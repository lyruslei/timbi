// Days in a row with at least one food, ending today, or yesterday if today
// has nothing logged yet (so the streak doesn't read 0 every morning).
import { addDays } from './days.js';

export function computeStreak(days, today) {
  const logged = new Set(days.filter((d) => d <= today));
  let day = logged.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (logged.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
