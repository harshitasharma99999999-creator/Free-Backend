import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Global rate limiter: 60 req/min per IP
export const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key if present, fall back to IP
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const key = auth.slice(7).trim();
      if (key) return `apikey:${key}`;
    }
    return req.ip;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Max ${env.rateLimit.max} requests per minute.`,
      retryAfter: 60,
    });
  },
});

// Stricter limiter for generation endpoints: 20 req/min
export const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const key = auth.slice(7).trim();
      if (key) return `gen:${key}`;
    }
    return `gen:${req.ip}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many generation requests',
      message: 'Max 20 generation requests per minute. Please slow down.',
      retryAfter: 60,
    });
  },
});
