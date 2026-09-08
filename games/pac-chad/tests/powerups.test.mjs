import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,makeMaze,neighbors,step,position,key,VERSION} from '../js/model.mjs';
import {POWERUPS,canEat,ghostBonus} from '../js/powerups.mjs';
import {Recorder,validateReplay} from '../js/replay.mjs';
const place=(a,x,y,dir=1)=>Object.assign(a,{x,y,tx:x,ty:y,dir,progress:0,carry:0,moving:false,duration:13});
const freeze=s=>s.ghosts.forEach(g=>g.wait=999999);
function acquire(stage){
 const s=createRun();s.stage=stage;s.maze=makeMaze(s.seed,stage);freeze(s);
 const item=s.maze.pickup,n=neighbors(s,item.x,item.y)[0];place(s.player,n.x,n.y,(n.dir+2)%4);
 for(let i=0;i<13;i++)step(s,s.player.dir);
 assert.equal(s.special?.id,POWERUPS[stage].id);assert.equal(s.special.ticks,300);return s;
}
test('every level has one reachable, optional illustrated pickup away from spawn',()=>{
 for(const seed of [0,1,9,0xffffffff])for(let stage=0;stage<10;stage++){
  const s=createRun({seed});s.maze=makeMaze(seed,stage);const item=s.maze.pickup;
  assert.equal(item.id,POWERUPS[stage].id);assert.equal(s.maze.tiles[key(item.x,item.y)],0);assert.equal(s.maze.pellets[key(item.x,item.y)],0);assert.ok(item.y<17);
  const seen=new Set([key(11,17)]),queue=[[11,17]];for(let i=0;i<queue.length;i++)for(const n of neighbors(s,...queue[i]))if(!seen.has(key(n.x,n.y))){seen.add(key(n.x,n.y));queue.push([n.x,n.y]);}
  assert.ok(seen.has(key(item.x,item.y)));
 }
});
test('all ten pickups expire after five seconds, cannot be collected twice, and stay spent after damage',()=>{
 for(let stage=0;stage<10;stage++){
  const s=acquire(stage),item=s.maze.pickup;place(s.player,11,17);
  for(let i=0;i<299;i++)step(s,4);assert.equal(s.special.ticks,1);step(s,4);assert.equal(s.special,null);
  const n=neighbors(s,item.x,item.y)[0];place(s.player,n.x,n.y,(n.dir+2)%4);for(let i=0;i<13;i++)step(s,s.player.dir);assert.equal(s.special,null);
 }
 const s=acquire(2);s.invulnerable=0;place(s.player,11,17);place(s.ghosts[0],11,17);s.ghosts[0].wait=0;step(s,1);assert.equal(s.lives,2);assert.equal(s.special,null);assert.equal(s.maze.pickup.collected,true);
});
test('Gym Pass and Final Form make ghosts edible with doubled escalating capture scores',()=>{
 for(const stage of [0,9]){
  const s=acquire(stage);assert.ok(canEat(s));assert.equal(ghostBonus(s),2);const base=s.score;
  for(let i=0;i<4;i++){place(s.player,11,17);place(s.ghosts[i],11,17);s.ghosts[i].wait=0;step(s,1);}
  assert.equal(s.score-base,400+800+1600+3200);assert.equal(s.lives,3);assert.equal(s.ghostsEaten,4);
  s.special=null;assert.equal(canEat(s),false);s.power=10;assert.equal(canEat(s),true);assert.equal(ghostBonus(s),1);
 }
});
test('Leg Day sends ghosts away at twice normal movement rate without making them edible',()=>{
 const s=acquire(1);place(s.player,4,17);const g=s.ghosts[0];place(g,8,17,3);g.wait=0;step(s,4);
 assert.equal(g.duration,19);assert.equal(g.progress,2);assert.equal(canEat(s),false);
 assert.ok(Math.abs(g.tx-s.player.x)+Math.abs(g.ty-s.player.y)>Math.abs(g.x-s.player.x)+Math.abs(g.y-s.player.y));
});
test('steak is exactly twice normal speed and Final Form is 50 percent faster, with no wall clipping',()=>{
 for(const [stage,distance] of [[2,8],[9,6]]){
  const s=acquire(stage);place(s.player,3,17);for(let i=0;i<52;i++)step(s,1);assert.equal(position(s.player).x,3+distance);
  for(let i=0;i<150;i++){step(s,1);const p=position(s.player);assert.equal(s.maze.tiles[key(Math.round(p.x),Math.round(p.y))],0);}
 }
});
test('Mirror Check produces two moving lures; Ghosted ignores the current player location',()=>{
 const s=acquire(3);const before=s.special.echoes.map(position);for(let i=0;i<25;i++)step(s,4);assert.equal(s.special.echoes.length,2);assert.notDeepEqual(s.special.echoes.map(position),before);
 const hidden=acquire(7),other=structuredClone(hidden);place(hidden.player,1,17);place(other.player,21,17);
 for(const state of [hidden,other]){place(state.ghosts[0],11,17);state.ghosts[0].wait=0;step(state,4);}
 assert.deepEqual(hidden.ghosts[0],other.ghosts[0]);
});
test('Cold Plunge freezes for two seconds, then runs ghosts at half speed',()=>{
 const s=acquire(4),g=s.ghosts[0];place(g,11,17);g.wait=0;const p=position(g);
 for(let i=0;i<119;i++)step(s,4);assert.deepEqual(position(g),p);assert.equal(s.special.ticks,181);
 step(s,4);assert.equal(g.progress,.5);assert.equal(s.special.ticks,180);
});
test('Pre-Workout blocks only three hits; aura repels without crossing walls',()=>{
 for(const stage of [5,8]){
  const s=acquire(stage);s.invulnerable=0;
  for(let i=0;i<4;i++){
   place(s.player,11,17);const g=s.ghosts[0];place(g,11,17);g.stun=0;g.wait=0;step(s,1);
   assert.equal(s.maze.tiles[key(g.x,g.y)],0);
   if(stage===5&&i===3)assert.equal(s.lives,2);else{assert.equal(s.lives,3);assert.ok(g.stun>0);}
  }
 }
});
test('Cheat Day triples only regular pellets and stacks with combos',()=>{
 const s=acquire(6);place(s.player,11,17);s.combo=19;s.lastPellet=s.tick;s.maze.pellets[key(12,17)]=1;const base=s.score;
 for(let i=0;i<13;i++)step(s,1);assert.equal(s.score-base,60);
 place(s.player,11,17);s.maze.pellets[key(12,17)]=2;const powered=s.score;for(let i=0;i<13;i++)step(s,1);assert.equal(s.score-powered,100);
});
test('pickup input evidence replays deterministically and rejects forged bonus points',()=>{
 const s=createRun(),r=new Recorder(),item=s.maze.pickup;
 const queue=[[11,17,[]]],seen=new Set([key(11,17)]);let route;
 for(let i=0;i<queue.length;i++){const [x,y,path]=queue[i];if(x===item.x&&y===item.y){route=path;break;}for(const n of neighbors(s,x,y))if(!seen.has(key(n.x,n.y))){seen.add(key(n.x,n.y));queue.push([n.x,n.y,[...path,n.dir]]);}}
 let picked=false;for(const dir of route)for(let i=0;i<13&&!s.done;i++){r.add(dir);step(s,dir);picked ||= s.maze.pickup.collected;}
 // Natural enemies end the run; no test state changes enter recorded evidence.
 while(!s.done){r.add(4);step(s,4);if(s.tick>60000)throw Error('Test route did not complete');}
 assert.equal(picked,true);const config={version:VERSION,seed:s.seed,ability:s.ability,score:s.score};
 assert.equal(validateReplay(r.export(),config).score,s.score);assert.throws(()=>validateReplay(r.export(),{...config,score:s.score+400}),/Score/);
});
