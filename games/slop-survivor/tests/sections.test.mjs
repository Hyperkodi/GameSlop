import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,normalizeSave,validRun} from '../data.mjs';
import {createRun,chooseBoon,chooseUpgrade,tick,makeWeapon,spawnWave} from '../engine.mjs';
import {groupSections,updatePositions,sectionSpan,sectionDistance} from '../snake.mjs';
function ready(){const save=defaultSave(100),r=createRun(save,0,'easy',77);chooseBoon(r,'damage');chooseUpgrade(r,r.choices[0].id);r.weapons=[];r.pending=0;r.lastChoice=10000;return {save,r};}
function settle(r){for(let i=0;i<300&&r.segments.some(s=>s.retreat>0);i++){r.pending=0;r.state='playing';tick(r,.01);}assert.ok(r.segments.every(s=>s.retreat===0));}
test('25 body pieces become a head and six four-piece health pools without increasing total health',()=>{
 const {r}=ready();assert.equal(r.segments.length,7);assert.equal(r.segments[0].pieces,1);assert.ok(r.segments.slice(1).every(s=>s.pieces===4));
 assert.equal(r.waveMaxHp,1000+Array.from({length:24},(_,i)=>260+(i+1)*3).reduce((a,b)=>a+b,0));
 assert.equal(r.segments[1].points.length,13);assert.equal(r.segments[1].distance-r.segments[2].distance,128);
});
test('breaking a middle section slides the front backward 128 pixels and leaves the tail anchored',()=>{
 const {r}=ready();const head=r.segments[0],broken=r.segments[2],tail=r.segments.at(-1),frontBefore=head.distance,tailBefore=tail.distance;
 broken.hp=0;tick(r,0);assert.equal(head.distance,frontBefore);assert.equal(head.retreat,128);assert.equal(tail.retreat,0);
 r.pending=0;r.state='playing';tick(r,.05);assert.ok(head.distance<frontBefore&&head.distance>frontBefore-128);assert.equal(tail.distance,tailBefore);
 settle(r);assert.ok(Math.abs(head.distance-(frontBefore-128))<1e-8);assert.equal(tail.distance,tailBefore);
 for(let i=1;i<r.segments.length;i++)assert.ok(Math.abs(r.segments[i-1].distance-r.segments[i].distance-sectionSpan(r.segments[i-1]))<1e-8);
 assert.equal(r.kills,4);assert.equal(r.pending,0); // choices were cleared only by this test's settle helper
});
test('simultaneous breaks and another break during recoil accumulate without pulling rear sections forward',()=>{
 const {r}=ready();r.headDistance=1000;updatePositions(r);const head=r.segments[0],tail=r.segments.at(-1),before=head.distance,tailBefore=tail.distance;
 r.segments[1].hp=r.segments[3].hp=0;tick(r,0);assert.equal(head.retreat,256);
 r.pending=0;r.state='playing';tick(r,.05);r.segments[2].hp=0;tick(r,0);settle(r);
 assert.ok(Math.abs(head.distance-(before-384))<1e-8);assert.equal(tail.distance,tailBefore);
});
test('destroying the tail retreats the rest; destroying only the head does not teleport the next section forward',()=>{
 for(const which of ['tail','head']){const {r}=ready();const next=r.segments[1],before=next.distance,oldHead=r.segments[0].distance;
  r.segments[which==='head'?0:r.segments.length-1].hp=0;tick(r,0);settle(r);
  if(which==='head')assert.equal(next.distance,before);else assert.equal(r.segments[0].distance,oldHead-128);
 }
});
test('a projectile can hit either end of a curved section and piercing never damages its four pieces repeatedly',()=>{
 for(const endpoint of [0,12]){const {r}=ready();const w=makeWeapon('coin');w.timer=10;w.crit=0;r.weapons=[w];const section=r.segments[2],p=section.points[endpoint],hp=section.hp;section.armor=false;
  r.bullets=[{id:++r.castId,weapon:'coin',x:p.x,y:p.y,vx:0,vy:0,age:0,life:1,r:1,hits:[],pierce:10,type:'bolt',color:'#fff',tier:1}];
  tick(r,0);assert.equal(section.hp,hp-w.damage);tick(r,0);assert.equal(section.hp,hp-w.damage);
 }
 const {r}=ready(),s=r.segments[1];assert.equal(sectionDistance(s,s.points[0].x,s.points[0].y),0);
});
test('recoil freezes with choices and survives an autosave with deterministic continuation',()=>{
 const {save,r}=ready();r.segments[2].hp=0;tick(r,0);assert.equal(r.state,'choice');const frozen=JSON.stringify(r);tick(r,.05);assert.equal(JSON.stringify(r),frozen);
 save.run=r;const loaded=normalizeSave(JSON.parse(JSON.stringify(save)),100).run;assert.ok(loaded);assert.ok(validRun(loaded));
 for(const x of [r,loaded]){x.pending=0;x.state='playing';tick(x,.05);}assert.deepEqual(loaded,r);
});
test('legacy individual-piece saves retain damage and progress when grouped',()=>{
 const {save,r}=ready();const template=r.segments[1];r.snakeLayout=undefined;
 r.segments=Array.from({length:9},(_,i)=>({...template,id:i+100,head:i===0,hp:100+i,maxHp:200,pieces:undefined,retreat:undefined,points:undefined}));
 const hp=r.segments.reduce((v,s)=>v+s.hp,0);save.run=r;save.coins=789;const restored=normalizeSave(JSON.parse(JSON.stringify(save)),100);
 assert.equal(restored.coins,789);assert.equal(restored.run.segments.length,3);assert.equal(restored.run.segments.reduce((v,s)=>v+s.hp,0),hp);
 const unchanged=JSON.stringify(restored.run);groupSections(restored.run);assert.equal(JSON.stringify(restored.run),unchanged);
});
test('recoil on the final approach prevents a breach before the snake can slide out of danger',()=>{
 const {r}=ready();r.headDistance=1990;updatePositions(r);const health=r.health;r.segments[2].hp=0;tick(r,0);settle(r);assert.equal(r.health,health);
});
test('partial tail sections preserve chapter length and armor retains its one-in-four frequency',()=>{
 const {r}=ready();r.chapter=4;r.wave=0;spawnWave(r);
 assert.equal(r.segments.reduce((v,s)=>v+s.pieces,0),29);assert.equal(r.segments.at(-1).pieces,4);
 assert.deepEqual(r.segments.flatMap((s,i)=>s.armor?[i]:[]),[2,6]);
});
