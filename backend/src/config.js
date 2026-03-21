import 'dotenv/config';

function normalizeMongoUri(input, env) {
  const trimmed = (input || '').trim();
  // In production/serverless, defaulting to localhost breaks cold-starts and causes
  // "Backend initialisation failed" when MONGODB_URI isn't provided.
  if (!trimmed) return env === 'development' ? 'mongodb://localhost:27017/free-api' : null;

  try {
    const uri = new URL(trimmed);
    // fastify-mongodb expects a default db; add one when URI points only to cluster root.
    if (!uri.pathname || uri.pathname === '/') {
      uri.pathname = '/free-api';
    }
    return uri.toString();
  } catch {
    return trimmed;
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  mongodb: {
    uri: normalizeMongoUri(process.env.MONGODB_URI, process.env.NODE_ENV || 'development'),
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
  ollama: {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, ''),
    model: process.env.OLLAMA_MODEL || 'eior',
    embeddingsModel: process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text',
    imageGenUrl: process.env.IMAGE_GEN_URL ? process.env.IMAGE_GEN_URL.replace(/\/+$/, '') : null,
    // Some Ollama builds reject non-local Host headers; for tunnels (ngrok, localtunnel, etc.)
    // set this to "localhost" or "localhost:11434" if you see 403s from /api/*.
    hostHeader: process.env.OLLAMA_HOST_HEADER || null,
    // Optional: bypass runtime DNS by connecting to these IPs while keeping Host/SNI set to the tunnel hostname.
    // Useful when serverless runtimes can’t resolve dynamic tunnel hostnames (e.g. *.trycloudflare.com).
    connectIps: (process.env.OLLAMA_CONNECT_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
  },
  // EIOR OpenAI-compatible endpoint configuration (used by /eior/v1/* routes)
  // Maps public EIOR model IDs to the underlying Ollama model names.
  // Override via env vars if you run multiple Ollama models.
  eior: {
    ollamaModelMap: {
      'eior-v1': process.env.EIOR_OLLAMA_MODEL_V1 || process.env.OLLAMA_MODEL || 'eior',
      'eior-advanced': process.env.EIOR_OLLAMA_MODEL_ADVANCED || process.env.EIOR_OLLAMA_MODEL_V1 || process.env.OLLAMA_MODEL || 'eior',
      'eior-coder': process.env.EIOR_OLLAMA_MODEL_CODER || process.env.EIOR_OLLAMA_MODEL_ADVANCED || process.env.OLLAMA_MODEL || 'eior',
      // Image generation is handled via Replicate, but we keep the model ID here for discovery.
      'eior-image-gen': 'replicate',
    },
  },
  replicate: {
    apiToken:   process.env.REPLICATE_API_TOKEN || null,
    imageModel: process.env.REPLICATE_IMAGE_MODEL || 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e68b3d3616b828cff195886de25b873531be3b8b6be8e9e2e',
    videoModel: process.env.REPLICATE_VIDEO_MODEL || 'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351',
    creditCost: {
      image: parseInt(process.env.CREDIT_COST_IMAGE || '1', 10),
      video: parseInt(process.env.CREDIT_COST_VIDEO || '5', 10),
    },
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'free-backed',
    // For server-side verification. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use GOOGLE_APPLICATION_CREDENTIALS.
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
};
