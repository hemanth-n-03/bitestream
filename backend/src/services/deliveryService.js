import mongoose from 'mongoose';
import { DeliveryPartner, Order } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { calculateSphericalKm } from '../utils/geoHelpers.js';
import { clearAssignmentTimeout } from './deliveryAssignmentService.js';

export async function getPartnerProfile(userId) {
  const partner = await DeliveryPartner.findOne({ userId })
    .populate({
      path: 'activeOrderId',
      populate: [
        { path: 'restaurantId', select: 'name address location' },
        { path: 'customerId', select: 'name phone' },
      ],
    })
    .lean();

  if (!partner) {
    throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
  }
  return partner;
}

export async function updatePartnerAvailability(userId, targetStatus) {
  const partner = await DeliveryPartner.findOne({ userId });
  if (!partner) {
    throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
  }
  if (partner.availability === 'BUSY' || partner.activeOrderId) {
    throw new AppError(
      'Cannot change online/offline availability while an active delivery is in progress.',
      400,
      'PARTNER_BUSY'
    );
  }

  partner.availability =
    targetStatus || (partner.availability === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
  await partner.save();
  return partner;
}

export async function updatePartnerLocation(userId, coordinates) {
  const partner = await DeliveryPartner.findOneAndUpdate(
    { userId },
    {
      $set: {
        currentLocation: { type: 'Point', coordinates },
        lastLocationUpdatedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );
  if (!partner) {
    throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
  }
  return partner;
}

export async function getAvailableDeliveryTasks(userId) {
  const partner = await DeliveryPartner.findOne({ userId }).lean();
  if (!partner) {
    throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
  }

  const readyOrders = await Order.find({
    status: 'READY_FOR_PICKUP',
    deliveryPartnerId: null,
  })
    .populate('restaurantId', 'name address location')
    .populate('customerId', 'name phone')
    .sort({ createdAt: 1 })
    .lean();

  return readyOrders
    .map((order) => ({
      ...order,
      pickupDistanceKm: order.restaurantId?.location?.coordinates
        ? calculateSphericalKm(
            partner.currentLocation.coordinates,
            order.restaurantId.location.coordinates
          )
        : null,
    }))
    .sort((a, b) => (a.pickupDistanceKm ?? 999) - (b.pickupDistanceKm ?? 999));
}

export async function acceptDeliveryTask(userId, orderId) {
  clearAssignmentTimeout(orderId);
  const session = await mongoose.startSession();
  let assignedOrder = null;

  try {
    await session.withTransaction(async () => {
      const partner = await DeliveryPartner.findOne({ userId }).session(session);
      if (!partner) {
        throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
      }
      if (partner.availability !== 'ONLINE' || partner.activeOrderId) {
        throw new AppError(
          'Rider must be ONLINE without an active order to accept a new task.',
          400,
          'PARTNER_NOT_ELIGIBLE'
        );
      }

      const now = new Date();
      const claimedOrder = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: 'READY_FOR_PICKUP',
          deliveryPartnerId: null,
        },
        {
          $set: {
            deliveryPartnerId: partner._id,
            assignmentStatus: 'ACCEPTED',
            assignedAt: now,
            assignmentExpiresAt: null,
          },
          $inc: { assignmentAttempts: 1 },
          $push: {
            statusHistory: {
              status: 'READY_FOR_PICKUP',
              timestamp: now,
              updatedBy: userId,
              note: `Assigned to delivery partner ${partner.name}`,
            },
          },
        },
        { new: true, session }
      );

      if (!claimedOrder) {
        throw new AppError(
          'Order is no longer available for pickup assignment.',
          409,
          'TASK_UNAVAILABLE'
        );
      }

      const claimedPartner = await DeliveryPartner.findOneAndUpdate(
        {
          _id: partner._id,
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
        throw new AppError(
          'Rider became busy concurrently; cannot claim order.',
          409,
          'PARTNER_NOT_ELIGIBLE'
        );
      }

      assignedOrder = claimedOrder;
    });
  } finally {
    await session.endSession();
  }

  return Order.findById(assignedOrder._id)
    .populate('restaurantId', 'name address location')
    .populate('customerId', 'name phone')
    .populate('deliveryPartnerId', 'name phone vehicleType vehicleNumber currentLocation')
    .lean();
}

export async function getPartnerDeliveryHistory(userId, { page = 1, limit = 20 }) {
  const partner = await DeliveryPartner.findOne({ userId }).lean();
  if (!partner) {
    throw new AppError('Delivery partner profile not found', 404, 'PARTNER_NOT_FOUND');
  }

  const filter = { deliveryPartnerId: partner._id, status: 'DELIVERED' };
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('restaurantId', 'name address')
      .populate('customerId', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}
