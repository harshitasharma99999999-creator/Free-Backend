"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyRoutes = keyRoutes;
const zod_1 = require("zod");
const firebaseAuth_middleware_1 = require("../middleware/firebaseAuth.middleware");
const apiKey_model_1 = require("../models/apiKey.model");
const config_1 = require("../utils/config");
const createSchema = zod_1.z.object({ name: zod_1.z.string().min(1).max(100).trim() });
async function keyRoutes(app) {
    // All key routes require Firebase auth
    app.addHook('preHandler', firebaseAuth_middleware_1.verifyFirebaseToken);
    // GET /v1/keys
    app.get('/v1/keys', async (req, reply) => {
        const keys = await (0, apiKey_model_1.getKeysByUser)(req.user.id);
        return reply.send({ keys });
    });
    // POST /v1/keys — create a new API key
    app.post('/v1/keys', async (req, reply) => {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                code: 'VALIDATION_ERROR',
                details: parsed.error.flatten(),
            });
        }
        const count = await (0, apiKey_model_1.countActiveKeys)(req.user.id);
        if (count >= config_1.config.API_KEY_MAX_PER_USER) {
            return reply.status(400).send({
                error: `You have reached the limit of ${config_1.config.API_KEY_MAX_PER_USER} active API keys.`,
                code: 'KEY_LIMIT_REACHED',
            });
        }
        const key = await (0, apiKey_model_1.createApiKey)(req.user.id, parsed.data.name);
        return reply.status(201).send({
            key: {
                id: key.id,
                name: key.name,
                key: key.plaintext, // ← shown exactly ONCE
                prefix: key.key_prefix,
                createdAt: key.created_at,
            },
            warning: 'Save this key now — it will never be shown again.',
        });
    });
    // DELETE /v1/keys/:id — revoke a key
    app.delete('/v1/keys/:id', async (req, reply) => {
        const { id } = req.params;
        const ok = await (0, apiKey_model_1.revokeApiKey)(id, req.user.id);
        return ok
            ? reply.send({ message: 'API key revoked successfully.' })
            : reply.status(404).send({ error: 'Key not found or already revoked.', code: 'KEY_NOT_FOUND' });
    });
    // PUT /v1/keys/:id/rotate — atomically revoke + issue a new key
    app.put('/v1/keys/:id/rotate', async (req, reply) => {
        const { id } = req.params;
        const newKey = await (0, apiKey_model_1.rotateApiKey)(id, req.user.id);
        if (!newKey) {
            return reply.status(404).send({ error: 'Key not found.', code: 'KEY_NOT_FOUND' });
        }
        return reply.send({
            key: {
                id: newKey.id,
                name: newKey.name,
                key: newKey.plaintext,
                prefix: newKey.key_prefix,
                createdAt: newKey.created_at,
            },
            warning: 'Save this key now — it will never be shown again.',
        });
    });
}
//# sourceMappingURL=key.routes.js.map