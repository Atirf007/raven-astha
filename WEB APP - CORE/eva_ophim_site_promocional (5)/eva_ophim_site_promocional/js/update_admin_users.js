const fs = require('fs');

// --- evah/home/index.html ---
const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// 1. Dropdown transparency fix
content = content.replace(
  /\.eo-dropdown\s*\{[^}]*background:\s*var\(--surface-glass\);[^}]*\}/,
  (match) => match.replace('var(--surface-glass)', 'var(--surface-bg)')
);

// 2. Profile Email Field Disabled
content = content.replace(
  /<input type="email" id="profEmail" class="eo-input" required>/,
  '<input type="email" id="profEmail" class="eo-input" required disabled title="O e-mail de login não pode ser alterado">'
);
content = content.replace(
  /document\.getElementById\('profEmail'\)\.disabled = !canEdit;/,
  "// Email is always disabled to prevent breaking login links"
);

// 3. Always show org logo in dropdown
content = content.replace(
  /if\(corpSettings\.logo\)\s*\{\s*document\.getElementById\('dropCorpLogo'\)\.src = corpSettings\.logo;\s*document\.getElementById\('dropCorpLogo'\)\.style\.display = 'block';\s*\}/,
  `document.getElementById('dropCorpLogo').src = corpSettings.logo || '../../images/Logotipo (Alpha).png';
      document.getElementById('dropCorpLogo').style.display = 'block';`
);

// 4. Admin Users Tab UI update
content = content.replace(
  /<div style="margin-top:var\(--space-4\); padding-top:var\(--space-4\); border-top:1px solid var\(--surface-border\);">\s*<button class="btn btn-secondary btn-sm" onclick="showToast\('O sistema de convites estará disponível na próxima atualização\.'\)">Convidar Novo Usuário<\/button>\s*<\/div>/,
  `<div style="margin-top:var(--space-4); display: flex; gap: 10px; align-items: flex-end;">
           <div style="flex-grow:1;">
             <label class="eo-input-label">Nome do Usuário</label>
             <input type="text" id="newUserName" class="eo-input" placeholder="Ex: João Silva">
           </div>
           <div style="flex-grow:1;">
             <label class="eo-input-label">E-mail</label>
             <input type="email" id="newUserEmail" class="eo-input" placeholder="joao@evah.com">
           </div>
           <button class="btn btn-secondary btn-sm" style="height: 42px;" onclick="addAdminUser()">+ Adicionar</button>
         </div>
         <div style="margin-top:var(--space-4); text-align:right;">
           <button class="btn btn-primary" onclick="saveAdminUsers()">Salvar Permissões</button>
         </div>`
);

// 5. Admin Users JS logic update
// Replace openAdminModal completely to inject the selects
const openAdminStart = content.indexOf('function openAdminModal() {');
const switchAdminStart = content.indexOf('function switchAdminTab(idx) {');

const openAdminNew = `
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
          
          const selRole = \`<select class="eo-input user-role-select" data-idx="\${index}" style="padding: 4px; height: auto;">
             <option value="viewer" \${u.role==='viewer'?'selected':''}>Visualizador</option>
             <option value="operator" \${u.role==='operator'?'selected':''}>Operador</option>
             <option value="admin" \${u.role==='admin'?'selected':''}>Administrador</option>
          </select>\`;
          
          const selSector = \`<select class="eo-input user-sector-select" data-idx="\${index}" style="padding: 4px; height: auto;">
             <option value="Logística" \${u.sector==='Logística'?'selected':''}>Logística</option>
             <option value="TI" \${u.sector==='TI'?'selected':''}>TI</option>
             <option value="RH" \${u.sector==='RH'?'selected':''}>RH</option>
             <option value="Financeiro" \${u.sector==='Financeiro'?'selected':''}>Financeiro</option>
          </select>\`;

          div.innerHTML = \`
            <div style="flex-grow:1;">
              <div style="font-weight:bold; font-size:var(--text-sm)">\${u.name}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary)">\${u.email}</div>
            </div>
            <div style="display:flex; gap: 10px; align-items:center;">
               <div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Cargo</div>
                 \${selRole}
               </div>
               <div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Setor</div>
                 \${selSector}
               </div>
               <button class="btn btn-ghost btn-sm" style="color:var(--color-error); margin-top:14px;" onclick="removeAdminUser(\${index})">✕</button>
            </div>
          \`;
          list.appendChild(div);
        });
      }
    }

    function openAdminModal() {
      document.getElementById('corpName').value = corpSettings.name || '';
      document.getElementById('corpPlan').value = corpSettings.plan || 'Enterprise';
      document.getElementById('policyEditProfile').checked = corpSettings.allowEdit !== false;
      
      if(corpSettings.logo) {
         document.getElementById('corpLogoPreview').src = corpSettings.logo;
         document.getElementById('corpLogoPreview').style.display = 'block';
         document.getElementById('corpLogoPlaceholder').style.display = 'none';
         document.getElementById('corpLogoData').value = corpSettings.logo;
      }
      
      renderAdminUserList();
      switchAdminTab(0);
      document.getElementById('adminModal').classList.add('active');
    }

    function addAdminUser() {
      const name = document.getElementById('newUserName').value.trim();
      const email = document.getElementById('newUserEmail').value.trim();
      if(!name || !email) { showToast('Preencha nome e e-mail', 'warning'); return; }
      if(localUsers.find(u => u.email === email)) { showToast('E-mail já existe na organização', 'error'); return; }
      
      localUsers.push({ name, email, role: 'viewer', sector: 'Logística', avatar_url: null });
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
      try {
        localStorage.setItem('evah_users', JSON.stringify(localUsers));
        showToast('Permissões de usuários salvas!', 'success');
      } catch(e) {
        showToast('Erro ao salvar usuários', 'error');
      }
    }

    `;
content = content.substring(0, openAdminStart) + openAdminNew + content.substring(switchAdminStart);

fs.writeFileSync(htmlFile, content);

// --- evah/sistema/index.html ---
const sysFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/sistema/index.html';
let sysContent = fs.readFileSync(sysFile, 'utf8');

sysContent = sysContent.replace(
  /\.eo-dropdown\s*\{[^}]*background:\s*var\(--surface-glass\);[^}]*\}/,
  (match) => match.replace('var(--surface-glass)', 'var(--surface-bg)')
);

fs.writeFileSync(sysFile, sysContent);

// --- js/sistema-map.js ---
const mapFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/js/sistema-map.js';
let mapContent = fs.readFileSync(mapFile, 'utf8');

mapContent = mapContent.replace(
  /if\(corpSettings\.logo\)\s*\{\s*document\.getElementById\('dropCorpLogo'\)\.src = corpSettings\.logo;\s*document\.getElementById\('dropCorpLogo'\)\.style\.display = 'block';\s*\}/,
  `document.getElementById('dropCorpLogo').src = corpSettings.logo || '../../images/Logotipo (Alpha).png';
       document.getElementById('dropCorpLogo').style.display = 'block';`
);

fs.writeFileSync(mapFile, mapContent);
