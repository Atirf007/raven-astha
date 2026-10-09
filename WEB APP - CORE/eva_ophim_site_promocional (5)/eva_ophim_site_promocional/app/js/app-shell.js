(() => {
  'use strict';
  const preferenceKey = 'astha_sidebar_collapsed';
  const isCompactViewport = () => window.matchMedia('(max-width: 760px)').matches;
  let preferredCollapsed = false;

  function renderProductLogo() {
    document.querySelectorAll('.app-sidebar').forEach(sidebar => {
      if (sidebar.querySelector('.app-product-logo')) return;
      const link = document.createElement('a');
      link.className = 'app-product-logo';
      link.href = './home.html';
      link.setAttribute('aria-label', 'ASTHA — abrir Launchpad');
      const image = document.createElement('img');
      image.src = './images/astha-wordmark.png';
      image.alt = 'ASTHA';
      image.width = 128;
      image.height = 52;
      link.append(image);
      sidebar.prepend(link);
    });
  }

  function applySidebarState(collapsed) {
    const effectiveState = Boolean(collapsed && !isCompactViewport());
    document.querySelectorAll('.app-sidebar').forEach(sidebar => {
      sidebar.classList.toggle('is-collapsed', effectiveState);
      const toggle = sidebar.querySelector('[data-sidebar-toggle]');
      if (!toggle) return;
      const label = effectiveState ? 'Expandir menu lateral' : 'Recolher menu lateral';
      toggle.setAttribute('aria-expanded', String(!effectiveState));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    });
    document.body.classList.toggle('app-sidebar-collapsed', effectiveState);
  }

  function renderApplicationBrand(user) {
    const brand = document.querySelector('[data-app-brand]');
    if (brand && typeof OrganizationBrand !== 'undefined') OrganizationBrand.renderApplicationBrand(brand, user);
    if (user && typeof user.role === 'string') renderNavigation(user);
  }

  function renderNavigation(user) {
    const allowed = Boolean(user && ['superadmin', 'admin', 'manager'].includes(user.role));
    document.querySelectorAll('[data-analytics-link]').forEach(link => { link.hidden = !allowed; });
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-sidebar-toggle]');
    if (!toggle || isCompactViewport()) return;
    const sidebar = toggle.closest('.app-sidebar');
    if (!sidebar) return;
    const collapsed = !sidebar.classList.contains('is-collapsed');
    preferredCollapsed = collapsed;
    try { localStorage.setItem(preferenceKey, collapsed ? 'true' : 'false'); } catch (_) { /* Keep the current session usable without storage. */ }
    applySidebarState(collapsed);
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderProductLogo();
    try { preferredCollapsed = localStorage.getItem(preferenceKey) === 'true'; } catch (_) { /* Use the expanded default. */ }
    applySidebarState(preferredCollapsed);
    renderNavigation(typeof Auth !== 'undefined' ? Auth.getUser() : null);
    window.addEventListener('resize', () => applySidebarState(preferredCollapsed), { passive: true });
  });

  window.AppSidebar = { renderApplicationBrand, applySidebarState, renderNavigation };
})();
