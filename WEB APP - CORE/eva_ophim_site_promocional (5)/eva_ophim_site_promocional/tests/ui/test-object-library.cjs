const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const model=require('../../app/js/sistema-map-model.js');
const context={setCadTool(){},document:{addEventListener(){},querySelectorAll(){return [];}}};context.window=context;vm.runInNewContext(fs.readFileSync('app/js/sistema-industrial-catalog.js','utf8'),context);vm.runInNewContext(fs.readFileSync('app/js/sistema-object-library.js','utf8'),context);
const library=context.window.ASTHAObjectLibrary;
for(const [key,def] of Object.entries(library.catalog)){
 library.select(key);assert.equal(library.definition(def.tool).key,key);
 const source={id:key,machineType:key,modelId:def.id,modelVersion:def.version,x:35,y:65,w:def.w,h:def.d,height3d:def.height,angle:.6,label:def.name};
 const collection=def.tool==='forklift'?'forklifts':'machines';
 const saved=model.normalizeBlueprint(JSON.parse(JSON.stringify({floors:{0:{[collection]:[source]}}})));
 const item=saved.floors[0][collection][0];assert.equal(item.modelId,def.id);assert.equal(item.modelVersion,def.version);assert.equal(item.machineType,key);assert.equal(item.height3d,def.height);
 const changed=model.transformEntity(item,{label:'Editado',x:100,y:200,width:def.w*1.2,depth:def.d*.8,height:def.height,rotation:90});
 assert.equal(changed.machineType,key);assert.equal(changed.height3d,def.height);assert.equal(changed.angle,Math.PI/2);assert.equal(changed.w,def.w*1.2);
}
assert.equal(new Set(Object.values(library.catalog).map(d=>d.id)).size,257);
const roadmap=JSON.parse(fs.readFileSync('app/industrial-library-roadmap.json','utf8'));assert.equal(roadmap.items.length,248);assert.equal(roadmap.items.filter(i=>i.status==='implemented-parametric').length,248);for(const def of Object.values(library.catalog)){if(def.id.startsWith('ASTHA-3D-'))assert.equal(roadmap.items.find(i=>i.id===def.id).name,def.name);assert.equal(def.dimensions.length,def.w/100);}
console.log('257 modelos: contrato, IDs, persistência, dimensões, posição e rotação; catálogo planejado 248/248.');
