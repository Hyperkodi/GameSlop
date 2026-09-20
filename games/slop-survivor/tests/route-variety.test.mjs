import test from 'node:test';
import assert from 'node:assert/strict';
import {routePoint,routeStyleFor} from '../encounters.mjs';
import {drawSerpentHead} from '../art.mjs';

test('all 100 levels have unique, deterministic, continuous routes inside the arena',()=>{
 const fingerprints=new Set(),styles=new Set();
 for(let chapter=0;chapter<100;chapter++){
  const r={chapter,wave:1,mode:'campaign',routeSeed:77,routeVersion:2};
  styles.add(routeStyleFor(chapter).id);const samples=[];let old=routePoint(r,0);
  for(let d=4;d<4000;d+=4){
   const p=routePoint(r,d);assert.ok(Math.hypot(p.x-old.x,p.y-old.y)<=4.001);
   assert.ok(p.x>45&&p.x<435);if(p.y>640)break;
   if(d%80===0)samples.push([+p.x.toFixed(2),+p.y.toFixed(2)]);old=p;
  }
  assert.ok(samples.length>=10);fingerprints.add(JSON.stringify(samples));
  assert.deepEqual(routePoint(r,900),routePoint({...r},900));
 }
 assert.equal(styles.size,10);assert.equal(fingerprints.size,100);
});

test('saved previous routes retain their shape until the next wave',()=>{
 const r={chapter:3,wave:2,mode:'campaign',routeSeed:77};
 const old=routePoint(r,900);r.routeVersion=2;
 assert.notDeepEqual(routePoint(r,900),old);
 delete r.routeVersion;assert.deepEqual(routePoint(r,900),old);
});

test('serpent heads stay upright and only mirror horizontally when changing direction',()=>{
 for(const angle of [0,.8,Math.PI/2+.1,Math.PI,-Math.PI,-2,-.8]){
  const transforms=[];let draws=0;
  const c={save(){},restore(){},scale(x,y){transforms.push([x,y]);},rotate(){assert.fail('head must not rotate');},drawImage(){draws++;}};
  drawSerpentHead(c,{naturalWidth:1024,naturalHeight:1024},2,angle,1.03);
  assert.equal(draws,1);assert.deepEqual(transforms,[[(Math.cos(angle)<0?-1:1)*1.03,1.03]]);
 }
});
