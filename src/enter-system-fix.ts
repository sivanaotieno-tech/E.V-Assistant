// Reliable first-run boot bridge.
// React normally owns the button, but this module guarantees that the entry control
// cannot get stuck behind backend startup timing or a disabled attribute.
const TARGET = 'ENTER E.V. SYSTEM';
const MARKER = 'data-ev-entry-proxy';

function installEntryProxy() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));

  for (const button of buttons) {
    if (button.textContent?.trim() !== TARGET) continue;

    button.disabled = false;
    button.removeAttribute('disabled');
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';

    if (button.parentElement?.querySelector(`[${MARKER}]`)) continue;

    // Keep React's original control intact, but add an independent native control
    // over it. This avoids browser disabled-button event suppression entirely.
    const proxy = button.cloneNode(true) as HTMLButtonElement;
    proxy.removeAttribute('disabled');
    proxy.setAttribute(MARKER, '1');
    proxy.setAttribute('type', 'button');
    proxy.setAttribute('aria-label', TARGET);
    proxy.style.position = 'absolute';
    proxy.style.inset = '0';
    proxy.style.width = '100%';
    proxy.style.height = '100%';
    proxy.style.margin = '0';
    proxy.style.zIndex = '50';
    proxy.style.pointerEvents = 'auto';
    proxy.style.cursor = 'pointer';

    const parent = button.parentElement;
    if (!parent) continue;
    const position = getComputedStyle(parent).position;
    if (position === 'static') parent.style.position = 'relative';

    button.style.visibility = 'hidden';
    button.style.pointerEvents = 'none';
    parent.appendChild(proxy);

    proxy.addEventListener('click', () => {
      window.localStorage.setItem('ev.firstRunComplete', '1');
      window.dispatchEvent(new CustomEvent('ev:first-run-complete'));
      // React may need one frame to reconcile. Reloading is the deterministic
      // fallback and restores the normal HUD immediately.
      window.setTimeout(() => window.location.reload(), 0);
    }, { once: true });
  }
}

const boot = () => {
  if (!document.documentElement) {
    window.requestAnimationFrame(boot);
    return;
  }
  installEntryProxy();
};

boot();

new MutationObserver(installEntryProxy).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['disabled'],
});
