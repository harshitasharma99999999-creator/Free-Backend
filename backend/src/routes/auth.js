import { config } from '../config.js';
import { verifyFirebaseToken } from '../lib/firebaseAdmin.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';

export default async function authRoutes(fastify) {
  const getDb = () => {
    if (!fastify.db) throw new Error('Database unavailable');
    return fastify.db;
  };

  async function requireClientApiKey(request, reply) {
    let db;
    try { db = getDb(); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }
    const rawKey = request.headers['x-api-key'] || request.query?.apiKey;
    if (!rawKey) return reply.code(401).send({ error: 'Missing API key' });
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!isValidApiKeyFormat(key)) return reply.code(401).send({ error: 'Invalid API key format' });

    const snap = await db.collection('api_keys').where('key', '==', key).limit(1).get();
    if (snap.empty) return reply.code(401).send({ error: 'Invalid API key' });
    request.clientApiKey = { ...snap.docs[0].data(), _id: snap.docs[0].id };
  }

  function getBearerToken(request) {
    const raw = request.headers.authorization;
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.toLowerCase().startsWith('bearer ')) return null;
    return raw.slice(7).trim() || null;
  }

  async function authenticateClientUser(request, reply) {
    const token = getBearerToken(request);
    if (!token) return reply.code(401).send({ error: 'Unauthorized', message: 'Missing Bearer token.' });
    let payload;
    try { payload = fastify.jwt.verify(token); } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token.' });
    }
    const appId = request.clientApiKey?._id?.toString();
    if (!payload?.sub || payload.type !== 'client' || payload.appId !== appId) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Token does not belong to this API key.' });
    }
    request.clientUser = { id: payload.sub, email: payload.email || '', appId };
  }

  // Exchange Firebase ID token for backend JWT
  fastify.post('/firebase', {
    schema: {
      body: { type: 'object', required: ['idToken'], properties: { idToken: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const { idToken } = request.body;
      let decoded;
      try { decoded = await verifyFirebaseToken(idToken); } catch {
        return reply.code(401).send({ error: 'Invalid Firebase token' });
      }

      // Upsert user (doc ID = Firebase UID)
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
      const userData = snap.exists ? snap.data() : {};
      const userPayload = {
        id: decoded.uid,
        email: userData.email || decoded.email || '',
        name: userData.name || decoded.name || 'User',
      };
      const token = fastify.jwt.sign(
        { sub: userPayload.id, email: userPayload.email },
        { expiresIn: config.jwt.expiresIn }
      );
      return reply.send({ user: userPayload, token });
    },
  });

  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const { email, password, name } = request.body;
      const emailLower = email.toLowerCase();

      const existing = await db.collection('users').where('email', '==', emailLower).limit(1).get();
      if (!existing.empty) return reply.code(409).send({ error: 'Email already registered' });

      const hash = await fastify.hashPassword(password);
      const docRef = await db.collection('users').add({
        email: emailLower,
        password: hash,
        name: name.trim(),
        createdAt: new Date(),
      });
      const user = { id: docRef.id, email: emailLower, name: name.trim() };
      const token = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: config.jwt.expiresIn });
      return reply.code(201).send({ user, token });
    },
  });

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const { email, password } = request.body;
      const snap = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
      if (snap.empty) return reply.code(401).send({ error: 'Invalid email or password' });

      const doc = snap.docs[0];
      const userData = doc.data();
      if (!userData.password) return reply.code(401).send({ error: 'Invalid email or password' });

      const ok = await fastify.verifyPassword(password, userData.password);
      if (!ok) return reply.code(401).send({ error: 'Invalid email or password' });

      const token = fastify.jwt.sign({ sub: doc.id, email: userData.email }, { expiresIn: config.jwt.expiresIn });
      return reply.send({ user: { id: doc.id, email: userData.email, name: userData.name }, token });
    },
  });

  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const snap = await db.collection('users').doc(request.user.id).get();
      if (!snap.exists) {
        // Fallback: return user info from token
        return reply.send({ user: { id: request.user.id, email: request.user.email, name: '' } });
      }
      const u = snap.data();
      return reply.send({ user: { id: request.user.id, email: u.email, name: u.name || '' } });
    },
  });

  // Dashboard: list all app users across the logged-in user's API keys
  fastify.get('/client-users', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const keysSnap = await db.collection('api_keys').where('userId', '==', request.user.id).get();
      const appIds = keysSnap.docs.map((d) => d.id);
      const keyByName = Object.fromEntries(keysSnap.docs.map((d) => [d.id, d.data().name || 'Unnamed']));
      if (appIds.length === 0) return reply.send({ users: [] });

      // Firestore 'in' supports up to 10 items
      const chunks = [];
      for (let i = 0; i < appIds.length; i += 10) chunks.push(appIds.slice(i, i + 10));

      const allUsers = [];
      for (const chunk of chunks) {
        const snap = await db.collection('client_users').where('appId', 'in', chunk).get();
        allUsers.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
      allUsers.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      return reply.send({
        users: allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name || 'User',
          appId: u.appId,
          appName: keyByName[u.appId] || u.appId,
          createdAt: u.createdAt ? new Date(u.createdAt.toDate ? u.createdAt.toDate() : u.createdAt).toISOString() : null,
        })),
      });
    },
  });

  // Developer-facing auth for their own app users
  fastify.post('/client-register', {
    preHandler: [requireClientApiKey],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const appId = request.clientApiKey._id.toString();
      const email = request.body.email.toLowerCase();
      const name = (request.body.name || email.split('@')[0] || 'User').trim();

      const existing = await db.collection('client_users')
        .where('appId', '==', appId).where('email', '==', email).limit(1).get();
      if (!existing.empty) return reply.code(409).send({ error: 'Email already registered for this app' });

      const passwordHash = await fastify.hashPassword(request.body.password);
      const docRef = await db.collection('client_users').add({
        appId, email, name, passwordHash, createdAt: new Date(), updatedAt: new Date(),
      });

      const user = { id: docRef.id, email, name };
      const token = fastify.jwt.sign({ sub: user.id, email: user.email, appId, type: 'client' });
      return reply.code(201).send({ user, token });
    },
  });

  fastify.post('/client-login', {
    preHandler: [requireClientApiKey],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const appId = request.clientApiKey._id.toString();
      const email = request.body.email.toLowerCase();

      const snap = await db.collection('client_users')
        .where('appId', '==', appId).where('email', '==', email).limit(1).get();
      if (snap.empty) return reply.code(401).send({ error: 'Invalid email or password' });

      const doc = snap.docs[0];
      const userData = doc.data();
      if (!userData.passwordHash) return reply.code(401).send({ error: 'Invalid email or password' });

      const ok = await fastify.verifyPassword(request.body.password, userData.passwordHash);
      if (!ok) return reply.code(401).send({ error: 'Invalid email or password' });

      const user = { id: doc.id, email: userData.email, name: userData.name || 'User' };
      const token = fastify.jwt.sign({ sub: user.id, email: user.email, appId, type: 'client' });
      return reply.send({ user, token });
    },
  });

  fastify.get('/client-me', {
    preHandler: [requireClientApiKey, authenticateClientUser],
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const snap = await db.collection('client_users').doc(request.clientUser.id).get();
      if (!snap.exists) return reply.code(404).send({ error: 'User not found' });
      const u = snap.data();
      return { user: { id: snap.id, email: u.email, name: u.name || 'User' } };
    },
  });
}
