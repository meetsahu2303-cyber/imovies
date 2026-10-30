# IMovies — cinema booking, end to end

A runnable MERN cinema-management application with a custom responsive React interface, Express REST API, MongoDB transactions, Socket.IO seat updates, JWT cookie sessions, and an administrator console.

**Payments:** a clearly labeled, no-charge demo gateway is the default for local development. An optional Stripe Checkout integration includes signed webhooks, server-side amount verification, idempotent confirmation, and refund handling. No real payment provider was exercised without credentials.

> This is a complete learning/reference implementation, not a claim of production certification. Review the deployment checklist before handling real customers or money. Sample cinemas, schedules, ratings, and tickets are fictional; movie artwork belongs to its respective owners.

## Quick start — no MongoDB installation needed

Requires **Node.js 20+** and npm. Node 16 is past end-of-life; this project intentionally uses a supported runtime.

```bash
cd imovies
npm ci
npm run setup
npm run dev:demo
```

Open **http://localhost:5173**. The API runs on port 4000; Vite proxies `/api`, `/uploads`, and Socket.IO, so the browser never needs a hardcoded backend hostname.

The first run downloads a MongoDB 7 binary for `mongodb-memory-server`. Internet access is needed for that download. Allow a minute for startup. The isolated demo database is seeded automatically and **removed when the server shuts down**. This mode never connects to or seeds your real MongoDB database.

### Demo sign-ins

| Role          | Email                 | Password      |
| ------------- | --------------------- | ------------- |
| Moviegoer     | `alex@imovies.local`  | `Movie@12345` |
| Administrator | `admin@imovies.local` | `Admin@12345` |

The sign-in page has buttons that fill these credentials. Click **Sign in** to submit. Registering through the API/UI always creates a regular user, even if a client submits `role: admin`.

Try the complete flow:

1. Discover a movie, choose a city/date, and select a showtime.
2. Select seats and reserve them. Sign in if prompted.
3. Continue to payment. Test a simulated decline, then a successful retry.
4. View the QR-reference ticket and booking history; cancel to release the seats.
5. Sign in as the administrator to manage movies, cinemas, screen layouts, shows, and bookings.

## Publish a GitHub link and a public mentor-review demo

See **[docs/SUBMISSION_GUIDE.md](docs/SUBMISSION_GUIDE.md)** for the beginner-friendly GitHub → MongoDB Atlas → Render walkthrough. The included `render.yaml` creates an explicit, no-charge **review deployment** with secure cookies and a persistent Atlas database. It is separate from a real-payment production deployment. Review sign-in credentials are generated locally and are not embedded in the public website or Git repository.

## Persistent MongoDB setup

Use MongoDB Atlas (replica sets by default), or the included local replica-set Compose service.

For a persistent local database, use the included `compose.local-db.yml`:

The service binds MongoDB only to localhost. Set `MONGODB_URI=mongodb://127.0.0.1:27017/imovies?replicaSet=rs0` in `.env`, then:

```bash
docker compose -f compose.local-db.yml up -d --wait
npm run seed
npm run dev
```

Alternatively set `MONGODB_URI` to your Atlas connection string. **Transactions require a replica set**; a standalone local `mongod` is rejected with an explanatory startup error. The server creates indexes before listening.

`npm run seed` is explicit and skips a database that already contains users. It does not reset passwords or overwrite bookings. It creates sample movies, four cinemas, physical seats, six days of shows, and two consistent demo bookings. Re-running it later does not extend old schedules; use the admin console to add new shows.

To create an administrator in a clean persistent database, set strong `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` values in `.env`, then run:

```bash
npm run admin:create
```

The command refuses to silently promote or overwrite an existing account. Passwords must have 10–72 characters with uppercase, lowercase, and a number. Demo seeding is forbidden when `NODE_ENV=production`.

## Features

### Moviegoers

- Featured movies, now-showing and upcoming catalogs, pagination.
- Full-text movie/director search; genre, language, city, cinema, and business-date filters.
- Movie details, cast, languages, certificates, formats, and grouped showtimes.
- Cinema directory and per-cinema schedules.
- Responsive, keyboard-accessible seat map with aisles and premium pricing.
- Atomic five-minute seat holds; Socket.IO availability updates and reconnect support.
- Booking creation with idempotency keys and server-calculated integer-paise totals.
- Ten-minute demo checkout reservation; retryable simulated payment failures.
- Confirmed tickets with QR reference, printable layout, and text download.
- Upcoming/past booking history, cancellation, and refund status.
- Profile editing, notifications, and secure sign-out.

### Administrators

- Dashboard with paid booking value, paid seat count, active catalog/cinema counts, and booking activity.
- Movie create/edit/archive and validated poster upload (real JPEG/PNG/WebP, maximum 5 MB).
- Cinema create/edit/deactivate, multiple screens, row/column layouts, aisles, premium rows, and geolocation.
- Show create/edit/cancel, screen-overlap prevention, and automatic 20-minute cleaning buffers.
- Paginated booking management, late cancellation with refund, and failed-refund retry.
- Active reservations/bookings protect shows and layouts from destructive changes.
- Movie/theatre removal is implemented as safe archival/deactivation, retaining financial history.

### API and data

- Eight requested collections: Users, Movies, Theatres, Shows, Seats, Bookings, Payments, Notifications.
- Additional Sessions and WebhookEvents collections support revocation and payment idempotency.
- Physical seat inventory lives in Seats; each Show stores an independent seat-state snapshot so future layout edits cannot rewrite historical availability.
- MongoDB transactions atomically create bookings and payments, confirm tickets, release cancelled seats, and record notifications.
- Unique user/idempotency-key index prevents duplicate booking creation.
- A partial unique index allows only one pending payment per booking/provider.
- Indexed catalog, showtime, booking-history, session, and hold-expiry queries.
- Background reservation expiry and completed-show sweeps every ten seconds.
- Zod validation, centralized errors, request IDs, structured Pino logs, Helmet, CORS allowlist, CSRF request checks, and API/auth/booking rate limits.

## Environment

`npm run setup` creates a gitignored `.env` with a random JWT secret. See `.env.example` for all settings.

| Variable                | Meaning                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | `development`, `test`, or `production`                                                              |
| `PORT`                  | Express port; default 4000                                                                          |
| `CLIENT_ORIGIN`         | Allowed frontend origin; comma-separated values supported. First value is the Stripe return origin. |
| `MONGODB_URI`           | Replica-set connection URI; ignored only by explicit `--memory` mode                                |
| `JWT_SECRET`            | At least 32 characters; use a unique random secret                                                  |
| `COOKIE_SECURE`         | `true` for HTTPS; required in production                                                            |
| `COOKIE_SAMESITE`       | `lax` by default; `strict` or `none` are supported                                                  |
| `TRUST_PROXY`           | Number of trusted reverse-proxy hops; default 0                                                     |
| `PAYMENT_PROVIDER`      | `demo` or `stripe`; production refuses demo                                                         |
| `STRIPE_SECRET_KEY`     | Stripe test/live secret key; server only                                                            |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this application's webhook endpoint                                              |
| `ALLOW_PREVIEW`         | Development-only allowance for Arena's E2B preview origin; keep false locally                       |
| `SEED_*`                | Explicit demo seed/admin creation credentials                                                       |

Never put secrets in `VITE_*` variables: Vite exposes those to browsers. Tokens are not stored in localStorage. The frontend keeps only the selected city in localStorage and a temporary seat selection in sessionStorage.

## Stripe test mode

1. Create a Stripe test account and obtain a test secret key.
2. Set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.env`.
3. Forward webhooks with the Stripe CLI:

   ```bash
   stripe listen --forward-to localhost:4000/api/payments/stripe/webhook
   ```

4. Copy the printed `whsec_...` into `.env` and restart the server.
5. Use Stripe's published test card `4242 4242 4242 4242`, any future expiry, and any CVC **on Stripe's hosted test checkout only**. IMovies never collects card data.
6. Select a show at least 31 minutes away. Stripe Checkout requires a 30-minute minimum session; the app holds seats for 40 minutes.
7. Complete or cancel checkout. The return page polls booking status; only the verified webhook confirms the ticket.

Implemented events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `charge.refunded`.

The endpoint verifies the raw-body signature, metadata, amount, and currency. Payment confirmation and the webhook event record commit together. A paid booking whose seats can no longer be secured is marked for refund instead of double-selling. Refunds use Stripe idempotency keys and complete when the refund webhook arrives.

**Important:** the automated suite exercises Stripe with mocked network calls and locally generated valid webhook signatures. Live Stripe account/CLI behavior still needs validation with your own test credentials before deployment.

## Security model

- bcrypt password hashes (cost 12 for application registration).
- 15-minute HS256 JWT access cookies with issuer/audience checks.
- Seven-day random refresh tokens; only SHA-256 hashes are stored in MongoDB.
- Refresh rotation and server-side session revocation on logout.
- HTTP-only cookies; Secure in production; configurable SameSite.
- Every mutating JSON API request requires `X-Requested-With: XMLHttpRequest`; supplied Origins must be allowlisted. Unsafe cross-site forms cannot set this header, and untrusted script origins do not receive CORS permission.
- The raw Stripe webhook is the sole exception to the JSON mutation header rule and uses signature verification instead.
- Role checks occur on the server; hiding admin navigation is not the security boundary.
- Users can read/cancel only their own bookings. Administrators can manage all bookings.
- Public seat broadcasts never expose hold owners, hold tokens, or booking IDs.
- JWT/session authentication protects private Socket.IO rooms. Public show rooms are intentional.
- Passwords, cookie headers, and authorization headers are redacted from logs.

This reference uses a single trusted frontend origin in production. If you deploy the frontend and API on different sites, review third-party cookie restrictions and prefer a same-site reverse proxy. Multiple API replicas should use a shared Socket.IO adapter and distributed rate-limit store.

## Tests

```bash
npm test             # Real MongoDB replica-set integration tests; no external database needed
npm run build        # Production React bundle
npm run check        # Both
npm audit --omit=dev
```

The first test run may download the test MongoDB binary. Tests use isolated databases and mocked Stripe network calls; they never charge a card.

Coverage includes registration/login, password hashing, role injection, CSRF/origin protection, refresh rotation, session revocation, search/filter/date handling, admin CRUD, concurrent schedule creation, competing and overlapping seat holds, hold ownership, server-side pricing, idempotent booking/payment, decline/retry, cancellation/refund, expiry cleanup, private booking access, Socket.IO privacy, Stripe signature validation, amount/metadata mismatch, webhook replay, and seat-conflict refunds.

See [docs/TESTING.md](docs/TESTING.md) for the manual/browser checklist and verification record.

## Postman and API docs

Import `docs/IMovies.postman_collection.json` into Postman. Run **Login** first; its test script saves the collection's booking variables after subsequent requests. All mutation requests include the required custom header. The cookie jar handles authentication automatically.

- [REST API reference](docs/API.md)
- [Architecture and booking lifecycle](docs/ARCHITECTURE.md)
- [Deployment checklist](docs/DEPLOYMENT.md)

## Build and container deployment

```bash
npm run build
NODE_ENV=production PAYMENT_PROVIDER=stripe \
CLIENT_ORIGIN=https://cinema.example.com COOKIE_SECURE=true \
npm start
```

Express serves `client/dist` and the API from one origin. Supply the required MongoDB and Stripe environment variables as well.

The multi-stage Docker image runs as the non-root `node` user. The full Compose stack includes a private MongoDB replica set and persistent upload/database volumes:

```bash
# Set a strong JWT_SECRET in .env first.
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

The local override enables development/demo mode on HTTP. It does not seed accounts: run `docker compose exec app npm run seed -w server` once if you explicitly want local demo data. Without the override, the application runs in production mode and requires Stripe plus HTTPS (`COOKIE_SECURE=true`). Never use the local override publicly.

After the container database is running, create an admin explicitly with the admin script and your own credentials. The container does not auto-seed demo accounts.

## Project layout

```text
imovies/
├── client/                  React + Vite + Redux Toolkit
│   ├── public/posters/      Local demo artwork; no runtime image CDN dependency
│   └── src/
│       ├── components/      Shared UI, layout, route guards, accessible dialogs
│       ├── lib/             Axios, hooks, Socket.IO context
│       ├── pages/           Discovery, seats, checkout, tickets, admin, auth
│       └── store/           Redux authentication and UI state
├── server/
│   ├── src/
│   │   ├── config/          Validated environment and replica-set connection
│   │   ├── controllers/     HTTP request/response layer
│   │   ├── middleware/      Authentication, security, error handling
│   │   ├── models/          Mongoose schemas and indexes
│   │   ├── realtime/        Commit-driven domain events and Socket.IO
│   │   ├── routes/          REST routes and rate limits
│   │   ├── scripts/         Explicit seed/admin commands
│   │   ├── services/        Booking transactions, catalog, Stripe gateway
│   │   └── utils/           Validation, integer money, logging
│   └── tests/               Node test runner + Supertest integration tests
├── docs/                    API, architecture, Postman, testing, deployment
├── scripts/setup.mjs        Secure local environment bootstrap
└── docker-compose.yml       Application + private MongoDB replica set
```

## Known boundaries

- QR codes encode a ticket reference, not a cryptographically signed admission pass. A real deployment needs staff-side verification and anti-replay check-in.
- No email delivery, password-reset mailer, payment-provider onboarding, tax engine, loyalty program, or real cinema inventory feed is included.
- Show ratings and prices are illustrative, not live data.
- The local rate-limit store and single-process Socket.IO setup suit one API instance. Scale-out requires shared infrastructure.
- Back up MongoDB and uploaded images, configure log retention/alerting, and perform security and load testing before production.

## Version control

```bash
git init
git add .
git commit -m "Build IMovies cinema booking platform"
```

`.env`, databases, dependencies, build output, logs, and uploaded customer files are excluded. A GitHub Actions workflow runs tests, build, and dependency audit on pushes/pull requests.
