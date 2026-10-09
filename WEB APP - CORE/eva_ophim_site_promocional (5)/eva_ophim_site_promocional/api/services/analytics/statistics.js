(function (root, factory) {
 if (typeof module === 'object' && module.exports) module.exports = factory();
 else root.AsthaStatistics = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
'use strict';

// Independent implementation. No code or UI from JASP is incorporated.
const LIMIT = 20000;
function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e100;
}
function descriptive(values) {
  if (!Array.isArray(values) || values.length > LIMIT) throw new Error('Limite de observações excedido');
  if (values.some(value => value !== null && !numeric(value))) throw new Error('Valores devem ser números finitos ou null; conversões exigem revisão');
  const sorted = values.filter(value => value !== null).sort((a,b) => a-b);
  let mean=0, m2=0, count=0;
  for (const value of sorted) { count++;const delta=value-mean;mean+=delta/count;m2+=delta*(value-mean); }
  // Quantile convention: linear interpolation, type 7; sample variance ddof=1.
  const quantile=p=>{if(!count)return null;const position=(count-1)*p,index=Math.floor(position);return sorted[index]+(sorted[Math.ceil(position)]-sorted[index])*(position-index);};
  const ecdf=[];
  for(let i=0;i<count;i++){if(i+1===count||sorted[i+1]!==sorted[i])ecdf.push({value:sorted[i],probability:(i+1)/count});}
  const variance=count>1?Math.max(0,m2/(count-1)):null;
  return {
    method:'descriptive/1',total:values.length,valid:count,missing:values.length-count,
    mean:count?mean:null,median:quantile(0.5),q1:quantile(0.25),q3:quantile(0.75),
    minimum:count?sorted[0]:null,maximum:count?sorted.at(-1):null,
    variance,standard_deviation:variance===null?null:Math.sqrt(variance),
    conventions:{quantile:'linear-type-7',variance_ddof:1,missing:'null only; no imputation'},ecdf
  };
}
function kaplanMeier(observations, {unit,independent_subjects,noninformative_censoring}={}) {
  if(!['h','d','cycles'].includes(unit)||independent_subjects!==true||noninformative_censoring!==true)throw new Error('Declare unidade, independência e hipótese de censura não informativa');
  if(!Array.isArray(observations)||!observations.length||observations.length>LIMIT)throw new Error('População inválida');
  const subjects=new Set();
  for(const row of observations){
    if(!row||typeof row!=='object'||!numeric(row.duration)||row.duration<=0||typeof row.event!=='boolean'||typeof row.subject_id!=='string'||!row.subject_id||row.subject_id.length>120||Object.keys(row).some(key=>!['duration','event','subject_id'].includes(key)))throw new Error('Episódio inválido; entrada tardia, censura intervalar e covariáveis não são suportadas por este contrato');
    if(subjects.has(row.subject_id))throw new Error('Vidas repetidas por sujeito requerem outro contrato');
    subjects.add(row.subject_id);
  }
  const sorted=[...observations].sort((a,b)=>a.duration-b.duration),curve=[];
  let risk=sorted.length,survival=1,greenwood=0,events=0,median=null;
  for(let i=0;i<sorted.length;){
    const time=sorted[i].duration;let failures=0,censored=0;
    while(i<sorted.length&&sorted[i].duration===time){if(sorted[i].event)failures++;else censored++;i++;}
    if(failures){survival*=1-failures/risk;events+=failures;if(risk>failures)greenwood+=failures/(risk*(risk-failures));}
    const se=survival>0&&survival<1?survival*Math.sqrt(greenwood):null;
    // Pointwise normal approximation, not a simultaneous or prediction band.
    const ci=se===null?null:{lower:Math.max(0,survival-1.959963984540054*se),upper:Math.min(1,survival+1.959963984540054*se)};
    curve.push({time,at_risk:risk,events:failures,censored,survival,standard_error:se,confidence_interval:ci});
    if(median===null&&survival<=0.5)median=time;
    risk-=failures+censored;
  }
  return {
    method:'kaplan-meier-right/1',status:'exploratory',unit,subjects:sorted.length,events,censored:sorted.length-events,
    median,median_status:median===null?'not-reached':'estimated',curve,
    confidence:{level:0.95,method:'pointwise-normal-Greenwood',boundary_interval:'unavailable'},
    limitations:['Independência e censura não informativa são hipóteses declaradas, não verificadas pelo algoritmo.','Intervalos pontuais aproximados podem ter cobertura ruim em amostras pequenas e nas caudas.','Não suporta recorrências, entrada tardia, censura intervalar, riscos competitivos ou inferência causal.','Homologação estatística e de domínio pendente.']
  };
}
function weibull2p(observations,options={}) {
 if(options.single_population!==true)throw Error('Declare população comparável e um mecanismo de falha para Weibull.');
 const km=kaplanMeier(observations,options),failures=observations.filter(row=>row.event);
 const limitations=['Ajuste exploratório de vida, não de ocorrências repetidas de um ativo reparável.','População comparável, independência e censura não informativa são declarações; o algoritmo não as comprova.','Ajuste e AIC não demonstram adequação do modelo. Sem bandas de predição, efeitos causais ou decisão operacional automática.','IC aproximado de Wald em log-parâmetros; a cobertura não foi homologada. B10 é estimativa pontual, sem IC.'];
 const base={method:'weibull-2p-right/1',unit:options.unit,subjects:observations.length,events:failures.length,censored:km.censored,limitations};
 const unavailable=reason=>({...base,status:'not-estimable',reason,shape:null,scale:null,b10:null,confidence_interval:null,curve:[]});
 if(failures.length<5)return unavailable('São necessárias pelo menos cinco falhas neste fluxo exploratório; com poucos eventos o ajuste pode ser fortemente enviesado.');
 const logs=observations.map(row=>Math.log(row.duration)),maxLog=Math.max(...logs),centered=logs.map(value=>value-maxLog),failureMean=failures.reduce((sum,row)=>sum+(Math.log(row.duration)-maxLog),0)/failures.length;
 function score(beta){let weights=0,weighted=0;for(const value of centered){const weight=Math.exp(beta*value);weights+=weight;weighted+=weight*value;}return 1/beta+failureMean-weighted/weights;}
 let low=.001,high=1;while(score(high)>0&&high<1000)high=Math.min(1000,high*2);
 if(score(low)<=0||score(high)>=0)return unavailable('Não há solução identificável dentro do intervalo numérico de forma [0,001; 1.000].');
 let iterations=0;
 for(;iterations<100;iterations++){const middle=(low+high)/2;if(score(middle)>0)low=middle;else high=middle;if(high-low<=1e-11*Math.max(1,middle))break;}
 const shape=(low+high)/2,totalWeight=centered.reduce((sum,value)=>sum+Math.exp(shape*value),0),logScale=maxLog+(Math.log(totalWeight)-Math.log(failures.length))/shape,scale=Math.exp(logScale),b10=Math.exp(logScale+Math.log(-Math.log(.9))/shape);
 if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(b10)||b10<=0||Math.abs(score(shape))>1e-7)return unavailable('A precisão numérica não é suficiente para publicar parâmetros.');
 let weightedZ=0,weightedZ2=0;for(const value of logs){const z=value-logScale,w=Math.exp(shape*z);weightedZ+=w*z;weightedZ2+=w*z*z;}
 const d=failures.length,aa=d+shape*shape*weightedZ2,ab=-shape*shape*weightedZ,bb=shape*shape*d,det=aa*bb-ab*ab;
 let confidence_interval=null;
 if(d>=10&&det>0){const interval=(log,se)=>({lower:Math.exp(log-1.959963984540054*se),upper:Math.exp(log+1.959963984540054*se)});const candidate={level:.95,method:'log-parameter-Wald-observed-information',shape:interval(Math.log(shape),Math.sqrt(bb/det)),scale:interval(logScale,Math.sqrt(aa/det))};if([candidate.shape.lower,candidate.shape.upper,candidate.scale.lower,candidate.scale.upper].every(value=>Number.isFinite(value)&&value>0))confidence_interval=candidate;}
 if(!confidence_interval)limitations.push('IC indisponível: exige pelo menos dez falhas e informação numérica suficiente neste fluxo.');
 const failureSum=failures.reduce((sum,row)=>sum+Math.log(row.duration),0),log_likelihood=d*Math.log(shape)-d*shape*logScale+(shape-1)*failureSum-d;
 const curve=Array.from({length:81},(_,index)=>{const time=index*Math.exp(maxLog)/80;return {time,survival:time===0?1:Math.exp(-Math.exp(shape*(Math.log(time)-logScale)))};});
 return {...base,status:'exploratory',shape,scale,b10,confidence_interval,log_likelihood,aic:4-2*log_likelihood,convergence:{iterations,profile_score:score(shape),shape_bounds:[.001,1000]},curve,empirical:km.curve.map(row=>({time:row.time,survival:row.survival,at_risk:row.at_risk}))};
}
// Normal reference is a candidate for measurements, never an automatic model of life.
function normalCdf(z) {
 if(!Number.isFinite(z))throw Error('Quantil normal inválido');
 if(z===0)return .5;
 if(Math.abs(z)>=9)return z>0?1:0;
 const bound=Math.abs(z),steps=256,h=bound/steps;
 let sum=1+Math.exp(-bound*bound/2);
 for(let i=1;i<steps;i++)sum+=(i%2?4:2)*Math.exp(-((i*h)**2)/2);
 return .5+Math.sign(z)*sum*h/(3*Math.sqrt(2*Math.PI));
}
function normalQuantile(p) {
 if(!(p>0&&p<1))throw Error('Probabilidade deve estar entre zero e um');
 if(p===.5)return 0;
 let low=-9,high=9;
 for(let i=0;i<55;i++){const middle=(low+high)/2;if(normalCdf(middle)<p)low=middle;else high=middle;}
 return (low+high)/2;
}
function gaussian(values) {
 const summary=descriptive(values),sorted=values.filter(value=>value!==null).sort((a,b)=>a-b);
 const limitations=['Curva Normal candidata com média e desvio amostrais; não comprova normalidade, independência ou estabilidade do processo.','Ausentes não são imputados. O Q–Q é diagnóstico visual, sem p-valor ou aprovação automática.','Não usar medições repetidas como vidas independentes nem como previsão industrial.'];
 const base={...summary,method:'normal-reference/1',limitations,confidence_interval:null};
 const sigma=summary.standard_deviation,mean=summary.mean;
 if(sorted.length<3||!(sigma>0)||!Number.isFinite(sigma))return {...base,status:'not-estimable',reason:'São necessárias três medições válidas e dispersão positiva para comparar uma curva Normal.',histogram:[],curve:[],qq:[]};
 const count=Math.min(30,Math.ceil(Math.log2(sorted.length)+1)),width=(summary.maximum-summary.minimum)/count;
 if(!(width>0)||!Number.isFinite(width))return {...base,status:'not-estimable',reason:'A escala das medições não permite um histograma com precisão suficiente.',histogram:[],curve:[],qq:[]};
 const histogram=Array.from({length:count},(_,i)=>({from:summary.minimum+i*width,to:summary.minimum+(i+1)*width,count:0}));
 for(const value of sorted)histogram[Math.min(count-1,Math.floor((value-summary.minimum)/width))].count++;
 for(const bin of histogram)bin.density=bin.count/(sorted.length*width);
 const from=Math.min(summary.minimum,mean-4*sigma),to=Math.max(summary.maximum,mean+4*sigma);
 const curve=Array.from({length:161},(_,i)=>{const value=from+(to-from)*i/160,z=(value-mean)/sigma;return {value,density:Math.exp(-z*z/2)/(sigma*Math.sqrt(2*Math.PI))};});
 const indices=Array.from({length:Math.min(200,sorted.length)},(_,i)=>Math.round(i*(sorted.length-1)/(Math.min(200,sorted.length)-1)));
 const qq=indices.map(index=>{const probability=(index+.5)/sorted.length;return {rank:index+1,probability,theoretical:mean+sigma*normalQuantile(probability),observed:sorted[index]};});
 if([...histogram.map(bin=>bin.density),...curve.map(point=>point.density),...qq.map(point=>point.theoretical)].some(value=>!Number.isFinite(value)))return {...base,status:'not-estimable',reason:'Precisão numérica insuficiente nesta escala.',histogram:[],curve:[],qq:[]};
 return {...base,status:'exploratory',histogram,curve,qq,qq_displayed:qq.length,qq_total:sorted.length,conventions:{...summary.conventions,histogram:'equal-width Sturges, at most 30 bins; density=count/(n*width)',qq:'(rank-0.5)/n; at most 200 evenly selected order statistics',normal_quantile:'bisection of Simpson-integrated standard Normal CDF'}};
}
function ageHazard(observations,options={}) {
 const km=kaplanMeier(observations,options),bins=options.bins??6;
 if(!Number.isSafeInteger(bins)||bins<2||bins>20)throw Error('Use entre duas e vinte faixas de idade');
 const maximum=Math.max(...observations.map(row=>row.duration)),width=maximum/bins;
 if(!(width>0))throw Error('Precisão insuficiente na escala de idade');
 const bands=Array.from({length:bins},(_,i)=>{const from=width*i,to=i===bins-1?maximum:width*(i+1);let exposure=0,events=0,censored=0,at_risk=0;
  for(const row of observations){if(row.duration>from){at_risk++;exposure+=Math.min(row.duration,to)-from;}if(row.duration>from&&row.duration<=to){if(row.event)events++;else censored++;}}
  return {from,to,at_risk,events,censored,exposure,rate:exposure>0?events/exposure:null,confidence_interval:null};
 });
 if(bands.some(band=>!Number.isFinite(band.exposure)||band.rate!==null&&!Number.isFinite(band.rate)))throw Error('Precisão insuficiente na exposição');
 return {method:'age-hazard/1',status:'exploratory',unit:options.unit,subjects:km.subjects,events:km.events,censored:km.censored,bins,bands,total_exposure:bands.reduce((sum,band)=>sum+band.exposure,0),limitations:['Taxa por faixa = falhas observadas / exposição acumulada das vidas nessa faixa. Origem de idade zero declarada; sem entrada tardia ou recorrências.','Faixas são (início, fim]; exposição inclui as vidas censuradas até a retirada. Zero eventos com exposição produz taxa zero; ausência de exposição produz taxa indisponível.','Forma observada não comprova as três fases da banheira ou um mecanismo físico. Nenhuma curva em U é imposta aos dados.','Faixas, independência, população e censura precisam de revisão. IC e bandas de incerteza não implementados neste estimador exploratório.']};
}
function pareto(observations,{unit}={}) {
 if(!Array.isArray(observations)||!observations.length||observations.length>LIMIT||!['occurrences','h','BRL'].includes(unit))throw Error('Informe perdas por categoria e unidade occurrences, h ou BRL');
 const ids=new Set(),categories=new Map();
 for(const row of observations){if(!row||typeof row.subject_id!=='string'||!row.subject_id.trim()||row.subject_id.length>120||ids.has(row.subject_id)||typeof row.category!=='string'||!row.category.trim()||row.category.length>100||!numeric(row.value)||row.value<0||unit==='occurrences'&&!Number.isSafeInteger(row.value)||Object.keys(row).some(key=>!['subject_id','category','value'].includes(key)))throw Error('Registro categorizado inválido; valores ausentes/negativos não são perdas zero');ids.add(row.subject_id);const category=row.category.trim();categories.set(category,(categories.get(category)||0)+row.value);}
 if(categories.size>100)throw Error('Use até 100 categorias distintas');
 const ordered=[...categories].map(([category,value])=>({category,value})).sort((a,b)=>b.value-a.value||(a.category<b.category?-1:a.category>b.category?1:0));
 const total=ordered.reduce((sum,row)=>sum+row.value,0);let accumulated=0;
 if(!Number.isFinite(total)||unit==='occurrences'&&!Number.isSafeInteger(total))throw Error('Precisão insuficiente no total das categorias');
 const rows=ordered.map(row=>{accumulated+=row.value;return {...row,share:total>0?row.value/total:null,cumulative:total>0?accumulated/total:null};});
 return {method:'pareto/1',status:'exploratory',unit,observations:observations.length,categories:rows.length,total,rows,limitations:['Categorias e pesos são declarados na versão dos dados. Frequência, horas e custo têm significados distintos; não são convertidos automaticamente.','Frequência ou contribuição não demonstram criticidade, causa raiz ou efeito causal. Registros sobrepostos de horas não são reconciliados automaticamente.','Percentual acumulado fica indisponível quando o total é zero. Categorias empatadas seguem ordem textual determinística.']};
}
return {descriptive,kaplanMeier,weibull2p,gaussian,ageHazard,pareto,normalCdf,normalQuantile};
});
