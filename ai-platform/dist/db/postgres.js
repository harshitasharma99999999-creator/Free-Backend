"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.query = query;
exports.queryOne = queryOne;
const pg_1 = require("pg");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
let _pool;
function getPool() {
    if (!_pool) {
        _pool = new pg_1.Pool({
            connectionString: config_1.config.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            ssl: { rejectUnauthorized: false },
        });
        _pool.on('error', err => logger_1.logger.error({ err }, 'Unexpected PostgreSQL pool error'));
    }
    return _pool;
}
async function query(text, params) {
    const pool = getPool();
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res.rows;
    }
    finally {
        client.release();
    }
}
async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] ?? null;
}
//# sourceMappingURL=postgres.js.map