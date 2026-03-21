import fp from 'fastify-plugin';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../lib/firebaseAdmin.js';

async function dbPlugin(fastify) {
  try {
    getFirebaseAdmin(); // ensure Firebase app is initialized
    const db = getFirestore();
    fastify.decorate('db', db);
    console.log('[DB] Firestore connected');
  } catch (err) {
    console.error('[DB] Firestore initialization failed:', err.message);
  }

  fastify.decorate('ensureIndexes', async function ensureIndexes() {
    // Firestore manages its own indexes automatically
  });
}

export default fp(dbPlugin);
