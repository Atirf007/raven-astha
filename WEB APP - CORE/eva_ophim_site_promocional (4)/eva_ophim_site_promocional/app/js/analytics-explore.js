(() => {
 'use strict';
 const states=new WeakMap(),make=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const number=v=>v===null?'Ausente':Number(v).toLocaleString('pt-BR',{maximumSignificantDigits:7});
 function begin(root,dataset){const state={root,dataset,marks:[],predicate:null,label:'Todas as observações',page:0};states.set(root,state);return state;}
 function draw(state){
  if(!state.panel)return;
  const rows=state.dataset?.rows||[],selected=state.predicate?rows.filter(state.predicate):rows;
  state.panel.replaceChildren();const header=make('div');header.className='analytics-actions';const clear=make('button','Limpar seleção');clear.type='button';clear.disabled=!state.predicate;clear.onclick=()=>select(state,null,'Todas as observações');header.append(make('h4','Registros ligados aos gráficos'),clear);state.panel.append(header);
  const info=make('p',state.label+' · '+selected.length+' de '+rows.length+' observações.');info.setAttribute('role','status');state.panel.append(info);
  state.panel.append(make('p','Seleção de visualização: a versão publicada e a exportação integral permanecem preservadas.'));
  const wrap=make('div'),table=make('table'),head=make('thead'),line=make('tr'),body=make('tbody');wrap.className='analytics-table-wrap';
  const life=state.dataset.kind==='life',category=state.dataset.kind==='categories',operational=state.dataset.source==='application-condition',readingLabels=new Map(operational?rows.map((row,index)=>[row.subject_id,(index+1)+' · '+state.dataset.provenance.records[index].recorded_at]):[]);
  for(const title of [operational?'Leitura · data armazenada':'Registro',life?'Duração':'Valor',...(life?['Evento']:category?['Categoria']:[])]){const cell=make('th',title);cell.scope='col';line.append(cell);}head.append(line);
  for(const row of selected.slice(state.page*100,(state.page+1)*100)){const tr=make('tr');for(const value of [readingLabels.get(row.subject_id)||row.subject_id,number(life?row.duration:row.value),...(life?[row.event?'Falha':'Censura']:category?[row.category]:[])])tr.append(make('td',value));body.append(tr);}table.append(head,body);wrap.append(table);state.panel.append(wrap);
  if(selected.length>100){const nav=make('div');nav.className='analytics-actions';const previous=make('button','Registros anteriores'),next=make('button','Próximos registros');previous.type=next.type='button';previous.disabled=state.page===0;next.disabled=(state.page+1)*100>=selected.length;previous.onclick=()=>{state.page--;draw(state);};next.onclick=()=>{state.page++;draw(state);};nav.append(previous,make('span','Página '+(state.page+1)+' de '+Math.ceil(selected.length/100)),next);state.panel.append(nav);}
  if(category){if(state.dataset.comparison){const totals=[0,0];selected.forEach(row=>{totals[row.comparison_version]+=row.value;});state.panel.prepend(make('p',state.dataset.comparison.map((label,i)=>label+': '+number(totals[i])+' '+state.dataset.variable.unit).join(' · ')));}else{const total=selected.reduce((sum,row)=>sum+row.value,0);state.panel.prepend(make('p','Contribuição selecionada: '+number(total)+' '+state.dataset.variable.unit));}}
 }
 function select(state,predicate,label){state.predicate=predicate;state.label=label;state.page=0;state.selected=predicate&&state.dataset?.rows?state.dataset.rows.filter(predicate):null;for(const mark of state.marks){const matched=!predicate||!state.selected||state.selected.some(mark.predicate);mark.element.style.opacity=matched?'1':'.22';mark.element.setAttribute('aria-pressed',String(Boolean(predicate&&matched)));}draw(state);}
 function mark(root,element,label,predicate){let state=states.get(root);if(!state)state=begin(root,null);element.classList.add('analytics-interactive-mark');element.setAttribute('tabindex','0');element.setAttribute('role','button');element.setAttribute('aria-label',label);element.setAttribute('aria-pressed','false');state.marks.push({element,predicate});if(state.predicate){const matched=state.selected?.some(predicate);element.style.opacity=matched?'1':'.22';element.setAttribute('aria-pressed',String(Boolean(matched)));}const act=()=>select(state,predicate,label);element.addEventListener('click',act);element.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();act();}});}
 function panel(root){const state=states.get(root);if(!state?.dataset)return;state.panel=make('section');state.panel.className='analytics-linked-records';root.append(state.panel);draw(state);}
 function inspect(svg,figure){
  const marks=[...svg.querySelectorAll('.analytics-interactive-mark')];if(!marks.length)return;
  const hint=make('p','Passe o cursor, use Tab ou selecione um ponto para consultar os registros.');hint.className='analytics-chart-hint';hint.setAttribute('role','status');figure.append(hint);
  for(const mark of marks){const show=()=>{hint.textContent=mark.getAttribute('aria-label');};mark.addEventListener('pointerenter',show);mark.addEventListener('focus',show);}
 }
 window.AnalyticsExplore={begin,mark,panel,inspect,prepare(root){const state=states.get(root);if(state)state.marks=state.marks.filter(item=>root.contains(item.element));}};
})();
