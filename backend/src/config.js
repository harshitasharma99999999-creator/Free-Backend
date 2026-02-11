import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/free-api',
  },
  upstash: {
    redisRestUrl: process.env.UPSTASH_REDIS_REST_URL,
    redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((o) => o.trim()),
  },
  rateLimit: {
    // Per API key: 100 requests per 60 seconds (free tier)
    requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'free-backed',
    // For server-side verification. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use GOOGLE_APPLICATION_CREDENTIALS.
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
};
