import AppError from '../utils/AppError.js';

export const VALID_TRANSITIONS = {
  PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'REJECTED', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['PICKED_UP'],
  PICKED_UP: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const ROLE_ALLOWED_TARGET_STATUSES = {
  customer: ['CANCELLED'],
  restaurant: ['ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP'],
  delivery: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  admin: [
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ],
};

export function assertValidOrderTransition(currentStatus, nextStatus, actorRole) {
  if (currentStatus === nextStatus) {
    throw new AppError(
      `Order is already in "${currentStatus}" status.`,
      409,
      'DUPLICATE_STATE_TRANSITION'
    );
  }

  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw new AppError(
      `Invalid status transition from "${currentStatus}" to "${nextStatus}".`,
      400,
      'INVALID_STATE_TRANSITION'
    );
  }

  const roleAllowed = ROLE_ALLOWED_TARGET_STATUSES[actorRole] || [];
  if (!roleAllowed.includes(nextStatus)) {
    throw new AppError(
      `Role "${actorRole}" is not permitted to set order status to "${nextStatus}".`,
      403,
      'ROLE_TRANSITION_FORBIDDEN'
    );
  }
}
