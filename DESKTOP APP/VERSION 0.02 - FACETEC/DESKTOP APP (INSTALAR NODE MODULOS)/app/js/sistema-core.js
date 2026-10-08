/* Sistema Core — Persistent Data (localStorage), Tabs, Dashboard, Stock */
function showToast(m,t='info'){const c=document.getElementById('toastContainer');if(!c)return;const d=document.createElement('div');d.className=`toast toast-${t}`;d.innerHTML=`<span>${m}</span>`;c.appendChild(d);setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300)},4000)}

// ── State variables (MySQL S.S.O.T.) ──
let materials = [];
let movements = [];
let customComponents = [];
let users = [];
let nextCode = 200;
let currentInfoMaterial = null;
let currentWarehouseId = null;

// No-op para compatibilidade retroativa
function saveAll() {
  console.log('[SISTEMA] MySQL é a única fonte da verdade. Batch save local ignorado.');
}

// Mapper de materiais (Banco de Dados -> Frontend)
function mapMaterialToFrontend(m) {
  // Tenta ler campos extras de JSON legado no campo notes
  let ext = {};
  if (m.notes) {
    try { ext = JSON.parse(m.notes); } catch (e) { ext = { plainNotes: m.notes }; }
  }
  return {
    id: m.id,
    code: m.code,
    desc: m.description,
    brand: m.brand || '',
    model: m.model || '',
    sector: m.sector || 'Assembly',
    location: m.location || 'N/A',
    qty: m.quantity || 0,
    min: m.min_qty || 0,
    max: m.max_qty || 0,
    price: parseFloat(m.unit_price) || 0,
    image: m.image_data || m.image_url || '',
    machineryName: m.machinery || '',
    // Colunas dedicadas (v2.1) com fallback para JSON legado
    machineryImage: m.machinery_image || ext.machineryImage || '',
    machineryDesc: m.machinery_desc || ext.machineryDesc || '',
    usageDesc: m.usage_desc || ext.usageDesc || '',
    manufacturerUrl: m.manufacturer_url || ext.manufacturerUrl || '',
    manualUrl: m.manual_data || m.manual_url || '',
    interchangeable: !!m.interchangeable,
    interchangeWith: m.interchange_with || '',
    plainNotes: ext.plainNotes || ''
  };
}

// Mapper de movimentações (Banco de Dados -> Frontend)
function mapMovementToFrontend(m) {
  return {
    date: new Date(m.created_at).toLocaleString('pt-BR'),
    code: m.material_code,
    desc: m.material_desc,
    operation: m.type === 'entrada' ? 'Entrada (+)' : 'Saída (-)',
    opClass: m.type === 'entrada' ? 'entrada' : 'saida',
    qty: m.quantity,
    responsible: m.responsible || 'Sistema'
  };
}

// ── Warehouse Tabs rendering and switching ──
function renderWarehouseTabs(tabs) {
  const container = document.getElementById('warehouseTabs');
  if (!container) return;
  container.innerHTML = tabs.map(t => {
    const isActive = t.id === currentWarehouseId;
    return `<button class="eo-tab ${isActive ? 'active' : ''}" data-id="${t.id}" onclick="selectWarehouse(${t.id})">${t.name}</button>`;
  }).join('');
}

async function selectWarehouse(id) {
  currentWarehouseId = id;
  const tabsRes = await API.get('/warehouse/tabs');
  if (tabsRes.success) {
    renderWarehouseTabs(tabsRes.data);
  }
  await initAppData();
}

// ── Async Bootstrap Loader ──
async function initAppData() {
  try {
    // 0. Fetch Warehouse Tabs
    const tabsRes = await API.get('/warehouse/tabs');
    if (tabsRes.success && tabsRes.data.length > 0) {
      if (!currentWarehouseId) currentWarehouseId = tabsRes.data[0].id;
      renderWarehouseTabs(tabsRes.data);
    }

    // 1. Materiais
    const materialsRes = await API.get(`/materials${currentWarehouseId ? '?warehouse_id='+currentWarehouseId : ''}`);
    if (materialsRes.success) {
      materials = materialsRes.data.map(mapMaterialToFrontend);
    }
    
    // 2. Histórico de Movimentações
    const movementsRes = await API.get('/movements');
    if (movementsRes.success) {
      movements = movementsRes.data.map(mapMovementToFrontend);
    }
    
    // 3. Componentes customizados
    const componentsRes = await API.get('/components');
    if (componentsRes.success) {
      customComponents = componentsRes.data;
    }
    
    // 4. Usuários & Permissões
    if (Auth.canManageUsers()) {
      const usersRes = await API.get('/auth/users');
      if (usersRes.success) {
        users = usersRes.data.map(u => ({
          id: u.id,
          name: u.name + (u.surname ? ' ' + u.surname : ''),
          email: u.email,
          role: u.role,
          avatar: u.avatar_url || (u.name ? u.name[0].toUpperCase() : 'U')
        }));
      }
    } else {
      const self = Auth.getUser();
      if (self) {
        users = [{
          id: self.id,
          name: self.name,
          email: self.email,
          role: self.role,
          avatar: self.avatar_url || (self.name ? self.name[0].toUpperCase() : 'U')
        }];
      }
    }
    
    // 5. Armazém (Layout & Mapa)
    if (window.initWarehouseMap) {
      await window.initWarehouseMap();
    }
    
    // 6. Atualizar a UI
    renderDashboard();
    renderStock();
    renderReports();
    renderComponents();
    renderUsers();
    
    console.log('[BOOTSTRAP] Banco de dados MySQL sincronizado com sucesso.');
  } catch (err) {
    console.error('[BOOTSTRAP] Erro na inicialização:', err);
    showToast('Erro ao inicializar o banco de dados', 'error');
  }
}

function getStatus(m){
  if(m.qty===0)return{text:'Recomprar',cls:'critico'};
  if(m.qty<=m.min)return{text:'Abaixo Mín.',cls:'recomprar'};
  return{text:'Em Estoque',cls:'em-estoque'};
}
function formatBRL(v){return'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}

function switchTab(t){
  document.querySelectorAll('.eo-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.eo-panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${t}`));
  const titles={dashboard:'Dashboard',estoque:'Estoque',entrada:'Entrada de Material',saida:'Saída de Material',mapa:'Mapa do Estoque',componentes:'Componentes Personalizados',relatorios:'Movimentações',usuarios:'Usuários & Permissões'};
  document.getElementById('pageTitle').textContent=titles[t]||'';
  if(t==='dashboard')renderDashboard();
  if(t==='estoque')renderStock();
  if(t==='relatorios')renderReports();
  // Special trigger for CAD resize
  if(t==='mapa'){ 
    if(typeof resizeCadCanvas==='function') resizeCadCanvas();
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 100);
    // Re-inicializa o canvas se ainda não foi inicializado (script carregou com delay)
    setTimeout(async () => {
      if (typeof window.initWarehouseMap === 'function' && typeof cadCanvas !== 'undefined' && !cadCanvas) {
        console.log('[CORE] Lazy init do canvas CAD na aba mapa.');
        await window.initWarehouseMap();
        if(typeof resizeCadCanvas==='function') resizeCadCanvas();
      }
    }, 300);
  }
  if(t==='componentes')renderComponents();
  if(t==='usuarios')renderUsers();
}

function renderDashboard(){
  const total=materials.length,critical=materials.filter(m=>m.qty>0&&m.qty<=m.min).length,zero=materials.filter(m=>m.qty===0).length;
  let totalQty=0,totalValue=0;
  materials.forEach(m=>{ totalQty+=m.qty; totalValue+=(m.qty*m.price); });
  document.getElementById('statTotal').textContent=total;
  document.getElementById('statCritical').textContent=critical;
  document.getElementById('statZero').textContent=zero;
  const sq=document.getElementById('statTotalQty'); if(sq) sq.textContent=totalQty;
  const sv=document.getElementById('statTotalValue'); if(sv) sv.textContent=formatBRL(totalValue);
  drawDonut(total-critical-zero,critical,zero);
  const tbody=document.getElementById('criticalTableBody');
  tbody.innerHTML=materials.filter(m=>m.qty<=m.min).map(m=>{const s=getStatus(m);return`<tr><td><span class="eo-status ${s.cls}">${s.text}</span></td><td><span class="material-code">${m.code}</span></td><td>${m.desc}</td><td>${m.qty}</td><td><span class="badge">${m.location}</span></td></tr>`}).join('');
}

function drawDonut(h,c,z){
  const canvas=document.getElementById('donutChart');if(!canvas)return;
  const ctx=canvas.getContext('2d'),tot=h+c+z||1,cx=canvas.width/2,cy=canvas.height/2,r=100,inner=60;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  let start=-Math.PI/2;
  [{value:h,color:'#00FF88'},{value:c,color:'#FFB830'},{value:z,color:'#FF4757'}].forEach(s=>{
    const sweep=(s.value/tot)*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+sweep);ctx.arc(cx,cy,inner,start+sweep,start,true);ctx.closePath();ctx.fillStyle=s.color;ctx.fill();start+=sweep;
  });
  ctx.fillStyle='#F0F0F5';ctx.font='bold 28px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tot,cx,cy-8);
  ctx.font='12px Inter,sans-serif';ctx.fillStyle='#8888A0';ctx.fillText('Total',cx,cy+14);
}

function renderStock(filter=''){
  const canEdit=Auth.canEdit(),canDel=Auth.canEdit();
  const tbody=document.getElementById('stockTableBody');
  const filtered=filter?materials.filter(m=>(m.code+m.desc+m.brand+m.model+m.sector).toLowerCase().includes(filter.toLowerCase())):materials;
  tbody.innerHTML=filtered.map(m=>{
    const s=getStatus(m);
    const img=m.image?`<img class="eo-thumb" src="${m.image}">`:`<div class="eo-thumb-placeholder"></div>`;
    const ic=m.interchangeable?'<span title="Intercambiável" style="color:#00D4FF;cursor:help"></span>':'';
    return`<tr>
      <td>${img}</td>
      <td><span class="material-code">${m.code}</span></td>
      <td>${m.desc} ${ic}</td>
      <td>${m.brand||'-'}</td>
      <td>${m.sector}</td>
      <td><span class="badge">${m.location}</span></td>
      <td>${m.qty}</td>
      <td>${formatBRL(m.price)}</td>
      <td><span class="eo-status ${s.cls}">${s.text}</span></td>
      <td><div class="eo-actions">
        <button class="eo-action-btn" title="Mais Info" onclick="openMoreInfo('${m.code}')">ℹ️</button>
        <button class="eo-action-btn" title="Editar" onclick="openEditMaterial('${m.code}')" ${canEdit?'':'disabled'}>️</button>
        <button class="eo-action-btn" title="Ver no Mapa" onclick="locateOnMap('${m.code}')"></button>
        <button class="eo-action-btn" title="Comparar" onclick="comparePricesFor('${m.code}')"></button>
        <button class="eo-action-btn danger" title="Excluir" onclick="deleteMaterial('${m.code}')" ${canDel?'':'disabled'}>️</button>
      </div></td></tr>`}).join('');
}
function filterStock(){renderStock(document.getElementById('stockFilter').value)}

async function deleteMaterial(code){
  if(!confirm(`Excluir material ${code}?`))return;
  const res = await API.delete('/materials/' + code);
  if (res.success) {
    await initAppData();
    showToast(`Material ${code} excluído`,'success');
  } else {
    showToast(`Erro ao excluir material: ${res.error}`,'error');
  }
}

// ── Permissions ──
function applyPermissions(){
  const role=Auth.getUserRole();
  const hide=role==='viewer'?['entrada','saida','usuarios','componentes']:role==='operator'?['usuarios']:[];
  document.querySelectorAll('.eo-tab').forEach(t=>{if(hide.includes(t.dataset.tab))t.style.display='none'});
  if(role==='viewer'){const b=document.getElementById('btnNewMaterial');if(b)b.style.display='none'}
  const sessionUser=Auth.getUser();
  if(sessionUser){
    const u = sessionUser;
    document.getElementById('userName').textContent = u.name || 'User';
    if (u.avatar_url) {
      document.getElementById('headerAvatar').style.backgroundImage = `url(${u.avatar_url})`;
      document.getElementById('headerAvatar').textContent = '';
      document.getElementById('dropAvatar').style.backgroundImage = `url(${u.avatar_url})`;
      document.getElementById('dropAvatar').textContent = '';
    } else {
      document.getElementById('headerAvatar').style.backgroundImage = 'none';
      document.getElementById('headerAvatar').textContent = (u.name || 'U').charAt(0).toUpperCase();
      document.getElementById('dropAvatar').style.backgroundImage = 'none';
      document.getElementById('dropAvatar').textContent = (u.name || 'U').charAt(0).toUpperCase();
    }
    const roleLabel = (role === 'superadmin' || role === 'admin') ? 'Admin' : role === 'manager' ? 'Gerente' : role === 'operator' ? 'Operador' : 'Visualizador';
    document.getElementById('userRoleBadge').textContent = roleLabel;
    document.getElementById('userRoleBadge').className = `eo-role-badge ${role}`;
    document.getElementById('dropName').textContent = u.name || 'Usuário';
    document.getElementById('dropEmail').textContent = u.email || 'N/A';
    document.getElementById('dropRole').textContent = roleLabel;
    document.getElementById('dropPlan').textContent = u.plan || 'Enterprise';
    document.getElementById('dropCorpName').textContent = u.company || 'Astah Raven Ltda.';
    const logoEl = document.getElementById('dropCorpLogo');
    if (logoEl) { logoEl.src = u.logo || '../../images/Logotipo (Alpha).png'; logoEl.style.display = 'block'; }
  }
}

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

// ── Identidade da Organizacao no Topbar ──
async function loadOrgIdentity() {
  try {
    const res = await API.get('/auth/organization/me');
    if (!res.success) return;
    const org = res.data;
    const nameEl = document.getElementById('topbarOrgName');
    if (nameEl) nameEl.textContent = org.name || 'Minha Organizacao';
    const planEl = document.getElementById('topbarOrgPlan');
    if (planEl) planEl.textContent = org.plan || 'Enterprise';
    const logoEl = document.getElementById('topbarOrgLogo');
    const initialEl = document.getElementById('topbarOrgInitial');
    const wrapEl = document.getElementById('topbarOrgLogoWrap');
    if (org.logo && org.logo.length > 10) {
      if (logoEl) { logoEl.src = org.logo; logoEl.style.display = 'block'; }
      if (initialEl) initialEl.style.display = 'none';
    } else {
      if (logoEl) logoEl.style.display = 'none';
      if (initialEl) {
        initialEl.textContent = (org.name || 'O').trim().charAt(0).toUpperCase();
        initialEl.style.display = '';
      }
      if (wrapEl && org.name) {
        const hue = [...org.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
        wrapEl.style.background = 'hsl(' + hue + ', 60%, 45%)';
      }
    }
    const orgBlock = document.getElementById('topbarOrg');
    if (orgBlock) orgBlock.title = org.name + ' - Plano: ' + (org.plan || 'Enterprise');
    const dropCorpName = document.getElementById('dropCorpName');
    if (dropCorpName) dropCorpName.textContent = org.name || 'Organizacao';
    const dropCorpLogo = document.getElementById('dropCorpLogo');
    if (dropCorpLogo && org.logo) { dropCorpLogo.src = org.logo; dropCorpLogo.style.display = 'block'; }
  } catch (e) {
    const nameEl = document.getElementById('topbarOrgName');
    if (nameEl) nameEl.textContent = 'Organizacao';
    const initialEl = document.getElementById('topbarOrgInitial');
    if (initialEl) initialEl.textContent = 'O';
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!Auth.requireAuth())return;
  applyPermissions();
  loadOrgIdentity();
  await initAppData();
  
  // Remove loader overlay if it exists
  const loader = document.getElementById('loadingOverlay');
  if(loader) loader.style.display = 'none';
});

// ── Locating Materials on the Map ──
window.locateOnMap = function(code) {
  const m = materials.find(x => x.code === code);
  if (!m) return;
  
  if (!m.location) {
    if(typeof showToast === 'function') showToast('Material sem localização cadastrada', 'warning');
    return;
  }
  
  const slotId = m.location.trim();
  switchTab('mapa');
  
  // 2D only highlights the shelf
  if (typeof highlightSlot2D === 'function') highlightSlot2D(slotId);
  
  // 3D will parse the location, place the 3D model, and show HUD
  if (typeof highlightSlot3D === 'function') highlightSlot3D(slotId, m);
  
  if(typeof showToast === 'function') showToast(`Buscando localização: ${slotId}`, 'success');
};
