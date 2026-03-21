import { config } from '../config.js';
import { verifyFirebaseToken } from '../lib/firebaseAdmin.js';

// Default credits for a new free-tier user
const DEFAULT_PLAN = 'free';
const defaultCredits = () => ({
  imageCredits: config.plans.free.imageCredits,
  videoCredits: config.plans.free.videoCredits,
});

// Shared user schema for Fastify response serialization
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    plan: { type: 'string' },
    imageCredits: { type: 'number' },
    videoCredits: { type: 'number' },
  },
};

function toUserPayload(user) {
  return {
    id: user._id ? user._id.toString() : user.id,
    email: user.email || '',
    name: user.name || 'User',
    plan: user.plan || DEFAULT_PLAN,
    imageCredits: user.imageCredits ?? config.plans.free.imageCredits,
    videoCredits: user.videoCredits ?? config.plans.free.videoCredits,
  };
}

export default async function authRoutes(fastify) {
  const getUsers = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('users');
  };

  // Exchange Firebase ID token for backend JWT
  fastify.post('/firebase', {
    schema: {
      body: {
        type: 'object',
        required: ['idToken'],
        properties: { idToken: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: { user: userSchema, token: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      let users;
      try {
        users = getUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const { idToken } = request.body;
      let decoded;
      try {
        decoded = await verifyFirebaseToken(idToken);
      } catch (err) {
        return reply.code(401).send({ error: 'Invalid Firebase token' });
      }
      let user = await users.findOne({ firebaseUid: decoded.uid });
      if (!user) {
        const { insertedId } = await users.insertOne({
          firebaseUid: decoded.uid,
          email: (decoded.email || '').toLowerCase() || null,
          name: decoded.name || 'User',
          password: null,
          plan: DEFAULT_PLAN,
          ...defaultCredits(),
          createdAt: new Date(),
        });
        user = await users.findOne({ _id: insertedId });
      }
      const payload = toUserPayload(user);
      payload.email = payload.email || decoded.email || '';
      payload.name = payload.name || decoded.name || 'User';
      const token = fastify.jwt.sign(
        { sub: payload.id, email: payload.email },
        { expiresIn: config.jwt.expiresIn }
      );
      return reply.send({ user: payload, token });
    },
  });

  // Register with email + password
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
      response: {
        201: {
          type: 'object',
          properties: { user: userSchema, token: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      let users;
      try {
        users = getUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const { email, password, name } = request.body;
      const existing = await users.findOne({ email: email.toLowerCase() });
      if (existing) {
        return reply.code(409).send({ error: 'Email already registered' });
      }
      const hash = await fastify.hashPassword(password);
      const { insertedId } = await users.insertOne({
        email: email.toLowerCase(),
        password: hash,
        name: name.trim(),
        plan: DEFAULT_PLAN,
        ...defaultCredits(),
        createdAt: new Date(),
      });
      const user = {
        id: insertedId.toString(),
        email: email.toLowerCase(),
        name: name.trim(),
        plan: DEFAULT_PLAN,
        ...defaultCredits(),
      };
      const token = fastify.jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: config.jwt.expiresIn }
      );
      return reply.code(201).send({ user, token });
    },
  });

  // Login with email + password
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { user: userSchema, token: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      let users;
      try {
        users = getUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const { email, password } = request.body;
      const user = await users.findOne({ email: email.toLowerCase() });
      if (!user) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }
      const ok = await fastify.verifyPassword(password, user.password);
      if (!ok) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }
      const token = fastify.jwt.sign(
        { sub: user._id.toString(), email: user.email },
        { expiresIn: config.jwt.expiresIn }
      );
      return reply.send({ user: toUserPayload(user), token });
    },
  });

  // Get current user info
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: { user: userSchema },
        },
      },
    },
    handler: async (request, reply) => {
      let users;
      try {
        users = getUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      if (!fastify.mongo?.ObjectId) {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const user = await users.findOne(
        { _id: fastify.mongo.ObjectId(request.user.id) },
        { projection: { password: 0 } }
      );
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return { user: toUserPayload(user) };
    },
  });
}
