"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vpsRoutes = vpsRoutes;
const zod_1 = require("zod");
const firebaseAuth_middleware_1 = require("../middleware/firebaseAuth.middleware");
const postgres_1 = require("../db/postgres");
const logger_1 = require("../utils/logger");
const hetzner_service_1 = require("../services/hetzner.service");
const createVpsSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with dashes'),
    plan: zod_1.z.enum(['starter', 'standard', 'pro']),
});
async function vpsRoutes(app) {
    app.addHook('preHandler', firebaseAuth_middleware_1.verifyFirebaseToken);
    // ── GET /v1/vps — list user's VPS instances ───────────────────────────────
    app.get('/v1/vps', async (req, reply) => {
        const pool = (0, postgres_1.getPool)();
        const { rows } = await pool.query(`SELECT id, hetzner_server_id, name, plan, cores, memory_gb, disk_gb,
              ip_address, status, image, created_at
       FROM vps_instances
       WHERE user_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`, [req.user.id]);
        return reply.send({ vps: rows });
    });
    // ── POST /v1/vps — create a new VPS ──────────────────────────────────────
    app.post('/v1/vps', async (req, reply) => {
        if (!(0, hetzner_service_1.hetznerConfigured)()) {
            return reply.status(503).send({
                error: 'VPS provisioning requires a Hetzner API token. Set HETZNER_API_TOKEN in your environment.',
            });
        }
        const parsed = createVpsSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.issues[0].message });
        }
        const { name, plan } = parsed.data;
        const planConfig = hetzner_service_1.VPS_PLANS[plan];
        const pool = (0, postgres_1.getPool)();
        // Check existing VPS count (max 3 per user)
        const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM vps_instances WHERE user_id = $1 AND status != 'deleted'`, [req.user.id]);
        if (parseInt(countRows[0].count) >= 3) {
            return reply.status(400).send({ error: 'Maximum 3 VPS instances per account.' });
        }
        // Insert record immediately (status: creating)
        const { rows } = await pool.query(`INSERT INTO vps_instances
         (user_id, hetzner_server_id, name, plan, cores, memory_gb, disk_gb, image, status)
       VALUES ($1, 0, $2, $3, $4, $5, $6, 'ubuntu-22.04', 'creating')
       RETURNING id, hetzner_server_id, name, plan, cores, memory_gb, disk_gb, image, status, created_at`, [req.user.id, name, plan, planConfig.cores, planConfig.memoryGb, planConfig.diskGb]);
        const instance = rows[0];
        // Provision async (don't block the response)
        (async () => {
            try {
                const server = await (0, hetzner_service_1.createServer)({ name, plan: plan });
                await pool.query(`UPDATE vps_instances
           SET hetzner_server_id = $1, ip_address = $2, status = $3, updated_at = NOW()
           WHERE id = $4`, [server.id, server.ip, (0, hetzner_service_1.mapHetznerStatus)(server.status), instance.id]);
                logger_1.logger.info({ serverId: server.id, name, ip: server.ip }, 'VPS provisioned on Hetzner');
            }
            catch (err) {
                logger_1.logger.error({ err }, 'Hetzner VPS provisioning failed');
                await pool.query(`UPDATE vps_instances SET status = 'error', updated_at = NOW() WHERE id = $1`, [instance.id]);
            }
        })();
        return reply.status(202).send({
            message: 'VPS is being provisioned on Hetzner Cloud. Check status in a moment.',
            vps: instance,
        });
    });
    // ── GET /v1/vps/:id — get single VPS + live Hetzner status ───────────────
    app.get('/v1/vps/:id', async (req, reply) => {
        const { id } = req.params;
        const pool = (0, postgres_1.getPool)();
        const { rows } = await pool.query(`SELECT * FROM vps_instances WHERE id = $1 AND user_id = $2 AND status != 'deleted'`, [id, req.user.id]);
        if (!rows.length)
            return reply.status(404).send({ error: 'VPS not found' });
        const instance = rows[0];
        // Enrich with live Hetzner status
        if ((0, hetzner_service_1.hetznerConfigured)() && instance.hetzner_server_id > 0) {
            try {
                const server = await (0, hetzner_service_1.getServer)(instance.hetzner_server_id);
                const liveStatus = (0, hetzner_service_1.mapHetznerStatus)(server.status);
                const liveIp = server.public_net.ipv4?.ip ?? instance.ip_address;
                await pool.query(`UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3`, [liveStatus, liveIp, id]);
                instance.status = liveStatus;
                instance.ip_address = liveIp;
            }
            catch (err) {
                logger_1.logger.warn({ err, serverId: instance.hetzner_server_id }, 'Could not fetch live Hetzner status');
            }
        }
        return reply.send({ vps: instance });
    });
    // ── POST /v1/vps/:id/start ────────────────────────────────────────────────
    app.post('/v1/vps/:id/start', async (req, reply) => {
        const { id } = req.params;
        const pool = (0, postgres_1.getPool)();
        const { rows } = await pool.query(`SELECT * FROM vps_instances WHERE id = $1 AND user_id = $2 AND status != 'deleted'`, [id, req.user.id]);
        if (!rows.length)
            return reply.status(404).send({ error: 'VPS not found' });
        try {
            await (0, hetzner_service_1.powerOnServer)(rows[0].hetzner_server_id);
            await pool.query(`UPDATE vps_instances SET status = 'running', updated_at = NOW() WHERE id = $1`, [id]);
            return reply.send({ message: 'VPS starting' });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Failed to start Hetzner server');
            return reply.status(502).send({ error: 'Failed to start VPS' });
        }
    });
    // ── POST /v1/vps/:id/stop ─────────────────────────────────────────────────
    app.post('/v1/vps/:id/stop', async (req, reply) => {
        const { id } = req.params;
        const pool = (0, postgres_1.getPool)();
        const { rows } = await pool.query(`SELECT * FROM vps_instances WHERE id = $1 AND user_id = $2 AND status != 'deleted'`, [id, req.user.id]);
        if (!rows.length)
            return reply.status(404).send({ error: 'VPS not found' });
        try {
            await (0, hetzner_service_1.powerOffServer)(rows[0].hetzner_server_id);
            await pool.query(`UPDATE vps_instances SET status = 'stopped', updated_at = NOW() WHERE id = $1`, [id]);
            return reply.send({ message: 'VPS stopping' });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Failed to stop Hetzner server');
            return reply.status(502).send({ error: 'Failed to stop VPS' });
        }
    });
    // ── DELETE /v1/vps/:id — destroy VPS ─────────────────────────────────────
    app.delete('/v1/vps/:id', async (req, reply) => {
        const { id } = req.params;
        const pool = (0, postgres_1.getPool)();
        const { rows } = await pool.query(`SELECT * FROM vps_instances WHERE id = $1 AND user_id = $2 AND status != 'deleted'`, [id, req.user.id]);
        if (!rows.length)
            return reply.status(404).send({ error: 'VPS not found' });
        await pool.query(`UPDATE vps_instances SET status = 'deleted', updated_at = NOW() WHERE id = $1`, [id]);
        if ((0, hetzner_service_1.hetznerConfigured)() && rows[0].hetzner_server_id > 0) {
            (0, hetzner_service_1.deleteServer)(rows[0].hetzner_server_id).catch(err => logger_1.logger.error({ err, serverId: rows[0].hetzner_server_id }, 'Failed to delete Hetzner server'));
        }
        return reply.send({ message: 'VPS destroyed' });
    });
}
//# sourceMappingURL=vps.routes.js.map