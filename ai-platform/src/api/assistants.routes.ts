/**
 * Eior Assistants API — OpenAI-compatible
 * Implements: Assistants, Threads, Messages, Runs, Files
 *
 * All endpoints require Firebase auth (Bearer token from portal) OR API key.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/postgres';
import { verifyApiKey }   from '../middleware/apiKey.middleware';
import { rateLimitByKey } from '../middleware/rateLimit.middleware';
import { chatCompletion } from '../services/llm.service';
import { logger } from '../utils/logger';

const oaiError = (
  message: string,
  type = 'invalid_request_error',
  code: string | null = null,
) => ({ error: { message, type, param: null, code } });

// ── Schemas ───────────────────────────────────────────────────────────────────
const toolSchema = z.object({
  type: z.enum(['code_interpreter', 'retrieval', 'function']),
  function: z.object({
    name:        z.string().optional(),
    description: z.string().optional(),
    parameters:  z.record(z.unknown()).optional(),
  }).optional(),
});

const assistantCreateSchema = z.object({
  model:        z.string().optional().default('eior-chat'),
  name:         z.string().max(256).optional().nullable(),
  description:  z.string().max(512).optional().nullable(),
  instructions: z.string().max(32_768).optional().nullable(),
  tools:        z.array(toolSchema).max(128).optional().default([]),
  metadata:     z.record(z.string()).optional().default({}),
  temperature:  z.number().min(0).max(2).optional().nullable(),
  top_p:        z.number().min(0).max(1).optional().nullable(),
});

const threadCreateSchema = z.object({
  messages:  z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().min(1).max(32_768),
  })).optional().default([]),
  metadata: z.record(z.string()).optional().default({}),
});

const messageCreateSchema = z.object({
  role:     z.enum(['user', 'assistant']),
  content:  z.union([
    z.string().min(1).max(32_768),
    z.array(z.object({
      type: z.string(),
      text: z.object({ value: z.string(), annotations: z.array(z.unknown()).optional() }).optional(),
    })),
  ]),
  metadata: z.record(z.string()).optional().default({}),
});

const runCreateSchema = z.object({
  assistant_id:        z.string().uuid(),
  model:               z.string().optional().nullable(),
  instructions:        z.string().max(32_768).optional().nullable(),
  additional_instructions: z.string().max(32_768).optional().nullable(),
  tools:               z.array(toolSchema).optional().nullable(),
  metadata:            z.record(z.string()).optional().default({}),
  temperature:         z.number().min(0).max(2).optional().nullable(),
  top_p:               z.number().min(0).max(1).optional().nullable(),
  max_prompt_tokens:   z.number().int().optional().nullable(),
  max_completion_tokens: z.number().int().optional().nullable(),
  stream:              z.boolean().optional().default(false),
});

// ── DB helpers ────────────────────────────────────────────────────────────────
const db = () => getPool();

function now() { return Math.floor(Date.now() / 1000); }
function runId()   { return `run_${uuidv4().replace(/-/g, '').slice(0, 24)}`; }
function msgId()   { return `msg_${uuidv4().replace(/-/g, '').slice(0, 24)}`; }
function fileId()  { return `file-${uuidv4().replace(/-/g, '')}`; }

// ── Routes ────────────────────────────────────────────────────────────────────
export async function assistantsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', verifyApiKey);
  app.addHook('preHandler', rateLimitByKey);

  // ════════════════════════════════════════════════════════════════════════════
  // ASSISTANTS
  // ════════════════════════════════════════════════════════════════════════════

  // POST /v1/assistants
  app.post('/v1/assistants', async (req, reply) => {
    const parsed = assistantCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(oaiError(parsed.error.issues[0].message));

    const { model, name, description, instructions, tools, metadata, temperature, top_p } = parsed.data;
    const id        = `asst_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    const userId    = req.user!.id;
    const createdAt = now();

    try {
      await db().query(
        `INSERT INTO assistants (id, user_id, name, description, instructions, model, tools, metadata, temperature, top_p, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, to_timestamp($11))`,
        [id, userId, name ?? null, description ?? null, instructions ?? null,
         model, JSON.stringify(tools), JSON.stringify(metadata),
         temperature ?? null, top_p ?? null, createdAt]
      );
    } catch (err) {
      logger.error({ err }, 'Failed to create assistant');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    return reply.status(200).send({
      id, object: 'assistant', created_at: createdAt,
      name, description, instructions, model, tools, metadata,
      temperature, top_p,
    });
  });

  // GET /v1/assistants
  app.get('/v1/assistants', async (req, reply) => {
    const { limit = '20', order = 'desc', after, before } =
      (req.query as Record<string, string>);
    const userId = req.user!.id;

    try {
      const lim = Math.min(parseInt(limit, 10) || 20, 100);
      const rows = await db().query(
        `SELECT * FROM assistants WHERE user_id = $1 ORDER BY created_at ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT $2`,
        [userId, lim]
      );

      const data = rows.rows.map(r => ({
        id: r.id, object: 'assistant', created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        name: r.name, description: r.description, instructions: r.instructions,
        model: r.model, tools: r.tools, metadata: r.metadata,
        temperature: r.temperature, top_p: r.top_p,
      }));

      return reply.send({
        object: 'list', data,
        first_id: data[0]?.id ?? null,
        last_id:  data[data.length - 1]?.id ?? null,
        has_more: data.length === lim,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to list assistants');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // GET /v1/assistants/:assistant_id
  app.get('/v1/assistants/:assistant_id', async (req, reply) => {
    const { assistant_id } = req.params as { assistant_id: string };
    const userId = req.user!.id;

    try {
      const res = await db().query(
        'SELECT * FROM assistants WHERE id = $1 AND user_id = $2',
        [assistant_id, userId]
      );
      if (!res.rows[0]) return reply.status(404).send(oaiError(`Assistant '${assistant_id}' not found`, 'invalid_request_error', 'not_found'));

      const r = res.rows[0];
      return reply.send({
        id: r.id, object: 'assistant', created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        name: r.name, description: r.description, instructions: r.instructions,
        model: r.model, tools: r.tools, metadata: r.metadata,
        temperature: r.temperature, top_p: r.top_p,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to get assistant');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // POST /v1/assistants/:assistant_id — update
  app.post('/v1/assistants/:assistant_id', async (req, reply) => {
    const { assistant_id } = req.params as { assistant_id: string };
    const userId = req.user!.id;
    const updates = req.body as Record<string, unknown>;

    const allowed = ['name', 'description', 'instructions', 'model', 'tools', 'metadata', 'temperature', 'top_p'];
    const setParts: string[] = [];
    const values: unknown[]  = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in updates) {
        const val = (key === 'tools' || key === 'metadata') ? JSON.stringify(updates[key]) : updates[key];
        setParts.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (!setParts.length) return reply.status(400).send(oaiError('No valid fields to update'));

    values.push(assistant_id, userId);
    try {
      const res = await db().query(
        `UPDATE assistants SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
        values
      );
      if (!res.rows[0]) return reply.status(404).send(oaiError(`Assistant '${assistant_id}' not found`, 'invalid_request_error', 'not_found'));
      const r = res.rows[0];
      return reply.send({
        id: r.id, object: 'assistant', created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        name: r.name, description: r.description, instructions: r.instructions,
        model: r.model, tools: r.tools, metadata: r.metadata,
        temperature: r.temperature, top_p: r.top_p,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to update assistant');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // DELETE /v1/assistants/:assistant_id
  app.delete('/v1/assistants/:assistant_id', async (req, reply) => {
    const { assistant_id } = req.params as { assistant_id: string };
    const userId = req.user!.id;
    try {
      await db().query('DELETE FROM assistants WHERE id = $1 AND user_id = $2', [assistant_id, userId]);
      return reply.send({ id: assistant_id, object: 'assistant.deleted', deleted: true });
    } catch (err) {
      logger.error({ err }, 'Failed to delete assistant');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // THREADS
  // ════════════════════════════════════════════════════════════════════════════

  // POST /v1/threads
  app.post('/v1/threads', async (req, reply) => {
    const parsed = threadCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(oaiError(parsed.error.issues[0].message));

    const { messages, metadata } = parsed.data;
    const id        = `thread_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    const userId    = req.user!.id;
    const createdAt = now();

    try {
      await db().query(
        'INSERT INTO threads (id, user_id, metadata, created_at) VALUES ($1,$2,$3,to_timestamp($4))',
        [id, userId, JSON.stringify(metadata), createdAt]
      );

      // Seed initial messages if provided
      for (const msg of messages) {
        const msgId_ = msgId();
        await db().query(
          `INSERT INTO thread_messages (id, thread_id, role, content, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,to_timestamp($6))`,
          [msgId_, id, msg.role, JSON.stringify([{ type: 'text', text: { value: msg.content, annotations: [] } }]),
           '{}', createdAt]
        );
      }
    } catch (err) {
      logger.error({ err }, 'Failed to create thread');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    return reply.send({ id, object: 'thread', created_at: createdAt, metadata });
  });

  // GET /v1/threads/:thread_id
  app.get('/v1/threads/:thread_id', async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const userId = req.user!.id;
    try {
      const res = await db().query('SELECT * FROM threads WHERE id = $1 AND user_id = $2', [thread_id, userId]);
      if (!res.rows[0]) return reply.status(404).send(oaiError(`Thread '${thread_id}' not found`, 'invalid_request_error', 'not_found'));
      const r = res.rows[0];
      return reply.send({ id: r.id, object: 'thread', created_at: Math.floor(new Date(r.created_at).getTime() / 1000), metadata: r.metadata });
    } catch (err) {
      logger.error({ err }, 'Failed to get thread');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // DELETE /v1/threads/:thread_id
  app.delete('/v1/threads/:thread_id', async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const userId = req.user!.id;
    try {
      await db().query('DELETE FROM threads WHERE id = $1 AND user_id = $2', [thread_id, userId]);
      return reply.send({ id: thread_id, object: 'thread.deleted', deleted: true });
    } catch (err) {
      logger.error({ err }, 'Failed to delete thread');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ════════════════════════════════════════════════════════════════════════════

  // POST /v1/threads/:thread_id/messages
  app.post('/v1/threads/:thread_id/messages', async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const userId = req.user!.id;

    // Verify thread ownership
    try {
      const t = await db().query('SELECT id FROM threads WHERE id = $1 AND user_id = $2', [thread_id, userId]);
      if (!t.rows[0]) return reply.status(404).send(oaiError(`Thread '${thread_id}' not found`, 'invalid_request_error', 'not_found'));
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    const parsed = messageCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(oaiError(parsed.error.issues[0].message));

    const { role, content, metadata } = parsed.data;
    const id        = msgId();
    const createdAt = now();

    // Normalise content to OpenAI message content array format
    const contentArr = typeof content === 'string'
      ? [{ type: 'text', text: { value: content, annotations: [] } }]
      : content;

    try {
      await db().query(
        `INSERT INTO thread_messages (id, thread_id, role, content, metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,to_timestamp($6))`,
        [id, thread_id, role, JSON.stringify(contentArr), JSON.stringify(metadata), createdAt]
      );
    } catch (err) {
      logger.error({ err }, 'Failed to create message');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    return reply.send({
      id, object: 'thread.message', created_at: createdAt,
      thread_id, role, content: contentArr,
      assistant_id: null, run_id: null, metadata,
    });
  });

  // GET /v1/threads/:thread_id/messages
  app.get('/v1/threads/:thread_id/messages', async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const userId = req.user!.id;
    const { limit = '20', order = 'asc' } = req.query as Record<string, string>;

    // Verify ownership
    try {
      const t = await db().query('SELECT id FROM threads WHERE id = $1 AND user_id = $2', [thread_id, userId]);
      if (!t.rows[0]) return reply.status(404).send(oaiError(`Thread '${thread_id}' not found`, 'invalid_request_error', 'not_found'));
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    try {
      const res = await db().query(
        `SELECT * FROM thread_messages WHERE thread_id = $1 ORDER BY created_at ${order === 'desc' ? 'DESC' : 'ASC'} LIMIT $2`,
        [thread_id, lim]
      );
      const data = res.rows.map(r => ({
        id: r.id, object: 'thread.message',
        created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        thread_id, role: r.role, content: r.content,
        assistant_id: r.assistant_id ?? null, run_id: r.run_id ?? null, metadata: r.metadata,
      }));
      return reply.send({
        object: 'list', data,
        first_id: data[0]?.id ?? null,
        last_id:  data[data.length - 1]?.id ?? null,
        has_more: data.length === lim,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to list messages');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // GET /v1/threads/:thread_id/messages/:message_id
  app.get('/v1/threads/:thread_id/messages/:message_id', async (req, reply) => {
    const { thread_id, message_id } = req.params as { thread_id: string; message_id: string };
    const userId = req.user!.id;

    try {
      const t = await db().query('SELECT id FROM threads WHERE id = $1 AND user_id = $2', [thread_id, userId]);
      if (!t.rows[0]) return reply.status(404).send(oaiError('Thread not found', 'invalid_request_error', 'not_found'));

      const res = await db().query('SELECT * FROM thread_messages WHERE id = $1 AND thread_id = $2', [message_id, thread_id]);
      if (!res.rows[0]) return reply.status(404).send(oaiError('Message not found', 'invalid_request_error', 'not_found'));

      const r = res.rows[0];
      return reply.send({
        id: r.id, object: 'thread.message',
        created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        thread_id, role: r.role, content: r.content,
        assistant_id: r.assistant_id ?? null, run_id: r.run_id ?? null, metadata: r.metadata,
      });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RUNS
  // ════════════════════════════════════════════════════════════════════════════

  // POST /v1/threads/:thread_id/runs
  app.post('/v1/threads/:thread_id/runs', async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const userId = req.user!.id;

    const parsed = runCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(oaiError(parsed.error.issues[0].message));

    const {
      assistant_id, model: runModel, instructions: runInstructions,
      additional_instructions, temperature, top_p, max_completion_tokens, metadata, stream,
    } = parsed.data;

    // Verify thread
    let thread: { id: string } | null = null;
    try {
      const t = await db().query('SELECT id FROM threads WHERE id = $1 AND user_id = $2', [thread_id, userId]);
      thread = t.rows[0] ?? null;
    } catch { /* handled below */ }
    if (!thread) return reply.status(404).send(oaiError(`Thread '${thread_id}' not found`, 'invalid_request_error', 'not_found'));

    // Verify assistant
    let assistant: { model: string; instructions: string | null; tools: unknown[]; temperature: number | null; top_p: number | null } | null = null;
    try {
      const a = await db().query('SELECT * FROM assistants WHERE id = $1 AND user_id = $2', [assistant_id, userId]);
      assistant = a.rows[0] ?? null;
    } catch { /* handled below */ }
    if (!assistant) return reply.status(404).send(oaiError(`Assistant '${assistant_id}' not found`, 'invalid_request_error', 'not_found'));

    // Create run record
    const id        = runId();
    const createdAt = now();

    try {
      await db().query(
        `INSERT INTO runs (id, thread_id, assistant_id, user_id, status, model, instructions, metadata, created_at)
         VALUES ($1,$2,$3,$4,'in_progress',$5,$6,$7,to_timestamp($8))`,
        [id, thread_id, assistant_id, userId,
         runModel ?? assistant.model,
         runInstructions ?? assistant.instructions ?? null,
         JSON.stringify(metadata), createdAt]
      );
    } catch (err) {
      logger.error({ err }, 'Failed to create run');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    // Process run asynchronously
    processRun({
      runId: id, threadId: thread_id, assistantId: assistant_id,
      userId, assistant,
      overrideModel: runModel ?? undefined,
      overrideInstructions: runInstructions ?? additional_instructions ?? undefined,
      temperature: temperature ?? assistant.temperature ?? undefined,
      top_p: top_p ?? assistant.top_p ?? undefined,
      maxTokens: max_completion_tokens ?? undefined,
    }).catch(err => logger.error({ err, runId: id }, 'Run processing failed'));

    const runObj = {
      id, object: 'thread.run', created_at: createdAt,
      thread_id, assistant_id, status: 'in_progress',
      model: runModel ?? assistant.model,
      instructions: runInstructions ?? assistant.instructions ?? null,
      tools: assistant.tools ?? [],
      metadata, started_at: createdAt,
      expires_at: createdAt + 600,
      cancelled_at: null, failed_at: null, completed_at: null,
      required_action: null, last_error: null,
      usage: null,
    };

    // SSE streaming
    if (stream) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.removeHeader('Content-Length');

      const send = (event: string, data: unknown) =>
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      send('thread.run.created',     runObj);
      send('thread.run.in_progress', { ...runObj, status: 'in_progress' });

      // Poll for completion (max 30 seconds)
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await db().query('SELECT * FROM runs WHERE id = $1', [id]);
          const run = res.rows[0];
          if (run?.status === 'completed') {
            // Fetch the latest assistant message
            const msgs = await db().query(
              `SELECT * FROM thread_messages WHERE thread_id = $1 AND run_id = $2 AND role = 'assistant' ORDER BY created_at DESC LIMIT 1`,
              [thread_id, id]
            );
            if (msgs.rows[0]) {
              send('thread.message.created', {
                id: msgs.rows[0].id, object: 'thread.message', thread_id,
                role: 'assistant', content: msgs.rows[0].content,
                assistant_id, run_id: id,
                created_at: Math.floor(new Date(msgs.rows[0].created_at).getTime() / 1000),
              });
            }
            send('thread.run.completed', {
              ...runObj, status: 'completed',
              completed_at: Math.floor(new Date(run.completed_at ?? Date.now()).getTime() / 1000),
              usage: run.usage,
            });
            clearInterval(interval);
            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
          } else if (run?.status === 'failed' || attempts > 60) {
            send('thread.run.failed', { ...runObj, status: 'failed', failed_at: now() });
            clearInterval(interval);
            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
          }
        } catch { clearInterval(interval); reply.raw.end(); }
      }, 500);

      return reply;
    }

    return reply.send(runObj);
  });

  // GET /v1/threads/:thread_id/runs/:run_id
  app.get('/v1/threads/:thread_id/runs/:run_id', async (req, reply) => {
    const { thread_id, run_id } = req.params as { thread_id: string; run_id: string };
    const userId = req.user!.id;
    try {
      const res = await db().query('SELECT * FROM runs WHERE id = $1 AND thread_id = $2 AND user_id = $3', [run_id, thread_id, userId]);
      if (!res.rows[0]) return reply.status(404).send(oaiError('Run not found', 'invalid_request_error', 'not_found'));
      const r = res.rows[0];
      return reply.send({
        id: r.id, object: 'thread.run',
        created_at:   Math.floor(new Date(r.created_at).getTime() / 1000),
        thread_id, assistant_id: r.assistant_id,
        status: r.status, model: r.model, instructions: r.instructions,
        tools: [], metadata: r.metadata,
        started_at:    r.started_at    ? Math.floor(new Date(r.started_at).getTime() / 1000)   : null,
        completed_at:  r.completed_at  ? Math.floor(new Date(r.completed_at).getTime() / 1000) : null,
        failed_at:     r.failed_at     ? Math.floor(new Date(r.failed_at).getTime() / 1000)    : null,
        cancelled_at:  r.cancelled_at  ? Math.floor(new Date(r.cancelled_at).getTime() / 1000) : null,
        expires_at:    Math.floor(new Date(r.created_at).getTime() / 1000) + 600,
        required_action: null, last_error: r.last_error ?? null,
        usage: r.usage ?? null,
      });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // GET /v1/threads/:thread_id/runs
  app.get('/v1/threads/:thread_id/runs', async (req, reply) => {
    const { thread_id } = req.params as { thread_id: string };
    const userId = req.user!.id;
    const { limit = '20', order = 'desc' } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    try {
      const res = await db().query(
        `SELECT * FROM runs WHERE thread_id = $1 AND user_id = $2 ORDER BY created_at ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT $3`,
        [thread_id, userId, lim]
      );
      const data = res.rows.map(r => ({
        id: r.id, object: 'thread.run',
        created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        thread_id, assistant_id: r.assistant_id, status: r.status, model: r.model,
        instructions: r.instructions, tools: [], metadata: r.metadata,
        completed_at: r.completed_at ? Math.floor(new Date(r.completed_at).getTime() / 1000) : null,
        failed_at: r.failed_at ? Math.floor(new Date(r.failed_at).getTime() / 1000) : null,
        usage: r.usage ?? null,
      }));
      return reply.send({ object: 'list', data, first_id: data[0]?.id ?? null, last_id: data[data.length - 1]?.id ?? null, has_more: data.length === lim });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // POST /v1/threads/:thread_id/runs/:run_id/cancel
  app.post('/v1/threads/:thread_id/runs/:run_id/cancel', async (req, reply) => {
    const { thread_id, run_id } = req.params as { thread_id: string; run_id: string };
    const userId = req.user!.id;
    try {
      await db().query(
        `UPDATE runs SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1 AND thread_id = $2 AND user_id = $3`,
        [run_id, thread_id, userId]
      );
      const res = await db().query('SELECT * FROM runs WHERE id = $1', [run_id]);
      const r = res.rows[0];
      return reply.send({ id: r.id, object: 'thread.run', status: 'cancelled', thread_id, assistant_id: r.assistant_id, model: r.model });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FILES
  // ════════════════════════════════════════════════════════════════════════════

  // POST /v1/files — accepts JSON { filename, purpose, content_base64 }
  app.post('/v1/files', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const filename = String(body?.filename ?? 'file.txt');
    const purpose  = String(body?.purpose  ?? 'assistants');
    const content  = body?.content_base64 as string | undefined;

    if (!content) {
      // Try multipart
      try {
        const { file, fields } = await parseMultipartForFiles(req);
        if (!file) return reply.status(400).send(oaiError("Missing 'file' content"));
        const id_       = fileId();
        const createdAt = now();
        const userId    = req.user!.id;
        await db().query(
          `INSERT INTO files (id, user_id, filename, purpose, content, size, created_at) VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7))`,
          [id_, userId, fields.filename ?? file.filename, fields.purpose ?? purpose, file.buffer, file.buffer.length, createdAt]
        );
        return reply.send({ id: id_, object: 'file', created_at: createdAt, filename: file.filename, purpose: fields.purpose ?? purpose, bytes: file.buffer.length, status: 'processed' });
      } catch {
        return reply.status(400).send(oaiError("Missing 'content_base64' or multipart 'file' field"));
      }
    }

    const buffer    = Buffer.from(content, 'base64');
    const id_       = fileId();
    const createdAt = now();
    const userId    = req.user!.id;

    try {
      await db().query(
        `INSERT INTO files (id, user_id, filename, purpose, content, size, created_at) VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7))`,
        [id_, userId, filename, purpose, buffer, buffer.length, createdAt]
      );
    } catch (err) {
      logger.error({ err }, 'Failed to upload file');
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }

    return reply.send({ id: id_, object: 'file', created_at: createdAt, filename, purpose, bytes: buffer.length, status: 'processed' });
  });

  // GET /v1/files
  app.get('/v1/files', async (req, reply) => {
    const userId = req.user!.id;
    const { purpose, limit = '20' } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    try {
      const res = purpose
        ? await db().query(`SELECT id,filename,purpose,size,created_at FROM files WHERE user_id=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT $3`, [userId, purpose, lim])
        : await db().query(`SELECT id,filename,purpose,size,created_at FROM files WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, [userId, lim]);
      const data = res.rows.map(r => ({
        id: r.id, object: 'file',
        created_at: Math.floor(new Date(r.created_at).getTime() / 1000),
        filename: r.filename, purpose: r.purpose, bytes: r.size, status: 'processed',
      }));
      return reply.send({ object: 'list', data });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // GET /v1/files/:file_id
  app.get('/v1/files/:file_id', async (req, reply) => {
    const { file_id } = req.params as { file_id: string };
    const userId = req.user!.id;
    try {
      const res = await db().query(`SELECT id,filename,purpose,size,created_at FROM files WHERE id=$1 AND user_id=$2`, [file_id, userId]);
      if (!res.rows[0]) return reply.status(404).send(oaiError('File not found', 'invalid_request_error', 'not_found'));
      const r = res.rows[0];
      return reply.send({ id: r.id, object: 'file', created_at: Math.floor(new Date(r.created_at).getTime() / 1000), filename: r.filename, purpose: r.purpose, bytes: r.size, status: 'processed' });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // GET /v1/files/:file_id/content
  app.get('/v1/files/:file_id/content', async (req, reply) => {
    const { file_id } = req.params as { file_id: string };
    const userId = req.user!.id;
    try {
      const res = await db().query(`SELECT content, filename FROM files WHERE id=$1 AND user_id=$2`, [file_id, userId]);
      if (!res.rows[0]) return reply.status(404).send(oaiError('File not found', 'invalid_request_error', 'not_found'));
      const { content, filename } = res.rows[0];
      reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      reply.raw.setHeader('Content-Length', content.length.toString());
      reply.raw.end(content);
      return reply;
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });

  // DELETE /v1/files/:file_id
  app.delete('/v1/files/:file_id', async (req, reply) => {
    const { file_id } = req.params as { file_id: string };
    const userId = req.user!.id;
    try {
      await db().query('DELETE FROM files WHERE id=$1 AND user_id=$2', [file_id, userId]);
      return reply.send({ id: file_id, object: 'file', deleted: true });
    } catch (err) {
      return reply.status(500).send(oaiError('Internal error', 'api_error', 'internal_error'));
    }
  });
}

// ── Background run processor ──────────────────────────────────────────────────
async function processRun(opts: {
  runId: string;
  threadId: string;
  assistantId: string;
  userId: string;
  assistant: { model: string; instructions: string | null; tools: unknown[]; temperature: number | null; top_p: number | null };
  overrideModel?: string;
  overrideInstructions?: string;
  temperature?: number;
  top_p?: number;
  maxTokens?: number;
}): Promise<void> {
  const db_ = getPool();

  try {
    // Fetch all thread messages
    const msgsRes = await db_.query(
      `SELECT role, content FROM thread_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [opts.threadId]
    );

    const messages = msgsRes.rows.map(r => {
      const contentArr = r.content as Array<{ type: string; text?: { value: string } }>;
      const text = contentArr
        .filter(c => c.type === 'text')
        .map(c => c.text?.value ?? '')
        .join('\n');
      return { role: r.role as 'system' | 'user' | 'assistant', content: text };
    });

    // Prepend system instructions
    const sysInstructions = opts.overrideInstructions ?? opts.assistant.instructions;
    const fullMessages = sysInstructions
      ? [{ role: 'system' as const, content: sysInstructions }, ...messages]
      : messages;

    const result = await chatCompletion(fullMessages, {
      model:       opts.overrideModel ?? opts.assistant.model,
      temperature: opts.temperature,
      top_p:       opts.top_p,
      max_tokens:  opts.maxTokens,
    });

    // Store assistant reply
    const id        = `msg_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const contentArr = [{ type: 'text', text: { value: result.content ?? '', annotations: [] } }];

    await db_.query(
      `INSERT INTO thread_messages (id, thread_id, role, content, assistant_id, run_id, metadata, created_at)
       VALUES ($1,$2,'assistant',$3,$4,$5,'{}',to_timestamp($6))`,
      [id, opts.threadId, JSON.stringify(contentArr), opts.assistantId, opts.runId, createdAt]
    );

    // Mark run completed
    await db_.query(
      `UPDATE runs SET status = 'completed', completed_at = NOW(),
       usage = $1 WHERE id = $2`,
      [JSON.stringify({ prompt_tokens: result.promptTokens, completion_tokens: result.completionTokens, total_tokens: result.promptTokens + result.completionTokens }), opts.runId]
    );
  } catch (err) {
    logger.error({ err, runId: opts.runId }, 'Run processing error');
    await db_.query(
      `UPDATE runs SET status = 'failed', failed_at = NOW(), last_error = $1 WHERE id = $2`,
      [JSON.stringify({ code: 'server_error', message: String(err) }), opts.runId]
    ).catch(() => {});
  }
}

// ── Minimal multipart helper for file uploads ─────────────────────────────────
async function parseMultipartForFiles(req: import('fastify').FastifyRequest): Promise<{
  file?: { buffer: Buffer; filename: string; mimetype: string };
  fields: Record<string, string>;
}> {
  const mp = req as unknown as { parts(): AsyncIterable<{
    type: 'file' | 'field';
    fieldname: string;
    filename?: string;
    mimetype?: string;
    value?: string;
    toBuffer?: () => Promise<Buffer>;
  }> };
  const fields: Record<string, string> = {};
  let fileResult: { buffer: Buffer; filename: string; mimetype: string } | undefined;

  for await (const part of mp.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer!();
      fileResult = { buffer, filename: part.filename ?? 'file', mimetype: part.mimetype ?? 'application/octet-stream' };
    } else {
      fields[part.fieldname] = part.value ?? '';
    }
  }
  return { file: fileResult, fields };
}
