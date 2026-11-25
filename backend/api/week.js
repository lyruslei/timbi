import { route, HttpError } from '../lib/http.js';
import { isValidDay } from '../lib/validate.js';
import { sumTotals, sumNutrients } from '../lib/totals.js';
import { addDays } from '../lib/days.js';
import { deps } from '../lib/deps.js';

// GET ?start=YYYY-MM-DD: the 7 days from start (the app sends a Monday), each with
// its macro and nutrient totals, plus the daily goals. Days with nothing are zeros.
export async function weekHandler(req, store) {
  const start = req.query?.start;
  if (!isValidDay(start)) throw new HttpError(400, 'Bad day');
  const [goals, rows] = await Promise.all([store.getGoals(), store.getEntriesRange(start, addDays(start, 6))]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const entries = rows.filter((e) => e.day === day);
    return { day, logged: entries.length > 0, totals: sumTotals(entries), nutrients: sumNutrients(entries) };
  });
  return { body: { goals, days } };
}

export default route({ methods: ['GET'], auth: true }, (req) => weekHandler(req, deps().store));
