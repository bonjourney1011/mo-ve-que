import { el } from './dom-and-format-helpers.js';
import { submitBill } from './order-api-client.js';
import { resizeBillImage } from './bill-image-resizer.js';
import { attachBillSources, isDesktopPointer } from './bill-input-sources.js';

const PHONE_HINT = 'Chọn ảnh chụp màn hình chuyển khoản trong thư viện ảnh. Trang tự thu nhỏ ảnh trước khi gửi.';
const DESKTOP_HINT = 'Chọn ảnh, kéo thả ảnh vào đây, hoặc dán ảnh bằng Ctrl+V. Trang tự thu nhỏ ảnh trước khi gửi.';

function doneNote() {
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  return el('div', { class: 'bill bill--done', role: 'status' },
    el('p', { class: 'bill__done-title', text: `✓ Mo đã nhận ảnh chuyển khoản lúc ${time}` }),
    el('p', { class: 'bill__done-text', text: 'Mo kiểm tra tài khoản rồi chốt đơn với bạn qua Zalo hoặc Messenger nhé.' }));
}

/**
 * "Send your transfer screenshot" box under the payment details.
 * The bill is linked to the order only with the order's secret billToken from the order response.
 */
export function billUploadSection({ orderCode, billToken }) {
  let bill = null;
  let sending = false;
  let done = false;

  const fileInput = el('input', { class: 'upload__input', type: 'file', accept: 'image/*', id: 'bill-file' });
  const dropZone = el('label', { class: 'upload', for: 'bill-file' },
    el('span', { class: 'upload__title', text: 'Chọn ảnh chụp màn hình chuyển khoản' }),
    el('span', { class: 'upload__hint', text: isDesktopPointer() ? DESKTOP_HINT : PHONE_HINT }),
    fileInput);
  const preview = el('img', { class: 'upload__preview', alt: 'Ảnh chuyển khoản bạn vừa chọn', hidden: true });
  const error = el('p', { class: 'form-error', role: 'alert' });
  const button = el('button', { type: 'button', class: 'btn btn--nem btn--block', text: 'Gửi ảnh chuyển khoản' });
  const section = el('div', { class: 'bill' },
    el('h4', { class: 'bill__title', text: 'Chuyển xong? Gửi ảnh chuyển khoản cho Mo' }),
    el('p', { class: 'bill__lede', text: 'Ảnh lưu kín trong Drive của Mo, kèm đúng mã đơn, để Mo khớp tiền nhanh.' }),
    dropZone, preview, error, button);

  async function useFile(file) {
    error.textContent = '';
    bill = null;
    preview.hidden = true;
    try {
      bill = await resizeBillImage(file);
      preview.src = bill.dataUrl;
      preview.hidden = false;
    } catch (failure) {
      error.textContent = failure.message === 'too-large'
        ? 'Ảnh quá lớn. Bạn chụp màn hình rồi chọn lại nhé.'
        : 'Ảnh không đọc được. Bạn chụp màn hình rồi chọn lại nhé.';
    }
    fileInput.value = '';
  }

  attachBillSources({
    dropZone, fileInput,
    isActive: () => section.isConnected && !done && !sending,
    onFile: useFile,
    onReject: () => { error.textContent = 'File này không phải ảnh. Bạn chọn ảnh JPG hoặc PNG nhé.'; }
  });

  button.addEventListener('click', async () => {
    if (sending) return;
    error.textContent = '';
    if (!bill) { error.textContent = 'Bạn chọn ảnh chụp màn hình chuyển khoản trước nhé.'; return; }
    sending = true;
    button.disabled = true;
    button.textContent = 'Đang gửi ảnh…';
    const result = await submitBill({ orderCode, billToken, billBase64: bill.base64, billMime: bill.mime });
    sending = false;
    if (result.ok) {
      done = true;
      section.replaceWith(doneNote());
      return;
    }
    error.textContent = result.error;
    button.disabled = false;
    button.textContent = 'Gửi ảnh chuyển khoản';
  });

  return section;
}
