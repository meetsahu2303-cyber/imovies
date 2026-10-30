# Testing and validation

## Automated backend tests

`npm test` starts isolated, real MongoDB replica sets and runs 28 integration/unit tests. Stripe network operations are mocked; webhook signatures are generated locally with Stripe's test helper. No live payment is made.

Suites:

- `server/tests/booking.test.js`: 22 tests covering auth/security, catalog filters, admin CRUD/scheduling, seat contention/ownership, pricing, booking/payment idempotency, failure/retry, cancellation, expiry, privacy, and Socket.IO.
- `server/tests/payments.test.js`: six tests covering Stripe checkout amount/idempotency, confirmation/replay, metadata/amount validation, conflict refunds, and signed webhook verification.

See `test-results.log` for the most recent local run. Logs are excluded from the source archive.

## Browser checks

Tested with Chromium through Playwright against the running React/Express/MongoDB application:

- Home artwork, movie cards, navigation, and featured-film controls render.
- Movie detail and date/cinema show selection.
- Moviegoer demo sign-in and cookie-authenticated booking.
- Select two seats, reserve, continue to checkout.
- Simulated payment decline followed by successful retry and confirmed ticket.
- Cancellation changes ticket state and releases inventory (also verified by backend integration tests).
- Movie search narrows the catalog.
- 390 px mobile home/catalog/seat layout; no page-level horizontal overflow. Seat map intentionally scrolls inside its own container.
- Admin authentication and management screens; browser-tested movie create/edit/archive and poster-path validation.

Two issues found during browser testing were fixed and retested:

1. The seat page now reads the actual Redux user rather than the entire auth state.
2. A client's own newly held seats are retained when its hold broadcast arrives, rather than being mistaken for another user's hold.

## Manual acceptance checklist

### Authentication

- [ ] Register a new user; confirm role is user and password hash is never returned.
- [ ] Reject weak passwords, duplicate email, and incorrect credentials.
- [ ] Refresh the page while signed in; session persists.
- [ ] Wait for access expiry; a protected request refreshes the session.
- [ ] Sign out; protected pages redirect and old refresh cookies cannot restore the session.
- [ ] Regular user cannot open admin APIs; unauthenticated user cannot read another booking.

### Catalog/admin

- [ ] Search by title/director and combine genre/language/cinema/date filters.
- [ ] Create/edit/archive a movie; upload a valid image and reject a renamed non-image.
- [ ] Create/edit a cinema and inspect generated seats.
- [ ] Schedule a show; overlapping screening is rejected.
- [ ] Attempt to resize a screen with scheduled future shows; request is rejected.
- [ ] Attempt to delete a show with active bookings; request is rejected.

### Booking and payment

- [ ] Two browser accounts compete for overlapping seats; only one hold succeeds.
- [ ] Public availability updates in the other browser without revealing owner information.
- [ ] Release a hold or wait for expiry; seats become available again.
- [ ] Retry the same booking idempotency key; one booking/payment is created.
- [ ] Simulate a declined payment and retry successfully before expiry.
- [ ] Refresh the ticket page; QR/reference and booking details remain available.
- [ ] Cancel before cutoff; booking is cancelled and seats are released exactly once.
- [ ] User cannot cancel within two hours; admin can perform a late cancellation.
- [ ] In Stripe test mode, verify signature failure, correct payment, duplicate webhook, cancellation/refund, and paid seat-conflict refund.

### Responsive/accessibility

- [ ] Test widths 390, 768, 1280 px; navigation and dialogs remain usable.
- [ ] Tab through seat controls; selected state is exposed with aria-pressed.
- [ ] Scroll wide seat maps inside their container rather than clipping the entire page.
- [ ] Native dialogs trap focus and close with Escape.
- [ ] Reduced-motion preference disables decorative animations.
- [ ] Print a confirmed ticket; navigation and unrelated controls are hidden.

## Not validated here

Live Stripe account/CLI interaction, real cinema admission scanning, email delivery, high-volume load, screen-reader certification, and deployment-specific infrastructure. These require your credentials/environment and are explicitly listed in the deployment checklist.
