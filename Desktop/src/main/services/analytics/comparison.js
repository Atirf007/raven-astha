'use strict';
const {restore,invalid}=require('./datasets');
const {canonical}=require('./evidence');
function frozen(snapshot){const data=restore(typeof snapshot.dataset==='string'?JSON.parse(snapshot.dataset):snapshot.dataset);if(data.hash!==snapshot.content_hash||data.rows!==Number(snapshot.row_count))throw Error('SNAPSHOT_INTEGRITY');return data.data;}
function context(data){const provenance=data.provenance?{...data.provenance}:null;if(provenance)delete provenance.records;return {kind:data.kind,variable:data.variable,source:data.source,provenance};}
function compare(before,after,offset=0){
 const left=frozen(before),right=frozen(after);if(left.kind!==right.kind)invalid('Grãos diferentes: medições, vidas e perdas por categoria não podem ser reconciliadas como a mesma população.');
 const leftContext=context(left),rightContext=context(right),metadata=[];
 for(const key of ['variable','source','provenance'])if(canonical(leftContext[key])!==canonical(rightContext[key]))metadata.push({field:key,before:leftContext[key],after:rightContext[key]});
 const lineage=data=>new Map((data.provenance?.records||[]).map(record=>[record.subject_id,record]));
 const lRecords=lineage(left),rRecords=lineage(right),l=new Map(left.rows.map(row=>[row.subject_id,row])),r=new Map(right.rows.map(row=>[row.subject_id,row]));
 const summary={added:0,removed:0,changed:0,unchanged:0},changes=[];
 for(const id of [...new Set([...l.keys(),...r.keys()])].sort()){
  const a=l.get(id)||null,b=r.get(id)||null,originA=lRecords.get(id)||null,originB=rRecords.get(id)||null;
  const status=!a?'added':!b?'removed':canonical(a)!==canonical(b)||canonical(originA)!==canonical(originB)?'changed':'unchanged';summary[status]++;
  if(status!=='unchanged')changes.push({subject_id:id,status,before:a,after:b,origin_before:originA,origin_after:originB});
 }
 if(!Number.isSafeInteger(offset)||offset<0||offset>changes.length)invalid('Página de diferenças inválida.');
 const describe=(snapshot,data)=>({id:snapshot.id,version:snapshot.version,sha256:snapshot.content_hash,row_count:Number(snapshot.row_count),...context(data)});
 return {schema:'astha-version-comparison/1',before:describe(before,left),after:describe(after,right),metadata_changes:metadata,summary,total_changes:changes.length,changes:changes.slice(offset,offset+100),has_more:offset+100<changes.length,next_cursor:offset+100<changes.length?offset+100:null,limitations:['Identificadores iguais são comparados como texto. Isso não comprova identidade física, equivalência de peças ou comparabilidade científica.','Não há conversão de unidade, subtração de valores ou cálculo de efeito. Uma mudança de variável/unidade/origem deve ser revisada antes de comparar resultados.','Comparação documental entre snapshots: não altera dados, resultados, revisões ou registros operacionais.']};
}
module.exports={compare};
