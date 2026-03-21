import { FastifyInstance } from 'fastify';
import { z }               from 'zod';
import { getPool }         from '../db/postgres';
import { verifyFirebaseToken } from '../middleware/firebaseAuth.middleware';
import { chatCompletion }  from '../services/llm.service';
import { logger }          from '../utils/logger';

export async function chatRoutes(app: FastifyInstance) {

  // ── List conversations ─────────────────────────────────────────────────────
  app.get('/chat/conversations', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string; title: string; model: string; created_at: string; updated_at: string;
    }>(
      `SELECT id, title, model, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 100`,
      [req.user!.id],
    );
    return reply.send({ conversations: rows });
  });

  // ── Create conversation ────────────────────────────────────────────────────
  const createSchema = z.object({
    model: z.string().default('eior-chat'),
    title: z.string().max(255).optional(),
  });

  app.post('/chat/conversations', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request body' });

    const { model, title } = parsed.data;
    const pool = getPool();
    const { rows } = await pool.query<{ id: string; title: string; model: string; created_at: string }>(
      `INSERT INTO conversations (user_id, title, model)
       VALUES ($1, $2, $3)
       RETURNING id, title, model, created_at`,
      [req.user!.id, title ?? 'New conversation', model],
    );
    return reply.status(201).send({ conversation: rows[0] });
  });

  // ── Get single conversation ────────────────────────────────────────────────
  app.get('/chat/conversations/:id', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, title, model, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id],
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Conversation not found' });
    return reply.send({ conversation: rows[0] });
  });

  // ── Update conversation title ──────────────────────────────────────────────
  const patchSchema = z.object({ title: z.string().max(255) });

  app.patch('/chat/conversations/:id', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request body' });

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE conversations SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, model, updated_at`,
      [parsed.data.title, id, req.user!.id],
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Conversation not found' });
    return reply.send({ conversation: rows[0] });
  });

  // ── Delete conversation ────────────────────────────────────────────────────
  app.delete('/chat/conversations/:id', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const pool = getPool();
    const { rowCount } = await pool.query(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id],
    );
    if (!rowCount) return reply.status(404).send({ error: 'Conversation not found' });
    return reply.status(204).send();
  });

  // ── Get messages for a conversation ───────────────────────────────────────
  app.get('/chat/conversations/:id/messages', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const pool = getPool();

    // Verify ownership
    const convRes = await pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id],
    );
    if (!convRes.rows[0]) return reply.status(404).send({ error: 'Conversation not found' });

    const { rows } = await pool.query(
      `SELECT id, role, content, created_at FROM conversation_messages
       WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    return reply.send({ messages: rows });
  });

  // ── Send a message + get AI reply ─────────────────────────────────────────
  const attachmentSchema = z.union([
    z.object({ type: z.literal('image'), name: z.string(), mimeType: z.string(), base64: z.string().max(20_000_000) }),
    z.object({ type: z.literal('text'),  name: z.string(), content: z.string().max(500_000) }),
  ]);

  const msgSchema = z.object({
    content:     z.string().max(32_000).default(''),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens:  z.number().int().min(1).max(8192).optional(),
    top_p:       z.number().min(0).max(1).optional(),
    attachments: z.array(attachmentSchema).max(10).optional(),
  });

  app.post('/chat/conversations/:id/messages', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = msgSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request body' });

    const pool = getPool();

    // Verify ownership + get conversation model
    const convRes = await pool.query<{ model: string; title: string }>(
      `SELECT model, title FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id],
    );
    if (!convRes.rows[0]) return reply.status(404).send({ error: 'Conversation not found' });
    const { model, title } = convRes.rows[0];

    const { content, attachments, temperature, max_tokens, top_p } = parsed.data;

    // Build the user message content (text + images for LLM context)
    let llmUserContent: any = content;
    let storedContent       = content;   // what we save to DB (text only)

    if (attachments?.length) {
      const parts: any[] = [];

      // Prepend text file contents into the text part
      let textPrefix = '';
      for (const att of attachments) {
        if (att.type === 'text') {
          textPrefix += `[File: ${att.name}]\n\`\`\`\n${att.content.slice(0, 50_000)}\n\`\`\`\n\n`;
        }
      }

      const fullText = (textPrefix + content).trim();
      if (fullText) parts.push({ type: 'text', text: fullText });
      storedContent = fullText || content;

      // Add image parts
      for (const att of attachments) {
        if (att.type === 'image') {
          parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.base64}` } });
          storedContent += (storedContent ? '\n' : '') + `[Image: ${att.name}]`;
        }
      }

      // Auto-upgrade model to vision if image attached
      if (attachments.some(a => a.type === 'image') && model === 'eior-chat') {
        await pool.query(`UPDATE conversations SET model = 'eior-vision' WHERE id = $1`, [id]);
      }

      llmUserContent = parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
    }

    // Insert user message (store text summary, not raw base64)
    const userMsgRes = await pool.query<{ id: string; created_at: string }>(
      `INSERT INTO conversation_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2) RETURNING id, created_at`,
      [id, storedContent],
    );

    // Load last 20 messages as context for LLM
    const historyRes = await pool.query<{ role: string; content: string }>(
      `SELECT role, content FROM conversation_messages
       WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20`,
      [id],
    );
    // Replace the last message content with the full structured content (with images)
    const messages = historyRes.rows.map((r, i) =>
      i === historyRes.rows.length - 1
        ? { role: r.role as 'user' | 'assistant', content: llmUserContent }
        : { role: r.role as 'user' | 'assistant', content: r.content }
    );

    // Call LLM
    let aiContent = '';
    try {
      const result = await chatCompletion(messages, {
        model,
        temperature,
        max_tokens,
        top_p,
      });
      aiContent = result.content ?? '';
    } catch (err) {
      logger.error({ err }, 'LLM call failed in chat route');
      return reply.status(503).send({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    // Insert assistant message
    const asstMsgRes = await pool.query<{ id: string; created_at: string }>(
      `INSERT INTO conversation_messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2) RETURNING id, created_at`,
      [id, aiContent],
    );

    // Update conversation timestamp
    await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [id]);

    // Auto-title: if still default, set from first user message (first exchange only)
    if (title === 'New conversation') {
      const autoTitle = content.slice(0, 60).trim().replace(/\n/g, ' ')
        || (attachments?.length ? attachments[0].name : 'New conversation');
      await pool.query(
        `UPDATE conversations SET title = $1 WHERE id = $2`,
        [autoTitle || 'New conversation', id],
      );
    }

    return reply.send({
      userMessage: {
        id:         userMsgRes.rows[0].id,
        role:       'user',
        content:    storedContent,
        created_at: userMsgRes.rows[0].created_at,
      },
      message: {
        id:         asstMsgRes.rows[0].id,
        role:       'assistant',
        content:    aiContent,
        created_at: asstMsgRes.rows[0].created_at,
      },
    });
  });
}
