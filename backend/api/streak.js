import { route, HttpError } from '../lib/http.js';
import { isValidDay } from '../lib/validate.js';
import { computeStreak } from '../lib/streak.js';
import { addDays } from '../lib/days.js';
import { deps } from '../lib/deps.js';

const LOOKBACK_DAYS = 400;

export async function streakHandler(req, store) {
  const today = req.query?.today;
  if (!isValidDay(today)) throw new HttpError(400, 'Bad day');
  const days = await store.getLoggedDays(addDays(today, -LOOKBACK_DAYS), today);
  return { body: { streak: computeStreak(days, today) } };
}

export default route({ methods: ['GET'], auth: true }, (req) => streakHandler(req, deps().store));
