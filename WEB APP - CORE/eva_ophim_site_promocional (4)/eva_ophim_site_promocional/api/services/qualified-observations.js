'use strict';
const {fields,text,invalid}=require('./analytics/datasets');
const {createHash}=require('node:crypto');
const {exposureLedger,legacyDowntimeReport}=require('./analytics/exposure');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sqlTime=value=>value==null?null:new Date(value).toISOString().slice(0,23).replace('T',' ');
const utcColumns=['started_at','ended_at','repair_started_at','repair_ended_at'].map(name=>"DATE_FORMAT("+name+",'%Y-%m-%dT%H:%i:%s.%fZ') AS "+name).join(',');
function input(b,now=Date.now()){
 fields(b,['request_key','kind','started_at','ended_at','repair_started_at','repair_ended_at','source','notes','confirmed']);
 if(!UUID.test(b.request_key)||!['operation','failure'].includes(b.kind)||!text(b.source,120)||!text(b.notes,500)||b.confirmed!==true)invalid('Confirme a origem, a observação e a identificação do registro.');
 function time(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)||!Number.isFinite(Date.parse(s)))invalid('Use instantes UTC válidos.');const d=new Date(s);if(d.getTime()>now+60000||d.getUTCFullYear()<2000)invalid('O registro deve representar observação passada.');if(d.toISOString().replace('.000Z','Z')!==s.replace('.000Z','Z'))invalid('Data inválida.');return d;}
 const start=time(b.started_at),end=time(b.ended_at);if(end<=start||end-start>3650*86400000)invalid('Intervalo observado inválido.');
 let repairStart=null,repairEnd=null;if(b.kind==='failure'){repairStart=time(b.repair_started_at);repairEnd=time(b.repair_ended_at);if(repairStart<start||repairEnd<=repairStart||repairEnd>end)invalid('Reparo ativo deve estar contido na parada.');}else if(b.repair_started_at!==undefined||b.repair_ended_at!==undefined)invalid('Operação não admite campos de reparo.');
 const record={kind:b.kind,started_at:start.toISOString(),ended_at:end.toISOString(),repair_started_at:repairStart?.toISOString()??null,repair_ended_at:repairEnd?.toISOString()??null,source:b.source.trim(),notes:b.notes.trim()};
 return{record,dates:[start,end,repairStart,repairEnd].map(sqlTime),hash:createHash('sha256').update(JSON.stringify(record)).digest('hex')};
}
function report({from,to,rows=[],observations=[]}){
 const legacy=legacyDowntimeReport({from,to,rows});if(!observations.length)return legacy;
 const operations=observations.filter(o=>o.kind==='operation'),failures=observations.filter(o=>o.kind==='failure');
 const exposure=exposureLedger({from,to,downtime:[...rows,...failures],operationIntervals:operations});
 const start=+new Date(from),end=+new Date(to),events=failures.filter(o=>+new Date(o.started_at)>=start&&+new Date(o.started_at)<end),repairs=events.filter(o=>+new Date(o.repair_started_at)>=start&&+new Date(o.repair_ended_at)<=end);
 const complete=exposure.unknown_hours<1e-8&&!exposure.conflicting_hours;
 const repairHours=repairs.reduce((n,o)=>n+(+new Date(o.repair_ended_at)-+new Date(o.repair_started_at))/3600000,0);
 return{...legacy,exposure,downtime_hours:exposure.downtime_hours,calendar_availability:exposure.calendar_availability,availability:complete?exposure.availability:null,failures:events.length,completed_repairs:repairs.length,mtbf_hours:complete&&events.length?exposure.observed_operation_hours/events.length:null,mttr_hours:repairs.length?repairHours/repairs.length:null,warnings:[...exposure.warnings,...(!complete?['Cobertura incompleta ou conflitante: MTBF e disponibilidade operacional não são estimados.']:[]),'Eventos confirmados pelo registrador; resultados descritivos, sem inferência de vidas independentes ou aprovação industrial.',...legacy.warnings.filter(w=>w.startsWith('Perda estimada'))]};
}
module.exports={input,report,sqlTime,utcColumns};
