import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '../lib/rateLimit.js';
import { config } from '../config.js';
import { getOllamaHostHeader, ollamaRequest } from '../lib/ollamaHttp.js';

function formatFetchError(err) {
  const base = err?.message || 'Model error.';
  const cause = err?.cause;
  const code = cause?.code || cause?.errno;
  const extra = code ? ` (${code})` : '';
  return `${base}${extra}`;
}

/**
 * Free vibecode: generate a full working app scaffold (no API key required).
 *
 * Base URL: /api/vibecode
 * Auth:     none
 */
export default async function freeVibecodeRoutes(fastify) {
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string', minLength: 1, maxLength: 12000 },
          stream: { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      const { description, stream = true } = request.body;
      const baseUrl = config.ollama.baseUrl;
      const hostHeader = getOllamaHostHeader(baseUrl, config.ollama.hostHeader);

      const baseUrlMisconfigured =
        !baseUrl ||
        /PLACEHOLDER_UPDATE_AFTER_VPS/i.test(baseUrl) ||
        (config.env === 'production' && /^http:\/\/localhost\b/i.test(baseUrl));

      if (baseUrlMisconfigured) {
        return reply
          .code(503)
          .send({ error: 'Model backend is not configured. Set `OLLAMA_BASE_URL` to a reachable Ollama server (e.g. `http://YOUR_VPS_IP:11434`).' });
      }

      const forwardedFor = request.headers['x-forwarded-for'];
      const ip = (typeof forwardedFor === 'string' && forwardedFor.split(',')[0]?.trim()) || request.ip || 'anonymous';
      const rl = await checkRateLimit(`freevibe:${ip}`);
      reply.header('X-RateLimit-Limit', rl.limit);
      reply.header('X-RateLimit-Remaining', rl.remaining);
      reply.header('X-RateLimit-Reset', rl.reset);
      if (!rl.success) {
        return reply.code(429).send({ error: 'Rate limit exceeded. Try again later.' });
      }

      const systemPrompt = [
        'You are EIOR Coder, an expert software engineer.',
        'Task: Generate a complete, working app based on the user description.',
        '',
        'Requirements:',
        '- Output a full project with multiple files when needed (not just snippets).',
        '- Include a clear file tree first.',
        '- Then output each file with a header: FILE: <path>',
        '- For each file, include a single fenced code block with the full contents.',
        '- Include setup/run instructions at the end.',
        '- Prefer simple, production-ready defaults and avoid placeholders that break the app.',
        '',
        'Respond in plain text following the format exactly.',
      ].join('\n');

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
      ];

      if (!stream) {
        try {
          const res = await ollamaRequest({
            baseUrl,
            path: '/api/chat',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            hostHeader,
            body: JSON.stringify({ model: config.ollama.model, messages, stream: false }),
            timeoutMs: 180_000,
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            return reply.code(res.status).send({ error: `Ollama ${res.status}: ${text}` });
          }
          const data = await res.json();
          return reply.send({ id: `vibecode-${randomUUID().replace(/-/g, '')}`, output: data.message?.content ?? '' });
        } catch (err) {
          if (err?.name === 'TimeoutError') return reply.code(504).send({ error: 'Model timed out.' });
          return reply.code(502).send({ error: formatFetchError(err) });
        }
      }

      let ollamaRes;
      try {
        ollamaRes = await ollamaRequest({
          baseUrl,
          path: '/api/chat',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          hostHeader,
          body: JSON.stringify({ model: config.ollama.model, messages, stream: true }),
          timeoutMs: 180_000,
        });
      } catch (err) {
        if (err?.name === 'TimeoutError') return reply.code(504).send({ error: 'Model timed out.' });
        return reply.code(502).send({ error: formatFetchError(err) });
      }

      if (!ollamaRes.ok) {
        const text = await ollamaRes.text().catch(() => '');
        return reply.code(ollamaRes.status).send({ error: `Ollama ${ollamaRes.status}: ${text}` });
      }

      const id = `vibecode-${randomUUID().replace(/-/g, '')}`;
      const created = Math.floor(Date.now() / 1000);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      reply.raw.write(`data: ${JSON.stringify({ id, event: 'start', created })}\n\n`);

      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      for await (const rawChunk of ollamaRes.body) {
        buffer += decoder.decode(rawChunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }

          const token = chunk.message?.content ?? '';
          if (token) {
            full += token;
            reply.raw.write(`data: ${JSON.stringify({ id, event: 'token', token })}\n\n`);
          }

          if (chunk.done) {
            reply.raw.write(`data: ${JSON.stringify({ id, event: 'done', output: full })}\n\n`);
          }
        }
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    },
  });
}
