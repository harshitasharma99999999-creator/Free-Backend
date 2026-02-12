// Vercel serverless handler — maximally defensive
// Uses dynamic import so any crash in app.js is caught, not a top-level crash

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = import('../src/app.js')
      .then((mod) => mod.buildApp())
      .catch((err) => {
        console.error('[INIT] buildApp failed:', err);
        appPromise = null; // allow retry on next invocation
        throw err;
      });
  }
  return appPromise;
}

export default async function handler(req, res) {
  // Set CORS headers for every response (even errors)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let fastify;
  try {
    fastify = await getApp();
  } catch (err) {
    console.error('[HANDLER] App init error:', err);
    return res.status(500).json({
      error: 'Backend initialisation failed',
      message: err.message || String(err),
      hint: 'Check Vercel Runtime Logs → likely MongoDB Atlas IP whitelist or env var issue.',
    });
  }

  try {
    const rawPath = req.query?.path;
    const joinedPath = Array.isArray(rawPath)
      ? rawPath.join('/')
      : typeof rawPath === 'string'
        ? rawPath
        : '';

    let url = req.url || '';
    if (joinedPath) {
      const normalized = `/api/${joinedPath}`;
      // In some Vercel invocations nested paths arrive partially in req.url.
      if (!url || !url.includes(joinedPath)) {
        url = normalized;
      }
    }
    if (!url || url === '/') url = '/api';
    if (!url.startsWith('/api')) {
      url = joinedPath ? `/api/${joinedPath}` : '/api';
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
    const headers = response.headers;
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        // Skip transfer-encoding and CORS headers (we handle CORS ourselves above)
        if (k === 'transfer-encoding') continue;
        if (k.startsWith('access-control-')) continue;
        res.setHeader(k, v);
      }
    }
    res.end(response.payload);
  } catch (err) {
    console.error('[HANDLER] Request error:', err);
    res.status(500).json({
      error: 'Server error',
      message: err.message || 'Unknown error',
    });
  }
}
