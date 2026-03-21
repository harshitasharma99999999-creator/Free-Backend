const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || res.statusText);
  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────
export const auth = {
  firebase: (idToken: string) =>
    api<{ user: User; token: string }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  me: () => api<{ user: User }>('/api/auth/me'),
};

// ─── API Keys ────────────────────────────────────────────────────────
export const keys = {
  list: () => api<{ keys: ApiKeyPreview[] }>('/api/keys'),
  create: (name: string) =>
    api<ApiKeyCreated>('/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  revoke: (id: string) =>
    api<null>(`/api/keys/${id}`, { method: 'DELETE' }),
};

// ─── Usage ───────────────────────────────────────────────────────────
export const usage = {
  get: (days?: number) =>
    api<{ total: number; byDay: { date: string; count: number }[] }>(
      days ? `/api/usage?days=${days}` : '/api/usage'
    ),
};

// ─── Payments ────────────────────────────────────────────────────────
export const payments = {
  createCheckout: (plan: 'pro' | 'enterprise') =>
    api<{ checkoutUrl: string; sessionId: string }>('/api/payments/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
  simulateUpgrade: (plan: 'pro' | 'enterprise') =>
    api<{ success: boolean; plan: string; imageCredits: number; videoCredits: number }>(
      '/api/payments/simulate-upgrade',
      {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }
    ),
};

// ─── Types ───────────────────────────────────────────────────────────
export type User = {
  id: string;
  email: string;
  name: string;
  plan?: string;
  imageCredits?: number;
  videoCredits?: number;
};

export type ApiKeyPreview = {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
};

export type ApiKeyCreated = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
};
