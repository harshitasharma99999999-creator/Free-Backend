export interface ContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
}
export interface ToolFunction {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
}
export interface Tool {
    type: 'function';
    function: ToolFunction;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export type ToolChoice = 'none' | 'auto' | 'required' | {
    type: 'function';
    function: {
        name: string;
    };
};
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | ContentPart[] | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}
export interface ChatOptions {
    model?: string;
    tools?: Tool[];
    tool_choice?: ToolChoice;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
}
export interface ChatResult {
    content: string | null;
    model: string;
    promptTokens: number;
    completionTokens: number;
    finishReason: string;
    provider: 'ollama' | 'groq';
    tool_calls?: ToolCall[];
}
export interface EmbeddingResult {
    embeddings: number[][];
    model: string;
    promptTokens: number;
}
export declare function chatCompletion(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
export declare function createEmbedding(input: string | string[], model?: string): Promise<EmbeddingResult>;
export declare function transcribeAudio(audioBuffer: Buffer, filename: string, mimeType: string, language?: string, prompt?: string): Promise<{
    text: string;
    language?: string;
    duration?: number;
}>;
export declare function translateAudio(audioBuffer: Buffer, filename: string, mimeType: string, prompt?: string): Promise<{
    text: string;
}>;
export declare function textToSpeech(text: string, voice?: string, speed?: number): Promise<Buffer>;
interface ModerationCategories {
    hate: boolean;
    'hate/threatening': boolean;
    harassment: boolean;
    'harassment/threatening': boolean;
    'self-harm': boolean;
    'self-harm/intent': boolean;
    'self-harm/instructions': boolean;
    sexual: boolean;
    'sexual/minors': boolean;
    violence: boolean;
    'violence/graphic': boolean;
}
interface ModerationResult {
    flagged: boolean;
    categories: ModerationCategories;
    category_scores: Record<keyof ModerationCategories, number>;
}
export declare function moderateText(input: string | string[]): ModerationResult[];
export declare const textModels: () => {
    id: string;
    name: string;
    type: string;
    provider: string;
}[];
export {};
