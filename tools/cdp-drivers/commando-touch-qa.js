'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Real CDP touch gestures exercise the same pointer capture and physics inputs
// as a phone. Quiet scenes isolate controls; the boss descent uses real ledges.
module.exports = async (cdp, evaluate, sleep) => {
  const frames = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const waitFor = async (expression, label, timeout = 3000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await sleep(25);
    }
    throw new Error(label + ': ' + JSON.stringify(await evaluate('(()=>{const s=__gameslop.engine.state,p=s.players[0];return {status:s.status,x:p.x,y:p.y,vy:p.vy,grounded:p.grounded,held:p.held,touch:__gameslop.touch.inspect(),log:s.inputLog.slice(-10),trace:window.__touchTrace};})()')));
  };
  const check = async (expression, label) => { assert.ok(await evaluate(expression), label); console.log('PASS ' + label); };
  const touch = (type, points) => cdp('Input.dispatchTouchEvent', { type, touchPoints: points });
  const rect = selector => evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);
  const tap = async selector => { const p=await rect(selector);await touch('touchStart',[{x:p.x,y:p.y,id:1}]);await touch('touchEnd',[]);await frames(); };
  const screenshot = async name => { await frames();const shot=await cdp('Page.captureScreenshot',{format:'png'});const output=path.resolve('docs/game-screenshots/commando-touch-'+name+'.png');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.from(shot.data,'base64')); };
  const viewport = async (width, height) => { await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}});await frames(); };
  const released = "(()=>{const p=__gameslop.engine.state.players[0];return !p.held.left&&!p.held.right&&!p.held.up&&!p.held.down&&!p.held.jump&&!p.held.drop&&__gameslop.touch.inspect().contacts===0;})()";
  const quiet = async (stage=0) => {
    await evaluate(`(()=>{const e=__gameslop.engine;e.release();e.start({difficulty:'normal'});for(let i=0;i<${stage};i++){e.state.status='clear';e.advance();}const s=e.state,l=s.level,p=s.players[0];s.waveTime=-999;s.banner=0;s.boss=null;s.enemies=[];s.pickups=[];s.bullets=[];l.spawns=[];l.supplies=[];l.hazards=[];p.invincible=999;p.weapon='P';p.cooldown=0;p.holstered='T';if(l.mode!=='base'){l.platforms=[{x:0,y:480,w:l.width,h:60,ground:true}];p.x=260;p.y=438;p.grounded=true;p.onGround=true;s.camera={x:0,y:0};}else{p.x=400;p.y=360;}document.querySelector('#game').focus({preventScroll:true});})()`);
    await waitFor("__gameslop.engine.state.status==='playing'&&document.querySelector('#title-screen').hidden&&document.querySelector('#overlay').hidden",'active controls');await frames();
  };
  const layout = async label => {
    const boxes=await evaluate(`(()=>{const selectors=['.dpad','#auto-fire','[data-action=jump]','[data-action=fire]','[data-action=swap]','[data-action=drop]'];return selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};});})()`);
    assert.ok(boxes.every(b=>b.w>=44&&b.h>=44),label+' targets at least 44px '+JSON.stringify(boxes));
    assert.ok(boxes.every(b=>b.x>=0&&b.right<=viewportSize.width+1&&b.y>=0&&b.bottom<=viewportSize.height+1),label+' controls fit onscreen '+JSON.stringify(boxes));
    assert.ok(boxes.every((a,i)=>boxes.every((b,j)=>i===j||a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y)),label+' controls do not overlap');
    await check('document.documentElement.scrollWidth<=innerWidth',label+' has no horizontal overflow');
    console.log('PASS '+label+' full-size non-overlapping thumb targets');
  };
  let viewportSize={width:844,height:390};
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await viewport(844,390);
  await evaluate("window.__touchErrors=[];addEventListener('error',e=>__touchErrors.push(e.message));addEventListener('unhandledrejection',e=>__touchErrors.push(String(e.reason)));document.querySelector('#crt').checked=false;document.querySelector('#crt').dispatchEvent(new Event('change'));window.scrollTo(0,0)");
  await check("document.querySelector('#auto-fire').getAttribute('aria-pressed')==='true'&&!__gameslop.touch.inspect().usingTouch",'automatic fire defaults on but waits for touch intent');
  await check("getComputedStyle(document.querySelector('.touch-controls')).display==='none'",'title has no obstructing touch controls');
  await tap('#start');await waitFor("__gameslop.engine.state.status==='playing'&&__gameslop.touch.inspect().usingTouch",'real touch Start activates mobile firing');await quiet();
  await waitFor("__gameslop.engine.state.bullets.some(b=>b.team==='player')",'automatic fire produces actual bullets');
  await layout('844x390 landscape');

  let stick=await rect('.dpad'),right={x:stick.x+stick.w*.38,y:stick.y,id:1};
  const startX=await evaluate('__gameslop.engine.state.players[0].x');
  await touch('touchStart',[{x:stick.x,y:stick.y,id:1}]);await frames();
  await check("__gameslop.touch.inspect().contacts===1&&!__gameslop.engine.state.players[0].held.right",'stick center captures initial touch');
  await touch('touchMove',[right]);await waitFor(`__gameslop.engine.state.players[0].x>${startX+30}`,'center drag moves right');
  await touch('touchMove',[{...right,y:stick.y+stick.h*.12}]);await frames();
  await check("__gameslop.engine.state.players[0].held.right&&!__gameslop.engine.state.players[0].prone&&!__gameslop.engine.state.players[0].held.down",'modest downward thumb drift does not crouch');
  await touch('touchStart',[right,{x:stick.x-stick.w*.38,y:stick.y,id:2}]);await frames();
  await check("__gameslop.touch.inspect().contacts===1&&__gameslop.engine.state.players[0].held.right&&!__gameslop.engine.state.players[0].held.left",'second stick finger cannot take over the movement pointer');
  await touch('touchEnd',[{x:stick.x-stick.w*.38,y:stick.y,id:2}]);await frames();
  await check("__gameslop.touch.inspect().contacts===1&&__gameslop.engine.state.players[0].held.right",'releasing the ignored finger preserves the original stick contact');
  await touch('touchMove',[{x:stick.x,y:stick.y+stick.h*.38,id:1}]);
  await waitFor('__gameslop.engine.state.players[0].prone','deliberate down crouches');await touch('touchEnd',[]);await waitFor(released,'touch release clears movement');
  console.log('PASS center drag, drift rejection, one-pointer stick ownership and deliberate crouch');

  await quiet();stick=await rect('.dpad');right={x:stick.x+stick.w*.38,y:stick.y,id:1};const jump=await rect('[data-action=jump]');
  await touch('touchStart',[right]);await touch('touchStart',[right,{x:jump.x,y:jump.y,id:2}]);
  await waitFor("(()=>{const s=__gameslop.engine.state,p=s.players[0];return p.held.right&&p.y<415&&s.bullets.some(b=>b.team==='player');})()",'two thumbs move, jump and auto-fire together');
  await touch('touchEnd',[]);await waitFor(released,'two-thumb release');console.log('PASS movement, jumping and automatic firing with two thumbs');
  await quiet();await tap('[data-action=jump]');await waitFor('__gameslop.engine.state.players[0].y<425','quick real touch tap launches jump');console.log('PASS quick jump taps survive input release');

  await quiet();stick=await rect('.dpad');right={x:stick.x+stick.w*.38,y:stick.y,id:1};const auto=await rect('#auto-fire');
  await touch('touchStart',[right]);await touch('touchStart',[right,{x:auto.x,y:auto.y,id:2}]);await touch('touchEnd',[{x:auto.x,y:auto.y,id:2}]);await frames();
  await check("!__gameslop.touch.inspect().autoFire&&__gameslop.engine.state.players[0].held.right&&!__gameslop.engine.state.players[0].held.fire",'second finger can turn off automatic fire while the stick stays held');
  await touch('touchStart',[right,{x:auto.x,y:auto.y,id:2}]);await touch('touchEnd',[{x:auto.x,y:auto.y,id:2}]);await frames();
  await check("__gameslop.touch.inspect().autoFire&&__gameslop.engine.state.players[0].held.right&&__gameslop.engine.state.players[0].held.fire",'second finger can restore automatic fire without releasing movement');await touch('touchEnd',[]);

  await tap('#auto-fire');await check("document.querySelector('#auto-fire').getAttribute('aria-pressed')==='false'&&localStorage.getItem('gameslop:commando:auto-fire')==='0'",'auto-fire can be switched off and saved');
  await quiet();await sleep(150);await check("!__gameslop.engine.state.players[0].held.fire&&!__gameslop.engine.state.bullets.length",'disabled automatic fire stays quiet');
  const fire=await rect('[data-action=fire]');await touch('touchStart',[{x:fire.x,y:fire.y,id:1}]);await waitFor('__gameslop.engine.state.bullets.length>0','manual fire creates bullets');await touch('touchEnd',[]);await frames();await check('!__gameslop.engine.state.players[0].held.fire','manual fire releases cleanly');
  await tap('#auto-fire');await cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'ArrowRight',key:'ArrowRight'});await frames();await check("!__gameslop.touch.inspect().usingTouch&&!__gameslop.engine.state.players[0].held.fire",'keyboard movement turns off touch auto-fire without changing preference');await cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'ArrowRight',key:'ArrowRight'});
  await tap('[data-action=jump]');await waitFor('__gameslop.touch.inspect().usingTouch&&__gameslop.engine.state.players[0].held.fire','touch reactivates automatic fire');
  await evaluate("window.__originalGetGamepads=navigator.getGamepads;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{axes:[1,0],buttons:Array.from({length:16},()=>({pressed:false}))}]})");await frames();
  await check("!__gameslop.touch.inspect().usingTouch&&!__gameslop.engine.state.players[0].held.fire&&__gameslop.engine.state.players[0].held.right",'gamepad input poll takes over from touch automatic fire');
  await evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:__originalGetGamepads})");await tap('[data-action=jump]');
  await evaluate("(()=>{const e=__gameslop.engine;e.start({difficulty:'normal',players:2});const s=e.state;s.waveTime=-999;s.enemies=[];s.level.spawns=[];s.level.supplies=[];s.players.forEach(p=>p.invincible=999);})()");await frames();await tap('[data-action=jump]');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyD',key:'d'});await frames();
  await check("__gameslop.touch.inspect().usingTouch&&__gameslop.engine.state.players[0].held.fire&&__gameslop.engine.state.players[1].held.right",'P2 keyboard movement preserves P1 touch automatic fire');await cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyD',key:'d'});
  await evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))},{axes:[1,0],buttons:Array.from({length:16},()=>({pressed:false}))}]})");await frames();
  await check("__gameslop.touch.inspect().usingTouch&&__gameslop.engine.state.players[0].held.fire&&__gameslop.engine.state.players[1].held.right",'P2 gamepad movement preserves P1 touch automatic fire');await evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:__originalGetGamepads})");

  await quiet(1);stick=await rect('.dpad');const before=await evaluate('({x:__gameslop.engine.state.players[0].x,y:__gameslop.engine.state.players[0].y})');
  await touch('touchStart',[{x:stick.x+stick.w*.32,y:stick.y-stick.h*.32,id:1}]);await waitFor(`__gameslop.engine.state.players[0].x>${before.x+15}&&__gameslop.engine.state.players[0].y<${before.y-15}`,'bunker stick supports diagonal floor movement');await touch('touchCancel',[]);await waitFor(released,'pointer cancellation clears held movement');await check("document.querySelector('[data-action=drop]').disabled",'bunker drop control is disabled');console.log('PASS eight-way bunker movement and touch cancellation');

  await evaluate(`(()=>{const e=__gameslop.engine;e.release();e.start({difficulty:'normal'});for(let i=0;i<2;i++){e.state.status='clear';e.advance();}const s=e.state,l=s.level,p=s.players[0];l.spawns=[];l.supplies=[];l.hazards=[];s.waveTime=-999;s.enemies=[];s.pickups=[];s.banner=0;const ledges=l.platforms.filter(q=>!q.ground).sort((a,b)=>a.y-b.y);const crest=ledges[0];p.x=465;p.y=crest.y-p.h;p.vy=0;p.grounded=true;p.invincible=999;s.camera.y=0;const lower=ledges.find(q=>q.y>crest.y+1&&p.x+p.w>q.x&&p.x<q.x+q.w);window.__touchCrest={upper:crest.y,lower:lower.y};})()`);await frames();
  const drop=await rect('[data-action=drop]');await touch('touchStart',[{x:drop.x,y:drop.y,id:1}]);await waitFor("(()=>{const p=__gameslop.engine.state.players[0];return p.grounded&&p.y+p.h===__touchCrest.lower;})()",'Drop descends from boss crest to first lower shelf');await sleep(650);await check("(()=>{const p=__gameslop.engine.state.players[0];return p.grounded&&p.y+p.h===__touchCrest.lower;})()",'holding Drop never repeats onto another shelf');await touch('touchEnd',[]);await tap('[data-action=jump]');await waitFor("__gameslop.engine.state.players[0].y<__touchCrest.upper-42",'Jump can return above boss crest');await waitFor("(()=>{const p=__gameslop.engine.state.players[0];return p.grounded&&p.y+p.h===__touchCrest.upper;})()",'Jump lands back on boss crest');console.log('PASS separate Drop button descends once and Jump returns to boss');
  await screenshot('boss-crest');

  await quiet();stick=await rect('.dpad');right={x:stick.x+stick.w*.38,y:stick.y,id:1};const pause=await rect('#pause');
  await evaluate("window.__touchTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','click','resize'])addEventListener(type,e=>__touchTrace.push({type:e.type,target:e.target?.id||e.target?.className,pointer:e.pointerId,primary:e.isPrimary,x:e.clientX,y:e.clientY,status:__gameslop.engine.state.status}),true)");
  await touch('touchStart',[right]);await touch('touchStart',[right,{x:pause.x,y:pause.y,id:2}]);await touch('touchEnd',[{x:pause.x,y:pause.y,id:2}]);
  await waitFor("__gameslop.engine.state.status==='paused'",'pause menu');await waitFor(released,'pause releases the still-held movement finger');await touch('touchEnd',[]);
  const tick=await evaluate('__gameslop.engine.state.tick');await sleep(120);assert.equal(await evaluate('__gameslop.engine.state.tick'),tick,'pause freezes automatic firing physics');await check("getComputedStyle(document.querySelector('.touch-controls')).visibility==='hidden'",'pause menu hides thumb controls');await tap('#overlay-action');await waitFor("__gameslop.engine.state.status==='playing'",'resume from real touch');await waitFor(released,'resume has no stale motion');
  stick=await rect('.dpad');await touch('touchStart',[{x:stick.x+stick.w*.38,y:stick.y,id:1}]);await frames();await viewport(390,844);await waitFor(released,'rotation cancels active touch without sticky movement');await touch('touchCancel',[]);
  console.log('PASS pause, resume, and rotation release inputs');

  for(const [width,height]of [[844,390],[667,375],[390,844],[320,568]]){
    await viewport(width,height);viewportSize={width,height};await quiet();await evaluate("document.querySelector('.cabinet').scrollIntoView({block:'center'});");await frames();await layout(width+'x'+height);await screenshot(width+'x'+height);
  }
  await viewport(844,390);viewportSize={width:844,height:390};await evaluate('window.scrollTo(0,0)');await frames();
  await tap('#fullscreen');await waitFor("!!document.fullscreenElement||document.querySelector('.cabinet').classList.contains('expanded')",'fullscreen enters');await layout('fullscreen');await tap('#fullscreen');await waitFor("!document.fullscreenElement&&!document.querySelector('.cabinet').classList.contains('expanded')",'fullscreen exits');
  await evaluate("document.querySelector('.cabinet').requestFullscreen=undefined");await tap('#fullscreen');await waitFor("document.querySelector('.cabinet').classList.contains('expanded')",'Safari-style fullscreen fallback enters');await layout('fullscreen fallback');await screenshot('fullscreen');await tap('#fullscreen');
  assert.deepEqual(await evaluate('__touchErrors'),[],'no browser runtime errors during mobile input and traversal');
  await tap('#auto-fire');await cdp('Page.reload',{ignoreCache:true});await waitFor("document.body.dataset.ready==='1'&&!!window.__gameslop",'reload finished');await check("document.querySelector('#auto-fire').getAttribute('aria-pressed')==='false'&&!__gameslop.touch.inspect().usingTouch",'automatic-fire preference survives reload without activating input');
  await tap('#start');await quiet();await check('!__gameslop.engine.state.players[0].held.fire','restored OFF preference remains off after touch Start');await tap('#auto-fire');await screenshot('final');
  console.log('All mobile control browser QA checks passed.');
};
