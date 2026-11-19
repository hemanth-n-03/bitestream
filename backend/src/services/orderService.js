import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  DeliveryPartner,
  FoodItem,
  Order,
  Payment,
  Restaurant,
} from '../models/index.js';
import AppError from '../utils/AppError.js';
import { calculateSphericalKm } from '../utils/geoHelpers.js';
import { assignNearestDeliveryPartner, clearAssignmentTimeout } from './deliveryAssignmentService.js';
import { assertValidOrderTransition } from './orderStateService.js';

function generateOrderNumber() {
  const suffix = crypto.randomInt(1000, 9999);
  const stamp = Date.now().toString().slice(-4);
  return `BS-${stamp}${suffix}`;
}

export async function createOrderTransaction(customerUser, payload, headerIdempotencyKey) {
  const idempotencyKey =
    (payload.idempotencyKey || headerIdempotencyKey || '').trim() || undefined;

  if (idempotencyKey) {
    const existing = await Order.findOne({
      customerId: customerUser._id,
      idempotencyKey,
    })
      .populate('restaurantId', 'name address location')
      .lean();
    if (existing) {
      const payment = await Payment.findOne({ orderId: existing._id }).lean();
      return { order: existing, payment, idempotentReplay: true };
    }
  }

  const session = await mongoose.startSession();
  let createdOrder = null;
  let createdPayment = null;

  try {
    await session.withTransaction(async () => {
      const restaurant = await Restaurant.findById(payload.restaurantId).session(session);
      if (!restaurant || !restaurant.isActive) {
        throw new AppError('Selected restaurant was not found or is inactive.', 404, 'RESTAURANT_NOT_FOUND');
      }
      if (!restaurant.isOpen) {
        throw new AppError('Selected restaurant is currently closed.', 400, 'RESTAURANT_CLOSED');
      }

      // Merge duplicate foodItemId entries cleanly
      const qtyById = new Map();
      for (const entry of payload.items) {
        const prev = qtyById.get(entry.foodItemId) || 0;
        qtyById.set(entry.foodItemId, prev + entry.quantity);
      }

      const requestedIds = Array.from(qtyById.keys());
      const dbItems = await FoodItem.find({ _id: { $in: requestedIds } }).session(session);

      if (dbItems.length !== requestedIds.length) {
        throw new AppError('One or more requested menu items do not exist.', 400, 'INVALID_FOOD_ITEM');
      }

      const dbItemMap = new Map(dbItems.map((doc) => [doc._id.toString(), doc]));
      const orderItems = [];
      let itemsTotal = 0;

      for (const id of requestedIds) {
        const doc = dbItemMap.get(id);
        if (doc.restaurantId.toString() !== restaurant._id.toString()) {
          throw new AppError(
            `Item "${doc.name}" does not belong to ${restaurant.name}.`,
            400,
            'CROSS_RESTAURANT_ITEM'
          );
        }
        if (!doc.availability) {
          throw new AppError(
            `Item "${doc.name}" is currently out of stock.`,
            400,
            'ITEM_UNAVAILABLE'
          );
        }

        const quantity = qtyById.get(id);
        const subtotal = doc.price * quantity;
        itemsTotal += subtotal;

        orderItems.push({
          foodItemId: doc._id,
          name: doc.name,
          price: doc.price,
          quantity,
          subtotal,
        });
      }

      const deliveryFee = itemsTotal >= 399 ? 0 : 25;
      const taxAmount = Math.round(itemsTotal * 0.05);
      const totalAmount = itemsTotal + deliveryFee + taxAmount;
      const estimatedDistanceKm = calculateSphericalKm(
        restaurant.location.coordinates,
        payload.deliveryLocation.coordinates
      );

      const orderNumber = generateOrderNumber();

      const [orderDoc] = await Order.create(
        [
          {
            orderNumber,
            customerId: customerUser._id,
            restaurantId: restaurant._id,
            items: orderItems,
            itemsTotal,
            deliveryFee,
            taxAmount,
            totalAmount,
            deliveryAddress: payload.deliveryAddress,
            deliveryLocation: payload.deliveryLocation,
            status: 'PLACED',
            statusHistory: [
              {
                status: 'PLACED',
                timestamp: new Date(),
                updatedBy: customerUser._id,
                note: 'Order placed via Cash on Delivery',
              },
            ],
            paymentStatus: 'PENDING',
            estimatedDistanceKm,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        ],
        { session }
      );

      const [paymentDoc] = await Payment.create(
        [
          {
            orderId: orderDoc._id,
            customerId: customerUser._id,
            amount: totalAmount,
            currency: 'INR',
            method: 'COD',
            status: 'PENDING',
            transactionRef: `COD-${orderNumber}`,
          },
        ],
        { session }
      );

      createdOrder = orderDoc;
      createdPayment = paymentDoc;
    });
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({
        customerId: customerUser._id,
        idempotencyKey,
      })
        .populate('restaurantId', 'name address location')
        .lean();
      if (existing) {
        const payment = await Payment.findOne({ orderId: existing._id }).lean();
        return { order: existing, payment, idempotentReplay: true };
      }
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const populatedOrder = await Order.findById(createdOrder._id)
    .populate('restaurantId', 'name address location')
    .lean();

  return { order: populatedOrder, payment: createdPayment, idempotentReplay: false };
}

export async function getCustomerOrders(customerId, { status, page = 1, limit = 20 }) {
  const filter = { customerId };
  if (status && status !== 'ALL') filter.status = status;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate('restaurantId', 'name address location')
      .populate('deliveryPartnerId', 'name phone vehicleType vehicleNumber currentLocation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getRestaurantOrders(actorUser, { restaurantId, status, page = 1, limit = 25 }) {
  let targetRestaurantIds = [];

  if (actorUser.role === 'admin') {
    if (restaurantId) {
      targetRestaurantIds = [restaurantId];
    } else {
      const all = await Restaurant.find().select('_id').lean();
      targetRestaurantIds = all.map((r) => r._id);
    }
  } else {
    const owned = await Restaurant.find({ ownerId: actorUser._id }).select('_id').lean();
    const ownedIds = owned.map((r) => r._id.toString());
    if (restaurantId) {
      if (!ownedIds.includes(restaurantId)) {
        throw new AppError('You do not own this restaurant.', 403, 'OWNERSHIP_REQUIRED');
      }
      targetRestaurantIds = [restaurantId];
    } else {
      targetRestaurantIds = owned.map((r) => r._id);
    }
  }

  const filter = { restaurantId: { $in: targetRestaurantIds } };
  if (status && status !== 'ALL') filter.status = status;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate('customerId', 'name phone email')
      .populate('restaurantId', 'name address location')
      .populate('deliveryPartnerId', 'name phone vehicleType vehicleNumber currentLocation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getOrderDetails(orderId, actorUser) {
  const order = await Order.findById(orderId)
    .populate('customerId', 'name phone email')
    .populate('restaurantId', 'name ownerId address location')
    .populate('deliveryPartnerId', 'name phone userId vehicleType vehicleNumber currentLocation')
    .lean();

  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const uid = actorUser._id.toString();
  const isAdmin = actorUser.role === 'admin';
  const isCustomer = order.customerId?._id?.toString() === uid;
  const isRestOwner = order.restaurantId?.ownerId?.toString() === uid;
  const isAssignedRider = order.deliveryPartnerId?.userId?.toString() === uid;

  if (!isAdmin && !isCustomer && !isRestOwner && !isAssignedRider) {
    throw new AppError('You are not authorized to view this order.', 403, 'ORDER_ACCESS_DENIED');
  }

  const payment = await Payment.findOne({ orderId: order._id }).lean();
  return { order, payment };
}

export async function transitionOrderStatus(orderId, actorUser, nextStatus, note = '') {
  const session = await mongoose.startSession();
  let updatedOrder = null;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      // Ownership validation by role
      if (actorUser.role === 'customer') {
        if (order.customerId.toString() !== actorUser._id.toString()) {
          throw new AppError('You can only cancel your own orders.', 403, 'OWNERSHIP_REQUIRED');
        }
      } else if (actorUser.role === 'restaurant') {
        const restaurant = await Restaurant.findById(order.restaurantId).session(session);
        if (!restaurant || restaurant.ownerId.toString() !== actorUser._id.toString()) {
          throw new AppError(
            'You can only manage orders belonging to your own restaurant.',
            403,
            'OWNERSHIP_REQUIRED'
          );
        }
      } else if (actorUser.role === 'delivery') {
        const partner = await DeliveryPartner.findOne({ userId: actorUser._id }).session(session);
        if (
          !partner ||
          !order.deliveryPartnerId ||
          order.deliveryPartnerId.toString() !== partner._id.toString()
        ) {
          throw new AppError(
            'You can only update orders assigned to you.',
            403,
            'OWNERSHIP_REQUIRED'
          );
        }
      }

      assertValidOrderTransition(order.status, nextStatus, actorUser.role);

      order.status = nextStatus;
      order.statusHistory.push({
        status: nextStatus,
        timestamp: new Date(),
        updatedBy: actorUser._id,
        note: note || `Status updated to ${nextStatus}`,
      });

      if (nextStatus === 'CANCELLED') {
        clearAssignmentTimeout(order._id);
        order.cancellationReason = note || 'Cancelled by customer';
        order.paymentStatus = order.paymentStatus === 'PAID' ? 'REFUNDED' : 'FAILED';
        await Payment.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              status: order.paymentStatus === 'REFUNDED' ? 'REFUNDED' : 'FAILED',
            },
          },
          { session }
        );
        if (order.deliveryPartnerId) {
          await DeliveryPartner.findOneAndUpdate(
            { _id: order.deliveryPartnerId, activeOrderId: order._id },
            { $set: { availability: 'ONLINE', activeOrderId: null } },
            { session }
          );
          order.deliveryPartnerId = null;
          order.assignmentExpiresAt = null;
        }
      } else if (nextStatus === 'REJECTED') {
        clearAssignmentTimeout(order._id);
        order.cancellationReason = note || 'Rejected by restaurant';
        order.paymentStatus = order.paymentStatus === 'PAID' ? 'REFUNDED' : 'FAILED';
        await Payment.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              status: order.paymentStatus === 'REFUNDED' ? 'REFUNDED' : 'FAILED',
            },
          },
          { session }
        );
        if (order.deliveryPartnerId) {
          await DeliveryPartner.findOneAndUpdate(
            { _id: order.deliveryPartnerId, activeOrderId: order._id },
            { $set: { availability: 'ONLINE', activeOrderId: null } },
            { session }
          );
          order.deliveryPartnerId = null;
          order.assignmentExpiresAt = null;
        }
      } else if (nextStatus === 'READY_FOR_PICKUP') {
        order.assignmentStatus = 'SEARCHING';
      } else if (nextStatus === 'PICKED_UP') {
        clearAssignmentTimeout(order._id);
        order.assignmentStatus = 'ACCEPTED';
        order.assignmentExpiresAt = null;
      } else if (nextStatus === 'DELIVERED') {
        clearAssignmentTimeout(order._id);
        order.paymentStatus = 'PAID';
        await Payment.findOneAndUpdate(
          { orderId: order._id },
          { $set: { status: 'SUCCESS', paidAt: new Date() } },
          { session }
        );

        if (order.deliveryPartnerId) {
          await DeliveryPartner.findByIdAndUpdate(
            order.deliveryPartnerId,
            {
              $set: { availability: 'ONLINE', activeOrderId: null },
              $inc: { totalDeliveries: 1, totalEarnings: 55 },
            },
            { session }
          );
        }
      }

      await order.save({ session });
      updatedOrder = order;
    });
  } finally {
    await session.endSession();
  }

  let assignment = null;
  if (nextStatus === 'READY_FOR_PICKUP') {
    assignment = await assignNearestDeliveryPartner(updatedOrder._id, {
      actorUserId: actorUser._id,
    });
  }

  const finalOrder = await Order.findById(updatedOrder._id)
    .populate('customerId', 'name phone email')
    .populate('restaurantId', 'name address location')
    .populate('deliveryPartnerId', 'name phone vehicleType vehicleNumber currentLocation')
    .lean();

  if (assignment) {
    finalOrder.assignmentOutcome = {
      assigned: assignment.assigned,
      outcome: assignment.outcome,
      partnerId: assignment.partnerId ?? null,
      partnerName: assignment.partnerName ?? null,
      nearestDistanceKm: assignment.nearestDistanceKm ?? null,
      radiusSearchedMeters: assignment.radiusSearchedMeters ?? null,
      message: assignment.message,
    };
  }

  return finalOrder;
}
