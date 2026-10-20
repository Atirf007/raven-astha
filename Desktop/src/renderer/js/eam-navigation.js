(() => {
 'use strict';
 const definitions = {
  assets: {label:'Ativos', areas:{catalog:{label:'Ativos', pages:{list:'Catálogo de ativos'}}, locations:{label:'Localizações', pages:{tree:'Hierarquia de localizações', edit:'Cadastrar ou editar localização'}}}},
  orders: {label:'Ordens', areas:{orders:{label:'Ordens de manutenção', pages:{list:'Ordens cadastradas', create:'Nova ordem'}}}},
  plans: {label:'Preventivas', areas:{planning:{label:'Acompanhamento', pages:{calendar:'Calendário', agenda:'Agenda do dia', list:'Planos cadastrados', indicators:'Indicadores preventivos'}}, configuration:{label:'Configuração', pages:{create:'Novo plano', templates:'Modelos de preventiva', counters:'Horímetros e ciclos'}}}},
  reliability: {label:'Confiabilidade', areas:{indicators:{label:'Indicadores', pages:{overview:'Indicadores do equipamento', comparison:'Comparar equipamentos', projection:'Projeção de falhas'}}, condition:{label:'Monitoramento', pages:{overview:'Leituras e alertas', limits:'Limites de condição', readings:'Registrar leitura', devices:'Dispositivos'}}, records:{label:'Registros', pages:{observations:'Operação e reparos', failures:'Classificações de falha'}}}}
 };
 const views = {
  asset:{overview:'Visão geral', structure:'Estrutura', components:'Componentes', twin:'Digital Twin', maintenance:'Manutenção', documents:'Documentos', history:'Histórico', reliability:'Confiabilidade'},
  order:{overview:'Visão geral', tasks:'Tarefas', materials:'Materiais', labor:'Mão de obra', downtime:'Downtime', history:'Histórico'}
 };
 const assemblyTools={assembly:'Montar partes 3D',module:'Adicionar módulo',position:'Indexar posição e peça',spare:'Vincular spare part',visual:'Anexar imagem ou 3D',hotspot:'Marcar peça na imagem'};
 const $ = id => document.getElementById(id);
 const make = (tag,text,cls) => {const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
 function init() {
  if(!$('panel-eam')||window.EamNavigation)return;
  const modules=new Map(), pages=new Map(), last=new Map(), loaders=new Map();
  let applying=false, routeSerial=0, pendingAssemblyTool=null;
  const contextParams=['eamAsset','eamOrder','eamView','eamTool'];
  const defaultArea = section => Object.keys(definitions[section].areas)[0];
  const defaultPage = (section,area) => Object.keys(definitions[section].areas[area].pages)[0];
  function address(section,area,page,context) {
   const url=new URL(location.href);url.searchParams.set('tab','eam');url.searchParams.set('eamSection',section);
   for(const key of contextParams)url.searchParams.delete(key);
   if(section==='procurement') {url.searchParams.delete('eamArea');url.searchParams.delete('eamPage');url.searchParams.set('procurementArea',area);url.searchParams.set('procurementPage',page);}
   else {url.searchParams.delete('procurementArea');url.searchParams.delete('procurementPage');url.searchParams.set('eamArea',area);url.searchParams.set('eamPage',page);}
   if(context){url.searchParams.set(context.kind==='asset'?'eamAsset':'eamOrder',String(context.id));url.searchParams.set('eamView',context.view);if(context.tool)url.searchParams.set('eamTool',context.tool);}
   return url.pathname+url.search+url.hash;
  }
  function save(url,push=true) {if(location.pathname+location.search+location.hash!==url)history[push?'pushState':'replaceState'](null,'',url);}
  function link(text,section,area,page) {
   const anchor=make('a',text,'eam-procurement-nav-link');anchor.href=address(section,area,page);
   anchor.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(section,area,page,{focus:true});});
   return anchor;
  }
  for(const [section,definition] of Object.entries(definitions)) {
   const root=$('eam-'+section), shell=make('div',null,'eam-procurement-pages eam-module-pages');
   const breadcrumb=make('nav',null,'eam-procurement-breadcrumb'),primary=make('nav',null,'eam-procurement-nav'),secondary=make('nav',null,'eam-procurement-subnav'),shared=make('div',null,'eam-module-context'),content=make('div');
   breadcrumb.setAttribute('aria-label','Localização em '+definition.label);primary.setAttribute('aria-label','Páginas de '+definition.label);secondary.setAttribute('aria-label','Subpáginas de '+definition.label);
   for(const [area,group] of Object.entries(definition.areas))for(const [page,label] of Object.entries(group.pages)) {
    const node=make('section',null,'eam-procurement-page eam-module-page'),heading=make('h3',label),body=make('div',null,'eam-module-page-body');node.id=`eam-page-${section}-${area}-${page}`;node.hidden=true;heading.id=node.id+'-title';heading.tabIndex=-1;node.setAttribute('aria-labelledby',heading.id);node.append(heading,body);content.append(node);pages.set(`${section}/${area}/${page}`,{node,body});
   }
   shell.append(breadcrumb,primary,secondary,shared,content);root.prepend(shell);modules.set(section,{root,breadcrumb,primary,secondary,shared,shell});
   last.set(section,[defaultArea(section),defaultPage(section,defaultArea(section))]);
  }
  const body = key => pages.get(key).body;
  const move = (key,node) => {if(node)body(key).append(node);};
  const intro = (key,text) => body(key).append(make('p',text,'eam-procurement-intro'));
  function unwrapDialog(id,key) {
   const dialog=$(id);if(!dialog)return;
   for(const node of [...dialog.children])if(node.tagName!=='HEADER')move(key,node);
   // Retain the empty dialog for existing close handlers in successful save flows.
   dialog.hidden=true;
  }
  const assets=$('eam-assets'),locationDetails=assets.querySelector(':scope > details');
  move('assets/catalog/list',assets.querySelector(':scope > .eam-object-toolbar'));move('assets/catalog/list',$('eamAssetsTable'));
  intro('assets/locations/tree','Consulte a hierarquia de áreas e os ativos associados a cada localização.');
  move('assets/locations/tree',$('eamLocationsTree'));move('assets/locations/edit',$('eamLocationForm'));locationDetails?.remove();
  const editLocation=window.editEamFunctionalLocation;
  window.editEamFunctionalLocation=row=>{go('assets','locations','edit');editLocation(row);};
  const saveLocation=window.createEamFunctionalLocation;
  window.createEamFunctionalLocation=async event=>{await saveLocation(event);if(!$('eamLocationEditId').value&&!$('eamLocationCode').value)go('assets','locations','tree');};
  const orderDashboard=$('eamOrderDashboard');move('orders/orders/list',orderDashboard);unwrapDialog('eamOrderCreateDialog','orders/orders/create');
  window.toggleEamOrderForm=async visible=>{go('orders','orders',visible?'create':'list');if(visible)await prepareOrder();};
  async function prepareOrder(){await window.EamUx?.prepareOrder();$('eamOrderTitle')?.focus();}

  const plans=$('eam-plans'),heading=plans.querySelector('.eam-preventive-heading'),filter=plans.querySelector('.eam-preventive-filter'),layout=plans.querySelector('.eam-preventive-layout');
  modules.get('plans').shared.append(filter,$('eamPlanFeedback'));
  move('plans/planning/calendar',layout.querySelector('.eam-preventive-calendar-panel'));
  move('plans/planning/agenda',$('eamPlanDayTitle'));move('plans/planning/agenda',$('eamPlanDayItems'));
  move('plans/planning/list',$('eamPlansBody'));move('plans/planning/indicators',$('eamPlanMetrics'));
  move('plans/configuration/create',$('eamPlanForm'));move('plans/configuration/counters',plans.querySelector('[onsubmit="saveEamCounter(event)"]'));
  modules.get('plans').shared.prepend($('eamPlanNewButton'));heading.remove();layout.remove();
  $('eamPlanForm').hidden=false;
  const planFormHeading=$('eamPlanForm').querySelector('.eam-preventive-form-head');
  if(planFormHeading){for(const node of [...planFormHeading.children])if(node.tagName==='BUTTON'&&node.textContent.includes('Modelos')){node.onclick=()=>go('plans','configuration','templates');move('plans/configuration/create',node);}planFormHeading.remove();}
  window.toggleEamPlanForm=visible=>{go('plans',visible?'configuration':'planning',visible?'create':'list');if(visible)preparePlan();};
  function preparePlan(){const state=window.eamPlanState,missing=!state?.assets.length;$('eamPlanNoAssets').hidden=!missing;$('eamPlanSubmit').disabled=missing;if(state?.assetId)$('eamPlanAsset').value=state.assetId;}
  const dayLabel=make('label','Data da agenda'),day=make('input',null,'eo-input');day.id='eamAgendaDate';day.type='date';dayLabel.htmlFor=day.id;day.value=window.eamPlanState?.day||'';dayLabel.append(day);body('plans/planning/agenda').prepend(dayLabel);
  day.addEventListener('change',()=>{if(!day.value||!window.eamPlanState)return;window.eamPlanState.day=day.value;window.eamPlanState.month=day.value.slice(0,7);window.loadEamPlanOverview();});
  const agendaLink=link('Ver agenda do dia selecionado','plans','planning','agenda');body('plans/planning/calendar').append(agendaLink);
  $('eamPlansBody').addEventListener('click',event=>{if(event.target.closest('.eam-preventive-plan'))go('plans','planning','agenda');});
  loaders.set('plans/configuration/templates',host=>window.EamPlanningTools.templates(host));
  intro('plans/configuration/counters','Registre horas e ciclos acumulados para acompanhar os intervalos de manutenção.');

  const reliability=$('eam-reliability'),actions=reliability.querySelector('.eam-ux-actions'),filters=reliability.querySelector('.eam-reliability-filters');
  modules.get('reliability').shared.append(filters,$('eamReliabilityIdentity'));
  move('reliability/indicators/overview',$('eamReliabilityResult'));move('reliability/indicators/overview',$('eamReliabilityCharts'));
  unwrapDialog('eamReliabilityCompareDialog','reliability/indicators/comparison');
  unwrapDialog('eamConditionRulesDialog','reliability/condition/limits');unwrapDialog('eamConditionReadingDialog','reliability/condition/readings');unwrapDialog('eamFailureCodesDialog','reliability/records/failures');unwrapDialog('eamObservationsDialog','reliability/records/observations');
  const condition=reliability.querySelector(':scope > details'),conditionRow=$('eamConditionAsset').parentElement;
  $('eamConditionAsset').hidden=true;move('reliability/condition/overview',conditionRow);move('reliability/condition/overview',$('eamConditionResult'));condition?.remove();
  actions?.remove();for(const node of [...reliability.children])if(node.tagName==='H3')node.remove();
  loaders.set('reliability/indicators/projection',host=>window.EamPlanningTools.poisson(host));loaders.set('reliability/condition/devices',host=>window.EamPlanningTools.devices(host));
  filters.addEventListener('change',()=>{syncCondition();const [area,page]=last.get('reliability');if(area==='records'&&page==='observations')runObservations();});
  function syncCondition(){$('eamConditionAsset').value=$('eamReliabilityAsset').value;}
  function runObservations(){window.EamObservations?.open().catch(error=>showError(body('reliability/records/observations'),error));}
  function showError(target,error){let message=target.querySelector('.eam-page-error');if(!message){message=make('p',null,'eam-page-error');message.setAttribute('role','status');target.append(message);}message.textContent=error?.message||'Não foi possível carregar esta página.';}
  async function loadPage(key,force=false) {
   const loader=loaders.get(key),target=body(key);if(!loader||target.dataset.loaded==='true'&&!force)return;
   target.dataset.loaded='true';try{if(key==='reliability/condition/devices')await window.EamUx?.assets();await loader(target);}catch(error){delete target.dataset.loaded;showError(target,error);}
  }
  for(const key of loaders.keys()){const refresh=make('button','Atualizar dados','btn btn-secondary btn-sm');refresh.type='button';refresh.addEventListener('click',()=>loadPage(key,true));pages.get(key).node.insertBefore(refresh,body(key));}
  function draw(section,area,page) {
   const module=modules.get(section),definition=definitions[section],group=definition.areas[area];last.set(section,[area,page]);
   for(const [key,value] of pages)if(key.startsWith(section+'/'))value.node.hidden=key!==`${section}/${area}/${page}`;
   module.primary.replaceChildren();module.primary.hidden=Object.keys(definition.areas).length===1;
   for(const [key,item] of Object.entries(definition.areas)){const anchor=link(item.label,section,key,key===area?page:defaultPage(section,key));if(key===area){anchor.classList.add('active');anchor.setAttribute('aria-current','true');}module.primary.append(anchor);}
   module.secondary.replaceChildren();module.secondary.hidden=Object.keys(group.pages).length===1;
   for(const [key,label] of Object.entries(group.pages)){const anchor=link(label,section,area,key);if(key===page){anchor.classList.add('active');anchor.setAttribute('aria-current','page');}module.secondary.append(anchor);}
   const parent=link(definition.label,section,defaultArea(section),defaultPage(section,defaultArea(section)));parent.className='';const current=make('span',group.pages[page]);current.setAttribute('aria-current','page');module.breadcrumb.replaceChildren(parent,make('span','/'),make('span',group.label),make('span','/'),current);
   if(section==='plans'){filter.hidden=area==='configuration';$('eamPlanNewButton').hidden=page==='create';}
   if(section==='reliability')filters.classList.toggle('eam-context-equipment-only',area!=='indicators');
  }
  const baseSwitch=window.switchEamSection;
  function leaveSensitivePage(){const target=body('reliability/condition/devices');if(target.querySelector('[aria-label="Credencial exibida uma única vez"]')){target.replaceChildren();delete target.dataset.loaded;}}
  function go(section,area,page,{push=true,focus=false}={}) {
   if(section!=='procurement'&&!Object.hasOwn(definitions,section))section='assets';
   if(section!=='procurement'){if(!Object.hasOwn(definitions[section].areas,area))area=defaultArea(section);if(!Object.hasOwn(definitions[section].areas[area].pages,page))page=defaultPage(section,area);}
   ++routeSerial;pendingAssemblyTool=null;leaveSensitivePage();applying=true;
   try {
    if(!$('panel-eam').classList.contains('active'))window.switchTab('eam',{render:false});
    // Close a contextual record before showing a different module page.
    if(!$('eamAssetWorkspace').hidden)window.closeEamAssetWorkspace();if(!$('eamOrderWorkspace').hidden)window.closeEamOrderWorkspace();
    if(!$('eam-'+section).classList.contains('active'))baseSwitch(section,document.querySelector(`#panel-eam .eo-inline-tab[onclick*="'${section}'"]`));
    if(section==='procurement')window.EamProcurementNavigation.go(area,page,{push,focus});else draw(section,area,page);
   }finally{applying=false;}
   if(section==='procurement'){const url=new URL(location.href);last.set(section,[url.searchParams.get('procurementArea'),url.searchParams.get('procurementPage')]);return;}
   save(address(section,area,page),push);const key=`${section}/${area}/${page}`;
   if(section==='plans'&&page==='agenda')day.value=window.eamPlanState?.day||day.value;
   if(key==='plans/configuration/create')preparePlan();
   if(key==='orders/orders/create')prepareOrder().catch(error=>showError(body(key),error));
   if(section==='reliability'){syncCondition();if(key==='reliability/indicators/comparison')Promise.resolve(window.loadEamReliabilitySummary()).catch(error=>showError(body(key),error));if(area==='condition'&&page==='overview')Promise.resolve(window.loadEamCondition()).catch(error=>showError(body(key),error));if(area==='records'&&page==='observations')runObservations();}
   loadPage(key);
   if(focus){pages.get(key).node.querySelector('h3').focus({preventScroll:true});$('panel-eam').scrollIntoView({block:'start'});}
  }
  function organizeAssembly(actions,asset) {
   const groups=new Map([...actions.querySelectorAll(':scope > details')].map(node=>{const label=node.querySelector('summary')?.textContent;return [Object.keys(assemblyTools).find(key=>assemblyTools[key]===label),node];}).filter(([key])=>key));
   if(!groups.size)return;
   actions.classList.add('eam-assembly-pages');const nav=make('nav',null,'eam-assembly-page-nav');nav.setAttribute('aria-label','Configuração da estrutura do ativo');actions.querySelector('h4').after(nav);
   const url=new URL(location.href),requested=String(asset.id)===url.searchParams.get('eamAsset')?url.searchParams.get('eamTool'):null;
   let current=null;
   function select(key,push=true) {
    if(!groups.has(key))return;current=key;
    for(const [name,node] of groups){node.hidden=name!==key;node.open=name===key;}
    for(const anchor of nav.children){const active=anchor.dataset.tool===key;anchor.classList.toggle('active',active);if(active)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');}
    if(push)save(address('assets','catalog','list',{kind:'asset',id:asset.id,view:'structure',tool:key}));
   }
   for(const [key,label] of Object.entries(assemblyTools)){if(!groups.has(key))continue;const anchor=make('a',label,'eam-procurement-nav-link');anchor.dataset.tool=key;anchor.href=address('assets','catalog','list',{kind:'asset',id:asset.id,view:'structure',tool:key});anchor.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();select(key);});nav.append(anchor);const node=groups.get(key);node.querySelector('summary').hidden=true;node.addEventListener('toggle',()=>{if(node.open&&current!==key)select(key);else if(!node.hidden&&!node.open)node.open=true;});}
   actions.eamSelectTool=key=>select(groups.has(key)?key:groups.keys().next().value,false);
   const opened=[...groups].find(([,node])=>node.open)?.[0],pending=pendingAssemblyTool?.id===Number(asset.id)?pendingAssemblyTool.tool:null;
   select(groups.has(requested)?requested:groups.has(pending)?pending:opened||groups.keys().next().value,false);pendingAssemblyTool=null;
  }
  window.EamNavigation={go,organizeAssembly,get applying(){return applying;}};
  window.switchEamSection=(section,button)=>{if(applying){baseSwitch(section,button);return;}const [area,page]=last.get(section)||['requisitions','list'];go(section,area,page);};
  // Contextual asset/order screens keep their existing actions, with shareable subpage URLs.
  function record(kind,entity,label,push=true){if(applying)return;const section=kind==='asset'?'assets':'orders',area=defaultArea(section),page=defaultPage(section,area),view=Object.keys(views[kind]).find(key=>views[kind][key]===label)||'overview',url=new URL(location.href);let tool=null;if(kind==='asset'&&view==='structure'){const requested=String(entity.id)===url.searchParams.get('eamAsset')?url.searchParams.get('eamTool'):pendingAssemblyTool?.id===Number(entity.id)?pendingAssemblyTool.tool:null;if(Object.hasOwn(assemblyTools,requested))tool=requested;}save(address(section,area,page,{kind,id:entity.id,view,tool}),push);}
  for(const [kind,openName,renderName,closeName,workspaceId] of [['asset','openEamAssetWorkspace','renderEamAssetWorkspaceTab','closeEamAssetWorkspace','eamAssetWorkspace'],['order','openEamOrderWorkspace','renderEamOrderWorkspaceTab','closeEamOrderWorkspace','eamOrderWorkspace']]) {
   const originalRender=window[renderName],originalOpen=window[openName],originalClose=window[closeName];
   window[renderName]=(target,label,entity)=>{originalRender(target,label,entity);record(kind,entity,label);};
   window[openName]=entity=>{originalOpen(entity);const workspace=$(workspaceId);for(const tab of workspace.querySelectorAll('.eam-workspace-tab')){const view=Object.keys(views[kind]).find(key=>views[kind][key]===tab.textContent);if(!view)continue;const anchor=make('a',tab.textContent,tab.className);anchor.href=address(kind==='asset'?'assets':'orders',kind==='asset'?'catalog':'orders','list',{kind,id:entity.id,view});anchor.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();workspace.querySelectorAll('.eam-workspace-tab').forEach(node=>{node.classList.toggle('active',node===anchor);node.removeAttribute('aria-current');});anchor.setAttribute('aria-current','page');window[renderName](workspace.querySelector('.eam-workspace-body'),views[kind][view],entity);workspace.scrollTop=0;});if(tab.classList.contains('active'))anchor.setAttribute('aria-current','page');tab.replaceWith(anchor);}};
   window[closeName]=()=>{originalClose();if(!applying){const section=kind==='asset'?'assets':'orders',[area,page]=last.get(section);go(section,area,page);}};
  }
  async function restore(){
   const url=new URL(location.href);if(url.searchParams.get('tab')!=='eam'){applying=true;try{if(!$('eamAssetWorkspace').hidden)window.closeEamAssetWorkspace();if(!$('eamOrderWorkspace').hidden)window.closeEamOrderWorkspace();if(url.searchParams.get('tab'))window.switchTab(url.searchParams.get('tab'));}finally{applying=false;}return;}
   // Back/Forward within the open record preserves drafts and the current 3D scene.
   for(const kind of ['asset','order']){
    const section=kind==='asset'?'assets':'orders',id=Number(url.searchParams.get(kind==='asset'?'eamAsset':'eamOrder')),workspace=$(kind==='asset'?'eamAssetWorkspace':'eamOrderWorkspace'),entity=kind==='asset'?window.eamActiveAsset:window.eamActiveOrder;
    if(url.searchParams.get('eamSection')!==section||workspace.hidden||!entity||id!==Number(entity.id)||!Object.hasOwn(views[kind],url.searchParams.get('eamView')))continue;
    ++routeSerial;const label=views[kind][url.searchParams.get('eamView')],tab=[...workspace.querySelectorAll('.eam-workspace-tab')].find(node=>node.textContent===label);
    if(tab&&!tab.classList.contains('active')){applying=true;try{tab.click();}finally{applying=false;}}
    if(kind==='asset'&&label==='Estrutura'){const actions=workspace.querySelector('.eam-assembly-pages');if(actions)actions.eamSelectTool(url.searchParams.get('eamTool'));else if(Object.hasOwn(assemblyTools,url.searchParams.get('eamTool')))pendingAssemblyTool={id,tool:url.searchParams.get('eamTool')};}
    return;
   }
   const section=url.searchParams.get('eamSection')||'assets',area=url.searchParams.get(section==='procurement'?'procurementArea':'eamArea'),page=url.searchParams.get(section==='procurement'?'procurementPage':'eamPage');
   go(section,area,page,{push:false});
   const activeSection=Object.hasOwn(definitions,section)?section:'assets',kind=activeSection==='assets'?'asset':activeSection==='orders'?'order':null,idText=kind&&url.searchParams.get(kind==='asset'?'eamAsset':'eamOrder');
   if(!kind||!idText)return;const id=Number(idText);if(!/^\d+$/.test(idText)||!Number.isSafeInteger(id)||id<1)return;
   const serial=routeSerial,cache=kind==='asset'?window.eamAssetsForWorkspace:window.eamOrdersForWorkspace;let entity=cache?.find(item=>Number(item.id)===id);
   if(!entity){try{const result=await API.get(kind==='asset'?'/eam/assets':'/eam/work-orders');if(serial!==routeSerial)return;if(result.success&&Array.isArray(result.data)){entity=result.data.find(item=>Number(item.id)===id);if(kind==='asset')window.eamAssetsForWorkspace=result.data;else window.eamOrdersForWorkspace=result.data;}}catch(error){showError(body(`${activeSection}/${defaultArea(activeSection)}/${defaultPage(activeSection,defaultArea(activeSection))}`),error);return;}}
   if(serial!==routeSerial||new URL(location.href).searchParams.get('tab')!=='eam')return;if(!entity){showError(body(`${activeSection}/${defaultArea(activeSection)}/${defaultPage(activeSection,defaultArea(activeSection))}`),new Error('Registro não encontrado ou indisponível para sua conta.'));return;}
   const view=Object.hasOwn(views[kind],url.searchParams.get('eamView'))?url.searchParams.get('eamView'):'overview';
   if(kind==='asset'&&view==='structure'&&Object.hasOwn(assemblyTools,url.searchParams.get('eamTool')))pendingAssemblyTool={id,tool:url.searchParams.get('eamTool')};
   applying=true;try{window[kind==='asset'?'openEamAssetWorkspace':'openEamOrderWorkspace'](entity);const workspace=$(kind==='asset'?'eamAssetWorkspace':'eamOrderWorkspace'),tab=[...workspace.querySelectorAll('.eam-workspace-tab')].find(node=>node.textContent===views[kind][view]);if(view!=='overview')tab?.click();}finally{applying=false;}
   record(kind,entity,views[kind][view],false);
  }
  window.addEventListener('popstate',restore);
  window.addEventListener('eam:data-ready',()=>{
   if(!$('eamAssetWorkspace').hidden&&window.eamActiveAsset)window.setEamAssetContext(window.eamActiveAsset);
   if(!$('eamOrderWorkspace').hidden&&window.eamActiveOrder)window.setEamOrderContext(window.eamActiveOrder);
   if(!pages.get('plans/configuration/create').node.hidden)preparePlan();
  });
  window.addEventListener('eam:equipment-ready',()=>{syncCondition();if($('eam-reliability').classList.contains('active')){const [area,page]=last.get('reliability');if(area==='records'&&page==='observations')runObservations();}});
  for(const section of modules.keys()){const [area,page]=last.get(section);draw(section,area,page);}
  restore();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
