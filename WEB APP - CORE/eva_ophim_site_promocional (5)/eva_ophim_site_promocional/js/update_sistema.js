const fs = require('fs');

// 1. Update evah/sistema/index.html
const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/sistema/index.html';
let htmlContent = fs.readFileSync(htmlFile, 'utf8');

htmlContent = htmlContent.replace(
  /<div class="eo-topbar-right">\s*<button class="btn btn-ghost btn-sm" id="themeToggle"[^>]+>☀️<\/button>\s*<a href="\.\.\/index\.html" class="btn btn-ghost btn-sm">← Voltar ao Site<\/a>\s*<div class="eo-user">\s*<div class="avatar" id="userAvatar">A<\/div>\s*<span id="userName">ADMIN<\/span>\s*<span class="eo-role-badge admin" id="userRoleBadge">Admin<\/span>\s*<button class="btn btn-ghost btn-sm" onclick="Auth\.logout\(\)">Sair<\/button>\s*<\/div>\s*<\/div>/,
  `<div class="eo-topbar-right">
        <button class="btn btn-ghost btn-sm" id="themeToggle" onclick="toggleTheme()" title="Alternar Modo Claro/Escuro" style="font-size: 1.2rem; padding: 0 var(--space-2);">☀️</button>
        <a href="../home/index.html" class="btn btn-ghost btn-sm">← Voltar ao Launchpad</a>
        
        <div class="eo-user" style="cursor:pointer;" onclick="toggleDropdown(event)">
          <div class="avatar" id="headerAvatar" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:var(--color-primary); color:var(--text-inverse); border-radius:var(--radius-full); font-weight:var(--font-bold); background-size: cover; background-position: center;"></div>
          <div style="display:flex; flex-direction:column; line-height: 1.2; align-items: flex-start;">
             <span id="userName" style="font-weight:bold; font-size:var(--text-sm);">ADMIN</span>
             <span class="eo-role-badge admin" id="userRoleBadge" style="margin-left:0; font-size: 10px; padding: 2px 6px;">Admin</span>
          </div>
        </div>

        <div class="eo-dropdown" id="userDropdown" style="position:absolute; top:calc(100% + var(--space-2)); right: var(--space-4); background:var(--surface-glass); backdrop-filter:var(--liquid-blur); -webkit-backdrop-filter:var(--liquid-blur); border:1px solid var(--surface-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); min-width: 300px; padding: 0; display: none; flex-direction: column; z-index: 9999;">
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
            <div class="eo-dropdown-item" onclick="window.location.href='../home/index.html'" style="padding: var(--space-3) var(--space-4); color: var(--text-primary); text-decoration: none; font-size: var(--text-sm); border-radius: var(--radius-md); transition: background var(--transition-fast); cursor: pointer; display: flex; align-items: center; gap: var(--space-3);">👤 Meu Perfil e Configurações</div>
            <div class="eo-dropdown-item" onclick="toggleTheme(); toggleDropdown();" style="padding: var(--space-3) var(--space-4); color: var(--text-primary); text-decoration: none; font-size: var(--text-sm); border-radius: var(--radius-md); transition: background var(--transition-fast); cursor: pointer; display: flex; align-items: center; gap: var(--space-3);">☀️ Alternar Tema</div>
            <div class="eo-dropdown-item" onclick="Auth.logout()" style="padding: var(--space-3) var(--space-4); color: var(--text-primary); text-decoration: none; font-size: var(--text-sm); border-radius: var(--radius-md); transition: background var(--transition-fast); cursor: pointer; display: flex; align-items: center; gap: var(--space-3);">🔄 Trocar Conta</div>
            <div class="eo-dropdown-divider" style="height: 1px; background: var(--surface-border); margin: var(--space-2) 0;"></div>
            <div class="eo-dropdown-item" style="color:var(--color-error); padding: var(--space-3) var(--space-4); text-decoration: none; font-size: var(--text-sm); border-radius: var(--radius-md); transition: background var(--transition-fast); cursor: pointer; display: flex; align-items: center; gap: var(--space-3);" onclick="Auth.logout()">🚪 Sair do Sistema</div>
          </div>
        </div>
      </div>`
);

fs.writeFileSync(htmlFile, htmlContent);

// 2. Update js/sistema-map.js
const mapFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/js/sistema-map.js';
let mapContent = fs.readFileSync(mapFile, 'utf8');

const populateCode = `
    let corpSettings = { name: 'Evah Ophim Ltda.', plan: 'Enterprise', logo: null };
    try { const c = localStorage.getItem('evah_corp'); if(c) corpSettings = JSON.parse(c); } catch(e){}

    document.getElementById('userName').textContent = u.name || 'User';
    
    if (u.avatar_url) {
      document.getElementById('headerAvatar').style.backgroundImage = \`url(\${u.avatar_url})\`;
      document.getElementById('headerAvatar').textContent = '';
      document.getElementById('dropAvatar').style.backgroundImage = \`url(\${u.avatar_url})\`;
      document.getElementById('dropAvatar').textContent = '';
    } else {
      document.getElementById('headerAvatar').style.backgroundImage = 'none';
      document.getElementById('headerAvatar').textContent = (u.name || 'U').charAt(0).toUpperCase();
      document.getElementById('dropAvatar').style.backgroundImage = 'none';
      document.getElementById('dropAvatar').textContent = (u.name || 'U').charAt(0).toUpperCase();
    }
    
    document.getElementById('userRoleBadge').textContent = role === 'admin' ? 'Admin' : role === 'operator' ? 'Operador' : 'Visualizador';
    document.getElementById('userRoleBadge').className = \`eo-role-badge \${role}\`;
    
    document.getElementById('dropName').textContent = u.name || 'Usuário';
    document.getElementById('dropEmail').textContent = u.email || 'N/A';
    document.getElementById('dropRole').textContent = u.role || 'Usuário';
    document.getElementById('dropPlan').textContent = corpSettings.plan || 'Enterprise';
    document.getElementById('dropCorpName').textContent = corpSettings.name || 'Evah Ophim Ltda.';
    
    if(corpSettings.logo) {
       document.getElementById('dropCorpLogo').src = corpSettings.logo;
       document.getElementById('dropCorpLogo').style.display = 'block';
    }
`;

mapContent = mapContent.replace(
  /document\.getElementById\('userName'\)\.textContent=u\.name\|\|'User';\s*document\.getElementById\('userAvatar'\)\.textContent=u\.avatar\|\|'U';\s*document\.getElementById\('userRoleBadge'\)\.textContent=role==='admin'\?'Admin':role==='operator'\?'Operador':'Visualizador';\s*document\.getElementById\('userRoleBadge'\)\.className=`eo-role-badge \$\{role\}`;/,
  populateCode
);

const globalClickCode = `
function toggleDropdown(e) {
  if (e) e.stopPropagation();
  const drop = document.getElementById('userDropdown');
  drop.style.display = drop.style.display === 'flex' ? 'none' : 'flex';
}

document.addEventListener('click', (e) => {
  const drop = document.getElementById('userDropdown');
  if(drop && drop.style.display === 'flex' && !drop.contains(e.target)) {
    drop.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded',`;

mapContent = mapContent.replace(/document\.addEventListener\('DOMContentLoaded',/, globalClickCode);

fs.writeFileSync(mapFile, mapContent);
