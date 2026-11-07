# Bitelog

A personal food tracker you use by chatting. Type what you ate ("2 eggs and a slice of toast"), Claude estimates the calories and macros, and two charts at the top update: a calorie ring (eaten vs. goal) and a protein / carbs / fat pie.

- `frontend/` — static page (HTML/CSS/JS, Chart.js). Installable on a phone via Add to Home Screen.
- `backend/` — Vercel serverless functions: `api/login`, `api/chat`, `api/today`, `api/goals`. Logic lives in `lib/`, tests in `test/`.
- `docs/superpowers/` — the design spec and the Phase 1 build plan.

## Setup

1. **Database.** Create a Supabase project and run `backend/supabase/schema.sql` in its SQL editor.
2. **Backend env vars** (Vercel project settings, or `backend/.env.local` for local runs; see `backend/.env.example`):
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_PASSWORD` — at least 12 characters, or login is disabled
   - `TOKEN_SECRET` — long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `FRONTEND_ORIGIN` — the frontend's exact URL, no trailing slash
   - `CLAUDE_MODEL` — optional, defaults to `claude-opus-5-5`
3. **Frontend.** Set `BACKEND_URL` in `frontend/config.js` to the backend's URL.

## Run locally

```bash
cd backend && npm install && npx vercel dev --listen 3001
```

```bash
cd frontend && npx serve -l 3000
```

## Tests

```bash
cd backend && npm test
```

```bash
cd frontend && npm test
```

## Deploy

Import this repo into Vercel twice: one project with Root Directory `backend`, one with Root Directory `frontend` (no build command). Set the backend's env vars, then point `frontend/config.js` at the backend URL.
