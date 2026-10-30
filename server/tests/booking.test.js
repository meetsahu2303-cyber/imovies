import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as socketClient } from 'socket.io-client';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a-test-only-secret-with-at-least-thirty-two-characters';
process.env.PAYMENT_PROVIDER = 'demo';
process.env.COOKIE_SECURE = 'false';
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { createSocketServer } = await import('../src/realtime/socket.js');
const { Show } = await import('../src/models/Show.js');
const { Movie } = await import('../src/models/Movie.js');
const { Theatre, Seat } = await import('../src/models/Theatre.js');
const { User, Session } = await import('../src/models/User.js');
const { Booking, Payment, WebhookEvent } = await import('../src/models/Booking.js');
const { Notification } = await import('../src/models/Notification.js');
const { holdSeats, createBooking, confirmPayment, sweepExpiredReservations, releaseHold } =
  await import('../src/services/booking.service.js');
const { quoteSeats, dayRange } = await import('../src/utils/money.js');
const { seatLayout } = await import('../src/utils/validation.js');
let app, server, io, port, movie, theatre, screen, admin, user, other;
const header = { 'X-Requested-With': 'XMLHttpRequest' };
const post = (agent, url, body) => agent.post(url).set(header).send(body);
async function loginUser(agent, email = 'user@example.test') {
  const response = await post(agent, '/api/auth/login', {
    email,
    password: 'Password123',
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response;
}
async function makeShow(offset = 86400000 * 2) {
  const startsAt = new Date(Date.now() + offset);
  return Show.create({
    movie: movie._id,
    theatre: theatre._id,
    screen: screen._id,
    screenName: screen.name,
    startsAt,
    endsAt: new Date(+startsAt + 140 * 60000),
    basePrice: 20000,
    premiumPrice: 35000,
    language: 'English',
    format: '2D',
    seats: seatLayout(screen).map((s) => ({ ...s, status: 'available' })),
  });
}
before(async () => {
  await connectDatabase({ memory: true });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  app = createApp();
  server = http.createServer(app);
  io = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(async () => {
  io?.close();
  server?.close();
  await disconnectDatabase();
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('Password123', 4);
  [admin, user, other] = await User.create([
    { name: 'Admin', email: 'admin@example.test', passwordHash, role: 'admin' },
    {
      name: 'Moviegoer',
      email: 'user@example.test',
      passwordHash,
      role: 'user',
    },
    { name: 'Other', email: 'other@example.test', passwordHash, role: 'user' },
  ]);
  movie = await Movie.create({
    title: 'Test Cinema',
    slug: 'test-cinema',
    description: 'An exceptional film for integration testing.',
    poster: '/posters/test.jpg',
    genres: ['Drama', 'Thriller'],
    languages: ['English', 'Hindi'],
    duration: 120,
    rating: 8.5,
    releaseDate: new Date('2026-01-01'),
    formats: ['2D', 'IMAX'],
  });
  theatre = await Theatre.create({
    name: 'Test Cinema',
    slug: 'test-cinema-mumbai',
    city: 'Mumbai',
    address: 'Test street, Mumbai',
    screens: [{ name: 'Screen 1', rows: 8, columns: 12, aisleAfter: 6, premiumFrom: 6 }],
  });
  screen = theatre.screens[0];
  user = request.agent(app);
  other = request.agent(app);
  admin = request.agent(app);
  await loginUser(user);
  await loginUser(other, 'other@example.test');
  await loginUser(admin, 'admin@example.test');
});
test('health, security headers, pagination and input validation', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.ok(health.headers['x-content-type-options']);
  assert.ok(health.headers['x-request-id']);
  const list = await request(app).get('/api/movies?limit=1&page=1');
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.pagination.pages, 1);
  assert.equal((await request(app).get('/api/movies?limit=999')).status, 400);
  assert.equal((await request(app).get('/api/movies?date=2026-02-31')).status, 400);
  assert.equal((await request(app).get('/api/no-such-route')).status, 404);
});
test('registration hashes passwords, ignores role injection, rejects duplicates and weak passwords', async () => {
  const agent = request.agent(app);
  const result = await post(agent, '/api/auth/register', {
    name: 'New User',
    email: 'NEW@example.test',
    password: 'StrongPassword123',
    role: 'admin',
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.user.role, 'user');
  assert.equal(result.body.user.passwordHash, undefined);
  const saved = await User.findOne({ email: 'new@example.test' }).select('+passwordHash');
  assert.notEqual(saved.passwordHash, 'StrongPassword123');
  assert.ok(saved.passwordHash.startsWith('$2'));
  assert.match(result.headers['set-cookie'].join(';'), /HttpOnly/);
  assert.equal(
    (
      await post(request.agent(app), '/api/auth/register', {
        name: 'Duplicate',
        email: 'new@example.test',
        password: 'StrongPassword123',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(request.agent(app), '/api/auth/register', {
        name: 'Weak',
        email: 'weak@example.test',
        password: 'password',
      })
    ).status,
    400,
  );
});
test('anonymous session bootstrap is quiet and reflects authenticated users', async () => {
  const anonymous = await post(request.agent(app), '/api/auth/session');
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.body.user, null);
  const current = await post(user, '/api/auth/session');
  assert.equal(current.status, 200);
  assert.equal(current.body.user.email, 'user@example.test');
});
test('image uploads validate actual content, not just the file extension', async () => {
  const bad = await admin
    .post('/api/admin/uploads')
    .set(header)
    .attach('image', Buffer.from('<script>alert(1)</script>'), {
      filename: 'fake.jpg',
      contentType: 'image/jpeg',
    });
  assert.equal(bad.status, 400);
  const { readFile } = await import('node:fs/promises');
  const image = await readFile(
    new URL('../../client/public/posters/inception.jpg', import.meta.url),
  );
  const good = await admin.post('/api/admin/uploads').set(header).attach('image', image, {
    filename: 'poster.jpg',
    contentType: 'image/jpeg',
  });
  assert.equal(good.status, 201);
  assert.match(good.body.url, /^\/uploads\/[a-f0-9-]+\.jpg$/);
  const served = await request(app).get(good.body.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers['x-content-type-options'], 'nosniff');
});
test('authentication, role checks, CSRF and origin checks protect APIs', async () => {
  assert.equal((await request(app).get('/api/bookings')).status, 401);
  assert.equal((await user.get('/api/admin/dashboard')).status, 403);
  assert.equal((await admin.get('/api/admin/dashboard')).status, 200);
  assert.equal((await user.post('/api/bookings').send({})).status, 403);
  assert.equal(
    (await user.post('/api/auth/logout').set('Origin', 'https://attacker.example').set(header))
      .status,
    403,
  );
  assert.equal(
    (await request(app).get('/api/movies').set('Origin', 'https://attacker.example')).headers[
      'access-control-allow-origin'
    ],
    undefined,
  );
  assert.equal(
    (
      await post(request.agent(app), '/api/auth/login', {
        email: 'user@example.test',
        password: 'wrong-password',
      })
    ).status,
    401,
  );
});
test('refresh tokens rotate and logout revokes the database session', async () => {
  const account = await User.findOne({ email: 'user@example.test' });
  const session = await Session.findOne({ user: account._id });
  const loginResponse = await post(user, '/api/auth/login', {
    email: 'user@example.test',
    password: 'Password123',
  });
  const cookies = loginResponse.headers['set-cookie'];
  const oldRefresh = cookies.find((c) => c.startsWith('imovies_refresh=')).split(';')[0];
  const rotated = await post(user, '/api/auth/refresh');
  assert.equal(rotated.status, 200);
  assert.equal(await Session.countDocuments({ user: account._id }), 2);
  const replay = await request(app).post('/api/auth/refresh').set(header).set('Cookie', oldRefresh);
  assert.equal(replay.status, 401);
  const logout = await post(user, '/api/auth/logout');
  assert.ok(logout.headers['set-cookie'].length >= 2);
  assert.equal((await user.get('/api/auth/me')).status, 401);
  assert.equal((await post(user, '/api/auth/refresh')).status, 401);
});
test('catalog search and filtering by genre, language, theatre and business date', async () => {
  const show = await makeShow();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(show.startsAt);
  assert.equal((await request(app).get('/api/movies?q=Cinema')).body.items.length, 1);
  assert.equal((await request(app).get('/api/movies?q=NoSuchMovie')).body.items.length, 0);
  assert.equal(
    (
      await request(app).get(
        `/api/movies?genre=Thriller&language=English&theatre=${theatre._id}&city=Mumbai&date=${date}`,
      )
    ).body.items.length,
    1,
  );
  assert.equal((await request(app).get('/api/movies?genre=Comedy')).body.items.length, 0);
  assert.equal((await request(app).get('/api/movies?city=Bengaluru')).body.items.length, 0);
  const range = dayRange('2026-01-01');
  assert.equal(range.start.toISOString(), '2025-12-31T18:30:00.000Z');
});
test('admin movie CRUD and safe archival', async () => {
  const body = {
    title: 'CRUD Movie',
    description: 'A sufficiently long movie description.',
    poster: '/posters/test.jpg',
    genres: ['Drama'],
    languages: ['English'],
    duration: 100,
    rating: 7,
    releaseDate: new Date().toISOString(),
  };
  const created = await post(admin, '/api/admin/movies', body);
  assert.equal(created.status, 201);
  const id = created.body.movie._id;
  const updated = await admin
    .put(`/api/admin/movies/${id}`)
    .set(header)
    .send({ title: 'Updated Movie', rating: 9 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.movie.title, 'Updated Movie');
  assert.equal((await request(app).get(`/api/movies/${id}`)).body.movie.rating, 9);
  assert.equal((await admin.delete(`/api/admin/movies/${id}`).set(header)).status, 200);
  assert.equal((await request(app).get(`/api/movies/${id}`)).status, 404);
});
test('admin theatre CRUD generates the physical seat collection', async () => {
  const body = {
    name: 'New Cinema',
    city: 'Mumbai',
    address: 'A new silver screen',
    screens: [{ name: 'Screen 1', rows: 3, columns: 4, aisleAfter: 2, premiumFrom: 3 }],
  };
  const created = await post(admin, '/api/admin/theatres', body);
  assert.equal(created.status, 201);
  assert.equal(await Seat.countDocuments({ theatre: created.body.theatre._id }), 12);
  const updated = await admin
    .put(`/api/admin/theatres/${created.body.theatre._id}`)
    .set(header)
    .send({
      ...body,
      name: 'Updated Cinema',
      screens: created.body.theatre.screens.map((screen) => ({
        ...screen,
        id: String(screen._id),
      })),
    });
  assert.equal(updated.status, 200);
  assert.equal(
    (await admin.delete(`/api/admin/theatres/${created.body.theatre._id}`).set(header)).status,
    200,
  );
});
test('show scheduling rejects overlaps and concurrent duplicate slots', async () => {
  const startsAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const body = {
    movie: String(movie._id),
    theatre: String(theatre._id),
    screen: String(screen._id),
    startsAt,
    basePrice: 20000,
    premiumPrice: 30000,
    format: '2D',
    language: 'English',
  };
  const results = await Promise.all([
    post(admin, '/api/admin/shows', body),
    post(admin, '/api/admin/shows', body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await Show.countDocuments(), 1);
  const id = results.find((r) => r.status === 201).body.show._id;
  assert.equal(
    (
      await admin
        .put(`/api/admin/shows/${id}`)
        .set(header)
        .send({ ...body, basePrice: 25000 })
    ).status,
    200,
  );
  assert.equal((await admin.delete(`/api/admin/shows/${id}`).set(header)).status, 200);
});
test('overlapping seat requests have exactly one winner, with no partial holds', async () => {
  const show = await makeShow();
  const results = await Promise.allSettled([
    holdSeats(show._id, user._id || (await User.findOne({ email: 'user@example.test' }))._id, [
      'A1',
      'A2',
    ]),
    holdSeats(show._id, (await User.findOne({ email: 'other@example.test' }))._id, ['A2', 'A3']),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const saved = await Show.findById(show._id);
  assert.equal(saved.seats.filter((s) => s.status === 'held').length, 2);
  assert.equal(saved.seats.filter((s) => s.status === 'available').length, 94);
});
test('invalid, duplicate, excess and unavailable seats are rejected', async () => {
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  await assert.rejects(holdSeats(show._id, account._id, ['Z99']));
  await assert.rejects(holdSeats(show._id, account._id, ['A1', 'A1']));
  await assert.rejects(
    holdSeats(
      show._id,
      account._id,
      Array.from({ length: 9 }, (_, i) => `A${i + 1}`),
    ),
  );
  await holdSeats(show._id, account._id, ['A1']);
  await assert.rejects(
    holdSeats(show._id, account._id, ['A1']),
    (e) => e.code === 'SEATS_UNAVAILABLE',
  );
});
test('a different user cannot release a hold; owner release makes seats available', async () => {
  const show = await makeShow();
  const a = await User.findOne({ email: 'user@example.test' });
  const b = await User.findOne({ email: 'other@example.test' });
  const hold = await holdSeats(show._id, a._id, ['A1']);
  await releaseHold(show._id, hold.holdId, b._id);
  assert.equal((await Show.findById(show._id)).seats[0].status, 'held');
  await releaseHold(show._id, hold.holdId, a._id);
  assert.equal((await Show.findById(show._id)).seats[0].status, 'available');
});
test('booking amounts come from server seat tiers, not untrusted client totals', async () => {
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['A1', 'H1']);
  const response = await post(user, '/api/bookings', {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
    total: 1,
    seats: [{ seatId: 'A1', price: 1 }],
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.booking.amount.total, 20000 + 35000 + 5000);
  assert.equal(response.body.booking.movieTitle, movie.title);
  assert.equal(response.body.payment.amount, 60000);
});
test('idempotent booking creation never duplicates charges under concurrency', async () => {
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['B1']);
  const body = {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  };
  const responses = await Promise.all([
    post(user, '/api/bookings', body),
    post(user, '/api/bookings', body),
  ]);
  assert.ok(responses.every((r) => r.status === 201));
  assert.equal(responses[0].body.booking._id, responses[1].body.booking._id);
  assert.equal(await Booking.countDocuments(), 1);
  assert.equal(await Payment.countDocuments(), 1);
});
test('payment failure is retryable, success is atomic and idempotent', async () => {
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['B1']);
  const created = await post(user, '/api/bookings', {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  });
  const paymentId = created.body.payment._id;
  const bookingId = created.body.booking._id;
  assert.equal(
    (
      await post(user, `/api/payments/${paymentId}/demo`, {
        outcome: 'failure',
      })
    ).status,
    200,
  );
  assert.equal((await Booking.findById(bookingId)).status, 'pending');
  const retry = await Payment.findOne({
    booking: bookingId,
    status: 'pending',
  });
  const success = await post(user, `/api/payments/${retry._id}/demo`, {
    outcome: 'success',
  });
  assert.equal(success.status, 200);
  assert.equal(success.body.booking.status, 'confirmed');
  assert.equal(
    (
      await post(user, `/api/payments/${retry._id}/demo`, {
        outcome: 'success',
      })
    ).status,
    409,
  );
  const paid = await confirmPayment({ paymentId: retry._id, provider: 'demo' });
  assert.equal(paid.status, 'confirmed');
  assert.equal(
    (await Show.findById(show._id)).seats.find((s) => s.seatId === 'B1').status,
    'booked',
  );
  assert.equal(await Notification.countDocuments({ booking: bookingId }), 1);
  assert.equal(
    (await user.get(`/api/bookings/${bookingId}`)).body.qr.startsWith('data:image/png'),
    true,
  );
  assert.equal((await other.get(`/api/bookings/${bookingId}`)).status, 404);
});
test('concurrent confirmation and cancellation cannot double-sell or lose payment state', async () => {
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['C1']);
  const booking = await createBooking(account._id, {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  });
  const payment = await Payment.findOne({ booking: booking._id });
  await confirmPayment({ paymentId: payment._id, provider: 'demo' });
  const results = await Promise.allSettled([
    post(user, `/api/bookings/${booking._id}/cancel`),
    post(user, `/api/bookings/${booking._id}/cancel`),
  ]);
  assert.ok(results.every((r) => r.status === 'fulfilled'));
  const cancelled = await Booking.findById(booking._id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.paymentStatus, 'refunded');
  assert.equal(
    (await Show.findById(show._id)).seats.find((s) => s.seatId === 'C1').status,
    'available',
  );
});
test('expired reservations release all seats and close pending payments', async () => {
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['C1', 'C2']);
  const booking = await createBooking(account._id, {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  });
  await Booking.updateOne({ _id: booking._id }, { expiresAt: new Date(Date.now() - 1000) });
  await Show.updateOne(
    { _id: show._id },
    { $set: { 'seats.$[s].holdUntil': new Date(Date.now() - 1000) } },
    { arrayFilters: [{ 's.holdId': hold.holdId }] },
  );
  await sweepExpiredReservations();
  assert.equal((await Booking.findById(booking._id)).status, 'expired');
  assert.equal((await Payment.findOne({ booking: booking._id })).status, 'failed');
  assert.ok((await Show.findById(show._id)).seats.every((s) => s.status === 'available'));
  const freshHold = await holdSeats(show._id, account._id, ['C1']);
  assert.ok(freshHold.holdId);
  await releaseHold(show._id, freshHold.holdId, account._id);
});
test('user cancellation cutoff applies; administrators may cancel late', async () => {
  const show = await makeShow(3600000);
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['C1']);
  const booking = await createBooking(account._id, {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  });
  await confirmPayment({
    paymentId: (await Payment.findOne({ booking: booking._id }))._id,
    provider: 'demo',
  });
  assert.equal((await post(user, `/api/bookings/${booking._id}/cancel`)).status, 409);
  assert.equal((await post(admin, `/api/admin/bookings/${booking._id}/cancel`)).status, 200);
});
test('public socket receives seat updates without leaking hold owners', async () => {
  const show = await makeShow();
  const client = socketClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });
  try {
    await new Promise((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
    });
    await new Promise((resolve) =>
      client.emit('show:subscribe', { showId: String(show._id) }, resolve),
    );
    const update = new Promise((resolve) => client.once('seats:updated', resolve));
    const account = await User.findOne({ email: 'user@example.test' });
    await holdSeats(show._id, account._id, ['D1']);
    const event = await update;
    assert.equal(event.seats.find((s) => s.seatId === 'D1').status, 'held');
    assert.equal(event.seats[0].holdOwner, undefined);
    assert.equal(event.seats[0].holdId, undefined);
  } finally {
    client.disconnect();
  }
});
test('booking history, notifications, profile and Stripe demo restrictions', async () => {
  assert.equal((await user.get('/api/bookings?scope=upcoming')).status, 200);
  assert.equal((await user.get('/api/bookings?scope=invalid')).status, 400);
  assert.equal(
    (await user.patch('/api/auth/me').set(header).send({ name: 'Updated Name', city: 'Bengaluru' }))
      .body.user.city,
    'Bengaluru',
  );
  assert.equal((await post(user, '/api/notifications/read')).status, 200);
  const show = await makeShow();
  const account = await User.findOne({ email: 'user@example.test' });
  const hold = await holdSeats(show._id, account._id, ['D1']);
  const booking = await createBooking(account._id, {
    showId: String(show._id),
    holdId: hold.holdId,
    idempotencyKey: randomUUID(),
  });
  await post(user, '/api/notifications/read');
  const payment = await Payment.create({
    booking: booking._id,
    user: account._id,
    provider: 'stripe',
    amount: booking.amount.total,
  });
  assert.equal(
    (
      await post(user, `/api/payments/${payment._id}/demo`, {
        outcome: 'success',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .send({})
    ).status,
    503,
  );
});
test('quote helpers use integer currency and reject invalid calendar dates', () => {
  assert.deepEqual(
    quoteSeats([{ tier: 'standard' }, { tier: 'premium' }], {
      basePrice: 10000,
      premiumPrice: 20000,
    }),
    { subtotal: 30000, fee: 5000, total: 35000, currency: 'INR' },
  );
  assert.equal(dayRange('2026-02-30'), null);
  assert.equal(dayRange('invalid'), null);
});
