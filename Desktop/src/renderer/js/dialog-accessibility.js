(() => {
  'use strict';
  const opened = new Map();
  let sequence = 0;
  const visible = element => !element.closest('[hidden],[inert],[aria-hidden="true"]') && element.getClientRects().length > 0;
  const controls = overlay => [...overlay.querySelectorAll('*')].filter(element => element.matches('button,input:not([type="hidden"]),select,textarea,a[href],[tabindex]') && !element.matches(':disabled') && element.tabIndex >= 0 && visible(element));
  function synchronize() {
    if (!window.document?.body) return;
    const active = [...document.querySelectorAll('.eo-modal-overlay')].filter(overlay => !overlay.hidden && overlay.style.display !== 'none' && (overlay.classList.contains('active') || Boolean(overlay.style.display)));
    for (const overlay of active) {
      if (opened.has(overlay)) continue;
      const previous = document.activeElement;
      overlay.setAttribute('role', overlay.getAttribute('role') || 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-hidden', 'false');
      const heading = overlay.querySelector('h1,h2,h3');
      if (heading && !overlay.hasAttribute('aria-labelledby')) {
        if (!heading.id) heading.id = 'astha-dialog-title-' + (++sequence);
        overlay.setAttribute('aria-labelledby', heading.id);
      }
      overlay.tabIndex = -1;
      opened.set(overlay, previous);
      (controls(overlay)[0] || overlay).focus();
    }
    for (const [overlay, previous] of opened) {
      if (active.includes(overlay)) continue;
      opened.delete(overlay);
      overlay.setAttribute('aria-hidden', 'true');
      if ((!document.activeElement || document.activeElement === document.body || overlay.contains(document.activeElement)) && previous?.isConnected && !previous.closest('[hidden],[inert]')) previous.focus();
    }
  }
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return; // Native dialogs manage their own focus.
    const overlay = [...opened.keys()].at(-1);
    if (!overlay) return;
    if (event.key === 'Escape') {
      const close = overlay.querySelector('.eo-modal-close');
      if (close && !close.disabled) { event.preventDefault(); event.stopPropagation(); close.click(); }
    } else if (event.key === 'Tab') {
      const list = controls(overlay), first = list[0] || overlay, last = list.at(-1) || overlay;
      if (!list.length || !overlay.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }
  }, true);
  function start() {
    new MutationObserver(records => {
      const relevant = records.some(record => record.type === 'attributes' ? record.target.matches('.eo-modal-overlay') : [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('.eo-modal-overlay') || node.querySelector('.eo-modal-overlay'))));
      if (relevant) synchronize();
    }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class','hidden','style']});
    synchronize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
