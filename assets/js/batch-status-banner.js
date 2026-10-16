const DEFAULT_NEXT_HINT = 'Mo sẽ báo trong nhóm Zalo mỗi lần chuẩn bị về quê.';
const LOAD_FAILED_LINE = 'Mạng chập chờn nên chưa xem được đợt hiện tại. Bạn tải lại trang, hoặc nhắn Mo nhé.';

/** Countdown line from the deadline day (it ends at 23:59:59; app-main closes the form after that). */
function deadlineText(deadlineIso, deadlineLabel, now = Date.now()) {
  const daysLeft = Math.floor((new Date(deadlineIso).getTime() - now) / 864e5);
  if (daysLeft === 0) return `Hôm nay (${deadlineLabel}) chốt đơn rồi, nhanh tay nha!`;
  return `Chốt đơn hết ngày ${deadlineLabel} · còn ${daysLeft} ngày`;
}

/**
 * "Dự kiến mở đơn lại ngày 15/12 · còn 12 ngày" from Config → next_open_date.
 * Once that day has passed without reopening, avoid showing a stale date. Empty when unset.
 */
export function nextOpenText(publicConfig, now = Date.now()) {
  if (!publicConfig?.nextOpenDate) return '';
  const daysLeft = Math.ceil((new Date(publicConfig.nextOpenDate).getTime() - now) / 864e5);
  if (daysLeft < 0) return 'Mo sắp mở đơn lại, canh nhóm Zalo nhé!';
  if (daysLeft === 0) return `Hôm nay (${publicConfig.nextOpenLabel}) Mo mở đơn lại, canh nhé!`;
  if (daysLeft === 1) return `Ngày mai (${publicConfig.nextOpenLabel}) Mo mở đơn lại!`;
  return `Dự kiến mở đơn lại ngày ${publicConfig.nextOpenLabel} · còn ${daysLeft} ngày`;
}

/** Updates the hero stamp + status line. `canOrder` is false when nothing is orderable. */
export function renderBatchStatus(root, { publicConfig, failed, canOrder }) {
  const stamp = root.querySelector('[data-batch-stamp]');
  const stampLabel = root.querySelector('[data-batch-stamp-label]');
  const line = root.querySelector('[data-batch-line]');
  const countdown = root.querySelector('[data-countdown]');

  const showClosed = (title, text) => {
    stamp.dataset.state = 'closed';
    stampLabel.textContent = title;
    line.textContent = text || publicConfig?.nextBatchHint || DEFAULT_NEXT_HINT;
    const reopen = text ? '' : nextOpenText(publicConfig);
    countdown.hidden = !reopen;
    countdown.textContent = reopen;
  };

  if (failed) return showClosed('Chưa tải được', LOAD_FAILED_LINE);
  if (!publicConfig) return showClosed('Chưa mở đơn');
  if (!canOrder) return showClosed(publicConfig.batchLabel ? `${publicConfig.batchLabel} đã chốt` : 'Chưa mở đơn');

  stamp.dataset.state = 'open';
  stampLabel.textContent = `Đang mở · ${publicConfig.batchLabel}`;
  line.textContent = publicConfig.deliveryDate
    ? `Giao tận nơi nội thành Hà Nội, miễn phí · ${publicConfig.deliveryDate}`
    : 'Giao tận nơi nội thành Hà Nội, miễn phí';
  if (!publicConfig.deadline) return;
  countdown.hidden = false;
  countdown.textContent = deadlineText(publicConfig.deadline, publicConfig.deadlineLabel);
}
