import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/User.js';
import { Session } from '../models/User.js';
import { email, password } from '../utils/validation.js';
try {
  const address = email.parse(process.env.SEED_ADMIN_EMAIL);
  const plain = password.parse(process.env.SEED_ADMIN_PASSWORD);
  await connectDatabase();
  const existing = await User.findOne({ email: address });
  if (existing)
    throw new Error('That email already exists. Existing accounts are never silently promoted.');
  await User.create({
    name: process.env.ADMIN_NAME || 'Cinema Admin',
    email: address,
    role: 'admin',
    passwordHash: await bcrypt.hash(plain, 12),
  });
  console.log(
    'Administrator created. Use the credentials from your environment; no password is printed.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
