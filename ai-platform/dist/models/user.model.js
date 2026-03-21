"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertUser = upsertUser;
exports.getUserByFirebaseUid = getUserByFirebaseUid;
exports.getUserById = getUserById;
const postgres_1 = require("../db/postgres");
async function upsertUser(firebaseUid, email) {
    const [user] = await (0, postgres_1.query)(`INSERT INTO users (firebase_uid, email)
     VALUES ($1, $2)
     ON CONFLICT (firebase_uid)
     DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
     RETURNING *`, [firebaseUid, email]);
    return user;
}
function getUserByFirebaseUid(uid) {
    return (0, postgres_1.queryOne)('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
}
function getUserById(id) {
    return (0, postgres_1.queryOne)('SELECT * FROM users WHERE id = $1', [id]);
}
//# sourceMappingURL=user.model.js.map