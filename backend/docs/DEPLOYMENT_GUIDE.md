# TokenTrail Deployment Guide (Free Tier)

This guide provides step-by-step instructions for deploying TokenTrail using **100% free-tier services**:
* **Database**: Supabase PostgreSQL (Already provisioned & migrated)
* **Backend API**: Render (Free Web Service)
* **Frontend Dashboard**: Vercel (Free Static Hosting)
* **Keep-Alive Cron**: GitHub Actions / Cron-Job.org (Prevents Render cold starts)

---

## 1. Backend Deployment (Render)

1. Sign up / Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository: `MeetRamani28/TokenTrail`.
4. Configure the Web Service settings:
   * **Name**: `tokentrail-backend` (or your preferred name)
   * **Region**: Choose the region closest to your Supabase DB (e.g. Singapore / Seoul / Oregon)
   * **Branch**: `main`
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install uv && uv sync --frozen --no-dev`
   * **Start Command**: `uv run python run.py prod`
   * **Instance Type**: `Free`
5. Under **Environment Variables**, add the following:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `APP_ENV` | `production` | Enables production mode |
   | `DATABASE_URL` | `postgresql+asyncpg://postgres.dfudlwazmyfrddccogtg:Ramani2814%402814@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres` | Your Supabase pooler connection |
   | `CORS_ORIGINS` | `https://tokentrail.vercel.app,http://localhost:5173` | Your Vercel frontend domain (update after Vercel deploy) |
   | `INTERNAL_JOBS_TOKEN` | `tt_prod_internal_token_9f83a12b4e7c0d2a` | Secret token for scheduled maintenance |
   | `LOG_LEVEL` | `INFO` | Standard logging |
6. Click **Create Web Service**.
7. Once deployed, copy your Render service URL (e.g. `https://tokentrail-backend.onrender.com`).
   * Test it by visiting: `https://tokentrail-backend.onrender.com/healthz` (Should return `{"status": "ok"}`).

---

## 2. Frontend Deployment (Vercel)

1. Sign up / Log in to [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** ➔ **Project**.
3. Import your GitHub repository: `MeetRamani28/TokenTrail`.
4. Configure the Project settings:
   * **Project Name**: `tokentrail`
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click **Edit** and select `frontend`
   * **Build Command**: `npm run build` (Default)
   * **Output Directory**: `dist` (Default)
5. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://tokentrail-backend.onrender.com` (Your Render Backend URL from Step 1) |
6. Click **Deploy**.
7. Once deployed, copy your Vercel URL (e.g. `https://tokentrail.vercel.app`).
8. **Final Step**: Go back to Render Environment Variables and make sure `CORS_ORIGINS` matches your exact Vercel URL.

---

## 3. Keep-Alive Cron Setup (Free Tier Warmup)

Render's free tier spins down after 15 minutes of inactivity. To keep your API fast:

### Option A: Free External Ping (Recommended)
1. Sign up at [cron-job.org](https://cron-job.org/) (100% free).
2. Create a new cron job:
   * **Title**: `TokenTrail Keep-Alive`
   * **URL**: `https://tokentrail-backend.onrender.com/healthz`
   * **Schedule**: Every `10 minutes`

### Option B: Automated Maintenance Job
Schedule a POST request to `https://tokentrail-backend.onrender.com/internal/run-jobs` with Header:
`Authorization: Bearer tt_prod_internal_token_9f83a12b4e7c0d2a` once daily to prune expired traces and check alert rules.
