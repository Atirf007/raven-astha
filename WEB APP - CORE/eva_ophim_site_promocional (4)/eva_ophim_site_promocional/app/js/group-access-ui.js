(() => {
  const moduleForTab = tab => tab === 'componentes' ? 'components' : tab === 'eam' ? 'eam' : ['dashboard', 'estoque', 'entrada', 'saida', 'mapa', 'relatorios'].includes(tab) ? 'wms' : null;
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.API || !localStorage.getItem('astha_token')) return;
    const result = await API.get('/org/access/me');
    if (!result.success || !result.data?.restricted) return;
    const grants = result.data.permissions || {};
    document.querySelectorAll('a[href*="sistema.html?tab="]').forEach(link => {
      const module = moduleForTab(new URL(link.href).searchParams.get('tab'));
      if (module && !grants[module]?.read) { link.hidden = true; link.style.display = 'none'; }
    });
    if (location.pathname.endsWith('/sistema.html')) {
      const tab = new URLSearchParams(location.search).get('tab') || 'dashboard';
      const module = moduleForTab(tab);
      if (module && !grants[module]?.read) location.replace('./home.html');
    }
  });
})();
