import { buildApp } from '../src/app.js';

let appPromise = null;
function getApp() {
  if (!appPromise) appPromise = buildApp();
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const fastify = await getApp();
    let url = req.url || `/api/${(req.query.path || []).join('/')}`;
    if (url === '/' || url === '') url = '/api';
    const payload =
      req.method !== 'GET' && req.method !== 'HEAD'
        ? typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {})
        : undefined;
    const response = await fastify.inject({
      method: req.method,
      url,
      headers: req.headers,
      payload,
    });
    res.status(response.statusCode);
    const headers = response.headers;
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (k !== 'transfer-encoding') res.setHeader(k, v);
      }
    }
    res.end(response.payload);
  } catch (err) {
    console.error('API handler error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'Check Vercel logs. Ensure MONGODB_URI, JWT_SECRET, and Firebase env vars are set in Project Settings.',
    });
  }
}
