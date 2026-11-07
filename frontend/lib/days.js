// Date helpers for the day picker. Days are 'YYYY-MM-DD' strings in local time.
// Uses UTC math internally so daylight-saving changes never skip or repeat a day.

const pad = (n) => String(n).padStart(2, '0');
const toUTC = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

export function addDays(day, n) {
  const dt = toUTC(day);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

// String comparison is safe for zero-padded YYYY-MM-DD.
export const isFuture = (day, today) => day > today;

export function dayLabel(day, today) {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return toUTC(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function monthTitle(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Weeks (Sunday first) for one month; days outside the month are null.
export function monthGrid(year, monthIndex) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(monthIndex + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
