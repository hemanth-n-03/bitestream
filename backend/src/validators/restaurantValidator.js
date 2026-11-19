import { z } from 'zod';

const optionalBool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
  .optional();

const coordLat = z.coerce
  .number({ invalid_type_error: 'latitude must be a valid number' })
  .min(-90, 'latitude must be >= -90')
  .max(90, 'latitude must be <= 90');

const coordLng = z.coerce
  .number({ invalid_type_error: 'longitude must be a valid number' })
  .min(-180, 'longitude must be >= -180')
  .max(180, 'longitude must be <= 180');

export const restaurantIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid restaurant ID format'),
});

export const nearbyQuerySchema = z.object({
  latitude: coordLat,
  longitude: coordLng,
  radius: z.coerce.number().min(0.1).max(100).default(15),
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(['distance', 'rating', 'fast']).default('distance'),
  vegOnly: optionalBool,
  openOnly: optionalBool,
  minRating: z.coerce.number().min(0).max(5).optional(),
  mode: z.enum(['geoNear', 'near', 'geoWithin']).default('geoNear'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const nearbyDetailQuerySchema = z
  .object({
    latitude: coordLat.optional(),
    longitude: coordLng.optional(),
  })
  .refine(
    (d) =>
      (d.latitude === undefined && d.longitude === undefined) ||
      (d.latitude !== undefined && d.longitude !== undefined),
    { message: 'Both latitude and longitude must be provided together' }
  );

export const menuQuerySchema = z.object({
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
  vegOnly: optionalBool,
  availableOnly: optionalBool,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    search: z.string().trim().max(80).optional(),
    category: z.string().trim().max(60).optional(),
    vegOnly: optionalBool,
    latitude: coordLat.optional(),
    longitude: coordLng.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine(
    (d) =>
      (d.latitude === undefined && d.longitude === undefined) ||
      (d.latitude !== undefined && d.longitude !== undefined),
    { message: 'Both latitude and longitude must be provided together' }
  );

export const updateRestaurantLocationSchema = z.object({
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  address: z
    .object({
      street: z.string().trim().min(2).optional(),
      area: z.string().trim().min(2).optional(),
      city: z.string().trim().min(2).optional(),
      pincode: z.string().trim().optional(),
    })
    .optional(),
});
