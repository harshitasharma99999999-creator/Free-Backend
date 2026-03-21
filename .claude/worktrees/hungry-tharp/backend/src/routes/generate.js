import { checkRateLimit } from '../lib/rateLimit.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';
import { generateImage, generateVideo } from '../lib/aiProviders.js';
import { config } from '../config.js';

/**
 * AI Generation routes — image and video generation behind API key auth.
 * Mounted at /api/public (same prefix as other public API routes, but in a separate plugin).
 *
 * Credit flow:
 *  1. Validate API key
 *  2. Look up the key owner
 *  3. Check credits
 *  4. Deduct credits
 *  5. Call external AI provider
 *  6. Log usage
 *  7. Return result
 */
export default async function generateRoutes(fastify) {
  const getCollections = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return {
      apiKeys: db.collection('api_keys'),
      users: db.collection('users'),
      usageLogs: db.collection('usage_logs'),
      usage: db.collection('usage'),
    };
  };

  // Record a usage tick (for the existing daily usage aggregation)
  async function recordUsage(apiKeyId) {
    const { usage } = getCollections();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await usage.updateOne(
      { apiKeyId, date: today },
      { $inc: { count: 1 } },
      { upsert: true }
    );
  }

  // Log a generation event for audit trail
  async function logGeneration({ userId, apiKey, type, provider, cost }) {
    const { usageLogs } = getCollections();
    await usageLogs.insertOne({
      userId,
      apiKey,
      type,
      provider,
      cost,
      timestamp: new Date(),
    });
  }

  // Shared API key validation + rate limiting hook for generation endpoints
  async function validateApiKey(request, reply) {
    let apiKeys;
    try {
      ({ apiKeys } = getCollections());
    } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    // Accept both Authorization: Bearer <key> and X-API-Key header
    let rawKey = request.headers['x-api-key'] || request.query?.apiKey;
    if (!rawKey && request.headers.authorization) {
      const parts = request.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        rawKey = parts[1];
      }
    }

    if (!rawKey) {
      return reply.code(401).send({
        error: 'Missing API key',
        message: 'Provide Authorization: Bearer YOUR_API_KEY header or X-API-Key header.',
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

    // Rate limiting
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
  }

  // Apply API key validation to all routes in this plugin
  fastify.addHook('preHandler', validateApiKey);

  // ─── POST /v1/generate-image ───────────────────────────────────────
  fastify.post('/v1/generate-image', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            imageUrl: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            creditsRemaining: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { users } = getCollections();
      const keyDoc = request.apiKey;
      const { prompt } = request.body;

      // Look up the key owner
      let ownerId;
      try {
        ownerId = fastify.mongo.ObjectId(keyDoc.userId);
      } catch {
        ownerId = keyDoc.userId;
      }
      const user = await users.findOne({ _id: ownerId });
      if (!user) {
        return reply.code(401).send({ error: 'API key owner not found' });
      }

      // Check image credits
      const credits = user.imageCredits ?? 0;
      const cost = config.costs.image;
      if (credits < cost) {
        return reply.code(402).send({
          error: 'Insufficient credits',
          message: `You need ${cost} image credit(s) but have ${credits}. Upgrade your plan.`,
          creditsRemaining: credits,
        });
      }

      // Deduct credits BEFORE calling provider (optimistic deduction)
      await users.updateOne(
        { _id: user._id },
        { $inc: { imageCredits: -cost } }
      );

      try {
        const result = await generateImage(prompt);

        // Log usage
        await recordUsage(keyDoc._id);
        await logGeneration({
          userId: keyDoc.userId,
          apiKey: keyDoc.key,
          type: 'image',
          provider: result.provider,
          cost,
        });

        return reply.send({
          success: true,
          imageUrl: result.imageUrl,
          provider: result.provider,
          model: result.model,
          creditsRemaining: credits - cost,
        });
      } catch (err) {
        // Refund credits if provider call failed
        await users.updateOne(
          { _id: user._id },
          { $inc: { imageCredits: cost } }
        );
        return reply.code(502).send({
          error: 'Image generation failed',
          message: err.message || 'External provider error',
        });
      }
    },
  });

  // ─── POST /v1/generate-video ───────────────────────────────────────
  fastify.post('/v1/generate-video', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            videoUrl: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            creditsRemaining: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { users } = getCollections();
      const keyDoc = request.apiKey;
      const { prompt } = request.body;

      let ownerId;
      try {
        ownerId = fastify.mongo.ObjectId(keyDoc.userId);
      } catch {
        ownerId = keyDoc.userId;
      }
      const user = await users.findOne({ _id: ownerId });
      if (!user) {
        return reply.code(401).send({ error: 'API key owner not found' });
      }

      // Check video credits
      const credits = user.videoCredits ?? 0;
      const cost = config.costs.video;
      if (credits < cost) {
        return reply.code(402).send({
          error: 'Insufficient credits',
          message: `You need ${cost} video credit(s) but have ${credits}. Upgrade your plan.`,
          creditsRemaining: credits,
        });
      }

      // Deduct credits
      await users.updateOne(
        { _id: user._id },
        { $inc: { videoCredits: -cost } }
      );

      try {
        const result = await generateVideo(prompt);

        await recordUsage(keyDoc._id);
        await logGeneration({
          userId: keyDoc.userId,
          apiKey: keyDoc.key,
          type: 'video',
          provider: result.provider,
          cost,
        });

        return reply.send({
          success: true,
          videoUrl: result.videoUrl,
          provider: result.provider,
          model: result.model,
          creditsRemaining: credits - cost,
        });
      } catch (err) {
        // Refund on failure
        await users.updateOne(
          { _id: user._id },
          { $inc: { videoCredits: cost } }
        );
        return reply.code(502).send({
          error: 'Video generation failed',
          message: err.message || 'External provider error',
        });
      }
    },
  });
}
