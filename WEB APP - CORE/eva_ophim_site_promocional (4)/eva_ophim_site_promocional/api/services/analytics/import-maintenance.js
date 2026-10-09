'use strict';
// Expiry governs access independently; cleanup is best effort while the database is available.
function startImportCleanup(pool,{intervalMs=300000,onError=()=>{}}={}){
 let stopped=false,busy=false;
 async function tick(){if(stopped||busy)return;busy=true;try{await pool.execute("UPDATE analytics_imports SET status='expired',raw_data=NULL,table_data=NULL,mapped_data=NULL WHERE expires_at<NOW(3) AND status<>'published' AND (raw_data IS NOT NULL OR table_data IS NOT NULL OR mapped_data IS NOT NULL) LIMIT 100");}catch(_){onError();}finally{busy=false;}}
 const timer=setInterval(tick,intervalMs);timer.unref();tick();return()=>{stopped=true;clearInterval(timer);};
}
module.exports={startImportCleanup};
