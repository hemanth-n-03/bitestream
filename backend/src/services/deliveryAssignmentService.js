import mongoose from 'mongoose';
import env from '../config/env.js';
import { DeliveryPartner, Order, Restaurant } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { calculateSphericalKm } from '../utils/geoHelpers.js';
import { createNotificationIdempotent } from './notificationService.js';

const activeOfferTimers = new Map();

export function clearAssignmentTimeout(orderId) {
  const key = orderId?.toString();
  if (!key) return;
  const handle = activeOfferTimers.get(key);
  if (handle) {
    clearTimeout(handle);
    activeOfferTimers.delete(key);
  }
}

export function clearAllAssignmentTimeouts() {
  for (const handle of activeOfferTimers.values()) {
    clearTimeout(handle);
  }
  activeOfferTimers.clear();
}

function scheduleAssignmentTimeout(orderId, partnerId, timeoutMs) {
  const key = orderId.toString();
  clearAssignmentTimeout(key);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return;

  const timer = setTimeout(() => {
    activeOfferTimers.delete(key);
    handleAssignmentTimeout(orderId, partnerId).catch((err) => {
      console.error(`[BiteStream Assignment] Timeout handler failed for ${key}:`, err.message);
    });
  }, timeoutMs);

  // Never block Node exit during graceful shutdown / test completion
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  activeOfferTimers.set(key, timer);
}

/**
 * Searches ONLINE, idle, active DeliveryPartner documents within `radiusMeters` using MongoDB $near.
 */
async function queryPartnersWithinRadius(coordinates, radiusMeters, excludedIds = []) {
  const excludedObjectIds = excludedIds
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id.toString()));

  const query = {
    availability: 'ONLINE',
    activeOrderId: null,
    ...(excludedObjectIds.length > 0 ? { _id: { $nin: excludedObjectIds } } : {}),
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: radiusMeters,
      },
    },
  };

  const rawCandidates = await DeliveryPartner.find(query)
    .populate('userId', 'isActive role')
    .limit(15)
    .lean();

  return rawCandidates.filter(
    (p) => p.userId && p.userId.isActive !== false && p.userId.role === 'delivery'
  );
}

/**
 * Automatically assigns the nearest eligible ONLINE DeliveryPartner to a READY_FOR_PICKUP order
 * using MongoDB $near geospatial queries and multi-document atomic transactions.
 */
export async function assignNearestDeliveryPartner(
  orderId,
  {
    actorUserId = null,
    radiusStepsMeters = env.deliveryRadiusStepsMeters,
    offerTimeoutMs = env.assignmentOfferTimeoutMs,
  } = {}
) {
  const order = await Order.findById(orderId)
    .populate('restaurantId', 'name ownerId address location')
    .lean();

  if (!order) {
    throw new AppError('Order not found for delivery assignment', 404, 'ORDER_NOT_FOUND');
  }
  if (order.status !== 'READY_FOR_PICKUP') {
    return {
      assigned: false,
      outcome: 'ORDER_NOT_READY',
      orderId: order._id.toString(),
      status: order.status,
      message: `Order status is "${order.status}", expected READY_FOR_PICKUP.`,
    };
  }
  if (order.deliveryPartnerId) {
    return {
      assigned: false,
      outcome: 'ALREADY_ASSIGNED',
      orderId: order._id.toString(),
      partnerId: order.deliveryPartnerId.toString(),
      message: 'Order already has an assigned delivery partner.',
    };
  }

  const restaurantCoords = order.restaurantId?.location?.coordinates;
  if (!Array.isArray(restaurantCoords) || restaurantCoords.length !== 2) {
    throw new AppError('Restaurant coordinates missing for geospatial dispatch', 400, 'GEO_MISSING');
  }

  const normalizedSteps = Array.isArray(radiusStepsMeters) && radiusStepsMeters.length > 0
    ? [...radiusStepsMeters].sort((a, b) => a - b)
    : env.deliveryRadiusStepsMeters;

  const triedPartnerIds = new Set(
    (order.excludedPartnerIds || []).filter(Boolean).map((id) => id.toString())
  );

  let totalCandidatesSeen = 0;
  let lastRadiusSearched = normalizedSteps[normalizedSteps.length - 1];

  for (const tierRadius of normalizedSteps) {
    lastRadiusSearched = tierRadius;
    const candidates = await queryPartnersWithinRadius(
      restaurantCoords,
      tierRadius,
      Array.from(triedPartnerIds)
    );
    totalCandidatesSeen += candidates.length;

    for (const candidate of candidates) {
      triedPartnerIds.add(candidate._id.toString());
      const distanceKm = calculateSphericalKm(
        candidate.currentLocation.coordinates,
        restaurantCoords
      );

      const session = await mongoose.startSession();
      let committedOrder = null;
      let committedPartner = null;

      try {
        await session.withTransaction(async () => {
          const now = new Date();
          const expiresAt =
            Number.isFinite(offerTimeoutMs) && offerTimeoutMs > 0
              ? new Date(now.getTime() + offerTimeoutMs)
              : null;

          const claimedOrder = await Order.findOneAndUpdate(
            {
              _id: order._id,
              status: 'READY_FOR_PICKUP',
              deliveryPartnerId: null,
            },
            {
              $set: {
                deliveryPartnerId: candidate._id,
                assignmentStatus: 'ASSIGNED',
                assignedAt: now,
                assignmentExpiresAt: expiresAt,
              },
              $inc: { assignmentAttempts: 1 },
              $push: {
                statusHistory: {
                  status: 'READY_FOR_PICKUP',
                  timestamp: now,
                  updatedBy: actorUserId,
                  note: `Auto-assigned nearest partner ${candidate.name} (${distanceKm.toFixed(
                    2
                  )} km away within ${(tierRadius / 1000).toFixed(1)} km)`,
                },
              },
            },
            { new: true, session }
          );

          if (!claimedOrder) {
            const stopErr = new Error('ORDER_ALREADY_CLAIMED');
            stopErr.code = 'ORDER_ALREADY_CLAIMED';
            throw stopErr;
          }

          const claimedPartner = await DeliveryPartner.findOneAndUpdate(
            {
              _id: candidate._id,
              availability: 'ONLINE',
              activeOrderId: null,
            },
            {
              $set: {
                availability: 'BUSY',
                activeOrderId: claimedOrder._id,
              },
            },
            { new: true, session }
          );

          if (!claimedPartner) {
            const raceErr = new Error('CANDIDATE_BUSY');
            raceErr.code = 'CANDIDATE_BUSY';
            throw raceErr;
          }

          committedOrder = claimedOrder;
          committedPartner = claimedPartner;
        });
      } catch (err) {
        if (err?.code === 'ORDER_ALREADY_CLAIMED') {
          await session.endSession();
          return {
            assigned: false,
            outcome: 'ORDER_ALREADY_CLAIMED',
            orderId: order._id.toString(),
            message: 'Order was claimed concurrently before auto-assignment completed.',
          };
        }
        if (err?.code === 'CANDIDATE_BUSY' || err?.code === 112) {
          await session.endSession();
          continue;
        }
        await session.endSession();
        throw err;
      }

      await session.endSession();

      if (committedOrder && committedPartner) {
        scheduleAssignmentTimeout(committedOrder._id, committedPartner._id, offerTimeoutMs);

        const populatedOrder = await Order.findById(committedOrder._id)
          .populate('customerId', 'name phone email')
          .populate('restaurantId', 'name address location')
          .populate('deliveryPartnerId', 'name phone vehicleType vehicleNumber currentLocation')
          .lean();

        return {
          assigned: true,
          outcome: 'ASSIGNED',
          order: populatedOrder,
          partnerId: committedPartner._id.toString(),
          partnerName: committedPartner.name,
          nearestDistanceKm: distanceKm,
          radiusSearchedMeters: tierRadius,
          searchRadiiMeters: normalizedSteps,
          candidateCount: totalCandidatesSeen,
          offerTimeoutMs,
          message: `Assigned ${committedPartner.name} (${distanceKm.toFixed(2)} km away)`,
        };
      }
    }
  }

  const noPartnerMsg = `No ONLINE delivery partner available within ${(
    lastRadiusSearched / 1000
  ).toFixed(1)} km of ${order.restaurantId.name}.`;

  await Order.findOneAndUpdate(
    { _id: order._id, status: 'READY_FOR_PICKUP', deliveryPartnerId: null },
    {
      $set: { assignmentStatus: 'NO_PARTNER_AVAILABLE' },
      $push: {
        statusHistory: {
          status: 'READY_FOR_PICKUP',
          timestamp: new Date(),
          updatedBy: actorUserId,
          note: noPartnerMsg,
        },
      },
    }
  );

  if (order.restaurantId?.ownerId) {
    await createNotificationIdempotent({
      recipientUserId: order.restaurantId.ownerId,
      recipientRole: 'restaurant',
      orderId: order._id,
      type: 'SYSTEM',
      title: `No rider available for ${order.orderNumber}`,
      message: `${noPartnerMsg} Order remains open in the delivery pool for pickup claim or retry.`,
      dedupeKey: `order:${order._id}:no_partner:${order.assignmentAttempts || 0}:${(order.excludedPartnerIds || []).length}`,
      metadata: { outcome: 'NO_PARTNER_AVAILABLE', radiusSearchedMeters: lastRadiusSearched },
    });
  }

  return {
    assigned: false,
    outcome: 'NO_PARTNER_AVAILABLE',
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    radiusSearchedMeters: lastRadiusSearched,
    searchRadiiMeters: normalizedSteps,
    candidateCount: totalCandidatesSeen,
    message: noPartnerMsg,
  };
}

export async function confirmAssignedTask(partnerUserId, orderId) {
  const partner = await DeliveryPartner.findOne({ userId: partnerUserId }).lean();
  if (!partner) {
    throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      deliveryPartnerId: partner._id,
      status: 'READY_FOR_PICKUP',
    },
    {
      $set: {
        assignmentStatus: 'ACCEPTED',
        assignmentExpiresAt: null,
      },
      $push: {
        statusHistory: {
          status: 'READY_FOR_PICKUP',
          timestamp: new Date(),
          updatedBy: partnerUserId,
          note: `${partner.name} confirmed pickup assignment`,
        },
      },
    },
    { new: true }
  )
    .populate('restaurantId', 'name address location')
    .populate('customerId', 'name phone')
    .populate('deliveryPartnerId', 'name phone vehicleType vehicleNumber currentLocation')
    .lean();

  if (!order) {
    throw new AppError(
      'No active unassigned/pending pickup assignment matches this partner.',
      409,
      'ASSIGNMENT_NOT_FOUND'
    );
  }

  clearAssignmentTimeout(order._id);
  return order;
}

export async function rejectAssignedTask(partnerUserId, orderId, reason = '') {
  clearAssignmentTimeout(orderId);
  const session = await mongoose.startSession();
  let partnerDoc = null;

  try {
    await session.withTransaction(async () => {
      const partner = await DeliveryPartner.findOne({ userId: partnerUserId }).session(session);
      if (!partner) {
        throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
      }

      const order = await Order.findOne({
        _id: orderId,
        deliveryPartnerId: partner._id,
      }).session(session);

      if (!order) {
        throw new AppError('This order is not assigned to you.', 403, 'OWNERSHIP_REQUIRED');
      }
      if (order.status !== 'READY_FOR_PICKUP') {
        throw new AppError(
          'Cannot decline an assignment after pickup has already started.',
          400,
          'PICKUP_ALREADY_STARTED'
        );
      }

      order.deliveryPartnerId = null;
      order.assignmentStatus = 'SEARCHING';
      order.assignedAt = null;
      order.assignmentExpiresAt = null;
      if (!order.excludedPartnerIds.some((id) => id.toString() === partner._id.toString())) {
        order.excludedPartnerIds.push(partner._id);
      }
      order.statusHistory.push({
        status: 'READY_FOR_PICKUP',
        timestamp: new Date(),
        updatedBy: partnerUserId,
        note: reason
          ? `Partner ${partner.name} declined assignment: ${reason}`
          : `Partner ${partner.name} declined assignment; searching next nearest rider`,
      });
      await order.save({ session });

      partner.availability = 'ONLINE';
      partner.activeOrderId = null;
      await partner.save({ session });
      partnerDoc = partner;
    });
  } finally {
    await session.endSession();
  }

  const reassignment = await assignNearestDeliveryPartner(orderId, {
    actorUserId: partnerUserId,
  });

  return {
    releasedPartnerId: partnerDoc?._id?.toString(),
    reassignment,
  };
}

export async function handleAssignmentTimeout(orderId, expectedPartnerId) {
  const session = await mongoose.startSession();
  let timedOut = false;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        status: 'READY_FOR_PICKUP',
        deliveryPartnerId: expectedPartnerId,
        assignmentStatus: 'ASSIGNED',
      }).session(session);

      if (!order) {
        return;
      }

      order.deliveryPartnerId = null;
      order.assignmentStatus = 'TIMED_OUT';
      order.assignedAt = null;
      order.assignmentExpiresAt = null;
      if (!order.excludedPartnerIds.some((id) => id.toString() === expectedPartnerId.toString())) {
        order.excludedPartnerIds.push(expectedPartnerId);
      }
      order.statusHistory.push({
        status: 'READY_FOR_PICKUP',
        timestamp: new Date(),
        updatedBy: null,
        note: 'Delivery assignment offer timed out; searching next nearest partner',
      });
      await order.save({ session });

      await DeliveryPartner.findOneAndUpdate(
        { _id: expectedPartnerId, activeOrderId: order._id },
        { $set: { availability: 'ONLINE', activeOrderId: null } },
        { session }
      );
      timedOut = true;
    });
  } finally {
    await session.endSession();
  }

  if (!timedOut) {
    return { timedOut: false, reassignment: null };
  }

  const reassignment = await assignNearestDeliveryPartner(orderId);
  return { timedOut: true, reassignment };
}

export async function reassignOrderDelivery(
  orderId,
  actorUser,
  { resetExcluded = false, releaseCurrentPartner = false, reason = '' } = {}
) {
  clearAssignmentTimeout(orderId);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      if (actorUser.role !== 'admin') {
        const restaurant = await Restaurant.findById(order.restaurantId).session(session);
        if (!restaurant || restaurant.ownerId.toString() !== actorUser._id.toString()) {
          throw new AppError(
            'You are not authorized to reassign this order.',
            403,
            'OWNERSHIP_REQUIRED'
          );
        }
      }

      if (order.status !== 'READY_FOR_PICKUP') {
        throw new AppError(
          'Reassignment is only allowed while the order is READY_FOR_PICKUP.',
          400,
          'INVALID_REASSIGN_STATE'
        );
      }

      if (order.deliveryPartnerId) {
        if (!releaseCurrentPartner) {
          throw new AppError(
            'Order already has an assigned rider. Pass releaseCurrentPartner=true to force reassignment.',
            409,
            'ORDER_ALREADY_ASSIGNED'
          );
        }
        const prevPartnerId = order.deliveryPartnerId;
        if (!order.excludedPartnerIds.some((id) => id.toString() === prevPartnerId.toString())) {
          order.excludedPartnerIds.push(prevPartnerId);
        }
        order.deliveryPartnerId = null;
        order.assignmentStatus = 'SEARCHING';
        order.assignedAt = null;
        order.assignmentExpiresAt = null;
        order.statusHistory.push({
          status: 'READY_FOR_PICKUP',
          timestamp: new Date(),
          updatedBy: actorUser._id,
          note: reason || 'Controlled delivery reassignment triggered before pickup',
        });

        await DeliveryPartner.findOneAndUpdate(
          { _id: prevPartnerId, activeOrderId: order._id },
          { $set: { availability: 'ONLINE', activeOrderId: null } },
          { session }
        );
      }

      if (resetExcluded) {
        order.excludedPartnerIds = [];
      }

      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return assignNearestDeliveryPartner(orderId, { actorUserId: actorUser._id });
}
