// Signed login tokens (HMAC-SHA256) and timing-safe password check.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

// Hash both sides first so timingSafeEqual always gets equal-length buffers.
function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function createToken(secret, nowMs) {
  const payload = Buffer.from(JSON.stringify({ exp: nowMs + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken(token, secret, nowMs) {
  try {
    if (typeof token !== 'string' || !secret) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    if (!safeEqual(sig, sign(payload, secret))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && nowMs < exp;
  } catch {
    return false;
  }
}

export function checkPassword(given, expected) {
  if (typeof given !== 'string' || !given || typeof expected !== 'string' || !expected) return false;
  return safeEqual(given, expected);
}
