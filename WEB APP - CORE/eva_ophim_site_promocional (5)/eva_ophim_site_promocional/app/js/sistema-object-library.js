/* Procedural CAD library. Models share the same footprint and physical bounds in both views. */
window.ASTHAObjectLibrary = (() => {
  const entries = {
    GENERIC_MACHINE: {name:'Centro de usinagem CNC',tool:'machine',w:180,d:140,height:210},
    LATHE: {name:'Torno industrial',tool:'machine',w:240,d:100,height:150},
    FURNACE: {name:'Forno industrial',tool:'machine',w:160,d:150,height:220},
    PRESS: {name:'Prensa hidráulica',tool:'machine',w:140,d:110,height:230},
    CONVEYOR: {name:'Esteira transportadora',tool:'machine',w:300,d:90,height:100},
    CRATE: {name:'Caixa de madeira',tool:'machine',w:100,d:80,height:90},
    CARTON: {name:'Caixa de papelão',tool:'machine',w:60,d:40,height:45},
    PALLET: {name:'Palete',tool:'machine',w:120,d:100,height:15},
    FORKLIFT: {name:'Empilhadeira',tool:'forklift',w:300,d:120,height:220}
    ,MILL: {id:'ASTHA-3D-001',category:'Usinagem e metalurgia',name:'Fresadora universal',tool:'machine',w:180,d:150,height:220,tags:['usinagem','fresa']}
    ,DRILL: {id:'ASTHA-3D-003',category:'Usinagem e metalurgia',name:'Furadeira de coluna',tool:'machine',w:70,d:90,height:180,tags:['usinagem','broca']}
    ,BANDSAW: {id:'ASTHA-3D-007',category:'Usinagem e metalurgia',name:'Serra de fita',tool:'machine',w:160,d:90,height:160,tags:['corte','serra']}
    ,TANK: {id:'ASTHA-3D-027',category:'Processamento industrial',name:'Tanque agitado',tool:'machine',w:150,d:150,height:240,tags:['mistura','reservatorio']}
    ,SILO: {id:'ASTHA-3D-033',category:'Processamento industrial',name:'Silo',tool:'machine',w:200,d:200,height:500,tags:['graos','armazenagem']}
    ,ROBOT: {id:'ASTHA-3D-053',category:'Robótica e células automatizadas',name:'Braço robótico de seis eixos',tool:'machine',w:180,d:140,height:220,tags:['automacao','robo']}
    ,SCARA: {id:'ASTHA-3D-054',category:'Robótica e células automatizadas',name:'Robô SCARA',tool:'machine',w:120,d:100,height:150,tags:['automacao','robo']}
    ,ROLLER: {id:'ASTHA-3D-065',category:'Transportadores e transferência',name:'Transportador de roletes livres',tool:'machine',w:300,d:80,height:90,tags:['esteira','transportador']}
    ,ROLLER_MOTOR: {id:'ASTHA-3D-066',category:'Transportadores e transferência',name:'Transportador de roletes motorizados',tool:'machine',w:300,d:100,height:90,tags:['esteira','motor']}
    ,AGV: {id:'ASTHA-3D-085',category:'Movimentação e elevação',name:'AGV',tool:'machine',w:130,d:90,height:45,tags:['veiculo','autonomo','logistica']}
    ,COMPRESSOR: {id:'ASTHA-3D-119',category:'Utilidades industriais',name:'Compressor de parafuso',tool:'machine',w:150,d:100,height:140,tags:['ar comprimido','utilidades']}
    ,PUMP: {id:'ASTHA-3D-124',category:'Utilidades industriais',name:'Bomba centrífuga',tool:'machine',w:140,d:70,height:90,tags:['agua','motor','utilidades']}
    ,EXTINGUISHER: {id:'ASTHA-3D-183',category:'Segurança industrial',name:'Extintor',tool:'machine',w:35,d:35,height:80,tags:['incendio','seguranca']}
    ,FENCE: {id:'ASTHA-3D-190',category:'Segurança industrial',name:'Cerca de proteção de máquinas',tool:'machine',w:200,d:25,height:200,tags:['grade','barreira','seguranca']}
  };
  const aliases=Object.fromEntries(Object.entries(entries).filter(([,item])=>item.id).map(([key,item])=>[key,item.id]));
  const catalog=Object.freeze({...Object.fromEntries(Object.entries(entries).filter(([,item])=>!item.id).map(([key,item])=>[key,Object.freeze({
    ...item,id:item.id||'ASTHA-LEGACY-'+key,version:'1.0.0',category:item.category||'Modelos básicos',
    geometryType:'parametric',dimensions:{length:item.w/100,width:item.d/100,height:item.height/100,unit:'m'},
    capabilities:{resizable:true,rotatable:true,snap:false,connectors:false,collision:false,assetLink:false},
    origin:'ASTHA · geometria procedural autoral',tags:item.tags||[]
  })])),...(window.ASTHAIndustrialCatalog?.byId||{})});
  const resolve=key=>aliases[key]||key;
  let pending='GENERIC_MACHINE';
  function select(key) {key=resolve(key); if(!catalog[key])return;pending=key;window.setCadTool(catalog[key].tool);document.querySelectorAll('[data-library-model]').forEach(button=>button.classList.toggle('active',button.dataset.libraryModel===key));if(typeof showToast==='function')showToast('Clique na planta 2D para posicionar: '+catalog[key].name,'info'); }
  function definition(tool){const key=tool==='forklift'?'FORKLIFT':(catalog[pending]?.tool===tool?pending:'GENERIC_MACHINE');return {...catalog[key],key};}
  function create(key,width,height,depth,source={}){
    key=resolve(key);
    if(window.ASTHAIndustrialCatalog?.byId[key]){
      const high=window.ASTHAIndustrialGenerators.create(catalog[key],width,height,depth,source);
      if(source.detail==='low'||!window.THREE.LOD)return high;
      const lod=new window.THREE.LOD();lod.addLevel(high,0);
      lod.addLevel(window.ASTHAIndustrialGenerators.create(catalog[key],width,height,depth,{...source,detail:'low',animation:false}),Math.max(width,height,depth)*8);
      lod.userData={...high.userData,lod:true};return lod;
    }
    const T=window.THREE;if(!T)throw Error('Three.js indisponível');key=catalog[key]?key:'GENERIC_MACHINE';const model=new T.Group();
    const material=color=>new T.MeshStandardMaterial({color,roughness:.55,metalness:.25});
    const steel=material('#667b8e'),dark=material('#25333e'),silver=material('#c2ccd3'),blue=material('#487c91'),orange=material('#e8a333'),wood=material('#bb8c55'),paper=material('#c4a077'),glass=new T.MeshStandardMaterial({color:'#3d6579',roughness:.2,metalness:.2});
    function box(x,y,z,w,h,d,mat){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);model.add(mesh);return mesh;}
    function cylinder(x,y,z,r,length,mat,axis='y'){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,length,20),mat);if(axis==='x')mesh.rotation.z=Math.PI/2;if(axis==='z')mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);model.add(mesh);return mesh;}
    function feet(){for(const x of [-.36,.36])for(const z of [-.32,.32])box(x,.08,z,.12,.16,.12,dark);}
    function console(x,y,z){box(x,y,z,.18,.23,.08,steel);box(x,y+.03,z+.045,.12,.10,.015,glass);for(const dx of [-.04,0,.04])cylinder(x+dx,y-.065,z+.05,.012,.015,orange,'z');}
    if(key==='FORKLIFT'){
      box(-.10,.28,0,.64,.28,.64,orange);box(-.34,.45,0,.18,.27,.64,orange);
      for(const x of [-.29,.20])for(const z of [-.32,.32]){cylinder(x,.18,z,.17,.10,dark,'z');cylinder(x,.18,z*1.15,.07,.012,silver,'z');}
      box(-.04,.47,0,.22,.08,.24,dark);box(-.14,.59,0,.07,.24,.24,dark);
      for(const x of [-.28,.20])for(const z of [-.28,.28])box(x,.70,z,.035,.55,.035,dark);box(-.04,1,0,.57,.04,.66,dark);
      for(const z of [-.23,.23])box(.35,.61,z,.055,.90,.055,steel);box(.36,.38,0,.08,.08,.58,steel);
      for(const z of [-.20,.20])box(.61,.13,z,.53,.035,.06,silver);
      cylinder(.14,.58,0,.11,.025,dark,'x');
    }else if(key==='LATHE'){
      feet();box(0,.27,0,.86,.22,.55,blue);box(0,.48,0,.94,.13,.38,steel);
      box(-.34,.71,0,.24,.39,.50,blue);cylinder(-.18,.74,0,.15,.10,silver,'x');cylinder(.03,.74,0,.06,.38,silver,'x');
      box(.34,.65,0,.20,.19,.26,steel);box(.08,.61,.13,.20,.14,.28,blue);cylinder(.08,.59,.31,.065,.04,dark,'z');console(-.34,.82,.28);
    }else if(key==='FURNACE'){
      feet();box(0,.55,0,.78,.87,.65,steel);box(0,.54,.34,.66,.67,.07,dark);box(0,.55,.385,.48,.47,.025,orange);box(0,.55,.405,.37,.36,.025,dark);
      box(.26,.57,.43,.035,.22,.035,silver);cylinder(-.23,1.07,-.18,.085,.24,steel);console(.29,.90,.38);
    }else if(key==='PRESS'){
      feet();box(0,.18,0,.87,.16,.66,blue);for(const x of [-.35,.35])box(x,.62,0,.12,.90,.5,blue);
      box(0,1.02,0,.82,.15,.55,blue);cylinder(0,.82,0,.10,.27,silver);box(0,.68,0,.55,.09,.48,steel);box(0,.40,0,.64,.10,.5,silver);console(.43,.72,.29);
    }else if(key==='MILL'||key==='DRILL'){
      box(0,.08,0,.7,.16,.7,blue);box(0,.52,-.20,.24,.90,.24,blue);
      box(0,.65,.09,.65,.09,.55,silver);box(0,.98,0,.32,.21,.46,blue);cylinder(0,.82,.15,.04,.22,silver);
      if(key==='MILL'){box(0,.40,.07,.46,.30,.32,steel);cylinder(.30,.53,.36,.075,.045,dark,'z');console(-.30,.83,.06);}
      else{cylinder(0,.40,-.20,.08,.65,silver);box(.25,.93,.10,.32,.025,.025,dark);}
    }else if(key==='BANDSAW'){
      feet();box(0,.28,0,.9,.35,.55,blue);box(0,.51,0,.9,.07,.60,silver);
      box(-.37,.78,0,.14,.52,.3,blue);box(.37,.78,0,.14,.52,.3,blue);box(0,1.02,0,.87,.13,.3,blue);
      box(0,.69,.02,.7,.02,.06,dark);cylinder(-.32,.91,.17,.10,.04,silver,'z');cylinder(.32,.91,.17,.10,.04,silver,'z');
    }else if(key==='TANK'||key==='SILO'){
      for(const x of [-.30,.30])for(const z of [-.30,.30])box(x,.25,z,.05,.5,.05,steel);
      cylinder(0,.74,0,.43,.70,silver);cylinder(0,1.10,0,.44,.035,steel);
      if(key==='TANK'){cylinder(0,1.22,0,.10,.22,blue);box(0,1.11,0,.55,.04,.10,blue);cylinder(.42,.52,0,.045,.18,steel,'x');}
      else{const cone=new T.Mesh(new T.CylinderGeometry(.43,.075,.35,20),silver);cone.position.y=.23;model.add(cone);cylinder(0,.045,0,.08,.09,steel);for(let i=0;i<12;i++)box(.46,.2+i*.08,0,.04,.025,.35,orange);}
    }else if(key==='ROBOT'||key==='SCARA'){
      cylinder(0,.08,0,.30,.16,dark);cylinder(0,.27,0,.18,.30,orange);
      if(key==='SCARA'){box(0,.73,0,.17,.72,.18,blue);box(.27,1.02,0,.60,.11,.16,orange);cylinder(.54,.96,0,.10,.20,dark);box(.70,.96,0,.36,.10,.13,orange);cylinder(.87,.78,0,.035,.36,silver);}
      else{cylinder(0,.48,0,.16,.26,dark,'z');const arm=box(.13,.73,0,.18,.57,.19,orange);arm.rotation.z=-.45;cylinder(.25,.99,0,.13,.22,dark,'z');const fore=box(.47,1.02,0,.52,.14,.16,orange);fore.rotation.z=.15;cylinder(.73,1.06,0,.09,.16,dark,'z');box(.81,.97,0,.10,.22,.10,silver);for(const z of [-.065,.065])box(.83,.84,z,.12,.10,.035,dark);}
    }else if(key==='AGV'){
      box(0,.22,0,.90,.30,.65,orange);box(0,.40,0,.8,.06,.60,silver);for(const x of [-.30,.30])for(const z of [-.33,.33])cylinder(x,.14,z,.12,.08,dark,'z');cylinder(.32,.45,0,.065,.10,dark);box(-.46,.24,0,.015,.08,.38,glass);
    }else if(key==='COMPRESSOR'){
      feet();box(0,.54,0,.90,.78,.66,blue);for(let i=0;i<7;i++)box(-.20,.37+i*.065,.34,.35,.025,.025,dark);console(.25,.72,.34);cylinder(.35,1.01,-.15,.045,.17,silver);box(0,.15,0,1,.08,.74,steel);
    }else if(key==='PUMP'){
      box(0,.08,0,1,.16,.55,steel);cylinder(-.23,.37,0,.19,.44,blue,'x');for(let i=0;i<8;i++)box(-.23,.48,-.15+i*.042,.40,.035,.022,steel);cylinder(.18,.32,0,.20,.20,blue,'x');cylinder(.20,.54,0,.065,.30,silver);cylinder(.40,.32,0,.065,.25,silver,'x');cylinder(.54,.32,0,.11,.035,steel,'x');
    }else if(key==='EXTINGUISHER'){
      const red=material('#c94141');cylinder(0,.42,0,.18,.66,red);cylinder(0,.78,0,.065,.08,dark);box(.06,.83,0,.27,.03,.05,dark);box(-.16,.48,0,.025,.55,.025,dark);box(0,.45,.18,.18,.22,.015,silver);
    }else if(key==='FENCE'){
      for(const x of [-.47,.47]){box(x,.52,0,.045,1.04,.045,orange);box(x,.025,0,.15,.05,.20,steel);}for(const y of [.15,.96])box(0,y,0,.94,.025,.025,orange);for(let i=0;i<16;i++)box(-.44+i*.059,.55,0,.009,.80,.009,steel);for(let i=0;i<10;i++)box(0,.16+i*.08,0,.89,.008,.008,steel);
    }else if(key==='CONVEYOR'||key==='ROLLER'||key==='ROLLER_MOTOR'){
      for(const x of [-.4,.4])for(const z of [-.3,.3])box(x,.28,z,.055,.56,.055,steel);
      box(0,.6,0,1,.10,.70,dark);for(let i=0;i<12;i++)cylinder(-.46+i*.083,.665,0,.035,.68,silver,'z');for(const z of [-.37,.37])box(0,.68,z,1,.07,.035,blue);
      if(key==='ROLLER_MOTOR'){cylinder(-.34,.52,.45,.08,.19,blue,'z');box(-.34,.48,.32,.14,.1,.1,steel);}
    }else if(key==='CRATE'||key==='CARTON'){
      box(0,.5,0,.94,.94,.74,key==='CRATE'?wood:paper);
      if(key==='CRATE'){for(const x of [-.39,.39])for(const z of [-.395,.395])box(x,.5,z,.10,1,.035,wood);for(const y of [.08,.33,.66,.92])for(const z of [-.395,.395])box(0,y,z,1,.06,.04,wood);}
      else{box(0,.978,0,.11,.018,.75,wood);box(0,.5,.38,.12,.94,.015,wood);box(.24,.55,.39,.23,.20,.01,silver);}
    }else if(key==='PALLET'){
      for(const x of [-.4,0,.4])for(const z of [-.32,0,.32])box(x,.10,z,.15,.12,.16,wood);
      for(let i=0;i<5;i++)box(0,.20,-.4+i*.2,1,.06,.13,wood);for(const x of [-.4,0,.4])box(x,.025,0,.15,.05,.94,wood);
    }else{
      feet();box(0,.24,0,.98,.22,.74,blue);box(0,.66,-.24,.98,.67,.28,steel);for(const x of [-.41,.41])box(x,.66,.04,.15,.67,.65,blue);
      box(0,.97,0,.98,.13,.77,blue);box(0,.64,.385,.63,.56,.045,silver);box(0,.70,.415,.49,.29,.015,glass);box(.25,.56,.45,.025,.14,.025,dark);console(.48,.78,.43);
    }
    model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const wrapper=new T.Group();model.position.set(-center.x,-bounds.min.y,-center.z);wrapper.add(model);wrapper.scale.set(Math.max(.001,width)/size.x,Math.max(.001,height)/size.y,Math.max(.001,depth)/size.z);return wrapper;
  }
  return {catalog,select,definition,create,resolve};
})();

