(() => {
  'use strict';
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || !['Enter',' '].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target.closest('[role="button"][tabindex]');
    if (!target || target.matches('button,a,input') || (event.target !== target && event.target.closest('input,select,textarea,button,a'))) return;
    if (target.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault(); target.click();
  });
})();
