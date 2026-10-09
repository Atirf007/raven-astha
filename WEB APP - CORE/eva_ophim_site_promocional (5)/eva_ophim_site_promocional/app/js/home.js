(function () {
  'use strict';
  if (!Auth.requireAuth()) return;

  const byId = id => document.getElementById(id);
  const count = value => Number(value || 0).toLocaleString('pt-BR');
  const text = (id, value) => { byId(id).textContent = value; };
  const empty = (container, message) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'home-empty';
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
  };

  function renderUser(user) {
    if (!user) return;
    const fullName = [user.name, user.surname].filter(part => typeof part === 'string' && part.trim()).map(part => part.trim()).join(' ') || 'Usuário';
    text('homeUserName', fullName);
    byId('homeUserName').title = fullName;
    ProfileAvatar.render(byId('homeAvatar'), user);
    ProfileAvatar.render(byId('homeProfileNavAvatar'), user);
    OrganizationBrand.render(document.querySelector('[data-workspace-brand]'), user);
    AppSidebar.renderApplicationBrand(user);
    const workspaceMark = byId('homeWorkspaceMark');
    const workspaceLogo = byId('homeWorkspaceLogo');
    const hasWorkspaceLogo = OrganizationBrand.setImage(workspaceLogo, user.org_logo);
    const workspaceInitial = workspaceMark?.querySelector('[data-workspace-initial]');
    if (workspaceInitial) workspaceInitial.hidden = hasWorkspaceLogo;
    if (workspaceMark) {
      workspaceMark.hidden = !hasWorkspaceLogo;
      workspaceMark.title = user.org_name || 'Organização';
      workspaceMark.setAttribute('aria-label', `Organização: ${user.org_name || 'Workspace'}`);
    }
    const role = user.role || Auth.getUserRole();
    document.querySelectorAll('[data-analytics-link]').forEach(link=>{link.hidden=!['superadmin','admin','manager'].includes(role);});
    document.querySelectorAll('[data-role="usuarios"]').forEach(node => { node.hidden = !['admin', 'superadmin'].includes(role); });
    document.querySelectorAll('[data-role="componentes"]').forEach(node => { node.hidden = role === 'viewer'; });
  }

  function renderMaterials(rows) {
    text('homeMaterials', count(rows.length));
    const low = rows.filter(item => Number(item.quantity || 0) <= Number(item.min_qty || 0));
    text('homeLowStock', count(low.length));
    const target = byId('homeLowStockList');
    if (!low.length) return empty(target, 'Nenhum material abaixo do mínimo.');
    target.replaceChildren(...low.slice(0, 5).map(item => {
      const row = document.createElement('div'); row.className = 'home-list-row';
      const label = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.description || item.code || 'Material';
      const code = document.createElement('small'); code.textContent = item.code || '';
      const qty = document.createElement('span'); qty.textContent = `${count(item.quantity)} / mín. ${count(item.min_qty)}`;
      label.append(title, code); row.append(label, qty); return row;
    }));
  }

  function renderOrders(rows) {
    const open = rows.filter(item => !['completed', 'cancelled'].includes(item.status));
    const labels = { draft: 'Rascunho', open: 'Aberta', planned: 'Planejada', released: 'Liberada', in_progress: 'Em execução', on_hold: 'Em espera', awaiting_material: 'Aguardando material' };
    text('homeOpenOrders', count(open.length));
    const target = byId('homeOrdersList');
    if (!open.length) return empty(target, 'Nenhuma ordem em aberto.');
    target.replaceChildren(...open.slice(0, 5).map(item => {
      const row = document.createElement('div'); row.className = 'home-list-row';
      const label = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.title || 'Ordem sem título';
      const code = document.createElement('small'); code.textContent = item.work_order_number || `#${item.id}`;
      const status = document.createElement('span'); status.textContent = labels[item.status] || item.status || 'Aberta';
      label.append(title, code); row.append(label, status); return row;
    }));
  }

  function renderMovements(rows) {
    const target = byId('homeRecentBody');
    if (!rows.length) {
      const row = document.createElement('tr'); const cell = document.createElement('td');
      cell.colSpan = 5; cell.textContent = 'Nenhuma movimentação registrada.';
      row.append(cell); target.replaceChildren(row); return;
    }
    target.replaceChildren(...rows.slice(0, 6).map(item => {
      const row = document.createElement('tr');
      const date = new Date(item.created_at);
      const cells = [
        Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR'),
        `${item.material_code || ''} ${item.material_desc || ''}`.trim() || '—',
        item.type === 'entrada' ? 'Entrada' : item.type === 'saida' ? 'Saída' : item.type || '—',
        count(item.quantity), item.responsible || 'Sistema'
      ];
      cells.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
      return row;
    }));
  }

  async function loadHome() {
    const refresh = byId('homeRefresh'); refresh.disabled = true;
    text('homeUpdated', 'Atualizando dados…');
    ['homeMaterials', 'homeLowStock', 'homeAssets', 'homeOpenOrders'].forEach(id => text(id, '—'));
    const [profileResult, accessResult, organizationResult] = await Promise.all([API.get('/auth/me'), API.get('/org/access/me'), API.get('/org/me')]);
    const profileUser = ProfileAvatar.fromResponse(profileResult);
    const organization = organizationResult.success ? organizationResult.data : null;
    const currentUser = profileUser || Auth.getUser();
    const user = currentUser && organization ? {
      ...currentUser,
      org_name: organization.name,
      org_logo: organization.logo_url,
      org_plan: organization.plan
    } : currentUser;
    if (user) { Auth.setUser(user); renderUser(user); }
    else renderUser(Auth.getUser());
    const restricted = Boolean(accessResult.success && accessResult.data?.restricted);
    const canWms = !restricted || Boolean(accessResult.data.permissions?.wms?.read);
    const canEam = !restricted || Boolean(accessResult.data.permissions?.eam?.read);
    const denied = () => Promise.resolve({ success: false, denied: true });
    const results = await Promise.allSettled([
      Promise.resolve(profileResult), canWms ? API.get('/materials') : denied(), canWms ? API.get('/movements?limit=6') : denied(),
      canEam ? API.get('/eam/assets') : denied(), canEam ? API.get('/eam/work-orders') : denied()
    ]);
    const response = index => results[index].status === 'fulfilled' ? results[index].value : { success: false };
    const missing = [];
    const sections = [
      { index: 1, name: 'materiais', render: renderMaterials, fail: () => empty(byId('homeLowStockList'), 'Materiais indisponíveis no momento.') },
      { index: 2, name: 'movimentações', render: renderMovements, fail: () => {
        const row = document.createElement('tr'); const cell = document.createElement('td');
        cell.colSpan = 5; cell.textContent = 'Movimentações indisponíveis no momento.';
        row.append(cell); byId('homeRecentBody').replaceChildren(row);
      } },
      { index: 3, name: 'ativos', render: rows => text('homeAssets', count(rows.length)) },
      { index: 4, name: 'ordens', render: renderOrders, fail: () => empty(byId('homeOrdersList'), 'Ordens indisponíveis no momento.') }
    ];
    sections.forEach(section => {
      const result = response(section.index);
      if (result.denied) {
        if (section.index === 1) empty(byId('homeLowStockList'), 'Sem acesso ao WMS.');
        if (section.index === 2) {
          const row = document.createElement('tr'); const cell = document.createElement('td');
          cell.colSpan = 5; cell.textContent = 'Sem acesso às movimentações.'; row.append(cell); byId('homeRecentBody').replaceChildren(row);
        }
        if (section.index === 4) empty(byId('homeOrdersList'), 'Sem acesso ao EAM.');
        return;
      }
      if (result.success && Array.isArray(result.data)) section.render(result.data);
      else { missing.push(section.name); section.fail?.(); }
    });
    const feedback = byId('homeFeedback');
    feedback.hidden = !missing.length;
    feedback.textContent = missing.length ? `Não foi possível carregar: ${missing.join(', ')}. Atualize os dados para tentar novamente.` : '';
    text('homeUpdated', `Consultado em ${new Date().toLocaleString('pt-BR')}`);
    refresh.disabled = false;
  }

  renderUser(Auth.getUser());
  const stockView=StockInsights.mount(byId('homeStockInsights'));
  byId('homeRefresh').addEventListener('click',()=>{loadHome();stockView?.refresh();});
  API.get('/warehouse/tabs').then(result=>{if(result.success&&Array.isArray(result.data)&&!result.data.length)window.location.replace('./sistema.html?tab=estoque');});
  loadHome();
})();
