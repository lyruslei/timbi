import { HttpError } from './http.js';

const MAX_IDS = 100;

// A list of 1–100 positive integer ids, or a 400.
export function checkIds(ids, what = 'foods') {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS
      || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw new HttpError(400, `Pick 1 to ${MAX_IDS} ${what}`);
  }
  return ids;
}
