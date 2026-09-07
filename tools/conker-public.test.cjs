const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../games/conker'),manifest=JSON.parse(fs.readFileSync(path.join(root,'game-manifest.json'))),engine=fs.readFileSync(path.join(root,'engine.js'),'utf8');
test('published cartridge matches its manifest and original inputs are excluded',()=>{
 const bytes=fs.readFileSync(path.join(root,manifest.file));assert.equal(bytes.length,67108864);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 assert.equal(fs.existsSync(path.join(root,'data/original.z64')),false);assert.equal(fs.existsSync(path.join(root,'extracted')),false);
});
async function bootstrap(game,bytes){
 const messages=[],scripts=[],element={textContent:''};let requests=0;
 const context={URL,URLSearchParams,Blob,crypto:webcrypto,navigator:{maxTouchPoints:0},location:{search:'',href:'https://example.test/conker/engine.html',origin:'https://example.test'},
 document:{addEventListener(){},getElementById(){return element},createElement(){return {}},body:{append(s){scripts.push(s)}}},parent:{postMessage(m){messages.push(m)}},
 fetch:async()=>++requests===1?{ok:true,json:async()=>game}:{ok:true,arrayBuffer:async()=>bytes},addEventListener(){}};
 context.window=context;vm.runInNewContext(engine,context);
 for(let i=0;i<50&&!scripts.length&&!messages.length;i++)await new Promise(r=>setTimeout(r,10));
 return {messages,scripts,element,requests,context};
}
test('malformed manifest fails before downloading any game data',async()=>{
 const r=await bootstrap({...manifest,file:'../data/original.z64'},new ArrayBuffer(0));assert.equal(r.requests,1);assert.equal(r.scripts.length,0);assert.match(r.element.textContent,/Invalid game build/);
});
test('incomplete game download never starts the emulator',async()=>{
 const r=await bootstrap(manifest,new ArrayBuffer(32));assert.equal(r.scripts.length,0);assert.match(r.element.textContent,/incomplete/);
});
test('matching data starts only the pinned runtime with an isolated save namespace',async()=>{
 const b=fs.readFileSync(path.join(root,manifest.file));const r=await bootstrap(manifest,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 assert.equal(r.messages.length,0);assert.equal(r.scripts[0].src,'https://cdn.emulatorjs.org/4.2.3/data/loader.js');assert.equal(r.context.EJS_gameName,'Sloppers Bad Fur Day EU v1');assert.equal(r.context.EJS_defaultControls[0][0].value,'space');URL.revokeObjectURL(r.context.EJS_gameUrl);
});
