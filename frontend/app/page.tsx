'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Code2, Sparkles, MessageSquare, Layers, Key, Shield, Zap, Bot, CheckCircle2 } from 'lucide-react';

const MODELS = [
  { name: 'EIOR',          id: 'eior-v1',        desc: 'Our versatile model for everyday tasks.' },
  { name: 'EIOR Advanced', id: 'eior-advanced',   desc: 'Our smartest model for complex problems.' },
  { name: 'EIOR Coder',    id: 'eior-coder',      desc: 'Our fastest model for code generation.' },
];

const FEATURES = [
  { icon: MessageSquare, title: 'Chat completions',   desc: 'Stream or batch conversations. Full OpenAI message format — drop-in compatible.' },
  { icon: Sparkles,      title: 'Vibecode',           desc: 'Describe what to build. EIOR Coder writes production-ready code, streamed token by token.' },
  { icon: Bot,           title: 'OpenClaw ready',     desc: 'Point OpenClaw at /eior/v1 and select an EIOR model. No code changes needed.' },
  { icon: Layers,        title: 'Embeddings',         desc: 'High-quality text embeddings for semantic search, RAG pipelines, and clustering.' },
  { icon: Key,           title: 'API key management', desc: 'Create, rotate, and revoke keys from your dashboard. Per-key usage tracking.' },
  { icon: Shield,        title: 'Secure by default',  desc: 'Rate limiting, key validation, and request sanitisation on every endpoint.' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#ececec]">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-sm">
            <span className="h-7 w-7 rounded-full bg-[#10a37f] flex items-center justify-center">
              <Code2 className="h-3.5 w-3.5 text-white" />
            </span>
            EIOR
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/docs"    className="hidden sm:block text-sm text-[#8e8ea0] hover:text-white transition-colors">API</Link>
            <Link href="/pricing" className="hidden sm:block text-sm text-[#8e8ea0] hover:text-white transition-colors">Pricing</Link>
            {user ? (
              <Link href="/dashboard" className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">
                Open EIOR
              </Link>
            ) : (
              <>
                <Link href="/login"    className="text-sm text-[#8e8ea0] hover:text-white transition-colors">Log in</Link>
                <Link href="/register" className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-28 pb-20 text-center">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
          EIOR
        </h1>
        <p className="text-xl sm:text-2xl text-[#8e8ea0] mb-10 max-w-2xl mx-auto leading-relaxed font-light">
          Your own AI — OpenAI-compatible, open-source, and ready for OpenClaw.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={user ? '/dashboard' : '/register'}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            {user ? 'Open EIOR' : 'Start for free'} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/10 text-sm text-[#ececec] hover:bg-white/5 transition-colors"
          >
            API reference
          </Link>
        </div>

        {/* Code snippet */}
        <div className="mt-16 rounded-2xl border border-white/8 bg-[#171717] overflow-hidden text-left">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-[#1a1a1a]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-xs text-[#8e8ea0] font-mono">2 lines changed</span>
          </div>
          <pre className="px-6 py-5 text-sm font-mono overflow-x-auto leading-7">
<span className="text-[#8e8ea0]/50">- </span><span className="text-red-400/70">const openai = new OpenAI(&#123; apiKey: &quot;sk-...&quot; &#125;);</span>{'\n'}
<span className="text-[#8e8ea0]/50">+ </span><span className="text-[#10a37f]">const openai = new OpenAI(&#123;</span>{'\n'}
<span className="text-[#8e8ea0]/50">+   </span><span className="text-[#10a37f]">  apiKey:  &quot;fk_your_eior_key&quot;,</span>{'\n'}
<span className="text-[#8e8ea0]/50">+   </span><span className="text-[#10a37f]">  baseURL: &quot;https://yourapi.com/eior/v1&quot;,</span>{'\n'}
<span className="text-[#8e8ea0]/50">+ </span><span className="text-[#10a37f]">&#125;);</span>{'\n'}
{'\n'}
<span className="text-[#8e8ea0]/60">{'// Everything else is identical'}</span>{'\n'}
<span className="text-[#ececec]/80">{'const res = await openai.chat.completions.create({'}</span>{'\n'}
{'  '}<span className="text-[#10a37f]/80">model</span>{': '}<span className="text-[#10a37f]">&quot;eior-v1&quot;</span>,{'\n'}
{'  '}<span className="text-[#10a37f]/80">messages</span>{': [{ role: '}<span className="text-[#10a37f]">&quot;user&quot;</span>{', content: '}<span className="text-[#10a37f]">&quot;Hello!&quot;</span>{' }],'}{'\n'}
{'  '}<span className="text-[#10a37f]/80">stream</span>{': '}<span className="text-[#10a37f]/80">true</span>,{'\n'}
<span className="text-[#ececec]/80">{'});'}</span>
          </pre>
        </div>
      </section>

      {/* ── Models ──────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-widest text-center mb-3">Models</p>
        <h2 className="text-3xl font-bold text-center mb-12">The EIOR model family</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {MODELS.map((m) => (
            <div key={m.id} className="rounded-2xl border border-white/8 bg-[#171717] p-6 hover:border-[#10a37f]/30 hover:bg-[#1a1a1a] transition-all">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 rounded-full bg-[#10a37f]/20 border border-[#10a37f]/40 flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10a37f]" />
                </div>
                <p className="font-semibold text-sm text-white">{m.name}</p>
              </div>
              <p className="text-xs font-mono text-[#10a37f] mb-2">{m.id}</p>
              <p className="text-sm text-[#8e8ea0] leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── OpenClaw ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-widest text-center mb-3">OpenClaw</p>
        <h2 className="text-3xl font-bold text-center mb-4">Use EIOR in OpenClaw</h2>
        <p className="text-center text-[#8e8ea0] mb-12 max-w-xl mx-auto">
          EIOR is fully OpenAI-compatible. Add it to OpenClaw in one config change.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/8 bg-[#171717] p-5">
            <p className="text-xs font-semibold text-[#8e8ea0] uppercase tracking-widest mb-3">env vars</p>
            <pre className="text-xs font-mono text-[#ececec] leading-6 overflow-x-auto">{`EIOR_BASE_URL="https://yourapi.com/eior/v1"
EIOR_API_KEY="fk_your_key"`}</pre>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#171717] p-5">
            <p className="text-xs font-semibold text-[#8e8ea0] uppercase tracking-widest mb-3">openclaw.json</p>
            <pre className="text-xs font-mono text-[#ececec] leading-6 overflow-x-auto">{`{
  "models": {
    "providers": {
      "eior": {
        "baseUrl": "https://yourapi.com/eior/v1",
        "apiKey": "\${EIOR_API_KEY}",
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
    "defaults": { "model": { "primary": "eior/eior-v1" } }
  }
}`}</pre>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {['eior-v1', 'eior-advanced', 'eior-coder', 'eior-image-gen'].map((m) => (
            <span key={m} className="rounded-full border border-[#10a37f]/30 bg-[#10a37f]/5 text-[#10a37f] px-3.5 py-1 font-mono text-xs">{m}</span>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-widest text-center mb-3">Capabilities</p>
        <h2 className="text-3xl font-bold text-center mb-12">Everything in one API</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/8 bg-[#171717] p-5 hover:border-white/12 hover:bg-[#1a1a1a] transition-all">
              <div className="h-8 w-8 rounded-xl bg-[#10a37f]/10 flex items-center justify-center mb-4">
                <f.icon className="h-4 w-4 text-[#10a37f]" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-2">{f.title}</h3>
              <p className="text-sm text-[#8e8ea0] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-widest text-center mb-3">Pricing</p>
        <h2 className="text-3xl font-bold text-center mb-12">Simple, transparent pricing</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { name: 'Free',       price: '$0',  period: '/forever', reqs: '1,000 req', rate: '20 req/min',  highlight: false },
            { name: 'Pro',        price: '$19', period: '/month',   reqs: '50,000 req', rate: '120 req/min', highlight: true  },
            { name: 'Enterprise', price: '$99', period: '/month',   reqs: 'Unlimited',  rate: 'Custom',      highlight: false },
          ].map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-6 transition-all ${
                p.highlight
                  ? 'border-[#10a37f]/40 bg-[#10a37f]/5'
                  : 'border-white/8 bg-[#171717] hover:border-white/12'
              }`}
            >
              {p.highlight && (
                <span className="text-[10px] font-bold text-[#10a37f] bg-[#10a37f]/10 rounded-full px-2.5 py-0.5 tracking-widest uppercase block w-fit mb-3">Popular</span>
              )}
              <p className="font-semibold text-white mb-1">{p.name}</p>
              <p className="text-3xl font-bold text-white mb-1">
                {p.price}<span className="text-sm font-normal text-[#8e8ea0]">{p.period}</span>
              </p>
              <ul className="space-y-2 mt-5 text-sm mb-6">
                {[p.reqs, p.rate, 'All EIOR models', 'Vibecode', 'OpenClaw compatible'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[#8e8ea0]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#10a37f] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={user ? '/dashboard' : '/register'}
                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  p.highlight
                    ? 'bg-[#10a37f] hover:bg-[#0d9270] text-white'
                    : 'border border-white/10 hover:bg-white/5 text-white'
                }`}
              >
                {user ? 'Open dashboard' : 'Get started'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4">Start building today</h2>
        <p className="text-[#8e8ea0] mb-8">
          Free to start. No credit card required.
        </p>
        <Link
          href={user ? '/dashboard' : '/register'}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          {user ? 'Go to dashboard' : 'Try EIOR for free'} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-5 w-5 rounded-full bg-[#10a37f] flex items-center justify-center">
              <Code2 className="h-2.5 w-2.5 text-white" />
            </span>
            EIOR
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8e8ea0]">
            <Link href="/docs"    className="hover:text-white transition-colors">API</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/dashboard/docs" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <p className="text-xs text-[#8e8ea0]">© {new Date().getFullYear()} EIOR. Powered by Ollama.</p>
        </div>
      </footer>
    </div>
  );
}
