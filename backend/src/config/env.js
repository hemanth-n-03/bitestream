import dotenv from 'dotenv';

dotenv.config();

const PLACEHOLDER_URI = 'your_mongodb_atlas_connection_string_here';
const PLACEHOLDER_JWT = 'replace_with_a_long_random_64_char_secret_key';

const maxDeliverySearchRadiusMeters =
  Number(process.env.MAX_DELIVERY_SEARCH_RADIUS_METERS) || 10000;

function parseRadiusSteps(raw, maxRadius) {
  if (raw && raw.trim()) {
    const parsed = raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= maxRadius);
    if (parsed.length > 0) {
      return Array.from(new Set([...parsed, maxRadius])).sort((a, b) => a - b);
    }
  }
  return Array.from(
    new Set([
      Math.min(3000, maxRadius),
      Math.min(6000, maxRadius),
      maxRadius,
    ])
  ).sort((a, b) => a - b);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || '',
  dbName: process.env.DB_NAME || 'bitestream',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  gpsDbWriteIntervalMs: Number(process.env.GPS_DB_WRITE_INTERVAL_MS) || 5000,
  maxDeliverySearchRadiusMeters,
  deliveryRadiusStepsMeters: parseRadiusSteps(
    process.env.DELIVERY_RADIUS_STEPS_METERS,
    maxDeliverySearchRadiusMeters
  ),
  assignmentOfferTimeoutMs: Number(process.env.ASSIGNMENT_OFFER_TIMEOUT_MS) || 45000,
};

export function validateEnv() {
  if (!env.mongodbUri || env.mongodbUri === PLACEHOLDER_URI) {
    throw new Error('MONGODB_URI is missing or still set to placeholder in backend/.env');
  }
  if (!env.mongodbUri.startsWith('mongodb://') && !env.mongodbUri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  if (!env.jwtSecret || env.jwtSecret === PLACEHOLDER_JWT || env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set in backend/.env and be at least 32 characters long');
  }
}

export default env;
