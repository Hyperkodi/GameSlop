import assert from 'node:assert/strict';
import {simulate,intendedAccount,CORE} from './campaign-harness.mjs';
import {economyReplay} from './economy-harness.mjs';
import {LEVELS,DIFFICULTIES,weapon,weaponUnlocked,arsenalSlots} from '../data.mjs';
import {makeWeapon,createRun,spawnWave} from '../engine.mjs';
import {effectiveDps} from '../presentation.mjs';
import {accountPower,cardsNeeded,EHP,speed} from '../../../docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs';
const full=process.argv.includes('--full'),reports=[],bands={easy:[.73,.98],hard:[1.39,1.87],impossible:[2.04,2.76]};
function simulatedPool(n){const r=createRun(intendedAccount(n),n-1,'easy',1);let hp=0;for(let wave=1;wave<=LEVELS[n-1].waves;wave++){spawnWave(r);assert.ok(r.segments.reduce((a,s)=>a+(s.pieces||1),0)<=64);hp+=r.segments.reduce((a,s)=>a+s.maxHp,0);}return hp;}
const firstPool=simulatedPool(1);
// The design's card band is an analytical pressure index, not a measured minimum
// multiplier. Substitute actual spawned HP and actual permanent weapon/Foundry
// stats into that index; report the real engine wins and shield margins separately.
function pressure(n,d){const s=intendedAccount(n),ids=CORE.filter(id=>weaponUnlocked(s,weapon(id))),permanent=ids.reduce((sum,id)=>sum+effectiveDps(makeWeapon(id,s.levels[id],[],s.ranks[id],s.foundry))/effectiveDps(makeWeapon(id)),0)/ids.length;
 const slots=arsenalSlots(s),arsenal=(1+2.6*(1-Math.exp(-(n-1)/24)))*(slots===8?1.12*1.09:slots===7?1.12:1),bonus=(1+.08*(LEVELS[n-1].waves-3))*(1+.15*Math.min(1,n/60));
 const pool=simulatedPool(n)/firstPool;assert.ok(Math.abs(pool/EHP(n)-1)<.01,`HP solve ${n}`);
 assert.ok(Math.abs(LEVELS[n-1].speed-speed(n))<1e-9,`speed ${n}`);
 return pool*DIFFICULTIES.find(x=>x.id===d).hp*LEVELS[n-1].speed/bonus/(permanent*arsenal);
}
for(let n=1;n<=100;n++)if(full||n===1||n%5===0){
 for(const d of Object.keys(bands)){
  const result=simulate(n,d),need=pressure(n,d),[lo,hi]=bands[d];result.modelCards=+cardsNeeded(n,d).toFixed(3);result.enginePressure=+need.toFixed(3);reports.push(result);console.log(JSON.stringify(result));
  if(result.result!=='won'||need<lo*.75||need>hi*1.25)process.exitCode=1;
 }
 const noCards=simulate(n,'hard',{noCards:true});console.log(JSON.stringify({...noCards,check:'hard-without-cards'}));if(noCards.result!=='lost')process.exitCode=1;
}
const economy=economyReplay();assert.ok(economy.farms<=20,'economy requires excessive repeat farming');for(const row of economy.rows)console.log(JSON.stringify({check:'economy',...row}));
const times=reports.map(r=>r.seconds).sort((a,b)=>a-b),inTarget=times.filter(t=>t>=360&&t<=720).length;
console.log(`SUMMARY: ${reports.filter(r=>r.result==='won').length}/${reports.length} engine wins; ${reports.length/3} Hard no-card losses required; economy minimum ${economy.minimum}, ${economy.farms} repeat clears. Runtime min/median/max ${times[0]}/${times[Math.floor(times.length/2)]}/${times.at(-1)} seconds; ${inTarget}/${times.length} within 6 to 12 minutes. ${process.exitCode?'FAIL':'PASS'}`);
