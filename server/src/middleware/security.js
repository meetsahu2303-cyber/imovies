import { allowedOrigins, env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
export function isAllowedOrigin(origin) {
  return (
    allowedOrigins.includes(origin) ||
    (env.NODE_ENV !== 'production' &&
      env.ALLOW_PREVIEW === 'true' &&
      /^https:\/\/5173-[a-z0-9-]+\.e2b\.app$/.test(origin))
  );
}
export const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'Idempotency-Key'],
};
// All cookie-authenticated mutations require BOTH a custom header and an allowed Origin when present.
// A cross-site form cannot set this header; CORS rejects untrusted script origins before processing.
export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest')
    return next(new AppError(403, 'Missing request protection header.', 'CSRF_REJECTED'));
  const origin = req.get('Origin');
  if (origin && !isAllowedOrigin(origin))
    return next(new AppError(403, 'Origin not allowed.', 'CSRF_REJECTED'));
  next();
}
