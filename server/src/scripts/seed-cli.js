import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedDatabase } from './seed-data.js';
try {
  await connectDatabase();
  await seedDatabase();
  console.log(
    'Seed complete. Demo sign-ins: alex@imovies.local / Movie@12345 and admin@imovies.local / Admin@12345 (or your SEED_* values).',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
