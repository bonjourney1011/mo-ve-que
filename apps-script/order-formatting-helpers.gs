/**
 * Pure text/number helpers shared by the other .gs files (no Google services, tested in Node).
 */
function cleanText(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Blocks formula injection: Sheets would evaluate text starting with = + - @. */
function sanitizeCell(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value && typeof value.getTime === 'function') return value;
  var text = String(value == null ? '' : value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function pad(number, width) {
  var text = String(number);
  while (text.length < width) text = '0' + text;
  return text;
}

/**
 * Sheets turns a typed "22/11" into a Date; read it back as "22/11" so labels
 * stored in Orders and the label in Config always compare equal.
 */
function labelText(value) {
  if (value && typeof value.getTime === 'function' && !isNaN(value.getTime())) {
    return pad(value.getDate(), 2) + '/' + pad(value.getMonth() + 1, 2);
  }
  return cleanText(value, 60);
}

function normalizePhone(value) {
  var digits = String(value == null ? '' : value).replace(/[\s.\-()]/g, '');
  if (digits.indexOf('+84') === 0) digits = '0' + digits.slice(3);
  else if (digits.indexOf('84') === 0 && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}

/** ASCII-only so it can be used as the bank transfer note, e.g. MVQ1610-007. */
function buildOrderCode(now, sequence) {
  return 'MVQ' + pad(now.getDate(), 2) + pad(now.getMonth() + 1, 2) + '-' + pad(sequence, 3);
}

/** 70000 -> "70.000"; avoids Intl, whose locale support in Apps Script is patchy. */
function formatVnd(amount) {
  return String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatItemsText(items) {
  return items.map(function (item) { return item.name + ' x' + item.qty + ' ' + item.unit; }).join('; ');
}

/** Null when the owner has not filled the bank rows yet; the page then asks to wait for Zalo. */
function buildPaymentInfo(config, orderCode, total) {
  var bankBin = String(config.bank_bin || '').trim();
  var account = String(config.bank_account || '').trim();
  if (!bankBin || !account) return null;
  return {
    bankBin: bankBin,
    account: account,
    accountName: cleanText(config.bank_account_name, 60),
    amount: total,
    addInfo: orderCode
  };
}
