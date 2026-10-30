import http from 'node:http';
import { mkdir } from 'node:fs/promises';
import { createApp } from './app.js';
import { env, rootDir } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createSocketServer } from './realtime/socket.js';
import { sweepExpiredReservations } from './services/booking.service.js';
import { logger } from './utils/logger.js';
import { User } from './models/User.js';
const memory = process.argv.includes('--memory');
await connectDatabase({ memory });
await mkdir(`${rootDir}/uploads`, { recursive: true });
// Explicit opt-in only: the preview starts with an isolated, seeded, in-memory database.
if (memory && !(await User.exists({}))) {
  const { seedDatabase } = await import('./scripts/seed-data.js');
  await seedDatabase();
}
// Build indexes before accepting traffic (the partial unique pending-payment index is essential).
const models = (await import('mongoose')).default.models;
await Promise.all(Object.values(models).map((model) => model.init()));
const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);
let sweeping = false;
const timer = setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    await sweepExpiredReservations();
  } catch (error) {
    logger.error({ err: error }, 'Reservation sweep failed');
  } finally {
    sweeping = false;
  }
}, 10000);
server.listen(env.PORT, '0.0.0.0', () =>
  logger.info({ port: env.PORT, memory, payment: env.PAYMENT_PROVIDER }, 'IMovies API ready'),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  io.close();
  server.close();
  const force = setTimeout(() => process.exit(1), 10000);
  force.unref();
  await disconnectDatabase();
  clearTimeout(force);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
