// Photos sent with a chat message: checked here, sent to the AI once, never stored.
import { HttpError } from './http.js';

export const MAX_IMAGE_BASE64 = 1.5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BAD = 'Photo must be JPEG, PNG or WebP under 1.5 MB';

export function checkImage(img) {
  if (img == null) return null;
  if (typeof img !== 'object' || !TYPES.has(img.media_type) || typeof img.data !== 'string') throw new HttpError(400, BAD);
  const data = img.data.replace(/^data:[^,]*,/, '');
  if (data.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new HttpError(400, BAD);
  return { media_type: img.media_type, data };
}
