(() => {
  const $ = id => document.getElementById(id);
  const make = (tag,text,className) => { const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el; };
  const dialogs=new Map();let assetRequest=null,reliabilityRequest=0,reliabilityPending=0,reliabilityKey='',reliabilitySignature='';
  function modal(id,title,content) {
    const dialog=make('dialog',null,'eam-ux-dialog');dialog.id=id;dialog.setAttribute('aria-labelledby',id+'Heading');
    const header=make('header'),heading=make('h3',title),close=make('button',null,'eam-ux-close');heading.id=id+'Heading';close.type='button';close.setAttribute('aria-label','Fechar janela');
    close.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    close.addEventListener('click',()=>dialog.close());header.append(heading,close);dialog.append(header,...content);document.body.append(dialog);dialogs.set(id,dialog);
    dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});return dialog;
  }
  function open(id){const dialog=dialogs.get(id);if(dialog&&!dialog.open)dialog.showModal();}
  function fillAssets(rows) {
    window.eamAssetsForWorkspace=rows;
    for(const id of ['eamOrderAsset','eamReliabilityAsset','eamConditionAsset']) {
      const select=$(id);if(!select)continue;const value=select.value;
      select.replaceChildren(new Option(rows.length?'Selecione o ativo':'Nenhum ativo cadastrado',''),...rows.map(row=>new Option(`${row.asset_code} — ${row.name}`,String(row.id))));
      if(rows.some(row=>String(row.id)===value))select.value=value;
    }
  }
  async function assets() {
    if(assetRequest)return assetRequest;
    assetRequest=(async()=>{const result=await API.get('/eam/assets');if(result.success&&Array.isArray(result.data)){fillAssets(result.data);return result.data;}throw new Error(result.error||'Não foi possível carregar os ativos.');})().finally(()=>{assetRequest=null;});return assetRequest;
  }
  function action(parent,label,id) { const button=make('button',label,'btn btn-secondary btn-sm');button.type='button';button.addEventListener('click',()=>{const asset=$('eamReliabilityAsset').value;if($('eamConditionAsset'))$('eamConditionAsset').value=asset;open(id);});parent.append(button); }
  function labeledForm(form) {
    [...form.children].forEach(field=>{if(!['INPUT','SELECT'].includes(field.tagName))return;const label=make('label',field.getAttribute('aria-label')||field.placeholder||({eamFailureCategory:'Categoria',eamReadingSource:'Origem'}[field.id])||'Valor');field.before(label);label.append(field);});
  }
  function chart(target,title,series) {
    const card=make('section',null,'eam-reliability-chart');card.append(make('h4',title));
    const valid=series.filter(item=>item.value!==null&&Number.isFinite(Number(item.value)));
    if(!valid.length){card.append(make('p','Ainda não há dados suficientes para este gráfico.'));target.append(card);return;}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 440 ${valid.length*56+12}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',title+': '+valid.map(item=>`${item.label} ${Number(item.value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} h`).join(', '));
    const max=Math.max(1,...valid.map(item=>Number(item.value)));
    valid.forEach((item,index)=>{const text=document.createElementNS(svg.namespaceURI,'text');text.setAttribute('x','0');text.setAttribute('y',String(index*56+18));text.setAttribute('font-size','13');text.textContent=`${item.label} · ${Number(item.value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} h`;const bar=document.createElementNS(svg.namespaceURI,'rect');bar.setAttribute('x','0');bar.setAttribute('y',String(index*56+28));bar.setAttribute('width',String(Math.max(0,Number(item.value))/max*420));bar.setAttribute('height','14');bar.setAttribute('rx','5');bar.setAttribute('fill',item.color);svg.append(text,bar);});card.append(svg);target.append(card);
  }
  async function reliability(event,{background=false}={}) {
    if(background&&reliabilityPending)return;
    event?.preventDefault();const assetId=Number($('eamReliabilityAsset').value),from=$('eamReliabilityFrom').value,to=$('eamReliabilityTo').value,target=$('eamReliabilityResult'),charts=$('eamReliabilityCharts'),identity=$('eamReliabilityIdentity');const request=++reliabilityRequest;
    const key=JSON.stringify([assetId,from,to]),status=$('eamReliabilityLiveStatus');
    if(key!==reliabilityKey){target.replaceChildren();charts.replaceChildren();reliabilitySignature='';reliabilityKey=key;}
    if(!assetId){identity.textContent='Selecione um equipamento para visualizar seus indicadores.';return;}
    if(!from||!to||from>to){identity.textContent='Informe um período válido.';return;}
    const asset=(window.eamAssetsForWorkspace||[]).find(item=>Number(item.id)===assetId);identity.textContent=`${asset?.asset_code||''} · ${asset?.name||'Equipamento'} · ${({active:'Ativo',inactive:'Inativo',maintenance:'Em manutenção',decommissioned:'Desativado'})[asset?.status]||''}`;
    if(!target.children.length)target.textContent='Carregando indicadores…';
    if(status)status.textContent='Conferindo os registros…';
    let result;reliabilityPending++;try{result=await API.get(`/eam/reliability/assets/${assetId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);}catch(_){result={success:false,error:'Sem conexão com o servidor.'};}finally{reliabilityPending--;}
    if(request!==reliabilityRequest)return;
    if(!result.success){if(status)status.textContent=(result.error||'Indicadores indisponíveis.')+' Os gráficos anteriores não foram confirmados agora.';if(!target.children.length)target.textContent=result.error||'Indicadores indisponíveis.';return;}
    if(status)status.textContent='Conferido em '+new Date().toLocaleTimeString('pt-BR')+' · atualização automática a cada 5 s.';
    const signature=JSON.stringify(result.data);if(signature===reliabilitySignature)return;reliabilitySignature=signature;charts.replaceChildren();
    const data=result.data;target.replaceChildren();
    const hours=value=>value==null?'Sem dados':`${Number(value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} h`;
    for(const [label,value] of [['Falhas registradas',data.failures??'Sem observação'],['Ordens corretivas',data.corrective_orders],['Paradas',hours(data.downtime_hours)],['Disponibilidade no calendário',data.calendar_availability==null?'Sem dados':`${(Number(data.calendar_availability)*100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`],['MTBF',hours(data.mtbf_hours)],['MTTR',hours(data.mttr_hours)],['MTWS',hours(data.mtws_hours)],['TCO',formatBRL(data.tco)]]){const card=make('div',null,'eo-component-card');card.append(make('strong',label),make('span',value));target.append(card);}
    for(const warning of data.warnings||[]) charts.append(make('p',warning,'eam-reliability-note'));
    chart(charts,'Cobertura do período',[{label:'Operação observada',value:data.exposure?.observed_operation_hours??null,color:'#111827'},{label:'Sem observação de operação',value:data.exposure?.unknown_hours??null,color:'#94a3b8'},{label:'Paradas registradas',value:data.downtime_hours,color:'#f43f5e'}]);
    chart(charts,'Tempos médios',[{label:'Entre falhas (MTBF)',value:data.mtbf_hours,color:'#111827'},{label:'Reparo (MTTR)',value:data.mttr_hours,color:'#8b5cf6'},{label:'Espera de material (MTWS)',value:data.mtws_hours,color:'#f59e0b'}]);
    if(!background){$('eamConditionAsset').value=String(assetId);loadEamCondition();}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const form=$('eamOrderCreateForm');if(!form)return;
    const previousPanel=$('eamOrderCreatePanel');modal('eamOrderCreateDialog','Nova ordem de manutenção',[form]);previousPanel.remove();
    const orderStatus=make('p','',null);orderStatus.setAttribute('role','status');$('eamOrderCreateDialog').append(orderStatus);
    const prepareOrder=async()=>{orderStatus.textContent='Carregando ativos…';const submit=form.querySelector('[type=submit]');submit.disabled=true;try{const rows=await assets();orderStatus.textContent=rows.length?'':'Cadastre um ativo antes de abrir uma ordem.';submit.disabled=!rows.length;}catch(error){orderStatus.textContent=error.message;} };
    window.EamUx={prepareOrder,assets};
    window.toggleEamOrderForm=async visible=>{if(!visible){$('eamOrderCreateDialog').close();return;}open('eamOrderCreateDialog');await prepareOrder();};
    const panel=$('eam-reliability'),condition=panel.querySelector('details'),failure=panel.querySelectorAll('details')[1];
    const conditionForms=[...condition.querySelectorAll('form')];conditionForms.forEach(labeledForm);
    modal('eamConditionRulesDialog','Limites de condição',[conditionForms[0]]);modal('eamConditionReadingDialog','Registrar leitura',[conditionForms[1]]);
    const conditionResult=$('eamConditionResult');panel.append(conditionResult);condition.hidden=true;
    const failureForm=failure.querySelector('form');labeledForm(failureForm);modal('eamFailureCodesDialog','Classificações de falha',[failureForm,$('eamFailureCodes')]);failure.remove();
    const heading=make('h3','Confiabilidade dos equipamentos'),actions=make('div',null,'eam-ux-actions');panel.prepend(heading,actions);
    action(actions,'Cadastrar limite','eamConditionRulesDialog');action(actions,'Registrar leitura','eamConditionReadingDialog');action(actions,'Classificações de falha','eamFailureCodesDialog');
    const compare=panel.querySelector('[onclick="loadEamReliabilitySummary()"]');const compareWrapper=compare.parentElement;const summary=$('eamReliabilitySummary');modal('eamReliabilityCompareDialog','Comparação de equipamentos',[summary]);compare.removeAttribute('onclick');compare.addEventListener('click',()=>{open('eamReliabilityCompareDialog');loadEamReliabilitySummary();});actions.append(compare);compareWrapper.remove();
    const filters=$('eamReliabilityAsset').closest('form');filters.className='eam-reliability-filters';for(const [id,label] of [['eamReliabilityAsset','Equipamento'],['eamReliabilityFrom','De'],['eamReliabilityTo','Até']]){const field=$(id),existing=field.closest('label');if(existing){const caption=existing.querySelector('.eo-input-label');if(caption)caption.textContent=label;}else{const wrapper=make('label',label);field.before(wrapper);wrapper.append(field);}field.addEventListener('change',()=>reliability());}
    const today=new Date(),start=new Date(today);start.setDate(start.getDate()-30);const date=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;$('eamReliabilityFrom').value=date(start);$('eamReliabilityTo').value=date(today);
    const identity=make('p','Selecione um equipamento para visualizar seus indicadores.','eam-reliability-identity');identity.id='eamReliabilityIdentity';filters.after(identity);
    const charts=make('div',null,'eam-reliability-charts');charts.id='eamReliabilityCharts';$('eamReliabilityResult').after(charts);window.loadEamReliability=reliability;
    const live=make('div',null,'eam-live-controls'),liveStatus=make('p','Os indicadores acompanham os registros automaticamente.','eam-reliability-note'),pause=make('button','Pausar atualização','btn btn-secondary btn-sm');liveStatus.id='eamReliabilityLiveStatus';liveStatus.setAttribute('role','status');pause.type='button';pause.setAttribute('aria-pressed','false');live.append(liveStatus,pause);filters.append(live);
    let timer=null,paused=false,stopped=false,polling=false;
    function visible(){return !document.hidden&&$('panel-eam').classList.contains('active')&&panel.classList.contains('active');}
    async function tick(){if(polling)return;clearTimeout(timer);if(stopped||paused||document.hidden)return;polling=true;try{if(visible()){if(!charts.closest('[hidden]'))await reliability(null,{background:true});else if(!$('eamReliabilitySummary').closest('[hidden]'))await loadEamReliabilitySummary({background:true});else if(!$('eamConditionResult').closest('[hidden]'))await loadEamCondition({background:true});}}catch(_){liveStatus.textContent='Sem conexão. Os dados anteriores não foram confirmados agora.';}finally{polling=false;if(!stopped&&!paused&&!document.hidden)timer=setTimeout(tick,5000);}}
    pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Retomar atualização':'Pausar atualização';pause.setAttribute('aria-pressed',String(paused));clearTimeout(timer);if(paused){reliabilityRequest++;liveStatus.textContent='Atualização automática pausada.';}else tick();};
    document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)tick();});window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);reliabilityRequest++;});window.addEventListener('pageshow',()=>{stopped=false;tick();});timer=setTimeout(tick,5000);
    const originalSwitch=window.switchEamSection;window.switchEamSection=(section,button)=>{originalSwitch(section,button);if(section==='reliability')assets().then(async rows=>{if(!$('eamReliabilityAsset').value&&rows.length)$('eamReliabilityAsset').value=String(rows[0].id);await reliability();window.dispatchEvent(new Event('eam:equipment-ready'));}).catch(error=>{identity.textContent=error.message;});};
  });
})();
