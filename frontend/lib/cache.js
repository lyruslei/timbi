// Remembers the last day the app showed (totals, goals, chat) and the streak, so
// opening the app can draw them at once while the fresh copy loads.
const DAY_KEY = 'timbi.lastDay';
const STREAK_KEY = 'timbi.streak';

const defaultStore = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

function read(store, key) {
  try { return JSON.parse(store?.getItem(key) ?? 'null'); } catch { return null; }
}
function write(store, key, value) {
  try { store?.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: just no cache */ }
}

export function readDay(day, store = defaultStore()) {
  const c = read(store, DAY_KEY);
  return c && c.day === day && c.data ? c.data : null;
}

export function writeDay(day, data, store = defaultStore()) {
  const { totals, goals, messages } = data;
  write(store, DAY_KEY, { day, data: { totals, goals, messages } });
}

// After a chat turn: add the two new messages and the new totals to the cached day.
export function patchDay(day, { user, reply, totals, goals }, store = defaultStore()) {
  const c = readDay(day, store);
  if (!c) return;
  writeDay(day, { totals, goals: goals ?? c.goals, messages: [...c.messages, { role: 'user', text: user }, { role: 'bot', text: reply }] }, store);
}

export function readStreak(day, store = defaultStore()) {
  const c = read(store, STREAK_KEY);
  return c && c.day === day && Number.isFinite(c.streak) ? c.streak : null;
}

export function writeStreak(day, streak, store = defaultStore()) {
  write(store, STREAK_KEY, { day, streak });
}

export function clearCache(store = defaultStore()) {
  try { store?.removeItem(DAY_KEY); store?.removeItem(STREAK_KEY); } catch { /* ignore */ }
}
