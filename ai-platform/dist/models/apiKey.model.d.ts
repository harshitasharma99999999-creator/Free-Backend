export interface ApiKey {
    id: string;
    user_id: string;
    name: string;
    key_prefix: string;
    key_hash: string;
    is_active: boolean;
    created_at: Date;
    last_used_at: Date | null;
}
export interface ApiKeyWithPlaintext extends ApiKey {
    plaintext: string;
}
export declare function generateKey(): string;
export declare function hashKey(key: string): string;
export declare function createApiKey(userId: string, name: string): Promise<ApiKeyWithPlaintext>;
export declare function getKeysByUser(userId: string): Promise<ApiKey[]>;
export declare function validateApiKey(rawKey: string): Promise<ApiKey | null>;
export declare function revokeApiKey(id: string, userId: string): Promise<boolean>;
export declare function rotateApiKey(id: string, userId: string): Promise<ApiKeyWithPlaintext | null>;
export declare function countActiveKeys(userId: string): Promise<number>;
