import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekHandler } from '../api/week.js';
import { HttpError } from '../lib/http.js';

const goals = { kcal: 2000, protein: 110, carbs: 220, fat: 70 };
const egg = { kcal: 100, protein: 10, carbs: 1, fat: 5, fiber: 0, sugar: 1, sat_fat: 2, sodium: 70, cholesterol: 180, potassium: 60 };
function fakeStore(rows) {
  return {
    asked: null,
    async getGoals() { return { ...goals }; },
    async getEntriesRange(from, to) { this.asked = [from, to]; return rows; },
  };
}
const is400 = (e) => e instanceof HttpError && e.status === 400;

test('week: 7 days from start, totals per day, empty days zeros', async () => {
  const store = fakeStore([{ day: '2026-11-23', ...egg }, { day: '2026-11-23', ...egg }, { day: '2026-11-25', ...egg }]);
  const { body } = await weekHandler({ query: { start: '2026-11-23' } }, store);
  assert.deepEqual(store.asked, ['2026-11-23', '2026-11-29']);
  assert.deepEqual(body.goals, goals);
  assert.deepEqual(body.days.map((d) => d.day), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  assert.deepEqual(body.days[0].totals, { kcal: 200, protein: 20, carbs: 2, fat: 10 });
  assert.equal(body.days[0].nutrients.sodium, 140);
  assert.equal(body.days[0].logged, true);
  assert.deepEqual(body.days[1].totals, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(body.days[1].logged, false);
  assert.equal(body.days[1].nutrients.fiber, null);
});

test('week: crosses a month boundary', async () => {
  const { body } = await weekHandler({ query: { start: '2026-11-30' } }, fakeStore([]));
  assert.equal(body.days[6].day, '2026-12-06');
});

test('week: bad start → 400', () => assert.rejects(weekHandler({ query: { start: 'x' } }, fakeStore([])), is400));
