'use strict';
const router=require('express').Router(),auth=require('../middleware/auth'),{pool}=require('../database/connection');
const {loadMode,setPageSession}=require('../middleware/workspaceMode');
router.use(auth,loadMode);
router.get('/context',(req,res)=>{setPageSession(req,res);res.json({type:req.workspace.workspace_type==='personal'?'personal':'corporate',setupDone:Boolean(req.workspace.setup_done)});});
router.put('/type',async(req,res)=>{
 const type=req.body?.type;if(!['personal','corporate'].includes(type))return res.status(400).json({error:'Tipo de uso inválido.'});
 if(type===req.workspace.workspace_type){setPageSession(req,res);return res.json({type});}
 if(req.workspace.setup_done||req.user.role!=='superadmin')return res.status(403).json({error:'O tipo de uso só pode ser alterado pelo criador durante a configuração inicial.'});
 try{const [result]=await pool.execute('UPDATE organizations SET workspace_type=? WHERE BINARY id=BINARY ? AND setup_done=0',[type,req.user.org_id]);if(!result.affectedRows)return res.status(409).json({error:'A configuração já foi concluída.'});setPageSession(req,res);res.json({type});}catch(_){res.status(503).json({error:'Não foi possível salvar o tipo de uso.'});}
});
module.exports=router;
