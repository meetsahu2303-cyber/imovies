import Stripe from 'stripe';
import { env, paymentProvider } from '../config/env.js';
import { AppError, assert } from '../utils/errors.js';
import { Payment } from '../models/Booking.js';
import { Booking } from '../models/Booking.js';
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 })
  : null;
export async function getCheckout(paymentId, userId) {
  const payment = await Payment.findOne({ _id: paymentId, user: userId });
  assert(payment, 404, 'Payment not found.');
  const booking = await Booking.findOne({ _id: payment.booking, user: userId });
  assert(booking, 404, 'Booking not found.');
  if (booking.status === 'confirmed') return { mode: 'confirmed', bookingId: booking._id };
  assert(
    booking.status === 'pending' && booking.expiresAt > new Date(),
    409,
    'This reservation expired. Please select seats again.',
    'HOLD_EXPIRED',
  );
  assert(
    payment.status === 'pending',
    409,
    'This payment attempt has closed. Start a new checkout.',
  );
  if (payment.provider === 'demo')
    return {
      mode: 'demo',
      paymentId,
      bookingId: booking._id,
      amount: payment.amount,
      expiresAt: booking.expiresAt,
    };
  assert(stripe, 503, 'Stripe is not configured.');
  assert(
    +booking.startsAt > Date.now() + 31 * 60000,
    409,
    'Stripe Checkout needs at least 31 minutes before showtime. Choose a later show.',
  );
  if (payment.providerRef && payment.checkoutExpiresAt > new Date())
    return { mode: 'stripe', url: payment.checkoutUrl, bookingId: booking._id };
  if (payment.providerRef) {
    payment.status = 'failed';
    payment.failureReason = 'Checkout expired';
    await payment.save();
    const next = await Payment.create({
      booking: booking._id,
      user: userId,
      amount: payment.amount,
      provider: 'stripe',
      currency: 'INR',
    });
    return getCheckout(next._id, userId);
  }
  const origin = env.CLIENT_ORIGIN.split(',')[0];
  const expiresAt = Math.floor((+booking.expiresAt - 10 * 60000) / 1000);
  assert(
    expiresAt >= Math.floor(Date.now() / 1000) + 1800,
    409,
    'This checkout window is too short. Start a new reservation.',
  );
  assert(
    expiresAt < Math.floor(+booking.expiresAt / 1000),
    409,
    'Not enough reservation time remains. Please select seats again.',
  );
  // Idempotency key makes concurrent/retried requests reuse the same Stripe Checkout session.
  const checkout = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: String(booking._id),
      metadata: {
        paymentId: String(payment._id),
        bookingId: String(booking._id),
        userId: String(userId),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'inr',
            unit_amount: payment.amount,
            product_data: {
              name: `${booking.movieTitle} · ${booking.seats.map((s) => s.seatId).join(', ')}`,
              description: `${booking.theatreName} · ${booking.reference}`,
            },
          },
        },
      ],
      expires_at: expiresAt,
      success_url: `${origin}/bookings/${booking._id}?checkout=returned`,
      cancel_url: `${origin}/checkout/${booking._id}?cancelled=1`,
    },
    { idempotencyKey: `checkout-${payment._id}` },
  );
  payment.providerRef = checkout.id;
  payment.checkoutUrl = checkout.url;
  payment.checkoutExpiresAt = new Date(checkout.expires_at * 1000);
  await payment.save();
  return { mode: 'stripe', url: checkout.url, bookingId: booking._id };
}
export async function refundStripePayment(payment) {
  assert(stripe, 503, 'Stripe is not configured.');
  let intent = payment.paymentIntent;
  if (!intent && payment.providerRef) {
    const checkout = await stripe.checkout.sessions.retrieve(payment.providerRef);
    intent =
      typeof checkout.payment_intent === 'string'
        ? checkout.payment_intent
        : checkout.payment_intent?.id;
  }
  assert(intent, 409, 'Stripe payment intent is missing; manual reconciliation is required.');
  return stripe.refunds.create(
    { payment_intent: intent, reason: 'requested_by_customer' },
    { idempotencyKey: `refund-${payment.booking}` },
  );
}
export async function handleStripeEvent(event) {
  const { confirmPayment, processRefund, recoverPaymentConflict } =
    await import('./booking.service.js');
  const object = event.data.object;
  if (
    ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
  ) {
    if (object.payment_status !== 'paid') return;
    const payment = await Payment.findById(object.metadata?.paymentId);
    assert(payment && payment.provider === 'stripe', 400, 'Unknown payment metadata.');
    assert(
      String(payment.booking) === object.metadata.bookingId &&
        String(payment.user) === object.metadata.userId,
      400,
      'Payment metadata mismatch.',
    );
    assert(
      object.amount_total === payment.amount && object.currency === payment.currency.toLowerCase(),
      400,
      'Payment amount mismatch.',
    );
    assert(
      !payment.providerRef || payment.providerRef === object.id,
      400,
      'Checkout reference mismatch.',
    );
    const intent =
      typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    try {
      await confirmPayment({
        paymentId: payment._id,
        provider: 'stripe',
        providerRef: object.id,
        eventId: event.id,
        intentId: intent,
      });
    } catch (error) {
      if (error.code === 'SEAT_CONFLICT' || error.code === 'BOOKING_NOT_PENDING') {
        await recoverPaymentConflict(payment._id, object.id, intent, event.id);
        await processRefund(payment.booking);
      } else throw error;
    }
  } else if (event.type === 'checkout.session.expired') {
    const payment = await Payment.findOne({
      providerRef: object.id,
      status: 'pending',
    });
    if (payment) {
      await Payment.updateOne(
        { _id: payment._id, status: 'pending' },
        { status: 'failed', failureReason: 'Checkout expired' },
      );
      const other = await Payment.exists({
        booking: payment.booking,
        status: 'pending',
      });
      if (!other)
        await Payment.create({
          booking: payment.booking,
          user: payment.user,
          provider: 'stripe',
          amount: payment.amount,
        });
    }
  } else if (event.type === 'charge.refunded') {
    const intent =
      typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    const payment = await Payment.findOne({
      paymentIntent: intent,
      provider: 'stripe',
    });
    if (payment && object.amount_refunded >= payment.amount) {
      await Payment.updateOne({ _id: payment._id }, { status: 'refunded' });
      await Booking.updateOne(
        { _id: payment.booking, status: 'cancelled' },
        { paymentStatus: 'refunded' },
      );
    }
  }
}
