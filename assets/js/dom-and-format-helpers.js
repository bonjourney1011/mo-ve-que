// Small shared helpers. All dynamic text goes through textContent, never innerHTML.

export const formatVnd = (amount) =>
  `${String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

export const formatPriceShort = (amount) =>
  amount % 1000 === 0 ? `${amount / 1000}k` : formatVnd(amount);

/** el('p', { class: 'note', text: 'hi' }, child1, child2) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) node.append(child);
  }
  return node;
}

export async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Không tải được ${path}`);
  return response.json();
}

export async function copyText(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Đã chép ✓';
  } catch {
    button.textContent = 'Chép thủ công nhé';
  }
  setTimeout(() => { button.textContent = original; }, 1800);
}
