/* Warehouse, map and material positions share the same server-owned context. */
window.WarehouseUI = (() => {
  let stocks = [], positionRequest = 0;
  const el = id => document.getElementById(id);
  const option = (value,label) => { const node=document.createElement('option');node.value=value;node.textContent=label;return node; };
  const mayCreate = () => ['superadmin','admin','manager'].includes(Auth.getUser()?.role);
  function confirmMapDelete(name,message) {
    return new Promise(resolve=>{
      const previous=document.activeElement;
      const overlay=document.createElement('div');overlay.className='eo-modal-overlay map-delete-overlay';overlay.style.display='flex';
      overlay.setAttribute('role','alertdialog');overlay.setAttribute('aria-modal','true');
      const titleId='mapDeleteTitle-'+Math.random().toString(36).slice(2),messageId='mapDeleteMessage-'+Math.random().toString(36).slice(2);
      overlay.setAttribute('aria-labelledby',titleId);overlay.setAttribute('aria-describedby',messageId);
      const dialog=document.createElement('section');dialog.className='eo-modal map-delete-dialog';
      const heading=document.createElement('h2');heading.id=titleId;heading.textContent='Excluir mapa?';
      const description=document.createElement('p');description.id=messageId;description.textContent=message;
      const nameLine=document.createElement('p');nameLine.className='map-delete-name';nameLine.textContent=name;
      const actions=document.createElement('div');actions.className='map-delete-actions';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='eo-btn map-delete-cancel';cancel.textContent='Cancelar';
      const confirm=document.createElement('button');confirm.type='button';confirm.className='eo-btn map-delete-confirm';confirm.textContent='Excluir mapa';
      actions.append(cancel,confirm);dialog.append(heading,description,nameLine,actions);overlay.append(dialog);document.body.append(overlay);
      let settled=false;
      function finish(accepted){if(settled)return;settled=true;document.removeEventListener('keydown',onKeydown);overlay.remove();if(previous?.isConnected)previous.focus();resolve(accepted);}
      function onKeydown(event){
        if(event.key==='Escape'){event.preventDefault();finish(false);return;}
        if(event.key==='Tab'){
          const first=cancel,last=confirm;
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      }
      cancel.onclick=()=>finish(false);confirm.onclick=()=>finish(true);
      overlay.onclick=event=>{if(event.target===overlay)finish(false);};
      document.addEventListener('keydown',onKeydown);cancel.focus();
    });
  }
  function setStocks(rows) {
    stocks=rows;
    const tabs=el('warehouseTabs');
    if(tabs){
      tabs.replaceChildren();const label=document.createElement('label');label.textContent='Estoque';
      const select=document.createElement('select');select.id='warehouseStockSelect';select.className='eo-input';select.setAttribute('aria-label','Selecionar estoque');
      select.append(option('','Selecione um estoque'),...rows.map(stock=>option(stock.id,`${stock.name} · ${stock.branch_name||'Sede'}`)));select.value=String(currentWarehouseId||'');
      select.onchange=()=>{if(select.value)selectWarehouse(Number(select.value));};label.append(select);tabs.append(label);
      if(mayCreate()){const button=document.createElement('button');button.type='button';button.className='eo-btn eo-btn-primary';button.textContent='+ Armazém / estoque';button.onclick=()=>openCreate();tabs.append(button);
        const trash=document.createElement('button');trash.type='button';trash.className='eo-btn';trash.textContent='Mapas excluídos';trash.onclick=restoreMap;tabs.append(trash);}
    }
    const current=stocks.find(stock=>stock.id===currentWarehouseId);
    let summary=el('warehouseContextSummary');
    if(!summary&&tabs){summary=document.createElement('p');summary.id='warehouseContextSummary';tabs.after(summary);}
    if(summary)summary.textContent=current?`${current.branch_name||'Sede'} · ${current.map_name} · ${current.parent_id?'Estoque subdividido':'Armazém'}`:'';
  }
  function dialog() {
    if(el('warehouseCreateDialog'))return el('warehouseCreateDialog');
    const overlay=document.createElement('div');overlay.id='warehouseCreateDialog';overlay.className='eo-modal-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','warehouseCreateTitle');
    overlay.innerHTML='<div class="eo-modal warehouse-create"><div class="eo-modal-header"><h2 id="warehouseCreateTitle">Criar armazém ou estoque</h2><button type="button" class="eo-modal-close" id="warehouseCreateClose" aria-label="Fechar"></button></div><form id="warehouseCreateForm"><p>Organize seus materiais por sede ou filial. Cada armazém tem um mapa; seus estoques podem compartilhar a mesma planta.</p><label for="warehouseCreateName">Nome do armazém / estoque</label><input id="warehouseCreateName" class="eo-input" maxlength="100" required placeholder="Ex.: Armazém de manutenção"><label for="warehouseCreateParent">Mapa e subdivisão</label><select id="warehouseCreateParent" class="eo-input"></select><label for="warehouseCreateBranch">Sede ou filial</label><select id="warehouseCreateBranch" class="eo-input"></select><label for="warehouseCreateImage">Imagem do armazém (opcional)</label><input id="warehouseCreateImage" type="file" accept="image/png,image/jpeg,image/webp"><img id="warehouseCreatePreview" alt="Prévia da imagem do armazém" hidden><p id="warehouseCreateError" role="alert"></p><button class="eo-btn eo-btn-primary" id="warehouseCreateSubmit">Criar e abrir mapa</button></form></div>';
    document.body.append(overlay);
    el('warehouseCreateImage').onchange=async()=>{try{const cover=await readCover(el('warehouseCreateImage').files[0]);el('warehouseCreatePreview').hidden=!cover;if(cover)el('warehouseCreatePreview').src=cover;}catch(e){el('warehouseCreateError').textContent=e.message;}};
    el('warehouseCreateClose').onclick=()=>{overlay.style.display='none';};
    el('warehouseCreateParent').onchange=()=>{el('warehouseCreateBranch').disabled=!!el('warehouseCreateParent').value;};
    el('warehouseCreateForm').onsubmit=async event=>{
      event.preventDefault();const button=el('warehouseCreateSubmit');button.disabled=true;el('warehouseCreateError').textContent='';
      try{
        const parent=el('warehouseCreateParent').value;
        const result=await API.post('/warehouse/tabs',{name:el('warehouseCreateName').value.trim(),parent_id:parent?Number(parent):null,org_unit_id:el('warehouseCreateBranch').value?Number(el('warehouseCreateBranch').value):null,cover_image:await readCover(el('warehouseCreateImage').files[0])});
        if(!result.success)throw Error(result.error||'Não foi possível criar o estoque.');
        currentWarehouseId=result.data.id;overlay.style.display='none';await initAppData();
        switchTab('mapa');
        if(window.mapHubReload)await window.mapHubReload(result.data.layout_id);
        if(window.mapHubShowView)window.mapHubShowView('editor');
        showToast('Armazém e mapa criados. Adicione as prateleiras e salve a planta.','success');
      }catch(error){el('warehouseCreateError').textContent=error.message;}finally{button.disabled=false;}
    };
    return overlay;
  }
  async function openCreate() {
    if(!mayCreate()){showToast('Solicite ao administrador o cadastro de um armazém.','info');return;}
    const overlay=dialog();overlay.style.display='flex';el('warehouseCreateError').textContent='';
    el('warehouseCreateSubmit').disabled=true;el('warehouseCreateName').value='';el('warehouseCreateImage').value='';el('warehouseCreatePreview').hidden=true;
    const [tabs,branches]=await Promise.all([API.get('/warehouse/tabs'),API.get('/warehouse/branches')]);
    if(!tabs.success||!branches.success){el('warehouseCreateError').textContent='Não foi possível carregar armazéns e filiais. Feche e tente novamente.';return;}
    stocks=tabs.data;
    el('warehouseCreateParent').replaceChildren(option('','Novo armazém com mapa próprio'),...stocks.map(stock=>option(stock.id,`Subdividir ${stock.name} · ${stock.branch_name||'Sede'}`)));
    el('warehouseCreateBranch').replaceChildren(option('','Sede da organização'),...branches.data.map(branch=>option(branch.id,branch.name)));
    el('warehouseCreateBranch').disabled=false;el('warehouseCreateSubmit').disabled=false;el('warehouseCreateName').focus();
  }
  async function readCover(file){
    if(!file)return null;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Use PNG, JPG ou WebP de até 8 MB.');
    const bitmap=await createImageBitmap(file);try{if(bitmap.width>12000||bitmap.height>12000)throw Error('Imagem grande demais.');const scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const image=canvas.toDataURL('image/jpeg',.75);if(image.length>400000)throw Error('Reduza o tamanho da imagem.');return image;}finally{bitmap.close();}
  }
  async function restoreMap(){
    const result=await API.get('/warehouse/archived-maps');if(!result.success){showToast(result.error,'error');return;}
    const overlay=document.createElement('div');overlay.className='eo-modal-overlay';overlay.style.display='flex';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    const box=document.createElement('div');box.className='eo-modal warehouse-create';const header=document.createElement('h2');header.textContent='Mapas excluídos';header.style.padding='24px';box.append(header);
    const body=document.createElement('div');body.style.padding='0 24px 24px';const select=document.createElement('select');select.className='eo-input';select.setAttribute('aria-label','Mapa para restaurar');select.append(...result.data.map(map=>option(map.id,map.name)));body.append(select);
    const restore=document.createElement('button');restore.textContent='Restaurar mapa';restore.className='eo-btn eo-btn-primary';restore.disabled=!result.data.length;restore.onclick=async()=>{const response=await API.post('/warehouse/maps/'+Number(select.value)+'/restore',{});if(response.success){overlay.remove();await initAppData();await mapHubReload(Number(select.value));}else showToast(response.error,'error');};
    const close=document.createElement('button');close.textContent='Fechar';close.className='eo-btn';close.onclick=()=>overlay.remove();body.append(restore,close);box.append(body);overlay.append(box);document.body.append(overlay);
  }
  async function deleteMap(map){
    if(!mayCreate()){showToast('Sem permissão para excluir mapas.','error');return;}
    const accepted=await confirmMapDelete(map.name,'Este mapa e seus estoques sairão da lista ativa. Os materiais e o histórico serão preservados, e o mapa poderá ser restaurado em Mapas excluídos.');
    if(!accepted)return;
    const result=await API.delete('/warehouse/maps/'+Number(map.layout_id));if(!result.success){showToast(result.error||'Não foi possível excluir o mapa.','error');return;}
    currentWarehouseId=null;await initAppData();await mapHubReload();showToast('Mapa enviado para Mapas excluídos.','success');
  }
  function onboarding() {
    materials=[];renderStock();renderDashboard();
    const tabs=el('warehouseTabs');if(tabs)tabs.replaceChildren();setStocks([]);
    switchTab('estoque');openCreate();
  }
  function populateShelfStock() {
    const select=el('shelf-stock');if(!select)return;
    const context=stocks.find(stock=>stock.id===currentWarehouseId);
    select.replaceChildren(...stocks.filter(stock=>stock.layout_id===context?.layout_id).map(stock=>option(stock.id,stock.name)));
    select.value=String(currentWarehouseId||'');
    const ids=new Set(Object.values(window.getCadBlueprint?.()?.floors||{}).flatMap(floor=>floor.shelves||[]).map(shelf=>shelf.id));
    let number=1;while(ids.has('SH-'+number))number++;if(el('shelf-id'))el('shelf-id').value='SH-'+number;
  }
  async function preparePositions(saved='') {
    const request=++positionRequest,hidden=el('matLocation'),shelf=el('matShelf'),level=el('matShelfLevel'),position=el('matShelfPosition'),hint=el('matPositionHint');
    if(!hidden||!shelf)return;
    hidden.value='';shelf.disabled=true;level.disabled=true;position.disabled=true;
    shelf.replaceChildren(option('','Carregando prateleiras…'));hint.textContent='';
    el('materialSubmitBtn').disabled=true;
    const result=await API.get('/warehouse/positions?warehouse_id='+currentWarehouseId);
    if(request!==positionRequest)return;
    if(!result.success){hint.textContent=result.error||'Não foi possível carregar posições.';return;}
    const rows=result.data;
    shelf.replaceChildren(option('','Sem posição definida'),...rows.map((row,index)=>option(index+1,`${row.code} · Andar ${row.floor}`)));
    shelf.disabled=false;el('materialSubmitBtn').disabled=false;
    function updatePosition(){const row=rows[Number(shelf.value)-1];hidden.value=row?`${row.code}-N${level.value}-P${position.value}`:'';}
    shelf.onchange=()=>{
      const row=rows[Number(shelf.value)-1];
      level.replaceChildren(...Array.from({length:row?.levels||0},(_,index)=>option(index+1,`Nível ${index+1}`)));
      position.replaceChildren(...Array.from({length:row?.positions||0},(_,index)=>option(index+1,`Posição ${index+1}`)));
      level.disabled=position.disabled=!row;updatePosition();
    };
    level.onchange=position.onchange=updatePosition;shelf.onchange();
    if(saved&&saved!=='N/A'){
      const match=rows.findIndex(row=>saved.startsWith(row.code+'-N'));
      const parts=saved.match(/-N(\d+)-P(\d+)$/);
      if(match>=0&&parts&&Number(parts[1])<=rows[match].levels&&Number(parts[2])<=rows[match].positions){shelf.value=String(match+1);shelf.onchange();level.value=parts[1];position.value=parts[2];updatePosition();}
      else hint.textContent='A posição anterior não existe no mapa salvo. Selecione uma nova posição ou deixe sem posição.';
    }else if(!rows.length)hint.textContent='Este estoque ainda não tem prateleiras salvas. Crie-as no Editor CAD e salve o mapa; também é possível cadastrar material sem posição.';
  }
  async function selectMap(map){
    const stock=map.warehouse_ids.includes(currentWarehouseId)?currentWarehouseId:map.warehouse_id;
    if(stock!==currentWarehouseId)await selectWarehouse(stock);
    if(window.loadBlueprint)await window.loadBlueprint();
  }
  async function openMaterialAtShelf(code,level,position){
    const shelf=Object.values(window.getCadBlueprint?.()?.floors||{}).flatMap(floor=>floor.shelves||[]).find(shelf=>shelf.id===code);
    if(shelf?.warehouse_id&&Number(shelf.warehouse_id)!==currentWarehouseId)await selectWarehouse(Number(shelf.warehouse_id));
    await openNewMaterialModal();
    if(code)await preparePositions(`${code}-N${Number(level)+1||1}-P${Number(position)+1||1}`);
  }
  async function afterMapSaved(layout){
    if(window.mapHubReload)await window.mapHubReload(layout);
    if(window.mapHubShowView)window.mapHubShowView('viewer');
  }
  return {readCover,restoreMap,deleteMap,confirmMapDelete,setStocks,openCreate,onboarding,populateShelfStock,preparePositions,selectMap,afterMapSaved,openMaterialAtShelf};
})();
