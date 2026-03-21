-- AI Platform PostgreSQL Schema
-- Run: psql $DATABASE_URL -f scripts/init-db.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  plan         VARCHAR(50)  NOT NULL DEFAULT 'free',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── API Keys ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  key_prefix   VARCHAR(12)  NOT NULL,          -- first 12 chars  (safe to display)
  key_hash     VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 of full key
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user   ON api_keys(user_id);

-- ── Usage Logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES users(id)    ON DELETE SET NULL,
  api_key_id        UUID        REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint          VARCHAR(255) NOT NULL,
  model             VARCHAR(255),
  prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER     NOT NULL DEFAULT 0,
  images_count      INTEGER     NOT NULL DEFAULT 0,
  videos_count      INTEGER     NOT NULL DEFAULT 0,
  response_time_ms  INTEGER,
  status_code       INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_key  ON usage_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_ts   ON usage_logs(created_at DESC);

-- ── VPS Instances ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vps_instances (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  proxmox_vmid   INTEGER     NOT NULL,
  proxmox_node   VARCHAR(64) NOT NULL DEFAULT 'pve',
  name           VARCHAR(255) NOT NULL,
  plan           VARCHAR(50)  NOT NULL,
  cores          INTEGER      NOT NULL,
  memory_mb      INTEGER      NOT NULL,
  disk_gb        INTEGER      NOT NULL,
  ip_address     VARCHAR(64),
  status         VARCHAR(32)  NOT NULL DEFAULT 'creating',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vps_user ON vps_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_vps_vmid ON vps_instances(proxmox_vmid);

-- ── Assistants ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assistants (
  id           VARCHAR(64)  PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(256),
  description  VARCHAR(512),
  instructions TEXT,
  model        VARCHAR(128) NOT NULL DEFAULT 'eior-chat',
  tools        JSONB        NOT NULL DEFAULT '[]',
  metadata     JSONB        NOT NULL DEFAULT '{}',
  temperature  FLOAT,
  top_p        FLOAT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assistants_user ON assistants(user_id);

-- ── Threads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id         VARCHAR(64)  PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata   JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threads_user ON threads(user_id);

-- ── Thread Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_messages (
  id           VARCHAR(64)  PRIMARY KEY,
  thread_id    VARCHAR(64)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role         VARCHAR(32)  NOT NULL,
  content      JSONB        NOT NULL DEFAULT '[]',
  assistant_id VARCHAR(64),
  run_id       VARCHAR(64),
  metadata     JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_thread_msgs_thread ON thread_messages(thread_id, created_at ASC);

-- ── Runs ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runs (
  id           VARCHAR(64)  PRIMARY KEY,
  thread_id    VARCHAR(64)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  assistant_id VARCHAR(64)  NOT NULL,
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(32)  NOT NULL DEFAULT 'queued',
  model        VARCHAR(128),
  instructions TEXT,
  metadata     JSONB        NOT NULL DEFAULT '{}',
  usage        JSONB,
  last_error   JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_runs_thread ON runs(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user   ON runs(user_id);

-- ── Files ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
  id         VARCHAR(64)  PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   VARCHAR(255) NOT NULL,
  purpose    VARCHAR(64)  NOT NULL DEFAULT 'assistants',
  content    BYTEA        NOT NULL,
  size       INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
