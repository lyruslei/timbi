import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, weekTitle, weekClock, paceTag, weekMacros, dayColumns, hitLine, weekNutrients } from '../lib/week.js';

const goals = { kcal: 2000, protein: 110, carbs: 220, fat: 70 };
const none = { fiber: null, sugar: null, sat_fat: null, sodium: null, cholesterol: null, potassium: null, partial: false };
const day = (d, t = {}, n = none) => ({ day: d, logged: Object.keys(t).length > 0, totals: { kcal: 0, protein: 0, carbs: 0, fat: 0, ...t }, nutrients: n });
// Mon Nov 23 – Sun Nov 29 2026, today Wednesday Nov 25.
const week = [
  day('2026-11-23', { kcal: 2150, protein: 95 }, { ...none, fiber: 20, sodium: 3000 }),
  day('2026-11-24', { kcal: 1900, protein: 130 }, { ...none, fiber: 28, sodium: 2300 }),
  day('2026-11-25', { kcal: 1200, protein: 60 }, { ...none, fiber: 14, sodium: 2100 }),
  day('2026-11-26'), day('2026-11-27'), day('2026-11-28'), day('2026-11-29'),
];
const TODAY = '2026-11-25';

test('weekStart: Monday of the week; Sunday belongs to the week before it', () => {
  assert.equal(weekStart('2026-11-25'), '2026-11-23');
  assert.equal(weekStart('2026-11-23'), '2026-11-23');
  assert.equal(weekStart('2026-11-29'), '2026-11-23');
  assert.equal(weekStart('2026-12-02'), '2026-11-30');
});

test('weekTitle', () => assert.equal(weekTitle('2026-11-23'), 'Mon, Nov 23 – Sun, Nov 29'));

test('weekClock: finished days, days left (today included)', () => {
  assert.deepEqual(weekClock(week, TODAY), { finished: 2, left: 5, dayNumber: 3 });
  assert.deepEqual(weekClock(week, '2026-12-01'), { finished: 7, left: 0, dayNumber: 7 });
});

test('paceTag: reach and limit, none on the first day', () => {
  assert.deepEqual(paceTag(5, 'reach', 'g', 2), { text: '5g ahead', tone: 'ok' });
  assert.deepEqual(paceTag(-20, 'reach', 'g', 2), { text: '20g behind', tone: 'warn' });
  assert.deepEqual(paceTag(50, 'limit', ' kcal', 2), { text: '50 kcal over pace', tone: 'warn' });
  assert.deepEqual(paceTag(-1200, 'limit', ' kcal', 2), { text: '1,200 kcal under pace', tone: 'ok' });
  assert.deepEqual(paceTag(0.3, 'reach', 'g', 2), { text: 'on pace', tone: 'ok' });
  assert.equal(paceTag(50, 'reach', 'g', 0), null);
});

test('weekMacros: protein total, budget, pace from finished days only, per-day left', () => {
  const [protein, kcal] = weekMacros(week, goals, TODAY);
  assert.equal(protein.total, '285');
  assert.equal(protein.budget, '770g');
  assert.equal(protein.pct, 37);
  assert.deepEqual(protein.tag, { text: '5g ahead', tone: 'ok' }); // 95 + 130 vs 2 × 110; today's 60 not judged
  assert.equal(protein.left, '485g to go · 5 days left · about 97g/day');
  assert.equal(kcal.budget, '14,000 kcal');
  assert.deepEqual(kcal.tag, { text: '50 kcal over pace', tone: 'warn' });
  assert.equal(kcal.left, '8,750 kcal left · about 1,750 kcal/day');
});

test('weekMacros: finished week says how it ended', () => {
  const [protein] = weekMacros(week, goals, '2026-11-30');
  assert.equal(protein.left, 'Finished 485g short.');
  const [p2] = weekMacros(week.map((d) => ({ ...d, totals: { ...d.totals, protein: 120 } })), goals, '2026-11-30');
  assert.equal(p2.left, "You've hit the week's goal.");
});

test('weekMacros: goal 0 gives no NaN', () => {
  const [protein] = weekMacros(week, { ...goals, protein: 0 }, TODAY);
  assert.equal(protein.pct, 0);
});

test('dayColumns: states and heights', () => {
  const cols = dayColumns(week, 'protein', 110, TODAY);
  assert.deepEqual(cols.map((c) => c.state), ['under', 'hit', 'today', 'future', 'future', 'future', 'future']);
  assert.deepEqual(cols.map((c) => c.letter).join(''), 'MTWTFSS');
  assert.equal(cols[1].height, 91); // 130 of top 143 (110 × 1.3)
});

test('hitLine', () => {
  assert.equal(hitLine(week, 'protein', 110, 'g', TODAY), 'Hit 110g on 1 of 2 finished days.');
  assert.equal(hitLine(week, 'protein', 110, 'g', '2026-11-23'), 'First day of the week. Finished days show up here.');
});

test('weekNutrients: reach vs limit, pace, average, unknown', () => {
  const { reach, limit, partial } = weekNutrients(week, TODAY);
  const fiber = reach.find((r) => r.key === 'fiber');
  assert.equal(fiber.text, '62g');
  assert.equal(fiber.refText, '/ 196g');
  assert.deepEqual(fiber.tag, { text: '8g behind', tone: 'warn' }); // 48 vs 56
  assert.equal(fiber.avg, 'avg 24g/day · aim 28');
  const sodium = limit.find((r) => r.key === 'sodium');
  assert.deepEqual(sodium.tag, { text: '700mg over pace', tone: 'warn' });
  const sugar = limit.find((r) => r.key === 'sugar');
  assert.equal(sugar.text, '—');
  assert.equal(sugar.tag, null);
  assert.equal(partial, false);
});

test('weekNutrients: a logged day with no nutrient data marks the week partial', () => {
  const w = [...week];
  w[3] = day('2026-11-26', { kcal: 500 });
  assert.equal(weekNutrients(w, TODAY).partial, true);
});
