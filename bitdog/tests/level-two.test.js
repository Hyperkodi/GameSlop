const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,ground,FETCH,HOME,RETURN_TIME,PONDS,BRIDGE}=require('../js/engine.js');
const advance=(e,seconds,input={})=>{for(let i=0;i<seconds*120;i++)e.update(1/120,input);};
test('five distinct hits end an attempt; one overlap cannot drain all hearts',()=>{
 const e=createEngine();e.start();const o=e.state.obstacles[0],d=e.state.dog;
 const hit=()=>{Object.assign(d,{x:o.x-47,y:ground(o.x-47),vx:350,grounded:true,invincible:0});o.cooldown=0;e.update(.03,{move:1});};
 hit();assert.equal(e.state.hearts,4);e.update(.03,{move:1});assert.equal(e.state.hearts,4);
 hit();assert.equal(e.state.hearts,3);hit();assert.equal(e.state.hearts,2);hit();assert.equal(e.state.hearts,1);hit();assert.equal(e.state.hearts,0);assert.equal(e.state.phase,'lost');assert.equal(e.state.failure,'hearts');
 const x=d.x;advance(e,2,{move:1});assert.equal(d.x,x);e.start();assert.equal(e.state.hearts,5);
});
test('outbound exploration does not consume the return countdown',()=>{
 const e=createEngine();e.start();advance(e,100);assert.equal(e.state.returnTime,RETURN_TIME);assert.equal(e.state.phase,'outbound');
 Object.assign(e.state.dog,{x:FETCH,y:ground(FETCH)});e.update(1/120);assert.equal(e.state.returnTime,RETURN_TIME);advance(e,2);assert.ok(e.state.returnTime<RETURN_TIME-1.9);
});
test('jumping over shallow water preserves speed without losing hearts',()=>{
 const wet=createEngine(),air=createEngine();for(const e of [wet,air]){e.start();Object.assign(e.state.dog,{x:PONDS[0].x+10,y:ground(PONDS[0].x+10),vx:600});}
 advance(wet,.2,{move:1,roll:true});advance(air,.2,{move:1,roll:true,jump:true});
 assert.ok(air.state.dog.vx>wet.state.dog.vx+150);assert.equal(wet.state.dog.wet,true);assert.equal(air.state.dog.wet,false);assert.equal(wet.state.hearts,5);
});
test('raised trail is reachable by jumping and lower passage remains open',()=>{
 const high=createEngine(),low=createEngine();for(const e of [high,low]){e.start();Object.assign(e.state.dog,{x:BRIDGE.x-150,y:ground(BRIDGE.x-150),vx:490});}
 advance(high,.62,{move:1,jump:true});advance(low,.62,{move:1});
 assert.equal(high.state.dog.platform,true);assert.equal(high.state.dog.y,BRIDGE.y);
 assert.equal(low.state.dog.platform,false);assert.equal(low.state.dog.y,ground(low.state.dog.x));
 assert.ok(high.state.coins>low.state.coins);
});
test('delivery itemizes coin and remaining-time bonuses exactly once',()=>{
 const e=createEngine();e.start();Object.assign(e.state,{phase:'return',coins:12,score:3200,obstaclePoints:2000,returnTime:30.8});Object.assign(e.state.dog,{x:HOME,y:ground(HOME),carrying:true});
 e.update(1/120);assert.equal(e.state.score,5700);assert.deepEqual(e.state.result,{obstacles:2000,coins:1200,time:1500,delivery:1000,perfect:true});advance(e,2);assert.equal(e.state.score,5700);
});
