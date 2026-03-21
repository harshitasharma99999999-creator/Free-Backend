'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowUp,
  Square,
  Mic,
  MicOff,
  Copy,
  Check,
  FileDown,
  Paperclip,
  X,
  Files,
  Search,
  GitBranch,
  Play,
  Boxes,
  Terminal,
} from 'lucide-react';
import { BACKEND_BASE_URL, backendFetch } from '@/lib/backendFetch';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
};

type Attachment = { id: string; file: File };
type FileNode = { type: 'dir' | 'file'; name: string; path: string; children?: FileNode[] };

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

function parseVibecodeFiles(output: string) {
  const files = new Map<string, string>();
  const re = /^FILE:\s*(.+?)\s*[\r\n]+```[^\r\n]*[\r\n]+([\s\S]*?)\r?\n```/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output))) {
    const path = (m[1] || '').trim();
    const content = m[2] ?? '';
    if (path) files.set(path, content);
  }
  return files;
}

function buildTree(paths: string[]) {
  const root: FileNode = { type: 'dir', name: '', path: '', children: [] };
  const byPath = new Map<string, FileNode>([['', root]]);

  for (const full of paths.sort((a, b) => a.localeCompare(b))) {
    const parts = full.split('/').filter(Boolean);
    let curPath = '';
    let parent = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const nextPath = curPath ? `${curPath}/${name}` : name;
      const isFile = i === parts.length - 1;
      let node = byPath.get(nextPath);
      if (!node) {
        node = { type: isFile ? 'file' : 'dir', name, path: nextPath, children: isFile ? undefined : [] };
        byPath.set(nextPath, node);
        parent.children!.push(node);
      }
      if (!isFile) {
        parent = node;
        curPath = nextPath;
      }
    }
  }

  return root;
}

export default function VibecodePage() {
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [rawOutput, setRawOutput] = useState('');
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [activeFile, setActiveFile] = useState<string>('');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<'vibecode' | 'output'>('vibecode');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const rec: SpeechRecognitionLike = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const transcript = r?.[0]?.transcript || '';
        if (r.isFinal) finalText += transcript;
        else interimText += transcript;
      }

      if (finalText || interimText) {
        setDescription((prev) => {
          const base = prev.trimEnd();
          const next = (finalText || interimText).trim();
          if (!next) return prev;
          return (base ? base + ' ' : '') + next;
        });
      }
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  function toggleVoice() {
    const rec = recognitionRef.current;
    if (!rec) return;

    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function copyOutput() {
    navigator.clipboard.writeText(rawOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportPdf() {
    function escapeHtml(s: string) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const title = 'EIOR Vibecode';
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f6f6f6; padding: 10px; border-radius: 10px; margin: 0; font-size: 12px; line-height: 1.5; }
    @media print { body { margin: 12mm; } pre { background: #fff; border: 1px solid #ddd; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <pre>${escapeHtml(rawOutput)}</pre>
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

  function openFile(path: string) {
    setActiveFile(path);
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }

  function closeTab(path: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      if (activeFile === path) setActiveFile(next[0] || '');
      return next;
    });
  }

  const generate = useCallback(async () => {
    const prompt = description.trim();
    if ((!prompt && attachments.length === 0) || loading) return;

    setError('');
    setRawOutput('');
    setFiles(new Map());
    setActiveFile('');
    setOpenTabs([]);
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const maxInlineBytes = 750_000;
      const attachBlocks: string[] = [];
      for (const a of attachments) {
        const f = a.file;
        const meta = `name=${f.name}, type=${f.type || 'unknown'}, size=${formatBytes(f.size)}`;
        if (isProbablyTextFile(f) && f.size <= maxInlineBytes) {
          const text = await f.text().catch(() => '');
          attachBlocks.push(`\n\n[ATTACHMENT ${meta}]\n${text}\n[/ATTACHMENT]`);
        } else {
          attachBlocks.push(
            `\n\n[ATTACHMENT ${meta}]\n(Binary file not inlined. If you want me to use it, upload it somewhere and paste a public link.)\n[/ATTACHMENT]`,
          );
        }
      }
      const promptWithAttachments = `${prompt}${attachBlocks.join('')}`.trim();
      setAttachments([]);

      const res = await backendFetch(`/api/vibecode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: promptWithAttachments, stream: true }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const hint =
          res.status === 404 && !BACKEND_BASE_URL
            ? 'Vibecode API returned 404. Set `NEXT_PUBLIC_API_URL` (or deploy with a host rewrite/proxy for `/api/*`) and rebuild the frontend.'
            : null;
        throw new Error(data.message || data.error || hint || `Error ${res.status}`);
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
            const parsed = JSON.parse(data) as { event?: string; token?: string; output?: string };
            if (parsed.event === 'token' && parsed.token) setRawOutput((prev) => prev + parsed.token);
            if (parsed.event === 'done' && typeof parsed.output === 'string') {
              setRawOutput(parsed.output);
              const nextFiles = parseVibecodeFiles(parsed.output);
              setFiles(nextFiles);
              const first = nextFiles.keys().next().value as string | undefined;
              if (first) {
                setActiveFile(first);
                setOpenTabs([first]);
              }
              setActivePanel('output');
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      let msg = err instanceof Error ? err.message : 'Generation failed';
      if ((err instanceof TypeError && /fetch/i.test(msg)) || /Failed to fetch|NetworkError/i.test(msg)) {
        msg =
          'Request failed. Confirm the backend is deployed and `frontend/vercel.json` rewrites point to it, then redeploy the frontend.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [description, loading, attachments]);

  const tree = buildTree(Array.from(files.keys()));

  function renderTree(node: FileNode, depth = 0): JSX.Element {
    const kids = node.children || [];
    return (
      <div key={node.path || 'root'}>
        {kids.map((c) => {
          const pad = { paddingLeft: `${8 + depth * 12}px` };
          if (c.type === 'dir') {
            return (
              <div key={c.path}>
                <div className="text-xs text-[#c5c5c5] py-1" style={pad}>
                  {c.name}
                </div>
                {renderTree(c, depth + 1)}
              </div>
            );
          }
          const active = c.path === activeFile;
          return (
            <button
              key={c.path}
              type="button"
              onClick={() => openFile(c.path)}
              className={
                'w-full text-left text-xs py-1 pr-2 truncate ' + (active ? 'bg-[#094771] text-white' : 'text-[#c5c5c5] hover:bg-white/5')
              }
              style={pad}
              title={c.path}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-white/5 bg-[#252526]">
        <div className="flex items-center gap-4 text-xs text-[#cccccc]">
          <span className="font-semibold tracking-wide">EIOR Vibecode</span>
          <span className="hidden md:inline">File</span>
          <span className="hidden md:inline">Edit</span>
          <span className="hidden md:inline">Selection</span>
          <span className="hidden md:inline">View</span>
          <span className="hidden md:inline">Go</span>
          <span className="hidden md:inline">Run</span>
          <span className="hidden md:inline">Terminal</span>
          <span className="hidden md:inline">Help</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportPdf} className="gap-1.5 h-7 px-2 text-xs" disabled={!rawOutput}>
            <FileDown className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={copyOutput} className="gap-1.5 h-7 px-2 text-xs" disabled={!rawOutput}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-12 shrink-0 bg-[#333333] border-r border-white/5 flex flex-col items-center py-2 gap-2">
          <button className="h-10 w-10 rounded hover:bg-white/10 flex items-center justify-center" title="Explorer">
            <Files className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded hover:bg-white/10 flex items-center justify-center opacity-70" title="Search">
            <Search className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded hover:bg-white/10 flex items-center justify-center opacity-70" title="Source Control">
            <GitBranch className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded hover:bg-white/10 flex items-center justify-center opacity-70" title="Run">
            <Play className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded hover:bg-white/10 flex items-center justify-center opacity-70" title="Extensions">
            <Boxes className="h-5 w-5" />
          </button>
        </div>

        <div className="w-72 shrink-0 bg-[#252526] border-r border-white/5 flex flex-col min-h-0">
          <div className="h-8 px-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-[#bbbbbb] border-b border-white/5">
            Explorer
            <span className="text-[#8e8ea0] normal-case">{files.size ? `${files.size} files` : ''}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {files.size ? renderTree(tree) : <div className="px-3 text-xs text-[#8e8ea0]">Generate a project to see files here.</div>}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="h-9 shrink-0 bg-[#252526] border-b border-white/5 flex items-stretch overflow-x-auto">
            {openTabs.length === 0 ? (
              <div className="px-3 flex items-center text-xs text-[#8e8ea0]">No file open</div>
            ) : (
              openTabs.map((p) => (
                <div
                  key={p}
                  className={
                    'flex items-center gap-2 px-3 border-r border-white/5 text-xs cursor-pointer select-none ' +
                    (p === activeFile ? 'bg-[#1e1e1e] text-white' : 'text-[#c5c5c5] hover:bg-white/5')
                  }
                  onClick={() => setActiveFile(p)}
                  title={p}
                >
                  <span className="truncate max-w-[220px]">{p.split('/').pop()}</span>
                  <button
                    type="button"
                    className="opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(p);
                    }}
                    title="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex-1 min-h-0 bg-[#1e1e1e] overflow-auto">
            {activeFile && files.get(activeFile) != null ? (
              <pre className="p-4 text-[12px] leading-5 font-mono whitespace-pre overflow-auto">{files.get(activeFile)}</pre>
            ) : (
              <div className="p-6 text-sm text-[#8e8ea0]">
                {files.size ? 'Select a file from the Explorer to view it.' : 'Generate a project to see files here.'}
              </div>
            )}
          </div>

          <div className="h-[240px] shrink-0 bg-[#1e1e1e] border-t border-white/5 flex flex-col min-h-0">
            <div className="h-9 shrink-0 bg-[#252526] border-b border-white/5 flex items-center justify-between px-2">
              <div className="flex items-center gap-1 text-xs">
                <button
                  className={'px-2 py-1 rounded ' + (activePanel === 'vibecode' ? 'bg-white/10 text-white' : 'text-[#c5c5c5] hover:bg-white/5')}
                  onClick={() => setActivePanel('vibecode')}
                >
                  Vibecode
                </button>
                <button
                  className={'px-2 py-1 rounded ' + (activePanel === 'output' ? 'bg-white/10 text-white' : 'text-[#c5c5c5] hover:bg-white/5')}
                  onClick={() => setActivePanel('output')}
                >
                  Output
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8e8ea0]">
                {loading ? 'Generating…' : ''}
                <Terminal className="h-4 w-4 opacity-70" />
              </div>
            </div>

            {activePanel === 'output' ? (
              <div className="flex-1 min-h-0 overflow-auto">
                <pre className="p-3 text-[12px] leading-5 font-mono whitespace-pre-wrap break-words">
                  {rawOutput || (loading ? 'Generating…' : 'No output yet.')}
                </pre>
              </div>
            ) : (
              <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/*,text/*,application/json,application/xml,application/x-yaml,application/yaml"
                  className="hidden"
                  onChange={(e) => {
                    const next = Array.from(e.target.files || []);
                    if (next.length > 0) setAttachments((prev) => [...prev, ...next.map((file) => ({ id: crypto.randomUUID(), file }))]);
                    e.currentTarget.value = '';
                  }}
                />

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 rounded flex items-center justify-center text-[#c5c5c5] hover:bg-white/10"
                    title="Attach files or videos"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the app you want. Vibecode will generate a full working project (file tree + files + run steps)."
                    rows={3}
                    className="flex-1 resize-none rounded-md bg-[#2a2a2a] border border-white/10 px-3 py-2 text-sm text-[#ececec] placeholder:text-[#8e8ea0] outline-none focus:border-white/20 min-h-[76px] max-h-[160px]"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleVoice}
                    disabled={!voiceSupported}
                    className="h-9 w-9 rounded shrink-0"
                    title={voiceSupported ? (listening ? 'Stop voice' : 'Start voice') : 'Voice not supported in this browser'}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>

                  <button
                    onClick={loading ? stop : generate}
                    disabled={!loading && !description.trim() && attachments.length === 0}
                    className={
                      'h-9 w-9 rounded flex items-center justify-center transition-all shrink-0 ' +
                      (loading
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : description.trim() || attachments.length > 0
                          ? 'bg-white text-black hover:bg-white/90'
                          : 'bg-white/10 text-[#8e8ea0] cursor-not-allowed')
                    }
                    title={loading ? 'Stop' : 'Generate app'}
                  >
                    {loading ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            )}
          </div>

          <div className="h-6 shrink-0 bg-[#007acc] text-white text-[11px] flex items-center justify-between px-3">
            <span>{activeFile ? activeFile : 'Ready'}</span>
            <span>{BACKEND_BASE_URL ? 'API: external' : 'API: /api rewrite'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

