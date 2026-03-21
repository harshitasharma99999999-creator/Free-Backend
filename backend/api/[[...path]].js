/**
 * Vercel serverless handler — serves the Fastify app for all routes.
 * Updated to work with Fastify instead of Express.
 */

let appPromise = null;

function getFastifyApp() {
  if (!appPromise) {
    appPromise = import('../src/server.js')
      .then((mod) => mod.default())
      .catch((err) => {
        console.error('[INIT] Fastify server failed:', err);
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-API-Key',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(req, res) {
  // Allow any origin (CORS is also handled inside Fastify, but set here as safety)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  let fastifyApp;
  try {
    fastifyApp = await getFastifyApp();
  } catch (err) {
    console.error('[HANDLER] App init error:', err);
    return res.status(500).json({
      error: 'Backend initialisation failed',
      message: err.message,
      hint: 'Check Vercel Runtime Logs for env var or Firebase credential issues.',
    });
  }

  // Let Fastify handle the native Node request/response streams.
  // This avoids re-serializing payloads and fixes "Invalid JSON" issues.
  try {
    await new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      fastifyApp.server.emit('request', req, res);
    });
  } catch (error) {
    console.error('[HANDLER] Request processing error:', error);
    res.status(500).json({
      error: 'Request processing failed',
      message: error.message,
    });
  }
}
