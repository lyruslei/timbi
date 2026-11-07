import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, HttpError } from '../lib/http.js';
import { createToken, TOKEN_TTL_MS } from '../lib/auth.js';

const env = { FRONTEND_ORIGIN: 'https://bitelog.vercel.app', TOKEN_SECRET: 's' };
const NOW = Date.UTC(2026, 10, 7);
const now = () => NOW;

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: undefined, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; this.ended = true; return this; },
    end() { this.ended = true; return this; },
  };
}
const req = (method, { token, body } = {}) => ({
  method, body, query: {},
  headers: token ? { authorization: `Bearer ${token}` } : {},
});
const ok = async () => ({ body: { hi: 1 } });

test('OPTIONS preflight → 204 with CORS headers', async () => {
  const res = fakeRes();
  await route({ methods: ['POST'], auth: true, env, now }, ok)(req('OPTIONS'), res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['access-control-allow-origin'], env.FRONTEND_ORIGIN);
  assert.match(res.headers['access-control-allow-headers'], /Authorization/);
  assert.match(res.headers['access-control-allow-methods'], /POST/);
});

test('wrong method → 405', async () => {
  const res = fakeRes();
  await route({ methods: ['POST'], auth: false, env, now }, ok)(req('GET'), res);
  assert.equal(res.statusCode, 405);
});

test('auth route without token → 401 {error}', async () => {
  const res = fakeRes();
  await route({ methods: ['GET'], auth: true, env, now }, ok)(req('GET'), res);
  assert.equal(res.statusCode, 401);
  assert.ok(res.body.error);
});

test('auth route with expired token → 401', async () => {
  const res = fakeRes();
  const old = createToken('s', NOW - TOKEN_TTL_MS - 1);
  await route({ methods: ['GET'], auth: true, env, now }, ok)(req('GET', { token: old }), res);
  assert.equal(res.statusCode, 401);
});

test('auth route with valid token → handler body, 200', async () => {
  const res = fakeRes();
  await route({ methods: ['GET'], auth: true, env, now }, ok)(req('GET', { token: createToken('s', NOW) }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { hi: 1 });
});

test('handler gets body, missing body becomes {}', async () => {
  const res = fakeRes();
  let seen;
  await route({ methods: ['POST'], auth: false, env, now }, async (r) => { seen = r.body; return { body: {} }; })(req('POST'), res);
  assert.deepEqual(seen, {});
});

test('HttpError(400,"bad") → 400 {error:"bad"}', async () => {
  const res = fakeRes();
  await route({ methods: ['POST'], auth: false, env, now }, async () => { throw new HttpError(400, 'bad'); })(req('POST'), res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'bad' });
});

test('unexpected throw → 500 {error:"Server error"}', async (t) => {
  t.mock.method(console, 'error', () => {});
  const res = fakeRes();
  await route({ methods: ['POST'], auth: false, env, now }, async () => { throw new Error('boom'); })(req('POST'), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Server error' });
});

test('every response carries Access-Control-Allow-Origin', async () => {
  for (const r of [req('GET'), req('POST'), req('OPTIONS')]) {
    const res = fakeRes();
    await route({ methods: ['POST'], auth: true, env, now }, ok)(r, res);
    assert.equal(res.headers['access-control-allow-origin'], env.FRONTEND_ORIGIN);
  }
});
