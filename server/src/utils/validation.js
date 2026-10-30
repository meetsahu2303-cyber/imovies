import { z } from 'zod';
import mongoose from 'mongoose';
export const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid resource ID');
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');
export const email = z.string().trim().email().max(254).toLowerCase();
export const dateString = z.string().datetime({ offset: true });
export const screenSchema = z.object({
  name: z.string().trim().min(1).max(60),
  rows: z.number().int().min(3).max(15),
  columns: z.number().int().min(4).max(18),
  aisleAfter: z.number().int().min(1).max(17),
  premiumFrom: z.number().int().min(1).max(15),
});
export function seatLayout(screen) {
  return Array.from({ length: screen.rows }, (_, r) =>
    Array.from({ length: screen.columns }, (_, c) => ({
      seatId: `${String.fromCharCode(65 + r)}${c + 1}`,
      row: String.fromCharCode(65 + r),
      number: c + 1,
      tier: r + 1 >= screen.premiumFrom ? 'premium' : 'standard',
    })),
  ).flat();
}
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
