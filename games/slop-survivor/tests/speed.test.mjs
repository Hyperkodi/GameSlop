import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,normalizeSave} from '../data.mjs';
test('game speed defaults to 1x, remembers 2x, and rejects anything else',()=>{
 assert.equal(defaultSave(0).settings.speed,1);
 assert.equal(normalizeSave({version:2,settings:{speed:2}},0).settings.speed,2);
 for(const bad of [3,0,-1,'2',null,1.5])assert.equal(normalizeSave({version:2,settings:{speed:bad}},0).settings.speed,1);
});
