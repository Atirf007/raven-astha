(() => {
 'use strict';
 const $=id=>document.getElementById(id),make=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 let generation=0,jobId=null,confirmed=null,busy=false;
 function selected(){const f=$('artifactForm'),format=f.elements.format.value;return{format,identifiers:f.elements.identifiers.checked,...(format==='csv'?{delimiter:f.elements.delimiter.value,decimal:f.elements.decimal.value}:{})};}
 function invalidate(){generation++;confirmed=null;$('downloadArtifact').disabled=true;$('artifactPreview').replaceChildren();$('artifactForm').querySelector('[data-feedback]').textContent='';}
 function sync(){const f=$('artifactForm'),csv=f.elements.format.value==='csv',pack=f.elements.format.value==='package';$('artifactCsvOptions').hidden=!csv;f.elements.identifiers.disabled=pack;if(pack)f.elements.identifiers.checked=true;invalidate();}
 function controls(disabled){busy=disabled;const f=$('artifactForm');f.querySelectorAll('input,select,[type=submit]').forEach(el=>el.disabled=disabled);if(!disabled)f.elements.identifiers.disabled=f.elements.format.value==='package';$('downloadArtifact').disabled=disabled||!confirmed;}
 window.AnalyticsArtifacts={open:id=>{const dialog=$('artifactDialog');jobId=id;generation++;busy=false;$('artifactForm').reset();controls(false);sync();dialog.returnFocus=document.activeElement;dialog.showModal();}};
 document.addEventListener('DOMContentLoaded',()=>{
  const f=$('artifactForm'),dialog=$('artifactDialog');f.addEventListener('change',sync);dialog.addEventListener('close',()=>{generation++;jobId=null;confirmed=null;});
  f.addEventListener('submit',async event=>{event.preventDefault();if(busy||!jobId)return;invalidate();const g=generation,id=jobId,profile=selected();controls(true);
   try{const response=await API.post(`/analytics/jobs/${encodeURIComponent(id)}/artifacts`,{profile,preview:true});if(g!==generation||!dialog.open)return;if(!response.success){f.querySelector('[data-feedback]').textContent=response.error;return;}
    confirmed={profile,sha256:response.data.sha256};const data=response.data,out=$('artifactPreview');out.replaceChildren(make('h3','Confira o arquivo'),make('p',`${data.filename} · ${data.bytes.toLocaleString('pt-BR')} bytes · versão ${data.version}`),make('p',`${data.variable.name} · ${data.variable.unit} · ${data.observations} observações exportadas`));data.warnings.forEach(text=>out.append(make('p',text)));const pre=make('pre',data.preview);pre.className='analytics-export-preview';out.append(pre);f.querySelector('[data-feedback]').textContent='Prévia preparada. Confira o conteúdo antes de baixar; o download verifica novamente sua autorização.';
   }catch{if(g===generation)f.querySelector('[data-feedback]').textContent='Não foi possível preparar a exportação.';}finally{if(g===generation)controls(false);}
  });
  $('downloadArtifact').addEventListener('click',async()=>{if(busy||!confirmed||!jobId)return;const g=generation,id=jobId,check=confirmed;controls(true);
   try{const response=await API.post(`/analytics/jobs/${encodeURIComponent(id)}/artifacts`,{profile:check.profile,preview:false,expected_sha256:check.sha256});if(g!==generation||!dialog.open)return;if(!response.success){confirmed=null;f.querySelector('[data-feedback]').textContent=response.error;return;}const data=response.data;if(data.sha256!==check.sha256){confirmed=null;f.querySelector('[data-feedback]').textContent='Conteúdo divergente da prévia. Confira novamente.';return;}
    const url=URL.createObjectURL(new Blob([data.content],{type:data.mime})),link=make('a');link.href=url;link.download=data.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);f.querySelector('[data-feedback]').textContent='Arquivo preparado para download.';
   }catch{if(g===generation)f.querySelector('[data-feedback]').textContent='Falha no download. Tente novamente.';}finally{if(g===generation)controls(false);}
  });
 });
})();
