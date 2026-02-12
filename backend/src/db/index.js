import fp from 'fastify-plugin';
import fastifyMongo from '@fastify/mongodb';
import { config } from '../config.js';

async function dbPlugin(fastify) {
  try {
    await fastify.register(fastifyMongo, {
      url: config.mongodb.uri,
      forceClose: true,
      // Serverless-friendly timeouts — fail fast instead of hanging
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 8000,
    });
    console.log('[DB] MongoDB connected');
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    // Decorate with null so the app still boots — routes will get errors when they try to use it
    if (!fastify.mongo) {
      fastify.decorate('mongo', { db: null, client: null, ObjectId: null });
    }
  }

  fastify.decorate('ensureIndexes', async function ensureIndexes() {
    const db = fastify.mongo?.db;
    if (!db) {
      console.warn('[DB] Skipping ensureIndexes — no database connection');
      return;
    }

    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true, sparse: true });
    await db.collection('api_keys').createIndex({ key: 1 }, { unique: true });
    await db.collection('api_keys').createIndex({ userId: 1 });
    await db.collection('usage').createIndex({ apiKeyId: 1, date: 1 });
  });
}

export default fp(dbPlugin);
