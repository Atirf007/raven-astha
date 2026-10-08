const fs = require('fs');

const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// 1. Update Tab 0 HTML
const tab0Old = `<div id="adminTab0" class="admin-tab">
         <div style="display:flex; gap: var(--space-6); align-items:flex-start;">`;
const tab0New = `<div id="adminTab0" class="admin-tab">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-6); background: var(--surface-glass); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--surface-border);">
            <div style="display:flex; gap:10px; align-items:center; width: 70%;">
               <label class="eo-input-label" style="margin:0;">Locatário Atual:</label>
               <select class="eo-input" id="orgSelector" onchange="loadOrgSettings()" style="padding: 4px 8px; height: 34px; flex-grow:1;"></select>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="createNewOrg()">+ Nova Organização</button>
         </div>
         <div style="display:flex; gap: var(--space-6); align-items:flex-start;">`;
content = content.replace(tab0Old, tab0New);
// Fix button to save
content = content.replace(/<button class="btn btn-primary" onclick="saveCorpSettings\(\)">Salvar Corporação<\/button>/g, '<button class="btn btn-primary" onclick="saveOrgSettings()">Salvar Organização</button>');

// 2. Update Tab 2 HTML
const tab2Old = /<div id="adminTab2" class="admin-tab" style="display:none;">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const tab2New = `<div id="adminTab2" class="admin-tab" style="display:none;">
         <label class="eo-input-label">Configurações de Segurança Avançada</label>
         <p style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom: 15px;">Aplique restrições globais para a Organização atual selecionada na primeira aba.</p>
         
         <div style="display:flex; align-items:center; gap:10px; margin-bottom: 15px;">
           <input type="checkbox" id="policyEditProfile" checked>
           <span style="font-size:var(--text-sm);">Permitir que usuários editem seus próprios nomes e fotos</span>
         </div>
         <div style="display:flex; align-items:center; gap:10px; margin-bottom: 15px;">
           <input type="checkbox" id="policy2FA">
           <span style="font-size:var(--text-sm);">Exigir autenticação em duas etapas (2FA) forçada</span>
         </div>
         <div style="display:flex; align-items:center; gap:10px; margin-bottom: 15px;">
           <input type="checkbox" id="policyIP">
           <span style="font-size:var(--text-sm);">Bloquear acessos externos à rede IP corporativa</span>
         </div>
         <div style="display:flex; align-items:center; gap:10px; margin-bottom: 25px;">
           <input type="checkbox" id="policyAudit">
           <span style="font-size:var(--text-sm);">Habilitar trilha de auditoria avançada (Logs ISO do WMS)</span>
         </div>
         
         <div style="text-align: right;">
           <button class="btn btn-primary btn-sm" onclick="saveOrgSettings()">Salvar Políticas</button>
         </div>
      </div>
    </div>
  </div>`;
content = content.replace(tab2Old, tab2New);

// 3. JS Data Structure Update
content = content.replace(
  /let corpSettings = \{ name: 'Evah Ophim Ltda\.', plan: 'Enterprise', logo: null, allowEdit: true \};/,
  `let corpSettings = { id: 'org_1', name: 'Evah Ophim Ltda.', plan: 'Enterprise', logo: null, policies: { allowEdit: true, require2FA: false, restrictIP: false, advancedAudit: true } };
    let organizations = [corpSettings];
    let currentOrgId = 'org_1';`
);

// 4. JS Load Update
const jsLoadOld = `const c = localStorage.getItem('evah_corp');
        if(c) corpSettings = JSON.parse(c);`;
const jsLoadNew = `const o = localStorage.getItem('evah_orgs');
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
        corpSettings = organizations.find(org => org.id === currentOrgId) || organizations[0];`;
content = content.replace(jsLoadOld, jsLoadNew);

// 5. User List UI Update
const userRoleSelectCode = `const selOrg = \`<select class="eo-input user-org-select" data-idx="\${index}" style="padding: 4px; height: auto;">
             \${organizations.map(o => \`<option value="\${o.id}" \${u.orgId===o.id?'selected':''}>\${o.name}</option>\`).join('')}
          </select>\`;
          
          const selRole`;
content = content.replace(/const selRole/, userRoleSelectCode);

content = content.replace(
  /<div>\s*<div style="font-size: 10px; color: var\(--text-tertiary\); margin-bottom:2px;">Setor<\/div>\s*\$\{selSector\}\s*<\/div>\s*<button class="btn btn-ghost btn-sm"/,
  `<div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Setor</div>
                 \${selSector}
               </div>
               <div>
                 <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom:2px;">Locatário</div>
                 \${selOrg}
               </div>
               <button class="btn btn-ghost btn-sm"`
);

// 6. Admin User Save Update
content = content.replace(
  /document\.querySelectorAll\('\.user-sector-select'\)\.forEach\(sel => \{\s*const idx = sel\.getAttribute\('data-idx'\);\s*localUsers\[idx\]\.sector = sel\.value;\s*\}\);/,
  `document.querySelectorAll('.user-sector-select').forEach(sel => {
         const idx = sel.getAttribute('data-idx');
         localUsers[idx].sector = sel.value;
      });
      document.querySelectorAll('.user-org-select').forEach(sel => {
         const idx = sel.getAttribute('data-idx');
         localUsers[idx].orgId = sel.value;
      });`
);

// 7. Add createNewOrg, loadOrgSettings, saveOrgSettings
const adminFnsOld = /function openAdminModal\(\) \{[\s\S]*?function previewCorpLogo\(input\) \{/;
const adminFnsNew = `function loadOrgSettings() {
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
      const name = prompt('Nome da Nova Organização:');
      if(!name) return;
      const newOrg = {
         id: 'org_' + Date.now(),
         name: name,
         plan: 'Free',
         logo: null,
         policies: { allowEdit: true, require2FA: false, restrictIP: false, advancedAudit: false }
      };
      organizations.push(newOrg);
      currentOrgId = newOrg.id;
      saveOrgSettings(true); // Save silently to persist, then reload UI
    }

    function openAdminModal() {
      const sel = document.getElementById('orgSelector');
      sel.innerHTML = organizations.map(o => \`<option value="\${o.id}" \${o.id===currentOrgId?'selected':''}>\${o.name}</option>\`).join('');
      
      loadOrgSettings();
      renderAdminUserList();
      switchAdminTab(0);
      document.getElementById('adminModal').classList.add('active');
    }

    function previewCorpLogo(input) {`;
content = content.replace(adminFnsOld, adminFnsNew);

// 8. Replace saveCorpSettings
const saveCorpOld = /function saveCorpSettings\(\) \{[\s\S]*?\}\s*<\/script>/;
const saveCorpNew = `function saveOrgSettings(silent = false) {
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
        sel.innerHTML = organizations.map(o => \`<option value="\${o.id}" \${o.id===currentOrgId?'selected':''}>\${o.name}</option>\`).join('');
      } catch(err) {
        if(!silent) showToast('Erro ao salvar. Imagem pode ser muito grande.', 'error');
      }
    }
  </script>`;
content = content.replace(saveCorpOld, saveCorpNew);

// 9. Link users default Org
content = content.replace(
  /localUsers\.push\(\{ name, email, role: 'viewer', sector: 'Logística', avatar_url: null \}\);/,
  `localUsers.push({ name, email, role: 'viewer', sector: 'Logística', orgId: currentOrgId, avatar_url: null });`
);

// 10. Link current profile display to their actual Org
const profileOrgFix = `
      const myOrg = organizations.find(o => o.id === currentUser.orgId) || organizations[0];
      document.getElementById('profOrg').value = myOrg.name || 'Evah Ophim Ltda.';
      document.getElementById('profPlan').textContent = myOrg.plan || 'Enterprise';
      
      if(myOrg.logo) {
         document.getElementById('profOrgLogo').src = myOrg.logo;
         document.getElementById('profOrgLogo').style.display = 'block';
      } else {
         document.getElementById('profOrgLogo').style.display = 'none';
      }
`;
content = content.replace(
  /document\.getElementById\('profOrg'\)\.value = corpSettings\.name \|\| 'Evah Ophim Ltda\.';\s*document\.getElementById\('profPlan'\)\.textContent = corpSettings\.plan \|\| 'Enterprise';\s*if\(corpSettings\.logo\) \{\s*document\.getElementById\('profOrgLogo'\)\.src = corpSettings\.logo;\s*document\.getElementById\('profOrgLogo'\)\.style\.display = 'block';\s*\} else \{\s*document\.getElementById\('profOrgLogo'\)\.style\.display = 'none';\s*\}/,
  profileOrgFix
);

// 11. Fix dropdown onload 
const dropOrgFix = `
      const myDropOrg = organizations.find(o => o.id === currentUser.orgId) || organizations[0];
      document.getElementById('dropPlan').textContent = myDropOrg.plan || 'Enterprise';
      document.getElementById('dropCorpName').textContent = myDropOrg.name || 'Evah Ophim Ltda.';
      
      document.getElementById('dropCorpLogo').src = myDropOrg.logo || '../../images/Logotipo (Alpha).png';
      document.getElementById('dropCorpLogo').style.display = 'block';
`;
content = content.replace(
  /document\.getElementById\('dropPlan'\)\.textContent = corpSettings\.plan \|\| 'Enterprise';\s*document\.getElementById\('dropCorpName'\)\.textContent = corpSettings\.name \|\| 'Evah Ophim Ltda\.';\s*document\.getElementById\('dropCorpLogo'\)\.src = corpSettings\.logo \|\| '\.\.\/\.\.\/images\/Logotipo \(Alpha\)\.png';\s*document\.getElementById\('dropCorpLogo'\)\.style\.display = 'block';/,
  dropOrgFix
);

fs.writeFileSync(htmlFile, content);

// Also we should update `js/sistema-map.js` for the dropdown so it shows their actual Org if they are logged in.
const mapFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/js/sistema-map.js';
let mapContent = fs.readFileSync(mapFile, 'utf8');

mapContent = mapContent.replace(
  /let corpSettings = \{ name: 'Evah Ophim Ltda\.', plan: 'Enterprise', logo: null \};\s*try \{ const c = localStorage\.getItem\('evah_corp'\); if\(c\) corpSettings = JSON\.parse\(c\); \} catch\(e\)\{\}/,
  `let organizations = [{ id: 'org_1', name: 'Evah Ophim Ltda.', plan: 'Enterprise', logo: null }];
    try { 
      const o = localStorage.getItem('evah_orgs'); 
      if(o) organizations = JSON.parse(o); 
    } catch(e){}`
);

mapContent = mapContent.replace(
  /document\.getElementById\('dropPlan'\)\.textContent = corpSettings\.plan \|\| 'Enterprise';\s*document\.getElementById\('dropCorpName'\)\.textContent = corpSettings\.name \|\| 'Evah Ophim Ltda\.';\s*document\.getElementById\('dropCorpLogo'\)\.src = corpSettings\.logo \|\| '\.\.\/\.\.\/images\/Logotipo \(Alpha\)\.png';/,
  `const myDropOrg = organizations.find(org => org.id === u.orgId) || organizations[0];
    document.getElementById('dropPlan').textContent = myDropOrg.plan || 'Enterprise';
    document.getElementById('dropCorpName').textContent = myDropOrg.name || 'Evah Ophim Ltda.';
    document.getElementById('dropCorpLogo').src = myDropOrg.logo || '../../images/Logotipo (Alpha).png';`
);

fs.writeFileSync(mapFile, mapContent);
