/* Authored parametric, illustrative geometry. No manufacturer specifications. */
window.ASTHAIndustrialGenerators = (() => {
  function create(def, width, height, depth, source={}) {
    const T=window.THREE, n=Number(def.id.slice(-3)), params={};
    if(!T||!Number.isInteger(n)||n<1||n>248)throw Error('Modelo industrial inválido');
    for(const [key,p] of Object.entries(def.parameters||{})){const v=Number(source.parameters?.[key]??p.default);params[key]=Math.max(p.min,Math.min(p.max,Number.isFinite(v)?(p.integer?Math.round(v):v):p.default));}
    const batches=new Map(), bounds=new T.Box3(), temp=new T.Object3D();
    const colors={body:source.color||'#487c91',steel:'#667b8e',silver:'#c2ccd3',dark:'#25333e',orange:'#e8a333',red:'#c94141',green:'#087f72',glass:'#7eacbf',white:'#edf2f6',wood:'#bb8c55'};
    const material={};for(const [key,color] of Object.entries(colors))material[key]=new T.MeshStandardMaterial({color,roughness:key==='glass'?.25:.6,metalness:key==='silver'?.6:.2});
    const segments=source.detail==='low'?6:12;
    const shapes={box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(.5,.5,1,segments),cone:new T.CylinderGeometry(.5,.08,1,segments),sphere:new T.SphereGeometry(.5,segments,segments===6?4:8)};
    for(const geo of Object.values(shapes))geo.computeBoundingBox();
    function primitive(kind,x,y,z,w,h,d,color='body',rx=0,ry=0,rz=0){
      if(![x,y,z,w,h,d,rx,ry,rz].every(Number.isFinite)||Math.min(w,h,d)<=0)throw Error('Geometria inválida');
      temp.position.set(x,y,z);temp.scale.set(w,h,d);temp.rotation.set(rx,ry,rz);temp.updateMatrix();
      const key=kind+':'+color;if(!batches.has(key))batches.set(key,{kind,color,matrices:[],bounds:new T.Box3()});
      const batch=batches.get(key),matrix=temp.matrix.clone(),box=shapes[kind].boundingBox.clone().applyMatrix4(matrix);batch.matrices.push(matrix);batch.bounds.union(box);bounds.union(box);
    }
    const box=(x,y,z,w,h,d,c='body',rz=0)=>primitive('box',x,y,z,w,h,d,c,0,0,rz);
    const cyl=(x,y,z,r,l,c='silver',axis='y')=>primitive('cylinder',x,y,z,r*2,l,r*2,c,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);
    const cone=(x,y,z,r,l,c='silver')=>primitive('cone',x,y,z,r*2,l,r*2,c);
    function rod(a,b,r=.025,c='silver'){
      const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),mid=start.clone().add(end).multiplyScalar(.5);temp.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());temp.position.copy(mid);temp.scale.set(r*2,delta.length(),r*2);temp.updateMatrix();const key='cylinder:'+c;if(!batches.has(key))batches.set(key,{kind:'cylinder',color:c,matrices:[],bounds:new T.Box3()});const batch=batches.get(key),matrix=temp.matrix.clone(),bb=shapes.cylinder.boundingBox.clone().applyMatrix4(matrix);batch.matrices.push(matrix);batch.bounds.union(bb);bounds.union(bb);
    }
    function feet(y=.16){for(const x of [-.38,.38])for(const z of [-.30,.30])box(x,y/2,z,.08,y,.08,'dark');}
    function base(y=.15){feet();box(0,y,0,.94,.12,.70,'body');}
    function console(x=.42,y=.75,z=.38){box(x,y,z,.17,.23,.06,'steel');box(x,y+.03,z+.035,.12,.10,.01,'glass');for(let i=0;i<3;i++)cyl(x-.04+i*.04,y-.06,z+.04,.01,.01,i===0?'red':'green','z');}
    function enclosure(){base();box(0,.60,-.30,.90,.80,.10);box(-.42,.6,0,.10,.80,.65);box(.42,.6,0,.10,.80,.65);box(0,1,0,.94,.10,.70);box(0,.60,.35,.66,.66,.025,'glass');console();}
    function table(y=.60){for(const x of [-.40,.40])for(const z of [-.3,.3])box(x,y/2,z,.045,y,.045,'steel');box(0,y,0,.94,.07,.72,'silver');}
    function motor(x=0,y=.45,z=0,axis='x'){cyl(x,y,z,.14,.35,'body',axis);for(let i=0;i<6;i++)box(x,y+.10,z-.12+i*.048,.28,.025,.013,'steel');}
    function vessel(agitator=false){for(const x of [-.28,.28])for(const z of [-.28,.28])box(x,.18,z,.035,.36,.035,'steel');cyl(0,.65,0,.38,.66);cyl(0,.99,0,.39,.04,'steel');cyl(.36,.60,0,.045,.22,'silver','x');cyl(0,1.02,0,.09,.10,'silver');if(agitator){motor(0,1.12,0,'y');box(0,1.04,0,.50,.025,.09,'body');}}
    function drum(horizontal=false){base();cyl(0,.56,0,.30,.90,'silver',horizontal?'x':'y');if(horizontal){for(const x of [-.35,.35])box(x,.28,0,.10,.24,.38,'steel');}else cyl(0,1.02,0,.31,.04,'steel');}
    function hopper(){for(const x of [-.33,.33])for(const z of [-.28,.28])box(x,.45,z,.04,.90,.04,'steel');cone(0,.72,0,.40,.50);cyl(0,.42,0,.07,.13,'steel');cyl(0,1,0,.41,.03,'steel');}
    function roller(x,y,z,angle=0){rod([x-Math.sin(angle)*.30,y,z-Math.cos(angle)*.30],[x+Math.sin(angle)*.30,y,z+Math.cos(angle)*.30],.025);}
    function conveyor(kind='roller'){
      const count=params.rollers||12,incline=kind==='incline'?Math.tan((params.inclination??12)*Math.PI/180)*.8:0;
      for(const x of [-.43,.43])for(const z of [-.31,.31])box(x,.26+incline*(x+.43)/2,z,.035,.52+incline*(x+.43),.035,'steel');
      for(const z of [-.35,.35])rod([-.50,.55,z],[.50,.55+incline,z],.02,'body');
      if(['belt','modular','incline','chain','sorter'].includes(kind))box(0,.57+incline/2,0,1,.04,.65,'dark',Math.atan(incline));
      if(kind==='chain'){for(const z of [-.22,.22])box(0,.61,z,1,.03,.045,'silver');}
      else if(kind==='modular'){for(let i=0;i<count;i++)box(-.48+i*.96/(count-1),.61,0,.035,.025,.64,'silver');}
      else if(!['belt','incline'].includes(kind)){for(let i=0;i<count;i++)roller(-.48+i*.96/(count-1),.60,0);}
      if(['motor','sorter'].includes(kind))motor(-.3,.44,.44,'z');
      if(kind==='sorter'){for(let i=0;i<4;i++)rod([-.20+i*.13,.64,-.30],[.01+i*.13,.64,.30],.035,'orange');box(.2,.56,.57,.4,.06,.4,'steel');}
    }
    function curve(belt=false){
      const count=params.rollers||16;for(let i=0;i<count;i++){const a=i*Math.PI/(2*(count-1)),x=Math.cos(a)*.60,z=Math.sin(a)*.60;roller(x,.60,z,-a);if(belt)box(x,.59,z,.12,.04,.45,'dark');}
      for(const a of [0,Math.PI/4,Math.PI/2]){const x=Math.cos(a)*.6,z=Math.sin(a)*.6;box(x,.28,z,.06,.56,.06,'steel');}
    }
    function fence(gate=false,mesh=true){for(const x of [-.46,.46]){box(x,.5,0,.04,1,.04,'orange');box(x,.015,0,.13,.03,.20,'steel');}for(const y of [.12,.94])box(0,y,0,.90,.025,.025,'orange');if(mesh){for(let i=0;i<15;i++)box(-.42+i*.06,.53,0,.006,.80,.008,'steel');for(let i=0;i<10;i++)box(0,.13+i*.088,0,.85,.008,.008,'steel');}if(gate){box(.35,.53,.04,.035,.18,.04,'dark');cyl(-.46,.7,.04,.025,.06,'steel');}}
    function rack(style='pallet'){
      const levels=params.levels||4,modules=params.modules||2;
      for(let j=0;j<=modules;j++)for(const z of [-.35,.35])box(-.5+j/modules,.50,z,.025,1,.025);
      for(let i=0;i<levels;i++){const y=.10+i*.86/Math.max(1,levels-1);for(const z of [-.35,.35])box(0,y,z,1,.022,.025,'orange');if(style!=='drivein')box(0,y+.02,0,.98,.025,.65,'silver');if(['flow','pushback','drivein'].includes(style))for(let j=0;j<7;j++)box(0,y+.04,-.30+j*.1,.98,.018,.015,'silver');if(style==='parts')for(let j=0;j<modules*3;j++)box(-.46+j*.92/(modules*3),y+.08,.12,.12,.1,.22,'orange');}
      if(style==='drivein')for(let j=0;j<=modules;j++)box(-.5+j/modules,.96,0,.025,.03,.7,'orange');
      if(style==='shuttle')box(.2,.38,0,.20,.06,.50,'orange');if(style==='miniload'){box(0,.50,.44,.03,1,.03,'steel');box(0,.42,.34,.4,.08,.25,'orange');}
    }
    function robot(kind='six',cobot=false){
      cyl(0,.06,0,.24,.12,'dark');cyl(0,.22,0,.13,.25,cobot?'silver':'orange');
      if(kind==='scara'){box(0,.61,0,.12,.65,.12);box(.24,.91,0,.56,.10,.13,'orange');cyl(.50,.87,0,.09,.15,'dark');box(.64,.88,0,.30,.07,.12,'orange');cyl(.78,.7,0,.025,.34,'silver');}
      else {cyl(0,.4,0,.13,.19,'dark','z');rod([0,.4,0],[.20,.88,0],.085,cobot?'silver':'orange');cyl(.20,.88,0,.11,.18,'dark','z');rod([.20,.88,0],[.60,.98,0],.07,cobot?'silver':'orange');cyl(.60,.98,0,.075,.13,'dark','z');rod([.60,.98,0],[.7,.79,0],.04);for(const z of [-.05,.05])box(.70,.74,z,.10,.08,.025,'dark');}
    }
    function gantry(){for(const x of [-.45,.45])for(const z of [-.35,.35])box(x,.55,z,.04,1.10,.04,'steel');for(const z of [-.35,.35])box(0,1.10,z,1,.07,.07,'body');box(0,1.06,0,.10,.10,.8,'silver');box(0,.75,0,.10,.50,.1,'orange');}
    function cart(shelves=2){for(const x of [-.4,.4])for(const z of [-.3,.3]){cyl(x,.07,z,.065,.04,'dark','z');box(x,.5,z,.025,.90,.025,'steel');}for(let i=0;i<shelves;i++)box(0,.16+i*.65/Math.max(1,shelves-1),0,.85,.04,.65,'silver');box(-.45,.90,0,.025,.05,.70,'body');}
    function wheels(){for(const x of [-.30,.30])for(const z of [-.32,.32])cyl(x,.15,z,.13,.08,'dark','z');}
    function vehicle(kind='agv'){wheels();box(0,.28,0,.90,.28,.65,'orange');if(kind==='amr'){cyl(.25,.5,0,.065,.10,'dark');box(0,.52,0,.55,.18,.48,'silver');}else if(kind==='agv'){box(0,.45,0,.78,.06,.56,'silver');box(-.46,.3,0,.015,.08,.30,'glass');}else{box(-.15,.48,0,.20,.08,.28,'dark');box(-.26,.57,0,.05,.21,.28,'dark');cyl(.12,.60,0,.10,.025,'dark','x');if(kind==='reach'||kind==='stacker'){for(const z of [-.20,.20])box(.35,.72,z,.035,1.3,.035,'steel');for(const z of [-.2,.2])box(.55,.17,z,.5,.025,.07,'silver');}else box(.45,.32,0,.12,.06,.12,'steel');}}
    function cabinet(drawers=0){base(.09);box(0,.52,0,.85,.86,.6);if(drawers){for(let i=0;i<drawers;i++){const y=.16+i*.75/drawers;box(0,y,.31,.80,.65/drawers,.02,'silver');box(0,y,.34,.32,.025,.02,'dark');}}else{for(const x of [-.21,.21]){box(x,.53,.31,.4,.78,.015,'silver');box(x+.10,.52,.33,.015,.16,.02,'dark');}}}
    function screen(x=0,y=.75,z=0){box(x,y,z,.45,.32,.07,'dark');box(x,y,z+.04,.39,.26,.012,'glass');box(x,y-.27,z,.035,.25,.035,'steel');}
    function pump(){base(.08);motor(-.23,.35,0);cyl(.16,.32,0,.19,.20,'body','x');cyl(.18,.52,0,.06,.25);cyl(.38,.32,0,.06,.24,'silver','x');cyl(.51,.32,0,.10,.025,'steel','x');}
    function pipe(axis='x',r=.10,l=1){cyl(0,.20,0,r,l,'silver',axis);if(axis==='x')for(const x of [-.49,.49])cyl(x,.20,0,r*1.35,.035,'steel','x');}
    function duct(){box(0,.25,0,1,.35,.35,'silver');for(const x of [-.46,.46])box(x,.25,0,.035,.42,.42,'steel');}
    function room(glazed=false){box(0,.025,0,1,.05,.8,'steel');box(0,.5,-.4,1,.95,.025);for(const x of [-.5,.5])box(x,.5,0,.025,.95,.8);box(0,1,0,1,.05,.85,'silver');box(-.34,.5,.4,.32,.95,.025,'body');box(.30,.5,.4,.4,.95,.025,'body');box(0,.76,.4,.28,.42,.025,glazed?'glass':'silver');if(glazed)box(0,.64,-.42,.65,.35,.015,'glass');else cabinet();}
    function bench(style='plain'){table();if(['maintenance','calibration','electric','operator','ergonomic','testing'].includes(style)){box(0,.87,-.34,.95,.5,.035,'steel');screen(.18,.86,-.29);for(let i=0;i<5;i++)box(-.35+i*.09,.88,-.31,.035,.12,.025,'orange');}if(style==='adjustable'){for(const x of [-.35,.35]){box(x,.35,0,.06,.65,.1,'body');box(x,.035,0,.35,.05,.7,'dark');}}if(style==='packing')for(const x of [-.26,.26])box(x,.72,0,.22,.2,.24,'wood');}
    function switchboard(kind='qgbt'){const count=kind==='qgbt'?4:kind==='mcc'?3:1;for(let i=0;i<count;i++){const x=-.5+(i+.5)/count;box(x,.5,0,.97/count,.97,.5,'steel');box(x,.5,.26,.90/count,.90,.015,'white');box(x,.72,.28,.20/count,.08,.01,'glass');box(x,.50,.29,.012,.10,.025,'dark');if(kind==='plc')for(let j=0;j<5;j++)box(x-.15+j*.06,.40,.28,.045,.12,.02,'body');}box(0,.015,0,1,.03,.55,'dark');}
    function sensor(kind){
      box(0,.06,0,.5,.06,.4,'steel');
      if(['inductive','capacitive','encoder','pressure','thermocouple','vibration'].includes(kind)){cyl(0,.25,0,.12,.30,'silver');if(kind==='thermocouple')cyl(0,.64,0,.025,.65);else if(kind==='pressure'){cyl(0,.55,0,.18,.08,'dark','z');cyl(0,.55,.05,.15,.015,'white','z');rod([0,.55,.07],[.10,.62,.07],.006,'dark');}else{cyl(0,.41,0,.13,.025,kind==='capacitive'?'orange':'dark');if(kind==='encoder')cyl(0,.53,0,.04,.25);}}
      else if(kind==='loadcell'){box(0,.20,0,.7,.15,.35);cyl(-.23,.20,0,.08,.16,'dark');cyl(.23,.20,0,.08,.16,'dark');}
      else if(kind==='lidar'){cyl(0,.3,0,.24,.36,'body');cyl(0,.49,0,.25,.08,'dark');}
      else {box(0,.32,0,.5,.5,.30,'body');if(kind==='rfid'){for(let i=0;i<4;i++)box(0,.20+i*.06,.16,.35,.015,.015,'dark');}else{cyl(0,.35,.20,.12,.15,'dark','z');cyl(0,.35,.29,.085,.02,kind==='photo'?'red':'glass','z');}rod([.20,.28,-.15],[.35,.05,-.26],.01,'dark');}
    }
    // Individual model recipes. Reusable components are composed into distinct layouts.
    if(n<=14){
      switch(n){
        case 1:case 2:case 3:case 4:base();box(0,.57,-.22,.22,.85,.20);box(0,.62,.07,.8,.08,.5,'silver');box(n===4?-.22:0,.94,-.05,.30,.18,.40);cyl(n===4?-.20:0,.77,.12,.035,.20,'silver',n===4?'x':'y');if(n!==3){box(0,.40,.04,.45,.3,.3,'steel');console();}if(n===1){box(-.25,.72,.28,.2,.08,.13,'steel');cyl(-.24,.72,.37,.06,.03,'dark','z');}if(n===2)box(0,1.05,-.18,.12,.18,.12,'silver');break;
        case 5:case 6:base();box(0,.45,0,.95,.15,.5,'silver');box(-.35,.7,-.1,.2,.6,.3);cyl(-.15,.8,0,.17,.08,'dark',n===5?'z':'x');if(n===6){cyl(.15,.56,0,.05,.48,'silver','x');box(.36,.58,0,.16,.2,.25,'steel');}console();break;
        case 7:base();box(0,.45,0,.9,.07,.6,'silver');for(const x of [-.35,.35])box(x,.73,0,.13,.55,.25);box(0,1,0,.8,.12,.25);for(const x of [-.3,.3])cyl(x,.86,.15,.10,.04,'silver','z');box(0,.6,.1,.65,.015,.04,'dark');break;
        case 8:case 9:case 10:base();for(const x of [-.4,.4])box(x,.60,0,.12,.9,.45);box(0,1,0,.9,.12,.5);box(0,.55,.1,.8,.08,.5,'silver');if(n===9){box(0,.73,0,.75,.13,.10,'dark');box(0,.52,0,.8,.06,.07,'dark');}else if(n===10){cyl(0,.78,.1,.08,.3);box(.16,.47,.12,.55,.035,.65,'silver');}else{box(0,.7,0,.8,.03,.05,'silver');box(0,.8,0,.8,.09,.10,'orange');}console();break;
        case 11:case 12:table(.35);for(let i=0;i<12;i++)box(-.45+i*.08,.41,0,.015,.08,.7,'dark');for(const z of [-.35,.35])box(0,.5,z,1,.05,.04);box(.1,.68,0,.08,.08,.8,'silver');box(.1,.56,.06,.08,.2,.1,n===11?'red':'orange');if(n===11){box(0,.9,-.35,1,.04,.04);box(0,.7,-.35,1,.4,.025,'glass');}break;
        case 13:enclosure();box(0,.50,0,.55,.25,.45,'silver');cyl(0,.75,0,.025,.32);break;
        case 14:enclosure();conveyor('belt');cyl(0,.80,0,.14,.6,'dark','z');break;
      }
    }else if(n<=26){
      switch(n){
        case 15:case 23:base();box(0,.5,0,.95,.5,.5);for(const z of [-.2,.2])rod([-.4,.74,z],[.4,.74,z],.025);box(.28,.72,0,.08,.4,.45,'silver');cyl(-.30,.73,0,.10,.35,'steel','x');if(n===15)cone(-.33,1,0,.16,.25);else{cyl(-.43,1,0,.09,.14);box(.3,.96,0,.32,.25,.5,'glass');}console();break;
        case 16:base();cyl(0,.48,0,.08,.9,'silver','x');motor(-.4,.48,0);cone(-.18,.77,0,.18,.4);cyl(.47,.48,0,.15,.04,'steel','x');break;
        case 17:case 18:enclosure();if(n===17){cyl(0,.65,0,.14,.45);cone(0,1.15,0,.2,.25);}else{table(.45);box(0,.66,0,.65,.2,.6,'orange');}break;
        case 19:case 20:base();for(const x of [-.42,.42])box(x,.65,0,.10,.9,.5);for(let i=0;i<(n===19?3:2);i++)cyl(0,.45+i*.2,0,.12,.78,'silver','x');if(n===20){box(0,.4,.4,.85,.05,.35,'steel');motor(.35,.28,-.34);}break;
        case 21:case 22:base();for(const x of [-.35,.35])box(x,.6,0,.13,.85,.4);box(0,.95,0,.85,.20,.4);cyl(0,.97,-.3,.18,.1,'dark','z');cyl(0,.72,0,.06,.30);box(0,.45,0,.65,.08,.45,'silver');if(n===22){fence();conveyor('belt');}break;
        case 24:enclosure();cyl(0,1.15,-.2,.06,.35);box(-.45,.6,0,.16,.5,.3,'steel');break;
        case 25:enclosure();box(0,.55,.37,.65,.5,.025,'orange');box(0,.55,.40,.53,.4,.02,'dark');cyl(-.3,1.2,-.2,.07,.4,'steel');break;
        case 26:table(.25);for(const x of [-.45,.45])box(x,.6,0,.06,.65,.7,'silver');for(const z of [-.35,.35])box(0,.6,z,.90,.65,.06,'silver');box(0,.78,0,.80,.015,.55,'glass');break;
      }
    }else if(n<=40){
      switch(n){
        case 27:vessel(true);break;case 28:vessel(true);for(const y of [.5,.8])cyl(0,y,0,.40,.03,'body');cyl(.26,.94,0,.05,.25);break;
        case 29:drum(true);motor(-.48,.55,0);cone(0,.93,0,.20,.25);break;
        case 30:vessel(true);cone(0,.3,0,.36,.35);break;
        case 31:base();motor(-.2,.45,0);for(const x of [.10,.30])cyl(x,.60,0,.065,.4);pipe();console();break;
        case 32:hopper();box(0,.28,0,.30,.15,.35,'body');console(.4,.6,.35);break;
        case 33:case 34:hopper();if(n===33){cyl(0,1.2,0,.4,.75);for(let i=0;i<16;i++)box(.44,.15+i*.1,0,.035,.02,.32,'orange');}break;
        case 35:drum(true);for(const x of [-.3,.3])cyl(x,.84,0,.055,.25);break;
        case 36:table(.35);for(let i=0;i<5;i++){cyl(-.35+i*.175,.6,0,.05,.5,'silver','z');rod([-.35+i*.175,.6,-.25],[-.35+i*.175,.9,-.25],.04);}console();break;
        case 37:vessel();cyl(-.5,.8,0,.12,1.3);rod([-.5,1.4,0],[0,1.05,0],.045);break;
        case 38:base();cyl(0,.6,0,.40,.5);cyl(0,.86,0,.41,.04,'steel');motor(.45,.50,0,'y');break;
        case 39:table(.35);for(let i=0;i<12;i++)box(-.43+i*.078,.6,0,.04,.52,.60,i%2?'steel':'silver');cyl(.46,.6,0,.075,.3,'body','x');break;
        case 40:drum(true);for(const x of [-.3,.3])cyl(x,.55,0,.32,.05,'dark','x');motor(.25,.2,.30);break;
      }
    }else if(n<=52){
      conveyor('belt');
      switch(n){
        case 41:gantry();for(let i=0;i<4;i++)cyl(-.25+i*.17,.75,0,.015,.3);vessel();break;
        case 42:box(0,.85,0,.08,.5,.08);cyl(0,.62,0,.08,.12,'dark');break;
        case 43:for(const x of [-.25,.25])cyl(x,.84,-.25,.13,.1,'white','z');box(0,.75,-.25,.4,.03,.03,'dark');break;
        case 44:for(const z of [-.3,.3])box(0,.85,z,.06,.6,.06);box(0,.92,0,.1,.06,.7,'orange');break;
        case 45:case 46:gantry();box(0,.75,0,n===45?.60:.45,.20,.45,'white');if(n===46){box(.30,.8,0,.1,.4,.08,'orange');box(-.30,.8,0,.1,.4,.08,'orange');}break;
        case 47:cyl(-.25,.91,0,.15,.60,'white','z');box(.3,.78,0,.25,.22,.65,'silver');break;
        case 48:for(const z of [-.34,.34])box(0,.83,z,.7,.5,.05);box(0,1.08,0,.7,.05,.72);break;
        case 49:robot();box(.2,.3,.65,.5,.5,.5,'wood');break;
        case 50:gantry();for(let i=0;i<5;i++)box(.2,.23+i*.12,0,.6,.09,.6,'wood');break;
        case 51:cyl(0,.20,0,.40,.05,'steel');box(-.46,.62,0,.05,1,.1);cyl(-.35,.6,0,.12,.48,'white');box(0,.55,0,.35,.65,.4,'wood');break;
        case 52:box(0,.66,0,.40,.05,.65,'silver');screen(.35,.85,-.3);break;
      }
    }else if(n<=64){
      switch(n){
        case 53:robot();break;case 54:robot('scara');break;case 55:gantry();cyl(0,1.10,0,.36,.07,'steel');for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod([Math.cos(a)*.30,1.05,Math.sin(a)*.30],[0,.58,0],.025,'orange');}cyl(0,.58,0,.1,.04);break;
        case 56:gantry();box(.20,1.13,0,.25,.1,.20,'orange');break;case 57:robot('six',true);break;case 58:robot();fence();table(.35);break;case 59:gantry();conveyor();break;
        case 60:base();cyl(0,.55,0,.4,.25);for(let i=0;i<3;i++)cyl(0,.6+i*.05,0,.41,.015,'dark');box(.50,.6,0,.4,.06,.12,'silver');break;
        case 61:table(.45);cyl(0,.55,0,.4,.07,'silver');for(let i=0;i<6;i++){const a=i*Math.PI/3;box(Math.cos(a)*.30,.62,Math.sin(a)*.30,.08,.09,.1,'dark');}break;
        case 62:cabinet();for(let i=0;i<6;i++)box(0,.23+i*.12,.34,.60,.03,.22,'orange');break;
        case 63:base();for(const x of [-.35,.35])box(x,.45,0,.10,.55,.3);cyl(0,.75,0,.30,.08,'silver','x');motor(-.35,.65,0);break;
        case 64:box(-.35,.6,0,.07,1.2,.07);rod([-.35,1.2,0],[.4,1.2,0],.035);rod([.4,1.2,0],[.4,.7,0],.02);for(const z of [-.18,.18])cyl(.4,.68,z,.07,.04,'dark');break;
      }
    }else if(n<=78){
      switch(n){case 65:conveyor();break;case 66:conveyor('motor');break;case 67:curve();break;case 68:conveyor('incline');break;case 69:curve(true);break;case 70:conveyor('modular');break;case 71:conveyor('chain');break;case 72:gantry();for(let i=0;i<8;i++){const x=-.45+i*.13;rod([x,1,0],[x,.75,0],.01);box(x,.73,0,.10,.04,.13,'orange');}break;case 73:table(.3);pipe('x',.1);for(let i=0;i<15;i++)cyl(-.45+i*.065,.55,0,.09,.015,'orange','x');motor(-.45,.55,0);break;case 74:box(0,.65,0,.24,1.3,.20);for(let i=0;i<10;i++)box(0,.10+i*.12,.14,.18,.05,.08,'orange');box(.2,1.15,0,.35,.1,.2,'silver');break;case 75:gantry();box(0,.3,0,.85,.05,.65,'silver');for(const x of [-.4,.4])box(x,.7,0,.04,1.4,.04);break;case 76:conveyor();for(let i=0;i<4;i++)box(-.30+i*.2,.64,0,.04,.03,.7,'orange');break;case 77:table(.45);cyl(0,.55,0,.45,.06,'silver');break;case 78:conveyor('sorter');break;}
    }else if(n<=91){
      switch(n){case 79:case 80:for(const z of [-.22,.22]){box(.20,.09,z,.70,.07,.14,'orange');cyl(.48,.04,z,.035,.1,'dark','z');}box(-.25,.2,0,.3,.3,.65,'orange');rod([-.3,.2,0],[-.4,.9,0],.025,'dark');box(-.4,.9,0,.03,.05,.4,'dark');if(n===80)box(-.25,.5,0,.3,.4,.45,'body');break;case 81:vehicle('reach');break;case 82:vehicle('stacker');break;case 83:vehicle('tug');break;case 84:vehicle('tug');for(let i=0;i<3;i++){const x=1+i*.9;box(x,.3,0,.7,.08,.55,'silver');for(const z of [-.3,.3])cyl(x,.15,z,.1,.06,'dark','z');rod([x-.5,.25,0],[x-.35,.25,0],.02);}break;case 85:vehicle();break;case 86:vehicle('amr');break;case 87:case 88:gantry();box(0,1.16,0,.8,.05,.20,'orange');box(.12,1.07,0,.16,.14,.20,'steel');rod([.12,1,0],[.12,.55,0],.01);cyl(.12,.53,0,.06,.06,'dark','z');if(n===88)for(const x of [-.45,.45])for(const z of [-.35,.35])cyl(x,.04,z,.05,.04,'dark','z');break;case 89:box(0,.85,0,.6,.3,.4,'orange');motor(0,.85,.15);rod([0,.70,0],[0,.10,0],.01,'dark');cyl(0,.10,0,.08,.05,'dark','z');break;case 90:box(-.4,.5,0,.06,1,.06);rod([-.4,1,0],[.5,1,0],.03,'orange');rod([-.4,.60,0],[.45,1,0],.025,'steel');rod([.45,1,0],[.45,.45,0],.01);break;case 91:base();table(.85);for(const z of [-.25,.25]){rod([-.4,.2,z],[.4,.8,z],.03,'orange');rod([.4,.2,z],[-.4,.8,z],.03,'orange');}break;}
    }else if(n<=106){
      switch(n){case 92:rack();break;case 93:rack('drivein');break;case 94:rack('pushback');break;case 95:for(let i=0;i<(params.modules||3);i++){const x=-.4+i*.8/Math.max(1,(params.modules||3)-1);box(x,.5,0,.035,1,.05);for(let j=0;j<(params.levels||4);j++){box(x,.15+j*.75/Math.max(1,(params.levels||4)-1),.22,.04,.035,.45,'orange');box(x,.15+j*.75/Math.max(1,(params.levels||4)-1),-.22,.04,.035,.45,'orange');}}break;case 96:rack('flow');break;case 97:rack('picking');break;case 98:rack('light');break;case 99:rack('parts');break;case 100:gantry();box(0,.8,0,1,.05,.8,'silver');fence(false,false);break;case 101:rack('miniload');break;case 102:rack('shuttle');break;case 103:case 104:cabinet();box(0,.45,.32,.65,.2,.02,'dark');if(n===103)for(let i=0;i<(params.levels||7);i++)for(let j=0;j<(params.modules||1);j++)box(-.25+j*.5/Math.max(1,(params.modules||1)-1),.2+i*.65/Math.max(1,(params.levels||7)-1),.34,.50/(params.modules||1),.025,.1,'silver');else box(0,.45,.45,.6,.025,.25,'silver');break;case 105:for(const z of [-.35,.35]){for(let i=0;i<12;i++)box(-.44+i*.08,.5,z,.01,1,.01,'steel');for(let i=0;i<10;i++)box(0,.05+i*.1,z,.9,.01,.01,'steel');}for(const x of [-.45,.45])box(x,.5,0,.02,1,.7,'silver');box(0,.02,0,.9,.04,.7,'steel');break;case 106:box(0,.025,0,.9,.05,.7);for(const x of [-.44,.44])box(x,.3,0,.025,.55,.7);for(const z of [-.35,.35])box(0,.3,z,.9,.55,.025);for(let i=0;i<5;i++)box(-.4+i*.2,.3,.38,.025,.5,.025,'steel');break;}
    }else if(n<=118){
      switch(n){case 107:box(0,.35,0,1,.7,.8,'steel');box(0,.72,0,1,.05,.8,'silver');break;case 108:box(0,.38,0,.95,.75,.8,'steel');box(0,.77,0,1,.06,.85,'silver',.05);box(.4,.74,0,.25,.035,.8,'orange',-.15);break;case 109:case 110:for(const x of [-.45,.45])box(x,.5,0,.1,1,.1,'dark');box(0,1,0,1,.1,.15,'dark');if(n===110)for(let i=0;i<10;i++)box(0,.05+i*.10,0,.8,.085,.035,'silver');else{for(const x of [-.34,.34])box(x,.55,0,.10,.85,.04,'dark');}break;case 111:table(.25);box(0,.65,0,1,.04,.7,'silver',.17);for(const z of [-.35,.35])rod([-.5,.35,z],[.5,.95,z],.02,'orange');break;case 112:case 113:box(0,.05,0,1,.1,.85,'steel');for(let i=0;i<(n===113?6:2);i++)box(-.45+i*.9/(n===113?5:1),.11,0,.015,.015,.8,'dark');screen(.50,.45,-.4);break;case 114:bench('operator');break;case 115:bench('packing');break;case 116:box(0,.20,0,.6,.4,.5,'white');cyl(0,.47,-.1,.14,.48,'dark','x');box(0,.08,.4,.30,.02,.4,'white');break;case 117:table(.3);sensor('barcode');break;case 118:conveyor('sorter');for(const z of [-.5,.5])box(.40,.40,z,.25,.5,.24,'body');break;}
    }else if(n<=134){
      switch(n){case 119:enclosure();for(let i=0;i<7;i++)box(-.25,.35+i*.075,.38,.30,.022,.02,'dark');cyl(.25,1.12,-.15,.045,.25);break;case 120:vessel();cyl(0,.60,.4,.08,.04,'white','z');break;case 121:cabinet();pipe('x',.035);console(.1,.75,.34);break;case 122:base();box(0,.5,0,1,.7,.65,'silver');for(const x of [-.25,.25])cyl(x,.87,0,.18,.04,'dark');console(.3,.5,.34);break;case 123:box(0,.5,0,.85,1,.7,'silver');cyl(0,1.06,0,.30,.08,'dark');for(let i=0;i<8;i++)box(0,.12+i*.09,.36,.78,.025,.025,'body');break;case 124:pump();break;case 125:pump();box(0,.08,0,1.4,.08,.8,'steel');cyl(-.35,.35,.18,.18,.45,'body','x');break;case 126:table(.2);for(const z of [-.25,.25]){motor(-.2,.45,z);cyl(.2,.4,z,.14,.2,'body','x');}rod([.35,.45,-.3],[.35,.45,.3],.04);vessel();break;case 127:drum(true);cyl(.35,.98,0,.08,.5,'steel');cyl(-.5,.56,0,.18,.3,'body','x');break;case 128:vessel();cyl(.25,1.2,0,.045,.5);console();break;case 129:table(.2);for(let i=0;i<14;i++)box(-.35+i*.05,.62,0,.025,.7,.5,'silver');for(const y of [.35,.85])for(const z of [-.18,.18])cyl(.4,y,z,.055,.16,'steel','x');break;case 130:base();box(0,.3,0,.9,.4,.6,'steel');motor(.25,.65,0,'y');cyl(-.22,.65,0,.06,.5);console();break;case 131:pump();box(.28,.55,0,.3,.20,.3,'steel');break;case 132:cyl(0,.45,0,.38,.35,'body','z');for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod([0,.45,.20],[Math.cos(a)*.3,.45+Math.sin(a)*.3,.20],.035,'dark');}box(0,.09,0,.65,.1,.45,'steel');break;case 133:table(.15);for(const x of [-.3,0,.3])cyl(x,.65,0,.13,.85,'silver');rod([-.35,.3,0],[.35,.3,0],.035,'body');console();break;case 134:vessel();cyl(0,1.08,0,.035,.15);break;}
    }else if(n<=146){
      switch(n){case 135:case 136:hopper();box(0,1.15,0,.8,.6,.65,'silver');if(n===136)for(let i=0;i<5;i++)cyl(-.28+i*.14,1.15,.36,.045,.45,'white');else motor(.45,1.20,0,'y');break;case 137:hopper();cyl(0,1.15,0,.4,.6);pipe('x',.08,.6);break;case 138:vessel();cyl(.45,.65,0,.12,.85);rod([0,1,0],[.45,1,0],.07);break;case 139:case 140:case 141:box(0,.2,0,1,.4,.8,'silver');box(0,.4,0,.86,.02,.68,'glass');for(const x of [-.2,.2])box(x,.3,0,.02,.6,.78,'steel');if(n===140){vessel();cyl(.6,.5,0,.15,.7);}if(n===141)pipe('x',.05);break;case 142:base();box(0,.45,0,1,.7,.6);box(.4,.8,0,.20,.7,.6,'steel');box(.5,.65,.31,.08,.3,.025,'orange');break;case 143:box(0,.03,0,1,.06,.75,'steel');for(const z of [-.38,.38])box(0,.4,z,1,.8,.04,'body');for(const x of [-.5,.5])box(x,.4,0,.04,.8,.75,'body');break;case 144:for(let i=0;i<4;i++){const x=-.45+i*.3;box(x,.4,0,.23,.75,.55,['body','red','green','orange'][i]);box(x,.80,0,.25,.04,.57,'dark');}break;case 145:case 146:room();for(let i=0;i<6;i++)box(0,.2+i*.12,-.37,.85,.02,.015,'silver');if(n===145)rod([-.4,.5,0],[0,.3,0],.01,'dark');else cyl(0,.75,-.42,.17,.08,'dark','z');break;}
    }else if(n<=170){
      switch(n){case 147:table(.35);gantry();box(0,.48,0,.8,.15,.65,'dark');cyl(0,.72,0,.012,.3);break;case 148:table(.2);robot('six',true);break;case 149:base();box(0,.52,0,.25,.8,.25);cyl(0,.83,.18,.25,.08,'dark','z');cyl(0,.83,.23,.22,.02,'glass','z');box(0,.42,.25,.5,.04,.35,'silver');break;case 150:box(0,.06,0,.8,.12,.6,'silver');box(-.3,.35,0,.12,.6,.12);rod([-.3,.58,0],[.20,.58,0],.015);box(.2,.51,0,.015,.14,.015,'dark');break;case 151:base();box(-.3,.55,0,.15,.9,.3);box(-.05,1,0,.60,.12,.3);cyl(.20,.84,0,.035,.22);cyl(.2,.37,0,.12,.15,'silver');break;case 152:bench('calibration');break;case 153:bench('testing');cyl(-.22,.75,0,.12,.30);break;case 154:for(const z of [-.2,.2])rod([0,.75,0],[0,0,z],.025);rod([0,.75,0],[.3,0,0],.025);sensor('camera');box(0,.9,0,.15,.3,.15,'body');break;case 155:conveyor();gantry();sensor('camera');break;case 156:conveyor('belt');for(const z of [-.3,.3])box(0,.87,z,.18,.65,.05,'silver');box(0,1.18,0,.18,.07,.65,'silver');break;case 157:box(0,.10,0,.6,.2,.5,'white');cyl(0,.25,0,.24,.05);for(const x of [-.27,.27])box(x,.48,0,.02,.5,.5,'glass');box(0,.72,0,.55,.02,.5,'glass');break;case 158:table(.3);for(const x of [-.28,.28])cyl(x,.5,0,.07,.25,'dark');box(0,.55,0,.5,.06,.3,'silver');break;case 159:bench('maintenance');break;case 160:cart();cabinet(5);break;case 161:cabinet(7);break;case 162:table(.30);box(0,.52,0,.8,.35,.6,'silver');box(0,.84,-.27,.8,.4,.03,'silver');cyl(.3,.5,0,.04,.3);break;case 163:box(0,.35,0,.8,.7,.6,'silver');box(0,.72,0,.82,.025,.62,'steel');console(.25,.5,.31);break;case 164:table(.3);for(const x of [-.3,.3])box(x,.55,0,.1,.4,.3,'body');cyl(0,.75,0,.06,.8,'silver','x');screen(-.4,.9,-.3);break;case 165:bench('electric');break;case 166:for(const x of [-.35,.35]){rod([x,.8,0],[x,0,-.3],.04);rod([x,.8,0],[x,0,.3],.04);}box(0,.8,0,1,.05,.10,'silver');break;case 167:base();table(.85);for(const z of [-.25,.25]){rod([-.4,.2,z],[.4,.8,z],.03,'orange');rod([.4,.2,z],[-.4,.8,z],.03,'orange');}break;case 168:cart();for(const x of [-.25,.25])cyl(x,.50,0,.15,.60,'body');rod([-.25,.8,0],[.30,.80,.2],.02,'dark');break;case 169:cart(3);screen(0,.88,-.3);break;case 170:bench();break;}
    }else if(n<=182){sensor(['photo','inductive','capacitive','rfid','barcode','camera','lidar','encoder','loadcell','pressure','thermocouple','vibration'][n-171]);
    }else if(n<=196){
      switch(n){case 183:cyl(0,.40,0,.18,.65,'red');cyl(0,.76,0,.06,.10,'dark');box(.04,.84,0,.25,.025,.04,'dark');box(-.17,.45,0,.025,.5,.025,'dark');box(0,.40,.18,.18,.18,.015,'white');break;case 184:box(0,.5,0,.65,1,.3,'red');cyl(0,.6,.16,.24,.025,'white','z');cyl(0,.6,.18,.18,.025,'red','z');box(.22,.5,.2,.02,.15,.02,'dark');break;case 185:rod([-.3,0,0],[-.3,1.2,0],.035,'green');rod([-.3,1.2,0],[.3,1.2,0],.035,'green');cone(.3,1.13,0,.14,.10,'silver');rod([-.3,.95,.03],[-.3,.60,.03],.007);break;case 186:cyl(0,.4,0,.03,.8,'green');cyl(0,.82,0,.23,.08,'silver');for(const x of [-.10,.10])cyl(x,.93,0,.025,.12);break;case 187:cyl(0,.45,0,.32,.85,'orange');cyl(0,.90,0,.33,.06,'dark');box(0,.5,.32,.25,.25,.015,'white');break;case 188:box(0,.4,0,.9,.5,.08,'green');box(-.15,.4,.05,.25,.025,.015,'white');rod([-.25,.4,.05],[-.1,.55,.05],.013,'white');rod([-.25,.4,.05],[-.1,.25,.05],.013,'white');break;case 189:fence(false,false);box(0,.53,0,.9,.025,.025,'orange');break;case 190:fence();break;case 191:fence(true);break;case 192:for(const x of [-.4,.4]){box(x,.5,0,.05,1,.05,'orange');for(let i=0;i<10;i++)cyl(x,.07+i*.09,.035,.008,.01,'red','z');}break;case 193:for(const x of [-.4,.4])box(x,.45,0,.07,.9,.07,'orange');box(0,.85,0,.85,.09,.08,'orange');for(let i=0;i<6;i++)box(-.35+i*.14,.85,.045,.06,.08,.01,'dark',.5);break;case 194:cyl(0,.5,0,.12,1,'orange');cyl(0,.75,0,.125,.1,'dark');cyl(0,.2,0,.125,.1,'dark');break;case 195:cyl(0,.5,0,.025,1,'steel');cyl(0,1,0,.4,.06,'orange','z');primitive('sphere',0,1,.07,.75,.75,.08,'silver');break;case 196:cyl(0,.50,0,.025,1,'steel');box(0,1,0,.25,.65,.12,'dark');for(let i=0;i<3;i++)cyl(0,1.22-i*.22,.075,.075,.025,['red','orange','green'][i],'z');break;}
    }else if(n<=208){
      switch(n){case 197:bench('ergonomic');break;case 198:bench('adjustable');break;case 199:cyl(0,.30,0,.035,.60);box(0,.6,0,.60,.06,.5,'dark');box(0,.88,-.23,.55,.5,.07,'dark');for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod([0,.09,0],[Math.cos(a)*.3,.09,Math.sin(a)*.3],.025);cyl(Math.cos(a)*.3,.05,Math.sin(a)*.3,.04,.04,'dark','z');}break;case 200:cart(4);for(let i=0;i<3;i++)box(-.28+i*.28,.75,0,.22,.18,.35,'orange');break;case 201:bench('operator');break;case 202:cyl(0,.5,0,.025,1);for(let i=0;i<3;i++)cyl(0,1.03+i*.12,0,.08,.10,['green','orange','red'][i]);break;case 203:screen();box(0,.2,0,.40,.05,.35,'steel');break;case 204:screen();table(.45);box(.25,.62,0,.18,.40,.25,'dark');box(0,.5,.3,.45,.025,.20,'dark');break;case 205:for(const x of [-.4,.4])box(x,.5,0,.04,1,.04,'steel');box(0,.75,0,.9,.6,.035,'white');for(let i=0;i<5;i++)box(-.30+i*.15,.75,.025,.10,.40,.012,['body','green','orange','white','dark'][i]);break;case 206:cabinet();box(0,.85,.33,.55,.10,.012,'green');break;case 207:room();for(let i=0;i<4;i++)box(-.33+i*.22,.60,-.37,.18,.7,.03,'silver');break;case 208:room(true);break;}
    }else if(n<=224){
      switch(n){case 209:box(0,.5,0,.22,1,.22,'steel');box(0,.025,0,.35,.05,.35,'silver');break;case 210:box(0,.4,0,1,.3,.025,'steel');for(const y of [.24,.56])box(0,y,0,1,.035,.30,'silver');break;case 211:box(0,.5,0,1,1,.08,'white');break;case 212:box(0,.5,0,1,1,.035,'silver');for(const x of [-.45,0,.45])box(x,.5,.02,.01,1,.01,'steel');break;case 213:case 214:case 215:fence(true,n===215);if(n!==215)box(0,.53,0,.85,.90,.03,n===214?'red':'silver');break;case 216:for(const x of [-.45,0,.45])box(x,.5,0,.025,1,.05,'steel');for(const y of [.025,.5,.975])box(0,y,0,.9,.025,.05,'steel');box(0,.5,0,.85,.94,.01,'glass');break;case 217:box(-.25,.1,0,.55,.035,.8,'silver',.20);box(.25,.1,0,.55,.035,.8,'silver',-.20);break;case 218:box(0,.08,0,1,.15,.8,'steel');box(0,.17,0,.90,.035,.70,'glass');break;case 219:for(let i=0;i<(params.steps||12);i++){const count=params.steps||12;box(-.5+(i+.5)/count,(i+.5)/count,0,1/count,.025,.65,'silver');}for(const z of [-.35,.35]){rod([-.5,.3,z],[.5,1.3,z],.018,'orange');rod([-.5,0,z],[.5,1,z],.025,'steel');}break;case 220:box(0,.5,0,1,.04,.7,'silver',Math.PI/8);break;case 221:box(0,.08,0,1,.04,.7,'silver');for(const z of [-.36,.36]){rod([-.5,.9,z],[.5,.9,z],.015,'orange');for(const x of [-.45,0,.45])box(x,.49,z,.02,.80,.02,'orange');}break;case 222:table(.8);fence(false,false);break;case 223:for(let i=0;i<4;i++)for(let j=0;j<3;j++)box(-.375+i*.25,.10,-.25+j*.25,.245,.04,.245,'silver');for(const x of [-.45,.45])for(const z of [-.30,.30])box(x,.04,z,.03,.08,.03,'steel');break;case 224:box(0,.05,0,1,.1,.8,'silver');break;}
    }else if(n<=236){
      switch(n){case 225:switchboard();break;case 226:switchboard('mcc');break;case 227:switchboard('plc');break;case 228:switchboard('control');console(0,.8,.30);break;case 229:box(0,.5,0,.7,1,.4,'silver');for(let i=0;i<8;i++)box(-.30+i*.085,.5,-.22,.025,.8,.06,'dark');screen(0,.65,.24);break;case 230:box(0,.4,0,.75,.7,.55,'steel');for(const x of [-.45,.45])for(let i=0;i<7;i++)box(x,.4,-.3+i*.1,.10,.6,.02,'silver');for(const x of [-.25,0,.25])cyl(x,.9,0,.045,.3,'dark');break;case 231:cabinet();for(let i=0;i<5;i++)box(0,.22+i*.12,.34,.5,.02,.02,'dark');console(0,.82,.35);break;case 232:base();box(0,.5,0,1,.65,.6,'body');for(let i=0;i<8;i++)box(-.3,.30+i*.06,.32,.25,.022,.02,'dark');cyl(.2,.92,-.1,.045,.3,'steel');console();break;case 233:case 234:for(const z of [-.3,.3])box(0,.2,z,1,.18,.025,'silver');if(n===233)box(0,.12,0,1,.025,.60,'silver');else for(let i=0;i<10;i++)box(-.45+i*.1,.12,0,.03,.025,.6,'steel');break;case 235:box(0,.2,0,1,.12,.18,'silver');for(let i=0;i<5;i++)box(-.4+i*.2,.2,0,.015,.16,.22,'orange');break;case 236:box(0,.15,0,1,.1,.4,'silver');for(const z of [-.12,.12])cyl(0,.075,z,.035,.90,'white','x');break;}
    }else {
      switch(n){case 237:case 238:case 239:case 240:pipe('x',n===239?.13:n===238?.07:.10);if(n===239)cyl(0,.20,0,.145,.86,'white','x');if(n===240)box(.2,.20,0,.10,.3,.25,'steel');break;case 241:duct();break;case 242:pipe('x',.055);for(const x of [-.2,.2])cyl(x,.2,0,.075,.035,'steel','x');break;case 243:box(0,.12,0,1,.18,.3,'steel');for(let i=0;i<15;i++)box(-.47+i*.067,.22,0,.025,.025,.28,'silver');break;case 244:pipe('x',.09,.7);cyl(0,.45,0,.055,.5);cyl(0,.72,0,.22,.025,'red');for(const x of [-.18,.18])rod([x,.72,0],[0,.72,0],.01,'red');break;case 245:cyl(0,.4,0,.32,.07,'silver','x');cyl(0,.4,0,.10,.10,'dark','x');for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(.05,.4+Math.cos(a)*.24,Math.sin(a)*.24,.018,.10,'dark','x');}break;case 246:for(let i=0;i<12;i++){const a=i*Math.PI/22,b=(i+1)*Math.PI/22;rod([Math.cos(a)*.6,.20,Math.sin(a)*.6],[Math.cos(b)*.6,.20,Math.sin(b)*.6],.09);}break;case 247:pipe('x',.1);cyl(0,.20,.25,.1,.5,'silver','z');cyl(0,.20,.50,.14,.035,'steel','z');break;case 248:box(0,.5,0,.08,1,.08,'steel');box(0,.025,0,.35,.05,.35,'silver');box(0,.95,0,.65,.04,.1,'steel');for(const x of [-.25,.25])cyl(x,1,0,.06,.10,'dark');break;}
    }
    if(bounds.isEmpty())throw Error('Receita não implementada: '+def.geometry.generator);
    const root=new T.Group();let triangles=0;
    if(source.detail==='low'){
      // Distant LOD keeps every part but uses one colored mesh rather than one draw per material.
      let vertices=0,indexCount=0;
      for(const batch of batches.values()){vertices+=shapes[batch.kind].attributes.position.count*batch.matrices.length;indexCount+=shapes[batch.kind].index.count*batch.matrices.length;}
      const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),colorsArray=new Float32Array(vertices*3),indices=new Uint32Array(indexCount);
      const point=new T.Vector3(),normal=new T.Vector3(),normalMatrix=new T.Matrix3();let vertexOffset=0,indexOffset=0;
      for(const batch of batches.values()){
        const shape=shapes[batch.kind],color=material[batch.color].color;
        for(const matrix of batch.matrices){
          normalMatrix.getNormalMatrix(matrix);
          for(let i=0;i<shape.attributes.position.count;i++){
            point.fromBufferAttribute(shape.attributes.position,i).applyMatrix4(matrix);normal.fromBufferAttribute(shape.attributes.normal,i).applyMatrix3(normalMatrix).normalize();
            const offset=(vertexOffset+i)*3;positions.set([point.x,point.y,point.z],offset);normals.set([normal.x,normal.y,normal.z],offset);colorsArray.set([color.r,color.g,color.b],offset);
          }
          for(let i=0;i<shape.index.count;i++)indices[indexOffset++]=vertexOffset+shape.index.getX(i);
          vertexOffset+=shape.attributes.position.count;
        }
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.setAttribute('color',new T.BufferAttribute(colorsArray,3));geometry.setIndex(new T.BufferAttribute(indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.2}));mesh.castShadow=true;root.add(mesh);triangles=indexCount/3;
      for(const mat of Object.values(material))mat.dispose();
    }else for(const batch of batches.values()){
      const geometry=shapes[batch.kind].clone();geometry.boundingBox=batch.bounds.clone();geometry.boundingSphere=batch.bounds.getBoundingSphere(new T.Sphere());
      const mesh=new T.InstancedMesh(geometry,material[batch.color],batch.matrices.length);batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;root.add(mesh);triangles+=geometry.index.count/3*batch.matrices.length;
    }
    if(source.detail!=='low'){const used=new Set([...batches.values()].map(batch=>batch.color));for(const [key,mat] of Object.entries(material))if(!used.has(key))mat.dispose();}
    for(const shape of Object.values(shapes))shape.dispose();
    const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());root.position.set(-center.x,-bounds.min.y,-center.z);
    const wrapper=new T.Group();wrapper.add(root);wrapper.scale.set(width/size.x,height/size.y,depth/size.z);wrapper.userData={modelId:def.id,version:def.version,recipe:def.geometry.generator,triangles,parts:Array.from(batches.values()).reduce((sum,b)=>sum+b.matrices.length,0)};
    if(source.animation&&def.animation){const parcel=new T.Mesh(new T.BoxGeometry(width*.075,height*.08,depth*.35),new T.MeshStandardMaterial({color:'#b58d56',roughness:.8}));const animated=new T.Group();animated.add(wrapper,parcel);parcel.position.y=height*.82;parcel.userData.industrialTick=time=>{const progress=(time*.00016)%1;parcel.position.x=(progress-.5)*width*.8;if(n===68)parcel.position.y=height*(.18+progress*.65);};return animated;}
    return wrapper;
  }
  function animate(scene,time){let active=false;scene.traverse(object=>{if(object.visible&&object.userData.industrialTick){object.userData.industrialTick(time);active=true;}});return active;}
  return {create,animate};
})();
