/**
 * Pure checks for the transfer screenshot ("bill") a buyer sends after ordering.
 * No Google services here, so tests/ can run this file in Node. Same rules as book-mo.
 */
// ~2 MB of base64; the page resizes to <=1200px JPEG so a real bill is 150-400 KB.
var MAX_BILL_BASE64_CHARS = 2800000;
// base64 of the magic bytes: JPEG FF D8 FF, PNG 89 50 4E 47, WebP "RIFF"
var BILL_MAGIC = { 'image/jpeg': '/9j/', 'image/png': 'iVBORw0KGgo', 'image/webp': 'UklGR' };
var ORDER_CODE_PATTERN = /^MVQ\d{4}-\d{3,}$/;
var BILL_TOKEN_PATTERN = /^[0-9a-f-]{32,40}$/i;

function billFail(error) {
  return { ok: false, error: error };
}

/** Returns { ok: true, orderCode, billToken, billBase64, billMime } or { ok: false, error } in Vietnamese. */
function validateBillPayload(payload) {
  if (!payload || typeof payload !== 'object') return billFail('Dữ liệu không hợp lệ.');
  var orderCode = String(payload.orderCode || '').trim();
  var billToken = String(payload.billToken || '').trim();
  if (!ORDER_CODE_PATTERN.test(orderCode) || !BILL_TOKEN_PATTERN.test(billToken)) {
    return billFail('Không tìm thấy đơn này. Bạn gửi ảnh qua Messenger hoặc Zalo cho Mo nhé.');
  }
  var billBase64 = typeof payload.billBase64 === 'string' ? payload.billBase64.replace(/^data:[^,]*,/, '') : '';
  if (!billBase64) return billFail('Bạn chọn ảnh chụp màn hình chuyển khoản trước nhé.');
  if (billBase64.length > MAX_BILL_BASE64_CHARS) return billFail('Ảnh quá lớn. Bạn chụp lại màn hình rồi chọn lại nhé.');
  billBase64 = billBase64.replace(/\s/g, '');
  if (billBase64.length < 200 || !/^[A-Za-z0-9+/=]+$/.test(billBase64.slice(0, 200))) {
    return billFail('Ảnh không đọc được, bạn chọn lại nhé.');
  }
  var billMime = String(payload.billMime || 'image/jpeg').toLowerCase();
  if (!BILL_MAGIC[billMime]) return billFail('Ảnh cần là JPG, PNG hoặc WebP.');
  if (billBase64.indexOf(BILL_MAGIC[billMime]) !== 0) {
    return billFail('Tệp này không phải ảnh JPG/PNG/WebP. Bạn chụp màn hình rồi chọn lại nhé.');
  }
  return { ok: true, orderCode: orderCode, billToken: billToken, billBase64: billBase64, billMime: billMime };
}

/** The order row must exist, carry the same secret token and not be cancelled. */
function checkBillOrder(order, billToken) {
  if (!order || !order.billToken || order.billToken !== billToken) {
    return billFail('Không tìm thấy đơn này. Bạn gửi ảnh qua Messenger hoặc Zalo cho Mo nhé.');
  }
  if (CANCELLED_STATUSES.indexOf(String(order.paymentStatus || '').trim()) !== -1) {
    return billFail('Đơn này đã huỷ. Bạn nhắn Mo qua Messenger hoặc Zalo nhé.');
  }
  return { ok: true };
}
