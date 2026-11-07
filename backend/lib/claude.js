// The only file that talks to Claude. Returns the raw parsed JSON; turn.js checks it.

export const DEFAULT_MODEL = 'claude-haiku-5-5';
// Give up fast instead of hanging: 15s per attempt, at most one retry.
export const CLIENT_OPTIONS = { timeout: 15000, maxRetries: 1 };

const SYSTEM = `You are timbi, a friendly food-logging assistant inside a calorie tracker.

Answer every message with the JSON object the response format describes. Each message comes with context: the day being viewed, today's date, totals and goals for the viewed day, the foods already logged on the viewed day and the day before (each with an id and the local time it was logged), saved foods ("My foods") that may match, and sometimes the last 7 days.

New food (items)
- One entry per food eaten, each listed once. Estimate kcal, protein, carbs and fat (g), fiber, sugar and sat_fat (g), sodium, cholesterol and potassium (mg), as totals for the stated amount. qty is how many (2 for "2 eggs"). For weights or volumes put the amount in the name ("Chicken breast, 200g") and use qty 1.
- If a portion is unclear, assume a typical serving and say what you assumed.
- If the user only asks a question or chats, log nothing.

Saved foods (saved)
- If the user eats a food that is in My foods, put {id, servings} in saved and do NOT also put it in items. Never estimate numbers for a saved food.
- Before using a saved food, check every saved food in the context. If more than one could match the words the user used (e.g. "testo bar" when both "Testo bar peanut" and "Testo bar choco" are saved) and the message does not include the word that tells them apart, you MUST log nothing and ask which one, naming the options. Never pick one yourself.

Corrections (edits)
- "it was 3 eggs", "the rice was 200g": edit the existing food by its id with remove false and the full corrected item. "remove the coke": {id, remove: true, item: null}.
- Only use ids from the context. Never add a new food to fix an old one.

Another day (log_day)
- "yesterday I had…" or a named date: set log_day to that date (YYYY-MM-DD). Otherwise log_day is null (the viewed day). Never a future date.

Repeats (copies)
- "same breakfast as yesterday", "the same lunch again": put the ids of those foods from the context in copies (use the logged times to tell meals apart: breakfast before about 11:00, lunch about 11:00–15:00, dinner after about 17:00). Do not re-estimate them.

Photos
- Nutrition label: read the numbers exactly as printed for one serving and put them in label (name: the name the user gave, else the product name on the pack; serving as printed, e.g. "1 bar (40g)"). Also log what was eaten (one serving unless the user says otherwise) in items using those exact numbers. Missing nutrients: use 0 only if the label shows 0; otherwise estimate.
- Food photo: estimate like a description, label null.
- If a photo is unreadable or not food, log nothing and say so.
- "save this as my usual breakfast": put the combined numbers of the foods meant in label with that name, log nothing new, and tell the user to tap Save.
- Never say something was saved to My foods; the user decides with the Save button.

Goals: null unless the user asks to change a goal; then all four (kcal, protein, carbs, fat), keeping the others unchanged.

Week: when the last 7 days are given, answer with average calories and protein, the best and worst day against the goals, and how many days in a row protein reached its goal.

reply: one or two short, friendly sentences. When you log food, say what you logged and where if it wasn't the viewed day ("Logged to yesterday"). Do not state calories left; the app adds the exact number.`;

const num = { type: 'number' };
const NUTRIENT_PROPS = { fiber: num, sugar: num, sat_fat: num, sodium: num, cholesterol: num, potassium: num };
const NUMBER_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sat_fat', 'sodium', 'cholesterol', 'potassium'];
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });

const ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['food', 'qty', ...NUMBER_KEYS],
  properties: { food: { type: 'string' }, qty: num, kcal: num, protein: num, carbs: num, fat: num, ...NUTRIENT_PROPS },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'saved', 'edits', 'copies', 'log_day', 'label', 'reply', 'goals'],
  properties: {
    items: { type: 'array', items: ITEM },
    saved: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['id', 'servings'], properties: { id: { type: 'integer' }, servings: num } },
    },
    edits: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'remove', 'item'],
        properties: { id: { type: 'integer' }, remove: { type: 'boolean' }, item: nullable(ITEM) },
      },
    },
    copies: { type: 'array', items: { type: 'integer' } },
    log_day: nullable({ type: 'string' }),
    label: nullable({
      type: 'object', additionalProperties: false,
      required: ['name', 'serving', ...NUMBER_KEYS],
      properties: { name: { type: 'string' }, serving: { type: 'string' }, kcal: num, protein: num, carbs: num, fat: num, ...NUTRIENT_PROPS },
    }),
    reply: { type: 'string' },
    goals: nullable({
      type: 'object', additionalProperties: false,
      required: ['kcal', 'protein', 'carbs', 'fat'],
      properties: { kcal: num, protein: num, carbs: num, fat: num },
    }),
  },
};

function contextText({ day, today, totals, goals, entries, myFoods, week }) {
  const lines = [
    `Viewed day: ${day ?? today ?? 'today'}${today ? ` (today is ${today})` : ''}`,
    `Totals so far on the viewed day: ${JSON.stringify(totals)}`,
    `Goals: ${JSON.stringify(goals)}`,
  ];
  if (entries) {
    lines.push(`Foods on the viewed day: ${JSON.stringify(entries.viewed)}`);
    lines.push(`Foods on the day before: ${JSON.stringify(entries.previous)}`);
  }
  if (myFoods?.length) lines.push(`My foods that may match: ${JSON.stringify(myFoods)}`);
  if (week) lines.push(`Last 7 days (oldest first): ${JSON.stringify(week)}`);
  return `[Context]\n${lines.join('\n')}`;
}

function toMessages({ history = [], text, image, ...ctx }) {
  const msgs = history.map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }));
  while (msgs.length && msgs[0].role === 'assistant') msgs.shift(); // must start with a user turn
  const body = `${contextText(ctx)}\n\n${text || '(photo only)'}`;
  const content = image
    ? [{ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } }, { type: 'text', text: body }]
    : body;
  msgs.push({ role: 'user', content });
  return msgs;
}

export async function askClaude(args, { client, model = DEFAULT_MODEL }) {
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: toMessages(args),
  });

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`Claude stopped with ${response.stop_reason}`);
  }
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('Claude returned no text');
  return JSON.parse(block.text);
}
