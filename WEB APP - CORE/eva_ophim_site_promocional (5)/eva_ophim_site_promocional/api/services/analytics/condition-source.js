'use strict';
const {createHash}=require('node:crypto');
const {dataset,fields,text,invalid}=require('./datasets');
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const timestamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===value&&value>='1970-01-01'&&value<='2100-12-31';}
function selection(input){
 fields(input,['asset_code','metric_code','unit','from','through']);
 if(!text(input.asset_code,40)||!text(input.metric_code,80)||!text(input.unit,24)||!date(input.from)||!date(input.through)||input.from>input.through||Date.parse(input.through)-Date.parse(input.from)>366*86400000)invalid('Selecione equipamento, métrica, unidade e período de até 367 dias.');
 return {asset_code:input.asset_code.trim(),metric_code:input.metric_code.trim(),unit:input.unit.trim(),from:input.from,through:input.through};
}
function provenance(input){
 fields(input,['adapter','asset_code','asset_name','metric_code','unit','from','through','clock','grain','records']);
 const filter=selection({asset_code:input.asset_code,metric_code:input.metric_code,unit:input.unit,from:input.from,through:input.through});
 if(input.adapter!=='eam-condition/1'||!text(input.asset_name,200)||input.clock!=='database-wall-time'||input.grain!=='reading'||!Array.isArray(input.records)||!input.records.length||input.records.length>4000)invalid('Proveniência de condição inválida.');
 const seen=new Set();const records=input.records.map(record=>{fields(record,['subject_id','recorded_at','source']);if(typeof record.subject_id!=='string'||!/^CBM-[a-f0-9]{64}$/.test(record.subject_id)||seen.has(record.subject_id)||typeof record.recorded_at!=='string'||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(record.recorded_at)||!date(record.recorded_at.slice(0,10))||!['manual','iot','inspection'].includes(record.source)||record.recorded_at.slice(0,10)<filter.from||record.recorded_at.slice(0,10)>filter.through)invalid('Linhas de origem inválidas.');seen.add(record.subject_id);return {subject_id:record.subject_id,recorded_at:record.recorded_at,source:record.source};});
 return {adapter:'eam-condition/1',...filter,asset_name:input.asset_name.trim(),clock:input.clock,grain:input.grain,records};
}
function decimal(value){
 // MySQL DECIMAL strings are not concatenated or rounded silently into a measurement.
 if(typeof value!=='string'||!/^[-+]?\d{1,12}(?:\.\d{1,6})?$/.test(value))invalid('Leitura fora do contrato decimal.');
 const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e12)invalid('Leitura fora do limite.');
 const normalize=s=>{const [integer,fraction='']=s.replace(/^\+/,'').split('.');const result=integer.replace(/^(-?)0+(?=\d)/,'$1')+'.'+fraction.padEnd(6,'0');return /^-0\.0+$/.test(result)?result.slice(1):result;};
 if(normalize(n.toFixed(6))!==normalize(value))invalid('Leitura perderia precisão na conversão; revise o intervalo numérico.');return n;
}
function snapshot(asset,records,filter,org){
 if(!records.length)invalid('Não existem leituras para este equipamento, métrica, unidade e período.');if(records.length>4000)invalid('Período excede 4.000 leituras. Reduza o intervalo; nenhum dado foi truncado.');
 const rows=[],lineage=[];for(const record of records){
  if(!Number.isSafeInteger(record.id)||record.id<1||record.unit!==filter.unit||record.metric_code!==filter.metric_code)invalid('Leitura incompatível com a seleção.');
  const subject_id='CBM-'+createHash('sha256').update(JSON.stringify({org,adapter:'eam-condition/1',id:record.id})).digest('hex');rows.push({subject_id,value:decimal(record.value)});lineage.push({subject_id,recorded_at:record.recorded_at,source:record.source});
 }
 const origin=provenance({adapter:'eam-condition/1',...filter,asset_name:asset.name,clock:'database-wall-time',grain:'reading',records:lineage});
 return dataset({kind:'measurements',variable:{name:filter.metric_code,unit:filter.unit},rows},{source:'application-condition',provenance:origin});
}
module.exports={selection,provenance,snapshot,decimal};
