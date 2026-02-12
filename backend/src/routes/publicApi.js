import { checkRateLimit } from '../lib/rateLimit.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';

export default async function publicApiRoutes(fastify) {
  const getCollections = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return {
      apiKeys: db.collection('api_keys'),
      usage: db.collection('usage'),
    };
  };

  async function recordUsage(apiKeyId, count = 1) {
    const { usage } = getCollections();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await usage.updateOne(
      { apiKeyId, date: today },
      { $inc: { count } },
      { upsert: true }
    );
  }

  fastify.addHook('preHandler', async (request, reply) => {
    let apiKeys;
    try {
      ({ apiKeys } = getCollections());
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
    request.apiKey = keyDoc;

    const rl = await checkRateLimit(`apikey:${keyDoc._id.toString()}`);
    reply.header('X-RateLimit-Limit', rl.limit);
    reply.header('X-RateLimit-Remaining', rl.remaining);
    reply.header('X-RateLimit-Reset', rl.reset);
    if (!rl.success) {
      return reply.code(429).send({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Try again later.',
      });
    }

    await recordUsage(keyDoc._id);
  });

  // Public API v1 - example endpoints (you can extend)
  fastify.get('/v1/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  });

  fastify.get('/v1/echo', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            echo: { type: 'string' },
            received: { type: 'string' },
          },
        },
      },
    },
    handler: async (request) => ({
      echo: request.query.message || 'Hello from Free API',
      received: new Date().toISOString(),
    }),
  });

  fastify.get('/v1/random', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          min: { type: 'integer', default: 0 },
          max: { type: 'integer', default: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            value: { type: 'integer' },
            min: { type: 'integer' },
            max: { type: 'integer' },
          },
        },
      },
    },
    handler: async (request) => {
      const min = Math.floor(Number(request.query.min)) || 0;
      const max = Math.floor(Number(request.query.max)) || 100;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const value = Math.floor(lo + Math.random() * (hi - lo + 1));
      return { value, min: lo, max: hi };
    },
  });
}
