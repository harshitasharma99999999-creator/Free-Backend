'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, ChevronDown, ChevronRight, Zap, Key, Terminal, Settings, Globe, Code2, AlertCircle, CheckCircle2 } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://backend-eta-lyart-87.vercel.app').replace(/\/+$/, '');
const EIOR_BASE = `${API_BASE}/eior/v1`;

function Code({ children, inline }: { children: string; inline?: boolean }) {
  if (inline) return <code className="bg-[#252526] text-[#ce9178] rounded px-1.5 py-0.5 text-[12px] font-mono">{children}</code>;
  return <span className="font-mono text-[#ce9178] text-sm">{children}</span>;
}

function CopyBlock({ code, lang, title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2a2a] my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"/><div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"/><div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]"/></div>
          {title && <span className="text-xs text-[#858585] ml-1">{title}</span>}
          {lang && <span className="text-[10px] text-[#4e4e4e] uppercase tracking-widest ml-2">{lang}</span>}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 text-xs text-[#858585] hover:text-[#cccccc] transition-colors">
          {copied ? <><Check size={12} className="text-[#73c991]"/>Copied!</> : <><Copy size={12}/>Copy</>}
        </button>
      </div>
      <pre className="bg-[#0d1117] p-4 text-sm overflow-x-auto leading-relaxed text-[#abb2bf] font-mono"><code>{code}</code></pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#10a37f]/15 border border-[#10a37f]/30 flex items-center justify-center text-[#10a37f] font-bold text-sm mt-0.5">{n}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[#e0e0e0] mb-3 text-base">{title}</h3>
        <div className="text-[#8e8ea0] text-sm leading-relaxed space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, accent }: { icon: any; title: string; children: React.ReactNode; accent?: string }) {
  return (
    <section className={`rounded-2xl border p-6 mb-6 ${accent || 'border-[#2a2a2a] bg-[#141414]'}`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center"><Icon size={16} className="text-[#10a37f]"/></div>
        <h2 className="text-lg font-bold text-[#e0e0e0]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Alert({ type, children }: { type: 'info'|'warn'|'success'; children: React.ReactNode }) {
  const s = { info: 'border-[#007acc]/30 bg-[#007acc]/5 text-[#6cb6ff]', warn: 'border-[#e5c07b]/30 bg-[#e5c07b]/5 text-[#e5c07b]', success: 'border-[#73c991]/30 bg-[#73c991]/5 text-[#73c991]' }[type];
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return <div className={`flex gap-3 p-3 rounded-lg border text-sm ${s} my-3`}><Icon size={15} className="shrink-0 mt-0.5"/><div>{children}</div></div>;
}

type TabType = 'npm'|'curl'|'py';

export default function OpenClawGuidePage() {
  const [tab, setTab] = useState<TabType>('npm');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-2">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-[#858585] mb-3">
          <span>Guides</span><ChevronRight size={12}/><span className="text-[#10a37f]">OpenClaw + EIOR</span>
        </div>
        <h1 className="text-3xl font-bold text-[#ececec] mb-2">Connect EIOR to OpenClaw</h1>
        <p className="text-[#8e8ea0] text-base leading-relaxed">
          Professional step-by-step setup to use EIOR as your AI model inside OpenClaw — with exact commands, configs, and verification tests.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {['OpenAI-compatible','Streaming','128K context','Image gen','Embeddings'].map(t=>(
            <span key={t} className="text-xs bg-[#10a37f]/10 border border-[#10a37f]/20 text-[#10a37f] rounded-full px-3 py-1">{t}</span>
          ))}
        </div>
      </div>

      {/* ── Step 0: Prerequisites ─────────────────────────────────────────── */}
      <Section icon={CheckCircle2} title="Prerequisites">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: 'OpenClaw installed', cmd: 'openclaw --version' },
            { label: 'Node.js 18+ or Python 3.9+', cmd: 'node -v  /  python --version' },
            { label: 'EIOR account + API key', cmd: 'Dashboard → API Keys' },
            { label: 'curl (any OS)', cmd: 'curl --version' },
          ].map(p=>(
            <div key={p.label} className="flex items-start gap-2 bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
              <CheckCircle2 size={13} className="text-[#10a37f] mt-0.5 shrink-0"/>
              <div><div className="text-[#cccccc] font-medium">{p.label}</div><div className="text-[#555] text-xs font-mono mt-0.5">{p.cmd}</div></div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Step 1: Get API Key ───────────────────────────────────────────── */}
      <Section icon={Key} title="Step 1 — Get your EIOR API Key">
        <Step n={1} title="Create an API key in the dashboard">
          <p>Go to <strong className="text-[#cccccc]">Dashboard → API Keys</strong> and click <strong className="text-[#cccccc]">Create Key</strong>. Give it a name like <Code inline>openclaw-prod</Code>.</p>
          <p>Your key starts with <Code inline>fk_</Code> — copy it now, it's only shown once.</p>
          <Alert type="warn">Never commit your API key to git. Always use environment variables.</Alert>
        </Step>
        <Step n={2} title="Set the environment variable">
          <p>Add this to your shell profile (<Code inline>~/.bashrc</Code>, <Code inline>~/.zshrc</Code>, or Windows System Environment Variables):</p>
          <CopyBlock lang="bash" title="~/.zshrc or ~/.bashrc" code={`export EIOR_API_KEY="fk_your_key_here"
export EIOR_BASE_URL="${EIOR_BASE}"

# Reload immediately
source ~/.zshrc`} />
          <p>On Windows (PowerShell):</p>
          <CopyBlock lang="powershell" title="PowerShell" code={`[System.Environment]::SetEnvironmentVariable("EIOR_API_KEY", "fk_your_key_here", "User")
[System.Environment]::SetEnvironmentVariable("EIOR_BASE_URL", "${EIOR_BASE}", "User")`} />
        </Step>
        <Step n={3} title="Verify the key works">
          <CopyBlock lang="bash" title="Test — list available models" code={`curl ${EIOR_BASE}/models \\
  -H "Authorization: Bearer $EIOR_API_KEY"`} />
          <p>You should see a JSON list of EIOR models. If you get 401, double-check your key.</p>
        </Step>
      </Section>

      {/* ── Step 2: Configure OpenClaw ─────────────────────────────────────── */}
      <Section icon={Settings} title="Step 2 — Configure OpenClaw">
        <Step n={1} title="Create the OpenClaw config file">
          <p>Create <Code inline>openclaw.json</Code> in your project root (or <Code inline>~/.openclaw/config.json</Code> for global config):</p>
          <CopyBlock lang="json" title="openclaw.json" code={`{
  "models": {
    "providers": {
      "eior": {
        "baseUrl": "${EIOR_BASE}",
        "apiKey": "\${EIOR_API_KEY}",
        "api": "openai-completions",
        "models": [
          {
            "id": "eior-v1",
            "name": "EIOR v1",
            "description": "General reasoning — fast, 128K context"
          },
          {
            "id": "eior-advanced",
            "name": "EIOR Advanced",
            "description": "Deep analysis and complex tasks"
          },
          {
            "id": "eior-coder",
            "name": "EIOR Coder",
            "description": "Code generation, debugging, refactoring"
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "eior/eior-v1" },
      "maxTokens": 8192,
      "temperature": 0.7
    }
  }
}`} />
        </Step>

        <Step n={2} title="Set the default model globally">
          <CopyBlock lang="bash" title="Terminal" code={`# Set EIOR as default model for all sessions
openclaw config set model eior/eior-v1

# Or use EIOR Coder for coding projects
openclaw config set model eior/eior-coder

# Verify the config
openclaw config show`} />
        </Step>

        <Step n={3} title="Test the connection">
          <CopyBlock lang="bash" title="Terminal" code={`# Quick test — single message
openclaw ask "Say hello from EIOR" --model eior/eior-v1

# Streaming test
openclaw ask "Explain recursion briefly" --model eior/eior-v1 --stream

# Test EIOR Coder specifically
openclaw ask "Write a TypeScript binary search function" --model eior/eior-coder`} />
          <Alert type="success">If you see a response, OpenClaw is successfully connected to EIOR!</Alert>
        </Step>
      </Section>

      {/* ── Step 3: Use EIOR in code ──────────────────────────────────────── */}
      <Section icon={Code2} title="Step 3 — Use EIOR in your code">
        <div className="flex gap-2 mb-4 border-b border-[#2a2a2a] pb-3">
          {(['npm','curl','py'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab===t?'bg-[#10a37f]/15 text-[#10a37f] border border-[#10a37f]/30':'text-[#858585] hover:text-[#cccccc]'}`}>
              {t==='npm'?'Node.js / TypeScript':t==='curl'?'curl (bash)':'Python'}
            </button>
          ))}
        </div>

        {tab==='npm' && (
          <>
            <CopyBlock lang="bash" title="Install" code={`npm install openai`} />
            <CopyBlock lang="typescript" title="src/eior.ts" code={`import OpenAI from 'openai';

const eior = new OpenAI({
  apiKey:  process.env.EIOR_API_KEY!,
  baseURL: process.env.EIOR_BASE_URL ?? '${EIOR_BASE}',
});

// ── Chat completion ─────────────────────────────────────
export async function chat(prompt: string) {
  const res = await eior.chat.completions.create({
    model:    'eior-v1',
    messages: [{ role: 'user', content: prompt }],
    stream:   false,
  });
  return res.choices[0]?.message?.content ?? '';
}

// ── Streaming ───────────────────────────────────────────
export async function streamChat(prompt: string) {
  const stream = await eior.chat.completions.create({
    model:    'eior-v1',
    messages: [{ role: 'user', content: prompt }],
    stream:   true,
  });
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
  }
}

// ── Embeddings ──────────────────────────────────────────
export async function embed(text: string) {
  const res = await eior.embeddings.create({
    model: 'eior-v1',
    input: text,
  });
  return res.data[0]?.embedding ?? [];
}

// ── Usage ───────────────────────────────────────────────
chat('Hello from OpenClaw!').then(console.log);`} />
          </>
        )}

        {tab==='curl' && (
          <>
            <CopyBlock lang="bash" title="Chat completion" code={`curl -X POST ${EIOR_BASE}/chat/completions \\
  -H "Authorization: Bearer $EIOR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model":    "eior-v1",
    "messages": [{"role":"user","content":"Hello from OpenClaw!"}],
    "stream":   false
  }' | jq '.choices[0].message.content'`} />
            <CopyBlock lang="bash" title="Streaming" code={`curl -X POST ${EIOR_BASE}/chat/completions \\
  -H "Authorization: Bearer $EIOR_API_KEY" \\
  -H "Content-Type: application/json" \\
  --no-buffer \\
  -d '{
    "model":    "eior-v1",
    "messages": [{"role":"user","content":"Count to 5 slowly"}],
    "stream":   true
  }'`} />
            <CopyBlock lang="bash" title="Image generation" code={`curl -X POST ${EIOR_BASE}/images/generations \\
  -H "Authorization: Bearer $EIOR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model":  "eior-image-gen",
    "prompt": "A futuristic city at night, neon lights, 4K",
    "n":      1,
    "size":   "1024x1024"
  }' | jq '.data[0].url'`} />
            <CopyBlock lang="bash" title="Embeddings" code={`curl -X POST ${EIOR_BASE}/embeddings \\
  -H "Authorization: Bearer $EIOR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "eior-v1",
    "input": "The meaning of life"
  }' | jq '.data[0].embedding | length'`} />
          </>
        )}

        {tab==='py' && (
          <>
            <CopyBlock lang="bash" title="Install" code={`pip install openai`} />
            <CopyBlock lang="python" title="eior_client.py" code={`from openai import OpenAI
import os

eior = OpenAI(
    api_key  = os.environ["EIOR_API_KEY"],
    base_url = os.environ.get("EIOR_BASE_URL", "${EIOR_BASE}"),
)

# ── Chat completion ─────────────────────────────────────
def chat(prompt: str) -> str:
    res = eior.chat.completions.create(
        model    = "eior-v1",
        messages = [{"role": "user", "content": prompt}],
        stream   = False,
    )
    return res.choices[0].message.content or ""

# ── Streaming ───────────────────────────────────────────
def stream_chat(prompt: str):
    stream = eior.chat.completions.create(
        model    = "eior-v1",
        messages = [{"role": "user", "content": prompt}],
        stream   = True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        print(delta, end="", flush=True)

# ── Embeddings ──────────────────────────────────────────
def embed(text: str) -> list[float]:
    res = eior.embeddings.create(model="eior-v1", input=text)
    return res.data[0].embedding

if __name__ == "__main__":
    print(chat("Hello from OpenClaw!"))`} />
          </>
        )}
      </Section>

      {/* ── Step 4: OpenClaw Agent config ─────────────────────────────────── */}
      <Section icon={Zap} title="Step 4 — Advanced OpenClaw Agent config">
        <Step n={1} title="Per-agent model overrides">
          <CopyBlock lang="json" title="openclaw.json — agents" code={`{
  "agents": {
    "coder": {
      "model": { "primary": "eior/eior-coder" },
      "systemPrompt": "You are an expert software engineer. Write clean, typed, production-ready code.",
      "maxTokens": 16384,
      "temperature": 0.2
    },
    "analyst": {
      "model": { "primary": "eior/eior-advanced" },
      "systemPrompt": "You are a senior analyst. Be precise, cite sources, think step by step.",
      "temperature": 0.5
    },
    "chat": {
      "model": { "primary": "eior/eior-v1" },
      "temperature": 0.9
    }
  }
}`} />
        </Step>
        <Step n={2} title="Context window and rate limits">
          <div className="overflow-hidden rounded-lg border border-[#2a2a2a] text-sm">
            <table className="w-full">
              <thead className="bg-[#1e1e1e]"><tr>{['Model','Context','Rate limit','Best for'].map(h=><th key={h} className="text-left px-3 py-2 text-[#858585] font-medium text-xs">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {[
                  ['eior-v1','128K','100/min','General tasks, chat'],
                  ['eior-advanced','128K','60/min','Deep analysis, reasoning'],
                  ['eior-coder','128K','100/min','Code gen, debugging'],
                  ['eior-image-gen','—','20/min','Image generation'],
                ].map(([m,c,r,u])=>(
                  <tr key={m} className="hover:bg-[#1a1a1a]">
                    <td className="px-3 py-2 font-mono text-[#10a37f] text-xs">{m}</td>
                    <td className="px-3 py-2 text-[#8e8ea0] text-xs">{c}</td>
                    <td className="px-3 py-2 text-[#8e8ea0] text-xs">{r}</td>
                    <td className="px-3 py-2 text-[#8e8ea0] text-xs">{u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Step>
        <Step n={3} title="Verify everything end-to-end">
          <CopyBlock lang="bash" title="Full verification script" code={`#!/bin/bash
echo "=== EIOR + OpenClaw Verification ==="

# 1. Check env vars
echo "API Key: \${EIOR_API_KEY:0:8}..."
echo "Base URL: $EIOR_BASE_URL"

# 2. List models
echo "\\n--- Available Models ---"
curl -s $EIOR_BASE_URL/models \\
  -H "Authorization: Bearer $EIOR_API_KEY" | jq '.data[].id'

# 3. Quick chat test
echo "\\n--- Chat Test ---"
curl -s -X POST $EIOR_BASE_URL/chat/completions \\
  -H "Authorization: Bearer $EIOR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"eior-v1","messages":[{"role":"user","content":"Reply with just: EIOR OK"}]}' \\
  | jq -r '.choices[0].message.content'

# 4. OpenClaw config test
echo "\\n--- OpenClaw Config ---"
openclaw config show | grep model

echo "\\n=== Setup Complete! ==="`} />
          <Alert type="success">All three checks passing = you're fully set up and ready to build with EIOR + OpenClaw.</Alert>
        </Step>
      </Section>

      {/* ── Troubleshooting ───────────────────────────────────────────────── */}
      <Section icon={AlertCircle} title="Troubleshooting">
        <div className="space-y-3 text-sm">
          {[
            { err: '401 Unauthorized', fix: 'Your API key is invalid or expired. Generate a new key in Dashboard → API Keys.' },
            { err: '429 Too Many Requests', fix: 'You hit the rate limit. Add delays between requests or upgrade your plan.' },
            { err: 'ECONNREFUSED / Network Error', fix: 'The backend may be sleeping (Vercel cold start). Retry after 5s. Or check EIOR_BASE_URL.' },
            { err: 'openclaw: command not found', fix: 'Run: npm install -g openclaw  then restart your terminal.' },
            { err: 'Model not found', fix: 'Use exact model IDs: eior-v1, eior-advanced, eior-coder, eior-image-gen' },
          ].map(({err,fix})=>(
            <div key={err} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[#f14c4c] font-mono text-xs font-semibold mb-1">{err}</div>
              <div className="text-[#8e8ea0]">{fix}</div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
