import { route, HttpError } from '../lib/http.js';
import { isValidDay } from '../lib/validate.js';
import { deps } from '../lib/deps.js';

const MAX_IDS = 100;

function checkIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS
      || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw new HttpError(400, `Pick 1 to ${MAX_IDS} foods`);
  }
  return ids;
}

// PATCH {ids, day}: move foods to another day. DELETE {ids}: remove foods.
export async function entriesHandler(req, store) {
  const ids = checkIds(req.body?.ids);
  if (req.method === 'PATCH') {
    if (!isValidDay(req.body.day)) throw new HttpError(400, 'Bad day');
    return { body: { moved: await store.moveEntries(ids, req.body.day) } };
  }
  return { body: { removed: await store.removeEntries(ids) } };
}

export default route({ methods: ['PATCH', 'DELETE'], auth: true }, (req) => entriesHandler(req, deps().store));
