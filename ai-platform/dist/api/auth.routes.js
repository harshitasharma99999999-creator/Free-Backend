"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const firebaseAuth_middleware_1 = require("../middleware/firebaseAuth.middleware");
const usage_model_1 = require("../models/usage.model");
const apiKey_model_1 = require("../models/apiKey.model");
async function authRoutes(app) {
    // POST /auth/sync
    // Firebase ID token → upsert user in PostgreSQL → return user record
    app.post('/auth/sync', { preHandler: firebaseAuth_middleware_1.verifyFirebaseToken }, async (req, reply) => {
        return reply.send({ user: req.user });
    });
    // GET /auth/me
    // Firebase ID token → user + usage stats
    app.get('/auth/me', { preHandler: firebaseAuth_middleware_1.verifyFirebaseToken }, async (req, reply) => {
        const userId = req.user.id;
        const [usage, activeKeys] = await Promise.all([
            (0, usage_model_1.getUserSummary)(userId),
            (0, apiKey_model_1.countActiveKeys)(userId),
        ]);
        return reply.send({ user: req.user, usage, activeKeys });
    });
    // GET /auth/usage
    // Returns the last 50 usage log entries for the authenticated user
    app.get('/auth/usage', { preHandler: firebaseAuth_middleware_1.verifyFirebaseToken }, async (req, reply) => {
        const logs = await (0, usage_model_1.getRecentUsage)(req.user.id, 50);
        return reply.send({ logs });
    });
}
//# sourceMappingURL=auth.routes.js.map