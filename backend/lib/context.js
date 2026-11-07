// What gets sent to the AI alongside the message, and turning its pointers
// (saved foods × servings) back into exact numbers.
import { addDays } from './days.js';

const NUTRIENTS = ['fiber', 'sugar', 'sat_fat', 'sodium', 'cholesterol', 'potassium'];
const round1 = (n) => Math.round(n * 10) / 10;
const pad = (n) => String(n).padStart(2, '0');

export const isWeekQuestion = (text) =>
  /\b(this|last|past)\s+week\b|\bweekly\b|\b(last|past)\s+7\s+days\b/i.test(String(text));

// Foods for the AI to point at: id, local time logged, name and numbers.
// tzOffset is the browser's getTimezoneOffset() (minutes; UTC+8 → -480).
export function describeEntries(rows, tzOffset = 0) {
  return rows.map((e) => {
    const local = new Date(new Date(e.created_at).getTime() - tzOffset * 60000);
    return {
      id: e.id,
      time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
      food: e.food,
      qty: e.qty,
      kcal: Math.round(e.kcal),
      protein: round1(e.protein),
      carbs: round1(e.carbs),
      fat: round1(e.fat),
    };
  });
}

// Saved food × servings, from the stored numbers only (never re-estimated).
export function expandSaved(saved, myFoods) {
  const byId = new Map(myFoods.map((f) => [f.id, f]));
  return saved.map(({ id, servings }) => {
    const f = byId.get(id);
    const times = (v) => (typeof v === 'number' ? round1(v * servings) : null);
    return {
      food: servings === 1 ? `${f.name}, ${f.serving}` : `${f.name}, ${servings} × ${f.serving}`,
      qty: servings,
      kcal: times(f.kcal),
      protein: times(f.protein),
      carbs: times(f.carbs),
      fat: times(f.fat),
      ...Object.fromEntries(NUTRIENTS.map((k) => [k, times(f[k])])),
    };
  });
}

// Daily totals for the 7 days ending today (oldest first); days with nothing are zeros.
export function weekTotals(rows, today) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return days.map((day) => {
    const t = { day, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const e of rows) {
      if (e.day !== day) continue;
      t.kcal += e.kcal; t.protein += e.protein; t.carbs += e.carbs; t.fat += e.fat;
    }
    return { day, kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
  });
}
