/* Catalog panel: only implemented models are offered for placement. */
document.addEventListener('DOMContentLoaded',()=>{
  const library=window.ASTHAObjectLibrary,workspace=document.getElementById('cadWorkspace'),ribbon=document.querySelector('#cad-group-addons > div');
  if(!library||!workspace||!ribbon)return;
  const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
  const button=(text,handler)=>{const el=make('button',text);el.type='button';el.addEventListener('click',handler);return el;};
  const panel=make('aside');panel.className='industrial-library';panel.hidden=true;panel.setAttribute('aria-label','Biblioteca industrial 3D');
  const resize=()=>window.dispatchEvent(new Event('resize'));
  const toggle=button('Explorar biblioteca',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));resize();if(!panel.hidden)search.focus();});
  toggle.className='industrial-library-toggle cad-action-button';toggle.setAttribute('aria-expanded','false');panel.id='cad-library-panel';toggle.setAttribute('aria-controls',panel.id);ribbon.prepend(toggle);
  const quick=button('Biblioteca',()=>toggle.click());quick.className='cad-panel-toggle';quick.setAttribute('aria-controls',panel.id);quick.setAttribute('aria-expanded','false');document.getElementById('cad-ribbon-tabs')?.append(quick);
  const sync=()=>quick.setAttribute('aria-expanded',String(!panel.hidden));toggle.addEventListener('click',sync);
  const imported=button('Explorar importados',()=>window.ASTHAMapImports?.browse());imported.className='cad-action-button';ribbon.prepend(imported);
  const footer=document.querySelector('#cad-group-addons > div:last-child');if(footer?.firstChild)footer.firstChild.textContent='BIBLIOTECA 3D ';
  const heading=make('header');heading.append(make('h3','Biblioteca industrial'),button('Fechar',()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');sync();resize();quick.focus();}));
  const search=make('input');search.type='search';search.placeholder='Buscar nome, código ou função';search.setAttribute('aria-label','Buscar objetos');
  const category=make('select');category.setAttribute('aria-label','Categoria');
  const all=make('option','Todas as categorias');all.value='';category.append(all);
  const groups=new Map();for(const item of Object.values(library.catalog)){const group=item.group||'Objetos básicos';if(!groups.has(group))groups.set(group,new Set());groups.get(group).add(item.category);}
  for(const [name,categories] of groups){const group=make('optgroup');group.label=name;for(const value of categories){const option=make('option',value);option.value=value;group.append(option);}category.append(group);}
  const size=make('input');size.type='number';size.min='.01';size.step='.1';size.placeholder='Comprimento máximo (m)';size.setAttribute('aria-label','Comprimento máximo em metros');
  let page=0;const pageSize=16,pagination=make('div');pagination.className='industrial-library-pagination';
  const previous=button('Anterior',()=>{page--;render();}),next=button('Próxima',()=>{page++;render();}),pageLabel=make('span');pagination.append(previous,pageLabel,next);
  const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'[]').filter(id=>library.catalog[id]);}catch{return [];}};
  let favorites=read('astha-library-favorites'),recent=read('astha-library-recent'),filter='all';
  const persist=()=>{try{localStorage.setItem('astha-library-favorites',JSON.stringify(favorites));localStorage.setItem('astha-library-recent',JSON.stringify(recent));}catch{/* Local preferences are optional. */}};
  const filters=make('div');filters.className='industrial-library-filters';
  for(const [id,label] of [['all','Todos'],['favorites','Favoritos'],['recent','Recentes']]){const btn=button(label,()=>{filter=id;page=0;render();});btn.dataset.filter=id;filters.append(btn);}
  const status=make('p');status.setAttribute('role','status');const list=make('div');list.className='industrial-library-list';
  const help=make('p','Selecione um modelo e clique na planta 2D para inserir. Arraste para a planta ou clique para selecionar. Medidas em metros; modelos ilustrativos.');
  panel.append(heading,search,category,size,filters,status,list,pagination,help);workspace.prepend(panel);
  if(window.ResizeObserver)new ResizeObserver(resize).observe(panel);
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cache=new Map();let renderer;
  function thumbnail(key,item){
    if(cache.has(key))return cache.get(key);
    const T=window.THREE;if(!T)return null;
    let scene;
    try{
      renderer ||= new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setSize(200,140);renderer.setPixelRatio(1);
      scene=new T.Scene();scene.background=new T.Color('#f6f8fa');const mesh=library.create(key,item.w,item.height,item.d);scene.add(mesh);
      scene.add(new T.HemisphereLight(0xffffff,0x64748b,1.2));const light=new T.DirectionalLight(0xffffff,.9);light.position.set(200,400,300);scene.add(light);
      const extent=Math.max(item.w,item.d,item.height),camera=new T.PerspectiveCamera(35,200/140,.1,extent*20);camera.position.set(extent*1.8,extent*1.4,extent*2);camera.lookAt(0,item.height*.45,0);
      renderer.render(scene,camera);const uri=renderer.domElement.toDataURL('image/png');cache.set(key,uri);return uri;
    }catch{return null;}finally{scene?.traverse(object=>{object.geometry?.dispose();if(object.material){for(const mat of [object.material].flat())mat.dispose();}});}
  }
  function render(){
    list.replaceChildren();for(const btn of filters.children)btn.setAttribute('aria-pressed',String(btn.dataset.filter===filter));
    const query=normalize(search.value),rows=Object.entries(library.catalog).filter(([key,item])=>(category.selectedIndex===0||item.category===category.value)&&(!size.value||item.w/100<=Number(size.value))&&(filter==='all'||(filter==='favorites'?favorites:recent).includes(key))&&normalize([item.name,item.id,item.category,...item.tags].join(' ')).includes(query));
    if(filter==='recent')rows.sort(([a],[b])=>recent.indexOf(a)-recent.indexOf(b));
    status.textContent=rows.length?rows.length+' modelos disponíveis':'Nenhum modelo encontrado. Ajuste a busca ou a categoria.';
    const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.max(0,Math.min(page,pages-1));pageLabel.textContent=(page+1)+' / '+pages;previous.disabled=page===0;next.disabled=page===pages-1;
    for(const [key,item] of rows.slice(page*pageSize,(page+1)*pageSize)){
      const card=make('div');card.className='industrial-library-card';
      const choose=button('',()=>{library.select(key);recent=[key,...recent.filter(id=>id!==key)].slice(0,12);persist();if(matchMedia('(max-width:700px)').matches){panel.hidden=true;toggle.setAttribute('aria-expanded','false');sync();resize();}status.textContent=item.name+' selecionado. Clique na planta para inserir.';});
      choose.draggable=true;choose.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-astha-model',key);event.dataTransfer.effectAllowed='copy';});
      choose.dataset.libraryModel=key;choose.title=item.name+' · '+item.id;choose.setAttribute('aria-label','Inserir '+item.name);
      const image=make('img');image.alt='';image.loading='lazy';const uri=thumbnail(key,item);if(uri){image.src=uri;choose.append(image);}
      choose.append(make('span',item.name),make('small',[item.w/100,item.d/100,item.height/100].join(' × ')+' m'));
      const star=button(favorites.includes(key)?'★':'☆',()=>{favorites=favorites.includes(key)?favorites.filter(id=>id!==key):[...favorites,key];persist();render();});star.className='favorite';star.setAttribute('aria-label','Favoritar '+item.name);star.setAttribute('aria-pressed',String(favorites.includes(key)));card.append(choose,star);list.append(card);
    }
  }
  for(const el of [search,category,size])el.addEventListener(el===category?'change':'input',()=>{page=0;render();});
  const canvas=document.getElementById('cadCanvas2d');canvas?.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('application/x-astha-model')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});canvas?.addEventListener('drop',event=>{const key=event.dataTransfer.getData('application/x-astha-model');if(!library.catalog[key])return;event.preventDefault();library.select(key);canvas.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:event.clientX,clientY:event.clientY}));canvas.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:event.clientX,clientY:event.clientY}));});
  render();
  // Defer GPU work until the panel is actually opened.
  toggle.addEventListener('click',()=>{if(!panel.hidden)render();});
});
