import test from 'node:test';import assert from 'node:assert/strict';
import {LEVELS,defaultSave,validRun,normalizeSave,weaponUnlocked,weapon} from '../data.mjs';
import {campaignSpacing,waveMovement,feedSeconds} from '../campaign-pacing.mjs';
import {createRun,createTournamentRun,chooseBoon,spawnWave,tick,makeWeapon,fire} from './legacy-engine.mjs';
import {sectionSpan,closeSectionGaps,updatePositions} from '../snake.mjs';
import {intendedAccount} from './campaign-harness.mjs';
test('all levels derive bounded spacing and a consistent entrance travel budget',()=>{
 for(const level of LEVELS){assert.equal(level.pieceSpacing,campaignSpacing(level));assert.ok(level.pieceSpacing>=32&&level.pieceSpacing<=100);
 const time=Array.from({length:level.waves},(_,i)=>Math.min(64,level.segments+i*3)*level.pieceSpacing/(waveMovement(i+1)*level.speed)).reduce((a,b)=>a+b,0);assert.ok(time>=feedSeconds(level)-.01&&time<=feedSeconds(level)*1.25,`${level.number}: ${time}`);}
});
test('campaign starts at the entrance, with unchanged continuous simulation time',()=>{
 const r=createRun(defaultSave(0));chooseBoon(r,'damage');assert.equal(r.headDistance,0);r.pending=0;r.choices=[];r.state='playing';const start=r.time;tick(r,.05);assert.equal(r.time,start+.05);assert.ok(r.headDistance>0);assert.ok(r.segments.some(s=>s.hp>0&&s.points.some(p=>p.x>22&&p.x<458)));
});
test('new spacing preserves tail position and exact section recoil',()=>{
 const r=createRun(defaultSave(0));chooseBoon(r,'damage');const head=r.segments[0],dead=r.segments[2],tail=r.segments.at(-1),tailBefore=tail.distance,headBefore=head.distance,width=sectionSpan(dead);closeSectionGaps(r,new Set([dead.id]));assert.equal(tail.distance,tailBefore);assert.equal(head.distance,headBefore);assert.equal(head.retreat,width);
});
test('tournament retains its original entrance and 32-pixel geometry',()=>{
 const r=createTournamentRun(defaultSave(0));chooseBoon(r,'damage');assert.equal(r.headDistance,640);assert.ok(r.segments.every(s=>s.spacing===32));
});
test('expanded geometry resumes exactly and rejects invalid saved spacing',()=>{
 const s=defaultSave(0),r=createRun(s);chooseBoon(r,'damage');s.run=r;assert.ok(validRun(r));assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(s)),0).run,r);
 for(const invalid of [NaN,-1,101]){r.segments[0].spacing=invalid;assert.equal(validRun(r),false);}
});
test('a trap stops living victims for two seconds and releases a defeated victim',()=>{
 const r=createRun(defaultSave(0));chooseBoon(r,'damage');r.state='playing';r.pending=0;r.choices=[];r.headDistance=640;r.weapons=[makeWeapon('trap')];r.segments.forEach(s=>{s.spacing=32;s.hp=s.maxHp=1e7;});updatePositions(r);fire(r,r.weapons[0],r.segments[0]);r.headDistance+=36;updatePositions(r);r.weapons[0].timer=10;tick(r,.05);assert.ok(r.rootUntil>=r.time+1.99);const distance=r.headDistance;tick(r,.05);assert.equal(r.headDistance,distance);for(const s of r.segments)if(r.rootTargets.includes(s.id))s.hp=0;tick(r,.05);assert.equal(r.rootUntil,0);
});
test('intended account never pre-grants the encounter being tested',()=>{
 for(const d of ['easy','hard','impossible']){const s=intendedAccount(16,d);assert.equal(!!s.clears[`15:${d}`],false);assert.equal(weaponUnlocked(s,weapon('laser')),d==='impossible');}
});
