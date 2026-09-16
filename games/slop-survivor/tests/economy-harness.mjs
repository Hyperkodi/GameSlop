import assert from 'node:assert/strict';
import {defaultSave,WEAPONS,FOUNDRY,weapon,weaponUnlocked,upgradeCost,upgradeWeapon,rankCost,rankUp,foundryCost,upgradeFoundry,refine,openChests,syncChests,random,unlockWeapon} from '../data.mjs';
import {completeRun,makeWeapon} from '../engine.mjs';
import {CORE,intendedAccount} from './campaign-harness.mjs';
import {effectiveDps} from '../presentation.mjs';
// Compare the same core on both accounts, so later discoveries do not disguise starvation.
export function powerRatio(save,n){const target=intendedAccount(n),ids=CORE.filter(id=>weaponUnlocked(save,weapon(id)));
 const power=s=>ids.reduce((sum,id)=>sum+effectiveDps(makeWeapon(id,s.levels[id],[],s.ranks[id],s.foundry))/effectiveDps(makeWeapon(id)),0);
 return power(save)/power(target);
}
export function spend(save,n){const target=intendedAccount(n),ids=CORE.filter(id=>weaponUnlocked(save,weapon(id)));
 // Refine only non-core parts, preserving all six useful inventories.
 for(const from of WEAPONS.filter(w=>!CORE.includes(w.id)))while(save.parts[from.id]>=3){const to=[...ids].sort((a,b)=>save.parts[a]/upgradeCost(save.levels[a],weapon(a).grade).parts-save.parts[b]/upgradeCost(save.levels[b],weapon(b).grade).parts)[0];refine(save,from.id,to);}
 for(let guard=0;guard<1000;guard++){
  const options=[];
  for(const id of ids){const level=save.levels[id],rank=save.ranks[id];if(level<target.levels[id]){
   if(level>=rank*10&&rank<5&&save.cores>=rankCost(rank))options.push({cost:rankCost(rank),buy:()=>rankUp(save,id)});
   else if(level<rank*10){const c=upgradeCost(level,weapon(id).grade);if(save.coins>=c.coins&&save.parts[id]>=c.parts)options.push({cost:c.coins,buy:()=>upgradeWeapon(save,id)});}
  }}
  for(const key of Object.keys(FOUNDRY))if(save.foundry[key]<target.foundry[key]&&save.coins>=foundryCost(save.foundry[key]+1))options.push({cost:foundryCost(save.foundry[key]+1),buy:()=>upgradeFoundry(save,key)});
  if(!options.length)break;assert.ok(options.sort((a,b)=>a.cost-b.cost)[0].buy());
 }
}
// Impossible is tuned to be lost often, so the replay credits its rewards only 70% of the
// time and farms Hard, which a player on the curve can actually clear.
// A route needing more than maxTotalFarms repeat clears counts as starvation: the player
// could grind through, but the design promises they should not have to.
export function economyReplay({incomeScale=1,maxFarms=40,maxTotalFarms=40,impossibleClearRate=.7}={}){
 const save=defaultSave(0),rngState={seed:301519},rng=()=>random(rngState),rows=[];let elapsed=0,farms=0;
 const reward=(n,d)=>{const ids=CORE.filter(id=>weaponUnlocked(save,weapon(id))),before=save.coins,parts={...save.parts};
  completeRun(save,{mode:'campaign',state:'won',chapter:n-1,difficulty:d,weapons:ids.map(id=>({id})),score:0,kills:0,time:600,resultApplied:false});
  save.coins=before+Math.floor((save.coins-before)*incomeScale);for(const id of Object.keys(parts))save.parts[id]=parts[id]+Math.floor((save.parts[id]-parts[id])*incomeScale);
  elapsed+=600000;syncChests(save,elapsed,rng);openChests(save,32,elapsed,rng);
 };
 openChests(save,32,0,rng);
 for(let n=1;n<=100;n++){
  spend(save,n);let repeats=0,initial=powerRatio(save,n);
  while(powerRatio(save,n)<.85&&n>1&&repeats<maxFarms){reward(n-1,'hard');repeats++;farms++;spend(save,n);}
  const ratio=powerRatio(save,n);assert.ok(ratio>=.85,`Economy starved before level ${n}: ${ratio.toFixed(3)}, ${repeats} repeats`);assert.ok(farms<=maxTotalFarms,`Economy starved: ${farms} repeat clears by level ${n}, more than ${maxTotalFarms}`);
  rows.push({level:n,ratio:+ratio.toFixed(3),beforeFarming:+initial.toFixed(3),repeats,coins:save.coins,coreLevels:CORE.map(id=>save.levels[id]).join('/'),foundry:{...save.foundry}});
  reward(n,'easy');reward(n,'hard');if(rng()<impossibleClearRate)reward(n,'impossible');
  // Unlock eligible S weapons with earned plans; this expands idle drops honestly.
  for(const w of WEAPONS)if(w.grade==='S')unlockWeapon(save,w.id);
 }
 return {rows,farms,minimum:Math.min(...rows.map(r=>r.ratio)),save};
}
if(process.argv[1]?.endsWith('economy-harness.mjs')){const {rows,farms,minimum}=economyReplay();for(const row of rows)console.log(JSON.stringify(row));console.log(`Economy: 100 levels, minimum power ${minimum}, ${farms} repeat clears, one 10-minute idle interval per clear.`);}
