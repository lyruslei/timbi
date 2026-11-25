// What the Week page and the weekly Nutrients view show. Pure functions so they can
// be tested in Node. A week is Monday to Sunday. Days with nothing logged count as 0.
// "Pace" compares only finished days (before today) against their goals, so today
// never counts against you while you're still eating.
import { addDays } from './days.js';
import { NUTRIENTS } from './nutrition.js';

const num = (n) => Math.round(n).toLocaleString('en-US');
const pctOf = (value, ref) => (ref > 0 ? Math.min(100, Math.round((value / ref) * 100)) : 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function weekStart(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // Sunday = 0
  return addDays(day, -((dow + 6) % 7));
}

export function weekTitle(start) {
  const f = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  return `${f(start)} – ${f(addDays(start, 6))}`;
}

// How many of the 7 days are over, and how many are left (today included).
export function weekClock(days, today) {
  const finished = days.filter((d) => d.day < today).length;
  const left = days.filter((d) => d.day >= today).length;
  return { finished, left, dayNumber: Math.min(7, finished + 1) };
}

// The small tag next to a total. reach = more is good, limit = stay under.
export function paceTag(diff, kind, unit, finished) {
  if (finished === 0) return null;
  const n = Math.round(diff);
  if (n === 0) return { text: 'on pace', tone: 'ok' };
  const amount = `${num(Math.abs(n))}${unit}`;
  if (kind === 'reach') return n > 0 ? { text: `${amount} ahead`, tone: 'ok' } : { text: `${amount} behind`, tone: 'warn' };
  return n > 0 ? { text: `${amount} over pace`, tone: 'warn' } : { text: `${amount} under pace`, tone: 'ok' };
}

// The line under a bar: what's left and how much per day gets you there.
function leftText(total, budget, kind, unit, left) {
  const rest = budget - total;
  if (kind === 'reach') {
    if (rest <= 0) return "You've hit the week's goal.";
    if (left === 0) return `Finished ${num(rest)}${unit} short.`;
    return `${num(rest)}${unit} to go · ${plural(left, 'day')} left · about ${num(rest / left)}${unit}/day`;
  }
  if (rest < 0) return `${num(-rest)}${unit} over the week's budget.`;
  if (left === 0) return `Finished ${num(rest)}${unit} under.`;
  return `${num(rest)}${unit} left · about ${num(rest / left)}${unit}/day`;
}

const MACROS = [
  { key: 'protein', label: 'Protein', unit: 'g', kind: 'reach' },
  { key: 'kcal', label: 'Calories', unit: ' kcal', kind: 'limit' },
  { key: 'carbs', label: 'Carbs', unit: 'g', kind: 'limit' },
  { key: 'fat', label: 'Fat', unit: 'g', kind: 'limit' },
];

export function weekMacros(days, goals, today) {
  const { finished, left } = weekClock(days, today);
  return MACROS.map(({ key, label, unit, kind }) => {
    const goal = goals[key] || 0;
    const total = days.reduce((s, d) => s + (d.totals[key] || 0), 0);
    const done = days.filter((d) => d.day < today).reduce((s, d) => s + (d.totals[key] || 0), 0);
    const budget = goal * 7;
    return {
      key,
      label,
      total: num(total),
      budget: `${num(budget)}${unit}`,
      pct: pctOf(total, budget),
      over: kind === 'limit' && total > budget,
      tag: paceTag(done - goal * finished, kind, unit, finished),
      left: leftText(total, budget, kind, unit, left),
    };
  });
}

// One column per day for the "by day" chart. Height is relative to the goal line.
export function dayColumns(days, key, goal, today) {
  const top = Math.max(goal * 1.3, ...days.map((d) => d.totals[key] || 0), 1);
  return days.map((d) => {
    const value = d.totals[key] || 0;
    const state = d.day > today ? 'future' : d.day === today ? 'today' : value >= goal ? 'hit' : 'under';
    return { day: d.day, letter: 'MTWTFSS'[days.indexOf(d)], value: Math.round(value), height: Math.round((value / top) * 100), state };
  });
}

export function goalLinePct(days, key, goal) {
  const top = Math.max(goal * 1.3, ...days.map((d) => d.totals[key] || 0), 1);
  return Math.round((goal / top) * 100);
}

export function hitLine(days, key, goal, unit, today) {
  const done = days.filter((d) => d.day < today);
  if (!done.length) return 'First day of the week. Finished days show up here.';
  const hits = done.filter((d) => (d.totals[key] || 0) >= goal).length;
  return `Hit ${num(goal)}${unit} on ${hits} of ${plural(done.length, 'finished day')}.`;
}

// Weekly nutrients, split into "get enough" and "stay under".
export function weekNutrients(days, today) {
  const { finished, left } = weekClock(days, today);
  const rows = NUTRIENTS.map(({ key, label, unit, ref, kind }) => {
    const known = days.map((d) => d.nutrients?.[key]).filter((v) => typeof v === 'number');
    const total = known.reduce((s, v) => s + v, 0);
    const done = days.filter((d) => d.day < today).reduce((s, d) => s + (d.nutrients?.[key] || 0), 0);
    const budget = ref * 7;
    return {
      key,
      label,
      kind,
      text: known.length ? `${num(total)}${unit}` : '—',
      refText: `/ ${num(budget)}${unit}`,
      pct: pctOf(total, budget),
      over: kind === 'limit' && total > budget,
      tag: known.length ? paceTag(done - ref * finished, kind, unit, finished) : null,
      avg: finished ? `avg ${num(done / finished)}${unit}/day · ${kind === 'reach' ? 'aim' : 'limit'} ${num(ref)}` : `${kind === 'reach' ? 'aim' : 'limit'} ${num(ref)}${unit}/day`,
      left: known.length ? leftText(total, budget, kind, unit, left) : '',
    };
  });
  const partial = days.some((d) => d.nutrients?.partial || (d.logged && NUTRIENTS.every((n) => d.nutrients?.[n.key] == null)));
  return { reach: rows.filter((r) => r.kind === 'reach'), limit: rows.filter((r) => r.kind === 'limit'), partial };
}
