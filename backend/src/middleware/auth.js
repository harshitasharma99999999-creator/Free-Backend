import { getAuth } from '../config/firebase.js';
import { ensureUser } from '../utils/firestore.js';

/**
 * Middleware: validate Firebase ID token from Authorization: Bearer <token>.
 * Attaches req.user = { uid, email } and ensures user doc exists in Firestore.
 */
export async function requireFirebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Provide: Bearer <Firebase ID token>' });
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Empty token' });
  }

  // Step 1: Verify the Firebase ID token (pure auth check — separate from Firestore)
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired Firebase token', detail: err.message });
  }

  req.user = { uid: decoded.uid, email: decoded.email || '' };

  // Step 2: Lazily create user in Firestore (non-fatal — don't block the request if this fails)
  try {
    await ensureUser(decoded.uid, decoded.email || '');
  } catch (err) {
    console.error('[auth] ensureUser failed (non-fatal):', err.message);
    // Still allow the request — the user exists in Firebase Auth even if Firestore fails
  }

  next();
}
