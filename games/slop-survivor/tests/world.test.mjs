import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTERS,defaultSave,unlockedDifficulty,normalizeSave} from '../data.mjs';
import {bossForChapter,arenaForChapter,encounterPhase} from '../world.mjs';
import {pathPoint,updatePositions} from '../snake.mjs';
import {createRun,chooseBoon,chooseUpgrade,tick,makeWeapon,completeRun} from '../engine.mjs';
function ready(chapter){const save=defaultSave(100);for(let i=0;i<chapter;i++)save.clears[`${i}:easy`]=true;const r=createRun(save,chapter,'easy',42);chooseBoon(r,'damage');chooseUpgrade(r,r.choices[0].id);r.weapons=[];r.pending=0;r.lastChoice=10000;return {save,r};}
test('five boss identities and fifteen chapters retain progressive campaign gates',()=>{
 assert.equal(CHAPTERS.length,100);assert.equal(new Set(CHAPTERS.map((_,i)=>bossForChapter(i).name)).size,5);
 assert.deepEqual([39,49,19].map(arenaForChapter),['canyon','marina','citadel']);
 const {save,r}=ready(11);r.state='won';completeRun(save,r);assert.ok(unlockedDifficulty(save,12,'easy'));assert.equal(unlockedDifficulty(save,13,'easy'),false);
});
test('all new routes are continuous and reach the vault, with distinct layouts',()=>{
 const samples=[];for(const ch of [39,49,19]){let last=pathPoint(0,ch),crossed=false;for(let d=1;d<2600;d++){const p=pathPoint(d,ch);assert.ok(Math.hypot(p.x-last.x,p.y-last.y)<1.01);crossed||=p.y>575;last=p;}assert.ok(crossed);samples.push(pathPoint(400,ch));}assert.equal(new Set(samples.map(JSON.stringify)).size,3);
});
test('Rattlesatoshi warns before a bounded charge; pause freezes the phase',()=>{
 const {r}=ready(39);r.time=10;assert.equal(encounterPhase(r).id,'warning');r.time=12;assert.equal(encounterPhase(r).speed,1.6);
 const distance=r.headDistance;tick(r,.05);assert.ok(r.headDistance>distance);r.state='paused';const before=JSON.stringify(r);tick(r,.05);assert.equal(JSON.stringify(r),before);
});
test('Madame Mamba heals living damaged sections only during the chant, and saves preserve it',()=>{
 const {save,r}=ready(49);r.time=13;const section=r.segments[2];section.regen=false;section.hp=section.maxHp/2;const before=section.hp;tick(r,.05);assert.ok(section.hp>before);
 save.run=r;const loaded=normalizeSave(save,100).run;assert.equal(encounterPhase(loaded).id,'mend');
 section.hp=0;tick(r,0);assert.ok(!r.segments.includes(section));
});
test('Brass Baron shutters reduce body damage but leave the head and critical hits exposed',()=>{
 function damage(head,crit,time){const {r}=ready(19),w=makeWeapon('coin');w.timer=10;w.crit=crit;r.weapons=[w];r.time=time;const s=r.segments[head?0:1];s.armor=false;r.segments=[s];updatePositions(r);const p=s.points[0],hp=s.hp;
  r.bullets=[{id:++r.castId,weapon:'coin',x:p.x,y:p.y,vx:0,vy:0,age:0,life:1,r:1,hits:[],pierce:0,type:'bolt',color:'#fff',tier:1}];tick(r,0);return hp-s.hp;}
 assert.ok(Math.abs(damage(false,0,9)/damage(false,0,1)-.7)<1e-8);assert.equal(damage(true,0,9),damage(true,0,1));assert.equal(damage(false,1,9),damage(false,1,1));
});
