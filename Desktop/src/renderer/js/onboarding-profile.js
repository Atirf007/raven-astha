'use strict';
let obProfilePhoto=null,obProfilePhotoDirty=false,obProfilePhotoBusy=false,obProfilePhotoVersion=0,obProfilePhotoServerLoaded=false,obCorporateCopy;
function selectWorkspaceType(type){
  if(!['personal','corporate'].includes(type))return;
  if(!obCorporateCopy)obCorporateCopy={title:document.querySelector('#step4 .ob-title').textContent,subtitle:document.querySelector('#step4 .ob-subtitle').textContent,label:document.getElementById('obOrgName').previousElementSibling.textContent,profile:document.querySelector('#step2 .ob-subtitle').textContent};
  workspaceType=type;sessionStorage.setItem('astha_onboarding_type',type);
  const personal=type==='personal';
  document.querySelectorAll('[name=obWorkspaceType]').forEach(input=>{input.checked=input.value===type;input.closest('label').classList.toggle('selected',input.checked);});
  document.getElementById('obCorporateFields').hidden=personal;
  document.getElementById('optJoin').hidden=personal;
  document.getElementById('obPositionLabel').closest('.ob-field').hidden=personal;
  document.querySelector('#step2 .ob-subtitle').textContent=personal?'Complete seu perfil para identificar seu espaço pessoal. A foto é opcional.':obCorporateCopy.profile;
  document.querySelector('#step4 .ob-title').textContent=personal?'Seu espaço pessoal':obCorporateCopy.title;
  document.querySelector('#step4 .ob-subtitle').textContent=personal?'Dê um nome ao seu espaço. Não é necessário preencher dados de empresa ou cargos.':obCorporateCopy.subtitle;
  document.getElementById('obOrgName').previousElementSibling.textContent=personal?'Nome do espaço *':obCorporateCopy.label;
  document.getElementById('obOrgName').placeholder=personal?'Ex.: Meu espaço pessoal':'Ex.: Nome da empresa';
  document.querySelector('label[for=obOrgLogo]').textContent=personal?'Marca do espaço (opcional)':'Logo da empresa (opcional)';
  document.getElementById('obOrgLogo').nextElementSibling.textContent=personal?'Personalize seu espaço com uma marca. PNG, JPG ou WebP de até 2 MB.':'A miniatura aparecerá junto aos membros da organização. PNG, JPG ou WebP de até 2 MB.';
  if(personal)selectOrgType('new');
  buildNav();updateNav();
}
async function startProfile(){if(!workspaceType){showAlert('Escolha Pessoal ou Corporativo para continuar.');return;}try{await apiFetch('/workspace/type','PUT',{type:workspaceType});goStep(2);}catch(error){showAlert(error.message||'Não foi possível salvar o tipo de uso.');}}
function renderProfilePhoto(){ProfileAvatar.render(document.getElementById('obPhotoPreview'),{name:document.getElementById('obName').value||'Usuário',avatar_url:obProfilePhoto});}
function initializeProfilePhoto(user,authoritative=false){if(obProfilePhotoDirty||obProfilePhotoBusy||(!authoritative&&obProfilePhotoServerLoaded))return;if(authoritative)obProfilePhotoServerLoaded=true;obProfilePhoto=typeof user?.avatar_url==='string'?user.avatar_url:null;renderProfilePhoto();}
function profilePhotoLoading(){return obProfilePhotoBusy;}
function profilePhotoChanges(){return obProfilePhotoDirty?{avatar_url:obProfilePhoto}:{};}
function removeProfilePhoto(){obProfilePhotoVersion++;obProfilePhotoBusy=false;obProfilePhotoDirty=true;obProfilePhoto=null;document.getElementById('obProfilePhoto').value='';document.getElementById('obProfileContinue').disabled=false;document.getElementById('obPhotoStatus').textContent='Foto removida. A alteração será salva ao continuar.';renderProfilePhoto();}
async function readProfilePhoto(input){
  const file=input.files?.[0];if(!file)return;
  const version=++obProfilePhotoVersion;obProfilePhotoBusy=true;document.getElementById('obProfileContinue').disabled=true;document.getElementById('obPhotoStatus').textContent='Preparando foto…';
  let bitmap;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000||!file.size)throw Error('Escolha PNG, JPG ou WebP de até 2 MB.');
    bitmap=await createImageBitmap(file);
    if(bitmap.width>12000||bitmap.height>12000||bitmap.width*bitmap.height>40_000_000)throw Error('A resolução da foto é grande demais. Reduza a imagem.');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const side=Math.min(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
    const photo=canvas.toDataURL('image/webp',.8);if(photo.length>400000)throw Error('Reduza o tamanho da foto.');
    if(version!==obProfilePhotoVersion)return;
    obProfilePhoto=photo;obProfilePhotoDirty=true;renderProfilePhoto();document.getElementById('obPhotoStatus').textContent='Prévia pronta. Sua foto será salva ao continuar.';
  }catch(error){if(version===obProfilePhotoVersion){input.value='';document.getElementById('obPhotoStatus').textContent=error.message||'Não foi possível abrir a foto.';showAlert(error.message||'Arquivo de foto inválido.');}}
  finally{bitmap?.close();if(version===obProfilePhotoVersion){obProfilePhotoBusy=false;document.getElementById('obProfileContinue').disabled=false;}}
}
