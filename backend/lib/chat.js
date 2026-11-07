// One chat turn: ask Claude, validate, save, return fresh totals.
import { validateClaudeResult, isValidDay } from './validate.js';
import { sumTotals } from './totals.js';
import { HttpError } from './http.js';

export const FAIL_REPLY = "Couldn't log that — try again.";
export const GOALS_REJECTED_NOTE = "I didn't change your goals: calories must be 500–10,000 and each macro 0–1,000g.";
const MAX_TEXT = 1000;
const HISTORY = 10;

export async function handleChat({ text, day } = {}, { ai, store }) {
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
    const raw = await ai({ text: clean, history: messages.slice(-HISTORY), totals, goals });
    result = validateClaudeResult(raw);
  } catch (err) {
    console.error('chat failed:', err);
    return { reply: FAIL_REPLY, totals, goals, failed: true };
  }

  const reply = result.goalsRejected ? `${result.reply} ${GOALS_REJECTED_NOTE}` : result.reply;
  // Entries, goals and messages are written together or not at all, so a retry never double-logs.
  await store.logTurn(day, {
    items: result.items,
    goals: result.goals,
    messages: [{ role: 'user', text: clean }, { role: 'bot', text: reply }],
  });

  return {
    failed: false,
    reply,
    totals: sumTotals([...entries, ...result.items]),
    goals: result.goals ?? goals,
  };
}
