// Bill (transfer screenshot) checks from apps-script/bill-validation.gs: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gs = vm.createContext({});
for (const file of ['order-formatting-helpers.gs', 'order-validation-and-pricing.gs', 'bill-validation.gs']) {
  vm.runInContext(readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8'), gs);
}

const TOKEN = '3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d';
const JPEG = '/9j/' + 'A'.repeat(400);
const bill = (overrides = {}) => ({ orderCode: 'MVQ2310-012', billToken: TOKEN, billBase64: JPEG, billMime: 'image/jpeg', ...overrides });

test('accepts a JPEG bill and strips a data: prefix', () => {
  const ok = gs.validateBillPayload(bill({ billBase64: 'data:image/jpeg;base64,' + JPEG }));
  assert.equal(ok.ok, true);
  assert.equal(ok.billBase64.startsWith('/9j/'), true);
});

test('rejects a bad order code or token before touching Drive', () => {
  for (const overrides of [{ orderCode: 'ABC' }, { orderCode: '' }, { billToken: 'short' }, { billToken: '' }]) {
    assert.equal(gs.validateBillPayload(bill(overrides)).ok, false, JSON.stringify(overrides));
  }
});

test('rejects missing, oversized, non-image and mismatched-type files', () => {
  assert.equal(gs.validateBillPayload(bill({ billBase64: '' })).ok, false);
  assert.equal(gs.validateBillPayload(bill({ billBase64: '/9j/' + 'A'.repeat(2800001) })).ok, false);
  assert.equal(gs.validateBillPayload(bill({ billMime: 'application/pdf' })).ok, false);
  assert.equal(gs.validateBillPayload(bill({ billMime: 'image/png' })).ok, false);
  assert.equal(gs.validateBillPayload(bill({ billBase64: 'PHN2Zz' + 'A'.repeat(400) })).ok, false);
  assert.equal(gs.validateBillPayload(null).ok, false);
});

test('order must exist, match the secret token and not be cancelled', () => {
  const order = { orderCode: 'MVQ2310-012', billToken: TOKEN, paymentStatus: 'Chờ CK' };
  assert.equal(gs.checkBillOrder(order, TOKEN).ok, true);
  assert.equal(gs.checkBillOrder(null, TOKEN).ok, false);
  assert.equal(gs.checkBillOrder({ ...order, billToken: '' }, TOKEN).ok, false);
  assert.equal(gs.checkBillOrder(order, TOKEN.replace('3', '4')).ok, false);
  assert.equal(gs.checkBillOrder({ ...order, paymentStatus: 'Huỷ' }, TOKEN).ok, false);
});
