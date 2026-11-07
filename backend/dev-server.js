// Local stand-in for Vercel: serves api/<name>.js at /api/<name> on port 3001.
// Run with `npm run dev` (loads .env.local). Not used in production.
import http from 'node:http';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

function addVercelHelpers(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

http.createServer(async (req, res) => {
  addVercelHelpers(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const match = /^\/api\/([a-z]+)$/.exec(url.pathname);
  const file = match && join(here, 'api', `${match[1]}.js`);
  if (!file || !existsSync(file)) return res.status(404).json({ error: 'Not found' });

  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    req.body = raw ? JSON.parse(raw) : undefined;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  req.query = Object.fromEntries(url.searchParams);

  const { default: handler } = await import(pathToFileURL(file).href);
  await handler(req, res);
  console.log(`${req.method} ${url.pathname} → ${res.statusCode}`);
}).listen(PORT, () => console.log(`Bitelog backend on http://localhost:${PORT}`));
