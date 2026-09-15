import {defaultSave,WEAPONS,LEVELS,DIFFICULTIES,FOUNDRY,weaponUnlocked,normalizeSave,validRun} from '../data.mjs';
import {createRun,chooseBoon,chooseUpgrade,tick,ultimate} from '../engine.mjs';
export const CORE=['coin','paper','gas','chain','laser','burn'];
export function intendedAccount(n,difficulty='easy'){
 const s=defaultSave(0);for(let i=0;i<n-1;i++)for(const d of DIFFICULTIES)s.clears[`${i}:${d.id}`]=true;
 if(difficulty!=='easy')s.clears[`${n-1}:easy`]=true;
 if(difficulty==='impossible')s.clears[`${n-1}:hard`]=true;
 // S weapons require discovery plus a later blueprint chase.
 for(const w of WEAPONS)if(w.grade==='S'&&w.discovery+6<n)s.owned.push(w.id);
 const level=Math.max(1,Math.min(50,Math.round(n/2))),rank=Math.ceil(level/10);
 for(const id of CORE)if(weaponUnlocked(s,WEAPONS.find(w=>w.id===id))){s.levels[id]=level;s.ranks[id]=rank;}
 for(const [k,t] of Object.entries(FOUNDRY))s.foundry[k]=Math.floor(t.max*Math.min(1,n/95));
 return normalizeSave(s,0);
}
export function simulate(n,d,{save=intendedAccount(n,d),seed=20260914+n-1,noCards=false,maxSeconds=1800}={}){
 const r=createRun(save,n-1,d,seed);while(r.state==='boon')chooseBoon(r,['damage','slow','crit'].find(id=>r.boonOptions.includes(id)));
 let cards=0,frames=0;
 while(!['won','lost'].includes(r.state)&&r.time<maxSeconds&&frames++<200000){
  if(['playing','choice'].includes(r.state)&&(r.state==='choice'||frames%1200===0)&&!validRun(r))throw Error(`Unsavable combat state at ${n} ${d}, ${r.time}s`);
  if(r.state==='choice'){
   if(noCards){r.choices=[];r.pending=0;r.state='playing';r.lastChoice=r.time;continue;}
   const score=c=>({unlock:7,legendary:15,special:4,damage:5,crit:3,haste:4,criticalDamage:2,power:1}[c.kind]||0)+({green:0,blue:2,red:5,gold:10}[c.rarity]||0)+(c.kind==='unlock'?.2*(r.baseLevels[c.weapon]-1)-(['trap','rug','vortex','copium'].includes(c.weapon)?8:0):Math.log2(Math.max(1,(r.weapons.find(w=>w.id===c.weapon)?.damage||1)/WEAPONS.find(w=>w.id===c.weapon).damage))*.4);
   const choice=[...r.choices].sort((a,b)=>score(b)-score(a))[0];if(!choice||!chooseUpgrade(r,choice.id))throw Error(`Invalid choice at ${n} ${d}`);cards++;
  }else{if(r.charge>=100)ultimate(r);tick(r,.05);}
 }
 return {level:n,difficulty:d,result:r.state,seconds:Math.round(r.time),cards,shields:r.health,margin:+(r.health/r.maxHealth).toFixed(3),weapons:r.weapons.map(w=>w.id).join(',')};
}
