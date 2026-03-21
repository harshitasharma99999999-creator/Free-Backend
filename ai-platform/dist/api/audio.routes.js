"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioRoutes = audioRoutes;
const zod_1 = require("zod");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const llm_service_1 = require("../services/llm.service");
const logger_1 = require("../utils/logger");
const oaiError = (message, type = 'invalid_request_error', code = null) => ({ error: { message, type, param: null, code } });
const speechSchema = zod_1.z.object({
    model: zod_1.z.string().optional().default('eior-tts'),
    input: zod_1.z.string().min(1).max(4096),
    voice: zod_1.z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('alloy'),
    response_format: zod_1.z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).optional().default('mp3'),
    speed: zod_1.z.number().min(0.25).max(4.0).optional().default(1.0),
});
// ── Parse multipart body into fields + file buffer ────────────────────────────
async function parseMultipart(req) {
    const contentType = req.headers['content-type'] ?? '';
    if (contentType.includes('multipart/form-data')) {
        // Use Fastify's built-in multipart support via raw stream
        // We use the @fastify/multipart plugin if registered, otherwise fall back to manual parsing
        try {
            const mp = req;
            const fields = {};
            let fileResult;
            for await (const part of mp.parts()) {
                if (part.type === 'file') {
                    const buffer = await part.toBuffer();
                    fileResult = {
                        buffer,
                        filename: part.filename ?? 'audio.mp3',
                        mimetype: part.mimetype ?? 'audio/mpeg',
                    };
                }
                else {
                    fields[part.fieldname] = part.value ?? '';
                }
            }
            return { file: fileResult, fields };
        }
        catch {
            throw new Error('Failed to parse multipart form data. Ensure @fastify/multipart is registered.');
        }
    }
    // JSON body with base64-encoded audio
    const body = req.body;
    const fields = {};
    for (const [k, v] of Object.entries(body ?? {})) {
        if (typeof v === 'string' && k !== 'file')
            fields[k] = v;
    }
    const fileData = body?.file;
    if (fileData) {
        const base64 = fileData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const filename = body?.filename ?? 'audio.mp3';
        const mimetype = body?.mimetype ?? 'audio/mpeg';
        return { file: { buffer, filename, mimetype }, fields };
    }
    return { fields };
}
// ── Routes ────────────────────────────────────────────────────────────────────
async function audioRoutes(app) {
    app.addHook('preHandler', apiKey_middleware_1.verifyApiKey);
    app.addHook('preHandler', rateLimit_middleware_1.rateLimitByKey);
    // ── POST /v1/audio/speech ─────────────────────────────────────────────────
    app.post('/v1/audio/speech', async (req, reply) => {
        const parsed = speechSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send(oaiError(parsed.error.issues[0].message));
        }
        const { input, voice, speed, response_format } = parsed.data;
        try {
            const audio = await (0, llm_service_1.textToSpeech)(input, voice, speed);
            const mimeTypes = {
                mp3: 'audio/mpeg',
                opus: 'audio/ogg',
                aac: 'audio/aac',
                flac: 'audio/flac',
                wav: 'audio/wav',
                pcm: 'audio/pcm',
            };
            reply.raw.setHeader('Content-Type', mimeTypes[response_format] ?? 'audio/mpeg');
            reply.raw.setHeader('Content-Disposition', `attachment; filename="speech.${response_format}"`);
            reply.raw.setHeader('Content-Length', audio.length.toString());
            reply.raw.end(audio);
            return reply;
        }
        catch (err) {
            logger_1.logger.error({ err }, 'TTS failed');
            return reply.status(502).send(oaiError('Text-to-speech service unavailable. Please try again later.', 'api_error', 'service_unavailable'));
        }
    });
    // ── POST /v1/audio/transcriptions ─────────────────────────────────────────
    // Accepts multipart/form-data with 'file' field OR JSON with base64 'file'
    app.post('/v1/audio/transcriptions', {
        config: { rawBody: true },
    }, async (req, reply) => {
        try {
            const { file, fields } = await parseMultipart(req);
            if (!file) {
                return reply.status(400).send(oaiError("Missing 'file' in request body"));
            }
            const language = fields.language;
            const prompt = fields.prompt;
            const responseFormat = fields.response_format ?? 'json';
            const result = await (0, llm_service_1.transcribeAudio)(file.buffer, file.filename, file.mimetype, language, prompt);
            if (responseFormat === 'text') {
                reply.raw.setHeader('Content-Type', 'text/plain');
                reply.raw.end(result.text);
                return reply;
            }
            if (responseFormat === 'verbose_json') {
                return reply.send({
                    task: 'transcribe',
                    language: result.language ?? 'en',
                    duration: result.duration ?? 0,
                    text: result.text,
                    segments: [],
                    words: [],
                });
            }
            // Default: json
            return reply.send({ text: result.text });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Audio transcription failed');
            return reply.status(502).send(oaiError('Audio transcription failed. Ensure GROQ_API_KEY is set.', 'api_error', 'service_unavailable'));
        }
    });
    // ── POST /v1/audio/translations ───────────────────────────────────────────
    // Translates audio in any language to English text
    app.post('/v1/audio/translations', {
        config: { rawBody: true },
    }, async (req, reply) => {
        try {
            const { file, fields } = await parseMultipart(req);
            if (!file) {
                return reply.status(400).send(oaiError("Missing 'file' in request body"));
            }
            const prompt = fields.prompt;
            const responseFormat = fields.response_format ?? 'json';
            const result = await (0, llm_service_1.translateAudio)(file.buffer, file.filename, file.mimetype, prompt);
            if (responseFormat === 'text') {
                reply.raw.setHeader('Content-Type', 'text/plain');
                reply.raw.end(result.text);
                return reply;
            }
            return reply.send({ text: result.text });
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Audio translation failed');
            return reply.status(502).send(oaiError('Audio translation failed. Ensure GROQ_API_KEY is set.', 'api_error', 'service_unavailable'));
        }
    });
}
//# sourceMappingURL=audio.routes.js.map