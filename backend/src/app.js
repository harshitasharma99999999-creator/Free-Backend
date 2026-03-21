import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { config } from './config.js';
import dbPlugin from './db/index.js';
import authPlugin from './plugins/auth.js';
import passwordPlugin from './plugins/password.js';
import authRoutes from './routes/auth.js';
import apiKeysRoutes from './routes/apiKeys.js';
import usageRoutes from './routes/usage.js';
import publicApiRoutes from './routes/publicApi.js';
import openaiRoutes from './routes/openai.js';
import eiorOpenaiRoutes from './routes/eiorOpenai.js';
import freeChatRoutes from './routes/freeChat.js';
import freeVibecodeRoutes from './routes/freeVibecode.js';
import vpsRoutes from './routes/vps.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: config.env !== 'production',
    // Disable request timeout for serverless (Vercel manages its own)
    requestTimeout: 0,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Server-to-server requests don't have an Origin header
      // Allow these requests to bypass CORS (no CORS headers added)
      if (!origin) {
        callback(null, false);
        return;
      }

      // Browser requests have an Origin header
      // Apply CORS validation for allowed origins
      const allowedOrigins = config.cors.origins;
      
      // Handle wildcard or array of origins
      if (allowedOrigins === '*' || allowedOrigins === true) {
        callback(null, true);
        return;
      }

      if (Array.isArray(allowedOrigins)) {
        const allowed =
          allowedOrigins.includes(origin) ||
          allowedOrigins.includes('*') ||
          /^https?:\/\/[^.]+\.vercel\.app$/.test(origin) ||
          /^https?:\/\/[^.]+\.web\.app$/.test(origin);
        callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
        return;
      }

      // Single origin string
      if (allowedOrigins === origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Database — if this fails the app still starts; routes will return 500
  await fastify.register(dbPlugin);
  await fastify.register(passwordPlugin);
  await fastify.register(authPlugin);

  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(apiKeysRoutes, { prefix: '/api/keys' });
  await fastify.register(usageRoutes, { prefix: '/api/usage' });
  await fastify.register(publicApiRoutes, { prefix: '/api/public' });
  // Secondary prefix for developer integrations (works reliably across hosting rewrites).
  await fastify.register(publicApiRoutes, { prefix: '/api/developer' });

  // Free dashboard chat (no API key required; uses Firebase/backend auth)
  await fastify.register(freeChatRoutes, { prefix: '/api/chat' });

  // Free vibecode (no API key required)
  await fastify.register(freeVibecodeRoutes, { prefix: '/api/vibecode' });

  // OpenAI-compatible API — swap baseURL to this server's /v1 in any OpenAI SDK
  await fastify.register(openaiRoutes, { prefix: '/v1' });

  // EIOR OpenAI-compatible API for OpenClaw integration
  await fastify.register(eiorOpenaiRoutes, { prefix: '/eior/v1' });

  // VPS management — Hetzner Cloud servers for running OpenClaw
  await fastify.register(vpsRoutes, { prefix: '/api/vps' });

  // Root health-check endpoint (no DB needed)
  fastify.get('/api', (_, reply) => {
    reply.send({
      name: 'Free API',
      version: '1.0',
      status: 'running',
    });
  });

  // Public integration config — no API key required. Developers fetch this and add their API key in their app.
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  fastify.get('/api/integration-config', (_, reply) => {
    reply.send({
      baseUrl,
      auth: {
        register: `${baseUrl}/api/auth/client-register`,
        login: `${baseUrl}/api/auth/client-login`,
        me: `${baseUrl}/api/auth/client-me`,
      },
      headers: {
        apiKey: 'X-API-Key',
        authorization: 'Authorization',
      },
      usage: 'Add your API key to X-API-Key header. For /me, also send Authorization: Bearer <token>.',
    });
  });

  // Index creation in background — never crash the app
  try {
    fastify.ensureIndexes().catch((err) => {
      console.warn('ensureIndexes failed (non-fatal):', err.message);
    });
  } catch (_) {
    // ensureIndexes may not exist if db registration failed
  }

  // Make sure Fastify is fully ready
  await fastify.ready();
  return fastify;
}
