import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askClaude, DEFAULT_MODEL, CLIENT_OPTIONS } from '../lib/claude.js';

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

test('default model is Claude Haiku 5.5', () => assert.equal(DEFAULT_MODEL, 'claude-haiku-5-5'));

test('client gives up fast: 15s limit, at most one retry', () => {
  assert.equal(CLIENT_OPTIONS.timeout, 15000);
  assert.ok(CLIENT_OPTIONS.maxRetries <= 1);
});

test('asks for low effort so replies come back quickly', async () => {
  const client = fakeClient(ok(out));
  await askClaude(args, { client, model: 'm' });
  assert.equal(client.calls[0].output_config.effort, 'low');
});

// ---- v2: context, image, new reply fields ----
const v2 = {
  ...args,
  day: '2026-11-08', today: '2026-11-08',
  entries: { viewed: [{ id: 11, time: '08:10', food: 'Eggs', qty: 2, kcal: 156, protein: 12.6, carbs: 1.2, fat: 10.6 }], previous: [{ id: 5, time: '07:55', food: 'Toast', qty: 1, kcal: 80, protein: 3, carbs: 15, fat: 1 }] },
  myFoods: [{ id: 7, name: 'Blitz bar vanilla', serving: '1 bar', kcal: 210, protein: 20, carbs: 6, fat: 7 }],
  week: null,
};

test('context lists both days of foods with ids, and saved foods with ids', async () => {
  const client = fakeClient(ok(out));
  await askClaude(v2, { client, model: 'm' });
  const last = client.calls[0].messages.at(-1).content;
  for (const s of ['"id":11', '"id":5', '"id":7', 'Blitz bar vanilla', '2026-11-08']) assert.ok(last.includes(s), s);
});

test('week totals included only when given', async () => {
  const client = fakeClient(ok(out));
  await askClaude({ ...v2, week: [{ day: '2026-11-02', kcal: 2000, protein: 120, carbs: 200, fat: 60 }] }, { client, model: 'm' });
  assert.match(client.calls[0].messages.at(-1).content, /Last 7 days/);
  await askClaude(v2, { client, model: 'm' });
  assert.doesNotMatch(client.calls[1].messages.at(-1).content, /Last 7 days/);
});

test('a photo goes first, as an image block, then the text', async () => {
  const client = fakeClient(ok(out));
  await askClaude({ ...v2, image: { media_type: 'image/jpeg', data: 'QUJD' } }, { client, model: 'm' });
  const content = client.calls[0].messages.at(-1).content;
  assert.deepEqual(content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } });
  assert.equal(content[1].type, 'text');
  assert.match(content[1].text, /egg/);
});

test('reply schema asks for saved, edits, copies, log_day and label', async () => {
  const client = fakeClient(ok(out));
  await askClaude(v2, { client, model: 'm' });
  const schema = client.calls[0].output_config.format.schema;
  for (const k of ['items', 'reply', 'goals', 'saved', 'edits', 'copies', 'log_day', 'label']) {
    assert.ok(schema.required.includes(k), k);
    assert.ok(schema.properties[k], k);
  }
});
