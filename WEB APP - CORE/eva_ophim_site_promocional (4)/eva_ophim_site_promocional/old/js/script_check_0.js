
    function compressImage(file, maxSize, callback) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if(w > maxSize || h > maxSize) {
             const ratio = Math.min(maxSize/w, maxSize/h);
             w = w * ratio; h = h * ratio;
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function showToast(m, t='info') {
      const c = document.getElementById('toastContainer');
      const d = document.createElement('div');
      d.className = 'toast toast-'+t;
      d.innerHTML = `<span>${m}</span>`;
      c.appendChild(d);
      setTimeout(()=> { d.style.opacity='0'; setTimeout(()=>d.remove(), 300); }, 4000);
    }

    let currentUser = null;
    let localUsers = [];
    let corpSettings = { id: 'org_1', name: 'Evah Ophim Ltda.', plan: 'Enterprise', logo: null, policies: { allowEdit: true, require2FA: false, restrictIP: false, advancedAudit: true } };
    let organizations = [corpSettings];
    let currentOrgId = 'org_1';

    window.onload = () => {
      if(!Auth.isAuthenticated()) { window.location.href = '../login.html'; return; }
      const sessionUser = Auth.getUser() || { email: '', name: 'Visitante', role: 'viewer' };
      
      const theme = localStorage.getItem('evah_theme') || 'dark';
      if(theme === 'light') { document.documentElement.classList.add('light-mode'); }
      
      // Load user DB to find the actual user
      try {
        const d = localStorage.getItem('evah_users');
        if(d) localUsers = JSON.parse(d);
        const o = localStorage.getItem('evah_orgs');
        if(o) {
          organizations = JSON.parse(o);
        } else {
          const oldC = localStorage.getItem('evah_corp');
          if(oldC) {
             const parsedOld = JSON.parse(oldC);
             corpSettings = { id: 'org_1', name: parsedOld.name, plan: parsedOld.plan, logo: parsedOld.logo, policies: { allowEdit: parsedOld.allowEdit !== false, require2FA: false, restrictIP: false, advancedAudit: true } };
             organizations = [corpSettings];
          }
        }
        corpSettings = organizations.find(org => org.id === currentOrgId) || organizations[0];
      } catch(e) {}
      
      // Attempt to link session to local user DB
      currentUser = localUsers.find(u => u.email === sessionUser.email) || sessionUser;
      
      document.getElementById('greetingText').textContent = `Olá, ${currentUser.name || 'Usuário'}`;
      if (currentUser.avatar_url) {
        document.getElementById('headerAvatar').style.backgroundImage = `url(${currentUser.avatar_url})`;
        document.getElementById('headerAvatar').textContent = '';
      } else {
        document.getElementById('headerAvatar').style.backgroundImage = 'none';
        document.getElementById('headerAvatar').textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
      }
      // Populate rich dropdown
      document.getElementById('dropName').textContent = currentUser.name || 'Usuário';
      document.getElementById('dropEmail').textContent = currentUser.email || 'N/A';
      document.getElementById('dropRole').textContent = currentUser.role || 'Usuário';
      
      const myDropOrg = organizations.find(o => o.id === currentUser.orgId) || organizations[0];
      document.getElementById('dropPlan').textContent = myDropOrg.plan || 'Enterprise';
      document.getElementById('dropCorpName').textContent = myDropOrg.name || 'Evah Ophim Ltda.';
      
      document.getElementById('dropCorpLogo').src = myDropOrg.logo || '../../images/Logotipo (Alpha).png';
      document.getElementById('dropCorpLogo').style.display = 'block';

      
      if (currentUser.avatar_url) {
        document.getElementById('dropAvatar').style.backgroundImage = `url(${currentUser.avatar_url})`;
        document.getElementById('dropAvatar').textContent = '';
      } else {
        document.getElementById('dropAvatar').style.backgroundImage = 'none';
        document.getElementById('dropAvatar').textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
      }
      
      document.addEventListener('click', (e) => {
        const drop = document.getElementById('userDropdown');
        const avatar = document.getElementById('headerAvatar');
        if(drop && drop.classList.contains('active') && !drop.contains(e.target) && e.target !== avatar) {
          drop.classList.remove('active');
        }
      });

      // Show Admin card if root/admin
      if(currentUser.role === 'admin' || currentUser.email === 'root') {
        document.getElementById('adminCard').style.display = 'flex';
      }
    };

    function toggleTheme() {
      document.documentElement.classList.toggle('light-mode');
      const isLight = document.documentElement.classList.contains('light-mode');
      localStorage.setItem('evah_theme', isLight ? 'light' : 'dark');
    }

    function toggleDropdown() {
      document.getElementById('userDropdown').classList.toggle('active');
    }

    function previewProfileImage(input) {
      const file = input.files[0];
      if(!file) return;
      compressImage(file, 256, (dataUrl) => {
        document.getElementById('profImagePreview').src = dataUrl;
        document.getElementById('profImagePreview').style.display = 'block';
        document.getElementById('profImagePlaceholder').style.display = 'none';
        document.getElementById('profImageData').value = dataUrl;
      });
    }

    function openProfileModal() {
      document.getElementById('profName').value = currentUser.name || '';
      document.getElementById('profEmail').value = currentUser.email || '';
      document.getElementById('profOrg').value = corpSettings.name || 'Evah Ophim Ltda.';
      document.getElementById('profPlan').textContent = corpSettings.plan || 'Enterprise';
      document.getElementById('profRole').value = currentUser.role || 'Usuário';
      document.getElementById('profSector').value = currentUser.sector || 'Logística / WMS';
      
      if(corpSettings.logo) {
         document.getElementById('profOrgLogo').src = corpSettings.logo;
         document.getElementById('profOrgLogo').style.display = 'block';
      } else {
         document.getElementById('profOrgLogo').style.display = 'none';
      }
      
      if(currentUser.avatar_url) {
        document.getElementById('profImagePreview').src = currentUser.avatar_url;
        document.getElementById('profImagePreview').style.display = 'block';
        document.getElementById('profImagePlaceholder').style.display = 'none';
        document.getElementById('profImageData').value = currentUser.avatar_url;
      } else {
        document.getElementById('profImagePreview').style.display = 'none';
        document.getElementById('profImagePlaceholder').style.display = 'block';
        document.getElementById('profImageData').value = '';
      }
      
      const canEdit = corpSettings.allowEdit !== false || currentUser.role === 'admin' || currentUser.email === 'root';
      document.getElementById('profName').disabled = !canEdit;
      // Email is always disabled to prevent breaking login links
      
      document.getElementById('profileModal').classList.add('active');
    }

    
    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    function handleProfileSubmit(e) {
      e.preventDefault();
      const newName = document.getElementById('profName').value.trim();
      const newEmail = document.getElementById('profEmail').value.trim();
      const newAvatar = document.getElementById('profImageData').value;
      
      if(currentUser.email === 'root') {
        showToast('A conta Root não pode ser alterada', 'error');
        return;
      }

      // Update in Local DB
      let dbUser = localUsers.find(u => u.email === currentUser.email);
      if(!dbUser) {
        dbUser = { email: currentUser.email, role: currentUser.role, sector: currentUser.sector };
        localUsers.push(dbUser);
      }
      dbUser.name = newName;
      dbUser.email = newEmail;
      dbUser.avatar_url = newAvatar;
      try {
        localStorage.setItem('evah_users', JSON.stringify(localUsers));
      } catch(err) {
        if(err.name === 'QuotaExceededError') showToast('Imagem muito grande para salvar', 'warning');
      }
      
      // Update session
      const sessionUser = Auth.getUser();
      sessionUser.name = newName;
      sessionUser.email = newEmail;
      sessionUser.avatar_url = newAvatar;
      Auth.setUser(sessionUser);
      currentUser.name = newName;
      currentUser.email = newEmail;
      currentUser.avatar_url = newAvatar;
      
      document.getElementById('greetingText').textContent = `Olá, ${currentUser.name}`;
      if (newAvatar) {
        document.getElementById('headerAvatar').style.backgroundImage = `url(${newAvatar})`;
        document.getElementById('headerAvatar').textContent = '';
        document.getElementById('dropAvatar').style.backgroundImage = `url(${newAvatar})`;
        document.getElementById('dropAvatar').textContent = '';
      } else {
        document.getElementById('headerAvatar').style.backgroundImage = 'none';
        document.getElementById('headerAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('dropAvatar').style.backgroundImage = 'none';
        document.getElementById('dropAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
      }
      document.getElementById('dropName').textContent = currentUser.name;
      document.getElementById('dropEmail').textContent = currentUser.email;
      
      showToast('Perfil atualizado com sucesso!', 'success');
      closeModal('profileModal');
    }

    
    function renderAdminUserList() {
      const list = document.getElementById('adminUserList');
      list.innerHTML = '';
      if(localUsers.length === 0) {
        list.innerHTML = '<div style="color:var(--text-tertiary);font-size:var(--text-sm)">Nenhum usuário cadastrado localmente.</div>';
      } else {
        localUsers.forEach((u, index) => {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.justifyContent = 'space-between';
          div.style.padding = '12px 0';
          div.style.borderBottom = '1px solid var(--surface-border)';
          
          const selOrg = `<select class="eo-input user-org-select" data-idx="${index}" style="padding: 4px; height: auto;">
             ${organizations.map(o => `<option value="${o.id}" ${u.orgId===o.id?'selected':''}>${o.name}</option>`).join('')}
          </select>`;
          
          const selRole = `<select class="eo-input user-role-select" data-idx="${index}" style="padding: 4px; height: auto;">
             <option value="viewer" ${u.role==='viewer'?'selected':''}>Visualizador</option>
             <option value="operator" ${u.role==='operator'?'selected':''}>Operador</option>
             <option value="admin" ${u.role==='admin'?'selected':''}>Administrador</option>
          </select>`;
          
          const selSector = `<select class="eo-input user-sector-select" data-idx="${index}" style="padding: 4px; height: auto;">
             <option value="Logística" ${u.sector==='Logística'?'selected':''}>Logística</option>
             <option value="TI" ${u.sector==='TI'?'selected':''}>TI</option>
             <option value="RH" ${u.sector==='RH'?'selected':''}>RH</option>
             <option value="Financeiro" ${u.sector==='Financeiro'?'selected':''}>Financeiro</option>
          </select>`;

          div.innerHTML = `
            <div style="flex-grow:1;">
              <div style="font-weight:bold; font-size:var(--text-sm)">${u.name}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary)">${u.email}</div>
            </div>
            <div style="display:flex; gap: 10px; align-items:center;">
               <div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Cargo</div>
                 ${selRole}
               </div>
               <div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Setor</div>
                 ${selSector}
               </div>
               <div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Locatário</div>
                 ${selOrg}
               </div>
               <button class="btn btn-ghost btn-sm" style="color:var(--color-error); margin-top:14px;" onclick="removeAdminUser(${index})">✕</button>
            </div>
          `;
          list.appendChild(div);
        });
      }
    }

    function loadOrgSettings() {
      const sel = document.getElementById('orgSelector');
      if(sel && sel.value) currentOrgId = sel.value;
      corpSettings = organizations.find(org => org.id === currentOrgId) || organizations[0];
      
      document.getElementById('corpName').value = corpSettings.name || '';
      document.getElementById('corpPlan').value = corpSettings.plan || 'Enterprise';
      document.getElementById('policyEditProfile').checked = corpSettings.policies?.allowEdit !== false;
      document.getElementById('policy2FA').checked = corpSettings.policies?.require2FA || false;
      document.getElementById('policyIP').checked = corpSettings.policies?.restrictIP || false;
      document.getElementById('policyAudit').checked = corpSettings.policies?.advancedAudit || false;
      
      if(corpSettings.logo) {
         document.getElementById('corpLogoPreview').src = corpSettings.logo;
         document.getElementById('corpLogoPreview').style.display = 'block';
         document.getElementById('corpLogoPlaceholder').style.display = 'none';
         document.getElementById('corpLogoData').value = corpSettings.logo;
      } else {
         document.getElementById('corpLogoPreview').style.display = 'none';
         document.getElementById('corpLogoPlaceholder').style.display = 'block';
         document.getElementById('corpLogoData').value = '';
      }
    }

    function createNewOrg() {
      document.getElementById('newOrgName').value = '';
      document.getElementById('newOrgPlan').value = 'Free';
      document.getElementById('newOrgModal').classList.add('active');
    }
    
    function submitNewOrg() {
      const name = document.getElementById('newOrgName').value.trim();
      if(!name) { showToast('Preencha o nome', 'warning'); return; }
      
      const newOrg = {
         id: 'org_' + Date.now(),
         name: name,
         plan: document.getElementById('newOrgPlan').value,
         logo: null,
         policies: { allowEdit: true, require2FA: false, restrictIP: false, advancedAudit: false }
      };
      organizations.push(newOrg);
      currentOrgId = newOrg.id;
      
      try {
         localStorage.setItem('evah_orgs', JSON.stringify(organizations));
         showToast('Organização criada com sucesso!', 'success');
      } catch(e) {
         showToast('Erro ao salvar organização.', 'error');
      }
      
      closeModal('newOrgModal');
      
      // Refresh admin modal
      const sel = document.getElementById('orgSelector');
      if(sel) {
         sel.innerHTML = organizations.map(o => `<option value="${o.id}" ${o.id===currentOrgId?'selected':''}>${o.name}</option>`).join('');
         loadOrgSettings();
      }
    }

    function openAdminModal() {
      const sel = document.getElementById('orgSelector');
      sel.innerHTML = organizations.map(o => `<option value="${o.id}" ${o.id===currentOrgId?'selected':''}>${o.name}</option>`).join('');
      
      // Check if user is IT Support to show logs tab
      if(currentUser.sector === 'TI' || currentUser.email === 'root@evah.local') {
         document.getElementById('tabLogsBtn').style.display = 'inline-block';
      } else {
         document.getElementById('tabLogsBtn').style.display = 'none';
      }
      
      loadOrgSettings();
      renderAdminUserList();
      switchAdminTab(0);
      document.getElementById('adminModal').classList.add('active');
    }

    function switchAdminTab(idx) {
      document.querySelectorAll('.admin-tab').forEach((el, i) => {
         el.style.display = i === idx ? 'block' : 'none';
      });
      document.querySelectorAll('.admin-tab-btn').forEach((btn, i) => {
         if(i === idx) btn.classList.add('active');
         else btn.classList.remove('active');
      });
    }

    function addAdminUser() {
      const name = document.getElementById('newUserName').value.trim();
      const email = document.getElementById('newUserEmail').value.trim();
      if(!name || !email) { showToast('Preencha nome e e-mail', 'warning'); return; }
      if(localUsers.find(u => u.email === email)) { showToast('E-mail já existe no sistema', 'error'); return; }
      
      localUsers.push({ name, email, role: 'viewer', sector: 'Logística', orgId: currentOrgId, avatar_url: null });
      document.getElementById('newUserName').value = '';
      document.getElementById('newUserEmail').value = '';
      renderAdminUserList();
    }

    function removeAdminUser(idx) {
      if(localUsers[idx].email === currentUser.email) { showToast('Você não pode se remover', 'error'); return; }
      localUsers.splice(idx, 1);
      renderAdminUserList();
    }

    function saveAdminUsers() {
      document.querySelectorAll('.user-role-select').forEach(sel => {
         const idx = sel.getAttribute('data-idx');
         localUsers[idx].role = sel.value;
      });
      document.querySelectorAll('.user-sector-select').forEach(sel => {
         const idx = sel.getAttribute('data-idx');
         localUsers[idx].sector = sel.value;
      });
      document.querySelectorAll('.user-org-select').forEach(sel => {
         const idx = sel.getAttribute('data-idx');
         localUsers[idx].orgId = sel.value;
      });
      try {
        localStorage.setItem('evah_users', JSON.stringify(localUsers));
        showToast('Permissões de usuários salvas!', 'success');
      } catch(e) {
        showToast('Erro ao salvar usuários', 'error');
      }
    }

    function previewCorpLogo(input) {
      const file = input.files[0];
      if(!file) return;
      compressImage(file, 400, (dataUrl) => {
        document.getElementById('corpLogoPreview').src = dataUrl;
        document.getElementById('corpLogoPreview').style.display = 'block';
        document.getElementById('corpLogoPlaceholder').style.display = 'none';
        document.getElementById('corpLogoData').value = dataUrl;
      });
    }

    function saveOrgSettings(silent = false) {
      if(corpSettings) {
        corpSettings.name = document.getElementById('corpName').value.trim() || 'Nova Organização';
        corpSettings.plan = document.getElementById('corpPlan').value;
        if(!corpSettings.policies) corpSettings.policies = {};
        corpSettings.policies.allowEdit = document.getElementById('policyEditProfile').checked;
        corpSettings.policies.require2FA = document.getElementById('policy2FA').checked;
        corpSettings.policies.restrictIP = document.getElementById('policyIP').checked;
        corpSettings.policies.advancedAudit = document.getElementById('policyAudit').checked;
        corpSettings.logo = document.getElementById('corpLogoData').value;
      }
      
      try {
        localStorage.setItem('evah_orgs', JSON.stringify(organizations));
        if(!silent) showToast('Configurações da Organização salvas com sucesso!', 'success');
        
        // Atualiza a view do perfil se estiver no background
        if(document.getElementById('profOrg') && corpSettings.id === (currentUser.orgId || organizations[0].id)) {
           document.getElementById('profOrg').value = corpSettings.name;
           document.getElementById('profPlan').textContent = corpSettings.plan;
           if(corpSettings.logo) {
             document.getElementById('profOrgLogo').src = corpSettings.logo;
             document.getElementById('profOrgLogo').style.display = 'block';
             document.getElementById('dropCorpLogo').src = corpSettings.logo;
             document.getElementById('dropCorpLogo').style.display = 'block';
           }
           document.getElementById('dropCorpName').textContent = corpSettings.name;
        }
        
        // Re-render select list in case name changed
        const sel = document.getElementById('orgSelector');
        sel.innerHTML = organizations.map(o => `<option value="${o.id}" ${o.id===currentOrgId?'selected':''}>${o.name}</option>`).join('');
      } catch(err) {
        if(!silent) showToast('Erro ao salvar. Imagem pode ser muito grande.', 'error');
      }
    }
  