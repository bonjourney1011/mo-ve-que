/**
 * Run once from the Apps Script editor (select setupSheets → Run).
 * Creates the Config / Products / Orders tabs if they are missing. Existing tabs are left untouched.
 */
function setupSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  // Date cells (order_deadline) are read in the spreadsheet's time zone, not the script's.
  spreadsheet.setSpreadsheetTimeZone('Asia/Ho_Chi_Minh');
  createConfigSheet_(spreadsheet);
  createProductsSheet_(spreadsheet);
  createOrdersSheet_(spreadsheet);
  var defaultSheet = spreadsheet.getSheetByName('Sheet1') || spreadsheet.getSheetByName('Trang tính1');
  if (defaultSheet && spreadsheet.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    spreadsheet.deleteSheet(defaultSheet);
  }
}

function createSheetWithHeader_(spreadsheet, name, headers) {
  if (spreadsheet.getSheetByName(name)) return null;
  var sheet = spreadsheet.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3ead8');
  sheet.setFrozenRows(1);
  return sheet;
}

function createConfigSheet_(spreadsheet) {
  var sheet = createSheetWithHeader_(spreadsheet, SHEET_NAMES.config, ['key', 'value', 'ghi chú']);
  if (!sheet) return;
  var deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  deadline.setHours(0, 0, 0, 0);
  var rows = [
    ['ordering_open', false, 'Tích = đang nhận đơn. Bỏ tích (hoặc menu Mo về quê → Đóng đơn ngay) = đóng form.'],
    ['batch_label', 'Đợt 1', 'Tên đợt, hiện trên trang và dùng để đếm tồn kho của đợt.'],
    ['order_deadline', deadline, 'Ngày chốt: form tự đóng sau 23:59 ngày này, trang hiện "còn X ngày". Để trống = không tự đóng.'],
    ['delivery_date', 'Thứ 7 tuần này', 'Ngày Mo giao hàng ở Hà Nội.'],
    ['next_batch_hint', 'Vào nhóm Zalo để được báo sớm nhé!', 'Câu nhắn thêm, hiện khi chưa mở đơn.'],
    ['next_open_date', '', 'Ngày dự kiến mở đơn lại. Trang hiện "Dự kiến mở đơn lại ngày 15/12 · còn X ngày". Để trống = không hiện.'],
    ['bank_bin', '', 'Mã BIN ngân hàng nhận tiền, VD 970436 = Vietcombank, 970422 = MB, 970407 = Techcombank.'],
    ['bank_account', '', 'Số tài khoản nhận tiền (chỉ nằm ở Sheet, không public).'],
    ['bank_account_name', '', 'Tên chủ tài khoản, IN HOA KHÔNG DẤU.']
  ];
  // Formats and checkboxes first: insertCheckboxes() resets values to FALSE.
  sheet.getRange('B2').insertCheckboxes();
  sheet.getRange('B3').setNumberFormat('@');
  sheet.getRange('B4').setNumberFormat('dd/MM/yyyy');
  sheet.getRange('B5').setNumberFormat('@');
  sheet.getRange('B7').setNumberFormat('dd/MM/yyyy');
  sheet.getRange('B8:B10').setNumberFormat('@');
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 460);
}

function createProductsSheet_(spreadsheet) {
  var sheet = createSheetWithHeader_(spreadsheet, SHEET_NAMES.products, PRODUCT_HEADERS);
  if (!sheet) return;
  var rows = [
    ['nem-chua', 'Nem chua', 70000, 'chục', true, 30, 10],
    ['banh-rang-bua', 'Bánh lá răng bừa', 45000, 'chục', true, 20, 10],
    ['banh-bot-loc', 'Bánh bột lọc', '', 'chục', false, '', 10]
  ];
  sheet.getRange(2, 5, 20, 1).insertCheckboxes();
  sheet.getRange(2, 3, 20, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 1, rows.length, PRODUCT_HEADERS.length).setValues(rows);
  sheet.getRange(1, 6).setNote('Số lượng mang lên mỗi đợt. Để trống = không giới hạn.');
  sheet.getRange(1, 1).setNote('sku phải trùng với assets/data/products-content.json trên trang.');
}

function createOrdersSheet_(spreadsheet) {
  var sheet = createSheetWithHeader_(spreadsheet, SHEET_NAMES.orders, ORDER_HEADERS);
  if (!sheet) return;
  var col = function (header) { return ORDER_HEADERS.indexOf(header) + 1; };
  var maxRows = sheet.getMaxRows() - 1;
  sheet.getRange(2, col('created_at'), maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange(2, col('total'), maxRows, 1).setNumberFormat('#,##0');
  [['payment_status', PAYMENT_STATUSES], ['delivery_status', DELIVERY_STATUSES]].forEach(function (pair) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(pair[1], true).setAllowInvalid(false).build();
    sheet.getRange(2, col(pair[0]), maxRows, 1).setDataValidation(rule);
  });
  sheet.hideColumns(col('items_json'));
}
