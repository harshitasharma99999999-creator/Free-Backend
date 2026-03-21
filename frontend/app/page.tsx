'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight, Code2, Sparkles, MessageSquare, Layers, Key,
  Shield, Zap, Bot, CheckCircle2, Terminal, Globe, Server,
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const MODELS = [
  {
    name: 'EIOR',
    id: 'eior-v1',
    badge: 'Versatile',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    desc: 'The everyday workhorse. Fast, accurate, great for conversations, summaries, and reasoning.',
  },
  {
    name: 'EIOR Advanced',
    id: 'eior-advanced',
    badge: 'Smartest',
    badgeColor: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
    desc: 'Maximum intelligence. Handles multi-step reasoning, analysis, and complex instructions.',
  },
  {
    name: 'EIOR Coder',
    id: 'eior-coder',
    badge: 'Code',
    badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    desc: 'Optimised for software. Writes, reviews, and debugs code streamed token by token.',
  },
];

const FEATURES = [
  { icon: MessageSquare, title: 'Chat completions',   desc: 'Stream or batch conversations using the OpenAI message format — a true drop-in replacement.' },
  { icon: Sparkles,      title: 'Vibecode',           desc: 'Describe what to build and EIOR Coder writes production-ready code, streamed live.' },
  { icon: Bot,           title: 'OpenClaw ready',     desc: 'Point OpenClaw at /eior/v1. Select an EIOR model. Done — no code changes required.' },
  { icon: Layers,        title: 'Embeddings',         desc: 'High-quality text embeddings for semantic search, RAG pipelines, and clustering.' },
  { icon: Key,           title: 'API key management', desc: 'Create, rotate, and revoke keys from your dashboard. Per-key usage analytics.' },
  { icon: Shield,        title: 'Secure by default',  desc: 'Rate limiting, key validation, and request sanitisation on every single endpoint.' },
  { icon: Server,        title: 'VPS provisioning',   desc: 'Spin up a Hetzner Cloud server with Ollama pre-installed in one click.' },
  { icon: Globe,         title: 'OpenAI compatible',  desc: 'Works with any SDK that speaks OpenAI — Python, Node, Go, Rust, and more.' },
  { icon: Terminal,      title: 'Developer first',    desc: 'Clean REST API, comprehensive docs, and example integrations out of the box.' },
];

const STATS = [
  { value: '3',       label: 'Models'           },
  { value: '100%',    label: 'OpenAI compatible' },
  { value: '<200ms',  label: 'Avg. latency'      },
  { value: 'Free',    label: 'To start'          },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ececec] overflow-x-hidden">

      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* top-left glow */}
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#10a37f]/10 blur-[120px]" />
        {/* top-right glow */}
        <div className="absolute -top-20 right-0 h-[500px] w-[500px] rounded-full bg-violet-600/8 blur-[100px]" />
        {/* bottom glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-[#10a37f]/5 blur-[100px]" />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-sm">
            <span className="h-7 w-7 rounded-lg bg-[#10a37f] flex items-center justify-center shadow-lg shadow-[#10a37f]/30">
              <Code2 className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-white">EIOR</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            <Link href="/docs"    className="px-3 py-1.5 text-sm text-[#8e8ea0] hover:text-white hover:bg-white/5 rounded-lg transition-colors">API</Link>
            <Link href="/pricing" className="px-3 py-1.5 text-sm text-[#8e8ea0] hover:text-white hover:bg-white/5 rounded-lg transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#10a37f] text-white text-sm font-semibold hover:bg-[#0d9270] transition-colors shadow-lg shadow-[#10a37f]/20">
                Open EIOR <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login"    className="hidden sm:block px-3 py-1.5 text-sm text-[#8e8ea0] hover:text-white hover:bg-white/5 rounded-lg transition-colors">Log in</Link>
                <Link href="/register" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#10a37f]/30 bg-[#10a37f]/8 px-4 py-1.5 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10a37f] animate-pulse" />
          <span className="text-xs font-medium text-[#10a37f] tracking-wide">OpenAI-compatible · Open source · Free to start</span>
        </div>

        {/* Headline */}
        <h1 className="text-6xl sm:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
          <span
            className="inline-block"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Your own AI
          </span>
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #10a37f 0%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            API platform
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-[#8e8ea0] mb-10 max-w-xl mx-auto leading-relaxed">
          Run EIOR models via a fully OpenAI-compatible REST API. Works with OpenClaw, any SDK, and your existing codebase — with zero code changes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20">
          <Link
            href={user ? '/dashboard' : '/register'}
            className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#10a37f] text-white text-sm font-semibold hover:bg-[#0d9270] transition-all shadow-xl shadow-[#10a37f]/25 hover:shadow-[#10a37f]/40 hover:-translate-y-0.5"
          >
            {user ? 'Open EIOR' : 'Start for free'} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 bg-white/4 text-sm text-[#ececec] hover:bg-white/8 hover:border-white/15 transition-all backdrop-blur-sm"
          >
            <Terminal className="h-4 w-4 text-[#8e8ea0]" />
            View API docs
          </Link>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 mb-20">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-[#8e8ea0] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Code card */}
        <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden text-left shadow-2xl shadow-black/50">
          {/* titlebar */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/6 bg-[#161616]">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-[#8e8ea0] font-mono">migrate.ts — 2 lines changed</span>
          </div>
          <div className="p-6 overflow-x-auto">
            <pre className="text-sm font-mono leading-7">
<span className="text-[#8e8ea0]/40 select-none">1  </span><span className="text-red-400/60 line-through opacity-60">const openai = new OpenAI(&#123; apiKey: &quot;sk-...&quot; &#125;);</span>{'\n'}
<span className="text-[#8e8ea0]/40 select-none">2  </span>{'\n'}
<span className="text-emerald-500/50 select-none">3  </span><span className="text-emerald-400">{'const openai = new OpenAI({'}</span>{'\n'}
<span className="text-emerald-500/50 select-none">4  </span><span className="text-emerald-400">{'  apiKey:  "fk_your_eior_key",'}</span>{'\n'}
<span className="text-emerald-500/50 select-none">5  </span><span className="text-emerald-400">{'  baseURL: "https://yourapi.com/eior/v1",'}</span>{'\n'}
<span className="text-emerald-500/50 select-none">6  </span><span className="text-emerald-400">{'});'}</span>{'\n'}
<span className="text-[#8e8ea0]/40 select-none">7  </span>{'\n'}
<span className="text-[#8e8ea0]/40 select-none">8  </span><span className="text-[#8e8ea0]/60">{'// Everything else stays identical'}</span>{'\n'}
<span className="text-[#8e8ea0]/40 select-none">9  </span><span className="text-[#ececec]/70">{'const res = await openai.chat.completions.create({'}</span>{'\n'}
<span className="text-[#8e8ea0]/40 select-none">10 </span>{'  '}<span className="text-[#10a37f]">model</span>{': '}<span className="text-amber-400/80">&quot;eior-v1&quot;</span>{','}{'\n'}
<span className="text-[#8e8ea0]/40 select-none">11 </span>{'  '}<span className="text-[#10a37f]">messages</span>{': [{ role: '}<span className="text-amber-400/80">&quot;user&quot;</span>{', content: '}<span className="text-amber-400/80">&quot;Hello!&quot;</span>{' }],'}{'\n'}
<span className="text-[#8e8ea0]/40 select-none">12 </span>{'  '}<span className="text-[#10a37f]">stream</span>{': '}<span className="text-violet-400">true</span>{','}{'\n'}
<span className="text-[#8e8ea0]/40 select-none">13 </span><span className="text-[#ececec]/70">{'});'}</span>
            </pre>
          </div>
        </div>
      </section>

      {/* ── Models ──────────────────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-[0.2em] mb-3">Model family</p>
          <h2 className="text-4xl font-bold text-white">The EIOR models</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {MODELS.map((m) => (
            <div
              key={m.id}
              className="group relative rounded-2xl border border-white/8 bg-[#111111] p-6 hover:border-white/15 hover:bg-[#161616] transition-all duration-300 overflow-hidden"
            >
              {/* inner glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 0%, rgba(16,163,127,0.06) 0%, transparent 70%)' }} />

              <div className="flex items-start justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-[#10a37f]" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${m.badgeColor}`}>
                  {m.badge}
                </span>
              </div>

              <h3 className="font-bold text-white text-base mb-1">{m.name}</h3>
              <p className="text-xs font-mono text-[#10a37f]/80 mb-3">{m.id}</p>
              <p className="text-sm text-[#8e8ea0] leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── OpenClaw integration ─────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-[0.2em] mb-3">Integration</p>
          <h2 className="text-4xl font-bold text-white mb-4">Use EIOR in OpenClaw</h2>
          <p className="text-[#8e8ea0] max-w-lg mx-auto">
            EIOR speaks OpenAI natively. Add it to OpenClaw with a single config block — no plugins, no adapters.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden shadow-2xl shadow-black/50 mb-5">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/6 bg-[#161616]">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-[#8e8ea0] font-mono">openclaw.json</span>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/6">
            <div className="p-5">
              <p className="text-[10px] font-bold text-[#8e8ea0] uppercase tracking-widest mb-3">Environment</p>
              <pre className="text-xs font-mono text-[#ececec] leading-6 overflow-x-auto">
<span className="text-[#10a37f]">EIOR_BASE_URL</span><span className="text-[#8e8ea0]">=</span><span className="text-amber-400/80">&quot;https://yourapi.com/eior/v1&quot;</span>{'\n'}
<span className="text-[#10a37f]">EIOR_API_KEY</span><span className="text-[#8e8ea0]">=</span><span className="text-amber-400/80">&quot;fk_your_key&quot;</span>
              </pre>
            </div>
            <div className="p-5">
              <p className="text-[10px] font-bold text-[#8e8ea0] uppercase tracking-widest mb-3">Config</p>
              <pre className="text-xs font-mono text-[#ececec] leading-6 overflow-x-auto">
<span className="text-[#8e8ea0]">{'{'}</span>{'\n'}
{'  '}<span className="text-[#10a37f]">&quot;models&quot;</span><span className="text-[#8e8ea0]">: {'{'}</span>{'\n'}
{'    '}<span className="text-[#10a37f]">&quot;providers&quot;</span><span className="text-[#8e8ea0]">: {'{'}</span>{'\n'}
{'      '}<span className="text-violet-400">&quot;eior&quot;</span><span className="text-[#8e8ea0]">: {'{'}</span>{'\n'}
{'        '}<span className="text-[#10a37f]">&quot;baseUrl&quot;</span><span className="text-[#8e8ea0]">: </span><span className="text-amber-400/80">&quot;$&#123;EIOR_BASE_URL&#125;&quot;</span><span className="text-[#8e8ea0]">,</span>{'\n'}
{'        '}<span className="text-[#10a37f]">&quot;apiKey&quot;</span><span className="text-[#8e8ea0]">: </span><span className="text-amber-400/80">&quot;$&#123;EIOR_API_KEY&#125;&quot;</span><span className="text-[#8e8ea0]">,</span>{'\n'}
{'        '}<span className="text-[#10a37f]">&quot;api&quot;</span><span className="text-[#8e8ea0]">: </span><span className="text-amber-400/80">&quot;openai-completions&quot;</span>{'\n'}
{'      '}<span className="text-[#8e8ea0]">{'}'}</span>{'\n'}
{'    '}<span className="text-[#8e8ea0]">{'}'}</span>{'\n'}
{'  '}<span className="text-[#8e8ea0]">{'}'}</span>{'\n'}
<span className="text-[#8e8ea0]">{'}'}</span>
              </pre>
            </div>
          </div>
        </div>

        {/* model chips */}
        <div className="flex flex-wrap gap-2 justify-center">
          {['eior-v1', 'eior-advanced', 'eior-coder', 'eior-image-gen'].map((m) => (
            <span
              key={m}
              className="rounded-full border border-[#10a37f]/25 bg-[#10a37f]/6 text-[#10a37f] px-4 py-1.5 font-mono text-xs hover:border-[#10a37f]/50 hover:bg-[#10a37f]/10 transition-colors cursor-default"
            >
              {m}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-[0.2em] mb-3">Capabilities</p>
          <h2 className="text-4xl font-bold text-white">Everything in one API</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/8 bg-[#111111] p-5 hover:border-white/14 hover:bg-[#161616] transition-all duration-200"
            >
              <div className="h-9 w-9 rounded-xl bg-[#10a37f]/10 border border-[#10a37f]/15 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/15 group-hover:border-[#10a37f]/25 transition-colors">
                <f.icon className="h-4 w-4 text-[#10a37f]" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-2">{f.title}</h3>
              <p className="text-sm text-[#8e8ea0] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#10a37f] uppercase tracking-[0.2em] mb-3">Pricing</p>
          <h2 className="text-4xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-[#8e8ea0]">No hidden fees. Cancel anytime.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {([
            { name: 'Free',       price: '$0',  period: '/forever', reqs: '1,000 req/mo',  rate: '20 req/min',   cta: 'Get started',     highlight: false, popular: false },
            { name: 'Pro',        price: '$19', period: '/month',   reqs: '50,000 req/mo', rate: '120 req/min',  cta: 'Upgrade to Pro',  highlight: true,  popular: true  },
            { name: 'Enterprise', price: '$99', period: '/month',   reqs: 'Unlimited',     rate: 'Custom limit', cta: 'Contact us',      highlight: false, popular: false },
          ] as const).map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-6 transition-all duration-200 ${
                p.highlight
                  ? 'border-[#10a37f]/40 bg-gradient-to-b from-[#10a37f]/8 to-[#111111] shadow-xl shadow-[#10a37f]/10'
                  : 'border-white/8 bg-[#111111] hover:border-white/14 hover:bg-[#161616]'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold text-white bg-[#10a37f] rounded-full px-3 py-1 tracking-widest uppercase shadow-lg shadow-[#10a37f]/30">
                    Most popular
                  </span>
                </div>
              )}

              <p className="font-bold text-white text-lg mb-1">{p.name}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-bold text-white">{p.price}</span>
                <span className="text-sm text-[#8e8ea0]">{p.period}</span>
              </div>

              <div className="space-y-3 mb-6">
                {[p.reqs, p.rate, 'All EIOR models', 'Vibecode', 'OpenClaw compatible', 'API key management'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#10a37f] shrink-0" />
                    <span className="text-sm text-[#8e8ea0]">{item}</span>
                  </div>
                ))}
              </div>

              <Link
                href={user ? '/dashboard' : '/register'}
                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  p.highlight
                    ? 'bg-[#10a37f] hover:bg-[#0d9270] text-white shadow-lg shadow-[#10a37f]/25'
                    : 'border border-white/10 hover:bg-white/6 text-white hover:border-white/15'
                }`}
              >
                {user ? 'Open dashboard' : p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="relative rounded-3xl border border-white/8 bg-[#111111] overflow-hidden px-8 py-16 text-center">
          {/* glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,163,127,0.12) 0%, transparent 65%)' }} />
          {/* grid */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#10a37f]/30 bg-[#10a37f]/8 px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-[#10a37f]" />
              <span className="text-xs font-medium text-[#10a37f]">No credit card required</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Start building today</h2>
            <p className="text-[#8e8ea0] mb-10 max-w-md mx-auto">
              Sign up for free, grab your API key, and make your first request in under 2 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={user ? '/dashboard' : '/register'}
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#10a37f] text-white text-sm font-semibold hover:bg-[#0d9270] transition-all shadow-xl shadow-[#10a37f]/25 hover:-translate-y-0.5"
              >
                {user ? 'Go to dashboard' : 'Try EIOR for free'} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 bg-white/4 text-sm text-[#ececec] hover:bg-white/8 transition-all"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-sm">
              <span className="h-6 w-6 rounded-lg bg-[#10a37f] flex items-center justify-center">
                <Code2 className="h-3 w-3 text-white" />
              </span>
              <span className="text-white">EIOR</span>
            </Link>

            <div className="flex items-center gap-1">
              {[
                { href: '/docs',           label: 'API'    },
                { href: '/pricing',        label: 'Pricing'},
                { href: '/dashboard/docs', label: 'Docs'   },
                { href: '/dashboard/vps',  label: 'VPS'    },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="px-3 py-1.5 text-sm text-[#8e8ea0] hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>

            <p className="text-xs text-[#8e8ea0]">© {new Date().getFullYear()} EIOR · Powered by Ollama</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
