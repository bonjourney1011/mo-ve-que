import { el, formatVnd, copyText } from './dom-and-format-helpers.js';
import { SITE_CONFIG, messengerUrl } from './site-config.js';

function vietQrUrl(payment) {
  const params = new URLSearchParams({
    amount: String(payment.amount),
    addInfo: payment.addInfo,
    accountName: payment.accountName || ''
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(payment.bankBin)}-${encodeURIComponent(payment.account)}-compact2.png?${params}`;
}

function copyRow(label, value) {
  const button = el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Chép' });
  button.addEventListener('click', () => copyText(value, button));
  return el('div', { class: 'copy-row' },
    el('span', { class: 'copy-row__label', text: label }),
    el('strong', { class: 'copy-row__value', text: value }),
    button);
}

function paymentBlock(result) {
  const { payment } = result;
  if (!payment) {
    return el('p', { class: 'success__note', text: 'Mo sẽ nhắn số tài khoản cho bạn qua Zalo trong ít phút nhé.' });
  }
  return el('div', { class: 'success__pay' },
    el('img', { class: 'success__qr', src: vietQrUrl(payment), alt: `Mã VietQR chuyển ${formatVnd(payment.amount)}, nội dung ${payment.addInfo}`, width: '280', height: '320' }),
    copyRow('Số tài khoản', payment.account),
    payment.accountName ? copyRow('Chủ tài khoản', payment.accountName) : null,
    copyRow('Số tiền', String(payment.amount)),
    copyRow('Nội dung CK', payment.addInfo));
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
