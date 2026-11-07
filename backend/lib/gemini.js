// The only file that talks to the AI (Google Gemini, free tier).
// Returns the raw parsed JSON; chat.js validates it.

export const DEFAULT_MODEL = 'gemini-2.5-flash';

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
