import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,makeMaze,key,WIDTH,HEIGHT,neighbors,position,VERSION,RUN_TICKS} from '../js/model.mjs';
import {Recorder,validateReplay} from '../js/replay.mjs';
function freezeGhosts(s){for(const g of s.ghosts)g.wait=RUN_TICKS+1;}
function place(a,x,y,dir=1){Object.assign(a,{x,y,tx:x,ty:y,dir,moving:false,progress:0});}

test('all themed mazes have connected pellets, safe spawns, loops and reachable shortcuts',()=>{
  for(const seed of [0,1,0x504143,0xffffffff])for(let stage=0;stage<9;stage++){
    const s=createRun({seed});s.maze=makeMaze(seed,stage);
    const seen=new Set([key(11,17)]),queue=[[11,17]];
    for(let h=0;h<queue.length;h++)for(const n of neighbors(s,...queue[h]))if(!seen.has(key(n.x,n.y))){seen.add(key(n.x,n.y));queue.push([n.x,n.y]);}
    for(let k=0;k<s.maze.pellets.length;k++)if(s.maze.pellets[k])assert.ok(seen.has(k),`Unreachable ${seed}/${stage}/${k}`);
    assert.equal(s.maze.remaining,s.maze.pellets.filter(Boolean).length);assert.ok(s.maze.remaining>180);assert.ok(s.maze.gates.length>=1);
    for(const [x,y]of [[1,1],[21,1],[1,9],[21,9],[11,17]])assert.ok(seen.has(key(x,y)));
    assert.ok(queue.filter(([x,y])=>neighbors(s,x,y).length>=3).length>20);
    for(let x=0;x<WIDTH;x++){assert.equal(s.maze.tiles[key(x,0)],1);assert.equal(s.maze.tiles[key(x,HEIGHT-1)],1);}
  }
  assert.notDeepEqual(makeMaze(9,0).tiles,makeMaze(9,1).tiles);
});
test('buffered turns follow corridors, cannot cross a wall, and reversing mid-lane is continuous',()=>{
  const s=createRun();freezeGhosts(s);step(s,1);for(let i=0;i<5;i++)step(s,1);
  const before=position(s.player);step(s,3);const after=position(s.player);
  assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<=1/13+.001);assert.equal(s.player.dir,3);
  for(let t=0;t<1200;t++){step(s,Math.floor(t/17)%4);const p=position(s.player);assert.equal(s.maze.tiles[key(Math.round(p.x),Math.round(p.y))],0);}
});
test('combos build, expire and reset on damage; pellets pay only once',()=>{
  const s=createRun();freezeGhosts(s);s.combo=19;s.lastPellet=0;s.maze.pellets[key(12,17)]=1;
  for(let i=0;i<13;i++)step(s,1);
  assert.equal(s.combo,20);assert.equal(s.multiplier,2);assert.equal(s.score,20);
  const value=s.score;for(let i=0;i<13;i++)step(s,3);for(let i=0;i<13;i++)step(s,1);assert.equal(s.score,value);
  s.lastPellet=-999;step(s,4);assert.equal(s.multiplier,1);
  s.combo=45;s.multiplier=3;s.lastPellet=s.tick;s.invulnerable=0;place(s.player,11,17);place(s.ghosts[0],11,17);s.ghosts[0].wait=0;step(s,4);
  assert.equal(s.lives,2);assert.equal(s.combo,0);assert.equal(s.multiplier,1);
});
test('power pellets allow escalating ghost captures, preserving lives and capping chain points',()=>{
  const s=createRun();freezeGhosts(s);s.maze.pellets[key(12,17)]=2;
  for(let i=0;i<13;i++)step(s,1);assert.equal(s.power,420);
  const base=s.score;
  for(let i=0;i<4;i++){place(s.player,11,17);place(s.ghosts[i],11,17);s.ghosts[i].wait=0;step(s,4);assert.equal(s.ghosts[i].returning,true);}
  assert.equal(s.ghostsEaten,4);assert.equal(s.score-base,200+400+800+1600);assert.equal(s.lives,3);
});
test('dash costs a full charge, grants protection, expires and recharges; decoy moves then expires',()=>{
  const s=createRun();freezeGhosts(s);s.invulnerable=0;place(s.ghosts[0],11,17);s.ghosts[0].wait=0;step(s,9);
  assert.equal(s.energy,0);assert.equal(s.dash,48);assert.equal(s.lives,3);step(s,9);assert.equal(s.energy,1);assert.equal(s.dash,47);
  freezeGhosts(s);for(let i=0;i<599;i++)step(s,4);assert.equal(s.energy,600);assert.equal(s.dash,0);
  const d=createRun({ability:'decoy'});freezeGhosts(d);step(d,9);assert.ok(d.decoy);const initial=position(d.decoy);for(let i=0;i<20;i++)step(d,1);assert.notDeepEqual(position(d.decoy),initial);for(let i=0;i<220;i++)step(d,4);assert.equal(d.decoy,null);
});
test('gates warn then only open, without adding inaccessible collectibles',()=>{
  const s=createRun();freezeGhosts(s);const k=s.maze.gates[0];s.tick=719;step(s,4);assert.ok(s.events.some(e=>e.type==='gate-warning'));assert.equal(s.maze.tiles[k],1);
  s.tick=899;step(s,4);assert.equal(s.maze.tiles[k],0);assert.ok(s.events.some(e=>e.type==='gate'));
  s.tick=1799;step(s,4);assert.equal(s.maze.tiles[k],0);
});
test('last pellet advances to a distinct maze and preserves score, lives and charge',()=>{
  const s=createRun();freezeGhosts(s);s.maze.pellets.fill(0);s.maze.pellets[key(12,17)]=1;s.maze.remaining=1;s.energy=100;
  const first=[...s.maze.tiles];for(let i=0;i<13;i++)step(s,1);assert.equal(s.stage,1);assert.equal(s.transition,150);assert.equal(s.score,1010);
  for(let i=0;i<150;i++)step(s,4);assert.notDeepEqual([...s.maze.tiles],first);assert.equal(s.lives,3);assert.equal(s.score,1010);assert.equal(s.energy,263);
});
test('five-minute limit and death stop the simulation permanently',()=>{
  const s=createRun();s.tick=RUN_TICKS-1;step(s,4);assert.equal(s.done,true);assert.equal(s.reason,'time_up');const snapshot=JSON.stringify(s);step(s,1);assert.equal(JSON.stringify(s),snapshot);
});
test('compact evidence deterministically recomputes a completed run and rejects tampering',()=>{
  const config={version:VERSION,seed:0x504143,ability:'dash'},s=createRun(config),r=new Recorder();
  while(!s.done){const input=s.tick%211===0?9:4;r.add(input);step(s,input);}
  const evidence=r.export();assert.equal(validateReplay(evidence,{...config,score:s.score}).score,s.score);
  assert.throws(()=>validateReplay(evidence,{...config,score:s.score+1}),/Score/);
  assert.throws(()=>validateReplay(evidence,{...config,version:'unknown'}),/ruleset/);
  assert.throws(()=>validateReplay({...evidence,inputs:'!!!!'},config),/encoding|replay/);
  assert.throws(()=>validateReplay({...evidence,inputs:btoa(String.fromCharCode(7)+atob(evidence.inputs).slice(1))},config),/controller/);
  assert.throws(()=>validateReplay({...evidence,ticks:1,inputs:btoa('\x04')},config),/Incomplete/);
  assert.throws(()=>validateReplay({...evidence,ticks:RUN_TICKS+1},config),/envelope/);
  const full=new Recorder();for(let i=0;i<RUN_TICKS;i++)full.add(4);assert.ok(JSON.stringify({evidence:full.export(),score:999999}).length<16*1024);
});
