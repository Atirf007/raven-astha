'use strict';
const {restore,invalid}=require('./datasets');

// This inspects the frozen population. It does not infer independence, identity,
// clock conversions or a statistical approval from a valid input contract.
function inspect(snapshot,after=0){
 if(!Number.isSafeInteger(after)||after<0||after>4000)invalid('Página de observações inválida.');
 const normalized=restore(typeof snapshot.dataset==='string'?JSON.parse(snapshot.dataset):snapshot.dataset);
 if(normalized.hash!==snapshot.content_hash||normalized.rows!==snapshot.row_count)throw Error('SNAPSHOT_INTEGRITY');
 const data=normalized.data,life=data.kind==='life',internal=data.source==='application-condition';
 if(after>data.rows.length)invalid('Página fora da população.');
 const valid=life?data.rows.length:data.rows.filter(row=>row.value!==null).length;
 const events=life?data.rows.filter(row=>row.event).length:null;
 const counts={total:data.rows.length,valid,missing:data.rows.length-valid,zero:life?0:data.rows.filter(row=>row.value===0).length,events,censored:life?data.rows.length-events:null};
 const methods=[
  {id:'descriptive/1',label:'Estatística descritiva',compatible:data.kind==='measurements',reason:data.kind!=='measurements'?'Exige medições, não vidas censuradas.':valid?'Resumo de valores observados; ausentes permanecem ausentes.':'Somente contagem de ausentes; nenhuma estimativa numérica disponível.'},
  {id:'kaplan-meier-right/1',label:'Kaplan–Meier',compatible:life,reason:life?'Exige declaração de independência e censura não informativa; essas hipóteses não são verificadas por este diagnóstico.':'Exige vidas independentes com evento/censura explícitos; leituras não são convertidas em vidas.'},
  {id:'weibull-2p-right/1',label:'Weibull 2P',compatible:life&&events>=5,reason:!life?'Exige vidas censuradas de população comparável.':events<5?'O motor exige pelo menos cinco falhas; não há ajuste estimável neste conjunto.':'Exige independência, censura não informativa e população comparável; a execução ainda pode recusar precisão numérica insuficiente.'},
  {id:'normal-reference/1',label:'Histograma e Gauss',compatible:data.kind==='measurements',reason:'Comparação exploratória; não comprova normalidade.'},
  {id:'age-hazard/1',label:'Taxa de falha por idade',compatible:life,reason:'Falhas / exposição por faixa; não impõe curva de banheira.'},
  {id:'pareto/1',label:'Pareto',compatible:data.kind==='categories',reason:'Categorias explícitas; contagens, horas ou custos na mesma unidade.'}
 ];
 const source=internal?{title:'Leituras EAM',description:`${data.provenance.asset_code} · ${data.provenance.asset_name}`,details:[['Métrica',data.provenance.metric_code],['Unidade',data.provenance.unit],['Período',`${data.provenance.from} a ${data.provenance.through}`],['Relógio','Data/hora armazenada no banco; fuso não convertido']]}:data.source==='file-import'?{title:'Arquivo externo',description:data.provenance.origin,details:[['Formato',data.provenance.format],['SHA-256 original',data.provenance.raw_sha256],['Parser',data.provenance.parser.image],['Mapeamento',JSON.stringify(data.provenance.mapping)]]}:{title:'Digitação no estudo',description:'Observações fornecidas manualmente; sem vínculo operacional confirmado.',details:[['Instrumento e relógio','Não registrados neste contrato de entrada']]};
 const grain=internal?'Uma linha por leitura de condição':life?'Uma linha por vida declarada independente':'Uma linha por observação identificada';
 const nodes=[
  {key:'source',title:source.title,description:source.description,details:source.details},
  {key:'contract',title:'Representação tipada',description:grain,details:[['Variável',data.variable.name],['Unidade',data.variable.unit],['Ausentes',String(counts.missing)],['Zero medido',String(counts.zero)]]},
  {key:'snapshot',title:`Versão ${snapshot.version}`,description:`${counts.total} observações preservadas`,details:[['SHA-256',normalized.hash],['Publicação',snapshot.created_at||'Data não disponível']]}
 ];
 return {schema:'astha-inspection/1',version:snapshot.version,sha256:normalized.hash,variable:data.variable,kind:data.kind,source:data.source,grain,counts,methods,nodes,edges:[{from:'source',to:'contract',label:'Tipagem'},{from:'contract',to:'snapshot',label:'Publicação'}],observations:data.rows.slice(after,after+100).map((row,index)=>({...row,...(internal?{origin:data.provenance.records[after+index]}:{})})),has_more:after+100<data.rows.length,next_cursor:after+100<data.rows.length?after+100:null,limitations:['Inspeção do snapshot publicado; não consulta nem altera a fonte operacional atual.','Contrato válido não comprova independência, ausência de viés ou adequação científica.','Não excluir valores atípicos automaticamente. Não impor treino/teste a análises descritivas.']};
}
function inspectEvidence(pack,after=0){
 const result=inspect({version:pack.snapshot.version,dataset:pack.snapshot.dataset,content_hash:pack.snapshot.sha256,row_count:pack.snapshot.dataset.rows.length},after);
 result.nodes.push(
  {key:'recipe',title:'Receita executada',description:pack.recipe.method,details:[['Hipóteses declaradas',JSON.stringify(pack.recipe.parameters)],['Motor',pack.recipe.engine.id],['Runtime',pack.recipe.engine.node],['Arquivos do motor',JSON.stringify(pack.recipe.engine.files)]]},
  {key:'result',title:'Resultado congelado',description:'Saída da execução; não representa autorização operacional.',details:[['SHA-256 do resultado',pack.result_sha256],['SHA-256 do pacote',pack.manifest.payload_sha256]]},
  {key:'review',title:'Revisão documental',description:pack.reviews.length?`${pack.reviews.length} revisões registradas`:'Nenhuma revisão registrada',details:pack.reviews.length?pack.reviews.map(review=>[`${review.reviewer} · ${review.decision==='accepted'?'Aceita':'Rejeitada'}`,review.note]):[['Estado','Sem revisão; não há aprovação inferida']]}
 );
 result.edges.push({from:'snapshot',to:'recipe',label:'Dados utilizados'},{from:'recipe',to:'result',label:'Execução concluída'},{from:'result',to:'review',label:'Revisão'});
 return result;
}
module.exports={inspect,inspectEvidence};
