import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToken, verifyToken, checkPassword, TOKEN_TTL_MS } from '../lib/auth.js';

const now = Date.UTC(2026, 10, 7);
test('ttl is 30 days', () => assert.equal(TOKEN_TTL_MS, 30 * 24 * 60 * 60 * 1000));
test('fresh token verifies', () => assert.equal(verifyToken(createToken('s', now), 's', now + 1000), true));
test('expired token fails', () => assert.equal(verifyToken(createToken('s', now), 's', now + TOKEN_TTL_MS + 1), false));
test('wrong secret fails', () => assert.equal(verifyToken(createToken('s', now), 'other', now), false));
test('tampered payload fails', () => {
  const [, sig] = createToken('s', now).split('.');
  const forged = Buffer.from(JSON.stringify({ exp: now + 9e12 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`, 's', now), false);
});
test('garbage fails', () => {
  assert.equal(verifyToken('nope', 's', now), false);
  assert.equal(verifyToken('a.b.c', 's', now), false);
  assert.equal(verifyToken(undefined, 's', now), false);
});
test('password', () => {
  assert.equal(checkPassword('abc', 'abc'), true);
  assert.equal(checkPassword('abd', 'abc'), false);
  assert.equal(checkPassword('', 'abc'), false);
  assert.equal(checkPassword(undefined, 'abc'), false);
});
