"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKey = generateKey;
exports.hashKey = hashKey;
exports.createApiKey = createApiKey;
exports.getKeysByUser = getKeysByUser;
exports.validateApiKey = validateApiKey;
exports.revokeApiKey = revokeApiKey;
exports.rotateApiKey = rotateApiKey;
exports.countActiveKeys = countActiveKeys;
const crypto_1 = require("crypto");
const postgres_1 = require("../db/postgres");
// ── Key generation & hashing ──────────────────────────────────────────────────
function generateKey() {
    return 'sk-' + (0, crypto_1.randomBytes)(32).toString('hex'); // sk- + 64 hex chars
}
function hashKey(key) {
    return (0, crypto_1.createHash)('sha256').update(key).digest('hex');
}
// ── CRUD ──────────────────────────────────────────────────────────────────────
async function createApiKey(userId, name) {
    const plaintext = generateKey();
    const key_hash = hashKey(plaintext);
    const key_prefix = plaintext.slice(0, 12); // "sk-" + 9 chars — safe to display
    const [key] = await (0, postgres_1.query)(`INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`, [userId, name, key_prefix, key_hash]);
    return { ...key, plaintext };
}
function getKeysByUser(userId) {
    return (0, postgres_1.query)(`SELECT id, user_id, name, key_prefix, is_active, created_at, last_used_at
     FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}
async function validateApiKey(rawKey) {
    const key = await (0, postgres_1.queryOne)(`SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE`, [hashKey(rawKey)]);
    if (key) {
        // Fire-and-forget last_used_at update
        (0, postgres_1.query)('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]).catch(() => { });
    }
    return key;
}
async function revokeApiKey(id, userId) {
    const rows = await (0, postgres_1.query)(`UPDATE api_keys SET is_active = FALSE
     WHERE id = $1 AND user_id = $2 AND is_active = TRUE RETURNING id`, [id, userId]);
    return rows.length > 0;
}
async function rotateApiKey(id, userId) {
    const existing = await (0, postgres_1.queryOne)('SELECT * FROM api_keys WHERE id = $1 AND user_id = $2 AND is_active = TRUE', [id, userId]);
    if (!existing)
        return null;
    await revokeApiKey(id, userId);
    return createApiKey(userId, existing.name);
}
async function countActiveKeys(userId) {
    const [row] = await (0, postgres_1.query)('SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = TRUE', [userId]);
    return parseInt(row.count, 10);
}
//# sourceMappingURL=apiKey.model.js.map