import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumTotals } from '../lib/totals.js';

test('empty day is zeros', () => assert.deepEqual(sumTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 }));
test('sums and rounds', () => assert.deepEqual(
  sumTotals([{ kcal: 156.4, protein: 12.6, carbs: 1.2, fat: 10.6 }, { kcal: 80, protein: 3, carbs: 15.05, fat: 1 }]),
  { kcal: 236, protein: 15.6, carbs: 16.3, fat: 11.6 }));
