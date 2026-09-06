 'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
module.exports=async(cdp,evaluate,sleep)=>{
 const check=async(code,label)=>{assert.ok(await evaluate(code),label);console.log('PASS '+label);};
 for(let i=0;i<150&&!await evaluate('window.__gameslop?.renderer.ready');i++)await sleep(30);
 await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));document.querySelector('#start').click()");
 await evaluate(`(()=>{const e=__gameslop.engine;e.start({players:2});e.state.status='clear';e.advance();const p=e.state.players[0];for(const kind of ['stamina','strength']){const item=e.state.pickups.find(v=>v.kind===kind);item.x=p.x;item.y=p.y;e.tick();}})()`);
 await check('__gameslop.engine.state.players.every(p=>p.maxStamina===120&&p.strength===1)','collectible stamina and strength upgrades apply to both players');
 const counts=await evaluate(`(()=>{const e=__gameslop.engine;const results=[];e.start();for(let i=0;i<6;i++){if(i){e.state.status='clear';e.advance();}const count=kind=>e.state.pickups.filter(p=>p.kind===kind).length;results.push({era:i+1,food:count('food'),special:count('energy'),stamina:count('stamina'),strength:count('strength')});}return results;})()`);console.log(JSON.stringify(counts));for(const c of counts){assert.ok(c.food<=3&&c.special<=3);assert.equal(c.stamina,1);assert.equal(c.strength,c.era%2===0?1:0);}
 await evaluate(`(()=>{const e=__gameslop.engine;e.start({players:2});for(let i=0;i<5;i++){e.state.status='clear';e.advance();}const s=e.state;s.props=[];s.traps=[];s.enemies=[];s.effects=[];s.arena=true;s.waveCount=1;s.players.forEach((p,i)=>Object.assign(p,{x:150+i*110,y:450,invincible:0,maxStamina:220,stamina:i?4:210,strength:3}));s.pickups=[{kind:'stamina',x:450,y:380},{kind:'strength',x:570,y:380},{kind:'heart',x:690,y:380},...['chain','trident','axe','naginata','pickaxe','photon'].map((weapon,i)=>({kind:'weapon',weapon,x:365+i*95,y:470}))];e.tick=()=>{};})()`);await sleep(100);
 const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/game-screenshots/slop-in-time-upgrades-weapons.png',Buffer.from(shot.data,'base64'));
 await check('__errors.length===0','new pickup, weapon and upgraded HUD graphics render without errors');
 console.log('All progression browser checks passed.');
};
