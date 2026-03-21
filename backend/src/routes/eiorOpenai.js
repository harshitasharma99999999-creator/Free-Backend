import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '../lib/rateLimit.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';
import { config } from '../config.js';
import { getOllamaHostHeader, ollamaJson, ollamaRequest } from '../lib/ollamaHttp.js';

/**
 * EIOR OpenAI-Compatible API Routes for OpenClaw Integration
 *
 * Provides OpenAI-compatible endpoints that expose EIOR models.
 * Supports chat completions (streaming + non-streaming), image generation,
 * embeddings, and a dedicated vibecode endpoint for AI-assisted coding.
 *
 * Base URL: /eior/v1
 * Auth:     X-API-Key: fk_xxx  OR  Authorization: Bearer fk_xxx
 */
export default async function eiorOpenaiRoutes(fastify) {
  const hostHeader = getOllamaHostHeader(config.ollama.baseUrl, config.ollama.hostHeader);

  // ─── Auth + rate-limit preHandler ─────────────────────────────────────────
  fastify.addHook('preHandler', async (request, reply) => {
    // Allow unauthenticated access to model discovery endpoints
    if (request.method === 'GET' && /\/models(\/[^/]*)?(\?.*)?$/.test(request.url)) {
      return;
    }

    let rawKey = request.headers['x-api-key'];
    if (!rawKey) {
      const auth = request.headers.authorization;
      if (auth && auth.toLowerCase().startsWith('bearer ')) {
        rawKey = auth.slice(7).trim();
      }
    }

    if (!rawKey) {
      return reply.code(401).send({
        error: {
          message: 'No API key provided. Pass it as X-API-Key header or Authorization: Bearer <key>.',
          type: 'invalid_request_error',
          code: 'missing_api_key',
        },
      });
    }

    const key = String(rawKey).trim();
    if (!isValidApiKeyFormat(key)) {
      return reply.code(401).send({
        error: { message: 'Invalid API key format.', type: 'invalid_request_error', code: 'invalid_api_key' },
      });
    }

    const db = fastify.mongo?.db;
    if (!db) {
      return reply.code(503).send({
        error: { message: 'Database unavailable.', type: 'server_error', code: 'database_unavailable' },
      });
    }

    const keyDoc = await db.collection('api_keys').findOne({ key });
    if (!keyDoc) {
      return reply.code(401).send({
        error: { message: 'Invalid API key.', type: 'invalid_request_error', code: 'invalid_api_key' },
      });
    }
    request.apiKey = keyDoc;

    // Rate limiting
    const rl = await checkRateLimit(`eior:${keyDoc._id.toString()}`);
    reply.header('X-RateLimit-Limit', rl.limit);
    reply.header('X-RateLimit-Remaining', rl.remaining);
    reply.header('X-RateLimit-Reset', rl.reset);
    if (!rl.success) {
      return reply.code(429).send({
        error: { message: 'Rate limit exceeded. Try again later.', type: 'rate_limit_error', code: 'rate_limit_exceeded' },
      });
    }

    // Usage tracking (non-fatal)
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await db.collection('usage').updateOne(
        { apiKeyId: keyDoc._id, date: today },
        { $inc: { count: 1 } },
        { upsert: true }
      );
    } catch (_) {}
  });

  // ─── Ollama helpers ────────────────────────────────────────────────────────

  /** Non-streaming Ollama chat call. */
  async function ollamaChat(messages, options = {}) {
    const { model, temperature, max_tokens, top_p, tools } = options;
    const ollamaOptions = {};
    if (temperature != null) ollamaOptions.temperature = temperature;
    if (max_tokens != null)  ollamaOptions.num_predict = max_tokens;
    if (top_p != null)       ollamaOptions.top_p = top_p;

    const body = {
      model: model || config.ollama.model,
      messages,
      stream: false,
      options: ollamaOptions,
    };
    if (Array.isArray(tools) && tools.length > 0) body.tools = tools;

    return ollamaJson({
      baseUrl: config.ollama.baseUrl,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      hostHeader,
      body,
      timeoutMs: 120_000,
    });
  }

  /** Streaming Ollama chat call — returns raw Response for SSE piping. */
  async function ollamaChatStream(messages, options = {}) {
    const { model, temperature, max_tokens, top_p, tools } = options;
    const ollamaOptions = {};
    if (temperature != null) ollamaOptions.temperature = temperature;
    if (max_tokens != null)  ollamaOptions.num_predict = max_tokens;
    if (top_p != null)       ollamaOptions.top_p = top_p;

    const body = {
      model: model || config.ollama.model,
      messages,
      stream: true,
      options: ollamaOptions,
    };
    if (Array.isArray(tools) && tools.length > 0) body.tools = tools;

    const res = await ollamaRequest({
      baseUrl: config.ollama.baseUrl,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      hostHeader,
      body,
      timeoutMs: 120_000,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Ollama ${res.status}: ${text}`);
      err.ollamaStatus = res.status;
      throw err;
    }
    return res;
  }

  /** Estimate tokens (rough: ~4 chars per token). */
  function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4);
  }

  function normalizeToolCallArguments(args) {
    if (args == null) return '{}';
    if (typeof args === 'string') return args;
    try {
      return JSON.stringify(args);
    } catch {
      return String(args);
    }
  }

  function normalizeOpenAITools(body) {
    const tools = Array.isArray(body?.tools) ? body.tools : null;
    if (tools && tools.length > 0) return { tools, usedLegacyFunctions: false };

    // Legacy OpenAI ChatCompletions: { functions: [...], function_call: 'auto' }
    const functions = Array.isArray(body?.functions) ? body.functions : null;
    if (functions && functions.length > 0) {
      return {
        tools: functions.map((fn) => ({ type: 'function', function: fn })),
        usedLegacyFunctions: true,
      };
    }

    return { tools: null, usedLegacyFunctions: false };
  }

  function mapOllamaToolCallsToOpenAI(toolCalls, toolCallIdsByIndex) {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
    return toolCalls.map((tc, index) => {
      const id = toolCallIdsByIndex?.get(index) || `call_${randomUUID().replace(/-/g, '')}`;
      if (toolCallIdsByIndex) toolCallIdsByIndex.set(index, id);

      const name = tc?.function?.name ?? tc?.name ?? 'unknown';
      const args = normalizeToolCallArguments(tc?.function?.arguments ?? tc?.arguments ?? {});

      return {
        index,
        id,
        type: 'function',
        function: { name, arguments: args },
      };
    });
  }

  // ─── Replicate helpers ─────────────────────────────────────────────────────

  /** Run a Replicate prediction and poll until complete. */
  async function runReplicatePrediction(modelVersion, input) {
    if (!config.replicate.apiToken) {
      throw new Error('REPLICATE_API_TOKEN is not configured on this server.');
    }

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.replicate.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: modelVersion, input }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new Error(`Replicate create failed ${createRes.status}: ${text}`);
    }

    let prediction = await createRes.json();

    // Poll every 3 seconds, max 120 seconds
    const maxAttempts = 40;
    let attempts = 0;
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${config.replicate.apiToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      prediction = await pollRes.json();
      attempts++;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }

    return prediction.output;
  }

  // ─── GET /models ──────────────────────────────────────────────────────────
  fastify.get('/models', async (_request, reply) => {
    const models = [
      {
        id: 'eior-v1',
        object: 'model',
        created: 1700000000,
        owned_by: 'eior',
        permission: [],
        root: 'eior-v1',
        parent: null,
        description: 'EIOR general-purpose model for chat, code, and reasoning.',
      },
      {
        id: 'eior-advanced',
        object: 'model',
        created: 1700000000,
        owned_by: 'eior',
        permission: [],
        root: 'eior-advanced',
        parent: null,
        description: 'EIOR advanced model with deeper reasoning and longer context.',
      },
      {
        id: 'eior-coder',
        object: 'model',
        created: 1700000000,
        owned_by: 'eior',
        permission: [],
        root: 'eior-coder',
        parent: null,
        description: 'EIOR code-specialised model — optimised for Vibecoding and software generation.',
      },
      {
        id: 'eior-image-gen',
        object: 'model',
        created: 1700000000,
        owned_by: 'eior',
        permission: [],
        root: 'eior-image-gen',
        parent: null,
        description: 'EIOR image generation model powered by Stable Diffusion XL.',
      },
    ];
    return reply.send({ object: 'list', data: models });
  });

  // ─── GET /models/:model ───────────────────────────────────────────────────
  fastify.get('/models/:model', async (request, reply) => {
    const model = request.params.model;
    const eiorModels = ['eior-v1', 'eior-advanced', 'eior-coder', 'eior-image-gen'];

    if (!eiorModels.includes(model)) {
      return reply.code(404).send({
        error: { message: `Model '${model}' not found.`, type: 'invalid_request_error', code: 'model_not_found' },
      });
    }

    return reply.send({
      id: model,
      object: 'model',
      created: 1700000000,
      owned_by: 'eior',
      permission: [],
      root: model,
      parent: null,
    });
  });

  // ─── POST /chat/completions ───────────────────────────────────────────────
  fastify.post('/chat/completions', {
    schema: {
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          model:       { type: 'string' },
          messages: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role:    { type: 'string', enum: ['system', 'user', 'assistant', 'tool'] },
                content: { type: 'string' },
              },
            },
          },
          tools:       { type: 'array' },
          tool_choice: {},
          parallel_tool_calls: { type: 'boolean' },
          functions:   { type: 'array' },
          function_call: {},
          temperature: { type: 'number', minimum: 0, maximum: 2 },
          max_tokens:  { type: 'integer', minimum: 1 },
          top_p:       { type: 'number', minimum: 0, maximum: 1 },
          stream:      { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      const { messages, stream = false, temperature, max_tokens, top_p } = request.body;
      const model = request.body.model || 'eior-v1';

      const { tools, usedLegacyFunctions } = normalizeOpenAITools(request.body);

      const fallbackOllamaModel =
        config.eior?.ollamaModelMap?.['eior-v1'] ||
        config.ollama.model;

      const mappedOllamaModel = config.eior?.ollamaModelMap?.[model];
      const ollamaModel = mappedOllamaModel && mappedOllamaModel !== 'replicate'
        ? mappedOllamaModel
        : fallbackOllamaModel;

      const ollamaOptions = { model: ollamaModel, temperature, max_tokens, top_p, tools };

      if (stream) {
        let ollamaRes;
        try {
          ollamaRes = await ollamaChatStream(messages, ollamaOptions);
        } catch (err) {
          if (err.name === 'TimeoutError') {
            return reply.code(504).send({
              error: { message: 'Model timed out.', type: 'server_error', code: 'model_timeout' },
            });
          }
          return reply.code(err.ollamaStatus >= 400 ? err.ollamaStatus : 502).send({
            error: { message: err.message, type: 'server_error', code: 'model_error' },
          });
        }

        const id      = `chatcmpl-${randomUUID().replace(/-/g, '')}`;
        const created = Math.floor(Date.now() / 1000);

        reply.raw.writeHead(200, {
          'Content-Type':     'text/event-stream',
          'Cache-Control':    'no-cache',
          'Connection':       'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        // First chunk: role delta
        const roleChunk = {
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
        };
        reply.raw.write(`data: ${JSON.stringify(roleChunk)}\n\n`);

        const decoder = new TextDecoder();
        let   buffer  = '';
        const toolCallIdsByIndex = new Map();
        let sawToolCalls = false;

        for await (const rawChunk of ollamaRes.body) {
          buffer += decoder.decode(rawChunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            let ollamaChunk;
            try { ollamaChunk = JSON.parse(line); } catch { continue; }

            const content      = ollamaChunk.message?.content ?? '';
            const toolCalls    = ollamaChunk.message?.tool_calls ?? null;
            const done         = ollamaChunk.done === true;
            if (Array.isArray(toolCalls) && toolCalls.length > 0) sawToolCalls = true;
            const finishReason = done ? (sawToolCalls ? 'tool_calls' : (ollamaChunk.done_reason ?? 'stop')) : null;

            const openAiToolCalls = mapOllamaToolCallsToOpenAI(toolCalls, toolCallIdsByIndex);

            const delta = {};
            if (!done && content) delta.content = content;
            if (openAiToolCalls) {
              delta.tool_calls = openAiToolCalls.map(({ index, id, type, function: fn }) => ({
                index,
                id,
                type,
                function: fn,
              }));
            }

            const sseChunk = {
              id, object: 'chat.completion.chunk', created, model,
              choices: [{ index: 0, delta, finish_reason: finishReason }],
            };

            if (done && ollamaChunk.prompt_eval_count != null) {
              const pt = ollamaChunk.prompt_eval_count ?? 0;
              const ct = ollamaChunk.eval_count ?? 0;
              sseChunk.usage = { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct };
            }

            reply.raw.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
          }
        }

        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }

      // Non-streaming
      let data;
      try {
        data = await ollamaChat(messages, ollamaOptions);
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.code(504).send({
            error: { message: 'Model timed out. Try again or shorten your prompt.', type: 'server_error', code: 'model_timeout' },
          });
        }
        return reply.code(err.ollamaStatus >= 400 ? err.ollamaStatus : 502).send({
          error: { message: err.message, type: 'server_error', code: 'model_error' },
        });
      }

      const pt = data.prompt_eval_count ?? 0;
      const ct = data.eval_count ?? 0;
      const toolCalls = data.message?.tool_calls ?? null;
      const openAiToolCalls = mapOllamaToolCallsToOpenAI(toolCalls, null);
      const tool_calls = openAiToolCalls ? openAiToolCalls.map(({ index: _index, ...rest }) => rest) : undefined;

      const message = { role: 'assistant', content: data.message?.content ?? '' };
      if (tool_calls) message.tool_calls = tool_calls;
      if (usedLegacyFunctions && tool_calls?.[0]) {
        message.function_call = {
          name: tool_calls[0].function?.name,
          arguments: tool_calls[0].function?.arguments,
        };
      }

      return reply.send({
        id:      `chatcmpl-${randomUUID().replace(/-/g, '')}`,
        object:  'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index:         0,
          message,
          finish_reason: tool_calls ? 'tool_calls' : (data.done_reason ?? (data.done ? 'stop' : 'length')),
        }],
        usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct },
      });
    },
  });

  // ─── POST /images/generations ─────────────────────────────────────────────
  fastify.post('/images/generations', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt:          { type: 'string', minLength: 1, maxLength: 4000 },
          model:           { type: 'string' },
          n:               { type: 'integer', minimum: 1, maximum: 4, default: 1 },
          size:            { type: 'string', default: '1024x1024' },
          response_format: { type: 'string', enum: ['url', 'b64_json'], default: 'url' },
          negative_prompt: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { prompt, n = 1, size = '1024x1024', response_format = 'url', negative_prompt = '' } = request.body;
      const [width, height] = size.split('x').map(Number);

      if (!config.replicate.apiToken) {
        return reply.code(501).send({
          error: {
            message: 'Image generation is not configured. Set REPLICATE_API_TOKEN to enable it.',
            type: 'not_implemented_error',
            code: 'image_gen_not_configured',
          },
        });
      }

      try {
        const results = [];

        for (let i = 0; i < n; i++) {
          const output = await runReplicatePrediction(config.replicate.imageModel, {
            prompt,
            negative_prompt,
            width:  width  || 1024,
            height: height || 1024,
            num_inference_steps: 30,
            guidance_scale: 7.5,
          });

          const imageUrl = Array.isArray(output) ? output[0] : output;

          if (response_format === 'b64_json') {
            try {
              const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
              const buffer = await imgRes.arrayBuffer();
              results.push({ b64_json: Buffer.from(buffer).toString('base64') });
            } catch {
              results.push({ url: imageUrl });
            }
          } else {
            results.push({ url: imageUrl });
          }
        }

        return reply.send({ created: Math.floor(Date.now() / 1000), data: results });
      } catch (error) {
        return reply.code(502).send({
          error: { message: `Image generation failed: ${error.message}`, type: 'server_error', code: 'image_gen_error' },
        });
      }
    },
  });

  // ─── POST /embeddings ─────────────────────────────────────────────────────
  fastify.post('/embeddings', {
    schema: {
      body: {
        type: 'object',
        required: ['input'],
        properties: {
          model: { type: 'string' },
          input: {},
        },
      },
    },
    handler: async (request, reply) => {
      const { input } = request.body;
      const model = request.body.model || config.ollama.embeddingsModel;

      if (typeof input !== 'string' && !Array.isArray(input)) {
        return reply.code(400).send({
          error: { message: '`input` must be a string or array of strings.', type: 'invalid_request_error', code: 'invalid_input' },
        });
      }

      const inputs = Array.isArray(input) ? input : [input];

      try {
        // Use Ollama embeddings API
        const res = await ollamaRequest({
          baseUrl: config.ollama.baseUrl,
          path: '/api/embed',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          hostHeader,
          body: { model, input: inputs },
          timeoutMs: 30_000,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Ollama embed ${res.status}: ${text}`);
        }

        const data = await res.json();
        const embeds = Array.isArray(data.embeddings) ? data.embeddings : [];
        const tokenCount = data.prompt_eval_count ?? inputs.reduce((n, s) => n + estimateTokens(s), 0);

        return reply.send({
          object: 'list',
          data: embeds.map((emb, i) => ({
            object: 'embedding',
            embedding: Array.isArray(emb) ? emb : [],
            index: i,
          })),
          model,
          usage: { prompt_tokens: tokenCount, total_tokens: tokenCount },
        });
      } catch (error) {
        return reply.code(502).send({
          error: { message: `Embeddings failed: ${error.message}`, type: 'server_error', code: 'embeddings_error' },
        });
      }
    },
  });

  // ─── POST /vibecode ───────────────────────────────────────────────────────
  // Dedicated endpoint for AI-assisted code generation ("vibecoding").
  // Injects a code-expert system prompt so callers don't need to manage it.
  fastify.post('/vibecode', {
    schema: {
      body: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string', minLength: 1, maxLength: 8000 },
          language:    { type: 'string', maxLength: 50 },
          context:     { type: 'string', maxLength: 4000 },
          stream:      { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      const { description, language = '', context = '', stream = false } = request.body;

      const langHint = language ? ` Use ${language}.` : '';
      const contextHint = context ? `\n\nAdditional context:\n${context}` : '';

      const systemPrompt = `You are EIOR Coder, an expert software engineer and AI coding assistant.${langHint}
When given a description, you produce clean, production-ready code with:
- Clear structure and naming
- Inline comments for non-obvious logic
- Error handling where appropriate
- A brief explanation of what the code does at the top

Respond ONLY with the code block followed by a short explanation. No preamble.`;

      const userMessage = `${description}${contextHint}`;

      const messages = [
        { role: 'system',  content: systemPrompt },
        { role: 'user',    content: userMessage  },
      ];

      const ollamaOptions = { model: config.ollama.model };

      if (stream) {
        let ollamaRes;
        try {
          ollamaRes = await ollamaChatStream(messages, ollamaOptions);
        } catch (err) {
          if (err.name === 'TimeoutError') {
            return reply.code(504).send({ error: 'Model timed out.', code: 'model_timeout' });
          }
          return reply.code(502).send({ error: err.message, code: 'model_error' });
        }

        const id      = `vibecode-${randomUUID().replace(/-/g, '')}`;
        const created = Math.floor(Date.now() / 1000);

        reply.raw.writeHead(200, {
          'Content-Type':     'text/event-stream',
          'Cache-Control':    'no-cache',
          'Connection':       'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        reply.raw.write(`data: ${JSON.stringify({ id, event: 'start', created })}\n\n`);

        const decoder = new TextDecoder();
        let   buffer  = '';
        let   fullContent = '';

        for await (const rawChunk of ollamaRes.body) {
          buffer += decoder.decode(rawChunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            let chunk;
            try { chunk = JSON.parse(line); } catch { continue; }

            const token = chunk.message?.content ?? '';
            if (token) {
              fullContent += token;
              reply.raw.write(`data: ${JSON.stringify({ id, event: 'token', token })}\n\n`);
            }

            if (chunk.done) {
              reply.raw.write(`data: ${JSON.stringify({ id, event: 'done', code: fullContent })}\n\n`);
            }
          }
        }

        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }

      // Non-streaming
      let data;
      try {
        data = await ollamaChat(messages, ollamaOptions);
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.code(504).send({ error: 'Model timed out.', code: 'model_timeout' });
        }
        return reply.code(502).send({ error: err.message, code: 'model_error' });
      }

      const code = data.message?.content ?? '';
      const pt   = data.prompt_eval_count ?? estimateTokens(userMessage);
      const ct   = data.eval_count        ?? estimateTokens(code);

      return reply.send({
        id:          `vibecode-${randomUUID().replace(/-/g, '')}`,
        object:      'vibecode.completion',
        created:     Math.floor(Date.now() / 1000),
        model:       'eior-coder',
        code,
        language:    language || 'auto',
        usage:       { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct },
      });
    },
  });
}
