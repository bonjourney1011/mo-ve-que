/** Reads and writes the Config / Products / Orders tabs of the bound spreadsheet. */
var SHEET_NAMES = { config: 'Config', products: 'Products', orders: 'Orders' };
var PRODUCT_HEADERS = ['sku', 'name', 'price', 'unit', 'available', 'stock_limit', 'max_per_order'];
var ORDER_HEADERS = [
  'created_at', 'order_code', 'batch_label', 'name', 'phone', 'address', 'time_pref',
  'items_text', 'items_json', 'total', 'refund_bank', 'refund_account', 'refund_account_name',
  'note', 'source', 'payment_status', 'delivery_status',
  // Added for transfer screenshots; ensureOrderHeaders_() appends them to older sheets.
  'bill_url', 'bill_uploaded_at', 'bill_file_id', 'bill_token'
];
var HIDDEN_ORDER_HEADERS = ['items_json', 'bill_file_id', 'bill_token'];
var PAYMENT_STATUSES = ['Chờ CK', 'Đã CK', 'Đã hoàn', 'Huỷ'];
var DELIVERY_STATUSES = ['Chưa giao', 'Đã giao'];
var DEFAULT_MAX_PER_ORDER = 10;

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Thiếu tab "' + name + '". Chạy setupSheets() trước.');
  return sheet;
}

function readRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

function toNumberOrNull_(value) {
  if (value === '' || value == null) return null;
  var number = Number(value);
  return isNaN(number) ? null : number;
}

/** Config tab: column A = key, column B = value. */
function readConfig() {
  var config = {};
  readRows_(getSheet_(SHEET_NAMES.config)).forEach(function (row) {
    var key = String(row[0]).trim();
    if (key) config[key] = row[1];
  });
  return config;
}

function readProducts() {
  return readRows_(getSheet_(SHEET_NAMES.products))
    .filter(function (row) { return String(row[0]).trim(); })
    .map(function (row) {
      return {
        sku: String(row[0]).trim(),
        name: String(row[1]).trim(),
        price: toNumberOrNull_(row[2]) || 0,
        unit: String(row[3] || 'chục').trim(),
        available: row[4] === true,
        stock_limit: toNumberOrNull_(row[5]),
        max_per_order: toNumberOrNull_(row[6]) || DEFAULT_MAX_PER_ORDER
      };
    });
}

/** Orders of one batch with parsed items, used for the stock and per-phone counts. */
function readBatchOrders(batchLabel) {
  var col = function (header) { return ORDER_HEADERS.indexOf(header); };
  return readRows_(getSheet_(SHEET_NAMES.orders))
    .filter(function (row) { return labelText(row[col('batch_label')]) === batchLabel; })
    .map(function (row) {
      var items = [];
      try { items = JSON.parse(row[col('items_json')] || '[]'); } catch (err) { console.warn('Bad items_json', row[col('order_code')]); }
      return {
        items: items,
        status: String(row[col('payment_status')]).trim(),
        phone: normalizePhone(String(row[col('phone')]).replace(/^'/, ''))
      };
    });
}

/** Stored counter, so deleting test rows never makes an order code (= transfer note) repeat. Call inside the lock. */
function nextOrderSequence() {
  var props = PropertiesService.getScriptProperties();
  var current = Number(props.getProperty('ORDER_SEQ'));
  if (!current) current = Math.max(0, getSheet_(SHEET_NAMES.orders).getLastRow() - 1);
  props.setProperty('ORDER_SEQ', String(current + 1));
  return current + 1;
}

/**
 * Phone, account and batch label are forced to text ("'" prefix) so Sheets keeps the
 * leading 0 and never turns "22/11" into a date. Columns are written by position:
 * add new columns only at the end of the Orders tab.
 */
var FORCED_TEXT_HEADERS = ['phone', 'refund_account', 'batch_label'];

function appendOrder(order, meta) {
  var values = {
    created_at: meta.now,
    order_code: meta.orderCode,
    batch_label: "'" + meta.batchLabel,
    name: order.name,
    phone: "'" + order.phone,
    address: order.address,
    time_pref: order.timePref,
    items_text: formatItemsText(order.items),
    items_json: JSON.stringify(order.items.map(function (item) { return { sku: item.sku, qty: item.qty }; })),
    total: order.total,
    refund_bank: order.refundBank,
    refund_account: "'" + order.refundAccount,
    refund_account_name: order.refundAccountName,
    note: order.note,
    source: order.source,
    payment_status: PAYMENT_STATUSES[0],
    delivery_status: DELIVERY_STATUSES[0],
    bill_token: meta.billToken
  };
  var row = ORDER_HEADERS.map(function (header) {
    var value = values[header];
    return FORCED_TEXT_HEADERS.indexOf(header) !== -1 ? value : sanitizeCell(value);
  });
  ensureOrderHeaders_();
  getSheet_(SHEET_NAMES.orders).appendRow(row);
}

/** Adds any header missing at the end of row 1 (sheets created before the bill columns existed). */
function ensureOrderHeaders_() {
  var sheet = getSheet_(SHEET_NAMES.orders);
  var current = sheet.getRange(1, 1, 1, ORDER_HEADERS.length).getValues()[0];
  ORDER_HEADERS.forEach(function (header, index) {
    if (String(current[index]).trim() === header) return;
    if (String(current[index]).trim() !== '') throw new Error('Cột ' + (index + 1) + ' của tab Orders phải là "' + header + '".');
    sheet.getRange(1, index + 1).setValue(header).setFontWeight('bold').setBackground('#f3ead8');
    if (HIDDEN_ORDER_HEADERS.indexOf(header) !== -1) sheet.hideColumns(index + 1);
    if (header === 'bill_uploaded_at') sheet.getRange(2, index + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  });
}

/** { rowIndex, order: { orderCode, name, total, billToken, billUrl, paymentStatus } } or null. */
function findOrderByCode(orderCode) {
  var col = function (header) { return ORDER_HEADERS.indexOf(header); };
  var rows = readRows_(getSheet_(SHEET_NAMES.orders));
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][col('order_code')]).trim() !== orderCode) continue;
    return {
      rowIndex: i + 2,
      order: {
        orderCode: orderCode,
        name: String(rows[i][col('name')]),
        total: Number(rows[i][col('total')]) || 0,
        billToken: String(rows[i][col('bill_token')] || '').trim(),
        billUrl: String(rows[i][col('bill_url')] || '').trim(),
        paymentStatus: String(rows[i][col('payment_status')])
      }
    };
  }
  return null;
}

/** Writes { header: value } into one order row; only known headers, values from our own code. */
function setOrderCells(rowIndex, values) {
  ensureOrderHeaders_();
  var sheet = getSheet_(SHEET_NAMES.orders);
  Object.keys(values).forEach(function (header) {
    var index = ORDER_HEADERS.indexOf(header);
    if (index !== -1) sheet.getRange(rowIndex, index + 1).setValue(sanitizeCell(values[header]));
  });
}
