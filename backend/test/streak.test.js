import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from '../lib/streak.js';
import { streakHandler } from '../api/streak.js';
import { HttpError } from '../lib/http.js';

test('no days → 0', () => assert.equal(computeStreak([], '2026-11-08'), 0));
test('today only → 1', () => assert.equal(computeStreak(['2026-11-08'], '2026-11-08'), 1));
test('today empty, yesterday streak still counts', () =>
  assert.equal(computeStreak(['2026-11-06', '2026-11-07'], '2026-11-08'), 2));
test('gap breaks it', () => assert.equal(computeStreak(['2026-11-05', '2026-11-07', '2026-11-08'], '2026-11-08'), 2));
test('two days ago only → 0', () => assert.equal(computeStreak(['2026-11-06'], '2026-11-08'), 0));
test('across month and year boundaries', () =>
  assert.equal(computeStreak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01'), 3));
test('duplicates and unsorted input are fine', () =>
  assert.equal(computeStreak(['2026-11-08', '2026-11-07', '2026-11-08'], '2026-11-08'), 2));
test('future days ignored', () => assert.equal(computeStreak(['2026-11-09'], '2026-11-08'), 0));

test('route: returns streak from logged days', async () => {
  const store = { async getLoggedDays(from, to) { this.range = [from, to]; return ['2026-11-07', '2026-11-08']; } };
  const { body } = await streakHandler({ query: { today: '2026-11-08' } }, store);
  assert.deepEqual(body, { streak: 2 });
  assert.equal(store.range[1], '2026-11-08');
});
test('route: bad today → 400', () =>
  assert.rejects(streakHandler({ query: { today: 'nope' } }, {}), (e) => e instanceof HttpError && e.status === 400));
