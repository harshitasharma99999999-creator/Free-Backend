'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Server, Plus, Play, Square, Trash2, Copy, Check,
  RefreshCw, Terminal, AlertCircle, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { backendFetch } from '@/lib/backendFetch';
import { getBackendJwt } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type VpsStatus = 'creating' | 'running' | 'stopped' | 'error';

interface VpsInstance {
  id: string;
  name: string;
  plan: 'starter' | 'standard' | 'pro';
  cores: number;
  memoryGb: number;
  diskGb: number;
  ipAddress: string | null;
  status: VpsStatus;
  image: string;
  hetznerError?: string | null;
  createdAt: string;
}

// Keep in sync with backend VPS_PLANS (cx22/cx32/cx42)
const PLANS = {
  starter:  { label: 'Starter',  price: '~$4/mo',  cores: 2, memoryGb: 4,  diskGb: 40,  desc: 'Run a small Ollama model (cx22 — 2 vCPU, 4 GB RAM)' },
  standard: { label: 'Standard', price: '~$7/mo',  cores: 4, memoryGb: 8,  diskGb: 80,  desc: 'Recommended for most OpenClaw workloads (cx32 — 4 vCPU, 8 GB RAM)' },
  pro:      { label: 'Pro',      price: '~$15/mo', cores: 8, memoryGb: 16, diskGb: 160, desc: 'Large models & heavy concurrent usage (cx42 — 8 vCPU, 16 GB RAM)' },
} as const;

async function vpsApi(path: string, init?: RequestInit) {
  let token: string;
  try {
    token = await getBackendJwt();
  } catch {
    throw new Error('Not signed in. Please refresh the page.');
  }
  return backendFetch(`/api/vps${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VpsStatus }) {
  const map: Record<VpsStatus, { label: string; cls: string }> = {
    running:  { label: 'Running',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    stopped:  { label: 'Stopped',  cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
    creating: { label: 'Creating', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    error:    { label: 'Error',    cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const { label, cls } = map[status] ?? map.error;
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', cls)}>
      {status === 'creating' && <Loader2 className="inline h-2.5 w-2.5 mr-1 animate-spin" />}
      {label}
    </span>
  );
}

// ─── IP copy button ───────────────────────────────────────────────────────────

function IpCopy({ ip }: { ip: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 font-mono text-xs text-[#8e8ea0] hover:text-white transition-colors group">
      <span>{ip}</span>
      {copied
        ? <Check className="h-3 w-3 text-emerald-400" />
        : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </button>
  );
}

// ─── OpenClaw setup instructions panel ───────────────────────────────────────

function OpenClawGuide({ ip }: { ip: string | null }) {
  const [open, setOpen] = useState(false);
  if (!ip) return null;
  const ollamaUrl = `http://${ip}:11434`;
  return (
    <div className="mt-3 rounded-xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#1a1a1a] hover:bg-white/5 transition-colors text-sm font-medium text-[#8e8ea0] hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" />
          OpenClaw setup guide
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-[#141414] text-xs leading-relaxed space-y-3 text-[#ececec]">
          <p className="text-[#8e8ea0]">Your VPS runs Ollama on port 11434. Point OpenClaw at it:</p>

          <div className="space-y-2">
            <p className="font-semibold text-white">1. Verify Ollama is up (~60s after creation)</p>
            <pre className="bg-[#0f0f0f] rounded-lg px-3 py-2 font-mono overflow-x-auto text-emerald-400">
{`curl http://${ip}:11434/api/tags`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-white">2. Pull your model (SSH in first)</p>
            <pre className="bg-[#0f0f0f] rounded-lg px-3 py-2 font-mono overflow-x-auto text-emerald-400">
{`ssh root@${ip}
ollama pull eior
ollama pull nomic-embed-text`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-white">3. Set in your backend environment</p>
            <pre className="bg-[#0f0f0f] rounded-lg px-3 py-2 font-mono overflow-x-auto text-emerald-400">
{`OLLAMA_BASE_URL=${ollamaUrl}
OLLAMA_MODEL=eior`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-white">4. OpenClaw API integration</p>
            <pre className="bg-[#0f0f0f] rounded-lg px-3 py-2 font-mono overflow-x-auto text-emerald-400">
{`// OpenClaw config:
baseURL: "${ollamaUrl}/v1"
model:   "eior"`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VPS card ─────────────────────────────────────────────────────────────────

function VpsCard({
  vps, onStart, onStop, onDestroy, onRefresh, actionLoading,
}: {
  vps: VpsInstance;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDestroy: (id: string, name: string) => void;
  onRefresh: (id: string) => void;
  actionLoading: string | null;
}) {
  const busy = actionLoading === vps.id;

  return (
    <div className="rounded-2xl border border-white/8 bg-[#171717] p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
            <Server className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white truncate">{vps.name}</p>
            <p className="text-xs text-[#8e8ea0]">{PLANS[vps.plan]?.label ?? vps.plan} · {vps.cores} vCPU · {vps.memoryGb} GB RAM · {vps.diskGb} GB</p>
          </div>
        </div>
        <StatusBadge status={vps.status} />
      </div>

      {/* Hetzner provisioning error */}
      {vps.status === 'error' && vps.hetznerError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{vps.hetznerError}</span>
        </div>
      )}

      {/* IP / provisioning notice */}
      <div className="text-xs">
        {vps.ipAddress
          ? <div className="flex items-center gap-1.5 text-[#8e8ea0]"><span>IP:</span><IpCopy ip={vps.ipAddress} /></div>
          : vps.status === 'creating'
            ? <span className="text-amber-400/80">Provisioning — IP will appear in ~30s</span>
            : vps.status === 'error'
              ? <span className="text-red-400/70">Provisioning failed — destroy and recreate</span>
              : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {vps.status === 'stopped' && (
          <button
            disabled={busy}
            onClick={() => onStart(vps.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Start
          </button>
        )}
        {vps.status === 'running' && (
          <button
            disabled={busy}
            onClick={() => onStop(vps.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/25 text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            Stop
          </button>
        )}
        {vps.status === 'creating' && (
          <button
            onClick={() => onRefresh(vps.id)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh status
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => onDestroy(vps.id, vps.name)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-medium transition-colors disabled:opacity-50 ml-auto"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Destroy
        </button>
      </div>

      <OpenClawGuide ip={vps.ipAddress} />
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, plan: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'starter' | 'standard' | 'pro'>('starter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Hostname is required.'); return; }
    if (!/^[a-z0-9-]+$/.test(name)) { setError('Only lowercase letters, numbers and dashes allowed.'); return; }
    setLoading(true);
    try {
      await onCreate(name.trim(), plan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create VPS');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New VPS Server</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-white/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Hostname */}
          <div>
            <label className="block text-xs font-medium text-[#8e8ea0] mb-1.5">Hostname</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-openclaw-server"
              className="w-full px-3 py-2 rounded-xl bg-[#0f0f0f] border border-white/10 text-sm text-white placeholder:text-[#8e8ea0] outline-none focus:border-indigo-500/50 transition-colors"
            />
            <p className="text-xs text-[#8e8ea0] mt-1">Lowercase letters, numbers and dashes</p>
          </div>

          {/* Plan */}
          <div>
            <label className="block text-xs font-medium text-[#8e8ea0] mb-1.5">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    plan === p
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-white/8 bg-[#0f0f0f] hover:border-white/15',
                  )}
                >
                  <p className="text-xs font-semibold text-white">{PLANS[p].label}</p>
                  <p className="text-xs text-indigo-400 font-medium mt-0.5">{PLANS[p].price}</p>
                  <p className="text-[10px] text-[#8e8ea0] mt-1">{PLANS[p].cores} vCPU · {PLANS[p].memoryGb} GB RAM</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-[#8e8ea0] mt-1.5">{PLANS[plan].desc}</p>
          </div>

          {/* Ollama info */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5 text-xs text-indigo-300">
            <p className="font-medium mb-0.5">Ollama is pre-installed</p>
            <p className="text-indigo-300/70">The VPS boots with Ollama on port 11434 (open to the internet). SSH in and run <code className="text-indigo-200">ollama pull eior</code> to load your model.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Provisioning…' : 'Provision VPS'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VpsPage() {
  const [instances, setInstances] = useState<VpsInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  const loadVps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await vpsApi('/');
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
        if (data.code === 'HETZNER_NOT_CONFIGURED') {
          setError('hetzner_not_configured');
        } else {
          setError(data.error || `Server error ${res.status}`);
        }
        return;
      }
      const data = await res.json() as { vps: VpsInstance[] };
      setInstances(data.vps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VPS instances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVps(); }, [loadVps]);

  // Auto-refresh 'creating' instances every 15s
  useEffect(() => {
    const hasCreating = instances.some((v) => v.status === 'creating');
    if (!hasCreating) return;
    const t = setInterval(loadVps, 15_000);
    return () => clearInterval(t);
  }, [instances, loadVps]);

  async function handleCreate(name: string, plan: string) {
    const res = await vpsApi('/', {
      method: 'POST',
      body: JSON.stringify({ name, plan }),
    });
    const data = await res.json() as { error?: string; vps?: VpsInstance };
    if (!res.ok) throw new Error(data.error || 'Failed to create VPS');
    showToast('VPS provisioning started! It will be ready in ~60 seconds.');
    await loadVps();
  }

  async function handleStart(id: string) {
    setActionLoading(id);
    try {
      const res = await vpsApi(`/${id}/start`, { method: 'POST' });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      showToast('VPS is starting…');
      setTimeout(loadVps, 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStop(id: string) {
    setActionLoading(id);
    try {
      const res = await vpsApi(`/${id}/stop`, { method: 'POST' });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      showToast('VPS is stopping…');
      setTimeout(loadVps, 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to stop');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDestroy(id: string, name: string) {
    if (!confirm(`Destroy "${name}"? This permanently deletes the server and all data on it.`)) return;
    setActionLoading(id);
    try {
      const res = await vpsApi(`/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      showToast('VPS destroyed.');
      await loadVps();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to destroy');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefresh(id: string) {
    setActionLoading(id);
    try {
      const res = await vpsApi(`/${id}`);
      if (!res.ok) return;
      const data = await res.json() as { vps: VpsInstance };
      setInstances((prev) => prev.map((v) => (v.id === id ? data.vps : v)));
    } finally {
      setActionLoading(null);
    }
  }

  const isHetznerError = error === 'hetzner_not_configured';
  const activeInstances = instances.filter((v) => v.status !== 'deleted');

  return (
    <div className="h-full overflow-y-auto bg-[#0f0f0f] px-6 py-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">VPS Instances</h1>
            <p className="text-sm text-[#8e8ea0]">
              Hetzner Cloud servers — run <span className="text-white">OpenClaw</span> with your own Ollama models
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!loading && !isHetznerError && (
              <button
                onClick={loadVps}
                className="p-2 rounded-xl text-[#8e8ea0] hover:text-white hover:bg-white/5 border border-white/8 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {!loading && !isHetznerError && (
              <button
                onClick={() => setShowCreate(true)}
                disabled={activeInstances.length >= 3}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                title={activeInstances.length >= 3 ? 'Maximum 3 VPS per account' : undefined}
              >
                <Plus className="h-3.5 w-3.5" />
                New Server
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-[#8e8ea0]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {/* Hetzner not configured */}
        {!loading && isHetznerError && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
            <h2 className="text-sm font-semibold text-white mb-1">Hetzner API token not configured</h2>
            <p className="text-xs text-[#8e8ea0] max-w-sm mx-auto mb-4">
              Set <code className="text-amber-400">HETZNER_API_TOKEN</code> in your backend environment variables to enable VPS provisioning.
            </p>
            <div className="rounded-xl bg-[#0f0f0f] border border-white/8 px-4 py-3 text-left inline-block">
              <p className="text-xs font-semibold text-[#8e8ea0] mb-1">How to get a token</p>
              <ol className="text-xs text-[#ececec] space-y-0.5 list-decimal list-inside">
                <li>Go to <span className="text-amber-400">console.hetzner.cloud</span></li>
                <li>Security → API Tokens → Generate Token</li>
                <li>Select Read &amp; Write permissions</li>
                <li>Add to your Vercel backend env vars</li>
              </ol>
            </div>
          </div>
        )}

        {/* Generic error with retry */}
        {!loading && error && !isHetznerError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center mb-4">
            <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <button
              onClick={loadVps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white transition-colors mx-auto"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && activeInstances.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Server className="h-7 w-7 text-indigo-400" />
            </div>
            <h2 className="text-sm font-semibold text-white mb-1">No servers yet</h2>
            <p className="text-xs text-[#8e8ea0] max-w-xs mb-5">
              Deploy your first VPS to run OpenClaw with full control over your AI models.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Deploy first server
            </button>
          </div>
        )}

        {/* VPS grid */}
        {!loading && activeInstances.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeInstances.map((vps) => (
                <VpsCard
                  key={vps.id}
                  vps={vps}
                  onStart={handleStart}
                  onStop={handleStop}
                  onDestroy={handleDestroy}
                  onRefresh={handleRefresh}
                  actionLoading={actionLoading}
                />
              ))}
            </div>

            {activeInstances.length < 3 && (
              <p className="text-xs text-[#8e8ea0] mt-4 text-center">
                {3 - activeInstances.length} of 3 server slot{3 - activeInstances.length !== 1 ? 's' : ''} remaining
              </p>
            )}
          </>
        )}

        {/* Info box */}
        {!loading && !isHetznerError && (
          <div className="mt-8 rounded-2xl border border-white/5 bg-[#141414] p-4 text-xs text-[#8e8ea0] space-y-1">
            <p className="font-semibold text-[#ececec]">How VPS + OpenClaw works</p>
            <p>1. Provision a VPS — Ollama is pre-installed automatically via cloud-init.</p>
            <p>2. SSH in and pull your model: <code className="text-emerald-400">ollama pull eior</code></p>
            <p>3. Set <code className="text-emerald-400">OLLAMA_BASE_URL=http://&lt;ip&gt;:11434</code> in your EIOR backend env.</p>
            <p>4. Redeploy the backend — chat routes to your private Ollama instance.</p>
            <p className="pt-1">Billing is per-second on Hetzner Cloud — destroy servers you no longer need.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2f2f2f] border border-white/10 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl z-50 max-w-sm text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
