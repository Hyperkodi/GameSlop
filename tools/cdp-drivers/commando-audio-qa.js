'use strict';
const assert = require('node:assert/strict');
module.exports = async (cdp, evaluate, sleep) => {
  await evaluate("window.__audioErrors=[];addEventListener('error',e=>__audioErrors.push(e.message));addEventListener('unhandledrejection',e=>__audioErrors.push(String(e.reason)));");
  const info = () => evaluate('__gameslop.audio.inspect()');
  async function until(check, message) {
    for (let i=0;i<100;i++) { const value=await info(); if(check(value))return value; await sleep(100); }
    throw Error(message+': '+JSON.stringify(await info()));
  }
  async function click(selector) {
    const p=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
  }
  assert.equal((await info()).unlocked,false,'no autoplay on the title screen');
  await click('#start');
  await until(s=>s.loaded.length===16 && s.musicPlaying && s.musicTime>0,'initial music and samples');
  assert.deepEqual((await info()).failed,[]);
  console.log('PASS real user gesture starts streamed music and decodes all sixteen recordings');
  await evaluate(`(()=>{const e=__gameslop.engine;e.state.level.spawns=[];e.state.level.supplies=[];e.state.enemies=[];e.state.waveTime=-999;e.state.players[0].invincible=999;})()`);
  for(const weapon of ['M','S','L','F','G','H','W']) {
    await evaluate(`(()=>{const e=__gameslop.engine,p=e.state.players[0];p.weapon='${weapon}';p.cooldown=0;e.input(0,'fire',true);e.tick();e.input(0,'fire',false);__gameslop.audio.update(e.state,e.drainEvents());})()`);
    const s=await info(); assert.equal(s.lastSample,'shot:'+weapon);assert.ok(s.voices>0);
  }
  console.log('PASS recorded effects play for every supplied gun');
  for(const weapon of ['T','I','A']) {
    await evaluate(`(()=>{const e=__gameslop.engine,p=e.state.players[0];p.weapon='${weapon}';p.cooldown=0;e.input(0,'fire',true);e.tick();e.input(0,'fire',false);__gameslop.audio.update(e.state,e.drainEvents());})()`);
    assert.equal((await info()).lastSample,'shot:'+weapon);
  }
  console.log('PASS recorded Tesla, cryo, and plasma weapon effects');
  for(const weapon of ['G','H']) {
    await evaluate(`(()=>{const e=__gameslop.engine;e.state.bullets=[];const p=e.state.players[0];p.weapon='${weapon}';p.cooldown=0;e.input(0,'fire',true);e.tick();e.input(0,'fire',false);e.drainEvents();e.state.bullets[0].ttl=0;e.tick();__gameslop.audio.update(e.state,e.drainEvents());})()`);
    assert.equal((await info()).lastSample,'impact:'+weapon);
  }
  await evaluate(`(()=>{const e=__gameslop.engine,p=e.state.players[0];e.state.pickups.push({type:'B',x:p.x,y:p.y,w:24,h:24,ttl:10});e.tick();__gameslop.audio.update(e.state,e.drainEvents());})()`);
  assert.equal((await info()).lastSample,'barrier');
  await evaluate(`(()=>{const e=__gameslop.engine,p=e.state.players[0];e.state.pickups.push({type:'C',x:p.x,y:p.y,w:24,h:24,ttl:10});e.tick();__gameslop.audio.update(e.state,e.drainEvents());})()`);
  assert.equal((await info()).lastSample,'cloak');
  const nukeVisual=await evaluate(`(()=>{const {engine:e,renderer:r,audio}=__gameslop,p=e.state.players[0];e.state.pickups.push({type:'N',x:p.x,y:p.y,w:24,h:24,ttl:10});e.tick();audio.update(e.state,e.drainEvents());r.draw(e.state,{time:3});const data=document.querySelector('#game').getContext('2d').getImageData(480,270,1,1).data;return {flash:e.state.nukeFlash,white:data[0]>245&&data[1]>245&&data[2]>245};})()`);
  assert.equal((await info()).lastSample,'nuke');assert.deepEqual(nukeVisual,{flash:1.2,white:true});
  console.log('PASS barrier, cloak, nuke flash, and separate grenade/rocket detonation recordings');
  await click('#pause');const paused=await info();await sleep(250);
  assert.equal((await info()).musicPlaying,false);assert.equal((await info()).musicTime,paused.musicTime);assert.equal((await info()).voices,0);
  await click('#overlay-action');await until(s=>s.musicPlaying && s.musicTime>paused.musicTime,'music resumes from pause');
  await click('#sound');assert.equal((await info()).muted,true);assert.equal((await info()).musicPlaying,false);assert.equal((await info()).voices,0);
  await click('#sound');await until(s=>s.musicPlaying,'unmute resumes music');
  console.log('PASS pause/resume and mute stop both music and effect tails');
  const tracks=['Jungle.mp3','Bunker.mp3','Foundry.mp3','Reactor.mp3','Snow.mp3','Foundry.mp3','Cave.mp3','Alien.mp3'];
  for(let stage=1;stage<8;stage++) {
    await evaluate(`(()=>{const e=__gameslop.engine;e.state.status='clear';e.advance();e.state.players[0].invincible=999;__gameslop.audio.update(e.state,e.drainEvents());})()`);
    await until(s=>s.track===tracks[stage] && s.musicPlaying && s.musicTime>0,'stage '+(stage+1)+' music');
  }
  console.log('PASS every level track streams, including Foundry reused for Spillway');
  await evaluate(`__gameslop.audio.update(__gameslop.engine.state,[{type:'explosion',kind:'boss'}])`);
  assert.equal((await info()).lastSample,'bossExplosion');
  await evaluate(`(()=>{const e=__gameslop.engine;for(let n=0;n<80;n++)__gameslop.audio.update(e.state,[{type:'shot',weapon:'M'},{type:'shot',weapon:'F'}]);})()`);
  assert.ok((await info()).voices<=24,'rapid co-op fire has bounded polyphony');
  await evaluate("__gameslop.engine.state.status='clear';__gameslop.audio.update(__gameslop.engine.state)");
  assert.equal((await info()).musicPlaying,false);
  // The overlay was not drawn during the direct state setup above, so invoke its normal
  // handler directly before exercising the real mobile touch gesture on Start.
  await evaluate("document.querySelector('#restart').click()");assert.equal((await info()).musicPlaying,false);
  await cdp('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90}});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const pt=await evaluate("(()=>{const b=document.querySelector('#start');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:1};})()");
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await until(s=>s.stage===0 && s.musicPlaying && s.musicTime>0,'mobile restart');
  await evaluate("window.dispatchEvent(new Event('blur'))");await sleep(80);
  assert.equal((await info()).status,'paused');assert.equal((await info()).musicPlaying,false);
  const fallback=await evaluate(`(async()=>{
    const env={AudioContext,Audio,fetch:async()=>({ok:false}),localStorage:{getItem:()=>null,setItem:()=>{}}};
    const a=SlopCommando.createAudio({env});await a.unlock();
    a.update({stage:2,status:'playing'},[{type:'shot',weapon:'M'}]);const result=a.inspect();a.toggle();return result;
  })()`);
  assert.equal(fallback.failed.length,16);assert.equal(fallback.lastSample,null);assert.ok(fallback.voices>0);
  assert.deepEqual(await evaluate('__audioErrors'),[]);
  console.log('PASS boss recording, bounded effect voices, mobile restart, background pause, missing-file fallback, no runtime errors');
  // Leave the captured artifact on the peak nuke frame for visual release review.
  await evaluate("(()=>{const {engine:e,renderer:r}=__gameslop;e.state.status='playing';e.state.nukeFlash=1.2;r.draw(e.state,{time:3});})()");
};
