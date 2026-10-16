// Runs the real Apps Script file in a Node sandbox: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Same time zone as appsscript.json, so date-only deadlines resolve like they do in Apps Script.
process.env.TZ = 'Asia/Ho_Chi_Minh';

// Apps Script shares one global scope across .gs files; load them in the same context.
const gs = vm.createContext({});
for (const file of ['order-formatting-helpers.gs', 'order-validation-and-pricing.gs']) {
  vm.runInContext(readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8'), gs);
}

const NOW = new Date('2026-11-18T10:00:00+07:00');
const products = [
  { sku: 'nem-chua', name: 'Nem chua', price: 70000, unit: 'chục', available: true, stock_limit: 30, max_per_order: 10 },
  { sku: 'banh-rang-bua', name: 'Bánh lá răng bừa', price: 45000, unit: 'chục', available: true, stock_limit: null, max_per_order: 10 },
  { sku: 'banh-bot-loc', name: 'Bánh bột lọc', price: 0, unit: 'chục', available: false, stock_limit: null, max_per_order: 10 }
];
const openConfig = { ordering_open: true, batch_label: 'Đợt 22/11', order_deadline: new Date('2026-11-20T00:00:00+07:00') };

function payload(overrides = {}) {
  return {
    name: 'Lan', phone: '0912 345 678', address: 'Cầu Giấy, Hà Nội', note: '', timePref: 'Tối',
    refundBank: 'Vietcombank', refundAccount: '0123456789', refundAccountName: 'NGUYEN THI LAN',
    consent: true, fillMs: 15000, website: '', source: 'story',
    items: [{ sku: 'nem-chua', qty: 2, price: 1 }, { sku: 'banh-rang-bua', qty: 1 }],
    ...overrides
  };
}
const ctx = (overrides = {}) => ({ config: openConfig, products, soldBySku: {}, batchOrders: [], now: NOW, ...overrides });

test('deadline is a day: a date cell or "dd/MM(/yyyy)" text ends at 23:59:59', () => {
  const fromCell = gs.deadlineEndOfDay(new Date(2026, 10, 20), NOW);
  assert.equal(fromCell.toISOString(), '2026-11-20T16:59:59.000Z');
  assert.equal(gs.deadlineEndOfDay('20/11', NOW).toISOString(), '2026-11-20T16:59:59.000Z');
  assert.equal(gs.deadlineEndOfDay('5/1/2027', NOW).toISOString(), '2027-01-05T16:59:59.000Z');
  for (const bad of ['', null, 'thứ 5', '31/02', '20/11 20:00']) assert.equal(gs.deadlineEndOfDay(bad, NOW), null, String(bad));
  const pub = gs.buildPublicConfig({ ...openConfig, order_deadline: '20/11' }, products, {}, NOW);
  assert.equal(pub.deadlineLabel, '20/11');
});

test('next_open_date is published as the start of that day, empty when unset', () => {
  const pub = gs.buildPublicConfig({ ordering_open: false, next_open_date: new Date(2026, 11, 15) }, products, {}, NOW);
  assert.equal(pub.nextOpenLabel, '15/12');
  assert.equal(pub.nextOpenDate, '2026-12-14T17:00:00.000Z');
  const unset = gs.buildPublicConfig({ ordering_open: false, next_open_date: '' }, products, {}, NOW);
  assert.equal(unset.nextOpenDate, null);
  assert.equal(unset.nextOpenLabel, '');
});

test('limits active orders per phone in one batch, cancelled ones do not count', () => {
  const order = (status) => ({ status, phone: '0912345678', items: [] });
  const three = [order('Chờ CK'), order('Đã CK'), order('Chờ CK')];
  assert.equal(gs.validateOrder(payload(), ctx({ batchOrders: three })).ok, false);
  const withCancelled = [order('Chờ CK'), order('Huỷ'), order('Hủy')];
  assert.equal(gs.validateOrder(payload(), ctx({ batchOrders: withCancelled })).ok, true);
});

test('labelText reads a date-converted label back as dd/MM', () => {
  assert.equal(gs.labelText(new Date(2026, 10, 22)), '22/11');
  assert.equal(gs.labelText('  Đợt   22/11 '), 'Đợt 22/11');
});

test('total is recomputed from server prices, ignoring client price', () => {
  const result = gs.validateOrder(payload(), ctx());
  assert.equal(result.ok, true);
  assert.equal(result.order.total, 2 * 70000 + 45000);
  assert.equal(result.order.phone, '0912345678');
});

test('ordering closes when the owner unticks it, or after the deadline day ends', () => {
  assert.equal(gs.validateOrder(payload(), ctx({ config: { ...openConfig, ordering_open: false } })).ok, false);
  const lastMinute = new Date('2026-11-20T23:59:00+07:00');
  assert.equal(gs.validateOrder(payload(), ctx({ now: lastMinute })).ok, true);
  const nextDay = new Date('2026-11-21T00:00:01+07:00');
  assert.equal(gs.validateOrder(payload(), ctx({ now: nextDay })).ok, false);
  assert.equal(gs.buildPublicConfig(openConfig, products, {}, nextDay).open, false);
  assert.equal(gs.isOrderingOpen({ ordering_open: true, order_deadline: '' }, NOW), true);
  assert.equal(gs.isOrderingOpen({ ordering_open: true, order_deadline: 'thứ 5' }, NOW), false);
});

test('enforces stock left per batch', () => {
  const result = gs.validateOrder(payload({ items: [{ sku: 'nem-chua', qty: 5 }] }), ctx({ soldBySku: { 'nem-chua': 27 } }));
  assert.equal(result.ok, false);
  assert.match(result.error, /chỉ còn 3/);
  const soldOut = gs.validateOrder(payload({ items: [{ sku: 'nem-chua', qty: 1 }] }), ctx({ soldBySku: { 'nem-chua': 30 } }));
  assert.match(soldOut.error, /đã hết/);
});

test('sold count ignores cancelled orders', () => {
  const sold = gs.sumSoldBySku([
    { status: 'Chờ CK', items: [{ sku: 'nem-chua', qty: 2 }] },
    { status: 'Huỷ', items: [{ sku: 'nem-chua', qty: 9 }] },
    { status: 'Hủy', items: [{ sku: 'nem-chua', qty: 4 }] },
    { status: 'Đã CK', items: [{ sku: 'nem-chua', qty: 1 }, { sku: 'banh-rang-bua', qty: 4 }] }
  ]);
  assert.equal(sold['nem-chua'], 3);
  assert.equal(sold['banh-rang-bua'], 4);
});

test('rejects bad quantities, unknown, unavailable and duplicate items', () => {
  const bad = [
    [{ sku: 'nem-chua', qty: 0 }], [{ sku: 'nem-chua', qty: 1.5 }], [{ sku: 'nem-chua', qty: 11 }],
    [{ sku: 'nem-chua', qty: '2abc' }], [{ sku: 'khong-co', qty: 1 }], [{ sku: 'banh-bot-loc', qty: 1 }],
    [{ sku: 'nem-chua', qty: 1 }, { sku: 'nem-chua', qty: 1 }], [], 'nem-chua'
  ];
  for (const items of bad) assert.equal(gs.validateOrder(payload({ items }), ctx()).ok, false, JSON.stringify(items));
});

test('requires contact, address, refund account and consent', () => {
  const bad = [
    { name: '  ' }, { phone: '091234' }, { phone: '1912345678' }, { address: '' },
    { refundBank: '' }, { refundAccount: '12ab34' }, { refundAccountName: '' }, { consent: 'true' }
  ];
  for (const overrides of bad) assert.equal(gs.validateOrder(payload(overrides), ctx()).ok, false, JSON.stringify(overrides));
  assert.equal(gs.validateOrder(payload({ phone: '+84912345678' }), ctx()).ok, true);
});

test('honeypot and too-fast submits are rejected', () => {
  assert.equal(gs.validateOrder(payload({ website: 'http://spam' }), ctx()).ok, false);
  assert.equal(gs.validateOrder(payload({ fillMs: 800 }), ctx()).ok, false);
  assert.equal(gs.validateOrder(payload({ fillMs: undefined }), ctx()).ok, false);
});

test('sanitizeCell neutralises spreadsheet formulas', () => {
  assert.equal(gs.sanitizeCell('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")");
  assert.equal(gs.sanitizeCell('+84'), "'+84");
  assert.equal(gs.sanitizeCell('@sum'), "'@sum");
  assert.equal(gs.sanitizeCell('Nem chua x2'), 'Nem chua x2');
  assert.equal(gs.sanitizeCell(70000), 70000);
});

test('text is trimmed, control chars removed and length capped', () => {
  const result = gs.validateOrder(payload({ name: 'A\u0000B\n  C' + 'x'.repeat(200), source: 'story<script>' }), ctx());
  assert.equal(result.order.name.startsWith('A B C'), true);
  assert.equal(result.order.name.length, 80);
  assert.equal(result.order.source, 'storyscript');
});

test('public config hides bank details and reports stock left', () => {
  const config = { ...openConfig, bank_account: '999888', bank_bin: '970436' };
  const pub = gs.buildPublicConfig(config, products, { 'nem-chua': 10 }, NOW);
  assert.equal(JSON.stringify(pub).includes('999888'), false);
  assert.equal(pub.open, true);
  assert.equal(pub.products[0].left, 20);
  assert.equal(pub.products[1].left, null);
  assert.equal(pub.products[2].available, false);
});

test('order code, money format and payment info', () => {
  assert.equal(gs.buildOrderCode(new Date(2026, 10, 5), 7), 'MVQ0511-007');
  assert.equal(gs.formatVnd(1185000), '1.185.000');
  assert.equal(gs.buildPaymentInfo({}, 'MVQ0511-007', 70000), null);
  const info = gs.buildPaymentInfo({ bank_bin: '970436', bank_account: '0011', bank_account_name: 'NGUYEN VAN A' }, 'MVQ0511-007', 70000);
  assert.equal(info.amount, 70000);
  assert.equal(info.addInfo, 'MVQ0511-007');
});
