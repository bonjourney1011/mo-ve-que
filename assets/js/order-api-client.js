import { SITE_CONFIG } from './site-config.js';

// Generous: a cold Apps Script start + lock wait + sheet write can take 20 s+.
const TIMEOUT_MS = 45000;
const NETWORK_ERROR = 'Mạng chập chờn hoặc hệ thống đang bận. Bạn thử lại, hoặc nhắn Mo qua Messenger/Zalo nhé.';

async function callApi(options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(SITE_CONFIG.apiUrl, { ...options, signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export const isApiConfigured = () => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SITE_CONFIG.apiUrl);

/**
 * Batch status + product prices/stock.
 * { config } on success, { config: null } when no API is set, { config: null, failed: true } when unreachable.
 */
export async function fetchPublicConfig() {
  if (!isApiConfigured()) return { config: null };
  try {
    const data = await callApi();
    return data && data.ok ? { config: data } : { config: null, failed: true };
  } catch (error) {
    console.warn('Không tải được trạng thái đợt', error);
    return { config: null, failed: true };
  }
}

/**
 * POST as text/plain (fetch's default for a string body) so the browser sends a
 * "simple" request without a CORS preflight, which Apps Script cannot answer.
 */
export async function submitOrder(payload) {
  try {
    const data = await callApi({ method: 'POST', body: JSON.stringify(payload) });
    return data && typeof data.ok === 'boolean' ? data : { ok: false, error: NETWORK_ERROR };
  } catch (error) {
    console.warn('Gửi đơn lỗi', error);
    return { ok: false, error: NETWORK_ERROR };
  }
}
