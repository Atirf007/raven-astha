'use strict';
/* Disposable browser QA workspace. Real app, JWT middleware and database; loopback only. */
const crypto=require('node:crypto');
(async()=>{
 const profile=await require('../security/local-profile').load();if(profile.DB_NAME!=='astha_raven_lab')throw Error('Use o perfil local de laboratório.');Object.assign(process.env,profile);
 const {pool}=require('../database/connection'),tokens=require('../security/tokens'),rules=require('../../app/js/sistema-industrial-rules');
 const org='qa_browser_'+crypto.randomBytes(6).toString('hex');let user,layout,stock,server,closing=false;
 const insert=async(sql,args)=>(await pool.execute(sql,args))[0].insertId;
 const close=async()=>{if(closing)return;closing=true;if(server)await new Promise(resolve=>server.close(resolve));if(user){await pool.execute('DELETE FROM sessions WHERE user_id=?',[user]);await pool.execute('UPDATE users SET is_active=0 WHERE id=? AND org_id=?',[user,org]);}if(layout)await pool.execute('INSERT INTO warehouse_map_meta (layout_id,org_id,archived_at) VALUES (?,?,NOW()) ON DUPLICATE KEY UPDATE archived_at=NOW()',[layout,org]);await pool.end();};
 try{
  server=require('node:http').createServer();server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));process.env.ALLOWED_ORIGINS='http://127.0.0.1:'+server.address().port;process.env.PORT=String(server.address().port);const {app}=require('../server');server.on('request',app);
  await insert('INSERT INTO organizations (id,name) VALUES (?,?)',[org,'QA · ASTHA Industrial']);user=await insert("INSERT INTO users (org_id,name,email,role,is_active,email_verified) VALUES (?,?,?,'admin',1,1)",[org,'QA · Biblioteca',org+'@example.invalid']);
  const asset=await insert('INSERT INTO assets (org_id,asset_code,name,created_by) VALUES (?,?,?,?)',[org,'FRESA-QA','Fresadora universal QA',user]);const machine=(number,data)=>rules.validate({id:'QA-'+number,modelId:'ASTHA-3D-'+number,...data});
  const blueprint={schemaVersion:2,units:'cm',name:'Galpão QA',config:{wallHeight:300,snapGrid:false},floors:{0:{shelves:[{id:'SH-QA',x:150,y:150,w:280,h:90,levels:4,positions:5,shelfHeight:280}],machines:[machine('001',{x:650,y:150,linkedAssetId:asset}),machine('053',{x:600,y:600}),machine('065',{x:100,y:650})]}}};
  layout=await insert('INSERT INTO warehouse_layout (org_id,name,room_w,room_h,door_x,door_y,door_w,blueprint_data) VALUES (?,?,2000,1500,0,0,100,?)',[org,'Galpão QA',JSON.stringify(blueprint)]);stock=await insert('INSERT INTO warehouses (org_id,name,tab_number) VALUES (?,?,1)',[org,'Estoque QA']);await insert('INSERT INTO warehouse_context (warehouse_id,org_id,layout_id) VALUES (?,?,?)',[stock,org,layout]);
  const identity={id:user,org_id:org,name:'QA · Biblioteca',email:org+'@example.invalid',role:'admin',org_name:'QA · ASTHA Industrial'},token=tokens.signToken(identity);await insert('INSERT INTO sessions (user_id,token,expires_at) VALUES (?,?,?)',[user,token,tokens.expiresAt(token)]);
  const bootstrap='/__industrial_qa/'+crypto.randomBytes(16).toString('hex');app.get(bootstrap,(req,res)=>{res.set('Cache-Control','no-store');res.send('<!doctype html><title>Inicializando workspace de teste</title><script>localStorage.setItem("astha_token",'+JSON.stringify(token)+');localStorage.setItem("astha_user",'+JSON.stringify(JSON.stringify(identity))+');location.replace("/app/sistema.html?tab=mapa&warehouse='+stock+'");</script>');});
  app.post(bootstrap+'/finish',(req,res)=>{res.json({closing:true});close().then(()=>process.exit(0)).catch(error=>{console.error('QA_CLEANUP_FAILED',error.code||error.name);process.exitCode=1;});});
  console.log('QA_BROWSER_URL http://127.0.0.1:'+server.address().port+bootstrap);
  process.on('SIGINT',()=>close().then(()=>process.exit(0)));process.on('SIGTERM',()=>close().then(()=>process.exit(0)));
 }catch(error){await close();throw error;}
})().catch(error=>{console.error('QA_PREVIEW_FAILED',error.code||error.name);process.exitCode=1;});
