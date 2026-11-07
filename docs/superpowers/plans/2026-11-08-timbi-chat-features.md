# timbi Chat Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrections, past-day logging, repeat meals, My foods memory, photo/label scanning, weekly check-ins and a 🔥 streak, on top of the existing timbi app.

**Architecture:** The AI's JSON reply grows from `{items, reply, goals}` to also carry `saved`, `edits`, `copies`, `log_day`, `label`. The AI only *identifies* (which saved food, which entry, which day); the backend owns every number it can: saved foods are multiplied from `my_foods`, copies duplicate DB rows, and all writes for one turn go through one SQL function. New pure modules (`streak.js`, `myfoods.js`, `context.js`) keep logic testable with fakes.

**Tech Stack:** unchanged — Node 24 ESM, `@anthropic-ai/sdk` (Claude Haiku 5.5, structured output), `@supabase/supabase-js`, `node:test`, plain HTML/CSS/JS, Chart.js 4.4.1.

**Spec:** `docs/superpowers/specs/2026-11-07-bitelog-design.md` §13 (and §12 for the Nutrition screen this builds on).

## Global Constraints

- Model `claude-haiku-5-5`, effort `low`, client timeout 15 s, `maxRetries: 1` (unchanged).
- Days are client-local `YYYY-MM-DD`. The client now sends both `day` (viewed) and `today`.
- `log_day` accepted only when `log_day <= today` and `log_day >= today − 60 days`; otherwise use `day`.
- Edits and copies may only reference entry ids that were sent to the AI in this request.
- Saved-food usage may only reference `my_foods` ids sent in this request; servings `> 0` and `<= 50`.
- At most 10 matching My foods sent per message. Weekly data only when the message is about the week.
- Images: `image/jpeg|png|webp`, base64 ≤ 1.5 MB, never stored. Client resizes to ≤ 1024 px long side, JPEG quality 0.8.
- Label saves happen only through the user tapping **Save** (`POST /api/my-foods`). The AI never writes `my_foods`.
- Streak hidden at 0. No "(saved)" tag in replies.
- All writes for one chat turn happen in one transaction (`log_turn_v2`).
- Load the `claude-api` skill before editing `lib/claude.js` (image blocks, schema).

## Review Focus

1. **AI references an id it wasn't given** (edit/copy/saved) — refused; nothing else in the turn is lost silently: the turn fails with the retry message. *(Task 4)*
2. **"tomorrow I'll have…" / far past dates** — never logged to the future or >60 days back; falls back to the viewed day. *(Task 4)*
3. **Two saved foods match** ("blitz" with vanilla and choco saved) — AI asks; nothing logged. *(Task 5, prompt + real check in Task 9)*
4. **Huge or wrong-type photo** — 400 with a clear message; client shrink keeps normal photos well under the limit. *(Task 6)*
5. **Streak across month/year boundaries and with today empty** — counts correctly. *(Task 2)*

---

### Task 1: Database — `my_foods` and `log_turn_v2`

**Files:** Modify `backend/supabase/schema.sql` (append section); apply as migration `chat_features`.

- [ ] **Step 1:** Append to `schema.sql`:
  - `create table my_foods (id bigint generated always as identity primary key, name text not null, serving text not null default '1 serving', kcal real not null, protein real not null, carbs real not null, fat real not null, fiber real, sugar real, sat_fat real, sodium real, cholesterol real, potassium real, created_at timestamptz not null default now(), updated_at timestamptz not null default now());` plus `create unique index my_foods_name on my_foods (lower(name));`, RLS on, `grant select, insert, update, delete on my_foods to service_role`.
  - `log_turn_v2(p_log_day date, p_msg_day date, p_items jsonb, p_copy_ids bigint[], p_remove_ids bigint[], p_updates jsonb, p_goals jsonb, p_messages jsonb) returns void` — in order: delete `p_remove_ids`; update each `{id, food, qty, kcal, protein, carbs, fat, fiber..potassium}` in `p_updates`; insert `p_items` on `p_log_day`; insert copies `select … from entries where id = any(p_copy_ids)` onto `p_log_day`; goals as in v1; messages on `p_msg_day`. Same `security invoker`, `search_path`, revoke from public/anon/authenticated, grant to service_role.
- [ ] **Step 2:** Apply via Supabase MCP `apply_migration`; run a rolled-back transaction as `service_role` exercising every branch; check anon has no privileges on `my_foods`; run security advisor (expect only the existing INFO).
- [ ] **Step 3: Commit** `feat(db): my_foods table and log_turn_v2`

### Task 2: Streak

**Files:** Create `backend/lib/streak.js`, `backend/api/streak.js`; Test `backend/test/streak.test.js`; Modify `backend/lib/store.js`.

**Interfaces — Produces:** `computeStreak(days: string[], today: string) -> number`; `store.getLoggedDays(fromDay: string, toDay: string) -> string[]` (distinct days with entries); `GET /api/streak?today=YYYY-MM-DD -> { streak }` (looks back at most 400 days).

- [ ] **Step 1: Failing tests**

```js
test('no days → 0', () => assert.equal(computeStreak([], '2026-11-08'), 0));
test('today only → 1', () => assert.equal(computeStreak(['2026-11-08'], '2026-11-08'), 1));
test('today empty, yesterday streak still counts', () =>
  assert.equal(computeStreak(['2026-11-06', '2026-11-07'], '2026-11-08'), 2));
test('gap breaks it', () => assert.equal(computeStreak(['2026-11-05', '2026-11-07', '2026-11-08'], '2026-11-08'), 2));
test('across month and year boundaries', () =>
  assert.equal(computeStreak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01'), 3));
test('duplicates and unsorted input are fine', () =>
  assert.equal(computeStreak(['2026-11-08', '2026-11-07', '2026-11-08'], '2026-11-08'), 2));
test('future days ignored', () => assert.equal(computeStreak(['2026-11-09'], '2026-11-08'), 0));
test('route: bad today → 400', ...);
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (reuse `addDays` logic; backend copy of the UTC-safe helper in `lib/days.js`). **Step 4:** Run → PASS. **Step 5: Commit** `feat: streak count`

### Task 3: My foods — validation, matching, CRUD

**Files:** Create `backend/lib/myfoods.js`, `backend/api/my-foods.js`; Test `backend/test/myfoods.test.js`; Modify `backend/lib/store.js`.

**Interfaces — Produces:**
- `validateMyFood(f) -> { ok, food } | { ok: false, error }` — name 1–60 chars trimmed, serving 1–40 chars (default `'1 serving'`), kcal/macros per `validateItem` rules, nutrients nullable per `NUTRIENT_LIMITS`.
- `matchMyFoods(text: string, foods: MyFood[], max = 10) -> MyFood[]` — lowercase word overlap: a food matches if any word (≥ 3 letters) of its name appears in the text, or the text contains its full name; ranked by matched-word count, then name length.
- Store: `listMyFoods()`, `getMyFoods(ids)`, `addMyFood(food) -> MyFood` (name clash → `HttpError(409)`), `updateMyFood(id, food)`, `removeMyFoods(ids)`.
- `GET /api/my-foods -> {foods}`, `POST {food} -> {food}`, `PUT {id, food} -> {food}`, `DELETE {ids} -> {removed}`.

- [ ] **Step 1: Failing tests** — validate (trim, bounds, nullable nutrients), match (`'2 blitz bars'` → Blitz bar; `'vanilla blitz'` ranks "Blitz bar vanilla" over "Blitz bar choco"; `'rice'` matches "Rice crackers" (the AI then decides whether you meant it, and estimates plain rice otherwise); `'an egg'` matches nothing because words under 3 letters are ignored; never more than 10 returned), handler tests with a fake store (create, 409 duplicate name, update, delete, bad ids 400).
- [ ] **Step 2–4:** RED → implement → GREEN. **Step 5: Commit** `feat: My foods storage and matching`

### Task 4: Turn validation v2

**Files:** Modify `backend/lib/validate.js`; Test `backend/test/validate.test.js`.

**Interfaces — Produces:** `validateTurn(raw, { allowedEntryIds: Set<number>, allowedFoodIds: Set<number>, day, today }) -> { items, saved:[{id, servings}], edits:[{id, remove:true}|{id, item}], copies:number[], logDay, label: Label|null, reply, goals, goalsRejected }` — throws on any bad part, like `validateClaudeResult` (which stays as a thin wrapper for old callers).
- `log_day` → `logDay`: valid and `today−60 ≤ log_day ≤ today`, else `day`.
- `label`: `{ name, serving, kcal, protein, carbs, fat, …nutrients }` validated with `validateMyFood`; invalid → `null` (the food can still log).

- [ ] **Step 1: Failing tests** — unknown edit id throws; unknown saved id throws; servings 0 or 51 throws; copy of unknown id throws; `log_day` tomorrow → `day`; 61 days back → `day`; yesterday → yesterday; invalid label → `null` without failing; existing item rules still apply.
- [ ] **Step 2–4:** RED → GREEN. **Step 5: Commit** `feat: validate corrections, copies, saved foods and log day`

### Task 5: Chat flow v2 and AI request

**Files:** Create `backend/lib/context.js`; Modify `backend/lib/chat.js`, `backend/lib/claude.js`; Test `backend/test/chat.test.js`, `backend/test/context.test.js`, `backend/test/claude.test.js`.

**Interfaces:**
- `isWeekQuestion(text) -> boolean` — `/\b(this|last|past)\s+week\b|\bweekly\b|\b7 days\b/i`.
- `handleChat({ text, day, today, image }, { ai, store })` returns `{ reply, totals, goals, failed, logDay, saveOffer }`.
  - Loads viewed-day and previous-day entries (id, food, qty, kcal, macros, local time), matching My foods (`matchMyFoods`), weekly totals only if `isWeekQuestion`.
  - Calls `ai({ text, image, history, totals, goals, entries: {viewed, previous}, myFoods, week })`.
  - `validateTurn` with ids from what was sent; expands `saved` → items `{ food: '<name>, <servings> × <serving>', qty: servings, …numbers × servings }`; calls `store.logTurnV2({ logDay, msgDay: day, items, copyIds, removeIds, updates, goals, messages })`.
  - `saveOffer = label` (frontend asks); `totals` are for the viewed `day`.
- `askClaude` v2: schema adds `saved`, `edits`, `copies`, `log_day` (string|null), `label` (object|null); system prompt adds rules for corrections, past days, repeats ("same as yesterday" → copies), saved foods (use `saved`, never re-estimate; ambiguous → ask, log nothing), labels (read exactly per serving; fill `label`; log the eaten amount), week summaries, and "save this as my usual X" → reply telling the user to use the Save button (offer is returned as `label` built from the chosen foods' sum). Image passed as a `{type:'image', source:{type:'base64', media_type, data}}` block before the text.

- [ ] **Step 1: Failing tests** — fake `ai`/`store`: saved food expanded with exact × servings; copy ids passed through; edit of viewed-day food; logDay yesterday → entries on yesterday, messages on viewed day; weekly data present only for a week question; ids not sent → `FAIL_REPLY`, nothing written; label → `saveOffer`; `askClaude` puts the image block first and includes entries/myFoods in the context text.
- [ ] **Step 2–4:** RED → GREEN (load `claude-api` skill first). **Step 5: Commit** `feat: chat v2 — corrections, past days, repeats, saved foods, labels, weekly`

### Task 6: Photo intake

**Files:** Create `frontend/lib/image.js`; Modify `backend/api/chat.js` (validate image), `backend/lib/chat.js`; Test `frontend/test/image.test.js`, `backend/test/chat.test.js`.

**Interfaces:** `fitSize(w, h, max = 1024) -> {w, h}` (pure, keeps aspect, never upscales); `shrinkImage(file) -> Promise<{ media_type: 'image/jpeg', data: base64 }>` (canvas, quality 0.8; browser-only); backend `checkImage(img) -> img | null` throws `HttpError(400, 'Photo must be JPEG, PNG or WebP under 1.5 MB')`.

- [ ] **Step 1: Failing tests** — `fitSize(4032, 3024)` → `{1024, 768}`; portrait; small image unchanged; backend rejects `image/gif`, rejects > 1.5 MB base64, accepts a tiny JPEG; message with only a photo (empty text) is allowed.
- [ ] **Step 2–4:** RED → GREEN. **Step 5: Commit** `feat: photo intake`

### Task 7: Frontend — save offer, log-day notice, streak, photo button

**Files:** Modify `frontend/index.html`, `frontend/style.css`, `frontend/app.js`.

- [ ] 📷 button left of the input (`<input type=file accept="image/*" capture="environment">` hidden); chosen photo shows as a small chip with ✕ above the input; Send posts `{text, day, today, image}`.
- [ ] Reply with `saveOffer` → bubble under the reply: "Save **{name}** ({serving}: {kcal} kcal, {protein}g protein) to My foods?" with **Save** / **Don't save**. Save → `POST /api/my-foods`; success → "Saved."; 409 → "You already have a food called {name}." Don't save → dismiss.
- [ ] `logDay !== day` → reply gets a line "Logged to {dayLabel}" and charts for the viewed day are refreshed.
- [ ] Streak: `<span id="streak" class="streak" hidden>🔥 <b>N</b></span>` after the wordmark; refresh on load, after chat, after move/remove; hidden at 0.
- [ ] Commit `feat: photo button, save offer, streak`

### Task 8: My foods screen

**Files:** Modify `frontend/index.html`, `frontend/style.css`, `frontend/app.js`.

- [ ] ⚙ opens a small sheet: **Daily goals** / **My foods**. My foods is a screen like Nutrition: list (name, serving, kcal), tap → edit form (name, serving, 4 macros, 6 nutrients) with **Save** and **Delete** (confirm). Empty state: "Scan a nutrition label to save a food here."
- [ ] Commit `feat: My foods screen`

### Task 9: Real-model checks and browser check

- [ ] Throwaway test days (2000-01-0x) via API with a signed test token (no secrets printed): correction ("it was 3 eggs" → updated, not duplicated); "remove the coke"; "yesterday I had…" lands on the previous test day, messages on the viewed day; "same breakfast as yesterday" copies identical numbers; saved food "2 test bars" = exactly 2×; two similar saved foods → AI asks; weekly question gets averages; label photo → render a synthetic nutrition label (SVG → PNG) → exact numbers read and `saveOffer` returned; unreadable photo → nothing logged. Measure latency and tokens. Clean up test rows and test My foods.
- [ ] Browser at phone size, using the pane's existing session and changing no real data: 📷 chip appears and clears, save-offer buttons render (tap only Don't save), streak shows, My foods screen opens and lists the test food before cleanup.
- [ ] Final review (fresh reviewer), fix Critical/Important with RED→GREEN, commit and push.
