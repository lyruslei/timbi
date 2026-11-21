# timbi

A food tracker you talk to. Type or snap what you ate, and timbi works out the calories and macros, logs them, and updates your daily ring and macro chart.

[![timbi showcase](docs/showcase.gif)](https://lnkd.in/p/gcrZfvVQ)

**▶ [Watch the full video with sound](https://lnkd.in/p/gcrZfvVQ)**

> "2 eggs and a cup of rice, and a promatrix shake"

The eggs and rice get estimated. The shake matches a food you saved earlier, so it uses the exact numbers from its label instead of a guess, even though "promatrix" is misspelled.

A mobile-first web app you install to your phone's home screen.

## What it does

- **Logging by chat.** Claude estimates calories, protein, carbs and fat, plus fiber, sugar, saturated fat, sodium, cholesterol and potassium. If a portion is unclear, it assumes a typical serving and tells you.
- **Photos.** Snap a nutrition label and timbi reads the numbers exactly as printed, then offers to save the product to My foods. Snap a meal and it estimates. Photos are never stored.
- **My foods.** Saved products are matched by name even with typos, and amounts are scaled ("70g" of a 35g serving counts as 2 servings). If two saved foods could match, timbi asks which one instead of guessing.
- **Corrections, repeats and other days.** "It was 3 eggs", "remove the coke", "same breakfast as yesterday", "yesterday I had…" all work.
- **Goals, streak and a weekly summary.** Ask about your week to get your average calories and protein, your best and worst day against your goals, and your protein streak.

## Tech stack

| | |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript (ES modules), Chart.js, installable as a home-screen app |
| Backend | Node.js serverless functions on Vercel |
| AI | Claude (Haiku) via the Anthropic SDK, with structured JSON output and photo input |
| Database | Supabase (Postgres) |
| Tests | Node's built-in test runner, for the backend and the frontend |

No framework on either side.

## How it's built

```
frontend/              static app: chat, charts, My foods, settings
  lib/                 API client, offline cache, formatting, image shrinking (tested)
backend/
  api/                 one Vercel function per route: login, chat, today, entries, goals, my-foods, streak
  lib/
    claude.js          the only file that talks to Claude: system prompt + JSON schema
    turn.js            checks the AI's reply before anything is saved
    validate.js        number and range rules for every food
    myfoods.js         saved-food validation and typo-tolerant matching
    context.js         what the AI sees, and turning its pointers back into exact numbers
    http.js            route wrapper: CORS, login check, error handling
    auth.js            signed tokens, timing-safe password check
  supabase/schema.sql  tables, row-level security, atomic save functions
  test/                unit tests for every module
```

Some design decisions:

- **The AI points; the server does the math.** For saved foods, corrections and repeats, Claude only returns IDs and servings. The server looks up the real numbers. Any ID the AI wasn't shown in this request rejects the whole reply, so it can't invent or touch entries it shouldn't.
- **Check everything before saving.** Every number is range-checked, days outside today back to 60 days ago are refused, and each turn is saved in one database transaction.
- **Lock the database down.** Row-level security is on for every table, and only the backend's service-role key has access. The browser never sees the Claude key or the database key.
- **Login protects the bill.** Every route except login needs a signed token. The password must be at least 12 characters, because a guessed password would spend Claude credit.
- **Fast on a phone.** The app shows the last numbers it loaded right away, while fresh data loads in the background. Photos are shrunk on the phone before upload.

## Running it locally

1. Create a Supabase project and run `backend/supabase/schema.sql` in its SQL editor.
2. Copy `backend/.env.example` to `backend/.env.local` and fill it in. `APP_PASSWORD` must be at least 12 characters. `FRONTEND_ORIGIN` is the frontend's exact URL with no trailing slash.
3. Start both halves:

```bash
cd backend && npm install && npm run dev     # http://localhost:3001
```

```bash
cd frontend && npx serve -l 3000             # http://localhost:3000
```

## Tests

```bash
cd backend && npm test
cd frontend && npm test
```

## Deploy

Import this repo into Vercel twice: one project with Root Directory `backend`, one with Root Directory `frontend` (no build command). Set the backend's environment variables in Vercel, then point `frontend/config.js` at the backend URL.
