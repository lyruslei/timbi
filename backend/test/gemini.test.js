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
