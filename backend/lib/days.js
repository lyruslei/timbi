// UTC-safe day math for 'YYYY-MM-DD' strings (same as the frontend's lib/days.js).
const pad = (n) => String(n).padStart(2, '0');

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
