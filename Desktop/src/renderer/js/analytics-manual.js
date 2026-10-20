(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, text) => { const item = document.createElement(tag); if (text != null) item.textContent = text; return item; };
  const drafts = new Map();
  const pasteDrafts = new Map();
  const savedVersions = new Map();
  let edits = 0;
  let entryMode='paste';
  let draftPreview = null;
  let study = null, onPublish = null, reviewed = null, page = 0, generation = 0, sequence = 0;
  function raw() {
    const form = $('dataForm');
    return { kind: form.elements.kind.value, variable: form.elements.variable.value, unit: form.elements.kind.value==='categories'?form.elements.pareto_unit.value:form.elements.unit.value,
      rows: [...$('dataRows').children].map(row => [...row.querySelectorAll('input,select')].map(input => input.value)) };
  }
  function retain() { if (study) {drafts.set(study, raw());pasteDrafts.set(study,$('manualPasteValues')?.value||'');} }
  function addRow(values = null) {
    const body = $('dataRows'); if (body.children.length >= 4000) return;
    const categorical = $('dataForm').elements.kind.value === 'categories', life = $('dataForm').elements.kind.value === 'life', row = node('tr');
    const subject = node('input'), value = node('input');
    let generated;do{generated=`S-${++sequence}`;}while([...body.querySelectorAll('tr td:first-child input')].some(input=>input.value===generated));
    subject.value = values?.[0] ?? generated; subject.required = true; subject.maxLength = 120; subject.setAttribute('aria-label', categorical?'Identificação do registro':'Identificação do sujeito');
    row.dataset.pristine=values?'false':'true';row.addEventListener('input',()=>{row.dataset.pristine='false';});
    value.type = 'number'; value.step = 'any'; value.value = values?.[1] ?? ''; value.required = life || categorical; if(categorical)value.min="0";
    if (life) value.min = '0.000000001';
    value.setAttribute('aria-label', life ? 'Duração' : categorical?'Valor da perda':'Valor medido');
    const inputs = [subject, value];
    if (life) {
      const event = node('select'); event.required = true; event.setAttribute('aria-label', 'Falha ou censura');
      event.append(new Option('Selecione o evento', ''), new Option('Falha', 'true'), new Option('Censura à direita', 'false'));
      event.value = values?.[2] ?? ''; inputs.push(event);
    }
    if(categorical){const category=node('input');category.required=true;category.maxLength=100;category.value=values?.[2]??'';category.setAttribute('aria-label','Categoria da perda');inputs.push(category);}
    for (const input of inputs) { const cell = node('td'); cell.append(input); row.append(cell); }
    const cell = node('td'), remove = node('button', 'Remover'); remove.type = 'button';
    remove.addEventListener('click', () => { edits++;row.remove(); retain(); draftPreview?.schedule(); }); cell.append(remove); row.append(cell); body.append(row);
  }
  function head() {
    const form=$('dataForm'),categorical=form.elements.kind.value==='categories';$('manualUnitField').hidden=categorical;$('manualParetoUnitField').hidden=!categorical;form.elements.unit.disabled=categorical;form.elements.pareto_unit.disabled=!categorical;
    setEntryMode(entryMode);
    if($('manualTypeHelp'))$('manualTypeHelp').textContent=categorical?'Cada linha é uma perda: informe o valor e a categoria, como Elétrica, Mecânica ou Atraso. Escolha se está somando ocorrências, horas ou reais.':form.elements.kind.value==='life'?'Cada linha representa um item independente. Informe a duração e marque se o item falhou ou se ainda estava funcionando ao encerrar a observação (censura à direita). Use h, d ou cycles como unidade.':'Cada linha é uma medição. O código é preenchido automaticamente; basta informar o valor. Campo vazio significa dado ausente; zero é um valor válido.';
    const row = node('tr');
    for (const text of $('dataForm').elements.kind.value === 'life' ? ['Item independente', 'Duração', 'O que aconteceu?', ''] : $('dataForm').elements.kind.value === 'categories' ? ['Registro','Valor','Categoria',''] : ['Código automático', 'Valor medido', '']) {
      const cell = node('th', text); cell.scope = 'col'; row.append(cell);
    }
    $('dataHead').replaceChildren(row);
  }
  function setEntryMode(mode){entryMode=mode;const measurements=$('dataForm').elements.kind.value==='measurements';if($('manualEntryModes'))$('manualEntryModes').hidden=!measurements;if($('manualPastePanel'))$('manualPastePanel').hidden=!measurements||mode!=='paste';if($('manualDataTable'))$('manualDataTable').hidden=measurements&&mode==='paste';if($('manualPasteMode'))$('manualPasteMode').setAttribute('aria-pressed',String(mode==='paste'));if($('manualTableMode'))$('manualTableMode').setAttribute('aria-pressed',String(mode==='table'));$('addObservation').hidden=measurements&&mode==='paste';}
  function restore(saved){entryMode='table';const form=$('dataForm');form.reset();$('dataRows').replaceChildren();form.elements.kind.value=saved.kind;form.elements.variable.value=saved.variable;form.elements.unit.value=saved.unit;if(saved.kind==='categories')form.elements.pareto_unit.value=saved.unit;head();if(saved.rows.length)saved.rows.forEach(addRow);else addRow();retain();draftPreview?.refresh();}
  async function discardSaved(id){if(!savedVersions.has(id)||typeof API==='undefined'||typeof API.request!=='function')return {success:true};const result=await API.request(`/analytics/studies/${id}/draft`,{method:'DELETE',body:JSON.stringify({version:savedVersions.get(id)})});if(result.success)savedVersions.set(id,result.data.version);return result;}
  function open(id, callback, copy = null) {
    if (!drafts.has(id) && drafts.size >= 8) { $('analyticsFeedback').textContent = 'Há oito rascunhos nesta sessão. Publique ou descarte um antes de iniciar outro.'; return; }
    retain(); study = id; onPublish = callback; generation++;
    const saved = drafts.get(id), pendingPaste=pasteDrafts.get(id)||'', form = $('dataForm'); form.reset(); $('dataRows').replaceChildren();
    if (saved) { form.elements.kind.value = saved.kind; form.elements.variable.value = saved.variable; form.elements.unit.value = saved.unit; if(saved.kind==='categories')form.elements.pareto_unit.value=saved.unit; }
    entryMode=saved?'table':'paste';if($('manualPasteValues'))$('manualPasteValues').value=pendingPaste;
    head(); if (saved?.rows.length) saved.rows.forEach(addRow); else addRow(); retain();
    if($('manualPasteFeedback'))$('manualPasteFeedback').textContent='';
    const dialog = $('dataDialog'); dialog.returnFocus = document.activeElement; form.querySelector('[data-feedback]').textContent = saved ? 'Rascunho recuperado desta sessão. Ainda não está publicado.' : '';
    dialog.showModal();
    form.querySelector('[data-copy-version]')?.remove();
    if(copy){const use=node('button','Copiar versão selecionada para editar');use.type='button';use.dataset.copyVersion='true';use.onclick=()=>{edits++;restore({kind:copy.kind,variable:copy.variable.name,unit:copy.variable.unit,rows:copy.rows.map(row=>copy.kind==='life'?[row.subject_id,String(row.duration),String(row.event)]:copy.kind==='categories'?[row.subject_id,String(row.value),row.category]:[row.subject_id,row.value===null?'':String(row.value)])});form.querySelector('[data-feedback]').textContent='Cópia em edição. Publicar criará uma nova versão; a fonte e a versão anterior permanecem preservadas.';};form.querySelector('.analytics-form').prepend(use);}
    draftPreview?.refresh();
    if(!saved&&typeof API!=='undefined'&&typeof API.get==='function'){
      const revision=generation,inputRevision=edits;form.querySelector('[data-feedback]').textContent='Consultando seu rascunho privado…';
      API.get(`/analytics/studies/${id}/draft`).then(result=>{if(revision!==generation||study!==id||!dialog.open)return;if(!result.success){form.querySelector('[data-feedback]').textContent=result.error||'Rascunho privado indisponível.';return;}savedVersions.set(id,result.data.version);if(inputRevision!==edits){form.querySelector('[data-feedback]').textContent='Seus campos foram preservados. O rascunho salvo não substituiu a edição em andamento.';return;}if(result.data.draft){restore(result.data.draft);form.querySelector('[data-feedback]').textContent='Seu rascunho privado foi recuperado do servidor. Ainda não está publicado.';}else form.querySelector('[data-feedback]').textContent='Use Salvar rascunho para recuperar seus campos após sair.';}).catch(()=>{if(revision===generation&&study===id)form.querySelector('[data-feedback]').textContent='Não foi possível recuperar o rascunho. Seus campos foram preservados.';});
    }
  }
  function renderReview() {
    const target = $('manualReviewContent'), life = reviewed.payload.kind === 'life'; target.replaceChildren();
    target.append(node('h3', reviewed.payload.variable.name + ' · ' + reviewed.payload.variable.unit), node('p', `${reviewed.payload.rows.length} observações. Confira o original digitado e o valor que será publicado.`));
    const wrap = node('div'), table = node('table'), heading = node('tr'), thead = node('thead'), body = node('tbody'); wrap.className = 'analytics-table-wrap';
    for (const label of ['Sujeito', 'Original digitado', life ? 'Duração interpretada' : 'Valor interpretado', ...(life ? ['Evento'] : reviewed.payload.kind==='categories'?['Categoria']:[])]) { const th = node('th', label); th.scope = 'col'; heading.append(th); }
    thead.append(heading);
    reviewed.payload.rows.slice(page * 100, (page + 1) * 100).forEach((row, i) => {
      const original = reviewed.original.rows[page * 100 + i], line = node('tr');
      for (const text of [row.subject_id, original[1] === '' ? 'Em branco' : original[1], life ? String(row.duration) : row.value === null ? 'Ausente' : String(row.value), ...(life ? [row.event ? 'Falha' : 'Censura à direita'] : reviewed.payload.kind==='categories'?[row.category]:[])]) line.append(node('td', text));
      body.append(line);
    });
    table.append(thead, body); wrap.append(table); target.append(wrap);
    const pagination = node('div'); pagination.className = 'analytics-actions';
    const previous = node('button', 'Anterior'), next = node('button', 'Próximas observações'); previous.type = next.type = 'button';
    previous.disabled = page === 0; next.disabled = (page + 1) * 100 >= reviewed.payload.rows.length;
    previous.onclick = () => { page--; renderReview(); }; next.onclick = () => { page++; renderReview(); };
    pagination.append(previous, node('span', `Página ${page + 1} de ${Math.ceil(reviewed.payload.rows.length / 100)}`), next); target.append(pagination);
    target.append(node('p', 'Valores em branco permanecem ausentes; zero permanece zero. Publicar cria uma versão preservada e não altera o EAM. Use Salvar rascunho na edição para guardar os campos no servidor, privados para sua conta.'));
  }
  document.addEventListener('DOMContentLoaded', () => {
    const form = $('dataForm'); if (!form) return;
    draftPreview = window.AnalyticsLive?.installDraft(form,raw);
    form.addEventListener('input', ()=>{edits++;retain();}); form.addEventListener('change', ()=>{edits++;retain();});
    $('addObservation').onclick = () => { edits++;addRow(); retain(); draftPreview?.schedule(); };
    $('manualPasteMode')?.addEventListener('click',()=>setEntryMode('paste'));$('manualTableMode')?.addEventListener('click',()=>setEntryMode('table'));
    $('applyManualPaste')?.addEventListener('click',()=>{
      const input=$('manualPasteValues'),status=$('manualPasteFeedback');if(form.elements.kind.value!=='measurements')return;
      const text=input.value;if(!text.trim()){status.textContent='Cole pelo menos um número, com um valor por linha.';return;}if(text.length>200000){status.textContent='A lista é muito grande. Use um arquivo CSV ou JSON.';return;}
      const lines=text.replace(/\r\n?/g,'\n').split('\n');while(lines.length&&lines.at(-1).trim()==='')lines.pop();
      const values=[];for(let index=0;index<lines.length;index++){const value=lines[index].trim();if(value!==''&&!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(value)||value!==''&&(!Number.isFinite(Number(value.replace(',','.')))||Math.abs(Number(value.replace(',','.')))>1e100)){status.textContent=`Confira a linha ${index+1}. Cole apenas uma coluna de números; use vírgula ou ponto para o decimal.`;return;}values.push(value===''?'':String(Number(value.replace(',','.'))));}
      const initial=$('dataRows').children.length===1&&$('dataRows').firstElementChild.dataset.pristine==='true'&&!$('dataRows').firstElementChild.querySelector('[aria-label="Valor medido"]').value;
      if(values.length+$('dataRows').children.length-(initial?1:0)>4000){status.textContent='A tabela aceita até 4.000 registros. Nenhum valor foi alterado.';return;}
      if(initial)$('dataRows').replaceChildren();for(const value of values)addRow([null,value]);edits++;input.value='';retain();setEntryMode('table');draftPreview?.refresh();status.textContent=`${values.length} valores adicionados. Confira a tabela abaixo e clique em Conferir dados.`;
    });
    const save=node('button','Salvar rascunho');save.type='button';save.id='saveManualDraft';$('discardManualDraft').before(save);
    save.onclick=async()=>{if($('manualPasteValues')?.value.trim()&&form.elements.kind.value==='measurements'){setEntryMode('paste');form.querySelector('[data-feedback]').textContent='Adicione os valores colados à tabela antes de salvar o rascunho.';return;}const id=study,revision=generation;if(!id||save.disabled)return;save.disabled=true;const feedback=form.querySelector('[data-feedback]');try{if(typeof API==='undefined'||typeof API.put!=='function'){feedback.textContent='Servidor indisponível para salvar o rascunho.';return;}if(!savedVersions.has(id)){const current=await API.get(`/analytics/studies/${id}/draft`);if(!current.success){feedback.textContent=current.error;return;}if(current.data.draft){feedback.textContent='Há um rascunho salvo no servidor. Reabra a página para recuperá-lo antes de substituir.';return;}savedVersions.set(id,current.data.version);}if(revision!==generation||study!==id)return;const result=await API.put(`/analytics/studies/${id}/draft`,{version:savedVersions.get(id),draft:raw()});if(revision!==generation||study!==id)return;if(result.success){savedVersions.set(id,result.data.version);feedback.textContent='Rascunho salvo no servidor, privado para sua conta.';}else feedback.textContent=result.error||'Rascunho não salvo. Seus campos foram preservados.';}catch(_){if(revision===generation&&study===id)feedback.textContent='Não foi possível salvar. Seus campos foram preservados.';}finally{save.disabled=false;}};
    form.elements.kind.addEventListener('change', () => { $('dataRows').replaceChildren(); head(); addRow(); retain(); });
    $('dataDialog').addEventListener('close', retain);
    $('discardManualDraft').onclick = async () => {const id=study,revision=generation,result=await discardSaved(id);if(revision!==generation||study!==id)return;if(!result.success){form.querySelector('[data-feedback]').textContent=result.error||'Não foi possível descartar o rascunho salvo.';return;}drafts.delete(id);pasteDrafts.delete(id);savedVersions.delete(id);study = null; form.reset(); $('dataRows').replaceChildren(); $('dataDialog').close(); $('analyticsFeedback').textContent = 'Rascunho descartado.'; };
    form.addEventListener('submit', event => {
      event.preventDefault(); if (!study || !form.reportValidity()) return;
      if($('manualPasteValues')?.value.trim()&&form.elements.kind.value==='measurements'){setEntryMode('paste');form.querySelector('[data-feedback]').textContent='Clique em Adicionar valores à tabela para incluir os números que você colou antes de conferir.';return;}
      retain(); const original = raw(), life = original.kind === 'life', categorical=original.kind==='categories', ids = new Set();
      if (!original.rows.length) { form.querySelector('[data-feedback]').textContent = 'Adicione pelo menos uma observação.'; return; }
      if(categorical&&!['occurrences','h','BRL'].includes(original.unit)){form.querySelector('[data-feedback]').textContent='Pareto exige unidade occurrences, h ou BRL.';return;}
      const rows = [];
      for (const line of original.rows) {
        const subject_id = line[0].trim(), value = line[1] === '' ? null : Number(line[1]);
        if (categorical&&(!line[2]?.trim()||value===null||value<0||original.unit==='occurrences'&&!Number.isSafeInteger(value)) || !subject_id || ids.has(subject_id) || (value !== null && !Number.isFinite(value)) || (life && (!(value > 0) || !['true', 'false'].includes(line[2])))) {
          form.querySelector('[data-feedback]').textContent = 'Confira sujeitos únicos, números válidos e eventos explícitos. Ausente não é zero.'; return;
        }
        ids.add(subject_id); rows.push(life ? { subject_id, duration: value, event: line[2] === 'true' } : categorical?{subject_id,category:line[2].trim(),value}:{ subject_id, value });
      }
      reviewed = { study, callback: onPublish, original, payload: { kind: original.kind, variable: { name: original.variable, unit: original.unit }, rows } };
      page = 0; $('manualReviewForm').reset(); $('manualReviewForm').querySelector('[data-feedback]').textContent = ''; renderReview();
      const dialog = $('manualReviewDialog'); dialog.returnFocus = document.activeElement; dialog.showModal();
    });
    $('manualReviewDialog').addEventListener('close', () => { generation++; reviewed = null; });
    $('manualReviewDialog').addEventListener('cancel', event => { if ($('manualReviewForm').querySelector('[type=submit]').disabled) event.preventDefault(); });
    $('manualReviewForm').addEventListener('submit', async event => {
      event.preventDefault(); const review = reviewed, revision = generation, target = event.target, submit = target.querySelector('[type=submit]');
      if (!review || !target.reportValidity() || !target.elements.confirm.checked || submit.disabled) return;
      submit.disabled = true;
      target.querySelectorAll('[data-close]').forEach(button => { button.disabled = true; });
      try {
        const result = await API.post(`/analytics/studies/${review.study}/snapshots`, review.payload);
        if (revision !== generation || reviewed !== review || !$('manualReviewDialog').open) return;
        if (!result.success) { target.querySelector('[data-feedback]').textContent = result.error; return; }
        let cleared;try{cleared=await discardSaved(review.study);}catch(_){cleared={success:false};}
        if(revision!==generation||reviewed!==review||!$('manualReviewDialog').open)return;
        drafts.delete(review.study);pasteDrafts.delete(review.study);savedVersions.delete(review.study); study = null; $('manualReviewDialog').close(); $('dataDialog').close(); await review.callback(review.study);
        if(!cleared.success)$('analyticsFeedback').textContent='Versão publicada. O rascunho salvo foi preservado porque mudou ou ficou indisponível.';
      } finally { submit.disabled = false; target.querySelectorAll('[data-close]').forEach(button => { button.disabled = false; }); }
    });
  });
  window.addEventListener('pagehide', () => {
    drafts.clear();pasteDrafts.clear();savedVersions.clear(); study = null; reviewed = null; generation++;
    $('dataForm')?.reset(); $('dataRows')?.replaceChildren(); $('manualReviewContent')?.replaceChildren();
  });
  window.AnalyticsManual = { open };
})();
