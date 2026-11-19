import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import { getDatabaseStatus } from './config/db.js';
import { apiLimiter } from './middleware/rateLimitMiddleware.js';
import { sanitizeNoSqlInputs } from './middleware/sanitizeMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';
import { getChangeStreamStatus } from './realtime/changeStreamManager.js';
import { getSocketStats } from './realtime/socketServer.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const app = express();

const allowedOrigins = new Set([env.clientUrl]);
if (env.nodeEnv === 'development') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(sanitizeNoSqlInputs);
app.use('/api', apiLimiter);

if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (_req, res) => {
  const db = getDatabaseStatus();
  res.status(db.connected ? 200 : 503).json({
    success: db.connected,
    service: 'BiteStream API',
    phase: 8,
    environment: env.nodeEnv,
    database: {
      status: db.connected ? 'connected' : 'disconnected',
      name: db.database,
      isReplicaSet: db.isReplicaSet,
      setName: db.setName,
    },
    realtime: {
      socket: getSocketStats(),
      changeStreams: getChangeStreamStatus(),
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
