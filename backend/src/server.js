import http from 'node:http';
import app from './app.js';
import env, { validateEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { Notification, Order } from './models/index.js';
import { startChangeStreams, stopChangeStreams } from './realtime/changeStreamManager.js';
import { closeSocketServer, initSocketServer } from './realtime/socketServer.js';
import { clearAllAssignmentTimeouts } from './services/deliveryAssignmentService.js';

let server;

async function bootstrap() {
  validateEnv();
  await connectDatabase();

  // Ensure Phase 7 indexes (Order idempotency + Notification partial dedupe index) exist before watching
  await Promise.all([Order.syncIndexes(), Notification.syncIndexes()]);

  server = http.createServer(app);
  initSocketServer(server);
  await startChangeStreams();

  server.listen(env.port, () => {
    console.log(
      `[BiteStream] Backend listening on http://localhost:${env.port} (${env.nodeEnv}) [Socket.IO + ChangeStreams Active]`
    );
  });
}

let isStopping = false;

const shutdown = async (signal) => {
  if (isStopping) return;
  isStopping = true;
  console.log(`\n[BiteStream] Received ${signal}. Shutting down gracefully...`);

  clearAllAssignmentTimeouts();
  await stopChangeStreams();
  await closeSocketServer();

  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      console.log('[BiteStream] HTTP server, Change Streams, Socket.IO and MongoDB closed.');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap().catch((err) => {
  console.error('[BiteStream] Fatal startup error:', err.message);
  process.exit(1);
});
