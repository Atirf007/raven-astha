'use strict';
const spaces=require('./personal-spaces'),catalog=require('../../renderer/js/personal-catalog'),{location}=require('./personal-belongings'),{selectHighlights}=require('./operational-assistant');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const normalize=text=>String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop=new Set(('a o as os um uma uns umas de da do das dos em no na nos nas e ou para por com que qual quais onde como quando foi esta estao sao meu minha meus minhas voce eu ele ela isso esse essa esses essas perdi perdido perdida perdidos perdidas estou ta ficou deixei deixado deixada ultima ultimo ultimas ultimos vez lembro lembra achar encontrar procure procurar busque buscar pesquise pesquisar detalhe detalhar detalhes sobre item itens pertence pertences objeto objetos nao sei favor poderia pode fica ficam tem tenho temos estar guardado guardada guardados guardadas cadastrado cadastrada cadastrados cadastradas cadastro registrei registrado registrada registrados registradas mostre mostrar mostra liste listar lista tudo todos todas inventario quantidade quantos quantas quanto quanta ha existem existe contar conte mim me diga ver veja consultar consulta consegue preciso quero gostaria saber dentro cadastrei cade encontro acho localizar localizo possuem possuo possui').split(' '));
const irregular={lapis:'lapis',celulares:'celular',moveis:'movel',armarios:'armario',comodas:'comoda',prateleiras:'prateleira',gavetas:'gaveta',livros:'livro',cadernos:'caderno',brinquedos:'brinquedo',itens:'item',caixas:'caixa',computadores:'computador',notebooks:'notebook',tablets:'tablet',monitores:'monitor',chaves:'chave',canetas:'caneta',telefones:'telefone',roupas:'roupa'};
const singular=word=>Object.hasOwn(irregular,word)?irregular[word]:(word.length>4&&word.endsWith('s')?word.slice(0,-1):word);
const aliases={smartphone:'celular',telefone:'celular',laptop:'notebook',guardarroupa:'armario'};
const canonical=word=>{const value=singular(word);return Object.hasOwn(aliases,value)?aliases[value]:value;};
function validate(body){
 if(!body||typeof body.question!=='string'||!body.question.trim()||body.question.length>600||/[\u0000-\u001f]/.test(body.question)||Object.keys(body).some(key=>!['question','page'].includes(key))||(body.page!==undefined&&(!Number.isSafeInteger(body.page)||body.page<0||body.page>2000)))throw fail('Escreva uma pergunta de até 600 caracteres.');
 const q=normalize(body.question).replace(/guarda[ -]?roupas?/g,'armario');
 if(/\b(ignore|ignorar|credenciais?|tokens?|senhas?|password|cpf)\b|system.?prompt|instruc|api.?key|\b(e-?mail)\b|telefone.*(usuario|pessoa|contato)|outr[ao].*(conta|usuario|organiz)|https?:|\b(execute|executar)\b|drop\s+table/.test(q))throw fail('Posso consultar apenas seus móveis e pertences. Não acesso contas, credenciais ou dados externos.',403);
 if(/\b(apague|apagar|exclua|excluir|delete|remova|remover|mova|mover|cadastre|cadastrar|altere|alterar)\b/.test(q))throw fail('Esta conversa só consulta seus registros. Use os botões de cadastro, edição ou movimentação para alterar um item.');
 return q;
}
function question(body){return [...new Set(validate(body).match(/[a-z0-9]+/g)?.filter(word=>word.length>1&&!stop.has(word))||[])];}
function interpret(body){
 const q=validate(body),tokens=question(body).filter(word=>!['dizer','algum','alguns','alguma','algumas','cadastros'].includes(word));
 const filtering=/\b(quais|quantos?|quantas?|lista|liste|listar|mostre|mostrar|itens|pertences)\b|\bo que\b/.test(q);
 const status=!filtering?null:/\b(emprestad[oa]s?|emprestei)\b/.test(q)?'borrowed':/\bcomigo\b/.test(q)?'with-me':/\b(perdid[oa]s?|sumid[oa]s?|nao encontrad[oa]s?|nao encontro|nao acho|nao localizo)\b/.test(q)?'missing':/\bguardad[oa]s?\b/.test(q)?'stored':null;
 const history=/\b(historico|antes|anterior|anteriores|mudancas|movimentacoes)\b/.test(q);
 const count=/\b(quantos?|quantas?|quantidade|conte|contar|numero)\b/.test(q);
 const listing=/\b(quais|liste|listar|lista|mostre|mostra|mostrar|todos|todas|tenho|cadastrad[oa]s?|registrad[oa]s?|cadastrei|inventario)\b|\bo que (tem|ha|esta|tenho)\b/.test(q)||!tokens.length&&/\b(itens|pertences|objetos|moveis|cadastros)\b/.test(q);
 const help=/^(oi|ola|bom dia|boa tarde|boa noite)[!? .]*$/.test(q)||/\b(ajuda|ajudar|como funciona|o que voce faz|o que pode fazer)\b/.test(q);
 const local=/\b(na|no|nas|nos|dentro d[ao]|dentro de)\s+(.+?)(?:[?!,.]|$)/.exec(q)?.[2];
 const locationTokens=local?[...new Set((local.match(/[a-z0-9]+/g)||[]).filter(word=>word.length>1&&!stop.has(word)).map(canonical))]:[];
 const kind=/\b(moveis|mobilia|objetos 3d)\b/.test(q)?'object':/\bpertences\b/.test(q)||status||locationTokens.length?'belonging':null;
 const filtered=tokens.filter(word=>!['movel','moveis','mobilia','3d','historico','antes','anterior','anteriores','mudancas','movimentacoes','emprestado','emprestados','emprestada','emprestadas','emprestei','comigo','sumido','sumidos','sumida','sumidas','encontrado','encontrada','encontrados','encontradas','numero','ajuda','ajudar'].includes(word));
 const contentTokens=[...new Set(filtered.map(canonical))].filter(word=>!locationTokens.includes(word));
 return {intent:help?'help':count?'count':history?'history':listing||status?'list':'find',tokens:contentTokens,locationTokens,status,kind,page:body.page||0};
}
function words(value){return normalize(value).replace(/guarda[ -]?roupas?/g,'armario').match(/[a-z0-9]+/g)?.map(canonical)||[];}
function contains(value,token){const term=canonical(token);return words(value).some(word=>word===term||(term.length>=4&&word.startsWith(term)));}
function score(tokens,space,item){const title=item.name,search=[item.name,item.description,item.tags,space.name,catalog.byId[item.modelId]?.name,catalog.byId[item.modelId]?.category,...(item.history||[]).flatMap(e=>[e.location?.space,e.location?.object,e.location?.compartment])].join(' ');return tokens.reduce((total,word)=>total+(contains(title,word)?4:contains(search,word)?1:0),0);}
function records(rooms){return rooms.flatMap(space=>[
 ...space.objects.map(object=>({space,item:{id:object.id,modelId:object.modelId,name:object.name,quantity:object.quantity,status:'stored',description:`${object.width} × ${object.depth} × ${object.height} m`,objectId:object.id,history:[],lastConfirmedAt:null},kind:'object',location:{space:space.name,object:object.name,compartment:null},containedCount:(space.belongings||[]).filter(i=>i.objectId===object.id).length})),
 ...(space.belongings||[]).map(item=>({space,item,kind:'belonging',location:location(space,item)}))
 ]);}
function matches(record,scope){
 if(scope.kind&&record.kind!==scope.kind||scope.status&&(record.kind!=='belonging'||record.item.status!==scope.status))return false;
 const currentPlace=[record.location.space,record.location.object,record.location.compartment].join(' '),pastPlace=scope.intent==='history'?(record.item.history||[]).flatMap(e=>[e.location?.space,e.location?.object,e.location?.compartment,e.from?.space,e.from?.object,e.from?.compartment]).join(' '):'';
 return scope.locationTokens.every(token=>contains(currentPlace+' '+pastPlace,token));
}
const totals=entries=>({records:entries.length,units:entries.reduce((n,r)=>n+r.item.quantity,0),belongings:entries.filter(r=>r.kind==='belonging').length,objects:entries.filter(r=>r.kind==='object').length,missing:entries.filter(r=>r.kind==='belonging'&&r.item.status==='missing').length,archived:entries.filter(r=>r.space.archived).length});
const quantity=(n,singular,plural)=>`${n} ${n===1?singular:plural}`;
function message(scope,summary,partial){
 if(!summary.records){if(scope.status==='missing')return 'Você não marcou nenhum pertence como não encontrado neste filtro.';return scope.intent==='find'||scope.tokens.length||scope.locationTokens.length?'Não encontrei um registro correspondente. Tente o nome, uma característica ou outro local do item.':'Você ainda não tem itens registrados neste filtro. Cadastre um pertence dentro de um móvel ou adicione um objeto ao seu espaço 3D.';}
 const groups=[summary.belongings&&quantity(summary.belongings,'pertence','pertences'),summary.objects&&quantity(summary.objects,'móvel ou objeto 3D','móveis ou objetos 3D')].filter(Boolean).join(' e ');
 if(partial)return 'Não encontrei uma correspondência exata. Estes registros podem ajudar; confira os nomes e os locais antes de concluir.';
 if(scope.intent==='count')return `Você tem ${quantity(summary.units,'unidade','unidades')} em ${quantity(summary.records,'cadastro','cadastros')} neste filtro. ${groups}.`;
 if(scope.intent==='history')return summary.belongings?`Encontrei ${quantity(summary.records,'registro','registros')}. Veja as últimas mudanças de local em cada pertence.`:`Encontrei ${quantity(summary.records,'objeto 3D com seu local atual','objetos 3D com seus locais atuais')}. Ainda não há histórico individual de localização para esses objetos.`;
 if(scope.intent==='find')return `Encontrei ${quantity(summary.records,'registro correspondente','registros correspondentes')}. Veja o local registrado e a última confirmação abaixo.`;
 return `Você tem ${quantity(summary.records,'item cadastrado','itens cadastrados')}: ${groups}.${summary.units!==summary.records?' No total, '+quantity(summary.units,'unidade','unidades')+'.':''}`;
}
async function answer(db,user,body,options){
 const scope=interpret(body);
 if(scope.intent==='help')return {intent:'help',results:[],summary:totals([]),total:0,page:0,pages:0,limited:false,mode:'local',notice:'Posso listar seus itens, contar cadastros, localizar pertences e consultar as últimas mudanças de local.',message:'Experimente: “Quais são meus itens cadastrados?”, “Quantos livros tenho?” ou “O que está no armário?”.'};
 if(scope.intent==='find'&&!scope.tokens.length&&!scope.locationTokens.length)throw fail('Diga o nome ou uma característica do item, ou pergunte “Quais são meus itens cadastrados?”.');
 const rooms=await spaces.list(db,user),entries=records(rooms),scoped=entries.filter(record=>matches(record,scope)),ranked=scoped.map(record=>({...record,score:scope.tokens.length?score(scope.tokens,record.space,record.item):1}));
 const exact=scope.tokens.length?ranked.filter(record=>scope.tokens.every(token=>score([token],record.space,record.item)>0)):ranked;
 const partial=scope.intent==='find'&&scope.tokens.length>0&&!exact.length;
 const matched=(partial?ranked.filter(record=>record.score>0):exact).sort((a,b)=>b.score-a.score||(b.item.lastConfirmedAt||'').localeCompare(a.item.lastConfirmedAt||'')||a.item.name.localeCompare(b.item.name,'pt-BR')||a.space.id-b.space.id||a.item.id.localeCompare(b.item.id));
 const summary=totals(matched),pages=Math.ceil(matched.length/20),page=Math.min(scope.page,Math.max(0,pages-1)),candidates=matched.slice(page*20,(page+1)*20);
 // No question, names, locations or history leave ASTHA. Listing and counting do not call the provider.
 const ai=scope.intent==='find'&&candidates.length?await selectHighlights({intent:'personal_finder'},{sources:candidates.map((record,i)=>({ref:i+1,quantity:record.score}))},options):{refs:[],mode:'local'};
 const highlight=new Set(ai.refs),results=candidates.map(({space,item,kind,location:place,containedCount,score},i)=>({ref:i+1,highlighted:highlight.has(i+1),spaceId:space.id,spaceName:space.name,archived:space.archived,...item,kind,containedCount,category:catalog.byId[item.modelId]?.category||null,score,photo:undefined,location:place,history:(item.history||[]).slice(-10).reverse()}));
 return {intent:scope.intent,results,summary,total:matched.length,page,pages,limited:matched.length>(page+1)*20,partial:!!partial,mode:ai.mode,notice:message(scope,summary,partial),message:scope.intent==='find'||scope.intent==='history'?'Os locais e datas vêm dos seus registros. A busca não rastreia objetos físicos.':summary.archived?`${summary.archived} registro(s) estão em espaços arquivados, identificados na lista.`:'Os dados abaixo pertencem ao seu espaço pessoal.'};
}
module.exports={question,interpret,score,records,answer};
