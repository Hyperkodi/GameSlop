import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {normalizeSave,defaultSave,validRun,weapon,SPECIAL_CHARGE} from '../data.mjs';
import {makeWeapon,createRun,chooseBoon,fire,tick,hit} from '../engine.mjs';
import {economyReplay} from './economy-harness.mjs';
test('real v1 engine fixture preserves account and both active run slots',()=>{
 const raw=JSON.parse(readFileSync(new URL('./fixtures/v1-original-engine.json',import.meta.url))),s=normalizeSave(raw,0);
 assert.equal(s.coins,98765);assert.equal(s.totalRuns,345);assert.equal(s.tournamentBest,876543);assert.equal(s.tournamentRuns,7);assert.equal(s.cores,14*8);assert.equal(s.owned.length,14);
 assert.deepEqual(s.furthest,{easy:21,hard:21,impossible:21});assert.equal(s.run.state,'choice');assert.equal(s.tournamentRun.state,'paused');assert.equal(s.tournamentRun.revivesUsed,2);
 assert.deepEqual(s.run.choices,raw.run.choices);assert.deepEqual(s.run.weapons,raw.run.weapons);assert.deepEqual(s.tournamentRun.bullets,raw.tournamentRun.bullets);
 for(const id of Object.keys(raw.levels)){assert.ok(makeWeapon(id,s.levels[id],[],s.ranks[id]).damage>=weapon(id).damage*2.08);assert.equal(s.parts[id],114);}
 assert.deepEqual(normalizeSave(s,0),s,'migration is idempotent');
});
test('all ten weapons resume deterministically with their active effects',()=>{
 for(const id of ['paper','printer','sniper','halving','slippage','copium','trap','nuke','lambo','flashloan']){
  const s=defaultSave(0),r=createRun(s,0,'easy',49);chooseBoon(r,'damage');r.state='playing';r.pending=0;r.choices=[];r.weapons=[makeWeapon(id)];fire(r,r.weapons[0],r.segments[0]);s.run=r;
  const resumed=normalizeSave(JSON.parse(JSON.stringify(s)),0).run;assert.ok(resumed,id);
  for(let i=0;i<5;i++){tick(r,.05);tick(resumed,.05);}assert.deepEqual(resumed,r,id);
 }
});
test('campaign charge uses damage actually dealt and scales with encounter health',()=>{
 const r=createRun(defaultSave(0));chooseBoon(r,'damage');const w=r.weapons[0];w.crit=0;const s={hp:10,maxHp:10,x:100,y:100};hit(r,s,w,1e9);assert.ok(Math.abs(r.charge-.12*SPECIAL_CHARGE)<1e-9);
 r.chapter=99;r.charge=0;s.hp=10;hit(r,s,w,10);assert.ok(r.charge<.00001);
});
test('economy replay meets 85% and catches a halved reward regression',()=>{
 const result=economyReplay();assert.equal(result.rows.length,100);assert.ok(result.minimum>=.85);assert.ok(result.farms<=40);assert.throws(()=>economyReplay({incomeScale:.5}),/Economy starved/);
});
