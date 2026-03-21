import { query, queryOne } from '../db/postgres';

export interface UsageLog {
  id: string;
  user_id: string;
  api_key_id: string;
  endpoint: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  images_count: number;
  videos_count: number;
  response_time_ms: number | null;
  status_code: number | null;
  created_at: Date;
}

export interface UsageInput {
  userId: string;
  apiKeyId: string;
  endpoint: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  imagesCount?: number;
  videosCount?: number;
  responseTimeMs?: number;
  statusCode?: number;
}

export async function logUsage(input: UsageInput): Promise<void> {
  await query(
    `INSERT INTO usage_logs
       (user_id, api_key_id, endpoint, model,
        prompt_tokens, completion_tokens, images_count, videos_count,
        response_time_ms, status_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      input.userId, input.apiKeyId, input.endpoint, input.model ?? null,
      input.promptTokens ?? 0, input.completionTokens ?? 0,
      input.imagesCount ?? 0,  input.videosCount ?? 0,
      input.responseTimeMs ?? null, input.statusCode ?? null,
    ]
  );
}

export interface UsageSummary {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_images: number;
  total_videos: number;
  last_used: Date | null;
}

export async function getUserSummary(userId: string): Promise<UsageSummary> {
  const row = await queryOne<{
    total_requests: string;
    total_prompt_tokens: string;
    total_completion_tokens: string;
    total_images: string;
    total_videos: string;
    last_used: Date | null;
  }>(
    `SELECT
       COUNT(*)::text          AS total_requests,
       SUM(prompt_tokens)      AS total_prompt_tokens,
       SUM(completion_tokens)  AS total_completion_tokens,
       SUM(images_count)       AS total_images,
       SUM(videos_count)       AS total_videos,
       MAX(created_at)         AS last_used
     FROM usage_logs WHERE user_id = $1`,
    [userId]
  );

  return {
    total_requests:         parseInt(row?.total_requests ?? '0', 10),
    total_prompt_tokens:    parseInt(String(row?.total_prompt_tokens ?? '0'), 10),
    total_completion_tokens:parseInt(String(row?.total_completion_tokens ?? '0'), 10),
    total_images:           parseInt(String(row?.total_images ?? '0'), 10),
    total_videos:           parseInt(String(row?.total_videos ?? '0'), 10),
    last_used: row?.last_used ?? null,
  };
}

export function getRecentUsage(userId: string, limit = 50): Promise<UsageLog[]> {
  return query<UsageLog>(
    'SELECT * FROM usage_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
}
