'use strict';
const assert=require('node:assert/strict');
async function main(){
 const {account_password}=await require('./secret-input')();let token;const checks=[];
 async function request(url,method='GET',body,status=200){
  if(method!=='GET')await new Promise(resolve=>setTimeout(resolve,1400));
  const res=await fetch('http://127.0.0.1:3000/api'+url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await res.json();assert.equal(res.status,status,url+' '+(data.error||''));return data;
 }
 const login=await request('/auth/login','POST',{email:'admin@astah.com',password:account_password});token=login.token||login.data?.token;assert.ok(token);
 const tabs=await request('/warehouse/tabs');const lab=tabs.find(s=>s.name==='Armazém do laboratório');assert.ok(lab);
 const baseline=await request('/warehouse/insights?warehouses='+lab.id);assert.equal(Number(baseline.summary.materials),5);checks.push('Real MySQL aggregates match five laboratory materials');
 await request('/warehouse/insights?warehouses=2147483647','GET',null,404);await request('/warehouse/insights?from=2026-99-99','GET',null,400);checks.push('Invalid and unknown filters rejected');
 await request('/movements/entry','POST',{code:'LAB-MAT-1',quantity:2,responsible:'TESTE UX',reason:'Reposição hipotética',notes:'Verificação dos gráficos'},201);
 await request('/movements/exit','POST',{code:'LAB-MAT-1',quantity:2,responsible:'TESTE UX',reason:'Manutenção hipotética',notes:'Verificação dos gráficos'},201);
 const after=await request('/warehouse/insights?warehouses='+lab.id);assert.equal(Number(after.summary.quantity),Number(baseline.summary.quantity));assert.ok(after.series.some(r=>r.type==='entrada'&&Number(r.value)>=251));assert.ok(after.series.some(r=>r.type==='saida'&&Number(r.value)>=251));assert.ok(after.attribution.some(r=>r.reason==='Manutenção hipotética'));checks.push('Entry and exit preserve balance, captured valuation and purpose');
 const empty=tabs.find(s=>s.name.startsWith('TESTE UX — Armazém da filial'));assert.ok(empty);
 await request('/warehouse/maps/'+empty.layout_id,'DELETE');assert.ok(!(await request('/warehouse/tabs')).some(s=>s.id===empty.id));assert.ok((await request('/warehouse/archived-maps')).some(m=>m.id===empty.layout_id));
 await request('/warehouse/maps/'+empty.layout_id+'/restore','POST',{});assert.ok((await request('/warehouse/tabs')).some(s=>s.id===empty.id));checks.push('Map deletion hides stocks and restoration recovers them');
 await require('node:fs/promises').writeFile(require('node:path').join(__dirname,'../../tests/ui/artifacts/stock-insights-live.json'),JSON.stringify({date:new Date().toISOString(),checks,synthetic:true},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
}
main().catch(e=>{console.error('INSIGHTS_VERIFICATION_FAILED',e.message);process.exitCode=1;});
