// The only file that talks to the AI (Google Gemini, free tier).
// Returns the raw parsed JSON; chat.js validates it.

// Tried in order. If Google says a model is busy (503), rate-limited (429) or it
// times out, the next one is tried, so a busy moment doesn't stall the chat.
export const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
export const DEFAULT_MODEL = MODELS[0];
// Per-attempt limit and no hidden SDK retries; pass these when creating the client.
export const HTTP_OPTIONS = { timeout: 15000, retryOptions: { attempts: 1 } };

const SYSTEM = `You are Bitelog, a friendly food-logging assistant inside a calorie tracker.

For every user message, answer with the JSON object the response schema describes:
- items: one entry per food the user says they ate or drank. Estimate kcal, protein, carbs and fat in grams. The numbers are totals for the stated quantity, not per unit. qty is how many of that food (e.g. 2 for "2 eggs"; 1 for "a bowl of rice").
- If a portion is unclear, assume a typical serving and say what you assumed in reply.
- If the user only asks a question or chats, return items as an empty list.
- goals: null, unless the user asks to change a daily goal. Then return all four goals (kcal, protein, carbs, fat), keeping the ones they did not mention unchanged.
- reply: one or two short, friendly sentences. When you log food, say what you logged and how many calories are left today.

Each user message comes with today's totals so far (before this message) and the current goals.`;

const num = { type: 'number' };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'reply', 'goals'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['food', 'qty', 'kcal', 'protein', 'carbs', 'fat'],
        properties: { food: { type: 'string' }, qty: num, kcal: num, protein: num, carbs: num, fat: num },
      },
    },
    reply: { type: 'string' },
    goals: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['kcal', 'protein', 'carbs', 'fat'],
          properties: { kcal: num, protein: num, carbs: num, fat: num },
        },
        { type: 'null' },
      ],
    },
  },
};

function toContents(history, text, totals, goals) {
  const contents = history.map((m) => ({ role: m.role === 'bot' ? 'model' : 'user', parts: [{ text: m.text }] }));
  while (contents.length && contents[0].role === 'model') contents.shift(); // must start with a user turn
  const context = `[Today so far: ${JSON.stringify(totals)}. Goals: ${JSON.stringify(goals)}]`;
  contents.push({ role: 'user', parts: [{ text: `${context}\n\n${text}` }] });
  return contents;
}

export async function askGemini({ text, history = [], totals, goals }, { client, model = DEFAULT_MODEL }) {
  const response = await client.models.generateContent({
    model,
    contents: toContents(history, text, totals, goals),
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: SCHEMA,
    },
  });

  const reason = response.candidates?.[0]?.finishReason;
  if (reason && reason !== 'STOP') throw new Error(`Gemini stopped with ${reason}`);
  if (!response.text) throw new Error('Gemini returned no text');
  return JSON.parse(response.text);
}

function isBusy(err) {
  if (err?.status === 503 || err?.status === 429) return true;
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return true;
  return /timed? ?out|timeout|aborted/i.test(String(err?.message));
}

export async function askWithFallback(args, { client, models = MODELS }) {
  let lastErr;
  for (const model of models) {
    try {
      return await askGemini(args, { client, model });
    } catch (err) {
      if (!isBusy(err)) throw err;
      console.error(`${model} busy, trying next:`, err.status ?? err.name);
      lastErr = err;
    }
  }
  throw lastErr;
}
