'use strict';
const router=require('express').Router();
const rateLimit=require('express-rate-limit');
const {pool}=require('../database/connection');
const auth=require('../middleware/auth');
const {answer,clear}=require('../services/contextual-assistant');
// Tools check their own resource's read permission; EAM does not require WMS access.
router.use(auth);
router.delete('/conversations/:id',(req,res)=>{
  try{clear(req.user,req.params.id);res.json({success:true});}
  catch(error){res.status(error.status||503).json({error:error.status?error.message:'Não foi possível limpar a conversa.'});}
});
router.use(rateLimit({windowMs:60000,max:8,keyGenerator:req=>`${req.user.org_id}:${req.user.id}`,standardHeaders:true,legacyHeaders:false,message:{error:'Aguarde um minuto antes de consultar novamente.'}}));
router.post('/query',async(req,res)=>{
  try{res.json(await answer(pool,req.user,req.body));}
  catch(error){res.status(error.status||503).json({error:error.status?error.message:'Não foi possível consultar os registros agora.'});}
});
module.exports=router;
