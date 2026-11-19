import { Notification } from '../models/index.js';
import AppError from '../utils/AppError.js';

/**
 * Inserts a Notification idempotently using the { recipientUserId, dedupeKey } partial unique index.
 * Returns null if the exact notification was already created (duplicate prevention).
 */
export async function createNotificationIdempotent({
  recipientUserId,
  recipientRole,
  orderId = null,
  type = 'ORDER_STATUS',
  title,
  message,
  dedupeKey,
  metadata = {},
}) {
  if (!recipientUserId || !recipientRole || !title || !message) {
    return null;
  }

  if (dedupeKey) {
    try {
      const existing = await Notification.findOne({ recipientUserId, dedupeKey }).lean();
      if (existing) {
        return null;
      }

      const created = await Notification.create({
        recipientUserId,
        recipientRole,
        orderId,
        type,
        title,
        message,
        dedupeKey,
        metadata,
      });
      return created;
    } catch (err) {
      if (err?.code === 11000) {
        return null;
      }
      throw err;
    }
  }

  return Notification.create({
    recipientUserId,
    recipientRole,
    orderId,
    type,
    title,
    message,
    metadata,
  });
}

export async function listUserNotifications(userId, { unreadOnly = false, page = 1, limit = 25 } = {}) {
  const filter = { recipientUserId: userId };
  if (unreadOnly) filter.isRead = false;

  const skip = (page - 1) * limit;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientUserId: userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function markNotificationRead(notificationId, userId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientUserId: userId },
    { $set: { isRead: true } },
    { new: true }
  ).lean();

  if (!updated) {
    throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }

  const unreadCount = await Notification.countDocuments({
    recipientUserId: userId,
    isRead: false,
  });

  return { notification: updated, unreadCount };
}

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { recipientUserId: userId, isRead: false },
    { $set: { isRead: true } }
  );

  return {
    modifiedCount: result.modifiedCount || 0,
    unreadCount: 0,
  };
}
