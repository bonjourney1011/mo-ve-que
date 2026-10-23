import { el, formatVnd, copyText } from './dom-and-format-helpers.js';
import { SITE_CONFIG, messengerUrl } from './site-config.js';

// VietQR bank BIN → name buyers see in their banking app (for manual transfers).
const BANK_NAMES = {
  970436: 'Vietcombank', 970415: 'VietinBank', 970418: 'BIDV', 970405: 'Agribank',
  970407: 'Techcombank', 970422: 'MB Bank', 970416: 'ACB', 970432: 'VPBank',
  970423: 'TPBank', 970403: 'Sacombank', 970441: 'VIB', 970437: 'HDBank',
  970443: 'SHB', 970448: 'OCB', 970426: 'MSB', 970440: 'SeABank', 970431: 'Eximbank'
};

function vietQrUrl(payment) {
  const params = new URLSearchParams({
    amount: String(payment.amount),
    addInfo: payment.addInfo,
    accountName: payment.accountName || ''
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(payment.bankBin)}-${encodeURIComponent(payment.account)}-compact2.png?${params}`;
}

/** One line of the manual-transfer card; `copyValue` (if given) is what the Chép button copies. */
function payRow(label, value, copyValue, note) {
  const row = el('div', { class: 'copy-row' },
    el('span', { class: 'copy-row__label', text: label }),
    el('strong', { class: 'copy-row__value', text: value }));
  if (copyValue != null) {
    const button = el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Chép', 'aria-label': `Chép ${label.toLowerCase()}` });
    button.addEventListener('click', () => copyText(copyValue, button));
    row.append(button);
  }
  if (note) row.append(el('span', { class: 'copy-row__note', text: note }));
  return row;
}

function paymentBlock(result) {
  const { payment } = result;
  if (!payment) {
    return el('p', { class: 'success__note', text: 'Mo sẽ nhắn số tài khoản cho bạn qua Zalo trong ít phút nhé.' });
  }
  return el('div', { class: 'success__pay' },
    el('img', { class: 'success__qr', src: vietQrUrl(payment), alt: `Mã VietQR chuyển ${formatVnd(payment.amount)}, nội dung ${payment.addInfo}`, width: '280', height: '320' }),
    el('p', { class: 'success__qr-hint', text: 'Đang xem trên điện thoại? Chụp màn hình mã QR, mở app ngân hàng → Quét QR → chọn ảnh vừa chụp.' }),
    el('h4', { class: 'success__manual-title', text: 'Không tiện quét mã? Chuyển khoản thủ công' }),
    payRow('Ngân hàng', BANK_NAMES[payment.bankBin] || 'Xem tên ngân hàng trên mã QR'),
    payRow('Số tài khoản', payment.account, payment.account),
    payment.accountName ? payRow('Chủ tài khoản', payment.accountName) : null,
    payRow('Số tiền', formatVnd(payment.amount), String(payment.amount)),
    payRow('Nội dung chuyển khoản', payment.addInfo, payment.addInfo, 'Giữ nguyên mã đơn này để Mo khớp đơn nhanh.'));
}

function contactButtons() {
  const links = [];
  const messenger = messengerUrl();
  if (messenger) links.push(el('a', { class: 'btn btn--leaf', href: messenger, target: '_blank', rel: 'noopener', text: 'Gửi ảnh CK qua Messenger' }));
  if (SITE_CONFIG.zaloGroupUrl) links.push(el('a', { class: 'btn btn--ghost', href: SITE_CONFIG.zaloGroupUrl, target: '_blank', rel: 'noopener', text: 'Nhắn Mo trong nhóm Zalo' }));
  return links.length ? el('div', { class: 'success__actions' }, links) : null;
}

/** Replaces the form with the confirmation + transfer QR. */
export function renderOrderSuccess(container, result) {
  const view = el('div', { class: 'success', tabindex: '-1' },
    el('p', { class: 'success__eyebrow', text: 'Mo nhận đơn rồi nha!' }),
    el('h3', { class: 'success__code', text: result.orderCode }),
    el('p', { class: 'success__items', text: result.itemsText }),
    el('p', { class: 'success__total' }, 'Tổng cần chuyển: ', el('strong', { text: formatVnd(result.total) })),
    paymentBlock(result),
    el('ol', { class: 'success__steps' },
      el('li', { text: 'Chuyển khoản đúng số tiền, giữ nguyên nội dung là mã đơn.' }),
      el('li', { text: 'Gửi ảnh chuyển khoản cho Mo để chốt đơn.' }),
      el('li', { text: result.deliveryDate ? `Mo giao tận nơi, miễn phí trong nội thành Hà Nội vào ${result.deliveryDate}.` : 'Mo giao tận nơi, miễn phí trong nội thành Hà Nội.' })),
    contactButtons(),
    el('p', { class: 'success__refund', text: 'Nếu hàng đợt này không đạt chuẩn Mo muốn, Mo hoàn 100% vào tài khoản bạn đã để lại.' }));
  container.replaceChildren(view);
  view.focus();
  view.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
