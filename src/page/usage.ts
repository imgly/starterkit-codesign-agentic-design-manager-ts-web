// What a visitor should know before they spend credits or keep work here: a card on the first visit, and the same
// points behind the ⓘ beside the credits.

export const USAGE_POINTS = [
  'This is a demo, and its data can be deleted: download the designs you want to keep.',
  'The assistant’s model calls and the images it generates are paid in IMG.LY AI credits. Your prompts, previews and generated images go to IMG.LY’s AI gateway and to third-party AI models (for example Anthropic for the assistant, and image models for generation).',
  'Exports (a PNG or PDF you download, and every one the assistant makes) are paid by the platform’s license, as they would be by the product you build. Saving, editing and an .imgly download are free.'
];

const SEEN_KEY = 'codesign-tab.usage-seen';

const list = () => {
  const ul = document.createElement('ul');
  ul.className = 'usage-points';
  for (const point of USAGE_POINTS) {
    const li = document.createElement('li');
    li.textContent = point;
    ul.append(li);
  }
  return ul;
};

export function usageNotices(els: {
  card: HTMLElement;
  info: HTMLButtonElement;
  dialog: HTMLDialogElement;
}): void {
  els.card.querySelector('h3')?.after(list());
  els.dialog.querySelector('h2')?.after(list());

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    // Storage blocked: the card shows on every visit.
  }
  els.card.hidden = seen;
  els.card.querySelector('button')?.addEventListener('click', () => {
    els.card.hidden = true;
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: dismissed until the next visit.
    }
  });

  els.info.addEventListener('click', () => els.dialog.showModal());
  // `closedby="any"` closes it on a backdrop click; a browser without it gets the same here.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    els.dialog.addEventListener('click', (e) => {
      if (e.target === els.dialog) els.dialog.close();
    });
  }
}
