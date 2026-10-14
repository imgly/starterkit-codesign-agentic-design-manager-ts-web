// Clear data in the header: asks, stops the runner and its executor, deletes what the demo keeps in this browser, and
// reloads to a first visit. Sign-in keeps its own keys, so the visitor stays signed in.

import { clearData } from '../hosting.js';

/** The prefix of the page's own localStorage keys: the chosen brand. */
const PAGE_KEY_PREFIX = 'codesign-tab.';

export function forgetPageKeys(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'>
): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(PAGE_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function clearDataButton(els: {
  button: HTMLButtonElement;
  dialog: HTMLDialogElement;
  /** Ends the page's runner, and what the hosting started with it. */
  stop: () => void;
  fail: (message: string) => void;
}): void {
  const clear = clearData;
  // A hosting that keeps nothing in the browser offers no button.
  if (clear === undefined) return;
  els.button.hidden = false;
  els.button.addEventListener('click', () => {
    els.dialog.returnValue = '';
    els.dialog.showModal();
  });
  els.dialog.addEventListener('close', () => {
    if (els.dialog.returnValue !== 'clear') return;
    els.stop();
    clear().then(
      () => {
        try {
          forgetPageKeys(localStorage);
        } catch {
          // Storage blocked: there were no keys to forget.
        }
        location.reload();
      },
      (err: unknown) =>
        els.fail(
          `Some data could not be deleted: ${err instanceof Error ? err.message : String(err)}. Reload and try again, or clear this site’s data in the browser’s settings.`
        )
    );
  });
}
