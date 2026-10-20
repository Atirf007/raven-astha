(() => {
  'use strict';
  const jobs = new WeakMap(), pending = new Set(), observed = new Set();
  let frame = null;
  function schedule() { if (frame === null) frame = requestAnimationFrame(paint); }
  function paint() {
    frame = null;
    let budget = 2;
    for (const host of pending) {
      pending.delete(host);
      if (!host.isConnected) continue;
      const job = jobs.get(host); if (!job) continue;
      try {
        const url = job.render();
        if (url) { const image = document.createElement('img'); image.src = url; image.alt = ''; image.className = 'model-thumbnail'; host.replaceWith(image); }
      } catch (_) { /* Keep the visible category placeholder if WebGL is unavailable. */ }
      jobs.delete(host);
      if (--budget === 0) break;
    }
    if (pending.size) schedule();
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); observed.delete(entry.target); pending.add(entry.target); }
    if (pending.size) schedule();
  }, {rootMargin: '150px'}) : null;
  window.PersonalThumbnails = {
    prune() { for (const host of observed) if (!host.isConnected) { observer.unobserve(host); observed.delete(host); jobs.delete(host); } },
    create(spec, render, icon = '◇') {
      const host = document.createElement('span'); host.className = 'model-thumbnail model-thumbnail-placeholder';
      host.textContent = icon; host.setAttribute('aria-hidden','true'); jobs.set(host,{render});
      if (observer) { observed.add(host); observer.observe(host); } else { pending.add(host); schedule(); }
      return host;
    }
  };
})();
