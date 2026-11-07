import { route, HttpError } from '../lib/http.js';
import { checkPassword, createToken } from '../lib/auth.js';

export function loginHandler(body, env, nowMs) {
  // A short password could be guessed, and a guessed password spends your Claude credit.
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 12 || !env.TOKEN_SECRET) {
    console.error('Login disabled: APP_PASSWORD must be at least 12 characters and TOKEN_SECRET must be set.');
    throw new HttpError(500, 'Server is not configured');
  }
  if (!checkPassword(body?.password, env.APP_PASSWORD)) throw new HttpError(401, 'Wrong password');
  return { body: { token: createToken(env.TOKEN_SECRET, nowMs) } };
}

export default route({ methods: ['POST'], auth: false }, async (req) => loginHandler(req.body, process.env, Date.now()));
