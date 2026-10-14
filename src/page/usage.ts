// What a visitor should know before they spend credits or keep work here, behind the ⓘ beside the credits.

export const USAGE_POINTS = [
  'This is a sample app, and its data can be deleted: download the designs you want to keep.',
  'The assistant’s model calls and the images it generates are paid in IMG.LY AI credits. Your prompts, previews and generated images go to IMG.LY’s AI gateway and to third-party AI models (for example Anthropic for the assistant, and image models for generation).',
  'Exports (a PNG or PDF you download, and every one the assistant makes) are paid by the platform’s license, as they would be by the product you build. Saving, editing and an .imgly download are free.'
];

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
  info: HTMLButtonElement;
  dialog: HTMLDialogElement;
}): void {
  els.dialog.querySelector('h2')?.after(list());

  els.info.addEventListener('click', () => els.dialog.showModal());
  // `closedby="any"` closes it on a backdrop click; a browser without it gets the same here.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    els.dialog.addEventListener('click', (e) => {
      if (e.target === els.dialog) els.dialog.close();
    });
  }
}
