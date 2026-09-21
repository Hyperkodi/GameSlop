import {LEVELS,frenzyReduction} from './data.mjs';
import {isActionRun,routePoint} from './encounters.mjs';
import {snakeSlowFactor} from './rug-field.mjs';
import {ballHit} from './dragon-body.mjs';
// One health pool covers four body pieces. Distances run from tail to head.
export const PIECE_SPACING=32, SECTION_PIECES=4, RETREAT_SPEED=260;
export function pathPoint(d,chapter=0){
 const arena=LEVELS[chapter]?.arena;const act=arena==='canyon'?12:arena==='marina'?13:arena==='citadel'?14:0;
 const [left,right,row,radius]=act===12?[55,425,108,33]:act===13?[76,404,98,24]:act===14?[61,419,110,30]:[67,413,103,27];const straight=right-left-2*radius,turn=Math.PI*radius;
 let y=113,dir=chapter%2?-1:1,x=dir>0?left+radius:right-radius;
 if(d<0)return {x:x+dir*d,y,angle:dir>0?0:Math.PI};
 for(let i=0;i<7;i++){
  if(d<=straight)return {x:x+dir*d,y,angle:dir>0?0:Math.PI};d-=straight;x+=dir*straight;
  if(d<=turn){const a=-Math.PI/2+d/radius;return {x:x+dir*Math.cos(a)*radius,y:y+radius+Math.sin(a)*radius,angle:dir>0?a+Math.PI/2:Math.PI/2-a};}d-=turn;y+=2*radius;
  const vertical=row-2*radius;
  if(d<=vertical)return {x,y:y+d,angle:Math.PI/2};d-=vertical;y+=vertical;dir=-dir;
 }
 return {x:240,y:850,angle:Math.PI/2};
}
export const sectionSpan=s=>(s.pieces||1)*(s.spacing||PIECE_SPACING);
export const sectionPoints=s=>s.points?.length?s.points:[s];
// Rendering follows the canvas edge, not the inset combat targeting area.
// Include sprite/stroke overhang so entering sections never pop into view.
export const sectionInView=s=>sectionPoints(s).some(p=>p.x>-50&&p.x<530&&p.y>-50&&p.y<810);
export const onBoard=p=>p.x>22&&p.x<458&&p.y>75&&p.y<610;
export const sectionVisible=s=>s.hp>0&&sectionPoints(s).some(onBoard);
export function sectionDistance(s,x,y){let nearest=Infinity;for(const p of sectionPoints(s)){const dx=p.x-x,dy=p.y-y;nearest=Math.min(nearest,dx*dx+dy*dy);}return Math.sqrt(nearest);}
export function sectionHit(s,x,y,padding=0){return s.snakeId!==undefined&&!s.head?ballHit(s,x,y,padding):sectionDistance(s,x,y)<=(s.snakeId!==undefined?12:20)+padding;}
export function aimPoint(s,x,y){return sectionPoints(s).filter(onBoard).reduce((a,p)=>!a||Math.hypot(p.x-x,p.y-y)<Math.hypot(a.x-x,a.y-y)?p:a,null)||s;}
export function groupSections(r){
 if(r.snakeLayout===2)return;
 const groups=[];
 for(let i=0;i<r.segments.length;){
  const first=r.segments[i],batch=[];
  do{batch.push(r.segments[i++]);}while(!first.head&&batch.length<SECTION_PIECES&&i<r.segments.length&&!r.segments[i].head);
  groups.push({...first,pieces:batch.length,retreat:0,hp:batch.reduce((v,s)=>v+Math.max(0,s.hp),0),maxHp:batch.reduce((v,s)=>v+s.maxHp,0),
   armor:batch.some(s=>s.armor),regen:batch.some(s=>s.regen),volatile:batch.some(s=>s.volatile),
   burn:Math.max(...batch.map(s=>s.burn)),burnDps:batch.reduce((v,s)=>v+s.burnDps,0),markedUntil:Math.max(...batch.map(s=>s.markedUntil||0))});
 }
 r.segments=groups;r.snakeLayout=2;updatePositions(r);
}
export function updatePositions(r){
 if(isActionRun(r)&&r.snakes){
  for(const snake of r.snakes){let distance=snake.distance;
   for(const s of r.segments.filter(s=>s.snakeId===snake.id)){
    s.distance=distance+(s.retreat||0);const length=sectionSpan(s)-(s.spacing||PIECE_SPACING);
    const count=Math.ceil(length/6);s.points=Array.from({length:count+1},(_,i)=>{const d=s.distance-(count?i*length/count:0),p=routePoint(r,d,snake.id),sway=Math.sin(d*.045-r.time*4+snake.phase)*1.8+Math.sin(d*.071+r.time*2.2)*.6;return {...p,x:p.x-Math.sin(p.angle)*sway,y:p.y+Math.cos(p.angle)*sway};});
    Object.assign(s,routePoint(r,s.distance-length/2,snake.id));distance-=sectionSpan(s);
   }
  }r.headDistance=r.snakes[0]?.distance||0;return;
 }
 let distance=r.headDistance;
 for(const s of r.segments){
  s.distance=distance+(s.retreat||0);
  const length=sectionSpan(s)-(s.spacing||PIECE_SPACING);
  // Eight-pixel samples keep both the curved outline and all hit tests continuous.
  s.points=Array.from({length:length/8+1},(_,i)=>pathPoint(s.distance-i*8,r.chapter));
  Object.assign(s,pathPoint(s.distance-length/2,r.chapter));distance-=sectionSpan(s);
 }
}
export function advanceSnake(r,dt,speed){
 if(isActionRun(r)&&r.snakes){
  for(const snake of r.snakes){const body=r.segments.filter(s=>s.snakeId===snake.id);if(!body.length)continue;
   if(body.some(s=>s.retreat>0)){for(const s of body)s.retreat=Math.max(0,(s.retreat||0)-RETREAT_SPEED*dt);}
   else {const pulse=1+(1-frenzyReduction(r.boons||[]))*(.14*Math.sin(r.time*1.7+snake.phase)+.07*Math.sin(r.time*3.1+snake.phase*2));snake.distance+=dt*speed*snake.speed*pulse*snakeSlowFactor(r,body);}
  }updatePositions(r);return;
 }
 const retracting=r.segments.some(s=>s.retreat>0);
 if(retracting)for(const s of r.segments)s.retreat=Math.max(0,(s.retreat||0)-RETREAT_SPEED*dt);
 else r.headDistance+=dt*speed*snakeSlowFactor(r,r.segments);
 updatePositions(r);
}
export function closeSectionGaps(r,deadIds){
 if(isActionRun(r)&&r.snakes){
  for(const snake of r.snakes){let behind=0;const body=r.segments.filter(s=>s.snakeId===snake.id);
   for(let i=body.length-1;i>=0;i--){const s=body[i];if(deadIds.has(s.id))behind+=sectionSpan(s);else s.retreat=(s.retreat||0)+behind;}
   snake.distance-=behind;
  }r.segments=r.segments.filter(s=>!deadIds.has(s.id));updatePositions(r);return;
 }
 // Keep the tail in place. Only the sections AHEAD of a break move backward.
 const old=r.segments;let behind=0;
 for(let i=old.length-1;i>=0;i--){const s=old[i];if(deadIds.has(s.id))behind+=sectionSpan(s);else s.retreat=(s.retreat||0)+behind;}
 r.headDistance-=behind;r.segments=old.filter(s=>!deadIds.has(s.id));updatePositions(r);
}
