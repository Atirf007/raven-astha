/* Shared blueprint edits: both canvases use these same objects and undo history. */
window.CadObjectEditor = (() => {
  let panel, form, list, mode, status, copyButton, pasteButton, attached, pickGroup, marker, drag;
  const types={wall:'Parede',shelf:'Prateleira',pillar:'Pilar',door:'Porta',window:'Janela',stairs:'Escada',zone:'Zona',path:'Caminho',machine:'Máquina',forklift:'Empilhadeira',dock:'Doca',addon:'Modelo'};
  const fields={label:'Nome / descrição',x:'X (m)',y:'Y (m)',width:'Comprimento (m)',depth:'Largura (m)',height:'Altura (m)',rotation:'Rotação (graus)'};
  function item(){return typeof selectedItem==='undefined'||!selectedItem?null:blueprint.floors[currentFloor]?.[getArrayName(selectedItem.type)]?.[selectedItem.index];}
  function initialize(){
    const cad=document.querySelector('.eo-cad-container');if(!cad||panel)return;
    panel=document.createElement('section');panel.className='cad-object-panel';panel.setAttribute('aria-label','Propriedades do objeto CAD');
    const title=document.createElement('strong');title.textContent='Editar objeto · 2D e 3D';panel.append(title);
    const choose=document.createElement('label');choose.textContent='Objeto';list=document.createElement('select');list.id='cadObjectSelect';list.setAttribute('aria-label','Objeto');choose.append(list);panel.append(choose);
    const actions=document.createElement('div');actions.className='cad-object-actions';copyButton=document.createElement('button');pasteButton=document.createElement('button');copyButton.type=pasteButton.type='button';copyButton.textContent='Copiar';copyButton.title='Copiar (Ctrl+C)';pasteButton.textContent='Colar';pasteButton.title='Colar (Ctrl+V)';copyButton.onclick=()=>{copyCadItem();refresh();};pasteButton.onclick=async()=>{try{await pasteCadItem();refresh();}catch(error){status.textContent=error.message;}};actions.append(copyButton,pasteButton);panel.append(actions);
    list.onchange=()=>{const [type,index]=list.value.split(':');selectedItem=list.value?{type,index:Number(index)}:null;renderCad();update3DScene();};
    const ml=document.createElement('label');ml.textContent='Comando no 3D';mode=document.createElement('select');mode.id='cad3DMode';mode.setAttribute('aria-label','Comando no 3D');
    for(const [value,text] of [['navigate','Navegar'],['select','Selecionar'],['move','Mover'],['rotate','Girar'],['scale','Redimensionar']]){const o=document.createElement('option');o.value=value;o.textContent=text;mode.append(o);}ml.append(mode);panel.append(ml);
    const hint=document.createElement('p');hint.textContent='Escolha um comando e arraste no 3D. Use os campos para medidas precisas. Publicar grava uma revisão; Desfazer e Refazer preservam o histórico local.';panel.append(hint);
    form=document.createElement('form');form.className='cad-object-fields';for(const event of ['input','change'])form.addEventListener(event,()=>form.dataset.pending='true');
    for(const [key,text] of Object.entries(fields)){const label=document.createElement('label');label.textContent=text;const input=document.createElement('input');input.name=key;input.type=key==='label'?'text':'number';input.step='any';input.required=true;if(key==='label'){input.maxLength=120;input.required=false;}label.append(input);form.append(label);}
    const apply=document.createElement('button');apply.type='submit';apply.textContent='Aplicar alterações';apply.className='btn btn-primary';form.append(apply);
    form.onsubmit=e=>{e.preventDefault();try{const data=item();if(!data)return;const normalized=ASTHAMapModel.normalizeEntity(data,selectedItem.type,currentFloor,selectedItem.index);const edited=ASTHAMapModel.transformEntity(normalized,measureValues());Object.assign(data,window.CadIndustrialEditor?CadIndustrialEditor.apply(data,edited):edited);form.dataset.pending='false';saveHistory();renderCad();update3DScene();status.textContent='Alterações aplicadas ao desenho. Salve o mapa para gravar.';}catch(error){status.textContent=error.message;}};
    panel.append(form);status=document.createElement('p');status.setAttribute('role','status');panel.append(status);cad.append(panel);window.CadIndustrialEditor?.initialize(panel,form,status);
  }
  function measureValues(){const values=Object.fromEntries(new FormData(form));for(const key of ['x','y','width','depth','height'])values[key]=Number(values[key])*100;return values;}
  function refresh(){
    initialize();if(!panel||typeof blueprint==='undefined')return;
    const floorSelect=document.getElementById('cadFloorSelect');if(floorSelect){const floors=Object.keys(blueprint.floors).sort((a,b)=>a-b),signature=floors.join(',');if(floorSelect.dataset.floors!==signature){floorSelect.dataset.floors=signature;floorSelect.replaceChildren(...floors.map(level=>{const o=document.createElement('option');o.value=level;o.textContent=Number(level)===0?'Térreo':'Pavimento '+level;return o;}));}floorSelect.value=currentFloor;}
    const value=selectedItem?`${selectedItem.type}:${selectedItem.index}`:'';
    if(form.dataset.selection!==value){form.dataset.selection=value;form.dataset.pending='false';}
    list.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Selecione um objeto';list.append(empty);
    for(const [collection,type] of Object.entries(ASTHAMapModel.COLLECTIONS))for(const [index,obj] of (blueprint.floors[currentFloor]?.[collection]||[]).entries()){
      const o=document.createElement('option');o.value=`${type}:${index}`;o.textContent=`${types[type]} · ${obj.label||obj.id}${obj.visible===false?' (oculto)':''}`;list.append(o);
    }
    list.value=value;copyButton.disabled=!selectedItem;pasteButton.disabled=typeof cadClipboard==='undefined'||!cadClipboard;const selected=item();form.hidden=!selected;window.CadIndustrialEditor?.fill(selected,panel);if(!selected||form.dataset.pending==='true')return;
    const data=ASTHAMapModel.normalizeEntity(selected,selectedItem.type,currentFloor,selectedItem.index);
    const line=data.x1!==undefined, zone=data.type==='zone';
    const values={label:data.label||data.id,x:line?data.x1:data.x,y:line?data.y1:data.y,width:line&&!zone?Math.hypot(data.x2-data.x1,data.y2-data.y1):zone?Math.abs(data.x2-data.x1):data.w,depth:zone?Math.abs(data.y2-data.y1):data.type==='wall'?data.wallThickness||10:data.h,height:data.type==='shelf'?data.shelfHeight:['wall','pillar'].includes(data.type)?data.wallHeight||ASTHAMapModel.sceneDimensions(blueprint).wallHeight:data.height3d,rotation:line&&!zone?Math.atan2(data.y2-data.y1,data.x2-data.x1)*180/Math.PI:(data.angle||0)*180/Math.PI};
    for(const key of Object.keys(fields))form.elements.namedItem(key).value=typeof values[key]==='number'?Number((values[key]/(['x','y','width','depth','height'].includes(key)?100:1)).toFixed(4)):values[key]||'';
  }
  function attachScene(view){
    attached=view;refresh();if(!panel)return;
    if(pickGroup){pickGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});if(pickGroup.parent)pickGroup.parent.remove(pickGroup);}
    if(marker){marker.geometry.dispose();marker.material.dispose();if(marker.parent)marker.parent.remove(marker);marker=null;}
    pickGroup=new THREE.Group();view.scene.add(pickGroup);
    const plan=ASTHAMapModel.createScenePlan(blueprint);
    for(const e of plan.entities.filter(e=>e.level===Number(currentFloor))){
      const line=e.source.x1!==undefined, zone=e.type==='zone';const width=line&&!zone?e.length:zone?Math.abs(e.source.x2-e.source.x1):e.width;
      const depth=line&&!zone?10:zone?Math.max(1,Math.abs(e.source.y2-e.source.y1)):e.depth;
      const height=['zone','path'].includes(e.type)?2:e.height;
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(1,width),height,Math.max(1,depth)),new THREE.MeshBasicMaterial({visible:false}));
      mesh.position.set(e.position.x,e.position.y+height/2,e.position.z);mesh.rotation.y=line&&!zone?-e.lineAngle:e.rotationY;
      const collection=getArrayName(e.type),index=blueprint.floors[currentFloor][collection].findIndex(o=>o.id===e.id);mesh.userData={type:e.type,index};pickGroup.add(mesh);
      if(selectedItem?.type===e.type&&selectedItem.index===index){marker=new THREE.BoxHelper(mesh,ASTHAIndustrialRules.conflicts(blueprint.floors[currentFloor],e.source,{wallHeight:plan.dimensions.wallHeight}).some(h=>h.kind==='physical')?0xdc2626:0x0e7490);view.scene.add(marker);for(const [margin,color] of [[e.source.maintenanceClearance,0xb7791f],[e.source.operationClearance,0x7c3aed]])if(margin){const points=ASTHAIndustrialRules.shape(e.source,margin).map(p=>new THREE.Vector3(p.x,e.position.y+1,p.y)),ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.7}));pickGroup.add(ring);}}
    }
    view.scene.updateMatrixWorld(true);
    if(view.renderer.domElement.dataset.objectEditing)return;
    const canvas=view.renderer.domElement;canvas.dataset.objectEditing='true';
    const raycaster=new THREE.Raycaster();
    function ray(e){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),attached.camera);}
    function planePoint(e){ray(e);return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-Number(currentFloor)*ASTHAMapModel.sceneDimensions(blueprint).floorHeight),new THREE.Vector3());}
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||mode.value==='navigate')return;
      ray(e);const hit=raycaster.intersectObjects(pickGroup.children,false).find(hit=>hit.object.userData.type);if(!hit)return;
      e.stopImmediatePropagation();e.preventDefault();attached.controls.enabled=false;
      selectedItem={...hit.object.userData};refresh();const point=planePoint(e);
      form.dataset.pending='false';refresh();drag={original:{...item()},values:measureValues(),point,startX:e.clientX,mode:mode.value,changed:false};canvas.setPointerCapture(e.pointerId);renderCad();update3DScene();
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(!drag||drag.mode==='select'||item()?.locked)return;e.stopImmediatePropagation();const data=item();if(!data)return;
      Object.assign(data,drag.original);const delta=e.clientX-drag.startX;
      if(drag.mode==='move'){const point=planePoint(e);if(!point||!drag.point)return;const dx=Math.round(point.x-drag.point.x),dy=Math.round(point.z-drag.point.z);if(data.x1!==undefined){data.x1+=dx;data.x2+=dx;data.y1+=dy;data.y2+=dy;}else{data.x+=dx;data.y+=dy;}}
      else {const values={...drag.values};if(drag.mode==='rotate')values.rotation=Number(values.rotation)+delta*.5;else {const factor=Math.max(.1,1+delta/200);values.width=Number(values.width)*factor;values.depth=Number(values.depth)*factor;}try{Object.assign(data,ASTHAMapModel.transformEntity(data,values));}catch(_){return;}}
      drag.changed=true;renderCad();update3DScene();
    },true);
    function finish(e,cancel=false){if(!drag)return;e.stopImmediatePropagation();if(cancel)Object.assign(item(),drag.original);else if(drag.changed){try{window.CadIndustrialEditor?.snap(item());if(drag.mode==='move')window.CadIndustrialEditor?.moveGroup(item(),drag.original);saveHistory();}catch(error){Object.assign(item(),drag.original);status.textContent=error.message;}}drag=null;attached.controls.enabled=true;window.cadUserIsOrbiting=false;renderCad();update3DScene();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
    canvas.addEventListener('pointerup',e=>finish(e),true);canvas.addEventListener('pointercancel',e=>finish(e,true),true);
  }
  return {refresh,attachScene};
})();

