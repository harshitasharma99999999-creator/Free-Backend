import { createHash, randomBytes } from 'crypto';
import { query, queryOne } from '../db/postgres';

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  is_active: boolean;
  created_at: Date;
  last_used_at: Date | null;
}

export interface ApiKeyWithPlaintext extends ApiKey {
  plaintext: string; // returned exactly ONCE on creation/rotation
}

// ── Key generation & hashing ──────────────────────────────────────────────────

export function generateKey(): string {
  return 'sk-' + randomBytes(32).toString('hex'); // sk- + 64 hex chars
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createApiKey(
  userId: string,
  name: string
): Promise<ApiKeyWithPlaintext> {
  const plaintext = generateKey();
  const key_hash  = hashKey(plaintext);
  const key_prefix = plaintext.slice(0, 12); // "sk-" + 9 chars — safe to display

  const [key] = await query<ApiKey>(
    `INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, name, key_prefix, key_hash]
  );
  return { ...key, plaintext };
}

export function getKeysByUser(userId: string): Promise<ApiKey[]> {
  return query<ApiKey>(
    `SELECT id, user_id, name, key_prefix, is_active, created_at, last_used_at
     FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
}

export async function validateApiKey(rawKey: string): Promise<ApiKey | null> {
  const key = await queryOne<ApiKey>(
    `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE`,
    [hashKey(rawKey)]
  );
  if (key) {
    // Fire-and-forget last_used_at update
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]).catch(() => {});
  }
  return key;
}

export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE api_keys SET is_active = FALSE
     WHERE id = $1 AND user_id = $2 AND is_active = TRUE RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}

export async function rotateApiKey(
  id: string,
  userId: string
): Promise<ApiKeyWithPlaintext | null> {
  const existing = await queryOne<ApiKey>(
    'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
    [id, userId]
  );
  if (!existing) return null;
  await revokeApiKey(id, userId);
  return createApiKey(userId, existing.name);
}

export async function countActiveKeys(userId: string): Promise<number> {
  const [row] = await query<{ count: string }>(
    'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );
  return parseInt(row.count, 10);
}
