import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkImage, MAX_IMAGE_BASE64 } from '../lib/image.js';
import { HttpError } from '../lib/http.js';

const is400 = (e) => e instanceof HttpError && e.status === 400;
test('no image → null', () => assert.equal(checkImage(undefined), null));
test('jpeg, png and webp accepted', () => {
  for (const t of ['image/jpeg', 'image/png', 'image/webp']) assert.deepEqual(checkImage({ media_type: t, data: 'QUJD' }), { media_type: t, data: 'QUJD' });
});
test('gif or junk type → 400', () => {
  assert.throws(() => checkImage({ media_type: 'image/gif', data: 'QUJD' }), is400);
  assert.throws(() => checkImage({ media_type: 'text/html', data: 'QUJD' }), is400);
});
test('over 1.5 MB → 400', () => assert.throws(() => checkImage({ media_type: 'image/jpeg', data: 'A'.repeat(MAX_IMAGE_BASE64 + 4) }), is400));
test('not base64 → 400', () => assert.throws(() => checkImage({ media_type: 'image/jpeg', data: '<script>' }), is400));
test('a data: URL prefix is stripped', () =>
  assert.equal(checkImage({ media_type: 'image/jpeg', data: 'data:image/jpeg;base64,QUJD' }).data, 'QUJD'));
