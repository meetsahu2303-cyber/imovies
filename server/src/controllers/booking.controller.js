import { z } from 'zod';
import QRCode from 'qrcode';
import { Booking, Payment } from '../models/Booking.js';
import { Show } from '../models/Show.js';
import { Notification } from '../models/Notification.js';
import {
  holdSeats,
  releaseHold,
  createBooking,
  confirmPayment,
  failDemoPayment,
  cancelBooking,
} from '../services/booking.service.js';
import { getCheckout } from '../services/payment.service.js';
import { objectId, pagination } from '../utils/validation.js';
import { assert } from '../utils/errors.js';
import { paymentProvider } from '../config/env.js';
export async function hold(req, res) {
  const { seatIds } = z
    .object({
      seatIds: z
        .array(z.string().regex(/^[A-O]([1-9]|1[0-8])$/))
        .min(1)
        .max(8),
    })
    .parse(req.body);
  res.status(201).json(await holdSeats(req.params.id, req.user._id, seatIds));
}
export async function release(req, res) {
  res.json(await releaseHold(req.params.id, req.body.holdId, req.user._id));
}
export async function create(req, res) {
  const data = z
    .object({
      showId: objectId,
      holdId: z.string().uuid(),
      idempotencyKey: z.string().uuid(),
    })
    .parse(req.body);
  const booking = await createBooking(req.user._id, data);
  const payment = await Payment.findOne({
    booking: booking._id,
    status: 'pending',
  }).sort({ createdAt: -1 });
  res.status(201).json({ booking, payment });
}
export async function history(req, res) {
  const { page, limit, scope } = pagination
    .extend({ scope: z.enum(['all', 'upcoming', 'past']).default('all') })
    .parse(req.query);
  const filter = { user: req.user._id };
  if (scope === 'upcoming') {
    filter.startsAt = { $gte: new Date() };
    filter.status = { $in: ['confirmed', 'pending'] };
  }
  if (scope === 'past')
    filter.$or = [{ startsAt: { $lt: new Date() } }, { status: { $in: ['cancelled', 'expired'] } }];
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
export async function detail(req, res) {
  const booking = await Booking.findOne({
    _id: req.params.id,
    ...(req.user.role === 'admin' ? {} : { user: req.user._id }),
  }).lean();
  assert(booking, 404, 'Booking not found.');
  const payments = await Payment.find({ booking: booking._id })
    .select('-checkoutUrl -providerRef -paymentIntent')
    .sort({ createdAt: -1 })
    .lean();
  const qr =
    booking.status === 'confirmed'
      ? await QRCode.toDataURL(`IMOVIES:${booking.reference}:${booking._id}`, {
          margin: 1,
          width: 200,
        })
      : null;
  res.json({ booking, payments, qr });
}
export async function checkout(req, res) {
  const payment = await Payment.findOne({
    booking: req.params.id,
    user: req.user._id,
    status: 'pending',
  }).sort({ createdAt: -1 });
  assert(payment, 409, 'No pending payment. Your reservation may have expired.');
  res.json(await getCheckout(payment._id, req.user._id));
}
export async function payDemo(req, res) {
  assert(paymentProvider === 'demo', 403, 'Demo payments are disabled.');
  const { outcome } = z.object({ outcome: z.enum(['success', 'failure']) }).parse(req.body);
  const payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user._id,
    provider: 'demo',
    status: 'pending',
  });
  assert(payment, 409, 'This payment is no longer pending.');
  if (outcome === 'failure') return res.json(await failDemoPayment(payment._id, req.user._id));
  const booking = await confirmPayment({
    paymentId: payment._id,
    provider: 'demo',
    providerRef: `demo_${payment._id}`,
  });
  res.json({ booking });
}
export async function cancel(req, res) {
  res.json({ booking: await cancelBooking(req.params.id, req.user) });
}
export async function notifications(req, res) {
  const items = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ items, unread: items.filter((n) => !n.read).length });
}
export async function readNotifications(req, res) {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
}
