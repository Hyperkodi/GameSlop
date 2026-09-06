'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(cdp,evaluate,sleep)=>{
  for(let i=0;i<300&&!await evaluate('window.__gameslop?.renderer.ready');i++)await sleep(40);
  assert.ok(await evaluate('__gameslop.renderer.ready'));
  await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));const style=document.createElement('style');style.textContent='#overlay,#title-screen{display:none!important}';document.head.append(style)");
  const shot=async name=>{const data=await evaluate("document.querySelector('canvas').toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.resolve('docs/game-screenshots/slop-in-time-v3-'+name+'.png'),Buffer.from(data,'base64'));};
  const render=()=>evaluate('__gameslop.renderer.draw(__gameslop.engine.state,0)');
  for(const pose of ['jab','uppercut','jump','kick','weapon','lid']){
    await evaluate(`(()=>{const e=__gameslop.engine;e.start();const p=e.state.players[0];p.x=360;p.y=416;p.invincible=100;e.tick();e.state.enemies=[];e.state.props=[];e.state.pickups=[];e.state.traps=[];e.state.arena=false;e.state.gate=9;e.state.transition=0;e.state.story=null;
      if('${pose}'==='uppercut'){p.comboStep=2;p.comboUntil=100;}
      if('${pose}'==='jump'||'${pose}'==='kick')e.input(0,'jump',true);
      if('${pose}'==='weapon'){p.weapon='hammer';p.weaponHits=12;}
      if('${pose}'==='lid')e.state.props=[{id:99,x:p.x,y:p.y,hp:1,kind:'lid',open:false}];
      if('${pose}'!=='jump')e.input(0,'attack',true);
      for(let i=0;i<('${pose}'==='jump'?30:'${pose}'==='lid'?20:9);i++)e.tick();e.state.status='paused';})()`);
    await render();await shot(pose);
  }
  for(let era=0;era<6;era++){
    await evaluate(`(()=>{const e=__gameslop.engine;e.start();for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}const p=e.state.players[0],t=SlopInTime.stages[${era}].turns[0];e.state.gate=9;e.state.enemies=[];e.state.arena=false;p.x=t.x+90;p.y=416;p.invincible=100;e.state.camera=p.x-310;e.input(0,'right',true);for(let i=0;i<90;i++)e.tick();window.__blockedX=p.x;e.input(0,'right',false);e.input(0,'down',true);for(let i=0;i<86;i++)e.tick();e.release();e.state.status='paused';e.state.transition=0;})()`);
    assert.ok(await evaluate(`__blockedX<=SlopInTime.stages[${era}].turns[0].end&&__gameslop.engine.state.players[0].y>620&&__gameslop.engine.state.cameraY>150`),'right blocks and Down traverses route '+era);
    await render();await shot('route-'+(era+1));
    await evaluate(`(()=>{const e=__gameslop.engine;e.start();for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}e.state.gate=1;const p=e.state.players[0];p.x=SlopInTime.stages[${era}].encounters[1]-300;p.invincible=100;e.tick();e.state.transition=0;e.state.story=null;e.state.status='paused';})()`);
    assert.ok(await evaluate('__gameslop.engine.state.enemies.some(e=>e.kind===\'flyer\'&&e.z>60)'));await render();await shot('flyer-'+(era+1));
    console.log('PASS downward route and themed flyer: era '+(era+1));
  }
  assert.deepEqual(await evaluate('__errors'),[]);console.log('Adventure and animation browser checks passed.');
};
