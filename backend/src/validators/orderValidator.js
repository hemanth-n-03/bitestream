import { z } from 'zod';
import { ORDER_STATUSES } from '../models/index.js';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const orderIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid order ID format'),
});

export const createOrderSchema = z.object({
  restaurantId: z.string().regex(objectIdRegex, 'Valid restaurantId is required'),
  items: z
    .array(
      z.object({
        foodItemId: z.string().regex(objectIdRegex, 'Valid foodItemId is required'),
        quantity: z.coerce.number().int().min(1).max(25),
      })
    )
    .min(1, 'Order must include at least one item')
    .max(50),
  deliveryAddress: z.object({
    label: z.string().trim().max(60).default('Delivery Pin'),
    street: z.string().trim().min(3, 'Delivery street address is required').max(200),
    area: z.string().trim().max(80).default(''),
    city: z.string().trim().max(60).default('Mysuru'),
  }),
  deliveryLocation: z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  }),
  paymentMethod: z.enum(['COD']).default('COD'),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(['ALL', ...ORDER_STATUSES]).optional(),
  restaurantId: z.string().regex(objectIdRegex, 'Invalid restaurantId').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(240).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(240).optional(),
});

export const reassignOrderSchema = z.object({
  resetExcluded: z.boolean().optional(),
  releaseCurrentPartner: z.boolean().optional(),
  reason: z.string().trim().max(240).optional(),
});
