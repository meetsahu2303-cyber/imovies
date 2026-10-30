import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'payment-test-only-secret-with-at-least-thirty-two-characters';
process.env.PAYMENT_PROVIDER = 'stripe';
process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_only_secret';
process.env.COOKIE_SECURE = 'false';
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { stripe, handleStripeEvent, getCheckout } =
  await import('../src/services/payment.service.js');
const { User } = await import('../src/models/User.js');
const { Movie } = await import('../src/models/Movie.js');
const { Theatre } = await import('../src/models/Theatre.js');
const { Show } = await import('../src/models/Show.js');
const { Booking, Payment, WebhookEvent } = await import('../src/models/Booking.js');
const { holdSeats, createBooking } = await import('../src/services/booking.service.js');
const { seatLayout } = await import('../src/utils/validation.js');
let app, movie, theatre, user;
before(async () => {
  await connectDatabase({ memory: true });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  app = createApp();
});
after(async () => {
  mock.restoreAll();
  await disconnectDatabase();
});
beforeEach(async () => {
  mock.restoreAll();
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  user = await User.create({
    name: 'Stripe User',
    email: 'stripe@example.test',
    passwordHash: 'unused',
    role: 'user',
  });
  movie = await Movie.create({
    title: 'Stripe Movie',
    slug: 'stripe-movie',
    description: 'Payment integration test movie.',
    poster: '/posters/test.jpg',
    genres: ['Drama'],
    languages: ['English'],
    duration: 120,
    releaseDate: new Date(),
  });
  theatre = await Theatre.create({
    name: 'Stripe Cinema',
    slug: 'stripe-cinema',
    city: 'Mumbai',
    address: 'Test address',
    screens: [{ name: 'Screen 1', rows: 3, columns: 4, aisleAfter: 2, premiumFrom: 3 }],
  });
});
async function reservation({ expired = false } = {}) {
  const screen = theatre.screens[0],
    startsAt = new Date(Date.now() + 3 * 86400000);
  const show = await Show.create({
    movie: movie._id,
    theatre: theatre._id,
    screen: screen._id,
    screenName: screen.name,
    startsAt,
    endsAt: new Date(+startsAt + 140 * 60000),
    basePrice: 20000,
    premiumPrice: 30000,
    language: 'English',
    seats: seatLayout(screen).map((s) => ({ ...s, status: 'available' })),
  });
  const hold = await holdSeats(show._id, user._id, ['A1']);
  const booking = await createBooking(user._id, {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  });
  const payment = await Payment.findOne({ booking: booking._id });
  if (expired) {
    await Booking.updateOne(
      { _id: booking._id },
      { status: 'expired', expiresAt: new Date(Date.now() - 1000) },
    );
    await Show.updateOne(
      { _id: show._id },
      { $set: { 'seats.$[s].status': 'available' } },
      { arrayFilters: [{ 's.holdId': hold.holdId }] },
    );
  }
  return { show, booking, payment };
}
function paidEvent(payment, id = 'evt_test_paid') {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${payment._id}`,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: payment.amount,
        currency: 'inr',
        payment_intent: `pi_test_${payment._id}`,
        metadata: {
          paymentId: String(payment._id),
          bookingId: String(payment.booking),
          userId: String(payment.user),
        },
      },
    },
  };
}
test('Stripe checkout amount is server-controlled and repeated requests are idempotent', async () => {
  const { booking, payment } = await reservation();
  let calls = 0;
  mock.method(stripe.checkout.sessions, 'create', async (params, options) => {
    calls++;
    assert.equal(params.line_items[0].price_data.unit_amount, booking.amount.total);
    assert.equal(options.idempotencyKey, `checkout-${payment._id}`);
    return {
      id: `cs_test_${payment._id}`,
      url: 'https://checkout.stripe.com/test',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    };
  });
  const a = await getCheckout(payment._id, user._id),
    b = await getCheckout(payment._id, user._id);
  assert.equal(a.mode, 'stripe');
  assert.equal(a.url, b.url);
  assert.equal(calls, 1);
});
test('verified payment event atomically confirms; event replay does not duplicate booking', async () => {
  const { payment, booking, show } = await reservation();
  const event = paidEvent(payment);
  await handleStripeEvent(event);
  await handleStripeEvent(event);
  assert.equal((await Booking.findById(booking._id)).status, 'confirmed');
  assert.equal((await Payment.findById(payment._id)).status, 'succeeded');
  assert.equal(
    (await Show.findById(show._id)).seats.find((s) => s.seatId === 'A1').status,
    'booked',
  );
  assert.equal(await WebhookEvent.countDocuments({ providerEventId: event.id }), 1);
});
test('incorrect amount or account metadata cannot confirm a payment', async () => {
  const { payment, booking } = await reservation();
  const wrongAmount = paidEvent(payment);
  wrongAmount.data.object.amount_total = 1;
  await assert.rejects(handleStripeEvent(wrongAmount), /amount mismatch/);
  const wrongUser = paidEvent(payment, 'evt_wrong_user');
  wrongUser.data.object.metadata.userId = String(theatre._id);
  await assert.rejects(handleStripeEvent(wrongUser), /metadata mismatch/);
  assert.equal((await Booking.findById(booking._id)).status, 'pending');
});
test('paid reservation conflict is marked for refund and refunded idempotently', async () => {
  const { payment, booking } = await reservation({ expired: true });
  let calls = 0;
  mock.method(stripe.refunds, 'create', async (params, options) => {
    calls++;
    assert.equal(options.idempotencyKey, `refund-${booking._id}`);
    return { id: 're_test' };
  });
  const event = paidEvent(payment);
  await handleStripeEvent(event);
  await handleStripeEvent(event);
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'refund_pending');
  assert.equal((await Booking.findById(booking._id)).status, 'cancelled');
  assert.equal(calls, 1);
  await handleStripeEvent({
    id: 'evt_refund',
    type: 'charge.refunded',
    data: {
      object: {
        payment_intent: `pi_test_${payment._id}`,
        amount_refunded: payment.amount,
      },
    },
  });
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'refunded');
  assert.equal((await Payment.findById(payment._id)).status, 'refunded');
});
test('a delayed paid event after local expiry initiates a refund rather than retrying forever', async () => {
  const { payment, booking } = await reservation();
  await Payment.updateOne(
    { _id: payment._id },
    { status: 'failed', failureReason: 'Reservation expired' },
  );
  await Booking.updateOne({ _id: booking._id }, { status: 'expired' });
  mock.method(stripe.refunds, 'create', async () => ({ id: 're_delayed' }));
  await handleStripeEvent(paidEvent(payment));
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'refund_pending');
  assert.equal((await Payment.findById(payment._id)).status, 'succeeded');
});
test('real webhook route requires a valid Stripe signature and rejects demo confirmation', async () => {
  const { payment } = await reservation();
  const event = paidEvent(payment);
  const body = JSON.stringify(event);
  assert.equal(
    (
      await request(app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .send(body)
    ).status,
    400,
  );
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const valid = await request(app)
    .post('/api/payments/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(body);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.received, true);
  assert.equal((await Booking.findById(payment.booking)).status, 'confirmed');
  const replay = await request(app)
    .post('/api/payments/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(body);
  assert.equal(replay.body.duplicate, true);
  assert.equal(
    (
      await request(app)
        .post(`/api/payments/${payment._id}/demo`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ outcome: 'success' })
    ).status,
    401,
  );
});
