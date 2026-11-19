import mongoose from 'mongoose';
import geoPointSchema from './geoPointSchema.js';

export const ORDER_STATUSES = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

const orderItemSchema = new mongoose.Schema(
  {
    foodItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodItem',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      default: null,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    itemsTotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryAddress: {
      label: { type: String, trim: true, default: 'Delivery Pin' },
      street: { type: String, required: true, trim: true },
      area: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: 'Mysuru' },
    },
    deliveryLocation: {
      type: geoPointSchema,
      required: [true, 'GeoJSON deliveryLocation is required'],
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'PLACED',
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'PENDING',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    estimatedDistanceKm: {
      type: Number,
      default: null,
    },
    assignmentStatus: {
      type: String,
      enum: ['NONE', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'NO_PARTNER_AVAILABLE', 'TIMED_OUT'],
      default: 'NONE',
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    assignmentExpiresAt: {
      type: Date,
      default: null,
    },
    assignmentAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    excludedPartnerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner' }],
      default: [],
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: undefined,
    },
  },
  {
    collection: 'orders',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

orderSchema.index({ deliveryLocation: '2dsphere' });
orderSchema.index({ createdAt: -1 });
orderSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
