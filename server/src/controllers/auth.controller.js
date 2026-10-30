import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, Session, publicUser } from '../models/User.js';
import { env, isProduction } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { AppError, assert } from '../utils/errors.js';
import { email, password } from '../utils/validation.js';
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
  city: z.string().trim().min(2).max(60).default('Mumbai'),
});
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
const hash = (token) => createHash('sha256').update(token).digest('hex');
const refreshDays = 7;
const baseCookie = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAMESITE,
  ...(env.COOKIE_SAMESITE === 'none' ? { partitioned: true } : {}),
};
function accessToken(user, sid) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user._id),
    jwtid: sid,
    expiresIn: '15m',
    issuer: 'imovies',
    audience: 'imovies-web',
  });
}
function setCookies(res, user, sid, refresh) {
  res.cookie('imovies_access', accessToken(user, sid), {
    ...baseCookie,
    path: '/',
    maxAge: 15 * 60000,
  });
  res.cookie('imovies_refresh', refresh, {
    ...baseCookie,
    path: '/api/auth',
    maxAge: refreshDays * 86400000,
  });
}
async function newSession(user) {
  const refresh = randomBytes(48).toString('hex');
  const session = await Session.create({
    user: user._id,
    refreshHash: hash(refresh),
    expiresAt: new Date(Date.now() + refreshDays * 86400000),
  });
  return { sid: String(session._id), refresh };
}
const dummyHash = await bcrypt.hash('not-a-real-account-password', 12);
export async function register(req, res) {
  const { name, email, password: plain, city } = req.body;
  assert(
    !(await User.exists({ email })),
    409,
    'An account with this email already exists.',
    'EMAIL_EXISTS',
  );
  const user = await User.create({
    name,
    email,
    city,
    passwordHash: await bcrypt.hash(plain, 12),
    role: 'user',
  });
  const { sid, refresh } = await newSession(user);
  setCookies(res, user, sid, refresh);
  res.status(201).json({ user: publicUser(user) });
}
export async function login(req, res) {
  const user = await User.findOne({
    email: req.body.email,
    active: true,
  }).select('+passwordHash');
  const matches = await bcrypt.compare(req.body.password, user?.passwordHash || dummyHash);
  if (!user || !matches)
    throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  const { sid, refresh } = await newSession(user);
  setCookies(res, user, sid, refresh);
  res.json({ user: publicUser(user) });
}
export async function refresh(req, res) {
  const token = req.cookies.imovies_refresh;
  if (!token || !/^[a-f0-9]{96}$/.test(token))
    throw new AppError(401, 'Please sign in.', 'UNAUTHENTICATED');
  const old = await Session.findOneAndDelete({
    refreshHash: hash(token),
    expiresAt: { $gt: new Date() },
  });
  if (!old) throw new AppError(401, 'Please sign in again.', 'UNAUTHENTICATED');
  const user = await User.findOne({ _id: old.user, active: true });
  if (!user) throw new AppError(401, 'Account unavailable.', 'UNAUTHENTICATED');
  const next = await newSession(user);
  setCookies(res, user, next.sid, next.refresh);
  res.json({ user: publicUser(user) });
}
export async function logout(req, res) {
  const token = req.cookies.imovies_refresh;
  if (token) await Session.deleteOne({ refreshHash: hash(token) });
  res.clearCookie('imovies_access', { ...baseCookie, path: '/' });
  res.clearCookie('imovies_refresh', { ...baseCookie, path: '/api/auth' });
  res.json({ ok: true });
}
export const me = (req, res) => res.json({ user: req.userPublic });
export async function session(req, res, next) {
  if (!req.cookies.imovies_access && !req.cookies.imovies_refresh) return res.json({ user: null });
  const error = await new Promise((resolve) => authenticate(req, res, resolve));
  if (req.user) return res.json({ user: req.userPublic });
  if (req.cookies.imovies_refresh) return refresh(req, res);
  if (error?.status === 401) return res.json({ user: null });
  next(error);
}
export async function updateProfile(req, res) {
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      city: z.string().trim().min(2).max(60),
    })
    .parse(req.body);
  const user = await User.findByIdAndUpdate(req.user._id, data, {
    new: true,
    runValidators: true,
  });
  res.json({ user: publicUser(user) });
}
