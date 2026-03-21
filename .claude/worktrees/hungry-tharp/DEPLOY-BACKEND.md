# Deploy the backend so API keys and usage work

The frontend at **https://free-backed.web.app** is live. To make **Create key** and **Usage** work, you need to deploy the backend and point the frontend to it.

You can use either **Vercel** (no Firebase upgrade) or **Firebase Cloud Functions** (requires Blaze plan).

---

## Option A: Vercel (recommended, free, no card)

1. **Log in to Vercel** (once):
   ```bash
   cd backend
   npx vercel login
   ```

2. **Set environment variables** in Vercel before or after first deploy:
   - In [Vercel Dashboard](https://vercel.com/dashboard) → your project → Settings → Environment Variables, add:
   - `MONGODB_URI` – MongoDB Atlas connection string (free tier: https://www.mongodb.com/cloud/atlas)
   - `JWT_SECRET` – any long random string (e.g. `openssl rand -hex 32`)
   - `CORS_ORIGINS` – `https://free-backed.web.app`
   - `FIREBASE_PROJECT_ID` – `free-backed`
   - `FIREBASE_CLIENT_EMAIL` – from Firebase Console → Project settings → Service accounts → key JSON
   - `FIREBASE_PRIVATE_KEY` – from the same JSON (paste the full key including `-----BEGIN PRIVATE KEY-----`)

3. **Deploy the backend**:
   ```bash
   cd backend
   npx vercel --prod
   ```
   Copy the URL it prints (e.g. `https://free-api-backend-xxx.vercel.app`).

4. **Point the frontend to the backend**:
   - In the **frontend** folder, create `.env.production` with:
     ```
     NEXT_PUBLIC_API_URL=https://YOUR-VERCEL-URL.vercel.app
     ```
   - Rebuild and redeploy the frontend:
     ```bash
     cd frontend
     npm run build
     firebase deploy
     ```

After this, sign in at https://free-backed.web.app and **Create key** will work.

---

## Option B: Firebase Cloud Functions (needs Blaze plan)

Firebase Cloud Functions require the **Blaze (pay-as-you-go)** plan. You are only charged if you exceed the free tier.

1. **Upgrade** to Blaze: [Firebase Console → Usage and billing](https://console.firebase.google.com/project/free-backed/usage/details).

2. **Set config** (once):
   ```bash
   firebase functions:config:set mongodb.uri="YOUR_MONGODB_URI" jwt.secret="YOUR_JWT_SECRET" cors.origins="https://free-backed.web.app"
   ```

3. **Deploy functions** from the **frontend** directory (so it sees `../functions`):
   - Restore `firebase.json` to include functions:
     ```json
     "functions": { "source": "../functions" }
     ```
   - Then:
     ```bash
     cd frontend
     firebase deploy --only functions
     ```

4. **Use the Functions URL** in the frontend:
   - In Firebase Console → Functions, copy the URL of the `api` function (e.g. `https://uscentral1-free-backed.cloudfunctions.net/api`).
   - In **frontend**, create `.env.production` with:
     ```
     NEXT_PUBLIC_API_URL=https://uscentral1-free-backed.cloudfunctions.net
     ```
   - Rebuild and redeploy:
     ```bash
     cd frontend
     npm run build
     firebase deploy --only hosting
     ```

---

## Summary

| Step | Option A (Vercel) | Option B (Firebase) |
|------|-------------------|----------------------|
| 1 | `npx vercel login` | Upgrade to Blaze |
| 2 | Set env vars in Vercel | `firebase functions:config:set ...` |
| 3 | `npx vercel --prod` in `backend` | `firebase deploy --only functions` from `frontend` |
| 4 | Put Vercel URL in frontend `.env.production` | Put Functions URL in frontend `.env.production` |
| 5 | `npm run build` and `firebase deploy` in `frontend` | Same |

After step 5, the live app at **https://free-backed.web.app** will be able to create API keys and show usage.
