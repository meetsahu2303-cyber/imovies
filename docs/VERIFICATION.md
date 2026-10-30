# Verification record

Verified locally on 2026-10-29/30 against Node 20, real temporary MongoDB 7 replica sets, Express, and the React/Vite client.

## Results

- **34 / 34 automated tests passed** (`npm test`), including explicit public-review deployment guards and hidden local demo credentials.
- **Production frontend build passed** (`npm run build`).
- **npm audit: zero known vulnerabilities** at verification time, including development dependencies. This is a point-in-time check, not a guarantee.
- All server JavaScript files passed `node --check`.
- Postman collection parses as valid JSON and contains 40 requests.
- Compose, Render Blueprint and CI YAML files parse successfully. Docker daemon execution and a real Render/Atlas deployment were not available in this workspace, so container builds/startup and hosted deployment are not claimed as tested.
- Hosted setup generated private credentials without printing them; `.env.hosted` is gitignored; the review-seed safety guard refused an unconfirmed database before connecting.

## Browser flow results

Chromium/Playwright exercised:

1. Homepage rendering, local poster assets, featured-film navigation, and catalog.
2. Interstellar details and cinema/show selection.
3. Moviegoer login using the explicitly provided demo credentials.
4. Two-seat selection and atomic hold creation.
5. Checkout, simulated decline, successful retry, and confirmed ticket/QR rendering.
6. Booking cancellation and cancelled-ticket display.
7. Search filtering to Interstellar.
8. 390 px mobile layouts, with horizontal scrolling contained within the seat map.
9. Administrator login, dashboard, movie creation, editing, and archival through the actual UI.

The final browser run reported zero application console errors. Earlier authentication probes produced expected 401s; anonymous session bootstrap was subsequently changed to return a quiet null user.

## Screenshots

The source package includes `docs/screenshots/` with desktop discovery, mobile discovery, seat selection, a confirmed ticket, and the admin movie-management screen. These are development screenshots, not real cinema tickets.

## Not claimed

Live Stripe charges/refunds, production Docker deployment, real cinema check-in, load testing, independent security certification, and full assistive-technology conformance have not been performed. Stripe network operations are mocked in tests, while webhook signatures are verified using Stripe's local test-signature helper.
