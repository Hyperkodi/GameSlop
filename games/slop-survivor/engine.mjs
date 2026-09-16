import {CAMPAIGN_ENTRY,waveMovement} from './campaign-pacing.mjs';
import {encounterPhase} from './world.mjs';
import {drawCards,applyCard,preview} from './upgrades.mjs';
import {VERSION,WEAPONS,CHAPTERS,DIFFICULTIES,BOONS,weapon,clamp,random,unlockedDifficulty,weaponUnlocked,arsenalSlots,firstClearParts,firstClearCoins,addChest,chestTotal,openChests,highestUnlocked,encounterHealth,chestStride} from './data.mjs';
export const W=480,H=760;
export {pathPoint} from './snake.mjs';
import {pathPoint,groupSections,updatePositions,advanceSnake,closeSectionGaps,sectionPoints,sectionVisible,sectionDistance,aimPoint,onBoard} from './snake.mjs';
export function makeWeapon(id,level=1,boons=[],rank=1,foundry={}){const base=weapon(id);return {id,level,rank,damage:base.damage*1.135**(level-1)*1.12**(rank-1)*1.08**(foundry.ordnance||0)*(boons.includes('damage')?1.25:1),cooldown:base.cooldown*(1-.0055*(foundry.overclock||0))*(boons.includes('rapid')?.85:1),crit:Math.min(.85,base.crit+.01*(foundry.precision||0)+(boons.includes('crit')?.1:0)),mult:base.mult+.02*(foundry.precision||0),pierce:base.type==='beam'?2:base.type==='disc'?3:0,count:['swarm','paper'].includes(base.type)?3:1,radius:base.radius||0,chains:base.type==='oracle'?3:4,slow:.2,burnTime:3,legendary:false,timer:0,tier:1,upgrades:0,totalDamage:0,specialRanks:0,guaranteedCrit:id==='sniper',ramp:0,printerTarget:0,lastFireTime:0,shieldCharge:0,casts:0,debtUntil:0,debtTarget:0};}
export function createRun(save,chapter=0,difficulty='easy',seed=Date.now()){
 if(!unlockedDifficulty(save,chapter,difficulty))throw new Error('Level or difficulty is locked');
 const d=DIFFICULTIES.find(x=>x.id===difficulty),health=d.shields+Math.floor(save.foundry.vault/8);
 return {version:VERSION,rules:2,mode:'campaign',chapter,difficulty,seed:(seed>>>0)||1,time:0,state:'boon',wave:0,segments:[],bullets:[],effects:[],numbers:[],weapons:[],deck:WEAPONS.filter(w=>weaponUnlocked(save,w)).map(w=>w.id),baseLevels:{...save.levels},baseRanks:{...save.ranks},foundry:{...save.foundry},slots:arsenalSlots(save),boons:[],boonOptions:BOONS.map(b=>b.id),boonsLeft:DIFFICULTIES.find(d=>d.id===difficulty).boons,choices:[],pending:0,headDistance:180,health,maxHealth:health,score:0,kills:0,waveKills:0,nextChest:3,castId:0,charge:0,slowUntil:0,slowAmount:0,aimX:240,aimY:130,manual:false,heroX:240,heroY:640,events:[],resultApplied:false,rerolls:d.rerolls,lastChoice:0};
}
export function createTournamentRun(save,seed=Date.now()){
 const r=createRun(save,0,DIFFICULTIES[0].id,seed);r.mode='tournament';r.revivesUsed=0;return r;
}
export function reviveTournament(r){
 if(r.mode!=='tournament'||r.state!=='revive'||r.revivesUsed>=3)return false;
 r.revivesUsed++;r.health=r.maxHealth;r.headDistance=640;r.bullets=[];r.effects=[];
 r.state='playing';r.manual=false;for(const s of r.segments)s.retreat=0;updatePositions(r);r.events=[{type:'revived'}];return true;
}
export function endTournament(r){
 if(r.mode!=='tournament'||r.state!=='revive')return false;
 r.state='lost';return true;
}
function runWeapon(r,id){const w=makeWeapon(id,r.baseLevels[id],r.boons,r.baseRanks?.[id]||1,r.foundry);if(r.mode==='tournament')w.endless=true;return w;}
export function chooseBoon(r,id){if(r.state!=='boon'||!r.boonOptions.includes(id)||r.boons.includes(id))return false;r.boons.push(id);r.boonsLeft--;r.boonOptions=r.boonOptions.filter(x=>x!==id);if(r.boonsLeft<=0){if(r.boons.includes('health'))r.health=r.maxHealth=Math.min(10,r.maxHealth+2);r.weapons=[runWeapon(r,'coin')];r.state='playing';spawnWave(r);r.pending=1;offerChoice(r,true);}return true;}
export function spawnWave(r){
 r.wave++;const c=CHAPTERS[r.chapter],d=DIFFICULTIES.find(x=>x.id===r.difficulty);r.headDistance=r.mode==='tournament'?640:CAMPAIGN_ENTRY;r.waveKills=0;r.nextChest=3;r.bullets=[];r.slowUntil=0;r.slowAmount=0;r.rootUntil=0;r.rootTargets=[];
 const endless=r.mode==='tournament';const n=endless?Math.min(64,25+(r.wave-1)*3):Math.min(64,c.segments+(r.wave-1)*3);
 r.segments=Array.from({length:n},(_,i)=>{const head=i===0;const armor=(endless?r.wave>=3:c.traits.armor||r.difficulty==='impossible')&&i%4===2;const regen=(endless?r.wave>=5:c.traits.regen||r.difficulty==='impossible')&&i%5===3;const volatile=(endless?r.wave>=7:c.traits.volatile||r.difficulty==='impossible')&&i%5===1;const hp=Math.min(1e12,(head?1000*(endless?1:d.headWeight||1):260+i*3)*c.hp*d.hp*(endless?(1+(r.wave-1)*1.2+(r.wave-1)**2*.15)*1.12**Math.min(140,Math.max(0,r.wave-6)):1+(r.wave-1)*1.6));return {id:++r.castId,hp,maxHp:hp,spacing:endless?32:c.pieceSpacing,head,armor,regen,volatile,x:0,y:0,angle:0,flash:0,burn:0,burnDps:0,burnWeapon:'burn',markedUntil:0};});
 r.snakeLayout=undefined;groupSections(r);
 // Traits belong to health pools, not each of the four decorative body pieces.
 // Keep their original frequency instead of making every grouped section armored.
 r.segments.forEach((s,i)=>{
  s.armor=(endless?r.wave>=3:c.traits.armor||r.difficulty==='impossible')&&i%4===2;
  s.regen=(endless?r.wave>=5:c.traits.regen||r.difficulty==='impossible')&&i%5===3;
  s.volatile=(endless?r.wave>=7:c.traits.volatile||r.difficulty==='impossible')&&i%5===1;
 });
 r.waveMaxHp=r.segments.reduce((n,s)=>n+s.hp,0);
 updatePositions(r);r.events.push({type:'wave',wave:r.wave});
}

export const upgradePreview=preview;
export function offerChoice(r,opening=false){
 if(r.state!=='playing'||r.pending<=0)return;
 // Large endless waves must not queue dozens of consecutive frozen menus.
 if(r.mode==='tournament'&&!opening){r.pending=Math.min(1,r.pending);if(r.time-r.lastChoice<6)return;}
 r.choices=drawCards(r,opening);r.openingChoice=opening;
 if(!r.choices.length){r.pending=0;return;}
 r.state='choice';r.events.push({type:'chest'});
}
export function chooseUpgrade(r,choiceId){
 if(r.state!=='choice')return false;const c=r.choices.find(x=>x.id===choiceId);if(!c)return false;
 if(c.kind==='unlock'){if(r.weapons.length>=(r.slots||6)||r.weapons.some(w=>w.id===c.weapon))return false;r.weapons.push(runWeapon(r,c.weapon));}
 else {const w=r.weapons.find(w=>w.id===c.weapon);if(!w||!applyCard(w,c))return false;}
 r.pending=Math.max(0,r.pending-1);r.choices=[];r.state='playing';r.lastChoice=r.time;r.openingChoice=false;r.events.push({type:'upgrade'});offerChoice(r);return true;
}
export function reroll(r){if(r.state!=='choice'||r.rerolls<=0)return false;r.rerolls--;r.state='playing';offerChoice(r,r.openingChoice);return true;}
const visible=sectionVisible;
function target(r){const list=r.segments.filter(visible);if(!list.length)return null;return list.reduce((best,s)=>{const score=r.manual?sectionDistance(s,r.aimX,r.aimY):610-Math.max(...sectionPoints(s).filter(onBoard).map(p=>p.y))+(s.head?-30:0);return !best||score<best.score?{s,score}:best;},null).s;}
function fx(r,e){if(r.effects.length<140)r.effects.push({...e,life:e.life??.4,max:e.life??.4});}
export function hit(r,s,w,amount=w.damage){if(!s||s.hp<=0)return;const hpBefore=s.hp,crit=w.guaranteedCrit||random(r)<w.crit;let dmg=amount*(crit?w.mult:1)*(s.markedUntil>r.time?1.25:1)*(1+.08*(s.slipStacks||0));if(s.armor&&!crit)dmg*=.68;if(!s.head&&!crit&&encounterPhase(r).id==='shutters')dmg*=.7;if(r.mode==='tournament')dmg=Math.min(s.hp,dmg);if(w.id==='sniper'&&w.legendary&&s.hp<s.maxHp*.15)dmg=Math.max(dmg,s.hp);s.hp-=dmg;if(s.markedUntil>r.time&&s.hp>0&&s.hp<=s.maxHp*.1&&r.weapons.some(x=>x.id==='oracle'&&x.legendary)){dmg+=s.hp;s.hp=0;}s.flash=.1;w.totalDamage+=dmg;r.charge=Math.min(100,r.charge+Math.min(dmg,hpBefore)*.012/(r.mode==='tournament'?1:encounterHealth(r.chapter+1)));r.score+=Math.round(dmg*.12);if(r.numbers.length<55)r.numbers.push({x:s.x+(random(r)-.5)*15,y:s.y,text:Math.round(dmg),crit,color:weapon(w.id).color,life:.65});}
function area(r,w,x,y,radius,amount=w.damage){for(const s of r.segments)if(visible(s)&&sectionDistance(s,x,y)<radius+17)hit(r,s,w,amount);}
function hazard(r,w,x,y,radius,duration,amount,style){fx(r,{type:'hazard',style,x,y,r:radius,color:weapon(w.id).color,life:duration,weapon:w.id,amount,tick:0});}
function ignite(s,w){s.burn=Math.max(s.burn,w.burnTime);if(s.burnDps<=w.damage*.6){s.burnDps=w.damage*.6;s.burnWeapon=w.id;}}
function homing(r,w,x,y,t,type='homing',generation=0,factor=1){const a=Math.atan2(t.y-y,t.x-x),speed=weapon(w.id).speed||330;
 r.bullets.push({id:++r.castId,weapon:w.id,x,y,launchX:x,launchY:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,age:0,life:5,r:type==='dragon'?16:8,hits:[],pierce:0,type,targetId:t.id,color:weapon(w.id).color,tier:w.tier,generation,factor});}
function splitFork(r,w,b,hitTarget){const targets=r.segments.filter(x=>visible(x)&&x.id!==hitTarget.id).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));
 for(const t of targets.slice(0,2)){homing(r,w,b.x,b.y,t,'fragment',(b.generation||0)+1,(b.factor||1)*.65);r.bullets.at(-1).ignoreId=hitTarget.id;}}
export function fire(r,w,t){
 // A previous weapon can kill the shared target earlier in this same frame.
 if(!t||!visible(t))t=target(r);if(!t)return;
 const point=aimPoint(t,r.manual?r.aimX:r.heroX,r.manual?r.aimY:r.heroY);t={...t,x:point.x,y:point.y};
 const base=weapon(w.id),color=base.color;r.events.push({type:'fire',weapon:w.id});const angle=Math.atan2(t.y-r.heroY,t.x-r.heroX);
 if(['bolt','bomb','disc','fork'].includes(base.type))for(let i=0,count=w.count+(w.id==='coin'&&w.legendary?2:0);i<count;i++){const a=angle+(i-(count-1)/2)*.12,speed=base.speed;
  r.bullets.push({id:++r.castId,weapon:w.id,x:r.heroX,y:r.heroY-25,launchX:r.heroX,launchY:r.heroY-25,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,age:0,life:base.type==='disc'?4.5:3,turnAt:Math.hypot(t.x-r.heroX,t.y-r.heroY)/speed+.18,returning:false,r:base.type==='bolt'?5+Math.min(4,w.tier):base.type==='disc'?13:10,hits:[],pierce:w.pierce,type:base.type,targetX:t.x,targetY:t.y,color,tier:w.tier});}
 switch(base.type){
  case 'paper': {
   const count=w.count+(w.legendary?2:0);for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.1;r.bullets.push({id:++r.castId,weapon:w.id,x:r.heroX,y:r.heroY-25,vx:Math.cos(a)*base.speed,vy:Math.sin(a)*base.speed,life:3,age:0,r:6,hits:[],pierce:w.pierce,type:'paper',factor:r.health<r.maxHealth?2:1,color,tier:w.tier});}break;
  }
  case 'printer': {
   if(w.printerTarget!==t.id&&!w.legendary)w.ramp=0;else w.ramp=Math.min(30,w.ramp+Math.max(0,r.time-w.lastFireTime));w.printerTarget=t.id;w.lastFireTime=r.time;
   const rampTime=Math.max(2,10-w.specialRanks*2),interval=Math.max(.18,.55-.37*w.ramp/rampTime);w.timer=Math.max(.09,w.cooldown*interval/.55);
   homing(r,w,r.heroX,r.heroY-25,t,'printer');break;
  }
  case 'sniper': {
   const targets=r.segments.filter(visible).sort((a,b)=>a.hp-b.hp||a.id-b.id).slice(0,1+w.pierce);for(const s of targets){hit(r,s,w);fx(r,{type:'beam',weapon:w.id,x:r.heroX,y:r.heroY-18,x2:s.x,y2:s.y,color,life:.2});}break;
  }
  case 'halving': {
   w.casts++;const amplified=w.casts%(w.legendary?2:4)===0;for(const s of r.segments)if(visible(s)&&sectionDistance(s,t.x,t.y)<w.radius+17)hit(r,s,w,w.damage+(amplified?Math.min(s.maxHp*.02,w.damage*5):0));fx(r,{type:'blast',x:t.x,y:t.y,r:w.radius,color,life:.5});break;
  }
  case 'slippage': {
   const targets=r.segments.filter(visible).sort((a,b)=>sectionDistance(a,t.x,t.y)-sectionDistance(b,t.x,t.y)).slice(0,Math.max(1,w.chains-3));for(const s of targets){s.slipStacks=Math.min(w.legendary?10:5,(s.slipStacks||0)+1);s.slipUntil=r.time+5;hit(r,s,w);}fx(r,{type:'field',x:t.x,y:t.y,r:w.radius,color,life:.4});break;
  }
  case 'copium':hazard(r,w,t.x,t.y,w.radius,4,w.damage*.4,'copium');break;
  case 'trap': {
   const head=r.segments.find(visible),distance=(head?.distance??r.headDistance)+36;const place=(distance)=>{const p=pathPoint(distance,r.chapter);fx(r,{type:'trap',id:++r.castId,weapon:w.id,distance,x:p.x,y:p.y,r:w.radius,color,life:8,armed:true});};place(distance);break;
  }
  case 'nuke': {
   const head=r.segments.find(visible);for(const s of r.segments)if(visible(s)){const falloff=w.legendary?1:Math.max(.25,1-Math.hypot(s.x-head.x,s.y-head.y)/Math.max(100,w.radius));hit(r,s,w,w.damage*falloff);}fx(r,{type:'nuke',x:head.x,y:head.y,r:700,color,life:1.2});break;
  }
  case 'lambo': {
   const head=r.segments.find(visible),start=head.distance??r.headDistance;for(let i=0;i<w.count;i++){const p=pathPoint(start,r.chapter);fx(r,{type:'lambo',id:++r.castId,weapon:w.id,distance:start,start,travel:0,range:Math.min(2600,360+w.level*32),direction:-1,returning:false,hits:[],x:p.x,y:p.y,angle:p.angle,color,life:14});}break;
  }
  case 'flashloan': {
   const s=r.segments.find(s=>s.id===t.id);w.debtTarget=s.id;w.debtUntil=r.time+2.5;hit(r,s,w,w.damage*(1+.25*(w.count-1)));break;
  }
 }
 if(base.type==='beam'){
  const dx=t.x-r.heroX,dy=t.y-r.heroY,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len;
  const list=r.segments.filter(s=>visible(s)&&sectionPoints(s).some(p=>onBoard(p)&&((p.x-r.heroX)*ux+(p.y-r.heroY)*uy)>0&&Math.abs((p.x-r.heroX)*uy-(p.y-r.heroY)*ux)<19+Math.min(8,w.tier))).sort((a,b)=>Math.hypot(a.x-r.heroX,a.y-r.heroY)-Math.hypot(b.x-r.heroX,b.y-r.heroY));
  list.slice(0,w.legendary?200:w.pierce+1).forEach(s=>hit(r,s,w));fx(r,{type:'beam',weapon:w.id,x:r.heroX,y:r.heroY-18,x2:r.heroX+ux*780,y2:r.heroY+uy*780,color,tier:w.tier,life:.23});
 }
 if(base.type==='chain'){
  let cur=r.segments.find(s=>s.id===t.id),from={x:r.heroX,y:r.heroY};const seen=[];for(let i=0;i<w.chains*(w.legendary?2:1);i++){if(!cur)break;hit(r,cur,w);seen.push(cur.id);fx(r,{type:'chain',x:from.x,y:from.y,x2:cur.x,y2:cur.y,color,life:.35});from=cur;
   cur=r.segments.filter(s=>visible(s)&&!seen.includes(s.id)&&Math.hypot(s.x-from.x,s.y-from.y)<160).sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))[0];}
 }
 if(base.type==='field'){area(r,w,t.x,t.y,w.radius);if(r.slowUntil<=r.time||r.slowAmount<=w.slow){r.slowUntil=r.time+2.7;r.slowAmount=w.slow;}fx(r,{type:'field',x:t.x,y:t.y,r:w.radius,color,life:2.7});if(w.legendary)hazard(r,w,t.x,t.y,w.radius,3,w.damage*.4,'rug');}
 if(base.type==='burn'){for(const s of r.segments)if(visible(s)&&sectionDistance(s,t.x,t.y)<w.radius*(w.legendary?1.6:1)){hit(r,s,w,w.damage*.4);ignite(s,w);}fx(r,{type:'fire',x:t.x,y:t.y,r:w.radius,color,life:1});}
 if(base.type==='meteor')fx(r,{type:'meteor',x:t.x,y:t.y,r:w.radius,color,life:.8,weapon:w.id,trigger:false});
 if(base.type==='satellite'){for(const s of r.segments)if(visible(s)&&sectionDistance(s,t.x,t.y)<w.radius){const percent=Math.min(s.hp*(w.legendary?.03:.015),w.damage*4);hit(r,s,w,w.damage+percent);}fx(r,{type:'orbital',x:t.x,y:t.y,r:w.radius,color,life:.75});}
 if(base.type==='swarm'){const targets=r.segments.filter(visible).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y));for(let i=0;i<w.count*(w.legendary?2:1);i++)homing(r,w,r.heroX+(i%3-1)*14,r.heroY-25,targets[i%targets.length]);}
 if(base.type==='vortex'){hazard(r,w,t.x,t.y,w.radius,w.legendary?6:3,w.damage,'vortex');if(r.slowUntil<=r.time||r.slowAmount<=.35){r.slowUntil=r.time+3;r.slowAmount=.35;}}
 if(base.type==='oracle'){const targets=r.segments.filter(visible).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y)).slice(0,w.chains);for(const s of targets){s.markedUntil=r.time+5;hit(r,s,w);fx(r,{type:'prophecy',x:s.x,y:s.y,color,r:25,life:.75});}}
 if(base.type==='dragon'){const head=r.segments.find(visible)||t;for(let i=0;i<(w.legendary?2:1);i++)homing(r,w,r.heroX+(i?25:-10),r.heroY-25,head,'dragon');}
}
export function ultimate(r){if(r.state!=='playing'||r.charge<100)return false;r.slowUntil=r.time+3;r.slowAmount=.7;const w=r.mode==='tournament'?r.weapons[0]:r.weapons.reduce((best,w)=>w.damage>best.damage?w:best);for(const s of r.segments)if(visible(s))hit(r,s,w,w.damage*4);r.charge=0;fx(r,{type:'ultimate',x:240,y:340,r:400,color:'#ffd27b',life:1.1});r.events.push({type:'ultimate'});return true;}
function removeDead(r){
 const dead=r.segments.filter(s=>s.hp<=0);if(!dead.length)return;
 for(const s of dead){r.kills+=s.pieces||1;r.waveKills+=s.pieces||1;r.score+=s.head?350:70*(s.pieces||1);for(const p of sectionPoints(s).filter((_,i)=>i%4===0))fx(r,{type:'burst',x:p.x,y:p.y,r:s.head?45:24,color:CHAPTERS[r.chapter].color,life:.5});if(s.volatile){const w=r.mode==='tournament'?r.weapons[0]:r.weapons.reduce((best,w)=>w.damage>best.damage?w:best);area(r,w,s.x,s.y,70,w.damage*2);}r.events.push({type:'kill'});}
 const ids=new Set(dead.map(s=>s.id));closeSectionGaps(r,ids);
 while(r.waveKills>=r.nextChest){r.pending++;r.nextChest+=r.mode==='tournament'?4:chestStride(CHAPTERS[r.chapter]);}
}
export function tick(r,dt){
 if(r.state!=='playing')return;groupSections(r);dt=clamp(dt,0,.05);r.time+=dt;r.events=[];
 const c=CHAPTERS[r.chapter],d=DIFFICULTIES.find(x=>x.id===r.difficulty);
 if(r.rootTargets?.length&&!r.segments.some(s=>s.hp>0&&r.rootTargets.includes(s.id)))r.rootUntil=0;
 advanceSnake(r,dt,(r.mode==='tournament'?Math.min(140,11+r.wave*2):waveMovement(r.wave))*c.speed*d.speed*(r.boons.includes('slow')?.85:1)*(r.slowUntil>r.time?1-r.slowAmount:1)*encounterPhase(r).speed*(r.rootUntil>r.time?0:1));
 for(const s of r.segments){s.flash=Math.max(0,s.flash-dt);if(s.slipStacks>0&&s.slipUntil<=r.time){s.slipStacks--;s.slipUntil=r.time+1;}if(s.burn>0){s.burn=Math.max(0,s.burn-dt);const amount=s.burnDps*dt*(s.markedUntil>r.time?1.25:1)*(1+.08*(s.slipStacks||0));s.hp-=amount;r.charge=Math.min(100,r.charge+amount*.012/(r.mode==='tournament'?1:encounterHealth(r.chapter+1)));const w=r.weapons.find(w=>w.id===s.burnWeapon);if(w)w.totalDamage+=amount;}if(s.hp>0&&(s.regen||!s.head&&encounterPhase(r).id==='mend'))s.hp=Math.min(s.maxHp,s.hp+s.maxHp*(encounterPhase(r).id==='mend'?.009:.006)*dt);}
 const t=target(r);if(t){if(!r.manual){const p=aimPoint(t,r.heroX,r.heroY);r.aimX=p.x;r.aimY=p.y;}for(const w of r.weapons){w.timer=Math.max(0,w.timer-dt);if(w.debtUntil>r.time){const debtor=r.segments.find(s=>s.id===w.debtTarget&&s.hp>0);if(!debtor){w.debtUntil=0;w.debtTarget=0;w.timer=w.legendary?0:Math.max(0,w.timer-2.5);}else continue;}if(w.timer<=0){w.timer=w.cooldown;fire(r,w,t);}}}
 for(const b of r.bullets){b.age+=dt;b.life-=dt;const w=r.weapons.find(w=>w.id===b.weapon);if(!w)continue;
  if(b.type==='disc'&&b.age>b.turnAt){if(!b.returning){b.hits=[];b.returning=true;}const a=Math.atan2(r.heroY-b.y,r.heroX-b.x);b.vx=Math.cos(a)*360;b.vy=Math.sin(a)*360;if(Math.hypot(r.heroX-b.x,r.heroY-b.y)<15)b.life=0;}
  if(['homing','fragment','dragon','printer'].includes(b.type)){const dest=r.segments.find(s=>s.id===b.targetId&&visible(s))||r.segments.find(visible);if(dest){b.targetId=dest.id;const p=aimPoint(dest,b.x,b.y),a=Math.atan2(p.y-b.y,p.x-b.x),speed=weapon(w.id).speed||330;b.vx=Math.cos(a)*speed;b.vy=Math.sin(a)*speed;}}
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.type==='dragon'){b.trail=(b.trail||0)+dt;if(b.trail>.2){b.trail=0;hazard(r,w,b.x,b.y,25,1.2+w.burnTime*(w.legendary?.4:.2),w.damage*.15,'fire');}}

  if(b.type==='bomb'&&Math.hypot(b.x-b.targetX,b.y-b.targetY)<17){area(r,w,b.x,b.y,w.radius);fx(r,{type:'blast',x:b.x,y:b.y,r:w.radius,color:b.color,life:.5});if(w.legendary)hazard(r,w,b.x,b.y,w.radius,3,w.damage*.2,'fire');b.life=0;}
  else for(const s of r.segments){if(!visible(s)||s.id===b.ignoreId||b.type==='fragment'&&b.age<.06||b.hits.includes(s.id)||sectionDistance(s,b.x,b.y)>20+b.r)continue;b.hits.push(s.id);if(b.type==='bomb'){area(r,w,b.x,b.y,w.radius);fx(r,{type:'blast',x:b.x,y:b.y,r:w.radius,color:b.color,life:.5});if(w.legendary)hazard(r,w,b.x,b.y,w.radius,3,w.damage*.2,'fire');b.life=0;break;}if(b.type==='dragon'){area(r,w,b.x,b.y,w.radius);for(const nearby of r.segments)if(visible(nearby)&&sectionDistance(nearby,b.x,b.y)<w.radius)ignite(nearby,w);fx(r,{type:'fire',x:b.x,y:b.y,r:w.radius,color:b.color,life:1});b.life=0;break;}
   hit(r,s,w,w.damage*(b.factor||1)*(b.type==='disc'&&b.returning&&w.legendary?2:1));if(b.type==='fork'||b.type==='fragment'&&w.legendary&&b.generation<2)splitFork(r,w,b,s);if(b.hits.length>b.pierce){b.life=0;break;}}
 }
 r.bullets=r.bullets.filter(b=>b.life>0&&b.x>-50&&b.x<530&&b.y>-100&&b.y<750).slice(-240);
 const contacts=new Set();
 for(const e of [...r.effects]){e.life-=dt;
  const source=r.weapons.find(w=>w.id===e.weapon);
  if(e.type==='trap'&&e.armed&&r.segments.some(s=>visible(s)&&sectionDistance(s,e.x,e.y)<22)){e.armed=false;e.life=0;if(source)area(r,source,e.x,e.y,e.r);r.rootTargets=r.segments.filter(s=>visible(s)&&sectionDistance(s,e.x,e.y)<e.r+17).map(s=>s.id);r.rootUntil=r.rootTargets.length?r.time+2:0;if(source?.legendary&&!e.secondary){const nearest=r.segments.filter(visible).sort((a,b)=>sectionDistance(a,e.x,e.y)-sectionDistance(b,e.x,e.y))[0];if(nearest){const distance=nearest.distance,p=pathPoint(distance,r.chapter);fx(r,{type:'trap',id:++r.castId,weapon:source.id,distance,x:p.x,y:p.y,r:source.radius,color:e.color,life:8,armed:true,secondary:true});}}fx(r,{type:'blast',x:e.x,y:e.y,r:e.r,color:e.color,life:.5});}
  if(e.type==='lambo'&&source){e.travel+=420*dt;e.distance=e.start+e.direction*Math.min(e.travel,e.range);const p=pathPoint(e.distance,r.chapter);Object.assign(e,p);
   for(const s of r.segments)if(visible(s)&&!e.hits.includes(s.id)&&sectionDistance(s,e.x,e.y)<30){e.hits.push(s.id);hit(r,s,source);}
   if(e.travel>=e.range){if(source.legendary&&!e.returning){e.returning=true;e.start=e.distance;e.direction=1;e.travel=0;e.hits=[];}else e.life=0;}
  }
  if(e.type==='hazard'&&e.style==='copium'&&source&&r.segments.some(s=>visible(s)&&sectionDistance(s,e.x,e.y)<e.r+17))contacts.add(source);
if(e.type==='hazard'){e.tick-=dt;if(e.tick<=0){e.tick=.4;const source=r.weapons.find(w=>w.id===e.weapon);if(source)area(r,source,e.x,e.y,e.r,e.amount);}}if(e.type==='meteor'&&e.life<=.15&&!e.trigger){e.trigger=true;const w=r.weapons.find(w=>w.id===e.weapon);if(w){area(r,w,e.x,e.y,e.r);if(w.legendary&&!e.echo)fx(r,{type:'meteor',x:e.x,y:e.y,r:e.r,color:e.color,life:.6,weapon:w.id,trigger:false,echo:true});}r.events.push({type:'impact'});}}
 for(const w of contacts){w.shieldCharge+=dt*(w.legendary?2:1);if(w.shieldCharge>=45){w.shieldCharge-=45;r.health=Math.min(r.maxHealth,r.health+1);r.events.push({type:'repair'});}}
 r.effects=r.effects.filter(e=>e.life>0);r.numbers.forEach(n=>{n.life-=dt;n.y-=dt*24;});r.numbers=r.numbers.filter(n=>n.life>0);
 removeDead(r);
 if(r.segments.length&&!r.segments.some(s=>s.retreat>0)&&sectionPoints(r.segments[0])[0].y>575){r.health--;r.headDistance=Math.max(250,r.headDistance-360);updatePositions(r);fx(r,{type:'breach',x:240,y:580,r:170,color:'#fa745d',life:.6});r.events.push({type:'breach'});if(r.health<=0){r.state=r.mode==='tournament'&&r.revivesUsed<3?'revive':'lost';r.pending=0;r.events.push({type:r.state});return;}}
 if(!r.segments.length){if(r.mode!=='tournament'&&r.wave>=c.waves){r.state='won';r.pending=0;r.events.push({type:'won'});return;}spawnWave(r);r.pending++;}
 if(r.time-r.lastChoice>(r.mode==='tournament'?24:d.chestTimer)&&r.pending===0){r.pending=1;}
 offerChoice(r);
}
export function completeRun(save,r){
 if(!['won','lost'].includes(r.state)||r.resultApplied)return null;r.resultApplied=true;
 if(r.mode==='tournament'){const coins=Math.min(1000,30+r.kills*2);save.coins+=coins;save.totalKills+=r.kills;save.totalRuns++;save.tournamentRuns++;save.tournamentBest=Math.max(save.tournamentBest,r.score);save.tournamentRun=null;return {tournament:true,win:false,first:false,coins,score:r.score,kills:r.kills,time:r.time,chests:0};}
 const win=r.state==='won',n=r.chapter+1,key=`${r.chapter}:${r.difficulty}`,first=win&&!save.clears[key];
 const coins=win?Math.round(firstClearCoins(n,r.difficulty)*(first?1:.25)):Math.min(30+r.kills*2,Math.round(firstClearCoins(n,r.difficulty)*.1));
 const parts={},amount=win?Math.round(firstClearParts(n,r.difficulty)*(first?1:.25)):0;
 // Rewards are a total budget, distributed across the weapons actually used this run.
 const pool=[...new Set(r.weapons.length?r.weapons.map(w=>w.id):['coin'])];for(let i=0;i<amount;i++){const id=pool[i%pool.length];parts[id]=(parts[id]||0)+1;save.parts[id]++;}
 const diff=DIFFICULTIES.find(x=>x.id===r.difficulty);let cores=0,blueprints=0,chests=0,overflowLoot=null;
 if(first){if(diff.coreDiv)cores=Math.ceil(n/diff.coreDiv)+diff.coreAdd;if(r.difficulty==='impossible'&&n%4===0)blueprints++;
  if(r.difficulty==='hard'&&WEAPONS.some(w=>w.grade==='S'&&w.discovery===n))blueprints+=10;
  if(r.difficulty==='easy'&&n%10===0){blueprints+=3;if(chestTotal(save)>=32)overflowLoot=openChests(save,1,save.chestAt,()=>random(r));addChest(save,'vault');chests++;}
 }
 save.coins+=coins;save.cores+=cores;save.blueprints+=blueprints;save.totalKills+=r.kills;save.totalRuns++;
 const previous=WEAPONS.filter(w=>weaponUnlocked(save,w)).map(w=>w.id);
 if(win){save.clears[key]=true;save.best[key]=Math.max(save.best[key]||0,r.score);save.furthest[r.difficulty]=Math.max(save.furthest[r.difficulty],n);if(!save.selectedManual)save.selected=highestUnlocked(save);}
 const unlocked=WEAPONS.filter(w=>weaponUnlocked(save,w)&&!previous.includes(w.id)).map(w=>w.id);
 save.run=null;return {win,first,coins,parts,cores,blueprints,chests,overflowLoot,unlocked,score:r.score,kills:r.kills,time:r.time};
}
