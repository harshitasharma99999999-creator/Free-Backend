import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from '../config.js';

let rateLimiter = null;
let redisWarned = false;

// In-memory sliding window fallback — used when Upstash Redis is not configured.
// Enforces the same limits as the Redis-backed limiter.
// NOTE: this state is per-process and resets on restart; not shared across instances.
const inMemoryWindows = new Map();

function inMemoryRateLimit(identifier) {
  const limit = config.rateLimit.requestsPerWindow;
  const windowMs = config.rateLimit.windowSeconds * 1000;
  const now = Date.now();

  if (!inMemoryWindows.has(identifier)) {
    inMemoryWindows.set(identifier, []);
  }

  const timestamps = inMemoryWindows.get(identifier);

  // Evict timestamps that have fallen outside the sliding window
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  const reset = now + windowMs;

  if (timestamps.length >= limit) {
    return { success: false, limit, remaining: 0, reset };
  }

  timestamps.push(now);
  const remaining = limit - timestamps.length;
  return { success: true, limit, remaining, reset };
}

export function getRateLimiter() {
  const url = config.upstash.redisRestUrl;
  const token = config.upstash.redisRestToken;
  if (!url || !token || /xxx|placeholder|your-/i.test(url) || /your-token/i.test(token)) {
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
    if (!redisWarned) {
      console.warn(
        '[rateLimit] Upstash Redis not configured — falling back to in-memory rate limiting. ' +
        'Limits reset on server restart and are NOT shared across instances. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent, distributed rate limiting.'
      );
      redisWarned = true;
    }
    return inMemoryRateLimit(identifier);
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
