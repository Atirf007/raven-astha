/* Sistema Map �?" 2D Top-Down Floor Plan + Shelf Detail */
let warehouseLayout = {
  roomW: 720,
  roomH: 480,
  shelves: [],
  aisles: [],
  door: { x: 620, y: 480, w: 100 }
};
let shelfAssignments = {};
let selectedShelf = null;
let highlightedSlot = null;
let mapEditMode = false;
let mapTool = 'select';
let dragShelf = null;
let dragOff = { x: 0, y: 0 };
const WX = 40;
const WY = 40;
const WT = 20; // wall origin and thickness

function autoAssignMaterials(){
  console.log('[MAP] Auto-assignment offline desabilitado. Utilizar indexação via interface.');
}

window.initWarehouseMap = async function() {
  try {
    // 1. Fetch layout
    const layoutRes = await API.get('/warehouse/layout');
    if (layoutRes.success) {
      const lay = layoutRes.data;
      warehouseLayout.roomW = lay.room_w || 720;
      warehouseLayout.roomH = lay.room_h || 480;
      warehouseLayout.door = { x: lay.door_x || 620, y: lay.door_y || 480, w: lay.door_w || 100 };
      if (lay.aisles) {
        warehouseLayout.aisles = typeof lay.aisles === 'string' ? JSON.parse(lay.aisles) : lay.aisles;
      } else {
        warehouseLayout.aisles = [];
      }
    }

    // 2. Fetch shelves
    const shelvesRes = await API.get('/warehouse/shelves');
    if (shelvesRes.success) {
      warehouseLayout.shelves = shelvesRes.data.map(s => ({
        dbId: s.id,
        id: s.shelf_code,
        x: s.pos_x,
        y: s.pos_y,
        w: s.width,
        h: s.height,
        levels: s.levels,
        positions: s.positions
      }));
    }

    // 3. Fetch shelf assignments
    const assignmentsRes = await API.get('/warehouse/assignments');
    if (assignmentsRes.success) {
      shelfAssignments = assignmentsRes.data;
    }

    console.log('[MAP] Warehouse map initialized from MySQL API.');
  } catch (err) {
    console.error('[MAP] Error loading warehouse map:', err);
  }
};

async function saveLayout(){
  const payload = {
    room_w: warehouseLayout.roomW,
    room_h: warehouseLayout.roomH,
    door_x: warehouseLayout.door ? warehouseLayout.door.x : 620,
    door_y: warehouseLayout.door ? warehouseLayout.door.y : 480,
    door_w: warehouseLayout.door ? warehouseLayout.door.w : 100,
    aisles: warehouseLayout.aisles
  };
  const res = await API.put('/warehouse/layout', payload);
  if (!res.success) {
    showToast('Erro ao salvar dimensões do armazém', 'error');
  }
}

async function resizeRoom(){
  warehouseLayout.roomW=parseInt(document.getElementById('roomW').value)||720;
  warehouseLayout.roomH=parseInt(document.getElementById('roomH').value)||480;
  await saveLayout();
  renderMap();
}

function toggleMapEditMode(){
  if(!Auth.canEdit()){showToast('Sem permissão','error');return;}
  mapEditMode=!mapEditMode;
  document.getElementById('btnEditMap').textContent=mapEditMode?'�o. Finalizar':'�o�️ Editar';
  document.getElementById('btnEditMap').className=mapEditMode?'btn btn-sm btn-primary':'btn btn-sm btn-secondary';
  document.getElementById('btnAssignMap').style.display=mapEditMode?'inline-flex':'none';
  document.getElementById('mapToolbar').style.display=mapEditMode?'flex':'none';
  if(mapEditMode){
    document.getElementById('roomW').value=warehouseLayout.roomW;
    document.getElementById('roomH').value=warehouseLayout.roomH;
  }
  renderMap();
}
function setMapTool(t){mapTool=t;document.querySelectorAll('.map-tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===t))}

function getScale(W,H){
  const rw=(warehouseLayout.roomW||720)+WT*2+60,rh=(warehouseLayout.roomH||480)+WT*2+60;
  const s=Math.min((W-20)/rw,(H-20)/rh);
  return{s:s||0.5,ox:(W-(warehouseLayout.roomW||720)*s)/2,oy:(H-(warehouseLayout.roomH||480)*s)/2};
}

// �"?�"? Render Floor Plan �"?�"?
function renderMap(){
  const canvas=document.getElementById('warehouseMap');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const r=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  canvas.width=r.width*dpr;canvas.height=500*dpr;canvas.style.height='500px';
  ctx.scale(dpr,dpr);
  const W=r.width,H=500,wl=warehouseLayout;
  const{s,ox,oy}=getScale(W,H);

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0c0c16';ctx.fillRect(0,0,W,H);

  ctx.save();ctx.translate(ox,oy);ctx.scale(s,s);

  // Walls
  ctx.fillStyle='#3a3a50';
  ctx.fillRect(-WT,-WT,wl.roomW+WT*2,wl.roomH+WT*2);
  // Floor
  ctx.fillStyle='#181828';ctx.fillRect(0,0,wl.roomW,wl.roomH);
  // Floor pattern
  ctx.strokeStyle='rgba(255,255,255,0.015)';ctx.lineWidth=0.5;
  for(let gx=0;gx<wl.roomW;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,wl.roomH);ctx.stroke()}
  for(let gy=0;gy<wl.roomH;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(wl.roomW,gy);ctx.stroke()}

  // Door
  if(wl.door){
    ctx.fillStyle='#181828';ctx.fillRect(wl.door.x,wl.roomH,wl.door.w,WT);
    ctx.strokeStyle='#666';ctx.lineWidth=1;ctx.setLineDash([4,3]);
    ctx.strokeRect(wl.door.x,wl.roomH-1,wl.door.w,WT+2);ctx.setLineDash([]);
    ctx.fillStyle='#666';ctx.font='9px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText('PORTA',wl.door.x+wl.door.w/2,wl.roomH+WT+11);
  }

  // Aisles
  (wl.aisles||[]).forEach(a=>{ctx.fillStyle='#555570';ctx.font='bold 13px Inter,sans-serif';ctx.textAlign='center';ctx.fillText(a.label,a.x,a.y)});

  // Shelves
  wl.shelves.forEach(sh=>drawShelfTop(ctx,sh,s));

  ctx.restore();
}

function drawShelfTop(ctx,sh,scale){
  const isSel=selectedShelf&&selectedShelf.id===sh.id;
  const isHL=highlightedSlot&&highlightedSlot.shelfId===sh.id;

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.25)';
  roundRect(ctx,sh.x+3,sh.y+3,sh.w,sh.h,4);ctx.fill();

  // Body gradient
  const grd=ctx.createLinearGradient(sh.x,sh.y,sh.x,sh.y+sh.h);
  if(isHL){grd.addColorStop(0,'#e6a817');grd.addColorStop(1,'#c48a10')}
  else if(isSel){grd.addColorStop(0,'#7B73FF');grd.addColorStop(1,'#5B53DD')}
  else{grd.addColorStop(0,'#e87730');grd.addColorStop(1,'#c45a18')}
  roundRect(ctx,sh.x,sh.y,sh.w,sh.h,4);ctx.fillStyle=grd;ctx.fill();

  // Shelf lines (horizontal bars to look like shelves)
  const bars=Math.min(sh.levels,6);
  const isVert=sh.h>sh.w;
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;
  for(let i=1;i<bars;i++){
    if(isVert){const yy=sh.y+sh.h*i/bars;ctx.beginPath();ctx.moveTo(sh.x+3,yy);ctx.lineTo(sh.x+sh.w-3,yy);ctx.stroke()}
    else{const xx=sh.x+sh.w*i/bars;ctx.beginPath();ctx.moveTo(xx,sh.y+3);ctx.lineTo(xx,sh.y+sh.h-3);ctx.stroke()}
  }

  // Edge highlights
  ctx.strokeStyle=isSel?'#A09AFF':isHL?'#ffd700':'rgba(255,255,255,0.12)';
  ctx.lineWidth=isSel||isHL?2.5:1;
  roundRect(ctx,sh.x,sh.y,sh.w,sh.h,4);ctx.stroke();

  // Label
  ctx.fillStyle='#fff';
  const fs=Math.max(14,Math.min(sh.w,sh.h)*0.35);
  ctx.font=`bold ${fs}px Inter,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=3;
  ctx.fillText(sh.id,sh.x+sh.w/2,sh.y+sh.h/2);
  ctx.shadowBlur=0;

  // Sub-label (levels x positions)
  ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='bold 8px Inter,sans-serif';
  ctx.fillText(`${sh.levels}N �- ${sh.positions}P`,sh.x+sh.w/2,sh.y+sh.h/2+fs*0.45);

  // Badge count
  let cnt=0;
  for(let l=1;l<=sh.levels;l++)for(let p=1;p<=sh.positions;p++)if(shelfAssignments[`${sh.id}-N${l}-P${p}`])cnt++;
  if(cnt>0){
    const bx=sh.x+sh.w-8,by=sh.y-6;
    ctx.beginPath();ctx.arc(bx,by,9,0,Math.PI*2);ctx.fillStyle='#6C63FF';ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 8px Inter,sans-serif';ctx.textBaseline='middle';ctx.fillText(cnt,bx,by);
  }

  // Edit handles
  if(mapEditMode){
    ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(108,99,255,0.4)';ctx.lineWidth=1;
    ctx.strokeRect(sh.x-3,sh.y-3,sh.w+6,sh.h+6);ctx.setLineDash([]);
    // Resize handle
    ctx.fillStyle='#6C63FF';ctx.fillRect(sh.x+sh.w-6,sh.y+sh.h-6,8,8);
  }
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}

// �"?�"? Shelf Detail Panel (DOM) �"?�"?
function renderShelfDetail(){
  if(!selectedShelf)return;
  const s=selectedShelf;
  let panel=document.getElementById('shelfDetailPanel');
  if(!panel){panel=document.createElement('div');panel.id='shelfDetailPanel';
    const container=document.querySelector('#panel-mapa .eo-map-container');
    if(container)container.appendChild(panel);
    else return;
  }
  panel.style.cssText='margin-top:16px;background:rgba(16,16,30,0.96);border:1px solid rgba(108,99,255,0.25);border-radius:12px;padding:20px;animation:fadeInUp 0.3s ease';

  let h=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="background:#e87730;border-radius:8px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#fff">${s.id}</div>
      <div><div style="color:#F0F0F5;font-weight:600;font-size:15px">Prateleira ${s.id}</div>
        <div style="color:#8888A0;font-size:12px">${s.levels} níveis �- ${s.positions} posições</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">`;
  if(mapEditMode){
    h+=`<label style="font-size:11px;color:#888">Níveis:</label>
      <input type="number" value="${s.levels}" min="1" max="10" style="width:45px;padding:3px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:11px;text-align:center" onchange="editShelfProp('${s.id}','levels',this.value)">
      <label style="font-size:11px;color:#888">Pos.:</label>
      <input type="number" value="${s.positions}" min="1" max="12" style="width:45px;padding:3px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:11px;text-align:center" onchange="editShelfProp('${s.id}','positions',this.value)">`;
  }
  h+=`<button class="btn btn-sm btn-secondary" onclick="closeShelfDetail()">�o.</button></div></div>`;

  // Shelf side-view
  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:separate;border-spacing:3px">';
  for(let l=s.levels;l>=1;l--){
    h+=`<tr><td style="width:36px;text-align:center;vertical-align:middle"><span style="background:rgba(232,119,48,0.15);border:1px solid #e87730;border-radius:4px;padding:2px 6px;font-size:10px;color:#e87730;font-weight:600">N${l}</span></td>`;
    for(let p=1;p<=s.positions;p++){
      const key=`${s.id}-N${l}-P${p}`,mc=shelfAssignments[key],m=mc?materials.find(x=>x.code===mc):null;
      const isHL=highlightedSlot&&highlightedSlot.shelfId===s.id&&highlightedSlot.level===l&&highlightedSlot.position===p;
      let bg='rgba(255,255,255,0.02)',bd='rgba(255,255,255,0.06)',tc='#444',nm='�?"',extra='';

      if(m){
        const st=getStatus(m);
        if(st.cls==='critico'){bg='rgba(255,71,87,0.1)';bd='#FF4757';tc='#FF4757'}
        else if(st.cls==='recomprar'){bg='rgba(255,184,48,0.1)';bd='#FFB830';tc='#FFB830'}
        else{bg='rgba(0,255,136,0.08)';bd='#00FF88';tc='#00FF88'}
        nm=m.desc.length>16?m.desc.substring(0,16)+'�?�':m.desc;
        extra=`<div style="font-size:9px;opacity:0.7;margin-top:1px">Qtd: ${m.qty}</div>`;
      }
      if(isHL){bg='rgba(255,215,0,0.25)';bd='#ffd700'}

      h+=`<td onclick="showSlotInfo('${s.id}',${l},${p})" style="background:${bg};border:1.5px solid ${bd};border-radius:6px;padding:6px 4px;text-align:center;cursor:pointer;min-width:70px;transition:all .15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="font-weight:600;font-size:8px;color:#666">P${p}</div>
        <div style="font-size:10px;color:${tc};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm}</div>${extra}</td>`;
    }
    h+='</tr>';
    // Shelf bar
    h+=`<tr><td></td><td colspan="${s.positions}" style="height:4px;background:linear-gradient(90deg,#c45a18,#e87730);border-radius:2px"></td></tr>`;
  }
  h+='</table></div>';
  h+='<div id="slotInfoArea" style="margin-top:12px"></div>';
  panel.innerHTML=h;
}

async function editShelfProp(id,prop,val){
  const sh=warehouseLayout.shelves.find(s=>s.id===id);
  if(!sh)return;
  sh[prop]=parseInt(val)||1;
  selectedShelf=sh;
  
  if (sh.dbId) {
    const payload = {
      pos_x: sh.x,
      pos_y: sh.y,
      width: sh.w,
      height: sh.h,
      levels: sh.levels,
      positions: sh.positions
    };
    const res = await API.put(`/warehouse/shelves/${sh.dbId}`, payload);
    if (res.success) {
      showToast(`Prateleira ${sh.id} atualizada!`, 'success');
    } else {
      showToast(`Erro ao atualizar prateleira: ${res.error}`, 'error');
    }
  }
  await initAppData();
}
function closeShelfDetail(){selectedShelf=null;const p=document.getElementById('shelfDetailPanel');if(p)p.remove();renderMap()}

function showSlotInfo(shelfId,level,position){
  const key=`${shelfId}-N${level}-P${position}`,mc=shelfAssignments[key],area=document.getElementById('slotInfoArea');
  if(!area)return;
  if(!mc){area.innerHTML=`<div style="color:#555;font-size:13px;padding:8px 0">�Y"� ${key} �?" Vazia</div>`;return}
  const m=materials.find(x=>x.code===mc);if(!m)return;
  const st=getStatus(m),sc=st.cls==='critico'?'#FF4757':st.cls==='recomprar'?'#FFB830':'#00FF88';
  area.innerHTML=`<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center">
    <div><div style="font-size:15px;font-weight:600;color:#F0F0F5">${m.desc}</div>
      <div style="font-size:12px;color:#8888A0;margin-top:4px"><span style="color:#6C63FF;font-weight:600">${m.code}</span> · ${m.brand} · ${m.model}</div>
      <div style="font-size:12px;color:#8888A0;margin-top:2px">�Y"� Prateleira <strong>${shelfId}</strong> · Nível <strong>N${level}</strong> · Posição <strong>P${position}</strong>${m.interchangeable?' · <span style="color:#00D4FF">�Y"" Intercambiável</span>':''}</div>
    </div>
    <div style="text-align:right"><div style="font-size:24px;font-weight:bold;color:${sc}">${m.qty}</div>
      <div style="font-size:11px;color:${sc}">${st.text}</div>
      <button class="btn btn-sm btn-secondary" style="margin-top:6px;font-size:10px" onclick="openMoreInfo('${m.code}')">�"�️ Detalhes</button>
    </div></div>`;
}

// �"?�"? Canvas Events �"?�"?
function setupMapEvents(){
  const c=document.getElementById('warehouseMap');if(!c)return;
  let resizing=null,resizeStart={};

  c.addEventListener('click',e=>{
    const rect=c.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const{s,ox,oy}=getScale(rect.width,rect.height);
    const gx=(mx-ox)/s,gy=(my-oy)/s;

    if(mapEditMode&&mapTool==='shelf'){
      const id=String.fromCharCode(65+warehouseLayout.shelves.length);
      const payload = {
        shelf_code: id,
        pos_x: Math.round(gx/10)*10,
        pos_y: Math.round(gy/10)*10,
        width: 120,
        height: 80,
        levels: 4,
        positions: 5
      };
      (async () => {
        const res = await API.post('/warehouse/shelves', payload);
        if (res.success) {
          showToast(`Prateleira ${id} adicionada!`, 'success');
          await initAppData();
        } else {
          showToast(`Erro ao adicionar prateleira: ${res.error}`, 'error');
        }
      })();
      return;
    }
    if(mapEditMode&&mapTool==='clear'){
      const hit=warehouseLayout.shelves.find(sh=>gx>=sh.x&&gx<=sh.x+sh.w&&gy>=sh.y&&gy<=sh.y+sh.h);
      if(hit && hit.dbId){
        (async () => {
          const res = await API.delete(`/warehouse/shelves/${hit.dbId}`);
          if (res.success) {
            showToast(`Prateleira ${hit.id} removida!`, 'success');
            selectedShelf=null;
            closeShelfDetail();
            await initAppData();
          } else {
            showToast(`Erro ao remover prateleira: ${res.error}`, 'error');
          }
        })();
      }
      return;
    }

    const hit=warehouseLayout.shelves.find(sh=>gx>=sh.x&&gx<=sh.x+sh.w&&gy>=sh.y&&gy<=sh.y+sh.h);
    if(hit){selectedShelf=hit;renderMap();renderShelfDetail()}
    else{closeShelfDetail()}
  });

  c.addEventListener('mousedown',e=>{
    if(!mapEditMode||mapTool!=='select')return;
    const rect=c.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const{s,ox,oy}=getScale(rect.width,500);
    const gx=(mx-ox)/s,gy=(my-oy)/s;
    // Check resize handle first
    const rh=warehouseLayout.shelves.find(sh=>gx>=sh.x+sh.w-8&&gx<=sh.x+sh.w+4&&gy>=sh.y+sh.h-8&&gy<=sh.y+sh.h+4);
    if(rh){resizing=rh;resizeStart={mx:e.clientX,my:e.clientY,w:rh.w,h:rh.h};return}
    const hit=warehouseLayout.shelves.find(sh=>gx>=sh.x&&gx<=sh.x+sh.w&&gy>=sh.y&&gy<=sh.y+sh.h);
    if(hit){dragShelf=hit;dragOff={x:gx-hit.x,y:gy-hit.y};c.style.cursor='grabbing'}
  });
  c.addEventListener('mousemove',e=>{
    if(resizing){
      const rect=c.getBoundingClientRect();const{s}=getScale(rect.width,500);
      resizing.w=Math.max(40,resizeStart.w+(e.clientX-resizeStart.mx)/s);
      resizing.h=Math.max(40,resizeStart.h+(e.clientY-resizeStart.my)/s);
      renderMap();return;
    }
    if(!dragShelf)return;
    const rect=c.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const{s,ox,oy}=getScale(rect.width,500);
    dragShelf.x=Math.round(((mx-ox)/s-dragOff.x)/10)*10;
    dragShelf.y=Math.round(((my-oy)/s-dragOff.y)/10)*10;
    renderMap();
  });
  c.addEventListener('mouseup', async ()=>{
    if(dragShelf||resizing){
      const activeShelf = dragShelf || resizing;
      if (activeShelf && activeShelf.dbId) {
        const payload = {
          pos_x: activeShelf.x,
          pos_y: activeShelf.y,
          width: activeShelf.w,
          height: activeShelf.h,
          levels: activeShelf.levels,
          positions: activeShelf.positions
        };
        const res = await API.put(`/warehouse/shelves/${activeShelf.dbId}`, payload);
        if (res.success) {
          console.log(`[MAP] Shelf ${activeShelf.id} updated in database.`);
        } else {
          showToast(`Erro ao atualizar prateleira ${activeShelf.id}: ${res.error}`, 'error');
        }
      }
      dragShelf=null;resizing=null;c.style.cursor='pointer';
      await initAppData();
    }
  });
}

// �"?�"? Search & Locate �"?�"?
function searchMap(){
  const q=(document.getElementById('mapSearch')?.value||'').toLowerCase().trim();
  highlightedSlot=null;if(!q){renderMap();return}
  for(const[key,code]of Object.entries(shelfAssignments)){
    const m=materials.find(x=>x.code===code);
    if(m&&(m.desc.toLowerCase().includes(q)||m.code.toLowerCase().includes(q)||m.brand.toLowerCase().includes(q))){
      const p=key.split('-');
      highlightedSlot={shelfId:p[0],level:parseInt(p[1].replace('N','')),position:parseInt(p[2].replace('P',''))};
      selectedShelf=warehouseLayout.shelves.find(s=>s.id===highlightedSlot.shelfId);
      showToast(`�Y"� ${m.desc} �?" Prat. ${p[0]}, ${p[1]}, ${p[2]}`,'success');
      renderMap();renderShelfDetail();
      setTimeout(()=>showSlotInfo(p[0],highlightedSlot.level,highlightedSlot.position),50);return;
    }
  }
  showToast('Item não encontrado no mapa','warning');renderMap();
}

function locateOnMap(code){
  switchTab('mapa');highlightedSlot=null;
  for(const[key,c]of Object.entries(shelfAssignments)){
    if(c===code){const p=key.split('-');
      highlightedSlot={shelfId:p[0],level:parseInt(p[1].replace('N','')),position:parseInt(p[2].replace('P',''))};
      selectedShelf=warehouseLayout.shelves.find(s=>s.id===highlightedSlot.shelfId);
      const m=materials.find(x=>x.code===code);
      showToast(`�Y"� ${m?m.desc:code} �?" Prat. ${p[0]}, ${p[1]}, ${p[2]}`,'success');
      renderMap();renderShelfDetail();
      setTimeout(()=>showSlotInfo(p[0],highlightedSlot.level,highlightedSlot.position),50);return;
    }
  }
  showToast('Item não indexado no mapa','warning');renderMap();
}

// �"?�"? Assign Modal �"?�"?
function openAssignModal(){
  const sel=document.getElementById('assignMaterial');
  sel.innerHTML=materials.map(m=>`<option value="${m.code}">${m.code} �?" ${m.desc}</option>`).join('');
  if(selectedShelf)document.getElementById('assignShelf').value=selectedShelf.id;
  document.getElementById('assignModal').classList.add('active');
}
function closeAssignModal(){document.getElementById('assignModal').classList.remove('active')}

async function handleAssignToMap(e){
  e.preventDefault();
  const code=document.getElementById('assignMaterial').value;
  const sid=document.getElementById('assignShelf').value;
  const lvl=parseInt(document.getElementById('assignLevel').value)||1;
  const pos=parseInt(document.getElementById('assignPosition')?.value)||1;

  const targetShelf = warehouseLayout.shelves.find(sh => sh.id === sid);
  const targetMat = materials.find(m => m.code === code);

  if (!targetShelf || !targetShelf.dbId) {
    showToast('Prateleira inválida ou não sincronizada!', 'error');
    return;
  }
  if (!targetMat || !targetMat.id) {
    showToast('Material inválido ou não sincronizado!', 'error');
    return;
  }

  const payload = {
    shelf_id: targetShelf.dbId,
    level: lvl,
    position: pos,
    material_id: targetMat.id
  };

  const res = await API.post('/warehouse/assign', payload);
  if (res.success) {
    showToast(`${targetMat.desc} �?' ${sid}-N${lvl}-P${pos}`, 'success');
    closeAssignModal();
    await initAppData();
  } else {
    showToast(`Erro ao indexar material: ${res.error}`, 'error');
  }
}

// �"?�"? Permissions �"?�"?
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
    
    const roleLabel = (role === 'superadmin' || role === 'admin') ? 'Admin'
      : role === 'manager' ? 'Gerente'
      : role === 'operator' ? 'Operador'
      : 'Visualizador';
    document.getElementById('userRoleBadge').textContent = roleLabel;
    document.getElementById('userRoleBadge').className = `eo-role-badge ${role}`;
    
    document.getElementById('dropName').textContent = u.name || 'Usuário';
    document.getElementById('dropEmail').textContent = u.email || 'N/A';
    const roleDropLabel = (role === 'superadmin' || role === 'admin') ? 'Administrador'
      : role === 'manager' ? 'Gerente'
      : role === 'operator' ? 'Operador'
      : 'Visualizador';
    document.getElementById('dropRole').textContent = roleDropLabel;
    
    document.getElementById('dropPlan').textContent = u.plan || 'Enterprise';
    document.getElementById('dropCorpName').textContent = u.company || 'Evah Ophim Ltda.';
    
    const logoEl = document.getElementById('dropCorpLogo');
    if (logoEl) {
      logoEl.src = u.logo || '../../images/Logotipo (Alpha).png';
      logoEl.style.display = 'block';
    }
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

// Identidade da Organizacao no Topbar
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
  setupMapEvents();
  loadOrgIdentity();
  await initAppData();
});

