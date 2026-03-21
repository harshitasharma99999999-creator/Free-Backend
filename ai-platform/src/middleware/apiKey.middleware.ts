import { FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from '../models/apiKey.model';
import { getUserById } from '../models/user.model';

const oaiError = (message: string, type = 'authentication_error', code: string | null = null) => ({
  error: { message, type, param: null, code },
});

export async function verifyApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = request.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return void reply.status(401).send(
      oaiError('No API key provided. Include `Authorization: Bearer sk-...` header.', 'authentication_error', 'missing_api_key')
    );
  }

  const rawKey = auth.slice(7);

  if (!rawKey.startsWith('sk-')) {
    return void reply.status(401).send(
      oaiError('Invalid API key format. Keys must begin with sk-.', 'authentication_error', 'invalid_api_key')
    );
  }

  const key = await validateApiKey(rawKey);
  if (!key) {
    return void reply.status(401).send(
      oaiError('Incorrect API key provided. You can find your API keys in the dashboard.', 'authentication_error', 'invalid_api_key')
    );
  }

  const user = await getUserById(key.user_id);
  if (!user) {
    return void reply.status(401).send(
      oaiError('User account not found.', 'authentication_error', 'user_not_found')
    );
  }

  request.apiKey = { id: key.id, userId: user.id, name: key.name };
  request.user   = { id: user.id, firebaseUid: user.firebase_uid, email: user.email, plan: user.plan };
}
