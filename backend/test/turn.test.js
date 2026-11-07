import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTurn } from '../lib/turn.js';

const egg = { food: 'Egg', qty: 1, kcal: 78, protein: 6, carbs: 0.6, fat: 5 };
const ctx = { allowedEntryIds: new Set([11, 12]), allowedFoodIds: new Set([7]), day: '2026-11-08', today: '2026-11-08' };
const base = { items: [], reply: 'ok', goals: null };
const run = (extra, c = ctx) => validateTurn({ ...base, ...extra }, c);

test('plain turn: defaults for the new parts', () => {
  const r = run({ items: [egg] });
  assert.equal(r.items.length, 1);
  assert.deepEqual([r.saved, r.edits, r.copies, r.logDay, r.label], [[], [], [], '2026-11-08', null]);
});

// saved foods
test('saved food with allowed id and servings', () => assert.deepEqual(run({ saved: [{ id: 7, servings: 2 }] }).saved, [{ id: 7, servings: 2 }]));
test('saved food id not sent → throws', () => assert.throws(() => run({ saved: [{ id: 8, servings: 1 }] })));
test('servings 0 or 51 → throws', () => {
  assert.throws(() => run({ saved: [{ id: 7, servings: 0 }] }));
  assert.throws(() => run({ saved: [{ id: 7, servings: 51 }] }));
});

// edits
test('remove an allowed entry', () => assert.deepEqual(run({ edits: [{ id: 11, remove: true }] }).edits, [{ id: 11, remove: true }]));
test('update an allowed entry with checked numbers', () => {
  const r = run({ edits: [{ id: 12, remove: false, item: { ...egg, qty: 3, kcal: 234, protein: 18, carbs: 1.8, fat: 15 } }] });
  assert.equal(r.edits[0].item.kcal, 234);
  assert.equal(r.edits[0].item.sodium, null);
});
test('edit of an id not sent → throws', () => assert.throws(() => run({ edits: [{ id: 99, remove: true }] })));
test('update with bad numbers → throws', () => assert.throws(() => run({ edits: [{ id: 12, remove: false, item: { ...egg, kcal: -1 } }] })));
test('edit that neither removes nor updates → throws', () => assert.throws(() => run({ edits: [{ id: 12, remove: false }] })));

// copies
test('copies of allowed ids, deduplicated', () => assert.deepEqual(run({ copies: [11, 12, 11] }).copies, [11, 12]));
test('copy of an id not sent → throws', () => assert.throws(() => run({ copies: [5] })));

// log day
test('yesterday is allowed', () => assert.equal(run({ log_day: '2026-11-07' }).logDay, '2026-11-07'));
test('tomorrow falls back to the viewed day', () => assert.equal(run({ log_day: '2026-11-09' }).logDay, '2026-11-08'));
test('61 days back falls back; 60 is fine', () => {
  assert.equal(run({ log_day: '2026-09-08' }).logDay, '2026-11-08');
  assert.equal(run({ log_day: '2026-09-09' }).logDay, '2026-09-09');
});
test('garbage log day falls back', () => assert.equal(run({ log_day: 'yesterday' }).logDay, '2026-11-08'));

// label
const label = { name: 'Blitz bar vanilla', serving: '1 bar', kcal: 210, protein: 20, carbs: 6, fat: 7, fiber: 2, sugar: 1, sat_fat: 2, sodium: 150, cholesterol: 5, potassium: 150 };
test('valid label kept', () => assert.equal(run({ label }).label.name, 'Blitz bar vanilla'));
test('invalid label dropped without failing the turn', () => {
  const r = run({ label: { ...label, kcal: 'lots' }, items: [egg] });
  assert.equal(r.label, null);
  assert.equal(r.items.length, 1);
});

// existing rules still apply
test('bad item still fails the turn', () => assert.throws(() => run({ items: [{ ...egg, kcal: -5 }] })));
