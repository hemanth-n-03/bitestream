import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { z } from 'zod';
import env from '../config/env.js';
import { DeliveryPartner, Order, Restaurant, User } from '../models/index.js';
import { partnerLocationSchema } from '../validators/deliveryValidator.js';

export const SOCKET_EVENTS = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_ACCEPTED: 'ORDER_ACCEPTED',
  ORDER_REJECTED: 'ORDER_REJECTED',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  DELIVERY_ASSIGNED: 'DELIVERY_ASSIGNED',
  DELIVERY_PARTNER_LOCATION_UPDATED: 'DELIVERY_PARTNER_LOCATION_UPDATED',
  DELIVERY_PICKED_UP: 'DELIVERY_PICKED_UP',
  DELIVERY_COMPLETED: 'DELIVERY_COMPLETED',
  RESTAURANT_STATUS_UPDATED: 'RESTAURANT_STATUS_UPDATED',
  NEW_NOTIFICATION: 'NEW_NOTIFICATION',
};

const joinRoomSchema = z.object({
  room: z.string().trim().min(3).max(96),
});

let ioInstance = null;
const partnerLastGpsWriteMs = new Map();

function buildAllowedOrigins() {
  const allowedOrigins = new Set([env.clientUrl]);
  if (env.nodeEnv === 'development' || env.nodeEnv === 'test') {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
  }
  return allowedOrigins;
}

function extractSocketToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.replace(/^Bearer\s+/i, '').trim();
  }
  const authHeader = socket.handshake.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function authorizeRoomSubscription(user, roomName) {
  if (roomName === 'admin') {
    return user.role === 'admin';
  }
  if (roomName === 'restaurants:catalog') {
    return true;
  }
  if (roomName === 'delivery:pool') {
    return user.role === 'delivery' || user.role === 'admin';
  }

  const colonIdx = roomName.indexOf(':');
  if (colonIdx === -1) return false;

  const prefix = roomName.slice(0, colonIdx);
  const targetId = roomName.slice(colonIdx + 1);

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return false;
  }

  if (prefix === 'user' || prefix === 'customer') {
    if (user.role === 'admin') return true;
    return user._id.toString() === targetId && (prefix === 'user' || user.role === 'customer');
  }

  if (prefix === 'restaurant') {
    if (user.role === 'admin') return true;
    if (user.role !== 'restaurant') return false;
    const owned = await Restaurant.exists({ _id: targetId, ownerId: user._id });
    return Boolean(owned);
  }

  if (prefix === 'delivery') {
    if (user.role === 'admin') return true;
    if (user.role !== 'delivery') return false;
    const owned = await DeliveryPartner.exists({ _id: targetId, userId: user._id });
    return Boolean(owned);
  }

  if (prefix === 'order') {
    if (user.role === 'admin') return true;
    const order = await Order.findById(targetId)
      .select('customerId restaurantId deliveryPartnerId')
      .lean();
    if (!order) return false;

    if (user.role === 'customer') {
      return order.customerId?.toString() === user._id.toString();
    }
    if (user.role === 'restaurant') {
      const restOwned = await Restaurant.exists({
        _id: order.restaurantId,
        ownerId: user._id,
      });
      return Boolean(restOwned);
    }
    if (user.role === 'delivery') {
      const partner = await DeliveryPartner.findOne({ userId: user._id }).select('_id').lean();
      return Boolean(partner && order.deliveryPartnerId?.toString() === partner._id.toString());
    }
    return false;
  }

  return false;
}

export function createRealtimeEnvelope(event, payload) {
  return {
    event,
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...payload,
  };
}

export function initSocketServer(httpServer) {
  const allowedOrigins = buildAllowedOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Socket.IO CORS origin not allowed'));
      },
      credentials: true,
    },
    pingInterval: 20000,
    pingTimeout: 15000,
  });

  // Strict JWT authentication — never trust client-supplied userId/role
  io.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) {
        return next(new Error('UNAUTHORIZED: Authentication token required'));
      }

      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(decoded.sub);

      if (!user || !user.isActive) {
        return next(new Error('UNAUTHORIZED: User account inactive or missing'));
      }

      socket.data.user = user;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED: Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    const userIdStr = user._id.toString();

    try {
      await socket.join(`user:${userIdStr}`);
      await socket.join('restaurants:catalog');

      if (user.role === 'customer') {
        await socket.join(`customer:${userIdStr}`);
      } else if (user.role === 'restaurant') {
        const ownedRestaurants = await Restaurant.find({ ownerId: user._id })
          .select('_id')
          .lean();
        for (const rest of ownedRestaurants) {
          await socket.join(`restaurant:${rest._id.toString()}`);
        }
      } else if (user.role === 'delivery') {
        const partner = await DeliveryPartner.findOne({ userId: user._id })
          .select('_id')
          .lean();
        if (partner) {
          socket.data.partnerId = partner._id.toString();
          await socket.join(`delivery:${partner._id.toString()}`);
        }
        await socket.join('delivery:pool');
      } else if (user.role === 'admin') {
        await socket.join('admin');
      }

      socket.emit('SOCKET_READY', {
        userId: userIdStr,
        role: user.role,
        partnerId: socket.data.partnerId || null,
        rooms: Array.from(socket.rooms).filter((r) => r !== socket.id),
      });
    } catch (err) {
      console.error('[BiteStream Socket] Failed initial room join:', err.message);
    }

    socket.on('join_room', async (rawPayload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const parsed = joinRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return reply({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Valid room identifier is required',
        });
      }

      const { room } = parsed.data;
      try {
        const allowed = await authorizeRoomSubscription(user, room);
        if (!allowed) {
          socket.emit('ROOM_ACCESS_DENIED', { room, code: 'FORBIDDEN_ROOM_ACCESS' });
          return reply({
            ok: false,
            code: 'FORBIDDEN_ROOM_ACCESS',
            message: `Not authorized to subscribe to room "${room}"`,
          });
        }

        await socket.join(room);
        return reply({ ok: true, room });
      } catch (err) {
        return reply({
          ok: false,
          code: 'ROOM_JOIN_FAILED',
          message: err.message,
        });
      }
    });

    socket.on('leave_room', async (rawPayload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const parsed = joinRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return reply({ ok: false, code: 'VALIDATION_ERROR' });
      }
      await socket.leave(parsed.data.room);
      return reply({ ok: true, room: parsed.data.room });
    });

    // Throttled live GPS ingestion from authenticated delivery partner only
    socket.on('delivery:location_update', async (rawPayload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};

      if (user.role !== 'delivery') {
        return reply({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Only delivery partners may publish GPS telemetry',
        });
      }

      const parsed = partnerLocationSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return reply({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Valid GeoJSON [longitude, latitude] coordinates are required',
        });
      }

      const now = Date.now();
      const throttleKey = userIdStr;
      const lastWriteAt = partnerLastGpsWriteMs.get(throttleKey) || 0;

      if (now - lastWriteAt < env.gpsDbWriteIntervalMs) {
        return reply({
          ok: true,
          persisted: false,
          throttled: true,
          retryAfterMs: env.gpsDbWriteIntervalMs - (now - lastWriteAt),
        });
      }

      try {
        partnerLastGpsWriteMs.set(throttleKey, now);
        const updated = await DeliveryPartner.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              currentLocation: { type: 'Point', coordinates: parsed.data.coordinates },
              lastLocationUpdatedAt: new Date(now),
            },
          },
          { new: true, runValidators: true }
        ).select('_id currentLocation lastLocationUpdatedAt');

        if (!updated) {
          return reply({ ok: false, code: 'PARTNER_NOT_FOUND' });
        }

        return reply({
          ok: true,
          persisted: true,
          throttled: false,
          coordinates: updated.currentLocation.coordinates,
          lastLocationUpdatedAt: updated.lastLocationUpdatedAt,
        });
      } catch (err) {
        return reply({
          ok: false,
          code: 'GPS_WRITE_FAILED',
          message: err.message,
        });
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getSocketServer() {
  return ioInstance;
}

export function emitSocketEvent(rooms, eventName, payload) {
  if (!ioInstance) return;
  const uniqueRooms = Array.from(new Set((Array.isArray(rooms) ? rooms : [rooms]).filter(Boolean)));
  if (uniqueRooms.length === 0) return;

  const envelope = createRealtimeEnvelope(eventName, payload);
  ioInstance.to(uniqueRooms).emit(eventName, envelope);
}

export async function closeSocketServer() {
  partnerLastGpsWriteMs.clear();
  if (ioInstance) {
    const closing = ioInstance;
    ioInstance = null;
    await new Promise((resolve) => {
      closing.close(() => resolve());
    });
  }
}

export function getSocketStats() {
  if (!ioInstance) {
    return { initialized: false, connectedClients: 0 };
  }
  return {
    initialized: true,
    connectedClients: ioInstance.engine?.clientsCount ?? ioInstance.of('/').sockets.size,
  };
}
