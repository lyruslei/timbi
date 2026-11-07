// One chat turn: gather context, ask the AI, check its reply, save everything
// in one transaction, return fresh totals for the day being viewed.
import { isValidDay } from './validate.js';
import { validateTurn } from './turn.js';
import { matchMyFoods } from './myfoods.js';
import { describeEntries, expandSaved, isWeekQuestion, weekTotals } from './context.js';
import { sumTotals } from './totals.js';
import { addDays } from './days.js';
import { HttpError } from './http.js';

export const FAIL_REPLY = "Couldn't log that — try again.";
export const DAY_REFUSED_REPLY = 'I can only log food from today back to 60 days ago.';
export const PHOTO_FAIL_REPLY = "Couldn't read that photo. Try a clearer, closer shot.";
export const GOALS_REJECTED_NOTE = "I didn't change your goals: calories must be 500–10,000 and each macro 0–1,000g.";
const MAX_TEXT = 1000;
const HISTORY = 10;
const PHOTO = '📷';
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// The viewed day's foods as they will be after this turn is saved.
function dayAfterTurn(day, viewed, previous, turn, newItems) {
  const rows = new Map([...viewed, ...previous].map((e) => [e.id, { ...e, day: viewed.includes(e) ? day : null }]));
  // Copies are made before edits (same order as log_turn_v2), so "move" = copy + remove works.
  const copied = turn.copies.map((id) => rows.get(id)).filter(Boolean);
  for (const e of turn.edits) {
    if (e.remove) rows.delete(e.id);
    else if (rows.has(e.id)) rows.set(e.id, { ...rows.get(e.id), ...e.item });
  }
  const after = [...rows.values()].filter((e) => e.day === day);
  if (turn.logDay === day) {
    after.push(...newItems);
    after.push(...copied);
  }
  return after;
}

export async function handleChat({ text, day, today, image = null, tz = 0 } = {}, { ai, store }) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean && !image) throw new HttpError(400, 'Message is empty');
  if (clean.length > MAX_TEXT) throw new HttpError(400, `Message is over ${MAX_TEXT} characters`);
  if (!isValidDay(day)) throw new HttpError(400, 'Bad day');
  const now = today ?? day;
  if (!isValidDay(now)) throw new HttpError(400, 'Bad today');
  if (day > now) throw new HttpError(400, "Can't log food in the future");
  const tzOffset = Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0;

  const week = isWeekQuestion(clean);
  const [goals, viewed, previous, messages, savedFoods, weekRows] = await Promise.all([
    store.getGoals(),
    store.getEntries(day),
    store.getEntries(addDays(day, -1)),
    store.getMessages(day),
    store.listMyFoods(),
    week ? store.getEntriesRange(addDays(now, -6), now) : Promise.resolve(null),
  ]);
  const totals = sumTotals(viewed);
  const myFoods = matchMyFoods(clean, savedFoods);
  const entries = { viewed: describeEntries(viewed, tzOffset), previous: describeEntries(previous, tzOffset) };

  let raw;
  let turn;
  try {
    raw = await ai({
      text: clean, image, history: messages.slice(-HISTORY), totals, goals, entries, myFoods,
      week: week ? weekTotals(weekRows, now) : null, day, today: now,
    });
    turn = validateTurn(raw, {
      allowedEntryIds: new Set([...viewed, ...previous].map((e) => e.id)),
      allowedFoodIds: new Set(myFoods.map((f) => f.id)),
      day,
      today: now,
    });
  } catch (err) {
    console.error('chat failed:', err?.message ?? err, raw === undefined ? '' : JSON.stringify(raw).slice(0, 1500));
    // The AI service refusing the image itself (corrupt, too small) isn't worth a blind retry.
    const reply = err?.name === 'DayRefused' ? DAY_REFUSED_REPLY : image && err?.status === 400 ? PHOTO_FAIL_REPLY : FAIL_REPLY;
    return { reply, totals, goals, failed: true, logDay: day, saveOffer: null };
  }

  const newItems = [...turn.items, ...expandSaved(turn.saved, myFoods)];
  let reply = turn.goalsRejected ? `${turn.reply} ${GOALS_REJECTED_NOTE}` : turn.reply;
  // The AI's arithmetic isn't reliable, so the exact calories left come from the data.
  const viewedIds = new Set(viewed.map((e) => e.id));
  const changedViewedDay = turn.edits.some((e) => viewedIds.has(e.id))
    || (turn.logDay === day && (newItems.length > 0 || turn.copies.length > 0));
  if (changedViewedDay) {
    const goalKcal = (turn.goals ?? goals).kcal;
    const eaten = sumTotals(dayAfterTurn(day, viewed, previous, turn, newItems)).kcal;
    reply += eaten > goalKcal ? ` (${fmt(eaten - goalKcal)} kcal over)` : ` (${fmt(goalKcal - eaten)} kcal left)`;
  }
  const userText = image ? (clean ? `${clean} ${PHOTO}` : PHOTO) : clean;
  // New foods, edits, copies, goals and messages are written together or not at all.
  await store.logTurnV2({
    logDay: turn.logDay,
    msgDay: day,
    items: newItems,
    copyIds: turn.copies,
    removeIds: turn.edits.filter((e) => e.remove).map((e) => e.id),
    updates: turn.edits.filter((e) => !e.remove).map((e) => ({ id: e.id, ...e.item })),
    goals: turn.goals,
    messages: [{ role: 'user', text: userText }, { role: 'bot', text: reply }],
  });

  return {
    failed: false,
    reply,
    totals: sumTotals(await store.getEntries(day)),
    goals: turn.goals ?? goals,
    logDay: turn.logDay,
    saveOffer: turn.label,
  };
}
