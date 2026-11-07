// Shrink a photo on the phone before sending: faster, cheaper, under the upload limit.

// Keep the aspect ratio, never enlarge, longest side at most `max`.
export function fitSize(w, h, max = 1024) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// Browser only: File → { media_type: 'image/jpeg', data: base64 }.
export async function shrinkImage(file, max = 1024, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const { w, h } = fitSize(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { media_type: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}
