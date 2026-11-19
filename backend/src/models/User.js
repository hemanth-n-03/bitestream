import mongoose from 'mongoose';
import geoPointSchema from './geoPointSchema.js';

export const USER_ROLES = ['customer', 'restaurant', 'delivery', 'admin'];

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    street: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: 'Mysuru' },
    pincode: { type: String, trim: true, default: '' },
    location: { type: geoPointSchema, required: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      minlength: [8, 'Phone number is too short'],
      maxlength: [20, 'Phone number is too long'],
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'customer',
      index: true,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'users',
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const User = mongoose.model('User', userSchema);
export default User;
