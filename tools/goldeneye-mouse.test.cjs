const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({window:{},DataView,Uint8Array});
vm.runInContext(fs.readFileSync('local/goldeneye/mouse-controls.js','utf8'),context);
const Profile=vm.runInContext('GoldenEyeMouseProfile',context);
function fixture(){
 const heap=new Uint8Array(0x1200000),rom=new Uint8Array(0x1040),v=new DataView(heap.buffer);
 rom.set([0x80,0x37,0x12,0x40]);new DataView(rom.buffer).setUint32(8,0x80000400);
 for(let i=0;i<64;i++)rom[0x1000+i]=(i*29+7)%256;
 function place(base){
  for(let i=0;i<64;i++)heap[base+0x400+i]=rom[0x1000+(i^3)];
  v.setUint32(base+0x7a0b0,0x80090000,true);
  [3,3,0x40400000,0xffffffe2,1].forEach((x,i)=>v.setUint32(base+0x90000+0x2a58+i*4,x,true));
  v.setUint32(base+0x40a9c,1,true);
 }
 place(0x1000);
 const emulator={fileName:'fixture.z64',gameManager:{Module:{HEAPU8:heap},FS:{readFile:()=>rom}}};
 return {heap,rom,v,place,profile:new Profile(emulator)};
}
test('capture settings restore exactly, including toggle aim and unrelated memory',()=>{
 const f=fixture(),before=f.heap.slice();assert.equal(f.profile.locate(),true);assert.equal(f.profile.apply(),true);
 assert.equal(f.v.getUint32(0x91000+0x2a58,true),1);assert.equal(f.v.getUint32(0x1000+0x40a9c,true),0);
 f.v.setUint32(0x91000+0x124,1,true);f.profile.restore();assert.deepEqual(f.heap,before);
});
test('ambiguous RAM copies fail closed without touching memory',()=>{
 const f=fixture();f.place(0x901000);const before=f.heap.slice();
 assert.equal(f.profile.locate(),false);assert.equal(f.profile.apply(),false);assert.deepEqual(f.heap,before);
});
test('stale or invalid player pointer prevents writes and restoration into freed memory',()=>{
 const f=fixture();assert.equal(f.profile.locate(),true);f.profile.apply();
 f.v.setUint32(0x1000+0x7a0b0,0x7fffffff,true);const before=f.heap.slice();
 assert.equal(f.profile.apply(),false);f.profile.restore();assert.deepEqual(f.heap,before);
});
test('unsupported ROM byte order is rejected',()=>{
 const f=fixture();f.rom[0]=0x37;assert.equal(f.profile.locate(),false);
});
test('mouse pitch compensates for both native look settings without changing them',()=>{
 const f=fixture();assert.equal(f.profile.locate(),true);
 assert.equal(f.profile.verticalSign(),-1);
 f.v.setUint32(0x1000+0x40a84,1,true);
 assert.equal(f.profile.verticalSign(),1);
 assert.equal(f.v.getUint32(0x1000+0x40a84,true),1);
});
