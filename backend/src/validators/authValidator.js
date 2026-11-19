import { z } from 'zod';

const geoPointInputSchema = z.object({
  type: z.literal('Point').default('Point'),
  coordinates: z
    .tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password cannot exceed 72 characters'),
  phone: z.string().trim().min(8, 'Valid phone number is required').max(20),
  role: z.enum(['customer', 'restaurant', 'delivery']).default('customer'),
  address: z
    .object({
      label: z.string().trim().optional(),
      street: z.string().trim().optional(),
      area: z.string().trim().optional(),
      city: z.string().trim().optional(),
      pincode: z.string().trim().optional(),
      location: geoPointInputSchema.optional(),
    })
    .optional(),
  vehicleType: z.string().trim().optional(),
  vehicleNumber: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  address: z
    .object({
      label: z.string().trim().optional(),
      street: z.string().trim().optional(),
      area: z.string().trim().optional(),
      city: z.string().trim().optional(),
      pincode: z.string().trim().optional(),
      location: geoPointInputSchema.optional(),
    })
    .optional(),
});
