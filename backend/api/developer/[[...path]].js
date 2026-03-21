import { buildApp } from '../../src/app.js';

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = buildApp().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

function extractJoinedPath(req) {
  const query = req.query || {};
  const raw =
    query.path ??
    query['[...path]'] ??
    query['...path'] ??
    query['[[...path]]'];

  if (Array.isArray(raw)) return raw.join('/');
  if (typeof raw === 'string') return raw;
  return '';
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const fastify = await getApp();
    const joinedPath = extractJoinedPath(req).replace(/^\/+/, '');
    let url = (req.url || '').split('?')[0];
    if (joinedPath) {
      url = `/api/developer/${joinedPath}`;
    }
    if (!url || url === '/') url = '/api/developer';
    if (!url.startsWith('/api/developer')) {
      url = `/api/developer${url.startsWith('/') ? url : `/${url}`}`;
    }

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
    for (const [k, v] of Object.entries(response.headers || {})) {
      if (k === 'transfer-encoding' || k.startsWith('access-control-')) continue;
      res.setHeader(k, v);
    }
    res.end(response.payload);
  } catch (err) {
    res.status(500).json({ error: 'Server error', message: err.message || 'Unknown error' });
  }
}
