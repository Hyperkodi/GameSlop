import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionBalls,drawDragonSection} from '../dragon-body.mjs';
import {SPECIES} from '../encounters.mjs';
import {sectionHit,updatePositions} from '../snake.mjs';
import {defaultSave,normalizeSave} from '../data.mjs';
import {createRun,chooseBoon,chooseUpgrade,makeWeapon,tick} from '../engine.mjs';
import {rugTouches} from '../rug-field.mjs';
function ready(){const save=defaultSave(),r=createRun(save,0,'easy',77);chooseBoon(r,'damage');chooseUpgrade(r,r.choices[0].id);r.manual=false;r.pending=0;r.lastChoice=r.time;r.snakes[0].distance=850;updatePositions(r);return {save,r};}
test('every body health pool, including short tails and old saves, has exactly three circles',()=>{
 const {save,r}=ready();
 for(const s of r.segments){const balls=sectionBalls(s);assert.equal(balls.length,s.head?0:3);assert.ok(balls.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.radius>0));}
 for(const pieces of [1,2,3,4]){
  const s={pieces,spacing:24,head:false,x:100,y:100,angle:0};
  const balls=sectionBalls(s);assert.equal(balls.length,3);assert.equal(new Set(balls.map(p=>p.x)).size,3);
 }
 save.run=r;const restored=normalizeSave(JSON.parse(JSON.stringify(save))).run;
 assert.ok(restored);assert.deepEqual(restored.segments.map(s=>s.hp),r.segments.map(s=>s.hp));
 assert.deepEqual(sectionBalls(restored.segments[1]),sectionBalls(r.segments[1]));
});
test('all three circles damage one pool and piercing cannot hit the pool three times',()=>{
 for(let ball=0;ball<3;ball++){
  const {r}=ready(),s=r.segments[2],p=sectionBalls(s)[ball],w=makeWeapon('coin');
  w.timer=10;w.crit=0;r.weapons=[w];s.armor=false;r.time=5*((5-s.id%4)%4);const hp=s.hp;
  r.bullets=[{id:++r.castId,weapon:'coin',x:p.x,y:p.y,vx:0,vy:0,age:0,life:1,r:1,hits:[],pierce:10,type:'bolt',color:'#fff',tier:1}];
  tick(r,0);assert.equal(s.hp,hp-w.damage);tick(r,0);assert.equal(s.hp,hp-w.damage);
 }
});
test('destroying a section removes its three balls together and emits three break effects',()=>{
 const {r}=ready(),s=r.segments[2],ids=r.segments.map(s=>s.id),before=r.segments.flatMap(sectionBalls).length;
 r.weapons=[];s.hp=0;tick(r,0);
 assert.equal(r.segments.flatMap(sectionBalls).length,before-3);
 assert.deepEqual(r.segments.map(s=>s.id),ids.filter(id=>id!==s.id));
 assert.equal(r.effects.filter(e=>e.type==='burst').length,3);
});
test('projectiles and rugs use the visible circle edge instead of the old narrow strip',()=>{
 const {r}=ready(),s=r.segments[2],p=sectionBalls(s)[1],nx=-Math.sin(p.angle),ny=Math.cos(p.angle);
 const inside={x:p.x+nx*(p.radius-.5),y:p.y+ny*(p.radius-.5)};
 assert.equal(sectionHit(s,inside.x,inside.y),true);
 const rug={x:inside.x,y:inside.y,r:1,life:1,max:2};assert.equal(rugTouches(rug,s),true);
 assert.equal(sectionHit(s,10000,10000),false);assert.equal(rugTouches({...rug,x:10000,y:10000},s),false);
});
test('species skins are distinct and the renderer never outlines a three-ball group',()=>{
 const {r}=ready(),s=r.segments[1],signatures=new Set();
 for(const species of SPECIES){const calls=[];const c=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>{assert.notEqual(k,'stroke');calls.push([k,...args]);}),set:(o,k,v)=>(calls.push([k,v]),o[k]=v,true)});
  assert.equal(drawDragonSection(c,s,species,0).length,3);signatures.add(JSON.stringify(calls));
 }
 assert.equal(signatures.size,SPECIES.length);
});
