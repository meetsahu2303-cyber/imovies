import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
export const rootDir = fileURLToPath(new URL('../../../', import.meta.url));
dotenv.config({ path: `${rootDir}/.env`, quiet: true });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEPLOYMENT_MODE: z.enum(['standard', 'review']).default('standard'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Render supplies the public HTTPS URL; an explicit origin supports custom domains.
  CLIENT_ORIGIN: z
    .string()
    .url()
    .default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/imovies?replicaSet=rs0'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must contain at least 32 characters. Run npm run setup.'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ALLOW_PREVIEW: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  PAYMENT_PROVIDER: z.enum(['demo', 'stripe']).default('demo'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success)
  throw new Error(`Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const paymentProvider = env.PAYMENT_PROVIDER;
// A public portfolio review is not a real-payment deployment. This exception is
// explicit, retains production security, and must never be used for customer sales.
export const isReviewDeployment = isProduction && env.DEPLOYMENT_MODE === 'review';
if (env.DEPLOYMENT_MODE === 'review') {
  if (!isProduction || paymentProvider !== 'demo' || env.COOKIE_SECURE !== 'true')
    throw new Error(
      'Review mode requires NODE_ENV=production, PAYMENT_PROVIDER=demo and COOKIE_SECURE=true.',
    );
  if (env.ALLOW_PREVIEW !== 'false') throw new Error('Review mode requires ALLOW_PREVIEW=false.');
  if (env.CLIENT_ORIGIN.split(',').some((origin) => !origin.trim().startsWith('https://')))
    throw new Error('Review mode requires an HTTPS CLIENT_ORIGIN.');
  if (env.STRIPE_SECRET_KEY || env.STRIPE_WEBHOOK_SECRET)
    throw new Error('Do not supply Stripe credentials to a simulated-payment review deployment.');
}
if (isProduction && paymentProvider === 'demo' && !isReviewDeployment)
  throw new Error(
    'Demo payments are disabled in production. Configure Stripe or explicit review mode.',
  );
if (paymentProvider === 'stripe' && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET))
  throw new Error('Stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.');
if (isProduction && env.COOKIE_SECURE !== 'true')
  throw new Error('COOKIE_SECURE must be true in production (HTTPS required).');
export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim());
