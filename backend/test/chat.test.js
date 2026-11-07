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
    turns: 0,
    async getEntries(day) { return [...(this.entries[day] ?? [])]; },
    async getMessages(day) { return [...(this.messages[day] ?? [])]; },
    // One atomic write per chat turn (a single Postgres function in the real store).
    async logTurn(day, { items, goals, messages }) {
      this.turns += 1;
      if (items.length) this.entries[day] = [...(this.entries[day] ?? []), ...items];
      if (goals) this.goals = { ...goals };
      this.messages[day] = [...(this.messages[day] ?? []), ...messages];
    },
  };
}
const aiSays = (out) => async () => out;

test('logs items under the given day and returns new totals', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, ai: aiSays({ items: [egg], reply: 'Logged.' }) });
  assert.deepEqual(store.entries['2026-11-07'], [{ ...egg, ...{ fiber: null, sugar: null, sat_fat: null, sodium: null, cholesterol: null, potassium: null } }]);
  assert.equal(r.totals.kcal, 156);
  assert.equal(r.reply, 'Logged.');
  assert.deepEqual(r.goals, DEFAULT_GOALS);
  assert.deepEqual(store.messages['2026-11-07'], [{ role: 'user', text: '2 eggs' }, { role: 'bot', text: 'Logged.' }]);
});

test('day comes from the client, not server time', async () => {
  const store = fakeStore();
  await handleChat({ text: 'late snack', day: '2026-11-06' },
    { store, ai: aiSays({ items: [egg], reply: 'ok' }) });
  assert.deepEqual(Object.keys(store.entries), ['2026-11-06']);
});

test('totals include earlier entries of the same day', async () => {
  const store = fakeStore();
  store.entries['2026-11-07'] = [egg];
  const r = await handleChat({ text: 'another', day: '2026-11-07' },
    { store, ai: aiSays({ items: [egg], reply: 'ok' }) });
  assert.equal(r.totals.kcal, 312);
});

test('question: empty items saves no entries but saves messages', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: 'protein left?', day: '2026-11-07' },
    { store, ai: aiSays({ items: [], reply: '150g left.' }) });
  assert.equal(store.entries['2026-11-07'], undefined);
  assert.equal(store.messages['2026-11-07'].length, 2);
  assert.equal(r.reply, '150g left.');
});

test('invalid AI output: saves nothing, returns FAIL_REPLY', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, ai: aiSays({ items: [{ ...egg, kcal: '156' }], reply: 'Logged.' }) });
  assert.equal(r.reply, FAIL_REPLY);
  assert.deepEqual(store.entries, {});
  assert.deepEqual(store.messages, {});
  assert.equal(r.totals.kcal, 0);
});

test('AI call throws: saves nothing, returns FAIL_REPLY', async (t) => {
  t.mock.method(console, 'error', () => {});
  const store = fakeStore();
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store, ai: async () => { throw new Error('network'); } });
  assert.equal(r.reply, FAIL_REPLY);
  assert.deepEqual(store.entries, {});
  assert.deepEqual(store.messages, {});
});

test('goals in result are saved and returned', async () => {
  const store = fakeStore();
  const goals = { ...DEFAULT_GOALS, protein: 160 };
  const r = await handleChat({ text: 'set my protein to 160g', day: '2026-11-07' },
    { store, ai: aiSays({ items: [], reply: 'Done.', goals }) });
  assert.deepEqual(store.goals, goals);
  assert.deepEqual(r.goals, goals);
});

const rejects400 = (p) => assert.rejects(p, (e) => e instanceof HttpError && e.status === 400);
const neverCalled = async () => { throw new Error('should not be called'); };

test('empty text → HttpError 400', () =>
  rejects400(handleChat({ text: '   ', day: '2026-11-07' }, { store: fakeStore(), ai: neverCalled })));
test('text over 1000 chars → HttpError 400', () =>
  rejects400(handleChat({ text: 'a'.repeat(1001), day: '2026-11-07' }, { store: fakeStore(), ai: neverCalled })));
test('bad day → HttpError 400', () =>
  rejects400(handleChat({ text: 'egg', day: 'today' }, { store: fakeStore(), ai: neverCalled })));

test('passes last 10 messages of the day as history, plus totals and goals', async () => {
  const store = fakeStore();
  store.messages['2026-11-07'] = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: `m${i}` }));
  store.entries['2026-11-07'] = [egg];
  let args;
  await handleChat({ text: 'hi', day: '2026-11-07' },
    { store, ai: async (a) => { args = a; return { items: [], reply: 'hey' }; } });
  assert.equal(args.text, 'hi');
  assert.equal(args.history.length, 10);
  assert.equal(args.history[0].text, 'm4');
  assert.equal(args.totals.kcal, 156);
  assert.deepEqual(args.goals, DEFAULT_GOALS);
});

test('failed turn is flagged so the client keeps the text', async (t) => {
  t.mock.method(console, 'error', () => {});
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store: fakeStore(), ai: aiSays({ items: 'nope', reply: 'x' }) });
  assert.equal(r.failed, true);
});

test('successful turn is not flagged failed', async () => {
  const r = await handleChat({ text: '2 eggs', day: '2026-11-07' },
    { store: fakeStore(), ai: aiSays({ items: [egg], reply: 'ok' }) });
  assert.equal(r.failed, false);
});

test('a turn saves entries, goals and messages in one write', async () => {
  const store = fakeStore();
  await handleChat({ text: 'eggs, and protein 160', day: '2026-11-07' },
    { store, ai: aiSays({ items: [egg], reply: 'ok', goals: { ...DEFAULT_GOALS, protein: 160 } }) });
  assert.equal(store.turns, 1);
  assert.equal(store.goals.protein, 160);
  assert.equal(store.entries['2026-11-07'].length, 1);
});

test('out-of-range goals are dropped; food still logs and the reply says why', async () => {
  const store = fakeStore();
  const r = await handleChat({ text: 'egg, set calories to 400', day: '2026-11-07' },
    { store, ai: aiSays({ items: [egg], reply: 'Logged.', goals: { ...DEFAULT_GOALS, kcal: 400 } }) });
  assert.equal(r.failed, false);
  assert.deepEqual(store.goals, DEFAULT_GOALS);
  assert.equal(store.entries['2026-11-07'].length, 1);
  assert.match(r.reply, /^Logged\. .*goal/);
});
