import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from '../config.js';

let rateLimiter = null;

export function getRateLimiter() {
  if (!config.upstash.redisRestUrl || !config.upstash.redisRestToken) {
    return null;
  }
  if (!rateLimiter) {
    const redis = new Redis({
      url: config.upstash.redisRestUrl,
      token: config.upstash.redisRestToken,
    });
    rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        config.rateLimit.requestsPerWindow,
        `${config.rateLimit.windowSeconds} s`
      ),
      analytics: true,
    });
  }
  return rateLimiter;
}

export async function checkRateLimit(identifier) {
  const limiter = getRateLimiter();
  if (!limiter) {
    return { success: true, limit: 0, remaining: 999, reset: 0 };
  }
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
