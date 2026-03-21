import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyApiKey }   from '../middleware/apiKey.middleware';
import { rateLimitByKey } from '../middleware/rateLimit.middleware';
import { logUsage }       from '../models/usage.model';
import {
  chatCompletion, createEmbedding, moderateText,
  textModels,
} from '../services/llm.service';
import { generateImage, imageModels } from '../services/image.service';
import { generateVideo, videoModels } from '../services/video.service';
import { logger } from '../utils/logger';

// ── OpenAI error envelope ──────────────────────────────────────────────────────
const oaiError = (
  message: string,
  type = 'invalid_request_error',
  code: string | null = null,
  param: string | null = null,
) => ({ error: { message, type, param, code } });

// ── Schemas ───────────────────────────────────────────────────────────────────
const contentPartSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string().min(1).max(32_000) }),
  z.object({
    type:      z.literal('image_url'),
    image_url: z.object({
      url:    z.string().min(1),
      detail: z.enum(['auto', 'low', 'high']).optional(),
    }),
  }),
]);

const toolFunctionSchema = z.object({
  name:        z.string().min(1).max(64),
  description: z.string().max(1024).optional(),
  parameters:  z.record(z.unknown()).optional(),
  strict:      z.boolean().optional(),
});

const toolSchema = z.object({
  type:     z.literal('function'),
  function: toolFunctionSchema,
});

const toolChoiceSchema = z.union([
  z.enum(['none', 'auto', 'required']),
  z.object({
    type:     z.literal('function'),
    function: z.object({ name: z.string() }),
  }),
]);

const messageContentSchema = z.union([
  z.string().min(1).max(32_000),
  z.array(contentPartSchema).min(1).max(20),
]);

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: messageContentSchema.nullable().optional(),
  tool_calls: z.array(z.object({
    id:       z.string(),
    type:     z.literal('function'),
    function: z.object({ name: z.string(), arguments: z.string() }),
  })).optional(),
  tool_call_id: z.string().optional(),
  name:         z.string().optional(),
});

const chatSchema = z.object({
  model:        z.string().optional(),
  messages:     z.array(chatMessageSchema).min(1).max(200),
  stream:       z.boolean().optional().default(false),
  tools:        z.array(toolSchema).max(128).optional(),
  tool_choice:  toolChoiceSchema.optional(),
  max_tokens:   z.number().int().min(1).max(32_000).optional(),
  temperature:  z.number().min(0).max(2).optional(),
  top_p:        z.number().min(0).max(1).optional(),
  n:            z.number().int().min(1).max(1).optional(),  // we support n=1 only
  stop:         z.union([z.string(), z.array(z.string())]).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty:  z.number().min(-2).max(2).optional(),
  logprobs:          z.boolean().optional(),
  user:              z.string().optional(),
});

const imageSchema = z.object({
  prompt:          z.string().min(1).max(2_000),
  negative_prompt: z.string().max(500).optional(),
  n:               z.number().int().min(1).max(4).default(1),
  size:            z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).default('1024x1024'),
  quality:         z.enum(['standard', 'hd']).optional(),
  style:           z.enum(['natural', 'vivid']).optional(),
  response_format: z.enum(['url', 'b64_json']).optional().default('url'),
});

const videoSchema = z.object({
  prompt:   z.string().min(1).max(2_000),
  duration: z.number().min(1).max(10).default(5),
});

const embeddingSchema = z.object({
  input:           z.union([z.string().min(1), z.array(z.string().min(1)).min(1).max(2048)]),
  model:           z.string().optional().default('eior-embed'),
  encoding_format: z.enum(['float', 'base64']).optional().default('float'),
  dimensions:      z.number().int().min(1).optional(),
  user:            z.string().optional(),
});

const moderationSchema = z.object({
  input: z.union([z.string().min(1), z.array(z.string().min(1))]),
  model: z.string().optional().default('eior-moderation'),
});

const clean = (s: string) => s.replace(/\0/g, '').trim();

function fireLog(input: Parameters<typeof logUsage>[0]) {
  logUsage(input).catch(err => logger.error({ err }, 'Failed to write usage log'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function generationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', verifyApiKey);
  app.addHook('preHandler', rateLimitByKey);

  // ── POST /v1/chat/completions ─────────────────────────────────────────────
  app.post('/v1/chat/completions', async (req, reply) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(
        oaiError(parsed.error.issues[0].message, 'invalid_request_error', 'invalid_parameter',
          String(parsed.error.issues[0].path[0] ?? null))
      );
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
      const result = await chatCompletion(sanitized as Parameters<typeof chatCompletion>[0], {
        model,
        tools:       tools       as import('../services/llm.service').Tool[] | undefined,
        tool_choice: tool_choice as import('../services/llm.service').ToolChoice | undefined,
        max_tokens, temperature, top_p,
      });

      fireLog({
        userId: req.user!.id, apiKeyId: req.apiKey!.id,
        endpoint: '/v1/chat/completions', model: result.model,
        promptTokens: result.promptTokens, completionTokens: result.completionTokens,
        responseTimeMs: Date.now() - start, statusCode: 200,
      });

      const id      = `chatcmpl-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);

      // ── SSE streaming ───────────────────────────────────────────────────
      if (stream) {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('Transfer-Encoding', 'chunked');
        reply.raw.removeHeader('Content-Length');

        const send = (obj: unknown) => reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);

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
        } else {
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
      const message: Record<string, unknown> = { role: 'assistant', content: result.content };
      if (result.tool_calls?.length) message.tool_calls = result.tool_calls;

      return reply.send({
        id, object: 'chat.completion', created, model: result.model,
        choices: [{ index: 0, message, finish_reason: result.finishReason }],
        usage: {
          prompt_tokens:     result.promptTokens,
          completion_tokens: result.completionTokens,
          total_tokens:      result.promptTokens + result.completionTokens,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Chat completion failed');
      return reply.status(502).send(
        oaiError('The AI service is currently unavailable. Please try again later.', 'api_error', 'service_unavailable')
      );
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
      const result = await createEmbedding(input, model);

      fireLog({
        userId: req.user!.id, apiKeyId: req.apiKey!.id,
        endpoint: '/v1/embeddings', model: result.model,
        promptTokens: result.promptTokens,
        responseTimeMs: Date.now() - start, statusCode: 200,
      });

      const embedData = result.embeddings.map((emb, i) => ({
        object:    'embedding',
        index:     i,
        embedding: encoding_format === 'base64'
          ? Buffer.from(new Float32Array(emb).buffer).toString('base64')
          : emb,
      }));

      return reply.send({
        object: 'list',
        model:  result.model,
        data:   embedData,
        usage: {
          prompt_tokens: result.promptTokens,
          total_tokens:  result.promptTokens,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Embedding failed');
      return reply.status(502).send(
        oaiError('Embedding service unavailable. Ensure Ollama is running or GROQ_API_KEY is set.', 'api_error', 'service_unavailable')
      );
    }
  });

  // ── POST /v1/moderations ─────────────────────────────────────────────────
  app.post('/v1/moderations', async (req, reply) => {
    const parsed = moderationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(oaiError(parsed.error.issues[0].message));
    }

    const { input, model } = parsed.data;
    const results = moderateText(input);

    return reply.send({
      id:      `modr-${Date.now()}`,
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
      const result = await generateImage({ prompt: clean(prompt), negativePrompt: negative_prompt, width, height, n });

      fireLog({
        userId: req.user!.id, apiKeyId: req.apiKey!.id,
        endpoint: '/v1/images/generations', model: result.model,
        imagesCount: n, responseTimeMs: Date.now() - start, statusCode: 200,
      });

      return reply.send({
        created: Math.floor(Date.now() / 1000),
        data:    result.images.map(url => ({ url })),
      });
    } catch (err) {
      logger.error({ err }, 'Image generation failed');
      return reply.status(502).send(
        oaiError('Image generation failed. Ensure Automatic1111 or REPLICATE_API_TOKEN is configured.', 'api_error', 'service_unavailable')
      );
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
      const result = await generateVideo({ prompt: clean(prompt), duration });

      fireLog({
        userId: req.user!.id, apiKeyId: req.apiKey!.id,
        endpoint: '/v1/video/generate', model: result.model,
        videosCount: 1, responseTimeMs: Date.now() - start, statusCode: 200,
      });

      return reply.send({
        video_url: result.videoUrl,
        prompt:    clean(prompt),
        status:    result.status,
        model:     result.model,
      });
    } catch (err) {
      logger.error({ err }, 'Video generation failed');
      return reply.status(502).send(
        oaiError('Video generation failed. Ensure REPLICATE_API_TOKEN is configured.', 'api_error', 'service_unavailable')
      );
    }
  });

  // Rich model metadata — for OpenAI-compatible clients (LM Studio, LiteLLM, etc.)
  const MODEL_META: Record<string, object> = {
    'eior-chat': {
      description:    'Eior general-purpose chat model. Fast, helpful, and accurate for everyday tasks.',
      context_window: 32768,
      max_output:     8192,
      capabilities:   ['chat', 'function_calling', 'streaming'],
      pricing:        { prompt: 0, completion: 0 },
    },
    'eior-fast': {
      description:    'Eior lightweight model optimised for speed. Best for simple Q&A and short completions.',
      context_window: 8192,
      max_output:     4096,
      capabilities:   ['chat', 'streaming'],
      pricing:        { prompt: 0, completion: 0 },
    },
    'eior-code': {
      description:    'Eior code-specialised model. Expert at writing, reviewing, and debugging code in any language.',
      context_window: 32768,
      max_output:     8192,
      capabilities:   ['chat', 'function_calling', 'streaming', 'code'],
      pricing:        { prompt: 0, completion: 0 },
    },
    'eior-vision': {
      description:    'Eior multimodal vision model. Understands and reasons about images alongside text.',
      context_window: 32768,
      max_output:     8192,
      capabilities:   ['chat', 'vision', 'streaming'],
      modalities:     ['text', 'image'],
      pricing:        { prompt: 0, completion: 0 },
    },
  };

  // ── GET /v1/models ────────────────────────────────────────────────────────
  app.get('/v1/models', async (_req, reply) => {
    const now    = Math.floor(Date.now() / 1000);
    const models = [...textModels(), ...imageModels(), ...videoModels()];

    return reply.send({
      object: 'list',
      data: models.map(m => ({
        id:         m.id,
        object:     'model',
        created:    now,
        owned_by:   'eior',
        root:       m.id,
        parent:     null,
        ...(MODEL_META[m.id] ?? {}),
      })),
    });
  });

  // ── GET /v1/models/:model ─────────────────────────────────────────────────
  app.get('/v1/models/:model', async (req, reply) => {
    const { model } = req.params as { model: string };
    const all = [...textModels(), ...imageModels(), ...videoModels()];
    const found = all.find(m => m.id === model);
    if (!found) {
      return reply.status(404).send(oaiError(`The model '${model}' does not exist`, 'invalid_request_error', 'model_not_found'));
    }
    return reply.send({
      id:       found.id,
      object:   'model',
      created:  Math.floor(Date.now() / 1000),
      owned_by: 'eior',
      root:     found.id,
      parent:   null,
      ...(MODEL_META[found.id] ?? {}),
    });
  });
}
