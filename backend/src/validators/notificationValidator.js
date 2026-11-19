import { z } from 'zod';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const notificationIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid notification ID format'),
});

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
