(() => {
  'use strict';
  const allowed = () => typeof Auth !== 'undefined' && ['admin', 'superadmin', 'manager'].includes(Auth.getUser()?.role);
  function equipmentLink(parent, asset, period = {}) {
    if (!parent || !allowed() || !asset || typeof asset.asset_code !== 'string' || !asset.asset_code.trim() || asset.asset_code.length > 120) return;
    const query = new URLSearchParams({ asset_code: asset.asset_code });
    for (const key of ['from', 'through']) if (/^\d{4}-\d{2}-\d{2}$/.test(period[key] || '')) query.set(key, period[key]);
    const link = document.createElement('a');
    link.className = 'btn btn-secondary btn-sm';
    link.href = './analytics.html?' + query;
    link.textContent = 'Estudar leituras no Estúdio';
    parent.append(link);
    return link;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const actions = document.querySelector('#panel-eam .eam-ux-actions');
    if (!actions || !allowed()) return;
    const link = document.createElement('a');
    link.className = 'btn btn-secondary btn-sm';
    link.href = './analytics.html';
    link.textContent = 'Estúdio de análises';
    link.addEventListener('click', () => {
      const selected = document.getElementById('eamReliabilityAsset')?.value;
      const asset = (window.eamAssetsForWorkspace || []).find(item => String(item.id) === selected);
      const holder = document.createElement('div');
      const contextual = equipmentLink(holder, asset, {
        from: document.getElementById('eamReliabilityFrom')?.value,
        through: document.getElementById('eamReliabilityTo')?.value
      });
      link.href = contextual ? contextual.getAttribute('href') : './analytics.html';
    });
    actions.append(link);
  });
  window.AnalyticsEntry = { equipmentLink };
})();
