const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const read=p=>fs.readFileSync('games/goldeneye/'+p);
const manifest=JSON.parse(read('game-manifest.json'));
test('published game exactly matches the tested Gameslop build',()=>{
 const bytes=read(manifest.file),expected=JSON.parse(fs.readFileSync('local/goldeneye/build-manifest.json'));
 assert.equal(bytes.length,manifest.size);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.roster.sha256);
 assert.equal(manifest.sha256,expected.roster.sha256);
 assert.deepEqual(fs.readdirSync('games/goldeneye/data'),['gameslop.z64']);
});
test('launcher supports immediate play without file selection',()=>{
 const html=read('index.html').toString();
 assert.doesNotMatch(html,/type="file"|rom-loader|id="play" disabled|Select your GoldenEye/);
 assert.doesNotMatch(read('app.js').toString(),/GoldenEyePublic/);
 for(const name of ['rom-loader.js','patch-manifest.json','gameslop.patch'])assert.equal(fs.existsSync('games/goldeneye/'+name),false);
});
test('download failure is reported and never starts the emulator',async()=>{
 const messages=[],scripts=[],element={textContent:''};
 const context=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>element,createElement:()=>({}),body:{append:s=>scripts.push(s)}},parent:{postMessage:m=>messages.push(m)},location:{search:'',origin:'https://example.test'},URLSearchParams,fetch:async()=>({ok:false})});
 vm.runInContext(read('engine.js').toString(),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(scripts.length,0);assert.equal(messages[0].type,'error');assert.match(element.textContent,/Could not load the game/);
});
