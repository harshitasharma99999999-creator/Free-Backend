import crypto from 'node:crypto';

export default async function apiKeysRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  const getDb = () => {
    if (!fastify.db) throw new Error('Database unavailable');
    return fastify.db;
  };

  // POST /api/keys — create a new API key
  fastify.post('/', {
    schema: {
      body: { type: 'object', properties: { name: { type: 'string', maxLength: 100 } } },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable', message: 'Unable to connect to database.' });
      }

      const userId = request.user.id;
      const name = (request.body?.name || 'My App').trim().slice(0, 100);

      // Check API key limit (filter active in JS to avoid composite index)
      const allKeys = await db.collection('api_keys').where('userId', '==', userId).get();
      const activeCount = allKeys.docs.filter((d) => d.data().active !== false).length;
      if (activeCount >= 5) {
        return reply.code(400).send({ error: 'Maximum of 5 active API keys reached. Revoke one first.' });
      }

      const rawKey = 'fk_' + crypto.randomBytes(32).toString('hex');
      const keyPreview = rawKey.slice(0, 8) + '...' + rawKey.slice(-4);
      const now = new Date();

      const docRef = await db.collection('api_keys').add({
        key: rawKey,
        keyPreview,
        name,
        userId,
        active: true,
        usageCount: 0,
        createdAt: now,
      });

      return reply.code(201).send({
        message: 'API key created successfully. Copy it now — it will not be shown again.',
        key: rawKey,
        id: docRef.id,
        name,
        keyPreview,
        createdAt: now.toISOString(),
      });
    },
  });

  // GET /api/keys — list keys for current user
  fastify.get('/', async (request, reply) => {
    let db;
    try { db = getDb(); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const snap = await db.collection('api_keys').where('userId', '==', request.user.id).get();
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'My App',
          keyPreview: data.keyPreview,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          usageCount: data.usageCount || 0,
          active: data.active !== false,
        };
      })
      .filter((k) => k.active)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return reply.send({ keys: list });
  });

  // DELETE /api/keys/:id — revoke a key
  fastify.delete('/:id', async (request, reply) => {
    let db;
    try { db = getDb(); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const { id } = request.params;
    const docRef = db.collection('api_keys').doc(id);
    const snap = await docRef.get();

    if (!snap.exists || snap.data().userId !== request.user.id) {
      return reply.code(404).send({ error: 'Key not found or does not belong to your account' });
    }

    await docRef.update({ active: false });
    return reply.send({ message: 'API key revoked successfully.', success: true });
  });
}
