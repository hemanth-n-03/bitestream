import mongoose from 'mongoose';
import geoPointSchema from './geoPointSchema.js';

export const PARTNER_AVAILABILITY = ['OFFLINE', 'ONLINE', 'BUSY'];

const deliveryPartnerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Partner name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Partner phone is required'],
      trim: true,
    },
    vehicleType: {
      type: String,
      trim: true,
      default: 'Electric Scooter',
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: 'KA-09-EV-0000',
    },
    availability: {
      type: String,
      enum: PARTNER_AVAILABILITY,
      default: 'OFFLINE',
      index: true,
    },
    currentLocation: {
      type: geoPointSchema,
      required: [true, 'GeoJSON currentLocation is required'],
    },
    activeOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    lastLocationUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 0,
      max: 5,
    },
  },
  {
    collection: 'delivery_partners',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

deliveryPartnerSchema.index({ currentLocation: '2dsphere' });
deliveryPartnerSchema.index({ availability: 1, activeOrderId: 1 });

const DeliveryPartner = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
export default DeliveryPartner;
