import {defaultSave,WEAPONS,CHAPTERS} from '../data.mjs';
import {createRun,chooseBoon,chooseUpgrade,tick,ultimate} from '../engine.mjs';
const reports=[];
for(let ch=0;ch<CHAPTERS.length;ch++)for(const difficulty of ['normal','hard','hell']){
 const save=defaultSave();for(let i=0;i<ch;i++)save.clears[`${i}:normal`]=true;if(difficulty!=='normal')save.clears[`${ch}:normal`]=true;if(difficulty==='hell')save.clears[`${ch}:hard`]=true;
 for(const w of WEAPONS)save.levels[w.id]=Math.min(10,1+ch);
 const r=createRun(save,ch,difficulty,20260914+ch);while(r.state==='boon')chooseBoon(r,['damage','slow','crit'].find(id=>r.boonOptions.includes(id)));
 let cards=0,frames=0;
 while(!['won','lost'].includes(r.state)&&frames++<36000){if(r.state==='choice'){
   const score=c=>({unlock:7,legendary:15,special:4,damage:5,crit:3,haste:4,criticalDamage:2,power:1}[c.kind]||0)+({green:0,blue:2,red:5,gold:10}[c.rarity]||0)+(c.kind==='unlock'&&['vortex','dragon','chain','laser','satellite'].includes(c.weapon)?3:0);
   const choice=[...r.choices].sort((a,b)=>score(b)-score(a))[0];chooseUpgrade(r,choice.id);cards++;
  }else{if(r.charge>=100)ultimate(r);tick(r,.05);}}
 reports.push({chapter:ch+1,difficulty,result:r.state,seconds:Math.round(r.time),cards,health:r.health,weapons:r.weapons.map(w=>w.id).join(',')});
}
console.table(reports);if(reports.some(r=>r.result!=='won'))process.exitCode=1;
