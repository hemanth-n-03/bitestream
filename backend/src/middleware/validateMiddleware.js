import AppError from '../utils/AppError.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const formatted = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message,
    }));
    return next(new AppError('Input validation failed', 400, 'VALIDATION_ERROR', formatted));
  }
  req[source] = result.data;
  return next();
};
