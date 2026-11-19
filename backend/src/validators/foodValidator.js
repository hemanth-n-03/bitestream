import { z } from 'zod';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const optionalBool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
  .optional();

export const foodIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid food item ID format'),
});

export const listFoodQuerySchema = z.object({
  restaurantId: z.string().regex(objectIdRegex).optional(),
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
  vegOnly: optionalBool,
  availableOnly: optionalBool,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const ownerMenuQuerySchema = z.object({
  restaurantId: z.string().regex(objectIdRegex, 'Valid restaurantId is required'),
});

export const createFoodSchema = z.object({
  restaurantId: z.string().regex(objectIdRegex, 'Valid restaurantId is required'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  price: z.coerce.number().min(1, 'Price must be at least 1').max(50000),
  category: z.string().trim().min(2).max(60),
  isVeg: z.boolean().default(true),
  availability: z.boolean().default(true),
  bestseller: z.boolean().default(false),
  preparationTimeMins: z.coerce.number().int().min(3).max(120).default(15),
  image: z.string().trim().url().optional().or(z.literal('')),
});

export const updateFoodSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    price: z.coerce.number().min(1).max(50000).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    isVeg: z.boolean().optional(),
    availability: z.boolean().optional(),
    bestseller: z.boolean().optional(),
    preparationTimeMins: z.coerce.number().int().min(3).max(120).optional(),
    image: z.string().trim().url().optional().or(z.literal('')),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one updatable field must be provided',
  });

export const toggleAvailabilitySchema = z.object({
  availability: z.boolean().optional(),
});
