// Talks to the backend. Adds the login token; on 401 drops it and signals logout.
import { BACKEND_URL } from '../config.js';

const KEY = 'bitelog.token';

export function getToken() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setToken(t) {
  try { localStorage.setItem(KEY, t); } catch { /* private mode: token lives for this page only */ }
}
export function clearToken() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(BACKEND_URL + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    clearToken();
    window.dispatchEvent(new Event('bitelog:logout'));
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
