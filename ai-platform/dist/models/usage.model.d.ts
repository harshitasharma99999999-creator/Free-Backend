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
export declare function logUsage(input: UsageInput): Promise<void>;
export interface UsageSummary {
    total_requests: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_images: number;
    total_videos: number;
    last_used: Date | null;
}
export declare function getUserSummary(userId: string): Promise<UsageSummary>;
export declare function getRecentUsage(userId: string, limit?: number): Promise<UsageLog[]>;
