const test = require('node:test');
const assert = require('node:assert/strict');
const { createTimeline, sample, DURATION } = require('../js/cinematic.js');
test('three shots preserve the requested edit order and end before play starts', () => {
  assert.equal(sample(0).id, 'throw'); assert.equal(sample(3.99).id, 'throw');
  assert.equal(sample(4).id, 'flight'); assert.equal(sample(7.49).id, 'flight');
  assert.equal(sample(7.5).id, 'sprint'); assert.equal(sample(DURATION).done, true);
});
test('the glance precedes windup and release; the distant star follows the flight', () => {
  assert.equal(sample(.5).glance, 0); assert.ok(sample(1.5).glance > .5);
  assert.equal(sample(1.5).windup, 0); assert.ok(sample(2.6).windup > .9);
  assert.equal(sample(2.65).coinReleased, false); assert.equal(sample(2.75).coinReleased, true);
  assert.equal(sample(6).star, false); assert.equal(sample(6.5).star, true);
});
test('paused and skipped openings cannot accumulate gameplay time', () => {
  const c = createTimeline(); c.start(); for(let i=0;i<60;i++)c.update(1/60);
  assert.ok(Math.abs(c.state.time-1)<1e-10); c.update(0); assert.ok(Math.abs(c.state.time-1)<1e-10);
  c.skip(); assert.equal(c.active,false); assert.equal(c.state.done,true);
  c.update(.05); assert.equal(c.state.time,DURATION); c.start(); assert.equal(c.state.time,0);
});
test('timeline limits long frames and completes once', () => {
  const c=createTimeline(); c.start(); c.update(15); assert.equal(c.state.time,.05);
  for(let i=0;i<300;i++)c.update(.05); assert.equal(c.state.time,DURATION); assert.equal(c.active,false);
});
