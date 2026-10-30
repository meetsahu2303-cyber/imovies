import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { rootDir, paymentProvider, env, isReviewDeployment } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import * as catalog from '../controllers/catalog.controller.js';
import * as booking from '../controllers/booking.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/error.js';
import { AppError } from '../utils/errors.js';
const router = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: env.NODE_ENV === 'test' ? 1000 : 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many sign-in attempts. Please try again in 15 minutes.',
    },
  },
});
const bookingLimit = rateLimit({
  windowMs: 60000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many booking attempts. Please wait a minute.',
    },
  },
});
router.get('/health', (req, res) => res.json({ status: 'ok', service: 'imovies-api' }));
router.get('/config', (req, res) =>
  res.json({
    paymentProvider,
    demo: paymentProvider === 'demo',
    review: isReviewDeployment,
    // Public review accounts are supplied privately to the reviewer, never embedded in the bundle.
    demoAccounts: env.NODE_ENV !== 'production',
    timezone: 'Asia/Kolkata',
    maxSeats: 8,
    holdMinutes: 5,
  }),
);
router.post('/auth/register', authLimit, validate(auth.registerSchema), auth.register);
router.post('/auth/login', authLimit, validate(auth.loginSchema), auth.login);
router.post('/auth/refresh', authLimit, auth.refresh);
router.post('/auth/logout', auth.logout);
router.post('/auth/session', authLimit, auth.session);
router.get('/auth/me', authenticate, auth.me);
router.patch('/auth/me', authenticate, auth.updateProfile);
router.get('/movies', catalog.movies);
router.get('/movies/:id', catalog.movie);
router.get('/theatres', catalog.theatres);
router.get('/shows', catalog.shows);
router.get('/shows/:id', catalog.show);
router.get('/metadata', catalog.metadata);
router.post('/shows/:id/holds', authenticate, bookingLimit, booking.hold);
router.delete('/shows/:id/holds', authenticate, booking.release);
router.post('/bookings', authenticate, bookingLimit, booking.create);
router.get('/bookings', authenticate, booking.history);
router.get('/bookings/:id', authenticate, booking.detail);
router.post('/bookings/:id/checkout', authenticate, bookingLimit, booking.checkout);
router.post('/bookings/:id/cancel', authenticate, bookingLimit, booking.cancel);
router.post('/payments/:id/demo', authenticate, bookingLimit, booking.payDemo);
router.get('/notifications', authenticate, booking.notifications);
router.post('/notifications/read', authenticate, booking.readNotifications);
router.use('/admin', authenticate, requireAdmin);
router.get('/admin/dashboard', admin.dashboard);
router.get('/admin/movies', async (req, res) => {
  const { Movie } = await import('../models/Movie.js');
  const { pagination } = await import('../utils/validation.js');
  const { page, limit } = pagination.parse(req.query);
  const [items, total] = await Promise.all([
    Movie.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Movie.countDocuments(),
  ]);
  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
router.post('/admin/movies', admin.saveMovie);
router.put('/admin/movies/:id', admin.saveMovie);
router.delete('/admin/movies/:id', admin.deleteMovie);
router.get('/admin/theatres', admin.listTheatres);
router.post('/admin/theatres', admin.saveTheatre);
router.put('/admin/theatres/:id', admin.saveTheatre);
router.delete('/admin/theatres/:id', admin.deleteTheatre);
router.get('/admin/shows', admin.listShows);
router.post('/admin/shows', admin.saveShow);
router.put('/admin/shows/:id', admin.saveShow);
router.delete('/admin/shows/:id', admin.deleteShow);
router.get('/admin/bookings', admin.listBookings);
router.post('/admin/bookings/:id/cancel', admin.adminCancel);
router.post('/admin/bookings/:id/refund-retry', admin.retryRefund);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
router.post('/admin/uploads', upload.single('image'), async (req, res) => {
  if (!req.file) throw new AppError(400, 'Select an image.');
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime))
    throw new AppError(400, 'Only real JPEG, PNG, or WebP images are accepted.');
  const filename = `${randomUUID()}.${type.ext}`;
  await writeFile(`${rootDir}/uploads/${filename}`, req.file.buffer, {
    flag: 'wx',
  });
  res.status(201).json({ url: `/uploads/${filename}` });
});
export default router;
