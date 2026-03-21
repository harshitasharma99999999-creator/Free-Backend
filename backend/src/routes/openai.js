import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '../lib/rateLimit.js';
import { isValidApiKeyFormat } from '../lib/apiKey.js';
import { config } from '../config.js';

function rateLimitExceededBody(rl) {
  const retryAfterSec = rl.reset > 0 ? Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)) : config.rateLimit.windowSeconds;
  return {
    retryAfterSec,
    body: {
      error: {
        message: `Rate limit exceeded. You have used all ${rl.limit} requests allowed per ${config.rateLimit.windowSeconds} seconds. Wait ${retryAfterSec}s before retrying. Need higher limits? Visit /pricing to upgrade your plan.`,
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
        upgrade_url: '/pricing',
      },
    },
  };
}
import { getOllamaHostHeader, ollamaJson, ollamaRequest } from '../lib/ollamaHttp.js';

export default async function openaiRoutes(fastify) {
  const hostHeader = getOllamaHostHeader(config.ollama.baseUrl, config.ollama.hostHeader);
  // ─── Auth + rate-limit preHandler ─────────────────────────────────────────
  // Accepts key from:
  //   X-API-Key: fk_xxx            (platform format)
  //   Authorization: Bearer fk_xxx  (OpenAI SDK — just change baseURL, nothing else)
  fastify.addHook('preHandler', async (request, reply) => {
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
    if (keyDoc.active === false) {
      return reply.code(403).send({
        error: { message: 'This API key has been revoked. Generate a new key from your dashboard.', type: 'invalid_request_error', code: 'api_key_revoked' },
      });
    }
    request.apiKey = keyDoc;

    // Rate limiting
    const rl = await checkRateLimit(`openai:${keyDoc._id.toString()}`);
    reply.header('X-RateLimit-Limit', rl.limit);
    reply.header('X-RateLimit-Remaining', rl.remaining);
    reply.header('X-RateLimit-Reset', rl.reset);
    if (!rl.success) {
      const { retryAfterSec, body } = rateLimitExceededBody(rl);
      reply.header('Retry-After', retryAfterSec);
      return reply.code(429).send(body);
    }

    // Usage tracking (non-fatal)
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await Promise.all([
        db.collection('usage').updateOne(
          { apiKeyId: keyDoc._id, date: today },
          { $inc: { count: 1 } },
          { upsert: true }
        ),
        db.collection('api_keys').updateOne(
          { _id: keyDoc._id },
          { $inc: { usageCount: 1 } }
        ),
      ]);
    } catch (_) {}
  });

  // ─── Shared helpers ────────────────────────────────────────────────────────

  /** One-shot JSON POST to Ollama. */
  async function ollamaPost(path, body, timeoutMs = 120_000) {
    return ollamaJson({
      baseUrl: config.ollama.baseUrl,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      hostHeader,
      body,
      timeoutMs,
    });
  }

  /** One-shot GET from Ollama. */
  async function ollamaGet(path, timeoutMs = 10_000) {
    return ollamaJson({
      baseUrl: config.ollama.baseUrl,
      path,
      method: 'GET',
      hostHeader,
      timeoutMs,
    });
  }

  function sendOllamaError(err, reply) {
    if (err.name === 'TimeoutError') {
      return reply.code(504).send({
        error: { message: 'The model timed out. Try again or shorten your prompt.', type: 'server_error', code: 'model_timeout' },
      });
    }
    return reply.code(err.ollamaStatus >= 400 ? err.ollamaStatus : 502).send({
      error: { message: err.message, type: 'server_error', code: 'model_error' },
    });
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

  // ─── GET /v1/models ───────────────────────────────────────────────────────
  // Lists models available on the local Ollama instance in OpenAI format.
  // OpenAI SDKs call this automatically on init — without it some clients error.
  fastify.get('/models', async (request, reply) => {
    let tags;
    try {
      tags = await ollamaGet('/api/tags');
    } catch (err) {
      return sendOllamaError(err, reply);
    }

    const models = (tags.models ?? []).map((m) => ({
      id: m.name ?? m.model,
      object: 'model',
      created: m.modified_at ? Math.floor(new Date(m.modified_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
      owned_by: 'ollama',
    }));

    return reply.send({ object: 'list', data: models });
  });

  // ─── GET /v1/models/:model ────────────────────────────────────────────────
  fastify.get('/models/:model', async (request, reply) => {
    const model = request.params.model;
    let tags;
    try {
      tags = await ollamaGet('/api/tags');
    } catch (err) {
      return sendOllamaError(err, reply);
    }

    const found = (tags.models ?? []).find((m) => (m.name ?? m.model) === model);
    if (!found) {
      return reply.code(404).send({
        error: { message: `Model '${model}' not found.`, type: 'invalid_request_error', code: 'model_not_found' },
      });
    }

    return reply.send({
      id: found.name ?? found.model,
      object: 'model',
      created: found.modified_at ? Math.floor(new Date(found.modified_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
      owned_by: 'ollama',
    });
  });

  // ─── POST /v1/chat/completions ────────────────────────────────────────────
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
      const model = request.body.model || config.ollama.model;

      const ollamaOptions = {};
      if (temperature != null) ollamaOptions.temperature = temperature;
      if (max_tokens != null)  ollamaOptions.num_predict = max_tokens;
      if (top_p != null)       ollamaOptions.top_p = top_p;

      const { tools, usedLegacyFunctions } = normalizeOpenAITools(request.body);

      const ollamaBody = { model, messages, stream, options: ollamaOptions };
      if (Array.isArray(tools) && tools.length > 0) ollamaBody.tools = tools;

      // ── Streaming path (SSE) ──────────────────────────────────────────────
      if (stream) {
        let ollamaRes;
        try {
          ollamaRes = await ollamaRequest({
            baseUrl: config.ollama.baseUrl,
            path: '/api/chat',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            hostHeader,
            body: JSON.stringify({ ...ollamaBody, stream: true }),
            timeoutMs: 120_000,
          });
        } catch (err) {
          if (err.name === 'TimeoutError') {
            return reply.code(504).send({
              error: { message: 'Model timed out.', type: 'server_error', code: 'model_timeout' },
            });
          }
          return reply.code(502).send({
            error: { message: err.message, type: 'server_error', code: 'model_error' },
          });
        }

        if (!ollamaRes.ok) {
          const text = await ollamaRes.text().catch(() => '');
          return reply.code(ollamaRes.status).send({
            error: { message: `Ollama ${ollamaRes.status}: ${text}`, type: 'server_error', code: 'model_error' },
          });
        }

        const id      = `chatcmpl-${randomUUID().replace(/-/g, '')}`;
        const created = Math.floor(Date.now() / 1000);

        // Send SSE headers directly on the raw response
        reply.raw.writeHead(200, {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection':    'keep-alive',
          'X-Accel-Buffering': 'no',        // disable nginx proxy buffering
        });

        // First chunk includes the role delta (OpenAI convention)
        const roleChunk = {
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
        };
        reply.raw.write(`data: ${JSON.stringify(roleChunk)}\n\n`);

        // Stream NDJSON lines from Ollama → SSE chunks to client
        const decoder = new TextDecoder();
        let   buffer  = '';
        const toolCallIdsByIndex = new Map();
        let sawToolCalls = false;

        for await (const rawChunk of ollamaRes.body) {
          buffer += decoder.decode(rawChunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line

          for (const line of lines) {
            if (!line.trim()) continue;
            let ollamaChunk;
            try { ollamaChunk = JSON.parse(line); } catch { continue; }

            const content     = ollamaChunk.message?.content ?? '';
            const toolCalls   = ollamaChunk.message?.tool_calls ?? null;
            const done        = ollamaChunk.done === true;
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

            // Append usage on the final chunk (mirrors OpenAI behaviour)
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

      // ── Non-streaming path ────────────────────────────────────────────────
      let data;
      try {
        data = await ollamaPost('/api/chat', ollamaBody);
      } catch (err) {
        return sendOllamaError(err, reply);
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

  // ─── POST /v1/embeddings ──────────────────────────────────────────────────
  fastify.post('/embeddings', {
    schema: {
      body: {
        type: 'object',
        required: ['input'],
        properties: {
          model: { type: 'string' },
          input: {},   // string or string[] — validated in handler
        },
      },
    },
    handler: async (request, reply) => {
      const { input } = request.body;

      if (typeof input !== 'string' && !Array.isArray(input)) {
        return reply.code(400).send({
          error: { message: '`input` must be a string or array of strings.', type: 'invalid_request_error', code: 'invalid_input' },
        });
      }
      if (Array.isArray(input) && input.length === 0) {
        return reply.code(400).send({
          error: { message: '`input` array must not be empty.', type: 'invalid_request_error', code: 'invalid_input' },
        });
      }

      const model  = request.body.model || config.ollama.embeddingsModel;
      const inputs = Array.isArray(input) ? input : [input];

      let data;
      try {
        // Ollama ≥0.3: /api/embed accepts `input` as string or array
        data = await ollamaPost('/api/embed', { model, input: inputs });
      } catch (err) {
        return sendOllamaError(err, reply);
      }

      const embeds     = Array.isArray(data.embeddings) ? data.embeddings : [];
      const tokenCount = data.prompt_eval_count ?? inputs.reduce((n, s) => n + s.split(/\s+/).length, 0);

      return reply.send({
        object: 'list',
        data:   embeds.map((emb, i) => ({ object: 'embedding', embedding: Array.isArray(emb) ? emb : [], index: i })),
        model,
        usage:  { prompt_tokens: tokenCount, total_tokens: tokenCount },
      });
    },
  });

  // ─── POST /v1/images/generations ─────────────────────────────────────────
  // Standard Ollama does NOT support text-to-image generation.
  // Set IMAGE_GEN_URL to an OpenAI-compatible image backend
  // (e.g. AUTOMATIC1111 started with --api flag, or a ComfyUI OpenAI wrapper).
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
        },
      },
    },
    handler: async (request, reply) => {
      if (!config.ollama.imageGenUrl) {
        return reply.code(501).send({
          error: {
            message:
              'Image generation is not configured. ' +
              'Set IMAGE_GEN_URL to an OpenAI-compatible image backend ' +
              '(e.g. AUTOMATIC1111 at http://localhost:7860, or any ComfyUI wrapper). ' +
              'Standard Ollama does not support text-to-image generation.',
            type: 'not_implemented_error',
            code: 'image_gen_not_configured',
          },
        });
      }

      const { prompt, n = 1, size = '1024x1024', response_format = 'url' } = request.body;
      const model            = request.body.model || config.ollama.model;
      const [width, height]  = size.split('x').map(Number);

      let res;
      try {
        res = await fetch(`${config.ollama.imageGenUrl}/v1/images/generations`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ prompt, model, n, size, response_format, width: width || 1024, height: height || 1024 }),
          signal:  AbortSignal.timeout(180_000),
        });
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.code(504).send({
            error: { message: 'Image generation timed out.', type: 'server_error', code: 'model_timeout' },
          });
        }
        return reply.code(502).send({
          error: { message: `Image gen backend unreachable: ${err.message}`, type: 'server_error', code: 'image_gen_unavailable' },
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return reply.code(502).send({
          error: { message: `Image gen backend error ${res.status}: ${text}`, type: 'server_error', code: 'image_gen_error' },
        });
      }

      const data = await res.json();
      return reply.send({ created: Math.floor(Date.now() / 1000), data: data.data ?? data });
    },
  });
}
