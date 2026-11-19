import mongoose from 'mongoose';
import { USER_ROLES } from './User.js';

export const NOTIFICATION_TYPES = [
  'ORDER_PLACED',
  'ORDER_STATUS',
  'DELIVERY_ASSIGNED',
  'SYSTEM',
];

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'ORDER_STATUS',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: undefined,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: 'notifications',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ recipientUserId: 1, createdAt: -1 });
notificationSchema.index(
  { recipientUserId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
