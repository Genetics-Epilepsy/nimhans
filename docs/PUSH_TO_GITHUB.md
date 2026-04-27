# How to push this project to GitHub

Five commands once you have a fresh, **empty** repository on github.com.

## 1. Create the repository

* Sign in to <https://github.com>
* Click the **+** icon in the top right → **New repository**
* Name it (e.g. `nimhans-epilepsy-registry`), leave it **Public** (required for
  the free GitHub Pages tier — Private also works on paid plans)
* **Do NOT** initialize with a README, .gitignore, or license (we already have them)
* Click **Create repository**

GitHub then shows you a URL like
`https://github.com/<your-username>/<repo>.git`. Copy it.

## 2. Push from this folder

Open a terminal **inside this `nimhans-genetics-epilepsy-registry/` folder** and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

(The first time you push you'll be prompted for credentials. On modern GitHub,
use a **Personal Access Token** as the password — generate one at
<https://github.com/settings/tokens?type=beta>.)

## 3. Turn on GitHub Pages

Two equally good options.

### Option A — let the included workflow do it (recommended)
The file `.github/workflows/pages.yml` deploys automatically on every push.
Just go to **Settings → Pages** in your repo and set **Source = GitHub Actions**.

### Option B — serve directly from main
**Settings → Pages → Build and deployment → Source = Deploy from a branch →
Branch = `main`, Folder = `/ (root)` → Save.**

Either way, your site will be live in ~30 seconds at:

```
https://<your-username>.github.io/<repo>/
```

## 4. Configure Supabase

See the main `README.md` (steps 1 and 2). After running `db/schema.sql` in the
Supabase SQL editor and pasting your URL + anon key into `js/config.js`,
commit and push the change:

```bash
git add js/config.js
git commit -m "Wire to Supabase project"
git push
```

GitHub Pages picks up the change automatically.
