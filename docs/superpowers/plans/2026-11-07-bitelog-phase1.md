# Bitelog Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-protected chat food tracker — calorie ring + macro pie on top, chat below — where Claude logs food from plain text, data lives in Supabase, and frontend and backend deploy as two Vercel projects usable from a phone home screen.

**Architecture:** `backend/` is a set of Vercel Node serverless functions (`api/*.js`) that are thin wrappers around pure, dependency-injected modules in `lib/` (validation, totals, auth, chat flow), so all logic is unit-tested with fakes. `frontend/` is a static HTML/CSS/JS site that calls the backend's URL directly with a bearer token. Claude is forced to answer through a single tool (`log_food`) so its output is always structured JSON.

**Tech Stack:** Node 24 (ESM), `@anthropic-ai/sdk`, `@supabase/supabase-js`, `node:test`, Vercel CLI, Chart.js 4.4.1 (cdnjs), plain HTML/CSS/JS.

**Spec:** `docs/superpowers/specs/2026-11-07-bitelog-design.md`

## Global Constraints

- Node ESM everywhere (`"type": "module"` in both `package.json` files). No frameworks, no bundler.
- Secrets only in env vars, never committed: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, `TOKEN_SECRET`, `FRONTEND_ORIGIN`. Optional: `CLAUDE_MODEL` (default `claude-sonnet-5-5`).
- `.env`, `.env.local`, `.vercel/`, `node_modules/` are git-ignored.
- The "day" is always the client's local date as `YYYY-MM-DD`, sent by the frontend. The backend never derives the day from server time.
- Item numbers from Claude are totals for the whole line (qty already applied), not per-unit.
- Token: HMAC-SHA256 signed, 30-day expiry, sent as `Authorization: Bearer <token>`. No cookies.
- CORS allows only `FRONTEND_ORIGIN`.
- Before writing any Claude API code, load the `claude-api` skill for current SDK usage.
- Every task ends with `npm test` passing in the folder it touched.

## Review Focus

1. **Midnight boundary** — a message sent at 23:59 local is saved under that day even though the server's UTC date differs. *(test in Task 4)*
2. **Malformed Claude output** — numbers as strings, missing fields, absurd values: nothing is saved and the user gets a retry message. *(tests in Tasks 1, 4)*
3. **Expired or tampered token** — rejected with 401; frontend drops the token and shows the login screen. *(tests in Tasks 2, 3)*
4. **Goals of 0 / no entries yet** — charts render without NaN or divide-by-zero. *(tests in Task 6)*
5. **Send fails (network/server error)** — typed text stays in the input box and the Send button re-enables. *(manual check in Task 8)*

---

### Task 1: Repo scaffold + validation

**Files:**
- Create: `.gitignore`, `backend/package.json`, `backend/.env.example`, `backend/lib/validate.js`
- Test: `backend/test/validate.test.js`

**Interfaces:**
- Produces:
  - `validateItem(item: object) -> { ok: true, item } | { ok: false, error: string }`
  - `validateClaudeResult(raw: unknown) -> { items: Item[], reply: string, goals: Goals | null }` — throws `Error` on any invalid part.
  - `validateGoals(g: object) -> { ok: true, goals } | { ok: false, error }`
  - `isValidDay(s: string) -> boolean`
  - Types: `Item = { food: string, qty: number, kcal: number, protein: number, carbs: number, fat: number }`, `Goals = { kcal, protein, carbs, fat }` (numbers).

- [ ] **Step 1: Scaffold**

`git init` in `Bitelog/`. `.gitignore`: `node_modules/`, `.env`, `.env.local`, `.vercel/`. `backend/package.json`: `"type": "module"`, `"test": "node --test"`, deps `@anthropic-ai/sdk`, `@supabase/supabase-js`. `.env.example` lists every env var from Global Constraints with empty values. Run `npm install` in `backend/`.

- [ ] **Step 2: Write failing tests** in `backend/test/validate.test.js`

```js
const egg = { food: 'Egg, large', qty: 2, kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6 };
test('accepts a sane item', () => assert.deepEqual(validateItem(egg), { ok: true, item: egg }));
test('rejects string numbers', () => assert.equal(validateItem({ ...egg, kcal: '156' }).ok, false));
test('rejects negative', () => assert.equal(validateItem({ ...egg, fat: -1 }).ok, false));
test('rejects kcal > 5000', () => assert.equal(validateItem({ ...egg, kcal: 5001 }).ok, false));
test('rejects macros way over kcal', () =>
  assert.equal(validateItem({ ...egg, kcal: 10, protein: 50 }).ok, false)); // 4*50=200 > 10*1.5+50
test('rejects empty food name', () => assert.equal(validateItem({ ...egg, food: ' ' }).ok, false));
test('result: empty items is fine for questions', () =>
  assert.deepEqual(validateClaudeResult({ items: [], reply: 'You have 40g left.' }),
    { items: [], reply: 'You have 40g left.', goals: null }));
test('result: one bad item throws', () =>
  assert.throws(() => validateClaudeResult({ items: [egg, { ...egg, qty: 0 }], reply: 'x' })));
test('result: missing reply throws', () => assert.throws(() => validateClaudeResult({ items: [] })));
test('goals: accepts', () => assert.equal(validateGoals({ kcal: 2200, protein: 150, carbs: 220, fat: 70 }).ok, true));
test('goals: rejects kcal 300', () => assert.equal(validateGoals({ kcal: 300, protein: 1, carbs: 1, fat: 1 }).ok, false));
test('day format', () => { assert.equal(isValidDay('2026-11-07'), true); assert.equal(isValidDay('11/07/2026'), false); });
```

- [ ] **Step 3: Run** `npm test` in `backend/` → FAIL (module not found).

- [ ] **Step 4: Implement `backend/lib/validate.js`**

Limits: `food` trimmed, 1–100 chars; `qty` > 0 and ≤ 100; `kcal` 0–5000; each macro 0–500; reject if `4*protein + 4*carbs + 9*fat > kcal*1.5 + 50`; all numbers must be finite `typeof number`. Goals: `kcal` 500–10000, macros 0–1000. `reply` non-empty string. `goals` in a Claude result is optional; when present it must pass `validateGoals`. `isValidDay`: `/^\d{4}-\d{2}-\d{2}$/` and a real calendar date.

- [ ] **Step 5: Run** `npm test` → PASS.

- [ ] **Step 6: Commit** `git add -A && git commit -m "chore: scaffold backend; feat: claude output validation"`

---

### Task 2: Totals + token auth

**Files:**
- Create: `backend/lib/totals.js`, `backend/lib/auth.js`
- Test: `backend/test/totals.test.js`, `backend/test/auth.test.js`

**Interfaces:**
- Produces:
  - `sumTotals(entries: Item[]) -> { kcal: int, protein: number, carbs: number, fat: number }` — kcal rounded to integer, macros to 1 decimal.
  - `createToken(secret: string, nowMs: number) -> string`
  - `verifyToken(token: string, secret: string, nowMs: number) -> boolean`
  - `checkPassword(given: string, expected: string) -> boolean` (timing-safe)
  - `TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000`

- [ ] **Step 1: Write failing tests**

```js
// totals
test('empty day is zeros', () => assert.deepEqual(sumTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 }));
test('sums and rounds', () => assert.deepEqual(
  sumTotals([{ kcal: 156.4, protein: 12.6, carbs: 1.2, fat: 10.6 }, { kcal: 80, protein: 3, carbs: 15.05, fat: 1 }]),
  { kcal: 236, protein: 15.6, carbs: 16.3, fat: 11.6 }));
// auth
const now = Date.UTC(2026, 10, 7);
test('fresh token verifies', () => assert.equal(verifyToken(createToken('s', now), 's', now + 1000), true));
test('expired token fails', () => assert.equal(verifyToken(createToken('s', now), 's', now + TOKEN_TTL_MS + 1), false));
test('wrong secret fails', () => assert.equal(verifyToken(createToken('s', now), 'other', now), false));
test('tampered payload fails', () => {
  const [p, sig] = createToken('s', now).split('.');
  const forged = Buffer.from(JSON.stringify({ exp: now + 9e12 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`, 's', now), false);
});
test('garbage fails', () => assert.equal(verifyToken('nope', 's', now), false));
test('password', () => { assert.equal(checkPassword('abc', 'abc'), true); assert.equal(checkPassword('abd', 'abc'), false); assert.equal(checkPassword('', 'abc'), false); });
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Implement.** Token format: `base64url(JSON {exp}) + "." + base64url(HMAC-SHA256(secret, payloadPart))`. Use `node:crypto` `createHmac` and `timingSafeEqual` (hash both strings with SHA-256 first so lengths match). Never throw from `verifyToken`.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit** `feat: day totals and signed token auth`

---

### Task 3: HTTP route wrapper (CORS, auth, errors)

**Files:**
- Create: `backend/lib/http.js`
- Test: `backend/test/http.test.js`

**Interfaces:**
- Consumes: `verifyToken` (Task 2).
- Produces: `route({ methods: string[], auth: boolean, env?: object, now?: () => number }, handler: (req) => Promise<{ status?: number, body: object }>) -> (req, res) => Promise<void>`
  - `env` defaults to `process.env`; `now` to `Date.now`. Tests inject both.
  - Throwing `HttpError(status, message)` (also exported) maps to that status with `{ error: message }`; any other throw → 500 `{ error: 'Server error' }` (logged with `console.error`).

- [ ] **Step 1: Write failing tests** using a fake `res` (`{ statusCode, headers: {}, setHeader(k,v), status(c){...;return this}, json(b){...}, end(){...} }`) and `env = { FRONTEND_ORIGIN: 'https://bitelog.vercel.app', TOKEN_SECRET: 's' }`:

```js
test('OPTIONS preflight → 204 with CORS headers', ...);           // Access-Control-Allow-Origin === env.FRONTEND_ORIGIN, Allow-Headers includes Authorization
test('wrong method → 405', ...);
test('auth route without token → 401 {error}', ...);
test('auth route with expired token → 401', ...);
test('auth route with valid token → handler body, 200', ...);
test('HttpError(400,"bad") → 400 {error:"bad"}', ...);
test('unexpected throw → 500 {error:"Server error"}', ...);
test('every response carries Access-Control-Allow-Origin', ...);
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `route` and `HttpError`** in `backend/lib/http.js`. Vercel parses JSON bodies into `req.body`; treat a missing body as `{}`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: route wrapper with CORS, bearer auth, error mapping`

---

### Task 4: Claude client + chat flow

**Files:**
- Create: `backend/lib/claude.js`, `backend/lib/chat.js`
- Test: `backend/test/chat.test.js`

**Interfaces:**
- Consumes: `validateClaudeResult`, `isValidDay` (Task 1), `sumTotals` (Task 2), `HttpError` (Task 3).
- Produces:
  - `askClaude({ text, history, totals, goals }, { client, model }) -> Promise<unknown>` — returns the raw `input` of the `log_food` tool call. `history` = `[{ role: 'user'|'bot', text }]`.
  - `handleChat({ text, day }, { claude: (args) => Promise<unknown>, store }) -> Promise<{ reply: string, totals, goals }>`
  - Store contract (implemented in Task 5, faked here): `getGoals() -> Goals`, `setGoals(Goals)`, `getEntries(day) -> Item[]`, `addEntries(day, Item[])`, `getMessages(day) -> [{role,text}]`, `addMessages(day, [{role,text}])`.
  - `FAIL_REPLY = "Couldn't log that — try again."`

- [ ] **Step 1: Write failing tests** with an in-memory fake store and a fake `claude` function:

```js
test('logs items under the given day and returns new totals', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, claude: async () => ({ items: [egg], reply: 'Logged.' }) });
  assert.deepEqual(store.entries['2026-11-07'], [egg]);
  assert.equal(r.totals.kcal, 156);
  assert.deepEqual(store.messages['2026-11-07'].map(m => m.role), ['user', 'bot']);
});
test('day comes from the client, not server time', async () => { /* day '2026-11-06' → stored under '2026-11-06' */ });
test('question: empty items saves no entries but saves messages', ...);
test('invalid claude output: saves nothing, returns FAIL_REPLY', ...);   // store.entries and store.messages untouched
test('claude throws: saves nothing, returns FAIL_REPLY', ...);
test('goals in result are saved and returned', ...);
test('empty text → HttpError 400', ...);
test('text over 1000 chars → HttpError 400', ...);
test('bad day → HttpError 400', ...);
test('passes last 10 messages of the day as history', ...);
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `handleChat`** — order: validate input → load goals, entries, messages → call `claude` → `validateClaudeResult` → on any error return `{ reply: FAIL_REPLY, totals, goals }` with no writes → else `addEntries`, `setGoals` if present, `addMessages` → return fresh totals.

- [ ] **Step 4: Implement `askClaude`** (load `claude-api` skill first). `messages.create` with `model`, `max_tokens: 1024`, one tool `log_food` whose `input_schema` is `{ items: Item[], reply: string, goals?: Goals }`, and `tool_choice: { type: 'tool', name: 'log_food' }`. History maps `bot` → `assistant` turns as plain text. System prompt must say:
  - You are Bitelog, a friendly food-logging assistant. Always answer through `log_food`.
  - Estimate calories/macros for each food mentioned; numbers are totals for the stated quantity.
  - If portion is unclear, assume a typical serving and say what you assumed in `reply`.
  - If the user only asks a question, return `items: []`.
  - Only include `goals` when the user asks to change a goal; include all four values.
  - Keep `reply` to 1–2 short sentences and mention calories remaining.
  - Today's totals so far and goals: `<JSON>`.

  Not unit-tested (it is the network boundary); exercised in Task 8.

- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat: chat flow with Claude tool-call logging`

---

### Task 5: Supabase schema, store, API routes

**Files:**
- Create: `backend/supabase/schema.sql`, `backend/lib/store.js`, `backend/lib/deps.js`, `backend/api/login.js`, `backend/api/chat.js`, `backend/api/today.js`, `backend/api/goals.js`
- Test: `backend/test/login.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces (HTTP, all JSON, all with CORS):
  - `POST /api/login` `{ password }` → 200 `{ token }` | 401 `{ error: 'Wrong password' }` (no auth)
  - `POST /api/chat` `{ text, day }` → 200 `{ reply, totals, goals }`
  - `GET /api/today?day=YYYY-MM-DD` → 200 `{ totals, goals, messages: [{role,text}] }`
  - `GET /api/goals` → `{ goals }`; `PUT /api/goals` `Goals` → `{ goals }` (400 if `validateGoals` fails)
  - `createStore(supabase) -> Store` (contract from Task 4); `deps() -> { store, claude }` built from env.
  - `loginHandler(body, env, now) -> { body }` exported from `api/login.js` for testing.

- [ ] **Step 1: Write `schema.sql`**

```sql
create table goals (id int primary key default 1 check (id = 1),
  kcal int not null default 2200, protein real not null default 150,
  carbs real not null default 220, fat real not null default 70);
insert into goals (id) values (1);
create table entries (id bigint generated always as identity primary key,
  day date not null, food text not null, qty real not null,
  kcal real not null, protein real not null, carbs real not null, fat real not null,
  created_at timestamptz not null default now());
create index entries_day on entries(day);
create table messages (id bigint generated always as identity primary key,
  day date not null, role text not null check (role in ('user','bot')),
  text text not null, created_at timestamptz not null default now());
create index messages_day on messages(day);
alter table goals enable row level security;
alter table entries enable row level security;
alter table messages enable row level security;
```

- [ ] **Step 2: Write failing login tests**: correct password → token that `verifyToken` accepts; wrong → `HttpError` 401; missing `APP_PASSWORD` in env → 500 (never allow login with an empty configured password).
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** `store.js` (Supabase client from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false`; messages ordered by `created_at`), `deps.js`, and the four routes as `export default route({...}, handler)`. `today` and `chat` validate `day` with `isValidDay`.
- [ ] **Step 5: Run** `npm test` → PASS.
- [ ] **Step 6: Commit** `feat: supabase store and API routes`

---

### Task 6: Frontend

**Files:**
- Create: `frontend/package.json` (test script only), `frontend/index.html`, `frontend/style.css`, `frontend/config.js`, `frontend/lib/format.js`, `frontend/lib/api.js`, `frontend/app.js`
- Test: `frontend/test/format.test.js`

**Interfaces:**
- Consumes: backend HTTP API (Task 5).
- Produces:
  - `localDay(date: Date) -> 'YYYY-MM-DD'` (local time, not UTC)
  - `ringData(totals, goals) -> { eaten: int, left: int, over: boolean, pct: number }` — `pct` clamped 0–100; goal 0 → `pct 0`, `over` false if eaten 0
  - `macroSplit(totals) -> { grams: {protein,carbs,fat}, pct: {protein,carbs,fat}, empty: boolean }` — pct by grams, integers summing to 100 when not empty; all zeros + `empty: true` when no food
  - `api(path, { method, body }) -> Promise<object>` — adds bearer from `localStorage['bitelog.token']`, uses `BACKEND_URL` from `config.js`; on 401 removes token and dispatches `window` event `bitelog:logout`; on network error throws.

- [ ] **Step 1: Write failing tests** for `format.js`:

```js
test('localDay uses local date', () => assert.equal(localDay(new Date(2026, 10, 7, 23, 59)), '2026-11-07'));
test('ring under goal', () => assert.deepEqual(ringData({ kcal: 1340 }, { kcal: 2200 }), { eaten: 1340, left: 860, over: false, pct: 60.9 }));
test('ring over goal', () => { const r = ringData({ kcal: 2500 }, { kcal: 2200 }); assert.equal(r.over, true); assert.equal(r.pct, 100); assert.equal(r.left, 0); });
test('ring goal 0 no NaN', () => assert.equal(ringData({ kcal: 0 }, { kcal: 0 }).pct, 0));
test('split empty', () => assert.equal(macroSplit({ protein: 0, carbs: 0, fat: 0 }).empty, true));
test('split sums to 100', () => { const p = macroSplit({ protein: 10, carbs: 10, fat: 10 }).pct; assert.equal(p.protein + p.carbs + p.fat, 100); });
```

`pct` in `ringData` rounded to 1 decimal.

- [ ] **Step 2: Run** `npm test` in `frontend/` → FAIL.
- [ ] **Step 3: Implement `format.js`** → tests PASS.

- [ ] **Step 4: Build the UI** (`index.html`, `style.css`, `app.js`, `api.js`, `config.js`) per spec §4:
  - Load the `frontend-design` skill for visual direction; dark theme, mobile-first, 16px side gutter, chat fills remaining height, input pinned to bottom.
  - Chart.js `4.4.1` from `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js`. Calorie ring = doughnut (eaten / left; warning color when `over`); centre text "1,340 / 2,200" and "860 left". Macro pie labelled with grams and %; grey placeholder ring when `empty`.
  - Views: login (password field → `POST /api/login` → store token), main, goals panel (⚙ → four number inputs → `PUT /api/goals`).
  - On load and on `visibilitychange` to visible: `GET /api/today?day=localDay(new Date())` → render charts + messages (handles midnight rollover when app is reopened).
  - Send: disable button while pending, show "…" bubble, on success clear input and render; on failure keep text in input, show error bubble, re-enable.
  - `config.js`: `export const BACKEND_URL = 'http://localhost:3001';` (changed at deploy).
  - All user/Claude text inserted with `textContent`, never `innerHTML`.
- [ ] **Step 5: Commit** `feat: frontend charts, chat, login, goals`

---

### Task 7: PWA install support

**Files:**
- Create: `frontend/manifest.json`, `frontend/icons/icon.svg`, `frontend/icons/icon-192.png`, `frontend/icons/icon-512.png`, `frontend/icons/apple-touch-icon.png` (180px)
- Modify: `frontend/index.html` (head tags)

- [ ] **Step 1:** Draw `icon.svg` (simple bite-mark / plate mark on the app's dark background). Render the PNG sizes from it once (e.g. a throwaway `npx` run of an SVG→PNG converter); commit only the PNGs and SVG.
- [ ] **Step 2:** `manifest.json`: `name: "Bitelog"`, `short_name: "Bitelog"`, `start_url: "/"`, `display: "standalone"`, `background_color` and `theme_color` = app background, both PNG icons (`purpose: "any maskable"` on 512).
- [ ] **Step 3:** In `index.html` head: `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, viewport with `viewport-fit=cover`; pad body with `env(safe-area-inset-*)`.
- [ ] **Step 4: Verify** — open the page in Chrome DevTools → Application → Manifest shows no errors and the icons.
- [ ] **Step 5: Commit** `feat: PWA manifest and icons`

---

### Task 8: Supabase project + local end-to-end run

**Needs the user:** Anthropic API key, choosing a password, approval to create the Supabase project.

- [ ] **Step 1:** With the user's OK, create a Supabase project `bitelog` (Supabase MCP), apply `backend/supabase/schema.sql` as a migration, run `get_advisors` (security) and fix anything flagged.
- [ ] **Step 2:** User fills `backend/.env.local` with all env vars (`FRONTEND_ORIGIN=http://localhost:3000`, `TOKEN_SECRET` = 32 random bytes hex).
- [ ] **Step 3:** `vercel dev` needs the user to run `npx vercel login` once and link `backend/` to a Vercel project when prompted. Then run `npx vercel dev --listen 3001` in `backend/` and `npx serve -l 3000` in `frontend/` (both in background).
- [ ] **Step 4: Verify in the browser pane** — each must hold:
  - wrong password → error; right password → main view
  - "2 eggs and a slice of toast" → items logged, ring and pie update, reply mentions kcal left
  - "how much protein do I have left?" → answer, charts unchanged
  - "set my protein to 160g" → goals panel shows 160
  - reload → messages and charts persist
  - stop the backend, send a message → text stays in input, error bubble, Send re-enabled
  - mobile viewport (375px) → no horizontal scroll, charts readable
- [ ] **Step 5: Commit** any fixes found.

---

### Task 9: Deploy to Vercel

**Needs the user:** GitHub and Vercel accounts; approval before anything is pushed or published.

- [ ] **Step 1:** With the user's OK, create a private GitHub repo `bitelog` and push.
- [ ] **Step 2:** User imports the repo into Vercel **twice**: project `bitelog-api` (Root Directory `backend`) and project `bitelog` (Root Directory `frontend`, no build command, output `.`).
- [ ] **Step 3:** In `bitelog-api` → Settings → Environment Variables: all six secrets, with `FRONTEND_ORIGIN=https://bitelog.vercel.app` (the frontend's real URL). Redeploy.
- [ ] **Step 4:** Set `BACKEND_URL` in `frontend/config.js` to the `bitelog-api` URL, commit, push (auto-deploys).
- [ ] **Step 5: Verify** on the live frontend URL: repeat Task 8 Step 4's checks; then on a phone, "Add to Home Screen" → opens full-screen with the icon, login persists after closing and reopening.
- [ ] **Step 6:** Write `README.md` (what it is, env vars, local run commands, deploy notes). Commit and push.
