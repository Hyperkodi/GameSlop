'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Quiet debug scenes isolate traversal, but every drop and return jump uses the
// same keyboard or multi-touch events as a player. No direct engine.input calls.
module.exports = async (cdp, evaluate, sleep) => {
  const frames = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const waitFor = async (expression, label, timeout = 3000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await sleep(35);
    }
    throw new Error(label + ': ' + JSON.stringify(await evaluate('(()=>{const s=__gameslop.engine.state,p=s.players[0];return {status:s.status,x:p.x,y:p.y,vy:p.vy,grounded:p.grounded,jumpHeld:p.jumpHeld,held:p.held,camera:s.camera,lives:p.lives,inputLog:s.inputLog.slice(-12)};})()')));
  };
  const key = (type, code, value) => cdp('Input.dispatchKeyEvent', { type, code, key: value });
  const screenshot = async name => {
    await frames();
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    const output = path.resolve('docs/game-screenshots/commando-spillway-' + name + '.png');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, Buffer.from(shot.data, 'base64'));
  };
  await evaluate(`window.__spillwayErrors=[];
    addEventListener('error',e=>__spillwayErrors.push(e.message));
    addEventListener('unhandledrejection',e=>__spillwayErrors.push(String(e.reason)));
    document.querySelector('#crt').checked=false;
    document.querySelector('#crt').dispatchEvent(new Event('change'));
    document.querySelector('#game').scrollIntoView({block:'center'});`);
  await evaluate('__gameslop.renderer.environment.loadStage(2)');

  for (const [difficulty, expected] of [['easy', 5], ['normal', 3], ['hard', 1]]) {
    const loot = await evaluate(`(()=>{
      const e=__gameslop.engine;e.start({difficulty:${JSON.stringify(difficulty)}});
      for(let i=0;i<2;i++){e.state.status='clear';e.advance();}
      const supplies=e.state.level.supplies;
      return {guns:supplies.filter(p=>SlopCommando.weapons[p.type]).length,
        grenade:supplies.some(p=>p.type==='G'),optional:supplies.every(p=>p.optional),
        nuke:supplies.some(p=>p.type==='N')};
    })()`);
    assert.equal(loot.guns, expected, difficulty + ' has the requested sparse authored gun count');
    assert.equal(loot.grenade, false, 'no authored grenade launcher blocks the climbing route');
    assert.equal(loot.optional, true, 'every authored pickup is an optional detour');
    if (difficulty === 'hard') assert.equal(loot.nuke, false, 'hard still excludes nukes');
    console.log('PASS ' + difficulty + ' Spillway loot: ' + expected + ' optional guns, no forced grenade');
  }

  const setup = async (placement, showRoute = false) => {
    await evaluate(`(()=>{
      const e=__gameslop.engine;e.release();e.start({difficulty:'normal'});
      for(let i=0;i<2;i++){e.state.status='clear';e.advance();}
      const s=e.state,l=s.level,p=s.players[0];s.waveTime=-999;s.banner=0;
      if(!${showRoute}){l.spawns=[];l.supplies=[];l.hazards=[];s.enemies=[];s.pickups=[];}
      const ledges=l.platforms.filter(q=>!q.ground).sort((a,b)=>a.y-b.y);
      const crest=ledges[0];
      const placement=${JSON.stringify(placement)};
      let platform=crest,x=placement.x??465;
      if(placement.kind==='start'){platform=l.platforms.find(q=>q.ground);x=110;}
      if(placement.kind==='middle'){
        const pairs=ledges.flatMap(a=>ledges.filter(b=>b.y>a.y+30&&b.y<=a.y+110&&a.x+a.w/2>=b.x+20&&a.x+a.w/2<=b.x+b.w-20).map(b=>({a,b})));
        pairs.sort((a,b)=>Math.abs(a.a.y-l.height/2)-Math.abs(b.a.y-l.height/2));
        if(!pairs.length)throw new Error('No safe middle-route descent pair');
        platform=pairs[0].a;x=platform.x+platform.w/2-p.w/2;
      }
      p.x=x;p.y=platform.y-p.h;p.vy=0;p.vx=0;p.grounded=true;p.onGround=!!platform.ground;
      p.invincible=${showRoute ? 0 : 999};p.cloak=0;
      s.camera.y=Math.max(0,Math.min(l.height-540,p.y-(placement.kind==='middle'?330:235)));
      const lower=ledges.find(q=>q.y>platform.y+1&&p.x+p.w>q.x&&p.x<q.x+q.w);
      window.__spillwayPlacement={upperY:platform.y,lowerY:lower?.y,startY:p.y,cameraY:s.camera.y,lives:p.lives};
      document.querySelector('#game').focus({preventScroll:true});
    })()`);
    await waitFor("__gameslop.engine.state.status==='playing'&&document.querySelector('#title-screen').hidden&&document.querySelector('#overlay').hidden", 'game controls become active');
    await frames();
    await evaluate('(()=>{const s=__gameslop.engine.state;s.banner=0;if(s.boss)s.boss.cooldown=999;s.enemies.forEach(e=>e.cooldown=999);})()');
    return evaluate('__spillwayPlacement');
  };
  const assertLower = async (placement, label) => {
    await waitFor(`(()=>{const p=__gameslop.engine.state.players[0];return p.grounded&&Math.abs(p.y+p.h-${placement.lowerY})<.1;})()`, label + ' reaches the first lower shelf');
    await sleep(650);
    const result = await evaluate('(()=>{const s=__gameslop.engine.state,p=s.players[0];return {feet:p.y+p.h,grounded:p.grounded,lives:p.lives,cameraY:s.camera.y};})()');
    assert.equal(result.feet, placement.lowerY, label + ' held combo must not drop through a second shelf');
    assert.equal(result.grounded, true, label + ' stops on the lower shelf');
    assert.equal(result.lives, placement.lives, label + ' descent preserves lives');
    return result;
  };
  const keyboardReturn = async (placement, label) => {
    await key('keyUp', 'KeyZ', 'z');await key('keyUp', 'ArrowDown', 'ArrowDown');
    await waitFor("!__gameslop.engine.state.players[0].jumpHeld&&!__gameslop.engine.state.players[0].held.down", label + ' releases the drop combo');
    await key('keyDown', 'KeyZ', 'z');
    await waitFor(`__gameslop.engine.state.players[0].y<${placement.upperY}-42`, label + ' rises back above the upper shelf');
    await key('keyUp', 'KeyZ', 'z');
    await waitFor(`(()=>{const p=__gameslop.engine.state.players[0];return p.grounded&&Math.abs(p.y+p.h-${placement.upperY})<.1;})()`, label + ' lands back on the upper shelf');
  };
  for (const [label, x] of [['left edge', 16], ['center', 465], ['right edge', 914]]) {
    const placement = await setup({ kind: 'crest', x });
    assert.ok(placement.lowerY > placement.upperY && placement.lowerY - placement.upperY <= 110, label + ' has a reachable retreat shelf');
    await key('keyDown', 'ArrowDown', 'ArrowDown');await key('keyDown', 'KeyZ', 'z');
    await assertLower(placement, 'crest ' + label);
    await keyboardReturn(placement, 'crest ' + label);
    console.log('PASS keyboard drop and return at boss crest ' + label);
  }
  const middle = await setup({ kind: 'middle' });
  await key('keyDown', 'ArrowDown', 'ArrowDown');await key('keyDown', 'KeyZ', 'z');
  const descended = await assertLower(middle, 'middle route');
  assert.ok(descended.cameraY > middle.cameraY + 10, 'camera follows the player down the climb');
  await key('keyUp', 'KeyZ', 'z');await key('keyUp', 'ArrowDown', 'ArrowDown');await frames();
  console.log('PASS climb camera follows a safe descent');

  for (const kind of ['start', 'middle', 'crest']) {
    await setup({ kind, x: 465 }, true);
    await screenshot('route-' + kind);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const mobile = await setup({ kind: 'crest', x: 465 });
  await evaluate('window.scrollTo(0,0)');
  await waitFor("getComputedStyle(document.querySelector('.touch-controls')).display==='flex'", 'landscape touch controls are visible');
  await frames();
  const touches = await evaluate(`['down','jump'].map((action,i)=>{
    const b=document.querySelector('[data-action='+action+']').getBoundingClientRect();
    return {x:b.x+b.width/2,y:b.y+b.height/2,id:i+1};
  })`);
  assert.ok(touches.every(p=>p.x>0&&p.x<844&&p.y>0&&p.y<390), 'both touch targets fit in landscape');
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
  await assertLower(mobile, 'mobile multi-touch');
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor("!__gameslop.engine.state.players[0].jumpHeld&&!__gameslop.engine.state.players[0].held.down", 'mobile releases the drop combo');
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touches[1]] });
  await waitFor(`__gameslop.engine.state.players[0].y<${mobile.upperY}-42`, 'mobile jump rises back to the crest');
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor(`(()=>{const p=__gameslop.engine.state.players[0];return p.grounded&&Math.abs(p.y+p.h-${mobile.upperY})<.1;})()`, 'mobile jump lands back on the crest');
  console.log('PASS mobile Down + Jump drops once and Jump returns to boss crest');
  await setup({ kind: 'crest', x: 160 }, true);await screenshot('mobile-crest');
  assert.deepEqual(await evaluate('__spillwayErrors'), [], 'no browser runtime errors');
  console.log('All Spillway browser QA checks passed.');
};
