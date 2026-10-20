(async()=>{
 const token=localStorage.getItem('astha_token');if(!token){location.replace('./login.html');return;}
 let target='/app/home.html';try{const raw=new URLSearchParams(location.search).get('return'),url=new URL(raw||target,location.origin);if(url.origin===location.origin&&/^\/app\/(home|sistema|analytics|settings|viewer-3d|personal|onboarding|account)\.html$/.test(url.pathname))target=url.pathname+url.search;}catch(_){}
 try{const r=await fetch('/api/workspace/context',{headers:{Authorization:'Bearer '+token}});if(r.status===401){localStorage.removeItem('astha_token');location.replace('./login.html');return;}if(!r.ok)throw Error();location.replace(target);}catch(_){document.getElementById('accessMessage').textContent='Não foi possível abrir seu espaço. Recarregue para tentar novamente.';}
})();
