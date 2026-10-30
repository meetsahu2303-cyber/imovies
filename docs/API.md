# REST API reference

Base path: `/api`. JSON request/response bodies unless uploading an image or receiving a Stripe webhook.

## Authentication and mutation headers

Browser authentication uses HTTP-only cookies. Do not send a JWT in a JSON body or store one in localStorage.

Every mutation except the Stripe webhook must include:

```http
X-Requested-With: XMLHttpRequest
Content-Type: application/json
```

When an `Origin` header is present it must match `CLIENT_ORIGIN`. Use the same origin in production. Postman should use its cookie jar; run Login first.

Access cookie lifetime: 15 minutes. Refresh cookie lifetime: seven days, path `/api/auth`. `POST /auth/refresh` rotates the refresh token. A consumed refresh token cannot be reused.

Pagination: `page` starts at 1; `limit` is 1–50. Paginated responses contain `items` and `pagination: { page, limit, total, pages }`.

Errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields.",
    "details": [{ "field": "password", "message": "Include a number" }]
  },
  "requestId": "uuid"
}
```

Common statuses: 400 validation, 401 authentication, 403 role/CSRF, 404 missing/private resource, 409 state/concurrency conflict, 413 upload size, 429 rate limit, 500 unexpected server error. Internal exception details are not returned to clients.

## Public endpoints

| Method | Path                    | Purpose                                                       |
| ------ | ----------------------- | ------------------------------------------------------------- |
| GET    | `/health`               | Process liveness; does not perform a DB ping                  |
| GET    | `/config`               | Payment mode, demo flag, timezone, hold length, maximum seats |
| GET    | `/metadata`             | Available genres/languages/cities                             |
| GET    | `/movies`               | Paginated catalog                                             |
| GET    | `/movies/:idOrSlug`     | Movie details; archived movies are hidden                     |
| GET    | `/theatres?city=Mumbai` | Active cinemas, up to 100                                     |
| GET    | `/shows`                | Future scheduled shows, up to 250; no seat states             |
| GET    | `/shows/:id`            | Show, movie, cinema, and sanitized seat availability          |

Movie query parameters:

- `q`: MongoDB text search over title, synopsis, director (words/stemming, not substring matching).
- `genre`, `language`: exact offered values.
- `city`, `theatre`: active cinema location/ID.
- `date`: `YYYY-MM-DD`, interpreted in Asia/Kolkata.
- `status`: `now_showing` (default), `upcoming`, `all`.
- `sort`: `popular` (featured/rating), `release`, `title`.
- `page`, `limit`.

Show query parameters: `movie`, `theatre`, `city`, `date`. Date and location filters combine. Catalog date/location filters select movies with at least one matching future show.

## Auth and profile

| Method | Path             | Body / result                                                    |
| ------ | ---------------- | ---------------------------------------------------------------- |
| POST   | `/auth/register` | `{name,email,password,city?}` → user + cookies; role always user |
| POST   | `/auth/login`    | `{email,password}` → user + cookies                              |
| POST   | `/auth/session`  | Bootstrap current user or null; refresh if needed                |
| POST   | `/auth/refresh`  | Rotate refresh cookie, issue access cookie                       |
| POST   | `/auth/logout`   | Revoke refresh session, clear cookies                            |
| GET    | `/auth/me`       | Current public user; authentication required                     |
| PATCH  | `/auth/me`       | `{name,city}` → updated user                                     |

Passwords: 10–72 characters with uppercase, lowercase, and a number. Public user objects never contain password hashes or session tokens.

## Seat holds and bookings

| Method | Path                       | Body / purpose                                               |
| ------ | -------------------------- | ------------------------------------------------------------ |
| POST   | `/shows/:id/holds`         | `{seatIds:["D6","D7"]}` → holdId, expiry, quote              |
| DELETE | `/shows/:id/holds`         | `{holdId}`; only owner can release                           |
| POST   | `/bookings`                | `{showId,holdId,idempotencyKey}` → booking + pending payment |
| GET    | `/bookings?scope=upcoming` | Own history; `all`, `upcoming`, `past`                       |
| GET    | `/bookings/:id`            | Own booking, safe payment attempts, QR data when confirmed   |
| POST   | `/bookings/:id/checkout`   | Create/reuse checkout for latest pending payment             |
| POST   | `/bookings/:id/cancel`     | Cancel own confirmed booking before two-hour cutoff          |
| POST   | `/payments/:id/demo`       | `{outcome:"success"                                          | "failure"}`; demo mode only |
| GET    | `/notifications`           | Latest 50 notifications and unread count                     |
| POST   | `/notifications/read`      | Mark all own notifications read                              |

`idempotencyKey` must be a UUID. Reuse it for retries of the same logical booking; generate a new one for a new selection. Reusing a key with a different show/hold returns 409.

All prices are integer paise. Booking amount contains `subtotal`, `fee`, `total`, `currency`. The server ignores injected price/total fields.

Booking states: `pending`, `confirmed`, `cancelled`, `expired`. Payment states: `pending`, `succeeded`, `failed`, `refunded`. A declined demo attempt closes that attempt and creates a new pending attempt; it does not immediately release seats.

Admins may read any booking detail. Only administrators may use the admin cancellation endpoint for another user's booking or a late cancellation.

## Administrator endpoints

All `/admin/*` endpoints require an active administrator session.

| Method | Path                               | Purpose                                                                 |
| ------ | ---------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/admin/dashboard`                 | Counts, paid booking value, paid seat count, recent activity            |
| GET    | `/admin/movies`                    | Paginated catalog including archived records                            |
| POST   | `/admin/movies`                    | Create movie                                                            |
| PUT    | `/admin/movies/:id`                | Update movie; partial fields accepted                                   |
| DELETE | `/admin/movies/:id`                | Archive; protected if active reservations exist                         |
| GET    | `/admin/theatres`                  | Cinemas including inactive records                                      |
| POST   | `/admin/theatres`                  | Create cinema/screens and physical seats                                |
| PUT    | `/admin/theatres/:id`              | Replace cinema fields/screen definitions                                |
| DELETE | `/admin/theatres/:id`              | Deactivate; future shows must be removed first                          |
| GET    | `/admin/shows`                     | Paginated show schedule                                                 |
| POST   | `/admin/shows`                     | Schedule show; validates overlap/cleaning buffer                        |
| PUT    | `/admin/shows/:id`                 | Replace show fields; active holds/bookings block edits                  |
| DELETE | `/admin/shows/:id`                 | Cancel show; active bookings block cancellation                         |
| GET    | `/admin/bookings?status=confirmed` | Paginated all-user booking log                                          |
| POST   | `/admin/bookings/:id/cancel`       | Cancel/refund, including late cancellation                              |
| POST   | `/admin/bookings/:id/refund-retry` | Reconcile/retry a failed or pending Stripe refund (provider-idempotent) |
| POST   | `/admin/uploads`                   | Multipart field `image`; returns safe local URL                         |

Cinema and show PUT requests are full replacements: send all required fields, not only the changed field. Preserve existing screen IDs when editing a cinema. The included admin UI does this automatically.

Example movie:

```json
{
  "title": "A New Movie",
  "description": "A sufficiently detailed description of the film.",
  "poster": "/posters/interstellar.jpg",
  "backdrop": "",
  "genres": ["Drama", "Thriller"],
  "languages": ["English"],
  "duration": 120,
  "rating": 8.2,
  "certificate": "UA",
  "releaseDate": "2026-10-01T00:00:00+05:30",
  "director": "Director Name",
  "cast": ["Actor One", "Actor Two"],
  "status": "now_showing",
  "featured": false,
  "formats": ["2D"]
}
```

Example cinema:

```json
{
  "name": "IMovies Example",
  "city": "Mumbai",
  "address": "Example road, Mumbai",
  "amenities": ["Dolby Atmos", "Accessible seating"],
  "longitude": 72.8777,
  "latitude": 19.076,
  "active": true,
  "screens": [
    {
      "name": "Screen 1",
      "rows": 8,
      "columns": 12,
      "aisleAfter": 6,
      "premiumFrom": 6
    }
  ]
}
```

Example show (replace IDs with actual records):

```json
{
  "movie": "<movie ObjectId>",
  "theatre": "<theatre ObjectId>",
  "screen": "<screen ObjectId>",
  "startsAt": "2026-12-01T19:00:00+05:30",
  "basePrice": 22000,
  "premiumPrice": 35000,
  "format": "2D",
  "language": "English"
}
```

Images must be actual JPEG, PNG, or WebP content, not merely a renamed file. Maximum 5 MB. SVG, HTML, and executable uploads are rejected. Movie image URLs accept HTTPS or `/posters/...`/`/uploads/...` paths.

## Stripe webhook

`POST /api/payments/stripe/webhook`

This route receives the raw JSON body and `Stripe-Signature` header. Do not add the JSON mutation header or parse/re-serialize the body in a proxy. Configure these events in Stripe:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `charge.refunded`

A valid signature alone is not enough: metadata, amount, currency, and stored reference are verified. Webhook replay is idempotent. A non-2xx response tells Stripe to retry. The app never trusts the frontend success redirect as payment confirmation.

## Socket.IO

Same origin, cookie credentials. Public events:

- Emit `show:subscribe` with `{showId}` and optional acknowledgment callback.
- Receive `seats:updated` with `{showId,seats,basePrice,premiumPrice,status}`.
- Emit `show:unsubscribe` with the show ID.

Authenticated private events: `booking:updated`, `notification:new`, `session:expired`. Public show subscriptions are rate-limited per socket. A REST fetch after reconnect reconciles any missed best-effort broadcast.
