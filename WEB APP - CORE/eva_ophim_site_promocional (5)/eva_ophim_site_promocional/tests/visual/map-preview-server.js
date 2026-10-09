const express = require('../../api/node_modules/express');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const app = express();
const blueprint = {schemaVersion:2,units:'cm',floors:{0:{
  walls:[{id:'W-N',x1:80,y1:60,x2:720,y2:60},{id:'W-W',x1:80,y1:60,x2:80,y2:500},{id:'W-S',x1:80,y1:500,x2:720,y2:500}],
  doors:[{id:'D1',x:390,y:500,angle:0}],windows:[{id:'WIN1',x:250,y:60,angle:0}],pillars:[{id:'C01',x:240,y:260,size:24},{id:'C02',x:560,y:260,size:24}],
  shelves:[{id:'A1',x:120,y:120,w:150,h:45,levels:4,positions:5},{id:'A2',x:450,y:120,w:180,h:45,levels:5,positions:6,angle:Math.PI/4}],
  stairs:[{id:'ST1',x1:640,y1:360,x2:700,y2:460}],zones:[{id:'Z-RECEB',label:'Recebimento',x1:110,y1:350,x2:330,y2:470,color:'#f97316'}],
  paths:[{id:'R1',x1:100,y1:300,x2:680,y2:300}],machines:[{id:'M1',label:'CNC 01',x:380,y:350,w:100,h:70,height3d:80}],
  forklifts:[{id:'F1',name:'Empilhadeira 01',x:350,y:270,w:40,h:25,height3d:28}],docks:[{id:'DO1',label:'Doca 01',x:500,y:455,w:120,h:40,height3d:18}],addons:[]
}}};

app.get('/visual-start', (_req,res) => res.type('html').send(`<!doctype html><meta charset="utf-8"><script>
localStorage.setItem('astha_token','visual-fixture');
localStorage.setItem('astha_user',JSON.stringify({id:1,name:'Visual QA',email:'qa@example.invalid',role:'admin',org_id:'TEST'}));
localStorage.setItem('ASTHA_maphub_maps',JSON.stringify([{id:'visual-map',name:'Galpão de Validação',type:'stock',items:[],sectors:[],imageUrl:null}]));
location.replace('/app/sistema.html');</script>`));
app.get('/api/warehouse/layout', (_req,res) => res.json({id:1,org_id:'TEST',blueprint_data:blueprint}));
app.get('/api/warehouse/tabs', (_req,res) => res.json([{id:1,name:'Galpão de Validação',tab_number:1}]));
app.get('/api/auth/me', (_req,res) => res.json({id:1,name:'Visual QA',role:'admin',org_id:'TEST'}));
app.get('/api/*', (_req,res) => res.json([]));
app.use(express.static(root));
app.listen(4173,'127.0.0.1',()=>console.log('MAP_PREVIEW_READY http://127.0.0.1:4173/visual-start'));
