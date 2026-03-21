import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../db/redis';
import { config } from '../utils/config';

/**
 * Redis sliding-window rate limiter.
 * Applies per API key (if present) or per IP address.
 * Limits: RATE_LIMIT_RPM requests per 60-second window.
 */
export async function rateLimitByKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const redis  = getRedis();
  const id     = request.apiKey?.id ?? request.ip;
  const minute = Math.floor(Date.now() / 60_000);
  const key    = `rl:${id}:${minute}`;
  const limit  = config.RATE_LIMIT_RPM;

  // Atomic increment + set TTL
  const [[, count]] = (await redis
    .pipeline()
    .incr(key)
    .expire(key, 90) // 90 s gives buffer beyond the minute window
    .exec()) as [[null, number], [null, number]];

  const remaining = Math.max(0, limit - count);
  const resetAt   = (minute + 1) * 60;

  reply.header('X-RateLimit-Limit',     limit);
  reply.header('X-RateLimit-Remaining', remaining);
  reply.header('X-RateLimit-Reset',     resetAt);

  if (count > limit) {
    reply.header('Retry-After', '60');
    return void reply.status(429).send({
      error: {
        message: 'Rate limit reached. You are sending requests too quickly. Please retry after 60 seconds.',
        type:    'requests',
        param:   null,
        code:    'rate_limit_exceeded',
      },
    });
  }
}
