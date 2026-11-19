import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import env from '../config/env.js';
import { DeliveryPartner, User } from '../models/index.js';
import AppError from '../utils/AppError.js';

const BCRYPT_ROUNDS = 12;
const DEFAULT_MYSURU_POINT = {
  type: 'Point',
  coordinates: [76.6394, 12.2958],
};

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function registerUser(payload) {
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
  const session = await mongoose.startSession();
  let createdUser;

  try {
    await session.withTransaction(async () => {
      const [userDoc] = await User.create(
        [
          {
            name: payload.name,
            email: payload.email,
            passwordHash,
            phone: payload.phone,
            role: payload.role,
            address: payload.address || {},
          },
        ],
        { session }
      );

      if (payload.role === 'delivery') {
        await DeliveryPartner.create(
          [
            {
              userId: userDoc._id,
              name: userDoc.name,
              phone: userDoc.phone,
              vehicleType: payload.vehicleType || 'Electric Scooter',
              vehicleNumber: payload.vehicleNumber || 'KA-09-EV-0000',
              availability: 'OFFLINE',
              currentLocation: payload.address?.location || DEFAULT_MYSURU_POINT,
            },
          ],
          { session }
        );
      }

      createdUser = userDoc;
    });
  } finally {
    await session.endSession();
  }

  const token = signToken(createdUser);
  return { user: createdUser, token };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Your account has been disabled.', 403, 'ACCOUNT_DISABLED');
  }

  const token = signToken(user);
  return { user, token };
}
