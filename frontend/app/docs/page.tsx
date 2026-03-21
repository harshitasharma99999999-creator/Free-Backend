'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Copy, Check, Code2 } from 'lucide-react';

const API   = (process.env.NEXT_PUBLIC_API_URL || 'https://your-backend.up.railway.app').replace(/\/+$/, '');
const EIOR  = `${API}/eior/v1`;

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg bg-muted overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 text-xs text-muted-foreground border-b">
        <span>{language}</span>
        <button
          className="hover:text-foreground flex items-center gap-1"
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

export default function DocsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/60 px-6 h-14 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight">
          <span className="rounded-md bg-primary/10 p-1"><Code2 className="h-4 w-4 text-primary" /></span>
          EIOR API
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
          {user ? (
            <Button asChild size="sm"><Link href="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
              <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">EIOR API Reference</h1>
          <p className="text-muted-foreground">
            OpenAI-compatible API · Base URL: <code className="bg-muted rounded px-2 py-0.5 text-sm">{EIOR}</code>
          </p>
        </div>

        {/* Quick start */}
        <Card>
          <CardHeader>
            <CardTitle>Quick start</CardTitle>
            <CardDescription>3 steps to use EIOR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li><Link href="/register" className="text-primary hover:underline">Create an account</Link> and sign in.</li>
              <li>Go to Dashboard → API Keys → create a key starting with <code className="bg-muted rounded px-1">fk_</code>.</li>
              <li>Use the key in any OpenAI-compatible client — or configure OpenClaw below.</li>
            </ol>
          </CardContent>
        </Card>

        {/* OpenClaw integration */}
        <Card className="border-green-500/30 bg-green-500/[0.03]">
          <CardHeader>
            <CardTitle>OpenClaw integration — use EIOR as a model</CardTitle>
            <CardDescription>
              EIOR is fully OpenAI-compatible. Point OpenClaw at <code className="bg-muted rounded px-1">{EIOR}</code> and it will work out of the box.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            <div>
              <p className="text-sm font-medium mb-2">Method 1 — environment variables</p>
              <CodeBlock language="bash" code={`OPENCLAW_BASE_URL="${EIOR}"
OPENCLAW_API_KEY="fk_your_api_key_here"
OPENCLAW_MODEL="eior-v1"`} />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Method 2 — openclaw.json</p>
              <CodeBlock language="json" code={`{
  "models": {
    "providers": {
      "eior": {
        "baseUrl": "${EIOR}",
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

            <div>
              <p className="text-sm font-medium mb-2">Method 3 — OpenAI SDK (any language)</p>
              <CodeBlock language="typescript" code={`import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey:  'fk_your_api_key_here',
  baseURL: '${EIOR}',
});

const res = await openai.chat.completions.create({
  model:    'eior-v1',
  messages: [{ role: 'user', content: 'Hello from OpenClaw!' }],
  stream:   true,
});`} />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Available models</p>
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
                      { id: 'eior-v1',        use: 'General chat & reasoning',    ctx: '128 K' },
                      { id: 'eior-advanced',  use: 'Complex reasoning & analysis', ctx: '128 K' },
                      { id: 'eior-coder',     use: 'Code generation (Vibecode)',   ctx: '128 K' },
                      { id: 'eior-image-gen', use: 'Image generation',             ctx: '—' },
                    ].map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-primary text-sm">{m.id}</td>
                        <td className="px-4 py-2 text-muted-foreground text-sm">{m.use}</td>
                        <td className="px-4 py-2 text-muted-foreground text-sm">{m.ctx}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Discover models without auth: <code className="bg-muted rounded px-1">GET {EIOR}/models</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Pass your API key in any of these ways</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CodeBlock code={`Authorization: Bearer fk_your_api_key_here`} language="http" />
            <p className="text-xs text-muted-foreground">Also accepted: <code className="bg-muted rounded px-1">X-API-Key: fk_your_api_key_here</code></p>
          </CardContent>
        </Card>

        {/* Chat completions */}
        <Card>
          <CardHeader>
            <CardTitle>POST /chat/completions</CardTitle>
            <CardDescription>Stream or batch chat — identical to OpenAI&apos;s API format.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock language="bash" code={`curl -X POST ${EIOR}/chat/completions \\
  -H "Authorization: Bearer fk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "eior-v1",
    "messages": [{"role":"user","content":"Hello!"}],
    "stream": false
  }'`} />
          </CardContent>
        </Card>

        {/* Vibecode */}
        <Card>
          <CardHeader>
            <CardTitle>POST /vibecode — AI code generation</CardTitle>
            <CardDescription>
              Describe what you want to build. EIOR Coder writes production-ready code.
              Also available in the <Link href="/dashboard/vibecode" className="text-primary hover:underline">Vibecode dashboard</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock language="bash" code={`curl -X POST ${EIOR}/vibecode \\
  -H "Authorization: Bearer fk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "description": "A React hook that fetches paginated data with TypeScript",
    "language": "TypeScript",
    "stream": true
  }'`} />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Body:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code className="bg-muted rounded px-1">description</code> <span className="text-destructive">*required</span> — what to build</li>
                <li><code className="bg-muted rounded px-1">language</code> — preferred language / framework (optional)</li>
                <li><code className="bg-muted rounded px-1">context</code> — additional project context (optional)</li>
                <li><code className="bg-muted rounded px-1">stream</code> — <code className="bg-muted rounded px-1">true</code> for SSE token-by-token output</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Image generation */}
        <Card>
          <CardHeader>
            <CardTitle>POST /images/generations</CardTitle>
            <CardDescription>Generate images using Stable Diffusion XL via Replicate.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock language="bash" code={`curl -X POST ${EIOR}/images/generations \\
  -H "Authorization: Bearer fk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "a glowing futuristic city at night, 4k cinematic",
    "n": 1,
    "size": "1024x1024"
  }'`} />
          </CardContent>
        </Card>

        {/* Embeddings */}
        <Card>
          <CardHeader>
            <CardTitle>POST /embeddings</CardTitle>
            <CardDescription>Text embeddings for semantic search and RAG pipelines.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock language="bash" code={`curl -X POST ${EIOR}/embeddings \\
  -H "Authorization: Bearer fk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "eior-v1",
    "input": "The quick brown fox"
  }'`} />
          </CardContent>
        </Card>

        {/* Rate limits */}
        <Card>
          <CardHeader>
            <CardTitle>Rate limits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>100 requests / 60 seconds</strong> per API key (free tier).</p>
            <p>Response headers: <code className="bg-muted rounded px-1">X-RateLimit-Limit</code>, <code className="bg-muted rounded px-1">X-RateLimit-Remaining</code>, <code className="bg-muted rounded px-1">X-RateLimit-Reset</code>.</p>
            <p>Exceeded: <code className="bg-muted rounded px-1">429 Too Many Requests</code>.</p>
          </CardContent>
        </Card>

        {/* Error reference */}
        <Card>
          <CardHeader>
            <CardTitle>Error format</CardTitle>
            <CardDescription>EIOR errors follow the OpenAI error format.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock language="json" code={`// 401 — missing / invalid key
{ "error": { "message": "Invalid API key.", "type": "invalid_request_error", "code": "invalid_api_key" } }

// 429 — rate limit exceeded
{ "error": { "message": "Rate limit exceeded.", "type": "rate_limit_error", "code": "rate_limit_exceeded" } }

// 502 — model error
{ "error": { "message": "Ollama 500: ...", "type": "server_error", "code": "model_error" } }

// 504 — timeout
{ "error": { "message": "Model timed out.", "type": "server_error", "code": "model_timeout" } }`} />
          </CardContent>
        </Card>

        <p className="text-sm text-center text-muted-foreground">
          Signed in?{' '}
          <Link href="/dashboard/docs" className="text-primary hover:underline">
            Full integration docs in your dashboard →
          </Link>
        </p>
      </div>
    </div>
  );
}
