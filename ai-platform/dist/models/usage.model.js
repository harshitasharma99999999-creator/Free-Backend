"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUsage = logUsage;
exports.getUserSummary = getUserSummary;
exports.getRecentUsage = getRecentUsage;
const postgres_1 = require("../db/postgres");
async function logUsage(input) {
    await (0, postgres_1.query)(`INSERT INTO usage_logs
       (user_id, api_key_id, endpoint, model,
        prompt_tokens, completion_tokens, images_count, videos_count,
        response_time_ms, status_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
        input.userId, input.apiKeyId, input.endpoint, input.model ?? null,
        input.promptTokens ?? 0, input.completionTokens ?? 0,
        input.imagesCount ?? 0, input.videosCount ?? 0,
        input.responseTimeMs ?? null, input.statusCode ?? null,
    ]);
}
async function getUserSummary(userId) {
    const row = await (0, postgres_1.queryOne)(`SELECT
       COUNT(*)::text          AS total_requests,
       SUM(prompt_tokens)      AS total_prompt_tokens,
       SUM(completion_tokens)  AS total_completion_tokens,
       SUM(images_count)       AS total_images,
       SUM(videos_count)       AS total_videos,
       MAX(created_at)         AS last_used
     FROM usage_logs WHERE user_id = $1`, [userId]);
    return {
        total_requests: parseInt(row?.total_requests ?? '0', 10),
        total_prompt_tokens: parseInt(String(row?.total_prompt_tokens ?? '0'), 10),
        total_completion_tokens: parseInt(String(row?.total_completion_tokens ?? '0'), 10),
        total_images: parseInt(String(row?.total_images ?? '0'), 10),
        total_videos: parseInt(String(row?.total_videos ?? '0'), 10),
        last_used: row?.last_used ?? null,
    };
}
function getRecentUsage(userId, limit = 50) {
    return (0, postgres_1.query)('SELECT * FROM usage_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
}
//# sourceMappingURL=usage.model.js.map