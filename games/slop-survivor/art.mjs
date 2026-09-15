import {drawPlayer} from './player-render.mjs';
import {WeaponPosePlayer,poseAsset,muzzlePoint} from './player-poses.mjs';
import {bossForChapter,arenaForChapter,encounterPhase} from './world.mjs';
import {WEAPON_ART,artUrl,getArt,artReady,drawArt,drawActor,skinForChapter,prepareChapterArt,preparePlayerArt} from './illustrated.mjs';
import {sectionPoints} from './snake.mjs';
import {CHAPTERS,weapon} from './data.mjs';
const TAU=Math.PI*2;
function ellipse(c,x,y,rx,ry,color,stroke=null,lw=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
function line(c,points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function poly(c,points,fill,stroke='#152137',lw=2.7){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
function round(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2.7;c.stroke();}}
export function drawIcon(c,id,x,y,size=40){if(WEAPON_ART.includes(id)&&drawArt(c,id,x,y,size))return;c.save();c.translate(x,y);c.scale(size/40,size/40);c.lineJoin='round';
 if(id==='coin'||id==='currency'){ellipse(c,0,2,14,15,'#dc8c29','#17292c');ellipse(c,-2,-1,14,15,'#ffd447','#17292c');ellipse(c,-2,-1,10,11,'#fff2a0','#b88942',1.5);line(c,[[-7,-5],[3,-5],[-5,4],[4,4]],'#94713c',2);line(c,[[-3,-10],[-3,10]],'#94713c',2);}
 else if(id==='diamond'){poly(c,[[-17,-5],[-9,-14],[9,-14],[17,-5],[0,17]],'#76e7ff');poly(c,[[-17,-5],[17,-5],[0,17]],'#289dcc');poly(c,[[-9,-14],[0,-5],[9,-14]],'#d8fbff');poly(c,[[-6,-5],[6,-5],[0,17]],'#dcffff',null);}
 else if(id==='laser'){round(c,-16,-9,23,18,4,'#6176a1','#162c30');round(c,-1,-6,14,12,2,'#86f28b','#182d2f');line(c,[[12,0],[23,-5]],'#ccffe7',5);line(c,[[-13,-4],[-7,-4]],'#edae57',3);}
 else if(id==='gas'){round(c,-11,-13,22,29,5,'#ffac58','#162b2c');round(c,-5,-18,10,6,2,'#789082');poly(c,[[-1,-8],[-6,3],[1,1],[-1,10],[7,-1],[1,-1]],'#633e32',null);line(c,[[10,-13],[16,-18],[21,-15]],'#ffe2a5',2);}
 else if(id==='chain'){c.strokeStyle='#c58dff';c.lineWidth=5;c.save();c.rotate(-.7);c.beginPath();c.roundRect(-7,-18,14,22,7);c.stroke();c.beginPath();c.roundRect(-7,-2,14,22,7);c.stroke();c.restore();poly(c,[[1,-17],[-7,2],[0,0],[-3,17],[11,-5],[3,-3]],'#faf2c3',null);}
 else if(id==='rug'){poly(c,[[-17,-9],[10,-15],[18,10],[-9,16]],'#be71ef');poly(c,[[-10,-6],[6,-9],[11,6],[-6,10]],'#ffe578');line(c,[[-15,0],[11,-7]],'#71466f',2);for(let i=0;i<5;i++)line(c,[[-9+i*6,16-i*1.1],[-10+i*6,20-i*1.1]],'#dfaece',2);}
 else if(id==='burn'){poly(c,[[0,-20],[4,-5],[10,-10],[15,4],[9,16],[-5,19],[-14,9],[-12,-3],[-5,-7]],'#ff7348');poly(c,[[1,-5],[6,7],[2,14],[-6,12],[-5,4]],'#fff085',null);}
 else if(id==='whale'){ellipse(c,-2,1,16,11,'#68cfff','#19313b');poly(c,[[10,0],[21,-8],[21,4],[12,8]],'#39b2ef');ellipse(c,-10,-1,2,2,'#16323b');line(c,[[-3,-10],[-4,-17],[-10,-19]],'#c8f4fc',2);}
 else if(id==='satellite'){c.save();c.rotate(-.35);round(c,-7,-10,14,20,3,'#fff39f','#192b43');for(const x of [-22,10]){round(c,x,-9,12,18,2,'#65bff1','#192b43');line(c,[[x+6,-8],[x+6,8]],'#d5faff',1.5);line(c,[[x+1,0],[x+11,0]],'#d5faff',1.5);}poly(c,[[-6,-10],[6,-10],[0,-19]],'#d8ffff','#193447');c.restore();line(c,[[0,11],[0,22]],'#ffc841',4);}
 else if(id==='swarm'){for(const [x,y] of [[-11,5],[11,5],[0,-10]]){round(c,x-7,y-5,14,11,4,'#b5f868','#243544');ellipse(c,x-2,y,2,2,'#233349');ellipse(c,x+3,y,2,2,'#233349');line(c,[[x-10,y+9],[x-6,y+6]],'#ffe792',2);line(c,[[x+10,y+9],[x+6,y+6]],'#ffe792',2);}}
 else if(id==='vortex'){ellipse(c,0,0,18,13,'#c384fa','#20233d',3);ellipse(c,0,0,10,9,'#291d43');c.strokeStyle='#ffeeb5';c.lineWidth=3;c.beginPath();c.ellipse(0,0,21,7,-.45,0,Math.PI*1.5);c.stroke();ellipse(c,-13,-10,3,3,'#f9d96d');}
 else if(id==='fork'){line(c,[[0,17],[0,2],[-13,-11]],'#243147',9);line(c,[[0,2],[13,-11]],'#243147',9);line(c,[[0,17],[0,2],[-13,-11]],'#ffb46d',5);line(c,[[0,2],[13,-11]],'#ffb46d',5);for(const [x,y] of [[-13,-12],[13,-12],[0,16]])round(c,x-5,y-5,10,10,2,'#ffd877','#1e2b42');}
 else if(id==='oracle'){poly(c,[[-21,0],[-10,-11],[0,-14],[11,-10],[21,0],[10,11],[0,14],[-11,10]],'#f69bb7','#2c2342',3);ellipse(c,0,0,9,10,'#fff2b3','#352346');ellipse(c,0,0,4,8,'#442054');ellipse(c,-2,-3,2,3,'#ffffff');}
 else if(id==='dragon'){poly(c,[[-20,10],[-13,-3],[-9,-16],[1,-11],[12,-9],[20,1],[13,13],[0,12],[-8,20]],'#ffd254','#34273d',3);poly(c,[[-12,-9],[-15,-22],[-2,-12]],'#86ecbe','#352844');poly(c,[[1,-10],[6,-21],[11,-8]],'#86ecbe','#352844');ellipse(c,5,-2,6,6,'#fff4ca','#352844');ellipse(c,7,-2,2,4,'#30223d');line(c,[[8,9],[16,8]],'#582532',2);poly(c,[[-18,7],[-26,10],[-17,16]],'#ff794c','#352844');}
 else if(id==='shield'){poly(c,[[-14,-13],[0,-18],[14,-13],[12,7],[0,19],[-12,7]],'#8bdd6b');poly(c,[[0,-13],[9,-10],[8,4],[0,13]],'#cdf5ca',null);}
 else if(id==='chest'){round(c,-17,-6,34,24,3,'#bf7534','#152a2d');round(c,-17,-15,34,15,5,'#ffd04e','#152a2d');round(c,-4,-8,8,14,2,'#fff4ac','#6a5537');ellipse(c,0,-1,1.7,2.2,'#5f4931');line(c,[[-12,4],[-12,14]],'#dfb467',3);line(c,[[12,4],[12,14]],'#dfb467',3);}
 c.restore();}
const icons=new Map();export function iconUrl(id){if(WEAPON_ART.includes(id))return artUrl(id);if(!icons.has(id)){const c=document.createElement('canvas');c.width=c.height=96;drawIcon(c.getContext('2d'),id,48,48,78);icons.set(id,c.toDataURL());}return icons.get(id);}
export function drawSloppy(c,x,y,size=50,time=0,aim=0){c.save();c.translate(x,y+Math.sin(time*3)*1.5);c.scale(size/50,size/50);const dark='#211727';
 ellipse(c,0,40,28,6,'#17253d55');line(c,[[-23,2],[-31,21]],'#ef2639',10);line(c,[[23,2],[31,21]],'#ef2639',10);ellipse(c,-31,23,8,9,'#ff263b',dark,2.5);ellipse(c,31,23,8,9,'#ff263b',dark,2.5);
 ellipse(c,-12,31,7,11,'#ff2538',dark);ellipse(c,12,31,7,11,'#ff2538',dark);ellipse(c,-14,40,12,6,'#ff3448',dark);ellipse(c,14,40,12,6,'#ff3448',dark);
 ellipse(c,0,0,25,33,'#ef2037',dark,3);ellipse(c,-4,-4,19,25,'#ff3447');
 c.beginPath();c.moveTo(-5,-30);c.bezierCurveTo(-4,-37,-1,-42,4,-40);c.bezierCurveTo(10,-35,2,-33,5,-30);c.fillStyle='#ff3447';c.fill();
 ellipse(c,-9,-13,7,10,'#fff1cd',dark);ellipse(c,9,-13,7,10,'#fff1cd',dark);ellipse(c,-7+aim,-13,3.5,7,'#171626');ellipse(c,7+aim,-13,3.5,7,'#171626');line(c,[[-16,-24],[-4,-21]],dark,2.5);line(c,[[16,-24],[4,-21]],dark,2.5);
 poly(c,[[-6,-1],[6,-1],[6,8],[16,8],[16,19],[6,19],[6,29],[-6,29],[-6,19],[-16,19],[-16,8],[-6,8]],'#141421',null);c.restore();}
function head(c,s,color,t){c.save();c.translate(s.x,s.y);c.rotate(Math.sin(t*2)*.055);ellipse(c,2,7,31,29,'#081d2677');const g=c.createLinearGradient(-22,-24,20,24);g.addColorStop(0,'#ffe2a0');g.addColorStop(.4,color);g.addColorStop(1,'#ae692d');ellipse(c,0,0,29,31,g,'#382b21',2);ellipse(c,-10,-16,7,3,'#ffe6b766');
 // Slippy's tuft, lazy eyelids and thick pink lips are deliberate identity features.
 c.beginPath();c.moveTo(-17,-22);c.bezierCurveTo(-16,-33,-7,-35,-9,-39);c.bezierCurveTo(1,-36,0,-32,7,-34);c.bezierCurveTo(19,-37,22,-20,10,-22);c.bezierCurveTo(0,-20,0,-28,-17,-22);c.fillStyle='#845437';c.fill();c.strokeStyle='#382b21';c.stroke();
 ellipse(c,-12,-3,12,8,'#fff3d4','#57422a',1.2);ellipse(c,12,-3,12,8,'#fff3d4','#57422a',1.2);ellipse(c,-10,0,4,4,'#202a28');ellipse(c,10,0,4,4,'#202a28');poly(c,[[-25,-11],[0,-9],[-1,-1],[-24,-3]],color,null);poly(c,[[0,-9],[25,-11],[24,-3],[1,-1]],color,null);line(c,[[-24,-3],[-1,-1]],'#705037',1.4);line(c,[[1,-1],[24,-3]],'#705037',1.4);
 ellipse(c,0,16,22,8,'#edaa93','#553e32',1.4);c.beginPath();c.moveTo(-16,14);c.quadraticCurveTo(0,24,17,12);c.strokeStyle='#603c32';c.lineWidth=1.5;c.stroke();c.restore();}
export class Renderer{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.headSprite=new Image();this.headSprite.src='./assets/slippy-cartoon.webp';this.heroSprite=new Image();this.heroSprite.src='./assets/illustrated/rear-coin-0.webp';this.back=document.createElement('canvas');this.back.width=480;this.back.height=760;this.chapter=-1;this.playerPose=new WeaponPosePlayer();}
 makeBackground(ch){const c=this.back.getContext('2d');prepareChapterArt(ch);const backdrop=getArt(`arena-${arenaForChapter(ch)}`);if(artReady(backdrop)){c.drawImage(backdrop,0,0,480,760);c.fillStyle='#0f162630';c.fillRect(34,70,412,516);this.chapter=ch;this.backdropReady=true;return;}this.backdropReady=false;
 const floors=['#3b4864','#454562','#3f5266','#514553','#424d60','#494262'];
 c.fillStyle=floors[ch%floors.length];c.fillRect(0,0,480,760);
 // Quiet flat floor gives bright snakes and weapons a consistent contrast field.
 for(let row=0;row<9;row++){for(let col=0;col<5;col++){const x=col*112+(row%2)*40,y=105+row*62;round(c,x,y,37,12,5,'#ffffff04');}}
 for(const side of [0,1]){c.save();if(side){c.translate(480,0);c.scale(-1,1);}for(let i=0;i<7;i++){const y=110+i*70;ellipse(c,4,y,18,25,'#263e49','#192d3c',3);poly(c,[[-5,y+14],[18,y-13],[9,y+17]],'#427a6e','#1b3544',2);}c.restore();}
 round(c,17,601,446,135,16,'#608e85','#213446');round(c,25,607,430,117,12,'#85b396');
 line(c,[[24,597],[456,597]],'#1d3044',5);line(c,[[24,594],[456,594]],'#ffe073',3);
 for(let i=0;i<7;i++)poly(c,[[36+i*63,595],[46+i*63,584],[56+i*63,595]],'#ffe073','#26384c',1.5);
 this.chapter=ch;}

 draw(r,time=0,reduced=false){const canvas=this.canvas,c=this.c;const ch=r?.chapter||0;if(ch!==this.chapter||!this.backdropReady&&artReady(getArt(`arena-${arenaForChapter(ch)}`)))this.makeBackground(ch);const dpr=Math.min(2,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect();const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}c.setTransform(w/480,0,0,h/760,0,0);c.drawImage(this.back,0,0);if(!r)return;preparePlayerArt(r.weapons);const t=r.time,spriteAspect=(w/480)/(h/760);
 // Vault line and glowing perimeter sit below the playable path.
 line(c,[[40,585],[440,585]],'#b6d7bb44',2);for(let i=0;i<r.maxHealth;i++)drawIcon(c,'shield',240+(i-(r.maxHealth-1)/2)*18,702,14);
 for(let i=r.health;i<r.maxHealth;i++){c.fillStyle='#061820dd';c.fillRect(232+(i-(r.maxHealth-1)/2)*18,694,17,18);}
 // Four-piece health sections share a continuous, unoutlined body surface.
 for(let i=r.segments.length-1;i>=0;i--){
  const s=r.segments[i],points=sectionPoints(s);
  if(!points.some(p=>p.x>-50&&p.x<530&&p.y>60&&p.y<660))continue;
  const color=bossForChapter(ch).color;
  if(!s.head){
   const route=points.map(p=>[p.x,p.y]);
   const palettes=[['#ffc542','#e9a832'],['#85d9cc','#61bdad'],['#a4daf4','#79bada'],['#ffa573','#e58554'],['#b8b8f2','#9393d3'],['#e4a8df','#c988c4']];
   const tone=bossForChapter(ch).color;
   line(c,route.map(([x,y])=>[x+2,y+5]),'#16223877',44);
   line(c,route,tone,38);
   line(c,route.map(([x,y])=>[x+2,y+6]),'#45304726',24);
   
   const skin=skinForChapter(ch);if(skin)for(let j=0;j<points.length;j+=2){const p=points[j];c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.beginPath();c.roundRect(-12,-18,24,36,7);c.clip();c.drawImage(skin,24,22,48,52,-12,-18,24,36);c.restore();}
   // Subtle scales mark the four body pieces without suggesting separate health pools.
   if(!skin)for(let j=0;j<points.length;j+=4){const p=points[j];c.save();c.translate(p.x,p.y);c.rotate(p.angle);line(c,[[0,-12],[3,-7],[4,0],[3,7],[0,12]],'#61463044',1.5);c.restore();}
   if(s.armor){for(let j=0;j<points.length;j+=4){const p=points[j];c.save();c.translate(p.x,p.y);c.rotate(p.angle);round(c,-6,-17,12,34,4,'#607e7caa','#20343b');c.restore();}}
   if(s.markedUntil>r.time)line(c,route,'#ff8bad66',8);
   if(s.burn>0){for(let j=0;j<points.length;j+=4){const p=points[j];drawArt(c,`flame-${reduced?0:Math.floor(t*10)%4}`, p.x,p.y-12,18);}}
   if(s.flash&&!reduced)line(c,route,'#fff5cf88',37);
  }
  if(s.head||i===0){const p=points[0];c.save();c.translate(p.x,p.y);c.scale(1,spriteAspect);
   if(drawActor(c,bossForChapter(ch).sheet,0,0,88,t,{hurt:s.flash>0,attack:encounterPhase(r).active,reduced})){}else if(this.headSprite.complete&&this.headSprite.naturalWidth){c.rotate(Math.sin(t*2)*.04);ellipse(c,2,10,30,24,'#061b2377');c.drawImage(this.headSprite,-37,-38,74,76);}
   else head(c,{...s,x:0,y:0},color,t);c.restore();
  }
  // Place the label on a visible point even while part of a section enters the arena.
  const visible=points.filter(p=>p.x>28&&p.x<452&&p.y>78&&p.y<590);
  if(!visible.length)continue;const label=visible[Math.floor(visible.length/2)],x=label.x,y=label.y+(s.head?30:0);
  c.font='900 12px "Segoe UI",sans-serif';c.textAlign='center';c.textBaseline='middle';
  const txt=s.hp>=1000?(s.hp/1000).toFixed(1)+'k':Math.ceil(Math.max(0,s.hp));
  const width=Math.max(38,c.measureText(String(txt)).width+14);
  round(c,x-width/2,y-10,width,20,5,'#252232e6');c.fillStyle='#ffffff';c.fillText(txt,x,y);
  if(s.hp<s.maxHp){round(c,x-20,y+12,40,4,2,'#172c2b');round(c,x-20,y+12,40*Math.max(0,s.hp/s.maxHp),4,2,'#b9f478');}
  if(s.regen)drawIcon(c,'shield',x-width/2-9,y,16);if(s.volatile)drawIcon(c,'gas',x+width/2+9,y,17);
 }
 for(const e of r.effects){const a=Math.max(0,e.life/e.max),p=1-a;c.save();c.globalAlpha=Math.min(1,a*2);c.strokeStyle=e.color;c.fillStyle=e.color;c.lineWidth=3;
  if(['burst','blast','impact','ultimate'].includes(e.type)&&drawArt(c,`burst-${Math.min(3,Math.floor(p*4))}`,e.x,e.y,Math.min(240,e.r*2.6))){c.restore();continue;}
  if(e.type==='orbital'){drawIcon(c,'satellite',e.x+Math.sin(t*2)*30,e.y-115,42);line(c,[[e.x,e.y-92],[e.x,e.y]],'#91eaff66',16);line(c,[[e.x,e.y-92],[e.x,e.y]],'#f1fdff',4);c.beginPath();c.ellipse(e.x,e.y,e.r*(.5+p*.5),e.r*.4,0,0,TAU);c.stroke();}
  else if(e.type==='prophecy'){drawIcon(c,'oracle',e.x,e.y-28-p*12,35);c.beginPath();c.arc(e.x,e.y,e.r,0,TAU);c.stroke();}
  else if(e.type==='hazard'){if(e.style==='vortex'){ellipse(c,e.x,e.y,e.r*.75,e.r*.36,'#271d4899','#bb94ff',2);for(let i=0;i<3;i++){c.beginPath();c.ellipse(e.x,e.y,e.r*(.3+i*.2),e.r*(.15+i*.08),t*(i%2?1:-1)+i,0,Math.PI*1.5);c.stroke();}drawIcon(c,'vortex',e.x,e.y,40);}else if(e.style==='fire'){for(let i=0;i<4;i++)drawArt(c,`flame-${reduced?0:Math.floor(t*10)%4}`, e.x+Math.cos(i*2+t)*e.r*.55,e.y+Math.sin(i*2+t)*e.r*.4,20);}else drawIcon(c,'rug',e.x,e.y,50);}
  else if(e.type==='beam'){const start=muzzlePoint(r,e.weapon||'laser',spriteAspect);line(c,[[start.x,start.y],[e.x2,e.y2]],e.color+'44',12+(e.tier||1));line(c,[[start.x,start.y],[e.x2,e.y2]],'#d7fff1',3+(e.tier||1)*.5);}
  else if(e.type==='chain'){const start=e.x===r.heroX&&e.y===r.heroY?muzzlePoint(r,'chain',spriteAspect):{x:e.x,y:e.y};const points=[[start.x,start.y]];for(let i=1;i<8;i++){const u=i/8;points.push([e.x+(e.x2-e.x)*u+Math.sin(i*9+t*8)*12,e.y+(e.y2-e.y)*u+Math.cos(i*8)*9]);}points.push([e.x2,e.y2]);line(c,points,e.color,4);line(c,points,'#f3e6ff',1.4);}
  else if(e.type==='field'){c.setLineDash([7,7]);c.beginPath();c.ellipse(e.x,e.y,e.r,e.r*.45,0,0,TAU);c.stroke();c.globalAlpha=a*.12;c.fill();c.setLineDash([]);drawIcon(c,'rug',e.x,e.y,55);}
  else if(e.type==='meteor'){if(!e.trigger){c.setLineDash([4,5]);c.beginPath();c.arc(e.x,e.y,e.r,0,TAU);c.stroke();drawIcon(c,'whale',e.x,e.y-180*a,55+50*p);}else{ellipse(c,e.x,e.y,e.r*(1.1-a),e.r*(1.1-a),e.color+'55');}}
  else if(e.type==='fire'){for(let i=0;i<9;i++)drawArt(c,`flame-${reduced?0:Math.floor(t*10)%4}`, e.x+Math.cos(i*2.4)*e.r*.6,e.y+Math.sin(i*2.4)*e.r*.5-10*p,20+18*a);}
  else {const radius=e.r*Math.max(.15,p);c.beginPath();c.arc(e.x,e.y,radius,0,TAU);c.stroke();if(!reduced){for(let i=0;i<10;i++){const ang=i/10*TAU;drawIcon(c,e.type==='ultimate'?'coin':'diamond',e.x+Math.cos(ang)*radius,e.y+Math.sin(ang)*radius,7+7*a);}}}
  c.restore();
 }
 for(const b of r.bullets){c.save();const muzzle=muzzlePoint(r,b.weapon,spriteAspect),blend=b.type!=='fragment'&&Number.isFinite(b.launchX)?Math.max(0,1-b.age/.12):0;c.translate(b.x+(blend?(muzzle.x-b.launchX)*blend:0),b.y+(blend?(muzzle.y-b.launchY)*blend:0));c.scale(1,spriteAspect);c.rotate(b.type==='disc'?b.age*12:Math.atan2(b.vy,b.vx)+Math.PI/2);if(!reduced){line(c,[[0,5],[0,15+Math.min(15,b.tier*3)]],b.color+'88',b.r*.8);}const ammo=b.type==='bomb'?1:b.type==='fork'?2:b.type==='fragment'?3:0;if(['disc','dragon','homing'].includes(b.type))drawIcon(c,b.type==='disc'?'diamond':b.type==='dragon'?'dragon':'swarm',0,0,b.r*2.6);else if(!drawArt(c,`projectiles-${ammo}`,0,0,b.r*3.1))ellipse(c,0,0,b.r,b.r*1.5,b.color,'#fff2b8',1);c.restore();}
 const pose=this.playerPose.update(r);c.save();c.translate(0,r.heroY);c.scale(1,spriteAspect);c.translate(0,-r.heroY);
 ellipse(c,r.heroX,r.heroY+49,26,5,'#001b2055');
 drawPlayer(c,r,pose,reduced);
 c.restore();

 const phase=encounterPhase(r);if(phase.label){round(c,48,64,384,27,9,phase.active?'#a83922ee':'#141009dd','#f5a300');c.font='800 10px Nunito, sans-serif';c.fillStyle='#fff3d6';c.textAlign='center';c.fillText(phase.label,240,82);}

 if(r.manual){c.strokeStyle='#d9f5d2aa';c.lineWidth=1.5;c.beginPath();c.arc(r.aimX,r.aimY,13,0,TAU);c.stroke();line(c,[[r.aimX-19,r.aimY],[r.aimX-9,r.aimY]],'#e6ebc8',1);line(c,[[r.aimX+9,r.aimY],[r.aimX+19,r.aimY]],'#e6ebc8',1);}
 for(const n of r.numbers){c.globalAlpha=Math.min(1,n.life*3);c.textAlign='center';c.font=`bold ${n.crit?17:12}px "Segoe UI",sans-serif`;c.strokeStyle='#182b31';c.lineWidth=3;c.strokeText(n.crit?n.text+'!':n.text,n.x,n.y);c.fillStyle=n.crit?'#ffe195':'#dce9df';c.fillText(n.crit?n.text+'!':n.text,n.x,n.y);}c.globalAlpha=1;
 // Fireflies provide gentle life without obscuring hit targets.
 if(!reduced){for(let i=0;i<8;i++){const x=30+((i*57.3+Math.sin(time*.3+i)*10)%420),y=100+(i*79+time*4)%480;ellipse(c,x,y,1.1,1.1,'#ddf7a455');}}
 }
}
