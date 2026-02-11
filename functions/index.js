const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const JWT_SECRET = process.env.JWT_SECRET || functions.config().jwt?.secret || 'free-api-default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || functions.config().cors?.origins || 'https://free-backed.web.app').split(',').map((o) => o.trim());

const PREFIX = 'fk_';
const KEY_LENGTH = 32;
function generateApiKey() {
  return PREFIX + nanoid(KEY_LENGTH);
}
function isValidApiKeyFormat(key) {
  return typeof key === 'string' && key.startsWith(PREFIX) && key.length === PREFIX.length + KEY_LENGTH;
}

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function verifyFirebaseToken(idToken) {
  const decoded = await admin.auth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email || '',
    name: decoded.name || decoded.email || 'User',
  };
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
}

const app = express();
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

// POST /api/auth/firebase
app.post('/api/auth/firebase', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });
    const decoded = await verifyFirebaseToken(idToken);
    const usersRef = db.collection('users');
    const byUid = await usersRef.where('firebaseUid', '==', decoded.uid).limit(1).get();
    let userDoc, userId;
    if (byUid.empty) {
      const ref = await usersRef.add({
        firebaseUid: decoded.uid,
        email: (decoded.email || '').toLowerCase() || null,
        name: decoded.name || 'User',
        password: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userId = ref.id;
      userDoc = (await ref.get()).data();
      userDoc.id = userId;
    } else {
      userId = byUid.docs[0].id;
      userDoc = byUid.docs[0].data();
      userDoc.id = userId;
    }
    const userPayload = {
      id: userId,
      email: userDoc.email || decoded.email || '',
      name: userDoc.name || decoded.name || 'User',
    };
    const token = jwt.sign(
      { sub: userPayload.id, email: userPayload.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ user: userPayload, token });
  } catch (err) {
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticate, async (req, res) => {
  const doc = await db.collection('users').doc(req.user.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'User not found' });
  const u = doc.data();
  res.json({
    user: {
      id: doc.id,
      email: u.email || '',
      name: u.name || 'User',
    },
  });
});

// POST /api/keys
app.post('/api/keys', authenticate, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  const key = generateApiKey();
  const ref = await db.collection('api_keys').add({
    userId: req.user.id,
    name: name.trim(),
    key,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.status(201).json({
    id: ref.id,
    name: name.trim(),
    key,
    createdAt: new Date().toISOString(),
  });
});

// GET /api/keys
app.get('/api/keys', authenticate, async (req, res) => {
  const snap = await db.collection('api_keys').where('userId', '==', req.user.id).get();
  const keys = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      keyPreview: 'fk_••••••••••••',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
    };
  });
  res.json({ keys });
});

// DELETE /api/keys/:id
app.delete('/api/keys/:id', authenticate, async (req, res) => {
  const ref = db.collection('api_keys').doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().userId !== req.user.id) {
    return res.status(404).json({ error: 'API key not found' });
  }
  await ref.delete();
  res.status(204).send();
});

// GET /api/usage
app.get('/api/usage', authenticate, async (req, res) => {
  const days = Math.min(90, parseInt(req.query.days, 10) || 30);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const keySnap = await db.collection('api_keys').where('userId', '==', req.user.id).get();
  const keyIds = keySnap.docs.map((d) => d.id);
  const usageSnap = await db.collection('usage')
    .where('apiKeyId', 'in', keyIds.length ? keyIds.slice(0, 10) : ['_']) // Firestore 'in' max 10
    .get();
  const byDayMap = {};
  let total = 0;
  usageSnap.docs.forEach((d) => {
    const data = d.data();
    const date = data.date?.toDate?.();
    if (date && date >= since && keyIds.includes(data.apiKeyId)) {
      const day = date.toISOString().slice(0, 10);
      byDayMap[day] = (byDayMap[day] || 0) + (data.count || 0);
      total += data.count || 0;
    }
  });
  if (keyIds.length > 10) {
    for (let i = 10; i < keyIds.length; i += 10) {
      const chunk = keyIds.slice(i, i + 10);
      const more = await db.collection('usage').where('apiKeyId', 'in', chunk).get();
      more.docs.forEach((d) => {
        const data = d.data();
        const date = data.date?.toDate?.();
        if (date && date >= since) {
          const day = date.toISOString().slice(0, 10);
          byDayMap[day] = (byDayMap[day] || 0) + (data.count || 0);
          total += data.count || 0;
        }
      });
    }
  }
  const byDay = Object.entries(byDayMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  res.json({ total, byDay });
});

// Public API middleware (API key + usage)
async function publicApiMiddleware(req, res, next) {
  const rawKey = req.headers['x-api-key'] || req.query?.apiKey;
  if (!rawKey) {
    return res.status(401).json({ error: 'Missing API key', message: 'Provide X-API-Key header or apiKey query parameter.' });
  }
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!isValidApiKeyFormat(key)) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }
  const keySnap = await db.collection('api_keys').where('key', '==', key).limit(1).get();
  if (keySnap.empty) return res.status(401).json({ error: 'Invalid API key' });
  const keyDoc = keySnap.docs[0];
  req.apiKey = { _id: keyDoc.id, ...keyDoc.data() };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const usageRef = db.collection('usage').doc(`${keyDoc.id}_${today.toISOString().slice(0, 10)}`);
  const usageDoc = await usageRef.get();
  if (usageDoc.exists) {
    await usageRef.update({ count: admin.firestore.FieldValue.increment(1) });
  } else {
    await usageRef.set({ apiKeyId: keyDoc.id, date: admin.firestore.Timestamp.fromDate(today), count: 1 });
  }
  next();
}

app.get('/api/public/v1/health', publicApiMiddleware, (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/public/v1/echo', publicApiMiddleware, (req, res) => {
  res.json({
    echo: req.query.message || 'Hello from Free API',
    received: new Date().toISOString(),
  });
});
app.get('/api/public/v1/random', publicApiMiddleware, (req, res) => {
  const min = Math.floor(Number(req.query.min)) || 0;
  const max = Math.floor(Number(req.query.max)) || 100;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const value = Math.floor(lo + Math.random() * (hi - lo + 1));
  res.json({ value, min: lo, max: hi });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Free API',
    version: '1.0',
    public: '/api/public/v1',
  });
});

exports.api = onRequest(app);
