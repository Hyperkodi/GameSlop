'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(cdp,evaluate,sleep)=>{
 for(let i=0;i<300&&!await evaluate('window.__gameslop?.renderer.ready');i++)await sleep(40);
 assert.ok(await evaluate('__gameslop.renderer.ready'));
 await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));const style=document.createElement('style');style.textContent='#title-screen,#overlay{display:none!important}';document.head.append(style)");
 const shot=async name=>{const data=await evaluate("document.querySelector('canvas').toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.resolve('docs/game-screenshots/slop-in-time-themed-'+name+'.png'),Buffer.from(data,'base64'));};
 for(let era=0;era<6;era++)for(let site=0;site<2;site++){
  const result=await evaluate(`(()=>{const e=__gameslop.engine;e.start();for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}const s=e.state,p=s.players[0],t=s.traps[${site}],count=s.traps.length;s.gate=9;p.x=t.x-170;p.y=t.y+80;p.invincible=0;s.camera=t.x-460;s.cameraY=SlopInTime.content.floor(SlopInTime.stages[${era}],t.x);s.pickups=[];t.clock=3.65;e.tick();s.status='paused';__gameslop.renderer.draw(s,s.time);return {count,kind:t.kind};})()`);assert.equal(result.count,3);await shot(result.kind+'-active');
  const safe=await evaluate(`(()=>{const e=__gameslop.engine,s=e.state,p=s.players[0],t=s.traps[${site}];s.status='playing';p.x=t.x;p.y=t.y+80;p.invincible=0;p.hp=100;for(let i=0;i<70;i++)e.tick();s.status='paused';return p.hp;})()`);assert.equal(safe,100);
  const disabled=await evaluate(`(()=>{const e=__gameslop.engine,s=e.state,p=s.players[0],t=s.traps[${site}],control=s.props.find(q=>q.target===t.id);if(!control)return null;s.status='playing';p.x=control.x-30;p.y=control.y;p.face=1;p.action=null;p.cooldown=0;control.hp=10;e.input(0,'attack',true);for(let i=0;i<8;i++)e.tick();e.release();for(let i=0;i<80;i++)e.tick();s.status='paused';__gameslop.renderer.draw(s,s.time);return t.disabled;})()`);if(disabled!==null){assert.equal(disabled,true,result.kind+' control');await shot(result.kind+'-disabled');}
  console.log('PASS '+result.kind+': source art, clear bypass and control');
 }
 assert.deepEqual(await evaluate('__errors'),[]);console.log('PASS all 12 themed hazards; exactly three sites per era.');
};
