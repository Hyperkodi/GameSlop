import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,BOONS,FRENZY_SPEED,FRENZY_SECTIONS,frenzyReduction,validRun} from '../data.mjs';
import {createRun,createTournamentRun,chooseBoon,tick,boonOptionsFor} from '../engine.mjs';

function unlocked(){const s=defaultSave(0);s.clears['0:easy']=true;s.clears['0:hard']=true;return s;}
function playing(difficulty,boon='damage',seed=7){const r=createRun(unlocked(),0,difficulty,seed);while(r.state==='boon')chooseBoon(r,r.boonOptions.find(id=>id===boon)||r.boonOptions[0]);r.pending=0;r.choices=[];r.state='playing';return r;}

test('frenzy boons never appear on Easy and appear on some Hard and Impossible seeds',()=>{
 const frenzy=BOONS.filter(b=>b.frenzy).map(b=>b.id);
 for(let seed=1;seed<=40;seed++)assert.ok(!boonOptionsFor('easy',seed).some(id=>frenzy.includes(id)));
 const hard=Array.from({length:60},(_,i)=>boonOptionsFor('hard',i+1).filter(id=>frenzy.includes(id)).length);
 assert.ok(hard.some(n=>n===1)&&hard.some(n=>n===0),'hard should offer a frenzy boon on some seeds but not all');
 assert.ok(hard.every(n=>n<=1),'never more than one frenzy boon');
 const impossible=Array.from({length:60},(_,i)=>boonOptionsFor('impossible',i+1).filter(id=>frenzy.includes(id)).length);
 assert.ok(impossible.filter(n=>n===1).length>hard.filter(n=>n===1).length,'impossible offers it more often than hard');
 for(let seed=1;seed<=10;seed++)assert.deepEqual(boonOptionsFor('hard',seed),boonOptionsFor('hard',seed),'deterministic per seed');
});

test('the snake rushes at frenzy speed until enough sections are on the board, then settles',()=>{
 const r=playing('easy');assert.equal(r.entered,0);
 tick(r,.05);assert.equal(r.frenzy,FRENZY_SPEED);assert.ok(validRun(r));
 const before=r.headDistance;let frames=0;while(r.frenzy>1&&frames++<20000)tick(r,.05);
 assert.ok(r.entered>=FRENZY_SECTIONS,`frenzy ended with ${r.entered} sections entered`);assert.equal(r.frenzy,1);assert.ok(r.headDistance>before);
 const distance=r.headDistance;tick(r,.05);const normalStep=r.headDistance-distance;assert.ok(normalStep>0&&normalStep<20,'normal speed after frenzy');
});

test('frenzy boons scale the rush down and Trading Halt removes it',()=>{
 assert.equal(frenzyReduction([]),0);assert.equal(frenzyReduction(['frenzy25']),.25);assert.equal(frenzyReduction(['frenzy50','frenzy25']),.5);assert.equal(frenzyReduction(['frenzy100']),1);
 const seed=[...Array(200).keys()].find(s=>boonOptionsFor('hard',s+1).includes('frenzy100'))+1;
 const halted=playing('hard','frenzy100',seed);tick(halted,.05);assert.equal(halted.frenzy,1);
 const s25=[...Array(200).keys()].find(s=>boonOptionsFor('hard',s+1).includes('frenzy25'))+1;
 const bumped=playing('hard','frenzy25',s25);tick(bumped,.05);assert.equal(bumped.frenzy,1+(FRENZY_SPEED-1)*.75);
});

test('tournament has no frenzy and rejects a corrupt entered count',()=>{
 const t=createTournamentRun(unlocked(),3);chooseBoon(t,'damage');t.pending=0;t.choices=[];t.state='playing';tick(t,.05);assert.equal(t.frenzy,1);
 const r=playing('easy');r.entered=-1;assert.equal(validRun(r),false);r.entered=2.5;assert.equal(validRun(r),false);r.entered=2;assert.ok(validRun(r));
});
