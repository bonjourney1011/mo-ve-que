import { SITE_CONFIG, messengerUrl } from './site-config.js';
import { loadJson } from './dom-and-format-helpers.js';
import { fetchPublicConfig } from './order-api-client.js';
import { indexLiveProducts, renderProductCards } from './product-cards-renderer.js';
import { renderBatchStatus, nextOpenText } from './batch-status-banner.js';
import { initOrderForm } from './order-form-controller.js';
import { renderOrderSuccess } from './order-success-view.js';
import { renderFeedbackGallery } from './feedback-gallery.js';

// ?src=story / post / zalo in the shared link tells which channel brought the order.
const source = (new URLSearchParams(location.search).get('src') || 'direct').slice(0, 30);

/** Fills every [data-contact] link from site-config, hiding the ones left empty. */
function wireContacts() {
  const targets = { messenger: messengerUrl(), 'zalo-group': SITE_CONFIG.zaloGroupUrl };
  document.querySelectorAll('[data-contact]').forEach((node) => {
    const kind = node.dataset.contact;
    if (kind === 'zalo-qr') {
      node.hidden = !SITE_CONFIG.zaloQrImage;
      return;
    }
    if (targets[kind]) node.href = targets[kind];
    else node.hidden = true;
  });
  const dialog = document.getElementById('zalo-qr-dialog');
  if (!SITE_CONFIG.zaloQrImage || !dialog) return;
  dialog.querySelector('img').src = SITE_CONFIG.zaloQrImage;
  document.querySelectorAll('[data-contact="zalo-qr"]').forEach((button) =>
    button.addEventListener('click', () => dialog.showModal()));
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
}

function showOrderPanel(isOpen) {
  document.querySelector('[data-order-open]').hidden = !isOpen;
  document.querySelector('[data-order-closed]').hidden = isOpen;
  document.querySelectorAll('[data-cta-order]').forEach((cta) => { cta.hidden = !isOpen; });
}

async function loadContents() {
  try {
    const contents = await loadJson('assets/data/products-content.json');
    return Array.isArray(contents) ? contents.filter((item) => item && item.sku) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function main() {
  wireContacts();
  const [contents, { config: publicConfig, failed }] = await Promise.all([loadContents(), fetchPublicConfig()]);
  const liveBySku = indexLiveProducts(publicConfig);
  const orderable = (publicConfig?.products || []).filter((product) => product.available);
  // The server already closes after the deadline day; this covers its ~30 s cache.
  const deadlinePassed = Boolean(publicConfig?.deadline) && new Date(publicConfig.deadline).getTime() < Date.now();
  const canOrder = Boolean(publicConfig?.open) && !deadlinePassed && orderable.length > 0;
  renderProductCards(document.querySelector('[data-product-cards]'), contents, liveBySku, canOrder);

  showOrderPanel(canOrder);
  if (publicConfig?.nextBatchHint) document.querySelector('[data-next-hint]').textContent = publicConfig.nextBatchHint;
  const reopenLine = document.querySelector('[data-next-open]');
  reopenLine.textContent = nextOpenText(publicConfig);
  reopenLine.hidden = !reopenLine.textContent;
  const retry = document.querySelector('[data-retry]');
  retry.hidden = !failed;
  retry.addEventListener('click', () => location.reload());

  renderBatchStatus(document.querySelector('[data-hero]'), { publicConfig, failed, canOrder });

  if (canOrder) {
    initOrderForm({
      form: document.getElementById('order-form'),
      products: orderable,
      source,
      onSuccess: (result) => renderOrderSuccess(document.querySelector('[data-order-open]'), result)
    });
  }
  renderFeedbackGallery(document.getElementById('feedback'));
  document.body.dataset.ready = 'true';
}

main();
