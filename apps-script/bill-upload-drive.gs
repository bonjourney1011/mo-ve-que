/**
 * Transfer screenshots ("bills"): stored in a private Drive folder owned by the deploying account,
 * linked on the order's row in the Orders tab, and emailed to the owner. Nobody else can open the file.
 * The owner still checks the bank app and sets payment_status to "Đã CK" by hand.
 */
var BILL_FOLDER_PROPERTY = 'BILL_FOLDER_ID';
var BILL_FOLDER_NAME = 'Mo về quê – Bills';
var MAX_BILLS_PER_ORDER = 5;

function getOrCreateBillFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(BILL_FOLDER_PROPERTY);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { console.warn('Bill folder missing, recreating', err); }
  }
  var folder = DriveApp.createFolder(BILL_FOLDER_NAME);
  props.setProperty(BILL_FOLDER_PROPERTY, folder.getId());
  return folder;
}

/** Run once from the editor: grants the Drive permission and creates the bill folder. */
function setupBillFolder() {
  var folder = getOrCreateBillFolder_();
  ensureOrderHeaders_();
  console.log('Thư mục bill: ' + folder.getUrl());
}

function saveBillImage_(base64, mime, orderCode) {
  var ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  var stamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, orderCode + '-' + stamp + '.' + ext);
  var file = getOrCreateBillFolder_().createFile(blob);
  return { url: file.getUrl(), fileId: file.getId() };
}

/** doPost route for { action: 'bill', orderCode, billToken, billBase64, billMime }. */
function handleBillUpload_(payload) {
  var checked = validateBillPayload(payload);
  if (!checked.ok) return checked;

  var cache = CacheService.getScriptCache();
  var countKey = 'bills_' + checked.orderCode;
  var count = Number(cache.get(countKey) || 0);
  if (count >= MAX_BILLS_PER_ORDER) {
    return { ok: false, error: 'Đơn này đã gửi nhiều ảnh. Bạn nhắn Mo qua Messenger hoặc Zalo nhé.' };
  }

  var found = findOrderByCode(checked.orderCode);
  var orderCheck = checkBillOrder(found && found.order, checked.billToken);
  if (!orderCheck.ok) return orderCheck;

  var bill = saveBillImage_(checked.billBase64, checked.billMime, checked.orderCode);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: BUSY_MESSAGE };
  try {
    setOrderCells(found.rowIndex, { bill_url: bill.url, bill_file_id: bill.fileId, bill_uploaded_at: new Date() });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  cache.put(countKey, String(count + 1), 21600);
  notifyBillReceived(found.order, bill.url);
  return { ok: true, orderCode: checked.orderCode };
}
