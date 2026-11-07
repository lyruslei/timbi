import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateItem, validateClaudeResult, validateGoals, isValidDay } from '../lib/validate.js';

const egg = { food: 'Egg, large', qty: 2, kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6 };

test('accepts a sane item', () => assert.deepEqual(validateItem(egg), { ok: true, item: egg }));
test('trims food name', () => assert.equal(validateItem({ ...egg, food: '  Egg ' }).item.food, 'Egg'));
test('rejects string numbers', () => assert.equal(validateItem({ ...egg, kcal: '156' }).ok, false));
test('rejects negative', () => assert.equal(validateItem({ ...egg, fat: -1 }).ok, false));
test('rejects NaN', () => assert.equal(validateItem({ ...egg, protein: NaN }).ok, false));
test('rejects kcal > 5000', () => assert.equal(validateItem({ ...egg, kcal: 5001 }).ok, false));
test('rejects qty 0', () => assert.equal(validateItem({ ...egg, qty: 0 }).ok, false));
test('rejects macros way over kcal', () =>
  assert.equal(validateItem({ ...egg, kcal: 10, protein: 50 }).ok, false));
test('rejects empty food name', () => assert.equal(validateItem({ ...egg, food: ' ' }).ok, false));
test('rejects non-object item', () => assert.equal(validateItem(null).ok, false));

test('result: empty items is fine for questions', () =>
  assert.deepEqual(validateClaudeResult({ items: [], reply: 'You have 40g left.' }),
    { items: [], reply: 'You have 40g left.', goals: null, goalsRejected: false }));
test('result: one bad item throws', () =>
  assert.throws(() => validateClaudeResult({ items: [egg, { ...egg, qty: 0 }], reply: 'x' })));
test('result: missing reply throws', () => assert.throws(() => validateClaudeResult({ items: [] })));
test('result: items not an array throws', () => assert.throws(() => validateClaudeResult({ items: 'egg', reply: 'x' })));
test('result: goals passed through when valid', () => {
  const goals = { kcal: 2200, protein: 160, carbs: 220, fat: 70 };
  assert.deepEqual(validateClaudeResult({ items: [], reply: 'ok', goals }).goals, goals);
});
test('result: malformed goals object is dropped, not fatal', () =>
  assert.equal(validateClaudeResult({ items: [], reply: 'ok', goals: { kcal: 100 } }).goals, null));

test('goals: accepts', () => assert.equal(validateGoals({ kcal: 2200, protein: 150, carbs: 220, fat: 70 }).ok, true));
test('goals: rejects kcal 300', () => assert.equal(validateGoals({ kcal: 300, protein: 1, carbs: 1, fat: 1 }).ok, false));
test('goals: rejects missing field', () => assert.equal(validateGoals({ kcal: 2200, protein: 150, carbs: 220 }).ok, false));

test('day format', () => {
  assert.equal(isValidDay('2026-11-07'), true);
  assert.equal(isValidDay('11/07/2026'), false);
  assert.equal(isValidDay('2026-02-30'), false);
  assert.equal(isValidDay(undefined), false);
});

test('result: invalid goals are dropped and flagged, not fatal', () => {
  const r = validateClaudeResult({ items: [], reply: 'ok', goals: { kcal: 100, protein: 1, carbs: 1, fat: 1 } });
  assert.equal(r.goals, null);
  assert.equal(r.goalsRejected, true);
});
