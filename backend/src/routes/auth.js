import { config } from '../config.js';
import { verifyFirebaseToken } from '../lib/firebaseAdmin.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';

export default async function authRoutes(fastify) {
  const getUsers = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('users');
  };

  const getClientUsers = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('client_users');
  };

  const getApiKeys = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('api_keys');
  };

  async function requireClientApiKey(request, reply) {
    let apiKeys;
    try {
      apiKeys = getApiKeys();
    } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const rawKey = request.headers['x-api-key'] || request.query?.apiKey;
    if (!rawKey) {
      return reply.code(401).send({
        error: 'Missing API key',
        message: 'Provide X-API-Key header or apiKey query parameter.',
      });
    }
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!isValidApiKeyFormat(key)) {
      return reply.code(401).send({ error: 'Invalid API key format' });
    }
    const keyDoc = await apiKeys.findOne({ key });
    if (!keyDoc) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }
    request.clientApiKey = keyDoc;
  }

  function getBearerToken(request) {
    const raw = request.headers.authorization;
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.toLowerCase().startsWith('bearer ')) return null;
    const token = raw.slice(7).trim();
    return token || null;
  }

  async function authenticateClientUser(request, reply) {
    const token = getBearerToken(request);
    if (!token) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing Bearer token in Authorization header.',
      });
    }

    let payload;
    try {
      payload = fastify.jwt.verify(token);
    } catch {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token.',
      });
    }

    const appId = request.clientApiKey?._id?.toString();
    if (!payload?.sub || payload.type !== 'client' || payload.appId !== appId) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token does not belong to this API key.',
      });
    }

    request.clientUser = {
      id: payload.sub,
      email: payload.email || '',
      appId,
    };
  }

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
      if (!user.password) {
        // User registered via Firebase and has no password set
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
        { _id: new fastify.mongo.ObjectId(request.user.id) },
        { projection: { password: 0 } }
      );
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return reply.send({
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
      });
    },
  });

  // Dashboard: list all app users across the logged-in user's API keys
  fastify.get('/client-users', {
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  appId: { type: 'string' },
                  appName: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const apiKeysCol = getApiKeys();
      const clientUsersCol = getClientUsers();
      if (!fastify.mongo?.ObjectId) {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const keyDocs = await apiKeysCol.find({ userId: request.user.id }).toArray();
      const appIds = keyDocs.map((k) => k._id.toString());
      const keyByName = Object.fromEntries(keyDocs.map((k) => [k._id.toString(), k.name || 'Unnamed']));
      if (appIds.length === 0) {
        return reply.send({ users: [] });
      }
      const users = await clientUsersCol
        .find({ appId: { $in: appIds } })
        .sort({ createdAt: -1 })
        .toArray();
      const list = users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name || 'User',
        appId: u.appId,
        appName: keyByName[u.appId] || u.appId,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      }));
      return reply.send({ users: list });
    },
  });

  // Developer-facing auth for their own app users (scoped by API key)
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
      let clientUsers;
      try {
        clientUsers = getClientUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const appId = request.clientApiKey._id.toString();
      const email = request.body.email.toLowerCase();
      const name = (request.body.name || request.body.email.split('@')[0] || 'User').trim();

      const existing = await clientUsers.findOne({ appId, email });
      if (existing) {
        return reply.code(409).send({ error: 'Email already registered for this app' });
      }

      const passwordHash = await fastify.hashPassword(request.body.password);

      try {
        const { insertedId } = await clientUsers.insertOne({
          appId,
          email,
          name,
          passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const user = {
          id: insertedId.toString(),
          email,
          name,
        };

        const token = fastify.jwt.sign({
          sub: user.id,
          email: user.email,
          appId,
          type: 'client',
        });

        return reply.code(201).send({ user, token });
      } catch (err) {
        if (err && err.code === 11000) {
          return reply.code(409).send({ error: 'Email already registered for this app' });
        }
        throw err;
      }
    },
  });

  fastify.post('/client-login', {
    preHandler: [requireClientApiKey],
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
      let clientUsers;
      try {
        clientUsers = getClientUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const appId = request.clientApiKey._id.toString();
      const email = request.body.email.toLowerCase();

      const userDoc = await clientUsers.findOne({ appId, email });
      if (!userDoc || !userDoc.passwordHash) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const ok = await fastify.verifyPassword(request.body.password, userDoc.passwordHash);
      if (!ok) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const user = {
        id: userDoc._id.toString(),
        email: userDoc.email,
        name: userDoc.name || 'User',
      };

      const token = fastify.jwt.sign({
        sub: user.id,
        email: user.email,
        appId,
        type: 'client',
      });

      return reply.send({ user, token });
    },
  });

  fastify.get('/client-me', {
    preHandler: [requireClientApiKey, authenticateClientUser],
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
      let clientUsers;
      try {
        clientUsers = getClientUsers();
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      if (!fastify.mongo?.ObjectId) {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const userDoc = await clientUsers.findOne({
        _id: new fastify.mongo.ObjectId(request.clientUser.id),
        appId: request.clientUser.appId,
      });

      if (!userDoc) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        user: {
          id: userDoc._id.toString(),
          email: userDoc.email,
          name: userDoc.name || 'User',
        },
      };
    },
  });
}
