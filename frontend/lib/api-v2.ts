/**
 * API client for the AI API Proxy Platform backend (v2 — Express/Firestore)
 * Every request that needs auth sends the Firebase ID token as Bearer.
 */
import { firebaseAuth } from '@/lib/firebase';

const API_URL =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function getIdToken(): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  useApiKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (useApiKey) {
    headers['Authorization'] = `Bearer ${useApiKey}`;
  } else {
    const token = await getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformUser = {
  uid: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  imageCredits: number;
  videoCredits: number;
  createdAt: string;
};

export type ApiKeyDoc = {
  keyPreview: string;
  userId: string;
  usageCount: number;
  active: boolean;
  createdAt: string;
};

export type UsageLog = {
  userId: string;
  apiKey: string;
  type: 'image' | 'video';
  provider: string;
  cost: number;
  timestamp: string;
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const platformUsers = {
  me: () => request<{ user: PlatformUser }>('/api/users/me'),
  usage: (limit = 50) =>
    request<{ logs: UsageLog[] }>(`/api/users/usage?limit=${limit}`),
};

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const platformKeys = {
  generate: () =>
    request<{ message: string; key: string; createdAt: string }>('/api/keys', { method: 'POST' }),
  list: () => request<{ keys: ApiKeyDoc[] }>('/api/keys'),
  revoke: (key: string) =>
    request<{ message: string }>(`/api/keys/${key}`, { method: 'DELETE' }),
};

// ─── Generation (uses API key as auth) ───────────────────────────────────────

export const generate = {
  image: (apiKey: string, prompt: string, opts?: { width?: number; height?: number; negativePrompt?: string }) =>
    request<{
      success: boolean;
      imageUrl: string;
      prompt: string;
      model: string;
      creditsUsed: number;
      imageCreditsRemaining: number;
    }>(
      '/api/developer/v1/generate-image',
      {
        method: 'POST',
        body: JSON.stringify({ prompt, ...opts }),
      },
      apiKey
    ),

  video: (apiKey: string, prompt: string, opts?: { fps?: number; numFrames?: number; negativePrompt?: string }) =>
    request<{
      success: boolean;
      videoUrl: string;
      prompt: string;
      model: string;
      creditsUsed: number;
      videoCreditsRemaining: number;
    }>(
      '/api/developer/v1/generate-video',
      {
        method: 'POST',
        body: JSON.stringify({ prompt, ...opts }),
      },
      apiKey
    ),
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = {
  createCheckout: (plan: 'pro' | 'enterprise') =>
    request<{ checkoutUrl: string; sessionId: string; plan: string; note?: string }>(
      '/api/payments/create-checkout-session',
      { method: 'POST', body: JSON.stringify({ plan }) }
    ),
  simulateUpgrade: (plan: 'pro' | 'enterprise') =>
    request<{ message: string; user: PlatformUser }>(
      '/api/payments/simulate-upgrade',
      { method: 'POST', body: JSON.stringify({ plan }) }
    ),
};
