/**
 * API client for the EIOR backend.
 * Auth: exchanges the Firebase ID token for a backend JWT on first use,
 * caches it in sessionStorage, and sends it as Authorization: Bearer.
 */
import { firebaseAuth } from '@/lib/firebase';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const JWT_KEY = 'eior_backend_jwt';

// ─── Types ─────────────────────────────────────────────────────────────────

export type User = { id: string; email: string; name: string };

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  imageCredits: number;
  videoCredits: number;
  createdAt?: string;
};

export type ApiKeyPreview = {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  usageCount: number;
  active?: boolean;
};

export type ApiKeyCreated = {
  key: string;
  name: string;
  keyPreview: string;
  createdAt: string;
};

export type UsageLog = {
  type: 'image' | 'video' | 'api';
  provider?: string;
  cost?: number;
  timestamp: string;
};

export type ClientUser = {
  id: string;
  email: string;
  name?: string;
  appName?: string;
  appId?: string;
  createdAt?: string;
};

// ─── JWT helpers ────────────────────────────────────────────────────────────

function storedJwt(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(JWT_KEY);
}

function storeJwt(token: string) {
  if (typeof window !== 'undefined') sessionStorage.setItem(JWT_KEY, token);
}

async function getBackendJwt(): Promise<string> {
  const cached = storedJwt();
  if (cached) return cached;

  const fb = firebaseAuth.currentUser;
  if (!fb) throw new Error('Not signed in');

  const idToken = await fb.getIdToken();
  const res = await fetch(`${API_URL}/api/auth/firebase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(d.error || 'Failed to authenticate with backend');
  }
  const data = await res.json() as { token: string };
  storeJwt(data.token);
  return data.token;
}

// Clear cached JWT on sign-out so next login gets a fresh one
if (typeof window !== 'undefined') {
  firebaseAuth.onAuthStateChanged((user) => {
    if (!user) sessionStorage.removeItem(JWT_KEY);
  });
}

// ─── Request helper ─────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token: string;
  try {
    token = await getBackendJwt();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    throw new Error(`Authentication required: ${errorMessage}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  // Token may have expired — clear and retry once
  if (res.status === 401) {
    sessionStorage.removeItem(JWT_KEY);
    try {
      const newToken = await getBackendJwt();
      const retry = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...(options.headers as Record<string, string>),
        },
      });
      
      if (!retry.ok) {
        const d = await retry.json().catch(() => ({})) as { error?: string; message?: string };
        const errorMsg = d.message || d.error || retry.statusText;
        throw new Error(errorMsg);
      }
      
      return await retry.json() as T;
    } catch (retryError) {
      const errorMessage = retryError instanceof Error ? retryError.message : 'Authentication failed';
      throw new Error(`Authentication required: ${errorMessage}`);
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
    const errorMsg = data.message || data.error || res.statusText;
    throw new Error(errorMsg);
  }
  
  return await res.json() as T;
}

// ─── Platform user ──────────────────────────────────────────────────────────

export const platformUser = {
  me: async (): Promise<{ user: PlatformUser }> => {
    const data = await request<{ user: User }>('/api/auth/me');
    return {
      user: {
        ...data.user,
        plan: 'free',
        imageCredits: 10,
        videoCredits: 2,
      },
    };
  },
};

// ─── API Keys ────────────────────────────────────────────────────────────────

export const keys = {
  list: (): Promise<{ keys: ApiKeyPreview[] }> =>
    request('/api/keys'),

  create: async (name?: string): Promise<ApiKeyCreated> => {
    try {
      const result = await request<ApiKeyCreated>('/api/keys', { 
        method: 'POST', 
        body: JSON.stringify({ name: name || 'My App' }) 
      });
      return result;
    } catch (error) {
      // Provide more specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('Authentication required')) {
          throw new Error('Please sign in to create API keys.');
        }
        if (error.message.includes('Maximum of 5 active API keys')) {
          throw new Error('You have reached the maximum of 5 API keys. Please revoke an existing key first.');
        }
        if (error.message.includes('Database unavailable')) {
          throw new Error('Service temporarily unavailable. Please try again in a moment.');
        }
      }
      throw error;
    }
  },

  revoke: async (id: string): Promise<{ message: string }> => {
    try {
      return await request(`/api/keys/${id}`, { method: 'DELETE' });
    } catch (error) {
      // Provide more specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('Key not found')) {
          throw new Error('API key not found or you do not have permission to revoke it.');
        }
        if (error.message.includes('Invalid key ID')) {
          throw new Error('Invalid API key ID provided.');
        }
        if (error.message.includes('Database unavailable')) {
          throw new Error('Service temporarily unavailable. Please try again in a moment.');
        }
      }
      throw error;
    }
  },
};

// ─── Usage ──────────────────────────────────────────────────────────────────

export const usage = {
  get: async (limit = 50): Promise<{ logs: UsageLog[] }> => {
    const data = await request<{ total: number; byDay: { date: string; count: number }[] }>('/api/usage');
    // Convert daily aggregates → synthetic log entries so the usage page renders correctly
    const logs: UsageLog[] = [];
    for (const day of data.byDay) {
      for (let i = 0; i < Math.min(day.count, limit); i++) {
        logs.push({ type: 'api', timestamp: `${day.date}T00:00:00.000Z`, cost: 1 });
      }
    }
    return { logs: logs.slice(0, limit) };
  },
};

// ─── Client users ────────────────────────────────────────────────────────────

export const clientUsers = {
  list: (): Promise<{ users: ClientUser[] }> =>
    request('/api/auth/client-users'),
};
