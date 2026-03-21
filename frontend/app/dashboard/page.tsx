'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowUp,
  Square,
  Copy,
  Check,
  Sparkles,
  Code2,
  MessageSquare,
  Zap,
  RotateCcw,
  FileDown,
  Paperclip,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BACKEND_BASE_URL, backendFetch } from '@/lib/backendFetch';

// Deployed builds use `frontend/vercel.json` rewrites to proxy `/api/*` to the backend.

const MODELS: Record<string, string> = {
  EIOR: 'eior-v1',
  'EIOR Advanced': 'eior-advanced',
  'EIOR Coder': 'eior-coder',
};

const SUGGESTIONS = [
  {
    icon: Code2,
    label: 'Write me a REST API',
    prompt: 'Write a REST API with Node.js and Express that handles user authentication with JWT tokens.',
  },
  {
    icon: Sparkles,
    label: 'Explain quantum computing',
    prompt: 'Explain quantum computing in simple terms, including qubits, superposition, and entanglement.',
  },
  {
    icon: MessageSquare,
    label: 'Debug my code',
    prompt: 'Help me debug: my async function keeps returning undefined even though I await it.',
  },
  {
    icon: Zap,
    label: 'Write a Python script',
    prompt: 'Write a Python script that reads a CSV file, computes summary statistics, and exports a formatted report.',
  },
];

type Message = { role: 'user' | 'assistant'; content: string; id: string };
type Attachment = { id: string; file: File };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let v = bytes;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  const num = idx === 0 ? String(Math.round(v)) : v.toFixed(v < 10 ? 1 : 0);
  return `${num} ${units[idx]}`;
}

function isProbablyTextFile(file: File) {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('text/')) return true;
  return [
    'application/json',
    'application/xml',
    'application/x-yaml',
    'application/yaml',
    'application/javascript',
    'application/typescript',
  ].includes(t);
}

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[70%] rounded-3xl bg-[#2f2f2f] px-5 py-3 text-sm text-[#ececec] leading-relaxed whitespace-pre-wrap break-words">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6 group">
      <div className="h-7 w-7 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 mt-0.5">
        <Code2 className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white mb-1.5">EIOR</p>
        <div className="text-sm text-[#ececec] leading-relaxed whitespace-pre-wrap break-words">
          {msg.content || <span className="inline-block h-4 w-0.5 bg-[#10a37f] animate-pulse" />}
        </div>
        {msg.content && (
          <button
            onClick={copy}
            className="mt-2 flex items-center gap-1.5 text-xs text-[#8e8ea0] hover:text-white opacity-0 group-hover:opacity-100 transition-all"
          >
            {copied ? <Check className="h-3 w-3 text-[#10a37f]" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('EIOR');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) sendMessage();
    }
  }

  const sendMessage = useCallback(
    async (overrideContent?: string) => {
      const content = (overrideContent || input).trim();
      if ((!content && attachments.length === 0) || loading) return;

      const maxInlineBytes = 750_000; // keep requests reasonable for serverless + models
      const attachBlocks: string[] = [];
      for (const a of attachments) {
        const f = a.file;
        const meta = `name=${f.name}, type=${f.type || 'unknown'}, size=${formatBytes(f.size)}`;
        if (isProbablyTextFile(f) && f.size <= maxInlineBytes) {
          const text = await f.text().catch(() => '');
          attachBlocks.push(`\n\n[ATTACHMENT ${meta}]\n${text}\n[/ATTACHMENT]`);
        } else {
          attachBlocks.push(`\n\n[ATTACHMENT ${meta}]\n(Binary file not inlined. If you want me to analyze it, upload it somewhere and paste a public link.)\n[/ATTACHMENT]`);
        }
      }

      const contentWithAttachments = `${content}${attachBlocks.join('')}`.trim();

      const userMsg: Message = { role: 'user', content: contentWithAttachments, id: crypto.randomUUID() };
      const assistantMsg: Message = { role: 'assistant', content: '', id: crypto.randomUUID() };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setAttachments([]);
      setLoading(true);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const history = [...messages, userMsg].map(({ role, content: c }) => ({ role, content: c }));
      abortRef.current = new AbortController();

      try {
        const res = await backendFetch(`/api/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: MODELS[model] || 'eior-v1', messages: history, stream: true }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          const hint =
            res.status === 404 && !BACKEND_BASE_URL
              ? 'Chat API returned 404. Set `NEXT_PUBLIC_API_URL` (or deploy with a host rewrite/proxy for `/api/*`) and rebuild the frontend.'
              : null;
          throw new Error(data.error?.message || hint || `Error ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const chunk = JSON.parse(data);
              const token = chunk.choices?.[0]?.delta?.content;
              if (token) {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + token };
                  return copy;
                });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      let msg = err instanceof Error ? err.message : 'Something went wrong';
      // Only show the generic hint for browser network failures.
      // Backend model errors can include "fetch failed (...)" and should be shown verbatim.
      if ((err instanceof TypeError && /fetch/i.test(msg)) || /Failed to fetch|NetworkError/i.test(msg)) {
        msg = 'Request failed. Confirm the backend is deployed and `frontend/vercel.json` rewrites point to it, then redeploy the frontend.';
      }
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: `Error: ${msg}` };
        return copy;
      });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, model, messages, attachments],
  );

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function reset() {
    setMessages([]);
    setInput('');
  }

  function exportPdf() {
    function escapeHtml(s: string) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const title = 'EIOR Chat';
    const body = messages
      .map((m) => {
        const who = m.role === 'user' ? 'You' : 'EIOR';
        return `<div class=\"msg\"><div class=\"who\">${who}</div><pre class=\"text\">${escapeHtml(m.content)}</pre></div>`;
      })
      .join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    .msg { margin: 0 0 14px; }
    .who { font-weight: 700; font-size: 12px; margin: 0 0 6px; }
    .text { white-space: pre-wrap; word-wrap: break-word; background: #f6f6f6; padding: 10px; border-radius: 10px; margin: 0; font-size: 12px; line-height: 1.5; }
    @media print { body { margin: 12mm; } .text { background: #fff; border: 1px solid #ddd; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const isEmpty = messages.length === 0;
  const canSend = loading ? true : input.trim().length > 0 || attachments.length > 0;

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm font-semibold text-white hidden md:block">{model}</span>
        {!isEmpty && (
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={exportPdf}
              className="flex items-center gap-1.5 text-xs text-[#8e8ea0] hover:text-white transition-colors"
              title="Export to PDF (Print dialog)"
            >
              <FileDown className="h-3.5 w-3.5" /> Export PDF
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-[#8e8ea0] hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> New chat
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
            <div className="h-12 w-12 rounded-full bg-[#10a37f] flex items-center justify-center mb-6">
              <Code2 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-10">What can I help with?</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-[#171717] hover:bg-[#1e1e1e] border border-white/5 hover:border-white/10 text-left transition-all group"
                >
                  <s.icon className="h-4 w-4 text-[#8e8ea0] group-hover:text-[#10a37f] mt-0.5 shrink-0 transition-colors" />
                  <span className="text-sm text-[#ececec] leading-snug">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 pt-4 pb-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-[#2f2f2f] rounded-3xl px-4 py-3 border border-white/5 focus-within:border-white/10 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,text/*,application/json,application/xml,application/x-yaml,application/yaml"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                  setAttachments((prev) => [
                    ...prev,
                    ...files.map((file) => ({ id: crypto.randomUUID(), file })),
                  ]);
                }
                e.currentTarget.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 rounded-full flex items-center justify-center text-[#8e8ea0] hover:text-white hover:bg-white/10 transition-all shrink-0"
              title="Attach files or videos"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message EIOR"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-[#ececec] placeholder:text-[#8e8ea0] outline-none min-h-[24px] max-h-[200px] leading-6 py-0.5"
            />
            <button
              onClick={loading ? stop : () => sendMessage()}
              disabled={!loading && !input.trim() && attachments.length === 0}
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center transition-all shrink-0',
                loading
                  ? 'bg-white/20 hover:bg-white/30 text-white'
                  : canSend
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-white/10 text-[#8e8ea0] cursor-not-allowed',
              )}
            >
              {loading ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="max-w-3xl mx-auto mt-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs text-[#ececec]"
                >
                  <span className="truncate max-w-[240px]" title={a.file.name}>
                    {a.file.name}
                  </span>
                  <span className="text-[#8e8ea0]">{formatBytes(a.file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    className="text-[#8e8ea0] hover:text-white transition-colors"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-center text-[10px] text-[#8e8ea0]/60 mt-2">EIOR can make mistakes. Verify important information.</p>
        </div>
      </div>
    </div>
  );
}
