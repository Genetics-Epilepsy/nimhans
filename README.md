# NIMHANS — Genetics in Epilepsy Registry

A web-based clinical registry for tracking patients, genetic variants, and lab
reports related to genetic causes of epilepsy.

The front end is a static site (HTML, CSS, vanilla JS). Shared registry data
lives in **Supabase** (Postgres + REST + auth). Hosted free on **GitHub Pages**.

```
┌─────────────────────────┐        ┌────────────────────────┐
│  Browser (GitHub Pages) │  ───▶  │  Supabase project      │
│  index.html / app.js    │  ◀───  │  patient_variants /    │
└─────────────────────────┘  HTTPS │  registry_users tables │
                                   └────────────────────────┘
```

## Features

* Dashboard with patient and variant counts
* Patient registry: search, filter, add, edit, delete (admin only)
* Genetic variants table with classification badges
* Upload Reports tab (front-end stub for future OCR pipeline)
* User management (admin only)
* Works fully offline (in-memory demo) when Supabase isn't configured

## Project layout

```
.
├── index.html              # markup shell
├── css/style.css           # styles
├── js/
│   ├── config.js           # ← put your Supabase URL + anon key here
│   ├── supabase-client.js  # thin data-access layer
│   └── app.js              # UI logic
├── db/schema.sql           # Postgres schema + seed data + RLS policies
├── README.md
├── LICENSE
└── .gitignore
```

## Setup

### 1. Create the Supabase project

1. Sign in at <https://supabase.com> and click **New project**.
2. Open the **SQL Editor** in the left sidebar, paste the entire contents of
   `db/schema.sql`, and click **Run**. This creates the tables, policies and
   seed records.
3. Open **Settings → API** and copy:
   * **Project URL** — looks like `https://xxxxxxx.supabase.co`
   * **anon public** key — starts with `eyJ...`

### 2. Wire the front end to Supabase

Edit `js/config.js` and replace the two placeholders:

```js
window.APP_CONFIG = {
  SUPABASE_URL:     "https://xxxxxxx.supabase.co",
  SUPABASE_ANON_KEY:"eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..."
};
```

The `anon` key is meant to be public; access is governed by Row-Level Security
in Supabase. **Never** commit your `service_role` key.

### 3. Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5500
# then visit http://localhost:5500
```

Default login: **admin / 273070** (created by the seed in `schema.sql`).

## Deploying to GitHub Pages

```bash
# from inside this folder
git init
git add .
git commit -m "Initial commit"
git branch -M main

# create a new EMPTY repo on github.com first, then:
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

Then on github.com:

1. Open your repo → **Settings** → **Pages**.
2. Under **Build and deployment**, set Source = **Deploy from a branch**,
   Branch = `main`, Folder = `/ (root)`. Click **Save**.
3. Wait ~30 seconds; your site is live at
   `https://<your-username>.github.io/<repo>/`.

## Security checklist before going to production

* The `anon` policies in `db/schema.sql` allow read AND write to anyone with
  the anon key. **Replace them** with policies that check `auth.uid()` /
  custom claims before exposing the URL publicly.
* Migrate user authentication from the demo `pw` column to **Supabase Auth**
  (`auth.users`) and remove the plaintext password column.
* Restrict the project's allowed origins under Supabase **Auth → URL
  Configuration**.

## License

MIT — see `LICENSE`.
