'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{draft,version}=require('../../api/services/analytics/drafts');
test('private drafts preserve incomplete, null versus zero text and hostile text as inert data within closed limits',()=>{
 const data={kind:'measurements',variable:'Temperatura',unit:'°C',rows:[['0001','0'],['0002',''],['<img src=x onerror=alert(1)>','-']]};
 assert.deepEqual(JSON.parse(draft(data)),data);
 for(const bad of [{...data,org_id:'other'},{...data,rows:[['a','0','extra']]},{...data,rows:[['a',0]]},{...data,kind:'life',rows:[['a','2','unknown']]},{...data,rows:Array(4001).fill(['a',''])}])assert.throws(()=>draft(bad));
 for(const v of [-1,'0',1.5,NaN,2147483647])assert.throws(()=>version(v));assert.equal(version(0),0);
});
