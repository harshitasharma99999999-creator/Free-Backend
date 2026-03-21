import { getApiKey, getUser } from '../utils/firestore.js';

/**
 * Middleware: validate API key from Authorization: Bearer <api_key>.
 * Attaches req.apiKeyDoc and req.user (from Firestore) for downstream use.
 */
export async function requireApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key',
      message: 'Include your API key in: Authorization: Bearer YOUR_API_KEY',
    });
  }

  const key = authHeader.slice(7).trim();
  if (!key) {
    return res.status(401).json({ error: 'Empty API key' });
  }

  try {
    const keyDoc = await getApiKey(key);
    if (!keyDoc) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    if (!keyDoc.active) {
      return res.status(403).json({ error: 'API key has been revoked' });
    }

    const user = await getUser(keyDoc.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found for this API key' });
    }

    req.apiKey = key;
    req.apiKeyDoc = keyDoc;
    req.user = user;
    next();
  } catch (err) {
    console.error('API key auth error:', err);
    return res.status(500).json({ error: 'Internal server error during API key validation' });
  }
}
