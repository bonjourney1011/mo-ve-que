/**
 * "Mo về quê" menu in the Sheet (desktop): one-click open/close of ordering.
 * On the Sheets phone app, menus do not show; untick/tick Config → ordering_open instead.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Mo về quê')
    .addItem('🔴 Đóng đơn ngay', 'closeOrdering')
    .addItem('🟢 Mở đơn', 'openOrdering')
    .addToUi();
}

function closeOrdering() {
  setOrderingOpen_(false);
}

function openOrdering() {
  setOrderingOpen_(true);
}

function setOrderingOpen_(isOpen) {
  var sheet = getSheet_(SHEET_NAMES.config);
  var keys = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() !== 'ordering_open') continue;
    sheet.getRange(i + 1, 2).setValue(isOpen);
    // Drop the doGet cache so the page switches state right away instead of within 30 s.
    CacheService.getScriptCache().remove(PUBLIC_CONFIG_CACHE_KEY);
    SpreadsheetApp.getActiveSpreadsheet().toast(isOpen ? 'Đã mở nhận đơn.' : 'Đã đóng đơn. Trang hiện "chưa mở đơn".', 'Mo về quê', 5);
    return;
  }
  throw new Error('Không tìm thấy dòng ordering_open trong tab Config.');
}
