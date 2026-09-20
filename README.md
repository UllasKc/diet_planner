# Diet Planner App

A professional diet planning app for Indian clinical nutrition practice. Built for
generating personalised, calorie-scaled meal plans and for growing a reusable meal
database over time.

## Stack

- **Backend**: FastAPI (Python), JWT auth, Postgres via SQLAlchemy, NVIDIA NIM
  (OpenAI-compatible) for LLM-assisted nutrition lookups.
- **Frontend**: React + Vite.

## Project layout

```
backend/
  app/
    main.py            FastAPI app + router registration
    config.py           Settings loaded from .env
    security.py          Password hashing + JWT
    deps.py               Auth dependencies (current user / admin-only)
    schemas.py             Pydantic request/response models
    db.py                    SQLAlchemy engine/session
    db_models.py              ORM models (UserRecord, MealOptionRecord)
    services/
      nutrition.py           BMR/TDEE/macro calculations, meal scaling
      plan_builder.py         Reads/writes meal options via the database
      llm.py                    NVIDIA-powered nutrition lookups
      export.py                  DOCX / PDF plan export
    routers/
      auth.py, plans.py, admin.py
    data/
      seed_users.yaml        Starter accounts (bcrypt-hashed passwords)
      seed_food_database.yaml Starter meal options, loaded once on first run
      guidelines.py            Static nutrition guideline content
  scripts/
    seed_db.py            Creates tables + loads seed_*.yaml (idempotent — safe to re-run)
  requirements.txt
  run.py                     Dev server entrypoint
  Dockerfile

frontend/
  src/
    pages/               LoginPage, GeneratePlanPage, BuildPlanPage (admin)
    components/          Navbar, ProtectedRoute
    context/AuthContext.jsx
    api/client.js

render.yaml               Render Blueprint — deploys both services
```

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
python scripts/seed_db.py     # creates tables + loads starter data (run once)
python run.py
```

Runs on http://127.0.0.1:8000. Health check: `GET /api/health`.

With no `DATABASE_URL` set, it defaults to a local SQLite file at
`backend/app/data/local.db` — good enough for local dev, but swap in a real
Postgres URL for anything shared or deployed (see below).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173.

## Configuration

Copy `.env.example` to `.env` in the project root and fill in real values
(already done for local dev — `.env` is gitignored, never commit it):

- `JWT_SECRET_KEY` — random secret for signing login tokens.
- `DATABASE_URL` — Postgres connection string (e.g. from Supabase). Omit for
  local SQLite.
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` — NVIDIA NIM credentials, used by
  the admin "NVIDIA Lookup" button to estimate calories/macros for a food item.

## Default accounts

Two users (`admin` / role `admin`, `client` / role `viewer`) are seeded from
`backend/app/data/seed_users.yaml` on first run — only the bcrypt hashes are
in that file (and in this repo), never the plaintext passwords. The
plaintext passwords were shared with the repo owner out of band; if you've
lost them, generate new ones and replace the hashes in `seed_users.yaml`
(see the "Generate a password hash" snippet below), or update the row
directly in the database. Since this repo is public, **rotate both
passwords** once the app is live and reachable.

Only `admin` can access **Build Diet Plans**. Any logged-in user can access
**Generate Plan**.

### Generate a password hash

```bash
cd backend
.venv/Scripts/python.exe -c "import bcrypt; print(bcrypt.hashpw(b'your-new-password', bcrypt.gensalt()).decode())"
```

Paste the output into `password_hash` for that user in
`backend/app/data/seed_users.yaml` (for a fresh DB) — or, for an already-seeded
database, update that user's `password_hash` column directly, since the seed
script never overwrites an existing user.

## How it works

1. **Login** — JWT-based, role is `admin` or `viewer`.
2. **Generate Plan** — enter client details (age, weight, height, activity,
   goal, food preference), pick meal options per slot, and the backend
   computes BMR → TDEE → target calories (Mifflin-St Jeor + activity factor +
   goal adjustment), macros, and scales the chosen meals' ingredient
   quantities to hit the target. Export to DOCX or PDF.
3. **Build Diet Plans** (admin only) — add a new meal option to the food
   database. Type a food name and quantity, click **NVIDIA Lookup** to get an
   LLM-estimated calorie/macro breakdown (review and edit before saving),
   then save — it's immediately available in Generate Plan.

## Data persistence

Meal options and user accounts live in Postgres (via SQLAlchemy), not in
files on disk — this matters because most free container hosts wipe local
disk on every redeploy. `scripts/seed_db.py` only ever *creates* rows that
don't already exist; it never overwrites an existing user or meal option, so
anything your wife adds or edits through the app survives every redeploy.

## Deploying (Render, free tier)

This repo includes a [`render.yaml`](render.yaml) Blueprint that deploys two
free services: the FastAPI backend (as a Docker web service) and the React
frontend (as a static site). Render's free web-service tier spins down after
~15 minutes of inactivity and wakes on the next request (roughly a 30–50s
delay on that first request) — it's always reachable, just not instant after
being idle. No card is required for Render's free tier.

**You'll need to do the account/dashboard steps yourself** — signing up and
connecting services requires your own login, which isn't something that can
be done on your behalf.

1. **Create a free Postgres database** at [supabase.com](https://supabase.com)
   (no card required). Once the project is up, go to
   **Project Settings → Database → Connection string** and copy the URI
   (use the "Session pooler" connection string, port 6543, for compatibility
   with most hosts). Save it — you'll paste it into Render as `DATABASE_URL`.
2. **Push this repo to GitHub** (see below) if you haven't already.
3. On [render.com](https://render.com), sign up free with GitHub, then
   **New → Blueprint**, and point it at this repo. Render reads `render.yaml`
   and proposes two services: `diet-planner-backend` and
   `diet-planner-frontend`.
4. Before the first deploy, fill in the env vars Render marks as required:
   - On `diet-planner-backend`: `DATABASE_URL` (from step 1),
     `LLM_API_KEY` (your NVIDIA key), `FRONTEND_ORIGIN` (fill in after step 5,
     once you know the frontend's URL — you can redeploy to update it).
   - On `diet-planner-frontend`: `VITE_API_URL` (fill in after the backend's
     first deploy finishes, once you know its URL — Render shows it as
     `https://diet-planner-backend-XXXX.onrender.com`; redeploy the frontend
     after setting it, since Vite bakes env vars in at build time).
5. First deploy of the backend runs `scripts/seed_db.py` automatically (via
   the Docker `CMD`), which creates the tables and loads the starter users +
   meal options into your new Postgres database.
6. Once both services are live, open the frontend URL and log in with the
   credentials shared with you out of band — then **change both passwords**
   (see above), since this repo is public.

## Notes on the data store

Meal options and user accounts are stored in Postgres via SQLAlchemy
(`backend/app/db.py`, `backend/app/db_models.py`). The `backend/app/data/seed_*.yaml`
files are only ever read once, by `scripts/seed_db.py`, to populate a fresh
database — the running app never reads or writes them directly.
