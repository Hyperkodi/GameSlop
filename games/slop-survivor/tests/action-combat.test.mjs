import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,WEAPONS,validRun,normalizeSave,LEVELS} from '../data.mjs';
import {createRun,createTournamentRun,chooseBoon,chooseUpgrade,tick,fire,makeWeapon,spawnWave,hit,reviveTournament} from '../engine.mjs';
import {routePoint,encounterFor,advanceHeat,vent,firingPoint,weakSection} from '../encounters.mjs';
import {sectionVisible,sectionDistance,closeSectionGaps,updatePositions,advanceSnake} from '../snake.mjs';
import {WeaponPosePlayer} from '../player-poses.mjs';
import {play} from './action-harness.mjs';
import {upgradeCombat,actionSpeed} from '../action-combat.mjs';
import {createRun as legacyRun} from './legacy-engine.mjs';
import {DIFFICULTIES} from '../data.mjs';
function ready(chapter=0,seed=77){const save=defaultSave(0);for(let i=0;i<100;i++)save.clears[`${i}:easy`]=true;const r=createRun(save,chapter,'easy',seed);chooseBoon(r,'damage');r.state='playing';r.pending=0;r.choices=[];r.lastChoice=1e6;r.manual=true;for(const snake of r.snakes)snake.distance=700-snake.id*100;updatePositions(r);return {r,save};}
test('new encounters cover six route styles, one through four independent snakes, and longer bodies',()=>{
 const styles=new Set(),counts=new Set();for(let chapter=0;chapter<100;chapter++){
  const {r}=ready(chapter);styles.add(r.encounter);counts.add(r.snakes.length);assert.ok(validRun(r));
  assert.equal(r.segments.filter(s=>s.head).length,r.snakes.length);assert.ok(r.segments.reduce((n,s)=>n+s.pieces,0)>LEVELS[chapter].segments);
 }assert.equal(styles.size,6);assert.deepEqual([...counts].sort(),[1,2,3,4]);assert.equal(encounterFor(4).count,4);
});
test('every new wave enters from above the screen with no body preloaded into the arena',()=>{
 for(let chapter=0;chapter<100;chapter++){
  const {r}=ready(chapter);spawnWave(r);assert.ok(r.snakes.every(s=>s.distance===-s.id*120));
  assert.ok(r.segments.every(s=>!sectionVisible(s)));assert.ok(r.segments.every(s=>s.points.every(p=>p.y<0)));
  r.manual=false;for(let i=0;i<35;i++)tick(r,.05);
  assert.ok(r.segments.some(sectionVisible));assert.ok(r.segments.every(s=>s.points.every(p=>p.y<210)));
 }
});
test('movement is moderated and level scaling stays bounded through the entire campaign',()=>{
 for(let chapter=0;chapter<100;chapter++){
  const {r}=ready(chapter),e=encounterFor(chapter,r.wave),previous=(160+Math.min(70,r.wave*10))*e.speed*[1,1,.9,.87,.85][e.count]*LEVELS[chapter].speed;
  assert.ok(actionSpeed(r)<previous*.76);assert.ok(actionSpeed(r)>85);
  const before=r.snakes[0].distance;r.manual=false;r.boons=['frenzy100'];for(let i=0;i<20;i++)tick(r,.05);
  assert.ok(Math.abs(r.snakes[0].distance-before-actionSpeed(r)*r.snakes[0].speed)<.001,'engine must not stack legacy level speed on top');
  for(const difficulty of ['easy','hard','impossible']){r.difficulty=difficulty;r.wave=6;assert.ok(actionSpeed(r)<200);}
 }
});
test('routes are deterministic, curved, continuous, seed-dependent and bounded',()=>{
 const {r}=ready(4),copy=JSON.parse(JSON.stringify(r)),other=ready(4,999).r;
 for(const snake of r.snakes){let bends=0,old=routePoint(r,0,snake.id);for(let d=1;d<2400;d+=3){const p=routePoint(r,d,snake.id);assert.ok(Math.hypot(p.x-old.x,p.y-old.y)<4.1);if(Math.abs(p.angle-old.angle)>.001)bends++;assert.ok(p.x>45&&p.x<435);assert.deepEqual(p,routePoint(copy,d,snake.id));old=p;}assert.ok(bends>150);}
 assert.notDeepEqual(routePoint(r,500),routePoint(other,500));
});
test('breaking one snake recoils only that snake while its rivals keep advancing',()=>{
 const {r}=ready(4),first=r.snakes[0],other=r.snakes[1],a=first.distance,b=other.distance,dead=r.segments.find(s=>s.snakeId===0&&!s.head);
 closeSectionGaps(r,new Set([dead.id]));assert.ok(first.distance<a);assert.equal(other.distance,b);advanceSnake(r,.05,70);assert.ok(other.distance>b);assert.ok(r.segments.filter(s=>s.snakeId!==0).every(s=>!s.retreat));
});
test('idle play fires nothing and loses; predictive active aim wins across five opening seeds',()=>{
 for(const seed of [7,41,77,123,915]){const idle=play({seed,mode:'idle'});assert.equal(idle.result,'lost');assert.equal(idle.kills,0);assert.ok(idle.r.weapons.every(w=>w.totalDamage===0));const active=play({seed});assert.equal(active.result,'won',JSON.stringify({seed,...active,r:undefined}));assert.ok(active.seconds>35&&active.seconds<240);}
});
test('parking a held trigger cannot farm a win even if upgrades are collected',()=>{
 for(const seed of [7,41,77,123,915])assert.equal(play({seed,mode:'parked'}).result,'lost');
});
test('direct fire follows the crosshair and actually starts at the rotated cannon muzzle',()=>{
 const {r}=ready();r.aimX=50;r.aimY=400;const w=makeWeapon('coin'),t=r.segments.find(sectionVisible);fire(r,w,t);const b=r.bullets[0],m=firingPoint(r);assert.equal(b.x,m.x);assert.equal(b.y,m.y);assert.ok(Math.abs(Math.atan2(b.vy,b.vx)-m.angle)<1e-10);
});
test('heat locks fire, releasing cools it, venting has a real firing cost, pause freezes everything',()=>{
 const {r}=ready();for(let i=0;i<210;i++)advanceHeat(r,.05);assert.equal(r.overheated,true);assert.equal(advanceHeat(r,.05),false);r.manual=false;for(let i=0;i<80;i++)advanceHeat(r,.05);assert.equal(r.overheated,false);r.heat=.8;r.manual=true;assert.equal(vent(r),true);assert.equal(advanceHeat(r,.05),false);assert.equal(vent(r),false);r.state='paused';const copy=JSON.stringify(r);tick(r,.05);assert.equal(JSON.stringify(r),copy);
});
test('napalm arrives from above, persists at its aimed location and does not create muzzle bullets',()=>{
 const {r}=ready();r.weapons=[makeWeapon('burn')];const t=r.segments.find(sectionVisible);r.aimX=t.x;r.aimY=t.y;fire(r,r.weapons[0],t);assert.equal(r.bullets.length,0);assert.equal(r.effects[0].type,'airstrike');const {x,y}=r.effects[0];r.manual=false;r.rootUntil=10;
 for(let i=0;i<15;i++)tick(r,.05);assert.ok(r.effects.some(e=>e.type==='hazard'&&e.style==='fire'&&e.x===x&&e.y===y));assert.ok(r.weapons[0].totalDamage>0);
});
test('all 24 modern weapons and their legendary variants damage aimed sections and remain saveable',()=>{
 for(const legendary of [false,true])for(const definition of WEAPONS){const {r}=ready(),w=makeWeapon(definition.id);w.legendary=legendary;r.weapons=[w];r.rootUntil=100;const t=r.segments.find(sectionVisible);r.aimX=t.x;r.aimY=t.y;r.manual=true;for(const s of r.segments)s.hp=s.maxHp=1e7;
  for(let i=0;i<150;i++)tick(r,.05);assert.ok(w.totalDamage>0,definition.id);assert.ok(validRun(r),definition.id);
 }
});
test('weak sections grant damage, support casts never swap the held cannon, and multi-snake saves resume exactly',()=>{
 const {r,save}=ready(4),s=r.segments.find(s=>weakSection(r,s)),w=makeWeapon('coin');w.crit=0;s.armor=false;const before=s.hp;hit(r,s,w,100);assert.ok(Math.abs(before-s.hp-165)<1e-8);
 const pose=new WeaponPosePlayer();r.events=[{type:'fire',weapon:'burn'},{type:'fire',weapon:'gas'}];assert.equal(pose.update(r).weapon,'coin');save.run=r;const resumed=normalizeSave(JSON.parse(JSON.stringify(save)),0).run;assert.ok(resumed);for(let i=0;i<40;i++){tick(r,.05);tick(resumed,.05);}assert.deepEqual(resumed,r);
 for(const key of ['heat','routeSeed']){const bad=JSON.parse(JSON.stringify(r));bad[key]=NaN;assert.equal(validRun(bad),false);}const bad=JSON.parse(JSON.stringify(r));bad.snakes[1].id=bad.snakes[0].id;assert.equal(validRun(bad),false);
});
test('every snake can breach and tournament revives reset all snake positions',()=>{
 const {r}=ready(4);r.manual=false;r.snakes[3].distance=4800;updatePositions(r);const health=r.health;tick(r,0);assert.equal(r.health,health-1);assert.ok(r.snakes[3].distance<4800);
 const t=createTournamentRun(defaultSave(0));chooseBoon(t,'damage');t.state='revive';t.health=0;t.wave=9;spawnWave(t);assert.equal(t.snakes.length,4);assert.ok(reviveTournament(t));assert.ok(t.snakes.every(s=>s.distance===-s.id*120));assert.ok(validRun(t));
});
test('opening a legacy saved battle upgrades combat once and preserves earned progress',()=>{
 const save=defaultSave(0),r=legacyRun(save,0,'easy',51);chooseBoon(r,'damage');r.state='paused';r.health=3;r.charge=63;r.score=777;r.kills=12;r.waveKills=12;
 for(const s of r.segments)s.hp*=.6;const arsenal=JSON.stringify(r.weapons),choices=JSON.stringify(r.choices);
 upgradeCombat(r,LEVELS[0],DIFFICULTIES[0]);assert.equal(r.combatVersion,3);assert.equal(r.health,3);assert.equal(r.score,777);assert.equal(r.charge,63);assert.equal(r.kills,12);assert.equal(JSON.stringify(r.weapons),arsenal);assert.equal(JSON.stringify(r.choices),choices);assert.ok(r.segments.every(s=>Math.abs(s.hp/s.maxHp-.6)<1e-9));assert.ok(validRun(r));
 const snapshot=JSON.stringify(r);upgradeCombat(r,LEVELS[0],DIFFICULTIES[0]);assert.equal(JSON.stringify(r),snapshot);
});
test('v3.0 saved battles receive faster-combat health tuning once without resetting their position',()=>{
 const {r}=ready();delete r.actionBalance;const hp=r.segments[0].hp,distance=r.snakes[0].distance;
 upgradeCombat(r,LEVELS[0],DIFFICULTIES[0]);assert.equal(r.snakes[0].distance,distance);assert.equal(r.segments[0].hp,hp*.13/.43);assert.equal(r.actionBalance,2);
 const copy=JSON.stringify(r);upgradeCombat(r,LEVELS[0],DIFFICULTIES[0]);assert.equal(JSON.stringify(r),copy);assert.ok(validRun(r));
});
