import fp from 'fastify-plugin';
import fastifyMongo from '@fastify/mongodb';
import { config } from '../config.js';

async function dbPlugin(fastify) {
  await fastify.register(fastifyMongo, {
    url: config.mongodb.uri,
    forceClose: true,
  });

  fastify.decorate('ensureIndexes', async function ensureIndexes() {
    const db = fastify.mongo.db;
    if (!db) return;

    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true, sparse: true });
    await db.collection('api_keys').createIndex({ key: 1 }, { unique: true });
    await db.collection('api_keys').createIndex({ userId: 1 });
    await db.collection('usage').createIndex({ apiKeyId: 1, date: 1 });
  });
}

export default fp(dbPlugin);
