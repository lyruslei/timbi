// Wraps a Vercel function handler with CORS, bearer-token auth, and error mapping.
import { verifyToken } from './auth.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function route({ methods, auth, env = process.env, now = Date.now }, handler) {
  const allowMethods = [...methods, 'OPTIONS'].join(', ');

  return async function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', env.FRONTEND_ORIGIN || '');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', allowMethods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!methods.includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

    if (auth) {
      const header = req.headers?.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!verifyToken(token, env.TOKEN_SECRET, now())) {
        return res.status(401).json({ error: 'Not logged in' });
      }
    }

    try {
      const out = await handler({
        method: req.method,
        headers: req.headers ?? {},
        body: req.body ?? {},
        query: req.query ?? {},
      });
      return res.status(out.status ?? 200).json(out.body);
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
}
