import * as assignmentService from '../services/deliveryAssignmentService.js';
import * as deliveryService from '../services/deliveryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getPartnerProfile = asyncHandler(async (req, res) => {
  const partner = await deliveryService.getPartnerProfile(req.user._id);
  res.status(200).json({
    success: true,
    message: 'Delivery partner portal access granted',
    data: { partner },
  });
});

export const toggleAvailability = asyncHandler(async (req, res) => {
  const partner = await deliveryService.updatePartnerAvailability(
    req.user._id,
    req.body?.availability
  );
  res.status(200).json({
    success: true,
    message: `Rider status updated to ${partner.availability}`,
    data: { partner },
  });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const partner = await deliveryService.updatePartnerLocation(
    req.user._id,
    req.body.coordinates
  );
  res.status(200).json({
    success: true,
    message: 'Rider GeoJSON location updated',
    data: { partner },
  });
});

export const getAvailableTasks = asyncHandler(async (req, res) => {
  const tasks = await deliveryService.getAvailableDeliveryTasks(req.user._id);
  res.status(200).json({
    success: true,
    data: { tasks },
  });
});

export const acceptTask = asyncHandler(async (req, res) => {
  const order = await deliveryService.acceptDeliveryTask(req.user._id, req.params.orderId);
  res.status(200).json({
    success: true,
    message: `Accepted delivery task ${order.orderNumber}`,
    data: { order },
  });
});

export const confirmTask = asyncHandler(async (req, res) => {
  const order = await assignmentService.confirmAssignedTask(req.user._id, req.params.orderId);
  res.status(200).json({
    success: true,
    message: `Confirmed pickup assignment for ${order.orderNumber}`,
    data: { order },
  });
});

export const rejectTask = asyncHandler(async (req, res) => {
  const result = await assignmentService.rejectAssignedTask(
    req.user._id,
    req.params.orderId,
    req.body?.reason
  );
  res.status(200).json({
    success: true,
    message: result.reassignment?.assigned
      ? `Task declined and reassigned to ${result.reassignment.partnerName}`
      : 'Task declined; awaiting next available rider',
    data: result,
  });
});

export const getDeliveryHistory = asyncHandler(async (req, res) => {
  const result = await deliveryService.getPartnerDeliveryHistory(req.user._id, req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});
