import { Pool, PoolClient } from 'pg';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

let _pool: Pool;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
    _pool.on('error', err => logger.error({ err }, 'Unexpected PostgreSQL pool error'));
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  const client: PoolClient = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
