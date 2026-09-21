// Shared by rendering and collision: only the unrolled carpet can catch a snake.
import {sectionBalls} from './dragon-body.mjs';
export const isRug=e=>e.type==='hazard'&&e.style==='rug'||e.type==='field'&&(e.weapon==='rug'||!e.weapon&&e.color==='#ed9dc7');
export function rugBounds(e){
 const width=e.r*1.8,height=e.r*1.12,unroll=Math.min(1,Math.max(0,(e.max-e.life)/.32));
 const left=e.x-width/2,top=e.y-height/2;
 return {left,top,right:left+width*unroll,bottom:top+height,width,height,unroll};
}
export function rugTouches(e,section){
 if(e.life<=0||section.hp<=0)return false;
 const b=rugBounds(e);if(b.unroll<=0)return false;
 const balls=section.snakeId!==undefined&&!section.head?sectionBalls(section):null;
 return (balls||(section.points?.length?section.points:[section])).some(p=>{
  const radius=p.radius??(section.head?18:10);
  const dx=Math.max(b.left-p.x,0,p.x-b.right),dy=Math.max(b.top-p.y,0,p.y-b.bottom);
  return dx*dx+dy*dy<=radius*radius;
 });
}
export function rugSlowAmount(r,body){
 let slow=0;
 for(const e of r.effects){
  if(!isRug(e)||!body.some(s=>rugTouches(e,s)))continue;
  const amount=e.slow??r.weapons.find(w=>w.id==='rug')?.slow??.2;
  slow=Math.max(slow,amount);
 }
 return slow;
}
// Strongest slow wins; overlapping rugs never multiply or override Market Crash.
export function snakeSlowFactor(r,body){return 1-Math.max(r.slowUntil>r.time?r.slowAmount:0,rugSlowAmount(r,body));}
