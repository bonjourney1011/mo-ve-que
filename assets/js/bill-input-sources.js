/**
 * Three ways to hand over the bill image: file picker, drag-and-drop, and Ctrl/⌘+V
 * (screenshot copied from Zalo/Messenger on a computer).
 * While the upload step is active (isActive), a drop anywhere on the page counts, so a near-miss
 * never makes the browser open the image and lose the booking.
 * onFile(file) gets the first image found; onReject() fires for files that are not images.
 */
export function attachBillSources({ dropZone, fileInput, isActive, onFile, onReject }) {
  const firstImage = (list) => [...(list || [])].find((file) => file.type.startsWith('image/'));
  const take = (files) => {
    const file = firstImage(files);
    if (file) onFile(file);
    else if (files?.length) onReject();
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFile(file);
  });

  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, () => dropZone.classList.add('is-dragover')));
  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, () => dropZone.classList.remove('is-dragover')));

  document.addEventListener('dragover', (event) => { if (isActive()) event.preventDefault(); });
  document.addEventListener('drop', (event) => {
    if (!isActive()) return;
    event.preventDefault();
    dropZone.classList.remove('is-dragover');
    take(event.dataTransfer?.files);
  });

  document.addEventListener('paste', (event) => {
    if (!isActive()) return;
    const data = event.clipboardData;
    const files = data?.files?.length
      ? data.files
      : [...(data?.items || [])].filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean);
    if (!files.length) return; // plain text paste: leave it alone
    event.preventDefault();
    take(files);
  });
}

/** True on a computer with a mouse; phones and tablets get the plain picker only. */
export const isDesktopPointer = () => globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;
