import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,normalizeSave,validRun} from '../data.mjs';
import {createRun,createTournamentRun,chooseBoon,chooseUpgrade,tick,spawnWave,reviveTournament,endTournament,completeRun,makeWeapon,offerChoice} from '../engine.mjs';
import {applyCard,nextDamage,preview} from '../upgrades.mjs';
function ready(){const s=defaultSave(),r=createTournamentRun(s,123);chooseBoon(r,'damage');chooseUpgrade(r,r.choices[0].id);r.events=[];return {s,r};}
function breach(r){r.health=1;r.headDistance=2100;r.pending=0;r.lastChoice=r.time+100;tick(r,.05);}
test('endless waves continue past campaign completion and introduce tougher traits with bounded segment counts',()=>{
 const {r}=ready();let lastHp=0;
 for(let i=1;i<=30;i++){
  assert.equal(r.wave,i);assert.notEqual(r.state,'won');assert.ok(r.segments[0].maxHp>lastHp);lastHp=r.segments[0].maxHp;
  assert.ok(r.segments.length<=64);assert.ok(validRun(r));
  if(i>=3)assert.ok(r.segments.some(s=>s.armor));if(i>=5)assert.ok(r.segments.some(s=>s.regen));if(i>=7)assert.ok(r.segments.some(s=>s.volatile));
  r.segments=[];r.state='playing';r.pending=0;tick(r,.05);
 }
});
test('three revives survive reload, preserve arsenal and score, then the fourth death ends the attempt',()=>{
 let {s,r}=ready();r.score=1234;
 for(let used=0;used<3;used++){
  breach(r);assert.equal(r.state,'revive');assert.equal(r.revivesUsed,used);assert.ok(validRun(r));
  const frozen=JSON.stringify(r);tick(r,1);assert.equal(JSON.stringify(r),frozen);
  s.tournamentRun=r;s=normalizeSave(JSON.parse(JSON.stringify(s)));r=s.tournamentRun;assert.ok(r);
  const arsenal=JSON.stringify(r.weapons),score=r.score;assert.ok(reviveTournament(r));
  assert.equal(r.revivesUsed,used+1);assert.equal(r.health,r.maxHealth);assert.equal(r.headDistance,640);
  assert.equal(r.score,score);assert.equal(JSON.stringify(r.weapons),arsenal);assert.equal(reviveTournament(r),false);assert.ok(validRun(r));
 }
 breach(r);assert.equal(r.state,'lost');assert.equal(reviveTournament(r),false);
});
test('campaign and tournament resume independently; finishing a tournament cannot unlock chapters or delete the campaign',()=>{
 const {s,r}=ready();s.run=createRun(s);s.tournamentRun=r;
 const loaded=normalizeSave(JSON.parse(JSON.stringify(s)));assert.ok(loaded.run);assert.ok(loaded.tournamentRun);
 const campaign=JSON.stringify(s.run);r.score=987;r.kills=14;breach(r);assert.ok(endTournament(r));
 const reward=completeRun(s,r);assert.equal(reward.tournament,true);assert.equal(s.tournamentBest,r.score);assert.equal(s.tournamentRuns,1);
 assert.deepEqual(s.clears,{});assert.equal(s.tournamentRun,null);assert.equal(JSON.stringify(s.run),campaign);
 const coins=s.coins;assert.equal(completeRun(s,r),null);assert.equal(s.coins,coins);
 const next=createTournamentRun(s);assert.equal(next.revivesUsed,0);assert.equal(next.score,0);assert.deepEqual(next.weapons,[]);
});
test('invalid revive counts, cross-mode saves and impossible revive states are rejected',()=>{
 const {s,r}=ready();for(const n of [-1,4,1.5,undefined]){s.tournamentRun={...r,revivesUsed:n};assert.equal(normalizeSave(s).tournamentRun,null);}
 s.tournamentRun={...r,state:'revive',health:1};assert.equal(normalizeSave(s).tournamentRun,null);
 s.run=r;s.tournamentRun=createRun(s);assert.equal(normalizeSave(s).run,null);assert.equal(normalizeSave(s).tournamentRun,null);
 assert.equal(endTournament(createRun(s)),false);
});
test('campaign victory also leaves an unfinished tournament untouched',()=>{
 const {s,r}=ready();s.tournamentRun=r;const campaign=createRun(s);campaign.state='won';completeRun(s,campaign);assert.equal(s.tournamentRun,r);
});
test('late tournament damage grows steadily and previews match the actual gain',()=>{
 const w=makeWeapon('laser');w.endless=true;w.damage=3400;
 const expected=nextDamage(w,{damage:.5});assert.equal(expected,4080);assert.match(preview(w,'damage','blue'),/4\.08K.*late-run scaling/);
 applyCard(w,{kind:'damage',rarity:'blue'});assert.equal(w.damage,expected);
 w.mult=5.8;applyCard(w,{kind:'criticalDamage',rarity:'gold'});assert.equal(w.mult,6);
 const campaign=makeWeapon('laser');campaign.damage=3400;applyCard(campaign,{kind:'damage',rarity:'blue'});assert.equal(campaign.damage,5100);
});
test('tournament scores cannot be inflated with overkill; swarm tolerates the previous weapon killing all visible targets',()=>{
 const {r}=ready();r.weapons=[makeWeapon('laser'),makeWeapon('swarm')];r.weapons[0].damage=1e9;r.weapons[0].legendary=true;
 const target=r.segments[0];target.hp=target.maxHp=10;r.segments=[target];r.pending=0;r.lastChoice=100;
 assert.doesNotThrow(()=>tick(r,.05));assert.equal(r.weapons[0].totalDamage,10);assert.equal(r.score,351);assert.equal(r.bullets.length,0);
});
test('large endless clears coalesce upgrade prompts and leave combat time between choices',()=>{
 const {r}=ready();r.pending=16;r.time=2;offerChoice(r);assert.equal(r.pending,1);assert.equal(r.state,'playing');
 r.time=6;offerChoice(r);assert.equal(r.state,'choice');assert.equal(r.choices.length,3);
 chooseUpgrade(r,r.choices[0].id);r.pending=10;offerChoice(r);assert.equal(r.state,'playing');assert.equal(r.pending,1);
});
