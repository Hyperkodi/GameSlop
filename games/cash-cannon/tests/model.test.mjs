import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,launch,setAngle,step,replay,powerAt,VERSION} from '../js/model.mjs';
import {rugPose,RUG_DURATION} from '../js/animations.mjs';
import {EXCHANGES} from '../js/exchanges.mjs';
test('a saved launch reproduces distance, hazards and ending exactly',()=>{
 for(let seed=1;seed<=30;seed++){const s=createRun(seed);for(let i=0;i<73;i++)step(s);setAngle(s,10+seed%51);launch(s);while(s.phase!=='done')step(s);const copy=replay(s.launch);assert.deepEqual(copy,s);assert.ok(s.score>0);assert.ok(s.tick<22000);}
});
test('power oscillates between 15 and 100 percent; air input cannot relaunch',()=>{
 assert.equal(powerAt(0),.15);assert.equal(powerAt(78),1);assert.equal(powerAt(156),.15);const s=createRun();setAngle(s,100);assert.equal(s.angle,60);launch(s,1);const vx=s.vx;setAngle(s,10);assert.equal(s.angle,60);assert.equal(launch(s),false);assert.equal(s.vx,vx);
});
function collision(kind){const s=createRun();launch(s,1);s.x=290;s.y=kind==='cex'?200:60;s.vx=1200;s.vy=-200;s.objects=[{id:99,kind,x:355,y:kind==='cex'?200:0,phase:0,used:false}];s.nextX=100000;for(let i=0;i<15&&!s.objects[0].used;i++)step(s);return s;}
for(const kind of ['dex','cabal','cex'])test(kind+' launches CashCat upward and counts once',()=>{const s=collision(kind);assert.equal(s.objects[0].used,true);assert.equal(s.boosts,1);assert.ok(s.vy>0);assert.equal(s.phase,'flight');for(let i=0;i<15;i++)step(s);assert.equal(s.boosts,1);});
for(const kind of ['honey','rug'])test(kind+' ends the shot and freezes distance through the animation',()=>{const s=collision(kind);assert.equal(s.phase,'ending');assert.equal(s.reason,kind);const score=s.score;while(s.phase!=='done')step(s);assert.equal(s.score,score);assert.equal(s.boosts,0);});
test('a shot with no boosts settles naturally',()=>{const s=createRun();launch(s,.15);s.objects=[];s.nextX=100000;while(s.phase!=='done')step(s);assert.equal(s.reason,'out-of-gas');assert.ok(s.bounces>0);});
test('malformed replay data is rejected',()=>{for(const data of [{},{version:VERSION,seed:1,angle:NaN,power:1},{version:VERSION,seed:-1,angle:35,power:1},{version:VERSION,seed:1,angle:35,power:2}])assert.throws(()=>replay(data));});
test('rug sequence stops, pulls, tumbles and rests before results',()=>{
 assert.equal(rugPose(.2).rotation,0);assert.equal(rugPose(.2).offset,0);
 assert.ok(rugPose(.55).offset>0);assert.equal(rugPose(.55).rotation,0);
 assert.ok(rugPose(1.1).rotation>0);assert.ok(rugPose(1.1).catLift>0);
 assert.equal(rugPose(2).stage,'rest');assert.equal(rugPose(2).rugAlpha,0);assert.equal(rugPose(2).rotation,Math.PI*2.5);
 const s=collision('rug');assert.equal(s.endingLength,RUG_DURATION*120);assert.equal(s.vx,0);assert.equal(s.vy,0);
});
test('a flying cat above a rug is not caught by the old spike hitbox',()=>{
 const s=createRun();launch(s,1);s.x=320;s.y=75;s.vx=1200;s.vy=0;s.nextX=100000;s.objects=[{id:1,kind:'rug',x:355,y:0,used:false}];step(s);assert.equal(s.phase,'flight');assert.equal(s.objects[0].used,false);
});
test('every real exchange variant can spawn with valid metadata',()=>{
 const seen=new Set();for(let seed=0;seed<EXCHANGES.length;seed++){const s=createRun(seed);seen.add(s.objects.find(o=>o.kind==='cex').exchange);}assert.equal(seen.size,11);assert.equal(new Set(EXCHANGES.map(e=>e.id)).size,11);
});
test('the balloon itself can be hit above the hanging bomb',()=>{
 const s=createRun();launch(s,1);s.x=290;s.y=238;s.vx=1200;s.vy=0;s.nextX=100000;s.objects=[{id:1,kind:'cex',exchange:0,x:355,y:200,phase:0,used:false}];for(let i=0;i<5;i++)step(s);assert.equal(s.boosts,1);
});
