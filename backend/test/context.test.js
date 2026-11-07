import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWeekQuestion, describeEntries, expandSaved, weekTotals } from '../lib/context.js';

test('week questions', () => {
  for (const t of ['how did I do this week?', 'weekly summary', 'last week vs this', 'past week protein', 'last 7 days']) assert.equal(isWeekQuestion(t), true, t);
  for (const t of ['2 eggs', 'a weekend brunch', 'how much protein left?']) assert.equal(isWeekQuestion(t), false, t);
});

test('describeEntries gives id, local time and numbers', () => {
  const rows = [{ id: 3, food: 'Eggs', qty: 2, kcal: 156.4, protein: 12.6, carbs: 1.2, fat: 10.6, created_at: '2026-11-08T00:18:00Z' }];
  // Manila is UTC+8 → getTimezoneOffset() = -480
  assert.deepEqual(describeEntries(rows, -480), [{ id: 3, time: '08:18', food: 'Eggs', qty: 2, kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6 }]);
});

const blitz = { id: 7, name: 'Blitz bar vanilla', serving: '1 bar', kcal: 210, protein: 20, carbs: 6, fat: 7, fiber: 2, sugar: 1, sat_fat: 2, sodium: 150, cholesterol: 5, potassium: null };

test('expandSaved multiplies the saved numbers exactly', () => {
  const [item] = expandSaved([{ id: 7, servings: 2 }], [blitz]);
  assert.deepEqual(item, { food: 'Blitz bar vanilla, 2 × 1 bar', qty: 2, kcal: 420, protein: 40, carbs: 12, fat: 14, fiber: 4, sugar: 2, sat_fat: 4, sodium: 300, cholesterol: 10, potassium: null });
});
test('expandSaved: one serving reads naturally', () => assert.equal(expandSaved([{ id: 7, servings: 1 }], [blitz])[0].food, 'Blitz bar vanilla, 1 bar'));
test('expandSaved: half a serving rounds to 1 decimal', () => {
  const [item] = expandSaved([{ id: 7, servings: 0.5 }], [blitz]);
  assert.equal(item.kcal, 105);
  assert.equal(item.food, 'Blitz bar vanilla, 0.5 × 1 bar');
});

test('weekTotals: 7 days ending today, empty days are zeros', () => {
  const rows = [
    { day: '2026-11-08', kcal: 500, protein: 30, carbs: 50, fat: 10 },
    { day: '2026-11-08', kcal: 100, protein: 5, carbs: 10, fat: 2 },
    { day: '2026-11-02', kcal: 2000, protein: 120, carbs: 200, fat: 60 },
    { day: '2026-11-01', kcal: 999, protein: 1, carbs: 1, fat: 1 }, // outside the window
  ];
  const w = weekTotals(rows, '2026-11-08');
  assert.equal(w.length, 7);
  assert.deepEqual(w[0], { day: '2026-11-02', kcal: 2000, protein: 120, carbs: 200, fat: 60 });
  assert.deepEqual(w[6], { day: '2026-11-08', kcal: 600, protein: 35, carbs: 60, fat: 12 });
  assert.deepEqual(w[1], { day: '2026-11-03', kcal: 0, protein: 0, carbs: 0, fat: 0 });
});
