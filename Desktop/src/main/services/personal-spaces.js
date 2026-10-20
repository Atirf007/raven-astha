'use strict';
const crypto=require('node:crypto'),{byId}=require('../../renderer/js/personal-catalog'),{validProfileImage}=require('../security/profile-image');
const belongings=require('./personal-belongings');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const ownScope="BINARY org_id=BINARY ? AND JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(blueprint_data),blueprint_data,'{}'),'$.schema'))='astha-personal-v1' AND JSON_EXTRACT(IF(JSON_VALID(blueprint_data),blueprint_data,'{}'),'$.ownerId')=?";
const id=v=>{if(!Number.isSafeInteger(Number(v))||Number(v)<1)throw fail('Espaço não encontrado.',404);return Number(v);};
const text=(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.length>n||/[\u0000-\u001f]/.test(v))throw fail(label+' inválido.');return v.trim();};
const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw fail(label+' inválido.');return v;};
const key=v=>text(v,64,'Identificação');
function clean(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Espaço inválido.');
 const space={name:text(body.name,100,'Nome'),width:number(body.width,2,50,'Largura'),depth:number(body.depth,2,50,'Profundidade')};
 if(!Array.isArray(body.objects)||body.objects.length>150||!Array.isArray(body.tasks)||body.tasks.length>150)throw fail('Use até 150 objetos e 150 tarefas por espaço.');
 const objectIds=new Set();
 const objects=body.objects.map(o=>{
  if(!o||typeof o!=='object'||Array.isArray(o))throw fail('Objeto inválido.');
  const model=byId[o.modelId];if(!model||!Object.hasOwn(byId,o.modelId))throw fail('Modelo doméstico não encontrado.');
  const item={id:key(o.id),modelId:model.id,name:text(o.name,120,'Nome do objeto'),x:number(o.x,0,space.width,'Posição X'),z:number(o.z,0,space.depth,'Posição Z'),yaw:number(o.yaw,0,360,'Rotação'),width:number(o.width,.003,20,'Largura do objeto'),depth:number(o.depth,.003,20,'Profundidade do objeto'),height:number(o.height,.01,10,'Altura'),quantity:number(o.quantity,1,9999,'Quantidade'),color:o.color,photo:o.photo||null};
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)||objectIds.has(item.id)||!Number.isInteger(item.quantity)||!/^#[0-9a-f]{6}$/i.test(item.color))throw fail('Objeto inválido ou duplicado.');
  if(item.photo&&(typeof item.photo!=='string'||item.photo.length>100000||!validProfileImage(item.photo)))throw fail('Foto do objeto inválida ou grande demais.');
  const angle=item.yaw*Math.PI/180,ex=(item.width*Math.abs(Math.cos(angle))+item.depth*Math.abs(Math.sin(angle)))/2,ez=(item.depth*Math.abs(Math.cos(angle))+item.width*Math.abs(Math.sin(angle)))/2;
  if(item.x-ex<-.001||item.x+ex>space.width+.001||item.z-ez<-.001||item.z+ez>space.depth+.001)throw fail('Mantenha os objetos dentro das medidas do espaço.');
  item.compartments=belongings.compartments(o.compartments);objectIds.add(item.id);return item;
 });
 const taskIds=new Set();const tasks=body.tasks.map(t=>{
  if(!t||typeof t!=='object'||Array.isArray(t))throw fail('Tarefa inválida.');
  const task={id:key(t.id),title:text(t.title,200,'Título da tarefa'),objectId:t.objectId||null,due:t.due,recurrence:t.recurrence,priority:t.priority,status:t.status};
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(task.id)||taskIds.has(task.id)||!['none','daily','weekly','monthly'].includes(task.recurrence)||!['normal','high','low'].includes(task.priority)||!['pending','done'].includes(task.status))throw fail('Tarefa inválida ou duplicada.');
  if(task.objectId&&!objectIds.has(task.objectId))throw fail('O objeto da tarefa não pertence a este espaço.');
  if(typeof task.due!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(task.due)||Number(task.due.slice(0,4))<2000||Number(task.due.slice(0,4))>2100||!Number.isFinite(Date.parse(task.due+'Z'))||new Date(task.due+'Z').toISOString().slice(0,16)!==task.due)throw fail('Data e horário inválidos. Use um ano entre 2000 e 2100.');
  taskIds.add(task.id);return task;
 });
 const items=belongings.clean(body.belongings,objects);
 if(Buffer.byteLength(JSON.stringify({space,objects,tasks,belongings:items}),'utf8')>1024*1024)throw fail('Este espaço excede 1 MB. Reduza a quantidade de fotos.');
 return {...space,objects,tasks,belongings:items};
}
function nowLocal(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).replace(' ','T');}
function nextDue(due,recurrence,anchor){const d=new Date(due+'Z');if(recurrence==='monthly'){const y=d.getUTCFullYear(),m=d.getUTCMonth()+1,last=new Date(Date.UTC(y,m+1,0)).getUTCDate();d.setUTCDate(1);d.setUTCMonth(m);d.setUTCDate(Math.min(anchor,last));}else d.setUTCDate(d.getUTCDate()+(recurrence==='weekly'?7:1));return d.toISOString().slice(0,16);}
function advanceDue(due,recurrence,anchor,limit){let next=nextDue(due,recurrence,anchor);if(next>limit)return next;if(recurrence==='monthly'){const a=new Date(next+'Z'),b=new Date(limit+'Z'),months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();a.setUTCDate(1);a.setUTCMonth(a.getUTCMonth()+months);a.setUTCDate(Math.min(anchor,new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0)).getUTCDate()));next=a.toISOString().slice(0,16);if(next<=limit)next=nextDue(next,recurrence,anchor);return next;}const interval=(recurrence==='weekly'?7:1)*86400000,start=Date.parse(next+'Z'),steps=Math.floor((Date.parse(limit+'Z')-start)/interval)+1;return new Date(start+steps*interval).toISOString().slice(0,16);}
function prepare(previous,body,ownerId,now=new Date()){
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Espaço inválido.');
 const compatible={...body};if(previous){if(body.belongings===undefined)compatible.belongings=previous.belongings||[];else if(Array.isArray(body.belongings))compatible.belongings=body.belongings.map(item=>item&&item.modelId===undefined?{...item,...((previous.belongings||[]).find(old=>old.id===item.id)?.modelId?{modelId:previous.belongings.find(old=>old.id===item.id).modelId}:{})}:item);if(Array.isArray(body.objects))compatible.objects=body.objects.map(o=>o&&o.compartments===undefined?{...o,compartments:previous.objects.find(old=>old.id===o.id)?.compartments||[]}:o);}
 const data=clean(compatible),last=previous||{objects:[],tasks:[],history:[],version:0};
 belongings.prepare(previous,data,body.confirmBelongingId,now);
 for(const task of data.tasks){const old=last.tasks.find(t=>t.id===task.id);task.completedOccurrences=old?.completedOccurrences||0;task.lastCompletedAt=old?.lastCompletedAt||null;task.recurrenceAnchorDay=old?.due===task.due?old.recurrenceAnchorDay||Number(task.due.slice(8,10)):Number(task.due.slice(8,10));
  if(task.status==='done'&&old?.status!=='done'){task.lastCompletedAt=now.toISOString();task.completedOccurrences++;if(task.recurrence!=='none'){task.due=advanceDue(task.due,task.recurrence,task.recurrenceAnchorDay,nowLocal(now));task.status='pending';}}
 }
 const history=[...(last.history||[])];const event=(kind,label)=>history.push({id:crypto.randomUUID(),kind,label,at:now.toISOString()});
 if(!previous)event('space_created',data.name);else if(previous.name!==data.name||previous.width!==data.width||previous.depth!==data.depth)event('space_updated',data.name);
 for(const collection of ['objects','tasks']){const old=last[collection];for(const entry of data[collection]){const before=old.find(o=>o.id===entry.id);if(!before)event(collection==='objects'?'object_added':'task_added',entry.name||entry.title);else if(JSON.stringify(before)!==JSON.stringify(entry))event(collection==='tasks'&&entry.completedOccurrences>before.completedOccurrences?'task_done':collection==='tasks'?'task_updated':'object_updated',entry.name||entry.title);}for(const entry of old)if(!data[collection].some(o=>o.id===entry.id))event(collection==='tasks'?'task_removed':'object_removed',entry.name||entry.title);}
 for(const item of data.belongings){const before=(last.belongings||[]).find(o=>o.id===item.id);if(!before)event('belonging_added',item.name);else if(JSON.stringify(before)!==JSON.stringify(item))event('belonging_updated',item.name);}for(const item of last.belongings||[])if(!data.belongings.some(o=>o.id===item.id))event('belonging_removed',item.name);
 const result={...data,schema:'astha-personal-v1',ownerId,version:last.version+1,archived:last.archived||false,history:history.slice(-100),updatedAt:now.toISOString()};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>1024*1024)throw fail('Este espaço excede 1 MB. Reduza a quantidade de fotos.');
 return result;
}
function decode(row){try{const data=typeof row.blueprint_data==='string'?JSON.parse(row.blueprint_data):row.blueprint_data;return {...data,id:row.id};}catch(_){throw fail('Não foi possível ler este espaço.',503);}}
async function get(db,user,spaceId){const [rows]=await db.execute(`SELECT id,blueprint_data FROM warehouse_layout WHERE id=? AND ${ownScope}`,[id(spaceId),user.org_id,user.id]);if(!rows.length)throw fail('Espaço não encontrado.',404);return decode(rows[0]);}
async function list(db,user){const [rows]=await db.execute(`SELECT id,blueprint_data FROM warehouse_layout WHERE ${ownScope} ORDER BY id LIMIT 51`,[user.org_id,user.id]);return rows.map(decode).map(s=>({...s,objects:s.objects.map(({photo,...o})=>({...o,hasPhoto:!!photo})),belongings:(s.belongings||[]).map(({photo,...item})=>({...item,hasPhoto:!!photo}))}));}
async function create(db,user,body){const data=prepare(null,body,user.id),connection=await db.getConnection();try{await connection.beginTransaction();const [owner]=await connection.execute('SELECT id FROM users WHERE id=? AND BINARY org_id=BINARY ? AND is_active=1 FOR UPDATE',[user.id,user.org_id]);if(!owner.length)throw fail('Sessão inválida.',401);const [rows]=await connection.execute(`SELECT COUNT(*) AS total FROM warehouse_layout WHERE ${ownScope}`,[user.org_id,user.id]);if(rows[0].total>=50)throw fail('Limite de 50 espaços atingido.',409);const [result]=await connection.execute('INSERT INTO warehouse_layout (org_id,name,room_w,room_h,door_x,door_y,door_w,blueprint_data) VALUES (?,?,?,?,0,0,0,?)',[user.org_id,data.name,Math.round(data.width*100),Math.round(data.depth*100),JSON.stringify(data)]);await connection.commit();return {...data,id:result.insertId};}catch(e){await connection.rollback();throw e;}finally{connection.release();}}
async function save(db,user,spaceId,body){const previous=await get(db,user,spaceId);if(!body||body.version!==previous.version)throw fail('Este espaço mudou em outra guia. Recarregue antes de salvar.',409);const data=prepare(previous,body,user.id);const [result]=await db.execute(`UPDATE warehouse_layout SET name=?,room_w=?,room_h=?,blueprint_data=? WHERE id=? AND ${ownScope} AND CAST(JSON_EXTRACT(blueprint_data,'$.version') AS UNSIGNED)=?`,[data.name,Math.round(data.width*100),Math.round(data.depth*100),JSON.stringify(data),id(spaceId),user.org_id,user.id,previous.version]);if(!result.affectedRows)throw fail('Este espaço mudou em outra guia. Recarregue antes de salvar.',409);return {...data,id:previous.id};}
async function archive(db,user,spaceId,version,archived){const previous=await get(db,user,spaceId);if(version!==previous.version)throw fail('Recarregue este espaço antes de continuar.',409);const next={...previous,archived,version:previous.version+1,updatedAt:new Date().toISOString()};delete next.id;const [result]=await db.execute(`UPDATE warehouse_layout SET blueprint_data=? WHERE id=? AND ${ownScope} AND CAST(JSON_EXTRACT(blueprint_data,'$.version') AS UNSIGNED)=?`,[JSON.stringify(next),previous.id,user.org_id,user.id,previous.version]);if(!result.affectedRows)throw fail('Espaço alterado em outra guia.',409);return {...next,id:previous.id};}
async function moveBelonging(pool,user,spaceId,itemId,body){
 if(!body||id(spaceId)===id(body.targetSpaceId))throw fail('Escolha outro espaço para a transferência.');
 const db=await pool.getConnection();try{await db.beginTransaction();
 const source=await get(db,user,spaceId),target=await get(db,user,body.targetSpaceId);
 if(source.archived||target.archived)throw fail('Restaure os espaços antes de transferir pertences.',409);
 if(body.version!==source.version||body.targetVersion!==target.version)throw fail('Um espaço mudou. Recarregue antes de transferir.',409);
 const item=(source.belongings||[]).find(entry=>entry.id===itemId);if(!item)throw fail('Pertence não encontrado.',404);if((target.belongings||[]).some(entry=>entry.id===itemId))throw fail('Identificação já existe no destino.',409);
 const now=new Date(),nextSource=prepare(source,{...source,belongings:source.belongings.filter(entry=>entry.id!==itemId)},user.id,now),nextTarget=prepare(target,{...target,belongings:[...(target.belongings||[]),{...item,objectId:body.objectId||null,compartmentId:body.compartmentId||null}]},user.id,now),moved=nextTarget.belongings.find(entry=>entry.id===itemId);
 moved.history=[...(item.history||[]),{id:crypto.randomUUID(),kind:'moved',at:now.toISOString(),from:belongings.location(source,item),location:belongings.location(nextTarget,moved),status:moved.status}].slice(-50);moved.lastConfirmedAt=moved.status==='stored'?now.toISOString():item.lastConfirmedAt||null;moved.lastConfirmedLocation=moved.status==='stored'?belongings.location(nextTarget,moved):item.lastConfirmedLocation||item.history?.findLast(event=>event.at===item.lastConfirmedAt)?.location||null;
 for(const [old,next] of [[source,nextSource],[target,nextTarget]]){if(Buffer.byteLength(JSON.stringify(next),'utf8')>1024*1024)throw fail('Espaço excede 1 MB.');const [result]=await db.execute(`UPDATE warehouse_layout SET blueprint_data=? WHERE id=? AND ${ownScope} AND CAST(JSON_EXTRACT(blueprint_data,'$.version') AS UNSIGNED)=?`,[JSON.stringify(next),old.id,user.org_id,user.id,old.version]);if(!result.affectedRows)throw fail('Um espaço mudou. Recarregue antes de transferir.',409);}
 await db.commit();return {source:{...nextSource,id:source.id},target:{...nextTarget,id:target.id}};
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}
module.exports={clean,prepare,nextDue,nowLocal,get,list,create,save,archive,moveBelonging,ownScope};
