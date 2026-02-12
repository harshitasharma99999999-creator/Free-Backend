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
    origin: config.cors.origins,
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

  // Root health-check endpoint (no DB needed)
  fastify.get('/api', (_, reply) => {
    reply.send({
      name: 'Free API',
      version: '1.0',
      status: 'running',
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
