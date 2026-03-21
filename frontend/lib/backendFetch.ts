const rawBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();

export const BACKEND_BASE_URL = rawBase ? rawBase.replace(/\/+$/, '') : '';

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * Fetch a backend path.
 *
 * Tries same-origin first (works when `/api/*` is rewritten/proxied by the host).
 * If that returns 404 (or fails to connect) and `NEXT_PUBLIC_API_URL` is set,
 * retries against the configured backend base URL.
 */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const candidate = path || '/';
  const canRetryWithBase =
    Boolean(BACKEND_BASE_URL) && !isAbsoluteUrl(candidate) && candidate.startsWith('/');

  try {
    const res = await fetch(candidate, init);
    if (res.status !== 404 || !canRetryWithBase) return res;
    return await fetch(`${BACKEND_BASE_URL}${candidate}`, init);
  } catch (err) {
    if (!canRetryWithBase) throw err;
    return await fetch(`${BACKEND_BASE_URL}${candidate}`, init);
  }
}

