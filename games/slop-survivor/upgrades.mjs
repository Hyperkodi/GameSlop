import {UPGRADE_RARITIES,LEGENDARY,weapon,random} from './data.mjs';
export const rarity=id=>UPGRADE_RARITIES.find(t=>t.id===id)||UPGRADE_RARITIES[1];
export function rollRarity(state){let pick=random(state)*100;for(const t of UPGRADE_RARITIES){pick-=t.weight;if(pick<0)return t.id;}return 'gold';}
export function values(card){if(card.legacy||!card.rarity)return {damage:.5,crit:.25,haste:.2,mult:.5,ranks:1};return rarity(card.rarity);}
export const nextDamage=(w,v)=>w.damage+Math.min(w.damage,w.endless?weapon(w.id).damage*40:Infinity)*v.damage;
export function preview(w,kind,tier='blue',legacy=false){const v=values({rarity:tier,legacy}),base=weapon(w.id),rank=Math.min(v.ranks,4-w.specialRanks);switch(kind){
 case'damage':return `Damage ${Math.round(w.damage)} → ${Math.round(nextDamage(w,v))} (${w.endless&&w.damage>base.damage*40?'late-run scaling':'+'+v.damage*100+'%'})`;
 case'power':return `Hit damage +${Math.round(base.damage*v.damage)}. Adds base power before future multipliers.`;
 case'crit':return `Critical chance ${Math.round(w.crit*100)}% → ${Math.round(Math.min(.85,w.crit+v.crit)*100)}% (+${Math.round(v.crit*100)} points; cap 85%)`;
 case'haste':return `Cooldown ${w.cooldown.toFixed(2)}s → ${Math.max(.09,w.cooldown*(1-v.haste)).toFixed(2)}s (−${v.haste*100}%)`;
 case'criticalDamage':return `Critical multiplier ${w.mult.toFixed(2)}× → ${Math.min(w.endless?6:Infinity,w.mult+v.mult).toFixed(2)}×`;
 case'legendary':return LEGENDARY[w.id][1];
 default:return `${rank>1?rank+' signature ranks. ':''}${base.specialText}${rank>1?' Applied once per rank.':''}`;
}}
export function eligible(r,tier,opening=false){const cards=[];
 for(const id of r.deck){const w=r.weapons.find(x=>x.id===id),b=weapon(id);if(!w){if(tier==='green'&&r.weapons.length<(r.slots||6))cards.push({id:`${id}:unlock`,weapon:id,kind:'unlock',title:b.name,description:b.description,rarity:'green',weight:2*(1+.06*((r.baseLevels[id]||1)-1)+.5*((r.baseRanks?.[id]||1)-1))});continue;}
  if(opening)continue;
  for(const kind of ['damage','power','crit','haste','special','criticalDamage','legendary']){
   if(kind==='criticalDamage'&&w.endless&&w.mult>=6||kind==='crit'&&w.crit>=.85||kind==='haste'&&w.cooldown<=.091||kind==='special'&&(tier==='green'||w.specialRanks>=4)||kind==='legendary'&&(tier!=='gold'||w.legendary||w.upgrades<3))continue;
   const title=kind==='legendary'?LEGENDARY[id][0]:kind==='special'?b.specialName:({damage:'Bigger numbers',power:'Heavy rounds',crit:'Critical mass',haste:'Overclock',criticalDamage:'Perfect execution'})[kind];
   cards.push({id:`${id}:${kind}`,weapon:id,kind,title,description:preview(w,kind,tier),rarity:tier,weight:kind==='legendary'?5:kind==='power'?.5:1});
  }
 }
 return cards;
}
export function drawCards(r,opening=false){const cards=[];let openingPool=opening&&eligible(r,'green',true).length>0;
 for(let slot=0;slot<3;slot++){
  const tier=openingPool?'green':rollRarity(r);let pool=eligible(r,tier,openingPool).filter(c=>!cards.some(x=>x.id===c.id));
  if(!pool.length&&openingPool){openingPool=false;pool=eligible(r,tier).filter(c=>!cards.some(x=>x.id===c.id));}
  if(!pool.length)break;
  let pick=random(r)*pool.reduce((n,c)=>n+c.weight,0),selected=pool.at(-1);for(const c of pool){pick-=c.weight;if(pick<0){selected=c;break;}}
  const {weight,...card}=selected;cards.push(card);
 }
 return cards;
}
export function applyCard(w,c){const v=values(c);if(c.kind==='damage')w.damage=nextDamage(w,v);if(c.kind==='power')w.damage+=Math.round(weapon(w.id).damage*v.damage);
 if(c.kind==='crit')w.crit=Math.min(.85,w.crit+v.crit);if(c.kind==='haste')w.cooldown=Math.max(.09,w.cooldown*(1-v.haste));if(c.kind==='criticalDamage')w.mult=Math.min(w.endless?6:Infinity,w.mult+v.mult);
 if(c.kind==='legendary'){if(w.legendary)return false;w.legendary=true;}
 if(c.kind==='special')for(let i=0;i<v.ranks&&w.specialRanks<4;i++){w.specialRanks++;switch(weapon(w.id).special){case'pierce':w.pierce+=w.id==='laser'?2:1;break;case'count':w.count++;break;case'radius':w.radius=Math.min(w.id==='nuke'?4000:800,w.radius*1.35);break;case'chain':w.chains+=2;break;case'slow':w.slow=Math.min(.6,w.slow+.1);break;case'haste':break;case'burn':w.burnTime=Math.min(15,w.burnTime+2);break;}}
 w.upgrades++;w.tier=1+Math.floor(w.upgrades/2);return true;
}
