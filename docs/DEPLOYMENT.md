# Deployment checklist

The code is a reference implementation with production-oriented safeguards, not a certified turnkey commercial cinema service. Complete this checklist before accepting real payments.

## Public mentor review is a separate mode

`render.yaml` and [SUBMISSION_GUIDE.md](SUBMISSION_GUIDE.md) configure a disposable, public review service with `DEPLOYMENT_MODE=review`, `NODE_ENV=production`, `PAYMENT_PROVIDER=demo`, HTTPS, and secure cookies. This explicit exception keeps simulated payments visibly labeled; it is **not** permission to accept real customer payments. Use a dedicated Atlas database, unique reviewer credentials, and no real customer data. Ordinary production deployments still refuse demo payments. The free Render service has an ephemeral filesystem: newly uploaded posters do not survive a restart/redeploy; bundled posters and Atlas data do.

## Required configuration for real-payment production

- [ ] Node 20+ supported patch release; `npm ci` from the committed lockfile.
- [ ] MongoDB Atlas replica set or authenticated production replica set; never expose a public unauthenticated database.
- [ ] Unique random `JWT_SECRET` at least 32 characters; secret manager injection, not source control.
- [ ] `NODE_ENV=production`, exact `CLIENT_ORIGIN`, `COOKIE_SECURE=true`, HTTPS.
- [ ] `PAYMENT_PROVIDER=stripe` with your Stripe secret and endpoint-specific webhook secret. Demo is blocked in production.
- [ ] Set `TRUST_PROXY` to the actual number of trusted proxy hops. Do not blindly trust arbitrary forwarded headers.
- [ ] Same-site frontend/API deployment recommended. Cross-site cookies may be blocked by browser privacy settings.
- [ ] Keep `ALLOW_PREVIEW=false` outside the Arena development preview.
- [ ] Build React with `npm run build`; serve API and `client/dist` from Express or a correctly configured same-origin reverse proxy.
- [ ] Proxy `/api`, `/uploads`, and `/socket.io` including WebSocket upgrades; preserve raw webhook bodies.
- [ ] Create the first admin explicitly with strong credentials; never deploy demo seed passwords.

## Storage and backups

- [ ] Persist MongoDB data and `/app/uploads` (the application root's uploads directory).
- [ ] Use durable object storage/shared uploads for multiple app instances; local disk is not shared.
- [ ] Configure malware scanning and upload retention if accepting untrusted administrator files.
- [ ] Encrypt disks/backups and test MongoDB restoration plus image restoration.
- [ ] Restrict database network access and use least-privilege credentials.

## Payments and reconciliation

- [ ] Run the entire Stripe **test** checkout, decline, cancellation, delayed webhook, and refund flow with your account.
- [ ] Configure all four documented webhook events and monitor failed deliveries.
- [ ] Verify currency/amount and metadata checks with your provider settings.
- [ ] Reconcile pending/failed refunds against Stripe; the sample has manual admin retry for `refund_failed`, not a full durable reconciliation worker.
- [ ] Add an outbox/queue for refund requests and provider reconciliation before high-volume use.
- [ ] Decide how to handle partial refunds, chargebacks, disputes, tax, and provider fees; these are not fully modeled here.
- [ ] Implement real staff-side ticket validation/check-in. The QR reference is not a signed admission credential.

## Scale and reliability

- [ ] One API instance is supported by the default in-memory rate limiter and Socket.IO emitter.
- [ ] For multiple instances: shared Socket.IO adapter, shared rate-limit store, and a single leased reservation-sweep worker.
- [ ] Monitor sweep backlog; each pass currently handles at most 500 records per category.
- [ ] Ship Pino JSON logs to your logging platform; configure retention and alerts for 5xx, payment conflicts, refund failures, and database errors.
- [ ] Add external health checks that verify database readiness as well as process liveness.
- [ ] Load-test popular-show seat contention, payment retries, and MongoDB transaction conflict rates.
- [ ] Add distributed caching/CDN for catalog assets as needed.

## Security and privacy

- [ ] `npm audit` and independent dependency/security review.
- [ ] Penetration-test authentication, CSRF/CORS, access control, upload handling, and payment webhooks.
- [ ] Add account recovery, email verification, administrator MFA, and audit trails for your operational requirements.
- [ ] Define privacy/terms/refund policies and data retention/deletion procedures.
- [ ] Replace sample artwork with licensed production assets and real cinema inventory.
- [ ] Keep secrets out of `VITE_*` variables, browser code, logs, and Git.

The included Docker Compose stack is a convenient starting point, not a substitute for these operational controls.
