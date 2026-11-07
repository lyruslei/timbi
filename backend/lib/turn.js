// Checks one full AI reply (v2). The AI only *points at* things (saved foods,
// entries to fix or copy, a day); anything it points at must have been sent to
// it in this request, or the whole turn is refused.
import { validateClaudeResult, validateItem, isValidDay } from './validate.js';
import { validateMyFood } from './myfoods.js';
import { addDays } from './days.js';

const MAX_DAYS_BACK = 60;
const MAX_SERVINGS = 50;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function list(raw, key) {
  if (raw[key] == null) return [];
  if (!Array.isArray(raw[key])) throw new Error(`${key} is not an array`);
  return raw[key];
}

export function validateTurn(raw, { allowedEntryIds, allowedFoodIds, day, today }) {
  const base = validateClaudeResult(raw);

  const saved = list(raw, 'saved').map((s, i) => {
    if (!allowedFoodIds.has(s?.id)) throw new Error(`saved ${i}: unknown saved food`);
    if (!isNum(s.servings) || s.servings <= 0 || s.servings > MAX_SERVINGS) throw new Error(`saved ${i}: bad servings`);
    return { id: s.id, servings: s.servings };
  });

  const edits = list(raw, 'edits').map((e, i) => {
    if (!allowedEntryIds.has(e?.id)) throw new Error(`edit ${i}: unknown entry`);
    if (e.remove === true) return { id: e.id, remove: true };
    if (!e.item) throw new Error(`edit ${i}: nothing to change`);
    const r = validateItem(e.item);
    if (!r.ok) throw new Error(`edit ${i}: ${r.error}`);
    return { id: e.id, item: r.item };
  });

  const copies = [...new Set(list(raw, 'copies').map((id, i) => {
    if (!allowedEntryIds.has(id)) throw new Error(`copy ${i}: unknown entry`);
    return id;
  }))];

  const oldest = addDays(today, -MAX_DAYS_BACK);
  const logDay = isValidDay(raw.log_day) && raw.log_day <= today && raw.log_day >= oldest ? raw.log_day : day;

  // A misread label must not cost the user their logged food: just don't offer to save it.
  let label = null;
  if (raw.label != null) {
    const r = validateMyFood(raw.label);
    if (r.ok) label = r.food;
  }

  return { ...base, saved, edits, copies, logDay, label };
}
