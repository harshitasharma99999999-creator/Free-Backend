# Free Public API Backend Platform

A production-ready full-stack application that provides **free API access** to users: sign up, get an API key, call the API from your apps, view docs, and monitor usage. Built to run on **free-tier infrastructure** and scale without per-user cost.

## Features

- **User auth** — Sign up, login, JWT-based sessions
- **API keys** — Create and revoke keys; use in `X-API-Key` header or `apiKey` query param
- **Public API** — Example endpoints: `/v1/health`, `/v1/echo`, `/v1/random` (extend as needed)
- **Rate limiting** — Per-key limits via Upstash Redis (sliding window)
- **Usage tracking** — Daily request counts per key, viewable in dashboard
- **Security** — Helmet, CORS, hashed passwords (bcrypt), secure JWT
- **Dashboard** — Next.js App Router, TailwindCSS, ShadCN-style UI: overview, keys, usage, docs

## Tech Stack

| Layer      | Stack |
|-----------|--------|
| Backend   | Node.js, Fastify, MongoDB (Atlas free tier), JWT, bcrypt, Upstash Redis (rate limit), Helmet, CORS |
| Frontend  | Next.js 14 (App Router), TypeScript, TailwindCSS, ShadCN-style components |

**Authentication** is handled by **Firebase Auth** (email/password). The backend verifies Firebase tokens and issues JWTs for API keys and usage. See **[DEPLOY.md](./DEPLOY.md)** for step-by-step deployment (Firebase Hosting + free domain, and backend on Vercel/Render).

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI, JWT_SECRET, and optionally UPSTASH_* for rate limiting
npm install
npm run dev
```

Runs at **http://localhost:4000**.

Without Upstash env vars, the API still runs; rate limiting is skipped (all requests allowed).

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000 if different
npm install
npm run dev
```

Dashboard at **http://localhost:3000**.

### 3. Try the API

1. Open http://localhost:3000 → Sign up → create an API key (copy it once).
2. Call the API:

```bash
curl -H "X-API-Key: fk_YOUR_KEY" "http://localhost:4000/api/public/v1/health"
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 4000) |
| `NODE_ENV` | `development` or `production` |
| `JWT_SECRET` | Secret for signing JWTs (required in production) |
| `MONGODB_URI` | MongoDB connection string (e.g. Atlas free tier) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (optional, for rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token (optional) |
| `CORS_ORIGINS` | Comma-separated origins (e.g. `http://localhost:3000`) |
| `RATE_LIMIT_REQUESTS` | Requests per window (default 100) |
| `RATE_LIMIT_WINDOW` | Window in seconds (default 60) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:4000`) |

## API Overview

| Purpose | Base path | Auth |
|---------|-----------|------|
| Auth (register, login, me) | `/api/auth` | JWT for `/me` |
| API keys (create, list, revoke) | `/api/keys` | JWT |
| Usage stats | `/api/usage` | JWT |
| **Public API** (your apps call this) | `/api/public/v1/*` | API key (header or query) |

Public endpoints included by default:

- `GET /api/public/v1/health` — status + timestamp
- `GET /api/public/v1/echo?message=...` — echo message
- `GET /api/public/v1/random?min=0&max=100` — random integer

Add more under `backend/src/routes/publicApi.js` and document them in the dashboard docs page.

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config.js
│   │   ├── index.js
│   │   ├── db/
│   │   ├── lib/          # rateLimit, apiKey helpers
│   │   ├── plugins/      # auth, password
│   │   └── routes/       # auth, apiKeys, usage, publicApi
│   └── .env.example
├── frontend/
│   ├── app/              # Next.js App Router
│   │   ├── dashboard/    # keys, usage, docs
│   │   ├── login, register
│   │   └── layout, page
│   ├── components/ui/    # Button, Card, Input, Label
│   ├── context/          # AuthContext
│   └── lib/              # api client, utils
└── README.md
```

## Production Checklist

- [ ] Set strong `JWT_SECRET` and keep it secret
- [ ] Use MongoDB Atlas (or another host) with a production URI
- [ ] Configure Upstash Redis for rate limiting
- [ ] Set `CORS_ORIGINS` to your dashboard origin(s) only
- [ ] Use HTTPS in production; set `API_BASE_URL` to your public API URL
- [ ] Optionally add request logging, monitoring, and alerts

## License

MIT
