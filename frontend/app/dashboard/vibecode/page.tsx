'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ArrowUp, Square, Mic, MicOff, Copy, Check, FileDown, Paperclip, X,
  Files, Search, GitBranch, Play, Boxes, Settings2, ChevronRight,
  ChevronDown, Download, RotateCcw, Plus, Terminal, AlertCircle,
  PanelLeftOpen, PanelLeftClose, Sparkles, RefreshCw, Eye, Code,
  ChevronUp, Circle, Minus, Maximize2, FolderOpen, Github, Code2,
} from 'lucide-react';
import { BACKEND_BASE_URL, backendFetch } from '@/lib/backendFetch';
import { useSidebar } from '@/context/SidebarContext';

// ─── VS Code palette ──────────────────────────────────────────────────────────
const C = {
  titleBar:    '#2d2d2d',
  menuBar:     '#2d2d2d',
  menuHover:   '#094771',
  menuDropBg:  '#252526',
  menuBorder:  'rgba(255,255,255,0.12)',
  activityBar: '#2c2c2c',
  sidebar:     '#1e1e1e',
  editorBg:    '#1e1e1e',
  tabsBar:     '#252526',
  tabActive:   '#1e1e1e',
  tabInactive: '#2d2d2d',
  tabBorderTop:'#007acc',
  panelHeader: '#252526',
  statusBar:   '#1a1a1a',
  agentBg:     '#1a1a1a',
  agentInput:  '#2a2a2a',
  agentBorder: 'rgba(255,255,255,0.08)',
  border:      'rgba(0,0,0,0.4)',
  borderLight: 'rgba(255,255,255,0.06)',
  text:        '#cccccc',
  dim:         '#858585',
  dimmer:      '#4e4e4e',
  blue:        '#007acc',
  lightBlue:   '#6cb6ff',
  green:       '#73c991',
  yellow:      '#e5c07b',
  red:         '#f14c4c',
  purple:      '#c586c0',
  input:       '#3c3c3c',
  hover:       'rgba(255,255,255,0.06)',
  active:      '#04395e',
  accentGreen: '#10a37f',
  termBg:      '#0c0c0c',
  termText:    '#cccccc',
};
const FONT_UI   = "'Segoe UI', system-ui, sans-serif";
const FONT_CODE = "Consolas, 'Courier New', monospace";

// ─── App types ────────────────────────────────────────────────────────────────
const APP_TYPES = [
  { id: 'react-vite',     label: 'React + Vite',    group: 'Web'   },
  { id: 'nextjs',         label: 'Next.js',          group: 'Web'   },
  { id: 'html-css-js',    label: 'HTML/CSS/JS',      group: 'Web'   },
  { id: 'landing-page',   label: 'Landing Page',     group: 'Web'   },
  { id: 'express-api',    label: 'Express API',      group: 'API'   },
  { id: 'fastapi',        label: 'FastAPI',           group: 'API'   },
  { id: 'fullstack',      label: 'Full Stack',        group: 'API'   },
  { id: 'cli',            label: 'CLI Tool',          group: 'API'   },
  { id: 'presentation',   label: 'Presentation',     group: 'Media' },
  { id: 'pdf-document',   label: 'Document / PDF',   group: 'Media' },
  { id: 'svg-image',      label: 'SVG Image',        group: 'Media' },
  { id: 'infographic',    label: 'Infographic',      group: 'Media' },
  { id: 'email-template', label: 'Email Template',   group: 'Media' },
] as const;

type SR       = { continuous:boolean;interimResults:boolean;lang:string;start():void;stop():void;onresult:((e:any)=>void)|null;onend:(()=>void)|null;onerror:((e:any)=>void)|null };
type Attach   = { id:string; file:File };
type FileNode = { type:'dir'|'file'; name:string; path:string; children?:FileNode[] };
type GenStep  = { file:string; done:boolean };
type EditorTab = 'editor'|'preview'|'split';
type Activity = 'explorer'|'search'|'git'|'run'|'extensions';
type Message  = { role:'user'|'agent'; text:string; files?:number; ts:number };
type TermType = 'bash'|'powershell'|'cmd'|'node'|'python';
type TermTab  = { id:string; type:TermType; label:string; lines:string[] };

// ─── Utilities ────────────────────────────────────────────────────────────────
function fileIcon(name:string){
  const e=name.split('.').pop()?.toLowerCase()??'';
  const m:Record<string,string>={ts:'🔷',tsx:'⚛️',js:'📜',jsx:'⚛️',json:'📋',html:'🌐',htm:'🌐',css:'🎨',scss:'🎨',sass:'🎨',py:'🐍',md:'📖',mdx:'📖',txt:'📄',sh:'⚡',bash:'⚡',yml:'⚙️',yaml:'⚙️',toml:'⚙️',sql:'🗃️',svg:'🖼️',png:'🖼️',jpg:'🖼️',ico:'🖼️',env:'🔒',vue:'💚',rb:'💎',go:'🐹',rs:'🦀',php:'🐘'};
  if(name==='Dockerfile')return'🐳';
  if(name.startsWith('.env'))return'🔒';
  if(name==='.gitignore')return'🚫';
  if(name==='README.md')return'📖';
  if(name==='package.json')return'📦';
  return m[e]??'📄';
}
function getLang(p:string){const e=p.split('.').pop()?.toLowerCase()??'';return({ts:'ts',tsx:'ts',js:'js',jsx:'js',html:'html',htm:'html',css:'css',scss:'css',json:'json',py:'python',sh:'shell',bash:'shell',yml:'yaml',yaml:'yaml',md:'markdown',svg:'html'} as Record<string,string>)[e]??'text';}
function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtBytes(b:number){if(!b||b<=0)return'0 B';const u=['B','KB','MB'];let i=0,v=b;while(v>=1024&&i<u.length-1){v/=1024;i++;}return`${i?v.toFixed(1):Math.round(v)} ${u[i]}`;}
function isText(f:File){const t=(f.type||'').toLowerCase();return t.startsWith('text/')||['application/json','application/xml','application/x-yaml','application/yaml','application/javascript'].includes(t);}
function timeAgo(ts:number){const s=Math.floor((Date.now()-ts)/1000);if(s<60)return'just now';if(s<3600)return`${Math.floor(s/60)}m ago`;return`${Math.floor(s/3600)}h ago`;}
function nowStr(){const d=new Date();return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;}

function highlight(raw:string,lang:string){
  let c=esc(raw);
  if(lang==='json')return c.replace(/("(?:[^"\\]|\\.)*")(\s*:)/g,'<b class="hk">$1</b>$2').replace(/:\s*("(?:[^"\\]|\\.)*")/g,(m,s)=>m.replace(s,`<b class="hs">${s}</b>`)).replace(/\b(true|false|null)\b/g,'<b class="hkw">$&</b>').replace(/\b(-?\d+(?:\.\d+)?)\b/g,'<b class="hn">$&</b>');
  if(lang==='html')return c.replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<b class="hc">$1</b>').replace(/(&lt;\/?)([\w-]+)/g,'$1<b class="ht">$2</b>').replace(/([\w-]+)=((?:&quot;|")[^"&]*(?:&quot;|"))/g,'<b class="hk">$1</b>=<b class="hs">$2</b>');
  if(lang==='css')return c.replace(/(\/\*[\s\S]*?\*\/)/g,'<b class="hc">$1</b>').replace(/([\w-]+)\s*:/g,'<b class="hk">$1</b>:').replace(/:\s*([^;{}\n]+)/g,(m,v)=>m.replace(v,`<b class="hs">${v}</b>`));
  if(lang==='markdown')return c.replace(/^(#{1,6} .+)$/gm,'<b class="ht">$1</b>').replace(/(`[^`]+`)/g,'<b class="hs">$1</b>');
  const KW=lang==='python'?/\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|pass|break|continue|lambda|yield|async|await|raise|True|False|None|and|or|not|in|is|del|global|print)\b/g:lang==='shell'?/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|echo|exit|set|source)\b/g:/\b(const|let|var|function|class|import|export|from|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|typeof|instanceof|async|await|void|null|undefined|true|false|extends|implements|interface|type|enum|declare|readonly|abstract|static|public|private|protected|default|super)\b/g;
  c=c.replace(/(\/\/[^\n]*|#[^\n]*)/g,'<b class="hc">$1</b>');
  c=c.replace(/(\/\*[\s\S]*?\*\/)/g,'<b class="hc">$1</b>');
  c=c.replace(/(`[^`]*`)/g,'<b class="hs">$1</b>');
  c=c.replace(/("(?:[^"\\]|\\.)*")/g,'<b class="hs">$1</b>');
  c=c.replace(/('(?:[^'\\]|\\.)*')/g,'<b class="hs">$1</b>');
  c=c.replace(/\b(\d+(?:\.\d+)?)\b/g,'<b class="hn">$1</b>');
  c=c.replace(KW,'<b class="hkw">$1</b>');
  c=c.replace(/(function|def|class)\s+(\w+)/g,'$1 <b class="hfn">$2</b>');
  return c;
}

// ─── ZIP ──────────────────────────────────────────────────────────────────────
const CRC_T=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[i]=c;}return t;})();
function crc32(d:Uint8Array){let c=0xffffffff;for(let i=0;i<d.length;i++)c=(c>>>8)^CRC_T[(c^d[i])&0xff];return(c^0xffffffff)>>>0;}
function u16(n:number){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b;}
function u32(n:number){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;}
function cat(...a:Uint8Array[]):Uint8Array<ArrayBuffer>{const buf=new ArrayBuffer(a.reduce((s,x)=>s+x.length,0));const o=new Uint8Array(buf);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;}
function buildZip(files:Map<string,string>):Blob{
  const enc=new TextEncoder(),lp:Uint8Array[]=[], cp:Uint8Array[]=[];let lo=0;
  for(const[path,content]of files){
    const nm=enc.encode(path.replace(/\\/g,'/')),dt=enc.encode(content),cr=crc32(dt),sz=dt.length;
    const lh=cat(new Uint8Array([0x50,0x4b,0x03,0x04]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(cr),u32(sz),u32(sz),u16(nm.length),u16(0),nm,dt);
    const ch=cat(new Uint8Array([0x50,0x4b,0x01,0x02]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(cr),u32(sz),u32(sz),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(lo),nm);
    lp.push(lh);cp.push(ch);lo+=lh.length;
  }
  const cs=cp.reduce((s,c)=>s+c.length,0);
  const eocd=cat(new Uint8Array([0x50,0x4b,0x05,0x06]),u16(0),u16(0),u16(files.size),u16(files.size),u32(cs),u32(lo),u16(0));
  return new Blob([cat(...lp,...cp,eocd)],{type:'application/zip'});
}

function parseFiles(out:string){const m=new Map<string,string>();const re=/^FILE:\s*(.+?)\s*[\r\n]+```[^\r\n]*[\r\n]+([\s\S]*?)\r?\n```/gim;let x:RegExpExecArray|null;while((x=re.exec(out))){const p=(x[1]||'').trim();if(p)m.set(p,x[2]??'');}return m;}
function buildTree(paths:string[]):FileNode{const root:FileNode={type:'dir',name:'',path:'',children:[]};const by=new Map<string,FileNode>([['',root]]);for(const full of paths.sort((a,b)=>a.localeCompare(b))){const parts=full.split('/').filter(Boolean);let cur='',parent=root;for(let i=0;i<parts.length;i++){const name=parts[i],next=cur?`${cur}/${name}`:name,isFile=i===parts.length-1;if(!by.has(next)){const n:FileNode={type:isFile?'file':'dir',name,path:next,children:isFile?undefined:[]};by.set(next,n);parent.children!.push(n);}if(!isFile){parent=by.get(next)!;cur=next;}}}return root;}
function currFile(raw:string){const ms=[...raw.matchAll(/^FILE:\s*(.+?)\s*$/gim)];return ms.length?(ms[ms.length-1][1]||'').trim():null;}

function extractLiveContent(raw:string):string{
  // Split on FILE: markers and get the last section
  const parts=raw.split(/^FILE:\s*/im);
  if(parts.length<2)return '';
  const lastPart=parts[parts.length-1];
  // Skip the filename line
  const nlIdx=lastPart.indexOf('\n');
  if(nlIdx<0)return '';
  const afterName=lastPart.slice(nlIdx+1);
  // Find opening fence
  const fenceMatch=afterName.match(/^```[^\n]*\n/m);
  if(!fenceMatch||fenceMatch.index===undefined)return '';
  let content=afterName.slice(fenceMatch.index+fenceMatch[0].length);
  // Remove closing fence if already streamed
  content=content.replace(/\n```[\s\S]*$/,'');
  return content;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CodePage() {
  const { open: navOpen, toggle: toggleNav } = useSidebar();

  const [desc,setDesc]               = useState('');
  const [appType,setAppType]         = useState('');
  const [attachments,setAttachments] = useState<Attach[]>([]);
  const [listening,setListening]     = useState(false);
  const [voiceOk,setVoiceOk]         = useState(true);
  const [rawOutput,setRawOutput]     = useState('');
  const [files,setFiles]             = useState<Map<string,string>>(new Map());
  const [activeFile,setActiveFile]   = useState('');
  const [openTabs,setOpenTabs]       = useState<string[]>([]);
  const [collapsed,setCollapsed]     = useState<Set<string>>(new Set());
  const [editorTab,setEditorTab]     = useState<EditorTab>('editor');
  const [activity,setActivity]       = useState<Activity>('explorer');
  const [explorerOpen,setExplorerOpen] = useState(true);
  const [steps,setSteps]             = useState<GenStep[]>([]);
  const [curFile,setCurFile]         = useState('');
  const [loading,setLoading]         = useState(false);
  const [error,setError]             = useState('');
  const [copied,setCopied]           = useState(false);
  const [messages,setMessages]       = useState<Message[]>([]);
  const [cursorLn,setCursorLn]       = useState(1);
  const [cursorCol,setCursorCol]     = useState(1);
  const [searchQ,setSearchQ]         = useState('');
  const [agentTyping,setAgentTyping] = useState(false);
  const [streamPreview,setStreamPreview] = useState('');
  const [liveCode,setLiveCode]       = useState('');
  const [terminalOpen,setTerminalOpen] = useState(false);
  const [termLines,setTermLines]     = useState<string[]>([]);
  const [termTabs,setTermTabs]       = useState<TermTab[]>([{id:'t1',type:'bash',label:'bash',lines:[]}]);
  const [activeTermId,setActiveTermId] = useState('t1');
  const [showTermMenu,setShowTermMenu] = useState(false);
  const [menuOpen,setMenuOpen]       = useState<string|null>(null);
  const [elapsedSecs,setElapsedSecs] = useState(0);

  const [gitCloneOpen, setGitCloneOpen] = useState(false);
  const [gitCloneUrl, setGitCloneUrl]   = useState('');
  const [projectName, setProjectName]   = useState('');

  const recRef        = useRef<SR|null>(null);
  const fileRef       = useRef<HTMLInputElement>(null);
  const folderInputRef= useRef<HTMLInputElement>(null);
  const lineRef       = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController|null>(null);
  const msgEndRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);
  const termRef     = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef= useRef<number>(0);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  // During generation show live code; after completion show saved file
  const displayFile    = loading && curFile ? curFile : activeFile;
  const displayContent = loading && liveCode ? liveCode : (activeFile ? (files.get(activeFile)??'') : '');
  const lineCount      = displayContent ? displayContent.split('\n').length : 0;
  const activeLang     = displayFile ? getLang(displayFile) : '';
  const tree           = buildTree(Array.from(files.keys()));

  const previewSrc = useMemo(()=>{
    if(!files.size)return null;

    // ── 1. Plain HTML/SVG — inline CSS & JS assets ──────────────────────────
    const htmlKey=[...files.keys()].find(k=>k.endsWith('.html')||k.endsWith('.htm'));
    const svgKey=[...files.keys()].find(k=>k.endsWith('.svg'));
    if(htmlKey||svgKey){
      let html=files.get(htmlKey||svgKey||'')??'';
      // Inline CSS files referenced by <link>
      for(const[path,content] of files){
        if(!path.endsWith('.css'))continue;
        const fname=path.split('/').pop()!;
        html=html.replace(new RegExp(`<link[^>]+href=["'][^"']*${fname.replace(/\./g,'\\.')}["'][^>]*/?>`,'gi'),`<style>${content}</style>`);
      }
      // Inline JS files referenced by <script src>
      for(const[path,content] of files){
        if(!path.endsWith('.js')||path.includes('.min.'))continue;
        const fname=path.split('/').pop()!;
        html=html.replace(new RegExp(`<script[^>]+src=["'][^"']*${fname.replace(/\./g,'\\.')}["'][^>]*></script>`,'gi'),`<script>${content}</script>`);
      }
      return html;
    }

    // ── 2. React / JSX / TSX — Babel-in-browser render ────────────────────
    const hasReact=[...files.keys()].some(k=>k.endsWith('.tsx')||k.endsWith('.jsx'));
    if(hasReact){
      const allCss=[...files.entries()].filter(([k])=>k.endsWith('.css')&&!k.includes('node_modules')).map(([,v])=>v).join('\n');
      // Sort: components first, App/index/main last
      const srcFiles=[...files.entries()]
        .filter(([k])=>(k.endsWith('.tsx')||k.endsWith('.jsx')||k.endsWith('.ts')||k.endsWith('.js'))
          &&!k.includes('node_modules')&&!k.includes('vite.config')&&!k.includes('next.config')
          &&!k.includes('.test.')&&!k.includes('.spec.')&&!k.includes('tailwind')&&!k.includes('postcss'))
        .sort(([a],[b])=>{
          const isMain=(p:string)=>/(App|main|index)\.(tsx|jsx|ts|js)$/.test(p);
          return isMain(a)?1:isMain(b)?-1:0;
        });
      const combined=srcFiles.map(([path,code])=>{
        let c=code;
        // Strip all imports
        c=c.replace(/^import\s+.*?from\s+['"][^'"]*['"]\s*;?\s*/gm,'');
        c=c.replace(/^import\s+['"][^'"]*['"]\s*;?\s*/gm,'');
        // Strip export keywords (keep declarations)
        c=c.replace(/export\s+default\s+function\s+/g,'function ');
        c=c.replace(/export\s+default\s+class\s+/g,'class ');
        c=c.replace(/export\s+default\s+/g,'var _def_=');
        c=c.replace(/export\s+(async\s+)?(function|class|const|let|var)\s+/g,'$1$2 ');
        c=c.replace(/export\s+\{[^}]*\}\s*;?/g,'');
        // Remove TypeScript-specific syntax that Babel might choke on in loose mode
        c=c.replace(/^(import|export)\s+type\s+.*?;?\s*$/gm,'');
        return `/* === ${path} === */\n${c}`;
      }).join('\n\n');
      return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}${allCss}</style>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="react,typescript" data-plugins="transform-modules-umd">
const {useState,useEffect,useRef,useCallback,useMemo,useContext,createContext,Fragment}=React;
${combined}
try{
  const Root=typeof App!=='undefined'?App:typeof _def_!=='undefined'?_def_:null;
  if(Root)ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Root));
  else document.getElementById('root').innerHTML='<div style="padding:24px;font-family:sans-serif;color:#888">No App component found.<br/>Make sure your main component is named <code>App</code>.</div>';
}catch(e){document.getElementById('root').innerHTML='<div style="padding:24px;font-family:sans-serif"><h3 style="color:#e44;margin:0 0 8px">Preview Error</h3><pre style="font-size:12px;color:#666;white-space:pre-wrap">'+String(e)+'</pre></div>';}
</script></body></html>`;
    }

    // ── 3. CSS-only / other — wrap in a simple HTML shell ──────────────────
    const cssKey=[...files.keys()].find(k=>k.endsWith('.css'));
    if(cssKey){
      const content=files.get(cssKey)??'';
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;font-family:sans-serif}${content}</style></head><body><div style="padding:20px;color:#666;font-size:14px">CSS Preview — add HTML to see full render</div></body></html>`;
    }
    return null;
  },[files]);

  const searchResults = useMemo(()=>{
    if(!searchQ.trim()||!files.size)return [];
    const q=searchQ.toLowerCase();
    const results:Array<{file:string;lines:Array<{n:number;text:string}>}>=[];
    for(const [path,content] of files){
      const matches:Array<{n:number;text:string}>=[];
      content.split('\n').forEach((line,i)=>{if(line.toLowerCase().includes(q))matches.push({n:i+1,text:line.trim().slice(0,80)});});
      if(matches.length)results.push({file:path,lines:matches.slice(0,5)});
    }
    return results;
  },[searchQ,files]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    const w=window as any,SR=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!SR){setVoiceOk(false);return;}
    let active=false;
    function makeRec(){
      const r:SR=new SR();r.continuous=true;r.interimResults=true;r.lang='en-US';
      r.onresult=(e:any)=>{
        let fin='',int='';
        for(let i=e.resultIndex;i<e.results.length;i++){const r2=e.results[i],t=r2?.[0]?.transcript||'';if(r2.isFinal)fin+=t;else int+=t;}
        const txt=(fin||int).trim();if(txt)setDesc(p=>(p.trimEnd()?p.trimEnd()+' ':'')+txt);
      };
      r.onerror=(e:any)=>{if(e.error==='not-allowed'||e.error==='audio-capture'){active=false;setListening(false);}};
      r.onend=()=>{
        // Auto-restart if still meant to be listening
        if(active){try{const nr=makeRec();recRef.current=nr;nr.start();}catch{active=false;setListening(false);}}
        else setListening(false);
      };
      return r;
    }
    recRef.current=makeRec();
    // Expose active flag via ref so toggleVoice can control it
    (recRef as any)._setActive=(v:boolean)=>{active=v;};
    return()=>{active=false;try{recRef.current?.stop();}catch{}};
  },[]);

  // Auto-scroll messages
  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages,agentTyping]);

  // Auto-scroll terminal
  useEffect(()=>{if(termRef.current)termRef.current.scrollTop=termRef.current.scrollHeight;},[termLines]);

  // Auto-scroll editor to bottom during live streaming
  useEffect(()=>{
    if(loading&&editorScrollRef.current){
      editorScrollRef.current.scrollTop=editorScrollRef.current.scrollHeight;
    }
  },[liveCode,loading]);

  // Close menus on outside click
  useEffect(()=>{
    if(!menuOpen&&!showTermMenu)return;
    const h=(e:MouseEvent)=>{
      if(menuRef.current&&!menuRef.current.contains(e.target as Node))setMenuOpen(null);
      setShowTermMenu(false);
    };
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[menuOpen,showTermMenu]);

  // Timer during generation
  useEffect(()=>{
    if(loading){
      startTimeRef.current=Date.now();
      setElapsedSecs(0);
      timerRef.current=setInterval(()=>setElapsedSecs(Math.floor((Date.now()-startTimeRef.current)/1000)),1000);
    } else {
      if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null;}
    }
    return()=>{if(timerRef.current)clearInterval(timerRef.current);}
  },[loading]);

  // Keyboard shortcuts
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(!loading&&(desc.trim()||attachments.length>0))generate();}
      if((e.ctrlKey||e.metaKey)&&e.key==='b'){e.preventDefault();setExplorerOpen(p=>!p);toggleNav();}
      if((e.ctrlKey||e.metaKey)&&e.key==='`'){e.preventDefault();setTerminalOpen(p=>!p);}
      if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();newProject();}
      if(e.key==='Escape'){setMenuOpen(null);}
      if((e.ctrlKey||e.metaKey)&&e.key==='Tab'){
        e.preventDefault();
        if(openTabs.length>1){const i=openTabs.indexOf(activeFile);setActiveFile(openTabs[(i+1)%openTabs.length]!);}
      }
    };
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loading,desc,attachments,openTabs,activeFile]);

  // Editor scroll sync with line numbers
  const onEditorScroll=(e:React.UIEvent<HTMLDivElement>)=>{if(lineRef.current)lineRef.current.scrollTop=e.currentTarget.scrollTop;};

  // ── Actions ───────────────────────────────────────────────────────────────
  const addTermLine=(line:string)=>setTermLines(p=>[...p,`[${nowStr()}] ${line}`]);
  const toggleVoice=()=>{
    const r=recRef.current;if(!r)return;
    const setActive=(recRef as any)._setActive;
    if(listening){
      if(setActive)setActive(false);
      try{r.stop();}catch{}
      setListening(false);
    }else{
      try{
        if(setActive)setActive(true);
        r.start();
        setListening(true);
      }catch(err){
        // Already started or other error — try fresh start
        try{
          const w=window as any,SR=w.SpeechRecognition||w.webkitSpeechRecognition;
          if(SR){const nr=new SR();nr.continuous=true;nr.interimResults=true;nr.lang='en-US';nr.onresult=(e:any)=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)t+=e.results[i][0].transcript||'';if(t.trim())setDesc(p=>(p.trimEnd()?p.trimEnd()+' ':'')+t.trim());};nr.onerror=()=>setListening(false);nr.onend=()=>setListening(false);recRef.current=nr;nr.start();setListening(true);}
        }catch{setListening(false);}
      }
    }
  };
  const stop=()=>{abortRef.current?.abort();setLoading(false);setAgentTyping(false);setLiveCode('');addTermLine('⏹ Generation stopped by user.');};
  const doCopy=()=>{navigator.clipboard.writeText(rawOutput);setCopied(true);setTimeout(()=>setCopied(false),1500);};
  const doZip=()=>{if(!files.size)return;const b=buildZip(files),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='project.zip';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);};
  const doDownloadFile=(path:string,content:string)=>{const b=new Blob([content],{type:'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=path.split('/').pop()||'file.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);};
  const openFile=(p:string)=>{setActiveFile(p);setOpenTabs(prev=>prev.includes(p)?prev:[...prev,p]);setEditorTab('editor');};
  const closeTab=(p:string)=>{setOpenTabs(prev=>{const n=prev.filter(x=>x!==p);if(activeFile===p)setActiveFile(n[0]||'');return n;});};
  const toggleDir=(p:string)=>{setCollapsed(prev=>{const n=new Set(prev);n.has(p)?n.delete(p):n.add(p);return n;});};
  const newProject=()=>{if(loading)stop();setRawOutput('');setFiles(new Map());setActiveFile('');setOpenTabs([]);setSteps([]);setCurFile('');setError('');setDesc('');setAppType('');setMessages([]);setStreamPreview('');setLiveCode('');setTermLines([]);setMenuOpen(null);setProjectName('');};

  // ── Open Folder ───────────────────────────────────────────────────────────
  const handleFolderOpen=useCallback(async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const inputFiles=Array.from(e.target.files||[]);
    if(!inputFiles.length)return;
    const newMap=new Map<string,string>();
    await Promise.all(inputFiles.map(async(f)=>{
      const path=(f as any).webkitRelativePath||f.name;
      try{
        if(f.size<=750_000&&(f.type.startsWith('text/')||/\.(ts|tsx|js|jsx|json|css|html|md|yml|yaml|sh|env|gitignore|prettierrc|eslintrc|xml|svg|txt|py|rb|go|rs|java|c|cpp|h|cs|php)$/i.test(f.name))){
          newMap.set(path,await f.text());
        }else{
          newMap.set(path,`// Binary file: ${f.name}`);
        }
      }catch{}
    }));
    setFiles(newMap);
    const first=newMap.keys().next().value as string|undefined;
    if(first){setActiveFile(first);setOpenTabs([...newMap.keys()].slice(0,8));}
    setTerminalOpen(true);
    setTermLines([`> Opened folder — ${newMap.size} files loaded.`]);
    e.target.value='';
  },[]);

  const handleGitClone=useCallback(async()=>{
    const url=gitCloneUrl.trim();
    if(!url)return;
    setGitCloneOpen(false);setGitCloneUrl('');
    setTerminalOpen(true);
    // Try to fetch from GitHub API if it's a github.com URL
    const ghMatch=url.match(/github\.com\/([^/]+)\/([^/.\s]+?)(?:\.git)?$/);
    if(ghMatch){
      const [,owner,repo]=ghMatch;
      setTermLines([`> Fetching ${owner}/${repo} from GitHub...`]);
      try{
        const treeRes=await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
        if(!treeRes.ok)throw new Error(`GitHub API ${treeRes.status}`);
        const tree=await treeRes.json() as {tree:{path:string;type:string;size?:number;url:string}[]};
        const blobs=tree.tree.filter(n=>n.type==='blob'&&(n.size||0)<=300_000).slice(0,80);
        const newMap=new Map<string,string>();
        await Promise.all(blobs.map(async(n)=>{
          try{
            const raw=await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${n.path}`);
            if(raw.ok)newMap.set(n.path,await raw.text());
          }catch{}
        }));
        setFiles(newMap);
        const first=newMap.keys().next().value as string|undefined;
        if(first){setActiveFile(first);setOpenTabs([...newMap.keys()].slice(0,8));}
        setTermLines(p=>[...p,`> ✓ Cloned ${newMap.size} files from ${owner}/${repo}`]);
      }catch(err){
        setTermLines(p=>[...p,`> Error: ${(err as Error).message}`]);
      }
    }else{
      setTermLines([`> git clone ${url}`,`> Note: Run this command in your local terminal to clone the repository.`]);
    }
  },[gitCloneUrl]);

  // ── Generate ──────────────────────────────────────────────────────────────
  const generate=useCallback(async()=>{
    const prompt=desc.trim();
    if((!prompt&&attachments.length===0)||loading)return;

    const userMsg:Message={role:'user',text:prompt+(attachments.length?` (+${attachments.length} file${attachments.length>1?'s':''})`:``),ts:Date.now()};
    setMessages(p=>[...p,userMsg]);
    setDesc('');
    setError('');setRawOutput('');setFiles(new Map());setActiveFile('');setOpenTabs([]);setSteps([]);setCurFile('');setLiveCode('');
    setLoading(true);setAgentTyping(true);setStreamPreview('');
    setTermLines([]);
    abortRef.current=new AbortController();

    try{
      const blocks:string[]=[];
      for(const a of attachments){const f=a.file,meta=`name=${f.name}, type=${f.type||'?'}, size=${fmtBytes(f.size)}`;if(isText(f)&&f.size<=750_000){const txt=await f.text().catch(()=>'');blocks.push(`\n\n[ATTACHMENT ${meta}]\n${txt}\n[/ATTACHMENT]`);}else blocks.push(`\n\n[ATTACHMENT ${meta}]\n(Binary)\n[/ATTACHMENT]`);}
      const full=`${prompt}${blocks.join('')}`.trim();setAttachments([]);

      // (terminal stays clean — progress shown in agent panel)

      // Auto-detect app type from prompt keywords if not manually set
      const pl=full.toLowerCase();
      let resolvedAppType=appType;
      if(!resolvedAppType){
        if(pl.includes('next.js')||pl.includes('nextjs'))resolvedAppType='nextjs';
        else if(pl.includes('fastapi')||pl.includes('fast api'))resolvedAppType='fastapi';
        else if(pl.includes('react'))resolvedAppType='react-vite';
        else if(pl.includes('express')||pl.includes('node api'))resolvedAppType='express-api';
        else if(pl.includes('full stack')||pl.includes('fullstack'))resolvedAppType='fullstack';
        else if(pl.includes('landing page'))resolvedAppType='landing-page';
        else if(pl.includes('presentation')||pl.includes('slides'))resolvedAppType='presentation';
        else if(pl.includes('email template'))resolvedAppType='email-template';
        else if(pl.includes('infographic'))resolvedAppType='infographic';
        else if(pl.includes('svg'))resolvedAppType='svg-image';
        else if(pl.includes('cli')||pl.includes('command line'))resolvedAppType='cli';
        else if(pl.includes('html')||pl.includes('css'))resolvedAppType='html-css-js';
      }
      const res=await backendFetch('/api/vibecode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:full,appType:resolvedAppType||undefined,stream:true}),signal:abortRef.current.signal});
      if(!res.ok){const d=(await res.json().catch(()=>({}))) as {error?:string;message?:string};throw new Error(d.message||d.error||`Error ${res.status}`);}

      // streaming started

      const reader=res.body!.getReader(),decoder=new TextDecoder();
      let buf='',acc='',lastLiveUpdate=0;
      while(true){
        const{done,value}=await reader.read();if(done)break;
        buf+=decoder.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()??'';
        for(const line of lines){
          if(!line.startsWith('data: '))continue;const raw=line.slice(6).trim();if(raw==='[DONE]')break;
          try{
            const p=JSON.parse(raw) as {event?:string;token?:string;output?:string};
            if(p.event==='token'&&p.token){
              acc+=p.token;setRawOutput(acc);setStreamPreview(acc.slice(-300));
              // Update live code display (throttle to every ~100ms worth of tokens)
              const now=Date.now();
              if(now-lastLiveUpdate>80){
                lastLiveUpdate=now;
                const lc=extractLiveContent(acc);
                if(lc!==undefined)setLiveCode(lc);
              }
              const cf=currFile(acc);
              if(cf&&cf!==curFile){
                setCurFile(cf);
                // Open live tab for this file
                setOpenTabs(prev=>prev.includes(cf)?prev:[...prev,cf]);
                setActiveFile(cf);
                setSteps(prev=>{if(prev.find(s=>s.file===cf))return prev;return[...prev.map(s=>({...s,done:true})),{file:cf,done:false}];});
              }
            }
            if(p.event==='done'&&typeof p.output==='string'){
              setRawOutput(p.output);
              const nf=parseFiles(p.output);
              setFiles(nf);
              setSteps(prev=>prev.map(s=>({...s,done:true})));
              setLiveCode('');
              const first=nf.keys().next().value as string|undefined;
              if(first){setActiveFile(first);setOpenTabs([...nf.keys()].slice(0,8));}
              // Derive project name from first path segment or description
              const firstPath=[...nf.keys()][0]||'';
              const rootFolder=firstPath.includes('/')?firstPath.split('/')[0]:'';
              setProjectName(rootFolder||prompt.split(' ').slice(0,4).join(' ')||'My Project');
              setCurFile('');
              const agentMsg:Message={role:'agent',text:`Done! Generated ${nf.size} file${nf.size!==1?'s':''}.`,files:nf.size,ts:Date.now()};
              setMessages(prev=>[...prev,agentMsg]);
              setAgentTyping(false);
              // Auto-switch to preview if previewable content was generated
              const hasHtml=[...nf.keys()].some(k=>k.endsWith('.html')||k.endsWith('.svg'));
              const hasReact=[...nf.keys()].some(k=>k.endsWith('.tsx')||k.endsWith('.jsx'));
              if(hasHtml||hasReact)setTimeout(()=>setEditorTab('preview'),400);
            }
          }catch{}
        }
      }
    }catch(err:unknown){
      if((err as Error).name==='AbortError'){setAgentTyping(false);return;}
      let msg=err instanceof Error?err.message:'Generation failed';
      if(/fetch|network/i.test(msg))msg='Network error — check backend is running.';
      setError(msg);
      setMessages(prev=>[...prev,{role:'agent',text:`Error: ${msg}`,ts:Date.now()}]);
      setAgentTyping(false);
      setLiveCode('');
      addTermLine(`> ✗ Error: ${msg}`);
    }finally{setLoading(false);setCurFile('');setStreamPreview('');}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[desc,loading,attachments,appType,curFile,elapsedSecs]);

  // ── Terminal helpers ─────────────────────────────────────────────────────
  const TERM_ICONS:Record<TermType,string> = {bash:'$',powershell:'PS',cmd:'>',node:'⬡',python:'🐍'};
  function addTermTab(type:TermType){
    const id=`t${Date.now()}`;
    setTermTabs(p=>[...p.map(t=>t.id===activeTermId?{...t,lines:termLines}:t),{id,type,label:type,lines:[]}]);
    setActiveTermId(id);
    setTermLines([]);
    setShowTermMenu(false);
  }
  function switchTerm(id:string){
    setTermTabs(p=>p.map(t=>t.id===activeTermId?{...t,lines:termLines}:t));
    const tab=termTabs.find(t=>t.id===id);
    if(tab){setTermLines(tab.lines);setActiveTermId(id);}
  }
  function removeTerm(id:string){
    if(termTabs.length<=1)return;
    const newTabs=termTabs.filter(t=>t.id!==id);
    setTermTabs(newTabs);
    if(activeTermId===id){const next=newTabs[newTabs.length-1]!;setActiveTermId(next.id);setTermLines(next.lines);}
  }

  // ── File tree ─────────────────────────────────────────────────────────────
  const renderTree=(node:FileNode,depth=0):JSX.Element=>(
    <div key={node.path||'root'}>
      {(node.children||[]).map(c=>{
        const pl=`${8+depth*12}px`;
        if(c.type==='dir'){const open2=!collapsed.has(c.path);return(<div key={c.path}>
          <div role="button" onClick={()=>toggleDir(c.path)} style={{paddingLeft:pl,display:'flex',alignItems:'center',gap:'4px',height:'22px',fontSize:'12px',color:C.text,cursor:'pointer',userSelect:'none'}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
            {open2?<ChevronDown size={12} style={{opacity:.5,flexShrink:0}}/>:<ChevronRight size={12} style={{opacity:.5,flexShrink:0}}/>}
            <span style={{fontSize:'11px'}}>📁</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
          </div>
          {open2&&renderTree(c,depth+1)}
        </div>);}
        const act=c.path===activeFile;
        return(<div key={c.path} role="button" onClick={()=>openFile(c.path)} style={{paddingLeft:`calc(${pl} + 16px)`,display:'flex',alignItems:'center',gap:'5px',height:'22px',fontSize:'12px',color:act?'#fff':C.text,background:act?C.active:'transparent',cursor:'pointer',userSelect:'none',overflow:'hidden'}} onMouseEnter={e=>{if(!act)(e.currentTarget as HTMLElement).style.background=C.hover;}} onMouseLeave={e=>{if(!act)(e.currentTarget as HTMLElement).style.background='transparent';}} title={c.path}>
          <span style={{fontSize:'10px',flexShrink:0}}>{fileIcon(c.name)}</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
        </div>);
      })}
    </div>
  );

  // ── Menu definitions ──────────────────────────────────────────────────────
  type MenuItem = { label:string; shortcut?:string; action:()=>void; disabled?:boolean; separator?:never } | { separator:true; label?:never; shortcut?:never; action?:never; disabled?:never };
  const menus: Record<string, MenuItem[]> = {
    File: [
      { label:'New Text File',         shortcut:'Ctrl+N',        action:()=>{newProject();setMenuOpen(null);} },
      { label:'New Project…',          shortcut:'Ctrl+Alt+N',    action:()=>{newProject();setMenuOpen(null);} },
      { label:'New Window',            shortcut:'Ctrl+Shift+N',  action:()=>{window.open(window.location.href,'_blank');setMenuOpen(null);} },
      { separator:true },
      { label:'Open File…',            shortcut:'Ctrl+O',        action:()=>{folderInputRef.current?.click();setMenuOpen(null);} },
      { label:'Open Folder…',          shortcut:'Ctrl+K Ctrl+O', action:()=>{folderInputRef.current?.click();setMenuOpen(null);} },
      { label:'Open Recent',                                      action:()=>setMenuOpen(null), disabled:true },
      { separator:true },
      { label:'Save',                  shortcut:'Ctrl+S',        action:()=>{if(activeFile&&files.get(activeFile))doDownloadFile(activeFile,files.get(activeFile)!);setMenuOpen(null);}, disabled:!activeFile||!files.size },
      { label:'Save As…',              shortcut:'Ctrl+Shift+S',  action:()=>{doZip();setMenuOpen(null);}, disabled:!files.size },
      { label:'Save All',              shortcut:'Ctrl+K S',      action:()=>{doZip();setMenuOpen(null);}, disabled:!files.size },
      { separator:true },
      { label:'Auto Save',                                        action:()=>setMenuOpen(null) },
      { label:'Preferences',                                      action:()=>setMenuOpen(null) },
      { separator:true },
      { label:'Clone from Git…',                                  action:()=>{setGitCloneOpen(true);setMenuOpen(null);} },
      { label:'Open in VS Code',                                  action:()=>{setTerminalOpen(true);setTermLines(['> To open in VS Code:','> 1. Download All as ZIP (Save As…)','> 2. Extract the ZIP to a local folder','> 3. Run: code <folder-path>']);setMenuOpen(null);} },
      { separator:true },
      { label:'Revert File',                                      action:()=>setMenuOpen(null), disabled:!activeFile },
      { label:'Close Editor',          shortcut:'Ctrl+F4',       action:()=>{if(activeFile)closeTab(activeFile);setMenuOpen(null);}, disabled:!activeFile },
      { label:'Close Folder',                                     action:()=>{newProject();setMenuOpen(null);}, disabled:!files.size },
      { label:'Close Window',          shortcut:'Alt+F4',        action:()=>{window.close();setMenuOpen(null);} },
      { separator:true },
      { label:'Exit',                                             action:()=>{window.close();setMenuOpen(null);} },
    ],
    Edit: [
      { label:'Copy Output',           shortcut:'Ctrl+Shift+C',  action:()=>{doCopy();setMenuOpen(null);}, disabled:!rawOutput },
      { label:'Clear Session',         action:()=>{newProject();setMenuOpen(null);} },
      { separator:true },
      { label:'Stop Generation',       shortcut:'Esc',           action:()=>{stop();setMenuOpen(null);}, disabled:!loading },
    ],
    Selection: [
      { label:'Select All',            shortcut:'Ctrl+A',        action:()=>{const el=document.activeElement as HTMLTextAreaElement;if(el?.select)el.select();setMenuOpen(null);} },
      { label:'Copy Line Up',          action:()=>setMenuOpen(null) },
      { label:'Copy Line Down',        action:()=>setMenuOpen(null) },
    ],
    View: [
      { label:'Explorer',              shortcut:'Ctrl+B',        action:()=>{setExplorerOpen(p=>!p);toggleNav();setMenuOpen(null);} },
      { label:'Search',                action:()=>{setActivity('search');setExplorerOpen(true);setMenuOpen(null);} },
      { label:'Source Control',        action:()=>{setActivity('git');setExplorerOpen(true);setMenuOpen(null);} },
      { separator:true },
      { label:'Terminal',              shortcut:'Ctrl+`',        action:()=>{setTerminalOpen(p=>!p);setMenuOpen(null);} },
      { label:'Preview',               action:()=>{setEditorTab('preview');setMenuOpen(null);}, disabled:!previewSrc },
      { separator:true },
      { label:'Zoom In',               shortcut:'Ctrl++',        action:()=>setMenuOpen(null) },
      { label:'Zoom Out',              shortcut:'Ctrl+-',        action:()=>setMenuOpen(null) },
    ],
    Go: [
      { label:'Next Tab',              shortcut:'Ctrl+Tab',      action:()=>{if(openTabs.length>1){const i=openTabs.indexOf(activeFile);openFile(openTabs[(i+1)%openTabs.length]!);}setMenuOpen(null);}, disabled:openTabs.length<2 },
      { label:'Previous Tab',          shortcut:'Ctrl+Shift+Tab',action:()=>{if(openTabs.length>1){const i=openTabs.indexOf(activeFile);openFile(openTabs[(i-1+openTabs.length)%openTabs.length]!);}setMenuOpen(null);}, disabled:openTabs.length<2 },
      { separator:true },
      { label:'First Tab',             action:()=>{if(openTabs[0])openFile(openTabs[0]);setMenuOpen(null);}, disabled:openTabs.length<2 },
      { label:'Last Tab',              action:()=>{const l=openTabs[openTabs.length-1];if(l)openFile(l);setMenuOpen(null);}, disabled:openTabs.length<2 },
    ],
    Run: [
      { label:'Run in Preview',        shortcut:'F5',            action:()=>{setEditorTab('preview');setMenuOpen(null);}, disabled:!previewSrc },
      { label:'Stop',                  shortcut:'Shift+F5',      action:()=>{stop();setMenuOpen(null);}, disabled:!loading },
    ],
    Terminal: [
      { label:'New Terminal',          shortcut:'Ctrl+Shift+`',  action:()=>{setTerminalOpen(true);addTermTab('bash');setMenuOpen(null);} },
      { label:'New PowerShell',                                   action:()=>{setTerminalOpen(true);addTermTab('powershell');setMenuOpen(null);} },
      { label:'New Command Prompt',                               action:()=>{setTerminalOpen(true);addTermTab('cmd');setMenuOpen(null);} },
      { label:'New Node.js REPL',                                 action:()=>{setTerminalOpen(true);addTermTab('node');setMenuOpen(null);} },
      { label:'New Python REPL',                                  action:()=>{setTerminalOpen(true);addTermTab('python');setMenuOpen(null);} },
      { separator:true },
      { label:'Toggle Terminal',       shortcut:'Ctrl+`',        action:()=>{setTerminalOpen(p=>!p);setMenuOpen(null);} },
      { separator:true },
      { label:'Clear Terminal',        action:()=>{setTermLines([]);setMenuOpen(null);} },
    ],
    Help: [
      { label:'Keyboard Shortcuts',    action:()=>{setTerminalOpen(true);setTermLines(['Keyboard Shortcuts:','  Ctrl+Enter — Generate / send prompt','  Ctrl+B     — Toggle file explorer','  Ctrl+`     — Toggle terminal','  Ctrl+N     — New project / file','  Ctrl+Tab   — Next tab','  Ctrl+Shift+` — New terminal','  Esc        — Stop / close menu']);setMenuOpen(null);} },
      { separator:true },
      { label:'Integrations Guide',    action:()=>{setTerminalOpen(true);setTermLines(['Supported Integrations:','  🔐 Firebase Auth — Google, Email/Password, GitHub OAuth','  💳 Stripe — Checkout, Subscriptions, Webhooks','  🗃️  Supabase — Auth + Postgres DB','  🔑 Clerk — Drop-in Auth UI','  💰 PayPal — Payments SDK','  🔒 Auth0 — Enterprise SSO','','Tip: Use the integration buttons in the agent panel to auto-add these!']);setMenuOpen(null);} },
      { label:'API Reference',         action:()=>{window.open('https://frontend-chi-drab-65.vercel.app/docs','_blank');setMenuOpen(null);} },
      { separator:true },
      { label:'About EIOR Code',       action:()=>{setTerminalOpen(true);setTermLines(['EIOR Code v2.0','Powered by EIOR Agent','Full-stack app generation with a single prompt.','','Features:','  ✓ Multi-terminal (bash, PowerShell, CMD, Node, Python)','  ✓ Live file preview during generation','  ✓ Built-in integrations (Auth, Payments, DB)','  ✓ Git clone & ZIP export','  ✓ Voice input']);setMenuOpen(null);} },
    ],
  };

  const actItems:[Activity,typeof Files,string][]=[
    ['explorer',Files,'Explorer (Ctrl+B)'],
    ['search',Search,'Search'],
    ['git',GitBranch,'Source Control'],
    ['run',Play,'Run and Debug'],
    ['extensions',Boxes,'Extensions'],
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:C.editorBg,color:C.text,fontFamily:FONT_UI,fontSize:'13px',overflow:'hidden'}}>

      {/* ── Title / Menu bar ── */}
      <div ref={menuRef} style={{height:'30px',background:C.titleBar,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'stretch',flexShrink:0,userSelect:'none',position:'relative',zIndex:100}}>

        {/* Nav toggle */}
        <button onClick={toggleNav} title={navOpen?'Hide EIOR sidebar':'Show EIOR sidebar'}
          style={{padding:'0 7px',background:'transparent',border:'none',cursor:'pointer',color:C.dim,display:'flex',alignItems:'center',borderRadius:'3px',flexShrink:0}}
          onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
        >{navOpen?<PanelLeftClose size={14}/>:<PanelLeftOpen size={14}/>}</button>

        {/* EIOR Logo */}
        <div style={{display:'flex',alignItems:'center',gap:'2px',padding:'0 8px',cursor:'default',flexShrink:0,userSelect:'none'}}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0}}>
            <circle cx="7" cy="7" r="7" fill="#10a37f" opacity="0.15"/>
            <polygon points="6,2 6,6.5 4,6.5 8,12 8,7.5 10,7.5" fill="#10a37f"/>
          </svg>
          <span style={{fontSize:'12px',fontWeight:700,color:'#e0e0e0',letterSpacing:'0.04em'}}>EIOR</span>
          <span style={{fontSize:'9px',fontWeight:400,color:C.dimmer,letterSpacing:'0.02em',marginLeft:'1px'}}>Code</span>
        </div>

        {/* Menu items */}
        {Object.entries(menus).map(([name,items])=>{
          const open=menuOpen===name;
          return(
            <div key={name} style={{position:'relative'}}>
              <button
                onClick={()=>setMenuOpen(open?null:name)}
                onMouseEnter={()=>{if(menuOpen&&menuOpen!==name)setMenuOpen(name);}}
                style={{padding:'0 8px',height:'30px',fontSize:'12px',color:open?'#fff':C.text,background:open?C.menuHover:'transparent',border:'none',cursor:'default',fontFamily:FONT_UI,whiteSpace:'nowrap'}}
              >{name}</button>
              {open&&(
                <div style={{position:'absolute',top:'100%',left:0,minWidth:'230px',background:C.menuDropBg,border:`1px solid ${C.menuBorder}`,borderRadius:'4px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)',padding:'4px 0',zIndex:200}}>
                  {items.map((item,i)=>{
                    if('separator' in item && item.separator) return <div key={i} style={{height:'1px',background:C.borderLight,margin:'3px 0'}}/>;
                    const it = item as {label:string;shortcut?:string;action:()=>void;disabled?:boolean};
                    return(
                      <button key={i} onClick={it.disabled?undefined:it.action} disabled={it.disabled}
                        style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 16px',fontSize:'12px',background:'transparent',border:'none',cursor:it.disabled?'default':'pointer',color:it.disabled?C.dimmer:C.text,fontFamily:FONT_UI,textAlign:'left',gap:'20px'}}
                        onMouseEnter={e=>{if(!it.disabled)(e.currentTarget as HTMLElement).style.background=C.menuHover;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';}}
                      >
                        <span>{it.label}</span>
                        {it.shortcut&&<span style={{color:C.dimmer,fontSize:'11px',whiteSpace:'nowrap'}}>{it.shortcut}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Center title */}
        <div style={{flex:1,textAlign:'center',fontSize:'12px',color:C.dim,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
          {loading?<span style={{color:C.yellow,display:'flex',alignItems:'center',gap:'5px'}}><span className="spin-icon">⟳</span>Generating… {elapsedSecs}s</span>:(activeFile||'EIOR Code')}
        </div>

        {/* Right actions */}
        <div style={{display:'flex',gap:'2px',alignItems:'center',padding:'0 6px'}}>
          {files.size>0&&<button onClick={doZip} title="Download ZIP" style={{padding:'0 8px',height:'26px',fontSize:'11px',color:C.dim,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'3px',borderRadius:'3px',fontFamily:FONT_UI}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}><Download size={12}/>ZIP</button>}
          <button onClick={newProject} title="New project (Ctrl+N)" style={{padding:'0 8px',height:'26px',fontSize:'11px',color:C.dim,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'3px',borderRadius:'3px',fontFamily:FONT_UI}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}><Plus size={12}/>New</button>
          {/* Window-style buttons */}
          <div style={{display:'flex',gap:'4px',marginLeft:'8px'}}>
            <div style={{width:'12px',height:'12px',borderRadius:'50%',background:'#f59e0b',cursor:'pointer'}} title="Minimize" onClick={()=>setTerminalOpen(p=>!p)}/>
            <div style={{width:'12px',height:'12px',borderRadius:'50%',background:'#ef4444',cursor:'pointer'}} title="Close" onClick={newProject}/>
            <div style={{width:'12px',height:'12px',borderRadius:'50%',background:'#10b981',cursor:'pointer'}} title="Maximize" onClick={()=>setEditorTab(p=>p==='editor'?'preview':'editor')}/>
          </div>
        </div>
      </div>

      {/* ── Three-panel workspace ── */}
      <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden',flexDirection:'column'}}>
        <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>

          {/* ── LEFT: Activity bar + Explorer ── */}
          <div style={{display:'flex',flexShrink:0}}>
            {/* Activity bar */}
            <div style={{width:'44px',background:C.activityBar,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'4px',flexShrink:0}}>
              {actItems.map(([id,Icon,label])=>{
                const isAct=activity===id&&explorerOpen;
                return(
                  <button key={id} onClick={()=>{if(activity===id){setExplorerOpen(p=>!p);}else{setActivity(id);setExplorerOpen(true);if(id==='search')setTimeout(()=>searchRef.current?.focus(),100);}}} title={label}
                    style={{width:'44px',height:'44px',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer',borderLeft:`2px solid ${isAct?'#fff':'transparent'}`,color:isAct?'#fff':C.dim,transition:'color .1s'}}
                    onMouseEnter={e=>{if(!isAct)(e.currentTarget as HTMLElement).style.color=C.text;}}
                    onMouseLeave={e=>{if(!isAct)(e.currentTarget as HTMLElement).style.color=C.dim;}}
                  ><Icon size={22}/></button>
                );
              })}
              <div style={{flex:1}}/>
              <button title="Settings" style={{width:'44px',height:'44px',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'none',cursor:'pointer',color:C.dim,marginBottom:'4px'}}
                onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.dim)}
              ><Settings2 size={20}/></button>
            </div>

            {/* Explorer panel */}
            {explorerOpen&&(
              <div style={{width:'220px',background:C.sidebar,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',minHeight:0}}>
                {/* Panel label */}
                <div style={{height:'28px',padding:'0 10px',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'10px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#bbb',borderBottom:`1px solid ${C.borderLight}`,flexShrink:0,userSelect:'none'}}>
                  <span>{{explorer:'Explorer',search:'Search',git:'Source Control',run:'Run & Debug',extensions:'Extensions'}[activity]}</span>
                  {files.size>0&&activity==='explorer'&&<span style={{fontWeight:400,textTransform:'none',color:C.dimmer,fontSize:'10px'}}>{files.size} files</span>}
                </div>
                {/* Project name row (explorer only) */}
                {activity==='explorer'&&(
                  <div style={{padding:'4px 8px 0',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 6px',borderRadius:'3px',cursor:'default',userSelect:'none'}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <ChevronDown size={12} style={{color:C.dim,flexShrink:0}}/>
                      <FolderOpen size={13} style={{color:'#e8c47a',flexShrink:0}}/>
                      <span style={{fontSize:'11px',fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.04em'}}>
                        {projectName||'EIOR PROJECT'}
                      </span>
                    </div>
                  </div>
                )}
                <div style={{flex:1,overflowY:'auto'}}>
                  {activity==='explorer'&&(
                    <>
                      {/* Generation progress */}
                      {(loading||steps.length>0)&&(
                        <div style={{borderBottom:`1px solid ${C.borderLight}`,padding:'4px 0'}}>
                          <div style={{padding:'3px 10px',fontSize:'10px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:C.dimmer,display:'flex',alignItems:'center',gap:'5px'}}>
                            {loading&&<span className="spin-icon" style={{color:C.blue}}>⟳</span>}
                            {loading?'Generating…':'Complete'}
                          </div>
                          {steps.map((s,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:'5px',padding:'2px 10px 2px 16px',fontSize:'11px'}}>
                              <span style={{color:s.done?C.green:C.yellow,flexShrink:0,fontSize:'10px'}}>{s.done?'✓':'▶'}</span>
                              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:s.done?C.dim:C.text}}>{s.file.split('/').pop()}</span>
                            </div>
                          ))}
                          {loading&&<div style={{display:'flex',alignItems:'center',gap:'5px',padding:'2px 10px 2px 16px',fontSize:'11px',color:C.dim}}>
                            <span className="blink-dot" style={{color:C.blue,fontSize:'8px'}}>●</span>
                            {curFile?`Writing ${curFile.split('/').pop()}…`:'Thinking…'}
                          </div>}
                        </div>
                      )}
                      {files.size>0
                        ?<div style={{paddingTop:'2px'}}>{renderTree(tree)}</div>
                        :<div style={{padding:'12px 10px',fontSize:'12px',color:C.dimmer,lineHeight:1.6}}>No folder opened.<br/>Generate a project to see files here.</div>
                      }
                    </>
                  )}
                  {activity==='search'&&(
                    <div style={{display:'flex',flexDirection:'column'}}>
                      <div style={{padding:'8px'}}>
                        <input ref={searchRef} value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search files…"
                          style={{width:'100%',background:C.input,border:`1px solid ${searchQ?C.blue:'transparent'}`,borderRadius:'3px',padding:'4px 8px',fontSize:'12px',color:C.text,outline:'none',fontFamily:FONT_UI,boxSizing:'border-box'}}
                          onFocus={e=>(e.currentTarget.style.borderColor=C.blue)} onBlur={e=>{if(!searchQ)(e.currentTarget.style.borderColor='transparent');}}
                        />
                      </div>
                      {!files.size&&<div style={{padding:'6px 10px',color:C.dimmer,fontSize:'11px'}}>Generate a project first.</div>}
                      {files.size&&!searchQ&&<div style={{padding:'6px 10px',color:C.dimmer,fontSize:'11px'}}>{files.size} files. Type to search.</div>}
                      {searchResults.map(r=>(
                        <div key={r.file}>
                          <div onClick={()=>openFile(r.file)} style={{padding:'3px 10px',fontWeight:700,color:C.text,cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'11px'}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                            {r.file.split('/').pop()}
                          </div>
                          {r.lines.map((l,i)=>(
                            <div key={i} onClick={()=>openFile(r.file)} style={{padding:'1px 10px 1px 20px',color:C.dim,cursor:'pointer',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:FONT_CODE,fontSize:'10px'}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                              <span style={{color:C.dimmer,marginRight:'6px'}}>{l.n}</span>{l.text}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {activity==='git'&&(
                    <div style={{padding:'6px 0',fontSize:'11px'}}>
                      {files.size>0?(
                        <>
                          <div style={{padding:'3px 10px',color:C.dim,fontWeight:600}}>Changes ({files.size})</div>
                          {[...files.keys()].map(f=>(
                            <div key={f} onClick={()=>openFile(f)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'2px 10px',cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.background=C.hover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                              <span style={{color:C.green,fontSize:'10px',fontWeight:700,flexShrink:0}}>U</span>
                              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.green}}>{f.split('/').pop()}</span>
                            </div>
                          ))}
                        </>
                      ):<div style={{padding:'10px',color:C.dimmer}}>No changes.</div>}
                    </div>
                  )}
                  {activity==='run'&&(
                    <div style={{padding:'10px',fontSize:'12px',color:C.dimmer}}>
                      {previewSrc
                        ?<button onClick={()=>setEditorTab('preview')} style={{padding:'6px 12px',background:C.blue,border:'none',borderRadius:'4px',color:'#fff',cursor:'pointer',fontSize:'12px',fontFamily:FONT_UI,display:'flex',alignItems:'center',gap:'5px'}}><Play size={12}/> Run in Preview</button>
                        :'Generate a project with HTML output to run it.'
                      }
                    </div>
                  )}
                  {activity==='extensions'&&(
                    <div style={{padding:'10px',fontSize:'12px',color:C.dimmer}}>No extensions installed.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER: Editor + preview ── */}
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',background:C.editorBg,borderRight:`1px solid ${C.border}`}}>

            {/* Tabs bar */}
            <div style={{height:'35px',background:C.tabsBar,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'stretch',flexShrink:0,overflowX:'auto'}}>
              {(loading&&curFile?[curFile,...openTabs.filter(t=>t!==curFile)]:openTabs).length===0
                ?<div style={{padding:'0 14px',display:'flex',alignItems:'center',fontSize:'12px',color:C.dimmer,userSelect:'none'}}>No file open</div>
                :(loading&&curFile?[curFile,...openTabs.filter(t=>t!==curFile)]:openTabs).map(p=>{
                  const act=p===displayFile;
                  const isLive=loading&&p===curFile;
                  return(
                    <div key={p} onClick={()=>{if(!isLive)setActiveFile(p);}}
                      style={{display:'flex',alignItems:'center',gap:'5px',padding:'0 10px',borderRight:`1px solid ${C.border}`,fontSize:'12px',cursor:'pointer',flexShrink:0,maxWidth:'180px',background:act?C.tabActive:C.tabInactive,color:act?'#fff':'#8e8ea0',borderTop:`1px solid ${act?C.tabBorderTop:'transparent'}`,userSelect:'none'}}
                    >
                      {isLive&&<span className="blink-dot" style={{color:C.yellow,fontSize:'8px'}}>●</span>}
                      <span style={{fontSize:'10px',flexShrink:0}}>{fileIcon(p.split('/').pop()!)}</span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{p.split('/').pop()}</span>
                      {!isLive&&<button type="button" onClick={e=>{e.stopPropagation();closeTab(p);}}
                        style={{opacity:.4,background:'transparent',border:'none',cursor:'pointer',color:'inherit',display:'flex',padding:'1px',borderRadius:'2px',flexShrink:0}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='.4';}}
                      ><X size={12}/></button>}
                    </div>
                  );
                })
              }
              {/* Editor / Preview toggle */}
              {(displayFile||previewSrc)&&(
                <div style={{marginLeft:'auto',display:'flex',alignItems:'center',padding:'0 8px',gap:'2px',flexShrink:0}}>
                  <button onClick={()=>setEditorTab('editor')}
                    style={{padding:'3px 8px',fontSize:'11px',background:editorTab==='editor'?'rgba(255,255,255,0.1)':'transparent',border:`1px solid ${editorTab==='editor'?'rgba(255,255,255,0.15)':'transparent'}`,borderRadius:'4px',color:editorTab==='editor'?'#fff':C.dim,cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontFamily:FONT_UI}}
                  ><Code size={11}/>Code</button>
                  {previewSrc&&<button onClick={()=>setEditorTab('split')}
                    style={{padding:'3px 8px',fontSize:'11px',background:editorTab==='split'?'rgba(255,255,255,0.1)':'transparent',border:`1px solid ${editorTab==='split'?'rgba(255,255,255,0.15)':'transparent'}`,borderRadius:'4px',color:editorTab==='split'?'#fff':C.dim,cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontFamily:FONT_UI}}
                  ><Code size={11}/><Eye size={11}/></button>}
                  {previewSrc&&<button onClick={()=>setEditorTab('preview')}
                    style={{padding:'3px 8px',fontSize:'11px',background:editorTab==='preview'?'rgba(255,255,255,0.1)':'transparent',border:`1px solid ${editorTab==='preview'?'rgba(255,255,255,0.15)':'transparent'}`,borderRadius:'4px',color:editorTab==='preview'?'#fff':C.dim,cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontFamily:FONT_UI}}
                  ><Eye size={11}/>Preview</button>}
                </div>
              )}
            </div>

            {/* Breadcrumb */}
            {displayFile&&editorTab==='editor'&&(
              <div style={{height:'22px',background:C.editorBg,borderBottom:`1px solid ${C.borderLight}`,display:'flex',alignItems:'center',padding:'0 12px',gap:'3px',fontSize:'11px',color:C.dim,flexShrink:0,userSelect:'none'}}>
                {displayFile.split('/').map((part,i,arr)=>(
                  <span key={i} style={{display:'flex',alignItems:'center',gap:'3px'}}>
                    <span style={{color:i===arr.length-1?C.text:C.dim}}>{part}</span>
                    {i<arr.length-1&&<ChevronRight size={10} style={{opacity:.4}}/>}
                  </span>
                ))}
                <span style={{marginLeft:'auto',color:C.dimmer,fontSize:'10px',textTransform:'capitalize'}}>{activeLang==='ts'?'TypeScript':activeLang==='js'?'JavaScript':activeLang}</span>
                {loading&&curFile&&<span style={{color:C.yellow,fontSize:'10px',display:'flex',alignItems:'center',gap:'3px',marginLeft:'8px'}}><span className="blink-dot" style={{fontSize:'8px'}}>●</span>writing…</span>}
              </div>
            )}

            {/* Editor / Preview area */}
            <div style={{flex:1,minHeight:0,overflow:'hidden',position:'relative',display:'flex'}}>
              {/* ── Code editor pane ── */}
              <div style={{flex:editorTab==='split'?'0 0 50%':'1',minWidth:0,display:editorTab==='preview'?'none':'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
              {displayFile&&displayContent?(
                <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
                  {/* Line numbers */}
                  <div ref={lineRef} style={{width:'48px',background:C.editorBg,textAlign:'right',padding:'14px 6px 14px 0',fontSize:'13px',lineHeight:'20px',color:C.dimmer,borderRight:`1px solid ${C.borderLight}`,flexShrink:0,overflowY:'hidden',userSelect:'none'}}>
                    {Array.from({length:lineCount},(_,i)=><div key={i} style={{height:'20px'}}>{i+1}</div>)}
                  </div>
                  {/* Code */}
                  <div ref={editorScrollRef} onScroll={onEditorScroll} style={{flex:1,overflow:'auto'}}
                    onClick={e=>{const el=e.currentTarget;const rect=el.getBoundingClientRect();const y=e.clientY-rect.top+el.scrollTop;const ln=Math.max(1,Math.floor(y/20)+1);setCursorLn(ln);setCursorCol(1);}}
                    className="editor-code-pane"
                  >
                    <pre style={{padding:'14px 14px 14px 12px',fontSize:'13px',lineHeight:'20px',fontFamily:FONT_CODE,margin:0,whiteSpace:'pre',color:C.text}} dangerouslySetInnerHTML={{__html:highlight(displayContent,activeLang)+(loading&&curFile?'<span class="cursor-blink">▌</span>':'')}}/>
                  </div>
                  {/* Minimap */}
                  {!loading&&<div style={{width:'56px',background:C.editorBg,borderLeft:`1px solid ${C.borderLight}`,overflow:'hidden',position:'relative',flexShrink:0}}>
                    <div style={{transform:'scale(0.09)',transformOrigin:'top left',width:'1100%',pointerEvents:'none'}}>
                      <pre style={{fontSize:'13px',lineHeight:'20px',color:'#3a3a3a',fontFamily:FONT_CODE,padding:'14px',margin:0,whiteSpace:'pre'}}>{displayContent}</pre>
                    </div>
                    <div style={{position:'absolute',top:0,left:0,right:0,height:'30%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}/>
                  </div>}
                </div>
              ):(
                /* Welcome / Loading screen */
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',color:'#3e3e3e',userSelect:'none',height:'100%'}}>
                  {loading?(
                    <>
                      <div style={{fontSize:'48px',lineHeight:1,filter:'drop-shadow(0 0 20px rgba(0,122,204,0.4))'}}>
                        <span className="spin-icon">⚡</span>
                      </div>
                      <div style={{fontSize:'16px',fontWeight:300,color:'#5e5e5e'}}>EIOR Agent is working…</div>
                      <div style={{fontSize:'12px',color:'#3e3e3e',fontFamily:FONT_CODE,background:'#252526',padding:'5px 12px',borderRadius:'4px',border:`1px solid ${C.borderLight}`}}>
                        {curFile?`Writing ${curFile}…`:'Analyzing your request…'}
                      </div>
                      <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                        {steps.slice(-3).map((s,i)=>(
                          <div key={i} style={{padding:'2px 8px',borderRadius:'3px',fontSize:'10px',background:s.done?'rgba(115,201,145,0.1)':'rgba(229,192,123,0.1)',border:`1px solid ${s.done?'rgba(115,201,145,0.3)':'rgba(229,192,123,0.3)'}`,color:s.done?C.green:C.yellow}}>
                            {s.done?'✓ ':''}{s.file.split('/').pop()}
                          </div>
                        ))}
                      </div>
                    </>
                  ):(
                    <>
                      <div style={{fontSize:'72px',lineHeight:1,filter:'drop-shadow(0 0 30px rgba(0,122,204,0.3))'}}>⚡</div>
                      <div style={{fontSize:'18px',fontWeight:300,color:'#4e4e4e',letterSpacing:'0.02em'}}>EIOR Code</div>
                      <div style={{fontSize:'12px',color:'#2e2e2e',fontFamily:FONT_CODE,background:'#252526',padding:'5px 12px',borderRadius:'4px',border:`1px solid ${C.borderLight}`}}>Describe your project in the chat →</div>
                    </>
                  )}
                </div>
              )}
              {/* ── Floating Preview button (bottom-right of editor) ── */}
              {previewSrc&&editorTab!=='preview'&&(
                <div style={{position:'absolute',bottom:'12px',right:'72px',zIndex:10,display:'flex',gap:'4px'}}>
                  <button onClick={()=>setEditorTab('split')} title="Split: Code + Preview"
                    style={{padding:'5px 10px',borderRadius:'6px',fontSize:'11px',background:'rgba(30,30,30,0.95)',border:'1px solid rgba(255,255,255,0.15)',color:C.text,cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',fontFamily:FONT_UI,boxShadow:'0 2px 8px rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(0,122,204,0.25)';(e.currentTarget as HTMLElement).style.borderColor='rgba(0,122,204,0.5)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='rgba(30,30,30,0.95)';(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.15)';}}
                  ><Code size={11}/><Eye size={11}/>Split</button>
                  <button onClick={()=>setEditorTab('preview')} title="Preview app"
                    style={{padding:'5px 10px',borderRadius:'6px',fontSize:'11px',background:'rgba(0,122,204,0.85)',border:'1px solid rgba(0,122,204,0.6)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',fontFamily:FONT_UI,boxShadow:'0 2px 8px rgba(0,0,0,0.4)'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(0,122,204,1)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='rgba(0,122,204,0.85)';}}
                  ><Eye size={11}/>Preview</button>
                </div>
              )}
              </div>

              {/* ── Preview pane (shown in split or full preview mode) ── */}
              {previewSrc&&(editorTab==='preview'||editorTab==='split')&&(
                <div style={{flex:editorTab==='split'?'0 0 50%':'1',minWidth:0,display:'flex',flexDirection:'column',borderLeft:editorTab==='split'?`1px solid ${C.border}`:'none',position:'relative'}}>
                  {/* Preview bar */}
                  <div style={{height:'30px',background:'#1a1a1a',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',padding:'0 8px',gap:'6px',flexShrink:0}}>
                    {/* Traffic-light dots */}
                    <div style={{display:'flex',gap:'4px'}}>
                      <div style={{width:'10px',height:'10px',borderRadius:'50%',background:'#ff5f57'}}/>
                      <div style={{width:'10px',height:'10px',borderRadius:'50%',background:'#ffbd2e'}}/>
                      <div style={{width:'10px',height:'10px',borderRadius:'50%',background:'#28ca41'}}/>
                    </div>
                    <div style={{flex:1,display:'flex',justifyContent:'center'}}>
                      <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px',padding:'2px 12px',fontSize:'11px',color:C.dim,fontFamily:FONT_CODE,minWidth:'160px',textAlign:'center',userSelect:'none'}}>
                        localhost • preview
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'4px'}}>
                      <button onClick={()=>setEditorTab('split')} title="Split view" style={{padding:'2px 6px',fontSize:'10px',background:editorTab==='split'?'rgba(255,255,255,0.1)':'transparent',border:`1px solid ${editorTab==='split'?'rgba(255,255,255,0.2)':'transparent'}`,borderRadius:'3px',color:C.dim,cursor:'pointer',fontFamily:FONT_UI}} onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.2)')} onMouseLeave={e=>(e.currentTarget.style.borderColor=editorTab==='split'?'rgba(255,255,255,0.2)':'transparent')}>Split</button>
                      <button onClick={()=>setEditorTab('preview')} title="Full preview" style={{padding:'2px 6px',fontSize:'10px',background:editorTab==='preview'?'rgba(255,255,255,0.1)':'transparent',border:`1px solid ${editorTab==='preview'?'rgba(255,255,255,0.2)':'transparent'}`,borderRadius:'3px',color:C.dim,cursor:'pointer',fontFamily:FONT_UI}} onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.2)')} onMouseLeave={e=>(e.currentTarget.style.borderColor=editorTab==='preview'?'rgba(255,255,255,0.2)':'transparent')}>Full</button>
                      <button onClick={()=>setEditorTab('editor')} title="Back to code" style={{padding:'2px 6px',fontSize:'10px',background:'transparent',border:'1px solid transparent',borderRadius:'3px',color:C.dim,cursor:'pointer',fontFamily:FONT_UI}} onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.2)')} onMouseLeave={e=>(e.currentTarget.style.borderColor='transparent')}><X size={10}/></button>
                    </div>
                  </div>
                  <iframe
                    key={previewSrc.slice(0,80)}
                    srcDoc={previewSrc}
                    style={{flex:1,border:'none',background:'#fff'}}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                    title="App Preview"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Agent panel (clean — activity + input only) ── */}
          <div style={{width:'300px',minWidth:'260px',display:'flex',flexDirection:'column',background:C.agentBg,borderLeft:`1px solid ${C.border}`,flexShrink:0}}>

            {/* Agent header */}
            <div style={{height:'35px',background:'#222',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',fontWeight:600,color:'#e0e0e0'}}>
                <Sparkles size={13} style={{color:C.accentGreen}}/>
                EIOR Agent
              </div>
              <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                {loading&&<span style={{fontSize:'10px',color:C.yellow,display:'flex',alignItems:'center',gap:'3px',fontFamily:FONT_CODE}}><span className="blink-dot" style={{fontSize:'7px'}}>●</span>{elapsedSecs}s</span>}
                {files.size>0&&<button onClick={doCopy} title="Copy output"
                  style={{padding:'2px 6px',fontSize:'11px',background:'transparent',border:`1px solid ${C.borderLight}`,borderRadius:'4px',color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',gap:'3px',fontFamily:FONT_UI}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.2)')} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.borderLight)}
                >{copied?<><Check size={10} style={{color:C.green}}/>Copied</>:<><Copy size={10}/>Copy</>}</button>}
                <button onClick={newProject} title="New session"
                  style={{padding:'2px 6px',fontSize:'11px',background:'transparent',border:`1px solid ${C.borderLight}`,borderRadius:'4px',color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',gap:'3px',fontFamily:FONT_UI}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.2)')} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.borderLight)}
                ><RefreshCw size={10}/>New</button>
              </div>
            </div>

            {/* ── Activity area: what the agent is doing ── */}
            <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'8px'}} ref={msgEndRef as any}>

              {/* Idle / done state */}
              {!loading&&steps.length===0&&(
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'12px',textAlign:'center'}}>
                  <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'rgba(16,163,127,0.08)',border:'1px solid rgba(16,163,127,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Sparkles size={20} style={{color:'rgba(16,163,127,0.5)'}}/>
                  </div>
                  <div style={{fontSize:'13px',color:'#4a4a4a',lineHeight:1.6}}>
                    {messages.length>0?'Project complete!':'Describe what you want to build.'}
                  </div>
                  {messages.length===0&&<div style={{fontSize:'10px',color:C.dimmer,fontFamily:FONT_CODE,background:'#252526',padding:'3px 10px',borderRadius:'4px',border:`1px solid ${C.borderLight}`}}>Ctrl+Enter or click ↑ to generate</div>}
                  {files.size>0&&(
                    <div style={{display:'flex',flexDirection:'column',gap:'4px',width:'100%'}}>
                      <div style={{fontSize:'10px',color:C.dimmer,textAlign:'left',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>Generated files</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'3px'}}>
                        {[...files.keys()].map(f=>(
                          <button key={f} onClick={()=>openFile(f)}
                            style={{padding:'2px 6px',fontSize:'10px',background:'rgba(0,122,204,0.1)',border:'1px solid rgba(0,122,204,0.25)',borderRadius:'3px',color:'#6cb6ff',cursor:'pointer',fontFamily:FONT_CODE,whiteSpace:'nowrap'}}
                          >{f.split('/').pop()}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active generation */}
              {(loading||steps.length>0)&&(
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {/* Status line */}
                  <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',background:'rgba(16,163,127,0.06)',border:'1px solid rgba(16,163,127,0.15)',borderRadius:'8px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:loading?C.accentGreen:C.green,flexShrink:0,boxShadow:loading?`0 0 6px ${C.accentGreen}`:'none'}} className={loading?'blink-dot':''}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'11px',color:C.text,fontWeight:500}}>
                        {loading?(curFile?`Writing ${curFile.split('/').pop()}`:'Thinking…'):`Done — ${files.size} files`}
                      </div>
                      {loading&&elapsedSecs>0&&<div style={{fontSize:'10px',color:C.dimmer,marginTop:'1px'}}>{elapsedSecs}s elapsed</div>}
                    </div>
                    {loading&&<button onClick={stop} style={{padding:'2px 7px',fontSize:'10px',background:'rgba(255,70,70,0.12)',border:'1px solid rgba(255,70,70,0.3)',borderRadius:'4px',color:C.red,cursor:'pointer',flexShrink:0,fontFamily:FONT_UI}}>Stop</button>}
                  </div>

                  {/* Live code preview */}
                  {loading&&(liveCode||streamPreview)&&(
                    <div style={{background:'#0d1117',border:`1px solid ${C.borderLight}`,borderRadius:'6px',overflow:'hidden'}}>
                      <div style={{padding:'4px 8px',fontSize:'10px',color:C.dimmer,borderBottom:`1px solid ${C.borderLight}`,display:'flex',alignItems:'center',gap:'5px',fontFamily:FONT_CODE}}>
                        <span className="blink-dot" style={{fontSize:'6px',color:C.yellow}}>●</span>
                        {curFile||'generating…'}
                      </div>
                      <div style={{padding:'8px',fontFamily:FONT_CODE,fontSize:'11px',color:'#abb2bf',lineHeight:'1.5',maxHeight:'180px',overflowY:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
                        {(liveCode||streamPreview).split('\n').slice(-12).join('\n')}
                        <span className="cursor-blink">▌</span>
                      </div>
                    </div>
                  )}

                  {/* File steps */}
                  <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    {steps.map((s,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:'6px',padding:'3px 6px',borderRadius:'4px',fontSize:'11px'}}>
                        <span style={{color:s.done?C.green:C.yellow,fontSize:'10px',flexShrink:0,fontWeight:600}}>{s.done?'✓':'▶'}</span>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:s.done?C.dim:C.text,fontFamily:FONT_CODE}}>{s.file}</span>
                      </div>
                    ))}
                    {loading&&<div style={{display:'flex',alignItems:'center',gap:'6px',padding:'3px 6px',fontSize:'11px',color:C.dimmer}}>
                      <span className="spin-icon" style={{color:C.blue,fontSize:'10px'}}>⟳</span>
                      <span style={{fontFamily:FONT_CODE}}>Processing…</span>
                    </div>}
                  </div>
                </div>
              )}

              {/* Error */}
              {error&&(
                <div style={{display:'flex',alignItems:'flex-start',gap:'6px',padding:'8px 10px',background:'rgba(244,71,71,0.08)',border:'1px solid rgba(244,71,71,0.2)',borderRadius:'8px',fontSize:'11px',color:C.red}}>
                  <AlertCircle size={12} style={{flexShrink:0,marginTop:'1px'}}/>
                  <span style={{flex:1,lineHeight:1.4}}>{error}</span>
                  <button onClick={()=>{setError('');generate();}} style={{background:'transparent',border:'none',cursor:'pointer',color:C.red,display:'flex',alignItems:'center',flexShrink:0}}><RotateCcw size={11}/></button>
                </div>
              )}
            </div>

            {/* ── Input: just textarea + voice + send ── */}
            <div style={{borderTop:`1px solid ${C.border}`,padding:'10px',background:'#1a1a1a',flexShrink:0}}>

              {/* Hidden file inputs */}
              <input ref={fileRef as any} type="file" multiple accept="video/*,text/*,application/json,application/xml,application/x-yaml,application/yaml" style={{display:'none'}}
                onChange={e=>{const n=Array.from(e.target.files||[]);if(n.length)setAttachments(p=>[...p,...n.map(f=>({id:crypto.randomUUID(),file:f}))]);(e.target as any).value='';}}
              />
              <input ref={folderInputRef as any} type="file" style={{display:'none'}} onChange={handleFolderOpen}
                {...{webkitdirectory:'',directory:''} as any}
              />

              {/* Attachments row */}
              {attachments.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:'3px',marginBottom:'6px'}}>
                  {attachments.map(a=>(
                    <span key={a.id} style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 6px',borderRadius:'3px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.borderLight}`,fontSize:'11px',color:C.text}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'}}>{a.file.name}</span>
                      <button type="button" onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))} style={{background:'transparent',border:'none',cursor:'pointer',color:C.dim,display:'flex',padding:'1px'}}><X size={10}/></button>
                    </span>
                  ))}
                </div>
              )}

              {/* Textarea */}
              <div style={{position:'relative'}}>
                <textarea ref={textareaRef} value={desc} onChange={e=>setDesc(e.target.value)}
                  onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(!loading&&(desc.trim()||attachments.length>0))generate();}}}
                  placeholder="Describe your app, or say what to integrate (auth, payments, db…)"
                  rows={4} maxLength={12000} disabled={loading}
                  style={{width:'100%',resize:'none',background:C.agentInput,border:`1px solid ${listening?'rgba(220,50,50,0.5)':C.borderLight}`,borderRadius:'10px',padding:'10px 12px 36px',fontSize:'12px',color:'#d4d4d4',outline:'none',fontFamily:FONT_UI,lineHeight:'1.5',boxSizing:'border-box',transition:'border-color .15s'}}
                  onFocus={e=>(e.currentTarget.style.borderColor=listening?'rgba(220,50,50,0.6)':'rgba(0,122,204,0.5)')}
                  onBlur={e=>(e.currentTarget.style.borderColor=listening?'rgba(220,50,50,0.5)':C.borderLight)}
                />
                {/* Bottom toolbar inside textarea */}
                <div style={{position:'absolute',bottom:'8px',left:'8px',right:'8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                    {/* Voice button */}
                    <button type="button" onClick={toggleVoice} disabled={!voiceOk} title={listening?'Stop voice':'Start voice input (speak your prompt)'}
                      style={{width:'26px',height:'26px',display:'flex',alignItems:'center',justifyContent:'center',background:listening?'rgba(220,50,50,0.25)':'transparent',border:`1px solid ${listening?'rgba(220,50,50,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:'6px',cursor:voiceOk?'pointer':'not-allowed',color:listening?C.red:C.dimmer,flexShrink:0,transition:'all .15s',boxShadow:listening?'0 0 8px rgba(220,50,50,0.3)':'none'}}
                    >{listening?<MicOff size={12}/>:<Mic size={12}/>}</button>
                    {listening&&<span style={{fontSize:'10px',color:C.red,display:'flex',alignItems:'center',gap:'3px',fontFamily:FONT_UI}}><span className="blink-dot" style={{fontSize:'6px'}}>●</span>Listening…</span>}
                    {/* Attach */}
                    <button type="button" onClick={()=>(fileRef.current as any)?.click()} title="Attach files"
                      style={{width:'26px',height:'26px',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',cursor:'pointer',color:attachments.length>0?C.lightBlue:C.dimmer,flexShrink:0}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color=C.text;}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color=attachments.length>0?C.lightBlue:C.dimmer;}}
                    ><Paperclip size={12}/></button>
                    {!voiceOk&&<span style={{fontSize:'9px',color:C.dimmer,fontFamily:FONT_UI}}>Voice: Chrome only</span>}
                  </div>
                  {/* Send / Stop */}
                  <button onClick={loading?stop:generate}
                    disabled={!loading&&!desc.trim()&&attachments.length===0}
                    title={loading?'Stop generation':'Generate (Ctrl+Enter)'}
                    style={{width:'28px',height:'28px',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'8px',border:'none',cursor:loading||desc.trim()||attachments.length>0?'pointer':'default',background:loading?'rgba(255,70,70,0.25)':desc.trim()||attachments.length>0?C.accentGreen:'rgba(255,255,255,0.05)',color:loading||desc.trim()||attachments.length>0?'#fff':C.dimmer,flexShrink:0,transition:'all .12s'}}
                  >{loading?<Square size={11}/>:<ArrowUp size={13}/>}</button>
                </div>
              </div>

              <div style={{marginTop:'5px',fontSize:'10px',color:C.dimmer,textAlign:'center',fontFamily:FONT_UI}}>
                Ctrl+Enter to send · Ctrl+` terminal
              </div>
            </div>
          </div>
        </div>

        {/* ── Terminal panel ── */}
        {terminalOpen&&(
          <div style={{height:'220px',background:C.termBg,borderTop:`1px solid ${C.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
            {/* Terminal tab bar */}
            <div style={{height:'30px',background:'#1a1a1a',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'stretch',flexShrink:0,position:'relative'}}>
              {/* Tabs */}
              <div style={{display:'flex',alignItems:'stretch',flex:1,overflowX:'auto'}}>
                {termTabs.map(tab=>{
                  const isAct=tab.id===activeTermId;
                  const icon=TERM_ICONS[tab.type];
                  return(
                    <div key={tab.id} onClick={()=>switchTerm(tab.id)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'0 10px',cursor:'pointer',flexShrink:0,fontSize:'11px',borderRight:`1px solid ${C.border}`,background:isAct?C.termBg:'transparent',color:isAct?C.text:C.dim,borderTop:`1px solid ${isAct?C.blue:'transparent'}`,userSelect:'none',fontFamily:FONT_UI}}>
                      <span style={{fontSize:'9px',fontWeight:700,color:tab.type==='bash'?C.green:tab.type==='powershell'?'#5b9bd5':tab.type==='cmd'?C.yellow:tab.type==='node'?'#8cc84b':C.purple}}>{icon}</span>
                      <span>{tab.label}</span>
                      {termTabs.length>1&&<button type="button" onClick={e=>{e.stopPropagation();removeTerm(tab.id);}} style={{padding:'1px',background:'transparent',border:'none',cursor:'pointer',color:'inherit',display:'flex',opacity:.5,borderRadius:'2px',flexShrink:0}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity='1';}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity='.5';}}><X size={10}/></button>}
                    </div>
                  );
                })}
                {/* New terminal button */}
                <div style={{position:'relative',flexShrink:0}}>
                  <button onClick={()=>setShowTermMenu(p=>!p)} title="New Terminal" style={{height:'30px',padding:'0 8px',background:'transparent',border:'none',cursor:'pointer',color:C.dim,display:'flex',alignItems:'center',gap:'3px',fontSize:'11px',fontFamily:FONT_UI}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.dim)}>
                    <Plus size={11}/>
                  </button>
                  {showTermMenu&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:C.menuDropBg,border:`1px solid ${C.menuBorder}`,borderRadius:'4px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)',padding:'4px 0',zIndex:300,minWidth:'160px'}}>
                      {(['bash','powershell','cmd','node','python'] as TermType[]).map(t=>(
                        <button key={t} onClick={()=>addTermTab(t)} style={{width:'100%',display:'flex',alignItems:'center',gap:'8px',padding:'5px 14px',fontSize:'12px',background:'transparent',border:'none',cursor:'pointer',color:C.text,fontFamily:FONT_UI,textAlign:'left'}} onMouseEnter={e=>(e.currentTarget.style.background=C.menuHover)} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <span style={{fontSize:'10px',fontWeight:700,color:t==='bash'?C.green:t==='powershell'?'#5b9bd5':t==='cmd'?C.yellow:t==='node'?'#8cc84b':C.purple,minWidth:'20px'}}>{TERM_ICONS[t]}</span>
                          <span>{{bash:'bash',powershell:'PowerShell',cmd:'Command Prompt',node:'Node.js REPL',python:'Python REPL'}[t]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Right controls */}
              <div style={{display:'flex',gap:'4px',alignItems:'center',padding:'0 8px',flexShrink:0}}>
                {loading&&<span style={{color:C.yellow,display:'flex',alignItems:'center',gap:'3px',fontSize:'10px'}}><span className="blink-dot" style={{fontSize:'6px'}}>●</span>Running…</span>}
                <button onClick={()=>setTermLines([])} title="Clear terminal" style={{padding:'1px 6px',background:'transparent',border:'none',cursor:'pointer',color:C.dim,fontSize:'10px',fontFamily:FONT_UI,borderRadius:'3px'}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.dim)}>Clear</button>
                <button onClick={()=>setTerminalOpen(false)} title="Close terminal" style={{padding:'1px',background:'transparent',border:'none',cursor:'pointer',color:C.dim,display:'flex',alignItems:'center',borderRadius:'3px'}} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.dim)}><X size={12}/></button>
              </div>
            </div>
            {/* Terminal content */}
            <div ref={termRef} style={{flex:1,overflowY:'auto',padding:'8px 12px',fontFamily:FONT_CODE,fontSize:'12px',lineHeight:'18px',color:C.termText}} onClick={()=>setShowTermMenu(false)}>
              <div style={{color:C.dimmer,marginBottom:'4px',fontSize:'10px'}}>{termTabs.find(t=>t.id===activeTermId)?.type==='powershell'?'Windows PowerShell':termTabs.find(t=>t.id===activeTermId)?.type==='cmd'?'Microsoft Windows [Command Prompt]':termTabs.find(t=>t.id===activeTermId)?.type==='node'?'Welcome to Node.js REPL':termTabs.find(t=>t.id===activeTermId)?.type==='python'?'Python 3 REPL':'bash — EIOR Code'}</div>
              {termLines.length===0?(
                <span style={{color:C.dimmer}}>Terminal ready. Generate a project to see output.</span>
              ):termLines.map((l,i)=>{
                const isErr=l.includes('✗')||l.includes('Error');
                const isDone=l.includes('✓')||l.includes('complete');
                const isWrite=l.includes('Writing');
                const isInfo=l.startsWith('>');
                return(
                  <div key={i} style={{color:isErr?C.red:isDone?C.green:isWrite?C.yellow:isInfo?C.lightBlue:C.termText,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
                    {l}
                  </div>
                );
              })}
              {loading&&<span style={{color:C.blue}}>▌</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Git Clone Modal ── */}
      {gitCloneOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setGitCloneOpen(false)}>
          <div style={{background:C.menuDropBg,border:`1px solid ${C.menuBorder}`,borderRadius:'8px',padding:'20px',width:'420px',boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px',color:C.text,fontSize:'13px',fontWeight:500}}>
              <Github size={15}/> Clone from Git
            </div>
            <input
              autoFocus
              value={gitCloneUrl}
              onChange={e=>setGitCloneUrl(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')handleGitClone();if(e.key==='Escape')setGitCloneOpen(false);}}
              placeholder="https://github.com/owner/repo"
              style={{width:'100%',background:C.input,border:`1px solid ${C.menuBorder}`,borderRadius:'4px',padding:'7px 10px',fontSize:'12px',color:C.text,fontFamily:FONT_CODE,boxSizing:'border-box',outline:'none',marginBottom:'12px'}}
            />
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setGitCloneOpen(false)} style={{padding:'5px 14px',background:'transparent',border:`1px solid ${C.menuBorder}`,borderRadius:'4px',color:C.dim,cursor:'pointer',fontSize:'12px',fontFamily:FONT_UI}}>Cancel</button>
              <button onClick={handleGitClone} disabled={!gitCloneUrl.trim()} style={{padding:'5px 14px',background:C.blue,border:'none',borderRadius:'4px',color:'#fff',cursor:'pointer',fontSize:'12px',fontFamily:FONT_UI,opacity:gitCloneUrl.trim()?1:0.5}}>Clone</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status bar ── */}
      <div style={{height:'22px',background:loading?'#8b6914':C.statusBar,borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',fontSize:'11px',color:C.text,flexShrink:0,userSelect:'none',fontFamily:FONT_UI,transition:'background .3s'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{display:'flex',alignItems:'center',gap:'3px',cursor:'pointer'}} onClick={()=>{setActivity('git');setExplorerOpen(true);}}>
            <GitBranch size={11}/> main
          </span>
          <span style={{display:'flex',alignItems:'center',gap:'2px'}}>
            <AlertCircle size={10}/> 0 &nbsp;△ 0
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {loading&&<span style={{display:'flex',alignItems:'center',gap:'4px'}}><span className="spin-icon" style={{fontSize:'10px'}}>⟳</span>Generating… {elapsedSecs}s</span>}
          {activeFile&&!loading&&<span>Ln {cursorLn}, Col {cursorCol}</span>}
          {activeFile&&!loading&&<span>UTF-8</span>}
          {displayFile&&activeLang&&<span style={{textTransform:'capitalize'}}>{activeLang==='ts'?'TypeScript':activeLang==='js'?'JavaScript':activeLang.charAt(0).toUpperCase()+activeLang.slice(1)}</span>}
          {files.size>0&&<span>{files.size} files</span>}
          <span style={{opacity:.6,cursor:'pointer'}} onClick={()=>setTerminalOpen(p=>!p)} title="Toggle Terminal (Ctrl+`)">{terminalOpen?'▼ Terminal':'▲ Terminal'}</span>
          <span style={{opacity:.6}}>{BACKEND_BASE_URL?'API: external':'API: proxy'}</span>
        </div>
      </div>

      <style>{`
        .hkw{color:#569cd6;font-weight:normal}
        .hs{color:#ce9178;font-weight:normal}
        .hn{color:#b5cea8;font-weight:normal}
        .hc{color:#6a9955;font-weight:normal}
        .ht{color:#4ec9b0;font-weight:normal}
        .hk{color:#9cdcfe;font-weight:normal}
        .hfn{color:#dcdcaa;font-weight:normal}
        b{font-weight:normal}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(121,121,121,0.35);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(121,121,121,0.6)}
        .editor-code-pane:hover .dl-btn{display:flex!important}
        .cursor-blink{animation:blink 1s step-end infinite;color:#007acc}
        .blink-dot{animation:pulse 1.2s ease-in-out infinite}
        .spin-icon{display:inline-block;animation:spin 1s linear infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        textarea::placeholder{color:#3a3a3a}
        textarea:disabled{opacity:0.6}
      `}</style>
    </div>
  );
}
