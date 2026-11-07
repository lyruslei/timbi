import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginHandler } from '../api/login.js';
import { verifyToken } from '../lib/auth.js';
import { HttpError } from '../lib/http.js';

const env = { APP_PASSWORD: 'open sesame', TOKEN_SECRET: 's' };
const NOW = Date.UTC(2026, 10, 7);

test('correct password → token that verifies', () => {
  const { body } = loginHandler({ password: 'open sesame' }, env, NOW);
  assert.equal(verifyToken(body.token, 's', NOW + 1000), true);
});

test('wrong password → 401', () => {
  assert.throws(() => loginHandler({ password: 'nope' }, env, NOW),
    (e) => e instanceof HttpError && e.status === 401 && e.message === 'Wrong password');
});

test('missing password field → 401', () => {
  assert.throws(() => loginHandler({}, env, NOW), (e) => e instanceof HttpError && e.status === 401);
});

test('APP_PASSWORD not configured → 500, never logs in', () => {
  assert.throws(() => loginHandler({ password: '' }, { TOKEN_SECRET: 's' }, NOW),
    (e) => e instanceof HttpError && e.status === 500);
});

test('TOKEN_SECRET not configured → 500', () => {
  assert.throws(() => loginHandler({ password: 'open sesame' }, { APP_PASSWORD: 'open sesame' }, NOW),
    (e) => e instanceof HttpError && e.status === 500);
});
