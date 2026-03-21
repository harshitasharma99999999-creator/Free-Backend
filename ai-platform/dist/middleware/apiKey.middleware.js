"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyApiKey = verifyApiKey;
const apiKey_model_1 = require("../models/apiKey.model");
const user_model_1 = require("../models/user.model");
const oaiError = (message, type = 'authentication_error', code = null) => ({
    error: { message, type, param: null, code },
});
async function verifyApiKey(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return void reply.status(401).send(oaiError('No API key provided. Include `Authorization: Bearer sk-...` header.', 'authentication_error', 'missing_api_key'));
    }
    const rawKey = auth.slice(7);
    if (!rawKey.startsWith('sk-')) {
        return void reply.status(401).send(oaiError('Invalid API key format. Keys must begin with sk-.', 'authentication_error', 'invalid_api_key'));
    }
    const key = await (0, apiKey_model_1.validateApiKey)(rawKey);
    if (!key) {
        return void reply.status(401).send(oaiError('Incorrect API key provided. You can find your API keys in the dashboard.', 'authentication_error', 'invalid_api_key'));
    }
    const user = await (0, user_model_1.getUserById)(key.user_id);
    if (!user) {
        return void reply.status(401).send(oaiError('User account not found.', 'authentication_error', 'user_not_found'));
    }
    request.apiKey = { id: key.id, userId: user.id, name: key.name };
    request.user = { id: user.id, firebaseUid: user.firebase_uid, email: user.email, plan: user.plan };
}
//# sourceMappingURL=apiKey.middleware.js.map