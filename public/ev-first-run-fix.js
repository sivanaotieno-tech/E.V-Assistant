(() => {
  const TARGET = 'ENTER E.V. SYSTEM';

  const unlock = () => {
    for (const button of document.querySelectorAll('button')) {
      if (button.textContent?.trim() !== TARGET) continue;
      button.removeAttribute('disabled');
      button.disabled = false;
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
    }
  };

  unlock();
  new MutationObserver(unlock).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled'],
  });
})();
