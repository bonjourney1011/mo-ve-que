/**
 * Web app entry points. Deploy: Execute as "Me", Who has access "Anyone".
 * Every path returns JSON; an uncaught error would come back as an HTML page,
 * which the browser reports as a CORS failure.
 */
var GLOBAL_MAX_ORDERS = 20;
var GLOBAL_WINDOW_SECONDS = 600;
var PUBLIC_CONFIG_CACHE_KEY = 'public_config';
var PUBLIC_CONFIG_CACHE_SECONDS = 30;
var REQUEST_REPLAY_SECONDS = 21600;
var BUSY_MESSAGE = 'Hệ thống đang bận, bạn thử lại sau ít phút hoặc nhắn Mo nhé.';

/** Cached ~30 s so a burst of visitors from a story does not re-read the whole Orders tab. */
function doGet() {
  return respondJson_(function () {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(PUBLIC_CONFIG_CACHE_KEY);
    if (cached) return JSON.parse(cached);
    var ctx = loadOrderContext_(new Date());
    var publicConfig = buildPublicConfig(ctx.config, ctx.products, ctx.soldBySku, ctx.now);
    publicConfig.ok = true;
    cache.put(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(publicConfig), PUBLIC_CONFIG_CACHE_SECONDS);
    return publicConfig;
  });
}

function doPost(e) {
  return respondJson_(function () {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Dữ liệu đơn không hợp lệ.' };
    // One id per filled form: a retry after a timeout gets the first answer back instead of a duplicate.
    var requestId = typeof payload.requestId === 'string' ? payload.requestId.replace(/[^\w-]/g, '').slice(0, 64) : '';
    var cache = CacheService.getScriptCache();

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return { ok: false, error: BUSY_MESSAGE };
    var response;
    var saved;
    try {
      var replay = requestId && cache.get('req_' + requestId);
      if (replay) return JSON.parse(replay);
      var recentCount = Number(cache.get('orders_recent') || 0);
      if (recentCount >= GLOBAL_MAX_ORDERS) return { ok: false, error: BUSY_MESSAGE };

      var ctx = loadOrderContext_(new Date());
      var checked = validateOrder(payload, ctx);
      if (!checked.ok) return checked;
      var meta = { now: ctx.now, orderCode: buildOrderCode(ctx.now, nextOrderSequence()), batchLabel: ctx.batchLabel };
      appendOrder(checked.order, meta);
      SpreadsheetApp.flush();

      response = {
        ok: true,
        orderCode: meta.orderCode,
        total: checked.order.total,
        itemsText: formatItemsText(checked.order.items),
        deliveryDate: labelText(ctx.config.delivery_date),
        payment: buildPaymentInfo(ctx.config, meta.orderCode, checked.order.total)
      };
      saved = { order: checked.order, meta: meta };
      cache.put('orders_recent', String(recentCount + 1), GLOBAL_WINDOW_SECONDS);
      if (requestId) cache.put('req_' + requestId, JSON.stringify(response), REQUEST_REPLAY_SECONDS);
      cache.remove(PUBLIC_CONFIG_CACHE_KEY);
    } finally {
      lock.releaseLock();
    }

    notifyNewOrder(saved.order, saved.meta);
    return response;
  });
}

function loadOrderContext_(now) {
  var config = readConfig();
  var batchLabel = labelText(config.batch_label);
  var batchOrders = readBatchOrders(batchLabel);
  return {
    config: config,
    products: readProducts(),
    batchLabel: batchLabel,
    batchOrders: batchOrders,
    soldBySku: sumSoldBySku(batchOrders),
    now: now
  };
}

function respondJson_(handler) {
  var body;
  try {
    body = handler();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    body = { ok: false, error: BUSY_MESSAGE };
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
