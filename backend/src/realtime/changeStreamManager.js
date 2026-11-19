import {
  DeliveryPartner,
  Notification,
  Order,
  Restaurant,
} from '../models/index.js';
import { createNotificationIdempotent } from '../services/notificationService.js';
import { emitSocketEvent, SOCKET_EVENTS } from './socketServer.js';

const WATCH_PIPELINE = [
  {
    $match: {
      operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
    },
  },
];

const MAX_RECENT_EVENT_IDS = 5000;
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 15000;

const recentEventIds = new Set();
const streamStates = new Map();
const activeStreams = new Map();
const reconnectTimers = new Map();
let isShuttingDown = false;

function rememberEventId(collectionName, changeId) {
  if (!changeId) return true;
  const serialized =
    typeof changeId === 'string'
      ? changeId
      : changeId._data || JSON.stringify(changeId);
  const key = `${collectionName}:${serialized}`;

  if (recentEventIds.has(key)) {
    return false;
  }

  recentEventIds.add(key);
  if (recentEventIds.size > MAX_RECENT_EVENT_IDS) {
    const oldestKey = recentEventIds.values().next().value;
    recentEventIds.delete(oldestKey);
  }
  return true;
}

function getStatusNotificationText(order) {
  const num = order.orderNumber;
  const restName = order.restaurantId?.name || 'the kitchen';
  const partnerName = order.deliveryPartnerId?.name || 'Your rider';

  switch (order.status) {
    case 'ACCEPTED':
      return {
        title: `Order ${num} accepted`,
        message: `${restName} accepted your order and will begin preparation shortly.`,
      };
    case 'PREPARING':
      return {
        title: `Preparing ${num}`,
        message: `${restName} is freshly preparing your food now.`,
      };
    case 'READY_FOR_PICKUP':
      return {
        title: `Order ${num} is ready for pickup`,
        message: `${restName} has packed your order and is matching a delivery partner.`,
      };
    case 'PICKED_UP':
      return {
        title: `Order ${num} picked up`,
        message: `${partnerName} has picked up your order from ${restName}.`,
      };
    case 'OUT_FOR_DELIVERY':
      return {
        title: `Order ${num} is on the way`,
        message: `${partnerName} is heading toward your delivery pin.`,
      };
    case 'DELIVERED':
      return {
        title: `Order ${num} delivered`,
        message: `Enjoy your meal from ${restName}! COD payment marked settled.`,
      };
    case 'REJECTED':
      return {
        title: `Order ${num} rejected`,
        message: `${restName} could not fulfill your order at this time.`,
      };
    case 'CANCELLED':
      return {
        title: `Order ${num} cancelled`,
        message: order.cancellationReason || 'Order was cancelled.',
      };
    default:
      return null;
  }
}

async function hydrateOrderForRealtime(orderId) {
  return Order.findById(orderId)
    .populate('customerId', 'name phone email')
    .populate('restaurantId', 'name ownerId address location')
    .populate('deliveryPartnerId', 'name phone userId vehicleType vehicleNumber currentLocation')
    .lean();
}

async function handleOrderChange(change) {
  const orderId = change.documentKey?._id;
  if (!orderId) return;

  if (change.operationType === 'delete') {
    emitSocketEvent(['admin'], SOCKET_EVENTS.ORDER_STATUS_UPDATED, {
      orderId: orderId.toString(),
      deleted: true,
    });
    return;
  }

  const order = await hydrateOrderForRealtime(orderId);
  if (!order) return;

  const customerUserId = (order.customerId?._id || order.customerId)?.toString();
  const restaurantId = (order.restaurantId?._id || order.restaurantId)?.toString();
  const restaurantOwnerId = order.restaurantId?.ownerId?.toString();
  const partnerId = (order.deliveryPartnerId?._id || order.deliveryPartnerId)?.toString();
  const partnerUserId = order.deliveryPartnerId?.userId?.toString();

  const baseRooms = [
    customerUserId ? `customer:${customerUserId}` : null,
    restaurantId ? `restaurant:${restaurantId}` : null,
    partnerId ? `delivery:${partnerId}` : null,
    'admin',
  ].filter(Boolean);

  const historyLen = Array.isArray(order.statusHistory) ? order.statusHistory.length : 0;

  if (change.operationType === 'insert') {
    emitSocketEvent(baseRooms, SOCKET_EVENTS.ORDER_CREATED, { order });

    if (customerUserId) {
      await createNotificationIdempotent({
        recipientUserId: customerUserId,
        recipientRole: 'customer',
        orderId: order._id,
        type: 'ORDER_PLACED',
        title: `Order ${order.orderNumber} placed`,
        message: `Sent to ${order.restaurantId?.name || 'restaurant'} (Total ₹${order.totalAmount} COD).`,
        dedupeKey: `order:${order._id}:insert:customer`,
      });
    }

    if (restaurantOwnerId) {
      await createNotificationIdempotent({
        recipientUserId: restaurantOwnerId,
        recipientRole: 'restaurant',
        orderId: order._id,
        type: 'ORDER_PLACED',
        title: `New incoming order ${order.orderNumber}`,
        message: `New order worth ₹${order.totalAmount} awaits kitchen acceptance.`,
        dedupeKey: `order:${order._id}:insert:restaurant`,
      });
    }
    return;
  }

  const updatedFields = change.updateDescription?.updatedFields || {};
  const isReplace = change.operationType === 'replace';
  const statusChanged = isReplace || updatedFields.status !== undefined;
  const partnerAssignedNow =
    Boolean(order.deliveryPartnerId) &&
    (isReplace || updatedFields.deliveryPartnerId !== undefined);
  const partnerUnassignedNow =
    !order.deliveryPartnerId &&
    'deliveryPartnerId' in updatedFields &&
    updatedFields.deliveryPartnerId === null;

  if (statusChanged) {
    const lifecycleEventMap = {
      ACCEPTED: SOCKET_EVENTS.ORDER_ACCEPTED,
      REJECTED: SOCKET_EVENTS.ORDER_REJECTED,
      CANCELLED: SOCKET_EVENTS.ORDER_CANCELLED,
      PICKED_UP: SOCKET_EVENTS.DELIVERY_PICKED_UP,
      DELIVERED: SOCKET_EVENTS.DELIVERY_COMPLETED,
    };

    const statusRooms = [...baseRooms];
    if (order.status === 'READY_FOR_PICKUP' && !order.deliveryPartnerId) {
      statusRooms.push('delivery:pool');
    }

    const specificEvent = lifecycleEventMap[order.status];
    if (specificEvent) {
      emitSocketEvent(statusRooms, specificEvent, { order, status: order.status });
    }
    emitSocketEvent(statusRooms, SOCKET_EVENTS.ORDER_STATUS_UPDATED, {
      order,
      status: order.status,
      assignmentOutcome: order.assignmentStatus || null,
    });

    const copy = getStatusNotificationText(order);
    if (copy && customerUserId) {
      await createNotificationIdempotent({
        recipientUserId: customerUserId,
        recipientRole: 'customer',
        orderId: order._id,
        type: 'ORDER_STATUS',
        title: copy.title,
        message: copy.message,
        dedupeKey: `order:${order._id}:status:${order.status}:h${historyLen}:cust`,
      });
    }

    if (
      restaurantOwnerId &&
      ['CANCELLED', 'PICKED_UP', 'DELIVERED'].includes(order.status)
    ) {
      await createNotificationIdempotent({
        recipientUserId: restaurantOwnerId,
        recipientRole: 'restaurant',
        orderId: order._id,
        type: 'ORDER_STATUS',
        title: `${order.orderNumber}: ${order.status}`,
        message: copy?.message || `Order status updated to ${order.status}`,
        dedupeKey: `order:${order._id}:status:${order.status}:h${historyLen}:rest`,
      });
    }

    if (
      partnerUserId &&
      ['CANCELLED', 'REJECTED', 'DELIVERED'].includes(order.status)
    ) {
      await createNotificationIdempotent({
        recipientUserId: partnerUserId,
        recipientRole: 'delivery',
        orderId: order._id,
        type: 'ORDER_STATUS',
        title: `${order.orderNumber}: ${order.status}`,
        message:
          order.status === 'DELIVERED'
            ? `Trip completed! +₹55 payout credited.`
            : `Order ${order.orderNumber} was ${order.status.toLowerCase()}.`,
        dedupeKey: `order:${order._id}:status:${order.status}:h${historyLen}:rider`,
      });
    }
  }

  if (partnerAssignedNow) {
    const partnerName = order.deliveryPartnerId?.name || 'Delivery Partner';
    emitSocketEvent([...baseRooms, 'delivery:pool'], SOCKET_EVENTS.DELIVERY_ASSIGNED, {
      order,
      partner: order.deliveryPartnerId,
    });

    if (customerUserId) {
      await createNotificationIdempotent({
        recipientUserId: customerUserId,
        recipientRole: 'customer',
        orderId: order._id,
        type: 'DELIVERY_ASSIGNED',
        title: `Rider assigned for ${order.orderNumber}`,
        message: `${partnerName} (${order.deliveryPartnerId?.vehicleNumber || 'Rider'}) is heading to pick up your order.`,
        dedupeKey: `order:${order._id}:assigned:${partnerId}:h${historyLen}:cust`,
      });
    }

    if (restaurantOwnerId) {
      await createNotificationIdempotent({
        recipientUserId: restaurantOwnerId,
        recipientRole: 'restaurant',
        orderId: order._id,
        type: 'DELIVERY_ASSIGNED',
        title: `Rider assigned for ${order.orderNumber}`,
        message: `${partnerName} has been dispatched for pickup.`,
        dedupeKey: `order:${order._id}:assigned:${partnerId}:h${historyLen}:rest`,
      });
    }

    if (partnerUserId) {
      await createNotificationIdempotent({
        recipientUserId: partnerUserId,
        recipientRole: 'delivery',
        orderId: order._id,
        type: 'DELIVERY_ASSIGNED',
        title: `New pickup assigned: ${order.orderNumber}`,
        message: `Pick up from ${order.restaurantId?.name || 'kitchen'} (${order.restaurantId?.address?.area || 'Mysuru'}).`,
        dedupeKey: `order:${order._id}:assigned:${partnerId}:h${historyLen}:rider`,
      });
    }
  } else if (
    partnerUnassignedNow ||
    updatedFields.assignmentStatus === 'NO_PARTNER_AVAILABLE' ||
    updatedFields.assignmentStatus === 'TIMED_OUT'
  ) {
    emitSocketEvent([...baseRooms, 'delivery:pool'], SOCKET_EVENTS.ORDER_STATUS_UPDATED, {
      order,
      status: order.status,
      assignmentOutcome: order.assignmentStatus,
    });
  }
}

async function handleRestaurantChange(change) {
  const restaurantId = change.documentKey?._id?.toString();
  if (!restaurantId) return;

  if (change.operationType === 'delete') {
    emitSocketEvent(
      [`restaurant:${restaurantId}`, 'admin', 'restaurants:catalog'],
      SOCKET_EVENTS.RESTAURANT_STATUS_UPDATED,
      { restaurantId, deleted: true }
    );
    return;
  }

  const doc = change.fullDocument;
  if (!doc) return;

  emitSocketEvent(
    [`restaurant:${restaurantId}`, 'admin', 'restaurants:catalog'],
    SOCKET_EVENTS.RESTAURANT_STATUS_UPDATED,
    {
      restaurantId,
      restaurant: doc,
      isOpen: doc.isOpen,
      isActive: doc.isActive,
      location: doc.location,
    }
  );
}

async function handleDeliveryPartnerChange(change) {
  const partnerId = change.documentKey?._id?.toString();
  if (!partnerId || change.operationType === 'delete') return;

  const partner = change.fullDocument;
  if (!partner) return;

  const targetRooms = [`delivery:${partnerId}`, 'admin'];

  // Enforce strict location privacy: share GPS only with customer/kitchen of an active order
  if (partner.activeOrderId) {
    const activeOrder = await Order.findById(partner.activeOrderId)
      .select('customerId restaurantId status orderNumber')
      .lean();

    if (
      activeOrder &&
      !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(activeOrder.status)
    ) {
      if (activeOrder.customerId) {
        targetRooms.push(`customer:${activeOrder.customerId.toString()}`);
      }
      if (activeOrder.restaurantId) {
        targetRooms.push(`restaurant:${activeOrder.restaurantId.toString()}`);
      }
    }
  }

  emitSocketEvent(targetRooms, SOCKET_EVENTS.DELIVERY_PARTNER_LOCATION_UPDATED, {
    partnerId,
    orderId: partner.activeOrderId ? partner.activeOrderId.toString() : null,
    availability: partner.availability,
    coordinates: partner.currentLocation?.coordinates || null,
    lastLocationUpdatedAt: partner.lastLocationUpdatedAt,
    totalDeliveries: partner.totalDeliveries,
    totalEarnings: partner.totalEarnings,
  });
}

async function handleNotificationChange(change) {
  if (change.operationType !== 'insert') return;
  const notification = change.fullDocument;
  if (!notification || !notification.recipientUserId) return;

  emitSocketEvent(
    [`user:${notification.recipientUserId.toString()}`],
    SOCKET_EVENTS.NEW_NOTIFICATION,
    { notification }
  );
}

const STREAM_SPECS = [
  { name: 'orders', model: Order, handler: handleOrderChange },
  { name: 'restaurants', model: Restaurant, handler: handleRestaurantChange },
  { name: 'delivery_partners', model: DeliveryPartner, handler: handleDeliveryPartnerChange },
  { name: 'notifications', model: Notification, handler: handleNotificationChange },
];

function isInvalidResumeTokenError(err) {
  const code = err?.code;
  const msg = err?.message || '';
  return (
    code === 260 ||
    code === 280 ||
    code === 286 ||
    /resume|ChangeStreamHistoryLost|invalidate/i.test(msg)
  );
}

function scheduleReconnect(spec, delayMs) {
  if (isShuttingDown) return;
  if (reconnectTimers.has(spec.name)) return;

  const state = streamStates.get(spec.name) || {};
  state.status = 'reconnecting';
  state.reconnectCount = (state.reconnectCount || 0) + 1;
  streamStates.set(spec.name, state);

  const timer = setTimeout(() => {
    reconnectTimers.delete(spec.name);
    if (!isShuttingDown) {
      openSingleStream(spec, Math.min(delayMs * 2, MAX_RECONNECT_MS)).catch((err) => {
        console.error(`[BiteStream ChangeStream:${spec.name}] Reconnect failed:`, err.message);
      });
    }
  }, delayMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  reconnectTimers.set(spec.name, timer);
}

async function closeStreamSilently(stream) {
  if (!stream) return;
  try {
    stream.removeAllListeners();
    await stream.close();
  } catch {
    // Ignore close errors during teardown
  }
}

async function openSingleStream(spec, backoffMs = BASE_RECONNECT_MS) {
  if (isShuttingDown) return null;

  const prev = activeStreams.get(spec.name);
  if (prev) {
    await closeStreamSilently(prev);
    activeStreams.delete(spec.name);
  }

  const prevState = streamStates.get(spec.name) || {
    collection: spec.name,
    eventsProcessed: 0,
    reconnectCount: 0,
    hasResumeToken: false,
    lastEventAt: null,
    lastError: null,
  };

  const options = {
    fullDocument: 'updateLookup',
    ...(prevState.resumeToken ? { resumeAfter: prevState.resumeToken } : {}),
  };

  const stream = spec.model.watch(WATCH_PIPELINE, options);
  activeStreams.set(spec.name, stream);

  prevState.status = 'watching';
  streamStates.set(spec.name, prevState);

  stream.on('change', async (change) => {
    const state = streamStates.get(spec.name);
    if (change._id && state) {
      state.resumeToken = change._id;
      state.hasResumeToken = true;
    }

    if (!rememberEventId(spec.name, change._id)) {
      return;
    }

    try {
      await spec.handler(change);
      if (state) {
        state.eventsProcessed += 1;
        state.lastEventAt = new Date().toISOString();
        state.lastError = null;
      }
    } catch (err) {
      console.error(`[BiteStream ChangeStream:${spec.name}] Handler error:`, err.message);
      if (state) {
        state.lastError = err.message;
      }
    }
  });

  stream.on('error', async (err) => {
    const state = streamStates.get(spec.name);
    if (state) {
      state.lastError = err?.message || 'Change stream error';
    }
    if (isInvalidResumeTokenError(err) && state) {
      state.resumeToken = null;
      state.hasResumeToken = false;
    }
    console.warn(`[BiteStream ChangeStream:${spec.name}] Error encountered:`, err?.message);
    await closeStreamSilently(stream);
    if (activeStreams.get(spec.name) === stream) {
      activeStreams.delete(spec.name);
    }
    if (!isShuttingDown) {
      scheduleReconnect(spec, backoffMs);
    }
  });

  stream.on('close', () => {
    if (activeStreams.get(spec.name) === stream) {
      activeStreams.delete(spec.name);
      if (!isShuttingDown) {
        scheduleReconnect(spec, backoffMs);
      }
    }
  });

  // Wait briefly until underlying cursor is initialized on server
  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const timer = setTimeout(done, 450);
    if (typeof timer.unref === 'function') timer.unref();
    stream.once('init', () => {
      clearTimeout(timer);
      done();
    });
    stream.once('error', () => {
      clearTimeout(timer);
      done();
    });
  });

  return stream;
}

export async function startChangeStreams() {
  isShuttingDown = false;
  await Promise.all(STREAM_SPECS.map((spec) => openSingleStream(spec)));
  console.log(
    `[BiteStream ChangeStreams] Watching ${STREAM_SPECS.map((s) => s.name).join(', ')} with resume tokens.`
  );
  return getChangeStreamStatus();
}

export async function stopChangeStreams() {
  isShuttingDown = true;
  for (const timer of reconnectTimers.values()) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();

  const closings = Array.from(activeStreams.entries()).map(async ([name, stream]) => {
    await closeStreamSilently(stream);
    const state = streamStates.get(name);
    if (state) {
      state.status = 'stopped';
    }
  });
  await Promise.all(closings);
  activeStreams.clear();
  recentEventIds.clear();
}

/**
 * Triggers a controlled stream interruption for integration testing of reconnection recovery.
 */
export async function triggerStreamErrorRecovery(collectionName, reason = 'Simulated network disconnect') {
  const stream = activeStreams.get(collectionName);
  const spec = STREAM_SPECS.find((s) => s.name === collectionName);
  if (!stream || !spec) {
    throw new Error(`No active change stream for collection "${collectionName}"`);
  }
  stream.emit('error', new Error(reason));
  return getChangeStreamStatus();
}

export function getChangeStreamStatus() {
  return STREAM_SPECS.map((spec) => {
    const s = streamStates.get(spec.name) || {
      collection: spec.name,
      status: 'stopped',
      eventsProcessed: 0,
      reconnectCount: 0,
      hasResumeToken: false,
      lastEventAt: null,
      lastError: null,
    };
    return {
      collection: s.collection,
      status: s.status,
      eventsProcessed: s.eventsProcessed,
      reconnectCount: s.reconnectCount,
      hasResumeToken: s.hasResumeToken,
      lastEventAt: s.lastEventAt,
      lastError: s.lastError,
    };
  });
}
