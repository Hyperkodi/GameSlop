const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({window:{},Uint8Array,DataView,TextDecoder,Blob,DecompressionStream,crypto:require('node:crypto').webcrypto});
vm.runInContext(fs.readFileSync('games/goldeneye/rom-loader.js','utf8'),context);
const {patch,sha,unzip}=context.window.GoldenEyeRom;
const manifest=JSON.parse(fs.readFileSync('games/goldeneye/patch-manifest.json','utf8'));
const delta=new Uint8Array(fs.readFileSync('games/goldeneye/gameslop.patch'));
const local='local/goldeneye/data/goldeneye.z64';
test('public release contains no full ROMs or local/private paths',()=>{
 for(const name of fs.readdirSync('games/goldeneye',{recursive:true})){
  assert.ok(!/\.(z64|n64|v64|zip|log|state)$/i.test(name),name);
  if(/\.(html|js|css)$/i.test(name))assert.doesNotMatch(fs.readFileSync(path.join('games/goldeneye',name),'utf8'),/C:\\Users|D:\\ClaudeCode|127\.0\.0\.1|data\/goldeneye/);
 }
 assert.ok(delta.length<1024*1024);
});
test('browser delta reproduces the exact tested Gameslop build without mutating source',{skip:!fs.existsSync(local)},async()=>{
 const original=new Uint8Array(fs.readFileSync(local));
 const result=await patch(original,delta,manifest);
 assert.equal(await sha(result),manifest.patched);assert.equal(await sha(original),manifest.original);
});
test('wrong game, corrupt patch and out-of-range records are rejected',async()=>{
 await assert.rejects(patch(new Uint8Array(100),delta,manifest),/original GoldenEye/);
 if(!fs.existsSync(local))return;
 const original=new Uint8Array(fs.readFileSync(local)),bad=delta.slice();bad[20]^=1;
 await assert.rejects(patch(original,bad,manifest),/failed verification/);
 const range=delta.slice();new DataView(range.buffer).setUint32(12,12582912);
 await assert.rejects(patch(original,range,{...manifest,patch:await sha(range)}),/Invalid patch range/);
});
test('truncated ZIP is rejected',async()=>{
 await assert.rejects(unzip(new Uint8Array(20)),/incomplete or unsupported/);
});
test('uncompressed ZIP reads the supported ROM member',{skip:!fs.existsSync(local)},async()=>{
 const data=fs.readFileSync(local),name=Buffer.from('GoldenEye.z64');
 const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(header.length+name.length+data.length,16);
 const bytes=new Uint8Array(Buffer.concat([header,name,data,central,name,end]));
 assert.equal(await sha(await unzip(bytes)),manifest.original);
});
