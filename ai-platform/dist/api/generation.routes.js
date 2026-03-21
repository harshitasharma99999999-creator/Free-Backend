"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generationRoutes = generationRoutes;
const zod_1 = require("zod");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const usage_model_1 = require("../models/usage.model");
const llm_service_1 = require("../services/llm.service");
const image_service_1 = require("../services/image.service");
const video_service_1 = require("../services/video.service");
const logger_1 = require("../utils/logger");
// ── OpenAI error envelope ──────────────────────────────────────────────────────
const oaiError = (message, type = 'invalid_request_error', code = null, param = null) => ({ error: { message, type, param, code } });
// ── Schemas ───────────────────────────────────────────────────────────────────
const contentPartSchema = zod_1.z.union([
    zod_1.z.object({ type: zod_1.z.literal('text'), text: zod_1.z.string().min(1).max(32_000) }),
    zod_1.z.object({
        type: zod_1.z.literal('image_url'),
        image_url: zod_1.z.object({
            url: zod_1.z.string().min(1),
            detail: zod_1.z.enum(['auto', 'low', 'high']).optional(),
        }),
    }),
]);
const toolFunctionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(64),
    description: zod_1.z.string().max(1024).optional(),
    parameters: zod_1.z.record(zod_1.z.unknown()).optional(),
    strict: zod_1.z.boolean().optional(),
});
const toolSchema = zod_1.z.object({
    type: zod_1.z.literal('function'),
    function: toolFunctionSchema,
});
const toolChoiceSchema = zod_1.z.union([
    zod_1.z.enum(['none', 'auto', 'required']),
    zod_1.z.object({
        type: zod_1.z.literal('function'),
        function: zod_1.z.object({ name: zod_1.z.string() }),
    }),
]);
const messageContentSchema = zod_1.z.union([
    zod_1.z.string().min(1).max(32_000),
    zod_1.z.array(contentPartSchema).min(1).max(20),
]);
const chatMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['system', 'user', 'assistant', 'tool']),
    content: messageContentSchema.nullable().optional(),
    tool_calls: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        type: zod_1.z.literal('function'),
        function: zod_1.z.object({ name: zod_1.z.string(), arguments: zod_1.z.string() }),
    })).optional(),
    tool_call_id: zod_1.z.string().optional(),
    name: zod_1.z.string().optional(),
});
const chatSchema = zod_1.z.object({
    model: zod_1.z.string().optional(),
    messages: zod_1.z.array(chatMessageSchema).min(1).max(200),
    stream: zod_1.z.boolean().optional().default(false),
    tools: zod_1.z.array(toolSchema).max(128).optional(),
    tool_choice: toolChoiceSchema.optional(),
    max_tokens: zod_1.z.number().int().min(1).max(32_000).optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    top_p: zod_1.z.number().min(0).max(1).optional(),
    n: zod_1.z.number().int().min(1).max(1).optional(), // we support n=1 only
    stop: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    frequency_penalty: zod_1.z.number().min(-2).max(2).optional(),
    presence_penalty: zod_1.z.number().min(-2).max(2).optional(),
    logprobs: zod_1.z.boolean().optional(),
    user: zod_1.z.string().optional(),
});
const imageSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1).max(2_000),
    negative_prompt: zod_1.z.string().max(500).optional(),
    n: zod_1.z.number().int().min(1).max(4).default(1),
    size: zod_1.z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).default('1024x1024'),
    quality: zod_1.z.enum(['standard', 'hd']).optional(),
    style: zod_1.z.enum(['natural', 'vivid']).optional(),
    response_format: zod_1.z.enum(['url', 'b64_json']).optional().default('url'),
});
const videoSchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1).max(2_000),
    duration: zod_1.z.number().min(1).max(10).default(5),
});
const embeddingSchema = zod_1.z.object({
    input: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.array(zod_1.z.string().min(1)).min(1).max(2048)]),
    model: zod_1.z.string().optional().default('eior-embed'),
    encoding_format: zod_1.z.enum(['float', 'base64']).optional().default('float'),
    dimensions: zod_1.z.number().int().min(1).optional(),
    user: zod_1.z.string().optional(),
});
const moderationSchema = zod_1.z.object({
    input: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.array(zod_1.z.string().min(1))]),
    model: zod_1.z.string().optional().default('eior-moderation'),
});
const clean = (s) => s.replace(/\0/g, '').trim();
function fireLog(input) {
    (0, usage_model_1.logUsage)(input).catch(err => logger_1.logger.error({ err }, 'Failed to write usage log'));
}
// ── Routes ────────────────────────────────────────────────────────────────────
async function generationRoutes(app) {
    app.addHook('preHandler', apiKey_middleware_1.verifyApiKey);
    app.addHook('preHandler', rateLimit_middleware_1.rateLimitByKey);
    // ── POST /v1/chat/completions ─────────────────────────────────────────────
    app.post('/v1/chat/completions', async (req, reply) => {
        const parsed = chatSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send(oaiError(parsed.error.issues[0].message, 'invalid_request_error', 'invalid_parameter', String(parsed.error.issues[0].path[0] ?? null)));
        }
        const { messages, model, stream, tools, tool_choice, max_tokens, temperature, top_p } = parsed.data;
        // Sanitize text content; pass array content (vision) through as-is
        const sanitized = messages.map(m => ({
            ...m,
            content: typeof m.content === 'string' ? clean(m.content)
                : m.content ?? null,
        }));
        const start = Date.now();
        try {
            const result = await (0, llm_service_1.chatCompletion)(sanitized, {
                model,
                tools: tools,
                tool_choice: tool_choice,
                max_tokens, temperature, top_p,
            });
            fireLog({
                userId: req.user.id, apiKeyId: req.apiKey.id,
                endpoint: '/v1/chat/completions', model: result.model,
                promptTokens: result.promptTokens, completionTokens: result.completionTokens,
                responseTimeMs: Date.now() - start, statusCode: 200,
            });
            const id = `chatcmpl-${Date.now()}`;
            const created = Math.floor(Date.now() / 1000);
            // ── SSE streaming ───────────────────────────────────────────────────
            if (stream) {
                reply.raw.setHeader('Content-Type', 'text/event-stream');
                reply.raw.setHeader('Cache-Control', 'no-cache');
                reply.raw.setHeader('Connection', 'keep-alive');
                reply.raw.setHeader('Transfer-Encoding', 'chunked');
                reply.raw.removeHeader('Content-Length');
                const send = (obj) => reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);
                // Tool calls chunk (if any)
                if (result.tool_calls?.length) {
                    send({
                        id, object: 'chat.completion.chunk', created, model: result.model,
                        choices: [{ index: 0, delta: { role: 'assistant', tool_calls: result.tool_calls }, finish_reason: null }],
                    });
                    send({
                        id, object: 'chat.completion.chunk', created, model: result.model,
                        choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
                    });
                }
                else {
                    // Role delta
                    send({ id, object: 'chat.completion.chunk', created, model: result.model,
                        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
                    // Content chunks
                    const words = (result.content ?? '').split(' ');
                    for (let i = 0; i < words.length; i += 5) {
                        const text = words.slice(i, i + 5).join(' ') + (i + 5 < words.length ? ' ' : '');
                        send({ id, object: 'chat.completion.chunk', created, model: result.model,
                            choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
                    }
                    // Done chunk
                    send({ id, object: 'chat.completion.chunk', created, model: result.model,
                        choices: [{ index: 0, delta: {}, finish_reason: result.finishReason }],
                        usage: { prompt_tokens: result.promptTokens, completion_tokens: result.completionTokens,
                            total_tokens: result.promptTokens + result.completionTokens } });
                }
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
                return reply;
            }
            // ── Standard JSON response ────────────────────────────────────────────
            const message = { role: 'assistant', content: result.content };
            if (result.tool_calls?.length)
                message.tool_calls = result.tool_calls;
            return reply.send({
                id, object: 'chat.completion', created, model: result.model,
                choices: [{ index: 0, message, finish_reason: result.finishReason }],
                usage: {
                    prompt_tokens: result.promptTokens,
                    completion_tokens: result.completionTokens,
                    total_tokens: result.promptTokens + result.completionTokens,
                },
            });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Chat completion failed');
            return reply.status(502).send(oaiError('The AI service is currently unavailable. Please try again later.', 'api_error', 'service_unavailable'));
        }
    });
    // ── POST /v1/embeddings ───────────────────────────────────────────────────
    app.post('/v1/embeddings', async (req, reply) => {
        const parsed = embeddingSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send(oaiError(parsed.error.issues[0].message));
        }
        const { input, model, encoding_format } = parsed.data;
        const start = Date.now();
        try {
            const result = await (0, llm_service_1.createEmbedding)(input, model);
            fireLog({
                userId: req.user.id, apiKeyId: req.apiKey.id,
                endpoint: '/v1/embeddings', model: result.model,
                promptTokens: result.promptTokens,
                responseTimeMs: Date.now() - start, statusCode: 200,
            });
            const embedData = result.embeddings.map((emb, i) => ({
                object: 'embedding',
                index: i,
                embedding: encoding_format === 'base64'
                    ? Buffer.from(new Float32Array(emb).buffer).toString('base64')
                    : emb,
            }));
            return reply.send({
                object: 'list',
                model: result.model,
                data: embedData,
                usage: {
                    prompt_tokens: result.promptTokens,
                    total_tokens: result.promptTokens,
                },
            });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Embedding failed');
            return reply.status(502).send(oaiError('Embedding service unavailable. Ensure Ollama is running or GROQ_API_KEY is set.', 'api_error', 'service_unavailable'));
        }
    });
    // ── POST /v1/moderations ─────────────────────────────────────────────────
    app.post('/v1/moderations', async (req, reply) => {
        const parsed = moderationSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send(oaiError(parsed.error.issues[0].message));
        }
        const { input, model } = parsed.data;
        const results = (0, llm_service_1.moderateText)(input);
        return reply.send({
            id: `modr-${Date.now()}`,
            model,
            results,
        });
    });
    // ── POST /v1/images/generations ───────────────────────────────────────────
    app.post('/v1/images/generations', async (req, reply) => {
        const parsed = imageSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send(oaiError(parsed.error.issues[0].message));
        }
        const { prompt, negative_prompt, n, size } = parsed.data;
        const [width, height] = size.split('x').map(Number);
        const start = Date.now();
        try {
            const result = await (0, image_service_1.generateImage)({ prompt: clean(prompt), negativePrompt: negative_prompt, width, height, n });
            fireLog({
                userId: req.user.id, apiKeyId: req.apiKey.id,
                endpoint: '/v1/images/generations', model: result.model,
                imagesCount: n, responseTimeMs: Date.now() - start, statusCode: 200,
            });
            return reply.send({
                created: Math.floor(Date.now() / 1000),
                data: result.images.map(url => ({ url })),
            });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Image generation failed');
            return reply.status(502).send(oaiError('Image generation failed. Ensure Automatic1111 or REPLICATE_API_TOKEN is configured.', 'api_error', 'service_unavailable'));
        }
    });
    // ── POST /v1/video/generate ───────────────────────────────────────────────
    app.post('/v1/video/generate', async (req, reply) => {
        const parsed = videoSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send(oaiError(parsed.error.issues[0].message));
        }
        const { prompt, duration } = parsed.data;
        const start = Date.now();
        try {
            const result = await (0, video_service_1.generateVideo)({ prompt: clean(prompt), duration });
            fireLog({
                userId: req.user.id, apiKeyId: req.apiKey.id,
                endpoint: '/v1/video/generate', model: result.model,
                videosCount: 1, responseTimeMs: Date.now() - start, statusCode: 200,
            });
            return reply.send({
                video_url: result.videoUrl,
                prompt: clean(prompt),
                status: result.status,
                model: result.model,
            });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Video generation failed');
            return reply.status(502).send(oaiError('Video generation failed. Ensure REPLICATE_API_TOKEN is configured.', 'api_error', 'service_unavailable'));
        }
    });
    // Rich model metadata — for OpenAI-compatible clients (LM Studio, LiteLLM, etc.)
    const MODEL_META = {
        'eior-chat': {
            description: 'Eior general-purpose chat model. Fast, helpful, and accurate for everyday tasks.',
            context_window: 32768,
            max_output: 8192,
            capabilities: ['chat', 'function_calling', 'streaming'],
            pricing: { prompt: 0, completion: 0 },
        },
        'eior-fast': {
            description: 'Eior lightweight model optimised for speed. Best for simple Q&A and short completions.',
            context_window: 8192,
            max_output: 4096,
            capabilities: ['chat', 'streaming'],
            pricing: { prompt: 0, completion: 0 },
        },
        'eior-code': {
            description: 'Eior code-specialised model. Expert at writing, reviewing, and debugging code in any language.',
            context_window: 32768,
            max_output: 8192,
            capabilities: ['chat', 'function_calling', 'streaming', 'code'],
            pricing: { prompt: 0, completion: 0 },
        },
        'eior-vision': {
            description: 'Eior multimodal vision model. Understands and reasons about images alongside text.',
            context_window: 32768,
            max_output: 8192,
            capabilities: ['chat', 'vision', 'streaming'],
            modalities: ['text', 'image'],
            pricing: { prompt: 0, completion: 0 },
        },
    };
    // ── GET /v1/models ────────────────────────────────────────────────────────
    app.get('/v1/models', async (_req, reply) => {
        const now = Math.floor(Date.now() / 1000);
        const models = [...(0, llm_service_1.textModels)(), ...(0, image_service_1.imageModels)(), ...(0, video_service_1.videoModels)()];
        return reply.send({
            object: 'list',
            data: models.map(m => ({
                id: m.id,
                object: 'model',
                created: now,
                owned_by: 'eior',
                root: m.id,
                parent: null,
                ...(MODEL_META[m.id] ?? {}),
            })),
        });
    });
    // ── GET /v1/models/:model ─────────────────────────────────────────────────
    app.get('/v1/models/:model', async (req, reply) => {
        const { model } = req.params;
        const all = [...(0, llm_service_1.textModels)(), ...(0, image_service_1.imageModels)(), ...(0, video_service_1.videoModels)()];
        const found = all.find(m => m.id === model);
        if (!found) {
            return reply.status(404).send(oaiError(`The model '${model}' does not exist`, 'invalid_request_error', 'model_not_found'));
        }
        return reply.send({
            id: found.id,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'eior',
            root: found.id,
            parent: null,
            ...(MODEL_META[found.id] ?? {}),
        });
    });
}
//# sourceMappingURL=generation.routes.js.map