import mongoose from 'mongoose';
import geoPointSchema from './geoPointSchema.js';

const restaurantSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Restaurant ownerId is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
      minlength: [2, 'Restaurant name must be at least 2 characters'],
      maxlength: [120, 'Restaurant name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Restaurant description is required'],
      trim: true,
      maxlength: [600, 'Description cannot exceed 600 characters'],
    },
    cuisineTypes: {
      type: [String],
      default: [],
    },
    address: {
      street: { type: String, required: true, trim: true },
      area: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true, default: 'Mysuru' },
      pincode: { type: String, trim: true, default: '' },
    },
    location: {
      type: geoPointSchema,
      required: [true, 'GeoJSON Point location is required'],
    },
    openingHours: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '22:30' },
      days: {
        type: [String],
        default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
    },
    rating: {
      average: { type: Number, default: 4.5, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    prepTimeMins: {
      type: Number,
      default: 18,
      min: 5,
      max: 120,
    },
    priceForTwo: {
      type: Number,
      default: 350,
      min: 50,
    },
    isVegOnly: {
      type: Boolean,
      default: false,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    featuredTag: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
  },
  {
    collection: 'restaurants',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ name: 'text', 'address.area': 'text', cuisineTypes: 'text' });

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
export default Restaurant;
