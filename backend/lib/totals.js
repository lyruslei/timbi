// Adds up a day's entries. kcal → whole number, macros → 1 decimal.

const round1 = (n) => Math.round(n * 10) / 10;

export function sumTotals(entries) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
  }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

const NUTRIENT_KEYS = ['fiber', 'sugar', 'sat_fat', 'sodium', 'cholesterol', 'potassium'];
const MG = new Set(['sodium', 'cholesterol', 'potassium']);

// Adds up the extra nutrients that are known. A nutrient no food has data for is
// null; partial is true when some foods (e.g. logged before nutrients were
// tracked) have no data, so the screen can say the total may be low.
export function sumNutrients(entries) {
  const out = { partial: false };
  for (const k of NUTRIENT_KEYS) {
    const known = entries.map((e) => e[k]).filter((v) => typeof v === 'number');
    if (known.length && known.length < entries.length) out.partial = true;
    const sum = known.reduce((s, v) => s + v, 0);
    out[k] = known.length ? (MG.has(k) ? Math.round(sum) : round1(sum)) : null;
  }
  const { partial, ...rest } = out;
  return { ...rest, partial };
}
