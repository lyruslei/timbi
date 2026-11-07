# timbi (formerly Bitelog) — Design Spec

**Date:** 2026-11-07
**Status:** Draft, awaiting review

## 1. What it is

Bitelog is a personal food tracker you use by chatting. You type what you ate
("2 eggs and a slice of toast"), an AI (Claude Haiku 5.5) estimates the
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
| Name | timbi, all lowercase (renamed from Bitelog on 2026-11-08) |
| Platform | Web app first, phone-ready (PWA) from day one |
| AI | Claude API, Claude Haiku 5.5 (fast, ~$0.20–0.30/month); tried Gemini free tier on 2026-11-07, dropped as too slow when busy |
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

Each file has one job. Only `lib/claude.js` talks to the AI; only
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
  `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
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

## 12. Addendum (2026-11-08): nutrition screen and food edits

**Show more.** A "Show more ›" button at the top right of the charts card opens a
Nutrition screen for the selected day, with a Back button.

**Nutrition screen.**
- Macros (kcal, protein, carbs, fat) as bars toward the user's goals.
- Six more nutrients against FDA daily values, shown for context (not editable yet):
  fiber 28 g (reach), sugar 50 g (stay under), saturated fat 20 g (stay under),
  sodium 2,300 mg (stay under), cholesterol 300 mg (stay under), potassium 4,700 mg (reach).
- "What you ate": every food logged that day with its calories.

**Nutrient data.** The AI also estimates the six nutrients per food. They are
optional: a missing or out-of-range value is stored as unknown (null), never a
wrong 0, and never fails the meal. Foods logged before this change have none;
day totals add up the known values and the screen notes when some are missing.

**Editing foods.** Each food has a ⋯ menu: *Move to another day* (calendar, no
future days) and *Remove* (with confirmation). A select mode moves or removes
several at once. Chat history is not changed; only entries and totals are.
Backend: `PATCH /api/entries {ids, day}` and `DELETE /api/entries {ids}`,
at most 100 ids, positive integers only.

## 13. Addendum (2026-11-08): smarter chat, My foods, photos, streak

Decided with the user on 2026-11-08. Model stays Claude Haiku 5.5. Estimated
cost with everything: about $0.0004–0.0009 per message (photos at the top of
that range): roughly 0.9–1.3¢/day at 15 messages, 0.2–0.4¢/day at 4.

### 13.1 Corrections by chat
"actually it was 3 eggs", "remove the coke", "the rice was 200g". The AI sees
the viewed day's foods (with ids) and the previous day's, and returns edits
(remove, or replace a food's numbers) for those ids only. Edits outside the
sent list are refused. Edits, new foods, goal changes and the chat messages are
saved in one transaction.

### 13.2 Past days in plain words
"yesterday I had pancit" logs to yesterday. The AI returns a log day; the
backend accepts it only if it is not after the client's today and at most 60
days back. A named day outside that range fails the turn with "I can only log
food from today back to 60 days ago" (nothing is logged). Moving a food by chat
= copy it to the new day + remove the original, in one transaction (copies run
first). Chat messages stay on the day the
user was viewing; the reply says where the food went ("Logged to yesterday").

### 13.3 Repeat meals
"same breakfast as yesterday": the AI picks entry ids from the previous day's
foods (sent with the local time each was logged); the backend copies those rows
exactly, so the numbers are identical and not re-estimated.
"my usual breakfast": the user can say "save this as my usual breakfast" to
store the day's chosen foods as one My foods item; afterwards it is logged like
any saved food.

### 13.4 My foods
A `my_foods` table holds the user's saved foods: name, serving description, and
per-serving kcal, protein, carbs, fat and the six nutrients. When a message
mentions a saved food, the AI returns only which saved food and how many
servings; the backend multiplies the stored numbers, so the same food always
logs the same numbers. Only saved foods whose names match words in the message
are sent to the AI (at most 10). Two plausible matches → the AI asks which one.
No "(saved)" tag is shown. A My foods screen (from the ⚙ menu) lists saved foods
with edit (all numbers and the name) and delete.

### 13.5 Photos and nutrition labels
A 📷 button next to the message box takes or picks a photo, with optional text.
The phone shrinks it to at most 1,024 px on the long side (JPEG) before
sending; the backend accepts JPEG/PNG/WebP up to 1.5 MB. Photos are sent to the
AI once and never stored.
- Label photo: numbers are read exactly as printed (per serving) and the food
  is logged. timbi then asks "Save to My foods for next time?" with Save /
  Don't save buttons. Nothing is saved unless the user taps Save.
- Plate photo: an estimate, like a typed description.
- Unreadable photo: nothing is logged; the reply says so.

### 13.6 Weekly check-ins
"how did I do this week?" — when the message is about the week, the backend
adds the last 7 days' daily totals and goals to that one request; the reply
gives averages, best/worst days and protein streaks. Other messages do not
carry this data.

### 13.7 Streak
🔥 N to the right of the timbi wordmark: N = consecutive days with at least one
food, ending today, or yesterday if today has nothing yet. Hidden when 0.
Counted from the database (no AI cost); logging on a past day counts.
