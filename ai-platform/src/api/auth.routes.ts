import { FastifyInstance } from 'fastify';
import { verifyFirebaseToken } from '../middleware/firebaseAuth.middleware';
import { getUserSummary, getRecentUsage } from '../models/usage.model';
import { countActiveKeys } from '../models/apiKey.model';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/sync
  // Firebase ID token → upsert user in PostgreSQL → return user record
  app.post('/auth/sync', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    return reply.send({ user: req.user });
  });

  // GET /auth/me
  // Firebase ID token → user + usage stats
  app.get('/auth/me', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const userId = req.user!.id;

    const [usage, activeKeys] = await Promise.all([
      getUserSummary(userId),
      countActiveKeys(userId),
    ]);

    return reply.send({ user: req.user, usage, activeKeys });
  });

  // GET /auth/usage
  // Returns the last 50 usage log entries for the authenticated user
  app.get('/auth/usage', { preHandler: verifyFirebaseToken }, async (req, reply) => {
    const logs = await getRecentUsage(req.user!.id, 50);
    return reply.send({ logs });
  });
}
