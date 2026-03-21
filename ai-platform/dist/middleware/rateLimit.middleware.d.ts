import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Redis sliding-window rate limiter.
 * Applies per API key (if present) or per IP address.
 * Limits: RATE_LIMIT_RPM requests per 60-second window.
 */
export declare function rateLimitByKey(request: FastifyRequest, reply: FastifyReply): Promise<void>;
