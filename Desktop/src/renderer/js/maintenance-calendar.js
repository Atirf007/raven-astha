(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MaintenanceCalendar=api;})(typeof globalThis==='object'?globalThis:this,function(){
  const day=value=>String(value||'').slice(0,10);
  const add=(value,days)=>{const date=new Date(day(value)+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
  function validate(value){
    if(value==null)return null;
    if(typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.weekdays)||!value.weekdays.length||value.weekdays.length>7||value.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(value.weekdays).size!==value.weekdays.length)throw Error('Selecione dias de trabalho válidos');
    const holidays=value.holidays||[];
    if(!Array.isArray(holidays)||holidays.length>366||holidays.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))throw Error('Datas de exceção inválidas');
    const time=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    if(!time(value.start)||!time(value.end)||value.start>=value.end)throw Error('Turno deve terminar após o início, no mesmo dia');
    return {weekdays:[...value.weekdays],holidays:[...new Set(holidays)],start:value.start,end:value.end};
  }
  const working=(date,calendar)=>!calendar||(calendar.weekdays.includes(new Date(day(date)+'T12:00:00Z').getUTCDay())&&!calendar.holidays.includes(day(date)));
  function nextWorking(date,calendar){for(let n=0;n<374;n++,date=add(date,1))if(working(date,calendar))return day(date);throw Error('Nenhum dia de trabalho disponível');}
  function parse(value){return typeof value==='string'?validate(JSON.parse(value)):validate(value);}
  return {validate,working,nextWorking,parse,add};
});
