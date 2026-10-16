/**
 * Pure order logic: no Google services here, so tests/ can run this file in Node.
 * The server never trusts client prices: totals are recomputed from the Products tab.
 * Helpers (cleanText, normalizePhone, ...) live in order-formatting-helpers.gs.
 */
var TEXT_LIMITS = { name: 80, address: 200, timePref: 40, note: 300, refundBank: 60, refundAccountName: 80, source: 30 };
var PHONE_PATTERN = /^0\d{9}$/;
var ACCOUNT_PATTERN = /^\d{6,20}$/;
var MIN_FILL_MS = 3000;
var MAX_ORDERS_PER_PHONE_PER_BATCH = 3;
// Both spellings, since the owner may type the status by hand.
var CANCELLED_STATUSES = ['Huỷ', 'Hủy'];

/**
 * Reads a DAY from a date cell or text "20/11" / "20/11/2026" (year defaults to now's).
 * Returns that day at hh:mm:ss in the script time zone, or null if empty/unreadable.
 */
function parseDay(value, now, hours, minutes, seconds) {
  var year, month, day;
  if (value && typeof value.getTime === 'function' && !isNaN(value.getTime())) {
    year = value.getFullYear(); month = value.getMonth(); day = value.getDate();
  } else {
    var match = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*$/.exec(String(value == null ? '' : value));
    if (!match) return null;
    year = match[3] ? Number(match[3]) : now.getFullYear(); month = Number(match[2]) - 1; day = Number(match[1]);
  }
  var date = new Date(year, month, day, hours || 0, minutes || 0, seconds || 0);
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

/** order_deadline: ordering closes after 23:59:59 of that day. */
function deadlineEndOfDay(value, now) {
  return parseDay(value, now, 23, 59, 59);
}

function dayLabel(date) {
  return date ? pad(date.getDate(), 2) + '/' + pad(date.getMonth() + 1, 2) : '';
}

/**
 * Open while ordering_open is ticked and the deadline day has not ended. The owner can still
 * close early (untick, or menu "Mo về quê → Đóng đơn ngay"). Empty deadline = no auto-close;
 * a deadline that cannot be read keeps ordering closed rather than open forever.
 */
function isOrderingOpen(config, now) {
  if (config.ordering_open !== true) return false;
  var raw = config.order_deadline;
  if (raw === '' || raw == null) return true;
  var deadline = deadlineEndOfDay(raw, now);
  return Boolean(deadline) && now.getTime() <= deadline.getTime();
}

function isOrderable(product) {
  return product.available === true && product.price > 0;
}

function isActiveOrder(order) {
  return CANCELLED_STATUSES.indexOf(String(order.status || '').trim()) === -1;
}

/** Sums sold quantity per sku for one batch, ignoring cancelled orders. */
function sumSoldBySku(batchOrders) {
  var sold = {};
  batchOrders.filter(isActiveOrder).forEach(function (order) {
    (order.items || []).forEach(function (item) {
      sold[item.sku] = (sold[item.sku] || 0) + (Number(item.qty) || 0);
    });
  });
  return sold;
}

function countActiveOrdersForPhone(batchOrders, phone) {
  return batchOrders.filter(function (order) { return isActiveOrder(order) && order.phone === phone; }).length;
}

function stockLeft(product, soldBySku) {
  if (product.stock_limit == null) return null;
  return Math.max(0, product.stock_limit - (soldBySku[product.sku] || 0));
}

/** What the landing page may see; the owner's bank details are deliberately excluded. */
function buildPublicConfig(config, products, soldBySku, now) {
  var deadline = deadlineEndOfDay(config.order_deadline, now);
  var nextOpen = parseDay(config.next_open_date, now);
  return {
    open: isOrderingOpen(config, now),
    batchLabel: labelText(config.batch_label),
    deadline: deadline ? deadline.toISOString() : null,
    deadlineLabel: dayLabel(deadline),
    // Expected reopening day, shown while ordering is closed
    nextOpenDate: nextOpen ? nextOpen.toISOString() : null,
    nextOpenLabel: dayLabel(nextOpen),
    deliveryDate: labelText(config.delivery_date),
    nextBatchHint: cleanText(config.next_batch_hint, 160),
    products: products.map(function (product) {
      return {
        sku: product.sku,
        name: product.name,
        price: product.price,
        unit: product.unit,
        available: isOrderable(product),
        left: stockLeft(product, soldBySku),
        maxPerOrder: product.max_per_order
      };
    })
  };
}

function fail(error) {
  return { ok: false, error: error };
}

function isSpamPayload(payload) {
  return Boolean(payload.website) || !(Number(payload.fillMs) >= MIN_FILL_MS);
}

function validateItems(rawItems, products, soldBySku) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return fail('Bạn chưa chọn món nào.');
  var bySku = {};
  products.forEach(function (product) { bySku[product.sku] = product; });
  var seen = {};
  var items = [];
  for (var i = 0; i < rawItems.length; i++) {
    var sku = String(rawItems[i] && rawItems[i].sku);
    var qty = Number(rawItems[i] && rawItems[i].qty);
    var product = bySku[sku];
    if (!product || !isOrderable(product)) return fail('Có món hiện không còn bán, bạn tải lại trang nhé.');
    if (seen[sku]) return fail('Món bị lặp trong đơn.');
    seen[sku] = true;
    if (!(Number.isInteger(qty) && qty >= 1 && qty <= product.max_per_order)) {
      return fail('Số lượng ' + product.name + ' phải từ 1 đến ' + product.max_per_order + ' ' + product.unit + '.');
    }
    var left = stockLeft(product, soldBySku);
    if (left != null && qty > left) {
      return fail(left === 0 ? product.name + ' đợt này đã hết.' : product.name + ' chỉ còn ' + left + ' ' + product.unit + '.');
    }
    items.push({ sku: sku, name: product.name, unit: product.unit, qty: qty, price: product.price, lineTotal: qty * product.price });
  }
  return { ok: true, items: items };
}

/**
 * ctx = { config, products, soldBySku, batchOrders, now }.
 * Returns { ok: true, order } with a server-computed total, or { ok: false, error } in Vietnamese.
 */
function validateOrder(payload, ctx) {
  if (!payload || typeof payload !== 'object') return fail('Dữ liệu đơn không hợp lệ.');
  if (isSpamPayload(payload)) return fail('Không gửi được đơn, bạn thử lại hoặc nhắn Mo nhé.');
  if (!isOrderingOpen(ctx.config, ctx.now)) return fail('Đợt này đã chốt đơn rồi, hẹn bạn đợt sau nhé!');

  var order = {
    name: cleanText(payload.name, TEXT_LIMITS.name),
    phone: normalizePhone(payload.phone),
    address: cleanText(payload.address, TEXT_LIMITS.address),
    timePref: cleanText(payload.timePref, TEXT_LIMITS.timePref),
    note: cleanText(payload.note, TEXT_LIMITS.note),
    refundBank: cleanText(payload.refundBank, TEXT_LIMITS.refundBank),
    refundAccount: String(payload.refundAccount == null ? '' : payload.refundAccount).replace(/\s/g, ''),
    refundAccountName: cleanText(payload.refundAccountName, TEXT_LIMITS.refundAccountName),
    source: cleanText(payload.source, TEXT_LIMITS.source).replace(/[^a-z0-9_-]/gi, '')
  };
  if (!order.name) return fail('Bạn điền họ tên giúp Mo nhé.');
  if (!PHONE_PATTERN.test(order.phone)) return fail('Số điện thoại cần đủ 10 số, bắt đầu bằng 0.');
  if (countActiveOrdersForPhone(ctx.batchOrders || [], order.phone) >= MAX_ORDERS_PER_PHONE_PER_BATCH) {
    return fail('Số này đã có ' + MAX_ORDERS_PER_PHONE_PER_BATCH + ' đơn trong đợt, bạn nhắn Mo để gộp hoặc chỉnh đơn nhé.');
  }
  if (!order.address) return fail('Bạn điền địa chỉ giao trong nội thành Hà Nội nhé.');
  if (!order.refundBank || !order.refundAccountName) return fail('Bạn điền đủ thông tin tài khoản hoàn tiền nhé.');
  if (!ACCOUNT_PATTERN.test(order.refundAccount)) return fail('Số tài khoản hoàn tiền chỉ gồm 6–20 chữ số.');
  if (payload.consent !== true) return fail('Bạn đọc và tích ô lưu ý bảo quản giúp Mo nhé.');

  var checked = validateItems(payload.items, ctx.products, ctx.soldBySku);
  if (!checked.ok) return checked;
  order.items = checked.items;
  order.total = checked.items.reduce(function (sum, item) { return sum + item.lineTotal; }, 0);
  return { ok: true, order: order };
}
