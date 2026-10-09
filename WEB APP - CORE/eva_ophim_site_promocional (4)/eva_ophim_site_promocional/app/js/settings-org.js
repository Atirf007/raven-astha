(() => {
  const roleLabels = { superadmin: 'Superadmin', admin: 'Administrador', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador' };
  const state = { user: null, organization: null, members: [], positions: [], chart: [], invites: [], orgLogo: null };
  const canManage = () => ['admin', 'superadmin'].includes(state.user?.role);
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function notify(message, isError = false) {
    if (typeof showToast === 'function') showToast(message, isError);
    else window.alert(message);
  }

  async function initialize() {
    const cachedUser = (() => {
      try { return JSON.parse(localStorage.getItem('astha_user') || 'null'); }
      catch (_) { return null; }
    })();
    state.user = cachedUser;
    const [profile, organization] = await Promise.all([API.get('/auth/me'), API.get('/org/me')]);
    if (profile.success && profile.data) {
      state.user = profile.data;
      localStorage.setItem('astha_user', JSON.stringify(profile.data));
      document.querySelectorAll('[data-workspace-brand]').forEach(element => OrganizationBrand.render(element, profile.data));
      AppSidebar.renderApplicationBrand(profile.data);
    }
    if (organization.success) {
      renderOrganization(organization.data);
      AppSidebar.renderApplicationBrand({
        ...(state.user || {}),
        org_name: organization.data?.name,
        org_logo: organization.data?.logo_url,
        org_plan: organization.data?.plan
      });
    }
    else {
      setStatus('workspaceStatus', organization.error || 'Não foi possível carregar a organização.', true);
      const heroName = document.getElementById('workspaceHeroName');
      const heroDetail = document.getElementById('workspaceHeroDetail');
      const heroPlan = document.getElementById('workspaceHeroPlan');
      if (heroName) heroName.textContent = 'Organização indisponível';
      if (heroDetail) heroDetail.textContent = 'Não foi possível buscar os dados deste workspace.';
      if (heroPlan) heroPlan.textContent = '—';
    }
    configureAccess();
    bindForms();
    const [members, positions, chart, invites] = await Promise.all([
      API.get('/org/users'), API.get('/org/positions'), API.get('/org/chart'),
      canManage() ? API.get('/org/invites') : Promise.resolve({ success: false })
    ]);
    state.members = members.success && Array.isArray(members.data) ? members.data : [];
    state.positions = positions.success && Array.isArray(positions.data) ? positions.data : [];
    state.chart = chart.success && Array.isArray(chart.data) ? chart.data : [];
    state.invites = invites.success && Array.isArray(invites.data) ? invites.data : [];
    renderMembers();
    renderTeam();
    renderInvites();
    renderPositionOptions();
  }

  function setStatus(id, message, isError = false) {
    const target = document.getElementById(id);
    if (!target) return;
    target.textContent = message;
    target.dataset.state = isError ? 'error' : 'success';
  }

  function renderOrganization(org) {
    const form = document.getElementById('workspaceForm');
    if (!form || !org) return;
    state.organization = { ...(state.organization || {}), ...org };
    state.orgLogo = OrganizationBrand.imageSource(org.logo_url) || null;
    const logo = document.getElementById('workspaceLogoPreview');
    OrganizationBrand.setImage(logo, state.orgLogo);
    const heroLogo = document.getElementById('workspaceHeroLogo');
    const heroLogoShown = OrganizationBrand.setImage(heroLogo, state.orgLogo);
    const heroInitial = document.getElementById('workspaceHeroInitial');
    if (heroInitial) {
      heroInitial.textContent = (org.name || 'A').trim().charAt(0).toUpperCase();
      heroInitial.hidden = heroLogoShown;
    }
    ['name', 'cnpj', 'email', 'phone', 'address', 'city', 'state'].forEach(key => {
      const field = form.elements.namedItem(key);
      if (field) field.value = org[key] || '';
    });
    const name = document.getElementById('wsOrgName');
    if (name) name.textContent = org.name || 'Organização';
    const heroName = document.getElementById('workspaceHeroName');
    if (heroName) heroName.textContent = org.name || 'Organização';
    const heroDetail = document.getElementById('workspaceHeroDetail');
    if (heroDetail) heroDetail.textContent = org.cnpj ? `CNPJ: ${org.cnpj}` : org.email || 'Dados corporativos e identificação do cliente';
    const heroPlan = document.getElementById('workspaceHeroPlan');
    if (heroPlan) heroPlan.textContent = org.plan || 'Plano não definido';
    SettingsDialogs.renderCompany(state.organization);
    setStatus('workspaceStatus', 'Dados carregados do workspace.');
  }

  function configureAccess() {
    const admin = canManage();
    const workspaceForm = document.getElementById('workspaceForm');
    if (workspaceForm) {
      workspaceForm.querySelectorAll('input').forEach(input => { input.readOnly = !admin; });
      const save = document.getElementById('saveWorkspaceButton');
      if (save) save.hidden = !admin;
    }
    ['workspaceInviteCard', 'corporateEditCompany', 'corporateAddPerson', 'corporateAddPosition'].forEach(id => {
      const section = document.getElementById(id);
      if (section) section.hidden = !admin;
    });
  }

  function renderMembers() {
    const target = document.getElementById('workspaceMembers');
    const count = document.getElementById('workspaceMemberCount');
    if (!target) return;
    if (count) count.textContent = `${state.members.length} ${state.members.length === 1 ? 'pessoa' : 'pessoas'}`;
    target.replaceChildren();
    if (!state.members.length) {
      target.append(node('p', 'settings-help', 'Nenhuma pessoa encontrada neste workspace.'));
      return;
    }
    state.members.forEach(member => {
      const row = node('article', 'workspace-member-row');
      const avatar = node('div', 'workspace-member-avatar');
      const identity = node('div', 'workspace-member-identity');
      const name = node('strong', '', member.name || 'Usuário');
      const email = node('span', '', member.email || '');
      const status = node('span', `workspace-member-status ${Number(member.is_active) ? 'is-active' : 'is-inactive'}`, Number(member.is_active) ? 'Ativo' : 'Inativo');
      const role = document.createElement('select');
      role.className = 'row-input workspace-member-role';
      role.setAttribute('aria-label', `Papel de ${member.name || member.email}`);
      const roleOptions = state.user?.role === 'superadmin'
        ? ['superadmin', 'admin', 'manager', 'operator', 'viewer']
        : ['admin', 'manager', 'operator', 'viewer'];
      roleOptions.forEach(value => {
        const option = node('option', '', roleLabels[value]);
        option.value = value;
        role.append(option);
      });
      role.value = roleOptions.includes(member.role) ? member.role : 'viewer';
      const position = document.createElement('select');
      position.className = 'row-input workspace-member-position';
      position.setAttribute('aria-label', `Cargo de ${member.name || member.email}`);
      const noPosition = node('option', '', 'Sem cargo');
      noPosition.value = '';
      position.append(noPosition);
      state.positions.forEach(item => {
        const option = node('option', '', item.name);
        option.value = String(item.id);
        position.append(option);
      });
      position.value = member.position_id ? String(member.position_id) : '';
      const locked = !canManage() || Number(member.id) === Number(state.user?.id) || (member.role === 'superadmin' && state.user?.role !== 'superadmin');
      role.disabled = locked;
      position.disabled = locked;
      const assignment = node('div', 'workspace-member-assignment');
      assignment.append(node('span', 'corporate-member-role', `${roleLabels[member.role] || member.role} · ${state.positions.find(item => Number(item.id) === Number(member.position_id))?.name || 'Sem cargo'}`));
      if (canManage() && !locked) {
        const editor = node('div', 'corporate-member-editor');
        const roleLabel = node('label', '', 'Papel de acesso'); roleLabel.append(role);
        const positionLabel = node('label', '', 'Cargo'); positionLabel.append(position);
        const save = node('button', 'btn-edit workspace-member-save', 'Salvar acesso');
        save.type = 'button';
        save.addEventListener('click', async () => {
          save.disabled = true;
          try { if (await updateMember(member, role.value, position.value)) SettingsDialogs.close('corporateMemberAccess'); }
          finally { save.disabled = false; }
        });
        editor.append(roleLabel, positionLabel, save);
        const manage = node('button', 'btn-edit', 'Gerenciar acesso'); manage.type = 'button';
        manage.addEventListener('click', () => SettingsDialogs.openPanel(`Acesso · ${member.name || member.email}`, editor));
        assignment.append(manage);
      }
      identity.append(name, email, status);
      const orgMark = node('span', 'workspace-member-org-mark');
      const orgImage = node('img');
      orgImage.alt = '';
      const orgInitial = node('span', '', (state.user?.org_name || 'W').trim().charAt(0).toUpperCase());
      orgImage.addEventListener('error', () => { orgImage.hidden = true; orgInitial.hidden = false; });
      orgInitial.setAttribute('aria-hidden', 'true');
      orgMark.title = state.user?.org_name || 'Workspace';
      orgMark.setAttribute('aria-label', `Organização: ${state.user?.org_name || 'Workspace'}`);
      OrganizationBrand.setImage(orgImage, state.orgLogo);
      orgInitial.hidden = Boolean(state.orgLogo);
      orgMark.append(orgImage, orgInitial);
      row.append(avatar, orgMark, identity, assignment);
      target.append(row);
      if (typeof ProfileAvatar !== 'undefined') ProfileAvatar.render(avatar, Number(member.id) === Number(state.user?.id) ? { ...member, avatar_url: state.user.avatar_url || member.avatar_url } : member);
      else avatar.textContent = (member.name || 'U').trim().charAt(0).toUpperCase();
    });
  }

  async function updateMember(member, role, positionId) {
    const selectedPosition = state.positions.find(position => String(position.id) === positionId);
    const result = await API.put(`/org/users/${Number(member.id)}`, {
      role,
      position_id: positionId ? Number(positionId) : null,
      position_label: selectedPosition?.name || ''
    });
    if (!result.success) return notify(result.error || 'Não foi possível atualizar o acesso.', true);
    notify('Acesso e cargo atualizados.');
    await reloadOrganizationData();
    return true;
  }

  async function reloadOrganizationData() {
    const [members, chart, invites] = await Promise.all([
      API.get('/org/users'), API.get('/org/chart'), canManage() ? API.get('/org/invites') : Promise.resolve({ success: false })
    ]);
    state.members = members.success && Array.isArray(members.data) ? members.data : [];
    state.chart = chart.success && Array.isArray(chart.data) ? chart.data : [];
    state.invites = invites.success && Array.isArray(invites.data) ? invites.data : [];
    renderMembers();
    renderTeam();
    renderInvites();
    renderPositionOptions();
  }

  function renderTeam() {
    const target = document.getElementById('workspaceTeamTree');
    if (!target) return;
    target.replaceChildren();
    if (!state.chart.length) {
      target.append(node('p', 'settings-help', 'O organograma ainda não tem posições. Adicione cargos e associe pessoas para montar a equipe.'));
      return;
    }
    const byId = new Map(state.chart.map(item => [Number(item.id), item]));
    state.chart.forEach(item => {
      const row = node('article', 'workspace-team-row');
      let depth = 0;
      let parent = byId.get(Number(item.reports_to));
      const visited = new Set([Number(item.id)]);
      while (parent && depth < 8 && !visited.has(Number(parent.id))) {
        visited.add(Number(parent.id));
        depth += 1;
        parent = byId.get(Number(parent.reports_to));
      }
      row.style.setProperty('--team-depth', String(depth));
      const avatar = node('div', 'workspace-team-avatar');
      const orgMark = node('span', 'workspace-team-org-mark');
      const orgImage = node('img');
      orgImage.alt = '';
      const orgInitial = node('span', '', (state.user?.org_name || 'W').trim().charAt(0).toUpperCase());
      orgImage.addEventListener('error', () => { orgImage.hidden = true; orgInitial.hidden = false; });
      orgInitial.setAttribute('aria-hidden', 'true');
      orgMark.title = state.user?.org_name || 'Workspace';
      orgMark.setAttribute('aria-label', `Organização: ${state.user?.org_name || 'Workspace'}`);
      OrganizationBrand.setImage(orgImage, state.orgLogo);
      orgInitial.hidden = Boolean(state.orgLogo);
      orgMark.append(orgImage, orgInitial);
      const information = node('div', 'workspace-team-information');
      const member = node('strong', '', item.user_name || item.node_label || 'Posição sem pessoa atribuída');
      const details = node('span', '', [item.position_name, item.department].filter(Boolean).join(' · ') || 'Cargo não informado');
      information.append(member, details);
      row.append(avatar, orgMark, information);
      if (item.avatar_url && item.user_name && typeof ProfileAvatar !== 'undefined') {
        ProfileAvatar.render(avatar, { name: item.user_name, avatar_url: item.avatar_url });
      } else avatar.textContent = (item.user_name || item.node_label || item.position_name || 'P').trim().charAt(0).toUpperCase();
      if (canManage()) {
        const remove = node('button', 'btn-edit workspace-team-remove', 'Remover');
        remove.type = 'button';
        remove.addEventListener('click', () => removeTeamNode(item.id));
        row.append(remove);
      }
      target.append(row);
    });
  }

  function renderPositionOptions() {
    const form = document.getElementById('workspaceTeamForm');
    if (!form) return;
    const userSelect = form.elements.namedItem('user_id');
    const positionSelect = form.elements.namedItem('position_id');
    const managerSelect = form.elements.namedItem('reports_to');
    if (userSelect) {
      userSelect.replaceChildren(new Option('Posição sem pessoa atribuída', ''));
      state.members.filter(member => Number(member.is_active)).forEach(member => userSelect.add(new Option(member.name || member.email, String(member.id))));
    }
    if (positionSelect) {
      positionSelect.replaceChildren(new Option('Selecione um cargo', ''));
      state.positions.forEach(position => positionSelect.add(new Option(position.name, String(position.id))));
    }
    if (managerSelect) {
      managerSelect.replaceChildren(new Option('Sem liderança direta', ''));
      state.chart.forEach(item => managerSelect.add(new Option(`${item.user_name || item.node_label || item.position_name} · ${item.position_name || 'Cargo'}`, String(item.id))));
    }
    const invitePosition = document.querySelector('#workspaceInviteForm [name="position_id"]');
    if (invitePosition) {
      invitePosition.replaceChildren(new Option('Sem cargo definido', ''));
      state.positions.forEach(position => invitePosition.add(new Option(position.name, String(position.id))));
    }
    const adminInviteRole = document.querySelector('#workspaceInviteForm [name="role"] option[value="admin"]');
    if (adminInviteRole) adminInviteRole.hidden = state.user?.role !== 'superadmin';
    const directAdminRole = document.querySelector('#newUserRole option[value="admin"]');
    if (directAdminRole) directAdminRole.hidden = state.user?.role !== 'superadmin';
  }

  function renderInvites() {
    const target = document.getElementById('workspaceInviteList');
    if (!target) return;
    target.replaceChildren();
    const pending = state.invites.filter(invite => !invite.used_by && new Date(invite.expires_at) > new Date());
    if (!pending.length) {
      target.append(node('p', 'settings-help', 'Nenhum convite pendente.'));
      return;
    }
    pending.forEach(invite => {
      const row = node('div', 'workspace-invite-row');
      const code = node('strong', '', invite.code);
      const detail = node('span', '', `${invite.email || 'Qualquer e-mail'} · ${roleLabels[invite.role] || invite.role} · expira ${new Date(invite.expires_at).toLocaleString('pt-BR')}`);
      row.append(code, detail);
      target.append(row);
    });
  }

  async function removeTeamNode(id) {
    if (!window.confirm('Remover esta posição do organograma?')) return;
    const result = await API.delete(`/org/chart/${Number(id)}`);
    if (!result.success) return notify(result.error || 'Não foi possível remover a posição.', true);
    notify('Posição removida do organograma.');
    await reloadOrganizationData();
  }

  function bindForms() {
    const logoInput = document.getElementById('workspaceLogoInput');
    logoInput?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!canManage()) return setStatus('workspaceStatus', 'Sem permissão para alterar a marca.', true);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
        setStatus('workspaceStatus', 'Escolha uma imagem PNG, JPG ou WebP de até 2 MB.', true); return;
      }
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const scale = Math.min(128 / bitmap.width, 128 / bitmap.height);
        ctx.drawImage(bitmap, (128 - bitmap.width * scale) / 2, (128 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
        bitmap.close();
        const logo = canvas.toDataURL('image/webp', 0.78);
        if (logo.length > 50_000) throw new Error('A miniatura ficou grande demais. Escolha uma imagem mais simples.');
        const result = await API.put('/org/logo', { logo });
        if (!result.success) throw new Error(result.error || 'Não foi possível salvar a imagem.');
        state.orgLogo = logo;
        renderOrganization({ ...Object.fromEntries(new FormData(document.getElementById('workspaceForm'))), logo_url: logo });
        renderMembers();
        renderTeam();
        await refreshWorkspaceBrand();
        setStatus('workspaceStatus', 'Logo salvo e vinculado aos membros desta organização.');
      } catch (error) { setStatus('workspaceStatus', error.message || 'Não foi possível processar a imagem.', true); }
      finally { event.target.value = ''; }
    });
    const organizationForm = document.getElementById('workspaceForm');
    organizationForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!canManage()) return notify('Você não tem permissão para editar a empresa.', true);
      const data = new FormData(organizationForm);
      const payload = Object.fromEntries(['name', 'cnpj', 'email', 'phone', 'address', 'city', 'state'].map(key => [key, String(data.get(key) || '').trim()]));
      const result = await API.put('/org/me', payload);
      if (!result.success) return setStatus('workspaceStatus', result.error || 'Não foi possível salvar os dados.', true);
      renderOrganization({ ...(state.organization || {}), ...payload, logo_url: state.orgLogo });
      setStatus('workspaceStatus', 'Dados da empresa salvos.');
      notify('Dados da empresa atualizados.');
      SettingsDialogs.close('workspaceForm');
      const profile = await API.get('/auth/me');
      if (profile.success && profile.data) {
        state.user = profile.data;
        localStorage.setItem('astha_user', JSON.stringify(profile.data));
        document.querySelectorAll('[data-workspace-brand]').forEach(element => OrganizationBrand.render(element, profile.data));
        AppSidebar.renderApplicationBrand(profile.data);
        const name = document.getElementById('wsOrgName');
        if (name) name.textContent = profile.data.org_name || payload.name;
      }
    });

    const inviteForm = document.getElementById('workspaceInviteForm');
    inviteForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!canManage()) return notify('Você não tem permissão para convidar pessoas.', true);
      const data = new FormData(inviteForm);
      const result = await API.post('/org/invites', {
        email: String(data.get('email') || '').trim() || null,
        role: String(data.get('role') || 'viewer'),
        position_id: data.get('position_id') ? Number(data.get('position_id')) : null,
        expires_hours: Number(data.get('expires_hours') || 48)
      });
      if (!result.success) return notify(result.error || 'Não foi possível gerar o convite.', true);
      const output = document.getElementById('workspaceInviteResult');
      if (output) {
        output.hidden = false;
        const code = node('strong', '', `Código: ${result.data.code}`);
        const detail = node('span', '', `Compartilhe este código com a pessoa para concluir o cadastro. Expira em ${new Date(result.data.expires_at).toLocaleString('pt-BR')}.`);
        const copy = node('button', 'btn-edit', 'Copiar código');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(result.data.code); notify('Código copiado.'); }
          catch (_) { window.prompt('Copie o código do convite:', result.data.code); }
        });
        output.replaceChildren(code, detail, copy);
      }
      inviteForm.elements.namedItem('email').value = '';
      notify('Convite gerado. Compartilhe o código com a pessoa.');
      await reloadOrganizationData();
    });

    const teamForm = document.getElementById('workspaceTeamForm');
    teamForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!canManage()) return notify('Você não tem permissão para editar a equipe.', true);
      const data = new FormData(teamForm);
      const userId = String(data.get('user_id') || '');
      const result = await API.post('/org/chart', {
        user_id: userId ? Number(userId) : null,
        position_id: Number(data.get('position_id')),
        reports_to: data.get('reports_to') ? Number(data.get('reports_to')) : null,
        node_label: String(data.get('node_label') || '').trim() || null
      });
      if (!result.success) return notify(result.error || 'Não foi possível adicionar a posição.', true);
      teamForm.reset();
      SettingsDialogs.close('workspaceTeamForm');
      notify('Pessoa adicionada ao organograma.');
      await reloadOrganizationData();
    });

    const positionForm = document.getElementById('workspacePositionForm');
    positionForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!canManage()) return notify('Você não tem permissão para criar cargos.', true);
      const data = new FormData(positionForm);
      const result = await API.post('/org/positions', {
        name: String(data.get('name') || '').trim(),
        department: String(data.get('department') || '').trim() || null,
        level: Number(data.get('level') || 3)
      });
      if (!result.success) return notify(result.error || 'Não foi possível criar o cargo.', true);
      positionForm.reset();
      SettingsDialogs.close('workspacePositionForm');
      notify('Cargo criado.');
      const positions = await API.get('/org/positions');
      state.positions = positions.success && Array.isArray(positions.data) ? positions.data : [];
      renderPositionOptions();
      renderMembers();
    });

    const passwordForm = document.getElementById('securityPasswordForm');
    passwordForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(passwordForm);
      const currentPassword = String(data.get('current_password') || '');
      const newPassword = String(data.get('new_password') || '');
      if (newPassword.length < 8) return notify('A nova senha deve ter pelo menos 8 caracteres.', true);
      if (newPassword !== String(data.get('confirm_password') || '')) return notify('A confirmação da senha não corresponde.', true);
      const result = await API.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      if (!result.success) return notify(result.error || 'Não foi possível atualizar a senha.', true);
      passwordForm.reset();
      notify('Senha atualizada. Entre novamente para continuar.');
      window.setTimeout(() => {
        localStorage.removeItem('astha_token');
        localStorage.removeItem('astha_user');
        window.location.href = './login.html';
      }, 1200);
    });
  }

  async function refreshWorkspaceBrand() {
    const profile = await API.get('/auth/me');
    if (!profile.success || !profile.data) return;
    state.user = profile.data;
    localStorage.setItem('astha_user', JSON.stringify(profile.data));
    document.querySelectorAll('[data-workspace-brand]').forEach(element => OrganizationBrand.render(element, profile.data));
    AppSidebar.renderApplicationBrand(profile.data);
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
