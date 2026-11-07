# Bitelog — Design Spec

**Date:** 2026-11-07
**Status:** Draft, awaiting review

## 1. What it is

Bitelog is a personal food tracker you use by chatting. You type what you ate
("2 eggs and a slice of toast"), an AI (Google Gemini, free tier) estimates the
calories and macros, logs them, and two charts at the top of the screen update.

**For:** one person (the owner). Not a multi-user product.

**Success looks like:**
- Logging a meal takes one chat message.
- At a glance you see calories eaten vs. goal, and your protein/carbs/fat split.
- It works on your PC browser and as a home-screen app on your phone.
- Nobody else can use it (and spend your Claude credit).

## 2. Decisions made

| Topic | Decision |
|---|---|
| Name | Bitelog |
| Platform | Web app first, phone-ready (PWA) from day one |
| AI | Google Gemini API, free tier (switched from Claude 2026-11-07 to avoid API cost) |
| Goals | Typed in manually (settings panel or via chat) |
| Calorie chart | Ring: eaten vs. goal |
| Macro chart | Pie: split of protein / carbs / fat eaten (grams + %) |
| Stack | Node.js, plain HTML/CSS/JS, Chart.js |
| Hosting | Vercel, two separate projects (frontend, backend) |
| Database | Supabase (Postgres) |
| Auth | Single password → bearer token (no cookies) |
| Domain | `.vercel.app` for now; custom domain optional later |

## 3. Folder structure

```
Bitelog/
  frontend/                ← Vercel project #1 (static site)
    index.html
    app.js                 ← chat, charts, login, API calls
    style.css
    config.js              ← BACKEND_URL
    manifest.json          ← PWA: name, icon, standalone display
    icons/                 ← app icons (192px, 512px)
  backend/                 ← Vercel project #2 (serverless functions)
    api/
      login.js             ← POST /api/login
      chat.js              ← POST /api/chat
      today.js             ← GET  /api/today?day=YYYY-MM-DD
      goals.js             ← GET/PUT /api/goals
    lib/
      claude.js            ← calls Claude, returns validated items + reply
      store.js             ← Supabase reads/writes
      auth.js              ← token create/verify, CORS headers
      validate.js          ← checks numbers from Claude are sane
    test/                  ← node:test unit tests (fake Claude, no cost)
    package.json
    .env.example           ← lists required env vars (no real values)
  docs/
```

Each file has one job. Only `lib/gemini.js` talks to the AI; only
`lib/store.js` talks to Supabase.

## 4. Screen layout

```
┌───────────────────────────────────────┐
│  Bitelog                 Sat, Nov 7  ⚙ │
│   ( 1,340 / 2,200 )    ( P | C | F )  │
│     kcal ring           macro pie     │
│   860 left            P 30% C 50% F 20%│
├───────────────────────────────────────┤
│  chat history (scrolls)               │
│  [ type what you ate...      ] [Send] │
└───────────────────────────────────────┘
```

- Dark theme, works on narrow phone screens.
- Calorie ring turns a warning color when over goal.
- ⚙ opens a panel to edit goals (kcal, protein, carbs, fat).
- First visit shows a password screen instead.

## 5. Message flow

1. User sends text → frontend `POST {BACKEND_URL}/api/chat` with
   `{ text, day }` and `Authorization: Bearer <token>`.
   `day` is the device's local date (YYYY-MM-DD).
2. Backend verifies token, loads today's totals + goals.
3. `claude.js` sends Claude the message plus totals/goals and asks for this JSON:
   ```json
   { "items": [ {"food":"Egg, large","qty":2,"kcal":156,"protein":12.6,"carbs":1.2,"fat":10.6} ],
     "reply": "Logged 2 eggs — 156 kcal. 2,044 left today." }
   ```
4. `validate.js` checks every item. Invalid response → nothing saved, error reply.
5. Valid items are saved to `entries`; user message + reply saved to `messages`.
6. Response `{ reply, totals, goals }` → frontend appends reply, redraws charts.

- Questions ("how much protein left?") → `items` is empty, nothing logged.
- Unclear portions → Claude uses a typical serving and says what it assumed.
- "Set my protein to 160g" → Claude returns a `goals` field; backend updates goals.

## 6. Data (Supabase)

- `goals` — single row: `kcal, protein, carbs, fat`.
- `entries` — `id, day (date), food, qty, kcal, protein, carbs, fat, created_at`.
- `messages` — `id, day, role ('user'|'bot'), text, created_at`.

**Daily reset:** nothing is deleted. Charts sum entries where `day` = today's
local date, so they start at zero after midnight. Old days stay for history.

## 7. Security

- **Login:** `POST /api/login` with the password. Backend compares to
  `APP_PASSWORD`; on match returns a signed token (HMAC with `TOKEN_SECRET`,
  30-day expiry). Frontend stores it in `localStorage` and sends it as a
  bearer header. No cookies, so cross-site cookie blocking doesn't apply.
- Every endpoint except login rejects requests without a valid token (401 →
  frontend shows login screen).
- **CORS:** backend only allows the frontend's origin (`FRONTEND_ORIGIN`).
- Supabase is accessed only from the backend with the service-role key.
  Row-level security is enabled with no public policies.
- Secrets live in Vercel environment variables, never in the repo:
  `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `APP_PASSWORD`, `TOKEN_SECRET`, `FRONTEND_ORIGIN`.

## 8. Error handling

- Claude unreachable / malformed JSON → chat shows "Couldn't log that, try
  again"; nothing saved.
- Validation rejects negative numbers, non-numbers, and absurd values
  (e.g. >5,000 kcal for one item, macros whose calories wildly exceed kcal).
- Network failure on frontend → message stays in input box so it can be resent.

## 9. Testing

- Unit tests with Node's built-in `node:test`, using a fake Claude:
  validation, day totals, token create/verify, chat flow with empty/invalid
  responses.
- Manual check locally (`vercel dev` in each folder), then on the live links
  from a phone, including "Add to Home Screen".

## 10. Phases

1. **Core + deploy** — everything above, live on Vercel, usable on phone.
2. **Corrections** — "actually it was 3 eggs" / "remove the toast"; tap to see
   today's food list.
3. **History** — past days, weekly averages.
4. **Extras** — photo logging, saved meals ("my usual breakfast"), custom domain.

## 11. Out of scope (Phase 1)

Multiple users, sign-up, barcode scanning, app-store apps, offline logging.
