import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import dns from 'node:dns';

function timeoutError(timeoutMs) {
  const err = new Error(`Request timed out after ${timeoutMs}ms`);
  err.name = 'TimeoutError';
  return err;
}

function shouldDefaultToLocalhostHostHeader(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();
    // Note: Cloudflare quick tunnels require the public Host header for routing,
    // so upstream host-rewrite must be done by `cloudflared` (not by the client).
    return /ngrok|loca\.lt/i.test(hostname);
  } catch {
    return false;
  }
}

export function getOllamaHostHeader(baseUrl, explicitHostHeader) {
  if (explicitHostHeader != null && String(explicitHostHeader).trim() !== '') return String(explicitHostHeader).trim();
  if (!baseUrl) return null;
  return shouldDefaultToLocalhostHostHeader(baseUrl) ? 'localhost' : null;
}

export function getOllamaConnectIp(baseUrl, connectIps) {
  if (!baseUrl) return null;
  const ips = Array.isArray(connectIps) ? connectIps : [];
  if (ips.length === 0) return null;
  try {
    const url = new URL(baseUrl);
    const h = url.hostname.toLowerCase();
    if (h.endsWith('.trycloudflare.com')) return ips[0];
    return null;
  } catch {
    return null;
  }
}

function shouldUseDoh(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h.endsWith('.trycloudflare.com');
}

const dohCache = new Map();

async function dohResolveA(hostname, timeoutMs = 2500) {
  const key = `A:${hostname}`;
  const now = Date.now();
  const cached = dohCache.get(key);
  if (cached && cached.expiresAt > now) return cached.address;

  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', 'A');

  // Use IP-based DoH (1.1.1.1) to avoid relying on runtime DNS when DNS is restricted.
  const json = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: 'https:',
        hostname: '1.1.1.1',
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          Host: 'cloudflare-dns.com',
          Accept: 'application/dns-json',
        },
        servername: 'cloudflare-dns.com',
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`DoH ${res.statusCode}: ${text}`));
          try {
            resolve(JSON.parse(text || 'null'));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    const t = setTimeout(() => req.destroy(timeoutError(timeoutMs)), timeoutMs);
    req.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
    req.on('close', () => clearTimeout(t));
    req.end();
  });

  const answers = Array.isArray(json?.Answer) ? json.Answer : [];
  const first = answers.find((a) => a && typeof a.data === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(a.data));
  if (!first) throw new Error('DoH no answer');

  const ttlSeconds = typeof first.TTL === 'number' ? first.TTL : 60;
  dohCache.set(key, { address: first.data, expiresAt: now + Math.max(30, ttlSeconds) * 1000 });
  return first.data;
}

function createLookup(hostname) {
  if (!shouldUseDoh(hostname)) return undefined;

  return (host, options, callback) => {
    const family =
      typeof options === 'number'
        ? options
        : (options && typeof options === 'object' && typeof options.family === 'number')
          ? options.family
          : 0;

    dns.lookup(host, { family: family || 0 }, async (err, address, fam) => {
      if (!err) return callback(null, address, fam);
      if (err && err.code !== 'ENOTFOUND') return callback(err);

      try {
        const ip = await dohResolveA(host);
        return callback(null, ip, 4);
      } catch (_) {
        return callback(err);
      }
    });
  };
}

export async function ollamaRequest({
  baseUrl,
  path,
  method = 'GET',
  headers = {},
  body,
  timeoutMs = 120_000,
  hostHeader,
  connectIp,
}) {
  if (!baseUrl) throw new Error('Missing baseUrl.');
  if (!path) throw new Error('Missing path.');

  const url = new URL(path, baseUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const lookup = createLookup(url.hostname);

  const requestHeaders = { ...headers };
  if (hostHeader) requestHeaders.Host = hostHeader;
  if (connectIp && !requestHeaders.Host) requestHeaders.Host = url.hostname;

  const bodyBytes = body == null ? null : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  if (bodyBytes != null && requestHeaders['Content-Length'] == null && requestHeaders['content-length'] == null) {
    requestHeaders['Content-Length'] = Buffer.byteLength(bodyBytes);
  }

  return await new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: connectIp || url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: requestHeaders,
        lookup,
        servername: url.hostname,
      },
      (res) => {
        let cachedText = null;
        let consumed = false;

        async function readText() {
          if (cachedText != null) return cachedText;
          if (consumed) return '';
          consumed = true;
          const chunks = [];
          for await (const chunk of res) chunks.push(Buffer.from(chunk));
          cachedText = Buffer.concat(chunks).toString('utf8');
          return cachedText;
        }

        async function readJson() {
          const text = await readText();
          try {
            return JSON.parse(text || 'null');
          } catch (err) {
            const e = new Error('Invalid JSON returned by model backend.');
            e.cause = err;
            throw e;
          }
        }

        resolve({
          status: res.statusCode || 0,
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          headers: res.headers,
          body: res,
          text: readText,
          json: readJson,
        });
      }
    );

    const timer = setTimeout(() => req.destroy(timeoutError(timeoutMs)), timeoutMs);
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on('close', () => clearTimeout(timer));

    if (bodyBytes != null) req.write(bodyBytes);
    req.end();
  });
}

export async function ollamaJson({
  baseUrl,
  path,
  method = 'GET',
  headers = {},
  body,
  timeoutMs = 120_000,
  hostHeader,
  connectIp,
}) {
  const res = await ollamaRequest({ baseUrl, path, method, headers, body, timeoutMs, hostHeader, connectIp });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Ollama ${res.status}: ${text}`);
    err.ollamaStatus = res.status;
    throw err;
  }
  return res.json();
}
