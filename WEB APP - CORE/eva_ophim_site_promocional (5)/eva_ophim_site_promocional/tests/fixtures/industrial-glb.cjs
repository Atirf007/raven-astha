const makeGlb=()=>{
 const vertices=[-.5,0,-.5,.5,0,-.5,.5,1,-.5,-.5,1,-.5,-.5,0,.5,.5,0,.5,.5,1,.5,-.5,1,.5];
 const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
 const positions=Buffer.from(new Float32Array(vertices).buffer),idx=Buffer.from(new Uint16Array(indices).buffer),bin=Buffer.concat([positions,idx]);
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.2,.5,.7,1]}}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.length},{buffer:0,byteOffset:positions.length,byteLength:idx.length}],accessors:[{bufferView:0,componentType:5126,count:8,type:'VEC3'},{bufferView:1,componentType:5123,count:indices.length,type:'SCALAR'}]};
 const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+padded.length+8+bin.length,8);jh.writeUInt32LE(padded.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return {bytes:Buffer.concat([header,jh,padded,bh,bin]),json,bin};
};
module.exports=makeGlb;
if(require.main===module){require('fs').writeFileSync(require('path').join(__dirname,'industrial-test.glb'),makeGlb().bytes);console.log('Created authored GLB fixture (12 triangles).');}
