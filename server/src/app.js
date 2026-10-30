import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { env, rootDir } from './config/env.js';
import { corsOptions, csrfProtection } from './middleware/security.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { stripe } from './services/payment.service.js';
import { handleStripeEvent } from './services/payment.service.js';
import { WebhookEvent } from './models/Booking.js';
import routes from './routes/index.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-ID', id);
        return id;
      },
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: [
            "'self'",
            ...(env.ALLOW_PREVIEW === 'true' && env.NODE_ENV !== 'production'
              ? ['https://*.arena.ai', 'https://*.e2b.app']
              : []),
          ],
          upgradeInsecureRequests: env.COOKIE_SECURE === 'true' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      frameguard:
        env.ALLOW_PREVIEW === 'true' && env.NODE_ENV !== 'production'
          ? false
          : { action: 'sameorigin' },
    }),
  );
  app.post(
    '/api/payments/stripe/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET)
        return res.status(503).json({ error: 'Stripe is not configured.' });
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers['stripe-signature'],
          env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        return res.status(400).json({ error: 'Invalid webhook signature.' });
      }
      if (await WebhookEvent.exists({ providerEventId: event.id }))
        return res.json({ received: true, duplicate: true });
      await handleStripeEvent(event);
      // Successful non-confirmation events are also recorded to make retries inexpensive.
      if (
        !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
          event.type,
        )
      )
        await WebhookEvent.updateOne(
          { providerEventId: event.id },
          { $setOnInsert: { type: event.type } },
          { upsert: true },
        );
      res.json({ received: true });
    },
  );
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60000,
      limit: env.NODE_ENV === 'test' ? 10000 : 1000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT',
          message: 'Too many requests. Please try again later.',
        },
      },
    }),
    csrfProtection,
    routes,
  );
  app.use(
    '/uploads',
    express.static(`${rootDir}/uploads`, {
      maxAge: '7d',
      immutable: true,
      dotfiles: 'deny',
      index: false,
    }),
  );
  const clientDist = `${rootDir}/client/dist`;
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)|\/socket.io(?:\/|$)).*/, (req, res) =>
      res.sendFile(`${clientDist}/index.html`),
    );
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
