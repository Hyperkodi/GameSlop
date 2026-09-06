'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(cdp,evaluate,sleep)=>{
 for(let i=0;i<300&&!await evaluate('window.__gameslop?.renderer.ready');i++)await sleep(40);
 assert.ok(await evaluate('__gameslop.renderer.ready'));
 await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));const style=document.createElement('style');style.textContent='#title-screen{display:none!important}';document.head.append(style)");
 const shot=async name=>{const data=await evaluate("document.querySelector('canvas').toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.resolve('docs/game-screenshots/slop-in-time-v4-'+name+'.png'),Buffer.from(data,'base64'));};
 for(let era=0;era<6;era++){
   await evaluate(`(()=>{const e=__gameslop.engine;e.start();for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}const p=e.state.players[0],s=SlopInTime.stages[${era}],t=s.turns[0];p.x=(t.x+t.end)/2;p.y=411+SlopInTime.content.floor(s,p.x);p.invincible=0;e.state.camera=p.x-310;e.state.cameraY=SlopInTime.content.floor(s,p.x);e.state.status='paused';__gameslop.renderer.draw(e.state,1);})()`);
   await shot('route-'+(era+1));
   // All palette variants, including the airborne thrower, retain their era art.
   await evaluate(`(()=>{const e=__gameslop.engine,s=e.state,p=s.players[0];s.status='playing';s.gate=0;s.camera=0;s.cameraY=0;p.x=170;p.y=416;e.tick();const base=s.enemies[0];s.enemies=SlopInTime.content.enemyKinds.map((kind,i)=>({...base,entrance:null,id:100+i,kind,x:270+i*135,y:430,z:kind==='flyer'?85:kind==='thrower'?60:0,hp:35,maxHp:35,defend:kind==='guard'?1:0}));s.props=[];s.pickups=[];s.traps=[];s.status='paused';__gameslop.renderer.draw(s,1);})()`);await shot('enemies-'+(era+1));
 }
 await evaluate(`(()=>{const e=__gameslop.engine;e.start();const s=e.state,p=s.players[0];s.status='paused';p.hp=67;p.maxHp=101;p.invincible=0;p.x=95;s.pickups=['hotdog','pizza','burger','ramen'].map((food,i)=>({kind:'food',food,x:250+i*105,y:450}));s.pickups.push({kind:'heart',x:730,y:450},{kind:'energy',x:850,y:450});s.props=[{kind:'barrel',hp:24,x:280,y:365},{kind:'gong',hp:24,x:430,y:365},{kind:'switch',hp:24,x:580,y:365}];s.traps=[{kind:'steam',x:740,y:365,active:true}];__gameslop.renderer.draw(s,2);})()`);await shot('pickups');
 await evaluate(`(()=>{const e=__gameslop.engine;e.start();const s=e.state,p=s.players[0];s.gate=9;p.x=SlopInTime.stages[0].encounters[9]-300;p.y=416+SlopInTime.content.floor(SlopInTime.stages[0],p.x);s.camera=p.x-310;s.cameraY=SlopInTime.content.floor(SlopInTime.stages[0],p.x);e.tick();const boss=s.enemies.find(e=>e.boss);boss.x=boss.entrance.landX;boss.y=boss.entrance.landY;boss.entrance=null;boss.hp=0;e.tick();for(let i=0;i<75;i++)e.tick();s.status='paused';__gameslop.renderer.draw(s,2);})()`);
 assert.ok(await evaluate('__gameslop.engine.state.ending.age>1&&__gameslop.engine.state.effects.some(f=>f.kind===\'explosion\')'));await shot('boss-explosion');
 await evaluate(`(()=>{const e=__gameslop.engine;e.state.status='playing';for(let i=0;i<115;i++)e.tick();e.state.status='paused';__gameslop.renderer.draw(e.state,3);})()`);assert.ok(await evaluate('__gameslop.engine.state.ending.fade>.4&&__gameslop.engine.state.ending.fade<1'));await shot('boss-fade');
 await evaluate(`(()=>{const e=__gameslop.engine;e.state.status='playing';for(let i=0;i<100;i++)e.tick();})()`);await sleep(70);assert.equal(await evaluate('__gameslop.engine.state.status'),'clear');assert.ok(await evaluate("!document.querySelector('#overlay').hidden&&document.querySelector('#overlay-kicker').textContent.includes('SECURED')"));await shot('stage-clear');
 assert.deepEqual(await evaluate('__errors'),[]);console.log('PASS six continuous routes, thirty enemy appearances, pickups, boss explosion/fade and stage clear overlay.');
};
