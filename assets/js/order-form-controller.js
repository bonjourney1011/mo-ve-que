import { el, formatVnd, formatPriceShort } from './dom-and-format-helpers.js';
import { submitOrder } from './order-api-client.js';

const PHONE_PATTERN = /^0\d{9}$/;
// Same rules as normalizePhone in apps-script/order-formatting-helpers.gs
const normalizePhone = (value) => {
  const digits = value.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) return `0${digits.slice(3)}`;
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
};
const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function maxQty(product) {
  return product.left == null ? product.maxPerOrder : Math.min(product.maxPerOrder, product.left);
}

function stepperRow(product, quantities, onChange) {
  const limit = maxQty(product);
  const output = el('output', { class: 'stepper__qty', 'aria-live': 'polite', text: '0' });
  const minus = el('button', { type: 'button', class: 'stepper__btn', 'aria-label': `Bớt 1 ${product.unit} ${product.name}`, text: '−' });
  const plus = el('button', { type: 'button', class: 'stepper__btn', 'aria-label': `Thêm 1 ${product.unit} ${product.name}`, text: '+' });
  const sync = () => {
    const qty = quantities.get(product.sku) || 0;
    output.textContent = String(qty);
    minus.disabled = qty === 0;
    plus.disabled = qty >= limit;
    onChange();
  };
  minus.addEventListener('click', () => { quantities.set(product.sku, Math.max(0, (quantities.get(product.sku) || 0) - 1)); sync(); });
  plus.addEventListener('click', () => { quantities.set(product.sku, Math.min(limit, (quantities.get(product.sku) || 0) + 1)); sync(); });
  minus.disabled = true;
  if (limit <= 0) plus.disabled = true;

  const hint = limit <= 0 ? 'Đợt này hết rồi' : product.left != null ? `Còn ${product.left} ${product.unit}` : `Tối đa ${limit} ${product.unit}/đơn`;
  return el('div', { class: `order-item${limit <= 0 ? ' order-item--out' : ''}` },
    el('div', { class: 'order-item__info' },
      el('span', { class: 'order-item__name', text: product.name }),
      el('span', { class: 'order-item__price', text: `${formatPriceShort(product.price)}/${product.unit}` }),
      el('span', { class: 'order-item__meta', text: hint })),
    el('div', { class: 'stepper', role: 'group', 'aria-label': `Số ${product.unit} ${product.name}` }, minus, output, plus));
}

/**
 * Wires the static form in index.html to the live products of the open batch.
 * onSuccess receives the server response ({ orderCode, total, payment, ... }).
 */
export function initOrderForm({ form, products, source, onSuccess }) {
  const quantities = new Map();
  const itemsBox = form.querySelector('[data-order-items]');
  const totalText = form.querySelector('[data-order-total]');
  const submitButton = form.querySelector('[data-order-submit]');
  const errorBox = form.querySelector('[data-order-error]');
  const phoneInput = form.elements.phone;
  const startedAt = performance.now();
  // One id for this filled form: if a slow request is retried, the server returns the first order.
  const requestId = newRequestId();
  const priceOf = Object.fromEntries(products.map((product) => [product.sku, product.price]));
  let sending = false;

  const total = () => [...quantities].reduce((sum, [sku, qty]) => sum + qty * priceOf[sku], 0);
  const refreshTotal = () => {
    const amount = total();
    totalText.textContent = formatVnd(amount);
    if (sending) return;
    submitButton.textContent = amount > 0 ? `Gửi đơn · ${formatVnd(amount)}` : 'Chọn món để đặt';
    submitButton.disabled = amount === 0;
  };
  const setSending = (value) => {
    sending = value;
    form.querySelectorAll('fieldset').forEach((fieldset) => { fieldset.disabled = value; });
    submitButton.disabled = value;
    if (value) submitButton.textContent = 'Đang gửi đơn…';
  };
  itemsBox.replaceChildren(...products.map((product) => stepperRow(product, quantities, refreshTotal)));
  refreshTotal();

  phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    errorBox.textContent = '';
    phoneInput.value = normalizePhone(phoneInput.value);
    if (!PHONE_PATTERN.test(phoneInput.value)) phoneInput.setCustomValidity('Số điện thoại cần đủ 10 số, bắt đầu bằng 0.');
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      items: [...quantities].filter(([, qty]) => qty > 0).map(([sku, qty]) => ({ sku, qty })),
      name: data.get('name'),
      phone: phoneInput.value,
      address: data.get('address'),
      timePref: data.get('timePref'),
      note: data.get('note'),
      refundBank: data.get('refundBank'),
      refundAccount: String(data.get('refundAccount') || '').replace(/\s/g, ''),
      refundAccountName: data.get('refundAccountName'),
      consent: data.get('consent') === 'on',
      website: data.get('website'),
      fillMs: Math.round(performance.now() - startedAt),
      source,
      requestId
    };
    if (payload.items.length === 0) return;

    setSending(true);
    const result = await submitOrder(payload);
    if (result.ok) {
      onSuccess(result);
      return;
    }
    setSending(false);
    errorBox.textContent = result.error;
    errorBox.focus();
    refreshTotal();
  });
}
