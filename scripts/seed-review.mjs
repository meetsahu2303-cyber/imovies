// Explicitly seed a dedicated Atlas review database from your own computer.
// Run only after setup:hosted and editing .env.hosted. Never auto-runs on deployment.
import { email, password } from '../server/src/utils/validation.js';

const uri = new URL(process.env.MONGODB_URI || '');
if (
  process.env.REVIEW_DATABASE_CONFIRM !== 'YES' ||
  uri.protocol !== 'mongodb+srv:' ||
  uri.pathname !== '/imovies_review'
) {
  throw new Error(
    'Review seeding requires REVIEW_DATABASE_CONFIRM=YES and an Atlas URI ending in /imovies_review. Use a dedicated disposable database.',
  );
}
for (const [name, schema] of [
  ['SEED_ADMIN_EMAIL', email],
  ['SEED_USER_EMAIL', email],
  ['SEED_ADMIN_PASSWORD', password],
  ['SEED_USER_PASSWORD', password],
]) {
  const result = schema.safeParse(process.env[name]);
  if (!result.success || String(process.env[name]).startsWith('replace-with-'))
    throw new Error(`Set a valid, unique ${name} in .env.hosted before seeding.`);
}
if (process.env.SEED_ADMIN_EMAIL === process.env.SEED_USER_EMAIL)
  throw new Error('Reviewer and administrator must use different email addresses.');

// Seeding is a local maintenance operation. The hosted server still runs in production.
process.env.NODE_ENV = 'development';
process.env.DEPLOYMENT_MODE = 'standard';
process.env.PAYMENT_PROVIDER = 'demo';
process.env.CLIENT_ORIGIN = 'https://example.invalid';
process.env.COOKIE_SECURE = 'true';
process.env.ALLOW_PREVIEW = 'false';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
const { connectDatabase, disconnectDatabase } = await import('../server/src/config/db.js');
const { seedDatabase } = await import('../server/src/scripts/seed-data.js');
try {
  await connectDatabase();
  await seedDatabase();
  console.log(
    'Review database ready. Share the credentials from .env.hosted privately with your mentor.',
  );
} finally {
  await disconnectDatabase();
}
