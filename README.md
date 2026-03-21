# GenAPI — AI API Proxy Platform

A production-grade SaaS platform that lets users generate AI images and videos via API keys.
No ML infrastructure — we proxy requests to [Replicate](https://replicate.com).

## What it does

- Users sign up (Firebase Auth), get 10 free image credits + 2 video credits
- They generate API keys from the dashboard
- They call `POST /api/v1/generate-image` or `POST /api/v1/generate-video` with their key
- Backend validates the key, deducts credits, proxies to Replicate, returns the result
- Usage is logged in Firestore; plans can be upgraded (Stripe checkout placeholder included)

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Firebase Auth |
| Backend | Node.js, Express, Firebase Admin SDK (Firestore) |
| AI provider | Replicate (Stable Diffusion XL, Zeroscope V2) |
| Hosting | Frontend → Vercel · Backend → Railway |

---

## Project structure

```
Free Backend/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js          # All env var config
│   │   │   └── firebase.js     # Firebase Admin init
│   │   ├── middleware/
│   │   │   ├── auth.js         # Firebase ID token verifier
│   │   │   ├── apiKeyAuth.js   # API key validator
│   │   │   └── rateLimiter.js  # express-rate-limit
│   │   ├── routes/
│   │   │   ├── users.js        # GET /api/users/me, /usage
│   │   │   ├── apiKeys.js      # POST/GET/DELETE /api/keys
│   │   │   ├── generate.js     # POST /api/v1/generate-image|video
│   │   │   └── payments.js     # POST /api/payments/*
│   │   ├── utils/
│   │   │   ├── firestore.js    # All Firestore CRUD helpers
│   │   │   └── credits.js      # Credit deduction + usage logging
│   │   ├── server.js           # Express app
│   │   └── index.js            # Entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── app/
    │   ├── page.tsx             # Landing page
    │   ├── login/page.tsx       # Login
    │   ├── register/page.tsx    # Register
    │   ├── dashboard/page.tsx   # Dashboard (keys, playground)
    │   ├── pricing/page.tsx     # Pricing
    │   ├── docs/page.tsx        # API docs
    │   └── billing/success/     # Post-payment success
    ├── lib/api-v2.ts            # API client (calls backend)
    └── context/AuthContext.tsx  # Firebase auth context
```

---

## Local setup

### Prerequisites
- Node.js 20+
- Firebase project (Firestore + Auth enabled)
- Replicate account (for image/video generation)

### 1. Clone and install

```bash
git clone <your-repo>
cd "Free Backend"

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure backend env

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

| Variable | Where to get it |
|----------|----------------|
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → General |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Project Settings → Service Accounts → Generate key → JSON file |
| `FIREBASE_PRIVATE_KEY` | Same JSON file (keep `\n` as-is, wrap in quotes) |
| `REPLICATE_API_TOKEN` | https://replicate.com/account/api-tokens |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys (optional) |

### 3. Configure frontend env

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

The dashboard will try same-origin `/api/*` first (works on hosts with rewrites/proxies), and falls back to `NEXT_PUBLIC_API_URL` if `/api/*` returns 404.

### 4. Run locally

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Backend health: http://localhost:4000/health

---

## Deployment

### Backend → Railway

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Set **Root Directory** to `backend`
3. Add environment variables (same as `.env.example`)
4. Railway will run `npm start` automatically
5. Copy the Railway URL (e.g. `https://your-api.up.railway.app`)

### Frontend → Vercel

1. Go to https://vercel.com → Add New Project → import repo
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL
4. Deploy

### Firebase setup

1. Go to Firebase Console → Firestore → Create database (start in production mode)
2. Go to Authentication → Enable **Email/Password** and **Google** providers
3. Add Firestore security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own doc
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // API keys: read/write own keys via backend only (backend uses Admin SDK, bypasses rules)
    match /apiKeys/{key} {
      allow read: if false; // backend only
    }
    match /usageLogs/{log} {
      allow read: if false; // backend only
    }
  }
}
```

---

## Environment variables reference

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Default `4000` |
| `FRONTEND_URL` | Yes | Your frontend URL for checkout redirects |
| `CORS_ORIGINS` | Yes | Comma-separated frontend URLs |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | Service account email |
| `FIREBASE_PRIVATE_KEY` | Yes | Service account private key |
| `REPLICATE_API_TOKEN` | Yes | Replicate API token for generation |
| `REPLICATE_IMAGE_MODEL` | No | Replicate model version for images |
| `REPLICATE_VIDEO_MODEL` | No | Replicate model version for videos |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (for real payments) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `RATE_LIMIT_MAX` | No | Requests per minute (default 60) |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Recommended | Backend API base URL (used directly and as a fallback if `/api/*` isn’t proxied) |

---

## API reference

See [/docs](http://localhost:3000/docs) or `frontend/app/docs/page.tsx`.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Health check |
| GET | `/api/users/me` | Firebase ID token | Get user profile + credits |
| GET | `/api/users/usage` | Firebase ID token | Usage logs |
| POST | `/api/keys` | Firebase ID token | Generate API key |
| GET | `/api/keys` | Firebase ID token | List your keys |
| DELETE | `/api/keys/:key` | Firebase ID token | Revoke a key |
| POST | `/api/v1/generate-image` | API key | Generate image (1 credit) |
| POST | `/api/v1/generate-video` | API key | Generate video (5 credits) |
| POST | `/api/payments/create-checkout-session` | Firebase ID token | Start checkout |
| POST | `/api/payments/webhook/success` | none (verify sig) | Payment webhook |
| POST | `/api/payments/simulate-upgrade` | Firebase ID token | Dev-only plan upgrade |

---

## Credits system

| Plan | Image credits | Video credits |
|------|--------------|--------------|
| Free | 10 | 2 |
| Pro ($19/mo) | 200 | 50 |
| Enterprise ($99/mo) | 2000 | 500 |

- 1 image = 1 image credit
- 1 video = 5 video credits
- 402 Payment Required when credits reach 0
