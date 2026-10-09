const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('selecting an imported addon renders its footprint and shared selection handles',()=>{
 const source=fs.readFileSync('app/js/sistema-builder-2d.js','utf8');
 const drawing=source.slice(source.indexOf('function drawBoundingBox('),source.indexOf('window.openSaveModal ='));
 const calls=[],ctx=new Proxy({}, {get:(obj,key)=>key in obj?obj[key]:(...args)=>calls.push([key,...args]),set:(obj,key,value)=>(obj[key]=value,true)});
 const addon={id:'imported-1',importId:12,name:'PeÃ§a autoral',x:20,y:30,w:100,h:80,angle:.5};
 const runtime={ctx,cadCanvas:{width:800,height:600},panX:0,panY:0,zoom:1,currentFloor:0,blueprint:{floors:{0:{addons:[addon]}}},selectedItem:{type:'addon',index:0},hoveredItem:null,tempWall:null,drawBlueprintGrid(){},getItemData:()=>addon,window:{}};
 vm.createContext(runtime);vm.runInContext(drawing,runtime);
 assert.doesNotThrow(()=>runtime.renderCad());
 assert.ok(calls.some(([method])=>method==='arc'),'shared corner handles are rendered');
 assert.ok(calls.some(([method,x,y,w,h])=>method==='strokeRect'&&x===20&&y===30&&w===100&&h===80),'selection bounds match the imported object');
});
