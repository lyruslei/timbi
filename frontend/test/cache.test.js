import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDay, writeDay, patchDay, readStreak, writeStreak, clearCache } from '../lib/cache.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const data = { totals: { kcal: 500, protein: 30, carbs: 50, fat: 10 }, goals: { kcal: 2200, protein: 150, carbs: 220, fat: 70 }, messages: [{ role: 'user', text: 'egg' }], entries: [{ id: 1 }] };

test('returns the cached day only for the same day', () => {
  const s = memory();
  writeDay('2026-11-08', data, s);
  assert.deepEqual(readDay('2026-11-08', s), { totals: data.totals, goals: data.goals, messages: data.messages });
  assert.equal(readDay('2026-11-09', s), null);
});

test('nothing cached reads as null', () => assert.equal(readDay('2026-11-08', memory()), null));

test('patchDay appends the chat turn and new totals', () => {
  const s = memory();
  writeDay('2026-11-08', data, s);
  patchDay('2026-11-08', { user: 'toast', reply: 'Logged toast.', totals: { kcal: 600, protein: 33, carbs: 70, fat: 11 } }, s);
  const c = readDay('2026-11-08', s);
  assert.equal(c.totals.kcal, 600);
  assert.deepEqual(c.goals, data.goals);
  assert.deepEqual(c.messages.slice(-2), [{ role: 'user', text: 'toast' }, { role: 'bot', text: 'Logged toast.' }]);
});

test('patchDay on another day changes nothing', () => {
  const s = memory();
  writeDay('2026-11-08', data, s);
  patchDay('2026-11-07', { user: 'x', reply: 'y', totals: data.totals }, s);
  assert.equal(readDay('2026-11-08', s).messages.length, 1);
});

test('streak is cached per day', () => {
  const s = memory();
  writeStreak('2026-11-08', 4, s);
  assert.equal(readStreak('2026-11-08', s), 4);
  assert.equal(readStreak('2026-11-09', s), null);
});

test('clearCache forgets everything', () => {
  const s = memory();
  writeDay('2026-11-08', data, s);
  writeStreak('2026-11-08', 4, s);
  clearCache(s);
  assert.equal(readDay('2026-11-08', s), null);
  assert.equal(readStreak('2026-11-08', s), null);
});

test('broken storage never throws', () => {
  const bad = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
  writeDay('2026-11-08', data, bad);
  assert.equal(readDay('2026-11-08', bad), null);
  clearCache(bad);
  assert.equal(readDay('2026-11-08', null), null);
});
