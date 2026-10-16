/**
 * Emails each new order to the owner's Gmail (free, ~100 emails/day on a personal account).
 * Goes to the Google account that deployed the web app; set Script Property NOTIFY_EMAIL to send elsewhere.
 * Never throws: a failed notification must not lose an order that is already saved.
 */
function notifyNewOrder(order, meta) {
  try {
    var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    if (!to) return;
    MailApp.sendEmail({
      to: to,
      subject: '🛒 Đơn mới ' + meta.orderCode + ' · ' + formatVnd(order.total) + 'đ · ' + order.name,
      body: buildOrderNotifyText(order, meta)
    });
  } catch (err) {
    console.error('Order email failed', err);
  }
}

function buildOrderNotifyText(order, meta) {
  return [
    'Đơn ' + meta.orderCode + ' · ' + meta.batchLabel,
    '',
    'Khách: ' + order.name + ' · ' + order.phone,
    'Giao tới: ' + order.address + (order.timePref ? ' (' + order.timePref + ')' : ''),
    'Món: ' + formatItemsText(order.items),
    'Tổng: ' + formatVnd(order.total) + 'đ · chờ chuyển khoản',
    order.note ? 'Ghi chú: ' + order.note : '',
    order.source ? 'Nguồn: ' + order.source : '',
    '',
    'Xem và cập nhật trạng thái ở tab Orders của Google Sheet.'
  ].filter(function (line, index, lines) { return line || lines[index - 1]; }).join('\n');
}

/** Run once from the editor: grants the Gmail permission and checks the email arrives. */
function testOrderEmail() {
  notifyNewOrder(
    { name: 'Test', phone: '0900000000', address: 'Hà Nội', timePref: '', note: '', source: 'test',
      items: [{ name: 'Nem chua', qty: 1, unit: 'chục' }], total: 70000 },
    { orderCode: 'MVQ-TEST', batchLabel: 'Thử' }
  );
}
