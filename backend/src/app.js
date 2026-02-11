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
  const fastify = Fastify({ logger: config.env === 'production' ? false : true });
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
  await fastify.register(dbPlugin);
  await fastify.register(passwordPlugin);
  await fastify.register(authPlugin);

  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(apiKeysRoutes, { prefix: '/api/keys' });
  await fastify.register(usageRoutes, { prefix: '/api/usage' });
  await fastify.register(publicApiRoutes, { prefix: '/api/public' });

  fastify.get('/api', (_, reply) => {
    reply.send({
      name: 'Free API',
      version: '1.0',
      docs: `${config.apiBaseUrl}/api/docs`,
      public: `${config.apiBaseUrl}/api/public/v1`,
    });
  });

  await fastify.ensureIndexes();
  return fastify;
}
