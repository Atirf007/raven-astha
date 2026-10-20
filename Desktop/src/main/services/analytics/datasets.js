'use strict';
const {createHash}=require('node:crypto');
function invalid(message){const error=new Error(message);error.status=400;throw error;}
function text(value,max){return typeof value==='string'&&value.trim().length>0&&value.length<=max;}
function fields(object,allowed){if(!object||typeof object!=='object'||Array.isArray(object)||Object.keys(object).some(key=>!allowed.includes(key)))invalid('Estrutura de dados não permitida.');}
function dataset(input,origin={source:'manual-entry'}){
 fields(input,['kind','variable','rows']);fields(input.variable,['name','unit']);
 if(!['measurements','life','categories'].includes(input.kind)||!text(input.variable.name,100)||!text(input.variable.unit,24)||!Array.isArray(input.rows)||!input.rows.length||input.rows.length>4000)invalid('Informe variável, unidade e entre 1 e 4.000 observações.');
 if(input.kind==='life'&&!['h','d','cycles'].includes(input.variable.unit))invalid('Vida exige unidade h, d ou cycles.');
 if(input.kind==='categories'&&!['occurrences','h','BRL'].includes(input.variable.unit))invalid('Pareto exige unidade occurrences, h ou BRL, sem conversão automática.');
 const subjects=new Set(),categories=new Set();
 const rows=input.rows.map(row=>{
  fields(row,input.kind==='life'?['subject_id','duration','event']:input.kind==='categories'?['subject_id','category','value']:['subject_id','value']);
  if(!text(row.subject_id,120))invalid('Cada observação exige identificação do sujeito.');
  const subject=row.subject_id.trim();if(subjects.has(subject))invalid('Identificação repetida; revise o grão do estudo.');subjects.add(subject);
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e100;
  if(input.kind==='categories'){
   if(!text(row.category,100)||!valid(row.value)||row.value<0||input.variable.unit==='occurrences'&&!Number.isSafeInteger(row.value))invalid('Informe categoria e perda não negativa; contagens exigem inteiros exatos. Ausente não é zero.');
   categories.add(row.category.trim());if(categories.size>100)invalid('Use até 100 categorias distintas por estudo.');return {subject_id:subject,category:row.category.trim(),value:row.value};
  }
  if(input.kind==='life'){
   if(!valid(row.duration)||row.duration<=0||typeof row.event!=='boolean')invalid('Vida exige duração positiva e evento explícito (true/false).');
   return {subject_id:subject,duration:row.duration,event:row.event};
  }
  if(row.value!==null&&!valid(row.value))invalid('Medição exige número finito ou null; vazio não significa zero.');
  return {subject_id:subject,value:row.value};
 });
 if(!['manual-entry','file-import','application-condition'].includes(origin.source))invalid('Origem dos dados inválida.');
 const normalized={schema:'astha-dataset/1',kind:input.kind,source:origin.source,variable:{name:input.variable.name.trim(),unit:input.variable.unit.trim()},rows};
 if(origin.source==='file-import')normalized.provenance=require('./imports').provenance(origin.provenance);
 if(origin.source==='application-condition'){
  if(input.kind!=='measurements')invalid('Leituras de condição não são vidas independentes.');
  normalized.provenance=require('./condition-source').provenance(origin.provenance);
  if(normalized.provenance.records.length!==rows.length||normalized.provenance.records.some((record,i)=>record.subject_id!==rows[i].subject_id)||normalized.provenance.unit!==normalized.variable.unit||normalized.provenance.metric_code!==normalized.variable.name)invalid('Linhas ou unidades divergentes da origem.');
 }
 const content=JSON.stringify(normalized);if(Buffer.byteLength(content)>2*1024*1024)invalid('Dados excedem o limite de 2 MiB.');
 return {data:normalized,content,hash:createHash('sha256').update(content).digest('hex'),rows:rows.length};
}
function restore(stored){
 fields(stored,['schema','kind','source','variable','rows','provenance']);
 if(stored.schema!=='astha-dataset/1'||!['manual-entry','file-import','application-condition'].includes(stored.source)||stored.source==='manual-entry'&&stored.provenance!==undefined)invalid('Versão de dados inválida.');
 return dataset({kind:stored.kind,variable:stored.variable,rows:stored.rows},{source:stored.source,provenance:stored.provenance});
}
function analysis(data,method,parameters){
 fields(parameters,method==='pareto/1'?['unit']:method==='weibull-2p-right/1'?['unit','independent_subjects','noninformative_censoring','single_population']:method==='age-hazard/1'?['unit','independent_subjects','noninformative_censoring','bins']:method==='kaplan-meier-right/1'?['unit','independent_subjects','noninformative_censoring']:[]);
 if(parameters.unit!==undefined&&parameters.unit!==data.variable.unit)invalid('Unidade incompatível.');
 if(method==='descriptive/1'&&data.kind==='measurements')return {};
 if(method==='normal-reference/1'&&data.kind==='measurements')return {};
 if(method==='pareto/1'&&data.kind==='categories')return {unit:data.variable.unit};
 if(method==='age-hazard/1'&&data.kind==='life'&&parameters.independent_subjects===true&&parameters.noninformative_censoring===true){const bins=parameters.bins??6;if(!Number.isSafeInteger(bins)||bins<2||bins>20)invalid('Use entre duas e vinte faixas de idade.');return {unit:data.variable.unit,independent_subjects:true,noninformative_censoring:true,bins};}
 if(method==='weibull-2p-right/1'&&data.kind==='life'&&parameters.independent_subjects===true&&parameters.noninformative_censoring===true&&parameters.single_population===true)return {unit:data.variable.unit,independent_subjects:true,noninformative_censoring:true,single_population:true};
 if(method==='kaplan-meier-right/1'&&data.kind==='life'&&parameters.independent_subjects===true&&parameters.noninformative_censoring===true)return {unit:data.variable.unit,independent_subjects:true,noninformative_censoring:true};
 invalid('Método incompatível ou hipóteses de censura/independência não declaradas.');
}
module.exports={dataset,restore,analysis,text,fields,invalid};
