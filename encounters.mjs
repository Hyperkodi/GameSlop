// Seeded encounter geometry. Arc-length lookup keeps speed constant through bends.
export const ENCOUNTERS = [
 {id:'hunt',name:'Serpent Hunt',count:1,speed:1,turns:3.6},
 {id:'crossfire',name:'Crossfire',count:2,speed:.92,turns:3.2},
 {id:'coil',name:'The Coil',count:1,speed:.88,turns:5.1},
 {id:'rush',name:'Sidewinder Rush',count:2,speed:1.18,turns:3.4},
 {id:'hydra',name:'Four-Head Siege',count:4,speed:.84,turns:3.5},
 {id:'swarm',name:'Viper Swarm',count:3,speed:1.04,turns:4.1}
];
export const SPECIES=[
 {name:'Thorn Viper',color:'#91bc35',accent:'#ddff79',cell:0,body:{shade:'#426727',light:'#ddff79',pattern:'leaf'}},
 {name:'Cindermaw',color:'#e86730',accent:'#ffd16b',cell:1,body:{shade:'#873321',light:'#ffd16b',pattern:'ember'}},
 {name:'Storm Eel',color:'#25b5cf',accent:'#adf7ff',cell:2,body:{shade:'#17617c',light:'#adf7ff',pattern:'bolt'}},
 {name:'Void Cobra',color:'#9a5cce',accent:'#f4b4ff',cell:3,body:{shade:'#4e287e',light:'#f4b4ff',pattern:'diamond'}}
];
export function encounterFor(chapter,wave=1,mode='campaign') {
 if(mode==='tournament')return ENCOUNTERS[wave>10?[4,5,1,3][wave%4]:Math.floor((wave-1)/2)];
 if(chapter===0)return {...ENCOUNTERS[wave===2?2:0],name:wave===3?'Slippy’s Last Stand':wave===2?'The Coil':'Serpent Hunt'};
 return ENCOUNTERS[chapter%6];
}
// Ten authored shapes, with a different width, bend count and lean for each level.
export const ROUTE_STYLES=[
 {id:'sweep',name:'Wide Sweeps',hint:'Broad side-to-side turns. Lead the head across the arena.'},
 {id:'switchback',name:'Switchbacks',hint:'Long edge runs followed by quick, rounded reversals.'},
 {id:'hourglass',name:'Hourglass',hint:'Wide turns narrow into a central choke point, then spread out.'},
 {id:'spiral',name:'Spiral Dive',hint:'Looping dives curl back upward before descending again.'},
 {id:'braid',name:'Braided Lanes',hint:'Snakes weave through offset lanes and cross near the center.'},
 {id:'steps',name:'Staircase',hint:'Diagonal steps alternate with steep drops.'},
 {id:'eight',name:'Figure Eight',hint:'Overlapping loops cross twice before each descent.'},
 {id:'funnel',name:'Closing Spiral',hint:'Large opening arcs tighten as the snakes approach the vault.'},
 {id:'ripple',name:'Ripple Run',hint:'Small ripples ride along broad sweeping turns.'},
 {id:'pendulum',name:'Pendulum',hint:'Uneven swings build from short feints into wide arcs.'}
];
export function routeStyleFor(chapter,wave=1,mode='campaign'){
 const index=mode==='tournament'?Math.max(0,wave-1):chapter;
 return {...ROUTE_STYLES[index%10],variant:Math.floor(index/10),index};
}
function variedRoute(r,id){
 const style=routeStyleFor(r.chapter,r.wave,r.mode),variant=style.variant;
 const phase=((r.routeSeed||1)%997)/997*.55+id*Math.PI*.83+(r.wave-1)*.21;
 const turns=3.2+(variant%5)*.13+(r.wave-1)*.06,width=136-(variant%4)*6;
 const lean=(variant-4.5)*2,mirror=(id+variant)%2?-1:1;
 const sample=u=>{
  const t=u*Math.PI*2*turns+phase,envelope=Math.sin(Math.PI*u);
  let x=Math.sin(t),dy=0;
  switch(style.id){
   case 'switchback':x=Math.tanh(Math.sin(t)*2.4)/Math.tanh(2.4);break;
   case 'hourglass':x*=.28+.72*Math.abs(2*u-1);break;
   case 'spiral':x=Math.cos(t);dy=Math.sin(t)*66*envelope;break;
   case 'braid':x=.68*Math.sin(t)+.3*Math.sin(t*2+id);break;
   case 'steps':x=.76*Math.sin(t)+.22*Math.cos(t*2);dy=8*Math.sin(t*2)*envelope;break;
   case 'eight':x=Math.sin(t);dy=72*Math.sin(t*2)*envelope;break;
   case 'funnel':x=Math.cos(t)*(1-.64*u);dy=48*Math.sin(t)*envelope;break;
   case 'ripple':x=.75*Math.sin(t)+.23*Math.sin(t*3+.7);break;
   case 'pendulum':x=Math.sin(t+.8*Math.sin(t*.5))*(.58+.4*Math.sin(u*Math.PI));break;
  }
  return {x:240+mirror*(width*x+lean*Math.sin(u*Math.PI)),y:105+520*u+dy};
 };
 const points=[];let length=0;
 const append=(x,y)=>{const last=points.at(-1);if(last)length+=Math.hypot(x-last.x,y-last.y);points.push({x,y,d:length});};
 const start=sample(0),next=sample(.001),direction=Math.sign(next.x-start.x)||1;
 const entryX=Math.max(65,Math.min(415,start.x-direction*55));
 // Start completely offscreen, then ease into the first bend.
 for(let i=0;i<60;i++){const t=i/60,v=1-t;append(v*v*v*entryX+3*v*v*t*entryX+3*v*t*t*(start.x-direction*20)+t*t*t*start.x,v*v*v*-40+3*v*v*t*55+3*v*t*t*102+t*t*t*start.y);}
 for(let i=0;i<=960;i++){const p=sample(i/960);append(p.x,p.y);}
 return points;
}
function legacyRoute(r,id) {
 const style=encounterFor(r.chapter,r.wave,r.mode),phase=((r.routeSeed||1)%997)/997*6.28+id*1.73;
 const points=[];let length=0;
 const append=(x,y)=>{const last=points.at(-1);if(last)length+=Math.hypot(x-last.x,y-last.y);points.push({x,y,d:length});};
 const startX=240+Math.sin(phase)*(style.id==='coil'?135:147)+Math.sin(phase*3.13)*18;
 const direction=Math.cos(phase)>=0?1:-1,entryX=Math.max(60,Math.min(420,startX-direction*65));
 // Feed from above the arena. A curved entrance joins the first slither smoothly.
 for(let i=0;i<60;i++){const t=i/60,v=1-t;append(v*v*v*entryX+3*v*v*t*entryX+3*v*t*t*(startX-direction*24)+t*t*t*startX,v*v*v*-40+3*v*v*t*55+3*v*t*t*102+t*t*t*105);}
 for(let i=0;i<=720;i++){
  const u=i/720,theta=u*Math.PI*2*style.turns+phase;
  const envelope=style.id==='coil'?135+22*Math.sin(u*11):147;
  const x=240+Math.sin(theta)*envelope+Math.sin(theta*2.13+phase)*18;
  const y=105+u*520+Math.sin(theta*1.7+phase)*12*Math.sin(u*Math.PI);
  append(x,y);
 }
 return points;
}
// Multiple snakes alternate lookups, so keep a tiny per-run map without serializing it.
const routeRuns=new WeakMap();
export function routePoint(r,d,id=0){
 let memo=routeRuns.get(r),key=`${r.mode}:${r.wave}:${r.chapter}:${r.routeSeed}:${r.routeVersion}`;
 if(!memo||memo.key!==key){memo={key,paths:new Map()};routeRuns.set(r,memo);}
 if(!memo.paths.has(id))memo.paths.set(id,r.routeVersion===2?variedRoute(r,id):legacyRoute(r,id));
 const p=memo.paths.get(id);
 if(d<0)return {x:p[0].x,y:p[0].y+d,angle:Math.PI/2};
 const end=p.at(-1);if(d>=end.d)return {x:end.x,y:end.y+d-end.d,angle:Math.PI/2};
 let lo=0,hi=p.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(p[mid].d<d)lo=mid;else hi=mid;}
 const a=p[lo],b=p[hi],f=(d-a.d)/(b.d-a.d);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
export const isActionRun=r=>r.combatVersion===3;
export function weakSection(r,s){return isActionRun(r)&&!s.head&&(s.id+Math.floor(r.time/5))%4===0;}
export function firingPoint(r){const angle=Math.atan2(r.aimY-(r.heroY-16),r.aimX-r.heroX);return {x:r.heroX+Math.cos(angle)*31,y:r.heroY-16+Math.sin(angle)*31,angle};}
export function vent(r){if(r.state!=='playing'||!isActionRun(r)||r.ventUntil>r.time||r.heat<.15)return false;r.ventUntil=r.time+1.15;r.events.push({type:'vent'});return true;}
export function advanceHeat(r,dt){
 if(!isActionRun(r))return true;
 const venting=r.ventUntil>r.time;
 if(venting)r.heat=Math.max(0,r.heat-dt*.95);
 else if(!r.manual||r.overheated)r.heat=Math.max(0,r.heat-dt*.29);
 else r.heat=Math.min(1,r.heat+dt*.105);
 if(r.heat>=1)r.overheated=true;
 if(r.heat<=.2&&(!r.manual||venting))r.overheated=false;
 return r.manual&&!venting&&!r.overheated;
}
