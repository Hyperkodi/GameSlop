const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,ground,FETCH,HOME}=require('../js/engine.js');
const Levels=require('../js/levels.js');
const advance=(e,seconds,input={})=>{for(let i=0;i<seconds*120;i++)e.update(1/120,input);};
test('orchard is isolated from park; countdown starts only at its Bitcoin',()=>{
 const e=createEngine(2),park=createEngine(1);e.start();advance(e,90);
 assert.equal(e.state.level.name,'Harvest Hustle');assert.equal(e.state.returnTime,80);assert.equal(e.state.hearts,5);
 assert.equal(e.state.ponds.length,0);assert.equal(park.state.ponds.length,2);assert.equal(park.state.returnTime,75);
 Object.assign(e.state.dog,{x:FETCH,y:ground(FETCH,2)});e.update(1/120);assert.equal(e.state.phase,'return');assert.equal(e.state.returnTime,80);
 advance(e,1);assert.ok(e.state.returnTime<79.1);
});
test('wooden harvest equipment supports a landing without an automatic bounce',()=>{
 for(const kind of ['bins','wagon','loading']){
  const e=createEngine(2);e.start();const p=e.state.platforms.find(p=>p.kind===kind),d=e.state.dog,x=(p.x+p.end)/2;
  Object.assign(d,{x,y:Levels.surfaceY(p,x)-12,vy:100,grounded:false,coyote:0});
  advance(e,.8);
  assert.equal(d.platformId,p.id);assert.equal(d.vy,0);assert.equal(d.springTimer,0);
 }
});
test('every adjacent orchard shelf can be reached in either direction',()=>{
 const shelves=createEngine(2).state.platforms.slice(0,5);
 for(const direction of [1,-1])for(let i=direction===1?0:4;direction===1?i<4:i>0;i+=direction){
  const from=shelves[i],to=shelves[i+direction];let reached=false;
  for(const inset of [10,50,100,150,200,250,300]){
   const e=createEngine(2);e.start();const d=e.state.dog;
   if(inset>=from.end-from.x)continue;
   const x=direction===1?from.end-inset:from.x+inset;
   Object.assign(d,{x,y:Levels.surfaceY(from,x),vx:490*direction,platform:true,platformId:from.id});
   for(let j=0;j<160;j++){e.update(1/120,{move:direction,jump:true});if(d.platformId===to.id){reached=true;break;}}
   if(reached)break;
  }
  assert.ok(reached,`${from.id} -> ${to.id}`);
 }
});
test('leaf piles slow paws, clear by rolling, persist for return and reset for replay',()=>{
 const walking=createEngine(2),rolling=createEngine(2);
 for(const e of [walking,rolling]){e.start();const patch=e.state.leaves[0];Object.assign(e.state.dog,{x:patch.x+10,y:ground(patch.x+10,2),vx:490});}
 advance(walking,.35,{});advance(rolling,.35,{roll:true});
 assert.ok(rolling.state.dog.vx>walking.state.dog.vx+100);assert.equal(rolling.state.leaves[0].cleared,true);assert.equal(walking.state.hearts,5);
 Object.assign(rolling.state.dog,{x:FETCH,y:ground(FETCH,2)});rolling.update(1/120);assert.equal(rolling.state.leaves[0].cleared,true);
 rolling.start();assert.equal(rolling.state.leaves[0].cleared,false);
});
test('all three harvest routes reach the wagons and packing deck in both directions',()=>{
 for(const [group,start]of [[0,3000],[1,10200],[2,16900]])for(const dir of [1,-1]){
  const e=createEngine(2);e.start();const d=e.state.dog,visited=new Set();let held=false;
  d.x=start+(dir===1?-220:2310);d.y=ground(d.x,2);d.vx=(dir===1?490:560)*dir;
  if(dir===-1){e.state.phase='return';d.carrying=true;}
  for(let i=0;i<1800;i++){
   if(d.platformId)visited.add(d.platformId);
   const next=e.state.platforms.filter(p=>p.id.startsWith(`orchard-${group}-`)&&!visited.has(p.id)&&((p.x+p.end)/2-d.x)*dir>0).sort((a,b)=>dir*(a.x-b.x))[0];
   const jump=!d.grounded&&d.coyote<=0?held:d.springTimer>0?true:!!next&&(dir===1?next.x-d.x:d.x-next.end)<220&&!e.state.lastJump;
   held=jump;e.update(1/120,{move:dir,jump});
   if(dir===1?d.x>start+2300:d.x<start-150)break;
  }
  for(const index of [1,2,3])assert.ok(visited.has(`orchard-${group}-${index}`),`Group ${group}, direction ${dir}, equipment ${index}`);
  assert.equal(e.state.hearts,5);
 }
});
test('the orchard ground route completes both legs with recovery time',()=>{
 const e=createEngine(2);e.start();
 for(let i=0;i<120*160&&!['won','lost'].includes(e.state.phase);i++){
  const s=e.state,d=s.dog,dir=s.phase==='return'?-1:1;
  const near=s.obstacles.some(o=>o.type==='rock'&&!o.broken&&(o.x-d.x)*dir>0&&(o.x-d.x)*dir<Math.max(190,Math.abs(d.vx)*.3));
  const roll=s.obstacles.some(o=>o.type==='crate'&&!o.broken&&(o.x-d.x)*dir>-44&&(o.x-d.x)*dir<180);
  e.update(1/120,{move:dir,sprint:true,roll,jump:near});
 }
 assert.equal(e.state.phase,'won');assert.ok(e.state.returnTime>25);assert.equal(e.state.hearts,5);
 assert.ok(e.state.coins>80);assert.equal(e.state.result.delivery,1000);
});
test('landing and running follow the loading ramp and its level deck',()=>{
 for(const u of [.08,.35,.7,.94]){
  const e=createEngine(2);e.start();const p=e.state.platforms.find(p=>p.kind==='loading'),d=e.state.dog,x=p.x+(p.end-p.x)*u;
  Object.assign(d,{x,y:Levels.surfaceY(p,x)-12,vy:80,vx:0,grounded:false,coyote:0});
  advance(e,.15);assert.equal(d.platformId,p.id);assert.ok(Math.abs(d.y-Levels.surfaceY(p,d.x))<.001);
  const before=d.y;advance(e,.16,{move:u<.5?1:-1});
  assert.equal(d.platformId,p.id);assert.ok(Math.abs(d.y-Levels.surfaceY(p,d.x))<.001);
  if(u<.4)assert.ok(Math.abs(d.y-before)>.5);else assert.ok(Math.abs(d.y-before)<.001);
 }
});
test('the loading ramp can be walked up and back down without jumping',()=>{
 const e=createEngine(2);e.start();const p=e.state.platforms.find(p=>p.kind==='loading'),d=e.state.dog;
 Object.assign(d,{x:p.x-30,y:ground(p.x-30,2),vx:0});
 let highest=d.y;
 for(let i=0;i<150;i++){e.update(1/120,{move:1});highest=Math.min(highest,d.y);}
 assert.equal(d.platformId,p.id);assert.ok(highest<ground(d.x,2)-100);
 for(let i=0;i<220;i++)e.update(1/120,{move:-1});
 assert.ok(d.x<p.x);assert.equal(d.platformId,null);assert.ok(Math.abs(d.y-ground(d.x,2))<.001);
 assert.equal(e.state.hearts,5);
});
