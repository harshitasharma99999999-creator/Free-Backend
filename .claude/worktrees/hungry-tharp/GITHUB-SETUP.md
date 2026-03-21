# Put this project on GitHub

Follow these steps to upload your **Free Backend** project to GitHub.

---

## 1. Create a GitHub account (if you don’t have one)

- Go to [github.com](https://github.com) and sign up (free).

---

## 2. Create a new repository on GitHub

1. Log in to GitHub.
2. Click the **+** (top right) → **New repository**.
3. Fill in:
   - **Repository name:** e.g. `free-backend` or `Free-Backend`.
   - **Description:** optional (e.g. “Free public API backend with Firebase”).
   - **Public**.
   - **Do not** check “Add a README”, “Add .gitignore”, or “Choose a license” (we already have files).
4. Click **Create repository**.
5. Leave the page open; you’ll need the repo URL (e.g. `https://github.com/YOUR_USERNAME/free-backend.git`).

---

## 3. Open a terminal in your project folder

- On Windows: open **PowerShell** or **Command Prompt**.
- Go to the project root (the folder that contains `frontend`, `backend`, `README.md`):

```powershell
cd "c:\Users\harsh\Downloads\Free Backend"
```

---

## 4. Initialize Git and make the first commit

Run these commands **one by one**:

```powershell
git init
```

```powershell
git add .
```

```powershell
git status
```

- Check that **no** `.env` or `node_modules` folders are listed.  
- If you see `.env` or `node_modules`, the `.gitignore` isn’t working; don’t commit those.

Then:

```powershell
git commit -m "Initial commit: Free API backend + frontend"
```

---

## 5. Connect to GitHub and push

Replace `YOUR_USERNAME` and `free-backend` with your GitHub username and repo name.

**If you created the repo with no README (recommended):**

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/free-backend.git
git push -u origin main
```

**If you already added a README on GitHub**, use:

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/free-backend.git
git pull origin main --allow-unrelated-histories
git push -u origin main
```

- When prompted for credentials, use your GitHub username and a **Personal Access Token** (GitHub no longer accepts account password for Git).  
- To create a token: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token**; give it “repo” scope and use it as the password.

---

## 6. Check on GitHub

- Open your repo in the browser (e.g. `https://github.com/YOUR_USERNAME/free-backend`).
- You should see `frontend/`, `backend/`, `README.md`, `DEPLOY.md`, etc.

---

## Important: never commit secrets

- **Do not** commit:
  - `.env`
  - `.env.production`
  - `.env.local`
  - Any file with MongoDB URIs, JWT secrets, or Firebase private keys.
- The `.gitignore` in this project is set up to ignore those.  
- For deployment (Vercel, Firebase, etc.), set secrets in the host’s dashboard or CLI, not in the repo.

---

## Later: push changes

After editing code:

```powershell
cd "c:\Users\harsh\Downloads\Free Backend"
git add .
git status
git commit -m "Short description of what you changed"
git push
```

You’re done. Your project is on GitHub.
