/**
 * VPS management routes — backed by Hetzner Cloud.
 * All routes require Firebase/JWT auth (Bearer token from frontend).
 * VPS records are stored in Firestore collection `vps_instances`.
 * Set HETZNER_API_TOKEN in env to enable provisioning.
 */

import { config } from '../config.js';

const HETZNER_BASE = 'https://api.hetzner.cloud/v1';

// Current Hetzner server types (cx11/cx21/cx31 are deprecated as of 2024)
const VPS_PLANS = {
  starter:  { serverType: 'cx22', cores: 2, memoryGb: 4,  diskGb: 40,  price: '~$4/mo'  },
  standard: { serverType: 'cx32', cores: 4, memoryGb: 8,  diskGb: 80,  price: '~$7/mo'  },
  pro:      { serverType: 'cx42', cores: 8, memoryGb: 16, diskGb: 160, price: '~$15/mo' },
};

// Cloud-init script: installs Ollama and sets it to listen on all interfaces
const CLOUD_INIT = `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
apt-get update -q
apt-get install -yq curl ca-certificates

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Allow Ollama to listen on all interfaces (needed for remote access)
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama

# Basic firewall: allow SSH and Ollama port
ufw allow 22/tcp
ufw allow 11434/tcp
ufw --force enable

echo "Ollama setup complete" >> /var/log/eior-setup.log
`;

function hetznerConfigured() {
  return !!config.hetzner?.apiToken;
}

function hetznerHeaders() {
  return {
    'Authorization': `Bearer ${config.hetzner.apiToken}`,
    'Content-Type': 'application/json',
  };
}

async function hetznerReq(method, path, body) {
  const res = await fetch(`${HETZNER_BASE}${path}`, {
    method,
    headers: hetznerHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json?.error?.message || json?.message || text;
    } catch {}
    throw new Error(`Hetzner ${res.status}: ${detail}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

function mapStatus(hetznerStatus) {
  switch (hetznerStatus) {
    case 'running':      return 'running';
    case 'off':          return 'stopped';
    case 'initializing':
    case 'starting':
    case 'rebuilding':
    case 'migrating':    return 'creating';
    case 'stopping':     return 'stopped';
    default:             return 'error';
  }
}

function getDb(fastify) {
  if (!fastify.db) throw new Error('Database unavailable');
  return fastify.db;
}

function docToVps(id, data) {
  return {
    id,
    name: data.name,
    plan: data.plan,
    cores: data.cores,
    memoryGb: data.memoryGb,
    diskGb: data.diskGb,
    ipAddress: data.ipAddress || null,
    status: data.status,
    image: data.image,
    hetznerError: data.hetznerError || null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
  };
}

export default async function vpsRoutes(fastify) {
  // All VPS routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // ── GET /api/vps — list instances ──────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    if (!hetznerConfigured()) {
      return reply.code(503).send({
        error: 'VPS provisioning not configured. Set HETZNER_API_TOKEN in your environment.',
        code: 'HETZNER_NOT_CONFIGURED',
      });
    }

    let db;
    try { db = getDb(fastify); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const uid = request.user.id;
    const snap = await db.collection('vps_instances')
      .where('userId', '==', uid)
      .get();

    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => d.status !== 'deleted')
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    return reply.send({ vps: docs.map((d) => docToVps(d.id, d)) });
  });

  // ── POST /api/vps — create a new VPS ───────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    if (!hetznerConfigured()) {
      return reply.code(503).send({
        error: 'VPS provisioning not configured. Set HETZNER_API_TOKEN in your environment.',
        code: 'HETZNER_NOT_CONFIGURED',
      });
    }

    const { name, plan } = request.body || {};

    if (!name || typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name) || name.length > 64) {
      return reply.code(400).send({ error: 'Name must be lowercase letters, numbers and dashes (max 64 chars).' });
    }
    if (!VPS_PLANS[plan]) {
      return reply.code(400).send({ error: 'Plan must be starter, standard, or pro.' });
    }

    let db;
    try { db = getDb(fastify); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const uid = request.user.id;

    // Max 3 VPS per user
    const existingSnap = await db.collection('vps_instances').where('userId', '==', uid).get();
    const activeCount = existingSnap.docs.filter((d) => d.data().status !== 'deleted').length;
    if (activeCount >= 3) {
      return reply.code(400).send({ error: 'Maximum 3 VPS instances per account.' });
    }

    const planConfig = VPS_PLANS[plan];
    const now = new Date();

    const docRef = await db.collection('vps_instances').add({
      userId: uid,
      hetznerServerId: 0,
      name,
      plan,
      cores: planConfig.cores,
      memoryGb: planConfig.memoryGb,
      diskGb: planConfig.diskGb,
      ipAddress: null,
      status: 'creating',
      image: 'ubuntu-22.04',
      createdAt: now,
      updatedAt: now,
    });

    const insertedId = docRef.id;

    // Provision asynchronously — don't block the HTTP response
    (async () => {
      try {
        const data = await hetznerReq('POST', '/servers', {
          name,
          server_type: planConfig.serverType,
          image: 'ubuntu-22.04',
          location: 'fsn1',
          start_after_create: true,
          user_data: CLOUD_INIT,
          labels: { managed_by: 'eior', user_id: uid },
        });

        const server = data.server;
        await db.collection('vps_instances').doc(insertedId).update({
          hetznerServerId: server.id,
          ipAddress: server.public_net?.ipv4?.ip ?? null,
          status: mapStatus(server.status),
          updatedAt: new Date(),
        });
        console.log(`[vps] Provisioned server ${server.id} for user ${uid}`);
      } catch (err) {
        console.error('[vps] Hetzner provisioning failed:', err.message);
        await db.collection('vps_instances').doc(insertedId).update({
          status: 'error',
          hetznerError: err.message,
          updatedAt: new Date(),
        });
      }
    })();

    return reply.code(202).send({
      message: 'VPS is being provisioned. Check back in ~60 seconds for the IP address.',
      vps: {
        id: insertedId,
        name,
        plan,
        cores: planConfig.cores,
        memoryGb: planConfig.memoryGb,
        diskGb: planConfig.diskGb,
        status: 'creating',
        image: 'ubuntu-22.04',
        ipAddress: null,
        createdAt: now,
      },
    });
  });

  // ── GET /api/vps/:id — get single VPS with live Hetzner status ─────────────
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    let db;
    try { db = getDb(fastify); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const uid = request.user.id;
    const docSnap = await db.collection('vps_instances').doc(id).get();
    if (!docSnap.exists) return reply.code(404).send({ error: 'VPS not found' });

    const data = docSnap.data();
    if (data.userId !== uid || data.status === 'deleted') {
      return reply.code(404).send({ error: 'VPS not found' });
    }

    // Sync live status from Hetzner
    if (hetznerConfigured() && data.hetznerServerId > 0) {
      try {
        const hData = await hetznerReq('GET', `/servers/${data.hetznerServerId}`);
        const liveStatus = mapStatus(hData.server.status);
        const liveIp = hData.server.public_net?.ipv4?.ip ?? data.ipAddress;
        await db.collection('vps_instances').doc(id).update({
          status: liveStatus,
          ipAddress: liveIp,
          updatedAt: new Date(),
        });
        data.status = liveStatus;
        data.ipAddress = liveIp;
      } catch (err) {
        console.warn('[vps] Could not fetch live Hetzner status:', err.message);
      }
    }

    return reply.send({ vps: docToVps(id, data) });
  });

  // ── POST /api/vps/:id/start ─────────────────────────────────────────────────
  fastify.post('/:id/start', async (request, reply) => {
    const { id } = request.params;
    let db;
    try { db = getDb(fastify); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const uid = request.user.id;
    const docSnap = await db.collection('vps_instances').doc(id).get();
    if (!docSnap.exists || docSnap.data().userId !== uid || docSnap.data().status === 'deleted') {
      return reply.code(404).send({ error: 'VPS not found' });
    }

    const data = docSnap.data();
    if (!hetznerConfigured() || !data.hetznerServerId) {
      return reply.code(400).send({ error: 'VPS has no Hetzner server ID yet.' });
    }

    try {
      await hetznerReq('POST', `/servers/${data.hetznerServerId}/actions/poweron`);
      await db.collection('vps_instances').doc(id).update({ status: 'running', updatedAt: new Date() });
      return reply.send({ message: 'VPS is starting.' });
    } catch (err) {
      return reply.code(502).send({ error: `Failed to start VPS: ${err.message}` });
    }
  });

  // ── POST /api/vps/:id/stop ──────────────────────────────────────────────────
  fastify.post('/:id/stop', async (request, reply) => {
    const { id } = request.params;
    let db;
    try { db = getDb(fastify); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const uid = request.user.id;
    const docSnap = await db.collection('vps_instances').doc(id).get();
    if (!docSnap.exists || docSnap.data().userId !== uid || docSnap.data().status === 'deleted') {
      return reply.code(404).send({ error: 'VPS not found' });
    }

    const data = docSnap.data();
    if (!hetznerConfigured() || !data.hetznerServerId) {
      return reply.code(400).send({ error: 'VPS has no Hetzner server ID yet.' });
    }

    try {
      await hetznerReq('POST', `/servers/${data.hetznerServerId}/actions/poweroff`);
      await db.collection('vps_instances').doc(id).update({ status: 'stopped', updatedAt: new Date() });
      return reply.send({ message: 'VPS is stopping.' });
    } catch (err) {
      return reply.code(502).send({ error: `Failed to stop VPS: ${err.message}` });
    }
  });

  // ── DELETE /api/vps/:id — destroy VPS ─────────────────────────────────────
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    let db;
    try { db = getDb(fastify); } catch {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const uid = request.user.id;
    const docSnap = await db.collection('vps_instances').doc(id).get();
    if (!docSnap.exists || docSnap.data().userId !== uid || docSnap.data().status === 'deleted') {
      return reply.code(404).send({ error: 'VPS not found' });
    }

    const data = docSnap.data();
    await db.collection('vps_instances').doc(id).update({ status: 'deleted', updatedAt: new Date() });

    // Delete Hetzner server async (fire and forget)
    if (hetznerConfigured() && data.hetznerServerId > 0) {
      hetznerReq('DELETE', `/servers/${data.hetznerServerId}`).catch((err) =>
        console.error('[vps] Failed to delete Hetzner server:', err.message),
      );
    }

    return reply.send({ message: 'VPS destroyed.' });
  });

  // ── GET /api/vps/plans — list available plans ─────────────────────────────
  fastify.get('/plans', async (_request, reply) => {
    return reply.send({
      plans: Object.entries(VPS_PLANS).map(([key, p]) => ({
        id: key,
        serverType: p.serverType,
        cores: p.cores,
        memoryGb: p.memoryGb,
        diskGb: p.diskGb,
        price: p.price,
      })),
    });
  });
}
