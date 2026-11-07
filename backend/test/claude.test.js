import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askClaude } from '../lib/claude.js';

const out = { items: [], reply: 'hi', goals: null };
function fakeClient(response) {
  const calls = [];
  return {
    calls,
    messages: { create: async (params) => { calls.push(params); return response; } },
  };
}
const ok = (obj) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(obj) }] });
const args = {
  text: 'egg',
  history: [{ role: 'user', text: 'toast' }, { role: 'bot', text: 'Logged toast.' }],
  totals: { kcal: 80, protein: 3, carbs: 15, fat: 1 },
  goals: { kcal: 2200, protein: 150, carbs: 220, fat: 70 },
};

test('parses the JSON text block', async () => {
  const client = fakeClient(ok(out));
  assert.deepEqual(await askClaude(args, { client, model: 'm' }), out);
});

test('sends model, json_schema format, history and the new message last', async () => {
  const client = fakeClient(ok(out));
  await askClaude(args, { client, model: 'm' });
  const p = client.calls[0];
  assert.equal(p.model, 'm');
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.deepEqual(p.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.match(p.messages.at(-1).content, /egg/);
  assert.equal(p.tool_choice, undefined);
});

test('totals and goals reach the model', async () => {
  const client = fakeClient(ok(out));
  await askClaude(args, { client, model: 'm' });
  const all = JSON.stringify(client.calls[0]);
  assert.match(all, /2200/);
  assert.match(all, /"kcal\\?":80/);
});

test('refusal throws', async () => {
  const client = fakeClient({ stop_reason: 'refusal', content: [] });
  await assert.rejects(askClaude(args, { client, model: 'm' }));
});

test('max_tokens throws', async () => {
  const client = fakeClient({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"items":' }] });
  await assert.rejects(askClaude(args, { client, model: 'm' }));
});
