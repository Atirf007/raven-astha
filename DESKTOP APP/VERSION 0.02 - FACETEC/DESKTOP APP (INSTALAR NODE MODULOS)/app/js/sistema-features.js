/* Sistema Features ? Modals, Entry/Exit, Components, Users, Map, PDF */

// â⬝??â⬝?? Modal Helpers â⬝??â⬝??
function switchModalTab(btn,panelId){
  btn.closest('.eo-modal').querySelectorAll('.eo-inline-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  btn.closest('.eo-modal').querySelectorAll('.eo-inline-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
}
function previewImage(input,previewId,dataId){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{const img=document.getElementById(previewId);img.src=e.target.result;img.style.display='block';document.getElementById(dataId).value=e.target.result;};
  reader.readAsDataURL(file);
}
function handleManualUpload(input){
  const file=input.files[0];if(!file)return;
  document.getElementById('matManualName').textContent=`ðŸ?S?~ ${file.name}`;
  const reader=new FileReader();
  reader.onload=e=>{document.getElementById('matManualData').value=e.target.result;};
  reader.readAsDataURL(file);
}

// â⬝??â⬝?? File Attachment System â⬝??â⬝??
let matPendingFiles = []; // {category, filename, mime_type, file_data, description, file_size_kb}

const FILE_ICONS = {
  pdf: 'ðŸ?S?~', stl: 'ðŸ⬝?', obj: 'ðŸ⬝?', gltf: 'ðŸ⬝?', glb: 'ðŸ⬝?',
  '3ds': 'ðŸ⬝?', step: 'ðŸ⬝?', stp: 'ðŸ⬝?', iges: 'ðŸ⬝?', igs: 'ðŸ⬝?',
  dwg: 'ðŸ?S', dxf: 'ðŸ?S', svg: 'ðŸ?¼ï¸', jpg: 'ðŸ?¼ï¸', png: 'ðŸ?¼ï¸',
  default: 'ðŸ?SŽ'
};
function getFileIcon(filename){
  const ext = (filename||'').split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}
function formatFileSize(kb){
  if(!kb) return '';
  return kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB`;
}

function readFileAsBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=e=>resolve(e.target.result);
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}

async function addFilesToQueue(files, category){
  for(const file of files){
    const sizekb = Math.round(file.size/1024);
    if(sizekb > 25000){ showToast(`Arquivo "${file.name}" muito grande (máx 25MB)`,'error'); continue; }
    const data = await readFileAsBase64(file);
    matPendingFiles.push({ category, filename:file.name, mime_type:file.type, file_data:data, description:'', file_size_kb:sizekb, _temp_id: Date.now()+Math.random() });
  }
  renderPendingFileLists();
}

function handleFileInput(input, category){
  if(input.files && input.files.length) addFilesToQueue(Array.from(input.files), category);
  input.value = '';
}

function handleFileDrop(event, category){
  event.preventDefault();
  const files = Array.from(event.dataTransfer.files);
  if(files.length) addFilesToQueue(files, category);
}

function renderPendingFileLists(){
  ['product_3d','machinery_3d','manual','electrical','mechanical'].forEach(cat=>{
    const el = document.getElementById('filelist-'+cat);
    if(!el) return;
    const pend = matPendingFiles.filter(f=>f.category===cat && !f._saved_id);
    const saved = matPendingFiles.filter(f=>f.category===cat && f._saved_id);
    el.innerHTML = [...saved.map(f=>renderFileItem(f, cat, true)), ...pend.map(f=>renderFileItem(f, cat, false))].join('');
  });
}

function renderFileItem(f, category, isSaved){
  const icon = getFileIcon(f.filename);
  const size = formatFileSize(f.file_size_kb);
  const key = isSaved ? `saved_${f._saved_id}` : `pend_${f._temp_id}`;
  const deleteCall = isSaved ? `deleteExistingFile(${f._saved_id},'${category}')` : `removePendingFile('${f._temp_id}','${category}')`;
  const badge = isSaved ? '<span class="eo-file-badge saved">Salvo</span>' : '<span class="eo-file-badge pending">Pendente</span>';
  const openBtn = (f.file_data || f.file_url) ? `<button type="button" class="eo-file-action" onclick="openFileFromPending('${f._temp_id||''}','${f._saved_id||''}','${category}')" title="Abrir">&#128065;</button>` : '';
  return `<div class="eo-file-item" id="fi-${key}">
    <span class="eo-file-icon">${icon}</span>
    <div class="eo-file-info">
      <div class="eo-file-name">${f.filename}</div>
      <div class="eo-file-meta">${size} ${badge}</div>
    </div>
    ${openBtn}
    <button type="button" class="eo-file-action danger" onclick="${deleteCall}" title="Remover">&#10005;</button>
  </div>`;
}

function removePendingFile(tempId, category){
  matPendingFiles = matPendingFiles.filter(f=>String(f._temp_id)!==String(tempId));
  renderPendingFileLists();
}

async function deleteExistingFile(fileId, category){
  const res = await API.delete('/materials/files/'+fileId);
  if(res.success){
    matPendingFiles = matPendingFiles.filter(f=>f._saved_id!==fileId);
    renderPendingFileLists();
    showToast('Arquivo removido','success');
  } else showToast('Erro ao remover arquivo','error');
}

function openFileFromPending(tempId, savedId, category){
  let f;
  if(tempId) f = matPendingFiles.find(x=>String(x._temp_id)===String(tempId));
  else if(savedId) f = matPendingFiles.find(x=>x._saved_id===parseInt(savedId));
  if(!f) return showToast('Arquivo nío encontrado','info');
  if(f.file_data) _openManualUrl(f.file_data);
  else if(f.file_url) window.open(f.file_url,'_blank');
  else showToast('Sem dados para abrir','info');
}

async function uploadPendingFiles(materialCode){
  const pending = matPendingFiles.filter(f=>!f._saved_id);
  if(!pending.length) return;
  let count=0;
  for(const f of pending){
    const res = await API.post(`/materials/${materialCode}/files`, {
      category:f.category, filename:f.filename, mime_type:f.mime_type,
      file_data:f.file_data, description:f.description, file_size_kb:f.file_size_kb
    });
    if(res.success){ f._saved_id=res.data.id; count++; }
    else console.warn('File upload failed:', f.filename, res.error);
  }
  if(count) showToast(`${count} arquivo(s) anexado(s)`,'success');
  renderPendingFileLists();
}

async function loadExistingFiles(materialCode){
  matPendingFiles = matPendingFiles.filter(f=>!f._saved_id); // keep pending only
  const res = await API.get(`/materials/${materialCode}/files`);
  if(res.success && res.data){
    res.data.forEach(f=>{
      matPendingFiles.push({ category:f.category, filename:f.filename, mime_type:f.mime_type,
        file_url:`/api/materials/${materialCode}/files/${f.id}/data?token=${localStorage.getItem('astah_token')}`,
        description:f.description||'', file_size_kb:f.file_size_kb, _saved_id:f.id, _temp_id:null });
    });
  }
  renderPendingFileLists();
}

// â⬝??â⬝?? Material Modal (Create/Edit) â⬝??â⬝??
function openNewMaterialModal(){
  matPendingFiles = [];
  document.getElementById('matEditCode').value='';
  document.getElementById('materialModalTitle').textContent='+ Novo Material (MM01)';
  document.getElementById('materialSubmitBtn').textContent='Criar Material';
  document.getElementById('materialForm').reset();
  document.getElementById('matImagePreview').style.display='none';
  document.getElementById('matMachImagePreview').style.display='none';
  document.getElementById('materialModal').classList.add('active');
  renderPendingFileLists();
  document.querySelector('#materialModal .eo-inline-tab').click();
}
function closeMaterialModal(){document.getElementById('materialModal').classList.remove('active'); matPendingFiles=[];}

async function openEditMaterial(code){
  const m=materials.find(x=>x.code===code);if(!m)return;
  matPendingFiles = [];
  document.getElementById('matEditCode').value=m.code;
  document.getElementById('materialModalTitle').textContent=`Editar: ${m.code}`;
  document.getElementById('materialSubmitBtn').textContent='Salvar Alterações';
  document.getElementById('matDesc').value=m.desc;
  document.getElementById('matBrand').value=m.brand||'';
  document.getElementById('matModel').value=m.model;
  document.getElementById('matSector').value=m.sector;
  document.getElementById('matLocation').value=m.location;
  document.getElementById('matInitQty').value=m.qty;
  document.getElementById('matMin').value=m.min;
  document.getElementById('matMax').value=m.max;
  document.getElementById('matPrice').value=m.price;
  document.getElementById('matManufacturerUrl').value=m.manufacturerUrl||'';
  document.getElementById('matUsageDesc').value=m.usageDesc||'';
  document.getElementById('matMachineryName').value=m.machineryName||'';
  document.getElementById('matMachineryDesc').value=m.machineryDesc||'';
  const notesEl = document.getElementById('matNotes');
  if(notesEl) notesEl.value = m.notes||'';
  const icEl=document.getElementById('matInterchangeable');
  if(icEl) icEl.checked=!!m.interchangeable;
  const icWith=document.getElementById('matInterchangeWith');
  if(icWith) icWith.value=m.interchangeWith||'';
  // Images
  if(m.image){document.getElementById('matImagePreview').src=m.image;document.getElementById('matImagePreview').style.display='block';document.getElementById('matImageData').value=m.image;}
  else{document.getElementById('matImagePreview').style.display='none';document.getElementById('matImageData').value='';}
  if(m.machineryImage){document.getElementById('matMachImagePreview').src=m.machineryImage;document.getElementById('matMachImagePreview').style.display='block';document.getElementById('matMachImageData').value=m.machineryImage;}
  else{document.getElementById('matMachImagePreview').style.display='none';document.getElementById('matMachImageData').value='';}
  // Legacy manual â⬠? show as "manual" file in list
  if(m.manualUrl){
    matPendingFiles.push({ category:'manual', filename:'Manual (legado)', mime_type:'application/pdf',
      file_data:m.manualUrl.startsWith('data:')?m.manualUrl:null, file_url:m.manualUrl.startsWith('http')?m.manualUrl:null,
      description:'Manual original', file_size_kb:null, _saved_id:null, _temp_id:'legacy_'+Date.now() });
  }
  document.getElementById('materialModal').classList.add('active');
  document.querySelector('#materialModal .eo-inline-tab').click();
  // Load files from API in background
  await loadExistingFiles(m.code);
}

async function handleMaterialSubmit(e){
  e.preventDefault();
  const editCode=document.getElementById('matEditCode').value;
  const icEl=document.getElementById('matInterchangeable');
  const icWith=document.getElementById('matInterchangeWith');
  const desc=document.getElementById('matDesc').value.trim();
  if(!desc){
    showToast('A Descriçío do material í? obrigatória!','error');
    document.querySelector('#materialModal .eo-inline-tab').click();
    return;
  }
  const notesEl = document.getElementById('matNotes');
  const data={
    desc, brand:document.getElementById('matBrand').value.trim(),
    model:document.getElementById('matModel').value.trim(),
    sector:document.getElementById('matSector').value,
    location:document.getElementById('matLocation').value.trim()||'N/A',
    qty:parseInt(document.getElementById('matInitQty').value)||0,
    min:parseInt(document.getElementById('matMin').value)||0,
    max:parseInt(document.getElementById('matMax').value)||0,
    price:parseFloat(document.getElementById('matPrice').value)||0,
    image:document.getElementById('matImageData').value||'',
    manufacturerUrl:document.getElementById('matManufacturerUrl').value.trim(),
    usageDesc:document.getElementById('matUsageDesc').value.trim(),
    machineryName:document.getElementById('matMachineryName').value.trim(),
    machineryImage:document.getElementById('matMachImageData').value||'',
    machineryDesc:document.getElementById('matMachineryDesc').value.trim(),
    notes: notesEl?notesEl.value.trim():'',
    interchangeable:icEl?icEl.checked:false,
    interchangeWith:icWith?icWith.value.trim():''
  };

  const backendData={
    description:data.desc, brand:data.brand, model:data.model, sector:data.sector,
    location:data.location, quantity:data.qty, min_qty:data.min, max_qty:data.max,
    unit_price:data.price,
    image_data:data.image&&data.image.startsWith('data:')?data.image:null,
    image_url:data.image&&!data.image.startsWith('data:')?data.image:null,
    machinery:data.machineryName,
    machinery_image:data.machineryImage||null, machinery_desc:data.machineryDesc||null,
    usage_desc:data.usageDesc||null, manufacturer_url:data.manufacturerUrl||null,
    manual_data:null, manual_url:null,
    interchangeable:data.interchangeable?1:0, interchange_with:data.interchangeWith,
    notes:data.notes||null
  };

  let res, savedCode;
  if(editCode){
    res=await API.put('/materials/'+editCode, backendData);
    if(res.success) showToast(`Material ${editCode} atualizado!`,'success');
    savedCode=editCode;
  } else {
    res=await API.post('/materials', backendData);
    if(res.success){ showToast(`Material ${res.data.code} criado!`,'success'); savedCode=res.data.code; }
  }

  if(res.success){
    if(savedCode) await uploadPendingFiles(savedCode);
    await initAppData();
    closeMaterialModal();
  } else {
    showToast(`Erro ao salvar material: ${res.error}`,'error');
  }
}
// â⬝??â⬝?? More Info Modal â⬝??â⬝??
async function openMoreInfo(code){
  const m=materials.find(x=>x.code===code);if(!m)return;
  currentInfoMaterial=m;
  document.getElementById('infoModalTitle').textContent=`${m.code} ? ${m.desc}`;
  
  const contentEl = document.getElementById('infoContent');
  contentEl.className = ''; // Remove .eo-info-grid or any inherited classes that restrict width
  contentEl.style.display = 'block';
  
  contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);">Carregando dados estruturais...</div>';
  document.getElementById('moreInfoModal').classList.add('active');

  const filesRes = await API.get(`/materials/${code}/files`);
  const files = (filesRes.success && filesRes.data) ? filesRes.data : [];
  
  const prod3D = files.find(f => f.category === 'product_3d' && f.filename.match(/\.(stl|obj|gltf|glb)$/i));

  const imgSrc=m.image||'';
  const machImg=m.machineryImage||'';
  const s=getStatus(m);
  const pct = m.max > 0 ? Math.min(100, Math.round((m.qty / m.max) * 100)) : (m.qty > 0 ? 100 : 0);
  const barColor=m.qty===0?'#FF4757':m.qty<=m.min?'#FFB830':'#00FF88';
  
  const isOldDesign = window.useOldDesign || false;

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const oldDesignHTML = `
    <div style="display:grid;grid-template-columns:minmax(300px, 380px) 1fr;gap:24px;align-items:start;" id="infoModernGrid">
      <div style="position:sticky;top:0;display:flex;flex-direction:column;gap:16px;">
        <div class="eo-media-gallery" id="eoMediaGallery" style="margin:0;height:320px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05);background:var(--bg-secondary);">
          <div class="eo-media-controls">
            <button class="eo-media-btn" id="eoMediaToggleBtn" onclick="toggleInfoMedia()" style="display:none;">â⬡?~ Alternar 2D/3D</button>
            <button class="eo-media-btn" onclick="expandMiniViewer()" title="Expandir Tela Cheia">â⬺¶ Tela Cheia</button>
          </div>
          ${imgSrc ? `<img id="eoMediaImage" class="eo-media-image" src="${imgSrc}" style="display:none;object-fit:cover;">` : `<div id="eoMediaImage" style="display:none;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);font-size:13px;">Sem foto 2D</div>`}
          <div id="eoMediaCanvas" class="eo-media-canvas" style="display:none;"></div>
          <div id="eoMediaLoading" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:12px;display:none;background:rgba(0,0,0,0.7);padding:8px 16px;border-radius:20px;backdrop-filter:blur(4px);">Renderizando Motor 3D...</div>
        </div>
        <div style="background:var(--bg-elevated, var(--bg-secondary));border:1px solid var(--surface-border);border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Disponibilidade</span>
            <span class="eo-status ${s.cls}" style="font-size:11px;padding:4px 8px;">${s.text}</span>
          </div>
          <div style="font-size:28px;font-weight:800;color:var(--text-primary);line-height:1;margin-bottom:12px;">
            ${m.qty} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary);">und.</span>
          </div>
          <div style="background:var(--surface-border);border-radius:99px;height:6px;overflow:hidden;margin-bottom:8px;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:99px;transition:width 0.6s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);font-weight:600;">
            <span>Mín: ${m.min}</span><span>Máx: ${m.max > 0 ? m.max : '??~'}</span>
          </div>
          <button class="btn btn-primary btn-block" onclick="closeMoreInfoModal();locateOnMap('${m.code}')" style="margin-top:20px;border-radius:12px;padding:10px;">ðŸ?S Localizar no Mapa</button>
        </div>
      </div>
      <button onclick="window.useOldDesign=false; openMoreInfo('${m.code}');" style="position:fixed;bottom:20px;right:20px;background:var(--color-primary);color:#FFF;padding:10px 16px;border-radius:8px;border:none;cursor:pointer;z-index:9999;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.2);">Ver Novo Design</button>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="eo-info-section" style="margin:0;border-radius:16px;">
          <h4 style="margin-bottom:16px;font-size:14px;color:var(--text-secondary);">Especificações T?cnicas</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;">
            <div class="eo-chip" style="width:100%;"><span class="eo-chip-label">Código</span><span class="eo-chip-val mono">${m.code}</span></div>
            <div class="eo-chip" style="width:100%;"><span class="eo-chip-label">Marca</span><span class="eo-chip-val">${m.brand||'N/A'}</span></div>
            <div class="eo-chip" style="width:100%;"><span class="eo-chip-label">Modelo</span><span class="eo-chip-val">${m.model||'?'}</span></div>
            <div class="eo-chip" style="width:100%;"><span class="eo-chip-label">Setor / Local</span><span class="eo-chip-val">${m.sector} ? ${m.location}</span></div>
            <div class="eo-chip" style="width:100%;grid-column:1/-1;background:rgba(var(--color-primary-rgb,108,99,255),0.05);border-color:rgba(var(--color-primary-rgb,108,99,255),0.2);">
              <span class="eo-chip-label">Valor Unitário</span>
              <span class="eo-chip-val" style="color:var(--color-primary);font-weight:800;font-size:16px;">${formatBRL(m.price)}</span>
            </div>
          </div>
        </div>
        <div class="eo-info-section" style="margin:0;border-radius:16px;">
          <h4 style="margin-bottom:16px;font-size:14px;color:var(--text-secondary);">Aplicaçío / Equipamento</h4>
          <div style="display:flex;gap:16px;align-items:flex-start;">
            ${machImg?`<img src="${machImg}" style="width:90px;height:90px;object-fit:cover;border-radius:12px;border:1px solid var(--surface-border);box-shadow:0 2px 8px rgba(0,0,0,0.05);">`:`<div style="width:90px;height:90px;background:var(--bg-secondary);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);font-size:11px;text-align:center;padding:8px;border:1px dashed var(--surface-border);">Sem imagem</div>`}
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${m.machineryName||'Equipamento nío especificado'}</div>
              <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0;">${m.machineryDesc||'Nenhuma descriçío detalhada do equipamento.'}</p>
            </div>
          </div>
        </div>
        <div class="eo-info-section" style="margin:0;border-radius:16px;">
          <h4 style="margin-bottom:16px;font-size:14px;color:var(--text-secondary);">Instruções e Equivalência</h4>
          <div style="margin-bottom:16px;">
            <span style="display:block;font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:6px;">Como Utilizar</span>
            <p style="font-size:13px;color:var(--text-primary);line-height:1.6;margin:0;">${m.usageDesc||'Nenhuma instruçío cadastrada.'}</p>
          </div>
          ${m.notes?`<div style="margin-bottom:16px;background:rgba(255,184,48,0.08);border-left:3px solid #FFB830;padding:12px 16px;border-radius:0 12px 12px 0;">
            <strong style="display:block;font-size:11px;color:#b37d1a;text-transform:uppercase;margin-bottom:4px;">Observações Tí?cnicas</strong>
            <p style="font-size:13px;color:var(--text-secondary);margin:0;line-height:1.5;">${m.notes}</p>
          </div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <div class="eo-chip" style="margin:0;"><span class="eo-chip-label">Intercambiável</span><span class="eo-chip-val" style="color:${m.interchangeable?'#00FF88':'#FF4757'};">${m.interchangeable?'?S Sim':'?S Não'}</span></div>
            ${m.interchangeable&&m.interchangeWith?`<div class="eo-chip" style="margin:0;"><span class="eo-chip-label">Peças Substitutas</span><span class="eo-chip-val mono">${m.interchangeWith}</span></div>`:''}
            ${m.manufacturerUrl?`<a href="${m.manufacturerUrl}" target="_blank" class="btn btn-secondary btn-sm" style="margin-left:auto;">Site do Fabricante â⬠?</a>`:''}
          </div>
        </div>
        <div class="eo-info-section" style="margin:0;border-radius:16px;flex:1;">
          <h4 style="margin-bottom:16px;font-size:14px;color:var(--text-secondary);">Documentos, Manuais & Modelos 3D</h4>
          <div id="infoFilesList" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><span style="color:var(--text-tertiary);font-size:13px;">Carregando arquivos...</span></div>
        </div>
      </div>
    </div>
  `;

  // Novo Design Variables
  const newStatusBg = m.qty === 0 ? '#FFE5E8' : m.qty <= m.min ? '#FFF4E5' : '#E6F4EE';
  const newStatusColor = m.qty === 0 ? '#FF4757' : m.qty <= m.min ? '#FFB830' : '#1B7A4E';
  const newStatusText = m.qty === 0 ? 'Sem Estoque' : m.qty <= m.min ? 'Estoque Crí­tico' : 'Em Estoque';
  const newBarColor = '#1B7A4E';

  const newDesignHTML = `
    <style>
      #moreInfoModal .eo-modal { background: #f0f4f7 !important; padding: 32px !important; max-width: 1200px !important; border-radius: 24px !important; border: none !important; box-shadow: 0 40px 80px rgba(0,0,0,0.5) !important; position: relative; overflow-y: auto; overflow-x: hidden; max-height: 90vh !important; }
      #moreInfoModal .eo-modal-header { display: none !important; }
      #infoContent { font-family: 'Inter', sans-serif !important; color: #1A1A1A; height: 100%; display: flex; flex-direction: column; }
      .volvo-card { background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.8); border-radius: 20px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.04); }
      #infoFilesList { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
      #infoFilesList .eo-info-file-btn { background: rgba(0,0,0,0.05); border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #1A1A1A; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
      #infoFilesList .eo-info-file-btn:hover { background: rgba(27,122,78,0.1); color: #1B7A4E; transform: translateY(-1px); }
      .main-grid { display:grid; grid-template-columns: 1fr 340px; grid-template-rows: 1fr auto; gap: 20px; flex: 1; min-height: 450px; }
      .bottom-grid { grid-column: 1; grid-row: 2; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; z-index: 10; align-items: start; }
      @media(max-width: 900px) {
        .main-grid { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }
        .right-card { grid-column: 1 !important; grid-row: 2 !important; }
        .bottom-grid { grid-column: 1 !important; grid-row: 3 !important; }
        .viewer-area-wrapper { grid-column: 1 !important; grid-row: 1 !important; min-height: 300px; }
      }
    </style>

    <!-- Top Bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;z-index:20;position:relative;margin-bottom:20px;">
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <button onclick="closeMoreInfoModal()" style="width:40px;height:40px;border-radius:12px;background:#FFF;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.05);color:#1A1A1A;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h2 style="font-size:28px;font-weight:600;margin:0;color:#1A1A1A;line-height:1.2;">${m.code}</h2>
          <div style="font-size:14px;color:#8A8A8A;margin-top:4px;">${m.desc || m.model || 'Item Cadastrado'}</div>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.5);backdrop-filter:blur(10px);border-radius:24px;padding:4px;display:flex;gap:4px;">
        <button onclick="comparePrices()" style="background:#FFF;border:none;border-radius:20px;padding:8px 20px;font-size:13px;font-weight:600;color:#1A1A1A;box-shadow:0 2px 8px rgba(0,0,0,0.05);cursor:pointer;">Comparar Preços</button>
        <button onclick="closeMoreInfoModal();locateOnMap('${m.code}')" style="background:transparent;border:none;border-radius:20px;padding:8px 20px;font-size:13px;font-weight:500;color:#8A8A8A;cursor:pointer;">Localizar no Mapa</button>
      </div>

      <div style="display:flex;gap:12px;align-items:center;">
        <div style="background:#FFF;border-radius:20px;padding:8px 16px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:#1A1A1A;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          Setor: ${m.sector} ${m.location ? `- ${m.location}` : ''}
        </div>
        <button onclick="window.useOldDesign=true; openMoreInfo('${m.code}');" style="width:40px;height:40px;border-radius:12px;background:#FFF;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.05);color:#1A1A1A;" title="Visualizaçío Antiga">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </button>
      </div>
    </div>

    <!-- Main Area Grid Layout -->
    <div class="main-grid">
      
      <!-- 3D Viewer Area (Row 1, Col 1) -->
      <div class="viewer-area-wrapper" style="grid-column: 1; grid-row: 1; position: relative; border-radius: 20px; min-height: 380px;">
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          ${imgSrc ? `<img id="eoMediaImage" src="${imgSrc}" style="display:none;width:100%;height:100%;object-fit:contain;border-radius:16px;box-sizing:border-box;padding:20px;">` : `<div id="eoMediaImage" style="display:none;"></div>`}
          <div id="eoMediaCanvas" style="display:block;width:100%;height:100%;cursor:grab;"></div>
          <div id="eoMediaLoading" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:12px;display:none;background:rgba(0,0,0,0.7);padding:8px 16px;border-radius:20px;">Carregando 3D...</div>
          
          <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:10;background:rgba(255,255,255,0.8);backdrop-filter:blur(10px);padding:6px;border-radius:24px;border:1px solid rgba(255,255,255,0.8);box-shadow:0 8px 24px rgba(0,0,0,0.08);">
            <button id="eoMediaToggleBtn" onclick="toggleInfoMedia()" style="display:none;background:#FFF;border:1px solid #E8E8E8;border-radius:16px;padding:6px 20px;font-size:12px;font-weight:600;color:#1A1A1A;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.05);transition:all 0.2s;">Alternar 2D/3D</button>
            <button onclick="expandMiniViewer()" style="background:transparent;border:none;border-radius:16px;padding:6px 20px;font-size:12px;font-weight:600;color:#8A8A8A;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg> Tela Cheia
            </button>
          </div>
        </div>
      </div>

      <!-- Right Floating Card (Row 1 to 2, Col 2) -->
      <div class="volvo-card right-card" style="grid-column: 2; grid-row: 1 / span 2; display:flex;flex-direction:column;gap:20px;overflow-y:auto;max-height:100%;">
        <div>
          <div style="font-size:14px;font-weight:600;color:#1A1A1A;margin-bottom:4px;">Disponibilidade</div>
          <div style="font-size:12px;color:#8A8A8A;margin-bottom:12px;">Estoque Atual</div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="font-size:32px;font-weight:700;color:#1A1A1A;">${m.qty}</div>
            <span style="background:${newStatusBg};color:${newStatusColor};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">${newStatusText}</span>
          </div>
          <div style="background:rgba(0,0,0,0.05);border-radius:4px;height:6px;width:100%;margin-bottom:8px;overflow:hidden;">
            <div style="height:100%;background:${newBarColor};width:${pct}%;border-radius:4px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#8A8A8A;">
            <span>Mín: ${m.min}</span><span>Máx: ${m.max > 0 ? m.max : '??~'}</span>
          </div>
        </div>
        
        <hr style="border:none;border-top:1px solid rgba(0,0,0,0.05);margin:0;">

        <div>
          <div style="font-size:14px;font-weight:600;color:#1A1A1A;margin-bottom:12px;">Especificações T?cnicas</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><div style="font-size:11px;color:#8A8A8A;margin-bottom:2px;">Marca</div><div style="font-size:13px;font-weight:600;color:#1A1A1A;">${m.brand||'N/A'}</div></div>
            <div><div style="font-size:11px;color:#8A8A8A;margin-bottom:2px;">Modelo</div><div style="font-size:13px;font-weight:600;color:#1A1A1A;">${m.model||'?'}</div></div>
            <div><div style="font-size:11px;color:#8A8A8A;margin-bottom:2px;">Intercambiável</div><div style="font-size:13px;font-weight:600;color:${m.interchangeable?'#1B7A4E':'#FF4757'};">${m.interchangeable?'?S Sim':'?S Não'}</div></div>
            ${m.interchangeable && m.interchangeWith ? `<div><div style="font-size:11px;color:#8A8A8A;margin-bottom:2px;">Substitutas</div><div style="font-size:13px;font-weight:600;color:#1A1A1A;">${m.interchangeWith}</div></div>` : ''}
          </div>
          ${m.manufacturerUrl ? `<div style="margin-top:12px;"><a href="${m.manufacturerUrl}" target="_blank" style="font-size:12px;color:#1B7A4E;text-decoration:none;font-weight:500;">?  Site do Fabricante</a></div>` : ''}
          
          <div style="margin-top:16px;background:rgba(255,255,255,0.5);border-radius:12px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;color:#8A8A8A;font-weight:500;">Valor Unitário</span>
            <span style="font-size:18px;font-weight:700;color:#1A1A1A;">${formatBRL(m.price)}</span>
          </div>
        </div>
      </div>

      <!-- Bottom Cards Row (Row 2, Col 1) -->
      <div class="bottom-grid">
        <div class="volvo-card" style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${machImg?`<img src="${machImg}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;">`:`<div style="width:40px;height:40px;border-radius:10px;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:10px;color:#8A8A8A;flex-shrink:0;">Sem Img</div>`}
            <div>
              <div style="font-size:12px;color:#8A8A8A;margin-bottom:2px;">Aplicação principal</div>
              <div style="font-size:14px;font-weight:600;color:#1A1A1A;line-height:1.2;">${m.machineryName||'Gen?rico'}</div>
            </div>
          </div>
          ${m.machineryDesc ? `<div style="font-size:12px;color:#666;line-height:1.5;">${m.machineryDesc}</div>` : ''}
        </div>

        <div class="volvo-card" style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(27,122,78,0.1);color:#1B7A4E;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </div>
            <div>
              <div style="font-size:12px;color:#8A8A8A;margin-bottom:2px;">Instruções e Manuseio</div>
              <div style="font-size:14px;font-weight:600;color:#1A1A1A;line-height:1.2;">Guia T?cnico</div>
            </div>
          </div>
          <div style="font-size:13px;color:#1A1A1A;line-height:1.5;">${m.usageDesc||'Ver manual.'}</div>
          ${m.notes ? `<div style="margin-top:4px;padding:8px 12px;background:rgba(255,184,48,0.1);border-left:2px solid #FFB830;font-size:11px;color:#b37d1a;border-radius:0 8px 8px 0;line-height:1.4;">${m.notes}</div>` : ''}
        </div>

        <div class="volvo-card" style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(0,0,0,0.05);color:#1A1A1A;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </div>
            <div>
              <div style="font-size:12px;color:#8A8A8A;margin-bottom:2px;">Documentos e Modelos</div>
              <div style="font-size:14px;font-weight:600;color:#1A1A1A;line-height:1.2;">Anexos Disponíveis</div>
            </div>
          </div>
          <div id="infoFilesList">Carregando...</div>
        </div>
      </div>

    </div>
  `;

  // Salvar referencias p/ toggle
  window._lastM = m;
  window._lastFiles = files;

  document.getElementById('infoContent').innerHTML = isOldDesign ? oldDesignHTML : newDesignHTML;

  // Apply responsive fix to grid
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `@media (max-width: 800px) { #infoModernGrid { grid-template-columns: 1fr !important; } #infoModernGrid > div:first-child { position: static !important; } }`;
  document.getElementById('infoContent').appendChild(styleEl);

  // Render Files List
  _renderInfoFilesList(files, m.code);

  // Initialize Media Gallery (Image + 3D)
  // Pass full files list so viewer can load associated MTL/textures
  const filesContext = { code: m.code, files: files };
  if(prod3D) {
    const ext = prod3D.filename.split('.').pop().toLowerCase();
    setupInfoMediaGallery(prod3D.id, m.code, prod3D.filename, ext, imgSrc, filesContext);
  } else {
    setupInfoMediaGallery(null, null, null, null, imgSrc, filesContext);
  }
}

function _renderInfoFilesList(files, code){
  const el = document.getElementById('infoFilesList');
  if(!el) return;
  const legacyManual = currentInfoMaterial && currentInfoMaterial.manualUrl;
  if(!files.length && !legacyManual){
    el.innerHTML='<p style="color:var(--text-tertiary);font-size:13px;">Nenhum arquivo anexado</p>';
    return;
  }
  const catLabel = {product_3d:'3D Produto',machinery_3d:'3D Maquinário',manual:'Manual',electrical:'El?trico',mechanical:'Mecânico',other:'Outro'};
  const catGroups = {};
  files.forEach(f=>{
    if(!catGroups[f.category]) catGroups[f.category]=[];
    catGroups[f.category].push(f);
  });
  let html = '';
  if(legacyManual && !files.find(f=>f.category==='manual')){
    html += `<div style="width:100%;"><div style="font-size:11px;color:#8A8A8A;margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Manual Legado</div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="eo-info-file-btn" onclick="openManualCurrent()">?x Manual (PDF)</button></div></div>`;
  }
  Object.entries(catGroups).forEach(([cat,flist])=>{
    const label = catLabel[cat]||cat;
    html += `<div style="width:100%;"><div style="font-size:11px;color:#8A8A8A;margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</div><div style="display:flex;gap:8px;flex-wrap:wrap;">`;
    flist.forEach(f=>{
      const icon = f.mime_type&&f.mime_type.includes('pdf')?'?x':
                   f.filename.match(/\.(stl|obj|gltf|glb|3ds|step|stp)$/i)?'?x?`':
                   f.filename.match(/\.(dwg|dxf)$/i)?'?x?':'?x}';
      html += `<button class="eo-info-file-btn" onclick="_openInfoFile(${f.id},'${code}','${f.filename}')" title="${f.filename} [${label}]">${icon} ${f.filename.length>22?f.filename.substring(0,20)+'...':f.filename}</button>`;
    });
    html += `</div></div>`;
  });
  el.innerHTML = html || '<p style="color:var(--text-tertiary);font-size:13px;">Nenhum arquivo anexado</p>';
}

function _openInfoFile(fileId, code, filename){
  if (!filename) {
    window.open(`/api/materials/${code}/files/${fileId}/data?token=${localStorage.getItem('astah_token')}`,'_blank');
    return;
  }
  const ext = filename.split('.').pop().toLowerCase();
  const url = `${typeof API !== 'undefined' ? API.BASE_URL : '/api'}/materials/${code}/files/${fileId}/data?token=${localStorage.getItem('astah_token')}`;
  if (['stl', 'obj', 'gltf', 'glb'].includes(ext)) {
    if (typeof open3DViewer === 'function') {
      open3DViewer(url, ext, filename);
    } else {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}

function closeMoreInfoModal(){
  document.getElementById('moreInfoModal').classList.remove('active');
  if(typeof miniViewerInst !== 'undefined' && miniViewerInst) {
    miniViewerInst.stop();
  }
}
// -- PDF & Manual --
function openManualCurrent(){
  if(!currentInfoMaterial||!currentInfoMaterial.manualUrl){showToast('Nenhum manual disponí­vel','info');return;}
  _openManualUrl(currentInfoMaterial.manualUrl);
}
function downloadManualCurrent(){
  if(!currentInfoMaterial||!currentInfoMaterial.manualUrl){showToast('Nenhum manual disponí­vel','info');return;}
  const url=currentInfoMaterial.manualUrl;
  const a=document.createElement('a');
  a.href=url;
  a.download=`manual-${currentInfoMaterial.code}.pdf`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function _openManualUrl(url){
  if(!url)return;
  if(url.startsWith('data:')){
    try{
      const parts=url.split(',');
      const mime=parts[0].split(':')[1].split(';')[0];
      const bstr=atob(parts[1]);
      const ab=new Uint8Array(bstr.length);
      for(let i=0;i<bstr.length;i++)ab[i]=bstr.charCodeAt(i);
      const blob=new Blob([ab],{type:mime});
      const blobUrl=URL.createObjectURL(blob);
      window.open(blobUrl,'_blank');
    }catch(e){showToast('Erro ao abrir o manual','error');console.error(e);}
  }else{window.open(url,'_blank');}
}
function openPdfViewer(url,title){_openManualUrl(url);}
function closePdfViewer(){document.getElementById('pdfViewerModal').classList.remove('active');document.getElementById('pdfFrame').src='';}
// â⬝??â⬝?? Price Comparison â⬝??â⬝??
function comparePrices(){if(currentInfoMaterial)comparePricesFor(currentInfoMaterial.code)}
function comparePricesFor(code){
  const m=materials.find(x=>x.code===code);if(!m)return;
  const q=encodeURIComponent(`${m.brand} ${m.model} ${m.desc}`);
  window.open(`https://www.google.com/search?tbm=shop&q=${q}`,'_blank');
  showToast('Comparaçío aberta no Google Shopping','info');
}

// â⬝??â⬝?? Entry/Exit â⬝??â⬝??
function lookupMaterial(prefix){
  const code=document.getElementById(prefix+'Code').value.trim().toUpperCase();
  const desc=document.getElementById(prefix+'Desc');
  const found=materials.find(m=>m.code===code);
  desc.value=found?found.desc:(code.length>=5?'Nío encontrado':'Aguardando código...');
}
async function handleEntry(e){
  e.preventDefault();
  const code=document.getElementById('entryCode').value.trim().toUpperCase();
  const qty=parseInt(document.getElementById('entryQty').value)||0;
  const price=parseFloat(document.getElementById('entryPrice').value)||0;
  const supplier=document.getElementById('entrySupplier').value.trim();
  const mat=materials.find(m=>m.code===code);
  if(!mat){showToast('Material nío encontrado!','error');return}
  if(qty<=0){showToast('Quantidade inválida!','error');return}

  const payload = {
    code: code,
    quantity: qty,
    nf_number: supplier || 'Sistema',
    responsible: supplier || 'Sistema'
  };

  const res = await API.post('/movements/entry', payload);
  if (res.success) {
    showToast(`Entrada: ${qty}x ${mat.desc}`,'success');
    e.target.reset();
    document.getElementById('entryDesc').value='Aguardando código...';
    await initAppData();
  } else {
    showToast(`Erro ao registrar entrada: ${res.error}`,'error');
  }
}
async function handleExit(e){
  e.preventDefault();
  const code=document.getElementById('exitCode').value.trim().toUpperCase();
  const qty=parseInt(document.getElementById('exitQty').value)||0;
  const center=document.getElementById('exitCenter').value.trim();
  const mat=materials.find(m=>m.code===code);
  if(!mat){showToast('Material nío encontrado!','error');return}
  if(qty<=0){showToast('Quantidade inválida!','error');return}
  if(qty>mat.qty){showToast(`Saldo insuficiente! Disponí­vel: ${mat.qty}`,'error');return}

  const payload = {
    code: code,
    quantity: qty,
    responsible: center || 'Sistema',
    reason: center || 'Sistema'
  };

  const res = await API.post('/movements/exit', payload);
  if (res.success) {
    showToast(`Saí­da: ${qty}x ${mat.desc}`,'success');
    e.target.reset();
    document.getElementById('exitDesc').value='Aguardando código...';
    await initAppData();
  } else {
    showToast(`Erro ao registrar saí­da: ${res.error}`,'error');
  }
}

// â⬝??â⬝?? Reports â⬝??â⬝??
function renderReports(filter=''){
  const tbody=document.getElementById('reportsTableBody');
  const empty=document.getElementById('reportsEmpty');
  const f=filter?movements.filter(m=>(m.code+m.desc+m.operation+m.responsible).toLowerCase().includes(filter.toLowerCase())):movements;
  if(!f.length){tbody.innerHTML='';if(empty)empty.style.display='block';return}
  if(empty)empty.style.display='none';
  tbody.innerHTML=f.map(m=>`<tr><td>${m.date}</td><td><span class="material-code">${m.code}</span></td><td>${m.desc}</td><td><span class="eo-status ${m.opClass}">${m.operation}</span></td><td>${m.qty}</td><td>${m.responsible}</td></tr>`).join('');
}
function filterReports(){renderReports(document.getElementById('reportFilter').value)}

// â⬝??â⬝?? Components â⬝??â⬝??
function renderComponents(){
  const grid=document.getElementById('componentsGrid');
  const empty=document.getElementById('componentsEmpty');
  if(!customComponents.length){grid.innerHTML='';empty.style.display='block';return}
  empty.style.display='none';
  grid.innerHTML=customComponents.map((c,i)=>{
    let totalCost=0;
    const items=c.materials.map(cm=>{
      const m=materials.find(x=>x.code===cm.code);
      const cost=m?(m.price*cm.qty):0;totalCost+=cost;
      return`<div class="eo-component-material-item"><span>${m?m.desc:cm.code}</span><span>${cm.qty}x ${m?formatBRL(cost):'-'}</span></div>`;
    }).join('');
    return`<div class="eo-component-card">
      <div class="eo-component-name">${c.name}</div>
      <div class="eo-component-desc">${c.description||''}</div>
      <div class="eo-component-materials">${items}</div>
      <div class="eo-component-total">Custo Total: ${formatBRL(totalCost)}</div>
    </div>`;
  }).join('');
}
function openNewComponentModal(){
  document.getElementById('componentForm').reset();
  document.getElementById('compMaterialsList').innerHTML='';
  addCompMaterialRow();
  document.getElementById('componentModal').classList.add('active');
}
function closeComponentModal(){document.getElementById('componentModal').classList.remove('active')}
function addCompMaterialRow(){
  const div=document.createElement('div');div.style.cssText='display:flex;gap:8px;margin-bottom:8px;align-items:end';
  const opts=materials.map(m=>`<option value="${m.code}">${m.code} ? ${m.desc}</option>`).join('');
  div.innerHTML=`<div class="input-group" style="flex:2"><select class="eo-input comp-mat-code">${opts}</select></div>
    <div class="input-group" style="flex:1"><input type="number" class="eo-input comp-mat-qty" value="1" min="1"></div>
    <button type="button" class="eo-action-btn danger" onclick="this.parentElement.remove()" style="margin-bottom:4px">â?⬢</button>`;
  document.getElementById('compMaterialsList').appendChild(div);
}
async function handleNewComponent(e){
  e.preventDefault();
  const name=document.getElementById('compName').value.trim();
  const desc=document.getElementById('compDesc').value.trim();
  const rows=document.querySelectorAll('#compMaterialsList > div');
  const mats=[];
  rows.forEach(r=>{
    const code=r.querySelector('.comp-mat-code').value;
    const qty=parseInt(r.querySelector('.comp-mat-qty').value)||1;
    mats.push({code,qty});
  });
  if(!name){showToast('Nome obrigatório','error');return}
  if(!mats.length){showToast('Adicione ao menos um material','error');return}

  const payload = {
    name: name,
    description: desc,
    materials: mats
  };

  const res = await API.post('/components', payload);
  if (res.success) {
    showToast(`Componente "${name}" criado!`,'success');
    closeComponentModal();
    await initAppData();
  } else {
    showToast(`Erro ao criar componente: ${res.error}`,'error');
  }
}

// â⬝??â⬝?? Users â⬝??â⬝??
function getRoleLabel(role) {
  return role === 'superadmin' ? 'Super Admin'
    : role === 'admin' ? 'Admin'
    : role === 'manager' ? 'Gerente'
    : role === 'operator' ? 'Operador'
    : 'Visualizador';
}
function renderUsers(){
  const grid = document.getElementById('usersGrid');
  if (!grid) return;
  const isAdmin = Auth.canManageUsers();
  if (!users || users.length === 0) {
    grid.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--text-secondary)">Nenhum usuário encontrado</div>';
    return;
  }
  grid.innerHTML = users.map(u => `
    <div style="display:grid;grid-template-columns:40px 1fr auto auto;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--surface-border);">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${(u.name||'U').charAt(0).toUpperCase()}</div>
      <div style="overflow:hidden;min-width:0;">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name || 'Usuário'}</div>
        <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.email || ''}</div>
      </div>
      <span class="eo-role-badge ${u.role||'viewer'}" style="white-space:nowrap;flex-shrink:0;">${getRoleLabel(u.role)}</span>
      ${isAdmin ? `<select class="eo-input" style="width:auto;padding:4px 8px;font-size:11px;flex-shrink:0;" onchange="changeUserRole(${u.id},this.value)">
        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        <option value="manager" ${u.role==='manager'?'selected':''}>Gerente</option>
        <option value="operator" ${u.role==='operator'?'selected':''}>Operador</option>
        <option value="viewer" ${u.role==='viewer'?'selected':''}>Visualizador</option>
      </select>` : ''}
    </div>`).join('');
}
async function changeUserRole(id,role){
  const res = await API.put(`/auth/users/${id}/role`, { role });
  if (res.success) {
    showToast(`Permissío alterada para ${role}`,'success');
    await initAppData();
  } else {
    showToast(`Erro ao alterar permissío: ${res.error}`,'error');
  }
}
function openAddUserModal(){document.getElementById('addUserModal').classList.add('active')}
function closeAddUserModal(){document.getElementById('addUserModal').classList.remove('active')}
async function handleAddUser(e){
  e.preventDefault();
  const name=document.getElementById('newUserName').value.trim();
  const email=document.getElementById('newUserEmail').value.trim();
  const password=document.getElementById('newUserPassword').value;
  const role=document.getElementById('newUserRole').value;
  
  const registerRes = await API.post('/auth/users', {
    name: name,
    surname: '',
    email: email,
    password: password,
    role: role,
    company: 'Astah Raven',
    phone: ''
  });

  if (registerRes.success) {
    showToast(`Usuário ${name} adicionado com sucesso!`, 'success');
    closeAddUserModal();
    await initAppData();
    e.target.reset();
  } else {
    showToast(`Erro ao adicionar usuário: ${registerRes.error}`, 'error');
  }
}

// â⬝??â⬝?? Close modals on overlay click â⬝??â⬝??
document.addEventListener('click',e=>{
  ['materialModal','moreInfoModal','pdfViewerModal','componentModal','assignModal','addUserModal'].forEach(id=>{
    if(e.target.id===id)document.getElementById(id).classList.remove('active');
  });
});







