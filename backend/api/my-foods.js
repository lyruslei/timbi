import { route, HttpError } from '../lib/http.js';
import { validateMyFood } from '../lib/myfoods.js';
import { checkIds } from '../lib/ids.js';
import { deps } from '../lib/deps.js';

function checkFood(food) {
  const r = validateMyFood(food);
  if (!r.ok) throw new HttpError(400, r.error);
  return r.food;
}

// GET: list. POST {food}: save. PUT {id, food}: edit. DELETE {ids}: remove.
export async function myFoodsHandler(req, store) {
  if (req.method === 'GET') return { body: { foods: await store.listMyFoods() } };
  if (req.method === 'POST') return { body: { food: await store.addMyFood(checkFood(req.body?.food)) } };
  if (req.method === 'PUT') {
    const id = req.body?.id;
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Bad id');
    return { body: { food: await store.updateMyFood(id, checkFood(req.body?.food)) } };
  }
  return { body: { removed: await store.removeMyFoods(checkIds(req.body?.ids, 'saved foods')) } };
}

export default route({ methods: ['GET', 'POST', 'PUT', 'DELETE'], auth: true }, (req) => myFoodsHandler(req, deps().store));
