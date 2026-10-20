'use strict';
const crypto=require('node:crypto'),bcrypt=require('bcryptjs');
const {verifyToken}=require('../security/tokens'),{validPassword,PASSWORD_ERROR}=require('../security/password-policy');
const {ownScope}=require('./personal-spaces');
const RECOVERY_PREFIX='account-recovery:';
const failure=(message,status=400,code)=>Object.assign(new Error(message),{status,code});
const email=value=>{if(typeof value!=='string'||value.length>255||!/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(value))throw failure('Informe um e-mail válido.');return value.trim().toLowerCase();};
const sessionToken=req=>req.headers.authorization.slice(7);
async function identity(db,user){const [rows]=await db.execute('SELECT id,org_id,email,provider,provider_id,password_hash,role FROM users WHERE id=? AND BINARY org_id=BINARY ? AND is_active=1',[user.id,user.org_id]);if(!rows.length)throw failure('Sessão inválida.',401);return rows[0];}
function recent(token){try{const claims=verifyToken(token),age=Date.now()/1000-claims.iat;return Number.isFinite(age)&&age>=-5&&age<=300;}catch(_){return false;}}
async function proof(db,req,body,localOnly=false){
 const user=await identity(db,req.user);
 if(user.provider!=='local'){
  if(localOnly)throw failure('O e-mail e a senha desta conta são gerenciados pelo provedor de login.',409,'PROVIDER_MANAGED');
  const [sessions]=await db.execute('SELECT provider FROM sessions WHERE user_id=? AND token=? AND expires_at>NOW()',[user.id,sessionToken(req)]);
  if(!recent(sessionToken(req))||sessions[0]?.provider!==user.provider)throw failure('Entre novamente com seu provedor para confirmar esta ação. A confirmação vale por 5 minutos.',403,'REAUTH_REQUIRED');
 }else{
  const password=body?.current_password;
  if(typeof password!=='string'||!password||Buffer.byteLength(password,'utf8')>72)throw failure('Informe sua senha atual.');
  if(!user.password_hash||!await bcrypt.compare(password,user.password_hash))throw failure('Senha atual incorreta.',403,'PASSWORD_INCORRECT');
 }
 return user;
}
async function transaction(pool,req,snapshot,work,lockOrganization=false){const db=await pool.getConnection();try{
 await db.beginTransaction();
 if(lockOrganization)await db.execute('SELECT id FROM organizations WHERE id=? FOR UPDATE',[snapshot.org_id]);
 const [rows]=await db.execute('SELECT id,org_id,email,provider,password_hash,role FROM users WHERE id=? AND BINARY org_id=BINARY ? AND is_active=1 FOR UPDATE',[snapshot.id,snapshot.org_id]);
 const current=rows[0];if(!current||current.password_hash!==snapshot.password_hash||current.provider!==snapshot.provider||current.email!==snapshot.email)throw failure('Sua conta mudou. Entre novamente antes de continuar.',401);
 const [sessions]=await db.execute('SELECT id FROM sessions WHERE user_id=? AND token=? AND expires_at>NOW()',[snapshot.id,sessionToken(req)]);if(!sessions.length)throw failure('Sessão revogada.',401);
 const result=await work(db,current);await db.commit();return result;
 }catch(error){await db.rollback();throw error;}finally{db.release();}}
async function audit(db,user,action){await db.execute('INSERT INTO audit_log (user_id,action,entity_type,entity_id) VALUES (?, ?, ?, ?)',[user.id,action,'user',user.id]);}
async function revokeAll(db,id){await db.execute('DELETE FROM sessions WHERE user_id=?',[id]);await db.execute('DELETE FROM password_resets WHERE user_id=?',[id]);}
async function context(db,req){const user=await identity(db,req.user);return {email:user.email,provider:user.provider,canChangeCredentials:user.provider==='local'&&!!user.password_hash,recentLogin:recent(sessionToken(req))};}
async function changePassword(pool,req,body){
 if(!validPassword(body?.new_password))throw failure(PASSWORD_ERROR);
 const user=await proof(pool,req,body,true),hash=await bcrypt.hash(body.new_password,12);
 return transaction(pool,req,user,async(db,current)=>{await db.execute('UPDATE users SET password_hash=?,failed_logins=0,locked_until=NULL WHERE id=?',[hash,current.id]);await revokeAll(db,current.id);await audit(db,current,'SELF_PASSWORD_CHANGE');return {message:'Senha alterada. Entre novamente com a nova senha.',signOut:true};});
}
async function changeEmail(pool,req,body){
 const target=email(body?.email);if(target!==email(body?.confirm_email))throw failure('A confirmação do e-mail não corresponde.');
 const user=await proof(pool,req,body,true);if(target===user.email.toLowerCase())throw failure('Informe um e-mail diferente do atual.');
 try{return await transaction(pool,req,user,async(db,current)=>{await db.execute('UPDATE users SET email=?,email_verified=0 WHERE id=?',[target,current.id]);await revokeAll(db,current.id);await audit(db,current,'SELF_EMAIL_CHANGE');return {message:'E-mail de acesso alterado. Entre novamente com o novo endereço.',signOut:true};});}catch(e){if(e.code==='ER_DUP_ENTRY')throw failure('Não foi possível usar este e-mail. Escolha outro endereço.',409);throw e;}
}
async function sessions(db,req){const [rows]=await db.execute('SELECT id,provider,created_at,expires_at,LEFT(COALESCE(user_agent,?),120) AS device,(token=?) AS is_current FROM sessions WHERE user_id=? AND expires_at>NOW() ORDER BY is_current DESC,created_at DESC,id DESC LIMIT 100',['Navegador não identificado',sessionToken(req),req.user.id]);return rows.map(row=>({...row,is_current:!!row.is_current}));}
async function revokeSession(db,req,value){if(!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw failure('Sessão não encontrada.',404);const [rows]=await db.execute('SELECT token FROM sessions WHERE id=? AND user_id=?',[Number(value),req.user.id]);if(!rows.length)throw failure('Sessão não encontrada.',404);const [result]=await db.execute('DELETE FROM sessions WHERE id=? AND user_id=?',[Number(value),req.user.id]);if(!result.affectedRows)throw failure('Sessão não encontrada.',404);return {message:'Sessão encerrada.',signOut:rows[0].token===sessionToken(req)};}
async function revokeOthers(db,req){await db.execute('DELETE FROM sessions WHERE user_id=? AND token<>?',[req.user.id,sessionToken(req)]);return {message:'Outras sessões encerradas.'};}
async function recoveryCodes(pool,req,body){const user=await proof(pool,req,body,true);return transaction(pool,req,user,async(db,current)=>{
 await db.execute('DELETE FROM password_resets WHERE user_id=? AND token LIKE ?',[current.id,RECOVERY_PREFIX+'%']);
 const codes=Array.from({length:8},()=>crypto.randomBytes(16).toString('base64url'));
 for(const code of codes)await db.execute('INSERT INTO password_resets (user_id,token,used,expires_at) VALUES (?,?,0,DATE_ADD(NOW(),INTERVAL 365 DAY))',[current.id,RECOVERY_PREFIX+crypto.createHash('sha256').update(code).digest('hex')]);
 await audit(db,current,'SELF_RECOVERY_CODES');return {codes,expiresInDays:365};
 });}
async function recover(pool,body){const address=email(body?.email);if(!validPassword(body?.new_password))throw failure(PASSWORD_ERROR);if(typeof body?.code!=='string'||! /^[a-zA-Z0-9_-]{22}$/.test(body.code))throw failure('E-mail ou código de recuperação inválido.');
 const db=await pool.getConnection();try{await db.beginTransaction();const [rows]=await db.execute("SELECT id,org_id FROM users WHERE email=? AND provider='local' AND is_active=1 FOR UPDATE",[address]);const user=rows[0];if(!user)throw failure('E-mail ou código de recuperação inválido.');const token=RECOVERY_PREFIX+crypto.createHash('sha256').update(body.code).digest('hex');const [codes]=await db.execute('SELECT id FROM password_resets WHERE user_id=? AND token=? AND used=0 AND expires_at>NOW() FOR UPDATE',[user.id,token]);if(!codes.length)throw failure('E-mail ou código de recuperação inválido.');const hash=await bcrypt.hash(body.new_password,12);await db.execute('UPDATE users SET password_hash=?,failed_logins=0,locked_until=NULL WHERE id=?',[hash,user.id]);await revokeAll(db,user.id);await audit(db,user,'SELF_ACCOUNT_RECOVERY');await db.commit();return {message:'Senha redefinida. Entre novamente e gere novos códigos de recuperação.'};}catch(e){await db.rollback();throw e;}finally{db.release();}}
async function deleteAccount(pool,req,body){
 if(body?.confirmation!=='EXCLUIR'||body.acknowledged!==true)throw failure('Confirme a exclusão digitando EXCLUIR.');
 const confirmed=email(body.confirmed_email),user=await proof(pool,req,body);if(confirmed!==user.email.toLowerCase())throw failure('Confirme o e-mail da conta que será excluída.');
 return transaction(pool,req,user,async(db,current)=>{
  const [orgs]=await db.execute('SELECT id,owner_id,workspace_type FROM organizations WHERE id=? FOR UPDATE',[current.org_id]);
  const [members]=await db.execute('SELECT id,role,is_active FROM users WHERE org_id=? AND id<>? FOR UPDATE',[current.org_id,current.id]);
  const others=members.filter(member=>member.is_active);
  const org=orgs[0];if(org?.workspace_type!=='personal'&&others.length&&(Number(org?.owner_id)===current.id||(current.role==='superadmin'&&!others.some(u=>u.role==='superadmin'))))throw failure('Transfira a administração da organização antes de excluir sua conta.',409,'OWNERSHIP_REQUIRED');
  await db.execute('DELETE FROM warehouse_layout WHERE '+ownScope,[current.org_id,current.id]);
  await revokeAll(db,current.id);await db.execute('DELETE FROM webauthn_credentials WHERE user_id=?',[current.id]);
  await db.execute('UPDATE audit_log SET ip_address=NULL,user_agent=NULL WHERE user_id=?',[current.id]);
  await db.execute("UPDATE audit_log SET old_values=NULL,new_values=NULL WHERE entity_type='user' AND entity_id=?",[current.id]);
  await db.execute('UPDATE org_chart SET user_id=NULL,node_label=NULL WHERE user_id=? AND org_id=?',[current.id,current.org_id]);
  if(!members.length){await db.execute('UPDATE org_invites SET expires_at=NOW() WHERE org_id=?',[current.org_id]);if(org?.workspace_type==='personal'&&(org.owner_id==null||Number(org.owner_id)===current.id))await db.execute("UPDATE organizations SET name='Espaço encerrado',slug=NULL,cnpj=NULL,email=NULL,phone=NULL,address=NULL,city=NULL,state=NULL,logo=NULL,logo_url=NULL,policies=NULL,owner_id=NULL WHERE id=?",[current.org_id]);}
  else if(Number(org?.owner_id)===current.id)await db.execute('UPDATE organizations SET owner_id=NULL WHERE id=?',[current.org_id]);
  const tombstone='deleted-'+crypto.randomUUID()+'@deleted.invalid';
  await db.execute("UPDATE users SET name='Conta excluída',surname=NULL,email=?,password_hash=NULL,provider_id=NULL,avatar_url=NULL,company=NULL,phone=NULL,sector=NULL,position_id=NULL,position_label=NULL,dob=NULL,gender=NULL,country=NULL,is_active=0,email_verified=0,last_login_at=NULL,failed_logins=0,locked_until=NULL WHERE id=?",[tombstone,current.id]);
  await audit(db,current,'SELF_ACCOUNT_DELETE');return {message:'Sua conta foi excluída e todas as sessões foram encerradas.',signOut:true};
 },true);
}
module.exports={context,changePassword,changeEmail,sessions,revokeSession,revokeOthers,recoveryCodes,recover,deleteAccount};
