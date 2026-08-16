// Keeps the first-run entry button usable even when the local backend has not finished starting.
// The button's existing React onClick handler still performs the real first-run transition.
function enableFirstRunButton() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('button');
  for (const button of buttons) {
    if (button.textContent?.trim() !== 'ENTER E.V. SYSTEM') continue;
    button.disabled = false;
    button.removeAttribute('disabled');
  }
}

enableFirstRunButton();

const observer = new MutationObserver(enableFirstRunButton);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
