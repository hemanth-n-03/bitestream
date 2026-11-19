import * as notificationService from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.listUserNotifications(req.user._id, req.query);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const readNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.markNotificationRead(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: result,
  });
});

export const readAllNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(req.user._id);
  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data: result,
  });
});
