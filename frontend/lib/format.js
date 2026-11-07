// Pure helpers for the charts. No DOM here so they can be tested in Node.

const pad = (n) => String(n).padStart(2, '0');

export function localDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function ringData(totals, goals) {
  const eaten = Math.round(totals.kcal || 0);
  const goal = goals.kcal || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((eaten / goal) * 1000) / 10) : 0;
  return { eaten, left: Math.max(0, Math.round(goal - eaten)), over: goal > 0 && eaten > goal, pct };
}

const KEYS = ['protein', 'carbs', 'fat'];

export function macroSplit(totals) {
  const grams = Object.fromEntries(KEYS.map((k) => [k, totals[k] || 0]));
  const sum = KEYS.reduce((s, k) => s + grams[k], 0);
  if (sum <= 0) return { grams, pct: { protein: 0, carbs: 0, fat: 0 }, empty: true };

  // Largest-remainder rounding so the three percentages always add up to 100.
  const raw = KEYS.map((k) => ({ k, v: (grams[k] / sum) * 100 }));
  const floors = raw.map((r) => ({ ...r, f: Math.floor(r.v) }));
  let left = 100 - floors.reduce((s, r) => s + r.f, 0);
  [...floors].sort((a, b) => (b.v - b.f) - (a.v - a.f)).forEach((r) => {
    if (left > 0) { r.f += 1; left -= 1; }
  });
  const pct = Object.fromEntries(floors.map((r) => [r.k, r.f]));
  return { grams, pct, empty: false };
}
