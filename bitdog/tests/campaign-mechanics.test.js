const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/engine.js'),Levels=require('../js/levels.js');
const advance=(e,seconds,input={})=>{for(let i=0;i<seconds*120;i++)e.update(1/120,input);};
function at(e,x,extra={}){Object.assign(e.state.dog,{x,y:B.ground(x,e.state.level.id),vx:0,vy:0,grounded:true,platform:false,platformId:null,coyote:.1,...extra});}

test('all eight fetches have independent playable settings and music',()=>{
 assert.deepEqual(Levels.catalog.filter(l=>l.available).map(l=>l.id),[1,2,3,4,5,6,7,8]);
 assert.equal(new Set(Levels.catalog.map(l=>l.music)).size,8);
 for(let id=4;id<=8;id++){
  const e=B.createEngine(id);e.start();advance(e,91);assert.equal(e.state.returnTime,e.state.level.returnTime);assert.equal(e.state.hearts,5);
  at(e,B.FETCH);e.update(1/120);assert.equal(e.state.phase,'return');advance(e,1);assert.ok(e.state.returnTime<e.state.level.returnTime-.9);
 }
});

test('mushroom contact bounces automatically; holding Jump produces a higher arc',()=>{
 const lows=[];
 for(const held of [false,true]){
  const e=B.createEngine(4);e.start();const p=e.state.platforms[0],d=e.state.dog;
  at(e,p.x+90,{y:p.y-2,vy:80,grounded:false,coyote:0});let highest=d.y,launched=false;
  for(let i=0;i<150;i++){e.update(1/120,{jump:held});highest=Math.min(highest,d.y);launched ||= e.state.events.some(v=>v.type==='mushroom');}
  assert.ok(launched);assert.equal(e.state.hearts,5);lows.push(highest);
 }
 assert.ok(lows[1]<lows[0]-80);
});

test('mud slows a missed route without damage and leaving restores ordinary movement',()=>{
 const e=B.createEngine(4);e.start();at(e,3600,{vx:650});advance(e,.4,{move:1});assert.ok(e.state.dog.muddy);assert.ok(e.state.dog.vx<450);assert.equal(e.state.hearts,5);
 at(e,4700,{vx:250});advance(e,.5,{move:1});assert.equal(e.state.dog.muddy,false);assert.ok(e.state.dog.vx>450);
});

test('rolling grows a capped snow shell, breaks snow barriers, and jumping sheds it',()=>{
 const e=B.createEngine(5);e.start();at(e,400,{vx:800});
 e.state.obstacles=[];advance(e,2.1,{move:1,roll:true});const d=e.state.dog;assert.equal(d.snowball,1);assert.ok(d.vx<=1100);
 const x=d.x+45;e.state.obstacles=[{x,type:'crate',skin:'snow',h:48,broken:false,cooldown:0}];advance(e,.12,{move:1,roll:true});assert.equal(e.state.obstacles[0].broken,true);assert.equal(e.state.hearts,5);
 e.update(1/120,{move:1,roll:true,jump:true});assert.equal(d.snowball,0);assert.ok(d.vy<0);
 e.start();assert.equal(e.state.dog.snowball,0);
});

test('snowbank ramps can be entered at either ground-level end without jumping',()=>{
 for(const dir of [1,-1]){
  const e=B.createEngine(5);e.start();const p=e.state.platforms[0];at(e,dir===1?p.x-15:p.end+15,{vx:dir*200});
  advance(e,.4,{move:dir});assert.equal(e.state.dog.platformId,p.id);assert.equal(e.state.dog.y,Levels.surfaceY(p,e.state.dog.x));
 }
});

test('umbrellas launch by contact from either side; jump releases without immediately reopening',()=>{
 for(const index of [0,1]){
  const e=B.createEngine(6);e.start();const u=e.state.umbrellas[index],dir=index?-1:1;at(e,u.x,{y:u.y+30,grounded:false,coyote:0,vx:dir*300});e.update(1/120,{move:dir});
  assert.equal(e.state.dog.gliding,true);assert.ok(e.state.dog.vy<0);advance(e,.5,{move:dir});assert.ok(e.state.dog.y<400);
  e.update(1/120,{move:dir,jump:true});assert.equal(e.state.dog.gliding,false);assert.ok(e.state.dog.glideCooldown>0);
  advance(e,.1,{move:dir,jump:true});assert.equal(e.state.dog.gliding,false);
 }
});

test('opposing visible gusts still permit steering both ways and cannot launch above their ceiling',()=>{
 for(const dir of [1,-1]){
  const e=B.createEngine(6);e.start();const z=e.state.zones.find(z=>z.direction===-dir);at(e,z.x+1300,{y:300,grounded:false,gliding:true,coyote:0,vx:dir*350});const initial=e.state.dog.x;
  advance(e,1.5,{move:dir});assert.ok((e.state.dog.x-initial)*dir>300);assert.ok(e.state.dog.y>65);assert.equal(e.state.hearts,5);
 }
});

test('moon gravity pockets restore weight and exit back to low gravity without changing hearts',()=>{
 const low=B.createEngine(7),heavy=B.createEngine(7);low.start();heavy.start();at(low,2000,{grounded:false,y:100,coyote:0});at(heavy,5100,{grounded:false,y:100,coyote:0});
 advance(low,.3);advance(heavy,.3);assert.equal(low.state.dog.gravityScale,.48);assert.equal(heavy.state.dog.gravityScale,1);assert.ok(heavy.state.dog.y>low.state.dog.y+30);
 at(heavy,5700);heavy.update(1/120);assert.equal(heavy.state.dog.gravityScale,.48);assert.equal(heavy.state.hearts,5);
});

test('final backyard reuses harvest surfaces, charged cable and living springs',()=>{
 const e=B.createEngine(8),kinds=new Set(e.state.platforms.map(p=>p.kind));for(const kind of ['bins','wagon','loading','cable','spring'])assert.ok(kinds.has(kind));
 assert.equal(e.state.junctions.length,2);assert.equal(e.state.leaves.length,1);
});

for(let id=4;id<=8;id++)test(`level ${id} completes both legs with ordinary movement and recovery time`,()=>{
 const e=B.createEngine(id);e.start();
 for(let i=0;i<120*200&&!['won','lost'].includes(e.state.phase);i++){
  const s=e.state,d=s.dog,dir=s.phase==='return'?-1:1;
  const near=s.obstacles.some(o=>o.type==='rock'&&!o.broken&&(o.x-d.x)*dir>0&&(o.x-d.x)*dir<Math.max(190,Math.abs(d.vx)*.3));
  const roll=s.obstacles.some(o=>o.type==='crate'&&!o.broken&&(o.x-d.x)*dir>-44&&(o.x-d.x)*dir<(o.skin==='snow'?420:180));
  e.update(1/120,{move:dir,sprint:true,roll,jump:near});
 }
 assert.equal(e.state.phase,'won');assert.equal(e.state.hearts,5);assert.ok(e.state.returnTime>25);assert.ok(e.state.coins>80);
 assert.equal(e.state.score,e.state.coins*100+Math.floor(e.state.returnTime)*50+1000+e.state.obstacles.filter(o=>o.broken).length*1000);
});

test('new mechanics keep five-hit failure, timeout and replay cleanup',()=>{
 for(let id=4;id<=8;id++){
  const e=B.createEngine(id);e.start();const o=e.state.obstacles[0];
  for(let i=0;i<5;i++){at(e,o.x-47,{vx:350,invincible:0});o.cooldown=0;e.update(.03,{move:1});}
  assert.equal(e.state.phase,'lost');assert.equal(e.state.hearts,0);e.start();assert.equal(e.state.hearts,5);assert.equal(e.state.dog.gliding,false);assert.equal(e.state.dog.snowball,0);
  at(e,700);e.state.phase='return';e.state.returnTime=.01;e.update(.02);assert.equal(e.state.failure,'time');
 }
});

test('all mushroom and lunar shelf chains connect in both directions',()=>{
 for(const id of [4,7])for(let cluster=0;cluster<3;cluster++)for(const dir of [1,-1]){
  const platforms=B.createEngine(id).state.platforms.slice(cluster*3,cluster*3+3);
  for(let i=dir===1?0:2;dir===1?i<2:i>0;i+=dir){
   const from=platforms[i],to=platforms[i+dir],e=B.createEngine(id);e.start();
   const x=dir===1?from.end-50:from.x+50;at(e,x,{y:Levels.surfaceY(from,x),vx:dir*250,platform:true,platformId:from.id,springTimer:id===4?.04:0});
   let reached=false;for(let j=0;j<300;j++){e.update(1/120,{move:dir,jump:true});if(e.state.dog.platformId===to.id){reached=true;break;}}
   assert.ok(reached,`${from.id} to ${to.id}`);assert.equal(e.state.hearts,5);
  }
 }
});

test('each carnival high route is reachable from the ground using its umbrella in both directions',()=>{
 for(let cluster=0;cluster<3;cluster++)for(const dir of [1,-1]){
  const e=B.createEngine(6);e.start();const index=cluster*2+(dir===1?0:1),u=e.state.umbrellas[index],p=e.state.platforms[index],d=e.state.dog;
  at(e,u.x-dir*130,{vx:dir*490});let lifted=false,released=false,landed=false;
  for(let i=0;i<700;i++){
   const close=dir===1?d.x>p.x+25:d.x<p.end-25;let jump=!lifted;
   if(lifted&&close&&!released){jump=true;released=true;}
   e.update(1/120,{move:dir,jump});if(d.gliding)lifted=true;if(d.platformId===p.id){landed=true;break;}
  }
  assert.ok(lifted&&released&&landed,`${p.id} direction ${dir}`);assert.equal(e.state.hearts,5);
 }
});

test('every forest and backyard mushroom route is reachable from ground at both ends',()=>{
 for(const id of [4,8])for(const dir of [1,-1])for(let cluster=0;cluster<(id===4?3:1);cluster++)for(const gap of [160,200]){
  const e=B.createEngine(id);e.start();const ps=e.state.platforms.filter(p=>p.kind==='spring'),p=ps[cluster*3+(dir===1?0:2)];
  at(e,dir===1?p.x-gap:p.end+gap,{vx:dir*350});let landed=false;
  for(let i=0;i<200;i++){e.update(1/120,{move:dir,jump:true});if(e.state.dog.platformId===p.id){landed=true;break;}}
  assert.ok(landed,`${id}: ${p.id}, direction ${dir}, approach ${gap}`);assert.equal(e.state.hearts,5);
 }
});

test('new platform artwork keeps native proportions and buries its supports across the full footprint',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const files={mushroom:'moonwood/mushroom-v1.png',snowbank:'snow/snowbank-v1.png',boardwalk:'carnival/boardwalk-v2.png',moonshelf:'moon/moonshelf-v1.png'};
 for(let id=4;id<=8;id++)for(const p of B.createEngine(id).state.platforms){
  if(!['spring','snowbank','canopy','moonShelf'].includes(p.kind))continue;
  assert.ok(p.art,`${p.id} needs visible supporting art`);const a=p.art,bytes=fs.readFileSync(path.join(__dirname,'../art',files[a.kind]));
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.ok(Math.abs(a.w/width-a.h/height)<1e-9,`${p.id} must keep native proportions`);
  for(let i=0;i<=32;i++){const x=a.x+a.w*i/32;assert.ok(a.foot>=B.ground(x,id),`${p.id} support floats at ${x}`);}
  assert.ok(p.surface.every(([x,y])=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h),`${p.id} contacts must remain on its painted asset`);
 }
});

test('both snowbank slopes lead onto and off the painted summit without a jump',()=>{
 for(const dir of [1,-1])for(const bank of B.createEngine(5).state.platforms){
  const e=B.createEngine(5);e.start();at(e,dir===1?bank.x-15:bank.end+15,{vx:dir*250});let peak=0,entered=false;
  for(let i=0;i<420;i++){
   e.update(1/120,{move:dir});const d=e.state.dog;
   if(d.platformId===bank.id){entered=true;peak=Math.max(peak,B.ground(d.x,5)-d.y);assert.ok(d.grounded);}
   if(entered&&(dir===1?d.x>bank.end+30:d.x<bank.x-30))break;
  }
  assert.ok(entered&&peak>140);assert.equal(e.state.dog.platformId,null);assert.equal(e.state.hearts,5);
 }
});
