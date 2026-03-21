import { checkRateLimit } from '../lib/rateLimit.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';
import { config } from '../config.js';

function rateLimitExceededResponse(rl) {
  const retryAfterSec = rl.reset > 0 ? Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)) : config.rateLimit.windowSeconds;
  return {
    code: 429,
    body: {
      error: 'Rate limit exceeded',
      message: `You have used all ${rl.limit} requests allowed per ${config.rateLimit.windowSeconds} seconds. Please wait ${retryAfterSec}s before retrying.`,
      retryAfter: retryAfterSec,
      upgrade: {
        message: 'Need higher rate limits? Upgrade your plan for more requests, higher quotas, and priority access.',
        url: '/pricing',
      },
    },
    retryAfterSec,
  };
}
import { getOllamaHostHeader, ollamaRequest } from '../lib/ollamaHttp.js';

export default async function publicApiRoutes(fastify) {
  const getDb = () => {
    if (!fastify.db) throw new Error('Database unavailable');
    return fastify.db;
  };

  async function recordUsage(apiKeyId, count = 1) {
    if (count === 0) return;
    try {
      const db = getDb();
      const { FieldValue } = await import('firebase-admin/firestore');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().slice(0, 10);
      const usageDocId = `${apiKeyId}_${dateStr}`;
      await Promise.all([
        db.collection('usage').doc(usageDocId).set(
          { apiKeyId, date: today, count: FieldValue.increment(count) },
          { merge: true }
        ),
        db.collection('api_keys').doc(apiKeyId).update({ usageCount: FieldValue.increment(count) }),
      ]);
    } catch {
      // non-critical — don't fail the request
    }
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
    let db;
    try { db = getDb(); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    // API key extraction — header only (query params are insecure: logged in server access logs)
    let rawKey = null;
    let keySource = null;

    // 1. X-API-Key header (primary)
    if (request.headers['x-api-key']) {
      rawKey = request.headers['x-api-key'];
      keySource = 'X-API-Key header';
    }
    // 2. Authorization: Bearer fk_... (OpenAI-SDK compatible fallback)
    else if (request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token.startsWith('fk_')) {
          rawKey = token;
          keySource = 'Authorization: Bearer header';
        }
      }
    }

    if (!rawKey) {
      return reply.code(401).send({
        error: 'Missing API key',
        message: 'Provide your API key via X-API-Key header or Authorization: Bearer <key>.',
      });
    }

    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!isValidApiKeyFormat(key)) {
      return reply.code(401).send({
        error: 'Invalid API key format',
        message: `API key must start with "fk_" and be 36 characters. Received from: ${keySource}.`,
      });
    }

    const keySnap = await db.collection('api_keys').where('key', '==', key).limit(1).get();
    if (keySnap.empty) {
      return reply.code(401).send({
        error: 'Invalid API key',
        message: 'API key not found. Check your key or generate a new one from the dashboard.',
      });
    }
    const keyDoc = { ...keySnap.docs[0].data(), _id: keySnap.docs[0].id };
    if (keyDoc.active === false) {
      return reply.code(403).send({
        error: 'API key revoked',
        message: 'This API key has been revoked. Generate a new key from your dashboard.',
      });
    }
    request.apiKey = keyDoc;

    const rl = await checkRateLimit(`apikey:${keyDoc._id}`);
    reply.header('X-RateLimit-Limit', rl.limit);
    reply.header('X-RateLimit-Remaining', rl.remaining);
    reply.header('X-RateLimit-Reset', rl.reset);
    if (!rl.success) {
      const { code, body, retryAfterSec } = rateLimitExceededResponse(rl);
      reply.header('Retry-After', retryAfterSec);
      return reply.code(code).send(body);
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
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const appId = request.apiKey._id.toString();
      const email = request.body.email.toLowerCase();
      const name = (request.body.name || email.split('@')[0] || 'User').trim();

      const existing = await db.collection('client_users')
        .where('appId', '==', appId).where('email', '==', email).limit(1).get();
      if (!existing.empty) return reply.code(409).send({ error: 'Email already registered for this app' });

      const passwordHash = await fastify.hashPassword(request.body.password);
      const docRef = await db.collection('client_users').add({
        appId, email, name, passwordHash, createdAt: new Date(), updatedAt: new Date(),
      });
      const user = { id: docRef.id, email, name };
      const token = fastify.jwt.sign({ sub: user.id, email: user.email, appId, type: 'client' });
      return reply.code(201).send({ user, token });
    },
  });

  fastify.post('/v1/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const appId = request.apiKey._id.toString();
      const email = request.body.email.toLowerCase();

      const snap = await db.collection('client_users')
        .where('appId', '==', appId).where('email', '==', email).limit(1).get();
      if (snap.empty) return reply.code(401).send({ error: 'Invalid email or password' });

      const doc = snap.docs[0];
      const userData = doc.data();
      if (!userData.passwordHash) return reply.code(401).send({ error: 'Invalid email or password' });

      const ok = await fastify.verifyPassword(request.body.password, userData.passwordHash);
      if (!ok) return reply.code(401).send({ error: 'Invalid email or password' });

      const user = { id: doc.id, email: userData.email, name: userData.name || 'User' };
      const token = fastify.jwt.sign({ sub: user.id, email: user.email, appId, type: 'client' });
      return reply.send({ user, token });
    },
  });

  fastify.get('/v1/auth/me', {
    preHandler: [authenticateClientUser],
    handler: async (request, reply) => {
      let db;
      try { db = getDb(); } catch {
        return reply.code(503).send({ error: 'Database unavailable' });
      }
      const snap = await db.collection('client_users').doc(request.clientUser.id).get();
      if (!snap.exists) return reply.code(404).send({ error: 'User not found' });
      const u = snap.data();
      return { user: { id: snap.id, email: u.email, name: u.name || 'User' } };
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
