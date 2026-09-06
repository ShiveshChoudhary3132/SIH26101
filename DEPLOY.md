# Deploying SAMARTH

**Read this first.** SAMARTH is a client-side application. The competency engine, the
recommender and the assessment generator all run in the browser. **Vercel alone gives you a
fully working deployment** — Render and Neon are optional and add exactly one thing:
state that survives a page refresh.

So there are two paths. Do Path A first. It takes about five minutes and everything works.

| | Path A — frontend only | Path B — add persistence |
|---|---|---|
| Hosts | Vercel | Vercel + Render + Neon |
| Works fully | Yes | Yes |
| Survives refresh | No — completions and quiz scores reset | Yes |
| Moving parts that can fail on stage | 0 | 3 |
| Setup time | ~5 min | ~25 min |

If you are short on time before the pitch, **stop after Path A.** The demo is identical to a
judge except that reloading the page resets progress.

---

## Prerequisite — put the project on GitHub

Both Vercel and Render deploy from a Git repository.

```bash
cd nexus
git init -b main
git add .
git commit -m "SAMARTH — SIH26101 prototype"
```

Create an empty repo on GitHub, then:

```bash
git remote add origin https://github.com/<you>/samarth.git
git push -u origin main
```

`dist/` is gitignored — Vercel regenerates it on every deploy, and a clean checkout has been
verified to produce a byte-identical build. Do commit `data/courses.json` and the generated
`src/catalogue.js`, so a fresh clone runs locally without anyone having to run the ingest first.

---

# Path A — frontend on Vercel

1. Go to **vercel.com → Add New → Project** and import your GitHub repo.
2. Vercel reads `vercel.json`, so leave every field at its default. For the record it will use:
   - Framework preset: **Other**
   - Build command: `node tools/ingest-igot.mjs data/courses.json && node build.mjs`
   - Output directory: `dist`
3. Click **Deploy**.

You get a URL like `https://samarth.vercel.app`. Open it — the app should load in well under a
second and the top bar should read **iGOT synced · 758 modules** and **Local session**.

That is a complete, working deployment. Everything below is optional.

> **If the repo root is not `nexus/`** (say you committed the parent folder), set
> **Root Directory** to `nexus` in Vercel's project settings.

---

# Path B — add persistence

Three services, in this order. The order matters: Render needs to exist before Vercel can point
at it, and Render needs Vercel's URL for CORS — so you will set CORS loosely at first and
tighten it at the end.

## B1 · Neon — the database

1. **neon.tech → New Project.** Name it `samarth`, pick the region closest to you
   (`ap-south-1` / Mumbai for an Indian audience).
2. On the project dashboard open **Connection Details**.
3. Select the **Pooled connection** string and copy it. It looks like:

   ```
   postgresql://neondb_owner:PASSWORD@ep-xxxx-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```

   Use the **pooled** one (it has `-pooler` in the host). Render's free tier opens and closes
   connections often, and the pooler handles that. The code already sets
   `statement_cache_size=0`, which is required because Neon's pooler runs PgBouncer in
   transaction mode and cannot hold prepared statements.

4. You do **not** need to create any tables. The API creates its schema on first start.

## B2 · Seed the database

Run this once from your machine — it loads the framework, roles, officers, the 758 iGOT modules
and the 49 TPAC programmes into Neon.

```bash
cd nexus
node tools/export-seed.mjs
```

```bash
cd server
pip install -r requirements.txt
```

PowerShell:

```bash
$env:DATABASE_URL = "postgresql://neondb_owner:PASSWORD@ep-xxxx-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require"
python seed.py
```

Expect:

```
   iGOT modules  758
   TPAC modules  49
   seeded:
     competencies  34
     roles         8
     courses       807
     officers      6
     trainings     20
     assessments   0
```

`python seed.py --reset` truncates first if you want a clean reload.

## B3 · Render — the API

1. **render.com → New → Web Service**, connect the same GitHub repo.
2. Settings:
   - **Root Directory**: `server`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
   - Instance type: **Free**
3. **Environment variables**:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon **pooled** connection string |
   | `ALLOWED_ORIGINS` | `*` &nbsp;(tighten in B5) |
   | `PYTHON_VERSION` | `3.12.7` |

4. Deploy, then open `https://<your-service>.onrender.com/health`. You want:

   ```json
   { "status": "ok", "database": "connected",
     "rows": { "courses": 807, "competencies": 34, "officers": 6 } }
   ```

   If `status` is `degraded`, the `detail` field tells you why — almost always a malformed
   `DATABASE_URL` or a missing `?sslmode=require`.

Interactive API docs are at `/docs`.

## B4 · Point Vercel at the API

In **Vercel → Project → Settings → Environment Variables**, add:

| Key | Value | Environments |
|---|---|---|
| `SAMARTH_API_URL` | `https://<your-service>.onrender.com` | Production, Preview, Development |

Then **Deployments → ⋯ → Redeploy**. The build bakes the URL into the page; it is not read at
runtime, so a redeploy is required whenever you change it.

Reload the site. The top-bar chip should turn green and read **Synced**, and a toast should say
*"Service record restored"*.

## B5 · Close the CORS hole

Back in Render, change `ALLOWED_ORIGINS` from `*` to your real origins:

```
https://samarth.vercel.app,http://localhost:8731
```

Save — Render redeploys automatically. Reload the site once more and confirm the chip is still
green.

---

## Verifying it actually persists

1. Open the site → **Learning Path** → **Mark complete** on any module.
2. Watch readiness move and the list re-rank.
3. **Refresh the page.**
4. The completion is still there, and the module shows *Already completed*.

Do the same with **Assessment Studio → Apply to competency profile**.

To see it from the database side:

```
https://<your-service>.onrender.com/api/officers/OFF-001
https://<your-service>.onrender.com/api/analytics/summary
```

---

## Things that will bite you

**Render's free tier sleeps after 15 minutes idle** and takes 30–60 seconds to wake. The app
handles this — it paints immediately and hydrates in the background with a 75-second timeout —
but a judge watching the chip say "Connecting…" for a minute is a bad look.

> **Before you present: open the site once, wait for the green chip, then leave the tab open.**

If you want to avoid it entirely, add a free cron ping (cron-job.org, every 10 minutes) hitting
`https://<your-service>.onrender.com/health`.

**Neon's free tier auto-suspends** after 5 minutes idle too, but wakes in under a second. The
same ping covers both.

**A failed API never breaks the app.** If Render is down, the chip reads *Local session*, a
warning toast appears, and everything works exactly as it does offline. This is deliberate. Your
fallback if the venue network dies is `dist/samarth.html` — a single file that runs from a USB
stick with no network at all. Keep a copy on your laptop.

**Changing `SAMARTH_API_URL` needs a Vercel redeploy.** It is baked in at build time, on purpose,
so the offline build makes no network calls of its own.

---

## What each service is actually doing

| Service | Role | If it disappears |
|---|---|---|
| **Vercel** | Serves one 532 KB HTML file containing the entire application | Site is down |
| **Render** | FastAPI: catalogue reads, officer records, completions, assessment attempts, SQL aggregates | App runs; nothing persists between reloads |
| **Neon** | Postgres: 807 courses, 34 competencies, 8 role matrices, 6 officers, and the growing record of completions and assessments | Same as above |

The scoring engine deliberately stays in the browser. That is what makes the Assessment Studio's
claim true — an uploaded document is never sent anywhere.

---

## Local development

```bash
cd nexus
python -m http.server 8731        # http://localhost:8731/dist/index.html
```

Run the API locally too:

```bash
cd server
$env:DATABASE_URL = "postgresql://..."
uvicorn main:app --reload --port 8000
```

Then rebuild the frontend against it:

```bash
$env:SAMARTH_API_URL = "http://localhost:8000"
node build.mjs
```

Unset `SAMARTH_API_URL` and rebuild to get back to a fully offline bundle.
