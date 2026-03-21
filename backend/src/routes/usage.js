export default async function usageRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  const getDb = () => {
    if (!fastify.db) throw new Error('Database unavailable');
    return fastify.db;
  };

  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: { days: { type: 'integer', minimum: 1, maximum: 90, default: 30 } },
      },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const days = Math.min(90, request.query.days || 30);
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      // Get all API key IDs for this user
      const keysSnap = await db.collection('api_keys').where('userId', '==', request.user.id).get();
      const keyIds = keysSnap.docs.map((d) => d.id);

      if (keyIds.length === 0) return reply.send({ total: 0, byDay: [] });

      // Query usage records in batches of 10 (Firestore 'in' limit)
      const allUsage = [];
      for (let i = 0; i < keyIds.length; i += 10) {
        const chunk = keyIds.slice(i, i + 10);
        const snap = await db.collection('usage').where('apiKeyId', 'in', chunk).get();
        allUsage.push(...snap.docs.map((d) => d.data()));
      }

      // Filter by date and group by day in JS
      const byDateMap = {};
      for (const record of allUsage) {
        const d = record.date?.toDate ? record.date.toDate() : new Date(record.date);
        if (d < since) continue;
        const dateStr = d.toISOString().slice(0, 10);
        byDateMap[dateStr] = (byDateMap[dateStr] || 0) + (record.count || 1);
      }

      const byDay = Object.entries(byDateMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
      const total = byDay.reduce((s, d) => s + d.count, 0);

      return reply.send({ total, byDay });
    },
  });
}
