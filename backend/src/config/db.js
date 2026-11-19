import mongoose from 'mongoose';
import env from './env.js';

let dbState = {
  connected: false,
  host: null,
  database: env.dbName,
  isReplicaSet: false,
  setName: null,
  lastError: null,
};

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => {
    dbState.connected = false;
    console.warn('[BiteStream DB] MongoDB connection disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    dbState.connected = true;
    dbState.lastError = null;
    console.log('[BiteStream DB] MongoDB connection re-established.');
  });

  mongoose.connection.on('error', (err) => {
    dbState.lastError = err.message;
    console.error('[BiteStream DB] MongoDB runtime error:', err.message);
  });

  try {
    const conn = await mongoose.connect(env.mongodbUri, {
      dbName: env.dbName,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20,
    });

    const hello = await conn.connection.db.admin().command({ hello: 1 });
    const setName = hello.setName || null;

    dbState = {
      connected: conn.connection.readyState === 1,
      host: conn.connection.host,
      database: conn.connection.name,
      isReplicaSet: Boolean(setName),
      setName,
      lastError: null,
    };

    console.log(
      `[BiteStream DB] Connected to host "${dbState.host}" (db: "${dbState.database}", replicaSet: ${
        dbState.isReplicaSet ? dbState.setName : 'standalone'
      })`
    );

    return dbState;
  } catch (err) {
    dbState.connected = false;
    dbState.lastError = err.message;
    throw new Error(`Database connection failed: ${err.message}`);
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    dbState.connected = false;
  }
}

export function getDatabaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: dbState.host,
    database: dbState.database,
    isReplicaSet: dbState.isReplicaSet,
    setName: dbState.setName,
  };
}
