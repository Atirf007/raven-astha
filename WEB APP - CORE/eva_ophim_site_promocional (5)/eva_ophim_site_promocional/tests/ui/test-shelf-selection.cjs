const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/sistema.html','utf8');
const handler=source.match(/window\.mhSelectShelf2D = function\(id\) \{([\s\S]*?)\n          \};/);assert.ok(handler);
const map={id:6,items:[{id:1,location:'SH-1'},{id:2,location:'SH-2'}]};
let rendered=null,focused=null;
const context={window:{_mapHub:{maps:[map],currentMapId:6}},build2DShelves(value){rendered=value;},_w3d:{focusShelf(id){focused=id;}}};
vm.runInNewContext('window.mhSelectShelf2D=function(id){'+handler[1]+'}',context);
for(const id of ['SH-1','SH-2','SH-1']){context.window.mhSelectShelf2D(id);assert.equal(context.window.mhSelectedShelf2D,id);assert.equal(rendered,map);assert.equal(focused,id);}
context._w3d=null;context.window.mhSelectShelf2D('SH-2');assert.equal(context.window.mhSelectedShelf2D,'SH-2');
context.window._mapHub.currentMapId=99;rendered=null;context.window.mhSelectShelf2D('SH-1');assert.equal(rendered,null);
for(const script of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){if(script[1].trim())new vm.Script(script[1]);}
console.log('Trocas SH-1 → SH-2 → SH-1 atualizam grade e foco; sem 3D e mapa ausente tratados; scripts válidos.');
