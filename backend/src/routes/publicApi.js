import { checkRateLimit } from '../lib/rateLimit.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';
import { config } from '../config.js';
import { getOllamaHostHeader, ollamaRequest } from '../lib/ollamaHttp.js';

export default async function publicApiRoutes(fastify) {
  const getCollections = () => {
    const db = fastify.mongo?.db;
    if (!db) throw new Error('Database unavailable');
    return {
      apiKeys: db.collection('api_keys'),
      usage: db.collection('usage'),
      clientUsers: db.collection('client_users'),
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
    } catch (err) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token.',
      });
    }

    const apiKeyId = request.apiKey?._id?.toString();
    if (!payload?.sub || !payload?.appId || payload.type !== 'client' || payload.appId !== apiKeyId) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token does not belong to this API key.',
      });
    }

    request.clientUser = {
      id: payload.sub,
      email: payload.email || '',
      appId: payload.appId,
    };
  }

  fastify.addHook('preHandler', async (request, reply) => {
    let apiKeys;
    try {
      ({ apiKeys } = getCollections());
    } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    // Unified API key extraction: support multiple formats
    let rawKey = null;
    let keySource = null;

    // 1. Check X-API-Key header (primary method)
    if (request.headers['x-api-key']) {
      rawKey = request.headers['x-api-key'];
      keySource = 'X-API-Key header';
    }
    // 2. Check Authorization: Bearer format (fallback)
    else if (request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        // Check if it's an API key format (fk_...) not a JWT
        if (token && token.startsWith('fk_')) {
          rawKey = token;
          keySource = 'Authorization: Bearer header';
        }
      }
    }
    // 3. Check query parameter (least preferred)
    if (!rawKey && request.query?.apiKey) {
      rawKey = request.query.apiKey;
      keySource = 'apiKey query parameter';
    }

    if (!rawKey) {
      return reply.code(401).send({
        error: 'Missing API key',
        message: 'Provide API key via X-API-Key header, Authorization: Bearer header, or apiKey query parameter.',
      });
    }

    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!isValidApiKeyFormat(key)) {
      return reply.code(401).send({
        error: 'Invalid API key format',
        message: `API key must match format fk_<32-characters>. Received from: ${keySource}.`,
      });
    }

    const keyDoc = await apiKeys.findOne({ key });
    if (!keyDoc) {
      return reply.code(401).send({
        error: 'Invalid API key',
        message: 'API key not found or has been revoked.',
      });
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

  fastify.post('/v1/auth/register', {
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
        ({ clientUsers } = getCollections());
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const appId = request.apiKey._id.toString();
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

  fastify.post('/v1/auth/login', {
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
        ({ clientUsers } = getCollections());
      } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }

      const appId = request.apiKey._id.toString();
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

  fastify.get('/v1/auth/me', {
    preHandler: [authenticateClientUser],
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
        ({ clientUsers } = getCollections());
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

  fastify.post('/v1/suggest-outfits', {
    schema: {
      body: {
        type: 'object',
        required: ['bodyType', 'skinTone'],
        properties: {
          bodyType: { type: 'string', minLength: 1, maxLength: 100 },
          skinTone: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  outfitName: { type: 'string' },
                  colors: { type: 'array', items: { type: 'string' } },
                  stylingTips: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { bodyType, skinTone } = request.body;

      const prompt = `You are a fashion expert. Suggest 3 outfit combinations for someone with the following profile:
- Body type: ${bodyType}
- Skin tone: ${skinTone}

Respond ONLY with a valid JSON object in this exact format (no extra text, no markdown, just JSON):
{
  "suggestions": [
    {
      "outfitName": "Casual Summer Look",
      "colors": ["Navy Blue", "White", "Beige"],
      "stylingTips": "Pair loose-fitting linen trousers with a tucked-in white shirt. Add nude sandals to elongate your silhouette."
    }
  ]
}

Return exactly 3 suggestions tailored to the body type and skin tone.`;

      let ollamaRaw;
      try {
        const hostHeader = getOllamaHostHeader(config.ollama.baseUrl, config.ollama.hostHeader);
        const res = await ollamaRequest({
          baseUrl: config.ollama.baseUrl,
          path: '/api/generate',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          hostHeader,
          body: {
            model: config.ollama.model,
            prompt,
            format: 'json',
            stream: false,
          },
          timeoutMs: 90_000,
        });

        if (!res.ok) {
          const errText = await res.text();
          return reply.code(502).send({
            error: 'Model error',
            message: `Ollama returned ${res.status}: ${errText}`,
          });
        }

        ollamaRaw = await res.json();
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.code(504).send({
            error: 'Model timed out',
            message: 'The AI model did not respond in time. Try again.',
          });
        }
        return reply.code(502).send({
          error: 'Model unavailable',
          message: err.message || 'Could not reach Ollama. Ensure it is running locally.',
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(ollamaRaw.response);
      } catch {
        return reply.code(502).send({
          error: 'Invalid model response',
          message: 'The model did not return valid JSON.',
        });
      }

      if (!Array.isArray(parsed?.suggestions)) {
        return reply.code(502).send({
          error: 'Invalid model response',
          message: 'Expected a "suggestions" array in the model response.',
        });
      }

      const suggestions = parsed.suggestions.map((s) => ({
        outfitName: String(s.outfitName || ''),
        colors: Array.isArray(s.colors) ? s.colors.map(String) : [],
        stylingTips: String(s.stylingTips || ''),
      }));

      return reply.send({ suggestions });
    },
  });

  // ─── Replicate helper ───────────────────────────────────────────────────────

  async function runReplicatePrediction(modelVersion, input) {
    if (!config.replicate?.apiToken) {
      throw Object.assign(new Error('REPLICATE_API_TOKEN is not configured on this server.'), { status: 501 });
    }

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.replicate.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: modelVersion, input }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new Error(`Replicate create failed ${createRes.status}: ${text}`);
    }

    let prediction = await createRes.json();
    const maxAttempts = 40;
    let attempts = 0;

    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${config.replicate.apiToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      prediction = await pollRes.json();
      attempts++;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }

    return prediction.output;
  }

  // ─── POST /v1/generate-image ──────────────────────────────────────────────
  fastify.post('/v1/generate-image', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt:         { type: 'string', minLength: 1, maxLength: 1000 },
          width:          { type: 'integer', minimum: 64, maximum: 2048, default: 1024 },
          height:         { type: 'integer', minimum: 64, maximum: 2048, default: 1024 },
          negativePrompt: { type: 'string', maxLength: 500 },
        },
      },
    },
    handler: async (request, reply) => {
      const { prompt, width = 1024, height = 1024, negativePrompt = '' } = request.body;

      if (!config.replicate?.apiToken) {
        return reply.code(501).send({
          error: 'Image generation not configured',
          message: 'Set REPLICATE_API_TOKEN to enable image generation.',
        });
      }

      try {
        await recordUsage(request.apiKey._id, 0); // already counted in preHandler
        const output = await runReplicatePrediction(config.replicate.imageModel, {
          prompt,
          negative_prompt:     negativePrompt,
          width,
          height,
          num_inference_steps: 30,
          guidance_scale:      7.5,
        });

        const imageUrl = Array.isArray(output) ? output[0] : output;
        return reply.send({
          success:  true,
          imageUrl,
          prompt,
          model:    'eior-image-gen',
          creditsUsed: config.replicate.creditCost?.image ?? 1,
        });
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.code(504).send({ error: 'Image generation timed out.', message: err.message });
        }
        return reply.code(err.status ?? 502).send({ error: 'Image generation failed', message: err.message });
      }
    },
  });

  // ─── POST /v1/generate-video ──────────────────────────────────────────────
  fastify.post('/v1/generate-video', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt:         { type: 'string', minLength: 1, maxLength: 500 },
          fps:            { type: 'integer', minimum: 8, maximum: 60, default: 24 },
          numFrames:      { type: 'integer', minimum: 8, maximum: 120, default: 24 },
          negativePrompt: { type: 'string', maxLength: 500 },
        },
      },
    },
    handler: async (request, reply) => {
      const { prompt, fps = 24, numFrames = 24, negativePrompt = '' } = request.body;

      if (!config.replicate?.apiToken) {
        return reply.code(501).send({
          error: 'Video generation not configured',
          message: 'Set REPLICATE_API_TOKEN to enable video generation.',
        });
      }

      try {
        const output = await runReplicatePrediction(config.replicate.videoModel, {
          prompt,
          negative_prompt:     negativePrompt,
          fps,
          num_frames:          numFrames,
          num_inference_steps: 50,
          guidance_scale:      17.5,
        });

        const videoUrl = Array.isArray(output) ? output[0] : output;
        return reply.send({
          success:  true,
          videoUrl,
          prompt,
          model:    'zeroscope-v2-xl',
          creditsUsed: config.replicate.creditCost?.video ?? 5,
        });
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.code(504).send({ error: 'Video generation timed out.', message: err.message });
        }
        return reply.code(err.status ?? 502).send({ error: 'Video generation failed', message: err.message });
      }
    },
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
