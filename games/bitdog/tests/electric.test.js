const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,ground,FETCH}=require('../js/engine.js');
const Levels=require('../js/levels.js');
const advance=(e,seconds,input={})=>{for(let i=0;i<seconds*120;i++)e.update(1/120,input);};
function onCable(){const e=createEngine(3);e.start();const p=e.state.platforms.find(p=>p.energized),d=e.state.dog;Object.assign(d,{x:p.x+80,y:Levels.surfaceY(p,p.x+80),vx:490,platform:true,platformId:p.id});return {e,p,d};}
test('Electric Avenue keeps five hearts and starts its clock at pickup',()=>{
 const e=createEngine(3);e.start();advance(e,100);assert.equal(e.state.returnTime,80);assert.equal(e.state.hearts,5);
 Object.assign(e.state.dog,{x:FETCH,y:ground(FETCH,3)});e.update(.02);assert.equal(e.state.phase,'return');
 advance(e,1);assert.ok(e.state.returnTime<79.1);assert.equal(e.state.level.id,3);
});
test('landing on a cable grants speed, while flying past does not',()=>{
 const {e,p,d}=onCable();advance(e,.35,{move:1});assert.ok(d.electricTimer>0);assert.ok(d.vx>560);
 const other=createEngine(3);other.start();Object.assign(other.state.dog,{x:p.x+40,y:180,vy:-200,grounded:false,coyote:0});
 advance(other,.1,{move:1,jump:true});assert.equal(other.state.dog.electricTimer,0);
});
test('jumping detaches cleanly and the electric afterglow expires',()=>{
 const {e,d}=onCable();e.update(.01,{move:1});e.update(.01,{move:1,jump:true});
 assert.equal(d.platformId,null);assert.ok(d.railCooldown>0);assert.ok(d.electricTimer>0);
 Object.assign(d,{x:7000,y:200,vy:0});advance(e,1);assert.equal(d.electricTimer,0);
});
test('a junction costs one heart and its jump clearance is safe',()=>{
 const {e,p,d}=onCable(),j=e.state.junctions[0];
 Object.assign(d,{x:j.x-8,y:j.y,vx:200});e.update(.02,{move:1});assert.equal(e.state.hearts,4);assert.equal(d.platformId,null);
 advance(e,.12);assert.equal(e.state.hearts,4);
 const safe=onCable();Object.assign(safe.d,{x:j.x-160,y:Levels.surfaceY(p,j.x-160),vx:490});
 advance(safe.e,.6,{move:1,jump:true});assert.equal(safe.e.state.hearts,5);assert.ok(safe.d.x>j.x);
});
test('every adjacent workshop and cable is reachable in both directions',()=>{
 const shelves=createEngine(3).state.platforms.filter(p=>p.id.startsWith('electric-0-')&&!['electric-0-5','electric-0-6'].includes(p.id));
 for(const dir of [1,-1])for(let i=dir===1?0:shelves.length-1;dir===1?i<shelves.length-1:i>0;i+=dir){
  const from=shelves[i],to=shelves[i+dir];let reached=false;
  for(const inset of [10,40,70,100,150,200,250,300]){
   if(inset>=from.end-from.x)continue;
   const e=createEngine(3);e.start();const d=e.state.dog,x=dir===1?from.end-inset:from.x+inset;
   Object.assign(d,{x,y:Levels.surfaceY(from,x),vx:490*dir,platform:true,platformId:from.id});
   for(let j=0;j<200;j++){e.update(1/120,{move:dir,jump:true});if(d.platformId===to.id){reached=true;break;}}
   if(reached)break;
  }
  assert.ok(reached,`${from.id} -> ${to.id}`);
 }
});
test('the street route completes a full delivery without requiring cables',()=>{
 const e=createEngine(3);e.start();
 for(let i=0;i<120*170&&!['won','lost'].includes(e.state.phase);i++){
  const s=e.state,d=s.dog,dir=s.phase==='return'?-1:1;
  const near=s.obstacles.some(o=>o.type==='rock'&&!o.broken&&(o.x-d.x)*dir>0&&(o.x-d.x)*dir<Math.max(190,Math.abs(d.vx)*.3));
  const roll=s.obstacles.some(o=>o.type==='crate'&&!o.broken&&(o.x-d.x)*dir>-44&&(o.x-d.x)*dir<180);
  e.update(1/120,{move:dir,sprint:true,roll,jump:near});
 }
 assert.equal(e.state.phase,'won');assert.equal(e.state.hearts,5);assert.ok(e.state.returnTime>25);assert.ok(e.state.coins>80);
});

test('all rooftop entrances can be climbed from the street using the two crate steps',()=>{
 for(let route=0;route<3;route++)for(const dir of [1,-1]){
  const e=createEngine(3);e.start();const d=e.state.dog;
  const steps=(dir===1?[0,5,1]:[4,6,3]).map(i=>e.state.platforms.find(p=>p.id===`electric-${route}-${i}`));
  const first=steps[0];
  Object.assign(d,{x:dir===1?first.x-45:first.end+45,y:ground(first.x,3),vx:0});
  for(const target of steps){
   // Ordinary movement and a held jump, with steering to land near the middle.
   e.update(1/120,{jump:false});
   const x=(target.x+target.end)/2;let landed=false;
   for(let frame=0;frame<180;frame++){
    const move=Math.max(-1,Math.min(1,(x-d.x)/60-d.vx/250));
    e.update(1/120,{move,jump:true});
    if(d.platformId===target.id){landed=true;break;}
   }
   assert.ok(landed,`route ${route}, direction ${dir}: reach ${target.id} from below`);
  }
  assert.equal(e.state.hearts,5);
 }
});
test('all three powered routes clear their junctions in both directions',()=>{
 for(const rail of createEngine(3).state.platforms.filter(p=>p.energized))for(const dir of [1,-1]){
  const e=createEngine(3);e.start();const d=e.state.dog,x=dir===1?rail.x+15:rail.end-15;
  if(dir<0){e.state.phase='return';d.carrying=true;}
  Object.assign(d,{x,y:Levels.surfaceY(rail,x),vx:dir*490,platform:true,platformId:rail.id});
  let held=false,maxSpeed=0;
  for(let i=0;i<900;i++){
   const near=e.state.junctions.some(j=>j.platformId===rail.id&&(j.x-d.x)*dir>0&&(j.x-d.x)*dir<190);
   held=d.grounded?near:held;
   e.update(1/120,{move:dir,jump:held});maxSpeed=Math.max(maxSpeed,Math.abs(d.vx));
   if(dir===1?d.x>rail.end+30:d.x<rail.x-30)break;
  }
  assert.equal(e.state.hearts,5,`${rail.id}, direction ${dir}`);
  assert.ok(dir===1?d.x>rail.end:d.x<rail.x);assert.ok(maxSpeed>600);assert.ok(e.state.coins>=5);
 }
});
