import mongoose from 'mongoose';
import { randomUUID, randomBytes } from 'node:crypto';
import { Show, publicSeats } from '../models/Show.js';
import { Booking } from '../models/Booking.js';
import { Payment, WebhookEvent } from '../models/Booking.js';
import { Movie } from '../models/Movie.js';
import { Theatre } from '../models/Theatre.js';
import { Notification } from '../models/Notification.js';
import { AppError, assert } from '../utils/errors.js';
import { quoteSeats, MAX_SEATS } from '../utils/money.js';
import { emitSeats, emitBooking, emitNotification } from '../realtime/events.js';
import { paymentProvider } from '../config/env.js';
import { refundStripePayment } from './payment.service.js';
import { logger } from '../utils/logger.js';
export const HOLD_MS = 5 * 60000;
const availableCondition = (now) => ({
  $or: [{ status: 'available' }, { status: 'held', holdUntil: { $lte: now } }],
});
const availableSeatUpdate = {
  $set: { 'seats.$[s].status': 'available' },
  $unset: {
    'seats.$[s].holdId': '',
    'seats.$[s].holdOwner': '',
    'seats.$[s].holdUntil': '',
    'seats.$[s].booking': '',
  },
};
async function transaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
    );
    return result;
  } finally {
    await session.endSession();
  }
}
export async function holdSeats(showId, userId, seatIds) {
  assert(
    new Set(seatIds).size === seatIds.length && seatIds.length > 0 && seatIds.length <= MAX_SEATS,
    400,
    `Choose between 1 and ${MAX_SEATS} distinct seats.`,
  );
  const now = new Date(),
    holdId = randomUUID(),
    holdUntil = new Date(+now + HOLD_MS);
  // Match ALL requested seats as available/expired before modifying any: no partial holds.
  const show = await Show.findOneAndUpdate(
    {
      _id: showId,
      status: 'scheduled',
      startsAt: { $gt: now },
      seats: {
        $all: seatIds.map((id) => ({
          $elemMatch: { seatId: id, ...availableCondition(now) },
        })),
      },
    },
    {
      $set: {
        'seats.$[s].status': 'held',
        'seats.$[s].holdId': holdId,
        'seats.$[s].holdOwner': userId,
        'seats.$[s].holdUntil': holdUntil,
      },
      $unset: { 'seats.$[s].booking': '' },
    },
    { new: true, arrayFilters: [{ 's.seatId': { $in: seatIds } }] },
  );
  if (!show) {
    const exists = await Show.exists({ _id: showId });
    throw new AppError(
      exists ? 409 : 404,
      exists
        ? 'One or more seats are no longer available. Please choose again.'
        : 'Show not found.',
      'SEATS_UNAVAILABLE',
    );
  }
  emitSeats(showId);
  return {
    holdId,
    expiresAt: holdUntil,
    seats: seatIds,
    quote: quoteSeats(
      show.seats.filter((s) => seatIds.includes(s.seatId)),
      show,
    ),
  };
}
export async function releaseHold(showId, holdId, userId) {
  const result = await Show.updateOne({ _id: showId, status: 'scheduled' }, availableSeatUpdate, {
    arrayFilters: [
      {
        's.holdId': holdId,
        's.holdOwner': new mongoose.Types.ObjectId(userId),
        's.status': 'held',
      },
    ],
  });
  if (result.modifiedCount) emitSeats(showId);
  return { ok: true };
}
export async function createBooking(userId, { showId, holdId, idempotencyKey }) {
  const existing = await Booking.findOne({ user: userId, idempotencyKey });
  if (existing) {
    assert(
      String(existing.show) === showId && existing.holdId === holdId,
      409,
      'This idempotency key was used for another request.',
    );
    return existing;
  }
  let result;
  try {
    result = await transaction(async (session) => {
      const show = await Show.findOne({ _id: showId })
        .populate('movie', 'title poster')
        .populate('theatre', 'name city')
        .session(session);
      assert(show, 404, 'Show not found.');
      assert(
        show.status === 'scheduled' && show.startsAt > new Date(),
        409,
        'This show is no longer open for booking.',
      );
      const seats = show.seats.filter(
        (s) =>
          s.holdId === holdId &&
          String(s.holdOwner) === String(userId) &&
          s.status === 'held' &&
          s.holdUntil > new Date(),
      );
      assert(
        seats.length > 0 && seats.length <= MAX_SEATS,
        409,
        'Your seat hold expired. Please select seats again.',
        'HOLD_EXPIRED',
      );
      const duration = paymentProvider === 'stripe' ? 40 * 60000 : 10 * 60000;
      const expiresAt = new Date(Math.min(Date.now() + duration, +show.startsAt));
      const [booking] = await Booking.create(
        [
          {
            reference: `IM-${randomBytes(5).toString('hex').toUpperCase()}`,
            user: userId,
            show: showId,
            movieTitle: show.movie.title,
            poster: show.movie.poster,
            theatreName: show.theatre.name,
            city: show.theatre.city,
            screenName: show.screenName,
            startsAt: show.startsAt,
            seats: seats.map((s) => ({ seatId: s.seatId, tier: s.tier })),
            amount: quoteSeats(seats, show),
            holdId,
            expiresAt,
            idempotencyKey,
          },
        ],
        { session },
      );
      const modified = await Show.updateOne(
        { _id: showId },
        { $set: { 'seats.$[s].holdUntil': expiresAt } },
        {
          session,
          arrayFilters: [
            {
              's.holdId': holdId,
              's.holdOwner': new mongoose.Types.ObjectId(userId),
              's.status': 'held',
            },
          ],
        },
      );
      assert(modified.modifiedCount === 1, 409, 'Seat hold changed. Please try again.');
      const payment = await Payment.create(
        [
          {
            booking: booking._id,
            user: userId,
            provider: paymentProvider,
            amount: booking.amount.total,
            currency: 'INR',
          },
        ],
        { session },
      );
      return { booking, payment };
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Booking.findOne({ user: userId, idempotencyKey });
      if (duplicate) {
        assert(
          String(duplicate.show) === showId && duplicate.holdId === holdId,
          409,
          'Idempotency key conflict.',
        );
        return duplicate;
      }
    }
    throw error;
  }
  emitSeats(showId);
  return result.booking;
}
export async function confirmPayment({ paymentId, provider, providerRef, eventId, intentId }) {
  assert(['demo', 'stripe'].includes(provider), 400, 'Unknown payment provider.');
  let sideEffects;
  try {
    sideEffects = await transaction(async (session) => {
      const payment = await Payment.findOne({
        _id: paymentId,
        provider,
      }).session(session);
      assert(payment, 404, 'Payment not found.');
      if (providerRef)
        assert(
          !payment.providerRef || payment.providerRef === providerRef,
          400,
          'Payment reference mismatch.',
        );
      if (payment.status === 'succeeded') return null;
      assert(
        payment.status === 'pending' ||
          (provider === 'stripe' &&
            payment.status === 'failed' &&
            ['Checkout expired', 'Reservation expired', 'Show ended'].includes(
              payment.failureReason,
            )),
        409,
        'This payment cannot be confirmed.',
      );
      const booking = await Booking.findOne({
        _id: payment.booking,
        user: payment.user,
      }).session(session);
      assert(booking, 404, 'Booking not found.');
      if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') return null;
      assert(
        booking.status === 'pending',
        409,
        'This booking has expired or was cancelled.',
        'BOOKING_NOT_PENDING',
      );
      if (provider === 'demo') {
        assert(booking.expiresAt > new Date(), 409, 'Your seat hold expired.', 'HOLD_EXPIRED');
        assert(booking.startsAt > new Date(), 409, 'This show has already started.');
      }
      const show = await Show.findOneAndUpdate(
        {
          _id: booking.show,
          status: 'scheduled',
          startsAt: { $gt: new Date() },
          seats: {
            $all: booking.seats.map((s) => ({
              $elemMatch: {
                seatId: s.seatId,
                status: 'held',
                holdId: booking.holdId,
                holdOwner: booking.user,
              },
            })),
          },
        },
        {
          $set: {
            'seats.$[s].status': 'booked',
            'seats.$[s].booking': booking._id,
          },
          $unset: {
            'seats.$[s].holdId': '',
            'seats.$[s].holdOwner': '',
            'seats.$[s].holdUntil': '',
          },
        },
        {
          session,
          new: true,
          arrayFilters: [
            {
              's.seatId': { $in: booking.seats.map((s) => s.seatId) },
              's.holdId': booking.holdId,
              's.status': 'held',
            },
          ],
        },
      );
      // Stripe expires Checkout before the seat hold. A delayed webhook may confirm an unclaimed,
      // expired hold, but NEVER a seat subsequently acquired by another customer.
      assert(show, 409, 'The seats are no longer reserved for this payment.', 'SEAT_CONFLICT');
      booking.status = 'confirmed';
      booking.paymentStatus = 'paid';
      booking.confirmedAt = new Date();
      await booking.save({ session });
      payment.status = 'succeeded';
      if (providerRef) payment.providerRef = providerRef;
      if (intentId) payment.paymentIntent = intentId;
      await payment.save({ session });
      const [notification] = await Notification.create(
        [
          {
            user: booking.user,
            title: 'Your tickets are confirmed!',
            message: `${booking.movieTitle} · ${booking.seats.map((s) => s.seatId).join(', ')} · ${booking.reference}`,
            booking: booking._id,
          },
        ],
        { session },
      );
      // Insert last: a duplicate-key error aborts a MongoDB transaction. Replayed events
      // normally exit at payment.status === succeeded before reaching this write.
      if (eventId)
        await WebhookEvent.create([{ providerEventId: eventId, type: 'payment' }], { session });
      return { booking, notification };
    });
  } catch (error) {
    if (
      error.code === 11000 &&
      eventId &&
      (await WebhookEvent.exists({ providerEventId: eventId }))
    ) {
      const payment = await Payment.findById(paymentId).select('booking');
      return Booking.findById(payment.booking);
    }
    logger.error({ err: error, paymentId }, 'Payment confirmation failed');
    throw error;
  }
  if (sideEffects) {
    emitSeats(sideEffects.booking.show);
    emitBooking(sideEffects.booking);
    emitNotification(sideEffects.notification);
  }
  const payment = await Payment.findById(paymentId).select('booking');
  return Booking.findById(payment.booking);
}
export async function failDemoPayment(paymentId, userId) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, user: userId, provider: 'demo', status: 'pending' },
    { status: 'failed', failureReason: 'Simulated payment decline' },
  );
  assert(payment, 409, 'Payment is not available for this action.');
  // A declined attempt does not cancel the booking; the user can retry before expiry.
  await Payment.create({
    booking: payment.booking,
    user: userId,
    provider: 'demo',
    amount: payment.amount,
    currency: payment.currency,
  });
  return { ok: true };
}
export async function cancelBooking(bookingId, user, { admin = false } = {}) {
  let result, stripePayment;
  result = await transaction(async (session) => {
    const booking = await Booking.findOne({
      _id: bookingId,
      ...(admin ? {} : { user: user._id }),
    }).session(session);
    assert(booking, 404, 'Booking not found.');
    if (booking.status === 'cancelled') return { booking, alreadyCancelled: true };
    assert(booking.status === 'confirmed', 409, 'Only confirmed bookings can be cancelled.');
    assert(
      admin || booking.startsAt.getTime() - Date.now() >= 2 * 3600000,
      409,
      'Cancellation closes 2 hours before the show.',
    );
    const payment = await Payment.findOne({
      booking: booking._id,
      status: 'succeeded',
    }).session(session);
    assert(payment, 409, 'No successful payment was found.');
    assert(['paid'].includes(booking.paymentStatus), 409, 'A refund is already being processed.');
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.paymentStatus = payment.provider === 'demo' ? 'refunded' : 'refund_pending';
    if (payment.provider === 'demo') payment.status = 'refunded';
    await booking.save({ session });
    await payment.save({ session });
    await Show.updateOne({ _id: booking.show }, availableSeatUpdate, {
      session,
      arrayFilters: [{ 's.booking': booking._id, 's.status': 'booked' }],
    });
    const [notification] = await Notification.create(
      [
        {
          user: booking.user,
          title: 'Booking cancelled',
          message: `${booking.reference}: seats released. ${payment.provider === 'demo' ? 'Demo refund recorded.' : 'Your refund is being processed.'}`,
          booking: booking._id,
        },
      ],
      { session },
    );
    return { booking, notification, payment };
  });
  if (result.alreadyCancelled) return result.booking;
  emitSeats(result.booking.show);
  emitBooking(result.booking);
  emitNotification(result.notification);
  if (result.payment.provider === 'stripe') await processRefund(result.booking._id);
  return Booking.findById(bookingId);
}
export async function processRefund(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.paymentStatus !== 'refund_pending') return;
  const payment = await Payment.findOne({
    booking: booking._id,
    provider: 'stripe',
    status: 'succeeded',
  });
  if (!payment) return;
  try {
    await refundStripePayment(payment);
  } catch (error) {
    logger.error({ err: error, bookingId }, 'Refund requires retry');
    await Booking.updateOne(
      { _id: bookingId, paymentStatus: 'refund_pending' },
      { paymentStatus: 'refund_failed' },
    );
  }
}
export async function recoverPaymentConflict(paymentId, providerRef, intentId, eventId) {
  const result = await transaction(async (session) => {
    const event = await WebhookEvent.findOne({
      providerEventId: eventId,
    }).session(session);
    if (event) return null;
    const payment = await Payment.findById(paymentId).session(session);
    const booking = await Booking.findById(payment.booking).session(session);
    if (['pending', 'failed'].includes(payment.status)) {
      payment.status = 'succeeded';
      payment.providerRef = providerRef;
      payment.paymentIntent = intentId;
      await payment.save({ session });
    }
    if (['pending', 'expired'].includes(booking.status)) {
      booking.status = 'cancelled';
      booking.paymentStatus = 'refund_pending';
      booking.cancelledAt = new Date();
      await booking.save({ session });
      await Show.updateOne({ _id: booking.show }, availableSeatUpdate, {
        session,
        arrayFilters: [
          {
            's.holdId': booking.holdId,
            's.holdOwner': booking.user,
            's.status': 'held',
          },
        ],
      });
    }
    const [notification] = await Notification.create(
      [
        {
          user: booking.user,
          title: 'Payment refund initiated',
          message: `We could not reserve your seats for ${booking.reference}. Your payment is being refunded.`,
          booking: booking._id,
        },
      ],
      { session },
    );
    await WebhookEvent.create([{ providerEventId: eventId, type: 'payment-conflict' }], {
      session,
    });
    return { booking, notification };
  });
  if (!result) return;
  emitSeats(result.booking.show);
  emitBooking(result.booking);
  emitNotification(result.notification);
}

export async function sweepExpiredReservations() {
  const now = new Date();
  const expiredBookings = await Booking.find({
    status: 'pending',
    expiresAt: { $lte: now },
  })
    .select('_id show user')
    .limit(500);
  for (const item of expiredBookings) {
    await transaction(async (session) => {
      const booking = await Booking.findOneAndUpdate(
        { _id: item._id, status: 'pending', expiresAt: { $lte: now } },
        { status: 'expired' },
        { session, new: true },
      );
      if (!booking) return;
      await Show.updateOne({ _id: booking.show }, availableSeatUpdate, {
        session,
        arrayFilters: [
          {
            's.holdId': booking.holdId,
            's.holdOwner': booking.user,
            's.status': 'held',
          },
        ],
      });
      await Payment.updateMany(
        { booking: booking._id, status: 'pending' },
        { status: 'failed', failureReason: 'Reservation expired' },
        { session },
      );
    });
    emitSeats(item.show);
    emitBooking(item);
  }
  const shows = await Show.find({
    seats: { $elemMatch: { status: 'held', holdUntil: { $lte: now } } },
  })
    .select('_id')
    .limit(500);
  for (const show of shows) {
    await Show.collection.updateOne({ _id: show._id }, availableSeatUpdate, {
      arrayFilters: [{ 's.status': 'held', 's.holdUntil': { $lte: now } }],
    });
    emitSeats(show._id);
  }
  const ended = await Show.find({ status: 'scheduled', endsAt: { $lte: now } })
    .select('_id')
    .limit(500);
  if (ended.length) {
    await Show.updateMany({ _id: { $in: ended.map((s) => s._id) } }, { status: 'completed' });
    // Pending reservations for a show that ended must not remain payable.
    const pending = await Booking.find({
      show: { $in: ended.map((s) => s._id) },
      status: 'pending',
    });
    for (const b of pending) {
      await Booking.updateOne({ _id: b._id, status: 'pending' }, { status: 'expired' });
      await Payment.updateMany(
        { booking: b._id, status: 'pending' },
        { status: 'failed', failureReason: 'Show ended' },
      );
      emitBooking(b);
    }
    ended.forEach((s) => emitSeats(s._id));
  }
}
