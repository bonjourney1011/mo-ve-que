/**
 * "Bill is on your phone?": the computer shows a QR code holding { orderCode, billToken } after a #,
 * so it never reaches the web server. The phone opens the page straight on the bill upload box.
 * Bank details are never put in the link. Same pattern as book-mo's phone-handoff.js.
 */
const HASH_PREFIX = '#bill=';
const QR_SCRIPT = 'assets/vendor/qrcode-generator-1.4.4.js';
const ORDER_CODE_PATTERN = /^MVQ\d{4}-\d{3,}$/;
const BILL_TOKEN_PATTERN = /^[0-9a-f-]{32,40}$/i;

function toBase64Url(text) {
  let binary = '';
  new TextEncoder().encode(text).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Link the phone opens; ?src= rides along in the query so the channel stays the same. */
export function billHandoffUrl({ orderCode, billToken }) {
  const data = toBase64Url(JSON.stringify({ o: orderCode, t: billToken }));
  return `${location.origin}${location.pathname}${location.search}${HASH_PREFIX}${data}`;
}

/** Reads and removes the handoff from the address bar. Returns { orderCode, billToken } or null. */
export function takeBillHandoff() {
  if (!location.hash.startsWith(HASH_PREFIX)) return null;
  const raw = location.hash.slice(HASH_PREFIX.length);
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const parsed = JSON.parse(fromBase64Url(raw));
    const orderCode = String(parsed.o || '');
    const billToken = String(parsed.t || '');
    return ORDER_CODE_PATTERN.test(orderCode) && BILL_TOKEN_PATTERN.test(billToken) ? { orderCode, billToken } : null;
  } catch {
    return null;
  }
}

let qrLibrary;
function loadQrLibrary() {
  qrLibrary ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = QR_SCRIPT;
    script.onload = () => (globalThis.qrcode ? resolve(globalThis.qrcode) : reject(new Error('qr')));
    script.onerror = () => { qrLibrary = null; reject(new Error('qr')); };
    document.head.append(script);
  });
  return qrLibrary;
}

/** Draws the QR into img at 5 screen pixels per module, sharp enough for a phone to read off a monitor. */
export async function drawHandoffQr(img, url) {
  const qrcode = await loadQrLibrary();
  const qr = qrcode(0, 'L');
  qr.addData(url);
  qr.make();
  img.src = qr.createDataURL(5, 20);
}
