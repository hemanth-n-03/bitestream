import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Provide a Bearer token.', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError('Authentication token is missing.', 401, 'UNAUTHORIZED');
  }

  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.sub);

  if (!user) {
    throw new AppError('User belonging to this token no longer exists.', 401, 'UNAUTHORIZED');
  }
  if (!user.isActive) {
    throw new AppError('Account is deactivated. Contact support.', 403, 'ACCOUNT_DISABLED');
  }

  req.user = user;
  next();
});

export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new AppError(
        `Access denied for role "${req.user.role}". Required: ${allowedRoles.join(', ')}`,
        403,
        'FORBIDDEN'
      )
    );
  }
  return next();
};
