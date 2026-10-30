import pino from 'pino';
import { env } from '../config/env.js';
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: [
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers["proxy-authorization"]',
    'req.headers["e2b-traffic-access-token"]',
    'req.headers["x-api-key"]',
    'res.headers["set-cookie"]',
    'password',
    'passwordHash',
    'token',
    'refreshToken',
  ],
});
