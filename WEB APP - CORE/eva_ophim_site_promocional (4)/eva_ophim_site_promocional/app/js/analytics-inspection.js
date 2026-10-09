(() => {
 'use strict';
 const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 let generation=0,context=null;
 const format=value=>value==null?'Não se aplica':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:6});
 const table=(headers,rows)=>{const wrap=make('div',null,'analytics-table-wrap'),t=make('table'),head=make('thead'),tr=make('tr'),body=make('tbody');for(const text of headers){const th=make('th',text);th.scope='col';tr.append(th);}head.append(tr);for(const values of rows){const row=make('tr');values.forEach(value=>row.append(make('td',value)));body.append(row);}t.append(head,body);wrap.append(t);return wrap;};
 function render(data){
  const out=$('inspectionContent');out.replaceChildren();
  out.append(make('p',`Versão ${data.version} · ${data.variable.name} · ${data.variable.unit} · ${data.grain}`,'analytics-subtle'));
  const summary=make('div',null,'analytics-results');
  for(const [label,value] of [['Observações',data.counts.total],['Valores observados',data.counts.valid],['Ausentes',data.counts.missing],...(data.kind==='life'?[['Falhas',data.counts.events],['Censuras',data.counts.censored]]:[['Zero medido',data.counts.zero]])]){const card=make('div',null,'analytics-result');card.append(make('strong',label),make('span',format(value)));summary.append(card);}out.append(summary);
  out.append(make('h3','Origem desta versão'));
  const graph=make('div',null,'analytics-lineage'+(data.nodes.length>3?' analytics-lineage-long':''));graph.setAttribute('aria-label','Caminho dos dados publicados');
  const inspector=make('section',null,'analytics-inspector');inspector.setAttribute('aria-live','polite');
  const select=(item,selected)=>{graph.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===selected)));inspector.replaceChildren(make('h3',item.title),make('p',item.description),table(['Propriedade','Valor preservado'],item.details));};
  data.nodes.forEach((item,index)=>{const btn=make('button');btn.type='button';btn.setAttribute('aria-pressed','false');btn.append(make('small',String(index+1).padStart(2,'0')),make('strong',item.title),make('span',item.description));btn.addEventListener('click',()=>select(item,btn));graph.append(btn);if(index<data.nodes.length-1){const edge=make('span',data.edges[index].label,'analytics-lineage-edge');graph.append(edge);}});
  out.append(graph,inspector);select(data.nodes[0],graph.querySelector('button'));
  out.append(make('h3','Requisitos dos métodos'));
  const methods=make('div',null,'analytics-methods');for(const method of data.methods){const card=make('section',null,'analytics-method');card.append(make('span',method.compatible?'Requisitos básicos atendidos':'Requisitos não atendidos',method.compatible?'analytics-badge':'analytics-badge analytics-badge-muted'),make('h4',method.label),make('p',method.reason));methods.append(card);}out.append(methods);
  const limits=make('details'),caption=make('summary','Limites desta inspeção');limits.append(caption);data.limitations.forEach(text=>limits.append(make('p',text)));out.append(limits);
  out.append(make('h3','Observações e registros de origem'));
  const observations=make('div');observations.id='inspectionObservations';out.append(observations);appendRows(data);
  const hash=make('details');hash.append(make('summary','Identificação da versão'),make('p',`SHA-256: ${data.sha256}`,'analytics-subtle'));out.append(hash);
 }
 function appendRows(data){
  const target=$('inspectionObservations'),internal=data.source==='application-condition';
  target.querySelector('[data-more-observations]')?.remove();
  target.append(table(data.kind==='life'?['Sujeito','Duração','Evento']:data.kind==='categories'?['Sujeito','Categoria','Valor']:internal?['Registro do estudo','Data armazenada','Origem','Valor']:['Sujeito','Valor'],data.observations.map(row=>data.kind==='life'?[row.subject_id,format(row.duration),row.event?'Falha':'Censurado']:data.kind==='categories'?[row.subject_id,row.category,format(row.value)]:internal?[row.subject_id,row.origin.recorded_at,({manual:'Manual',iot:'Telemetria',inspection:'Inspeção'})[row.origin.source]||row.origin.source,row.value===null?'Ausente':format(row.value)]:[row.subject_id,row.value===null?'Ausente':format(row.value)])));
  if(data.has_more){const more=make('button','Carregar mais observações');more.type='button';more.dataset.moreObservations='true';more.addEventListener('click',async()=>{const g=generation,c=context;more.disabled=true;try{const response=await API.get(`${c.endpoint}?after=${data.next_cursor}`);if(g!==generation||!$('inspectionDialog').open)return;if(!response.success){$('inspectionDialog').querySelector('[data-feedback]').textContent=response.error;return;}if(response.data.sha256!==c.sha256){$('inspectionDialog').querySelector('[data-feedback]').textContent='A versão recebida diverge da versão conferida. Reabra a inspeção.';return;}appendRows(response.data);}catch{if(g===generation)$('inspectionDialog').querySelector('[data-feedback]').textContent='Não foi possível carregar esta página.';}finally{if(g===generation)more.disabled=false;}});target.append(more);}
 }
 async function open(endpoint){
  const g=++generation,dialog=$('inspectionDialog');context={endpoint};dialog.returnFocus=document.activeElement;dialog.querySelector('[data-feedback]').textContent='';$('inspectionContent').textContent='Conferindo a versão publicada…';dialog.showModal();
  try{const response=await API.get(endpoint);if(g!==generation||!dialog.open)return;if(!response.success){$('inspectionContent').textContent=response.error;return;}context.sha256=response.data.sha256;render(response.data);}catch{if(g===generation&&dialog.open)$('inspectionContent').textContent='Não foi possível conferir os dados.';}
 }
 window.AnalyticsInspection={open:(study,snapshot)=>open(`/analytics/studies/${encodeURIComponent(study)}/snapshots/${encodeURIComponent(snapshot)}/inspection`),openJob:job=>open(`/analytics/jobs/${encodeURIComponent(job)}/inspection`)};
 document.addEventListener('DOMContentLoaded',()=>{$('inspectionDialog').addEventListener('close',()=>{generation++;context=null;});});
})();
