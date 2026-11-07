import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askGemini, DEFAULT_MODEL } from '../lib/gemini.js';

const out = { items: [], reply: 'hi', goals: null };
function fakeClient(response) {
  const calls = [];
  return {
    calls,
    models: { generateContent: async (params) => { calls.push(params); return response; } },
  };
}
const ok = (obj) => ({ text: JSON.stringify(obj), candidates: [{ finishReason: 'STOP' }] });
const args = {
  text: 'egg',
  history: [{ role: 'bot', text: 'stray' }, { role: 'user', text: 'toast' }, { role: 'bot', text: 'Logged toast.' }],
  totals: { kcal: 80, protein: 3, carbs: 15, fat: 1 },
  goals: { kcal: 2200, protein: 150, carbs: 220, fat: 70 },
};

test('default model is a Gemini model', () => assert.match(DEFAULT_MODEL, /^gemini-/));

test('parses the JSON text', async () => {
  const client = fakeClient(ok(out));
  assert.deepEqual(await askGemini(args, { client, model: 'm' }), out);
});

test('sends model, JSON schema, system instruction and history with the new message last', async () => {
  const client = fakeClient(ok(out));
  await askGemini(args, { client, model: 'm' });
  const p = client.calls[0];
  assert.equal(p.model, 'm');
  assert.equal(p.config.responseMimeType, 'application/json');
  assert.equal(p.config.responseJsonSchema.type, 'object');
  assert.match(p.config.systemInstruction, /Bitelog/);
  // leading bot message dropped; bot → model; new message last
  assert.deepEqual(p.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.match(p.contents.at(-1).parts[0].text, /egg/);
});

test('totals and goals reach the model', async () => {
  const client = fakeClient(ok(out));
  await askGemini(args, { client, model: 'm' });
  const last = client.calls[0].contents.at(-1).parts[0].text;
  assert.match(last, /2200/);
  assert.match(last, /"kcal":80/);
});

test('blocked or cut-off answers throw', async () => {
  for (const reason of ['SAFETY', 'MAX_TOKENS']) {
    const client = fakeClient({ text: '{"items":', candidates: [{ finishReason: reason }] });
    await assert.rejects(askGemini(args, { client, model: 'm' }));
  }
});

test('empty answer throws', async () => {
  const client = fakeClient({ text: undefined, candidates: [] });
  await assert.rejects(askGemini(args, { client, model: 'm' }));
});

// ---- fallback across models when Google is busy ----
import { askWithFallback, MODELS } from '../lib/gemini.js';

function scriptedClient(script) {
  const tried = [];
  return {
    tried,
    models: {
      generateContent: async ({ model }) => {
        tried.push(model);
        const step = script[model];
        if (step instanceof Error) throw step;
        return step;
      },
    },
  };
}
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

test('fallback list starts with 3.8 flash', () => assert.equal(MODELS[0], 'gemini-3.8-flash'));

test('busy model (503) falls back to the next one', async () => {
  const client = scriptedClient({ a: httpError(503), b: ok(out) });
  assert.deepEqual(await askWithFallback(args, { client, models: ['a', 'b'] }), out);
  assert.deepEqual(client.tried, ['a', 'b']);
});

test('rate limit (429) and timeouts also fall back', async () => {
  const timeout = Object.assign(new Error('timed out'), { name: 'AbortError' });
  const client = scriptedClient({ a: httpError(429), b: timeout, c: ok(out) });
  assert.deepEqual(await askWithFallback(args, { client, models: ['a', 'b', 'c'] }), out);
  assert.deepEqual(client.tried, ['a', 'b', 'c']);
});

test('a non-busy error (400) does not try other models', async () => {
  const client = scriptedClient({ a: httpError(400), b: ok(out) });
  await assert.rejects(askWithFallback(args, { client, models: ['a', 'b'] }));
  assert.deepEqual(client.tried, ['a']);
});

test('all models busy → throws', async () => {
  const client = scriptedClient({ a: httpError(503), b: httpError(503) });
  await assert.rejects(askWithFallback(args, { client, models: ['a', 'b'] }));
});
