'use strict';
const crypto=require('node:crypto'),{validProfileImage}=require('../security/profile-image');
const catalog=require('../../renderer/js/personal-catalog');
const fail=message=>Object.assign(new Error(message),{status:400});
const key=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(value);
function text(value,max,label,optional=false){if(optional&&(value==null||value===''))return '';if(typeof value!=='string'||(!optional&&!value.trim())||value.length>max||/[\u0000-\u001f]/.test(value))throw fail(label+' inválido.');return value.trim();}
function compartments(value){if(value===undefined)return [];if(!Array.isArray(value)||value.length>20)throw fail('Use até 20 locais por móvel.');const ids=new Set(),names=new Set();return value.map(entry=>{if(!entry||!key(entry.id)||ids.has(entry.id))throw fail('Local inválido ou duplicado.');const name=text(entry.name,80,'Nome do local'),normalized=name.toLocaleLowerCase('pt-BR');if(names.has(normalized))throw fail('Use nomes diferentes para os locais deste móvel.');ids.add(entry.id);names.add(normalized);return {id:entry.id,name};});}
function clean(value,objects){if(value===undefined)return [];if(!Array.isArray(value)||value.length>300)throw fail('Use até 300 pertences por espaço.');const ids=new Set();return value.map(entry=>{
 if(!entry||!key(entry.id)||ids.has(entry.id))throw fail('Pertence inválido ou duplicado.');ids.add(entry.id);
 const item={id:entry.id,name:text(entry.name,120,'Nome do pertence'),description:text(entry.description,500,'Descrição',true),tags:text(entry.tags,200,'Palavras para busca',true),quantity:entry.quantity,objectId:entry.objectId||null,compartmentId:entry.compartmentId||null,status:entry.status||'stored',photo:entry.photo||null};
 if(entry.modelId!=null){if(typeof entry.modelId!=='string'||!Object.hasOwn(catalog.byId,entry.modelId))throw fail('Modelo do pertence inválido.');item.modelId=entry.modelId;}
 if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>9999||!['stored','missing','with-me','borrowed'].includes(item.status))throw fail('Quantidade ou situação do pertence inválida.');
 const object=objects.find(o=>o.id===item.objectId);if(item.objectId&&!object)throw fail('O móvel do pertence não está neste espaço.');if(item.compartmentId&&(!object||!object.compartments.some(c=>c.id===item.compartmentId)))throw fail('O local não pertence ao móvel selecionado.');
 if(item.photo&&(typeof item.photo!=='string'||item.photo.length>100000||!validProfileImage(item.photo)))throw fail('Foto do pertence inválida ou grande demais.');return item;
 });}
function location(space,item){const object=space.objects.find(o=>o.id===item.objectId),compartment=object?.compartments?.find(c=>c.id===item.compartmentId);return {space:space.name,object:object?.name||null,compartment:compartment?.name||null};}
function prepare(previous,data,confirmation,now){const old=previous?.belongings||[];if(confirmation!=null&&(!key(confirmation)||!data.belongings.some(item=>item.id===confirmation)))throw fail('Pertence a confirmar não encontrado.');
 for(const item of data.belongings){const before=old.find(o=>o.id===item.id),place=location(data,item),oldPlace=before&&location(previous,before),at=now.toISOString();item.history=[...(before?.history||[])];item.lastConfirmedAt=before?.lastConfirmedAt||null;item.lastConfirmedLocation=before?.lastConfirmedLocation||before?.history?.findLast(event=>event.at===before.lastConfirmedAt)?.location||null;
  const moved=before&&(item.objectId!==before.objectId||item.compartmentId!==before.compartmentId),renamed=before&&!moved&&JSON.stringify(oldPlace)!==JSON.stringify(place);
  const kind=!before?'added':moved?'moved':item.id===confirmation?'confirmed':item.status!==before.status?'status_changed':renamed?'location_updated':null;
  if(kind)item.history.push({id:crypto.randomUUID(),kind,at,location:place,status:item.status,...(moved||renamed?{from:oldPlace}:{})});
  if((!before||moved||item.id===confirmation)&&item.status==='stored'){item.lastConfirmedAt=at;item.lastConfirmedLocation=place;}
  item.history=item.history.slice(-50);
 }
}
module.exports={compartments,clean,prepare,location};
