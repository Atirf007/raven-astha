(() => {
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  const labels={draft:'Pendente',approved:'Aprovada',rejected:'Rejeitada',fulfilled:'Saldo consumido',revoked:'Saldo revogado'};
  function decision(orderId,item,status){
    const dialog=node('dialog',null,'eam-ux-dialog'),header=node('header'),heading=node('h3',status==='approved'?'Aprovar quantidade':'Revogar saldo autorizado'),close=node('button','×','eam-ux-close');
    close.type='button';close.setAttribute('aria-label','Fechar janela');close.onclick=()=>dialog.close();header.append(heading,close);
    const form=node('form',null,'eo-form-grid'),info=node('p',`${item.code} — ${item.description}`),label=node('label',status==='approved'?'Quantidade adicional autorizada':'Motivo da revogação'),field=node('input',null,'eo-input'),message=node('p');message.setAttribute('role','status');
    if(status==='approved'){field.type='number';field.min='0.001';field.step='0.001';field.max=String(Number(item.requested_quantity)-Number(item.issued_quantity));field.value=field.max;}else{field.maxLength=300;}
    field.required=true;label.append(field);const submit=node('button',status==='approved'?'Aprovar':'Revogar saldo','btn btn-primary');submit.type='submit';form.append(info,label,message,submit);dialog.append(header,form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
    form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;const body={status};if(status==='approved')body.approved_quantity=Number(field.value);else body.reason=field.value.trim();const result=await API.request(`/eam/work-orders/${Number(orderId)}/material-requests/${Number(item.material_id)}`,{method:'PATCH',body:JSON.stringify(body)});submit.disabled=false;if(!result.success){message.textContent=result.error||'Não foi possível registrar a decisão';return;}dialog.close();loadEamMaterialRequests(orderId);};
    dialog.showModal();field.focus();
  }
  window.loadEamMaterialRequests=async orderId=>{
    const target=document.getElementById('eamMaterialRequests');if(!target)return;
    const result=await API.get(`/eam/work-orders/${Number(orderId)}/material-requests`);if(!result.success){target.textContent=result.error;return;}target.replaceChildren();
    for(const item of result.data||[]){const card=node('div',null,'eo-component-card'),approved=Number(item.approved_quantity??(item.status==='approved'?item.requested_quantity:0));card.append(node('strong',`${item.code} — ${item.description}`),node('p',`Solicitado: ${item.requested_quantity} · Autorizado: ${approved} · Consumido: ${item.issued_quantity} · ${labels[item.status]||item.status}`));
      for(const [status,label] of item.status==='draft'?[['approved','Aprovar quantidade'],['rejected','Rejeitar']]:item.status==='approved'?[['revoked','Revogar saldo']]:[]){const button=node('button',label,'btn btn-secondary btn-sm');button.type='button';button.onclick=()=>status==='rejected'?decideEamMaterialRequest(orderId,item.material_id,status):decision(orderId,item,status);card.append(button);}target.append(card);
    }if(!target.children.length)target.textContent='Nenhuma peça solicitada nesta ordem.';
  };
})();
