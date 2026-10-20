'use strict';
const auth=require('./auth');
const {pool}=require('../database/connection');
const path=require('node:path');
const {expiresAt}=require('../security/tokens');
const COOKIE='astha_page_session';
async function loadMode(req,res,next){
 try{const [rows]=await pool.execute('SELECT workspace_type,setup_done FROM organizations WHERE BINARY id=BINARY ?',[req.user.org_id]);if(!rows.length)return res.status(404).json({error:'Página não encontrada.'});req.workspace=rows[0];next();}catch(_){res.status(503).json({error:'Não foi possível verificar o tipo de conta.'});}
}
function setPageSession(req,res,signedToken){const token=signedToken||req.headers.authorization?.slice(7);if(token)res.cookie(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:req.secure||(process.env.NODE_ENV==='production'&&!['localhost','127.0.0.1','[::1]'].includes(req.hostname)),path:'/app',maxAge:Math.max(0,expiresAt(token).getTime()-Date.now())});}
const corporateOnly=[auth,loadMode,(req,res,next)=>req.workspace.workspace_type==='personal'?res.status(404).json({error:'Página não encontrada.'}):next()];
const personalOnly=[auth,loadMode,(req,res,next)=>req.workspace.workspace_type==='personal'?next():res.status(404).json({error:'Página não encontrada.'})];
const organizationGate=[auth,loadMode,(req,res,next)=>req.workspace.workspace_type!=='personal'||['/me','/logo','/complete-setup'].includes(req.path.toLowerCase())?next():res.status(404).json({error:'Página não encontrada.'})];
function pageAccess(req,res,next){
 let token;try{token=decodeURIComponent((req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'');}catch(_){token='';}
 if(!token)return res.redirect('/app/resolve.html?return='+encodeURIComponent(req.originalUrl));
 req.headers.authorization='Bearer '+token;
 const json=res.json.bind(res);res.json=function(body){if(res.statusCode===401){res.clearCookie(COOKIE,{path:'/app'});return res.redirect(302,'/app/resolve.html?return='+encodeURIComponent(req.originalUrl));}return json(body);};
 auth(req,res,()=>loadMode(req,res,()=>{
  const page=req.workspacePage||req.path.toLowerCase(),personal=req.workspace.workspace_type==='personal';
  if(page==='/app/personal.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if(personal&&page==='/app/home.html')return res.redirect('/app/personal.html');
  if(personal&&page==='/app/settings.html'&&['','profile'].includes(String(req.query.tab||'')))return res.redirect('/app/personal.html?view=profile');
  if((personal&&['/app/sistema.html','/app/analytics.html','/app/viewer-3d.html','/app/settings.html'].includes(page))||(!personal&&page==='/app/personal.html'))return res.status(404).sendFile(path.join(__dirname,'../../renderer/404.html'));
  next();
 }));
}
module.exports={loadMode,setPageSession,corporateOnly,personalOnly,organizationGate,pageAccess,COOKIE};
