import {snakeSlowFactor} from '../rug-field.mjs';
import {defaultSave,LEVELS,DIFFICULTIES} from '../data.mjs';
import {createRun,chooseBoon,chooseUpgrade,tick,ultimate} from '../engine.mjs';
import {sectionVisible,aimPoint} from '../snake.mjs';
import {routePoint,vent} from '../encounters.mjs';
import {actionSpeed} from '../action-combat.mjs';
export function play({seed=77,mode='active',save=defaultSave(0),chapter=0,difficulty='easy',limit=400}={}){
 const r=createRun(save,chapter,difficulty,seed);while(r.state==='boon')chooseBoon(r,r.boonOptions.includes('damage')?'damage':r.boonOptions[0]);let cards=0,frames=0;
 while(!['lost','won'].includes(r.state)&&r.time<limit&&frames++<30000){
  if(r.state==='choice'){
   const score=c=>({unlock:6,damage:5,haste:4,crit:3,criticalDamage:2,special:1,legendary:10}[c.kind]||0)+({green:0,blue:1,red:3,gold:6}[c.rarity]||0);
   chooseUpgrade(r,[...r.choices].sort((a,b)=>score(b)-score(a))[0].id);cards++;continue;
  }
  if(mode==='active'){
   const s=r.segments.filter(sectionVisible).sort((a,b)=>b.y-a.y)[0];
   if(s){const p=aimPoint(s,r.heroX,r.heroY),snake=r.snakes.find(n=>n.id===s.snakeId),speed=s.retreat>0?-260:actionSpeed(r)*snake.speed*(r.boons.includes('slow')?.85:1)*snakeSlowFactor(r,r.segments.filter(b=>b.snakeId===s.snakeId)),future=routePoint(r,s.distance+Math.hypot(p.x-r.heroX,p.y-r.heroY)/540*speed,s.snakeId);
    r.aimX=Math.max(30,Math.min(450,future.x));r.aimY=Math.max(80,Math.min(565,future.y));r.manual=true;}
   if(r.heat>.78)vent(r);if(r.charge>=100)ultimate(r);
  }else if(mode==='parked'){r.manual=true;r.aimX=240;r.aimY=200;}
  tick(r,.05);
 }
 return {r,result:r.state,seconds:Math.round(r.time),cards,shields:r.health,kills:r.kills};
}
if(process.argv.includes('--report'))for(const mode of ['idle','parked','active'])for(const seed of [7,41,77,123,915]){const {r,...result}=play({mode,seed});console.log(JSON.stringify({mode,seed,...result}));}
