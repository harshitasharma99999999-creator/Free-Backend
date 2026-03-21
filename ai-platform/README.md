# AI Platform

A production-ready, OpenAI-compatible AI developer platform built with open-source models.

| Layer | Technology |
|---|---|
| API framework | Fastify + TypeScript |
| Database | PostgreSQL |
| Cache / Rate limiting | Redis |
| Auth | Firebase Authentication |
| Text AI (local) | Ollama (Llama 3.2) |
| Text AI (cloud fallback) | Groq |
| Image AI (local) | Automatic1111 / Stable Diffusion |
| Image AI (cloud fallback) | Replicate SDXL |
| Video AI | Replicate WAN 2.1 T2V |
| Developer portal | Vanilla HTML/CSS/JS → Firebase Hosting |

---

## Project Structure

```
ai-platform/
├── src/
│   ├── server.ts                       ← Fastify entry point
│   ├── utils/
│   │   ├── config.ts                   ← Zod-validated env config
│   │   └── logger.ts                   ← Pino structured logger
│   ├── db/
│   │   ├── postgres.ts                 ← pg Pool singleton
│   │   └── redis.ts                    ← ioredis singleton
│   ├── models/
│   │   ├── user.model.ts               ← User upsert / lookup
│   │   ├── apiKey.model.ts             ← Key hashing, CRUD, rotation
│   │   └── usage.model.ts              ← Usage log writes / reads
│   ├── middleware/
│   │   ├── firebaseAuth.middleware.ts  ← Verify Firebase ID token
│   │   ├── apiKey.middleware.ts        ← Verify sk-... API key
│   │   └── rateLimit.middleware.ts     ← Redis sliding-window 60 rpm
│   ├── services/
│   │   ├── llm.service.ts              ← Ollama → Groq fallback
│   │   ├── image.service.ts            ← A1111 → Replicate fallback
│   │   └── video.service.ts            ← Replicate WAN 2.1
│   └── api/
│       ├── auth.routes.ts              ← /auth/*
│       ├── key.routes.ts               ← /v1/keys
│       └── generation.routes.ts        ← /v1/chat/completions etc.
├── scripts/
│   └── init-db.sql                     ← PostgreSQL schema
├── portal/                             ← Firebase-hosted developer UI
│   ├── index.html
│   ├── dashboard.html
│   ├── docs.html
│   └── style.css
├── docker-compose.yml
├── Dockerfile
├── firebase.json
└── .env.example
```

---

## Quick Start (Local)

### 1. Prerequisites
- Node.js 20+
- Docker + Docker Compose
- PostgreSQL & Redis (or use Docker Compose)

### 2. Clone and install

```bash
cd ai-platform
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the required values are:

| Variable | Where to get it |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Project Settings → Service Accounts → Generate key |
| `FIREBASE_PRIVATE_KEY` | Same JSON file |
| `DATABASE_URL` | Your PostgreSQL connection string |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) (free tier) |
| `REPLICATE_API_TOKEN` | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |

### 4. Initialise the database

```bash
psql $DATABASE_URL -f scripts/init-db.sql
```

### 5. Start the server

```bash
npm run dev          # development (hot reload)
npm run build && npm start   # production
```

---

## Docker (one-command startup)

Starts API + PostgreSQL + Redis + Ollama:

```bash
cp .env.example .env   # fill in Firebase + Groq/Replicate keys
docker compose up -d
```

The API will be available at `http://localhost:3000`.

> **GPU / Stable Diffusion (optional)**
> ```bash
> docker compose --profile gpu up -d
> ```
> Requires NVIDIA GPU with Docker GPU support.

---

## API Endpoints

### System
```
GET /health                     No auth — liveness probe
```

### Auth (Firebase ID token)
```
POST /auth/sync                 Upsert user → return user record
GET  /auth/me                   User + usage summary
GET  /auth/usage                Last 50 usage log entries
```

### API Keys (Firebase ID token)
```
GET    /v1/keys                 List your keys
POST   /v1/keys                 Create key { name } → plaintext returned ONCE
DELETE /v1/keys/:id             Revoke key
PUT    /v1/keys/:id/rotate      Revoke + issue new key
```

### AI Generation (API key: `sk-...`)
```
POST /v1/chat/completions       OpenAI-compatible chat
POST /v1/images/generations     OpenAI DALL-E-compatible image gen
POST /v1/video/generate         Text-to-video generation
GET  /v1/models                 List available models
```

---

## curl Examples

### Health check
```bash
curl http://localhost:3000/health
```

### Sync user (get Firebase ID token from browser DevTools)
```bash
curl -X POST http://localhost:3000/auth/sync \
  -H "Authorization: Bearer <firebase-id-token>"
```

### Create API key
```bash
curl -X POST http://localhost:3000/v1/keys \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App"}'
```

### Chat completion
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Explain black holes simply."}]
  }'
```

### Image generation
```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A neon city skyline at night, cyberpunk style",
    "n": 1,
    "size": "1024x1024"
  }'
```

### Video generation
```bash
curl -X POST http://localhost:3000/v1/video/generate \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A golden retriever running on a beach", "duration": 5}'
```

---

## Deploy

### Backend → Railway

```bash
cd ai-platform
railway login
railway init
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="redis://..."
railway variables set FIREBASE_PROJECT_ID="free-backed"
railway variables set FIREBASE_CLIENT_EMAIL="..."
railway variables set FIREBASE_PRIVATE_KEY="..."
railway variables set GROQ_API_KEY="..."
railway variables set REPLICATE_API_TOKEN="..."
railway up
```

> **PostgreSQL + Redis on Railway**: Add PostgreSQL and Redis as plugins in the Railway dashboard. The connection URLs will be auto-injected.

### Developer Portal → Firebase Hosting

Update the `firebaseConfig` in `portal/index.html` and `portal/dashboard.html` with your real Firebase web app config. Then:

```bash
cd ai-platform
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

Portal will be live at `https://free-backed.web.app`.

---

## Security

- API keys stored as **SHA-256 hashes** — plaintext never persisted
- Plaintext returned **exactly once** on creation/rotation
- Input validated with **Zod** on all routes
- `@fastify/helmet` sets security headers
- **CORS** restricted to portal origin in production
- **Rate limiting** per API key via Redis sliding window (60 rpm)
- Prompt **sanitization** strips null bytes

---

## JavaScript SDK Example

```js
const API_KEY = 'sk-your-key';
const BASE    = 'https://your-backend.railway.app';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type':  'application/json',
};

// Chat
const chat = await fetch(`${BASE}/v1/chat/completions`, {
  method: 'POST', headers,
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'What is machine learning?' }]
  }),
}).then(r => r.json());

console.log(chat.choices[0].message.content);

// Image
const img = await fetch(`${BASE}/v1/images/generations`, {
  method: 'POST', headers,
  body: JSON.stringify({ prompt: 'A futuristic Tokyo street', n: 1, size: '1024x1024' }),
}).then(r => r.json());

console.log(img.data[0].url);

// Video
const vid = await fetch(`${BASE}/v1/video/generate`, {
  method: 'POST', headers,
  body: JSON.stringify({ prompt: 'A timelapse of the Milky Way', duration: 5 }),
}).then(r => r.json());

console.log(vid.video_url);
```
