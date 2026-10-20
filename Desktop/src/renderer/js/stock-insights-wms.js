document.addEventListener('DOMContentLoaded',()=>{
 window.wmsStockView=StockInsights.mount(document.getElementById('wmsStockInsights'),{onData(data){
  const s=data.summary,put=(id,value)=>{document.getElementById(id).textContent=value;};
  put('statTotal',Number(s.materials)||0);put('statCritical',Math.max(0,(Number(s.critical)||0)-(Number(s.zero)||0)));put('statZero',Number(s.zero)||0);
  put('statTotalQty',(Number(s.quantity)||0).toLocaleString('pt-BR'));put('statTotalValue',formatBRL(Number(s.stock_value)||0));
  drawDonut(Math.max(0,(Number(s.materials)||0)-(Number(s.critical)||0)),Math.max(0,(Number(s.critical)||0)-(Number(s.zero)||0)),Number(s.zero)||0);
  const body=document.getElementById('criticalTableBody');body.replaceChildren();
  const criticalItems=[...(data.critical_items||[])].sort((a,b)=>{
   const quantityA=Number(a.quantity)||0,quantityB=Number(b.quantity)||0;
   return (quantityA<=0?0:1)-(quantityB<=0?0:1)||quantityA-quantityB;
  });
  criticalItems.forEach(m=>{const row=document.createElement('tr');[Number(m.quantity)<=0?'Recomprar':'Abaixo mín.',m.code,m.description,Number(m.quantity).toLocaleString('pt-BR'),m.location||'Não localizado'].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});body.append(row);});
  if(!criticalItems.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.className='dashboard-critical-empty';cell.textContent='Nenhum item crítico ou abaixo do mínimo.';row.append(cell);body.append(row);}
 }});
});
