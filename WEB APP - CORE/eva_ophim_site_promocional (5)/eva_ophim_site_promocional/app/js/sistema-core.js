/* Sistema Core — Persistent Data (localStorage), Tabs, Dashboard, Stock */
function showToast(m,t='info'){const c=document.getElementById('toastContainer');if(!c)return;const d=document.createElement('div');d.className=`toast toast-${t}`;const span=document.createElement('span');span.textContent=m;d.appendChild(span);c.appendChild(d);setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300)},4000)}

// ── State variables (MySQL S.S.O.T.) ──
let materials = [];
let movements = [];
let customComponents = [];
let users = [];
let nextCode = 200;
let currentInfoMaterial = null;
let currentWarehouseId = Number(new URLSearchParams(window.location.search).get('warehouse')) || null;

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
    warehouseId: m.warehouse_id,
    code: m.code,
    desc: m.description,
    brand: m.brand || '',
    originCountry: m.origin_country || '',
    model: m.model || '',
    sector: m.sector || 'Assembly',
    location: m.location || 'N/A',
    qty: Number(m.quantity) || 0,
    min: Number(m.min_qty) || 0,
    max: Number(m.max_qty) || 0,
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
  const timestamp = new Date(m.created_at);
  const day = Number.isNaN(timestamp.getTime()) ? '' : `${timestamp.getFullYear()}-${String(timestamp.getMonth()+1).padStart(2,'0')}-${String(timestamp.getDate()).padStart(2,'0')}`;
  return {
    date: day ? timestamp.toLocaleString('pt-BR') : '—',
    day,
    type: m.type,
    code: m.material_code || '',
    desc: m.material_desc || '',
    operation: m.type === 'entrada' ? 'Entrada (+)' : 'Saída (-)',
    opClass: m.type === 'entrada' ? 'entrada' : 'saida',
    qty: Number(m.quantity) || 0,
    responsible: m.responsible || 'Sistema'
  };
}

// ── Warehouse Tabs rendering and switching ──
function renderWarehouseTabs(tabs) {
  const container = document.getElementById('warehouseTabs');
  if (!container) return;
  window.WarehouseUI?.setStocks(tabs);
  if(currentWarehouseId){const url=new URL(window.location.href);url.searchParams.set('warehouse',currentWarehouseId);window.history.replaceState(null,'',url);}
}

async function selectWarehouse(id) {
  currentWarehouseId = id;materials=[];
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
    if (!tabsRes.success) throw Error(tabsRes.error || "Armazéns indisponíveis.");
    if (!tabsRes.data.length) { currentWarehouseId=null;window.WarehouseUI?.onboarding();return; }
    if (tabsRes.data.length > 0) {
      if (!tabsRes.data.some(stock=>stock.id===currentWarehouseId)) currentWarehouseId = tabsRes.data[0].id;
      renderWarehouseTabs(tabsRes.data);
    }

    // 1. Materiais
    const [materialsRes, movementsRes, componentsRes, usersRes] = await Promise.all([
      API.get('/materials' + (currentWarehouseId ? '?warehouse_id='+currentWarehouseId : '')),
      API.get('/movements'), API.get('/components'),
      Auth.canManageUsers() ? API.get('/auth/users') : Promise.resolve(null)
    ]);
    if (materialsRes.success) {
      materials = materialsRes.data.map(mapMaterialToFrontend);
    }else{materials=[];showToast(materialsRes.error||'Não foi possível carregar os materiais.','error');}
    
    // 2. Histórico de Movimentações

    if (movementsRes.success) {
      movements = movementsRes.data.map(mapMovementToFrontend);
    }
    
    // 3. Componentes customizados

    if (componentsRes.success) {
      customComponents = componentsRes.data;
    }
    
    // 4. Usuários & Permissões
    if (Auth.canManageUsers()) {

      if (usersRes.success) {
        users = usersRes.data.map(u => ({
          id: u.id,
          name: u.name + (u.surname ? ' ' + u.surname : ''),
          email: u.email,
          role: u.role,
          avatar_url: u.avatar_url || null,
          is_active: Boolean(u.is_active),
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
    
    if(window.mapHubReload)await window.mapHubReload();
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

function switchTab(t,{render=true}={}){
  if(t==='usuarios') { window.location.replace('./settings.html?tab=members'); return; }
  const wmsTabs=['dashboard','estoque','entrada','saida','mapa'];
  const standaloneTabs=['componentes','eam','relatorios','usuarios'];
  if(!wmsTabs.includes(t)&&!standaloneTabs.includes(t))t='dashboard';
  const role=Auth.getUserRole();
  if((role==='viewer'&&['entrada','saida','componentes'].includes(t))||(t==='usuarios'&&!Auth.canManageUsers()))t='dashboard';
  const isWms=wmsTabs.includes(t);
  const navigation=document.getElementById('SistemaTabs');
  if(navigation)navigation.hidden=!isWms;
  const pageActions=document.getElementById('wmsPageActions');
  if(pageActions)pageActions.hidden=!isWms;
  document.querySelectorAll('.sidebar [data-module]').forEach(link=>link.classList.toggle('active',link.dataset.module===(isWms?'wms':t)));
  document.querySelectorAll('#SistemaTabs .eo-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.eo-panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${t}`));
  const titles={dashboard:'Dashboard',estoque:'Estoque',entrada:'Entrada de Material',saida:'Saída de Material',mapa:'Mapa do Estoque',componentes:'Componentes',eam:'Ativos e manutenção',relatorios:'Relatórios',usuarios:'Usuários'};
  document.getElementById('pageTitle').textContent=titles[t]||'';
  document.documentElement.removeAttribute('data-boot-tab');
  const url=new URL(window.location.href);
  url.searchParams.set('tab',t);
  window.history.replaceState(null,'',url);
  if(!render)return;
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
  if(t==='eam')renderEam();
  if(t==='usuarios')renderUsers();
}

async function renderEam(){
  const [assets, orders, plans, locations, materialsResult, requisitions, sources, suppliers, replenishment, purchaseOrders, equipmentModels] = await Promise.all([API.get('/eam/assets'), API.get('/eam/work-orders'), API.get('/eam/plans'), API.get('/eam/functional-locations'), API.get('/materials'), API.get('/eam/purchase-requisitions'), API.get('/procurement/sources'), API.get('/procurement/suppliers'), API.get('/procurement/planning/replenishment'), API.get('/eam/purchase-orders'), API.get('/eam/equipment-models')]);
  const assetRows = assets.success && Array.isArray(assets.data) ? assets.data : [];
  if(!assets.success){const target=document.getElementById('eamAssetsTable');if(target)target.textContent=`Não foi possível carregar os ativos: ${assets.error||'erro da API'}`;return false;}
  const orderRows = orders.success && Array.isArray(orders.data) ? orders.data : [];
  const planRows = plans.success && Array.isArray(plans.data) ? plans.data : [];
  const locationRows = locations.success && Array.isArray(locations.data) ? locations.data : [];
  const materialRows = materialsResult.success && Array.isArray(materialsResult.data) ? materialsResult.data : [];
  window.eamMaterialsForProcurement=materialRows;
  const requisitionRows = requisitions.success && Array.isArray(requisitions.data) ? requisitions.data : [];
  const sourceRows = sources.success && Array.isArray(sources.data) ? sources.data : [], supplierRows = suppliers.success && Array.isArray(suppliers.data) ? suppliers.data : [];
  const replenishmentRows=replenishment.success&&Array.isArray(replenishment.data)?replenishment.data:[];
  const purchaseOrderRows=purchaseOrders.success&&Array.isArray(purchaseOrders.data)?purchaseOrders.data:[];
  const equipmentModelRows=equipmentModels.success&&Array.isArray(equipmentModels.data)?equipmentModels.data:[];
  window.eamEquipmentModelsForEdit=equipmentModelRows;
  const grid=document.getElementById('eamAssetsGrid'), body=document.getElementById('eamOrdersBody'), planBody=document.getElementById('eamPlansBody');
  if(!grid||!body||!planBody)return;
  grid.replaceChildren(...assetRows.map(eamAssetCard));
  window.eamAssetsForWorkspace=assetRows;
  renderEamAssetTable(assetRows);
  window.eamOrdersForWorkspace=orderRows;
  renderEamOrderMetrics(orderRows);
  filterEamOrders();
  for(const id of ['eamOrderAsset','eamPlanAsset','eamCounterAsset','eamAssetParent','eamReliabilityAsset','eamConditionAsset','eamBomAsset','eamModuleAsset','eamPositionAsset','eamInstanceAsset','eamRevisionAsset','eamVisualAsset','eamDocumentAsset']){const select=document.getElementById(id);if(select){const selected=select.value;select.replaceChildren(new Option(id==='eamAssetParent'?'Selecione o ativo pai':'Selecione o ativo',''),...assetRows.map(a=>new Option(`${a.asset_code} — ${a.name}`,String(a.id))));if(assetRows.some(a=>String(a.id)===selected))select.value=selected;}}
  if(typeof renderEamPreventives==='function')renderEamPreventives(assetRows,planRows);
  const locationSelect=document.getElementById('eamAssetFunctionalLocation');if(locationSelect)locationSelect.innerHTML='<option value="">Sem localização funcional</option>'+locationRows.map(l=>`<option value="${Number(l.id)}">${Security.escapeHTML(l.location_code)} — ${Security.escapeHTML(l.name)}</option>`).join('');
  const bomLocationSelect=document.getElementById('eamBomFunctionalLocation');if(bomLocationSelect)bomLocationSelect.innerHTML='<option value="">Localização do ativo</option>'+locationRows.map(l=>`<option value="${Number(l.id)}">${Security.escapeHTML(l.location_code)} — ${Security.escapeHTML(l.name)}</option>`).join('');
  renderEamFunctionalLocations(locationRows,assetRows);
  const modelSelect=document.getElementById('eamAssetEquipmentModel');if(modelSelect)modelSelect.innerHTML='<option value="">Sem modelo técnico</option>'+equipmentModelRows.map(m=>`<option value="${Number(m.id)}">${Security.escapeHTML(m.model_code)} — ${Security.escapeHTML(m.name)}</option>`).join('');
  const openOrderOptions=orderRows.filter(o=>!['completed','cancelled'].includes(o.status)).map(o=>`<option value="${Number(o.id)}">${Security.escapeHTML(o.work_order_number||('#'+o.id))} — ${Security.escapeHTML(o.title)}</option>`).join('');
  for(const id of ['eamMaterialOrder','eamLaborOrder','eamTaskOrder']){const select=document.getElementById(id);if(select)select.innerHTML='<option value="">Selecione a ordem</option>'+openOrderOptions;}
  const historySelect=document.getElementById('eamHistoryOrder');if(historySelect)historySelect.innerHTML='<option value="">Selecione a ordem</option>'+orderRows.map(o=>`<option value="${Number(o.id)}">${Security.escapeHTML(o.work_order_number||('#'+o.id))} — ${Security.escapeHTML(o.title)}</option>`).join('');
  const materialSelect=document.getElementById('eamMaterialId');if(materialSelect)materialSelect.innerHTML='<option value="">Selecione o material</option>'+materialRows.map(m=>`<option value="${Number(m.id)}">${Security.escapeHTML(m.code)} — ${Security.escapeHTML(m.description)}</option>`).join('');
  for(const id of ['eamBomMaterial']){const select=document.getElementById(id);if(select)select.innerHTML='<option value="">Selecione o material</option>'+materialRows.map(m=>`<option value="${Number(m.id)}">${Security.escapeHTML(m.code)} — ${Security.escapeHTML(m.description)}</option>`).join('');}
  for(const id of ['eamSourceMaterial','eamForecastMaterial','eamUnitMaterial','eamQuotaMaterial']){const select=document.getElementById(id);if(select)select.innerHTML='<option value="">Selecione o material</option>'+materialRows.map(m=>`<option value="${Number(m.id)}">${Security.escapeHTML(m.code)} — ${Security.escapeHTML(m.description)}</option>`).join('');}
  for(const id of ['eamSourceSupplier','eamQualificationSupplier','eamRfqBidSupplier','eamQuotaSupplier']){const select=document.getElementById(id);if(select)select.innerHTML='<option value="">Selecione o fornecedor</option>'+supplierRows.map(s=>`<option value="${Number(s.id)}">${Security.escapeHTML(s.name)}</option>`).join('');}
  const purchaseSupplier=document.getElementById('eamPurchaseSupplier');if(purchaseSupplier)purchaseSupplier.innerHTML='<option value="">Selecione o fornecedor</option>'+supplierRows.map(s=>`<option value="${Number(s.id)}">${Security.escapeHTML(s.name)}</option>`).join('');
  const purchaseReq=document.getElementById('eamPurchaseReq');if(purchaseReq)purchaseReq.innerHTML='<option value="">Selecione a requisição aprovada</option>'+requisitionRows.filter(r=>r.status==='approved').map(r=>`<option value="${Number(r.id)}">${Security.escapeHTML(r.code)} · ${Security.escapeHTML(r.requested_quantity)}</option>`).join('');
  const receiptOrder=document.getElementById('eamReceiptOrder');if(receiptOrder)receiptOrder.innerHTML='<option value="">Selecione o pedido</option>'+purchaseOrderRows.filter(p=>!['received','cancelled'].includes(p.status)).map(p=>`<option value="${Number(p.id)}">${Security.escapeHTML(p.po_number)} · ${Security.escapeHTML(p.code)}</option>`).join('');
  const sourcesBody=document.getElementById('eamSourcesBody');if(sourcesBody)sourcesBody.innerHTML=sourceRows.map(s=>`<tr><td>${Security.escapeHTML(s.code)} — ${Security.escapeHTML(s.description)}</td><td>${Security.escapeHTML(s.supplier_name)}</td><td>${formatBRL(s.unit_price)}</td><td>${Security.escapeHTML(s.lead_time_days??'—')}</td></tr>`).join('');
  const replenishmentBody=document.getElementById('eamReplenishmentBody');if(replenishmentBody)replenishmentBody.innerHTML=replenishmentRows.map(r=>`<tr><td>${Security.escapeHTML(r.code)} — ${Security.escapeHTML(r.description)} · ${Security.escapeHTML(r.suggested_quantity)}</td><td>${Security.escapeHTML(r.quantity)}</td><td>${Security.escapeHTML(r.reserved_quantity)}</td><td>${Security.escapeHTML(r.reorder_point??r.safety_stock)}</td><td>${Security.escapeHTML(r.lead_time_days??'—')}</td></tr>`).join('');
  const purchaseOrdersBody=document.getElementById('eamPurchaseOrdersBody');if(purchaseOrdersBody)purchaseOrdersBody.innerHTML=purchaseOrderRows.map(p=>`<tr><td>${Security.escapeHTML(p.po_number)}</td><td>${Security.escapeHTML(p.code)} — ${Security.escapeHTML(p.description)}</td><td>${Security.escapeHTML(p.supplier_name)}</td><td>${Security.escapeHTML(p.received_quantity)}/${Security.escapeHTML(p.quantity)} base · ${Security.escapeHTML(p.purchase_quantity??p.quantity)} ${Security.escapeHTML(p.purchase_unit||'base')}</td><td>${Security.escapeHTML(p.status)}</td></tr>`).join('');
  const downtimeSelect=document.getElementById('eamDowntimeOrder');if(downtimeSelect)downtimeSelect.innerHTML='<option value="">Selecione a ordem</option>'+orderRows.map(o=>`<option value="${Number(o.id)}">#${Number(o.id)} — ${Security.escapeHTML(o.title)}</option>`).join('');
  window.eamRequisitionsForWorkspace=requisitionRows;
  renderEamRequisitionMetrics(requisitionRows);
  filterEamRequisitions();
  document.getElementById('eamEmpty').style.display=assetRows.length||orderRows.length||planRows.length?'none':'block';
  loadEamFailureCodes();
  return true;
}

function switchEamSection(section,button){if(section!=='assets'&&!document.getElementById('eamAssetWorkspace')?.hidden)closeEamAssetWorkspace();if(section!=='orders'&&!document.getElementById('eamOrderWorkspace')?.hidden)closeEamOrderWorkspace();document.querySelectorAll('#panel-eam .eo-inline-tab').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('#panel-eam .eo-inline-panel').forEach(p=>p.classList.toggle('active',p.id===`eam-${section}`));if(section==='procurement'){loadEamMrp();loadEamForecasts();loadEamProcurementAdvanced();if(!document.getElementById('eamRfqLines')?.children.length)addEamRfqLine();}}
function renderEamAssetTable(rows){const target=document.getElementById('eamAssetsTable');if(!target)return;const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),all=window.eamAssetsForWorkspace||[],byId=new Map(all.map(asset=>[Number(asset.id),asset]));table.className='eo-table';head.innerHTML='<tr><th>Código</th><th>Ativo</th><th>Ativo pai</th><th>Modelo</th><th>Localização</th><th>Criticidade</th><th>Status</th><th>Ação</th></tr>';rows.forEach(asset=>{const row=document.createElement('tr'),parent=byId.get(Number(asset.parent_asset_id));[asset.asset_code,asset.name,parent?`${parent.asset_code} — ${parent.name}`:'Principal',asset.model_name||asset.model||'—',asset.functional_location_name||asset.functional_location||asset.location||'—',asset.criticality,asset.status].forEach(value=>{const cell=document.createElement('td');cell.textContent=value||'—';row.appendChild(cell);});const action=document.createElement('td'),button=document.createElement('button'),child=document.createElement('button');button.className='btn btn-secondary btn-sm';button.type='button';button.textContent='Abrir';button.addEventListener('click',()=>openEamAssetWorkspace(asset));child.className='btn btn-secondary btn-sm';child.type='button';child.textContent='Criar filho';child.addEventListener('click',()=>openEamAssetCreate(asset));action.append(button,child);row.appendChild(action);body.appendChild(row);});if(!rows.length){const empty=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=8;cell.textContent='Nenhum ativo cadastrado. Crie um ativo principal para começar.';empty.appendChild(cell);body.appendChild(empty);}table.append(head,body);target.replaceChildren(table);}
function filterEamAssets(){const query=(document.getElementById('eamAssetSearch')?.value||'').trim().toLocaleLowerCase('pt-BR'),rows=(window.eamAssetsForWorkspace||[]).filter(asset=>`${asset.asset_code||''} ${asset.name||''} ${asset.location||''} ${asset.status||''}`.toLocaleLowerCase('pt-BR').includes(query));renderEamAssetTable(rows);}
function switchEamAssetCreateTab(name,button){const form=document.getElementById('eamAssetCreateForm');if(!form)return;form.querySelectorAll('.eo-inline-tab').forEach(tab=>tab.classList.toggle('active',tab===button));form.querySelectorAll('.eo-inline-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`eamAssetTab-${name}`));}
function toggleEamAssetParent(){const child=document.getElementById('eamAssetKind')?.value==='child',group=document.getElementById('eamAssetParentGroup'),select=document.getElementById('eamAssetParent'),hint=document.getElementById('eamAssetParentHint');if(group)group.hidden=!child;if(select&&!child)select.value='';if(hint)hint.textContent=child?'Selecione um ativo já cadastrado como pai. O vínculo aparecerá na lista e na ficha.':'Este ativo será principal. Depois você poderá criar filhos a partir da lista ou da ficha.';}
function updateEamAssetFileLabel(input){const label=input?.closest('.eo-asset-upload');if(!label)return;label.dataset.prompt ||= label.firstChild.textContent;const names=Array.from(input.files||[],file=>file.name);label.firstChild.textContent=names.length?names.join(', '):label.dataset.prompt;}
function openEamAssetCreate(parentAsset){const modal=document.getElementById('eamAssetCreateModal'),slot=document.getElementById('eamAssetCreateSlot'),form=document.getElementById('eamAssetCreateForm');if(!modal||!slot||!form)return;form.reset();slot.appendChild(form);document.getElementById('eamAssetKind').value=parentAsset?'child':'root';document.getElementById('eamAssetParent').value=parentAsset?String(parentAsset.id):'';toggleEamAssetParent();const firstTab=form.querySelector('.eo-inline-tab');switchEamAssetCreateTab('basic',firstTab);form.querySelectorAll('.eo-asset-upload input').forEach(updateEamAssetFileLabel);document.getElementById('eamAssetCreateFeedback').textContent='';modal.classList.add('active');modal.setAttribute('aria-hidden','false');document.getElementById('eamAssetCode')?.focus();}
function closeEamAssetCreate(){const modal=document.getElementById('eamAssetCreateModal'),operations=document.getElementById('eamAssetOperations'),form=document.getElementById('eamAssetCreateForm');if(modal){modal.classList.remove('active');modal.setAttribute('aria-hidden','true');}if(operations&&form)operations.prepend(form);}
function closeEamAssetWorkspace(){
  const workspace=document.getElementById('eamAssetWorkspace');
  if(!workspace||workspace.hidden)return;
  window.EamVisualWorkspace?.invalidate();
  restoreEamAssetContext();
  workspace.hidden=true;
  document.body.classList.remove('eam-asset-screen-open');
  if(window.eamAssetWorkspaceKeyHandler){document.removeEventListener('keydown',window.eamAssetWorkspaceKeyHandler);window.eamAssetWorkspaceKeyHandler=null;}
  if(window.eamAssetReturnFocus?.isConnected)window.eamAssetReturnFocus.focus();
  else document.getElementById('eamAssetSearch')?.focus();
  window.eamAssetReturnFocus=null;
}
function openEamAssetWorkspace(asset){
  const workspace=document.getElementById('eamAssetWorkspace');
  if(!workspace||!asset)return;
  if(workspace.hidden)window.eamAssetReturnFocus=document.activeElement;
  else{window.EamVisualWorkspace?.invalidate();restoreEamAssetContext();}
  if(workspace.parentElement!==document.body)document.body.appendChild(workspace);
  window.eamActiveAsset=asset;
  workspace.hidden=false;
  workspace.setAttribute('role','dialog');
  workspace.setAttribute('aria-modal','true');
  workspace.setAttribute('aria-label',`Ficha do ativo ${asset.asset_code||asset.name||''}`);
  document.body.classList.add('eam-asset-screen-open');
  const header=document.createElement('header'),back=document.createElement('button'),title=document.createElement('h3'),meta=document.createElement('div'),actions=document.createElement('div'),createOrder=document.createElement('button'),createChild=document.createElement('button');
  header.className='eam-workspace-header';
  back.type='button';back.className='btn btn-secondary btn-sm';back.textContent='← Voltar aos ativos';back.addEventListener('click',closeEamAssetWorkspace);
  title.className='eam-workspace-title';title.textContent=`${asset.asset_code||'—'} · ${asset.name||'—'}`;
  meta.className='eam-workspace-meta';meta.textContent=`${asset.model_name||asset.model||'Sem modelo'} · ${asset.functional_location_name||asset.functional_location||asset.location||'Sem localização'}`;
  createChild.type='button';createChild.className='btn btn-secondary btn-sm';createChild.textContent='+ Criar ativo filho';createChild.addEventListener('click',()=>openEamAssetCreate(asset));
  createOrder.type='button';createOrder.className='btn btn-primary btn-sm';createOrder.textContent='Criar O.S.';createOrder.addEventListener('click',()=>{switchEamSection('orders',document.querySelector('#panel-eam [onclick*="orders"]'));const select=document.getElementById('eamOrderAsset');if(select)select.value=String(asset.id);toggleEamOrderForm(true);});
  const edit=document.createElement('button');edit.type='button';edit.className='btn btn-secondary btn-sm';edit.textContent='Editar ativo';edit.addEventListener('click',()=>openEamAssetEdit(asset));
  actions.className='eam-workspace-actions';const versions=document.createElement('button');versions.type='button';versions.className='btn btn-secondary btn-sm';versions.textContent='Versões da montagem';versions.onclick=()=>openEamSnapshots(asset);actions.append(edit,createChild,versions,createOrder);
  const heading=document.createElement('div');heading.className='eam-workspace-heading';heading.append(title,meta);header.append(back,heading,actions);
  const tabs=document.createElement('nav'),body=document.createElement('div'),shell=document.createElement('div');
  tabs.className='eam-workspace-tabs';tabs.setAttribute('aria-label','Seções da ficha do ativo');body.className='eam-workspace-body';shell.className='eam-workspace-shell';
  ['Visão geral','Estrutura','Componentes','Digital Twin','Manutenção','Documentos','Histórico','Confiabilidade'].forEach((label,index)=>{const tab=document.createElement('button');tab.type='button';tab.className=`eam-workspace-tab${index===0?' active':''}`;tab.textContent=label;tab.addEventListener('click',()=>{tabs.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button===tab));renderEamAssetWorkspaceTab(body,label,asset);workspace.scrollTop=0;});tabs.appendChild(tab);});
  shell.append(header,tabs,body);workspace.replaceChildren(shell);renderEamAssetWorkspaceTab(body,'Visão geral',asset);workspace.scrollTop=0;
  if(window.eamAssetWorkspaceKeyHandler)document.removeEventListener('keydown',window.eamAssetWorkspaceKeyHandler);
  window.eamAssetWorkspaceKeyHandler=event=>{if(workspace.hidden||document.querySelector('.eo-modal-overlay.active'))return;if(event.key==='Escape'){event.preventDefault();closeEamAssetWorkspace();return;}if(event.key!=='Tab')return;const focusable=[...workspace.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};
  document.addEventListener('keydown',window.eamAssetWorkspaceKeyHandler);
  back.focus();
}
function restoreEamAssetContext(){const fallback=document.getElementById('eamAssetOperations');[...(window.eamContextNodes||[])].reverse().forEach(record=>{const node=record.node||record,parent=record.parent||fallback;if(!node||!parent)return;if(record.nextSibling?.parentNode===parent)parent.insertBefore(node,record.nextSibling);else parent.appendChild(node);if(record.hidden!==undefined)node.hidden=record.hidden;});window.eamContextNodes=[];}
function moveEamContextNode(node,target){if(!node||!target)return;window.eamContextNodes||=[];if(!window.eamContextNodes.some(record=>(record.node||record)===node))window.eamContextNodes.push({node,parent:node.parentNode,nextSibling:node.nextSibling,hidden:node.hidden});node.hidden=false;target.appendChild(node);}
function eamContextForm(action,target){const form=[...document.querySelectorAll('form')].find(item=>item.getAttribute('onsubmit')===`${action}(event)`);moveEamContextNode(form,target);}
function setEamAssetContext(asset){['eamModuleAsset','eamPositionAsset','eamInstanceAsset','eamRevisionAsset','eamVisualAsset','eamDocumentAsset','eamBomAsset','eamOrderAsset','eamPlanAsset'].forEach(id=>{const select=document.getElementById(id);if(select){select.value=String(asset.id);select.dispatchEvent(new Event('change'));}});}
function eamAssetOverviewDetails(asset){
  let metadata=asset.metadata||{};
  if(typeof metadata==='string'){try{metadata=JSON.parse(metadata);}catch{metadata={};}}
  const all=window.eamAssetsForWorkspace||[],parent=all.find(item=>Number(item.id)===Number(asset.parent_asset_id)),children=all.filter(item=>Number(item.parent_asset_id)===Number(asset.id));
  return [['Status',asset.status],['Criticidade',asset.criticality],['Hierarquia',parent?`Filho de ${parent.asset_code} — ${parent.name}`:'Ativo principal'],['Ativos filhos',children.length?children.map(item=>item.asset_code).join(', '):'Nenhum'],['Localização',asset.functional_location_name||asset.functional_location||asset.location||'—'],['Modelo',asset.model_name||asset.model||'—'],['Fabricante',asset.manufacturer||'—'],['Número de série',asset.serial_number||'—'],['Descrição do maquinário',metadata.machine_description||'—'],['Observações técnicas',metadata.technical_notes||'—'],['URL do fabricante',metadata.manufacturer_url||'—'],['Próxima manutenção','Consulte Preventivas'],['Horas / ciclos','Sem leitura registrada']];
}
function renderEamAssetWorkspaceTab(target,label,asset){window.EamVisualWorkspace?.invalidate();restoreEamAssetContext();target.replaceChildren();setEamAssetContext(asset);if(label==='Visão geral'&&window.EamVisualWorkspace){window.EamVisualWorkspace.renderOverview(target,asset);return;}if(label==='Estrutura'&&window.EamVisualWorkspace){window.EamVisualWorkspace.renderAssembly(target,asset);return;}if(label==='Componentes'&&window.EamVisualWorkspace){window.EamVisualWorkspace.renderComponents(target,asset);return;}const header=document.createElement('h4');header.textContent=label;target.appendChild(header);const groups={Manutenção:['createEamPlan'],Histórico:['createEamRevision'],'Digital Twin':['createEamVisual'],'Documentos':['createEamDocument']}[label]||[];groups.forEach(action=>eamContextForm(action,target));if(label==='Histórico'&&window.EamVisualWorkspace)window.EamVisualWorkspace.renderHistory(target,asset);if(label==='Digital Twin'){moveEamContextNode(document.getElementById('eamDigitalTwin'),target);moveEamContextNode(document.getElementById('eamVisualCanvas'),target);moveEamContextNode(document.getElementById('eamHotspotForm'),target);loadEamDigitalTwin(Number(asset.id));}if(label==='Documentos'){if(window.EamVisualWorkspace)window.EamVisualWorkspace.renderDocuments(target,asset);else{moveEamContextNode(document.getElementById('eamTechnicalDocuments'),target);loadEamDocuments(Number(asset.id));}}if(label==='Confiabilidade'){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent='Calcular indicadores do ativo';button.addEventListener('click',()=>{switchEamSection('reliability',document.querySelector('#panel-eam [onclick*="reliability"]'));const select=document.getElementById('eamReliabilityAsset');if(select)select.value=String(asset.id);});target.appendChild(button);window.AnalyticsEntry?.equipmentLink(target,asset);}}
function eamAssetCard(asset){const card=document.createElement('div'),code=document.createElement('strong'),name=document.createElement('span'),meta=document.createElement('small'),button=document.createElement('button');card.className='eo-component-card';code.textContent=asset.asset_code||'—';name.textContent=asset.name||'—';meta.textContent=`${asset.status||'—'} · ${asset.criticality||'—'}`;button.type='button';button.className='btn btn-secondary btn-sm';button.textContent='Abrir ficha';button.addEventListener('click',()=>openEamAssetWorkspace(asset));card.append(code,name,meta,button);return card;}
function eamTwinCard(label,value){const card=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span');card.className='eo-component-card';title.textContent=label;detail.textContent=value;card.append(title,detail);return card;}
async function loadEamDigitalTwin(assetId){const target=document.getElementById('eamDigitalTwin');if(!target||!Number.isSafeInteger(assetId)||assetId<1)return;target.replaceChildren(eamTwinCard('Gêmeo digital','Carregando…'));const result=await API.get(`/eam/assets/${assetId}/digital-twin`);if(!result.success){target.replaceChildren(eamTwinCard('Gêmeo digital',result.error||'Não foi possível carregar o ativo'));return;}const twin=result.data||{},asset=twin.asset||{},model=twin.model_name?`${twin.model_code||''} — ${twin.model_name}`:'Sem modelo técnico associado',modules=Array.isArray(twin.modules)?twin.modules:[],positions=Array.isArray(twin.positions)?twin.positions:[],instances=Array.isArray(twin.instances)?twin.instances:[],visuals=Array.isArray(twin.visuals)?twin.visuals:[],revisions=Array.isArray(twin.revisions)?twin.revisions:[];target.replaceChildren(eamTwinCard('Gêmeo digital',`${asset.asset_code||'—'} — ${asset.name||'—'}`),eamTwinCard('Modelo',model),eamTwinCard('Conjuntos',modules.length?modules.map(m=>`${m.code||'—'} — ${m.name||'—'}`).join(' | '):'Nenhum conjunto cadastrado'),eamTwinCard('Posições',positions.length?positions.map(p=>`${p.position_number||'—'} — ${p.name||'—'}`).join(' | '):'Nenhuma posição cadastrada'),eamTwinCard('Instâncias instaladas',String(instances.filter(i=>i.status==='installed').length)),eamTwinCard('Visuais e revisões',`${visuals.length} visual(is) · ${revisions.length} revisão(ões)`));visuals.forEach(visual=>{const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent=`Abrir: ${visual.title||visual.filename||'visual'}`;button.addEventListener('click',()=>openEamVisual(assetId,visual));target.appendChild(button);});}
function restoreEamOrderContext(){const host=document.getElementById('eamOrderOperations');(window.eamOrderContextNodes||[]).forEach(node=>host?.appendChild(node));window.eamOrderContextNodes=[];}
function moveEamOrderNode(node,target){if(!node||!target)return;node.hidden=false;target.appendChild(node);window.eamOrderContextNodes.push(node);}
function eamOrderForm(action,target){const form=[...document.querySelectorAll('form')].find(item=>item.getAttribute('onsubmit')===`${action}(event)`);moveEamOrderNode(form,target);}
function setEamOrderContext(order){['eamMaterialOrder','eamLaborOrder','eamTaskOrder','eamHistoryOrder','eamDowntimeOrder'].forEach(id=>{const select=document.getElementById(id);if(select)select.value=String(order.id);});}
function renderEamOrderMetrics(orders){const target=document.getElementById('eamOrderMetrics');if(!target)return;const rows=Array.isArray(orders)?orders:[],counts=[['Total',rows.length],['Aguardando liberação',rows.filter(order=>order.status==='open'&&!order.released_at).length],['Em andamento',rows.filter(order=>order.status==='in_progress').length],['Concluídas',rows.filter(order=>order.status==='completed').length]];target.replaceChildren(...counts.map(([label,value])=>{const card=document.createElement('div'),name=document.createElement('span'),count=document.createElement('strong');card.className='eam-order-metric';name.textContent=label;count.textContent=String(value);card.append(name,count);return card;}));}
function filterEamOrders(){const target=document.getElementById('eamOrdersBody'),empty=document.getElementById('eamOrdersEmpty');if(!target)return;const query=(document.getElementById('eamOrderSearch')?.value||'').trim().toLocaleLowerCase('pt-BR'),status=document.getElementById('eamOrderStatusFilter')?.value||'',rows=(window.eamOrdersForWorkspace||[]).filter(order=>{const text=`${order.work_order_number||''} ${order.title||''} ${order.asset_code||''} ${order.asset_name||''} ${order.type||''}`.toLocaleLowerCase('pt-BR');return(!query||text.includes(query))&&(!status||order.status===status);});target.replaceChildren(...rows.map(eamOrderRow));if(empty){empty.hidden=rows.length>0;empty.textContent=(window.eamOrdersForWorkspace||[]).length?'Nenhuma ordem corresponde aos filtros.':'Nenhuma ordem cadastrada. Crie uma nova ordem para começar.';}}
function toggleEamOrderForm(open){const panel=document.getElementById('eamOrderCreatePanel');if(!panel)return;panel.open=Boolean(open);if(open)document.getElementById('eamOrderTitle')?.focus();}
function closeEamOrderWorkspace(){const workspace=document.getElementById('eamOrderWorkspace');if(!workspace||workspace.hidden)return;restoreEamOrderContext();workspace.hidden=true;document.body.classList.remove('eam-order-screen-open');if(window.eamOrderWorkspaceKeyHandler){document.removeEventListener('keydown',window.eamOrderWorkspaceKeyHandler);window.eamOrderWorkspaceKeyHandler=null;}if(window.eamOrderReturnFocus?.isConnected)window.eamOrderReturnFocus.focus();else document.getElementById('eamOrderSearch')?.focus();window.eamOrderReturnFocus=null;}
function openEamOrderWorkspace(order){const workspace=document.getElementById('eamOrderWorkspace');if(!workspace||!order)return;if(workspace.hidden)window.eamOrderReturnFocus=document.activeElement;else restoreEamOrderContext();if(workspace.parentElement!==document.body)document.body.appendChild(workspace);window.eamActiveOrder=order;workspace.hidden=false;workspace.setAttribute('role','dialog');workspace.setAttribute('aria-modal','true');workspace.setAttribute('aria-label',`Ordem ${order.work_order_number||order.id}`);document.body.classList.add('eam-order-screen-open');const shell=document.createElement('div'),header=document.createElement('header'),title=document.createElement('h2'),meta=document.createElement('div'),back=document.createElement('button'),body=document.createElement('div'),tabs=document.createElement('nav'),heading=document.createElement('div');shell.className='eam-workspace-shell';header.className='eam-workspace-header';heading.className='eam-workspace-heading';title.className='eam-workspace-title';title.textContent=`${order.work_order_number||`OS-${order.id}`} · ${order.title||'Ordem de manutenção'}`;meta.className='eam-workspace-meta';meta.textContent=`${order.asset_code||'—'} · ${order.asset_name||'Ativo sem nome'} · ${order.priority||'—'} · ${order.status==='open'&&!order.released_at?'Aguardando liberação':order.status||'—'}`;back.type='button';back.className='btn btn-secondary btn-sm';back.textContent='← Voltar às ordens';back.addEventListener('click',closeEamOrderWorkspace);heading.append(title,meta);header.append(back,heading);tabs.className='eam-workspace-tabs';tabs.setAttribute('aria-label','Seções da ordem');body.className='eam-workspace-body';['Visão geral','Tarefas','Materiais','Mão de obra','Downtime','Histórico'].forEach((label,index)=>{const tab=document.createElement('button');tab.type='button';tab.className=`eam-workspace-tab${index===0?' active':''}`;tab.textContent=label;tab.addEventListener('click',()=>{tabs.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button===tab));renderEamOrderWorkspaceTab(body,label,order);workspace.scrollTop=0;});tabs.appendChild(tab);});shell.append(header,tabs,body);workspace.replaceChildren(shell);renderEamOrderWorkspaceTab(body,'Visão geral',order);workspace.scrollTop=0;if(window.eamOrderWorkspaceKeyHandler)document.removeEventListener('keydown',window.eamOrderWorkspaceKeyHandler);window.eamOrderWorkspaceKeyHandler=event=>{if(workspace.hidden)return;if(event.key==='Escape'){event.preventDefault();closeEamOrderWorkspace();return;}if(event.key!=='Tab')return;const focusable=[...workspace.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};document.addEventListener('keydown',window.eamOrderWorkspaceKeyHandler);back.focus();}
function renderEamOrderWorkspaceTab(target,label,order){restoreEamOrderContext();target.replaceChildren();setEamOrderContext(order);if(label==='Visão geral'){const grid=document.createElement('div');grid.className='eam-order-detail-grid';[['Ativo',`${order.asset_code||'—'} — ${order.asset_name||'—'}`],['Tipo',eamOrderTypeLabel(order.type)],['Prioridade',order.priority],['Status',eamOrderStatusLabel(order)],['Abertura',order.created_at?new Date(order.created_at).toLocaleString('pt-BR'):'—'],['Responsável',order.assigned_to_name||'Não atribuído']].forEach(([name,value])=>grid.appendChild(eamTwinCard(name,value||'—')));target.appendChild(grid);return;}const descriptions={Tarefas:'Planeje e acompanhe as atividades necessárias para concluir esta ordem.',Materiais:'Registre solicitações, reservas e consumo de peças vinculadas a esta ordem.','Mão de obra':'Lance as horas trabalhadas e o custo de execução.',Downtime:'Registre o período parado e classifique a falha.',Histórico:'Consulte tarefas e eventos já registrados para esta ordem.'},intro=document.createElement('p');intro.className='eam-order-tab-intro';intro.textContent=descriptions[label]||'';target.appendChild(intro);const forms={Tarefas:['createEamTask'],Materiais:['submitEamMaterial'],'Mão de obra':['createEamLabor'],Downtime:['createEamDowntime']}[label]||[];forms.forEach(action=>eamOrderForm(action,target));if(label==='Materiais'){moveEamOrderNode(document.getElementById('eamMaterialRequests'),target);loadEamMaterialRequests(order.id);}if(label==='Histórico'){moveEamOrderNode(document.getElementById('eamHistoryOrder')?.parentElement,target);moveEamOrderNode(document.getElementById('eamOrderHistory'),target);loadEamOrderHistory();}else if(label==='Tarefas'){moveEamOrderNode(document.getElementById('eamOrderHistory'),target);loadEamOrderHistory();}}
function eamOrderStatusLabel(order){if(order.status==='open'&&!order.released_at)return'Aguardando liberação';return({open:'Aberta',in_progress:'Em andamento',blocked:'Bloqueada',waiting_materials:'Aguardando materiais',paused:'Pausada',completed:'Concluída',cancelled:'Cancelada'})[order.status]||order.status||'—';}
function eamOrderTypeLabel(type){return({corrective:'Corretiva',preventive:'Preventiva',inspection:'Inspeção'})[type]||type||'—';}
function eamOrderRow(order){const row=document.createElement('tr'),cells=[`${order.work_order_number||('#'+order.id)} · ${order.asset_code||''} — ${order.asset_name||''}`,eamOrderTypeLabel(order.type),({low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'})[order.priority]||order.priority,eamOrderStatusLabel(order)];cells.forEach(value=>{const cell=document.createElement('td');cell.textContent=value||'—';row.appendChild(cell);});const action=document.createElement('td'),open=document.createElement('button'),next={open:order.released_at?'in_progress':null,in_progress:'completed',blocked:'in_progress',waiting_materials:'in_progress',paused:'in_progress'}[order.status];open.className='btn btn-secondary btn-sm';open.textContent='Abrir ficha';open.addEventListener('click',()=>openEamOrderWorkspace(order));action.appendChild(open);if(['open','in_progress','blocked','waiting_materials','paused'].includes(order.status)){const manage=document.createElement('button');manage.type='button';manage.className='btn btn-secondary btn-sm';manage.textContent='Alterar situação';manage.onclick=()=>openEamOperationalStatus(order);action.append(manage);}if(order.status==='open'&&!order.released_at){const release=document.createElement('button');release.className='btn btn-primary btn-sm';release.textContent='Liberar';release.addEventListener('click',()=>releaseEamOrder(order.id));action.appendChild(release);}if(next){const button=document.createElement('button');button.className='btn btn-primary btn-sm';button.textContent=next==='in_progress'?'Iniciar':'Concluir';button.addEventListener('click',()=>updateEamOrderStatus(order.id,next));action.appendChild(button);}if(order.status==='completed'&&!order.financial_closed_at){const close=document.createElement('button');close.className='btn btn-secondary btn-sm';close.textContent='Fechar financeiro';close.addEventListener('click',()=>financialCloseEamOrder(order.id));action.appendChild(close);}row.appendChild(action);return row;}
function eamRequisitionStatusLabel(status){return({draft:'Rascunho',requested:'Aguardando aprovação',approved:'Aprovada',fulfilled:'Pedido gerado',cancelled:'Cancelada'})[status]||status||'—';}
function renderEamRequisitionMetrics(requisitions){const target=document.getElementById('eamRequisitionMetrics');if(!target)return;const rows=Array.isArray(requisitions)?requisitions:[],cards=[['Total',rows.length],['Aguardando aprovação',rows.filter(row=>['draft','requested'].includes(row.status)).length],['Aprovadas',rows.filter(row=>row.status==='approved').length],['Pedidos gerados',rows.filter(row=>row.status==='fulfilled').length]];target.replaceChildren(...cards.map(([label,value])=>{const card=document.createElement('div'),name=document.createElement('span'),count=document.createElement('strong');card.className='eam-order-metric';name.textContent=label;count.textContent=String(value);card.append(name,count);return card;}));}
function filterEamRequisitions(){const target=document.getElementById('eamRequisitionsBody'),empty=document.getElementById('eamRequisitionsEmpty');if(!target)return;const query=(document.getElementById('eamRequisitionSearch')?.value||'').trim().toLocaleLowerCase('pt-BR'),status=document.getElementById('eamRequisitionStatusFilter')?.value||'',all=window.eamRequisitionsForWorkspace||[],rows=all.filter(row=>{const text=`${row.code||''} ${row.description||''} ${row.work_order_title||''} ${row.status||''}`.toLocaleLowerCase('pt-BR');return(!query||text.includes(query))&&(!status||row.status===status);});target.replaceChildren(...rows.map(eamRequisitionRow));if(empty){empty.hidden=rows.length>0;empty.textContent=all.length?'Nenhuma requisição corresponde aos filtros.':'Não há requisições cadastradas. Ordens que precisam de materiais podem gerar uma solicitação.';}}
function prepareEamPurchaseOrder(requisitionId){const panel=document.getElementById('eamPurchaseOrderCreatePanel'),select=document.getElementById('eamPurchaseReq');if(!panel||!select)return;for(let ancestor=panel.parentElement?.closest('details');ancestor;ancestor=ancestor.parentElement?.closest('details'))ancestor.open=true;select.value=String(requisitionId);panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('eamPurchaseSupplier')?.focus();}
function eamRequisitionRow(requisition){const row=document.createElement('tr'),date=requisition.created_at?new Date(requisition.created_at):null,values=[`${requisition.code||''} — ${requisition.description||''}`,requisition.requested_quantity,requisition.work_order_title||'Estoque',eamRequisitionStatusLabel(requisition.status),date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('pt-BR'):'—'];values.forEach(value=>{const cell=document.createElement('td');cell.textContent=value??'—';row.appendChild(cell);});const actions=document.createElement('td');if(['draft','requested'].includes(requisition.status)){const approve=document.createElement('button');approve.type='button';approve.className='btn btn-primary btn-sm';approve.textContent='Aprovar';approve.addEventListener('click',()=>updateEamRequisition(requisition.id,'approved'));actions.appendChild(approve);const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-secondary btn-sm';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>updateEamRequisition(requisition.id,'cancelled'));actions.appendChild(cancel);}if(requisition.status==='approved'){const purchase=document.createElement('button');purchase.type='button';purchase.className='btn btn-primary btn-sm';purchase.textContent='Gerar pedido';purchase.addEventListener('click',()=>prepareEamPurchaseOrder(requisition.id));actions.appendChild(purchase);}if(!actions.childElementCount){actions.textContent='—';}row.appendChild(actions);return row;}
function eamAssetCreatePayload(){
  const value=id=>document.getElementById(id).value.trim(),child=value('eamAssetKind')==='child',parent=value('eamAssetParent'),location=value('eamAssetFunctionalLocation'),equipmentModel=value('eamAssetEquipmentModel');
  if(!value('eamAssetCode')||!value('eamAssetName'))throw Error('Informe o código e a descrição do ativo.');
  if(child&&!parent)throw Error('Selecione um ativo pai antes de cadastrar o filho.');
  if(child&&(!Number.isSafeInteger(Number(parent))||Number(parent)<1))throw Error('Ativo pai inválido.');
  const manufacturerUrl=value('eamAssetManufacturerUrl');
  if(manufacturerUrl){try{const url=new URL(manufacturerUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw Error('Use uma URL HTTPS válida para o fabricante.');}}
  return {asset_code:value('eamAssetCode'),name:value('eamAssetName'),parent_asset_id:child?Number(parent):null,functional_location_id:location?Number(location):null,equipment_model_id:equipmentModel?Number(equipmentModel):null,criticality:value('eamAssetCriticality'),status:value('eamAssetStatus'),manufacturer:value('eamAssetManufacturer')||undefined,model:value('eamAssetModel')||undefined,serial_number:value('eamAssetSerial')||undefined,metadata:{manufacturer_url:manufacturerUrl||null,machine_description:value('eamAssetMachineDescription')||null,technical_notes:value('eamAssetNotes')||null}};
}
function eamAssetSelectedFiles(){
  const groups=[['eamAssetPhoto','visual','photo'],['eamAsset3D','visual','3d_model'],['eamAssetManuals','document','manual'],['eamAssetElectrical','document','electrical'],['eamAssetMechanical','document','mechanical']];
  const files=groups.flatMap(([id,kind,type])=>Array.from(document.getElementById(id).files||[],file=>({file,kind,type})));
  for(const {file} of files){if(!file.size||file.size>8*1024*1024)throw Error(`O arquivo ${file.name} deve ter até 8 MiB.`);if(!/^[^/\\\x00-\x1f\x7f]{1,200}$/.test(file.name))throw Error('Nome de arquivo inválido.');}
  return files;
}
async function uploadEamAssetCreateFiles(assetId,assetCode,files){
  const failed=[];
  for(const [index,{file,kind,type}] of files.entries()){
    try{
      const file_data=await readEamVisualFile(file);
      const payload=kind==='visual'?{type,title:file.name,filename:file.name,file_data}:{document_number:`${assetCode}-${type}-${index+1}`.slice(0,120),title:file.name,revision_code:'A',document_type:type,filename:file.name,file_data};
      const result=await API.post(`/eam/assets/${assetId}/${kind==='visual'?'visuals':'documents'}`,payload);
      if(!result.success)failed.push(`${file.name}: ${result.error||'falha ao enviar'}`);
    }catch(error){failed.push(`${file.name}: ${error.message||'falha ao ler'}`);}
  }
  return failed;
}
async function createEamAsset(event){
  event.preventDefault();
  const feedback=document.getElementById('eamAssetCreateFeedback'),submit=document.getElementById('eamAssetSubmit');
  let payload,files;
  try{payload=eamAssetCreatePayload();files=eamAssetSelectedFiles();}catch(error){feedback.textContent=error.message;showToast(error.message,'error');if(!payload){const invalidUrl=error.message.includes('URL HTTPS'),form=document.getElementById('eamAssetCreateForm'),tabs=form.querySelectorAll('.eo-inline-tab');switchEamAssetCreateTab(invalidUrl?'machine':'basic',tabs[invalidUrl?2:0]);document.getElementById(invalidUrl?'eamAssetManufacturerUrl':!document.getElementById('eamAssetCode').value.trim()?'eamAssetCode':!document.getElementById('eamAssetName').value.trim()?'eamAssetName':'eamAssetParent')?.focus();}return;}
  submit.disabled=true;feedback.textContent='Salvando ativo…';
  try{
    const result=await API.post('/eam/assets',payload);
    if(!result.success){feedback.textContent=result.error||'Não foi possível cadastrar o ativo';showToast(feedback.textContent,'error');return;}
    const assetId=Number(result.data?.id||result.id),failed=await uploadEamAssetCreateFiles(assetId,payload.asset_code,files);
    const loaded=await renderEam();
    const created=(window.eamAssetsForWorkspace||[]).find(asset=>Number(asset.id)===assetId);
    closeEamAssetCreate();
    if(loaded&&created)openEamAssetWorkspace(created);
    showToast(!loaded?'Ativo cadastrado, mas a lista não pôde ser atualizada. Recarregue a página.':failed.length?`Ativo cadastrado; ${failed.length} anexo(s) falharam. Reenvie pela ficha.`:'Ativo e anexos cadastrados',loaded?'success':'error');
    if(failed.length){feedback.textContent=failed.join(' · ');showToast(failed.join(' · '),'error');}
  }catch(error){feedback.textContent=error.message||'Falha ao cadastrar ativo';showToast(feedback.textContent,'error');}
  finally{submit.disabled=false;}
}
async function createEamEquipmentModel(event){event.preventDefault();const result=await API.post('/eam/equipment-models',{model_code:document.getElementById('eamEquipmentModelCode').value,name:document.getElementById('eamEquipmentModelName').value,manufacturer:document.getElementById('eamEquipmentModelManufacturer').value||undefined});if(result.success){event.target.reset();showToast('Modelo técnico cadastrado','success');renderEam();}else showToast(result.error||'Não foi possível cadastrar modelo técnico','error');}
async function createEamModule(event){event.preventDefault();const assetId=Number(document.getElementById('eamModuleAsset').value),parentId=Number(document.getElementById('eamModuleParent')?.value),result=await API.post(`/eam/assets/${assetId}/modules`,{code:document.getElementById('eamModuleCode').value,name:document.getElementById('eamModuleName').value,parent_module_id:parentId||null});if(result.success){event.target.reset();showToast('Conjunto adicionado','success');window.EamVisualWorkspace?.refresh(assetId);}else showToast(result.error||'Não foi possível adicionar conjunto','error');}
async function createEamComponentPosition(event){event.preventDefault();const assetId=Number(document.getElementById('eamPositionAsset').value),moduleId=Number(document.getElementById('eamPositionModule')?.value),itemId=Number(document.getElementById('eamPositionMaterial')?.value),result=await API.post(`/eam/assets/${assetId}/component-positions`,{position_number:document.getElementById('eamPositionNumber').value,name:document.getElementById('eamPositionName').value,quantity_required:Number(document.getElementById('eamPositionQuantity').value),module_id:moduleId||null,expected_item_id:itemId||null});if(result.success){event.target.reset();showToast('Posição adicionada','success');window.EamVisualWorkspace?.refresh(assetId);}else showToast(result.error||'Não foi possível adicionar posição','error');}
function setEamOptions(select,rows,label,empty){if(!select)return;select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=empty;select.appendChild(first);rows.forEach(row=>{const option=document.createElement('option');option.value=String(Number(row.id));option.textContent=label(row);select.appendChild(option);});}
async function loadEamInstancePositions(){const assetId=Number(document.getElementById('eamInstanceAsset').value),positionSelect=document.getElementById('eamInstancePosition');window.eamTwinInstances=[];if(!Number.isSafeInteger(assetId)||assetId<1){window.eamTwinPositions=[];setEamOptions(positionSelect,[],()=>'', 'Selecione o ativo primeiro');loadEamInstalledInstances();return;}const result=await API.get(`/eam/assets/${assetId}/digital-twin`);if(!result.success){window.eamTwinPositions=[];setEamOptions(positionSelect,[],()=>'', 'Posições indisponíveis');showToast(result.error||'Não foi possível carregar posições','error');return;}window.eamTwinPositions=Array.isArray(result.data?.positions)?result.data.positions:[];window.eamTwinInstances=Array.isArray(result.data?.instances)?result.data.instances:[];setEamOptions(positionSelect,window.eamTwinPositions,p=>`${p.position_number||'—'} — ${p.name||'—'}`, 'Selecione a posição');loadEamInstalledInstances();}
function loadEamInstalledInstances(){const positionId=Number(document.getElementById('eamInstancePosition').value),previous=document.getElementById('eamInstancePrevious'),instances=(window.eamTwinInstances||[]).filter(i=>Number(i.component_position_id)===positionId&&i.status==='installed');setEamOptions(previous,instances,i=>i.serial_number||`Instância #${i.id}`,'Selecione a instância instalada');toggleEamInstanceReplacement();}
function toggleEamInstanceReplacement(){const replacement=document.getElementById('eamInstanceAction')?.value==='replace',previous=document.getElementById('eamInstancePrevious');if(previous){previous.disabled=!replacement;previous.required=replacement;}}
async function submitEamComponentInstance(event){event.preventDefault();const positionId=Number(document.getElementById('eamInstancePosition').value),replacement=document.getElementById('eamInstanceAction').value==='replace',installedAt=document.getElementById('eamInstanceInstalledAt').value,data={serial_number:document.getElementById('eamInstanceSerial').value||undefined,manufacturer_part_number:document.getElementById('eamInstancePartNumber').value||undefined,installed_at:installedAt||undefined,reason:document.getElementById('eamInstanceReason').value||undefined};const result=replacement?await API.post(`/eam/component-positions/${positionId}/replace`,{...data,old_instance_id:Number(document.getElementById('eamInstancePrevious').value)}):await API.post(`/eam/component-positions/${positionId}/instances`,data);if(result.success){event.target.reset();toggleEamInstanceReplacement();showToast(replacement?'Componente substituído com histórico':'Componente instalado','success');await loadEamInstancePositions();}else showToast(result.error||'Não foi possível registrar a configuração','error');}
async function createEamRevision(event){event.preventDefault();const effective=document.getElementById('eamRevisionEffectiveFrom').value,result=await API.post(`/eam/assets/${Number(document.getElementById('eamRevisionAsset').value)}/revisions`,{revision_code:document.getElementById('eamRevisionCode').value,effective_from:effective||undefined,change_order:document.getElementById('eamRevisionChangeOrder').value||undefined});if(result.success){event.target.reset();showToast('Baseline criada como rascunho','success');}else showToast(result.error||'Não foi possível criar baseline','error');}
function readEamVisualFile(file){return new Promise((resolve,reject)=>{if(!file||file.size>8*1024*1024)return reject(Error('Selecione um arquivo de até 8 MiB'));const reader=new FileReader();reader.onerror=()=>reject(Error('Não foi possível ler o arquivo'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});}
async function createEamVisual(event){event.preventDefault();try{const file=document.getElementById('eamVisualFile').files[0],data=await readEamVisualFile(file),assetId=Number(document.getElementById('eamVisualAsset').value),moduleId=Number(document.getElementById('eamVisualModule')?.value),result=await API.post(`/eam/assets/${assetId}/visuals`,{type:document.getElementById('eamVisualType').value,title:document.getElementById('eamVisualTitle').value,filename:file.name,file_data:data,module_id:moduleId||null});if(result.success){event.target.reset();showToast('Visual técnico registrado','success');window.EamVisualWorkspace?.refresh(assetId);}else showToast(result.error||'Não foi possível registrar visual','error');}catch(error){showToast(error.message||'Arquivo inválido','error');}}
async function createEamDocument(event){event.preventDefault();try{const file=document.getElementById('eamDocumentFile').files[0],data=await readEamVisualFile(file),assetId=Number(document.getElementById('eamDocumentAsset').value),moduleId=Number(document.getElementById('eamDocumentModule')?.value),result=await API.post(`/eam/assets/${assetId}/documents`,{document_number:document.getElementById('eamDocumentNumber').value,title:document.getElementById('eamDocumentTitle').value,revision_code:document.getElementById('eamDocumentRevision').value,document_type:document.getElementById('eamDocumentType').value,filename:file.name,file_data:data,module_id:moduleId||null});if(result.success){event.target.reset();showToast('Documento técnico registrado','success');window.EamVisualWorkspace?.refresh(assetId);}else showToast(result.error||'Não foi possível registrar documento','error');}catch(error){showToast(error.message||'Arquivo inválido','error');}}
async function fetchEamAttachment(url){const token=localStorage.getItem('astha_token'),response=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!response.ok)throw Error('Arquivo não disponível');return response.blob();}
function downloadEamBlob(blob,filename){const link=document.createElement('a'),objectUrl=URL.createObjectURL(blob);link.href=objectUrl;link.download=filename||'arquivo';link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);}
async function loadEamDocuments(assetId){const target=document.getElementById('eamTechnicalDocuments');if(!target||!Number.isSafeInteger(assetId)||assetId<1)return;target.replaceChildren(eamTwinCard('Documentos técnicos','Carregando…'));const result=await API.get(`/eam/assets/${assetId}/documents`);if(!result.success){target.replaceChildren(eamTwinCard('Documentos técnicos',result.error||'Indisponíveis'));return;}const documents=Array.isArray(result.data)?result.data:[];target.replaceChildren(...(documents.length?documents.map(document=>{const card=eamTwinCard(document.document_number||'Documento',`${document.title||'—'} · ${document.revision_code||'sem revisão'} · ${document.status||'draft'}`),button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent='Baixar revisão';button.disabled=!document.revision_id;button.addEventListener('click',async()=>{try{const blob=await fetchEamAttachment(`${API.BASE_URL}/eam/documents/${Number(document.id)}/revisions/${Number(document.revision_id)}/data`);downloadEamBlob(blob,document.filename);}catch(error){showToast(error.message,'error');}});card.appendChild(button);return card;}):[eamTwinCard('Documentos técnicos','Nenhum documento cadastrado')]));}
async function openEamVisual(assetId,visual){const url=`${API.BASE_URL}/eam/assets/${assetId}/visuals/${Number(visual.id)}/data`,ext=(visual.filename||'').split('.').pop().toLowerCase();window.eamActiveVisual={assetId,visual};if(['stl','obj','gltf','glb','step','stp','iges','igs'].includes(ext)&&typeof open3DViewer==='function'){open3DViewer(url,ext,visual.title||visual.filename);return;}if(!['png','jpg','jpeg','webp'].includes(ext)){try{downloadEamBlob(await fetchEamAttachment(url),visual.filename);showToast('Download seguro iniciado','success');}catch(error){showToast(error.message,'error');}return;}const canvas=document.getElementById('eamVisualCanvas');if(!canvas)return;try{const blob=await fetchEamAttachment(url),objectUrl=URL.createObjectURL(blob),stage=document.createElement('div'),image=document.createElement('img'),hotspotResult=await API.get(`/eam/assets/${assetId}/visuals/${Number(visual.id)}/hotspots`),hotspots=hotspotResult.success&&Array.isArray(hotspotResult.data)?hotspotResult.data:[];canvas.replaceChildren();stage.style.cssText='position:relative;display:inline-block;max-width:100%;border:1px solid #d1d5db;background:#fff;cursor:crosshair';image.src=objectUrl;image.alt=visual.title||'Visual técnico';image.style.cssText='display:block;max-width:100%;max-height:560px;object-fit:contain';image.onload=()=>URL.revokeObjectURL(objectUrl);stage.addEventListener('click',event=>{if(event.target!==image)return;const rect=image.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));document.getElementById('eamHotspotAssetId').value=String(assetId);document.getElementById('eamHotspotVisualId').value=String(visual.id);document.getElementById('eamHotspotX').value=x.toFixed(4);document.getElementById('eamHotspotY').value=y.toFixed(4);showToast('Coordenada selecionada; informe o rótulo e salve o hotspot','info');});stage.appendChild(image);hotspots.forEach(hotspot=>{if(!Number.isFinite(Number(hotspot.x_normalized))||!Number.isFinite(Number(hotspot.y_normalized)))return;const marker=document.createElement('button');marker.type='button';marker.className='btn btn-primary btn-sm';marker.textContent=hotspot.callout_number||'•';marker.title=hotspot.label||'Hotspot';marker.style.cssText=`position:absolute;left:${Number(hotspot.x_normalized)*100}%;top:${Number(hotspot.y_normalized)*100}%;transform:translate(-50%,-50%);border-radius:999px;padding:2px 7px`;marker.addEventListener('click',event=>{event.stopPropagation();showToast(hotspot.label||'Hotspot sem descrição','info');});stage.appendChild(marker);});canvas.appendChild(stage);document.getElementById('eamHotspotAssetId').value=String(assetId);document.getElementById('eamHotspotVisualId').value=String(visual.id);}catch(error){canvas.replaceChildren(eamTwinCard('Visual técnico',error.message||'Não foi possível abrir o visual'));}}
async function createEamHotspot(event){event.preventDefault();const assetId=Number(document.getElementById('eamHotspotAssetId').value),visualId=Number(document.getElementById('eamHotspotVisualId').value),positionId=Number(document.getElementById('eamHotspotPosition')?.value),result=await API.post(`/eam/assets/${assetId}/visuals/${visualId}/hotspots`,{hotspot_type:'callout',label:document.getElementById('eamHotspotLabel').value,x_normalized:Number(document.getElementById('eamHotspotX').value),y_normalized:Number(document.getElementById('eamHotspotY').value),component_position_id:positionId||null});if(result.success){showToast('Hotspot salvo','success');event.target.reset();if(window.eamActiveVisual)openEamVisual(window.eamActiveVisual.assetId,window.eamActiveVisual.visual);window.EamVisualWorkspace?.refresh(assetId);}else showToast(result.error||'Não foi possível salvar o hotspot','error');}
async function createEamWorkOrder(event){event.preventDefault();const assetId=Number(document.getElementById('eamOrderAsset').value),title=document.getElementById('eamOrderTitle').value.trim();if(!Number.isSafeInteger(assetId)||assetId<1||!title){showToast('Selecione o ativo e informe o título da ordem','error');return;}const result=await API.post('/eam/work-orders',{asset_id:assetId,title,type:document.getElementById('eamOrderType').value,priority:'medium'});if(result.success){event.target.reset();toggleEamOrderForm(false);showToast('Ordem aberta','success');await renderEam();}else showToast(result.error||'Não foi possível abrir a ordem','error');}
async function createEamPlan(event){event.preventDefault();let extras;try{extras=window.eamPlanExtras?window.eamPlanExtras():{};}catch(error){showToast(error.message,'error');return;}const due=document.getElementById('eamPlanDue').value,assetId=Number(document.getElementById('eamPlanAsset').value),hours=document.getElementById('eamPlanHours').value,cycles=document.getElementById('eamPlanCycles').value,tasks=document.getElementById('eamPlanTasks').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean),result=await API.post('/eam/plans',{asset_id:assetId,title:document.getElementById('eamPlanTitle').value,interval_days:Number(document.getElementById('eamPlanInterval').value),next_due_at:due,interval_hours:hours===''?null:Number(hours),interval_cycles:cycles===''?null:Number(cycles),tasks,...extras});if(result.success){event.target.reset();if(window.eamPlanState){window.eamPlanState.assetId=String(assetId);window.eamPlanState.month=due.slice(0,7);window.eamPlanState.day=due;}toggleEamPlanForm(false);showToast('Plano preventivo criado','success');renderEam();}else{const feedback=document.getElementById('eamPlanFeedback');if(feedback)feedback.textContent=result.error||'Não foi possível criar o plano';showToast(result.error||'Não foi possível criar o plano','error');}}
async function loadEamCounter(){const id=Number(document.getElementById('eamCounterAsset').value),target=document.getElementById('eamCounterCurrent');if(!id){target.textContent='';return;}const result=await API.get(`/eam/assets/${id}/counters`);target.textContent=result.success?`Leitura atual: ${result.data.asset.operating_hours} h · ${result.data.asset.operating_cycles} ciclos`:result.error||'Leitura indisponível';}
async function saveEamCounter(event){event.preventDefault();const id=Number(document.getElementById('eamCounterAsset').value),hours=document.getElementById('eamCounterHours').value,cycles=document.getElementById('eamCounterCycles').value;if(hours===''&&cycles===''){showToast('Informe ao menos um contador','error');return;}const body={};if(hours!=='')body.operating_hours=Number(hours);if(cycles!=='')body.operating_cycles=Number(cycles);const result=await API.post(`/eam/assets/${id}/counters`,body);if(result.success){showToast(`Leitura registrada; ${result.data.generated?.length||0} ordem(ns) preventiva(s) gerada(s)`,'success');document.getElementById('eamCounterHours').value='';document.getElementById('eamCounterCycles').value='';loadEamCounter();renderEam();}else showToast(result.error||'Não foi possível registrar a leitura','error');}
function renderEamFunctionalLocations(rows,assets){
  window.eamFunctionalLocations=rows;
  const target=document.getElementById('eamLocationsTree'),parentSelect=document.getElementById('eamLocationParent');
  if(!target||!parentSelect)return;
  const current=parentSelect.value;
  parentSelect.replaceChildren(new Option('Localização principal',''),...rows.map(row=>new Option(`${row.location_code} — ${row.name}`,String(row.id))));
  parentSelect.value=current;
  const byParent=new Map(),known=new Set(rows.map(row=>Number(row.id)));
  rows.forEach(row=>{const id=Number(row.parent_location_id),parent=id&&known.has(id)?id:0;if(!byParent.has(parent))byParent.set(parent,[]);byParent.get(parent).push(row);});
  const seen=new Set();
  const append=(parent,depth)=>{
    for(const row of byParent.get(parent)||[]){
      const id=Number(row.id);if(seen.has(id))continue;seen.add(id);
      const item=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('span'),edit=document.createElement('button');
      item.className='eam-location-row';item.style.paddingLeft=`${Math.min(depth,8)*18+12}px`;
      name.textContent=`${row.location_code} · ${row.name}`;
      const count=assets.filter(asset=>Number(asset.functional_location_id)===id).length;
      meta.textContent=`${count} ativo(s) · ${row.status==='inactive'?'Inativa':'Ativa'} · CC ${row.cost_center||'—'} · CT ${row.work_center||'—'}`;
      edit.type='button';edit.className='btn btn-secondary btn-sm';edit.textContent='Editar';edit.addEventListener('click',()=>editEamFunctionalLocation(row));
      item.append(name,meta,edit);target.append(item);append(id,depth+1);
    }
  };
  target.replaceChildren();append(0,0);
  rows.filter(row=>!seen.has(Number(row.id))).forEach(row=>{byParent.set(0,[row]);append(0,0);});
  if(!rows.length){const empty=document.createElement('p');empty.textContent='Nenhuma localização funcional cadastrada.';target.append(empty);}
}
function editEamFunctionalLocation(row){
  document.getElementById('eamLocationEditId').value=String(row.id);
  const code=document.getElementById('eamLocationCode');code.value=row.location_code||'';code.readOnly=true;
  document.getElementById('eamLocationName').value=row.name||'';
  document.getElementById('eamLocationParent').value=row.parent_location_id?String(row.parent_location_id):'';
  document.getElementById('eamLocationCostCenter').value=row.cost_center||'';
  document.getElementById('eamLocationWorkCenter').value=row.work_center||'';
  document.getElementById('eamLocationStatus').value=row.status||'active';
  document.getElementById('eamLocationSave').textContent='Salvar localização';
  document.getElementById('eamLocationName').focus();
}
function resetEamFunctionalLocationForm(){
  const form=document.getElementById('eamLocationForm');form.reset();
  document.getElementById('eamLocationEditId').value='';
  document.getElementById('eamLocationCode').readOnly=false;
  document.getElementById('eamLocationSave').textContent='Cadastrar localização';
}
function openEamAssetEdit(asset){
  if(!asset?.id){showToast('Abra a ficha de um ativo para editar','info');return;}
  window.eamAssetBeingEdited=asset;
  const set=(id,value)=>{document.getElementById(id).value=value==null?'':String(value);};
  const options=(id,placeholder,rows,label)=>{const select=document.getElementById(id);select.replaceChildren(new Option(placeholder,''),...rows.map(row=>new Option(label(row),String(row.id))));};
  const assets=window.eamAssetsForWorkspace||[];
  options('eamEditParent','Ativo principal (sem pai)',assets.filter(row=>Number(row.id)!==Number(asset.id)),row=>`${row.asset_code} — ${row.name}`);
  options('eamEditLocation','Sem localização funcional',window.eamFunctionalLocations||[],row=>`${row.location_code} — ${row.name}`);
  options('eamEditEquipmentModel','Sem modelo técnico',window.eamEquipmentModelsForEdit||[],row=>`${row.model_code} — ${row.name}`);
  [['eamEditName',asset.name],['eamEditParent',asset.parent_asset_id],['eamEditLocation',asset.functional_location_id],['eamEditEquipmentModel',asset.equipment_model_id],['eamEditCriticality',asset.criticality||'medium'],['eamEditStatus',asset.status||'active'],['eamEditManufacturer',asset.manufacturer],['eamEditModel',asset.model],['eamEditSerial',asset.serial_number],['eamEditPhysicalLocation',asset.location],['eamEditDescription',asset.description]].forEach(([id,value])=>set(id,value));
  document.getElementById('eamEditFeedback').textContent='';
  const modal=document.getElementById('eamAssetEditModal');modal.classList.add('active');modal.setAttribute('aria-hidden','false');
  document.getElementById('eamEditName').focus();
}
function closeEamAssetEdit(){const modal=document.getElementById('eamAssetEditModal');modal.classList.remove('active');modal.setAttribute('aria-hidden','true');window.eamAssetBeingEdited=null;}
async function saveEamAssetEdit(event){
  event.preventDefault();const asset=window.eamAssetBeingEdited;if(!asset?.id)return;
  const value=id=>document.getElementById(id).value;
  const payload={name:value('eamEditName'),parent_asset_id:Number(value('eamEditParent'))||null,functional_location_id:Number(value('eamEditLocation'))||null,equipment_model_id:Number(value('eamEditEquipmentModel'))||null,criticality:value('eamEditCriticality'),status:value('eamEditStatus'),manufacturer:value('eamEditManufacturer'),model:value('eamEditModel'),serial_number:value('eamEditSerial'),location:value('eamEditPhysicalLocation'),description:value('eamEditDescription')};
  const save=document.getElementById('eamEditSave');save.disabled=true;
  const result=await API.request(`/eam/assets/${Number(asset.id)}`,{method:'PATCH',body:JSON.stringify(payload)});
  save.disabled=false;
  if(!result.success){document.getElementById('eamEditFeedback').textContent=result.error||'Não foi possível salvar o ativo';return;}
  closeEamAssetEdit();showToast('Ativo atualizado','success');
  await renderEam();const refreshed=(window.eamAssetsForWorkspace||[]).find(row=>Number(row.id)===Number(asset.id));
  if(refreshed)openEamAssetWorkspace(refreshed);
}
async function createEamFunctionalLocation(event){
  event.preventDefault();
  const id=Number(document.getElementById('eamLocationEditId').value),parent=Number(document.getElementById('eamLocationParent').value)||null;
  const payload={name:document.getElementById('eamLocationName').value,parent_location_id:parent,cost_center:document.getElementById('eamLocationCostCenter').value,work_center:document.getElementById('eamLocationWorkCenter').value,status:document.getElementById('eamLocationStatus').value};
  if(!id)payload.location_code=document.getElementById('eamLocationCode').value;
  const result=id?await API.request(`/eam/functional-locations/${id}`,{method:'PATCH',body:JSON.stringify(payload)}):await API.post('/eam/functional-locations',payload);
  if(result.success){resetEamFunctionalLocationForm();showToast(id?'Localização atualizada':'Localização cadastrada','success');renderEam();}
  else showToast(result.error||'Não foi possível salvar a localização','error');
}
async function addEamAssetSpare(event){event.preventDefault();const assetId=Number(document.getElementById('eamBomAsset').value),min=document.getElementById('eamBomMinimum').value,max=document.getElementById('eamBomMaximum').value,location=document.getElementById('eamBomFunctionalLocation').value;const result=await API.post(`/eam/assets/${assetId}/spares`,{material_id:Number(document.getElementById('eamBomMaterial').value),quantity:Number(document.getElementById('eamBomQuantity').value),minimum_quantity:min===''?null:Number(min),maximum_quantity:max===''?null:Number(max),functional_location_id:location?Number(location):null});if(result.success){event.target.reset();showToast('Peça incluída na BOM','success');window.EamVisualWorkspace?.refresh(assetId);}else showToast(result.error||'Não foi possível atualizar a BOM','error');}
async function createEamDowntime(event){event.preventDefault();const classification=document.getElementById('eamDowntimeFailureCode').value,result=await API.post(`/eam/work-orders/${Number(document.getElementById('eamDowntimeOrder').value)}/downtime`,{started_at:document.getElementById('eamDowntimeStart').value,ended_at:document.getElementById('eamDowntimeEnd').value,failure_symptom:document.getElementById('eamDowntimeSymptom').value,failure_mechanism:document.getElementById('eamDowntimeMechanism').value,failure_classification_id:classification?Number(classification):null});if(result.success){event.target.reset();showToast(`Downtime registrado: ${Number(result.data.downtime_hours).toFixed(2)} h`,'success');}else showToast(result.error||'Não foi possível registrar downtime','error');}
async function loadEamFailureCodes(){const result=await API.get('/eam/reliability/failure-codes'),list=document.getElementById('eamFailureCodes'),select=document.getElementById('eamDowntimeFailureCode');if(!result.success||!Array.isArray(result.data)){if(list)list.textContent=result.error||'Classificações indisponíveis';return;}const rows=result.data;if(select)select.replaceChildren(new Option('Sem classificação',''),...rows.filter(row=>row.is_active).map(row=>new Option(`${row.category} · ${row.code} — ${row.name}`,String(row.id))));if(list){list.replaceChildren();for(const row of rows){const item=document.createElement('div');item.className='eo-component-card';const name=document.createElement('span');name.textContent=`${row.category} · ${row.code} — ${row.name} · ${row.is_active?'Ativa':'Inativa'}`;const button=document.createElement('button');button.className='btn btn-secondary btn-sm';button.type='button';button.textContent=row.is_active?'Desativar':'Ativar';button.addEventListener('click',()=>setEamFailureCodeActive(row.id,!row.is_active));item.append(name,button);list.appendChild(item);}if(!rows.length)list.textContent='Nenhuma classificação cadastrada.';}}
async function createEamFailureCode(event){event.preventDefault();const result=await API.post('/eam/reliability/failure-codes',{code:document.getElementById('eamFailureCode').value,name:document.getElementById('eamFailureName').value,category:document.getElementById('eamFailureCategory').value});if(result.success){event.target.reset();showToast('Classificação cadastrada','success');loadEamFailureCodes();}else showToast(result.error||'Não foi possível cadastrar classificação','error');}
async function setEamFailureCodeActive(id,active){const result=await API.request(`/eam/reliability/failure-codes/${Number(id)}`,{method:'PATCH',body:JSON.stringify({is_active:active})});if(result.success)loadEamFailureCodes();else showToast(result.error||'Não foi possível alterar a classificação','error');}
async function createEamSource(event){event.preventDefault();const lead=document.getElementById('eamSourceLeadTime').value,result=await API.post('/procurement/sources',{material_id:Number(document.getElementById('eamSourceMaterial').value),supplier_id:Number(document.getElementById('eamSourceSupplier').value),unit_price:Number(document.getElementById('eamSourcePrice').value),currency:'BRL',lead_time_days:lead?Number(lead):undefined});if(result.success){event.target.reset();showToast('Fonte aprovada','success');renderEam();}else showToast(result.error||'Não foi possível aprovar a fonte','error');}
async function createEamSupplier(event){event.preventDefault();const result=await API.post('/procurement/suppliers',{name:document.getElementById('eamSupplierName').value,cnpj:document.getElementById('eamSupplierCnpj').value||undefined,contact_email:document.getElementById('eamSupplierEmail').value||undefined});if(result.success){event.target.reset();showToast('Fornecedor cadastrado','success');renderEam();}else showToast(result.error||'Não foi possível cadastrar fornecedor','error');}
async function loadEamMrp(){
  const target=document.getElementById('eamMrpResults');if(!target)return;
  const until=document.getElementById('eamMrpUntil')?.value||'';
  target.textContent='Calculando necessidades futuras…';
  const result=await API.get(`/procurement/planning/mrp${until?`?until=${encodeURIComponent(until)}`:''}`);
  if(!result.success){target.textContent=result.error||'Não foi possível calcular MRP';return;}
  const data=result.data||{},rows=Array.isArray(data.rows)?data.rows:[];
  const untilInput=document.getElementById('eamMrpUntil');if(untilInput){untilInput.min=data.today||'';if(!untilInput.value)untilInput.value=data.until||'';}
  const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');table.className='eo-table';
  head.innerHTML='<tr><th>Material</th><th>Saldo disponível</th><th>Necessidade em</th><th>Comprar até</th><th>Sugestão</th><th>Projeção</th></tr>';
  rows.forEach(row=>{const tr=document.createElement('tr'),cells=[`${row.code} · ${row.description}`,`${row.available_quantity} ${row.base_unit}`,row.shortage_date||'Sem ruptura',row.order_by||'—',row.shortage_date?`${row.suggested_purchase_quantity} ${row.purchase_unit} (${row.suggested_base_quantity} ${row.base_unit})${row.exceeds_bom_maximum?' · revisar máximo da BOM':''}`:'—'];cells.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});const detail=document.createElement('td'),disclosure=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');summary.textContent='Ver datas';(row.timeline||[]).forEach(event=>{const line=document.createElement('p');line.textContent=`${event.date} · ${event.type} · ${event.priority||''} · saldo ${event.projected_quantity} ${row.base_unit} · sem cobertura ${event.uncovered_quantity||0}`;list.append(line);});disclosure.append(summary,list);detail.append(disclosure);tr.append(detail);body.append(tr);});
  table.append(head,body);target.replaceChildren(table);
  if(!rows.length){const empty=document.createElement('p');empty.textContent='Nenhuma demanda ou necessidade de reposição no período.';target.append(empty);}
}
async function loadEamForecasts(){
  const target=document.getElementById('eamForecastRows');if(!target)return;
  const result=await API.get('/procurement/planning/forecasts');
  if(!result.success){target.textContent=result.error||'Não foi possível carregar demandas';return;}
  target.replaceChildren();for(const forecast of result.data||[]){const row=document.createElement('div'),label=document.createElement('span');row.className='eam-location-row';label.textContent=`${forecast.forecast_date} · ${forecast.code} · ${forecast.quantity} · ${forecast.source} · ${forecast.priority||'medium'}`;row.append(label);if(forecast.source==='manual'){const remove=document.createElement('button');remove.type='button';remove.className='btn btn-secondary btn-sm';remove.textContent='Remover';remove.addEventListener('click',async()=>{const deleted=await API.delete(`/procurement/planning/forecasts/${Number(forecast.id)}`);if(deleted.success){loadEamForecasts();loadEamMrp();}else showToast(deleted.error||'Não foi possível remover demanda','error');});row.append(remove);}target.append(row);}
  if(!target.children.length)target.textContent='Nenhuma demanda manual cadastrada.';
}
async function createEamForecast(event){event.preventDefault();const result=await API.post('/procurement/planning/forecasts',{material_id:Number(document.getElementById('eamForecastMaterial').value),forecast_date:document.getElementById('eamForecastDate').value,quantity:Number(document.getElementById('eamForecastQuantity').value),priority:document.getElementById('eamForecastPriority').value});if(result.success){event.target.reset();showToast('Demanda futura salva','success');loadEamForecasts();loadEamMrp();}else showToast(result.error||'Não foi possível salvar demanda','error');}
async function saveEamPurchaseUnit(event){event.preventDefault();const materialId=Number(document.getElementById('eamUnitMaterial').value),result=await API.post(`/procurement/materials/${materialId}/units`,{purchase_unit:document.getElementById('eamPurchaseUnit').value,factor:Number(document.getElementById('eamPurchaseFactor').value)});if(result.success){showToast('Conversão de unidade salva','success');loadEamMrp();}else showToast(result.error||'Não foi possível salvar conversão','error');}
function addEamRfqLine(){
  const container=document.getElementById('eamRfqLines');if(!container||container.children.length>=50)return;
  const row=document.createElement('div'),material=document.createElement('select'),quantity=document.createElement('input'),date=document.createElement('input'),remove=document.createElement('button');row.className='eo-form-grid eam-rfq-line';
  material.className='eo-input';material.required=true;material.setAttribute('aria-label','Material da RFQ');material.append(new Option('Selecione o material',''),...(window.eamMaterialsForProcurement||[]).map(item=>new Option(`${item.code} — ${item.description}`,String(item.id))));
  quantity.className='eo-input';quantity.type='number';quantity.min='.001';quantity.max='1000000';quantity.step='.001';quantity.required=true;quantity.placeholder='Quantidade';quantity.setAttribute('aria-label','Quantidade solicitada');
  date.className='eo-input';date.type='date';date.setAttribute('aria-label','Data necessária');
  remove.type='button';remove.className='btn btn-secondary btn-sm';remove.textContent='Remover item';remove.addEventListener('click',()=>{if(container.children.length>1)row.remove();});
  row.append(material,quantity,date,remove);container.append(row);
}
async function loadEamProcurementAdvanced(){
  const [qualifications,rfqs,quotas]=await Promise.all([API.get('/procurement/qualifications'),API.get('/procurement/rfqs'),API.get('/procurement/quotas')]);
  const qualificationTarget=document.getElementById('eamQualificationsList');if(qualificationTarget){qualificationTarget.replaceChildren();if(qualifications.success)for(const item of qualifications.data||[]){const row=document.createElement('div');row.className='eam-location-row';row.textContent=`${item.supplier_name} · ${item.category} · ${item.status} · nota ${item.score??'—'} · validade ${item.expires_at?String(item.expires_at).slice(0,10):'sem prazo'}`;const evidence=document.createElement('button');evidence.type='button';evidence.className='btn btn-secondary btn-sm';evidence.textContent='Evidências';evidence.onclick=()=>openQualificationEvidence(item.id);row.append(evidence);qualificationTarget.append(row);}else qualificationTarget.textContent=qualifications.error||'Não foi possível carregar qualificações';}
  const rfqTarget=document.getElementById('eamRfqsList');if(rfqTarget){rfqTarget.replaceChildren();if(rfqs.success)for(const item of rfqs.data||[]){const row=document.createElement('div'),label=document.createElement('span');row.className='eam-location-row';label.textContent=`${item.rfq_number} · ${item.title} · ${item.status} · ${item.line_count} item(ns) · ${item.bid_count} proposta(s)`;row.append(label);const open=document.createElement('button');open.type='button';open.className='btn btn-secondary btn-sm';open.textContent='Abrir';open.addEventListener('click',()=>openEamRfq(item.id));row.append(open);const next=item.status==='draft'?'published':item.status==='published'?'closed':null;if(next){const update=document.createElement('button');update.type='button';update.className='btn btn-secondary btn-sm';update.textContent=next==='published'?'Publicar':'Fechar';update.addEventListener('click',()=>updateEamRfqStatus(item.id,next));row.append(update);}rfqTarget.append(row);}else rfqTarget.textContent=rfqs.error||'Não foi possível carregar RFQs';}
  const quotaTarget=document.getElementById('eamQuotasList');if(quotaTarget){quotaTarget.replaceChildren();if(quotas.success)for(const item of quotas.data||[]){const row=document.createElement('div');row.className='eam-location-row';row.textContent=`${item.code} · ${item.supplier_name} · ${item.quota_percent}%`;quotaTarget.append(row);}else quotaTarget.textContent=quotas.error||'Não foi possível carregar quotas';}
}
async function saveEamSupplierQualification(event){event.preventDefault();const score=document.getElementById('eamQualificationScore').value,expiry=document.getElementById('eamQualificationExpiry').value,result=await API.post('/procurement/qualifications',{supplier_id:Number(document.getElementById('eamQualificationSupplier').value),category:'MRO',status:document.getElementById('eamQualificationStatus').value,score:score===''?undefined:Number(score),expires_at:expiry||null,evidence_note:document.getElementById('eamQualificationEvidence').value});if(result.success){event.target.reset();showToast('Qualificação salva','success');loadEamProcurementAdvanced();}else showToast(result.error||'Não foi possível salvar qualificação','error');}
async function createEamRfq(event){event.preventDefault();const lines=[...document.querySelectorAll('#eamRfqLines .eam-rfq-line')].map(row=>({material_id:Number(row.querySelector('select').value),quantity:Number(row.querySelector('input[type=number]').value),required_at:row.querySelector('input[type=date]').value||null}));const result=await API.post('/procurement/rfqs',{title:document.getElementById('eamRfqTitle').value,closes_at:document.getElementById('eamRfqCloses').value||null,lines});if(result.success){event.target.reset();document.getElementById('eamRfqLines').replaceChildren();addEamRfqLine();showToast(`RFQ ${result.data.rfq_number} criada`,'success');loadEamProcurementAdvanced();openEamRfq(result.data.id);}else showToast(result.error||'Não foi possível criar RFQ','error');}
async function updateEamRfqStatus(id,status){const result=await API.request(`/procurement/rfqs/${Number(id)}/status`,{method:'PATCH',body:JSON.stringify({status})});if(result.success){showToast('RFQ atualizada','success');loadEamProcurementAdvanced();openEamRfq(id);}else showToast(result.error||'Não foi possível atualizar RFQ','error');}
async function openEamRfq(id){
  const target=document.getElementById('eamRfqDetail'),form=document.getElementById('eamRfqBidForm');target.textContent='Carregando cotação…';const [result,requisitions]=await Promise.all([API.get(`/procurement/rfqs/${Number(id)}`),API.get('/eam/purchase-requisitions')]);if(!result.success){target.textContent=result.error||'RFQ indisponível';form.hidden=true;return;}
  const data=result.data;window.eamActiveRfqId=Number(id);target.replaceChildren();const heading=document.createElement('h4');heading.textContent=`${data.rfq.rfq_number} · ${data.rfq.title} · ${data.rfq.status}`;target.append(heading);
  const lineSelect=document.getElementById('eamRfqBidLine');lineSelect.replaceChildren(new Option('Selecione o item',''),...(data.lines||[]).map(line=>new Option(`${line.code} · ${line.quantity}`,String(line.id))));form.hidden=data.rfq.status!=='published';
  for(const line of data.lines||[]){const group=document.createElement('div'),title=document.createElement('strong');group.className='eam-rfq-detail-line';title.textContent=`${line.code} · ${line.description} · quantidade ${line.quantity}`;group.append(title);for(const bid of (data.bids||[]).filter(item=>Number(item.rfq_line_id)===Number(line.id))){const row=document.createElement('div'),label=document.createElement('span');row.className='eam-location-row';label.textContent=`${bid.supplier_name} · ${formatBRL(bid.unit_price)} · prazo ${bid.lead_time_days??'—'} dias · ${bid.status}`;row.append(label);if(data.rfq.status==='closed'&&bid.status==='submitted'){const approved=(requisitions.success?requisitions.data:[]).filter(item=>item.status==='approved'&&Number(item.material_id)===Number(line.material_id));const select=document.createElement('select');select.className='eo-input';select.setAttribute('aria-label',`Requisição aprovada para ${line.code}`);select.append(new Option('Somente adjudicar fonte',''),...approved.map(item=>new Option(`Requisição #${item.id} · ${item.requested_quantity} unidades`,String(item.id))));row.append(select);const award=document.createElement('button');award.type='button';award.className='btn btn-primary btn-sm';award.textContent='Adjudicar';award.addEventListener('click',()=>chooseEamRfqUnit(id,bid.id,select.value,line.material_id));row.append(award);}group.append(row);}target.append(group);}
}
async function submitEamRfqBid(event){event.preventDefault();const id=window.eamActiveRfqId,lead=document.getElementById('eamRfqBidLead').value,result=await API.post(`/procurement/rfqs/${Number(id)}/bids`,{rfq_line_id:Number(document.getElementById('eamRfqBidLine').value),supplier_id:Number(document.getElementById('eamRfqBidSupplier').value),unit_price:Number(document.getElementById('eamRfqBidPrice').value),lead_time_days:lead===''?null:Number(lead),currency:'BRL'});if(result.success){event.target.reset();showToast('Proposta registrada','success');openEamRfq(id);loadEamProcurementAdvanced();}else showToast(result.error||'Não foi possível registrar proposta','error');}
async function awardEamRfqBid(id,bidId,requisitionId,purchaseUnit){const result=await API.post(`/procurement/rfqs/${Number(id)}/award`,{bid_id:Number(bidId),requisition_id:requisitionId?Number(requisitionId):undefined,purchase_unit:purchaseUnit});if(result.success){showToast(result.data.purchase_order?`Pedido ${result.data.purchase_order.po_number} gerado da cotação`:'Proposta adjudicada e fonte atualizada','success');openEamRfq(id);loadEamProcurementAdvanced();renderEam();}else showToast(result.error||'Não foi possível adjudicar','error');}
async function saveEamSourceQuota(event){event.preventDefault();const result=await API.post('/procurement/quotas',{material_id:Number(document.getElementById('eamQuotaMaterial').value),supplier_id:Number(document.getElementById('eamQuotaSupplier').value),quota_percent:Number(document.getElementById('eamQuotaPercent').value)});if(result.success){showToast('Quota salva','success');loadEamProcurementAdvanced();}else showToast(result.error||'Não foi possível salvar quota','error');}
async function updateEamRequisition(id,status){const result=await API.request(`/eam/purchase-requisitions/${Number(id)}/status`,{method:'PATCH',body:JSON.stringify({status})});if(result.success){showToast(status==='approved'?'Requisição aprovada':'Requisição cancelada','success');renderEam();}else showToast(result.error||'Não foi possível atualizar requisição','error');}
async function createEamPurchaseOrder(event){event.preventDefault();const expected=document.getElementById('eamPurchaseExpectedAt').value,result=await API.post(`/eam/purchase-requisitions/${Number(document.getElementById('eamPurchaseReq').value)}/purchase-orders`,{supplier_id:Number(document.getElementById('eamPurchaseSupplier').value),unit_price:Number(document.getElementById('eamPurchasePrice').value),purchase_unit:document.getElementById('eamPurchaseOrderUnit').value.trim().toUpperCase()||undefined,expected_at:expected||undefined});if(result.success){event.target.reset();document.getElementById('eamPurchaseOrderCreatePanel').open=false;showToast(`Pedido ${result.data.po_number} gerado`,'success');await renderEam();}else showToast(result.error||'Não foi possível gerar pedido','error');}
async function receiveEamPurchaseOrder(event){event.preventDefault();const result=await API.post(`/eam/purchase-orders/${Number(document.getElementById('eamReceiptOrder').value)}/receive`,{quantity:Number(document.getElementById('eamReceiptQuantity').value),unit:document.getElementById('eamReceiptUnit').value});if(result.success){event.target.reset();showToast('Recebimento registrado','success');renderEam();}else showToast(result.error||'Não foi possível registrar recebimento','error');}
function toggleEamMaterialQuantity(){const action=document.getElementById('eamMaterialAction').value,input=document.getElementById('eamMaterialQty'),needed=action!=='cancel-reservation';input.required=needed;input.disabled=!needed;if(!needed)input.value='';}
async function submitEamMaterial(event){event.preventDefault();const orderId=Number(document.getElementById('eamMaterialOrder').value),materialId=Number(document.getElementById('eamMaterialId').value),quantity=Number(document.getElementById('eamMaterialQty').value),action=document.getElementById('eamMaterialAction').value;const result=action==='cancel-reservation'?await API.request(`/eam/work-orders/${orderId}/reservations/${materialId}`,{method:'DELETE'}):await API.post(`/eam/work-orders/${orderId}/${action}`,{material_id:materialId,quantity});if(result.success){event.target.reset();toggleEamMaterialQuantity();showToast(action==='material-requests'?'Solicitação enviada para aprovação':action==='reservations'?'Peça reservada':action==='cancel-reservation'?'Reserva cancelada':'Peça consumida','success');loadEamMaterialRequests(orderId);renderEam();}else showToast(result.error||'Operação não concluída','error');}
async function loadEamMaterialRequests(orderId){const target=document.getElementById('eamMaterialRequests');if(!target)return;const result=await API.get(`/eam/work-orders/${Number(orderId)}/material-requests`);if(!result.success){target.textContent=result.error||'Não foi possível carregar as solicitações';return;}target.replaceChildren();for(const item of result.data||[]){const card=document.createElement('div');card.className='eo-component-card';const title=document.createElement('strong');title.textContent=`${item.code} — ${item.description}`;const detail=document.createElement('p');detail.textContent=`Solicitado: ${item.requested_quantity} · Consumido: ${item.issued_quantity} · Status: ${item.status}`;card.append(title,detail);if(item.status==='draft'){for(const [status,label] of [['approved','Aprovar'],['rejected','Rejeitar']]){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent=label;button.addEventListener('click',()=>decideEamMaterialRequest(orderId,item.material_id,status));card.appendChild(button);}}target.appendChild(card);}if(!target.children.length)target.textContent='Nenhuma peça solicitada nesta ordem.';}
async function decideEamMaterialRequest(orderId,materialId,status){const result=await API.request(`/eam/work-orders/${Number(orderId)}/material-requests/${Number(materialId)}`,{method:'PATCH',body:JSON.stringify({status})});if(result.success){showToast(status==='approved'?'Peça aprovada':'Peça rejeitada','success');loadEamMaterialRequests(orderId);}else showToast(result.error||'Não foi possível decidir a solicitação','error');}
async function createEamLabor(event){event.preventDefault();const result=await API.post(`/eam/work-orders/${Number(document.getElementById('eamLaborOrder').value)}/labor`,{hours:Number(document.getElementById('eamLaborHours').value),hourly_rate:Number(document.getElementById('eamLaborRate').value)});if(result.success){event.target.reset();showToast(`Mão de obra apontada: ${formatBRL(result.data.labor_cost)}`,'success');}else showToast(result.error||'Não foi possível apontar mão de obra','error');}
async function createEamTask(event){event.preventDefault();const orderId=Number(document.getElementById('eamTaskOrder').value),result=await API.post(`/eam/work-orders/${orderId}/tasks`,{title:document.getElementById('eamTaskTitle').value});if(result.success){event.target.reset();showToast('Tarefa adicionada','success');}else showToast(result.error||'Não foi possível adicionar a tarefa','error');}
async function loadEamOrderHistory(){const orderId=Number(document.getElementById('eamHistoryOrder').value),target=document.getElementById('eamOrderHistory');if(!Number.isSafeInteger(orderId)||orderId<1){showToast('Selecione uma ordem','error');return;}const [tasks,audit]=await Promise.all([API.get(`/eam/work-orders/${orderId}/tasks`),API.get(`/eam/work-orders/${orderId}/audit`)]);if(!tasks.success||!audit.success){showToast(tasks.error||audit.error||'Não foi possível carregar o histórico','error');return;}const taskItems=tasks.data.map(t=>`<li><button class="btn btn-secondary btn-sm" type="button" onclick="toggleEamTask(${orderId},${Number(t.id)},${t.is_completed?false:true})">${t.is_completed?'Reabrir':'Concluir'}</button> ${Security.escapeHTML(t.title)}</li>`).join('')||'<li>Nenhuma tarefa</li>';const auditItems=audit.data.map(a=>`<li>${Security.escapeHTML(a.action)} · ${Security.escapeHTML(a.detail||'—')} · ${Security.escapeHTML(a.created_at)}</li>`).join('')||'<li>Sem eventos</li>';target.innerHTML=`<div class="eo-component-card"><strong>Tarefas</strong><ul>${taskItems}</ul></div><div class="eo-component-card"><strong>Histórico</strong><ul>${auditItems}</ul></div>`;}
async function toggleEamTask(orderId,taskId,isCompleted){const result=await API.request(`/eam/work-orders/${Number(orderId)}/tasks/${Number(taskId)}`,{method:'PATCH',body:JSON.stringify({is_completed:isCompleted})});if(result.success){showToast('Tarefa atualizada','success');loadEamOrderHistory();}else showToast(result.error||'Não foi possível atualizar a tarefa','error');}
async function loadEamCondition(){
  const assetId=Number(document.getElementById('eamConditionAsset').value),target=document.getElementById('eamConditionResult');
  target.replaceChildren();if(!assetId){target.textContent='Selecione um ativo para consultar condições.';return;}
  const result=await API.get(`/eam/assets/${assetId}/condition`);if(Number(document.getElementById('eamConditionAsset').value)!==assetId)return;if(!result.success){target.textContent=result.error||'Monitoramento indisponível';return;}
  const number=value=>value===null||value===undefined?'—':Number.isFinite(Number(value))?Number(value).toLocaleString('pt-BR',{maximumFractionDigits:6}):'—';
  const displayLabel=value=>({temperature:'Temperatura',vibration:'Vibração',pressure:'Pressão',warning:'Aviso',critical:'Crítico',open:'Aberto',acknowledged:'Reconhecido',closed:'Encerrado',inspection:'Inspeção',manual:'Manual',sensor:'Sensor'}[value]||String(value||''));
  const section=(title,items,render,collapsed=false)=>{const card=document.createElement(collapsed?'details':'section'),heading=document.createElement(collapsed?'summary':'h4');card.className='eo-component-card';heading.textContent=title+(collapsed?' · '+items.length+' registros':'');card.append(heading);if(!items.length){const empty=document.createElement('p');empty.textContent='Nenhum registro.';card.append(empty);}for(const item of items)card.append(render(item));target.append(card);};
  section('Limites cadastrados',result.data.rules||[],rule=>{const row=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button');row.className='eam-location-row';label.textContent=`${displayLabel(rule.metric_code)}: ${number(rule.minimum_value)} a ${number(rule.maximum_value)} ${rule.unit||''} · ${displayLabel(rule.severity)} · ${rule.is_active?'ativo':'inativo'}`;button.type='button';button.className='btn btn-secondary btn-sm';button.textContent=rule.is_active?'Desativar':'Ativar';button.addEventListener('click',()=>updateEamConditionRule(assetId,rule.id,!rule.is_active));row.append(label,button);return row;});
  section('Alertas',result.data.alerts||[],alert=>{const row=document.createElement('div'),label=document.createElement('span');row.className='eam-location-row';label.textContent=`${displayLabel(alert.metric_code)}: ${number(alert.value)} ${alert.unit||''} · ${displayLabel(alert.severity)} · ${displayLabel(alert.status)}${alert.work_order_id?` · OS #${alert.work_order_id}`:''}`;row.append(label);if(alert.status!=='closed'){const button=document.createElement('button');button.type='button';button.className='btn btn-secondary btn-sm';button.textContent=alert.status==='open'?'Reconhecer':'Encerrar';button.addEventListener('click',()=>updateEamConditionAlert(assetId,alert.id,alert.status==='open'?'acknowledged':'closed'));row.append(button);if(!alert.work_order_id){const order=document.createElement('button');order.type='button';order.className='btn btn-secondary btn-sm';order.textContent='Criar O.S.';order.addEventListener('click',()=>createEamConditionWorkOrder(assetId,alert.id));row.append(order);}}return row;});
  section('Últimas leituras',(result.data.readings||[]).slice(0,20),reading=>{const row=document.createElement('p');row.textContent=`${String(reading.recorded_at).slice(0,19).replace('T',' ')} · ${displayLabel(reading.metric_code)}: ${number(reading.value)} ${reading.unit||''} · ${displayLabel(reading.source)}`;return row;},true);
}
async function createEamConditionRule(event){event.preventDefault();const assetId=Number(document.getElementById('eamConditionAsset').value);if(!assetId){showToast('Selecione um ativo','error');return;}const min=document.getElementById('eamConditionMin').value,max=document.getElementById('eamConditionMax').value,result=await API.post(`/eam/assets/${assetId}/condition/rules`,{metric_code:document.getElementById('eamConditionMetric').value,unit:document.getElementById('eamConditionUnit').value,minimum_value:min===''?null:Number(min),maximum_value:max===''?null:Number(max),severity:document.getElementById('eamConditionSeverity').value});if(result.success){event.target.reset();showToast('Limite cadastrado','success');loadEamCondition();}else showToast(result.error||'Não foi possível criar limite','error');}
async function saveEamConditionReading(event){event.preventDefault();const assetId=Number(document.getElementById('eamConditionAsset').value);if(!assetId){showToast('Selecione um ativo','error');return;}const result=await API.post(`/eam/assets/${assetId}/condition/readings`,{metric_code:document.getElementById('eamReadingMetric').value,value:Number(document.getElementById('eamReadingValue').value),unit:document.getElementById('eamReadingUnit').value,source:document.getElementById('eamReadingSource').value});if(result.success){event.target.reset();showToast(result.data.alert_ids.length?`${result.data.alert_ids.length} alerta(s) gerado(s)`:'Leitura registrada','success');loadEamCondition();}else showToast(result.error||'Não foi possível registrar leitura','error');}
async function updateEamConditionRule(assetId,ruleId,active){const result=await API.request(`/eam/assets/${assetId}/condition/rules/${ruleId}`,{method:'PATCH',body:JSON.stringify({is_active:active})});if(result.success)loadEamCondition();else showToast(result.error||'Não foi possível atualizar limite','error');}
async function updateEamConditionAlert(assetId,alertId,status){const result=await API.request(`/eam/assets/${assetId}/condition/alerts/${alertId}`,{method:'PATCH',body:JSON.stringify({status})});if(result.success)loadEamCondition();else showToast(result.error||'Não foi possível atualizar alerta','error');}
async function createEamConditionWorkOrder(assetId,alertId){const result=await API.post(`/eam/assets/${assetId}/condition/alerts/${alertId}/work-order`,{});if(result.success){showToast(`${result.data.work_order_number} criada`,'success');await renderEam();document.getElementById('eamConditionAsset').value=String(assetId);loadEamCondition();}else showToast(result.error||'Não foi possível criar ordem','error');}
async function loadEamReliability(event){event.preventDefault();const assetId=Number(document.getElementById('eamReliabilityAsset').value),from=document.getElementById('eamReliabilityFrom').value,to=document.getElementById('eamReliabilityTo').value,result=await API.get(`/eam/reliability/assets/${assetId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),target=document.getElementById('eamReliabilityResult');if(!result.success){showToast(result.error||'Não foi possível calcular os indicadores','error');return;}const d=result.data;target.innerHTML=[['Ordens corretivas',d.corrective_orders],['Downtime',`${Number(d.downtime_hours).toFixed(2)} h`],['Disponibilidade',d.availability===null?'—':`${(d.availability*100).toFixed(2)}%`],['MTBF',d.mtbf_hours===null?'Sem exposição qualificada':`${d.mtbf_hours.toFixed(2)} h`],['MTTR',d.mttr_hours===null?'—':`${d.mttr_hours.toFixed(2)} h`],['MTWS',d.mtws_hours===null?'Sem esperas concluídas':`${d.mtws_hours.toFixed(2)} h (${d.completed_material_waits} compras)`],['TCO',formatBRL(d.tco)]].map(([label,value])=>`<div class="eo-component-card"><strong>${Security.escapeHTML(label)}</strong><span>${Security.escapeHTML(value)}</span></div>`).join('');}
async function loadEamReliabilitySummary(){const from=document.getElementById('eamReliabilityFrom').value,to=document.getElementById('eamReliabilityTo').value,target=document.getElementById('eamReliabilitySummary');if(!from||!to){target.textContent='Escolha o período acima.';return;}const result=await API.get(`/eam/reliability/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);if(!result.success){target.textContent=result.error||'Relatório indisponível';return;}const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');table.className='eo-table';const header=document.createElement('tr');['Ativo','Ordens corretivas','Paradas (h)','Disponibilidade no calendário','MTBF (h)','Perda estimada'].forEach(label=>{const cell=document.createElement('th');cell.textContent=label;header.appendChild(cell);});head.appendChild(header);for(const row of result.data.assets||[]){const tr=document.createElement('tr');[`${row.asset_code} — ${row.name}`,row.corrective_orders,Number(row.downtime_hours).toFixed(2),row.calendar_availability==null?'—':`${(Number(row.calendar_availability)*100).toFixed(2)}%`,row.mtbf_hours===null?'—':Number(row.mtbf_hours).toFixed(2),formatBRL(row.production_loss_cost)].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;tr.appendChild(cell);});body.appendChild(tr);}table.append(head,body);target.replaceChildren(table);if(!body.children.length)target.textContent='Nenhum ativo no período.';}
async function updateEamOrderStatus(id,status){const result=await API.request(`/eam/work-orders/${Number(id)}/status`,{method:'PATCH',body:JSON.stringify({status})});if(result.success){showToast('Status atualizado','success');renderEam();}else showToast(result.error||'Não foi possível atualizar o status','error');}
async function releaseEamOrder(id){const result=await API.post(`/eam/work-orders/${Number(id)}/release`,{});if(result.success){showToast('Ordem liberada com registro de responsável','success');renderEam();}else showToast(result.error||'Não foi possível liberar a ordem','error');}
async function financialCloseEamOrder(id){const result=await API.post(`/eam/work-orders/${Number(id)}/financial-close`,{});if(result.success){showToast('Ordem fechada financeiramente','success');renderEam();}else showToast(result.error||'Não foi possível fechar financeiramente','error');}

function renderDashboard(){
  if(window.wmsStockView){window.wmsStockView.refresh();return;}
  const total=materials.length,critical=materials.filter(m=>m.qty>0&&m.qty<=m.min).length,zero=materials.filter(m=>m.qty===0).length;
  let totalQty=0,totalValue=0;
  materials.forEach(m=>{ totalQty+=m.qty; totalValue+=(m.qty*m.price); });
  document.getElementById('statTotal').textContent=total;
  document.getElementById('statCritical').textContent=critical;
  document.getElementById('statZero').textContent=zero;
  const sq=document.getElementById('statTotalQty'); if(sq) sq.textContent=totalQty.toLocaleString('pt-BR',{maximumFractionDigits:3});
  const sv=document.getElementById('statTotalValue'); if(sv) sv.textContent=formatBRL(totalValue);
  drawDonut(total-critical-zero,critical,zero);
  const tbody=document.getElementById('criticalTableBody');
  const attention=materials.filter(m=>Number(m.qty)<=Number(m.min)).sort((a,b)=>{
    const priority=item=>Number(item.qty)<=0?0:1;
    return priority(a)-priority(b)||(Number(a.qty)/Math.max(Number(a.min)||0,1))-(Number(b.qty)/Math.max(Number(b.min)||0,1));
  });
  tbody.innerHTML=attention.length?attention.map(m=>{const s=getStatus(m);return`<tr><td><span class="eo-status ${s.cls}">${s.text}</span></td><td><span class="material-code">${Security.escapeHTML(m.code)}</span></td><td>${Security.escapeHTML(m.desc)}</td><td>${Security.escapeHTML(Number(m.qty).toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td><td><span class="badge">${Security.escapeHTML(m.location||'Não localizado')}</span></td></tr>`}).join(''):'<tr><td colspan="5" class="dashboard-critical-empty">Nenhum item crítico ou abaixo do mínimo.</td></tr>';
}

function drawDonut(h,c,z){
  const canvas=document.getElementById('donutChart');if(!canvas)return;
  const ctx=canvas.getContext('2d'),tot=h+c+z,cx=canvas.width/2,cy=canvas.height/2,r=100,inner=60;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  let start=-Math.PI/2;
  if (!tot) { ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.arc(cx,cy,inner,0,Math.PI*2,true);ctx.closePath();ctx.fillStyle='#e2e8f0';ctx.fill(); }
  [{value:h,color:'#00FF88'},{value:c,color:'#FFB830'},{value:z,color:'#FF4757'}].filter(s=>s.value>0).forEach(s=>{
    const sweep=(s.value/tot)*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+sweep);ctx.arc(cx,cy,inner,start+sweep,start,true);ctx.closePath();ctx.fillStyle=s.color;ctx.fill();start+=sweep;
  });
  ctx.fillStyle='#0f172a';ctx.font='bold 28px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tot,cx,cy-8);
  ctx.font='12px Inter,sans-serif';ctx.fillStyle='#64748b';ctx.fillText('Total',cx,cy+14);
}

function renderStock(filter=''){
  const canEdit=Auth.canEdit(),canDel=Auth.canEdit();
  const tbody=document.getElementById('stockTableBody');
  const filtered=filter?materials.filter(m=>(m.code+m.desc+m.brand+m.model+m.sector).toLowerCase().includes(filter.toLowerCase())):materials;
  tbody.innerHTML=filtered.map(m=>{
    const s=getStatus(m);
    const img=m.image?`<img class="eo-thumb" src="${Security.escapeHTML(m.image)}">`:`<div class="eo-thumb-placeholder"></div>`;
    const ic=m.interchangeable?'<span title="Intercambiável" style="color:#00D4FF;cursor:help"></span>':'';
    return`<tr>
      <td>${img}</td>
      <td><span class="material-code">${Security.escapeHTML(m.code)}</span></td>
      <td>${Security.escapeHTML(m.desc)} ${ic}</td>
      <td>${Security.escapeHTML(m.brand||'-')}</td>
      <td>${Security.escapeHTML(m.sector)}</td>
      <td><span class="badge">${Security.escapeHTML(m.location)}</span></td>
      <td>${Security.escapeHTML(m.qty.toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td>
      <td>${formatBRL(m.price)}</td>
      <td><span class="eo-status ${s.cls}">${s.text}</span></td>
              <td><div class="eo-actions">
          <button class="eo-action-btn" title="QR Code" data-action="qr"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg></button>
          <button class="eo-action-btn" title="Mais Info" data-action="info"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>
          <button class="eo-action-btn" title="Editar" data-action="edit" ${canEdit?'':'disabled'}><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
          <button class="eo-action-btn" title="Ver no Mapa" data-action="map"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></button>
          <button class="eo-action-btn" title="Comparar" data-action="compare"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg></button>
          <button class="eo-action-btn danger" title="Excluir" data-action="delete" ${canDel?'':'disabled'}><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
        </div></td></tr>`}).join('');
  Array.from(tbody.rows).forEach((row, index) => {
    const material = filtered[index];
    const actions = {
      qr: () => showQRCode(material.code, material.desc),
      info: () => openMoreInfo(material.code),
      edit: () => openEditMaterial(material.code),
      map: () => locateOnMap(material.code),
      compare: () => comparePricesFor(material.code),
      delete: () => deleteMaterial(material.code)
    };
    row.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', actions[button.dataset.action]);
    });
  });
}

window.showQRCode = function(code, desc) {
      const modalHtml = `
        <div id="qrModalOverlay" class="eo-modal-overlay active" style="z-index:9999;">
          <div class="eo-modal" style="max-width:320px; padding: 24px;">
            <div class="eo-modal-header" style="border-bottom:none; margin-bottom: 0;">
                <h3 class="eo-modal-title" style="font-size:18px; width:100%; text-align:center;">${Security.escapeHTML(code)}</h3>
              </div>
            <p style="font-size:13px; color:var(--text-tertiary); margin-bottom:16px; text-align:center;">${Security.escapeHTML(desc)}</p>
            <div style="background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:0 auto; width: 100%; text-align:center; box-sizing:border-box;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(code)}" alt="QR Code" style="width:100%; max-width:250px; display:block; margin:0 auto;">
            </div>
            <button class="btn btn-danger" style="margin-top:24px; width:100%;" onclick="document.getElementById('qrModalOverlay').remove()">Fechar</button>
          </div>
        </div>
      `;
      const old = document.getElementById('qrModalOverlay');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
  };
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
  const hide=role==='viewer'?['entrada','saida','componentes']:[];
  if(!Auth.canManageUsers())hide.push('usuarios');
  document.querySelectorAll('#SistemaTabs .eo-tab').forEach(t=>{if(hide.includes(t.dataset.tab))t.hidden=true});
  document.querySelectorAll('.sidebar [data-module]').forEach(link=>{if(hide.includes(link.dataset.module))link.hidden=true});
  if(role==='viewer'){const b=document.getElementById('btnNewMaterial');if(b)b.style.display='none'}
  const sessionUser=Auth.getUser();
  if(sessionUser){
    const u = sessionUser;
    OrganizationBrand.render(document.querySelector('[data-workspace-brand]'), u);
    AppSidebar.renderApplicationBrand(u);
    document.getElementById('userName').textContent = u.name || 'User';
    ['headerAvatar','dropAvatar','systemProfileNavAvatar','systemDropdownProfileAvatar']
      .forEach(id => ProfileAvatar.render(document.getElementById(id), u));
    const roleLabel = (role === 'superadmin' || role === 'admin') ? 'Admin' : role === 'manager' ? 'Gerente' : role === 'operator' ? 'Operador' : 'Visualizador';
    document.getElementById('userRoleBadge').textContent = roleLabel;
    document.getElementById('userRoleBadge').className = `eo-role-badge ${role}`;
    document.getElementById('dropName').textContent = u.name || 'Usuário';
    document.getElementById('dropEmail').textContent = u.email || 'N/A';
    document.getElementById('dropRole').textContent = roleLabel;
    document.getElementById('dropPlan').textContent = u.plan || 'Enterprise';
    document.getElementById('dropCorpName').textContent = u.org_name || 'Workspace';
    const logoEl = document.getElementById('dropCorpLogo');
    OrganizationBrand.setImage(logoEl, u.org_logo);
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
    const res = await API.get('/org/me');
    if (!res.success) return;
    const org = res.data;
    document.querySelectorAll('[data-workspace-brand]').forEach(element => OrganizationBrand.render(element, { org_name: org.name, org_logo: org.logo_url }));
    AppSidebar.renderApplicationBrand({ org_name: org.name, org_logo: org.logo_url, org_plan: org.plan });
    const nameEl = document.getElementById('topbarOrgName');
    if (nameEl) nameEl.textContent = org.name || 'Minha Organizacao';
    const planEl = document.getElementById('topbarOrgPlan');
    if (planEl) planEl.textContent = org.plan || 'Enterprise';
    const logoEl = document.getElementById('topbarOrgLogo');
    const initialEl = document.getElementById('topbarOrgInitial');
    const wrapEl = document.getElementById('topbarOrgLogoWrap');
    const logoShown = OrganizationBrand.setImage(logoEl, org.logo_url);
    if (initialEl) {
      initialEl.textContent = (org.name || 'O').trim().charAt(0).toUpperCase();
      initialEl.style.display = logoShown ? 'none' : '';
    }
    if (!logoShown && wrapEl && org.name) {
      const hue = [...org.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
      wrapEl.style.background = 'hsl(' + hue + ', 60%, 45%)';
    }
    const orgBlock = document.getElementById('topbarOrg');
    if (orgBlock) orgBlock.title = org.name + ' - Plano: ' + (org.plan || 'Enterprise');
    const dropCorpName = document.getElementById('dropCorpName');
    if (dropCorpName) dropCorpName.textContent = org.name || 'Workspace';
    const dropCorpLogo = document.getElementById('dropCorpLogo');
    const dropCorpLogoShown = OrganizationBrand.setImage(dropCorpLogo, org.logo_url);
    const dropCorpInitial = document.getElementById('dropCorpInitial');
    if (dropCorpInitial) {
      dropCorpInitial.textContent = (org.name || 'W').trim().charAt(0).toUpperCase();
      dropCorpInitial.style.display = dropCorpLogoShown ? 'none' : 'inline-flex';
    }
  } catch (e) {
    const nameEl = document.getElementById('topbarOrgName');
    if (nameEl) nameEl.textContent = 'Organizacao';
    const initialEl = document.getElementById('topbarOrgInitial');
    if (initialEl) initialEl.textContent = 'O';
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!Auth.requireAuth())return;
  const requestedTab=new URLSearchParams(window.location.search).get('tab')||'dashboard';
  switchTab(requestedTab,{render:false});
  const profile = await API.get('/auth/me');
  const freshUser = ProfileAvatar.fromResponse(profile);
  if(freshUser) Auth.setUser(freshUser);
  applyPermissions();
  switchTab(requestedTab,{render:false});
  loadOrgIdentity();
  await initAppData();
  switchTab(requestedTab);
  
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
