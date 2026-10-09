/* Data-only rules shared by the browser and API. All internal lengths are cm. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./sistema-industrial-catalog'):root.ASTHAIndustrialCatalog);if(typeof module==='object'&&module.exports)module.exports=api;root.ASTHAIndustrialRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(catalog){
  const aliases={MILL:'001',DRILL:'003',BANDSAW:'007',TANK:'027',SILO:'033',ROBOT:'053',SCARA:'054',ROLLER:'065',ROLLER_MOTOR:'066',AGV:'085',COMPRESSOR:'119',PUMP:'124',EXTINGUISHER:'183',FENCE:'190'};
  function descriptor(item){const key=item.modelId||item.machineType;return catalog?.byId[aliases[key]?'ASTHA-3D-'+aliases[key]:key];}
  function bounded(value, fallback, min,max){const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error('Parâmetro fora dos limites');return n;}
  function validate(item){
    const def=descriptor(item);if(!def){if(String(item.modelId||item.machineType||'').startsWith('ASTHA-3D-'))throw Error('Modelo não encontrado');return item;}
    if(item.modelVersion&&item.modelVersion!==def.version)throw Error('Versão de modelo não suportada');
    if(item.machineType&&descriptor({machineType:item.machineType})?.id!==def.id)throw Error('Referência de modelo inconsistente');
    if(item.parameters!=null&&(typeof item.parameters!=='object'||Array.isArray(item.parameters)))throw Error('Parâmetros inválidos');
    const result={...item,modelId:def.id,modelVersion:def.version,machineType:def.id,parameters:{}};
    for(const [field,axis] of [['w','length'],['h','width'],['height3d','height']]){const limit=def.limits[axis];result[field]=bounded(item[field],def.dimensions[axis]*100,limit.min*100,limit.max*100);}
    for(const [key,schema] of Object.entries(def.parameters)){const value=bounded(item.parameters?.[key],schema.default,schema.min,schema.max);if(schema.integer&&!Number.isInteger(value))throw Error('Parâmetro inteiro obrigatório');result.parameters[key]=value;}
    if(Object.keys(item.parameters||{}).some(key=>!Object.hasOwn(def.parameters,key)))throw Error('Parâmetro não suportado pelo modelo');
    if(item.variant!==undefined&&!def.variants.some(v=>v.id===item.variant))throw Error('Variante inválida');result.variant=item.variant||'standard';result.animation=def.animation&&item.animation===true;
    result.elevation=bounded(item.elevation,0,0,10000);result.operationClearance=bounded(item.operationClearance,def.operationClearance*100,0,500);result.maintenanceClearance=bounded(item.maintenanceClearance,def.maintenanceClearance*100,0,500);
    result.layer=typeof item.layer==='string'?item.layer.trim().slice(0,80):'Equipamentos';result.groupId=typeof item.groupId==='string'?item.groupId.trim().slice(0,80):'';result.locked=item.locked===true;
    if(item.linkedAssetId!=null&&(!Number.isSafeInteger(Number(item.linkedAssetId))||Number(item.linkedAssetId)<1))throw Error('Ativo inválido');result.linkedAssetId=item.linkedAssetId?Number(item.linkedAssetId):null;
    return result;
  }
  function shape(item,margin=0){
    let x=Number(item.x||0)+Number(item.w||1)/2,y=Number(item.y||0)+Number(item.h||1)/2,w=Number(item.w||1),h=Number(item.h||1),angle=Number(item.angle||0);
    if(item.type==='pillar'||item.size!==undefined){x=Number(item.x||0);y=Number(item.y||0);w=h=Number(item.size||item.w||20);}
    if(item.x1!==undefined){x=(item.x1+item.x2)/2;y=(item.y1+item.y2)/2;w=Math.hypot(item.x2-item.x1,item.y2-item.y1);h=item.wallThickness||10;angle=Math.atan2(item.y2-item.y1,item.x2-item.x1);}
    const c=Math.cos(angle),s=Math.sin(angle),round=descriptor(item)?.footprint==='round',points=[];
    for(const [u,v] of round?Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8)*(w/2+margin),Math.sin(i*Math.PI/8)*(h/2+margin)]):[[-w/2-margin,-h/2-margin],[w/2+margin,-h/2-margin],[w/2+margin,h/2+margin],[-w/2-margin,h/2+margin]])points.push({x:x+u*c-v*s,y:y+u*s+v*c});return points;
  }
  function intersects(a,b){for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],axis={x:-(q.y-p.y),y:q.x-p.x},project=points=>points.map(v=>v.x*axis.x+v.y*axis.y),pa=project(a),pb=project(b);if(Math.max(...pa)<=Math.min(...pb)+.001||Math.max(...pb)<=Math.min(...pa)+.001)return false;}return true;}
  function elevationOverlaps(a,b,wallHeight=120){const height=item=>item.shelfHeight||item.wallHeight||(['wall','pillar'].includes(item.type)||item.x1!==undefined||item.size!==undefined?wallHeight:item.height3d||120),az=a.elevation||0,bz=b.elevation||0;return az<bz+height(b)-.01&&bz<az+height(a)-.01;}
  function neighbors(floor,selected){return ['machines','forklifts','docks','shelves','pillars','walls','addons'].flatMap(key=>(floor[key]||[]).filter(item=>item!==selected&&!(selected.id&&item.id===selected.id)&&item.visible!==false).map(item=>({item,collection:key})));}
  function conflicts(floor,selected,options={}){if(!selected||selected.visible===false)return [];const physical=shape(selected),operation=Number(selected.operationClearance||0),clearance=Number(selected.maintenanceClearance||0);return neighbors(floor,selected).flatMap(({item,collection})=>{if(!elevationOverlaps(selected,item,options.wallHeight))return [];const other=shape(item);if(intersects(physical,other))return [{id:item.id,label:item.label||item.id||collection,kind:'physical'}];if(operation&&intersects(shape(selected,operation),other))return [{id:item.id,label:item.label||item.id||collection,kind:'operational'}];if(clearance&&intersects(shape(selected,clearance),other))return [{id:item.id,label:item.label||item.id||collection,kind:'maintenance'}];return [];});}
  function ports(item){const def=descriptor(item);if(!def)return [];const c=Math.cos(item.angle||0),s=Math.sin(item.angle||0),center={x:item.x+item.w/2,y:item.y+item.h/2},recipe=def.geometry.generator;return def.connectors.map(port=>{let ratio=port.type==='material_flow'?.96:recipe==='valve'?.145:.5;if(recipe==='conveyor_incline'){const incline=Math.tan((item.parameters?.inclination??12)*Math.PI/180)*.8;ratio=(.57+(port.end>0?incline:0))/(.59+incline);}return {...port,x:center.x+port.end*item.w/2*c,y:center.y+port.end*item.w/2*s,z:(item.elevation||0)+item.height3d*ratio,angle:(item.angle||0)+(port.end<0?Math.PI:0)};});}
  function snap(floor,item,options={}){
    if(item.locked)return {item,connector:null};const result={...item},grid=Number(options.grid)||20,tolerance=options.tolerance??30;let best=null;
    if(options.connectors!==false){for(const {item:target} of neighbors(floor,item))for(const a of ports(item))for(const b of ports(target)){const distance=Math.hypot(a.x-b.x,a.y-b.y);if(a.type!==b.type||a.end===b.end||Math.abs(a.z-b.z)>10||distance>tolerance||best&&distance>=best.distance)continue;best={a,b,distance,targetId:target.id};}}
    if(best){result.angle=best.b.angle+Math.PI-(best.a.end<0?Math.PI:0);const own=ports(result).find(p=>p.id===best.a.id);result.x+=best.b.x-own.x;result.y+=best.b.y-own.y;return {item:result,connector:{targetId:best.targetId,targetPortId:best.b.id,portId:best.a.id}};}
    if(options.grid!==false){result.x=Math.round(result.x/grid)*grid;result.y=Math.round(result.y/grid)*grid;}return {item:result,connector:null};
  }
  return {descriptor,validate,shape,intersects,conflicts,ports,snap};
});
