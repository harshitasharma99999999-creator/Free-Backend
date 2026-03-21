import fp from 'fastify-plugin';
import { MongoClient, ObjectId } from 'mongodb';
import { config } from '../config.js';

async function dbPlugin(fastify) {
  const uri = config.mongodb.uri;

  if (!uri) {
    console.warn('[DB] MONGODB_URI not set; starting without database');
  } else {
    try {
      const client = new MongoClient(uri, {
        // Serverless-friendly timeouts - fail fast instead of hanging
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 8000,
      });

      await client.connect();

      // Mirror the @fastify/mongodb decorator shape used elsewhere in this repo.
      fastify.decorate('mongo', {
        client,
        ObjectId,
        db: client.db(),
      });

      fastify.addHook('onClose', async () => {
        await client.close(true);
      });

      console.log('[DB] MongoDB connected');
    } catch (err) {
      console.error('[DB] MongoDB connection failed:', err.message);
      // Keep app booting; routes using DB will return 503 via guards.
    }
  }

  fastify.decorate('ensureIndexes', async function ensureIndexes() {
    const db = fastify.mongo?.db;
    if (!db) {
      console.warn('[DB] Skipping ensureIndexes - no database connection');
      return;
    }

    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true, sparse: true });
    await db.collection('api_keys').createIndex({ key: 1 }, { unique: true });
    await db.collection('api_keys').createIndex({ userId: 1 });
    await db.collection('usage').createIndex({ apiKeyId: 1, date: 1 });
    await db.collection('client_users').createIndex({ appId: 1, email: 1 }, { unique: true });
    await db.collection('client_users').createIndex({ appId: 1 });
  });
}

export default fp(dbPlugin);
