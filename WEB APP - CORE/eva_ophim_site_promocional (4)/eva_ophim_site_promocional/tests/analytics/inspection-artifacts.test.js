'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dataset}=require('../../api/services/analytics/datasets');
const {inspect,inspectEvidence}=require('../../api/services/analytics/inspection');
const {artifact}=require('../../api/services/analytics/artifacts');
const {evidence,hash}=require('../../api/services/analytics/evidence');
const {run}=require('../../api/services/analytics/runner');
const snap=(input)=>{const d=dataset(input);return {id:'snapshot',dataset:d.data,content_hash:d.hash,row_count:d.rows,version:2};};
const measurements=(rows)=>({kind:'measurements',variable:{name:'T',unit:'°C'},rows});

test('inspection preserves zero and missingness, checks integrity and enumerates all frozen rows',()=>{
 const input=snap(measurements(Array.from({length:220},(_,i)=>({subject_id:'S'+i,value:i%2?null:0}))));
 const before=JSON.stringify(input),pages=[0,100,200].map(after=>inspect(input,after));
 assert.equal(pages[0].counts.zero,110);assert.equal(pages[0].counts.missing,110);assert.equal(pages[0].counts.valid,110);
 assert.equal(pages[0].methods[0].compatible,true);assert.equal(pages[0].methods[1].compatible,false);
 assert.equal(pages[0].next_cursor,100);assert.equal(pages[2].has_more,false);assert.equal(pages.flatMap(p=>p.observations).length,220);
 assert.equal(JSON.stringify(input),before);assert.throws(()=>inspect({...input,row_count:221}),/INTEGRITY/);
});
test('inspection refuses altered populations and unsafe page cursors; empty measurements remain descriptive',()=>{
 const input=snap(measurements([{subject_id:'A',value:null}]));
 assert.equal(inspect(input).methods[0].compatible,true);assert.match(inspect(input).methods[0].reason,/nenhuma estimativa/);
 for(const after of [-1,2,0.5,4001,NaN])assert.throws(()=>inspect(input,after));
 assert.throws(()=>inspect({...input,content_hash:'a'.repeat(64)}),/INTEGRITY/);
 assert.throws(()=>inspect({...input,row_count:2}),/INTEGRITY/);
});
test('right censored inspection distinguishes estimability requirements from unverified hypotheses',()=>{
 const input=snap({kind:'life',variable:{name:'Vida',unit:'h'},rows:[{subject_id:'A',duration:10,event:true},{subject_id:'B',duration:20,event:false}]});
 const check=inspect(input);assert.equal(check.counts.events,1);assert.equal(check.counts.censored,1);assert.equal(check.methods[1].compatible,true);assert.equal(check.methods[2].compatible,false);assert.match(check.methods[1].reason,/não são verificadas/);assert.match(check.methods[2].reason,/cinco falhas/);
});
test('EAM lineage carries exact frozen timestamps and does not expose raw database identifiers',()=>{
 const condition=require('../../api/services/analytics/condition-source');
 const d=condition.snapshot({name:'Bomba'},[{id:42,metric_code:'T',unit:'C',recorded_at:'2026-09-01 09:00:00',source:'manual',value:'0.000000'}],{asset_code:'B01',metric_code:'T',unit:'C',from:'2026-09-01',through:'2026-09-02'},'ORG');
 const result=inspect({version:1,dataset:d.data,content_hash:d.hash,row_count:d.rows});assert.equal(result.observations[0].value,0);assert.equal(result.observations[0].origin.recorded_at,'2026-09-01 09:00:00');assert.equal(result.observations[0].origin.source,'manual');assert(!JSON.stringify(result).includes('"id":42'));assert.match(result.grain,/leitura/);assert.equal(result.methods[1].compatible,false);
});
test('export profiles preserve types, neutralize formulas, minimize named context and bind deterministic bytes',async()=>{
 const snapshot=snap(measurements([{subject_id:'  =HYPERLINK("x")',value:-2.5},{subject_id:'B',value:0},{subject_id:'C',value:null}])),output=await run(snapshot.dataset,'descriptive/1',{});
 const pack=evidence({name:'Cliente privado',question:'Pergunta privada'},snapshot,{status:'completed',method:'descriptive/1',result:{...output,snapshot_id:snapshot.id,snapshot_hash:snapshot.content_hash,parameters:{}}});
 const csv=artifact(pack,{format:'csv',identifiers:true,delimiter:';',decimal:'comma'});assert.match(csv.content,/'=HYPERLINK/);assert.match(csv.content,/"-2,5"/);assert.match(csv.content,/"B";"0"/);assert.match(csv.content,/"C";\r\n/);assert.equal(csv.sha256,hash(csv.content));assert.equal(csv.bytes,Buffer.byteLength(csv.content));
 const minimized=artifact(pack,{format:'json-data',identifiers:false});const json=JSON.parse(minimized.content);assert.equal(json.rows[0].value,-2.5);assert.equal(json.rows[2].value,null);assert(!minimized.content.includes('subject_id'));assert(!minimized.content.includes('Cliente privado'));assert.equal(json.provenance,undefined);assert.match(minimized.warnings.join(' '),/não garante anonimização/);
 const summary=artifact(pack,{format:'json-summary',identifiers:false});assert.equal(JSON.parse(summary.content).result.mean,-1.25);assert(!summary.content.includes('snapshot_id'));assert.equal(summary.observations,0);assert.equal(artifact(pack,{format:'json-summary',identifiers:false}).sha256,summary.sha256);
 const full=artifact(pack,{format:'package',identifiers:true});assert.deepEqual(JSON.parse(full.content),JSON.parse(JSON.stringify(pack)));
 const lineage=inspectEvidence(pack);assert.equal(lineage.nodes.length,6);assert.equal(lineage.nodes.at(-1).description,'Nenhuma revisão registrada');assert.equal(lineage.nodes.find(n=>n.key==='result').details[0][1],pack.result_sha256);
});
test('export rejects arbitrary profiles, executable formats and silently minimized evidence packages',()=>{
 for(const profile of [{format:'html',identifiers:true},{format:'csv',identifiers:true,delimiter:'\n',decimal:'comma'},{format:'json-data',identifiers:false,delimiter:';'},{format:'package',identifiers:false},{format:'json-summary',identifiers:'false'},{format:'csv',identifiers:false,delimiter:',',decimal:'point',path:'../../secret'}])assert.throws(()=>artifact({},profile),e=>e.status===400);
});
