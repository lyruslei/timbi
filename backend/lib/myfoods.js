// Saved foods ("My foods"): validation and matching against what the user typed.
import { validateItem } from './validate.js';

export function validateMyFood(f) {
  if (!f || typeof f !== 'object') return { ok: false, error: 'food is not an object' };
  const name = typeof f.name === 'string' ? f.name.trim() : '';
  if (name.length < 1 || name.length > 60) return { ok: false, error: 'Name must be 1 to 60 characters' };
  const serving = typeof f.serving === 'string' && f.serving.trim() ? f.serving.trim() : '1 serving';
  if (serving.length > 40) return { ok: false, error: 'Serving must be at most 40 characters' };
  // Same number rules as a logged food (one serving).
  const r = validateItem({ ...f, food: name, qty: 1 });
  if (!r.ok) return r;
  const { food, qty, ...numbers } = r.item;
  return { ok: true, food: { name, serving, ...numbers } };
}

const words = (s) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length >= 3) ?? [];
const same = (a, b) => a === b || a.startsWith(b) || b.startsWith(a); // "bars" ~ "bar"

// Saved foods whose name shares a word (3+ letters) with the message, best first.
export function matchMyFoods(text, foods, max = 10) {
  const lower = String(text).toLowerCase();
  const textWords = words(lower);
  return foods
    .map((f) => {
      const hits = words(f.name).filter((fw) => textWords.some((tw) => same(tw, fw))).length;
      const whole = lower.includes(f.name.toLowerCase()) ? 10 : 0;
      return { f, score: hits + whole };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
    .slice(0, max)
    .map((x) => x.f);
}
