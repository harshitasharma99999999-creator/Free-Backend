import admin from 'firebase-admin';
import { createVerify } from 'crypto';
import { config } from '../config.js';

// ─── Firebase Admin (used when service account credentials are available) ─────

let app = null;

export function getFirebaseAdmin() {
  if (app) return app;
  if (admin.apps.length > 0) return admin.apps[0];

  const { projectId, clientEmail, privateKey } = config.firebase;
  try {
    if (clientEmail && privateKey) {
      app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      app = admin.initializeApp({ projectId });
    }
  } catch {
    // May already be initialized in warm Vercel instances
    if (admin.apps.length > 0) return admin.apps[0];
    throw new Error('Firebase Admin initialization failed');
  }
  return app;
}

// ─── Manual Firebase token verification (no service account needed) ───────────
// Firebase ID tokens are RS256 JWTs. Public certs are at a public Google endpoint.

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = null;
let certCacheExpiry = 0;

async function fetchFirebaseCerts() {
  if (certCache && Date.now() < certCacheExpiry) return certCache;

  const res = await fetch(FIREBASE_CERTS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error('Failed to fetch Firebase public certs');

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3_600_000;

  certCache = await res.json();
  certCacheExpiry = Date.now() + maxAgeMs;
  return certCache;
}

function b64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function verifyFirebaseTokenManually(idToken) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  if (payload.iat > now + 300) throw new Error('Token issued in the future');

  const projectId = config.firebase.projectId;
  if (payload.aud !== projectId) {
    throw new Error(`Token audience mismatch (expected ${projectId})`);
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid token issuer');
  }

  const certs = await fetchFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error(`Unknown key ID: ${header.kid}`);

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  const valid = verifier.verify(cert, b64urlDecode(parts[2]));
  if (!valid) throw new Error('Invalid token signature');

  const uid = payload.sub || payload.user_id;
  if (!uid) throw new Error('Token missing subject (uid)');

  return {
    uid,
    email: payload.email || '',
    name: payload.name || payload.email || 'User',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function verifyFirebaseToken(idToken) {
  // Try Firebase Admin first (works when service account is configured)
  try {
    const auth = getFirebaseAdmin().auth();
    const decoded = await auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email || 'User',
    };
  } catch {
    // Fall back to manual verification — works without service account credentials
  }

  // Manual verification using Google's public key endpoint (no credentials needed)
  return verifyFirebaseTokenManually(idToken);
}
