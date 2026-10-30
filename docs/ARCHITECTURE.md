# Architecture and booking lifecycle

## Request path

React → same-origin Axios (`/api`) → Express security middleware → Zod validation → controller → service → Mongoose/MongoDB.

Vite proxies API, upload, and Socket.IO traffic during development. In production Express serves the built React application and API on the same origin. The client never uses a sandbox-specific hostname or localhost URL.

## Data model

- **User:** unique normalized email, bcrypt hash, role, active flag, preferred city.
- **Session:** user reference, hashed rotating refresh token, TTL expiry.
- **Movie:** searchable catalog metadata, poster/backdrop, genres/languages, runtime, release/listing status.
- **Theatre:** address, city, geolocation, amenities, embedded screen layout definitions, schedule revision.
- **Seat:** physical seat inventory, unique `(theatre, screen, seatId)`.
- **Show:** movie/theatre/screen references, start/end, language/format, prices, embedded seat-state snapshot.
- **Booking:** immutable movie/cinema/time/seat/price snapshot, user, show, status, hold token, expiry, unique client idempotency key.
- **Payment:** provider/reference, amount/currency, lifecycle state; at most one pending payment per booking/provider.
- **Notification:** user-scoped booking updates and read state.
- **WebhookEvent:** unique provider event ID, 90-day TTL, idempotency record.

Show seat snapshots prevent later screen changes from rewriting historical seating. Physical Seats are created/updated when a cinema layout is saved. The embedded show seat array is the authoritative real-time reservation state.

## Seat state machine

```text
available --atomic hold--> held --verified payment--> booked
    ^                       |                         |
    |----release/expiry-----+                         |
    |----confirmed cancellation/refund flow-----------+
```

A hold contains a random UUID, owner, and expiry. Public responses expose only seat ID, row, number, tier, and effective availability. An expired held seat is displayed as available even before the background sweeper runs.

### Competing holds

One `findOneAndUpdate` matches the show and **all** requested seats using `$all`/`$elemMatch`. MongoDB's single-document atomicity ensures only one competing request can acquire an overlapping set. The update never creates a partial hold. The client cannot submit prices, hold owners, or booking totals as authoritative values.

### Reservation and checkout

1. Authenticated user holds 1–8 distinct seats for five minutes.
2. Booking creation opens a MongoDB transaction, verifies ownership and expiry, computes the price from seat tiers, creates Booking and Payment, and extends the hold.
3. Demo checkout allows ten minutes from booking creation, capped at show start. Stripe checkout uses a 40-minute hold and a 30-minute hosted session, also capped at show start.
4. A stable idempotency key protects booking creation against network retries and concurrent submissions.
5. The client's payment success screen is never used as proof of payment.

### Confirmation

A transaction verifies payment/booking state, matches every held seat to the booking owner/token, marks seats booked, confirms the booking, succeeds the payment, and creates a notification. The Stripe event ID is recorded in the same transaction.

Stripe webhook metadata, amount, currency, and checkout reference are checked before confirmation. A late webhook may claim an expired but still unclaimed hold before the sweeper releases it. It may never take a seat acquired by another customer. A paid conflict is cancelled and marked for refund.

### Expiry and cancellation

The ten-second sweeper expires pending bookings and their payments, releases matching held seats, releases orphaned expired holds, and completes ended shows. A background sweep is bounded to 500 records per category per pass; high-volume deployments should use a dedicated worker/queue and monitor backlog.

Users can cancel confirmed bookings until two hours before showtime. Administrators can override that cutoff. Seat release and cancellation commit atomically. Demo refunds are simulated immediately; Stripe refunds are initiated with an idempotency key and completed by `charge.refunded`.

Cancellation opens seat inventory before a Stripe refund finishes. This is intentional: refund settlement must not keep seats unavailable. Failed API refund attempts become `refund_failed` and can be retried by an administrator. Provider/network failures are logged. Administrators can retry `refund_pending` or `refund_failed` records using the same provider idempotency key if the process crashes after a refund request; do not assume a bank settlement time.

## Schedule concurrency

Show create/edit/cancel transactions increment the theatre's schedule revision. This write lock serializes schedule changes for that cinema. Overlap queries run inside the transaction and include a 20-minute cleaning buffer. Screen layouts referenced by future scheduled shows cannot be resized or removed. Shows with active holds/bookings cannot be edited or cancelled until reservations are released/refunded.

## Real-time delivery

Domain events are emitted **after** database commits. Socket.IO broadcasts sanitized seat snapshots to subscribed show rooms. Private booking/notification events go only to authenticated user rooms. Clients can resubscribe after reconnect; the subscription acknowledgment includes an authoritative snapshot. REST remains the final authority, not an optimistic local UI state.

This implementation uses one API process. Multiple instances require a shared Socket.IO Redis adapter (or equivalent); otherwise a commit on instance A will not reach a socket connected to instance B.

## Authentication

The access JWT is signed with HS256 and includes subject, session ID (`jti`), issuer, audience, role, and expiry. Every protected request checks the current session and active user in MongoDB, so role changes/deactivation/revocation take effect without waiting for JWT expiry.

Refresh tokens are cryptographically random, stored only as hashes, scoped to `/api/auth`, and rotated. Logout removes the refresh session and clears both cookies. Session bootstrap uses a POST endpoint so anonymous visitors do not generate authentication-error console noise.

## Monetary values

All prices/totals are integer Indian paise. Standard and premium prices come from Show; the convenience fee is ₹25 per seat. The UI formats INR for display. Stripe receives the server-stored integer amount. This reference does not implement jurisdiction-specific GST or dynamic taxes.

## Important operational boundaries

This is a complete reference implementation, not a production certification. Before launch, add staff-side ticket verification, monitoring/alerting, backup/restore tests, distributed limits/events for scale-out, a durable payment reconciliation/outbox worker, email/account recovery, legal policies, and a security/load-test review. See DEPLOYMENT.md.
