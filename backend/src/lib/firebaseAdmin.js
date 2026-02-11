import admin from 'firebase-admin';
import { config } from '../config.js';

let app = null;

export function getFirebaseAdmin() {
  if (app) return app;
  if (admin.apps.length > 0) return admin.apps[0];

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (clientEmail && privateKey) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Use default credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS env or Google Cloud env)
    app = admin.initializeApp({ projectId });
  }
  return app;
}

export async function verifyFirebaseToken(idToken) {
  const auth = getFirebaseAdmin().auth();
  const decoded = await auth.verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email || '',
    name: decoded.name || decoded.email || 'User',
  };
}
