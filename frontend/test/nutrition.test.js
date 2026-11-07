import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NUTRIENTS, nutrientRows, macroRows } from '../lib/nutrition.js';

const all = { fiber: 14, sugar: 60, sat_fat: 5, sodium: 1150, cholesterol: 0, potassium: 4700 };

test('six nutrients in a fixed order with FDA references', () => {
  assert.deepEqual(NUTRIENTS.map((n) => [n.key, n.ref, n.unit, n.kind]), [
    ['fiber', 28, 'g', 'reach'], ['sugar', 50, 'g', 'limit'], ['sat_fat', 20, 'g', 'limit'],
    ['sodium', 2300, 'mg', 'limit'], ['cholesterol', 300, 'mg', 'limit'], ['potassium', 4700, 'mg', 'reach'],
  ]);
});

test('row text, reference and fill', () => {
  const [fiber, sugar, , sodium, chol, pot] = nutrientRows(all);
  assert.deepEqual([fiber.label, fiber.text, fiber.refText, fiber.pct, fiber.over], ['Fiber', '14g', 'of 28g', 50, false]);
  assert.deepEqual([sugar.text, sugar.refText, sugar.pct, sugar.over], ['60g', 'limit 50g', 100, true]);
  assert.deepEqual([sodium.text, sodium.refText, sodium.pct], ['1,150mg', 'limit 2,300mg', 50]);
  assert.deepEqual([chol.text, chol.pct, chol.over], ['0mg', 0, false]);
  assert.equal(pot.over, false); // reaching a "reach" target is good, never "over"
});

test('unknown nutrient shows a dash, not 0', () => {
  const rows = nutrientRows({ ...all, fiber: null });
  assert.equal(rows[0].text, '—');
  assert.equal(rows[0].pct, 0);
  assert.equal(rows[0].over, false);
});

test('macro rows against goals, no NaN at goal 0', () => {
  const rows = macroRows({ kcal: 1650, protein: 75, carbs: 0, fat: 10 }, { kcal: 1500, protein: 150, carbs: 220, fat: 0 });
  assert.deepEqual(rows.map((r) => r.label), ['Calories', 'Protein', 'Carbs', 'Fat']);
  assert.deepEqual([rows[0].text, rows[0].pct, rows[0].over], ['1,650 / 1,500 kcal', 100, true]);
  assert.deepEqual([rows[1].text, rows[1].pct, rows[1].over], ['75 / 150g', 50, false]);
  assert.equal(rows[3].pct, 0);
});
