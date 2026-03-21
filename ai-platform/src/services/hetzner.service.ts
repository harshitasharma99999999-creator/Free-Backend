/**
 * Hetzner Cloud VPS service
 * API docs: https://docs.hetzner.cloud/
 * Free to use (pay-per-use, ~€3-10/mo per server)
 */

import { config } from '../utils/config';
import { logger } from '../utils/logger';

const BASE = 'https://api.hetzner.cloud/v1';

export const VPS_PLANS = {
  starter:  { serverType: 'cx11', cores: 1, memoryGb: 2,  diskGb: 20,  label: 'Starter',  price: '$4/mo'  },
  standard: { serverType: 'cx21', cores: 2, memoryGb: 4,  diskGb: 40,  label: 'Standard', price: '$7/mo'  },
  pro:      { serverType: 'cx31', cores: 2, memoryGb: 8,  diskGb: 80,  label: 'Pro',       price: '$13/mo' },
} as const;

export type VpsPlan = keyof typeof VPS_PLANS;

export function hetznerConfigured(): boolean {
  return !!config.HETZNER_API_TOKEN;
}

function headers() {
  return {
    'Authorization': `Bearer ${config.HETZNER_API_TOKEN}`,
    'Content-Type':  'application/json',
  };
}

async function hetznerRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Hetzner API ${res.status}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}

export interface HetznerServer {
  id: number;
  name: string;
  status: 'running' | 'off' | 'initializing' | 'starting' | 'stopping' | 'rebuilding' | 'migrating' | 'deleting' | 'unknown';
  public_net: {
    ipv4?: { ip: string };
    ipv6?: { ip: string };
  };
  server_type: { name: string; cores: number; memory: number; disk: number };
  created: string;
}

export async function createServer(opts: {
  name: string;
  plan: VpsPlan;
  location?: string;
  image?: string;
}): Promise<{ id: number; ip: string | null; status: string }> {
  const plan = VPS_PLANS[opts.plan];

  const body = {
    name:        opts.name,
    server_type: plan.serverType,
    image:       opts.image ?? 'ubuntu-22.04',
    location:    opts.location ?? 'fsn1',   // Falkenstein, Germany (fast, cheap)
    start_after_create: true,
    labels: { managed_by: 'eior' },
  };

  const data = await hetznerRequest<{ server: HetznerServer; action: { status: string } }>('POST', '/servers', body);

  return {
    id:     data.server.id,
    ip:     data.server.public_net.ipv4?.ip ?? null,
    status: data.server.status,
  };
}

export async function getServer(id: number): Promise<HetznerServer> {
  const data = await hetznerRequest<{ server: HetznerServer }>('GET', `/servers/${id}`);
  return data.server;
}

export async function powerOnServer(id: number): Promise<void> {
  await hetznerRequest('POST', `/servers/${id}/actions/poweron`);
}

export async function powerOffServer(id: number): Promise<void> {
  await hetznerRequest('POST', `/servers/${id}/actions/poweroff`);
}

export async function deleteServer(id: number): Promise<void> {
  await hetznerRequest('DELETE', `/servers/${id}`);
}

export function mapHetznerStatus(status: string): 'running' | 'stopped' | 'creating' | 'error' {
  switch (status) {
    case 'running':    return 'running';
    case 'off':        return 'stopped';
    case 'initializing':
    case 'starting':
    case 'rebuilding':
    case 'migrating':  return 'creating';
    case 'stopping':   return 'stopped';
    default:           return 'error';
  }
}
