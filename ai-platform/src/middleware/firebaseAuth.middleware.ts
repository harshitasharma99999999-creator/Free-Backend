import { FastifyRequest, FastifyReply } from 'fastify';
import * as admin from 'firebase-admin';
import { upsertUser } from '../models/user.model';
import { logger } from '../utils/logger';

// Augment Fastify's request type globally
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      firebaseUid: string;
      email: string;
      plan: string;
    };
    apiKey?: {
      id: string;
      userId: string;
      name: string;
    };
  }
}

const oaiError = (message: string, type = 'invalid_request_error', code: string | null = null) => ({
  error: { message, type, param: null, code },
});

export async function verifyFirebaseToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = request.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return void reply.status(401).send(
      oaiError('Missing Authorization: Bearer <firebase-id-token> header', 'authentication_error', 'missing_auth')
    );
  }

  try {
    const decoded = await admin.auth().verifyIdToken(auth.slice(7));
    const user    = await upsertUser(decoded.uid, decoded.email ?? '');

    request.user = {
      id:          user.id,
      firebaseUid: user.firebase_uid,
      email:       user.email,
      plan:        user.plan,
    };
  } catch (err) {
    logger.warn({ err }, 'Firebase token verification failed');
    return void reply.status(401).send(
      oaiError('Invalid or expired Firebase ID token', 'authentication_error', 'invalid_token')
    );
  }
}
