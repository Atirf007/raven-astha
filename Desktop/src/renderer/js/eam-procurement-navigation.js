(function(){
 'use strict';
 const groups={
  requisitions:{label:'Requisições',pages:{list:{label:'Requisições de compra',description:'Revise as solicitações e acompanhe as aprovações.'}}},
  planning:{label:'Planejamento',pages:{mrp:{label:'Projeção MRP',description:'Projete o estoque por data, reservas, pedidos em aberto e consumo das preventivas.'},forecasts:{label:'Demandas futuras',description:'Cadastre as necessidades previstas na unidade base do material.'},units:{label:'Unidades de compra',description:'Defina a unidade de compra e sua conversão para a unidade base.'},replenishment:{label:'Reposição',description:'Consulte saldo, reservas e pontos de reposição dos materiais.'}}},
  suppliers:{label:'Fornecedores e cotações',pages:{register:{label:'Fornecedores',description:'Cadastre os dados comerciais dos seus fornecedores.'},qualifications:{label:'Qualificação',description:'Acompanhe avaliações, validade e evidências dos fornecedores.'},rfqs:{label:'Cotações RFQ',description:'Crie cotações, registre propostas e compare fornecedores.'},sources:{label:'Fontes aprovadas',description:'Vincule materiais a fornecedores, preços e prazos de fornecimento.'},quotas:{label:'Quotas de fornecimento',description:'Distribua a participação de cada fornecedor por material.'}}},
  purchases:{label:'Compras e recebimento',pages:{orders:{label:'Pedidos de compra',description:'Acompanhe pedidos, materiais, fornecedores e quantidades recebidas.'},create:{label:'Gerar pedido',description:'Converta uma requisição aprovada em pedido de compra.'},receipts:{label:'Recebimento',description:'Registre o recebimento na unidade base ou na unidade de compra do pedido.'}}}
 };
 function init(){
  const root=document.getElementById('eam-procurement');if(!root||root.dataset.pagesReady)return;
  const advanced=[...root.querySelectorAll(':scope > .eam-procurement-advanced')];if(advanced.length!==3)return;
  const [planning,suppliers,purchases]=advanced,mrp=planning.querySelector(':scope > details');
  const forecast=mrp.querySelector('[onsubmit="createEamForecast(event)"]').closest('details'),units=mrp.querySelector('[onsubmit="saveEamPurchaseUnit(event)"]').closest('details');
  const qualification=suppliers.querySelector('[onsubmit="saveEamSupplierQualification(event)"]').closest('details'),rfq=suppliers.querySelector('[onsubmit="createEamRfq(event)"]').closest('details'),quotas=suppliers.querySelector('[onsubmit="saveEamSourceQuota(event)"]').closest('details');
  const purchaseCreate=document.getElementById('eamPurchaseOrderCreatePanel'),receipt=purchases.querySelector('[onsubmit="receiveEamPurchaseOrder(event)"]').closest('details');
  const pages=new Map();
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const shell=make('div',undefined,'eam-procurement-pages'),breadcrumb=make('nav',undefined,'eam-procurement-breadcrumb'),primary=make('nav',undefined,'eam-procurement-nav'),secondary=make('nav',undefined,'eam-procurement-subnav'),content=make('div',undefined,'eam-procurement-content');
  primary.setAttribute('aria-label','Páginas de requisições e suprimentos');secondary.setAttribute('aria-label','Subpáginas de suprimentos');breadcrumb.setAttribute('aria-label','Localização em suprimentos');
  for(const [area,group] of Object.entries(groups))for(const [key,definition] of Object.entries(group.pages)){
   const page=make('section',undefined,'eam-procurement-page');page.id=`eam-procurement-${area}-${key}`;page.hidden=true;
   if(area!=='requisitions'){const heading=make('h3',definition.label);heading.tabIndex=-1;heading.id=page.id+'-title';page.setAttribute('aria-labelledby',heading.id);page.append(heading,make('p',definition.description,'eam-procurement-intro'));}
   pages.set(`${area}/${key}`,page);content.append(page);
  }
  const add=(key,node)=>{if(node)pages.get(key).append(node);};
  for(const node of [...root.children]){if(node===advanced[0])break;add('requisitions/list',node);}
  const moveDetails=(key,details)=>{for(const child of [...details.children])if(child.tagName!=='SUMMARY')add(key,child);};
  moveDetails('planning/forecasts',forecast);forecast.remove();moveDetails('planning/units',units);units.remove();moveDetails('planning/mrp',mrp);
  const mrpSubtitle=pages.get('planning/mrp').querySelector('.eo-table-subtitle');
  if(mrpSubtitle){pages.get('planning/mrp').querySelector('.eam-procurement-intro').textContent=mrpSubtitle.textContent;mrpSubtitle.remove();}
  add('planning/replenishment',document.getElementById('eamReplenishmentBody').closest('.eo-table-scroll'));
  add('suppliers/register',suppliers.querySelector('[onsubmit="createEamSupplier(event)"]'));
  moveDetails('suppliers/qualifications',qualification);moveDetails('suppliers/rfqs',rfq);moveDetails('suppliers/quotas',quotas);
  add('suppliers/sources',suppliers.querySelector('[onsubmit="createEamSource(event)"]'));add('suppliers/sources',document.getElementById('eamSourcesBody').closest('.eo-table-scroll'));
  moveDetails('purchases/create',purchaseCreate);const createPage=pages.get('purchases/create');createPage.id=purchaseCreate.id;
  moveDetails('purchases/receipts',receipt);add('purchases/orders',document.getElementById('eamPurchaseOrdersBody').closest('.eo-table-scroll'));
  for(const node of advanced)node.remove();
  shell.append(breadcrumb,primary,secondary,content);root.append(shell);root.dataset.pagesReady='true';
  let currentArea='requisitions',currentPage='list',applying=false;
  const mainButton=()=>document.querySelector('#panel-eam .eo-inline-tab[onclick*="procurement"]');
  const sections=['assets','orders','plans','reliability','procurement'];
  function href(area,page){const url=new URL(location.href);for(const key of ['eamArea','eamPage','eamAsset','eamOrder','eamView','eamTool'])url.searchParams.delete(key);url.searchParams.set('tab','eam');url.searchParams.set('eamSection','procurement');url.searchParams.set('procurementArea',area);url.searchParams.set('procurementPage',page);return url.pathname+url.search+url.hash;}
  function link(label,area,page){const anchor=make('a',label,'eam-procurement-nav-link');anchor.href=href(area,page);anchor.dataset.area=area;anchor.dataset.page=page;anchor.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();go(anchor.dataset.area,anchor.dataset.page,{focus:true});});return anchor;}
  for(const [area,group] of Object.entries(groups))primary.append(link(group.label,area,Object.keys(group.pages)[0]));
  function saveURL(url,push){if(url===location.pathname+location.search+location.hash)return;history[push?'pushState':'replaceState'](null,'',url);}
  function go(area,page,{push=true,focus=false}={}){
   if(window.EamNavigation&&!window.EamNavigation.applying)return window.EamNavigation.go('procurement',area,page,{push,focus});
   if(!Object.hasOwn(groups,area))area='requisitions';if(!Object.hasOwn(groups[area].pages,page))page=Object.keys(groups[area].pages)[0];
   if(!root.classList.contains('active')){applying=true;try{window.switchEamSection('procurement',mainButton());}finally{applying=false;}}
   currentArea=area;currentPage=page;
   for(const [key,node] of pages)node.hidden=key!==`${area}/${page}`;
   primary.querySelectorAll('a').forEach(anchor=>{const active=anchor.dataset.area===area;anchor.classList.toggle('active',active);if(active)anchor.setAttribute('aria-current','true');else anchor.removeAttribute('aria-current');anchor.href=href(anchor.dataset.area,anchor.dataset.area===area?page:Object.keys(groups[anchor.dataset.area].pages)[0]);anchor.dataset.page=anchor.dataset.area===area?page:Object.keys(groups[anchor.dataset.area].pages)[0];});
   secondary.replaceChildren();secondary.hidden=Object.keys(groups[area].pages).length===1;
   for(const [key,definition] of Object.entries(groups[area].pages)){const anchor=link(definition.label,area,key);if(key===page){anchor.classList.add('active');anchor.setAttribute('aria-current','page');}secondary.append(anchor);}
   const home=link('Requisições','requisitions','list');home.className='';const name=make('span',groups[area].pages[page].label);name.setAttribute('aria-current','page');breadcrumb.replaceChildren(home,make('span','/'),make('span',groups[area].label),make('span','/'),name);
   if(area==='requisitions')breadcrumb.replaceChildren(name);
   saveURL(href(area,page),push);
   if(focus){const heading=pages.get(`${area}/${page}`).querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}document.getElementById('panel-eam').scrollIntoView({block:'start',behavior:'auto'});}
  }
  const originalSwitch=window.switchEamSection;
  window.switchEamSection=function(section,button){originalSwitch(section,button);if(applying||window.EamNavigation)return;if(section==='procurement')go(currentArea,currentPage);else if(sections.includes(section)){const url=new URL(location.href);url.searchParams.set('eamSection',section);url.searchParams.delete('procurementArea');url.searchParams.delete('procurementPage');saveURL(url.pathname+url.search+url.hash,true);}};
  function restore(){const url=new URL(location.href);if(url.searchParams.get('tab')!=='eam')return;const section=sections.includes(url.searchParams.get('eamSection'))?url.searchParams.get('eamSection'):'assets';applying=true;try{if(!document.getElementById('panel-eam').classList.contains('active'))window.switchTab('eam',{render:false});window.switchEamSection(section,document.querySelector(`#panel-eam .eo-inline-tab[onclick*="'${section}'"]`));}finally{applying=false;}if(section==='procurement')go(url.searchParams.get('procurementArea'),url.searchParams.get('procurementPage'),{push:false});}
  window.EamProcurementNavigation={go};
  window.addEventListener('popstate',()=>{if(window.EamNavigation)return;const tab=new URL(location.href).searchParams.get('tab');if(tab==='eam')restore();else if(tab)window.switchTab(tab);});
  // Hide other subpages before the first visit without adding a browser-history entry.
  pages.get('requisitions/list').hidden=false;
  if(new URL(location.href).searchParams.has('eamSection'))restore();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
