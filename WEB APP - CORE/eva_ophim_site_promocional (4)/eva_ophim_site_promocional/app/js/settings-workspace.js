(() => {
  const labels = { branch: 'Filiais', business_unit: 'Unidades de negócio', department: 'Departamentos', cost_center: 'Centros de custo', location: 'Localizações' };
  const allowedParent = { branch: [], business_unit: ['branch'], department: ['branch', 'business_unit'], cost_center: ['branch', 'business_unit', 'department'], location: ['branch', 'business_unit', 'department', 'cost_center', 'location'] };
  const resources = ['wms', 'components', 'eam'];
  const state = { type: 'company', units: [], groups: [], groupMembers: [], people: [], locations: [], admin: false, pendingImage: null, imageRequestId: 0 };
  const $ = selector => document.querySelector(selector);
  const element = (tag, content, className) => { const item = document.createElement(tag); item.textContent = content; if (className) item.className = className; return item; };
  const status = (selector, message) => { const item = $(selector); if (item) item.textContent = message; };
  const unitImage = unit => typeof unit?.image_url === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(unit.image_url) ? unit.image_url : null;
  function showUnitImage(value) {
    const preview = $('#orgUnitImagePreview');
    preview.hidden = !value;
    if (value) preview.src = value; else preview.removeAttribute('src');
  }
  async function makeUnitThumbnail(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) throw new Error('Escolha PNG, JPG ou WebP de até 2 MB.');
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d');
    const scale = Math.min(128 / bitmap.width, 128 / bitmap.height);
    context.drawImage(bitmap, (128 - bitmap.width * scale) / 2, (128 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    bitmap.close();
    const image = canvas.toDataURL('image/webp', 0.78);
    if (image.length > 50_000) throw new Error('A miniatura ficou grande demais. Escolha outra imagem.');
    return image;
  }
  function appendUnitTitle(button, unit) {
    const identity = element('span', '', 'org-unit-identity');
    const image = unitImage(unit);
    if (image) { const thumbnail = document.createElement('img'); thumbnail.className = 'org-unit-thumb'; thumbnail.alt = ''; thumbnail.src = image; identity.append(thumbnail); }
    identity.append(element('span', `${unit.code} · ${unit.name}`));
    button.append(identity);
  }

  async function load() {
    const [profile, units, groups, people, locations] = await Promise.all([
      API.get('/auth/me'), API.get('/org/units'), API.get('/org/groups'), API.get('/org/users'), API.get('/eam/functional-locations')
    ]);
    state.admin = ['admin', 'superadmin'].includes(profile.data?.role);
    if (units.success) state.units = Array.isArray(units.data) ? units.data : [];
    else status('#orgUnitStatus', units.error || 'Não foi possível carregar a estrutura.');
    if (groups.success) {
      state.groups = groups.data?.groups || [];
      state.groupMembers = groups.data?.members || [];
    } else status('#orgGroupStatus', groups.error || 'Não foi possível carregar grupos.');
    state.people = people.success && Array.isArray(people.data) ? people.data : [];
    state.locations = locations.success && Array.isArray(locations.data) ? locations.data : [];
    renderType(); renderHierarchy(); renderGroups(); configureAccess();
  }

  async function refreshUnits() {
    const [result, locations] = await Promise.all([API.get('/org/units'), API.get('/eam/functional-locations')]);
    if (!result.success) return status('#orgUnitStatus', result.error || 'Falha ao atualizar unidades.');
    state.units = Array.isArray(result.data) ? result.data : [];
    if (locations.success && Array.isArray(locations.data)) state.locations = locations.data;
    renderType(); renderHierarchy();
  }
  async function refreshGroups() {
    const result = await API.get('/org/groups');
    if (!result.success) return status('#orgGroupStatus', result.error || 'Falha ao atualizar grupos.');
    state.groups = result.data?.groups || [];
    state.groupMembers = result.data?.members || [];
    renderGroups();
  }

  function configureAccess() {
    for (const selector of ['#orgUnitForm', '#orgGroupForm']) {
      const form = $(selector);
      form?.querySelectorAll('input,select,button').forEach(input => { input.disabled = !state.admin; });
    }
    for (const selector of ['#orgNewUnit', '#orgNewGroup']) { const button = $(selector); if (button) button.hidden = !state.admin; }
  }

  function selectType(type) {
    state.type = type;
    const selector = $('#orgCategorySelect');
    if (selector && selector.value !== type) selector.value = type;
    $('#hasWorkspace').hidden = type !== 'company';
    $('#orgHierarchyCard').hidden = type !== 'company';
    $('#orgUnitsCard').hidden = type === 'company';
    renderType();
  }

  function renderHierarchy() {
    const root = $('#orgHierarchy');
    root.replaceChildren();
    if (!state.units.length) {
      root.append(element('p', 'Cadastre uma filial para iniciar a estrutura. As unidades subordinadas aparecerão aqui.', 'org-muted'));
      return;
    }
    const byParent = new Map();
    state.units.forEach(unit => {
      const parent = Number(unit.parent_id) || 0;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(unit);
    });
    const rendered = new Set();
    function addUnit(unit, depth) {
      if (rendered.has(Number(unit.id))) return;
      rendered.add(Number(unit.id));
      const button = element('button', '');
      button.type = 'button';
      appendUnitTitle(button, unit);
      button.style.marginLeft = `${Math.min(depth, 6) * 20}px`;
      button.style.width = `calc(100% - ${Math.min(depth, 6) * 20}px)`;
      button.append(element('small', labels[unit.unit_type] || unit.unit_type));
      button.addEventListener('click', () => { selectType(unit.unit_type); selectUnit(unit.id); });
      root.append(button);
      (byParent.get(Number(unit.id)) || []).forEach(child => addUnit(child, depth + 1));
    }
    (byParent.get(0) || []).forEach(unit => addUnit(unit, 0));
    state.units.filter(unit => !rendered.has(Number(unit.id))).forEach(unit => addUnit(unit, 0));
  }

  function populateSelect(select, empty, options) {
    select.replaceChildren(new Option(empty, ''));
    options.forEach(option => select.add(new Option(option.label, String(option.value))));
  }

  function renderType(selectedId = null) {
    if (state.type === 'company') return;
    $('#orgUnitHeading').textContent = labels[state.type];
    const list = $('#orgUnitList');
    list.replaceChildren();
    const matching = state.units.filter(unit => unit.unit_type === state.type);
    if (!matching.length) list.append(element('p', `Nenhum cadastro de ${labels[state.type].toLowerCase()} neste workspace.`, 'org-muted'));
    matching.forEach(unit => {
      const button = element('button', '');
      button.type = 'button';
      appendUnitTitle(button, unit);
      button.dataset.id = String(unit.id);
      button.append(element('small', `${unit.status === 'active' ? 'Ativa' : 'Inativa'}${unit.manager_name ? ` · ${unit.manager_name}` : ''}${unit.functional_location_code ? ` · EAM ${unit.functional_location_code}` : ''}`));
      button.addEventListener('click', () => selectUnit(unit.id));
      list.append(button);
    });
    if (selectedId) selectUnit(selectedId);
    else resetUnit();
  }

  function resetUnit() {
    const form = $('#orgUnitForm'); form.reset(); form.elements.id.value = '';
    state.imageRequestId++;
    state.pendingImage = null;
    showUnitImage(null);
    populateSelect(form.elements.parent_id, 'Sem unidade superior', state.units.filter(unit => allowedParent[state.type]?.includes(unit.unit_type)).map(unit => ({ value: unit.id, label: `${unit.code} · ${unit.name}` })));
    populateSelect(form.elements.manager_user_id, 'Sem responsável atribuído', state.people.filter(person => Number(person.is_active)).map(person => ({ value: person.id, label: person.name || person.email })));
    populateSelect(form.elements.functional_location_id, 'Sem vínculo com o EAM', state.locations.map(location => ({ value: location.id, label: `${location.location_code} · ${location.name}` })));
    $('#orgLocationLink').hidden = state.type !== 'location';
    $('#orgBranchFields').hidden = state.type !== 'branch';
    $('#orgDeleteUnit').hidden = true;
    $('#orgCostSummary').hidden = true;
    status('#orgUnitStatus', state.type === 'location' ? 'Sem vínculo selecionado, uma localização funcional é criada no EAM. Escolha um centro de custo como unidade superior para integrar a alocação.' : 'Informe os dados e salve o cadastro.');
    $('#orgUnitList').querySelectorAll('button').forEach(button => button.classList.remove('active'));
    configureAccess();
  }

  function selectUnit(unitId) {
    const unit = state.units.find(item => Number(item.id) === Number(unitId));
    if (!unit) return;
    resetUnit();
    const form = $('#orgUnitForm');
    showUnitImage(unitImage(unit));
    for (const key of ['id', 'code', 'name', 'description', 'status', 'parent_id', 'manager_user_id', 'functional_location_id', 'legal_name', 'tax_id', 'state_registration', 'address', 'city', 'state', 'postal_code']) {
      if (form.elements[key]) form.elements[key].value = unit[key] == null ? '' : String(unit[key]);
    }
    $('#orgDeleteUnit').hidden = !state.admin;
    $('#orgUnitList').querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.id === String(unit.id)));
    status('#orgUnitStatus', `Cadastro atualizado em ${new Date(unit.updated_at).toLocaleString('pt-BR')}.`);
    SettingsDialogs.open('orgUnitForm', `${labels[state.type]} · ${unit.name}`);
    if (unit.unit_type === 'cost_center') {
      const summary = $('#orgCostSummary'); summary.hidden = false; summary.textContent = 'Calculando custos de manutenção…';
      API.get(`/org/cost-centers/${Number(unit.id)}/summary`).then(result => {
        if ($('#orgUnitForm').elements.id.value !== String(unit.id)) return;
        if (!result.success) { summary.textContent = result.error || 'Não foi possível calcular os custos.'; return; }
        const data = result.data;
        const money = amount => Number(amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        summary.textContent = `Custos de manutenção acumulados: ${money(data.total_cost)} · Materiais ${money(data.material_cost)} · Mão de obra ${money(data.labor_cost)} · ${data.asset_count} ativo(s) · ${data.work_order_count} ordem(ns).`;
      });
    }
  }

  function parsePermissions(value) {
    try { return typeof value === 'string' ? JSON.parse(value) : value || {}; }
    catch (_) { return {}; }
  }
  function renderGroups(selectedId = null) {
    const list = $('#orgGroupList'); list.replaceChildren();
    if (!state.groups.length) list.append(element('p', 'Nenhum grupo de acesso cadastrado.', 'org-muted'));
    state.groups.forEach(group => {
      const button = element('button', `${group.code} · ${group.name}`);
      button.type = 'button'; button.dataset.id = String(group.id);
      button.append(element('small', `${group.member_count || 0} membro(s)`));
      button.addEventListener('click', () => selectGroup(group.id));
      list.append(button);
    });
    if (selectedId) selectGroup(selectedId); else resetGroup();
  }
  function resetGroup() {
    const form = $('#orgGroupForm'); form.reset(); form.elements.id.value = '';
    const select = form.elements.members; select.replaceChildren();
    state.people.filter(person => Number(person.is_active)).forEach(person => select.add(new Option(`${person.name || person.email} · ${person.role}`, String(person.id))));
    $('#orgDeleteGroup').hidden = true;
    $('#orgGroupList').querySelectorAll('button').forEach(button => button.classList.remove('active'));
    status('#orgGroupStatus', 'Selecione leitura e escrita por módulo. Escrita também permite consulta.');
    configureAccess();
  }
  function selectGroup(groupId) {
    const group = state.groups.find(item => Number(item.id) === Number(groupId));
    if (!group) return;
    resetGroup();
    const form = $('#orgGroupForm'), permissions = parsePermissions(group.permissions);
    for (const key of ['id', 'code', 'name', 'description']) form.elements[key].value = group[key] || '';
    for (const resource of resources) for (const action of ['read', 'write']) form.elements[`${resource}_${action}`].checked = Boolean(permissions[resource]?.[action]);
    const ids = new Set(state.groupMembers.filter(member => Number(member.group_id) === Number(group.id)).map(member => Number(member.user_id)));
    [...form.elements.members.options].forEach(option => { option.selected = ids.has(Number(option.value)); });
    $('#orgDeleteGroup').hidden = !state.admin;
    $('#orgGroupList').querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.id === String(group.id)));
    status('#orgGroupStatus', 'Altere as permissões ou a seleção de membros e salve.');
    SettingsDialogs.open('orgGroupForm', `Grupo · ${group.name}`);
  }

  function bind() {
    $('#orgCategorySelect').addEventListener('change', event => selectType(event.currentTarget.value));
    $('#orgNewUnit').addEventListener('click', () => { resetUnit(); SettingsDialogs.open('orgUnitForm', `Novo cadastro · ${labels[state.type]}`); });
    $('#orgUnitForm').elements.image_file.addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      const requestId = ++state.imageRequestId;
      if (!file) { state.pendingImage = null; return; }
      try {
        const image = await makeUnitThumbnail(file);
        if (requestId !== state.imageRequestId) return;
        state.pendingImage = image;
        $('#orgUnitForm').elements.remove_image.checked = false;
        showUnitImage(state.pendingImage);
        status('#orgUnitStatus', 'Imagem pronta para salvar.');
      } catch (error) { if (requestId !== state.imageRequestId) return; state.pendingImage = null; event.currentTarget.value = ''; status('#orgUnitStatus', error.message); }
    });
    $('#orgUnitForm').elements.remove_image.addEventListener('change', event => {
      if (event.currentTarget.checked) { state.imageRequestId++; state.pendingImage = null; $('#orgUnitForm').elements.image_file.value = ''; showUnitImage(null); }
      else { const unit = state.units.find(item => Number(item.id) === Number($('#orgUnitForm').elements.id.value)); showUnitImage(unitImage(unit)); }
    });
    $('#orgNewGroup').addEventListener('click', () => { resetGroup(); SettingsDialogs.open('orgGroupForm', 'Novo grupo de acesso'); });
    $('#orgUnitForm').addEventListener('submit', async event => {
      event.preventDefault(); if (!state.admin) return;
      const form = event.currentTarget, data = new FormData(form), currentId = data.get('id');
      const payload = { unit_type: state.type, code: String(data.get('code') || '').trim(), name: String(data.get('name') || '').trim(), parent_id: data.get('parent_id') || null, manager_user_id: data.get('manager_user_id') || null, functional_location_id: state.type === 'location' ? data.get('functional_location_id') || null : null, description: String(data.get('description') || '').trim(), status: data.get('status') };
      if (!data.has('remove_image') && form.elements.image_file.files?.[0] && !state.pendingImage) {
        try { state.pendingImage = await makeUnitThumbnail(form.elements.image_file.files[0]); }
        catch (error) { return status('#orgUnitStatus', error.message); }
      }
      if (data.has('remove_image') || state.pendingImage) payload.image_url = data.has('remove_image') ? null : state.pendingImage;
      if (state.type === 'branch') for (const key of ['legal_name', 'tax_id', 'state_registration', 'address', 'city', 'state', 'postal_code']) payload[key] = String(data.get(key) || '').trim();
      const result = currentId ? await API.put(`/org/units/${Number(currentId)}`, payload) : await API.post('/org/units', payload);
      if (!result.success) return status('#orgUnitStatus', result.error || 'Não foi possível salvar.');
      await refreshUnits(); SettingsDialogs.close('orgUnitForm', 'Cadastro salvo.');
      status('#orgUnitStatus', 'Cadastro salvo.');
    });
    $('#orgDeleteUnit').addEventListener('click', async () => {
      const unitId = $('#orgUnitForm').elements.id.value;
      if (!unitId || !window.confirm('Excluir esta unidade organizacional?')) return;
      const result = await API.delete(`/org/units/${Number(unitId)}`);
      if (!result.success) return status('#orgUnitStatus', result.error || 'Não foi possível excluir.');
      await refreshUnits(); SettingsDialogs.close('orgUnitForm', 'Cadastro excluído.'); status('#orgUnitStatus', 'Cadastro excluído.');
    });
    $('#orgGroupForm').addEventListener('submit', async event => {
      event.preventDefault(); if (!state.admin) return;
      const form = event.currentTarget, data = new FormData(form), currentId = data.get('id');
      const permissions = Object.fromEntries(resources.map(resource => [resource, { read: data.has(`${resource}_read`) || data.has(`${resource}_write`), write: data.has(`${resource}_write`) }]));
      const payload = { code: String(data.get('code') || '').trim(), name: String(data.get('name') || '').trim(), description: String(data.get('description') || '').trim(), permissions };
      const result = currentId ? await API.put(`/org/groups/${Number(currentId)}`, payload) : await API.post('/org/groups', payload);
      if (!result.success) return status('#orgGroupStatus', result.error || 'Não foi possível salvar o grupo.');
      const groupId = result.data.id;
      form.elements.id.value = String(groupId);
      const userIds = [...form.elements.members.selectedOptions].map(option => Number(option.value));
      const assigned = await API.put(`/org/groups/${groupId}/members`, { user_ids: userIds });
      if (!assigned.success) return status('#orgGroupStatus', `Grupo salvo, mas os membros não foram atribuídos: ${assigned.error}`);
      await refreshGroups(); SettingsDialogs.close('orgGroupForm', 'Grupo e membros salvos.'); status('#orgGroupStatus', 'Grupo e membros salvos.');
    });
    $('#orgDeleteGroup').addEventListener('click', async () => {
      const groupId = $('#orgGroupForm').elements.id.value;
      if (!groupId || !window.confirm('Excluir este grupo e suas atribuições?')) return;
      const result = await API.delete(`/org/groups/${Number(groupId)}`);
      if (!result.success) return status('#orgGroupStatus', result.error || 'Não foi possível excluir.');
      await refreshGroups(); SettingsDialogs.close('orgGroupForm', 'Grupo excluído.'); status('#orgGroupStatus', 'Grupo excluído.');
    });
  }
  document.addEventListener('DOMContentLoaded', () => { bind(); load(); });
})();
