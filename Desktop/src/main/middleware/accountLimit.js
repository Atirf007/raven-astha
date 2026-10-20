'use strict';
const rateLimit=require('express-rate-limit');
module.exports={
 sensitive:rateLimit({windowMs:5*60*1000,max:10,standardHeaders:true,legacyHeaders:false,keyGenerator:req=>String(req.user.id),message:{error:'Muitas tentativas. Aguarde 5 minutos.'}}),
 recovery:rateLimit({windowMs:15*60*1000,max:5,standardHeaders:true,legacyHeaders:false,message:{error:'Muitas tentativas. Aguarde 15 minutos.'}})
};
