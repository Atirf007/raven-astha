const fs = require('fs');
const file = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the old dropdown with the new rich dropdown
content = content.replace(
  /<div class="eo-dropdown" id="userDropdown">[\s\S]*?<\/div>\s*<\/div>\s*<\/header>/,
  `<div class="eo-dropdown" id="userDropdown" style="min-width: 300px; padding: 0;">
          <div style="padding: var(--space-6); text-align: center; border-bottom: 1px solid var(--surface-border);">
            <div id="dropAvatar" style="width: 80px; height: 80px; border-radius: 50%; background-color: var(--color-primary); color: var(--text-inverse); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; margin: 0 auto var(--space-4); background-size: cover; background-position: center; border: 2px solid var(--surface-border);"></div>
            <div id="dropName" style="font-weight: bold; font-size: var(--text-lg); margin-bottom: 4px;">Nome</div>
            <div id="dropEmail" style="color: var(--text-secondary); font-size: var(--text-sm);">email</div>
            
            <div style="margin-top: var(--space-4); display: inline-flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: var(--radius-lg); border: 1px solid var(--surface-border);">
               <div style="font-size: var(--text-xs); font-weight: bold; color: var(--color-primary); text-transform: uppercase;" id="dropPlan">Enterprise</div>
               <div style="font-size: var(--text-xs); color: var(--text-secondary);" id="dropRole">Cargo</div>
            </div>
            
            <div style="margin-top: var(--space-4); display: flex; align-items: center; justify-content: center; gap: 8px;">
               <img id="dropCorpLogo" style="width: 24px; height: 24px; object-fit: contain; display: none;">
               <span id="dropCorpName" style="font-size: var(--text-sm); font-weight: bold;">Corp</span>
            </div>
          </div>
          <div style="padding: var(--space-2);">
            <div class="eo-dropdown-item" onclick="openProfileModal(); toggleDropdown();">👤 Meu Perfil e Configurações</div>
            <div class="eo-dropdown-item" onclick="toggleTheme(); toggleDropdown();">☀️ Alternar Tema</div>
            <div class="eo-dropdown-item" onclick="Auth.logout()">🔄 Trocar Conta</div>
            <div class="eo-dropdown-divider"></div>
            <div class="eo-dropdown-item" style="color:var(--color-error)" onclick="Auth.logout()">🚪 Sair do Sistema</div>
          </div>
        </div>
      </div>
    </header>`
);

// 2. Fix Profile saving (creating dbUser if not exists)
content = content.replace(
  /const dbUser = localUsers\.find\(u => u\.email === currentUser\.email\);\s*if\(dbUser\) \{\s*dbUser\.name = newName;\s*dbUser\.email = newEmail;\s*dbUser\.avatar_url = newAvatar;\s*try \{\s*localStorage\.setItem\('evah_users', JSON\.stringify\(localUsers\)\);\s*\} catch\(err\) \{\s*if\(err\.name === 'QuotaExceededError'\) showToast\('Imagem muito grande para salvar', 'warning'\);\s*\}\s*\}/,
  `let dbUser = localUsers.find(u => u.email === currentUser.email);
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
      }`
);

// 3. Update window.onload to populate drop fields
const populateCode = `// Populate rich dropdown
      document.getElementById('dropName').textContent = currentUser.name || 'Usuário';
      document.getElementById('dropEmail').textContent = currentUser.email || 'N/A';
      document.getElementById('dropRole').textContent = currentUser.role || 'Usuário';
      document.getElementById('dropPlan').textContent = corpSettings.plan || 'Enterprise';
      document.getElementById('dropCorpName').textContent = corpSettings.name || 'Evah Ophim Ltda.';
      
      if(corpSettings.logo) {
         document.getElementById('dropCorpLogo').src = corpSettings.logo;
         document.getElementById('dropCorpLogo').style.display = 'block';
      }
      
      if (currentUser.avatar_url) {
        document.getElementById('dropAvatar').style.backgroundImage = \`url(\${currentUser.avatar_url})\`;
        document.getElementById('dropAvatar').textContent = '';
      } else {
        document.getElementById('dropAvatar').style.backgroundImage = 'none';
        document.getElementById('dropAvatar').textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
      }`;

content = content.replace(
  /if \(currentUser\.avatar_url\) \{\s*document\.getElementById\('headerAvatar'\)\.style\.backgroundImage = `url\(\$\{currentUser\.avatar_url\}\)`;\s*document\.getElementById\('headerAvatar'\)\.textContent = '';\s*\} else \{\s*document\.getElementById\('headerAvatar'\)\.style\.backgroundImage = 'none';\s*document\.getElementById\('headerAvatar'\)\.textContent = \(currentUser\.name \|\| 'U'\)\.charAt\(0\)\.toUpperCase\(\);\s*\}/,
  `if (currentUser.avatar_url) {
        document.getElementById('headerAvatar').style.backgroundImage = \`url(\${currentUser.avatar_url})\`;
        document.getElementById('headerAvatar').textContent = '';
      } else {
        document.getElementById('headerAvatar').style.backgroundImage = 'none';
        document.getElementById('headerAvatar').textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
      }
      ${populateCode}`
);

// 4. Update handleProfileSubmit to also update dropdown
content = content.replace(
  /if \(newAvatar\) \{\s*document\.getElementById\('headerAvatar'\)\.style\.backgroundImage = `url\(\$\{newAvatar\}\)`;\s*document\.getElementById\('headerAvatar'\)\.textContent = '';\s*\} else \{\s*document\.getElementById\('headerAvatar'\)\.style\.backgroundImage = 'none';\s*document\.getElementById\('headerAvatar'\)\.textContent = currentUser\.name\.charAt\(0\)\.toUpperCase\(\);\s*\}/,
  `if (newAvatar) {
        document.getElementById('headerAvatar').style.backgroundImage = \`url(\${newAvatar})\`;
        document.getElementById('headerAvatar').textContent = '';
        document.getElementById('dropAvatar').style.backgroundImage = \`url(\${newAvatar})\`;
        document.getElementById('dropAvatar').textContent = '';
      } else {
        document.getElementById('headerAvatar').style.backgroundImage = 'none';
        document.getElementById('headerAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('dropAvatar').style.backgroundImage = 'none';
        document.getElementById('dropAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
      }
      document.getElementById('dropName').textContent = currentUser.name;
      document.getElementById('dropEmail').textContent = currentUser.email;`
);

fs.writeFileSync(file, content);
