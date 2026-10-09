(() => {
 'use strict';
 const $=id=>document.getElementById(id),el=(tag,text)=>{const item=document.createElement(tag);if(text!=null)item.textContent=text;return item;};
 let studyId=null,sequence=0,selection=null,cursor=null;
 const labels={added:'Incluído',removed:'Removido',changed:'Alterado',unchanged:'Sem alteração'},origins={'manual-entry':'Digitação','file-import':'Arquivo','application-condition':'Leituras EAM'};
 const feedback=value=>{$('comparisonDialog').querySelector('[data-feedback]').textContent=value||'';};
 function invalidate(){sequence++;selection=null;cursor=null;$('comparisonContent').replaceChildren();$('moreComparison').hidden=true;feedback('');}
 function open(id,versions,selected){studyId=id;invalidate();const form=$('comparisonForm');form.reset();for(const key of ['from','to']){const select=form.elements[key];select.replaceChildren();versions.forEach(version=>select.append(new Option(version.label,version.id)));}
  form.elements.to.value=selected;form.elements.from.value=versions.find(version=>version.id!==selected)?.id||'';const dialog=$('comparisonDialog');dialog.returnFocus=document.activeElement;dialog.showModal();
 }
 function observation(row,origin,kind){if(!row)return '—';const value=kind==='life'?`${row.duration} · ${row.event?'Falha':'Censurado'}`:row.value===null?'Ausente':Number(row.value).toLocaleString('pt-BR',{maximumSignificantDigits:16});if(kind==='categories')return row.category+' · '+value;return origin?`${value} · ${origin.recorded_at} · ${origin.source}`:value;}
 async function load(after=null){
  const version=sequence,id=studyId,pair=selection;if(!pair)return;const submit=$('comparisonForm').querySelector('[type=submit]'),more=$('moreComparison');submit.disabled=true;more.disabled=true;
  try{
   const response=await API.get(`/analytics/studies/${id}/comparison?from=${encodeURIComponent(pair.from)}&to=${encodeURIComponent(pair.to)}${after===null?'':'&after='+after}`);
   if(version!==sequence||!$('comparisonDialog').open)return;if(!response.success){feedback(response.error);return;}
   const data=response.data,out=$('comparisonContent');feedback('');
   if(after===null){
    out.replaceChildren();const versions=el('div');versions.className='analytics-comparison-versions';
    for(const item of [data.before,data.after]){const card=el('section');card.className='analytics-result';card.append(el('h3',`Versão ${item.version}`),el('p',`${item.row_count} observações · ${item.variable.name} · ${item.variable.unit}`),el('p',origins[item.source]||item.source));const identity=el('details');identity.append(el('summary','Identificação da versão'),el('p',`SHA-256: ${item.sha256}`));card.append(identity);versions.append(card);}out.append(versions);
    out.append(el('p',`Incluídos: ${data.summary.added} · Removidos: ${data.summary.removed} · Alterados: ${data.summary.changed} · Sem alteração: ${data.summary.unchanged}`));
    if(data.metadata_changes.length){out.append(el('h3','Mudanças de contexto'));for(const change of data.metadata_changes)out.append(el('p',`${change.field==='variable'?'Variável/unidade':change.field==='source'?'Origem':'Proveniência'}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`));}
    const interpretation=el('details');interpretation.append(el('summary','Como interpretar a comparação'));for(const text of data.limitations)interpretation.append(el('p',text));out.append(interpretation);
    if(window.AnalyticsCurves){const compareCurves=el('button','Comparar gráficos destas versões'),curves=el('section');compareCurves.type='button';out.append(compareCurves,curves);compareCurves.onclick=async()=>{compareCurves.disabled=true;curves.textContent='Carregando versões para comparar…';try{const versions=await Promise.all([pair.from,pair.to].map(snapshot=>API.get(`/analytics/studies/${id}/snapshots/${encodeURIComponent(snapshot)}`)));if(version!==sequence||!$('comparisonDialog').open)return;curves.replaceChildren();if(versions.some(item=>!item.success)){curves.textContent=versions.find(item=>!item.success).error;return;}AnalyticsCurves.compare(curves,versions[0].data,versions[1].data);}catch(_){if(version===sequence&&$('comparisonDialog').open)curves.textContent='Não foi possível carregar as curvas. A comparação de registros permanece disponível.';}finally{compareCurves.disabled=false;}};}
    const wrap=el('div');wrap.className='analytics-table-wrap';const table=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody');body.id='comparisonRows';['Sujeito/registro','Mudança',`Antes · ${data.before.variable.unit}`,`Depois · ${data.after.variable.unit}`].forEach(text=>{const th=el('th',text);th.scope='col';tr.append(th);});head.append(tr);table.append(head,body);wrap.append(table);out.append(wrap);if(!data.total_changes)out.append(el('p','Nenhuma linha mudou. Confira também as mudanças de contexto acima.'));
   }
   for(const change of data.changes){const tr=el('tr');[change.subject_id,labels[change.status],observation(change.before,change.origin_before,data.before.kind),observation(change.after,change.origin_after,data.after.kind)].forEach(text=>tr.append(el('td',text)));$('comparisonRows').append(tr);}
   cursor=data.next_cursor;more.hidden=!data.has_more;
  }finally{submit.disabled=false;more.disabled=false;}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const dialog=$('comparisonDialog'),form=$('comparisonForm');dialog.addEventListener('close',invalidate);form.addEventListener('change',invalidate);
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;invalidate();if(form.elements.from.value===form.elements.to.value){feedback('Selecione duas versões diferentes.');return;}selection={from:form.elements.from.value,to:form.elements.to.value};load();});
  $('moreComparison').addEventListener('click',()=>{if(cursor!==null)load(cursor);});
 });window.AnalyticsComparison={open};
})();
