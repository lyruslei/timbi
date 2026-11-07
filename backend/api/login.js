import { route, HttpError } from '../lib/http.js';
import { checkPassword, createToken } from '../lib/auth.js';

export function loginHandler(body, env, nowMs) {
  if (!env.APP_PASSWORD || !env.TOKEN_SECRET) throw new HttpError(500, 'Server is not configured');
  if (!checkPassword(body?.password, env.APP_PASSWORD)) throw new HttpError(401, 'Wrong password');
  return { body: { token: createToken(env.TOKEN_SECRET, nowMs) } };
}

export default route({ methods: ['POST'], auth: false }, async (req) => loginHandler(req.body, process.env, Date.now()));
