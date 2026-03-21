import { config } from '../utils/config';
import { logger } from '../utils/logger';

// ── VPS plan definitions ───────────────────────────────────────────────────────
export const VPS_PLANS = {
  starter:  { cores: 1, memoryMb: 1024, diskGb: 20,  label: 'Starter',  price: 'Free' },
  standard: { cores: 2, memoryMb: 2048, diskGb: 40,  label: 'Standard', price: '$5/mo' },
  pro:      { cores: 4, memoryMb: 4096, diskGb: 80,  label: 'Pro',      price: '$10/mo' },
} as const;

export type VpsPlan = keyof typeof VPS_PLANS;

export interface VMCreateOptions {
  vmid:     number;
  name:     string;
  plan:     VpsPlan;
}

export interface VMStatus {
  vmid:   number;
  status: 'running' | 'stopped' | 'unknown';
  uptime?: number;
  cpu?:    number;
  mem?:    number;
}

// ── Proxmox API helper ────────────────────────────────────────────────────────
function isConfigured(): boolean {
  return !!(config.PROXMOX_HOST && config.PROXMOX_TOKEN_ID && config.PROXMOX_TOKEN_SECRET);
}

async function proxmoxFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  if (!isConfigured()) throw new Error('Proxmox is not configured on this server');

  const url = `${config.PROXMOX_HOST}/api2/json${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `PVEAPIToken=${config.PROXMOX_TOKEN_ID}=${config.PROXMOX_TOKEN_SECRET}`,
      'Content-Type':  'application/json',
      ...(options.headers ?? {}),
    },
    // Proxmox uses self-signed certs in most setups
    // @ts-ignore
    agent: undefined,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Proxmox API ${res.status}: ${body}`);
  }

  const json = await res.json() as { data: unknown };
  return json.data;
}

// ── Get next available VMID ───────────────────────────────────────────────────
export async function getNextVmid(): Promise<number> {
  const data = await proxmoxFetch('/cluster/nextid') as string;
  return parseInt(data, 10);
}

// ── Create a new VM from cloud-init template ──────────────────────────────────
export async function createVM(opts: VMCreateOptions): Promise<void> {
  const node    = config.PROXMOX_NODE;
  const storage = config.PROXMOX_STORAGE;
  const tmplId  = config.PROXMOX_TEMPLATE_VMID;
  const plan    = VPS_PLANS[opts.plan];

  logger.info({ vmid: opts.vmid, plan: opts.plan }, 'Creating Proxmox VM');

  // Clone the template
  await proxmoxFetch(`/nodes/${node}/qemu/${tmplId}/clone`, {
    method: 'POST',
    body: JSON.stringify({
      newid:   opts.vmid,
      name:    opts.name,
      full:    1,
      storage,
    }),
  });

  // Wait briefly for clone to complete
  await new Promise(r => setTimeout(r, 3000));

  // Resize disk + set CPU/RAM
  await proxmoxFetch(`/nodes/${node}/qemu/${opts.vmid}/config`, {
    method: 'PUT',
    body: JSON.stringify({
      cores:   plan.cores,
      memory:  plan.memoryMb,
      sockets: 1,
    }),
  });

  // Resize disk to plan size
  await proxmoxFetch(`/nodes/${node}/qemu/${opts.vmid}/resize`, {
    method: 'PUT',
    body: JSON.stringify({ disk: 'scsi0', size: `${plan.diskGb}G` }),
  });
}

// ── Start a VM ────────────────────────────────────────────────────────────────
export async function startVM(vmid: number): Promise<void> {
  const node = config.PROXMOX_NODE;
  await proxmoxFetch(`/nodes/${node}/qemu/${vmid}/status/start`, { method: 'POST' });
}

// ── Stop a VM ─────────────────────────────────────────────────────────────────
export async function stopVM(vmid: number): Promise<void> {
  const node = config.PROXMOX_NODE;
  await proxmoxFetch(`/nodes/${node}/qemu/${vmid}/status/stop`, { method: 'POST' });
}

// ── Delete a VM ───────────────────────────────────────────────────────────────
export async function deleteVM(vmid: number): Promise<void> {
  const node = config.PROXMOX_NODE;
  // Stop first if running
  try { await stopVM(vmid); await new Promise(r => setTimeout(r, 2000)); } catch {}
  await proxmoxFetch(`/nodes/${node}/qemu/${vmid}`, { method: 'DELETE' });
}

// ── Get VM status ─────────────────────────────────────────────────────────────
export async function getVMStatus(vmid: number): Promise<VMStatus> {
  const node = config.PROXMOX_NODE;
  try {
    const data = await proxmoxFetch(`/nodes/${node}/qemu/${vmid}/status/current`) as {
      status: string; uptime?: number; cpu?: number; mem?: number;
    };
    return {
      vmid,
      status: data.status === 'running' ? 'running' : 'stopped',
      uptime: data.uptime,
      cpu:    data.cpu,
      mem:    data.mem,
    };
  } catch {
    return { vmid, status: 'unknown' };
  }
}

export { isConfigured as proxmoxConfigured };
