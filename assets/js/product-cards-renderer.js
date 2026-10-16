import { el, formatPriceShort } from './dom-and-format-helpers.js';

/** Live price/stock from the Sheet keyed by sku; empty when the API is not reachable. */
export function indexLiveProducts(publicConfig) {
  const bySku = {};
  for (const product of publicConfig?.products || []) bySku[product.sku] = product;
  return bySku;
}

function statusChip(live, batchOpen) {
  if (!live) return null;
  if (!live.available) return el('span', { class: 'chip chip--soon', text: 'Sắp có' });
  if (!batchOpen) return null;
  if (live.left === 0) return el('span', { class: 'chip chip--out', text: 'Đợt này hết rồi' });
  if (live.left != null) return el('span', { class: 'chip chip--left', text: `Còn ${live.left} ${live.unit}` });
  return el('span', { class: 'chip chip--left', text: 'Đang nhận đơn' });
}

/** Leaf-wrapped placeholder until real photos arrive; it doubles as the photo frame. */
function photoFrame(content) {
  const frame = el('div', { class: 'photo-frame' });
  if (content.image) {
    const img = el('img', { src: content.image, alt: content.imageAlt || content.name, loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => { img.remove(); frame.classList.add('photo-frame--empty'); });
    frame.append(img);
  } else {
    frame.classList.add('photo-frame--empty');
  }
  frame.append(
    el('span', { class: 'photo-frame__twine', 'aria-hidden': 'true' }),
    el('span', { class: 'photo-frame__note', text: 'Ảnh thật Mo chụp ở chuyến về tới' })
  );
  return frame;
}

function priceLine(live) {
  if (!live || !live.price) return el('p', { class: 'card__price card__price--muted', text: 'Giá báo khi mở đơn' });
  return el('p', { class: 'card__price' },
    el('strong', { text: formatPriceShort(live.price) }),
    el('span', { text: ` / ${live.unit}` }));
}

function productCard(content, live, batchOpen) {
  const details = el('details', { class: 'card__details' },
    el('summary', { text: 'Cách ăn & bảo quản' }),
    el('p', {}, el('b', { text: 'Ăn sao cho ngon: ' }), content.howToEat),
    el('p', {}, el('b', { text: 'Bảo quản: ' }), content.storage),
    content.caution ? el('p', { class: 'card__caution', text: content.caution }) : null
  );
  return el('article', { class: 'card', id: `mon-${content.sku}` },
    photoFrame(content),
    el('div', { class: 'card__body' },
      el('div', { class: 'card__head' },
        el('h3', { class: 'card__title', text: content.name }),
        statusChip(live, batchOpen)),
      priceLine(live),
      el('p', { class: 'card__tagline', text: content.tagline }),
      el('p', { class: 'card__desc', text: content.description }),
      details)
  );
}

export function renderProductCards(container, contents, liveBySku, batchOpen) {
  container.replaceChildren(...contents.map((content) => productCard(content, liveBySku[content.sku], batchOpen)));
}
