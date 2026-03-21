"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseToken = verifyFirebaseToken;
const admin = __importStar(require("firebase-admin"));
const user_model_1 = require("../models/user.model");
const logger_1 = require("../utils/logger");
const oaiError = (message, type = 'invalid_request_error', code = null) => ({
    error: { message, type, param: null, code },
});
async function verifyFirebaseToken(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return void reply.status(401).send(oaiError('Missing Authorization: Bearer <firebase-id-token> header', 'authentication_error', 'missing_auth'));
    }
    try {
        const decoded = await admin.auth().verifyIdToken(auth.slice(7));
        const user = await (0, user_model_1.upsertUser)(decoded.uid, decoded.email ?? '');
        request.user = {
            id: user.id,
            firebaseUid: user.firebase_uid,
            email: user.email,
            plan: user.plan,
        };
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Firebase token verification failed');
        return void reply.status(401).send(oaiError('Invalid or expired Firebase ID token', 'authentication_error', 'invalid_token'));
    }
}
//# sourceMappingURL=firebaseAuth.middleware.js.map