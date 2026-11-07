// Checks that numbers coming back from Claude (or the user) are sane before saving.

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inRange = (n, min, max) => isNum(n) && n >= min && n <= max;
const MACROS = ['protein', 'carbs', 'fat'];
// Optional extra nutrients and the largest believable amount in one food line.
// g: fiber, sugar, sat_fat. mg: sodium, cholesterol, potassium.
export const NUTRIENT_LIMITS = { fiber: 100, sugar: 300, sat_fat: 200, sodium: 20000, cholesterol: 3000, potassium: 20000 };

export function validateItem(item) {
  if (!item || typeof item !== 'object') return { ok: false, error: 'item is not an object' };
  const food = typeof item.food === 'string' ? item.food.trim() : '';
  if (food.length < 1 || food.length > 100) return { ok: false, error: 'bad food name' };
  // qty is only a label (calories and macros are what count), so be lenient:
  // missing or zero becomes 1; a weight like 200 (for 200g) is fine.
  const qty = isNum(item.qty) && item.qty > 0 ? item.qty : 1;
  if (qty > 10000) return { ok: false, error: 'bad qty' };
  if (!inRange(item.kcal, 0, 5000)) return { ok: false, error: 'bad kcal' };
  for (const m of MACROS) {
    if (!inRange(item[m], 0, 500)) return { ok: false, error: `bad ${m}` };
  }
  const macroKcal = 4 * item.protein + 4 * item.carbs + 9 * item.fat;
  if (macroKcal > item.kcal * 1.5 + 50) return { ok: false, error: 'macros do not match kcal' };
  const { kcal, protein, carbs, fat } = item;
  // A missing or unbelievable nutrient is stored as unknown (null), never a wrong 0,
  // and never fails the meal.
  const extras = Object.fromEntries(Object.entries(NUTRIENT_LIMITS)
    .map(([k, max]) => [k, inRange(item[k], 0, max) ? item[k] : null]));
  return { ok: true, item: { food, qty, kcal, protein, carbs, fat, ...extras } };
}

export function validateGoals(g) {
  if (!g || typeof g !== 'object') return { ok: false, error: 'goals is not an object' };
  if (!inRange(g.kcal, 500, 10000)) return { ok: false, error: 'bad kcal goal' };
  for (const m of MACROS) {
    if (!inRange(g[m], 0, 1000)) return { ok: false, error: `bad ${m} goal` };
  }
  return { ok: true, goals: { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat } };
}

export function validateClaudeResult(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('result is not an object');
  if (!Array.isArray(raw.items)) throw new Error('items is not an array');
  if (typeof raw.reply !== 'string' || !raw.reply.trim()) throw new Error('missing reply');
  const items = raw.items.map((it, i) => {
    const r = validateItem(it);
    if (!r.ok) throw new Error(`item ${i}: ${r.error}`);
    return r.item;
  }).filter((it) => it.kcal + it.protein + it.carbs + it.fat > 0); // all-zero rows add nothing but clutter
  // A bad goal change shouldn't throw away the food that came with it: drop just the goals.
  let goals = null;
  let goalsRejected = false;
  if (raw.goals != null) {
    const r = validateGoals(raw.goals);
    if (r.ok) goals = r.goals;
    else goalsRejected = true;
  }
  return { items, reply: raw.reply.trim(), goals, goalsRejected };
}

export function isValidDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
