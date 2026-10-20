(function(){
 'use strict';
 function model(id,color){
  const kind=window.PersonalCatalog?.byId[id]?.geometry||id;
  const g=new THREE.Group(),body=new THREE.MeshStandardMaterial({color,roughness:.8}),wood=new THREE.MeshStandardMaterial({color:'#c4ae91',roughness:.85}),light=new THREE.MeshStandardMaterial({color:'#efede6',roughness:.85}),dark=new THREE.MeshStandardMaterial({color:'#43504f',roughness:.7}),green=new THREE.MeshStandardMaterial({color:'#5f8968',roughness:.9});
  const box=(w,h,d,x=0,y=h/2,z=0,mat=body)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
  const cylinder=(r,h,x,y,z,mat=body)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const legs=(top=.8)=>{for(const x of [-.42,.42])for(const z of [-.4,.4])box(.06,top,.06,x,top/2,z,wood);};
  const sphere=(r,x,y,z,mat=body,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;};
  const ring=(r,t,x,y,z,mat=body)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,24),mat);m.position.set(x,y,z);g.add(m);return m;};
  switch(kind){
   case 'desk':case 'table':legs(.88);box(1,.12,1,0,.94,0);if(kind==='desk'){box(.3,.32,.82,.29,.63,0);box(.22,.02,.02,.29,.67,.43,dark);}break;
   case 'chair':legs(.46);box(.95,.1,.95,0,.51,0);box(.95,.44,.09,0,.78,-.43);break;
   case 'sofa':box(.9,.35,.8,0,.3,0);box(.9,.23,.78,0,.54,.06,light);box(1,.45,.16,0,.77,-.4);box(.12,.65,.95,-.44,.4,0);box(.12,.65,.95,.44,.4,0);for(const x of [-.35,.35])box(.05,.12,.65,x,.06,0,wood);break;
   case 'bed':box(1,.32,1,0,.24,0,wood);box(.98,.26,.98,0,.53,0,light);box(1,.7,.06,0,.64,-.47,wood);box(.4,.13,.24,-.25,.73,-.29);box(.4,.13,.24,.25,.73,-.29);box(.98,.06,.52,0,.68,.22);break;
   case 'wardrobe':case 'drawer':case 'cabinet':box(1,.95,1,0,.5,0);if(kind==='drawer'){for(const y of [.23,.52,.81]){box(.93,.015,.02,0,y,.51,dark);box(.18,.02,.025,0,y+.09,.53,dark);}}else{box(.015,.8,.02,0,.5,.51,dark);for(const x of [-.1,.1])box(.025,.12,.025,x,.55,.53,dark);}if(kind==='cabinet')box(1.05,.05,1.05,0,1,0,light);break;
   case 'bookcase':case 'shelf':for(const x of [-.46,.46])box(.08,1,1,x,.5,0,wood);box(.92,1,.05,0,.5,-.47,light);for(const y of [.04,.3,.57,.84,.97])box(.92,.035,1,0,y,0,wood);if(id==='bookcase')for(let i=0;i<6;i++)box(.09,.17,.7,-.3+i*.12,.4,0,i%2?body:dark);break;
   case 'box':box(1,.9,1,0,.45,0);box(1.06,.1,1.06,0,.95,0,light);box(.26,.1,.04,0,.65,.51,dark);break;
   case 'books':for(let i=0;i<4;i++){box(.93,.12,.9,0,.14+i*.22,0,light);box(1,.025,1,0,.06+i*.22,0,i%2?wood:body);box(1,.025,1,0,.22+i*.22,0,i%2?wood:body);}break;
   case 'computer':case 'tv':box(.36,.04,.6,0,.02,0,dark);box(.1,.3,.1,0,.18,0,dark);box(1,.65,.08,0,.67,0);box(.9,.52,.02,0,.67,.052,dark);if(id==='computer')box(.8,.04,.25,0,.04,.32,light);break;
   case 'fridge':box(1,1,1);box(.94,.65,.04,0,.37,.52,light);box(.94,.26,.04,0,.85,.52,light);box(.035,.3,.04,-.35,.45,.56,dark);box(.035,.13,.04,-.35,.85,.56,dark);break;
   case 'stove':box(1,.94,1,0,.47,0,light);box(.84,.5,.04,0,.4,.52,dark);box(.6,.025,.04,0,.7,.55,body);box(1,.05,1,0,.97,0,dark);for(const x of [-.25,.25])for(const z of [-.25,.25])cylinder(.14,.02,x,1,z,body);break;
   case 'microwave':box(1,1,1);box(.75,.7,.025,-.07,.5,.51,dark);box(.07,.4,.05,.37,.5,.54,light);break;
   case 'washer':box(1,.98,1,0,.49,0,light);const drum=cylinder(.32,.04,0,.45,.52,dark);drum.rotation.x=Math.PI/2;const window=cylinder(.23,.05,0,.45,.55,body);window.rotation.x=Math.PI/2;box(.8,.03,.02,0,.84,.51,dark);break;
   case 'plant':cylinder(.25,.36,0,.18,0,wood);cylinder(.025,.45,0,.57,0,green);for(let i=0;i<5;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),green);leaf.scale.set(1,.55,.65);leaf.position.set(Math.sin(i*1.5)*.19,.72+i*.05,Math.cos(i*1.5)*.19);g.add(leaf);}break;
   case 'lamp':cylinder(.38,.04,0,.02,0,dark);cylinder(.035,.72,0,.4,0,dark);const shade=new THREE.Mesh(new THREE.ConeGeometry(.4,.27,20,1,true),body);shade.position.y=.86;g.add(shade);break;
   case 'rug':box(1,1,1,0,.5,0);break;
   case 'bike':for(const x of [-.31,.31]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.25,.025,8,24),dark);wheel.position.set(x,.27,0);g.add(wheel);}const rod=(a,b)=>{const delta=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,delta.length(),8),body);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(m);};const a=new THREE.Vector3(-.31,.27,0),b=new THREE.Vector3(.31,.27,0),c=new THREE.Vector3(-.12,.7,0),d=new THREE.Vector3(.24,.68,0);for(const [p,q] of [[a,c],[a,b],[c,b],[c,d],[d,b]])rod(p,q);box(.22,.05,.35,-.13,.76,0,dark);box(.04,.27,.04,.29,.84,0,dark);box(.04,.035,.8,.29,.97,0,dark);break;
   case 'suitcase':box(.92,.82,.92,0,.49,0);box(.5,.03,.04,0,.96,0,dark);for(const x of [-.3,.3])cylinder(.07,.12,x,.06,0,dark);break;
   case 'basket':cylinder(.45,.85,0,.43,0,wood);const rim=new THREE.Mesh(new THREE.TorusGeometry(.45,.025,8,24),body);rim.rotation.x=Math.PI/2;rim.position.y=.86;g.add(rim);break;
   case 'device':box(1,.96,1,0,.5,0,dark);box(.88,.78,.04,0,.55,.52,body);box(.17,.025,.025,0,.08,.53,light);sphere(.03,.32,.89,.53,light);break;
   case 'laptop':box(1,.05,1,0,.025,0,body);box(.92,.02,.42,0,.06,-.02,dark);box(.27,.012,.22,0,.06,.32,dark);box(1,.85,.045,0,.51,-.43,body);box(.9,.7,.02,0,.51,-.397,dark);break;
   case 'keyboard':box(1,.5,1,0,.25,0);for(let r=0;r<4;r++)for(let c=0;c<12;c++)box(.065,.2,.16,-.445+c*.08,.62,-.36+r*.22,light);break;
   case 'mouse':sphere(.5,0,.5,0,body,1,1,.95);box(.02,.3,.7,0,.8,-.15,dark);box(.1,.1,.18,0,.96,-.2,dark);break;
   case 'headphones':ring(.37,.08,0,.59,0,dark);for(const x of [-.4,.4])box(.2,.42,.8,x,.25,0);break;
   case 'printer':box(1,.8,1,0,.4,0);box(.8,.045,.6,0,.85,-.12,dark);box(.65,.055,.45,0,.35,.62,light);box(.8,.08,.02,0,.45,.51,dark);box(.15,.025,.13,.3,.86,.3,dark);break;
   case 'router':box(1,.22,1,0,.11,0);for(const x of [-.4,.4])cylinder(.03,.8,x,.6,-.35,dark);for(let i=0;i<4;i++)box(.03,.035,.02,-.25+i*.1,.13,.51,green);break;
   case 'charger':box(.75,.65,.8,0,.5,0,light);for(const x of [-.16,.16])box(.06,.3,.12,x,.15,0,dark);box(.25,.06,.025,0,.53,.41,dark);break;
   case 'usb':box(.85,.7,1,0,.35,-.15);box(.65,.45,.45,0,.32,.55,light);break;
   case 'console':box(1,.7,1,0,.35,0);box(.8,.06,.02,0,.48,.51,dark);for(const x of [-.3,-.15])box(.08,.1,.02,x,.25,.51,dark);break;
   case 'book':case 'spiral':box(.95,.9,.86,0,.5,0,light);box(1,1,.07,0,.5,-.47);box(1,1,.07,0,.5,.47);box(.055,1,1,-.47,.5,0);box(.45,.08,.02,.04,.76,.512,dark);box(.55,.025,.02,.04,.61,.512,dark);if(kind==='spiral')for(let i=0;i<8;i++)ring(.055,.014,-.5,.1+i*.11,.03,dark);break;
   case 'pen':cylinder(.28,.78,0,.48,0);const tip=new THREE.Mesh(new THREE.ConeGeometry(.28,.18,12),wood);tip.rotation.z=Math.PI;tip.position.y=.03;g.add(tip);box(.1,.36,.08,.3,.67,0,dark);break;
   case 'markers':box(1,.14,1,0,.07,0,light);for(let i=0;i<6;i++){cylinder(.065,.85,-.4+i*.16,.56,0,i%2?body:wood);}break;
   case 'scissors':ring(.17,.055,-.2,.17,0);ring(.17,.055,.2,.17,0);for(const x of [-.15,.15])box(.08,.7,.15,x,.62,0,dark).rotation.z=x<0?-.24:.24;sphere(.06,0,.4,0,dark);break;
   case 'stapler':box(1,.12,1,0,.06,0,dark);box(1,.26,.9,0,.72,0).rotation.z=.16;box(.12,.65,.95,-.42,.4,0);break;
   case 'case':box(1,.8,1,0,.4,0);box(.94,.04,1.02,0,.85,0,dark);box(.13,.11,.025,.3,.79,.52,light);break;
   case 'teddy':sphere(.28,0,.37,0,body,1,1.15,.9);sphere(.25,0,.75,0);for(const x of [-.18,.18])sphere(.11,x,.94,0);for(const x of [-.3,.3])sphere(.14,x,.43,0);for(const x of [-.2,.2])sphere(.14,x,.12,.08);for(const x of [-.08,.08])sphere(.025,x,.79,.23,dark);sphere(.055,0,.7,.26,light);break;
   case 'doll':sphere(.18,0,.83,0,light);box(.35,.4,.3,0,.48,0);for(const x of [-.13,.13])box(.12,.3,.2,x,.15,0,light);for(const x of [-.28,.28])box(.1,.35,.16,x,.5,0,light);break;
   case 'toycar':case 'toytrain':box(1,.4,.8,0,.35,0);box(.5,.3,.75,0,.7,0,light);for(const x of [-.33,.33])for(const z of [-.43,.43]){const wheel=cylinder(.15,.07,x,.15,z,dark);wheel.rotation.x=Math.PI/2;}if(kind==='toytrain')cylinder(.1,.2,-.32,.76,0,dark);break;
   case 'blocks':for(let i=0;i<3;i++){box(.75,.24,.8,i*.09-.09,.12+i*.28,0,i===1?wood:body);for(const x of [-.2,.2])for(const z of [-.22,.22])cylinder(.07,.05,x+i*.09-.09,.265+i*.28,z,light);}break;
   case 'ball':sphere(.5,0,.5,0);ring(.5,.015,0,.5,0,light);break;
   case 'gamebox':box(1,.85,1,0,.43,0);box(1.04,.15,1.04,0,.92,0,light);box(.5,.012,.45,0,1.01,0);break;
   case 'robot':box(.55,.35,.6,0,.43,0);box(.48,.25,.52,0,.77,0,light);for(const x of [-.15,.15])box(.09,.05,.025,x,.8,.28,dark);for(const x of [-.2,.2])box(.14,.25,.3,x,.13,0);for(const x of [-.4,.4])box(.12,.35,.2,x,.46,0);cylinder(.02,.1,0,.96,0,dark);break;
   case 'dinosaur':sphere(.26,0,.4,0,body,1.4,.9,.75);sphere(.14,.32,.7,0,body,1.1,1,.8);box(.1,.4,.12,.23,.53,0).rotation.z=-.35;for(const x of [-.13,.13])for(const z of [-.12,.12])box(.06,.3,.07,x,.15,z);box(.34,.07,.07,-.36,.4,0).rotation.z=.2;break;
   case 'mug':case 'cup':case 'bowl':case 'jar':cylinder(.38,kind==='bowl'?.6:.9,0,kind==='bowl'?.3:.45,0);cylinder(.33,.02,0,kind==='bowl'?.61:.91,0,dark);if(kind==='mug')ring(.22,.06,.4,.5,0);if(kind==='jar')cylinder(.41,.08,0,.98,0,wood);break;
   case 'plate':cylinder(.5,.2,0,.1,0,light);cylinder(.42,.09,0,.23,0);break;
   case 'utensils':cylinder(.3,.6,0,.3,0,wood);for(const x of [-.17,0,.17]){box(.035,.5,.045,x,.69,0,dark);sphere(.07,x,.94,0,dark,.8,1,.2);}break;
   case 'pot':case 'pan':cylinder(.34,kind==='pan'?.4:.7,0,kind==='pan'?.2:.35,0,dark);if(kind==='pot'){cylinder(.37,.05,0,.74,0,light);sphere(.07,0,.81,0);for(const x of [-.44,.44])box(.2,.08,.2,x,.5,0);}else box(.44,.1,.15,.5,.35,0);break;
   case 'kettle':sphere(.35,0,.4,0);ring(.28,.045,0,.75,0,dark);box(.3,.14,.14,-.38,.55,0).rotation.z=-.3;cylinder(.17,.07,0,.74,0,light);break;
   case 'blender':cylinder(.32,.32,0,.16,0);cylinder(.26,.6,0,.65,0,light);cylinder(.3,.06,0,.98,0,dark);ring(.17,.04,.31,.64,0);break;
   case 'coffeemaker':box(.9,.12,.95,0,.06,0);box(.35,.85,.9,-.25,.55,0);box(.8,.17,.9,.05,.93,0);cylinder(.22,.4,.15,.39,.08,light);ring(.13,.04,.39,.42,.08,dark);break;
   case 'toaster':box(1,.9,1,0,.45,0);for(const x of [-.23,.23])box(.17,.02,.75,x,.91,0,dark);box(.05,.13,.07,.51,.52,0,dark);break;
   case 'pillow':sphere(.5,0,.5,0,body,1,.65,.9);break;
   case 'blanket':for(let i=0;i<3;i++)box(1,.28,1,0,.16+i*.3,0,i===1?light:body);break;
   case 'shoes':for(const x of [-.23,.23]){sphere(.24,x,.29,.05,body,.8,1,1.6);box(.38,.3,.35,x,.53,-.17);}break;
   case 'shirt':box(.7,.75,.9,0,.4,0);box(1,.45,.45,0,.73,-.14);ring(.12,.03,0,.96,-.34,dark).rotation.x=Math.PI/2;break;
   case 'hanger':box(.7,.03,.12,0,.21,0,wood);for(const x of [-.2,.2])box(.48,.035,.12,x,.42,0,wood).rotation.z=x<0?.6:-.6;ring(.12,.025,.04,.8,0,dark);break;
   case 'backpack':box(.9,.9,.85,0,.45,0);box(.65,.38,.22,0,.25,.51,wood);ring(.16,.04,0,.94,0,dark);break;
   case 'clock':const clock=cylinder(.43,.18,0,.53,0,light);clock.rotation.x=Math.PI/2;box(.04,.3,.025,0,.64,.12,dark);box(.25,.035,.025,.12,.51,.12,dark);box(.8,.1,.8,0,.05,0);break;
   case 'remote':box(1,.95,1,0,.47,0,dark);for(let i=0;i<5;i++)for(const x of [-.25,.25])sphere(.08,x,.25+i*.13,.51,body,1,1,.15);break;
   case 'candle':cylinder(.42,.9,0,.45,0,light);cylinder(.035,.1,0,.97,0,dark);break;
   case 'fan':box(.6,.08,.7,0,.04,0,dark);cylinder(.035,.5,0,.3,0,dark);ring(.36,.035,0,.69,0);for(let i=0;i<4;i++){const blade=box(.14,.29,.035,0,.69,0,light);blade.position.x=Math.sin(i*Math.PI/2)*.13;blade.position.y=.69+Math.cos(i*Math.PI/2)*.13;blade.rotation.z=-i*Math.PI/2;}break;
   case 'hammer':box(.18,.76,.25,0,.38,0,wood);box(.9,.2,.65,0,.89,0,dark);break;
   case 'screwdriver':case 'flashlight':cylinder(kind==='flashlight'?.3:.2,.5,0,.28,0);cylinder(.07,.44,0,.75,0,dark);if(kind==='flashlight')cylinder(.4,.16,0,.91,0,light);else box(.12,.12,.06,0,.95,0,dark);break;
   case 'drill':case 'dryer':box(.6,.35,.8,-.07,.74,0);box(.22,.6,.45,-.05,.32,0);box(.3,.12,.18,.4,.74,0,dark);if(kind==='drill')box(.1,.15,.9,-.05,.08,0,dark);break;
   case 'pliers':for(const x of [-.16,.16])box(.15,.65,.3,x,.33,0).rotation.z=x<0?-.2:.2;for(const x of [-.08,.08])box(.15,.4,.3,x,.78,0,dark).rotation.z=x<0?.2:-.2;break;
   case 'wrench':box(.18,.7,.5,0,.35,0,dark);box(.65,.12,.5,0,.74,0,dark);for(const x of [-.27,.27])box(.13,.2,.5,x,.86,0,dark);break;
   case 'tape':box(.9,.85,1,0,.45,0);box(.65,.025,.2,.38,.08,0,light);ring(.22,.035,0,.5,.53,dark);break;
   case 'toolbox':box(1,.75,1,0,.38,0);box(1.03,.12,1.03,0,.81,0,wood);box(.48,.05,.06,0,.98,0,dark);for(const x of [-.23,.23])box(.04,.16,.06,x,.91,0,dark);for(const x of [-.27,.27])box(.07,.22,.025,x,.7,.53,light);break;
   case 'toothbrush':box(.25,.74,.5,0,.37,0);box(.7,.25,.7,0,.87,0,light);break;
   case 'bottle':box(.85,.8,1,0,.4,0);box(.5,.18,.8,0,.89,0,wood);box(.55,.35,.025,0,.42,.51,light);break;
   case 'soap':box(1,.4,1,0,.2,0,light);box(.8,.5,.75,0,.65,0);break;
  }
  return g;
 }
 function disposeGroup(group){const materials=new Set();group.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());}
 class PersonalScene{
  constructor(container,{onSelect,onMove}){
   this.container=container;this.onSelect=onSelect;this.onMove=onMove;this.groups=new Map();this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#f5f4f1');this.scene.fog=new THREE.Fog('#f5f4f1',60,160);
   this.camera=new THREE.PerspectiveCamera(42,1,.05,200);this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputEncoding=THREE.sRGBEncoding;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.append(this.renderer.domElement);
   this.controls=new THREE.OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.maxPolarAngle=Math.PI/2-.04;this.controls.minDistance=2;this.controls.maxDistance=80;
   this.scene.add(new THREE.HemisphereLight('#ffffff','#d7d2c9',.55));const sun=new THREE.DirectionalLight('#fff8ef',.4);sun.position.set(8,14,10);sun.castShadow=true;sun.shadow.bias=-.0003;sun.shadow.normalBias=.02;this.sun=sun;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-40;sun.shadow.camera.right=sun.shadow.camera.top=40;this.scene.add(sun,sun.target);
   this.content=new THREE.Group();this.scene.add(this.content);this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
   this.resize=()=>{const r=container.getBoundingClientRect();if(r.width<1||r.height<1)return;this.renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height,factor=Math.max(1,1/aspect)/Math.max(1,1/(this.lastAspect||1));if(this.space&&Math.abs(factor-1)>.001)this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.lastAspect=aspect;this.camera.aspect=aspect;this.camera.updateProjectionMatrix();};this.observer=new ResizeObserver(this.resize);this.observer.observe(container);
   const point=e=>{const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);};
   this.renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;point(e);const hit=this.ray.intersectObjects([...this.groups.values()],true)[0];if(!hit)return;let g=hit.object;while(g&&!g.userData.objectId)g=g.parent;if(!g)return;this.onSelect(g.userData.objectId);if(this.moveMode){this.dragId=g.userData.objectId;this.dragStart={x:e.clientX,y:e.clientY};const grab=new THREE.Vector3();this.dragOffset=this.ray.ray.intersectPlane(this.plane,grab)?grab.sub(g.position):new THREE.Vector3();this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}});
   this.renderer.domElement.addEventListener('pointermove',e=>{if(!this.dragId)return;if(!(e.buttons&1)){this.dragId=null;this.controls.enabled=true;return;}if(Math.hypot(e.clientX-this.dragStart.x,e.clientY-this.dragStart.y)<3)return;point(e);const p=new THREE.Vector3();if(this.ray.ray.intersectPlane(this.plane,p)){p.sub(this.dragOffset);const item=this.space.objects.find(o=>o.id===this.dragId),a=item.yaw*Math.PI/180,ex=(item.width*Math.abs(Math.cos(a))+item.depth*Math.abs(Math.sin(a)))/2,ez=(item.depth*Math.abs(Math.cos(a))+item.width*Math.abs(Math.sin(a)))/2;item.x=Math.max(ex,Math.min(this.space.width-ex,p.x));item.z=Math.max(ez,Math.min(this.space.depth-ez,p.z));this.groups.get(item.id).position.set(item.x,0,item.z);this.onMove(item.id,item.x,item.z);this.highlight?.update();}});
   const end=()=>{this.dragId=null;this.controls.enabled=true;};this.renderer.domElement.addEventListener('pointerup',end);this.renderer.domElement.addEventListener('pointercancel',end);this.renderer.domElement.addEventListener('lostpointercapture',end);window.addEventListener('pointerup',end);
   const draw=()=>{this.frame=requestAnimationFrame(draw);if(container.clientWidth&&container.clientHeight){this.controls.update();this.renderer.render(this.scene,this.camera);}};draw();window.addEventListener('pagehide',()=>{cancelAnimationFrame(this.frame);this.observer.disconnect();this.renderer.dispose();});
  }
  setSpace(space,reset=false){this.space=space;const span=Math.max(space.width,space.depth);this.sun.position.set(space.width/2+8,14,space.depth/2+10);this.sun.target.position.set(space.width/2,0,space.depth/2);this.sun.shadow.camera.left=this.sun.shadow.camera.bottom=-span;this.sun.shadow.camera.right=this.sun.shadow.camera.top=span;this.sun.shadow.camera.updateProjectionMatrix();if(this.highlight){this.scene.remove(this.highlight);this.highlight.geometry.dispose();this.highlight.material.dispose();this.highlight=null;}disposeGroup(this.content);this.content.clear();this.groups.clear();
   const floor=new THREE.Mesh(new THREE.BoxGeometry(space.width,.12,space.depth),new THREE.MeshStandardMaterial({color:'#e8e2d7',roughness:1}));floor.position.set(space.width/2,-.06,space.depth/2);floor.receiveShadow=true;this.content.add(floor);
   const wallMat=new THREE.MeshStandardMaterial({color:'#f4f0e8',roughness:1});for(const [w,d,x,z] of [[space.width,.1,space.width/2,0],[.1,space.depth,0,space.depth/2]]){const wall=new THREE.Mesh(new THREE.BoxGeometry(w,1.15,d),wallMat);wall.position.set(x,.575,z);wall.receiveShadow=true;this.content.add(wall);}
   for(const item of space.objects){const group=model(item.modelId,item.color);group.scale.set(item.width,item.height,item.depth);group.position.set(item.x,0,item.z);group.rotation.y=-item.yaw*Math.PI/180;group.userData.objectId=item.id;this.content.add(group);this.groups.set(item.id,group);}
   if(reset)this.reset();this.resize();
  }
  select(id){if(this.highlight){this.scene.remove(this.highlight);this.highlight.geometry.dispose();this.highlight.material.dispose();this.highlight=null;}const group=this.groups.get(id);if(group){this.highlight=new THREE.BoxHelper(group,'#188452');this.scene.add(this.highlight);}}
  reset(){if(!this.space)return;this.resize();const s=this.space,r=Math.max(s.width,s.depth,...s.objects.map(o=>o.height))*1.2*Math.max(1,1/this.camera.aspect);this.controls.maxDistance=Math.max(80,r*5);this.camera.far=Math.max(200,r*8);this.camera.updateProjectionMatrix();this.scene.fog.near=Math.max(60,r*4);this.scene.fog.far=Math.max(160,r*8);this.camera.position.set(s.width/2+r,r*.9,s.depth/2+r);this.controls.target.set(s.width/2,.3,s.depth/2);this.controls.update();}
  top(){const s=this.space;this.camera.position.set(s.width/2,Math.max(s.width,s.depth)*1.7*Math.max(1,1/this.camera.aspect),s.depth/2+.01);this.controls.target.set(s.width/2,0,s.depth/2);this.controls.update();}
  setMoveMode(value){this.moveMode=value;this.renderer.domElement.style.cursor=value?'grab':'default';}
 }
 let thumbRenderer;const thumbs=new Map();
 function thumbnail(spec){if(thumbs.has(spec.id))return thumbs.get(spec.id);try{if(!thumbRenderer){thumbRenderer=new THREE.WebGLRenderer({antialias:true});thumbRenderer.setSize(200,150);thumbRenderer.outputEncoding=THREE.sRGBEncoding;window.addEventListener('pagehide',()=>thumbRenderer.dispose());}const s=new THREE.Scene();s.background=new THREE.Color('#edf0e7');s.add(new THREE.HemisphereLight('#ffffff','#d7d2c9',.65));const sun=new THREE.DirectionalLight('#ffffff',.5);sun.position.set(3,5,4);s.add(sun);const group=model(spec.id,spec.color);group.scale.set(spec.width,spec.height,spec.depth);s.add(group);const size=Math.max(spec.width,spec.depth,spec.height),c=new THREE.PerspectiveCamera(38,4/3,.01,100);c.position.set(size*1.5,size*1.2,size*1.8);c.lookAt(0,spec.height*.45,0);thumbRenderer.render(s,c);const url=thumbRenderer.domElement.toDataURL('image/png');disposeGroup(group);thumbs.set(spec.id,url);return url;}catch(_){return null;}}
 window.Personal3D={model,PersonalScene,thumbnail};
})();
