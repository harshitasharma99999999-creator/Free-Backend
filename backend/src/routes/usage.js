export default async function usageRoutes(fastify) {
  const usage = fastify.mongo.db.collection('usage');
  const apiKeys = fastify.mongo.db.collection('api_keys');

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            byDay: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  count: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request) => {
      const days = Math.min(90, request.query.days || 30);
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const keyIds = await apiKeys
        .find({ userId: request.user.id })
        .project({ _id: 1 })
        .toArray()
        .then((arr) => arr.map((k) => k._id));

      const pipeline = [
        { $match: { apiKeyId: { $in: keyIds }, date: { $gte: since } } },
        { $group: { _id: '$date', count: { $sum: '$count' } } },
        { $sort: { _id: 1 } },
      ];
      const byDay = await usage.aggregate(pipeline).toArray();
      const total = byDay.reduce((s, d) => s + d.count, 0);

      return {
        total,
        byDay: byDay.map((d) => ({
          date: d._id.toISOString().slice(0, 10),
          count: d.count,
        })),
      };
    },
  });
}
