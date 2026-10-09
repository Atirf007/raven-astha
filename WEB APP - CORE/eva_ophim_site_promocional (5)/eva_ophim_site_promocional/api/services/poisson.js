function poissonForecast(failures, exposureHours, horizonHours, confidence=0.95){
  if(!Number.isSafeInteger(failures)||failures<0||failures>1000000||![exposureHours,horizonHours].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=876000)||typeof confidence!=='number'||confidence<0.5||confidence>0.999)throw Error('Parâmetros estatísticos inválidos');
  if(!failures)return {supported:false,reason:'Sem falhas observadas; não há evidência suficiente para estimar a taxa.'};
  const rate=failures/exposureHours,lambda=rate*horizonHours;
  if(lambda>500)return {supported:false,reason:'Horizonte excede o limite de cálculo; reduza o período.'};
  let probability=Math.exp(-lambda),cumulative=probability,count=0;
  while(cumulative<confidence&&count<2000){count++;probability*=lambda/count;cumulative+=probability;}
  return {supported:true,failure_rate_per_hour:rate,expected_failures:lambda,probability_at_least_one:-Math.expm1(-lambda),coverage_count:count,confidence,assumption:'Falhas independentes, taxa constante e exposição representativa; estimativa não homologada com dados operacionais.'};
}
module.exports={poissonForecast};
