// The popup while the app opens the library, and what stops it.

/** The loading popup: `failed` replaces the spinner with an error that stays. */
export function loadingPopup(el: HTMLElement) {
  return {
    done: () => {
      el.hidden = true;
    },
    failed: (message: string) => {
      el.classList.add('failed');
      const text = el.querySelector('p');
      if (text !== null) text.textContent = message;
      el.hidden = false;
    }
  };
}
