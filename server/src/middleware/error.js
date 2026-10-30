import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
export const notFound = (req, res, next) =>
  next(new AppError(404, 'This endpoint does not exist.', 'NOT_FOUND'));
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500,
    message = error.message,
    code = error.code || 'INTERNAL_ERROR',
    details;
  if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the submitted fields.';
    details = error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
  }
  if (error.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'This record already exists.';
  }
  if (error.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid resource ID.';
  }
  if (error.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the submitted fields.';
  }
  if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request is too large.';
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    code = 'FILE_TOO_LARGE';
    message = 'Images must be smaller than 5 MB.';
  }
  if (status >= 500) {
    logger.error({ err: error, requestId: req.id }, 'Request failed');
    message = 'Something went wrong. Please try again.';
  }
  res.status(status).json({
    error: { code, message, ...(details ? { details } : {}) },
    requestId: req.id,
  });
}
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};
