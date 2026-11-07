// What the Nutrition screen shows. Pure functions so they can be tested in Node.

// FDA daily values. "reach" = aim to get at least this much; "limit" = stay under.
export const NUTRIENTS = [
  { key: 'fiber', label: 'Fiber', unit: 'g', ref: 28, kind: 'reach' },
  { key: 'sugar', label: 'Sugar', unit: 'g', ref: 50, kind: 'limit' },
  { key: 'sat_fat', label: 'Saturated fat', unit: 'g', ref: 20, kind: 'limit' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', ref: 2300, kind: 'limit' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', ref: 300, kind: 'limit' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', ref: 4700, kind: 'reach' },
];

const num = (n) => Math.round(n).toLocaleString('en-US');
const pctOf = (value, ref) => (ref > 0 ? Math.min(100, Math.round((value / ref) * 100)) : 0);

export function nutrientRows(nutrients) {
  return NUTRIENTS.map(({ key, label, unit, ref, kind }) => {
    const value = nutrients?.[key];
    const known = typeof value === 'number';
    return {
      key,
      label,
      text: known ? `${num(value)}${unit}` : '—',
      refText: `${kind === 'limit' ? 'limit' : 'of'} ${num(ref)}${unit}`,
      pct: known ? pctOf(value, ref) : 0,
      over: known && kind === 'limit' && value > ref,
    };
  });
}

export function macroRows(totals, goals) {
  const row = (label, key, unit, sep) => ({
    key,
    label,
    text: `${num(totals[key] || 0)} / ${num(goals[key] || 0)}${sep}${unit}`,
    pct: pctOf(totals[key] || 0, goals[key] || 0),
    over: goals[key] > 0 && (totals[key] || 0) > goals[key],
  });
  return [
    row('Calories', 'kcal', 'kcal', ' '),
    row('Protein', 'protein', 'g', ''),
    row('Carbs', 'carbs', 'g', ''),
    row('Fat', 'fat', 'g', ''),
  ];
}
