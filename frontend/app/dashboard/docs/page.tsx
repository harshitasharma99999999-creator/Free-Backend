'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';

const API_BASE   = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
const PUBLIC_BASE = `${API_BASE}/api/developer`;
const AUTH_BASE   = `${API_BASE}/api/auth`;
const EIOR_BASE   = `${API_BASE}/eior/v1`;

const INTEGRATION_CONFIG_JSON = {
  baseUrl: API_BASE,
  eiorBaseUrl: EIOR_BASE,
  auth: {
    register: `${AUTH_BASE}/client-register`,
    login:    `${AUTH_BASE}/client-login`,
    me:       `${AUTH_BASE}/client-me`,
  },
  headers: {
    apiKey:        'X-API-Key',
    authorization: 'Authorization',
  },
  apiKey: 'YOUR_API_KEY_HERE',
};

function CopyBlock({ code, lang = '' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative mt-2">
      {lang && (
        <span className="absolute top-2 left-3 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">{lang}</span>
      )}
      <pre className={`rounded-lg bg-muted p-4 text-sm overflow-x-auto pr-12 ${lang ? 'pt-7' : ''}`}>
        {code}
      </pre>
      <Button size="sm" variant="ghost" className="absolute top-1.5 right-1.5 h-7 w-7 p-0" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function DocsPage() {
  const [copiedConfig, setCopiedConfig] = useState(false);
  const configString = JSON.stringify(INTEGRATION_CONFIG_JSON, null, 2);

  function copyConfig() {
    navigator.clipboard.writeText(configString);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground">Complete API reference, OpenClaw integration guide, and Vibecode usage.</p>
      </div>

      {/* ── Integration config ──────────────────────────────────────────── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>Integration config</CardTitle>
          <CardDescription>
            Copy this into your app. Set <code className="rounded bg-muted px-1">apiKey</code> to your key and you're ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
            <li>Create an API key in <strong>API Keys</strong> and copy it.</li>
            <li>Copy the config below and set <code className="rounded bg-muted px-1">apiKey</code> to your key.</li>
            <li>Call <code className="rounded bg-muted px-1">register</code> or <code className="rounded bg-muted px-1">login</code>, then use the returned token with <code className="rounded bg-muted px-1">me</code>.</li>
          </ol>
          <div className="relative">
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto pr-24">{configString}</pre>
            <Button size="sm" variant="secondary" className="absolute top-3 right-3" onClick={copyConfig}>
              {copiedConfig ? 'Copied!' : 'Copy config'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fetch at runtime: <code className="rounded bg-muted px-1">GET {API_BASE}/api/integration-config</code> (no key required).
          </p>
        </CardContent>
      </Card>

      {/* ── OpenClaw / EIOR integration ─────────────────────────────────── */}
      <Card className="border-green-500/30 bg-green-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            OpenClaw integration — Add EIOR as a model
          </CardTitle>
          <CardDescription>
            EIOR exposes a fully OpenAI-compatible API at <code className="rounded bg-muted px-1">{EIOR_BASE}</code>.
            Add it to OpenClaw in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Quick config */}
          <div>
            <p className="text-sm font-medium mb-1">Method 1 — Environment variables</p>
            <CopyBlock lang="bash" code={`EIOR_BASE_URL="${EIOR_BASE}"
EIOR_API_KEY="fk_your_api_key_here"`} />
          </div>

          {/* openclaw.json */}
          <div>
            <p className="text-sm font-medium mb-1">Method 2 — <code className="rounded bg-muted px-1">openclaw.json</code></p>
            <CopyBlock lang="json" code={`{
  "models": {
    "providers": {
      "eior": {
        "baseUrl": "${EIOR_BASE}",
        "apiKey": "${'${'}EIOR_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "eior-v1", "name": "EIOR v1" },
          { "id": "eior-advanced", "name": "EIOR Advanced" },
          { "id": "eior-coder", "name": "EIOR Coder" },
          { "id": "eior-image-gen", "name": "EIOR Image Gen" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "eior/eior-v1" }
    }
  }
}`} />
          </div>

          {/* OpenAI SDK */}
          <div>
            <p className="text-sm font-medium mb-1">Method 3 — OpenAI SDK (any language)</p>
            <CopyBlock lang="typescript" code={`import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey:  'fk_your_api_key_here',
  baseURL: '${EIOR_BASE}',
});

const res = await openai.chat.completions.create({
  model:    'eior-v1',
  messages: [{ role: 'user', content: 'Hello from OpenClaw!' }],
  stream:   true,
});`} />
          </div>

          {/* curl */}
          <div>
            <p className="text-sm font-medium mb-1">Method 4 — curl</p>
            <CopyBlock lang="bash" code={`curl -X POST ${EIOR_BASE}/chat/completions \\
  -H "Authorization: Bearer fk_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "eior-v1",
    "messages": [{"role":"user","content":"Hello!"}]
  }'`} />
          </div>

          {/* Available models */}
          <div>
            <p className="text-sm font-medium mb-2">Available EIOR models</p>
            <div className="rounded-lg border overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Model ID</th>
                    <th className="text-left px-4 py-2 font-medium">Best for</th>
                    <th className="text-left px-4 py-2 font-medium">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { id: 'eior-v1',       use: 'General chat & reasoning',     ctx: '128 K' },
                    { id: 'eior-advanced', use: 'Complex reasoning & analysis',  ctx: '128 K' },
                    { id: 'eior-coder',    use: 'Code generation (Vibecode)',    ctx: '128 K' },
                    { id: 'eior-image-gen',use: 'Image generation',              ctx: '—' },
                  ].map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-primary">{m.id}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.use}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.ctx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Endpoint list */}
          <div>
            <p className="text-sm font-medium mb-2">EIOR API endpoints</p>
            <div className="space-y-3 text-sm">
              {[
                { method: 'GET',  path: '/models',             desc: 'List available EIOR models (OpenAI-compatible).' },
                { method: 'POST', path: '/chat/completions',   desc: 'Chat completions — streaming & non-streaming.' },
                { method: 'POST', path: '/images/generations', desc: 'Image generation (requires REPLICATE_API_TOKEN).' },
                { method: 'POST', path: '/embeddings',         desc: 'Text embeddings for RAG, search, and clustering.' },
                { method: 'POST', path: '/vibecode',           desc: 'AI code generation with injected coding system prompt.' },
              ].map((ep) => (
                <div key={ep.path} className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className={`shrink-0 font-mono text-xs rounded px-1.5 py-0.5 w-fit ${ep.method === 'GET' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'}`}>
                    {ep.method}
                  </span>
                  <code className="font-mono text-primary shrink-0">{EIOR_BASE}{ep.path}</code>
                  <span className="text-muted-foreground text-xs sm:ml-2">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            All endpoints accept <code className="rounded bg-muted px-1">Authorization: Bearer fk_xxx</code> or <code className="rounded bg-muted px-1">X-API-Key: fk_xxx</code>.
          </p>
        </CardContent>
      </Card>

      {/* ── Vibecode API ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Vibecode API</CardTitle>
          <CardDescription>
            Generate code from natural language — available as a REST endpoint and from the Vibecode dashboard page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyBlock lang="bash" code={`curl -X POST ${EIOR_BASE}/vibecode \\
  -H "Authorization: Bearer fk_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "description": "A React hook that fetches paginated data with TypeScript",
    "language": "TypeScript",
    "stream": false
  }'`} />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Body parameters:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="rounded bg-muted px-1">description</code> <span className="text-destructive">*required</span> — what to build</li>
              <li><code className="rounded bg-muted px-1">language</code> — preferred language / framework (optional)</li>
              <li><code className="rounded bg-muted px-1">context</code> — additional project context (optional)</li>
              <li><code className="rounded bg-muted px-1">stream</code> — set <code className="rounded bg-muted px-1">true</code> for SSE streaming</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── App authentication endpoints ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>App authentication endpoints</CardTitle>
          <CardDescription>For your app's users — send <code className="rounded bg-muted px-1">X-API-Key</code> with your developer key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {[
            { method: 'POST', path: `${AUTH_BASE}/client-register`, desc: 'Register a new user.', body: '{ email, password, name? }', returns: '{ user, token }' },
            { method: 'POST', path: `${AUTH_BASE}/client-login`,    desc: 'Login.',               body: '{ email, password }',       returns: '{ user, token }' },
            { method: 'GET',  path: `${AUTH_BASE}/client-me`,       desc: 'Current user (also send Authorization: Bearer <token>).', returns: '{ user }' },
          ].map((ep) => (
            <div key={ep.path}>
              <p className="font-mono text-primary font-medium">{ep.method} {ep.path}</p>
              <p className="text-muted-foreground mt-1">{ep.desc}
                {ep.body && <> Body: <code className="rounded bg-muted px-1">{ep.body}</code>.</>}
                {ep.returns && <> Returns: <code className="rounded bg-muted px-1">{ep.returns}</code>.</>}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Public API endpoints ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Public API endpoints</CardTitle>
          <CardDescription>Base URL: <code className="rounded bg-muted px-1">{PUBLIC_BASE}</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/health</p>
            <p className="text-sm text-muted-foreground mt-1">Check API status.</p>
            <CopyBlock code={`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/health"`} />
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-primary">POST /v1/generate-image</p>
            <p className="text-sm text-muted-foreground mt-1">Generate an image. Body: <code className="rounded bg-muted px-1">{"{ prompt, width?, height?, negativePrompt? }"}</code>. Requires <code className="rounded bg-muted px-1">REPLICATE_API_TOKEN</code>.</p>
            <CopyBlock lang="bash" code={`curl -X POST "${PUBLIC_BASE}/v1/generate-image" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"a glowing city at night, 4k cinematic"}'`} />
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-primary">POST /v1/generate-video</p>
            <p className="text-sm text-muted-foreground mt-1">Generate a video clip. Body: <code className="rounded bg-muted px-1">{"{ prompt, fps?, numFrames? }"}</code>. Requires <code className="rounded bg-muted px-1">REPLICATE_API_TOKEN</code>.</p>
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-primary">POST /v1/suggest-outfits</p>
            <p className="text-sm text-muted-foreground mt-1">AI outfit suggestions. Body: <code className="rounded bg-muted px-1">{"{ bodyType, skinTone }"}</code>. Requires Ollama.</p>
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/echo?message=...</p>
            <p className="text-sm text-muted-foreground mt-1">Echo back a message.</p>
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/random?min=0&max=100</p>
            <p className="text-sm text-muted-foreground mt-1">Random integer in range [min, max].</p>
          </div>
        </CardContent>
      </Card>

      {/* ── API key usage ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>API key usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Option 1 — Header (recommended):</p>
          <CopyBlock code="X-API-Key: fk_your_api_key_here" />
          <p className="text-sm">Option 2 — Bearer token (OpenAI SDK compatible):</p>
          <CopyBlock code="Authorization: Bearer fk_your_api_key_here" />
          <p className="text-sm">Option 3 — Query parameter:</p>
          <CopyBlock code={`GET ${PUBLIC_BASE}/v1/health?apiKey=fk_your_api_key_here`} />
        </CardContent>
      </Card>

      {/* ── Rate limits ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Rate limits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Each API key is rate-limited per minute. Response headers:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><code className="rounded bg-muted px-1">X-RateLimit-Limit</code> — max requests per window</li>
            <li><code className="rounded bg-muted px-1">X-RateLimit-Remaining</code> — remaining in current window</li>
            <li><code className="rounded bg-muted px-1">X-RateLimit-Reset</code> — Unix timestamp when window resets</li>
          </ul>
          <p>When exceeded: <code className="rounded bg-muted px-1">429 Too Many Requests</code>.</p>
        </CardContent>
      </Card>

      {/* ── Errors ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Error responses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { code: '400', msg: 'Bad Request — missing or invalid body parameters.' },
            { code: '401', msg: 'Unauthorized — missing or invalid API key.' },
            { code: '402', msg: 'Payment Required — insufficient credits.' },
            { code: '429', msg: 'Too Many Requests — rate limit exceeded.' },
            { code: '501', msg: 'Not Implemented — feature not configured (e.g. REPLICATE_API_TOKEN missing).' },
            { code: '502', msg: 'Bad Gateway — model or upstream service error.' },
            { code: '504', msg: 'Gateway Timeout — model took too long.' },
          ].map((e) => (
            <p key={e.code}>
              <strong>{e.code}</strong> — {e.msg}
            </p>
          ))}
          <p className="text-muted-foreground pt-1">
            EIOR-route errors follow OpenAI format: <code className="rounded bg-muted px-1">{"{ error: { message, type, code } }"}</code>.
            Public-route errors use: <code className="rounded bg-muted px-1">{"{ error, message }"}</code>.
          </p>
        </CardContent>
      </Card>

      {/* ── Environment variables ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Required environment variables</CardTitle>
          <CardDescription>Set these on your backend deployment (Vercel / Railway / Render).</CardDescription>
        </CardHeader>
        <CardContent>
          <CopyBlock lang="env" code={`# Core
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-long-random-secret
API_BASE_URL=https://your-backend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# Firebase (for dashboard auth)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"

# Ollama (for EIOR chat / vibecode / embeddings)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=eior

# Replicate (for image + video generation)
REPLICATE_API_TOKEN=r8_...

# Rate limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...`} />
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap text-sm text-muted-foreground">
        <a href={`${EIOR_BASE}/models`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ExternalLink className="h-3.5 w-3.5" /> Live models endpoint
        </a>
        <a href={`${API_BASE}/api`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ExternalLink className="h-3.5 w-3.5" /> API health check
        </a>
      </div>
    </div>
  );
}
