const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine, ground, FETCH, HOME, RETURN_TIME } = require('../js/engine.js');
function simulate(engine, seconds, input) { for (let i = 0; i < seconds * 120; i++) engine.update(1 / 120, typeof input === 'function' ? input(engine.state) : input); }
test('ready state is stationary and restart resets the complete round', () => {
  const e = createEngine(); simulate(e, 2, { move: 1 }); assert.equal(e.state.dog.x, HOME);
  e.start(); simulate(e, 1, { move: 1 }); assert.ok(e.state.dog.x > HOME + 150);
  e.start(); assert.equal(e.state.score, 0); assert.equal(e.state.dog.x, HOME); assert.equal(e.state.phase, 'outbound');
});
test('sprinting builds speed; rolling coasts even with direction and sprint held', () => {
  for(const dir of [1,-1]){
    const a=createEngine(3),b=createEngine(3);a.start();b.start();
    for(const e of [a,b]){e.state.obstacles=[];e.state.platforms=[];Object.assign(e.state.dog,{x:10000,y:490});}
    simulate(a,.8,{move:dir,sprint:true});simulate(b,.8,{move:dir});
    assert.ok(Math.abs(a.state.dog.vx)>Math.abs(b.state.dog.vx)+250);
    const initial=Math.abs(a.state.dog.vx);let previous=initial;
    for(let i=0;i<240;i++){a.update(1/120,{move:dir,roll:true,sprint:true});const speed=Math.abs(a.state.dog.vx);assert.ok(speed<=previous);previous=speed;}
    assert.ok(previous>initial*.35&&previous<initial*.7);assert.equal(a.state.dog.sprinting,false);
    simulate(a,12,{move:dir,roll:true,sprint:true});assert.equal(a.state.dog.vx,0);assert.equal(a.state.dog.rolling,true);
    a.update(1/120,{});assert.equal(a.state.dog.vx,0);assert.ok(!a.state.events.some(e=>e.type==='boost'));
  }
});
test('a stationary roll cannot charge or propel, and all directional input is ignored',()=>{
 const a=createEngine(3),b=createEngine(3);a.start();b.start();
 simulate(a,1,{move:1,roll:true,sprint:true});assert.equal(a.state.dog.vx,0);assert.equal(a.state.dog.charge,0);
 for(const e of [a,b]){e.state.obstacles=[];Object.assign(e.state.dog,{x:10000,y:490,vx:500});}
 simulate(a,1,{move:-1,roll:true});simulate(b,1,{roll:true});
 assert.equal(a.state.dog.vx,b.state.dog.vx);assert.ok(b.state.dog.vx>250);
});
test('jump is edge-triggered, variable height, and lands back on terrain', () => {
  const a = createEngine(), b = createEngine(); a.start(); b.start();
  simulate(a, .3, { jump: true }); b.update(1 / 120, { jump: true }); simulate(b, .3, {});
  assert.ok(a.state.dog.y < b.state.dog.y - 30);
  simulate(a, 2, { jump: true }); assert.equal(a.state.dog.grounded, true); assert.equal(a.state.dog.y, ground(a.state.dog.x));
});
test('crate requires a fast roll and can only award its bonus once', () => {
  const e = createEngine(); e.start(); const crate = e.state.obstacles.find(o => o.type === 'crate');
  e.state.pickups=[];
  Object.assign(e.state.dog, { x: crate.x - 47, y: ground(crate.x - 47), vx: 450 });
  e.update(.03, { move: 1, roll: true }); assert.equal(crate.broken, true); assert.ok(e.state.events.some(v => v.type === 'smash'));
  assert.equal(e.state.obstaclePoints,1000);assert.equal(e.state.score,1000);
  e.update(.03, { move: 1, roll: true }); assert.ok(!e.state.events.some(v => v.type === 'smash'));
  assert.equal(e.state.obstaclePoints,1000);assert.equal(e.state.score,1000);
  e.start();assert.equal(e.state.obstaclePoints,0);
});
test('fetch switches objective, starts the timer, and home completes delivery', () => {
  const e = createEngine(); e.start(); e.state.dog.x = FETCH; e.state.dog.y = ground(FETCH);
  e.update(1 / 120, {}); assert.equal(e.state.phase, 'return'); assert.equal(e.state.dog.carrying, true);
  assert.equal(e.state.returnTime, RETURN_TIME); assert.equal(e.state.score, 0);
  simulate(e, 1, {}); assert.ok(e.state.returnTime < RETURN_TIME);
  e.state.dog.x = HOME; e.update(1 / 120, {}); assert.equal(e.state.phase, 'won');
  const score = e.state.score; simulate(e, 1, { move: 1 }); assert.equal(e.state.score, score);
});
test('timeout ends the return and stops physics', () => {
  const e = createEngine(); e.start(); e.state.dog.x = FETCH; e.state.dog.y = ground(FETCH); e.update(1 / 120, {});
  e.state.returnTime = .01; simulate(e, .05, {}); assert.equal(e.state.phase, 'lost'); const x = e.state.dog.x;
  simulate(e, 1, { move: 1 }); assert.equal(e.state.dog.x, x);
});
test('the complete route is beatable using movement, jumps and rolling', () => {
  const e = createEngine(); e.start(); let lastPhase = 'outbound';
  for (let i = 0; i < 120 * 150 && !['won', 'lost'].includes(e.state.phase); i++) {
    const s = e.state, d = s.dog, returning = s.phase === 'return';
    const direction=returning?-1:1;
    const fence = s.obstacles.find(o => !o.broken&&(o.type==='rock'||o.type==='fence'&&!returning)&&(o.x-d.x)*direction>0&&(o.x-d.x)*direction<Math.max(190,Math.abs(d.vx)*.30));
    const jump = !!fence;
    const roll=s.obstacles.some(o=>o.type==='crate'&&!o.broken&&(o.x-d.x)*direction>-44&&(o.x-d.x)*direction<180);
    e.update(1 / 120, { move: direction, sprint:true, roll, jump });
    if (s.phase !== lastPhase) lastPhase = s.phase;
  }
  assert.equal(e.state.phase, 'won', `route ended at ${e.state.dog.x}, phase ${e.state.phase}`);
  assert.ok(e.state.coins > 10); assert.ok(e.state.returnTime > 5); assert.ok(e.state.score > 1000);
});

test('rolling stops on flat ground and boost pads with direction and sprint held',()=>{
 for(const id of [3,6])for(const move of [-1,0,1]){
  const e=createEngine(id);e.start();e.state.obstacles=[];e.state.platforms=[];e.state.junctions=[];
  const x=3000;e.state.pads=[x];Object.assign(e.state.dog,{x,y:ground(x,id),vx:0});
  simulate(e,1,{move,roll:true,sprint:true});assert.equal(e.state.dog.x,x);assert.equal(e.state.dog.vx,0);
  e.state.dog.vx=800;let previous=800;
  for(let i=0;i<600;i++){e.update(1/120,{move,roll:true,sprint:true});assert.ok(Math.abs(e.state.dog.vx)<=previous);previous=Math.abs(e.state.dog.vx);}
  assert.equal(e.state.dog.vx,0);const stopped=e.state.dog.x;
  simulate(e,1,{move:1,roll:true,sprint:true});assert.equal(e.state.dog.x,stopped);
  simulate(e,.2,{move:1,sprint:true});assert.ok(e.state.dog.x>stopped);assert.equal(e.state.dog.rolling,false);
 }
});

test('rolling gains speed downhill and brakes harder uphill in both directions',()=>{
 for(const direction of [-1,1]){
  const speeds=[];
  for(const grade of [-.3,0,.3]){
   const e=createEngine(3);e.start();e.state.obstacles=[];e.state.junctions=[];
   const incline=grade*direction;
   e.state.platforms=[{id:'test-slope',x:9000,end:11000,y:-500,surface:[[9000,-500-incline*1000],[11000,-500+incline*1000]]}];
   Object.assign(e.state.dog,{x:10000,y:-500,vx:500*direction,grounded:true,platform:true,platformId:'test-slope'});
   simulate(e,.5,{move:-direction,sprint:true,roll:true});
   assert.equal(e.state.dog.platformId,'test-slope');
   speeds.push(e.state.dog.vx*direction);
  }
  assert.ok(speeds[0]<speeds[1]-150,'uphill brakes faster than flat ground');
  assert.ok(speeds[2]>500,'downhill increases rolling speed');
 }
});

test('rolling uses the supporting platform slope and ignores terrain while airborne',()=>{
 const a=createEngine(1),b=createEngine(3);
 for(const airborne of [false,true]){
  for(const e of [a,b]){
   e.start();e.state.obstacles=[];e.state.junctions=[];
   e.state.platforms=[{id:'flat',x:9000,end:11000,y:-1000}];
   Object.assign(e.state.dog,{x:10000,y:-1000,vx:500,vy:0,grounded:!airborne,platform:!airborne,platformId:airborne?null:'flat'});
   simulate(e,.25,{roll:true});
  }
  assert.equal(a.state.dog.vx,b.state.dog.vx);
  assert.ok(a.state.dog.vx<500);
 }
});
