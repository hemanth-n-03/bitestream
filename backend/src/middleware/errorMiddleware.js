import env from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'MONGOOSE_VALIDATION_ERROR';
    message = 'Database schema validation failed';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier format for "${err.path}"`;
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const fields = Object.keys(err.keyPattern || {});
    message = `Duplicate value for ${fields.join(', ') || 'unique field'}`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }

  if (statusCode >= 500) {
    console.error('[BiteStream Error]', err.message);
  }

  const payload = {
    success: false,
    code,
    message,
  };

  if (details) payload.details = details;
  if (env.nodeEnv === 'development' && statusCode >= 500) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}
