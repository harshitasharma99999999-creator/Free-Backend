import crypto from 'node:crypto';

export default async function apiKeysRoutes(fastify) {
  // Use enhanced authentication that supports Firebase tokens
  fastify.addHook('onRequest', fastify.authenticate);

  const getKeys = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('api_keys');
  };

  const getUsers = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return db.collection('users');
  };

  // POST /api/keys — create a new API key
  fastify.post('/', {
    schema: { 
      body: { 
        type: 'object', 
        properties: { 
          name: { type: 'string', maxLength: 100 } 
        } 
      } 
    },
    handler: async (request, reply) => {
      let apiKeys, users;
      try { 
        apiKeys = getKeys();
        users = getUsers();
      } catch {
        return reply.code(503).send({ 
          error: 'Database unavailable',
          message: 'Unable to connect to database. Please try again later.'
        });
      }

      const userId = request.user.id;
      const name = (request.body?.name || 'My App').trim().slice(0, 100);

      // Verify user exists and is properly authenticated
      if (!fastify.mongo?.ObjectId) {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const userDoc = await users.findOne({ _id: new fastify.mongo.ObjectId(userId) });
      if (!userDoc) {
        return reply.code(401).send({ 
          error: 'User not found',
          message: 'Your user account could not be found. Please sign out and sign in again.'
        });
      }

      // Check API key limit
      const active = await apiKeys.countDocuments({ userId, active: true });
      if (active >= 5) {
        return reply.code(400).send({ 
          error: 'Maximum of 5 active API keys reached. Revoke one first.',
          message: 'You can have a maximum of 5 active API keys. Please revoke an existing key before creating a new one.'
        });
      }

      // Generate secure API key
      const rawKey = 'fk_' + crypto.randomBytes(32).toString('hex');
      const keyPreview = rawKey.slice(0, 8) + '...' + rawKey.slice(-4);
      const now = new Date();

      try {
        await apiKeys.insertOne({ 
          key: rawKey, 
          keyPreview, 
          name, 
          userId, 
          active: true, 
          usageCount: 0, 
          createdAt: now 
        });

        return reply.code(201).send({ 
          message: 'API key created successfully. Copy it now — it will not be shown again.', 
          key: rawKey, 
          name, 
          keyPreview, 
          createdAt: now.toISOString() 
        });
      } catch (error) {
        console.error('Failed to create API key:', error);
        return reply.code(500).send({
          error: 'Failed to create API key',
          message: 'An error occurred while creating your API key. Please try again.'
        });
      }
    },
  });

  // GET /api/keys — list keys for current user
  fastify.get('/', async (request, reply) => {
    let apiKeys;
    try { 
      apiKeys = getKeys(); 
    } catch {
      return reply.code(503).send({ 
        error: 'Database unavailable',
        message: 'Unable to connect to database. Please try again later.'
      });
    }

    try {
      const list = await apiKeys.find({ userId: request.user.id }).sort({ createdAt: -1 }).toArray();
      return reply.send({
        keys: list.map((k) => ({
          id: k._id.toString(),
          name: k.name || 'My App',
          keyPreview: k.keyPreview,
          createdAt: k.createdAt instanceof Date ? k.createdAt.toISOString() : k.createdAt,
          usageCount: k.usageCount || 0,
          active: k.active !== false,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      return reply.code(500).send({
        error: 'Failed to fetch API keys',
        message: 'An error occurred while retrieving your API keys. Please try again.'
      });
    }
  });

  // DELETE /api/keys/:id — revoke a key by MongoDB _id
  fastify.delete('/:id', async (request, reply) => {
    let apiKeys;
    try { 
      apiKeys = getKeys(); 
    } catch {
      return reply.code(503).send({ 
        error: 'Database unavailable',
        message: 'Unable to connect to database. Please try again later.'
      });
    }

    const { id } = request.params;
    let filter;
    try { 
      filter = { _id: new fastify.mongo.ObjectId(id), userId: request.user.id }; 
    } catch { 
      return reply.code(400).send({ 
        error: 'Invalid key ID',
        message: 'The provided key ID is not valid.'
      }); 
    }

    try {
      const result = await apiKeys.updateOne(filter, { $set: { active: false } });
      if (result.matchedCount === 0) {
        return reply.code(404).send({ 
          error: 'Key not found or does not belong to your account',
          message: 'The specified API key was not found or you do not have permission to revoke it.'
        });
      }
      return reply.send({ 
        message: 'API key revoked successfully.',
        success: true
      });
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      return reply.code(500).send({
        error: 'Failed to revoke API key',
        message: 'An error occurred while revoking your API key. Please try again.'
      });
    }
  });
}
