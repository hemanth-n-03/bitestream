import * as assignmentService from '../services/deliveryAssignmentService.js';
import * as orderService from '../services/orderService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createOrder = asyncHandler(async (req, res) => {
  const headerKey = req.headers['idempotency-key'];
  const result = await orderService.createOrderTransaction(req.user, req.body, headerKey);

  res.status(result.idempotentReplay ? 200 : 201).json({
    success: true,
    message: result.idempotentReplay
      ? 'Existing order returned (idempotent replay)'
      : 'Order placed successfully',
    data: {
      order: result.order,
      payment: result.payment,
      idempotentReplay: result.idempotentReplay,
    },
  });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getCustomerOrders(req.user._id, req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getRestaurantOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getRestaurantOrders(req.user, req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const result = await orderService.getOrderDetails(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.transitionOrderStatus(
    req.params.id,
    req.user,
    req.body.status,
    req.body.note
  );
  res.status(200).json({
    success: true,
    message: `Order updated to ${order.status}`,
    data: {
      order,
      ...(order.assignmentOutcome ? { assignment: order.assignmentOutcome } : {}),
    },
  });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.transitionOrderStatus(
    req.params.id,
    req.user,
    'CANCELLED',
    req.body?.reason || 'Cancelled by customer'
  );
  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order },
  });
});

export const reassignOrder = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.reassignOrderDelivery(
    req.params.id,
    req.user,
    req.body || {}
  );
  res.status(200).json({
    success: true,
    message: assignment.message,
    data: {
      assignment,
      order: assignment.order || null,
    },
  });
});
