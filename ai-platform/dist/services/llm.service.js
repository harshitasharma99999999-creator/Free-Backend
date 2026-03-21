"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textModels = void 0;
exports.chatCompletion = chatCompletion;
exports.createEmbedding = createEmbedding;
exports.transcribeAudio = transcribeAudio;
exports.translateAudio = translateAudio;
exports.textToSpeech = textToSpeech;
exports.moderateText = moderateText;
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
// ── Eior model aliases → Ollama model IDs (primary) ───────────────────────────
const MODEL_ALIASES = {
    'eior-chat': { ollama: 'llama3.1:8b', groq: 'moonshotai/kimi-k2-instruct-0905' },
    'eior-fast': { ollama: 'phi3:mini', groq: 'llama-3.1-8b-instant' },
    'eior-vision': { ollama: 'llava:7b', groq: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    'eior-code': { ollama: 'qwen2.5-coder:7b', groq: 'moonshotai/kimi-k2-instruct-0905' },
    'eior-embed': { ollama: 'nomic-embed-text', groq: 'nomic-embed-text-v1.5' },
    'eior': { ollama: 'llama3.1:8b', groq: 'moonshotai/kimi-k2-instruct-0905' },
};
const DEFAULT_ALIAS = 'eior-chat';
function resolveAlias(requested, hasImages) {
    if (hasImages)
        return 'eior-vision';
    return requested in MODEL_ALIASES ? requested : DEFAULT_ALIAS;
}
function resolveOllamaModel(alias) {
    return MODEL_ALIASES[alias]?.ollama ?? MODEL_ALIASES[DEFAULT_ALIAS].ollama;
}
function resolveGroqModel(alias) {
    return MODEL_ALIASES[alias]?.groq ?? MODEL_ALIASES[DEFAULT_ALIAS].groq;
}
function detectImages(messages) {
    return messages.some(m => Array.isArray(m.content) &&
        m.content.some(p => p.type === 'image_url'));
}
function estTokens(messages) {
    return messages.reduce((acc, m) => {
        const text = typeof m.content === 'string'
            ? m.content ?? ''
            : Array.isArray(m.content)
                ? m.content.map(p => p.text ?? '').join(' ')
                : '';
        return acc + Math.ceil(text.length / 4);
    }, 0);
}
// ── Ollama (primary — self-hosted) ────────────────────────────────────────────
async function callOllama(messages, ollamaModel, opts = {}) {
    // Flatten array content for Ollama text format; pass images via Ollama image field
    const ollamaMessages = messages.map(m => {
        if (typeof m.content === 'string' || m.content === null) {
            const msg = { role: m.role, content: m.content ?? '' };
            if (m.tool_calls)
                msg.tool_calls = m.tool_calls;
            if (m.tool_call_id)
                msg.tool_call_id = m.tool_call_id;
            return msg;
        }
        const parts = m.content;
        const textParts = parts.filter(p => p.type === 'text').map(p => p.text).join('\n');
        const images = parts.filter(p => p.type === 'image_url').map(p => {
            const url = p.image_url.url;
            // Ollama expects base64 without data URI prefix for local images
            return url.startsWith('data:') ? url.split(',')[1] : url;
        });
        const msg = { role: m.role, content: textParts };
        if (images.length)
            msg.images = images;
        return msg;
    });
    const body = {
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
            ...(opts.temperature !== undefined && { temperature: opts.temperature }),
            ...(opts.top_p !== undefined && { top_p: opts.top_p }),
            ...(opts.max_tokens !== undefined && { num_predict: opts.max_tokens }),
        },
    };
    if (opts.tools?.length)
        body.tools = opts.tools;
    const res = await fetch(`${config_1.config.OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok)
        throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
        content: data.message.content || null,
        tool_calls: data.message.tool_calls,
        model: ollamaModel,
        promptTokens: data.prompt_eval_count ?? estTokens(messages),
        completionTokens: data.eval_count ?? Math.ceil((data.message.content?.length ?? 0) / 4),
        finishReason: data.done_reason === 'tool_calls' ? 'tool_calls' : 'stop',
        provider: 'ollama',
    };
}
// ── Groq (emergency fallback + tool calling) ──────────────────────────────────
async function callGroq(messages, groqModel, opts = {}) {
    if (!config_1.config.GROQ_API_KEY)
        throw new Error('GROQ_API_KEY not configured — Ollama is required');
    const body = { model: groqModel, messages };
    if (opts.tools?.length)
        body.tools = opts.tools;
    if (opts.tool_choice !== undefined)
        body.tool_choice = opts.tool_choice;
    if (opts.max_tokens !== undefined)
        body.max_tokens = opts.max_tokens;
    if (opts.temperature !== undefined)
        body.temperature = opts.temperature;
    if (opts.top_p !== undefined)
        body.top_p = opts.top_p;
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config_1.config.GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok)
        throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const choice = data.choices[0];
    return {
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
        model: data.model,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        finishReason: choice.finish_reason,
        provider: 'groq',
    };
}
// ── Public chat API ───────────────────────────────────────────────────────────
async function chatCompletion(messages, opts = {}) {
    const { model, tools, tool_choice, max_tokens, temperature, top_p } = opts;
    const alias = resolveAlias(model ?? DEFAULT_ALIAS, detectImages(messages));
    const ollamaModel = resolveOllamaModel(alias);
    const groqModel = resolveGroqModel(alias);
    try {
        const result = await callOllama(messages, ollamaModel, { tools, max_tokens, temperature, top_p });
        return { ...result, model: alias };
    }
    catch (ollamaErr) {
        logger_1.logger.warn({ ollamaErr }, 'Ollama unavailable — emergency fallback to Groq');
        try {
            const result = await callGroq(messages, groqModel, { tools, tool_choice, max_tokens, temperature, top_p });
            return { ...result, model: alias };
        }
        catch (groqErr) {
            logger_1.logger.error({ groqErr }, 'Both Ollama and Groq failed');
            throw new Error('AI service temporarily unavailable. Please try again shortly.');
        }
    }
}
// ── Embeddings ────────────────────────────────────────────────────────────────
async function callOllamaEmbed(input, model) {
    // Ollama /api/embed (batch) - Ollama >= 0.3
    const res = await fetch(`${config_1.config.OLLAMA_BASE_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input }),
        signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok)
        throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
        embeddings: data.embeddings,
        model,
        promptTokens: data.prompt_eval_count ?? Math.ceil(input.join(' ').length / 4),
    };
}
async function callGroqEmbed(input, groqModel) {
    if (!config_1.config.GROQ_API_KEY)
        throw new Error('GROQ_API_KEY not configured');
    const res = await fetch('https://api.groq.com/openai/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config_1.config.GROQ_API_KEY}`,
        },
        body: JSON.stringify({ model: groqModel, input }),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
        throw new Error(`Groq embed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
        embeddings: data.data.sort((a, b) => a.index - b.index).map(d => d.embedding),
        model: data.model,
        promptTokens: data.usage.prompt_tokens,
    };
}
async function createEmbedding(input, model = 'eior-embed') {
    const inputs = Array.isArray(input) ? input : [input];
    const ollamaModel = resolveOllamaModel(model === 'eior-embed' ? 'eior-embed' : 'eior-embed');
    const groqModel = resolveGroqModel('eior-embed');
    try {
        return await callOllamaEmbed(inputs, ollamaModel);
    }
    catch (ollamaErr) {
        logger_1.logger.warn({ ollamaErr }, 'Ollama embed unavailable — fallback to Groq');
        return await callGroqEmbed(inputs, groqModel);
    }
}
// ── Audio transcription via Groq Whisper ──────────────────────────────────────
async function transcribeAudio(audioBuffer, filename, mimeType, language, prompt) {
    if (!config_1.config.GROQ_API_KEY)
        throw new Error('GROQ_API_KEY required for audio transcription');
    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    form.append('file', blob, filename);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    if (language)
        form.append('language', language);
    if (prompt)
        form.append('prompt', prompt);
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config_1.config.GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok)
        throw new Error(`Groq STT ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.text, language: data.language, duration: data.duration };
}
// ── Audio translation (any language → English) ────────────────────────────────
async function translateAudio(audioBuffer, filename, mimeType, prompt) {
    if (!config_1.config.GROQ_API_KEY)
        throw new Error('GROQ_API_KEY required for audio translation');
    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    form.append('file', blob, filename);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');
    if (prompt)
        form.append('prompt', prompt);
    const res = await fetch('https://api.groq.com/openai/v1/audio/translations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config_1.config.GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok)
        throw new Error(`Groq translate ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.text };
}
// ── Text-to-Speech via StreamElements (free) ──────────────────────────────────
// Voice mapping: OpenAI names → StreamElements voices
const TTS_VOICE_MAP = {
    alloy: 'Brian',
    echo: 'Matthew',
    fable: 'Brian',
    onyx: 'Joey',
    nova: 'Amy',
    shimmer: 'Emma',
};
async function textToSpeech(text, voice = 'alloy', speed = 1.0) {
    const seVoice = TTS_VOICE_MAP[voice] ?? 'Brian';
    const encoded = encodeURIComponent(text.slice(0, 3000));
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${seVoice}&text=${encoded}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok)
        throw new Error(`TTS ${res.status}: service unavailable`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
const HATE_WORDS = ['kill all', 'death to', 'genocide', 'exterminate'];
const SEXUAL_WORDS = ['explicit sexual', 'pornography', 'nude minors'];
const VIOLENCE_WORDS = ['bomb making', 'how to make a bomb', 'mass shooting'];
const SELFHARM_WORDS = ['how to commit suicide', 'ways to self harm'];
function scoreCategory(text, keywords) {
    const lower = text.toLowerCase();
    const hits = keywords.filter(kw => lower.includes(kw)).length;
    return Math.min(1.0, hits * 0.4);
}
function moderateText(input) {
    const inputs = Array.isArray(input) ? input : [input];
    return inputs.map(text => {
        const hateScore = scoreCategory(text, HATE_WORDS);
        const sexualScore = scoreCategory(text, SEXUAL_WORDS);
        const violenceScore = scoreCategory(text, VIOLENCE_WORDS);
        const selfHarmScore = scoreCategory(text, SELFHARM_WORDS);
        const categories = {
            hate: hateScore >= 0.4,
            'hate/threatening': hateScore >= 0.8,
            harassment: hateScore >= 0.4,
            'harassment/threatening': hateScore >= 0.8,
            'self-harm': selfHarmScore >= 0.4,
            'self-harm/intent': selfHarmScore >= 0.8,
            'self-harm/instructions': selfHarmScore >= 0.4,
            sexual: sexualScore >= 0.4,
            'sexual/minors': sexualScore >= 0.8,
            violence: violenceScore >= 0.4,
            'violence/graphic': violenceScore >= 0.8,
        };
        const flagged = Object.values(categories).some(Boolean);
        const category_scores = {
            hate: hateScore,
            'hate/threatening': hateScore * 0.5,
            harassment: hateScore,
            'harassment/threatening': hateScore * 0.5,
            'self-harm': selfHarmScore,
            'self-harm/intent': selfHarmScore * 0.5,
            'self-harm/instructions': selfHarmScore * 0.5,
            sexual: sexualScore,
            'sexual/minors': sexualScore * 0.3,
            violence: violenceScore,
            'violence/graphic': violenceScore * 0.5,
        };
        return { flagged, categories, category_scores };
    });
}
const textModels = () => [
    { id: 'eior-chat', name: 'Eior Chat', type: 'chat', provider: 'eior' },
    { id: 'eior-fast', name: 'Eior Fast', type: 'chat', provider: 'eior' },
    { id: 'eior-vision', name: 'Eior Vision', type: 'vision', provider: 'eior' },
    { id: 'eior-code', name: 'Eior Code', type: 'chat', provider: 'eior' },
    { id: 'eior-embed', name: 'Eior Embed', type: 'embedding', provider: 'eior' },
];
exports.textModels = textModels;
//# sourceMappingURL=llm.service.js.map