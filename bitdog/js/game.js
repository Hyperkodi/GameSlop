(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const campaign=BitDogCampaign.create();
  let level=BitDogLevels.get(1),pendingStart=false;
  const presentation={
    1:{title:'Maximum<br><em>zoomies.</em>',start:'Fetch! Follow the coins →',home:'Fences are open!',bump:'Jump rocks and fences!'},
    2:{title:'Harvest<br><em>hustle.</em>',start:'Hop onto the harvest wagons for extra coins ↑',home:'Your cleared path is waiting!',bump:'Jump hay bales; roll through apple crates.'},
    3:{title:'Electric<br><em>zoomies.</em>',start:'Take the rooftops to the blue cables ↑',home:'The powered cables work both ways!',bump:'Jump barriers and sparking junctions!'},
    4:{title:'A forest<br><em>with spring.</em>',start:'Land on a mushroom. Hold Jump to bounce higher!',home:'Bounce over the mud on your way home!',bump:'Jump the stumps; roll through fallen wood.'},
    5:{title:'Snowball<br><em>zoomies.</em>',start:'Sprint, then hold Roll to gather snow. Jump to shake it off!',home:'Roll through the soft snow piles!',bump:'Jump icy rocks. A snowball breaks soft snow.'},
    6:{title:'Catch the<br><em>next breeze.</em>',start:'Jump into an umbrella to glide. Tap Jump to fold it.',home:'The boardwalk is always there to catch you.',bump:'Jump sandbags; roll through luggage.'},
    7:{title:'One giant<br><em>dog leap.</em>',start:'Long moon jumps! Blue fields mean normal gravity and shorter jumps.',home:'Take the low route or hop the crater shelves!',bump:'Jump moon rocks; roll through supply crates.'},
    8:{title:'There’s no<br><em>place like home.</em>',start:'One last fetch. All your favorite shortcuts await.',home:'Bring this last Bitcoin home!',bump:'Jump obstacles and sparks; roll through crates.'}
  };
  const view=()=>presentation[level.id];
  let engine = BitDog.createEngine(level.id,{hearts:campaign.hearts}), renderer = BitDog.createRenderer($('game'),level.id);
  const opening = BitDogCinematic.createTimeline();
  const audio = BitDogAudio.create();
  const keys = new Set(), touch = { move: 0, jump: false, roll: false, sprint: false }, owners = new Map();
  let paused = false, last = performance.now(), toastUntil = 0, muted = false, best = 0;
  const bestKey=()=>`gameslop:bitdog:best:level:${level.id}`;
  function loadBest(){best=0;try{best=Number(localStorage.getItem(bestKey()))||(level.id===1?Number(localStorage.getItem('gameslop:bitdog:best:v2')):0)||0;}catch{}$('best').textContent=best?best.toLocaleString():'—';}
  try { muted = localStorage.getItem('gameslop:muted') === '1'; } catch (_) {}
  loadBest();
  $('best').textContent = best ? best.toLocaleString() : '—';
  const running = () => !opening.active && ['outbound', 'return'].includes(engine.state.phase) && !paused;
  const joystick = GameslopJoystick.create($('joystick'), { axes: 'horizontal', enabled: running, onMove: p => { touch.move = p.x; } });
  function clearInput() {
    keys.clear(); joystick.reset(); touch.move = 0; touch.jump = false; touch.roll = false; touch.sprint = false;
    for (const [name, id] of owners) { const el = $(name); if (el.hasPointerCapture(id)) el.releasePointerCapture(id); el.classList.remove('active'); }
    owners.clear();
  }
  function unlockAudio() { audio.unlock(); }
  function sound(type) { audio.play(type); }
  function toast(message, duration = 2.3) { $('toast').textContent = message; $('toast').classList.add('show'); toastUntil = performance.now() + duration * 1000; }
  function overlay(title, copy, button, eyebrow, noteText) {
    $('next-level').hidden=true;
    $('overlay').classList.remove('result-overlay'); $('finish-stats').hidden = true;
    $('overlay-title').innerHTML = title; $('overlay-copy').textContent = copy;
    $('play').innerHTML = button + ' <span>↗</span>'; $('eyebrow').firstElementChild.textContent = eyebrow;
    $('overlay-note').textContent = noteText; $('overlay').hidden = false; $('scene-label').hidden = true;
  }
  function start() {
    if (!renderer.artReady || opening.active) return;
    if(engine.state.phase==='won'||engine.state.phase==='lost'){
      if(!campaign.advance())campaign.restart();
      pendingStart=true;selectLevel(campaign.level);return;
    }
    audio.stopEffects();
    $('next-level').hidden=true;
    $('overlay').classList.remove('result-overlay'); $('finish-stats').hidden = true;
    unlockAudio(); clearInput(); paused = false; engine.reset(); renderer.reset(); last = performance.now();
    opening.start(); $('overlay').hidden = true; $('hud').hidden = true; $('scene-caption').hidden = true;
    $('toast').classList.remove('show'); $('cinematic-controls').hidden = false;
    $('cinematic-pause').textContent = 'Ⅱ'; $('cinematic-pause').setAttribute('aria-label', 'Pause opening');
    document.body.classList.add('opening-active'); document.body.dataset.openingShot = 'throw';
    $('play').blur(); sound('start');
  }
  function beginLevel() {
    audio.stopEffects();
    opening.skip(); clearInput(); paused = false; engine.start(); renderer.reset(); last = performance.now();
    $('overlay').hidden = true; $('hud').hidden = false; $('scene-caption').hidden = true;
    $('cinematic-controls').hidden = true; document.body.classList.remove('opening-active'); delete document.body.dataset.openingShot;
    $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Pause game');
    toast(view().start, 3.5); sound('start'); $('play').blur();
  }
  function pause() {
    if (opening.active) {
      paused = !paused; clearInput();
      if(paused)renderer.pauseOpening();
      $('cinematic-pause').textContent = paused ? '▷' : 'Ⅱ';
      $('cinematic-pause').setAttribute('aria-label', paused ? 'Resume opening' : 'Pause opening');
      $('cinematic-label').textContent = paused ? 'PAUSED' : opening.state.label.toUpperCase();
      if (!paused) { unlockAudio(); last = performance.now(); }
      return;
    }
    if (!['outbound', 'return'].includes(engine.state.phase)) return;
    paused = !paused; clearInput();
    $('pause').textContent = paused ? '▷' : 'Ⅱ'; $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    if (paused) overlay('Sit.<br><em>Stay.</em>', 'Take a breather. Your Bitcoin can wait.', 'KEEP FETCHING', 'PAUSED', controls.codes('pause').map(controls.label).join(' / ')+' TO RESUME');
    else { $('overlay').hidden = true; unlockAudio(); last = performance.now(); }
  }
  function finish(won) {
    clearInput();
    if (won && engine.state.score > best) { best = engine.state.score; try { localStorage.setItem(bestKey(), String(best)); } catch (_) {} $('best').textContent = best.toLocaleString(); }
    const s = engine.state;campaign.finish(s);
    const title=won?'Very <em>good boy!</em>':s.failure==='hearts'?'Time for<br><em>a breather.</em>':'Dinner is<br><em>getting cold.</em>';
    const copy=won?`Bitcoin delivered! ${s.coins} coins collected, ${Math.floor(s.returnTime)} seconds to spare. ${s.hearts} of 5 hearts remain for the run.`
      :s.failure==='hearts'?'All five hearts are gone. Start a new run from level 1.':'The return timer ran out. Start a new run from level 1 with five hearts.';
    overlay(title,copy,won&&level.id<8?'NEXT LEVEL':'START NEW RUN',won?(s.result.perfect?'PERFECT FETCH':'LEVEL COMPLETE'):'RUN OVER',`LEVEL ${level.id} / 8 | RUN TOTAL: ${campaign.score.toLocaleString()} POINTS`);
    if(won&&level.id===8){$('overlay-title').innerHTML='Home, sweet<br><em>home.</em>';$('overlay-copy').textContent=`All eight Bitcoins delivered! ${campaign.score.toLocaleString()} total points with ${s.hearts} of 5 hearts remaining. Very good boy.`;$('eyebrow').firstElementChild.textContent='RUN COMPLETE';}
    $('overlay').classList.add('result-overlay'); $('hud').hidden = true; $('toast').classList.remove('show');
    $('finish-stats').replaceChildren();
    if(won){
      for(const [label,value] of [['Collected coins',s.result.coins],['Obstacle bonus',s.result.obstacles],['Time bonus',s.result.time],['Delivery bonus',s.result.delivery]]){
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value.toLocaleString();$('finish-stats').append(dt,dd);
      }
      $('finish-stats').hidden=false;
    }
  }
  $('play').addEventListener('click', () => paused ? pause() : start());
  $('next-level').addEventListener('click',start);
  $('pause').addEventListener('click', pause);
  $('skip-intro').addEventListener('click', beginLevel);
  $('cinematic-pause').addEventListener('click', pause);
  function paintSound() { audio.setMuted(muted); $('sound').innerHTML = (muted ? 'SOUND OFF' : 'SOUND ON') + ' <span>♫</span>'; $('sound').setAttribute('aria-pressed', String(muted)); }
  $('sound').addEventListener('click', () => { muted = !muted; unlockAudio(); paintSound(); try { localStorage.setItem('gameslop:muted', muted ? '1' : '0'); } catch (_) {} }); paintSound();
  for (const name of ['jump', 'roll', 'sprint']) {
    const el = $(name);
    el.addEventListener('pointerdown', e => { if (!running() || owners.has(name) || e.button !== 0) return; e.preventDefault(); unlockAudio(); owners.set(name, e.pointerId); el.setPointerCapture(e.pointerId); touch[name] = true; el.classList.add('active'); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, e => { if (owners.get(name) !== e.pointerId) return; owners.delete(name); touch[name] = false; el.classList.remove('active'); if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  const controls = BitDogControls.create({clearInput, levelName:()=>level.name});
  const held = action => controls.codes(action).some(code=>keys.has(code));
  addEventListener('keydown', e => {
    if (controls.isOpen()) return;
    if (opening.active && controls.matches('skip',e.code)) { e.preventDefault(); if (!e.repeat) beginLevel(); return; }
    if (controls.matches('pause',e.code) && !e.repeat) { e.preventDefault(); pause(); return; }
    if (opening.active && controls.isMovement(e.code)) { e.preventDefault(); return; }
    if (e.code === 'Enter' && !running() && !opening.active && !e.repeat && !e.target.closest('button,a')) { if (paused) pause(); else if (!running() && !opening.active) start(); return; }
    if (controls.isMovement(e.code) && running()) { e.preventDefault(); keys.add(e.code); }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { clearInput(); if (running() || (opening.active && !paused)) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (running() || (opening.active && !paused)) pause(); } });
  function resized() { clearInput(); renderer.resize(); }
  addEventListener('resize', resized); addEventListener('orientationchange', resized);
  const initialPlayLabel = $('play').innerHTML;
  $('play').disabled = true; $('play').textContent = 'GETTING READY...';
  let introLoaded = false;
  function paintLevel(){
    loadBest();audio.setTrack(level.music);
    $('level-heading').innerHTML=`<i></i> ${level.name.toUpperCase()} <b>0${level.id}</b>`;
    $('overlay-note').textContent=`0${level.id} · ${level.name.toUpperCase()} · A FETCH & RETURN ADVENTURE`;
    const credit=document.querySelector('.audio-credit a');credit.textContent=level.track+' — Kevin MacLeod';credit.href='https://incompetech.com/music/royalty-free/index.html?isrc='+level.isrc;
    document.querySelector('.field-notes>div>span').textContent=`0${level.id} / THE MISSION`;
    document.querySelector('.field-notes>p').textContent=level.hint+' Coins × 100 + seconds left × 50 + 1,000 for delivery + obstacle bonuses.';
    document.body.dataset.level=level.id;
    controls.paint();
  }
  function selectLevel(id){
    if(opening.active||running()||id!==campaign.level)return;
    clearInput();audio.stopEffects();renderer.reset();paused=false;opening.skip();
    level=BitDogLevels.get(id);engine=BitDog.createEngine(level.id,{hearts:campaign.hearts});renderer=BitDog.createRenderer($('game'),level.id);
    audio.setMode('ready');introLoaded=false;$('play').disabled=true;
    overlay(level.id===3?'Electric<br><em>zoomies.</em>':level.id===2?'Harvest<br><em>hustle.</em>':'Maximum<br><em>zoomies.</em>',level.hint,'GETTING READY...','THE ADVENTURES OF BITDOG','');
    $('hud').hidden=true;$('cinematic-controls').hidden=true;$('toast').classList.remove('show');
    document.body.classList.remove('opening-active');delete document.body.dataset.openingShot;
    paintLevel();last=performance.now();
    $('overlay-title').innerHTML=view().title;
  }
  // Old testing links may still carry ?level=; the public run always starts at 1.
  if(new URL(location.href).searchParams.has('level')){
    const url=new URL(location.href);url.searchParams.delete('level');history.replaceState(null,'',url);
  }
  paintLevel();
  if(level.id>1){$('overlay-title').innerHTML=level.id===3?'Electric<br><em>zoomies.</em>':'Harvest<br><em>hustle.</em>';$('overlay-copy').textContent=level.hint;}
  $('overlay-title').innerHTML=view().title;
  function frame(now) {
    document.body.classList.toggle('playing-active',opening.active||running());
    if (!introLoaded && renderer.artReady) {
      introLoaded = true; $('play').disabled = false; $('play').innerHTML = level.id===1?initialPlayLabel:'START LEVEL '+level.id;
      if(pendingStart){pendingStart=false;start();}
    }
    const dt = Math.min((now - last) / 1000, .05); last = now;
    audio.setMode(opening.active?'opening':engine.state.phase,paused);
    if (opening.active) {
      const previous = opening.state;
      const shot = paused ? previous : opening.update(dt);
      audio.update({level,dog:{...engine.state.dog,vx:0,grounded:true,rolling:false,wet:false}},!paused,dt);
      const throwAt=level.throwAt??({4:2.90,5:3.08,6:2.90,7:2.90,8:2.60}[level.id]??2.7);
      if (previous.time<throwAt&&shot.time>=throwAt) sound('throw');
      if (!previous.star && shot.star) sound('star');
      if (previous.id !== 'sprint' && shot.id === 'sprint') {
        if(audio.introGallop)audio.introGallop(level.id);else sound(level.id===3?'intro-gallop-electric':'intro-gallop-v3');
      }
      document.body.dataset.openingShot = shot.id;
      $('cinematic-label').textContent = paused ? 'PAUSED' : `0${BitDogCinematic.SHOTS.findIndex(s=>s.id===shot.id)+1} / ${shot.label.toUpperCase()}`;
      renderer.drawOpening(shot, engine.state, paused);
      if (shot.done) beginLevel();
      requestAnimationFrame(frame); return;
    }
    audio.update(engine.state,running(),dt);
    if (running()) {
      const right = held('right'), left = held('left');
      engine.update(dt, { move: right || left ? Number(right) - Number(left) : touch.move,
        jump: touch.jump || held('jump'),
        sprint: touch.sprint || held('sprint'),
        roll: touch.roll || held('roll') });
      for (const e of engine.state.events) {
        sound(e.type);
        if (['coin', 'smash', 'fetch', 'win','spring','leaves','mushroom','snowbreak','snowshed'].includes(e.type)) renderer.burst(e);
        if (e.type === 'fetch') { toast('GOT IT! Race home ← '+view().home, 4); clearInput(); }
        if (e.type === 'bump' || e.type === 'zap') toast(`${engine.state.hearts} hearts left. ${view().bump}`, 2.2);
        if (e.type === 'gravity') toast('Normal gravity: shorter jumps here.',2.3);
        if (e.type === 'electric') toast('Charged paws! Jump the sparking junctions.',1.8);
        if (['smash','snowbreak','leaves'].includes(e.type)) toast('Obstacle cleared.', 1.2);
        if (e.type === 'win') finish(true);
        if (e.type === 'timeout' || e.type === 'exhausted') finish(false);
      }
    }
    const s = engine.state, returning = s.phase === 'return' || s.phase === 'won';
    $('gravity-status').hidden=level.id!==7||!['outbound','return'].includes(s.phase)||paused;
    $('gravity-status').textContent=s.dog.gravityPocket?'NORMAL GRAVITY / SHORTER JUMPS':'MOON GRAVITY / HIGHER JUMPS';
    $('gravity-status').classList.toggle('normal-gravity',s.dog.gravityPocket);
    $('coins').textContent = String(s.coins).padStart(2, '0');
    $('phase').textContent = returning ? 'BRING IT HOME' : 'THE FETCH';
    $('objective').textContent = returning ? '← Back to your owner!' : 'Find the big Bitcoin →';
    $('hearts').textContent = '\u2665'.repeat(s.hearts) + '\u2661'.repeat(5-s.hearts);
    $('hearts').setAttribute('aria-label', `${s.hearts} of 5 hearts remaining for this run`);
    $('timer-label').textContent = returning ? 'HOME IN' : 'EXPLORE';
    const seconds = Math.floor(returning ? s.returnTime : s.elapsed);
    $('timer').textContent = returning ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '\u2014';
    $('timer').style.color = returning && seconds < 10 ? '#b74e30' : '';
    const progress = returning ? (BitDog.FETCH - s.dog.x) / (BitDog.FETCH - BitDog.HOME) : (s.dog.x - BitDog.HOME) / (BitDog.FETCH - BitDog.HOME);
    $('route-fill').style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
    if (now > toastUntil) $('toast').classList.remove('show');
    renderer.draw(s, paused ? 0 : dt, s.phase === 'ready');
    requestAnimationFrame(frame);
  }
  document.body.dataset.ready = '1'; requestAnimationFrame(frame);
})();
