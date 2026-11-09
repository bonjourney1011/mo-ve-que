// Shrinks the transfer screenshot in the browser so the JSON body stays small (~150-400 KB).
const MAX_SIDE = 1200;
const JPEG_QUALITY = 0.8;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

async function loadBitmap(file) {
  if (globalThis.createImageBitmap) {
    try { return await createImageBitmap(file); } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('decode'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * file -> { base64, mime: 'image/jpeg', dataUrl, bytes }.
 * Throws Error('decode') when the browser cannot read the image (e.g. HEIC on desktop).
 */
export async function resizeBillImage(file) {
  if (!file || file.size > MAX_INPUT_BYTES) throw new Error('too-large');
  const source = await loadBitmap(file);
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (!width || !height) throw new Error('decode');
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { base64, mime: 'image/jpeg', dataUrl, bytes: Math.round(base64.length * 0.75) };
}
