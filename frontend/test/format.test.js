import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDay, ringData, macroSplit } from '../lib/format.js';

test('localDay uses local date', () => assert.equal(localDay(new Date(2026, 10, 7, 23, 59)), '2026-11-07'));
test('localDay pads month and day', () => assert.equal(localDay(new Date(2026, 0, 5, 0, 1)), '2026-01-05'));

test('ring under goal', () => assert.deepEqual(ringData({ kcal: 1340 }, { kcal: 2200 }), { eaten: 1340, left: 860, over: false, pct: 60.9 }));
test('ring over goal', () => {
  const r = ringData({ kcal: 2500 }, { kcal: 2200 });
  assert.equal(r.over, true);
  assert.equal(r.pct, 100);
  assert.equal(r.left, 0);
});
test('ring goal 0 no NaN', () => assert.deepEqual(ringData({ kcal: 0 }, { kcal: 0 }), { eaten: 0, left: 0, over: false, pct: 0 }));
test('ring rounds eaten', () => assert.equal(ringData({ kcal: 99.6 }, { kcal: 2000 }).eaten, 100));

test('split empty', () => {
  const s = macroSplit({ protein: 0, carbs: 0, fat: 0 });
  assert.equal(s.empty, true);
  assert.deepEqual(s.pct, { protein: 0, carbs: 0, fat: 0 });
});
test('split sums to 100', () => {
  const p = macroSplit({ protein: 10, carbs: 10, fat: 10 }).pct;
  assert.equal(p.protein + p.carbs + p.fat, 100);
});
test('split by grams', () => {
  const s = macroSplit({ protein: 30, carbs: 50, fat: 20 });
  assert.deepEqual(s.pct, { protein: 30, carbs: 50, fat: 20 });
  assert.deepEqual(s.grams, { protein: 30, carbs: 50, fat: 20 });
  assert.equal(s.empty, false);
});
