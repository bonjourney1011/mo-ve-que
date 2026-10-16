import { el, loadJson } from './dom-and-format-helpers.js';

/**
 * Customer screenshots listed in assets/data/feedback-list.json:
 * [{ "image": "assets/images/feedback/feedback-01.jpg", "caption": "Chị Lan · đợt 22/11" }]
 * The whole section stays hidden until the list has at least one entry.
 */
export async function renderFeedbackGallery(section) {
  let entries = [];
  try {
    entries = await loadJson('assets/data/feedback-list.json');
  } catch (error) {
    console.warn(error);
  }
  entries = Array.isArray(entries) ? entries.filter((entry) => entry && entry.image) : [];
  if (entries.length === 0) return;

  const track = section.querySelector('[data-feedback-track]');
  track.replaceChildren(...entries.map((entry) =>
    el('figure', { class: 'feedback' },
      el('img', { src: entry.image, alt: entry.caption ? `Feedback: ${entry.caption}` : 'Ảnh feedback của khách', loading: 'lazy', decoding: 'async' }),
      entry.caption ? el('figcaption', { text: entry.caption }) : null)));
  section.hidden = false;
}
