#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# EIOR API — VPS Setup Script
# Tested on: Ubuntu 22.04 / Debian 12
# Run as root:  bash vps-setup.sh
# ─────────────────────────────────────────────────────────────────
set -e

OLLAMA_MODEL="${OLLAMA_MODEL:-eior}"   # change if your model name differs
OLLAMA_PORT=11434

echo "==> Updating packages..."
apt-get update -q && apt-get upgrade -yq

echo "==> Installing dependencies..."
apt-get install -yq curl wget git ufw

# ── Install Ollama ────────────────────────────────────────────────
echo "==> Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# ── Start Ollama as a systemd service ─────────────────────────────
echo "==> Configuring Ollama service..."
cat > /etc/systemd/system/ollama.service << 'SERVICE'
[Unit]
Description=Ollama LLM Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=5
Environment=OLLAMA_HOST=0.0.0.0:11434

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable ollama
systemctl start ollama

echo "==> Waiting for Ollama to start..."
sleep 5
until curl -sf http://localhost:$OLLAMA_PORT/api/tags > /dev/null; do
  echo "   Waiting for Ollama..."
  sleep 3
done
echo "   Ollama is up."

# ── Pull the EIOR model ───────────────────────────────────────────
echo "==> Pulling model: $OLLAMA_MODEL (this may take a while)..."
ollama pull "$OLLAMA_MODEL"

# Also pull an embeddings model
echo "==> Pulling embeddings model: nomic-embed-text..."
ollama pull nomic-embed-text

# ── Firewall: allow Ollama only from Vercel IPs ───────────────────
# Vercel uses dynamic IPs, so allow all by default (restrict to your backend IP in production)
echo "==> Configuring firewall..."
ufw allow ssh
ufw allow 11434/tcp comment 'Ollama API'
ufw --force enable

# ── Test ──────────────────────────────────────────────────────────
echo ""
echo "==> Testing Ollama..."
curl -s http://localhost:$OLLAMA_PORT/api/tags | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = [m['name'] for m in data.get('models', [])]
print('   Models available:', models)
"

VPS_IP=$(curl -s ifconfig.me)
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Your VPS IP:     $VPS_IP"
echo "  Ollama URL:      http://$VPS_IP:$OLLAMA_PORT"
echo ""
echo "  NEXT STEP — set this env var in Vercel:"
echo "  OLLAMA_BASE_URL = http://$VPS_IP:$OLLAMA_PORT"
echo ""
echo "  Then redeploy the backend:"
echo "  vercel --prod (from the backend/ directory)"
echo "══════════════════════════════════════════════════════════════"
