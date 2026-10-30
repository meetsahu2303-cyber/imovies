import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, Session, publicUser } from '../models/User.js';
import { AppError } from '../utils/errors.js';
export async function authenticate(req, res, next) {
  try {
    const token = req.cookies.imovies_access;
    if (!token) throw new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'imovies',
        audience: 'imovies-web',
      });
    } catch {
      throw new AppError(401, 'Your session has expired. Please sign in again.', 'TOKEN_EXPIRED');
    }
    const session = await Session.findOne({
      _id: payload.jti,
      user: payload.sub,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session) throw new AppError(401, 'Your session is no longer active.', 'UNAUTHENTICATED');
    const user = await User.findOne({ _id: payload.sub, active: true });
    if (!user) throw new AppError(401, 'This account is unavailable.', 'UNAUTHENTICATED');
    req.user = user;
    req.sessionId = String(session._id);
    req.userPublic = publicUser(user);
    next();
  } catch (error) {
    next(error);
  }
}
export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin'
    ? next()
    : next(new AppError(403, 'Administrator access is required.', 'FORBIDDEN'));
export function socketAuth(io) {
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || '';
      const token = cookie
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('imovies_access='))
        ?.slice('imovies_access='.length);
      if (!token) return next(); // Public show rooms are allowed.
      const payload = jwt.verify(decodeURIComponent(token), env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'imovies',
        audience: 'imovies-web',
      });
      const session = await Session.findOne({
        _id: payload.jti,
        user: payload.sub,
        expiresAt: { $gt: new Date() },
      }).lean();
      const user = session ? await User.findOne({ _id: payload.sub, active: true }).lean() : null;
      if (user) {
        socket.data.userId = String(user._id);
        socket.data.role = user.role;
        socket.data.sessionId = String(session._id);
        socket.data.exp = payload.exp;
      }
      next();
    } catch {
      next();
    } // A stale cookie must not prevent anonymous seat viewing.
  });
}
