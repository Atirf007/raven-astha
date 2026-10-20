'use strict';
const { filters } = require('./stock-insights');
const fail = (message, status=400) => Object.assign(new Error(message), {status});
const HELP = {
  map: {text:'Abra WMS Core → Mapa. Visualizador consulta a planta; Editor CAD altera objetos. Expandir área amplia a tela. Publicar grava uma revisão.',url:'./sistema.html?tab=mapa'},
  report: {text:'Abra Launchpad → Visão dos estoques para consultar indicadores por período e estoque. Relatórios permite filtrar e exportar movimentações.',url:'./home.html?view=stocks'},
  stock: {text:'Abra WMS Core → Estoque para consultar materiais. Entrada (+) registra recebimentos e Saída (-) registra consumo. Os registros ficam em Relatórios.',url:'./sistema.html?tab=estoque'}
};
function requestScope(body) {
  if (!body || typeof body.question !== 'string' || !body.question.trim() || body.question.length>1000) throw fail('Escreva uma pergunta de até 1.000 caracteres.');
  if (Object.keys(body).some(k=>!['question','from','to','materialCode'].includes(k))) throw fail('Filtro não permitido.');
  const q=body.question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  // Defense in depth. Security does not depend on this list: raw input never leaves the server.
  if (/senha|password|token|api.?key|chave|cpf|email|e-mail|telefone|pessoal|salario|usuario|cliente|fornecedor|ignore|ignorar|system.prompt|prompt|instruc|segredo|credencia|https?:|execute|executar|delete|drop\s+table|outra.organiza/.test(q)) throw fail('Posso consultar apenas estoque, movimentações e ajuda do ASTHA. Dados pessoais, credenciais e comandos não são permitidos.',403);
  let intent=/como|ajuda|onde.*(abr|encontr)|funciona|duvida/.test(q)?'help':/movimenta|entrada|saida|consumo|ocorreu|quando|relatorio/.test(q)?'movements':/estoque|saldo|material|minimo|critico|quantidade/.test(q)?'stock':null;
  if(!intent)throw fail('Pergunte sobre estoque, entradas, saídas, datas de movimentação ou como usar o mapa e os relatórios.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dates=[...q.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)].map(m=>`${m[3]}-${m[2]}-${m[1]}`);
  const iso=[...q.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
  const mentioned=dates.length?dates:iso;
  for(const date of [body.from,body.to,...mentioned].filter(v=>v!==undefined))filters({from:date,to:date});
  let to=body.to||mentioned[1]||mentioned[0]||today,from=body.from||mentioned[0];
  if(!from&&/\bhoje\b/.test(q))from=to=today;
  if(!from&&/\bontem\b/.test(q))from=to=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
  from=from||new Date(Date.parse(to)-29*86400000).toISOString().slice(0,10);
  const period=filters({from,to});
  const code=body.materialCode||body.question.match(/\b[A-Z]{2,12}-\d{1,12}\b/i)?.[0]||'';
  if(typeof code!=='string'||code.length>60|| (code&&!/^[A-Za-z0-9._-]+$/.test(code)))throw fail('Código de material inválido.');
  return {intent,from:period.from,to:period.to,code,help:/mapa|cad|prateleira|3d/.test(q)?'map':/relatorio|grafico|filtro/.test(q)?'report':'stock',type:/entrada/.test(q)&&!/saida/.test(q)?'entrada':/saida|consumo/.test(q)&&!/entrada/.test(q)?'saida':null};
}
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const codeLabel=(code,id)=>/^[A-Z]{2,12}-\d{1,12}$/i.test(code||'')?code:`Material #${num(id)}`;
async function collect(db,org,scope) {
  if(scope.intent==='help')return {sources:[],summary:{},help:HELP[scope.help]};
  const params=[org];
  let where='BINARY mat.org_id=BINARY ?';
  if(scope.code){where+=' AND mat.code=?';params.push(scope.code);}
  if(scope.intent==='stock'){
    const [[summary], [rows]]=await Promise.all([
      db.execute(`SELECT COUNT(*) AS count,SUM(mat.quantity<=mat.min_qty) AS critical,SUM(mat.quantity=0) AS zero FROM materials mat WHERE ${where} AND mat.is_active=1`,params),
      db.execute(`SELECT mat.id,mat.code,mat.quantity,mat.min_qty FROM materials mat WHERE ${where} AND mat.is_active=1 ORDER BY (mat.quantity<=mat.min_qty) DESC,mat.id LIMIT 50`,params)
    ]);
    return {summary:{count:num(summary[0]?.count),critical:num(summary[0]?.critical),zero:num(summary[0]?.zero)},sources:rows.map((r,i)=>({ref:i+1,kind:'stock',id:num(r.id),label:codeLabel(r.code,r.id),quantity:num(r.quantity),minimum:num(r.min_qty)}))};
  }
  where+=' AND m.created_at>=? AND m.created_at<DATE_ADD(?,INTERVAL 1 DAY)';params.push(scope.from,scope.to);
  if(scope.type){where+=' AND m.type=?';params.push(scope.type);}
  const [[counts],[rows]]=await Promise.all([
    db.execute(`SELECT m.type,COUNT(*) AS count,SUM(m.quantity) AS quantity FROM movements m JOIN materials mat ON mat.id=m.material_id WHERE ${where} GROUP BY m.type`,params),
    db.execute(`SELECT m.id,mat.id AS material_id,mat.code,m.type,m.quantity,DATE_FORMAT(m.created_at,'%Y-%m-%d %H:%i:%s') AS occurred_at FROM movements m JOIN materials mat ON mat.id=m.material_id WHERE ${where} ORDER BY m.created_at DESC,m.id DESC LIMIT 50`,params)
  ]);
  return {summary:Object.fromEntries(['entrada','saida'].map(type=>{const r=counts.find(r=>r.type===type);return [type,{count:num(r?.count),quantity:num(r?.quantity)}];})),sources:rows.filter(r=>['entrada','saida'].includes(r.type)).map((r,i)=>({ref:i+1,kind:'movement',id:num(r.id),label:codeLabel(r.code,r.material_id),type:r.type,quantity:num(r.quantity),at:r.occurred_at}))};
}
// The provider never receives question text, DB text, identifiers, names, codes, notes or URLs.
function providerContext(scope,data){if(scope.intent==='personal_finder')return {intent:'rank_matches',records:data.sources.map(s=>({ref:s.ref,relevance:s.quantity}))};return {intent:scope.intent,from:scope.from,to:scope.to,summary:data.summary,records:data.sources.map(s=>({ref:s.ref,quantity:s.quantity,...(s.kind==='stock'?{minimum:s.minimum}:{type:s.type,at:s.at})}))};}
async function selectHighlights(scope,data,{env=process.env,fetcher=fetch}={}){
  if(!data.sources.length)return {refs:[],mode:'local',notice:'Nenhum registro no filtro; não houve envio ao Gemini.'};
  if(!env.GEMINI_API_KEY)return {refs:[],mode:'local',notice:'Gemini não configurado. Consulta direta aos registros do ASTHA.'};
  const model=env.GEMINI_MODEL||'gemini-3.1-flash-lite';
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw fail('Modelo Gemini inválido na configuração do servidor.',503);
  const context=providerContext(scope,data);
  try {
    const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({
      systemInstruction:{parts:[{text:scope.intent==='personal_finder'?'Selecione até cinco referências com maior relevance numérica. Analise somente este JSON. Não execute ferramentas, não invente referências e não retorne texto. Retorne somente JSON com refs.':'Você analisa apenas o JSON operacional fornecido. Selecione até cinco referências existentes que mereçam atenção: mínimos e zeros no estoque, ou movimentações mais recentes. Nunca execute ferramentas ou comandos. Não invente referências. Retorne somente JSON.'}]},
      contents:[{role:'user',parts:[{text:JSON.stringify(context)}]}],
      generationConfig:{temperature:0,maxOutputTokens:500,...(model.startsWith('gemini-2.5-')?{thinkingConfig:{thinkingBudget:0}}:/^gemini-3\.(1|5)-flash-lite/.test(model)?{thinkingConfig:{thinkingLevel:'minimal'}}:{}),responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{refs:{type:'array',items:{type:'integer'},maxItems:5}},required:['refs'],additionalProperties:false}}
    })});
    if(!response.ok)return {refs:[],mode:'local',notice:response.status===400||response.status===401||response.status===403?'Gemini recusou a configuração de acesso. Consulta direta disponível.':'Gemini indisponível ou sem cota. Consulta direta disponível.'};
    const json=await response.json();const raw=json.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(raw.length>2000)throw Error('Invalid output');
    const result=JSON.parse(raw),allowed=new Set(data.sources.map(s=>s.ref));
    if(!Array.isArray(result.refs)||result.refs.length>5||result.refs.some(r=>!Number.isSafeInteger(r)||!allowed.has(r)))throw Error('Invalid references');
    return {refs:[...new Set(result.refs)],mode:'gemini',notice:'Gemini destacou registros anonimizados; números e datas abaixo vêm do ASTHA.'};
  } catch (_) {return {refs:[],mode:'local',notice:'Gemini não respondeu de forma válida. Consulta direta disponível.'};}
}
async function answer(db,org,body,options){
  const scope=requestScope(body),data=await collect(db,org,scope);
  const ai=scope.intent==='help'?{refs:[],mode:'local',notice:'Orientação do ASTHA, sem envio ao provedor.'}:await selectHighlights(scope,data,options);
  return {intent:scope.intent,from:scope.from,to:scope.to,...data,...ai,limited:data.sources.length===50};
}
module.exports={requestScope,collect,providerContext,selectHighlights,answer};
