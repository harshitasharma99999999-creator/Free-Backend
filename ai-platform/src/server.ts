import Fastify from 'fastify';
import cors      from '@fastify/cors';
import helmet    from '@fastify/helmet';
import multipart from '@fastify/multipart';
import * as admin from 'firebase-admin';

import { config }  from './utils/config';
import { logger }  from './utils/logger';
import { getPool } from './db/postgres';
import { getRedis } from './db/redis';

import { authRoutes }        from './api/auth.routes';
import { keyRoutes }         from './api/key.routes';
import { generationRoutes }  from './api/generation.routes';
import { audioRoutes }       from './api/audio.routes';
import { assistantsRoutes }  from './api/assistants.routes';
import { vpsRoutes }         from './api/vps.routes';
import { chatRoutes }        from './api/chat.routes';

// ── Firebase Admin ────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   config.FIREBASE_PROJECT_ID,
    clientEmail: config.FIREBASE_CLIENT_EMAIL,
    privateKey:  config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

// ── App builder ───────────────────────────────────────────────────────────────
async function buildApp() {
  const app = Fastify({
    logger:         false,
    trustProxy:     true,
    bodyLimit:      10 * 1024 * 1024,
    requestTimeout: 330_000,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin:      true,   // allow all origins — this is a developer API platform
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },  // 25 MB max
  });

  app.addHook('onResponse', async (req, reply) => {
    const auth   = req.headers.authorization ?? '';
    const masked = auth.startsWith('Bearer ') ? auth.slice(7, 14) + '****' : 'none';
    logger.info({
      method:    req.method,
      path:      req.routeOptions?.url ?? req.url,
      status:    reply.statusCode,
      ms:        reply.elapsedTime?.toFixed(1),
      key:       masked,
      uid:       req.user?.id ?? null,
      requestId: req.id,
    }, 'request');
  });

  await app.register(authRoutes);
  await app.register(keyRoutes);
  await app.register(generationRoutes);
  await app.register(audioRoutes);
  await app.register(assistantsRoutes);
  await app.register(vpsRoutes);
  await app.register(chatRoutes);

  app.get('/health', async () => ({
    status:    'ok',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  app.setErrorHandler(async (err, _req, reply) => {
    logger.error({ err }, 'Unhandled error');
    return reply.status(err.statusCode ?? 500).send({
      error: {
        message: err.message ?? 'Internal server error',
        type:    'api_error',
        param:   null,
        code:    'internal_error',
      },
    });
  });

  return app;
}

// ── Auto-migrate: create new tables if they don't exist ───────────────────────
async function runMigrations(): Promise<void> {
  const pool = getPool();
  const migrations = [
    // Assistants
    `CREATE TABLE IF NOT EXISTS assistants (
       id VARCHAR(64) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       name VARCHAR(256), description VARCHAR(512), instructions TEXT,
       model VARCHAR(128) NOT NULL DEFAULT 'eior-chat',
       tools JSONB NOT NULL DEFAULT '[]', metadata JSONB NOT NULL DEFAULT '{}',
       temperature FLOAT, top_p FLOAT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_assistants_user ON assistants(user_id)`,
    // Threads
    `CREATE TABLE IF NOT EXISTS threads (
       id VARCHAR(64) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_threads_user ON threads(user_id)`,
    // Thread messages
    `CREATE TABLE IF NOT EXISTS thread_messages (
       id VARCHAR(64) PRIMARY KEY, thread_id VARCHAR(64) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
       role VARCHAR(32) NOT NULL, content JSONB NOT NULL DEFAULT '[]',
       assistant_id VARCHAR(64), run_id VARCHAR(64),
       metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_thread_msgs_thread ON thread_messages(thread_id, created_at ASC)`,
    // Runs
    `CREATE TABLE IF NOT EXISTS runs (
       id VARCHAR(64) PRIMARY KEY, thread_id VARCHAR(64) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
       assistant_id VARCHAR(64) NOT NULL, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       status VARCHAR(32) NOT NULL DEFAULT 'queued', model VARCHAR(128), instructions TEXT,
       metadata JSONB NOT NULL DEFAULT '{}', usage JSONB, last_error JSONB,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), started_at TIMESTAMPTZ,
       completed_at TIMESTAMPTZ, failed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ
     )`,
    `CREATE INDEX IF NOT EXISTS idx_runs_thread ON runs(thread_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id)`,
    // Files
    `CREATE TABLE IF NOT EXISTS files (
       id VARCHAR(64) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       filename VARCHAR(255) NOT NULL, purpose VARCHAR(64) NOT NULL DEFAULT 'assistants',
       content BYTEA NOT NULL, size INTEGER NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)`,
    // VPS instances table (Hetzner-based)
    `CREATE TABLE IF NOT EXISTS vps_instances (
       id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
       proxmox_vmid INTEGER NOT NULL DEFAULT 0,
       proxmox_node VARCHAR(64) NOT NULL DEFAULT 'pve',
       name         VARCHAR(255) NOT NULL,
       plan         VARCHAR(50)  NOT NULL,
       cores        INTEGER NOT NULL DEFAULT 1,
       memory_mb    INTEGER NOT NULL DEFAULT 1024,
       disk_gb      INTEGER NOT NULL DEFAULT 20,
       ip_address   VARCHAR(64),
       status       VARCHAR(32) NOT NULL DEFAULT 'creating',
       created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_vps_user ON vps_instances(user_id)`,
    // Hetzner columns (added to existing table if upgrading from old schema)
    `ALTER TABLE vps_instances ADD COLUMN IF NOT EXISTS hetzner_server_id INTEGER DEFAULT 0`,
    `ALTER TABLE vps_instances ADD COLUMN IF NOT EXISTS memory_gb INTEGER`,
    `ALTER TABLE vps_instances ADD COLUMN IF NOT EXISTS image VARCHAR(64) DEFAULT 'ubuntu-22.04'`,
    // ChatGPT-style conversations
    `CREATE TABLE IF NOT EXISTS conversations (
       id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       title      VARCHAR(255) NOT NULL DEFAULT 'New conversation',
       model      VARCHAR(128) NOT NULL DEFAULT 'eior-chat',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS conversation_messages (
       id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
       role            VARCHAR(16) NOT NULL,
       content         TEXT NOT NULL,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_conv_msgs ON conversation_messages(conversation_id, created_at ASC)`,
  ];

  for (const sql of migrations) {
    await pool.query(sql);
  }
  logger.info('Database migrations complete');
}

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    const pg = await getPool().connect();
    pg.release();
    logger.info('PostgreSQL connected');

    await runMigrations();

    await getRedis().ping();
    logger.info('Redis connected');

    const app = await buildApp();
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`Eior LLM ready on http://0.0.0.0:${config.PORT}`);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
