import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumTotals } from '../lib/totals.js';

test('empty day is zeros', () => assert.deepEqual(sumTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 }));
test('sums and rounds', () => assert.deepEqual(
  sumTotals([{ kcal: 156.4, protein: 12.6, carbs: 1.2, fat: 10.6 }, { kcal: 80, protein: 3, carbs: 15.05, fat: 1 }]),
  { kcal: 236, protein: 15.6, carbs: 16.3, fat: 11.6 }));

import { sumNutrients } from '../lib/totals.js';

test('nutrients: none known → all null, not partial', () => {
  assert.deepEqual(sumNutrients([{ kcal: 100 }, {}]),
    { fiber: null, sugar: null, sat_fat: null, sodium: null, cholesterol: null, potassium: null, partial: false });
});
test('nutrients: sums known values; grams to 1 decimal, mg to whole numbers', () => {
  const r = sumNutrients([
    { fiber: 1.24, sugar: 2, sat_fat: 0.5, sodium: 100.4, cholesterol: 10, potassium: 200.6 },
    { fiber: 3, sugar: 4.06, sat_fat: 1, sodium: 50, cholesterol: 5, potassium: 100 },
  ]);
  assert.deepEqual(r, { fiber: 4.2, sugar: 6.1, sat_fat: 1.5, sodium: 150, cholesterol: 15, potassium: 301, partial: false });
});
test('nutrients: partial when some foods have no data', () => {
  const r = sumNutrients([{ fiber: 2, sugar: 1, sat_fat: 1, sodium: 10, cholesterol: 0, potassium: 5 }, { fiber: null }]);
  assert.equal(r.fiber, 2);
  assert.equal(r.partial, true);
});
