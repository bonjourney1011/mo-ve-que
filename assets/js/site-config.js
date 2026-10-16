// The only file you need to edit on the page side. Leave a value empty to hide that button.
export const SITE_CONFIG = {
  // Apps Script web app URL ending in /exec (see README, step 2). Empty = ordering hidden.
  apiUrl: 'https://script.google.com/macros/s/AKfycbwEjoYqzdm-Btw76LpgmhIy0w_pE4TtRnv9L5h0NlZ6ngLOfITh4QRjPxnZcQItQSIa/exec',
  // Facebook username for https://m.me/<username>
  messengerUsername: 'thuanbon.mo',
  // Zalo group invite link, e.g. https://zalo.me/g/abcxyz
  zaloGroupUrl: '',
  // Personal Zalo QR image (no phone number shown on the page)
  zaloQrImage: 'assets/images/zalo-qr.png',
  portfolioUrl: 'https://bonjourney1011.github.io/'
};

export const messengerUrl = () =>
  SITE_CONFIG.messengerUsername ? `https://m.me/${encodeURIComponent(SITE_CONFIG.messengerUsername)}` : '';
