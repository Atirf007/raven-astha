(() => {
 'use strict';
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 function compare(host,before,after){
  const a=before.dataset,b=after.dataset;if(a.kind!==b.kind||a.variable.unit!==b.variable.unit||a.variable.name!==b.variable.name){host.append(make('p','Curvas não sobrepostas: tipo, variável ou unidade diferentes. Não há conversão automática.'));return;}
  host.append(make('h3','Comparação visual das versões'),make('p','Prévia calculada localmente sobre duas versões preservadas. Sobreposição não é teste de diferença, previsão ou alteração de uma execução.'));
  const output=make('div');host.append(output);const labels=['Versão '+before.version,'Versão '+after.version];
  function render(){output.replaceChildren();const rows=[a,b].flatMap((data,i)=>data.rows.map(row=>({...row,subject_id:labels[i]+' · '+row.subject_id,comparison_version:i}))),combined={kind:a.kind,variable:a.variable,rows,comparison:labels};AnalyticsExplore.begin(output,combined);
   if(a.kind==='measurements'){
    const summaries=[a,b].map(data=>AsthaStatistics.descriptive(data.rows.map(row=>row.value)));
    AnalyticsCharts.plot(output,'Distribuições acumuladas · versões',{points:summaries.map((result,i)=>result.valid?[{x:result.minimum,y:0,predicate:item=>item.comparison_version===i&&item.value===result.minimum},...result.ecdf.map(row=>({x:row.value,y:row.probability,predicate:item=>item.comparison_version===i&&item.value===row.value}))]:[]),percent:true,step:true,seriesLabels:labels,xLabel:a.variable.unit,yLabel:'Fração acumulada'});
    const fits=[a,b].map(data=>AsthaStatistics.gaussian(data.rows.map(row=>row.value)));
    AnalyticsCharts.plot(output,'Gauss candidata · versões',{points:fits.map((result,i)=>(result.curve||[]).map(row=>({x:row.value,y:row.density,predicate:item=>item.comparison_version===i&&item.value!==null&&Math.abs(item.value-row.value)<=Math.max(Number.EPSILON,result.standard_deviation/20)}))),seriesLabels:labels,xLabel:a.variable.unit,yLabel:'Densidade · 1/'+a.variable.unit});
    fits.forEach((result,i)=>{if(result.status==='not-estimable')output.append(make('p',labels[i]+': '+result.reason));});
   }else if(a.kind==='categories'){
    const results=[a,b].map(data=>AsthaStatistics.pareto(data.rows,{unit:a.variable.unit})),categories=[...new Set(results.flatMap(result=>result.rows.map(row=>row.category)))].sort();
    AnalyticsCharts.plot(output,'Contribuição por categoria · versões',{points:results.map((result,i)=>categories.map((category,x)=>({x:x+1,label:labels[i]+' · '+category,y:result.rows.find(row=>row.category===category)?.value||0,predicate:item=>item.comparison_version===i&&item.category===category}))),seriesLabels:labels,xLabel:'Categoria (posição na lista abaixo)',yLabel:a.variable.unit});categories.forEach((category,i)=>output.append(make('p',(i+1)+': '+category)));output.append(make('p','Zero representa categoria ausente nesta versão; não é imputação de observação.'));
   }else{
    const results=[a,b].map(data=>AsthaStatistics.kaplanMeier(data.rows,{unit:a.variable.unit,independent_subjects:true,noninformative_censoring:true}));
    AnalyticsCharts.plot(output,'Sobrevivência Kaplan–Meier · versões',{points:results.map((result,i)=>[{x:0,y:1,predicate:item=>item.comparison_version===i},...result.curve.map(row=>({x:row.time,y:row.survival,predicate:item=>item.comparison_version===i&&item.duration===row.time}))]),percent:true,step:true,seriesLabels:labels,xLabel:a.variable.unit,yLabel:'Probabilidade de sobreviver'});
    output.append(make('p','Uma comparação visual não estabelece independência entre versões nem calcula significância estatística.'));
   }
   AnalyticsExplore.panel(output);
  }
  if(a.kind!=='life'){render();return;}
  const independent=make('input'),censoring=make('input');independent.type=censoring.type='checkbox';for(const [input,label] of [[independent,'Os sujeitos de cada versão são independentes.'],[censoring,'A censura não informativa é justificável em ambas as versões.']]){const wrapper=make('label');wrapper.className='analytics-check';wrapper.append(input,make('span',label));host.insertBefore(wrapper,output);}
  const run=make('button','Desenhar comparação de sobrevivência');run.type='button';host.insertBefore(run,output);run.onclick=()=>{if(!independent.checked||!censoring.checked){output.replaceChildren(make('p','Declare as hipóteses para comparar as curvas.'));return;}try{render();}catch(error){output.replaceChildren(make('p',error.message));}};
  for(const checkbox of [independent,censoring])checkbox.onchange=()=>output.replaceChildren();
 }
 window.AnalyticsCurves={compare};
})();
