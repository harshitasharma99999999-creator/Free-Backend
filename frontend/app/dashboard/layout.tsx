'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Key,
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  Sparkles,
  Plus,
  ChevronDown,
  Code2,
  Server,
  PanelLeftClose,
  Puzzle,
  HardDrive,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',                    label: 'Chat',          icon: MessageSquare, exact: true },
  { href: '/dashboard/vibecode',           label: 'Code',          icon: Sparkles },
  { href: '/dashboard/vps',               label: 'VPS',           icon: Server },
  { href: '/dashboard/keys',              label: 'API Keys',      icon: Key },
  { href: '/dashboard/docs',              label: 'Docs',          icon: BookOpen },
  { href: '/dashboard/usage',             label: 'Usage',         icon: BarChart3 },
  { href: '/dashboard/settings',          label: 'Settings',      icon: Settings },
];

const GUIDES = [
  { href: '/dashboard/guides/openclaw', label: 'OpenClaw Setup',   icon: Puzzle },
  { href: '/dashboard/guides/vps',      label: 'OpenClaw on VPS',  icon: HardDrive },
];

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, loading, logout } = useAuth();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [modelOpen, setModelOpen]   = useState(false);
  const [model, setModel]           = useState('EIOR');

  useEffect(() => { if (typeof window !== 'undefined' && window.innerWidth < 768) setMobileOpen(false); }, [pathname]);
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
      <div className="h-7 w-7 rounded-full border-2 border-[#10a37f] border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-[#0f0f0f] text-[#ececec] overflow-hidden">

      {/* ── Mobile overlay ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={cn(
        'fixed md:static inset-y-0 left-0 z-30 flex flex-col',
        'bg-[#171717] transition-all duration-200 ease-in-out overflow-hidden shrink-0',
        mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0',
        sidebarOpen ? 'md:w-[260px]' : 'md:w-0',
      )}>

        {/* Logo + actions */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <span className="h-6 w-6 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0">
              <Code2 className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="font-semibold text-sm text-white whitespace-nowrap">EIOR</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[#8e8ea0] hover:text-white"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[#8e8ea0] hover:text-white"
              title="Hide sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Model selector */}
        <div className="px-3 py-1 shrink-0">
          <button
            onClick={() => setModelOpen(!modelOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10a37f]" />
              <span className="font-medium text-white whitespace-nowrap">{model}</span>
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-[#8e8ea0] transition-transform shrink-0', modelOpen && 'rotate-180')} />
          </button>
          {modelOpen && (
            <div className="mt-1 rounded-xl border border-white/10 bg-[#212121] overflow-hidden py-1">
              {[
                { id: 'EIOR',          sub: 'eior-v1 · General purpose' },
                { id: 'EIOR Advanced', sub: 'eior-advanced · Deep reasoning' },
                { id: 'EIOR Coder',    sub: 'eior-coder · Code generation' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setModelOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors',
                    model === m.id && 'text-[#10a37f]',
                  )}
                >
                  <p className="font-medium whitespace-nowrap">{m.id}</p>
                  <p className="text-xs text-[#8e8ea0] whitespace-nowrap">{m.sub}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors whitespace-nowrap',
                  active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-[#8e8ea0] hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}

          {/* Guides section */}
          <div className="pt-3">
            <p className="text-[10px] font-semibold text-[#555] uppercase tracking-widest px-3 pb-1">Guides</p>
            {GUIDES.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors whitespace-nowrap',
                    active
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-[#8e8ea0] hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group">
            <div className="h-7 w-7 rounded-full bg-[#10a37f]/20 border border-[#10a37f]/40 flex items-center justify-center shrink-0 text-xs font-bold text-[#10a37f] uppercase">
              {user.email?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.email}</p>
            </div>
            <button
              onClick={() => { logout(); router.push('/'); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition-all text-[#8e8ea0] hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Mobile header */}
        <header className="md:hidden h-12 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0f0f0f] shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-white/5">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">{model}</span>
        </header>

        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutInner>{children}</LayoutInner>
    </SidebarProvider>
  );
}
