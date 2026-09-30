const test=require('node:test'),assert=require('node:assert/strict');
const Campaign=require('../js/campaign.js'),{createEngine}=require('../js/engine.js');
test('the campaign advances only after delivery, carries hearts and scores once, and ends at eight',()=>{
 const c=Campaign.create();assert.equal(c.hearts,5);assert.equal(c.advance(),false);
 for(let level=1;level<=8;level++){
  assert.equal(c.level,level);
  const e=createEngine(c.level,{hearts:c.hearts});e.start();
  assert.equal(e.state.hearts,level===1?5:3);
  e.reset();e.start();assert.equal(e.state.hearts,level===1?5:3);
  const result={level:{id:level},phase:'won',hearts:3,score:2000};
  c.finish(result);c.finish(result);assert.equal(c.score,level*2000);
  assert.equal(c.advance(),level<8);
 }
 assert.equal(c.level,8);c.restart();assert.equal(c.level,1);assert.equal(c.hearts,5);assert.equal(c.score,0);
});
test('failure cannot advance or bank points and a fresh run resets the shared hearts',()=>{
 for(const failure of ['hearts','time']){
  const c=Campaign.create();c.finish({level:{id:1},phase:'won',hearts:2,score:5000});c.advance();
  c.finish({level:{id:2},phase:'lost',failure,hearts:failure==='hearts'?0:2,score:300});
  assert.equal(c.advance(),false);assert.equal(c.score,5000);
  c.restart();assert.equal(c.level,1);assert.equal(c.hearts,5);assert.equal(c.score,0);
 }
});
