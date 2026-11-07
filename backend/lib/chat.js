// One chat turn: ask Claude, validate, save, return fresh totals.
import { validateClaudeResult, isValidDay } from './validate.js';
import { sumTotals } from './totals.js';
import { HttpError } from './http.js';

export const FAIL_REPLY = "Couldn't log that — try again.";
const MAX_TEXT = 1000;
const HISTORY = 10;

export async function handleChat({ text, day } = {}, { claude, store }) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) throw new HttpError(400, 'Message is empty');
  if (clean.length > MAX_TEXT) throw new HttpError(400, `Message is over ${MAX_TEXT} characters`);
  if (!isValidDay(day)) throw new HttpError(400, 'Bad day');

  const [goals, entries, messages] = await Promise.all([
    store.getGoals(), store.getEntries(day), store.getMessages(day),
  ]);
  const totals = sumTotals(entries);

  let result;
  try {
    const raw = await claude({ text: clean, history: messages.slice(-HISTORY), totals, goals });
    result = validateClaudeResult(raw);
  } catch (err) {
    console.error('chat failed:', err);
    return { reply: FAIL_REPLY, totals, goals };
  }

  if (result.items.length) await store.addEntries(day, result.items);
  if (result.goals) await store.setGoals(result.goals);
  await store.addMessages(day, [{ role: 'user', text: clean }, { role: 'bot', text: result.reply }]);

  return {
    reply: result.reply,
    totals: sumTotals([...entries, ...result.items]),
    goals: result.goals ?? goals,
  };
}
