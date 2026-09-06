'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(cdp,evaluate,sleep)=>{
 for(let i=0;i<300&&!await evaluate('window.__gameslop?.renderer.ready');i++)await sleep(40);
 assert.ok(await evaluate('__gameslop.renderer.ready'));
 await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));const style=document.createElement('style');style.textContent='#title-screen,#overlay{display:none!important}';document.head.append(style)");
 const shot=async name=>{const data=await evaluate("document.querySelector('canvas').toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.resolve('docs/game-screenshots/slop-in-time-entrance-'+name+'.png'),Buffer.from(data,'base64'));};
 for(const [kind,style] of Object.entries({grunt:'kick',guard:'charge',swift:'flip',thrower:'vault',flyer:'swoop'})){
  await evaluate(`(()=>{const e=__gameslop.engine;e.start();const s=e.state,p=s.players[0];p.x=170;p.invincible=100;e.tick();s.props=[];s.traps=[];s.pickups=[];const f=s.enemies[0];s.enemies=[f];f.kind='${kind}';f.entrance.style='${style}';f.entrance.delay=0;for(let i=0;i<30;i++)e.tick();s.status='paused';__gameslop.renderer.draw(s,s.time);})()`);
  assert.ok(await evaluate('__gameslop.engine.state.enemies[0].entrance.progress>0'));await shot(kind);
  await evaluate("(()=>{const e=__gameslop.engine;e.state.status='playing';for(let i=0;i<75;i++)e.tick();e.state.status='paused';__gameslop.renderer.draw(e.state,e.state.time);})()");assert.ok(await evaluate('!__gameslop.engine.state.enemies[0].entrance'));
 }
 for(let era=0;era<6;era++){
  await evaluate(`(()=>{const e=__gameslop.engine;e.start();for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}const s=e.state,p=s.players[0];s.gate=9;p.x=SlopInTime.stages[${era}].encounters[9]-300;p.y=416+SlopInTime.content.floor(SlopInTime.stages[${era}],p.x);s.camera=p.x-310;s.cameraY=p.y-416;p.invincible=100;e.tick();s.traps=[];s.props=[];s.pickups=[];const b=s.enemies.find(f=>f.boss);s.enemies=[b];for(let n=0;n<65;n++)e.tick();s.status='paused';__gameslop.renderer.draw(s,s.time);})()`);await shot('boss-'+era);
  assert.ok(await evaluate('__gameslop.engine.state.enemies[0].entrance.progress>0'));await evaluate("(()=>{const e=__gameslop.engine;e.state.status='playing';for(let n=0;n<90;n++)e.tick();e.state.status='paused';})()");assert.ok(await evaluate('!__gameslop.engine.state.enemies[0].entrance'));
 }
 const result=await evaluate(`(()=>{const e=__gameslop.engine;e.start();const s=e.state,p=s.players[0];p.x=170;p.invincible=100;e.tick();s.traps=[];s.props=[];s.pickups=[];p.x=850;s.waveCount=1;s.enemies=[];e.tick();const start=p.x,positions=[];for(let n=0;n<150;n++){const before=s.camera;e.tick();positions.push(s.camera-before);}s.status='paused';__gameslop.renderer.draw(s,s.time);return {max:Math.max(...positions),x:p.x,start,gate:s.gate,arena:s.arena};})()`);
 assert.ok(result.max<=5.001);assert.equal(result.x,result.start);assert.equal(result.gate,1);assert.equal(result.arena,false);await shot('camera-release');assert.deepEqual(await evaluate('__errors'),[]);console.log('PASS all five entrances, six boss entrances and smooth first arena release.');
};
