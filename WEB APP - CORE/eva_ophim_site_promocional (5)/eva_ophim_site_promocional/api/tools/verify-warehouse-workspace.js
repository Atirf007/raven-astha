'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
async function main(){
 const {account_password}=await require('./secret-input')();let token,lastWrite=0;const checks=[];
 async function request(url,method='GET',body,expected=200,anonymous=false){
  if(method!=='GET'){const delay=Math.max(0,1300-(Date.now()-lastWrite));await new Promise(resolve=>setTimeout(resolve,delay));lastWrite=Date.now();}
  const response=await fetch('http://127.0.0.1:3000/api'+url,{method,headers:{...(!anonymous&&token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();assert.equal(response.status,expected,url+' '+(data.error||''));return data;
 }
 const session=await request('/auth/login','POST',{email:'admin@astah.com',password:account_password});token=session.token;
 assert.equal(session.user.org_id,'lab_astha_initial');
 if(process.argv.includes('--read-only')){
  const report=JSON.parse(await fs.readFile(path.join(__dirname,'../../tests/ui/artifacts/warehouse-live-results.json'),'utf8'));
  const stocks=await request('/warehouse/tabs');
  assert.equal(stocks.find(stock=>stock.id===report.child_id).layout_id,stocks.find(stock=>stock.id===report.parent_id).layout_id);
  assert.equal(stocks.find(stock=>stock.id===report.branch_stock_id).org_unit_id,report.branch_id);
  const child=await request('/warehouse/positions?warehouse_id='+report.child_id);
  assert.ok(child.length);assert.ok(!child.some(shelf=>shelf.code==='TESTE-R01'));
  const maps=await request('/warehouse/map-hub');assert.ok(maps.maps.some(map=>map.source==='cad'&&map.warehouse_ids.includes(report.child_id)&&map.items.some(item=>item.warehouse_id===report.child_id)));
  await request('/warehouse/tabs','GET',null,401,true);
  console.log('WAREHOUSE_READ_ONLY_CHECKS_PASSED');return;
 }
 await request('/warehouse/tabs','GET',null,401,true);checks.push('anonymous access rejected');
 const tabs=await request('/warehouse/tabs');const parent=tabs.find(stock=>stock.name==='TESTE UX — Armazém integrado');assert.ok(parent);
 const material=(await request('/materials?warehouse_id='+parent.id)).find(item=>item.description==='TESTE UX — Material na prateleira');assert.equal(material.location,'TESTE-R01-N2-P3');checks.push('browser-created material persisted in correct stock and position');
 const suffix=Date.now().toString(36);
 const branch=await request('/org/units','POST',{unit_type:'branch',code:'QA-'+suffix,name:'TESTE UX — Filial '+suffix,status:'active'},201);
 const branchId=branch.id;
 assert.ok(branchId);const branchStock=await request('/warehouse/tabs','POST',{name:'TESTE UX — Armazém da filial '+suffix,org_unit_id:branchId},201);
 assert.equal(branchStock.org_unit_id,branchId);checks.push('warehouse assigned to corporate branch');
 const child=await request('/warehouse/tabs','POST',{name:'TESTE UX — Estoque subdividido '+suffix,parent_id:parent.id},201);assert.equal(child.layout_id,parent.layout_id);checks.push('substock shares parent map');
 const childShelf='QA-'+suffix;
 const layout=await request('/warehouse/layout?warehouse_id='+parent.id);const blueprint=layout.blueprint_data;
 blueprint.floors[0].shelves.push({id:childShelf,warehouse_id:child.id,x:700,y:500,w:100,h:40,levels:2,positions:2});
 await request('/warehouse/layout','PUT',{warehouse_id:child.id,blueprint_data:blueprint});
 const childPositions=await request('/warehouse/positions?warehouse_id='+child.id);
 assert.deepEqual(childPositions.map(shelf=>shelf.code),[childShelf]);assert.ok(!(await request('/warehouse/positions?warehouse_id='+parent.id)).some(shelf=>shelf.code===childShelf));checks.push('shelves isolated per stock within shared map');
 await request('/materials','POST',{description:'TESTE UX — invalid position',warehouse_id:child.id,location:'TESTE-R01-N1-P1'},400);
 await request('/materials','POST',{description:'TESTE UX — missing warehouse'},400);checks.push('material rejects missing stock and other-stock position');
 const created=await request('/materials','POST',{description:'TESTE UX — Material do subestoque '+suffix,warehouse_id:child.id,location:childShelf+'-N2-P2',quantity:3,min_qty:1,max_qty:10},201);
 assert.equal(created.warehouse_id,child.id);
 const maps=await request('/warehouse/map-hub');const map=maps.maps.find(map=>map.id==='cad-'+parent.layout_id);
 assert.ok(map.warehouse_ids.includes(parent.id)&&map.warehouse_ids.includes(child.id));assert.ok(map.items.some(item=>item.code===material.code)&&map.items.some(item=>item.code===created.code));checks.push('shared map contains persisted materials from both stocks');
 await request('/warehouse/positions?warehouse_id=2147483647','GET',null,404);await request('/warehouse/tabs','POST',{name:'Invalid branch',org_unit_id:2147483647},404);checks.push('unknown stock and branch rejected');
 const report={date:new Date().toISOString(),database:'astha_raven_lab',synthetic:true,checks,parent_id:parent.id,child_id:child.id,branch_id:branchId,branch_stock_id:branchStock.id};
 await fs.writeFile(path.join(__dirname,'../../tests/ui/artifacts/warehouse-live-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:checks.length,checks,synthetic:true}));
}
main().catch(error=>{console.error('WAREHOUSE_VERIFICATION_FAILED',error.message);process.exitCode=1;});
