import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayLabel, monthGrid, isFuture, monthTitle } from '../lib/days.js';

test('addDays goes back across a month boundary', () => assert.equal(addDays('2026-11-01', -1), '2026-10-31'));
test('addDays goes back across a year boundary', () => assert.equal(addDays('2026-01-01', -1), '2025-12-31'));
test('addDays forward', () => assert.equal(addDays('2026-02-28', 1), '2026-03-01'));

test('label: today', () => assert.equal(dayLabel('2026-11-08', '2026-11-08'), 'Today'));
test('label: yesterday', () => assert.equal(dayLabel('2026-11-07', '2026-11-08'), 'Yesterday'));
test('label: older day', () => assert.equal(dayLabel('2026-11-06', '2026-11-08'), 'Fri, Nov 6'));

test('isFuture', () => {
  assert.equal(isFuture('2026-11-09', '2026-11-08'), true);
  assert.equal(isFuture('2026-11-08', '2026-11-08'), false);
  assert.equal(isFuture('2026-10-31', '2026-11-08'), false);
});

test('monthTitle', () => assert.equal(monthTitle(2026, 10), 'November 2026'));

test('monthGrid: weeks start on Sunday, blanks outside the month', () => {
  const weeks = monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(weeks[0][0], '2026-11-01');
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, 30);
  assert.equal(weeks.flat().filter(Boolean).at(-1), '2026-11-30');
});

test('monthGrid: leading blanks before the 1st', () => {
  const weeks = monthGrid(2026, 9); // October 2026 starts on a Thursday
  assert.deepEqual(weeks[0].slice(0, 4), [null, null, null, null]);
  assert.equal(weeks[0][4], '2026-10-01');
});
