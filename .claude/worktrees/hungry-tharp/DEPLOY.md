# Deploy your Free API app (step-by-step)

This guide gets your app live in the browser using **Firebase** (free domain: `free-backed.web.app`) and **Vercel** for the backend (or another host). Follow each step in order.

---

## Part 1: Firebase Console setup (one-time)

### Step 1.1 – Open Firebase

1. Go to **https://console.firebase.google.com**
2. Sign in with your Google account.
3. Open your project **free-backed** (or create one and use that name everywhere).

### Step 1.2 – Enable Email/Password sign-in

1. In the left sidebar click **Build → Authentication**.
2. Click **Get started** if you see it.
3. Open the **Sign-in method** tab.
4. Click **Email/Password**, turn **Enable** ON, then **Save**.

### Step 1.3 – Get Firebase Admin keys (for your backend)

Your backend must verify Firebase tokens. It needs a **service account key**:

1. Click the **gear icon** next to “Project Overview” → **Project settings**.
2. Open the **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**. A JSON file downloads.
4. Open that JSON. You will need:
   - `project_id` → use as `FIREBASE_PROJECT_ID`
   - `client_email` → use as `FIREBASE_CLIENT_EMAIL`
   - `private_key` → use as `FIREBASE_PRIVATE_KEY` (keep the `\n` as in the file, or paste the key in one line and in `.env` use real newlines; see Step 3.2).

Keep this file **private** (do not commit to Git). You’ll put these values in your backend’s `.env` in Part 3.

---

## Part 2: Deploy the **frontend** to Firebase Hosting (free domain)

Your dashboard (Next.js) will be served from Firebase and get a free URL like **https://free-backed.web.app**.

### Step 2.1 – Install Firebase CLI

1. Open **PowerShell** or **Command Prompt**.
2. Run:

```bash
npm install -g firebase-tools
```

3. Log in:

```bash
firebase login
```

Use the same Google account as Firebase Console.

### Step 2.2 – Set the backend URL for production

Your frontend must know where your API lives.

1. In the project folder go to **frontend**.
2. Create **`.env.production`** (or set this in your host’s env later):

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-URL
```

Replace `YOUR-BACKEND-URL` with your real backend URL (e.g. from Vercel or Render). If you deploy the backend later, come back and set this and redeploy the frontend.

For **local testing** you can use:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Step 2.3 – Build and deploy the frontend

1. Open a terminal in the project root.
2. Go to the frontend folder:

```bash
cd frontend
```

3. Install dependencies (if you haven’t):

```bash
npm install
```

4. Build the static site:

```bash
npm run build
```

This creates an **out** folder with the static files.

5. Deploy to Firebase Hosting:

```bash
firebase deploy
```

6. When it finishes, it will show something like:

```text
Hosting URL: https://free-backed.web.app
```

7. Open that URL in **Chrome** (or any browser). You should see your app. Try **Sign up** with email/password (Firebase Auth). If `NEXT_PUBLIC_API_URL` still points to localhost, “Create API key” and “Usage” will only work when the backend is running locally or after you set the production backend URL and redeploy.

### Step 2.4 – See your app live in Chrome

- Open: **https://free-backed.web.app** (or the URL from `firebase deploy`).
- You should see the Free API landing page.
- Click **Sign up**, create an account (email + password), then you’ll be in the dashboard.

If something doesn’t load, check the browser console (F12 → Console) and that `NEXT_PUBLIC_API_URL` points to your deployed backend.

---

## Part 3: Deploy the **backend** (so API keys and usage work)

The frontend uses Firebase Auth; the backend still serves **API keys** and **usage** and must verify Firebase tokens. Deploy it somewhere (e.g. **Vercel** or **Render**) and then point the frontend to it.

### Step 3.1 – Choose a host

- **Vercel** (good for Node/API): https://vercel.com  
- **Render** (free tier): https://render.com  

Use one of them (or any Node host). Below we assume you have an account and can create a new project/service.

### Step 3.2 – Set backend environment variables

On your backend host, set these (names may differ slightly per host):

| Variable | Example / description |
|----------|------------------------|
| `PORT` | `4000` (or what the host expects, e.g. Render uses `PORT` automatically) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | A long random string (e.g. generate one and keep it secret) |
| `MONGODB_URI` | Your MongoDB Atlas connection string (free tier is fine) |
| `CORS_ORIGINS` | `https://free-backed.web.app` (your Firebase Hosting URL, no trailing slash) |
| `FIREBASE_PROJECT_ID` | `free-backed` |
| `FIREBASE_CLIENT_EMAIL` | From the service account JSON (`client_email`) |
| `FIREBASE_PRIVATE_KEY` | From the service account JSON (`private_key`). Paste the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. On many hosts you paste it as one line; the backend code turns `\n` into newlines. |

Optional (for rate limiting):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Step 3.3 – Deploy the backend

**If using Vercel:**

1. In the project root, the backend is in the **backend** folder.
2. You can deploy **backend** as a separate Vercel project (Node.js):
   - Connect your repo, set **Root Directory** to `backend`.
   - Build command: (leave default or `npm install`).
   - Output: the app is a Node server; set **Start Command** to `npm run start` (or `node src/index.js`).
3. Add all environment variables from Step 3.2 in Vercel → Settings → Environment Variables.
4. Deploy. Note the URL (e.g. `https://your-api.vercel.app`).

**If using Render:**

1. New **Web Service**, connect the repo.
2. Root directory: `backend`.
3. Build: `npm install`.
4. Start: `npm run start`.
5. Add env vars from Step 3.2.
6. Deploy and copy the service URL.

### Step 3.4 – Point the frontend to the backend

1. Set **frontend** env (e.g. `.env.production` or your host’s env):
   - `NEXT_PUBLIC_API_URL=https://your-backend-url` (the URL from Step 3.3).
2. Rebuild and redeploy the frontend:

```bash
cd frontend
npm run build
firebase deploy
```

Then open **https://free-backed.web.app** again. Sign in and try creating an API key and viewing usage; they should work.

---

## Quick checklist

- [ ] Firebase Console: Email/Password sign-in **enabled**
- [ ] Firebase Console: **Service account** key downloaded; `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` set on backend
- [ ] **Frontend**: `npm install` → `npm run build` → `firebase deploy`; app opens at `https://free-backed.web.app`
- [ ] **Backend**: Deployed with `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, Firebase env vars set
- [ ] **Frontend** `NEXT_PUBLIC_API_URL` set to backend URL; frontend rebuilt and redeployed

---

## One-command deploy (frontend only)

From the **frontend** folder you can run:

```bash
npm run deploy
```

This runs `next build` and then `firebase deploy`. Make sure `.env.production` (or your build-time env) has `NEXT_PUBLIC_API_URL` set correctly before this.

---

## Troubleshooting

- **“Invalid Firebase token”**  
  Backend env: check `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Ensure the private key has correct newlines (the backend replaces `\n` in the string).

- **CORS errors in browser**  
  Set `CORS_ORIGINS` on the backend to your exact frontend URL, e.g. `https://free-backed.web.app` (no trailing slash).

- **API keys / Usage don’t load**  
  Confirm `NEXT_PUBLIC_API_URL` is set at **build time** and points to the deployed backend. Rebuild and redeploy the frontend after changing it.

- **App works locally but not after deploy**  
  Check that you deployed the **out** folder to Firebase Hosting (`firebase deploy` from the folder that contains `firebase.json` and `out`). Confirm the Hosting URL in the Firebase Console matches the one you open in Chrome.
