(function(){
  'use strict';
  if(document.getElementById('asthaAssistant')||typeof API==='undefined'||!localStorage.getItem('astha_token'))return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./css/operational-assistant.css?v=3',document.baseURI).href;document.head.append(css);
  const root=document.createElement('div');root.id='asthaAssistant';
  root.innerHTML=`<button class="assistant-launcher" type="button" aria-label="Abrir assistente ASTHA" aria-controls="assistantPanel" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2V11.5a9.5 9.5 0 0 1 19 0Z"/><path d="M7 11h10M7 15h6"/></svg><span>Assistente</span></button>
    <section id="assistantPanel" class="assistant-panel" role="region" aria-label="Assistente operacional ASTHA" hidden>
      <header><div><strong>Assistente ASTHA</strong><small>Estoque · Valores · Ativos · Ajuda</small></div><button type="button" class="assistant-close" aria-label="Fechar assistente">×</button></header>
      <div class="assistant-progress" role="status" hidden><div class="assistant-progress-track" aria-hidden="true"><span></span></div><span class="assistant-progress-label">Consultando os registros autorizados…</span></div>
      <div class="assistant-scroll"><p class="assistant-privacy">O Gemini interpreta sua mensagem com filtros de privacidade e consulta quantidades, preços, estados e datas dos módulos autorizados. Nomes e textos do banco aparecem somente nos cartões aqui no sistema.</p>
      <div class="assistant-suggestions"><button type="button">Qual o valor das entradas no período?</button><button type="button">Qual o valor atual em estoque?</button><button type="button">Quais ativos tenho cadastrados?</button><button type="button">Materiais no mínimo</button></div>
      <div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions"></div></div>
      <form class="assistant-form"><details><summary>Filtrar consulta</summary><div class="assistant-filters"><label>De<input type="date" name="from"></label><label>Até<input type="date" name="to"></label><label class="assistant-code">Código do material<input name="materialCode" maxlength="60" placeholder="Ex.: MERB-00000003" autocomplete="off"></label><label class="assistant-scope-filter"><input type="checkbox" name="allStocks">Consultar todos os estoques ativos</label></div></details>
      <label for="assistantQuestion">Sua mensagem</label><textarea id="assistantQuestion" maxlength="1000" rows="2" required placeholder="Pergunte sobre sua operação ou continue a conversa…"></textarea>
      <div class="assistant-form-actions"><button type="button" class="assistant-clear">Limpar conversa</button><button type="submit" class="assistant-send">Enviar</button></div><p class="assistant-status" role="status"></p></form>
    </section>`;
  document.body.append(root);
  const panel=root.querySelector('#assistantPanel'),launcher=root.querySelector('.assistant-launcher'),input=root.querySelector('textarea'),form=root.querySelector('form'),messages=root.querySelector('.assistant-messages'),status=root.querySelector('.assistant-status'),send=root.querySelector('.assistant-send');
  const progress=root.querySelector('.assistant-progress'),progressLabel=root.querySelector('.assistant-progress-label'),scroll=root.querySelector('.assistant-scroll');
  let busy=false,conversationId=null,finishWriting=null;
  function toggle(open){panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open)input.focus();else{if(finishWriting)finishWriting();launcher.focus();}}
  launcher.addEventListener('click',()=>toggle(panel.hidden));root.querySelector('.assistant-close').addEventListener('click',()=>toggle(false));
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();toggle(false);}});
  const clear=root.querySelector('.assistant-clear');
  clear.onclick=async()=>{if(busy)return;busy=true;clear.disabled=true;try{if(conversationId&&API.delete){const response=await API.delete('/assistant/conversations/'+conversationId);if(!response.success&&!/expirada|indisponível/i.test(response.error||''))throw Error('clear');}conversationId=null;messages.replaceChildren();status.textContent='';input.value='';}catch(_){status.textContent='Não foi possível limpar a conversa. Tente novamente.';}finally{busy=false;clear.disabled=false;}};
  const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const number=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
  const money=(value,currency='BRL')=>/^[A-Z]{3}$/.test(currency)?Number(value||0).toLocaleString('pt-BR',{style:'currency',currency}):`${number(value)} (moeda não informada)`;
  const amounts=values=>(values||[]).map(r=>money(r.value,r.currency)).join(' + ')||money(0);
  const followsTail=()=>scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<80;
  function writeMessage(target,text,skip){
    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!window.requestAnimationFrame||motion?.matches||document.hidden||panel.hidden){target.textContent=text;skip.remove();return Promise.resolve();}
    return new Promise(resolve=>{
      const units=Array.from(text),duration=Math.min(6000,Math.max(350,units.length*12));let start,frame,shown=0,finished=false;
      function done(){if(finished)return;finished=true;window.cancelAnimationFrame(frame);const follow=followsTail(),restoreFocus=document.activeElement===skip;target.textContent=text;skip.remove();if(restoreFocus)input.focus();document.removeEventListener('visibilitychange',onVisibility);motion?.removeEventListener?.('change',onMotion);finishWriting=null;if(follow)scroll.scrollTop=scroll.scrollHeight;resolve();}
      function onVisibility(){if(document.hidden)done();}
      function onMotion(event){if(event.matches)done();}
      function tick(now){if(finished)return;if(start===undefined)start=now;const count=Math.min(units.length,Math.max(1,Math.floor((now-start)/duration*units.length)));if(count>shown){const follow=followsTail();shown=count;target.textContent=units.slice(0,count).join('');if(follow)scroll.scrollTop=scroll.scrollHeight;}if(count>=units.length)done();else frame=window.requestAnimationFrame(tick);}
      finishWriting=done;skip.onclick=done;document.addEventListener('visibilitychange',onVisibility);motion?.addEventListener?.('change',onMotion);frame=window.requestAnimationFrame(tick);
    });
  }
  const states={active:'Ativo',inactive:'Inativo',maintenance:'Em manutenção',retired:'Desativado',open:'Aberta',in_progress:'Em andamento',blocked:'Bloqueada',waiting_materials:'Aguardando material',paused:'Pausada',completed:'Concluída',cancelled:'Cancelada',low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'};
  async function contextual(data){
    if(typeof data.conversationId==='string'&&/^[a-f0-9-]{36}$/.test(data.conversationId))conversationId=data.conversationId;
    const article=element('article',undefined,'assistant-answer');
    article.append(element('strong',data.mode==='gemini'?'Assistente ASTHA · Gemini':'Assistente ASTHA · Consulta direta'));
    const responseText=element('p',undefined,'assistant-response-text'),skip=element('button','Exibir resposta completa','assistant-skip'),extra=element('div');skip.type='button';
    article.setAttribute('aria-busy','true');article.append(responseText,skip,extra);
    extra.hidden=true;
    if(data.notice)extra.append(element('p',data.notice,'assistant-notice'));
    for(const query of data.queries||[]){if(query.scope)extra.append(element('p',query.scope==='selected_warehouse'?'Consulta no estoque selecionado na tela.':query.scope==='dashboard_warehouses'?'Consulta nos estoques selecionados no painel.':'Consulta nos estoques ativos disponíveis.','assistant-notice'));if(query.from&&query.to)extra.append(element('small',`Período consultado: ${query.from} a ${query.to}`,'assistant-notice'));
      if(query.module==='stock'&&query.summary?.valueByCurrency)extra.append(element('p',`Valor atual em estoque: ${amounts(query.summary.valueByCurrency)} · ${number(query.summary.total)} materiais.`, 'assistant-financial-total'));
      if(query.module==='movements'&&query.summary?.types){extra.append(element('p',`Entradas: ${amounts(query.summary.types.entrada?.valueByCurrency)} · Saídas / consumo: ${amounts(query.summary.types.saida?.valueByCurrency)}.`, 'assistant-financial-total'));if(query.summary.estimated)extra.append(element('p','Parte do histórico usa estimativa pelo preço atual. Os demais valores foram registrados na movimentação.','assistant-notice'));}
    }
    if(data.sources?.length){const details=element('details'),list=element('ul',undefined,'assistant-records');details.open=true;details.append(element('summary',`Registros consultados (${data.sources.length})`));
      for(const source of data.sources){const item=element('li');item.append(element('strong',`[${source.ref}] ${source.label}${source.name?' · '+source.name:''}`));
        const info=[];if(source.status)info.push(states[source.status]||source.status);if(source.criticality)info.push('Criticidade: '+(states[source.criticality]||source.criticality));if(source.priority)info.push('Prioridade: '+(states[source.priority]||source.priority));
        if(source.kind==='stock')info.push(`Saldo: ${number(source.quantity)}${source.unit?' '+source.unit:''} · Mínimo: ${number(source.minimum)}`);
        if(source.kind==='movements')info.push(`${source.type==='entrada'?'Entrada':'Saída'}: ${number(source.quantity)}`);
        if(source.unitPrice!==undefined)info.push('Preço unitário: '+money(source.unitPrice,source.currency));
        if(source.stockValue!==undefined)info.push('Valor em estoque: '+money(source.stockValue,source.currency));
        if(source.movementValue!==undefined)info.push('Valor da movimentação: '+money(source.movementValue,source.currency)+(source.valuation==='estimated_current_price'?' (estimado pelo preço atual)':' (registrado)'));
        if(source.at)info.push('Registrado: '+source.at);if(source.dueAt)info.push('Prazo: '+source.dueAt);
        item.append(element('span',info.join(' · ')));const basics=[source.brand?'Marca: '+source.brand:'',source.model?'Modelo: '+source.model:'',source.sector?'Setor: '+source.sector:'',source.location?'Local: '+source.location:''].filter(Boolean);if(basics.length)item.append(element('small',basics.join(' · ')));item.append(element('small','Fonte: registros do ASTHA'));list.append(item);
      }details.append(list);extra.append(details);
    }
    if(data.limited)extra.append(element('p','Há mais resultados. Peça a próxima página ou refine a consulta.','assistant-notice'));
    const follow=followsTail();messages.append(article);if(follow)scroll.scrollTop=scroll.scrollHeight;
    await writeMessage(responseText,data.message.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/^\s*[*-]\s+/gm,'• '),skip);
    const followEnd=followsTail();extra.hidden=false;article.removeAttribute('aria-busy');if(followEnd)scroll.scrollTop=scroll.scrollHeight;
  }
  function render(data){
    if(typeof data.message==='string')return contextual(data);
    const article=element('article',undefined,'assistant-answer');
    article.append(element('strong',data.intent==='help'?'Ajuda do ASTHA':data.intent==='stock'?'Consulta do estoque':`Movimentações · ${data.from} a ${data.to}`));
    article.append(element('p',data.notice,'assistant-notice'));
    if(data.help){article.append(element('p',data.help.text));const link=element('a','Abrir tela');if(['./sistema.html?tab=mapa','./home.html?view=stocks','./sistema.html?tab=estoque'].includes(data.help.url)){link.href=data.help.url;article.append(link);}}
    if(data.intent==='stock')article.append(element('p',`${number(data.summary.count)} materiais · ${number(data.summary.critical)} no mínimo ou abaixo · ${number(data.summary.zero)} sem saldo.`));
    if(data.intent==='movements')article.append(element('p',`${number(data.summary.entrada.count)} entradas e ${number(data.summary.saida.count)} saídas no período. As quantidades por registro estão abaixo.`));
    if(data.sources?.length){const list=element('ul',undefined,'assistant-records');for(const source of data.sources){const item=element('li');const highlight=data.refs.includes(source.ref)?' · Destaque IA':'';
      item.append(element('strong',`[${source.ref}] ${source.label}${highlight}`));
      item.append(element('span',source.kind==='stock'?`Saldo: ${number(source.quantity)} · Mínimo: ${number(source.minimum)}`:`${source.type==='entrada'?'Entrada':'Saída'}: ${number(source.quantity)} · ${source.at}`));
      item.append(element('small',`${source.kind==='stock'?'Material':'Movimentação'} #${source.id} · Fonte: ASTHA`));list.append(item);}
      article.append(list);
    }else if(data.intent!=='help')article.append(element('p','Nenhum registro encontrado nesses filtros.'));
    if(data.limited)article.append(element('p','Exibindo até 50 registros; os totais consideram todo o filtro. Reduza o período ou informe o código do material.'));
    messages.append(article);article.scrollIntoView({block:'nearest'});
  }
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!input.value.trim())return;
    if(messages.children.length>=20)messages.replaceChildren();
    const body={question:input.value.trim(),...(conversationId?{conversationId}:{})};for(const name of ['from','to','materialCode']){const value=form.elements[name].value.trim();if(value)body[name]=value;}
    const selectedStock=document.getElementById('warehouseStockSelect')?.value;
    if(!form.elements.allStocks.checked&&/^[1-9]\d*$/.test(selectedStock||'')&&Number.isSafeInteger(Number(selectedStock)))body.warehouseId=Number(selectedStock);
    const dashboard=[...document.querySelectorAll('.stock-insights[data-assistant-context]')].find(el=>el.getClientRects().length&&!el.closest('[hidden]'));
    if(dashboard){try{const context=JSON.parse(dashboard.dataset.assistantContext);body.viewContext={from:context.from,to:context.to,...(!form.elements.allStocks.checked&&context.warehouseIds?.length?{warehouseIds:context.warehouseIds}:{})};}catch(_){/* A failed or unavailable panel does not provide filters. */}}
    messages.append(element('p',body.question,'assistant-question'));scroll.scrollTop=scroll.scrollHeight;input.value='';busy=true;send.disabled=true;clear.disabled=true;root.querySelectorAll('.assistant-suggestions button').forEach(b=>b.disabled=true);progress.hidden=false;progressLabel.textContent='Consultando os registros autorizados…';status.textContent='';
    let failed=false;
    try{const response=await API.post('/assistant/query',body);if(response.success){progressLabel.textContent='Escrevendo a resposta…';await render(response.data);}else {failed=true;messages.append(element('p',response.error||'Não foi possível consultar.','assistant-error'));}}
    catch(_){failed=true;messages.append(element('p','Não foi possível conectar. Tente novamente.','assistant-error'));}
    finally{if(failed&&!input.value.trim())input.value=body.question;busy=false;send.disabled=false;clear.disabled=false;root.querySelectorAll('.assistant-suggestions button').forEach(b=>b.disabled=false);progress.hidden=true;status.textContent='';}
  });
  root.querySelectorAll('.assistant-suggestions button').forEach(button=>button.onclick=()=>{input.value=button.textContent;form.requestSubmit();});
})();
