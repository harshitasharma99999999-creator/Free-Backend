import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';
import { verifyFirebaseToken } from '../lib/firebaseAdmin.js';

async function upsertFirebaseUser(db, decoded) {
  const userRef = db.collection('users').doc(decoded.uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      firebaseUid: decoded.uid,
      email: (decoded.email || '').toLowerCase() || null,
      name: decoded.name || 'User',
      createdAt: new Date(),
    });
  }
  return snap.exists ? snap.data() : { email: decoded.email, name: decoded.name };
}

async function authPlugin(fastify) {
  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
  });

  fastify.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Authentication required',
        message: 'Missing or invalid Authorization header. Please provide: Bearer <token>',
      });
    }

    const token = authHeader.slice(7).trim();

    // Try Firebase token first
    try {
      const decoded = await verifyFirebaseToken(token);
      const db = fastify.db;
      if (!db) {
        request.user = { id: decoded.uid, email: (decoded.email || '').toLowerCase(), firebaseUid: decoded.uid, dbUser: false };
        return;
      }
      const userData = await upsertFirebaseUser(db, decoded);
      request.user = {
        id: decoded.uid,
        email: userData.email || decoded.email || '',
        firebaseUid: decoded.uid,
      };
      return;
    } catch (firebaseError) {
      // Fall through to JWT
    }

    // Try JWT fallback
    try {
      await request.jwtVerify();
      const payload = request.user;
      request.user = { id: payload.sub || payload.id, email: payload.email };
      if (!request.user.id) {
        return reply.code(401).send({ error: 'Invalid token', message: 'Token payload missing required user ID' });
      }
      return;
    } catch (jwtError) {
      return reply.code(401).send({
        error: 'Authentication failed',
        message: 'Invalid or expired token. Please sign in again.',
      });
    }
  });

  fastify.decorate('authenticateFirebase', async function (request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Authentication required', message: 'Missing Bearer token.' });
    }
    const token = authHeader.slice(7).trim();
    try {
      const decoded = await verifyFirebaseToken(token);
      const db = fastify.db;
      if (!db) {
        request.user = { id: decoded.uid, email: (decoded.email || '').toLowerCase(), firebaseUid: decoded.uid, dbUser: false };
        return;
      }
      const userData = await upsertFirebaseUser(db, decoded);
      request.user = { id: decoded.uid, email: userData.email || decoded.email || '', firebaseUid: decoded.uid };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid Firebase token', message: error.message });
    }
  });
}

export default fp(authPlugin);
