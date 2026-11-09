import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleChat, FAIL_REPLY } from '../lib/chat.js';
import { HttpError } from '../lib/http.js';

const egg = { food: 'Egg, large', qty: 2, kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6 };
const NULLS = { fiber: null, sugar: null, sat_fat: null, sodium: null, cholesterol: null, potassium: null };
const DEFAULT_GOALS = { kcal: 2200, protein: 150, carbs: 220, fat: 70 };
const DAY = '2026-11-08';
const YDAY = '2026-11-07';
const blitz = { id: 7, name: 'Blitz bar vanilla', serving: '1 bar', kcal: 210, protein: 20, carbs: 6, fat: 7, ...NULLS };

// In-memory store with the same contract as lib/store.js.
function fakeStore() {
  let nextId = 100;
  return {
    goals: { ...DEFAULT_GOALS },
    entries: [],          // { id, day, created_at, ...item }
    messages: {},
    myFoods: [blitz],
    turns: 0,
    add(day, item) { const row = { id: nextId++, day, created_at: '2026-11-08T00:00:00Z', ...item }; this.entries.push(row); return row; },
    on(day) { return this.entries.filter((e) => e.day === day); },
    async getGoals() { return { ...this.goals }; },
    async getEntries(day) { return this.on(day).map((e) => ({ ...e })); },
    async getEntriesRange(from, to) { return this.entries.filter((e) => e.day >= from && e.day <= to); },
    async getMessages(day) { return [...(this.messages[day] ?? [])]; },
    async listMyFoods() { return this.myFoods; },
    async logTurnV2({ logDay, msgDay, items, copyIds, removeIds, updates, goals, messages }) {
      this.turns += 1;
      // Same order as log_turn_v2: copies, then removes, updates, new items.
      const sources = copyIds.map((id) => this.entries.find((e) => e.id === id)).filter(Boolean).map(({ id: _, day: __, ...rest }) => rest);
      for (const rest of sources) this.add(logDay, rest);
      this.entries = this.entries.filter((e) => !removeIds.includes(e.id));
      for (const u of updates) Object.assign(this.entries.find((e) => e.id === u.id), u);
      for (const it of items) this.add(logDay, it);
      if (goals) this.goals = { ...goals };
      this.messages[msgDay] = [...(this.messages[msgDay] ?? []), ...messages];
    },
  };
}
const aiSays = (out) => async () => ({ items: [], reply: 'ok', goals: null, ...out });
const chat = (body, store, ai) => handleChat({ day: DAY, today: DAY, ...body }, { store, ai });

test('logs items under the viewed day and returns new totals', async () => {
  const store = fakeStore();
  const r = await chat({ text: '2 eggs' }, store, aiSays({ items: [egg], reply: 'Logged.' }));
  assert.deepEqual(store.on(DAY).map(({ id, day, created_at, ...i }) => i), [{ ...egg, ...NULLS }]);
  assert.equal(r.totals.kcal, 156);
  assert.equal(r.reply, 'Logged. (2,044 kcal left)');
  assert.equal(r.failed, false);
  assert.equal(r.logDay, DAY);
  assert.deepEqual(store.messages[DAY], [{ role: 'user', text: '2 eggs' }, { role: 'bot', text: 'Logged. (2,044 kcal left)' }]);
});

test('day comes from the client, not server time', async () => {
  const store = fakeStore();
  await chat({ text: 'late snack', day: '2026-11-06', today: DAY }, store, aiSays({ items: [egg] }));
  assert.deepEqual([...new Set(store.entries.map((e) => e.day))], ['2026-11-06']);
});

test('question: nothing logged, messages saved', async () => {
  const store = fakeStore();
  const r = await chat({ text: 'protein left?' }, store, aiSays({ reply: '150g left.' }));
  assert.equal(store.entries.length, 0);
  assert.equal(store.messages[DAY].length, 2);
  assert.equal(r.reply, '150g left.');
});

test('invalid AI output: saves nothing, returns FAIL_REPLY', async (t) => {
  t.mock.method(console, 'error', () => {});
  const store = fakeStore();
  const r = await chat({ text: '2 eggs' }, store, aiSays({ items: [{ ...egg, kcal: '156' }] }));
  assert.equal(r.reply, FAIL_REPLY);
  assert.equal(r.failed, true);
  assert.equal(store.turns, 0);
});

test('AI call throws: saves nothing, returns FAIL_REPLY', async (t) => {
  t.mock.method(console, 'error', () => {});
  const store = fakeStore();
  const r = await chat({ text: '2 eggs' }, store, async () => { throw new Error('network'); });
  assert.equal(r.failed, true);
  assert.equal(store.turns, 0);
});

test('goals in result are saved and returned', async () => {
  const store = fakeStore();
  const goals = { ...DEFAULT_GOALS, protein: 160 };
  const r = await chat({ text: 'set my protein to 160g' }, store, aiSays({ goals }));
  assert.deepEqual(store.goals, goals);
  assert.deepEqual(r.goals, goals);
});

test('out-of-range goals are dropped; food still logs and the reply says why', async () => {
  const store = fakeStore();
  const r = await chat({ text: 'egg, set calories to 400' }, store, aiSays({ items: [egg], reply: 'Logged.', goals: { ...DEFAULT_GOALS, kcal: 400 } }));
  assert.deepEqual(store.goals, DEFAULT_GOALS);
  assert.equal(store.on(DAY).length, 1);
  assert.match(r.reply, /^Logged\. .*goal/);
});

const rejects400 = (p) => assert.rejects(p, (e) => e instanceof HttpError && e.status === 400);
const neverCalled = async () => { throw new Error('should not be called'); };
test('empty text without a photo → 400', () => rejects400(chat({ text: '   ' }, fakeStore(), neverCalled)));
test('text over 1000 chars → 400', () => rejects400(chat({ text: 'a'.repeat(1001) }, fakeStore(), neverCalled)));
test('bad day or today → 400', async () => {
  await rejects400(chat({ text: 'egg', day: 'today' }, fakeStore(), neverCalled));
  await rejects400(chat({ text: 'egg', today: 'nope' }, fakeStore(), neverCalled));
});
test('viewed day after today → 400', () => rejects400(chat({ text: 'egg', day: '2026-11-09' }, fakeStore(), neverCalled)));

test('sends history, totals, goals, both days of foods and all saved foods when there are few', async () => {
  const store = fakeStore();
  store.messages[DAY] = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: `m${i}` }));
  const a = store.add(DAY, { ...egg, ...NULLS });
  const b = store.add(YDAY, { food: 'Toast', qty: 1, kcal: 80, protein: 3, carbs: 15, fat: 1, ...NULLS });
  let args;
  await chat({ text: 'a blitz bar' }, store, async (x) => { args = x; return { items: [], reply: 'hi', goals: null }; });
  assert.equal(args.history.length, 10);
  assert.equal(args.totals.kcal, 156);
  assert.deepEqual(args.entries.viewed.map((e) => e.id), [a.id]);
  assert.deepEqual(args.entries.previous.map((e) => e.id), [b.id]);
  assert.deepEqual(args.myFoods.map((f) => f.id), [7]);
  assert.equal(args.week, null);
});

test('weekly data only for week questions', async () => {
  const store = fakeStore();
  let args;
  const spy = async (x) => { args = x; return { items: [], reply: 'ok', goals: null }; };
  await chat({ text: 'how did I do this week?' }, store, spy);
  assert.equal(args.week.length, 7);
  await chat({ text: '2 eggs' }, store, spy);
  assert.equal(args.week, null);
});

test('saved food logs exact numbers × servings', async () => {
  const store = fakeStore();
  const r = await chat({ text: '2 blitz bars' }, store, aiSays({ saved: [{ id: 7, servings: 2 }] }));
  const [row] = store.on(DAY);
  assert.equal(row.kcal, 420);
  assert.equal(row.food, 'Blitz bar vanilla, 2 × 1 bar');
  assert.equal(r.totals.kcal, 420);
});

test('saved food not offered to the AI → refused, nothing written', async (t) => {
  t.mock.method(console, 'error', () => {});
  const store = fakeStore();
  const r = await chat({ text: '2 eggs' }, store, aiSays({ saved: [{ id: 999, servings: 1 }] })); // not a saved food
  assert.equal(r.failed, true);
  assert.equal(store.turns, 0);
});

test('correction updates the right food; removal deletes it', async () => {
  const store = fakeStore();
  const eggs = store.add(DAY, { ...egg, ...NULLS });
  const coke = store.add(DAY, { food: 'Coke', qty: 1, kcal: 140, protein: 0, carbs: 39, fat: 0, ...NULLS });
  const r = await chat({ text: 'it was 3 eggs, and remove the coke' }, store, aiSays({
    edits: [{ id: eggs.id, remove: false, item: { ...egg, qty: 3, kcal: 234, protein: 18.9, carbs: 1.8, fat: 15.9 } }, { id: coke.id, remove: true }],
  }));
  assert.deepEqual(store.on(DAY).map((e) => [e.food, e.qty, e.kcal]), [['Egg, large', 3, 234]]);
  assert.equal(r.totals.kcal, 234);
});

test('"yesterday I had…" logs to yesterday; chat stays on the viewed day', async () => {
  const store = fakeStore();
  const r = await chat({ text: 'yesterday I had 2 eggs' }, store, aiSays({ items: [egg], log_day: YDAY }));
  assert.equal(store.on(YDAY).length, 1);
  assert.equal(store.on(DAY).length, 0);
  assert.equal(store.messages[DAY].length, 2);
  assert.equal(r.logDay, YDAY);
  assert.equal(r.totals.kcal, 0); // totals are for the viewed day
});

test('"same breakfast as yesterday" copies exact rows', async () => {
  const store = fakeStore();
  const toast = store.add(YDAY, { food: 'Toast', qty: 1, kcal: 80, protein: 3, carbs: 15, fat: 1, ...NULLS });
  await chat({ text: 'same breakfast as yesterday' }, store, aiSays({ copies: [toast.id] }));
  assert.deepEqual(store.on(DAY).map((e) => [e.food, e.kcal]), [['Toast', 80]]);
});

test('label photo: food logged and a save offer returned (not saved)', async () => {
  const store = fakeStore();
  const label = { name: 'Choco bar', serving: '1 bar', kcal: 200, protein: 20, carbs: 10, fat: 6 };
  const r = await chat({ text: 'this is choco bar', image: { media_type: 'image/jpeg', data: 'AAAA' } }, store,
    aiSays({ items: [{ food: 'Choco bar, 1 bar', qty: 1, kcal: 200, protein: 20, carbs: 10, fat: 6 }], label }));
  assert.equal(r.saveOffer.name, 'Choco bar');
  assert.equal(store.myFoods.length, 1); // only the original blitz bar
  assert.equal(store.on(DAY).length, 1);
  assert.equal(store.messages[DAY][0].text, 'this is choco bar 📷');
});

test('photo with no text is allowed and passed to the AI', async () => {
  const store = fakeStore();
  let args;
  await chat({ text: '', image: { media_type: 'image/png', data: 'AAAA' } }, store, async (x) => { args = x; return { items: [], reply: 'ok', goals: null }; });
  assert.equal(args.image.media_type, 'image/png');
  assert.equal(store.messages[DAY][0].text, '📷');
});

test('calories left are added from the database, not the AI', async () => {
  const store = fakeStore();
  const r = await chat({ text: '2 eggs' }, store, aiSays({ items: [egg], reply: 'Logged 2 eggs.' }));
  assert.equal(r.reply, 'Logged 2 eggs. (2,044 kcal left)');
});
test('over the goal says how much over', async () => {
  const store = fakeStore();
  store.goals.kcal = 100;
  const r = await chat({ text: '2 eggs' }, store, aiSays({ items: [egg], reply: 'Logged.' }));
  assert.equal(r.reply, 'Logged. (56 kcal over)');
});
test('no calories note for questions or food logged to another day', async () => {
  const store = fakeStore();
  assert.equal((await chat({ text: 'hi' }, store, aiSays({ reply: 'Hello!' }))).reply, 'Hello!');
  assert.equal((await chat({ text: 'yesterday 2 eggs' }, store, aiSays({ items: [egg], log_day: YDAY, reply: 'Logged to yesterday.' }))).reply, 'Logged to yesterday.');
});

test('photo the AI service rejects → says the photo could not be read; nothing saved', async (t) => {
  t.mock.method(console, 'error', () => {});
  const store = fakeStore();
  const r = await chat({ text: '', image: { media_type: 'image/png', data: 'AAAA' } }, store,
    async () => { throw Object.assign(new Error('Could not process image'), { status: 400 }); });
  assert.equal(r.failed, true);
  assert.match(r.reply, /couldn't read that photo/i);
  assert.equal(store.turns, 0);
});

// ---- review fixes ----
test('move by chat (copy + remove the same food) keeps the food', async () => {
  const store = fakeStore();
  const pancakes = store.add(YDAY, { food: 'Pancakes', qty: 1, kcal: 350, protein: 8, carbs: 50, fat: 12, ...NULLS });
  const r = await chat({ text: 'the pancakes were today, not yesterday' }, store,
    aiSays({ copies: [pancakes.id], edits: [{ id: pancakes.id, remove: true }], reply: 'Moved the pancakes to today.' }));
  assert.deepEqual(store.on(DAY).map((e) => [e.food, e.kcal]), [['Pancakes', 350]]);
  assert.equal(store.on(YDAY).length, 0);
  assert.equal(r.reply, 'Moved the pancakes to today. (1,850 kcal left)');
});

test('a date the AI names but we refuse → turn fails with a clear reply, nothing written', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const log_day of ['2026-08-01', '2026-11-09', 'last tuesday']) {
    const store = fakeStore();
    const r = await chat({ text: 'on aug 1 I had lechon' }, store, aiSays({ items: [egg], log_day }));
    assert.equal(r.failed, true, log_day);
    assert.match(r.reply, /60 days/);
    assert.equal(store.turns, 0);
  }
});

test('editing only yesterday\'s food adds no calories note for today', async () => {
  const store = fakeStore();
  const rice = store.add(YDAY, { food: 'Rice', qty: 1, kcal: 200, protein: 4, carbs: 44, fat: 0.4, ...NULLS });
  const r = await chat({ text: "yesterday's rice was 300g" }, store,
    aiSays({ edits: [{ id: rice.id, remove: false, item: { food: 'Rice, 300g', qty: 1, kcal: 390, protein: 8, carbs: 86, fat: 0.8 } }], reply: 'Updated yesterday\'s rice.' }));
  assert.equal(r.reply, "Updated yesterday's rice.");
});

test('with many saved foods, sends only the ones whose name matches', async () => {
  const store = fakeStore();
  store.myFoods = [...store.myFoods, ...Array.from({ length: 30 }, (_, i) => ({ ...store.myFoods[0], id: 100 + i, name: `Food ${i}` }))];
  let args;
  await chat({ text: 'a blitz bar' }, store, async (x) => { args = x; return { items: [], reply: 'hi', goals: null }; });
  assert.deepEqual(args.myFoods.map((f) => f.id), [7]);
});
