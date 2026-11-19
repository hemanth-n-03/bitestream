import { z } from 'zod';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const taskOrderIdParamSchema = z.object({
  orderId: z.string().regex(objectIdRegex, 'Invalid order ID format'),
});

export const availabilityBodySchema = z.object({
  availability: z.enum(['ONLINE', 'OFFLINE']).optional(),
});

export const partnerLocationSchema = z.object({
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
});

export const adminOrdersQuerySchema = z.object({
  status: z.string().trim().optional(),
  restaurantId: z.string().regex(objectIdRegex).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const entityIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid ID format'),
});

export const toggleActiveSchema = z.object({
  isActive: z.boolean().optional(),
});

export const toggleOpenSchema = z.object({
  isOpen: z.boolean().optional(),
});

export const rejectTaskBodySchema = z.object({
  reason: z.string().trim().max(240).optional(),
});
