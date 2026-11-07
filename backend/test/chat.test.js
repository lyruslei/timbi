import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleChat, FAIL_REPLY } from '../lib/chat.js';
import { HttpError } from '../lib/http.js';

const egg = { food: 'Egg, large', qty: 2, kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6 };
const DEFAULT_GOALS = { kcal: 2200, protein: 150, carbs: 220, fat: 70 };

function fakeStore() {
  return {
    goals: { ...DEFAULT_GOALS },
    entries: {},
    messages: {},
    async getGoals() { return { ...this.goals }; },
    async setGoals(g) { this.goals = { ...g }; },
    async getEntries(day) { return [...(this.entries[day] ?? [])]; },
    async addEntries(day, items) { this.entries[day] = [...(this.entries[day] ?? []), ...items]; },
    async getMessages(day) { return [...(this.messages[day] ?? [])]; },
    async addMessages(day, msgs) { this.messages[day] = [...(this.messages[day] ?? []), ...msgs]; },
  };
}
const claudeSays = (out) => async () => out;

test('logs items under the given day and returns new totals', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, claude: claudeSays({ items: [egg], reply: 'Logged.' }) });
  assert.deepEqual(store.entries['2026-11-07'], [egg]);
  assert.equal(r.totals.kcal, 156);
  assert.equal(r.reply, 'Logged.');
  assert.deepEqual(r.goals, DEFAULT_GOALS);
  assert.deepEqual(store.messages['2026-11-07'], [{ role: 'user', text: '2 eggs' }, { role: 'bot', text: 'Logged.' }]);
});

test('day comes from the client, not server time', async () => {
  const store = fakeStore();
  await handleChat({ text: 'late snack', day: '2026-11-06' },
    { store, claude: claudeSays({ items: [egg], reply: 'ok' }) });
  assert.deepEqual(Object.keys(store.entries), ['2026-11-06']);
});

test('totals include earlier entries of the same day', async () => {
  const store = fakeStore();
  store.entries['2026-11-07'] = [egg];
  const r = await handleChat({ text: 'another', day: '2026-11-07' },
    { store, claude: claudeSays({ items: [egg], reply: 'ok' }) });
  assert.equal(r.totals.kcal, 312);
});

test('question: empty items saves no entries but saves messages', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: 'protein left?', day: '2026-11-07' },
    { store, claude: claudeSays({ items: [], reply: '150g left.' }) });
  assert.equal(store.entries['2026-11-07'], undefined);
  assert.equal(store.messages['2026-11-07'].length, 2);
  assert.equal(r.reply, '150g left.');
});

test('invalid claude output: saves nothing, returns FAIL_REPLY', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, claude: claudeSays({ items: [{ ...egg, kcal: '156' }], reply: 'Logged.' }) });
  assert.equal(r.reply, FAIL_REPLY);
  assert.deepEqual(store.entries, {});
  assert.deepEqual(store.messages, {});
  assert.equal(r.totals.kcal, 0);
});

test('claude throws: saves nothing, returns FAIL_REPLY', async (t) => {
  t.mock.method(console, 'error', () => {});
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, claude: async () => { throw new Error('network'); } });
  assert.equal(r.reply, FAIL_REPLY);
  assert.deepEqual(store.entries, {});
  assert.deepEqual(store.messages, {});
});

test('goals in result are saved and returned', async () => {
  const store = fakeStore();
  const goals = { ...DEFAULT_GOALS, protein: 160 };
  const r = await handleChat({ text: 'set my protein to 160g', day: '2026-11-07' },
    { store, claude: claudeSays({ items: [], reply: 'Done.', goals }) });
  assert.deepEqual(store.goals, goals);
  assert.deepEqual(r.goals, goals);
});

const rejects400 = (p) => assert.rejects(p, (e) => e instanceof HttpError && e.status === 400);
const neverCalled = async () => { throw new Error('should not be called'); };

test('empty text → HttpError 400', () =>
  rejects400(handleChat({ text: '   ', day: '2026-11-07' }, { store: fakeStore(), claude: neverCalled })));
test('text over 1000 chars → HttpError 400', () =>
  rejects400(handleChat({ text: 'a'.repeat(1001), day: '2026-11-07' }, { store: fakeStore(), claude: neverCalled })));
test('bad day → HttpError 400', () =>
  rejects400(handleChat({ text: 'egg', day: 'today' }, { store: fakeStore(), claude: neverCalled })));

test('passes last 10 messages of the day as history, plus totals and goals', async () => {
  const store = fakeStore();
  store.messages['2026-11-07'] = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: `m${i}` }));
  store.entries['2026-11-07'] = [egg];
  let args;
  await handleChat({ text: 'hi', day: '2026-11-07' },
    { store, claude: async (a) => { args = a; return { items: [], reply: 'hey' }; } });
  assert.equal(args.text, 'hi');
  assert.equal(args.history.length, 10);
  assert.equal(args.history[0].text, 'm4');
  assert.equal(args.totals.kcal, 156);
  assert.deepEqual(args.goals, DEFAULT_GOALS);
});
