function sanitizeValue(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeValue(val, depth + 1);
  }
  return clean;
}

/**
 * Strips MongoDB query operator keys (`$*`) and dot-notation keys from incoming payloads
 * to prevent NoSQL operator injection across routes.
 */
export function sanitizeNoSqlInputs(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
}
