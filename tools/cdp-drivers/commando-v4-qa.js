'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
module.exports=async(cdp,evaluate,sleep)=>{
  await evaluate("window.__v4Errors=[];addEventListener('error',e=>__v4Errors.push(e.message));addEventListener('unhandledrejection',e=>__v4Errors.push(String(e.reason)));document.querySelector('#crt').checked=false;document.querySelector('#crt').dispatchEvent(new Event('change'));document.querySelector('#game').scrollIntoView({block:'center'});");
  assert.deepEqual(await evaluate("[...document.querySelector('#difficulty').options].map(o=>o.value)"),['easy','normal','hard']);
  for(let stage=0;stage<8;stage++){
    await evaluate(`(()=>{const e=__gameslop.engine;e.start({difficulty:'easy'});for(let n=0;n<${stage};n++){e.state.status='clear';e.advance();}e.state.status='paused';document.querySelector('#overlay').style.visibility='hidden';})()`);
    await evaluate(`__gameslop.renderer.environment.loadStage(${stage})`);
    const result=await evaluate(`(()=>{
      const {engine:e,renderer:r}=__gameslop,s=e.state,p=s.players[0];s.banner=0;p.invincible=0;
      const kind=SlopCommando.stageEnemies[s.stage];s.enemies.push({kind,id:999,x:p.x+260,y:p.y,w:32,h:34,hp:5,maxHp:5,cooldown:99,phase:0,originY:p.y});
      r.draw(s,{time:2});
      if(s.level.mode!=='base')return true;
      const env=r.environment;env.draw(s,2);const canvas=document.querySelector('#game');const before=canvas.toDataURL();
      s.enemies=s.enemies.filter(t=>t.kind!=='core'||t.x>300);s.tick+=120;env.draw(s,2);
      const stationary=before===canvas.toDataURL()&&env.layout.position===0;
      r.draw(s,{time:2});return stationary;
    })()`);
    assert.equal(result,true,'stationary overhead floor in stage '+(stage+1));
    const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/game-screenshots/commando-v4-stage-'+(stage+1)+'.png',Buffer.from(shot.data,'base64'));
    console.log('PASS stage '+(stage+1)+' artwork and '+(stage===1||stage===3?'stationary overhead room':'themed enemy'));
  }
  await evaluate(`(()=>{
    const e=__gameslop.engine;e.start({difficulty:'normal'});e.state.level.spawns=[];e.state.level.supplies=[];e.state.enemies=[];e.state.waveTime=-999;
    const p=e.state.players[0];p.invincible=999;
    for(const type of ['T','T','I']){e.state.pickups.push({x:p.x,y:p.y,w:24,h:24,type,ttl:99});e.tick();}
    document.querySelector('#game').focus();
  })()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyV',key:'v'});await sleep(100);await cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyV',key:'v'});
  assert.deepEqual(await evaluate("[__gameslop.engine.state.players[0].weapon,__gameslop.engine.state.players[0].holstered,SlopCommando.weaponTier(__gameslop.engine.state.players[0])]"),['T','I',2]);
  console.log('PASS keyboard swap preserves tier');
  await cdp('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90}});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await sleep(120);
  const pt=await evaluate("(()=>{const b=document.querySelector('[data-action=swap]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,id:1};})()");
  assert.equal(await evaluate("(()=>{const boxes=[...document.querySelectorAll('.action-buttons button')].map(b=>b.getBoundingClientRect());return boxes.every((a,i)=>boxes.every((b,j)=>i===j||a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));})()"),true,'mobile action controls must not overlap');
  assert.ok(pt.x>=0&&pt.x<=844&&pt.y>=0&&pt.y<=390);
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await sleep(100);await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await evaluate('__gameslop.engine.state.players[0].weapon'),'I');console.log('PASS mobile swap button');
  await evaluate("__gameslop.engine.start({difficulty:'hard'})");await sleep(80);
  assert.equal(await evaluate("document.querySelector('[data-action=swap]').disabled"),true);console.log('PASS hard disables holster control');
  assert.deepEqual(await evaluate('__v4Errors'),[]);console.log('PASS v4 browser regression without runtime errors');
};
