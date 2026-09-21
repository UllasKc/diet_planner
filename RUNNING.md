# Running Diet Planner locally

This guide is for running the app entirely on your own machine — no
Supabase, no Render, no cloud account needed. Useful if you've been handed
this codebase and just want it running locally to try it out or develop on.

The app falls back to a local SQLite file automatically when no
`DATABASE_URL` is set, so there's nothing extra to install or sign up for —
just Python and Node.

## Prerequisites

- Python 3.11+ (3.12 recommended)
- Node.js 18+ (20+ recommended)
- Git

## 1. Clone the repo

```bash
git clone https://github.com/UllasKc/diet_planner.git
cd diet_planner
```

## 2. Backend setup

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows (Git Bash / PowerShell)
.venv/Scripts/activate

# macOS / Linux
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Create your own local login

The `admin`/`client` accounts baked into this repo only have bcrypt
password **hashes** committed — nobody outside the original deploy knows
the plaintext passwords, by design (this repo is public). Set your own
before seeding:

```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'choose-a-password', bcrypt.gensalt()).decode())"
```

Copy the output and paste it over the `password_hash` value for `admin` in
`backend/app/data/seed_users.yaml` (do the same for `client` if you want a
second non-admin login). This only matters the *first* time you seed — see
below.

### Seed the database and run

```bash
python scripts/seed_db.py   # creates tables + loads starter data (run once)
python run.py
```

The backend is now running at **http://127.0.0.1:8000** (health check:
`GET /api/health`). With no `DATABASE_URL` env var set, this uses a local
SQLite file at `backend/app/data/local.db` — it's gitignored, so it's
yours alone and never gets committed or synced anywhere.

If you re-run `seed_db.py` later, it's safe — it only *creates* rows that
don't exist yet, so it never resets a password or meal option you've
already changed through the app.

### (Optional) NVIDIA nutrition lookups

The "🤖 NVIDIA Lookup" button on the Build Diet Plans page calls an LLM to
estimate calories/macros for a food item. It's entirely optional — without
a key, that one button just won't work; everything else (including
entering ingredient macros manually) works fine offline.

To enable it, create a `.env` file in the **project root** (next to this
file, not inside `backend/`):

```bash
cp .env.example .env
```

Then fill in:

```
LLM_API_KEY=your-nvidia-nim-api-key
```

(Get a free key at [build.nvidia.com](https://build.nvidia.com) if you
don't have one.) Restart `python run.py` after editing `.env`.

## 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend is now running at **http://localhost:5173** and talks to the
backend at `http://127.0.0.1:8000` by default (see `frontend/.env.example`
if you need to point it elsewhere).

## 4. Log in

Open http://localhost:5173 and log in with the username/password you set
in the "Create your own local login" step above (`admin` / whatever
password you chose).

## Switching to Postgres later

If you outgrow SQLite (e.g. running the backend from two machines that need
to share data), set `DATABASE_URL` in your `.env` to any Postgres
connection string — a local Postgres install, Docker container, or a free
Supabase project all work. The app code doesn't change; SQLAlchemy just
connects wherever `DATABASE_URL` points. Re-run `python scripts/seed_db.py`
once against the new database to create its tables and starter data.

## Troubleshooting

- **"LLM_API_KEY is not configured"** when clicking NVIDIA Lookup — expected
  if you skipped the optional `.env` step above; everything else still
  works.
- **Port already in use** — something else is already running on 8000 or
  5173; stop it, or change the port in `backend/run.py` / `frontend/vite.config.js`.
- **Login fails** — you likely still have the original committed password
  hash, which you don't know the plaintext for. Go back to "Create your own
  local login" above, and if you already ran `seed_db.py` once, either
  delete `backend/app/data/local.db` and re-seed, or update that user's row
  directly (seed script won't overwrite an existing user).
