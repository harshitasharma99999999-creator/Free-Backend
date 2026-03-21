'use client';

import { useState } from 'react';
import { Check, Copy, Server, Terminal, Shield, Zap, Globe, ChevronRight, AlertCircle, CheckCircle2, HardDrive, Cpu, MemoryStick, Network } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://backend-eta-lyart-87.vercel.app').replace(/\/+$/, '');
const EIOR_BASE = `${API_BASE}/eior/v1`;

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
      <pre className="bg-[#0d1117] p-4 text-sm overflow-x-auto leading-relaxed text-[#abb2bf] font-mono whitespace-pre-wrap"><code>{code}</code></pre>
    </div>
  );
}

function Step({ n, title, children, highlight }: { n: number|string; title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex gap-4 mb-7 ${highlight ? 'bg-[#10a37f]/5 border border-[#10a37f]/15 rounded-xl p-4 -mx-1' : ''}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mt-0.5 ${highlight ? 'bg-[#10a37f] text-white' : 'bg-[#10a37f]/15 border border-[#10a37f]/30 text-[#10a37f]'}`}>{n}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[#e0e0e0] mb-2 text-base">{title}</h3>
        <div className="text-[#8e8ea0] text-sm leading-relaxed space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, badge }: { icon: any; title: string; children: React.ReactNode; badge?: string }) {
  return (
    <section className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center"><Icon size={16} className="text-[#10a37f]"/></div>
        <h2 className="text-lg font-bold text-[#e0e0e0] flex-1">{title}</h2>
        {badge && <span className="text-xs bg-[#007acc]/10 border border-[#007acc]/20 text-[#6cb6ff] rounded-full px-2.5 py-1">{badge}</span>}
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

export default function VPSGuidePage() {
  const [sshUser, setSshUser] = useState('root');
  const [vpsIp, setVpsIp] = useState('YOUR_VPS_IP');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-[#858585] mb-3">
          <span>Guides</span><ChevronRight size={12}/><span className="text-[#10a37f]">OpenClaw on EIOR VPS</span>
        </div>
        <h1 className="text-3xl font-bold text-[#ececec] mb-2">Run OpenClaw on EIOR VPS</h1>
        <p className="text-[#8e8ea0] text-base leading-relaxed">
          Provision a dedicated VPS through EIOR, install OpenClaw on it, point it at the EIOR API, and have a 24/7 AI agent server running in under 15 minutes.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {['Ubuntu 22.04','Node 20 LTS','PM2 process manager','Nginx reverse proxy','SSL / HTTPS'].map(t=>(
            <span key={t} className="text-xs bg-[#1e1e1e] border border-[#2a2a2a] text-[#858585] rounded-full px-3 py-1">{t}</span>
          ))}
        </div>
      </div>

      {/* ── What you need ─────────────────────────────────────────────────── */}
      <Section icon={CheckCircle2} title="What you need">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
          {[
            { icon: Server, label: 'EIOR VPS', desc: 'Provisioned from Dashboard → VPS' },
            { icon: Shield, label: 'EIOR API Key', desc: 'Dashboard → API Keys (fk_...)' },
            { icon: Terminal, label: 'SSH client', desc: 'Terminal / PuTTY / Windows SSH' },
            { icon: Globe, label: 'Domain (optional)', desc: 'For public HTTPS access' },
          ].map(({icon:I,label,desc})=>(
            <div key={label} className="flex items-start gap-2 bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
              <I size={14} className="text-[#10a37f] mt-0.5 shrink-0"/>
              <div><div className="text-[#cccccc] font-medium">{label}</div><div className="text-[#555] text-xs mt-0.5">{desc}</div></div>
            </div>
          ))}
        </div>

        {/* Recommended spec */}
        <div className="text-sm font-medium text-[#cccccc] mb-2">Recommended VPS spec for OpenClaw</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: Cpu, label: 'CPU', value: '2 vCPU' },
            { icon: MemoryStick, label: 'RAM', value: '4 GB' },
            { icon: HardDrive, label: 'Storage', value: '40 GB SSD' },
            { icon: Network, label: 'Bandwidth', value: '20 TB/mo' },
          ].map(({icon:I,label,value})=>(
            <div key={label} className="bg-[#0d1117] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <I size={16} className="text-[#10a37f] mx-auto mb-1"/>
              <div className="text-[#e0e0e0] font-bold text-sm">{value}</div>
              <div className="text-[#555] text-xs">{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Part A: Provision VPS ─────────────────────────────────────────── */}
      <Section icon={Server} title="Part A — Provision your VPS" badge="5 min">
        <Step n={1} title="Go to Dashboard → VPS → Create Server">
          <p>Select <strong className="text-[#cccccc]">Ubuntu 22.04 LTS</strong>, choose a region close to your users, and pick at least the <strong className="text-[#cccccc]">CX21</strong> plan (2 vCPU, 4 GB RAM).</p>
          <p>Add your SSH public key so you can log in without a password. If you don't have one:</p>
          <CopyBlock lang="bash" title="Generate SSH key (run locally)" code={`# Generate key pair
ssh-keygen -t ed25519 -C "openclaw-vps"

# Copy your public key (paste this into the VPS dashboard)
cat ~/.ssh/id_ed25519.pub`} />
        </Step>

        <Step n={2} title="Note your VPS IP address">
          <p>Once created, your VPS will have a public IP (e.g. <code className="bg-[#252526] text-[#ce9178] rounded px-1 py-0.5 text-xs">167.235.18.42</code>). You'll use this for SSH and for setting up your domain.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="flex-1">
              <label className="text-xs text-[#858585] mb-1 block">Your VPS IP (fill in below to personalize commands)</label>
              <input value={vpsIp} onChange={e=>setVpsIp(e.target.value)} placeholder="167.235.18.42"
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#cccccc] outline-none focus:border-[#10a37f]/50 font-mono"/>
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#858585] mb-1 block">SSH user (usually root for new servers)</label>
              <input value={sshUser} onChange={e=>setSshUser(e.target.value)} placeholder="root"
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#cccccc] outline-none focus:border-[#10a37f]/50 font-mono"/>
            </div>
          </div>
        </Step>

        <Step n={3} title="Connect via SSH">
          <CopyBlock lang="bash" title="From your local machine" code={`ssh ${sshUser}@${vpsIp}

# You should see the Ubuntu welcome banner
# If you get permission denied: check your key with -i flag
ssh -i ~/.ssh/id_ed25519 ${sshUser}@${vpsIp}`} />
        </Step>
      </Section>

      {/* ── Part B: Server Setup ──────────────────────────────────────────── */}
      <Section icon={Shield} title="Part B — Initial server setup" badge="5 min">
        <Alert type="warn">Run all commands below inside your VPS SSH session, not on your local machine.</Alert>

        <Step n={1} title="Update the system and install dependencies">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Update package list and upgrade
apt update && apt upgrade -y

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install build tools, git, nginx, certbot
apt install -y build-essential git nginx certbot python3-certbot-nginx ufw

# Verify versions
node -v    # should be v20.x.x
npm -v     # should be 10.x.x
nginx -v`} />
        </Step>

        <Step n={2} title="Create a non-root user (recommended)">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Create user
adduser openclaw --disabled-password --gecos ""

# Give sudo access
usermod -aG sudo openclaw

# Copy SSH key to new user
mkdir -p /home/openclaw/.ssh
cp ~/.ssh/authorized_keys /home/openclaw/.ssh/
chown -R openclaw:openclaw /home/openclaw/.ssh
chmod 700 /home/openclaw/.ssh
chmod 600 /home/openclaw/.ssh/authorized_keys

# Switch to new user for the rest of the setup
su - openclaw`} />
        </Step>

        <Step n={3} title="Configure firewall">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Allow SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 3000   # OpenClaw port (if exposing directly)

# Enable firewall
ufw --force enable
ufw status`} />
        </Step>
      </Section>

      {/* ── Part C: Install & configure OpenClaw ─────────────────────────── */}
      <Section icon={Zap} title="Part C — Install & configure OpenClaw" badge="3 min">
        <Step n={1} title="Install OpenClaw globally">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Install OpenClaw
npm install -g openclaw

# Verify installation
openclaw --version`} />
        </Step>

        <Step n={2} title="Set EIOR environment variables" highlight>
          <p>This is the critical step — this points OpenClaw to the EIOR API.</p>
          <CopyBlock lang="bash" title="VPS terminal — add to ~/.bashrc" code={`# Add EIOR config to shell profile
cat >> ~/.bashrc << 'EOF'

# ── EIOR API Configuration ──────────────────────────────
export EIOR_API_KEY="fk_your_api_key_here"
export EIOR_BASE_URL="${EIOR_BASE}"

# Shortcut aliases
alias eior-chat='openclaw ask --model eior/eior-v1'
alias eior-code='openclaw ask --model eior/eior-coder'
EOF

# Apply immediately
source ~/.bashrc

# Verify
echo $EIOR_API_KEY
echo $EIOR_BASE_URL`} />
          <Alert type="warn">Replace <code className="bg-[#252526] text-[#ce9178] rounded px-1 text-xs">fk_your_api_key_here</code> with your actual key from Dashboard → API Keys.</Alert>
        </Step>

        <Step n={3} title="Configure OpenClaw to use EIOR">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Create OpenClaw config directory
mkdir -p ~/.openclaw

# Write the config file
cat > ~/.openclaw/config.json << 'EOF'
{
  "models": {
    "providers": {
      "eior": {
        "baseUrl": "${EIOR_BASE}",
        "apiKey": "\${EIOR_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "eior-v1",       "name": "EIOR v1" },
          { "id": "eior-advanced", "name": "EIOR Advanced" },
          { "id": "eior-coder",    "name": "EIOR Coder" }
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
}
EOF

# Set as default model
openclaw config set model eior/eior-v1

# Test connection
openclaw ask "Hello from my EIOR VPS!" --model eior/eior-v1`} />
          <Alert type="success">If you get a response — OpenClaw is running on your VPS and talking to EIOR!</Alert>
        </Step>
      </Section>

      {/* ── Part D: Run as a service ──────────────────────────────────────── */}
      <Section icon={Terminal} title="Part D — Run OpenClaw 24/7 as a service" badge="PM2">
        <Step n={1} title="Install PM2 process manager">
          <CopyBlock lang="bash" title="VPS terminal" code={`npm install -g pm2

# Verify
pm2 --version`} />
        </Step>

        <Step n={2} title="Create an OpenClaw server application">
          <CopyBlock lang="bash" title="VPS terminal" code={`mkdir -p ~/openclaw-server
cd ~/openclaw-server
npm init -y
npm install express openai cors`} />
          <CopyBlock lang="bash" title="VPS terminal — create server.js" code={`cat > server.js << 'JSEOF'
const express = require('express');
const OpenAI  = require('openai').default;
const cors    = require('cors');

const app  = express();
const eior = new OpenAI({
  apiKey:  process.env.EIOR_API_KEY,
  baseURL: process.env.EIOR_BASE_URL,
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', model: 'eior-v1', ts: Date.now() }));

// Proxy chat completions to EIOR
app.post('/chat', async (req, res) => {
  try {
    const { messages, model = 'eior-v1', stream = false } = req.body;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      const s = await eior.chat.completions.create({ model, messages, stream: true });
      for await (const chunk of s) {
        res.write(\`data: \${JSON.stringify(chunk)}\\n\\n\`);
      }
      res.write('data: [DONE]\\n\\n');
      res.end();
    } else {
      const r = await eior.chat.completions.create({ model, messages });
      res.json(r);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`OpenClaw-EIOR server running on :\${PORT}\`));
JSEOF`} />
        </Step>

        <Step n={3} title="Start with PM2 and enable auto-restart on reboot">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Start the server
pm2 start server.js --name "openclaw-eior" \\
  --env production \\
  -- \\
  --EIOR_API_KEY="$EIOR_API_KEY" \\
  --EIOR_BASE_URL="$EIOR_BASE_URL"

# Or with env file approach (recommended):
cat > .env << EOF
EIOR_API_KEY=$EIOR_API_KEY
EIOR_BASE_URL=$EIOR_BASE_URL
PORT=3000
EOF

pm2 start server.js --name "openclaw-eior"

# Enable auto-start on server reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs openclaw-eior`} />
        </Step>

        <Step n={4} title="Test the server from your local machine">
          <CopyBlock lang="bash" title="Local terminal" code={`# Health check
curl http://${vpsIp}:3000/health

# Chat test
curl -X POST http://${vpsIp}:3000/chat \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello from my EIOR VPS!"}]}'`} />
        </Step>
      </Section>

      {/* ── Part E: Nginx + SSL ───────────────────────────────────────────── */}
      <Section icon={Globe} title="Part E — Nginx reverse proxy + SSL (optional but recommended)">
        <Alert type="info">Skip this section if you only need internal/private access without a domain.</Alert>

        <Step n={1} title="Configure Nginx as a reverse proxy">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Create Nginx site config
cat > /etc/nginx/sites-available/openclaw << 'EOF'
server {
    listen 80;
    server_name your-domain.com;   # replace with your domain or VPS IP

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;

        # For SSE streaming support
        proxy_buffering    off;
        proxy_read_timeout 300s;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx`} />
        </Step>

        <Step n={2} title="Install free SSL certificate with Let's Encrypt">
          <CopyBlock lang="bash" title="VPS terminal" code={`# Replace with your actual domain
certbot --nginx -d your-domain.com

# Auto-renewal (already set up by certbot, verify it)
systemctl status certbot.timer

# Test renewal dry run
certbot renew --dry-run`} />
          <Alert type="success">Your OpenClaw server is now accessible at <strong>https://your-domain.com</strong> with a valid SSL certificate.</Alert>
        </Step>
      </Section>

      {/* ── Part F: Connect OpenClaw app to VPS ──────────────────────────── */}
      <Section icon={Network} title="Part F — Point your OpenClaw app to the VPS server">
        <Step n={1} title="Update OpenClaw config to use your VPS endpoint">
          <CopyBlock lang="json" title="Your app's openclaw.json" code={`{
  "models": {
    "providers": {
      "eior-vps": {
        "baseUrl": "http://${vpsIp}:3000",
        "api": "openai-completions",
        "models": [
          { "id": "eior-v1",    "name": "EIOR v1 (VPS)" },
          { "id": "eior-coder", "name": "EIOR Coder (VPS)" }
        ]
      }
    }
  }
}`} />
        </Step>

        <Step n={2} title="Switch OpenClaw to use the VPS model">
          <CopyBlock lang="bash" title="Local terminal" code={`# Point to your VPS-hosted EIOR
openclaw config set model eior-vps/eior-v1

# Test it end-to-end
openclaw ask "Hello from my VPS!" --stream

# Switch to coder model on VPS
openclaw config set model eior-vps/eior-coder`} />
        </Step>

        <Step n={3} title="Monitor your VPS server">
          <CopyBlock lang="bash" title="SSH into VPS then run:" code={`# Live log stream
pm2 logs openclaw-eior --lines 50

# Process stats (CPU/RAM)
pm2 monit

# Restart if needed
pm2 restart openclaw-eior

# View all processes
pm2 list`} />
        </Step>
      </Section>

      {/* ── Quick reference ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#10a37f]/20 bg-[#10a37f]/5 p-6 mb-6">
        <h2 className="text-base font-bold text-[#10a37f] mb-4">Quick Reference Card</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          {[
            { label: 'SSH to VPS', cmd: `ssh ${sshUser}@${vpsIp}` },
            { label: 'Check server status', cmd: 'pm2 status' },
            { label: 'View logs', cmd: 'pm2 logs openclaw-eior' },
            { label: 'Restart server', cmd: 'pm2 restart openclaw-eior' },
            { label: 'Health check', cmd: `curl http://${vpsIp}:3000/health` },
            { label: 'Test chat', cmd: `openclaw ask "test" --model eior-vps/eior-v1` },
            { label: 'Update server', cmd: 'git pull && pm2 restart openclaw-eior' },
            { label: 'Check nginx', cmd: 'systemctl status nginx' },
          ].map(({label,cmd})=>(
            <div key={label} className="bg-[#0d1117] rounded-lg p-2.5 border border-[#2a2a2a]">
              <div className="text-[#858585] text-[10px] mb-1">{label}</div>
              <div className="text-[#10a37f]">{cmd}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
