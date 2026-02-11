import { config } from '../config.js';
import { verifyFirebaseToken } from '../lib/firebaseAdmin.js';

export default async function authRoutes(fastify) {
  const users = fastify.mongo.db.collection('users');

  // Exchange Firebase ID token for backend JWT (Firebase Auth on frontend)
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
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
            token: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
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
          createdAt: new Date(),
        });
        user = await users.findOne({ _id: insertedId });
      }
      const userPayload = {
        id: user._id.toString(),
        email: user.email || decoded.email || '',
        name: user.name || decoded.name || 'User',
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
      response: {
        201: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
            token: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
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
        createdAt: new Date(),
      });
      const user = {
        id: insertedId.toString(),
        email: email.toLowerCase(),
        name: name.trim(),
      };
      const token = fastify.jwt.sign(
        { sub: user.id, email: user.email },
        { expiresIn: config.jwt.expiresIn }
      );
      return reply.code(201).send({ user, token });
    },
  });

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
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
            token: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
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
      return reply.send({
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
        token,
      });
    },
  });

  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const user = await users.findOne(
        { _id: request.mongo.ObjectId(request.user.id) },
        { projection: { password: 0 } }
      );
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
      };
    },
  });
}
