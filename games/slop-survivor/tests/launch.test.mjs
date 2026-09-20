import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,normalizeSave,highestUnlocked,unlockedDifficulty} from '../data.mjs';
import {createRun} from '../engine.mjs';

test('every legacy chapter selection migrates to a playable campaign level',()=>{
 for(let chapter=0;chapter<15;chapter++){
  const raw={version:1,selected:chapter,difficulty:'normal',coins:4321,clears:Object.fromEntries(Array.from({length:chapter},(_,i)=>[`${i}:normal`,true]))};
  const save=normalizeSave(raw);
  assert.ok(unlockedDifficulty(save,save.selected,save.difficulty),`legacy chapter ${chapter+1}`);
  assert.doesNotThrow(()=>createRun(save,save.selected,save.difficulty));
  assert.equal(save.coins,raw.coins);
 }
});

test('already migrated locked selection repairs without changing account progression',()=>{
 const raw={...defaultSave(),selected:4,selectedManual:true,difficulty:'hard',coins:4321,clears:{'0:easy':true,'1:easy':true,'2:easy':true}};
 raw.levels.coin=5;raw.parts.coin=17;
 const save=normalizeSave(raw);
 assert.equal(save.selected,highestUnlocked(save));assert.equal(save.selected,3);
 assert.equal(save.difficulty,'easy');assert.equal(save.selectedManual,false);
 assert.deepEqual(save.clears,raw.clears);assert.deepEqual(save.levels,raw.levels);
 assert.deepEqual(save.parts,raw.parts);assert.equal(save.coins,raw.coins);
 assert.doesNotThrow(()=>createRun(save,save.selected,save.difficulty));
});

test('valid manual farming level and unlocked difficulty stay selected',()=>{
 const raw={...defaultSave(),selected:1,selectedManual:true,difficulty:'hard',clears:{'0:easy':true,'1:easy':true,'2:easy':true}};
 const save=normalizeSave(raw);
 assert.equal(save.selected,1);assert.equal(save.selectedManual,true);assert.equal(save.difficulty,'hard');
 assert.doesNotThrow(()=>createRun(save,save.selected,save.difficulty));
});
