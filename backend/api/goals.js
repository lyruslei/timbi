import { route, HttpError } from '../lib/http.js';
import { validateGoals } from '../lib/validate.js';
import { deps } from '../lib/deps.js';

export async function goalsHandler(req, store) {
  if (req.method === 'PUT') {
    const r = validateGoals(req.body);
    if (!r.ok) throw new HttpError(400, r.error);
    await store.setGoals(r.goals);
    return { body: { goals: r.goals } };
  }
  return { body: { goals: await store.getGoals() } };
}

export default route({ methods: ['GET', 'PUT'], auth: true }, (req) => goalsHandler(req, deps().store));
