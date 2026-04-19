# StuffFinder

A PWA to catalog and find your belongings. Take a photo, tag it with a location and category, share the inventory with your household.

## Tech Stack

- **Frontend**: TypeScript + Vite + Preact + Tailwind CSS
- **Backend**: Supabase (Postgres + Storage + Auth, all RLS-enforced)
- **Hosting**: Vercel

## Features

- Photo capture straight from device camera
- Hierarchical locations ("Garage" > "Shelf 1")
- Per-household categories (customizable)
- Full-text search across name, description, category, location
- Multi-user households — invite others with a code
- Per-household private photo storage (signed URLs, 1h TTL)
- Installable as a PWA on iOS and Android

## Prerequisites

- Node.js 18+
- A Supabase account (free tier) — https://supabase.com
- A Vercel account (free tier) — https://vercel.com
- Git

## 1. Supabase setup

### 1.1 Create the project

1. Log into https://supabase.com → **New project**.
2. Pick a name, region close to you, and a database password (save it somewhere).
3. Wait for provisioning (~1 min).

### 1.2 Run the schema

1. In the dashboard, open **SQL Editor** → **New query**.
2. Copy the full contents of `supabase/schema_v2.sql` and paste.
3. Click **Run**. If prompted, choose **Run without RLS** (the script is DDL and needs the privileged role).
4. Expected result: `Success. No rows returned.` — all tables, RLS policies, and RPCs created.

The schema creates: `households`, `household_members`, `household_invites`, `categories`, `locations`, `items`, the `items_with_details` view, and the RPCs `create_household`, `create_invite`, `accept_invite`, `search_items`.

### 1.3 Storage bucket

1. Go to **Storage** → **Buckets**.
2. Click **New bucket** → name it `photos` → **leave "Public bucket" OFF**.
3. If you're migrating an existing public `photos` bucket, flip it with SQL:
   ```sql
   UPDATE storage.buckets SET public = false WHERE id = 'photos';
   ```
4. The storage RLS policies (at the bottom of `schema_v2.sql`) restrict access to `{household_id}/...` paths for members of that household.

### 1.4 Auth settings

1. **Authentication → Providers → Email** — keep enabled.
2. **Authentication → URL Configuration** — set **Site URL** to your production URL (e.g. `https://your-app.vercel.app`). This is where email confirmation links redirect.
3. For stricter rollout later: Authentication → Providers → Email → disable "Enable new user signups" (users can only join via invite code from an existing member).

### 1.5 Grab your credentials

In **Settings → API**, copy:
- **Project URL** (e.g. `https://abcde.supabase.co`) → this is `VITE_SUPABASE_URL`
- **Project API keys → anon public** → this is `VITE_SUPABASE_ANON_KEY`

## 2. Local development

```bash
git clone <this-repo>
cd stuffinder
npm install

cp .env.example .env
# Edit .env and fill in the two VITE_SUPABASE_* values from step 1.5

npm run dev
```

Open http://localhost:5173. Sign up → confirm email → create a household → add an item.

## 3. Vercel deployment

Two setup paths, either works:

- **GitHub integration (recommended)** — one-time wiring, then every `git push` to `main` auto-deploys. Preview deploys for branches.
- **CLI only** — no GitHub link, you deploy on demand with `npx vercel --prod`.

Pick one. The sections below cover both.

### 3.1 Prerequisites

- A Vercel account (https://vercel.com — free tier is fine).
- Your Supabase URL and anon key (from step 1.5).
- For GitHub integration: the repo pushed to GitHub (public or private).

### 3.2 Option A — GitHub integration (one-time setup)

**Push the repo** (skip if already pushed):
```bash
git remote add origin git@github.com:<you>/stuffinder.git
git push -u origin main
```

**Create the Vercel project:**

1. Go to https://vercel.com/new.
2. Click **Import Git Repository** and authorize Vercel for your GitHub account if prompted.
3. Find `stuffinder` in the list → **Import**.
4. **Configure Project** screen:
   - **Framework Preset**: Vite (auto-detected).
   - **Root Directory**: leave blank (repo root).
   - **Build Command**: leave default (`npm run build` or `vite build`).
   - **Output Directory**: leave default (`dist`).
   - **Install Command**: leave default (`npm install`).
5. Expand **Environment Variables** and add both, applying to all environments (Production, Preview, Development):

   | Name                     | Value                         |
   |--------------------------|-------------------------------|
   | `VITE_SUPABASE_URL`      | from Supabase Settings → API  |
   | `VITE_SUPABASE_ANON_KEY` | from Supabase Settings → API  |

   ⚠️ `VITE_*` variables are **baked into the client bundle at build time** — they are visible to anyone who views the site. That's fine for the Supabase URL and anon key (they rely on RLS, not secrecy). **Never** put the `service_role` key in `VITE_*` vars.
6. Click **Deploy**. First build takes ~60–90 s.
7. When it's done, click **Visit** to get the production URL (e.g. `https://stuffinder-xxxx.vercel.app`).

**Loop the URL back into Supabase:**

1. Copy the Vercel production URL.
2. In Supabase dashboard → **Authentication → URL Configuration**:
   - **Site URL**: paste the Vercel URL.
   - **Redirect URLs**: add the same URL plus `http://localhost:5173` if you want email confirmation links to also work locally.
3. Save.

This matters because Supabase email confirmation links redirect to Site URL. Without this, users click the confirmation link and land somewhere broken.

**Verify auto-deploy works:**

```bash
# Make any small change, e.g. edit README
git commit -am "test deploy" && git push
```

Watch https://vercel.com/<you>/stuffinder → Deployments. A new build should start within seconds.

### 3.3 Option B — CLI only

```bash
npm i -g vercel           # or use npx each time
vercel login              # opens browser for auth
vercel link               # first time: creates .vercel/ with project id
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
# paste values when prompted, repeat for `preview` and `development` if desired

vercel --prod             # build and deploy to production
```

Subsequent deploys: just `vercel --prod`.

To also mirror env vars into your local `.env` file:
```bash
vercel env pull .env
```

### 3.4 Custom domain (optional)

1. Vercel dashboard → your project → **Settings → Domains** → **Add**.
2. Enter your domain (e.g. `stuffinder.example.com`).
3. Follow the DNS instructions shown (A/AAAA record to Vercel's IP, or CNAME to `cname.vercel-dns.com`).
4. Once the domain shows "Valid Configuration", update Supabase **Site URL** (step 3.2 loop-back) to the custom domain.

### 3.5 Managing env vars after the fact

Dashboard → your project → **Settings → Environment Variables**. Each variable can scope to Production / Preview / Development independently. **Changing an env var does not redeploy** — you must trigger a redeploy manually:

- **Dashboard**: Deployments → latest → ⋯ → **Redeploy**.
- **CLI**: `vercel --prod`.

### 3.6 Rollback

Every past deploy stays accessible. To revert prod to an earlier build:

- Dashboard → Deployments → find a known-good deploy → ⋯ → **Promote to Production**.
- CLI: `vercel rollback <deployment-url-or-id>`.

Both are instant — no rebuild, just an alias swap.

### 3.7 Viewing logs and debugging a failed deploy

- **Build logs**: Deployments → click the failed deployment → **Build Logs** tab. Common failure = missing env var → `tsc` or `vite build` errors.
- **Runtime logs**: for a static SPA like this, there are no server runtime logs (Vercel just serves static files). Use the browser DevTools Console + Network tab against the live site for client-side issues. Supabase errors show up there.
- **Current production commit**: Dashboard → Deployments → look for the deploy with the green "Production" badge; the commit SHA is next to the message.

### 3.8 Disabling auto-deploy

If you want pushes to `main` to *not* auto-deploy (e.g. for a manual release gate):

Dashboard → **Settings → Git → Ignored Build Step** → add a command that exits 0 (skip) or 1 (build). Or simply disconnect the Git integration under **Settings → Git → Disconnect**.

## 4. Architecture

```
┌──────────────────┐     ┌──────────────────┐
│   Preact PWA     │◄───►│ Supabase Auth    │
│  (Vercel-hosted) │     │  (email + pwd)   │
└────────┬─────────┘     └──────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Supabase Postgres                          │
│                                            │
│   households ─┬─ members (user_id)         │
│               ├─ invites (code, expiry)    │
│               ├─ categories                │
│               ├─ locations (self-ref tree) │
│               └─ items                     │
│                                            │
│ All content tables scoped by household_id  │
│ RLS enforces: is_household_member(h_id)    │
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Supabase Storage (private bucket `photos`) │
│ Path: {household_id}/{filename}.jpg        │
│ Served as 1h signed URLs                   │
└────────────────────────────────────────────┘
```

## 5. Multi-user workflow

- **Create a household**: sign up → "Create a household" → give it a name.
- **Invite someone**: Settings → Household tab → **New invite** → share the 8-char code.
- **Join**: the recipient signs up → "Join with an invite code" → pastes the code. Codes expire after 7 days.
- **Leave**: Settings → Household tab → "Leave household" (non-owners only).

## 6. Useful commands

```bash
npm run dev          # Vite dev server with HMR
npm run dev -- --host   # Dev server exposed to LAN (test on phone)
npm run build        # Production build to dist/
npm run preview      # Serve the built output locally
npx tsc --noEmit     # Type check
npx vercel --prod    # Manual production deploy
```

## 7. Install as a PWA

**iOS (Safari)**: open the site → Share → Add to Home Screen → Add.
**Android (Chrome)**: open the site → ⋮ menu → Install app / Add to Home screen.

After install, the app runs fullscreen and gets its own icon. Note: a stale service worker can cache the old shell. If a new version isn't showing up, clear the site's storage or reinstall.

## 8. Project layout

```
stuffinder/
├── public/                      # PWA icons, favicons
├── scripts/
│   └── gen-icons.mjs            # Regenerate PWA icon set
├── src/
│   ├── components/
│   │   └── NavBar.tsx
│   ├── lib/
│   │   ├── auth.ts              # Session, memberships, active household
│   │   ├── api.ts               # All DB/RPC calls
│   │   ├── storage.ts           # Photo compress + upload
│   │   └── supabase.ts          # Client + signed-URL helper
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Onboarding.tsx       # Create or join household
│   │   ├── Home.tsx             # Item list + search
│   │   ├── AddItem.tsx
│   │   ├── ItemDetail.tsx       # View + edit + delete
│   │   └── Settings.tsx         # Household, categories, locations
│   ├── types/database.ts
│   ├── App.tsx                  # Route gate (auth → onboarding → main)
│   └── main.tsx
├── supabase/
│   └── schema_v2.sql            # Current schema (destructive migration)
├── index.html
├── vite.config.ts
└── tailwind.config.js
```
