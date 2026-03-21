import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyFirebaseToken } from '../middleware/firebaseAuth.middleware';
import {
  createApiKey, getKeysByUser, revokeApiKey,
  rotateApiKey, countActiveKeys,
} from '../models/apiKey.model';
import { config } from '../utils/config';

const createSchema = z.object({ name: z.string().min(1).max(100).trim() });

export async function keyRoutes(app: FastifyInstance): Promise<void> {
  // All key routes require Firebase auth
  app.addHook('preHandler', verifyFirebaseToken);

  // GET /v1/keys
  app.get('/v1/keys', async (req, reply) => {
    const keys = await getKeysByUser(req.user!.id);
    return reply.send({ keys });
  });

  // POST /v1/keys — create a new API key
  app.post('/v1/keys', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        code:  'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    const count = await countActiveKeys(req.user!.id);
    if (count >= config.API_KEY_MAX_PER_USER) {
      return reply.status(400).send({
        error: `You have reached the limit of ${config.API_KEY_MAX_PER_USER} active API keys.`,
        code:  'KEY_LIMIT_REACHED',
      });
    }

    const key = await createApiKey(req.user!.id, parsed.data.name);

    return reply.status(201).send({
      key: {
        id:        key.id,
        name:      key.name,
        key:       key.plaintext,   // ← shown exactly ONCE
        prefix:    key.key_prefix,
        createdAt: key.created_at,
      },
      warning: 'Save this key now — it will never be shown again.',
    });
  });

  // DELETE /v1/keys/:id — revoke a key
  app.delete('/v1/keys/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await revokeApiKey(id, req.user!.id);

    return ok
      ? reply.send({ message: 'API key revoked successfully.' })
      : reply.status(404).send({ error: 'Key not found or already revoked.', code: 'KEY_NOT_FOUND' });
  });

  // PUT /v1/keys/:id/rotate — atomically revoke + issue a new key
  app.put('/v1/keys/:id/rotate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const newKey = await rotateApiKey(id, req.user!.id);

    if (!newKey) {
      return reply.status(404).send({ error: 'Key not found.', code: 'KEY_NOT_FOUND' });
    }

    return reply.send({
      key: {
        id:        newKey.id,
        name:      newKey.name,
        key:       newKey.plaintext,
        prefix:    newKey.key_prefix,
        createdAt: newKey.created_at,
      },
      warning: 'Save this key now — it will never be shown again.',
    });
  });
}
