import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const root = new URL('../', import.meta.url);
const item = (name, method, path, body, script = [], rawPath) => ({
  name,
  request: {
    method,
    header: [
      { key: 'X-Requested-With', value: 'XMLHttpRequest' },
      ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : []),
    ],
    url: {
      raw: rawPath || `{{baseUrl}}${path}`,
      host: rawPath ? undefined : ['{{baseUrl}}'],
      path: rawPath ? undefined : path.split('/').filter(Boolean),
    },
    ...(body
      ? {
          body: {
            mode: 'raw',
            raw: JSON.stringify(body, null, 2),
            options: { raw: { language: 'json' } },
          },
        }
      : {}),
  },
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: ['pm.test("Request succeeded", () => pm.response.to.be.success);', ...script],
      },
    },
  ],
});
const capture = (key, path) =>
  `pm.collectionVariables.set(${JSON.stringify(key)}, pm.response.json()${path});`;
const requests = [
  item('Health', 'GET', '/health'),
  item('Configuration', 'GET', '/config'),
  item('Login — moviegoer', 'POST', '/auth/login', {
    email: '{{userEmail}}',
    password: '{{userPassword}}',
  }),
  item('Login — administrator', 'POST', '/auth/login', {
    email: '{{adminEmail}}',
    password: '{{adminPassword}}',
  }),
  item('Current user', 'GET', '/auth/me'),
  item('Register user', 'POST', '/auth/register', {
    name: 'Postman Moviegoer',
    email: `postman-${Date.now()}@example.test`,
    password: 'PostmanPassword123',
    city: 'Mumbai',
  }),
  item('Refresh session', 'POST', '/auth/refresh'),
  item('Movie catalog', 'GET', '/movies?status=now_showing&page=1&limit=12', null, [
    capture('movieId', '.items[0]._id'),
  ]),
  item('Search and filter movies', 'GET', '/movies?q=Interstellar&genre=Sci-Fi&language=English'),
  item('Movie details', 'GET', '/movies/{{movieId}}'),
  item('Theatres', 'GET', '/theatres?city=Mumbai', null, [capture('theatreId', '.items[0]._id')]),
  item('Shows', 'GET', '/shows?city=Mumbai', null, [capture('showId', '.items[0]._id')]),
  item('Seat availability', 'GET', '/shows/{{showId}}'),
  item('Hold seats', 'POST', '/shows/{{showId}}/holds', { seatIds: ['A1', 'A2'] }, [
    capture('holdId', '.holdId'),
  ]),
  item(
    'Create booking',
    'POST',
    '/bookings',
    {
      showId: '{{showId}}',
      holdId: '{{holdId}}',
      idempotencyKey: '{{idempotencyKey}}',
    },
    [capture('bookingId', '.booking._id'), capture('paymentId', '.payment._id')],
  ),
  item('Retry same booking (idempotent)', 'POST', '/bookings', {
    showId: '{{showId}}',
    holdId: '{{holdId}}',
    idempotencyKey: '{{idempotencyKey}}',
  }),
  item('Checkout', 'POST', '/bookings/{{bookingId}}/checkout'),
  item('Simulate payment failure', 'POST', '/payments/{{paymentId}}/demo', {
    outcome: 'failure',
  }),
  item('Get new pending payment', 'GET', '/bookings/{{bookingId}}', null, [
    capture('paymentId', '.payments.find(p => p.status === "pending")._id'),
  ]),
  item('Simulate payment success', 'POST', '/payments/{{paymentId}}/demo', {
    outcome: 'success',
  }),
  item('Booking details and QR', 'GET', '/bookings/{{bookingId}}'),
  item('Upcoming bookings', 'GET', '/bookings?scope=upcoming'),
  item('Past bookings', 'GET', '/bookings?scope=past'),
  item('Notifications', 'GET', '/notifications'),
  item('Read notifications', 'POST', '/notifications/read'),
  item('Cancel booking', 'POST', '/bookings/{{bookingId}}/cancel'),
  item('Release hold (alternative to booking)', 'DELETE', '/shows/{{showId}}/holds', {
    holdId: '{{holdId}}',
  }),
  item('Admin dashboard', 'GET', '/admin/dashboard'),
  item('Admin movies', 'GET', '/admin/movies'),
  item(
    'Admin create movie',
    'POST',
    '/admin/movies',
    {
      title: 'Postman Test Movie',
      description: 'A movie created by the API test collection.',
      poster: '/posters/interstellar.jpg',
      genres: ['Drama'],
      languages: ['English'],
      duration: 100,
      rating: 8,
      certificate: 'UA',
      releaseDate: new Date().toISOString(),
      formats: ['2D'],
      status: 'now_showing',
    },
    [capture('createdMovieId', '.movie._id')],
  ),
  item('Admin update movie', 'PUT', '/admin/movies/{{createdMovieId}}', {
    title: 'Postman Updated Movie',
    rating: 9,
  }),
  item('Admin archive movie', 'DELETE', '/admin/movies/{{createdMovieId}}'),
  item('Admin theatres', 'GET', '/admin/theatres'),
  item(
    'Admin create theatre',
    'POST',
    '/admin/theatres',
    {
      name: 'Postman Cinema',
      city: 'Mumbai',
      address: 'A test cinema address',
      screens: [
        {
          name: 'Screen 1',
          rows: 5,
          columns: 8,
          aisleAfter: 4,
          premiumFrom: 4,
        },
      ],
    },
    [
      capture('createdTheatreId', '.theatre._id'),
      capture('createdScreenId', '.theatre.screens[0]._id'),
    ],
  ),
  item('Admin deactivate theatre', 'DELETE', '/admin/theatres/{{createdTheatreId}}'),
  item('Admin shows', 'GET', '/admin/shows'),
  item('Admin bookings', 'GET', '/admin/bookings'),
  item('Admin cancel and refund', 'POST', '/admin/bookings/{{bookingId}}/cancel'),
  item('Update profile', 'PATCH', '/auth/me', {
    name: 'Alex Morgan',
    city: 'Mumbai',
  }),
  item('Logout', 'POST', '/auth/logout'),
];
const collection = {
  info: {
    name: 'IMovies Cinema API',
    description:
      'Run against npm run dev:demo. Login first. Holds → Create booking → Checkout → Payment success → Cancel. Run admin requests with the administrator login. Variables are populated by test scripts. Do not run destructive admin requests against real customer data.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000/api' },
    { key: 'userEmail', value: 'alex@imovies.local' },
    { key: 'userPassword', value: 'Movie@12345' },
    { key: 'adminEmail', value: 'admin@imovies.local' },
    { key: 'adminPassword', value: 'Admin@12345' },
    { key: 'idempotencyKey', value: randomUUID() },
    ...[
      'movieId',
      'theatreId',
      'showId',
      'holdId',
      'bookingId',
      'paymentId',
      'createdMovieId',
      'createdTheatreId',
      'createdScreenId',
    ].map((key) => ({ key, value: '' })),
  ],
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          "if (pm.request.url.toString().includes('/bookings') && pm.request.method === 'POST' && pm.request.body?.raw?.includes('idempotencyKey')) { /* Keep the key stable for explicit retries. Change it manually for a new booking. */ }",
        ],
      },
    },
  ],
  item: requests,
};
writeFileSync(
  new URL('docs/IMovies.postman_collection.json', root),
  JSON.stringify(collection, null, 2),
);
console.log(`Generated ${requests.length} Postman requests.`);
