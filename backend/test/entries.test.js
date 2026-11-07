import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entriesHandler } from '../api/entries.js';
import { HttpError } from '../lib/http.js';

function fakeStore() {
  return {
    moved: [], removed: [],
    async moveEntries(ids, day) { this.moved.push({ ids, day }); return ids.length; },
    async removeEntries(ids) { this.removed.push(ids); return ids.length; },
  };
}
const is400 = (e) => e instanceof HttpError && e.status === 400;

test('PATCH moves the chosen foods to a day', async () => {
  const store = fakeStore();
  const { body } = await entriesHandler({ method: 'PATCH', body: { ids: [3, 4], day: '2026-11-07' } }, store);
  assert.deepEqual(store.moved, [{ ids: [3, 4], day: '2026-11-07' }]);
  assert.deepEqual(body, { moved: 2 });
});

test('DELETE removes the chosen foods', async () => {
  const store = fakeStore();
  const { body } = await entriesHandler({ method: 'DELETE', body: { ids: [9] } }, store);
  assert.deepEqual(store.removed, [[9]]);
  assert.deepEqual(body, { removed: 1 });
});

for (const [name, ids] of [['empty', []], ['not an array', '3'], ['decimal', [1.5]], ['negative', [-1]], ['string id', ['3']], ['too many', Array.from({ length: 101 }, (_, i) => i + 1)]]) {
  test(`bad ids (${name}) → 400, nothing touched`, async () => {
    const store = fakeStore();
    await assert.rejects(entriesHandler({ method: 'DELETE', body: { ids } }, store), is400);
    await assert.rejects(entriesHandler({ method: 'PATCH', body: { ids, day: '2026-11-07' } }, store), is400);
    assert.equal(store.moved.length + store.removed.length, 0);
  });
}

test('move with a bad day → 400', async () => {
  const store = fakeStore();
  await assert.rejects(entriesHandler({ method: 'PATCH', body: { ids: [1], day: 'yesterday' } }, store), is400);
  assert.equal(store.moved.length, 0);
});
