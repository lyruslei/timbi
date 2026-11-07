import { route, HttpError } from '../lib/http.js';
import { isValidDay } from '../lib/validate.js';
import { sumTotals, sumNutrients } from '../lib/totals.js';
import { deps } from '../lib/deps.js';

export async function todayHandler(req, store) {
  const day = req.query?.day;
  if (!isValidDay(day)) throw new HttpError(400, 'Bad day');
  const [goals, entries, messages] = await Promise.all([store.getGoals(), store.getEntries(day), store.getMessages(day)]);
  return {
    body: {
      totals: sumTotals(entries),
      nutrients: sumNutrients(entries),
      entries: entries.map(({ id, food, qty, kcal }) => ({ id, food, qty, kcal })),
      goals,
      messages,
    },
  };
}

export default route({ methods: ['GET'], auth: true }, (req) => todayHandler(req, deps().store));
