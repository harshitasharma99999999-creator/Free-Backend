import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '../lib/rateLimit.js';
import { config } from '../config.js';
import { getOllamaConnectIp, getOllamaHostHeader, ollamaRequest } from '../lib/ollamaHttp.js';

function formatFetchError(err) {
  const base = err?.message || 'Model error.';
  const cause = err?.cause;
  const code = cause?.code || cause?.errno;
  const extra = code ? ` (${code})` : '';
  return `${base}${extra}`;
}

/**
 * Free chat (no API key required).
 *
 * Base URL: /api/chat
 * Auth:     none (optional Authorization header is ignored)
 */
export default async function freeChatRoutes(fastify) {
  fastify.post('/completions', {
    schema: {
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          model: { type: 'string' },
          messages: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['system', 'user', 'assistant', 'tool'] },
                content: { type: 'string' },
              },
            },
          },
          temperature: { type: 'number', minimum: 0, maximum: 2 },
          max_tokens: { type: 'integer', minimum: 1 },
          top_p: { type: 'number', minimum: 0, maximum: 1 },
          stream: { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      let observedBaseUrl = null;
      try {
        const { messages, stream = false, temperature, max_tokens, top_p } = request.body;
        const publicModel = request.body.model || config.ollama.model;
        const underlyingModel =
          (config.eior?.ollamaModelMap && config.eior.ollamaModelMap[publicModel]) ? config.eior.ollamaModelMap[publicModel] : publicModel;
        const baseUrl = config.ollama.baseUrl;
        observedBaseUrl = baseUrl;
        const hostHeader = getOllamaHostHeader(baseUrl, config.ollama.hostHeader);
        const connectIp = getOllamaConnectIp(baseUrl, config.ollama.connectIps);

        const baseUrlMisconfigured =
          !baseUrl ||
          /PLACEHOLDER_UPDATE_AFTER_VPS/i.test(baseUrl) ||
          (config.env === 'production' && /^http:\/\/localhost\b/i.test(baseUrl));

        if (baseUrlMisconfigured) {
          return reply.code(503).send({
            error: {
              message:
                'Model backend is not configured. Set `OLLAMA_BASE_URL` to a reachable Ollama server (e.g. `http://YOUR_VPS_IP:11434`).',
              type: 'server_error',
              code: 'model_not_configured',
            },
          });
        }

        // Lightweight per-IP rate limiting (non-fatal if Upstash isn't configured).
        const forwardedFor = request.headers['x-forwarded-for'];
        const ip = (typeof forwardedFor === 'string' && forwardedFor.split(',')[0]?.trim()) || request.ip || 'anonymous';
        const rl = await checkRateLimit(`freechat:${ip}`);
        reply.header('X-RateLimit-Limit', rl.limit);
        reply.header('X-RateLimit-Remaining', rl.remaining);
        reply.header('X-RateLimit-Reset', rl.reset);
        if (!rl.success) {
          return reply.code(429).send({
            error: { message: 'Rate limit exceeded. Try again later.', type: 'rate_limit_error', code: 'rate_limit_exceeded' },
          });
        }

        const ollamaOptions = {};
        if (temperature != null) ollamaOptions.temperature = temperature;
        if (max_tokens != null) ollamaOptions.num_predict = max_tokens;
        if (top_p != null) ollamaOptions.top_p = top_p;

        const ollamaBody = { model: underlyingModel, messages, stream, options: ollamaOptions };

        if (stream) {
          let ollamaRes;
          try {
            ollamaRes = await ollamaRequest({
              baseUrl,
              path: '/api/chat',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              hostHeader,
              connectIp,
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
              error: { message: formatFetchError(err), type: 'server_error', code: 'model_error' },
            });
          }

          if (!ollamaRes.ok) {
            const text = await ollamaRes.text().catch(() => '');
            return reply.code(ollamaRes.status).send({
              error: { message: `Ollama ${ollamaRes.status}: ${text}`, type: 'server_error', code: 'model_error' },
            });
          }

          const id = `chatcmpl-${randomUUID().replace(/-/g, '')}`;
          const created = Math.floor(Date.now() / 1000);

          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });

          const roleChunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model: publicModel,
            choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
          };
          reply.raw.write(`data: ${JSON.stringify(roleChunk)}\n\n`);

          const decoder = new TextDecoder();
          let buffer = '';

          for await (const rawChunk of ollamaRes.body) {
            buffer += decoder.decode(rawChunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) continue;
              let ollamaChunk;
              try {
                ollamaChunk = JSON.parse(line);
              } catch {
                continue;
              }

              const content = ollamaChunk.message?.content ?? '';
              const done = ollamaChunk.done === true;
              const finishReason = done ? (ollamaChunk.done_reason ?? 'stop') : null;

              const sseChunk = {
                id,
                object: 'chat.completion.chunk',
                created,
                model: publicModel,
                choices: [{ index: 0, delta: done ? {} : { content }, finish_reason: finishReason }],
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

        let data;
        try {
          const res = await ollamaRequest({
            baseUrl,
            path: '/api/chat',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            hostHeader,
            connectIp,
            body: JSON.stringify({ ...ollamaBody, stream: false }),
            timeoutMs: 120_000,
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            return reply.code(res.status).send({
              error: { message: `Ollama ${res.status}: ${text}`, type: 'server_error', code: 'model_error' },
            });
          }
          data = await res.json();
        } catch (err) {
          if (err.name === 'TimeoutError') {
            return reply.code(504).send({
              error: { message: 'The model timed out. Try again or shorten your prompt.', type: 'server_error', code: 'model_timeout' },
            });
          }
          return reply.code(502).send({
            error: { message: formatFetchError(err), type: 'server_error', code: 'model_error' },
          });
        }

        const pt = data.prompt_eval_count ?? 0;
        const ct = data.eval_count ?? 0;

        return reply.send({
          id: `chatcmpl-${randomUUID().replace(/-/g, '')}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: publicModel,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: data.message?.content ?? '' },
              finish_reason: data.done_reason ?? (data.done ? 'stop' : 'length'),
            },
          ],
          usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct },
        });
      } catch (err) {
        console.error('[freeChat] Unhandled error:', err);
        return reply.code(500).send({
          error: { message: formatFetchError(err), type: 'server_error', code: 'freechat_internal_error', baseUrl: observedBaseUrl },
        });
      }
    },
  });
}
