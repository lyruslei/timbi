import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayHandler } from '../api/today.js';
import { goalsHandler } from '../api/goals.js';
import { HttpError } from '../lib/http.js';

const goals = { kcal: 2200, protein: 150, carbs: 220, fat: 70 };
function fakeStore() {
  return {
    goals: { ...goals },
    async getGoals() { return { ...this.goals }; },
    async setGoals(g) { this.goals = { ...g }; },
    async getEntries(day) { return day === '2026-11-07' ? [{ kcal: 100, protein: 5, carbs: 10, fat: 2 }] : []; },
    async getMessages(day) { return day === '2026-11-07' ? [{ role: 'user', text: 'egg' }] : []; },
  };
}
const is400 = (e) => e instanceof HttpError && e.status === 400;

test('today: returns totals, goals, messages for the day', async () => {
  const { body } = await todayHandler({ query: { day: '2026-11-07' } }, fakeStore());
  assert.deepEqual(body, { totals: { kcal: 100, protein: 5, carbs: 10, fat: 2 }, goals, messages: [{ role: 'user', text: 'egg' }] });
});
test('today: empty day is zeros', async () => {
  const { body } = await todayHandler({ query: { day: '2026-11-08' } }, fakeStore());
  assert.equal(body.totals.kcal, 0);
  assert.deepEqual(body.messages, []);
});
test('today: bad day → 400', () => assert.rejects(todayHandler({ query: { day: 'x' } }, fakeStore()), is400));

test('goals: GET returns goals', async () => {
  assert.deepEqual((await goalsHandler({ method: 'GET', body: {} }, fakeStore())).body, { goals });
});
test('goals: PUT saves valid goals', async () => {
  const store = fakeStore();
  const next = { ...goals, protein: 160 };
  assert.deepEqual((await goalsHandler({ method: 'PUT', body: next }, store)).body, { goals: next });
  assert.deepEqual(store.goals, next);
});
test('goals: PUT rejects invalid goals → 400, nothing saved', async () => {
  const store = fakeStore();
  await assert.rejects(goalsHandler({ method: 'PUT', body: { kcal: 100, protein: 1, carbs: 1, fat: 1 } }, store), is400);
  assert.deepEqual(store.goals, goals);
});
