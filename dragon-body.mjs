// Three visual balls share the existing section's health, rewards and path span.
// Old saves keep their section weights; no wave or damage progress is reset.
export const BALLS_PER_SECTION=3;
export function sectionBalls(s){
 if(s.head)return [];
 const points=s.points?.length?s.points:[s],spacing=s.spacing||32,span=(s.pieces||1)*spacing;
 const length=span-spacing,step=span/BALLS_PER_SECTION;
 const sample=offset=>{
  if(points.length===1){const p=points[0];return {x:p.x-Math.cos(p.angle||0)*offset,y:p.y-Math.sin(p.angle||0)*offset,angle:p.angle||0};}
  if(offset<=0||offset>=length){const p=points[offset<=0?0:points.length-1],extra=offset<=0?-offset:length-offset;return {x:p.x+Math.cos(p.angle||0)*extra,y:p.y+Math.sin(p.angle||0)*extra,angle:p.angle||0};}
  const index=offset/length*(points.length-1),i=Math.floor(index),a=points[i],b=points[Math.min(i+1,points.length-1)],f=index-i;
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,angle:Math.atan2(a.y-b.y,a.x-b.x)};
 };
 return Array.from({length:BALLS_PER_SECTION},(_,i)=>({...sample((step-spacing)/2+i*step),radius:step*.54}));
}
export function ballHit(s,x,y,padding=0){return sectionBalls(s).some(p=>Math.hypot(p.x-x,p.y-y)<=p.radius+padding);}
function circle(c,x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();}
function shape(c,points,fill){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();}
export function drawDragonSection(c,s,species,time,reduced=false,aspect=1){
 const balls=sectionBalls(s),skin=species.body||{},shade=skin.shade||'#173d47',light=skin.light||species.accent;
 for(let i=balls.length-1;i>=0;i--){const p=balls[i],r=p.radius;
  c.save();c.translate(p.x,p.y);c.scale(1,aspect);
  circle(c,1,3,r,'#08132155');circle(c,0,0,r,shade);
  circle(c,-r*.05,-r*.12,r*.88,species.color);circle(c,-r*.26,-r*.38,r*.22,light);
  // Large, simple markings stay readable at mobile scale; no group outline.
  c.save();c.scale(r/16,r/16);c.rotate(p.angle);
  switch(skin.pattern){
   case 'leaf':shape(c,[[-3,-6],[6,0],[-3,6],[-7,0]],light);shape(c,[[-4,0],[5,0],[-1,2]],shade);break;
   case 'ember':shape(c,[[-6,-5],[2,-2],[-1,0],[6,5],[-3,2],[0,0]],light);break;
   case 'bolt':shape(c,[[1,-8],[-5,1],[-1,1],[-2,8],[6,-2],[1,-2]],light);break;
   case 'diamond':shape(c,[[0,-7],[5,0],[0,7],[-5,0]],light);shape(c,[[0,-4],[2,0],[0,4],[-2,0]],shade);break;
   default:circle(c,0,0,4,light);
  }
  c.restore();
  if(s.armor){c.fillStyle='#d9eef0';c.fillRect(-r*.35,r*.45,r*.7,Math.max(2,r*.13));}
  if(s.markedUntil>time){circle(c,r*.5,-r*.5,Math.max(2,r*.14),'#ff8bad');}
  if(s.burn>0){circle(c,-r*.45,r*.3,r*.16,'#ff993f');circle(c,r*.35,-r*.3,r*.12,'#ffe277');}
  if(s.flash&&!reduced)circle(c,0,0,r,'#fff5cf88');
  c.restore();
 }
 return balls;
}
