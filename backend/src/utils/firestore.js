import { getFirestore } from '../config/firebase.js';
import { env } from '../config/env.js';

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUser(uid) {
  const db = getFirestore();
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? { uid, ...doc.data() } : null;
}

export async function createUser(uid, email, plan = 'free') {
  const db = getFirestore();
  const credits = env.plans[plan] || env.plans.free;
  const data = {
    email,
    plan,
    imageCredits: credits.imageCredits,
    videoCredits: credits.videoCredits,
    createdAt: new Date().toISOString(),
  };
  await db.collection('users').doc(uid).set(data);
  return { uid, ...data };
}

export async function ensureUser(uid, email) {
  let user = await getUser(uid);
  if (!user) user = await createUser(uid, email);
  return user;
}

export async function updateUserCredits(uid, imageCredits, videoCredits) {
  const db = getFirestore();
  await db.collection('users').doc(uid).update({ imageCredits, videoCredits });
}

export async function upgradePlan(uid, plan) {
  const db = getFirestore();
  const credits = env.plans[plan] || env.plans.free;
  await db.collection('users').doc(uid).update({
    plan,
    imageCredits: credits.imageCredits,
    videoCredits: credits.videoCredits,
  });
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export async function createApiKey(uid, key, name = 'My App') {
  const db = getFirestore();
  const data = {
    key,
    name,
    userId: uid,
    usageCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.collection('apiKeys').doc(key).set(data);
  return data;
}

export async function getApiKey(key) {
  const db = getFirestore();
  const doc = await db.collection('apiKeys').doc(key).get();
  return doc.exists ? doc.data() : null;
}

export async function listApiKeys(uid) {
  const db = getFirestore();
  // No orderBy — avoids requiring a composite Firestore index; we sort in memory instead
  const snap = await db.collection('apiKeys').where('userId', '==', uid).get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        ...data,
        keyPreview: data.key.slice(0, 10) + '...' + data.key.slice(-4),
      };
    })
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function revokeApiKey(key, uid) {
  const db = getFirestore();
  const doc = await db.collection('apiKeys').doc(key).get();
  if (!doc.exists) return false;
  if (doc.data().userId !== uid) return false;
  await db.collection('apiKeys').doc(key).update({ active: false });
  return true;
}

export async function incrementKeyUsage(key) {
  const db = getFirestore();
  const ref = db.collection('apiKeys').doc(key);
  await ref.update({ usageCount: (await ref.get()).data().usageCount + 1 });
}

// ─── Usage Logs ───────────────────────────────────────────────────────────────

export async function logUsage({ userId, apiKey, type, provider, cost }) {
  const db = getFirestore();
  await db.collection('usageLogs').add({
    userId,
    apiKey,
    type,
    provider,
    cost,
    timestamp: new Date().toISOString(),
  });
}

export async function getUserUsageLogs(uid, limit = 50) {
  const db = getFirestore();
  // Avoid composite index requirement — sort in memory after fetch
  const snap = await db.collection('usageLogs').where('userId', '==', uid).get();
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
    .slice(0, limit);
}
