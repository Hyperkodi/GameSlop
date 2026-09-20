import {encounterFor,isActionRun} from './encounters.mjs';
import {random} from './data.mjs';
import {updatePositions,sectionPoints} from './snake.mjs';
import {isRug} from './rug-field.mjs';

export function spawnActionWave(r,c,d){
 r.actionBalance=2;
 r.routeVersion=2;
 const encounter=encounterFor(r.chapter,r.wave,r.mode);r.encounter=encounter.id;r.routeSeed=Math.floor(random(r)*1e9);
 r.heat=Math.min(r.heat||0,.35);r.overheated=false;r.waveStarted=r.time;
 const count=encounter.count,n=Math.max(41,Math.min(73,c.segments+12+(r.wave-1)*4)),perSnake=Math.max(21,Math.ceil(n/count));
 r.chestStep=Math.max(12,Math.ceil(perSnake*count/4));r.nextChest=r.chestStep;
 r.snakes=Array.from({length:count},(_,id)=>({id,distance:-id*120,phase:random(r)*6.28,speed:.94+random(r)*.12,species:(r.chapter+id+r.wave-1)%4}));
 // Share the encounter health budget across snakes instead of multiplying it by four.
 const total=r.waveMaxHp/(r.mode==='tournament'?1:d.hp)*(r.mode==='tournament'?1:r.difficulty==='impossible'?1.8:r.difficulty==='hard'?1.35:1),weight=count*(1000+(perSnake-1)*300);
 r.segments=[];
 for(const snake of r.snakes)for(let i=0;i<perSnake;){
  const head=i===0,pieces=head?1:Math.min(4,perSnake-i),hp=(head?1000:300*pieces)*total/weight*.13;
  const index=Math.floor((i+3)/4);
  r.segments.push({id:++r.castId,snakeId:snake.id,species:snake.species,hp,maxHp:hp,spacing:24,pieces,head,retreat:0,
   armor:!head&&(r.mode==='tournament'?r.wave>=3:c.traits.armor||r.difficulty==='impossible')&&index%4===2,
   regen:!head&&(r.mode==='tournament'?r.wave>=5:c.traits.regen||r.difficulty==='impossible')&&index%5===3,
   volatile:!head&&(r.mode==='tournament'?r.wave>=7:c.traits.volatile||r.difficulty==='impossible')&&index%5===1,
   x:0,y:0,angle:0,flash:0,burn:0,burnDps:0,burnWeapon:'burn',markedUntil:0});i+=pieces;
 }
 r.snakeLayout=2;r.waveMaxHp=r.segments.reduce((n,s)=>n+s.hp,0);updatePositions(r);
}
export function actionSpeed(r){
 const e=encounterFor(r.chapter,Math.max(1,r.wave),r.mode);
 const progression=1+.16*(1-Math.exp(-r.chapter/35));
 const difficulty=r.difficulty==='impossible'?1.15:r.difficulty==='hard'?1.08:1;
 return (120+Math.min(16,r.wave*4))*e.speed*[1,1,.9,.87,.85][e.count]*progression*difficulty;
}
export function breachAction(r){
 if(!isActionRun(r))return false;
 for(const snake of r.snakes||[]){const body=r.segments.filter(s=>s.snakeId===snake.id);if(!body.length||body.some(s=>s.retreat>0))continue;
  if(sectionPoints(body[0])[0].y<=575)continue;
  r.health--;snake.distance-=480;r.effects.push({type:'breach',x:body[0].x,y:580,r:100,color:'#fa745d',life:.6,max:.6});r.events.push({type:'breach'});
  if(r.health<=0){r.health=0;r.state=r.mode==='tournament'&&r.revivesUsed<3?'revive':'lost';r.pending=0;r.events.push({type:r.state});break;}
 }updatePositions(r);return r.health<=0;
}

// Upgrade a previously paused v2 battle when it is opened. Keep its account,
// wave, arsenal, cards, shields and proportional remaining encounter health.
export function upgradeCombat(r,c,d){
 // Old rug casts stored a board-wide slow. Keep Market Crash's 70% slow intact.
 if(r.slowUntil>r.time&&r.slowAmount<=.6&&r.effects.some(isRug)){r.slowUntil=0;r.slowAmount=0;}
 if(isActionRun(r)){
  // Existing v3.0 fights get the same health/speed tuning as fresh v3.1 fights.
  // Preserve damage fraction and position; a resumed fight is not a fresh spawn.
  if(r.wave>0&&r.actionBalance!==2){for(const s of r.segments){s.hp*=.13/.43;s.maxHp*=.13/.43;}r.waveMaxHp*=.13/.43;r.actionBalance=2;}
  return;
 }
 const fraction=r.segments.length?r.segments.reduce((n,s)=>n+Math.max(0,s.hp),0)/Math.max(1,r.waveMaxHp||r.segments.reduce((n,s)=>n+s.maxHp,0)):1;
 r.combatVersion=3;r.heat=0;r.overheated=false;r.ventUntil=0;r.manual=false;
 if(r.wave>0){r.waveMaxHp=Math.max(1,r.waveMaxHp||r.segments.reduce((n,s)=>n+s.maxHp,0));spawnActionWave(r,c,d);for(const s of r.segments)s.hp*=Math.max(.01,fraction);r.nextChest=r.waveKills+r.chestStep;r.bullets=[];r.effects=[];}
}
