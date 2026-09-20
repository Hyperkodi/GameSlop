import {drawArt,getArt,artReady} from './illustrated.mjs';
import {poseAsset,BAKED_WEAPONS} from './player-poses.mjs';
import {isActionRun,firingPoint} from './encounters.mjs';

const transform=(p,x,y,angle)=>({x:x+p[0]*Math.cos(angle)-p[1]*Math.sin(angle),y:y+p[0]*Math.sin(angle)+p[1]*Math.cos(angle)});
function sleeve(c,shoulder,hand,far=false){
 const elbow={x:shoulder.x+(far?-4:8),y:Math.max(shoulder.y+9,hand.y+6)};
 c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(shoulder.x,shoulder.y);c.quadraticCurveTo(elbow.x,elbow.y,hand.x,hand.y);
 c.strokeStyle='#10141d';c.lineWidth=11;c.stroke();c.strokeStyle=far?'#29313e':'#343e4b';c.lineWidth=8;c.stroke();
 c.strokeStyle='#55606b';c.lineWidth=1.2;c.beginPath();c.moveTo(shoulder.x,shoulder.y-2);c.quadraticCurveTo(elbow.x-2,elbow.y-2,hand.x-1,hand.y-2);c.stroke();
}
function hand(c,p,angle=0,open=false){
 c.save();c.translate(p.x,p.y);c.rotate(angle);c.fillStyle='#eee8df';c.strokeStyle='#151923';c.lineWidth=1.2;c.beginPath();c.ellipse(0,0,open?4.3:3.5,4.1,0,0,Math.PI*2);c.fill();c.stroke();
 c.strokeStyle='#bdb7b1';c.lineWidth=.6;for(let i=0;i<2;i++){c.beginPath();c.moveTo(-2,1+i);c.lineTo(1.8,1+i);c.stroke();}c.restore();
}
function back(c){
 // Runtime paper-doll layer: use the finished back/legs, excluding its baked gun arm.
 c.save();c.beginPath();c.moveTo(-56,-56);c.lineTo(10,-56);c.lineTo(10,-25);c.lineTo(9,-10);c.lineTo(6,-7);c.lineTo(8,18);c.lineTo(56,18);c.lineTo(56,56);c.lineTo(-56,56);c.closePath();c.clip();drawArt(c,'rear-coin-0',0,0,112);c.restore();
}
export function drawPlayer(c,r,pose,reduced=false){
 if(isActionRun(r)){
  const {angle}=firingPoint(r);c.save();c.translate(r.heroX,r.heroY);c.save();c.scale(.78,.78);back(c);c.restore();
  const grip={x:Math.cos(angle)*12,y:-16+Math.sin(angle)*12};sleeve(c,{x:-9,y:-1},grip,true);sleeve(c,{x:9,y:-1},grip);hand(c,grip,angle);
  c.translate(0,-16);c.rotate(angle);c.fillStyle='#121b29';c.strokeStyle='#90a6b4';c.lineWidth=1.5;
  c.beginPath();c.roundRect(-5,-6,32,12,3);c.fill();c.stroke();c.fillStyle='#e7b54e';c.fillRect(5,-4,12,8);c.fillStyle='#364c5b';c.fillRect(23,-3,8,6);
  if(pose.active&&!reduced&&r.time% .26<.075){c.fillStyle='#ffeaaa';c.beginPath();c.moveTo(31,-4);c.lineTo(42,0);c.lineTo(31,4);c.fill();}
  c.restore();return true;
 }
 const {weapon:id}=pose;
 if(BAKED_WEAPONS.has(id)){
  const frame=reduced?(pose.active?3:0):pose.frame;
  return drawArt(c,poseAsset(id,frame),r.heroX,r.heroY,112)||drawArt(c,poseAsset('coin',0),r.heroX,r.heroY,112);
 }
 if(!artReady(getArt('rear-coin-0')))return false;
 const p=pose.active?Math.min(1,pose.elapsed/pose.duration):0,e=reduced?0:Math.sin(p*Math.PI),wave=reduced?0:Math.sin(p*Math.PI*2);
 let x=17,y=-12,size=35,angle=0,scaleX=1,alpha=1,left=[-11,6],right=[11,6],open=false;
 switch(id){
  case 'diamond':x=19+e*4;y=-12-e*12;size=35;angle=-.8+p*2.1;left=[-5,10];right=[0,0];open=pose.active&&p>.48;alpha=open?Math.max(0,1-(p-.48)*5):1;break;
  case 'chain':y=-15-e*7;angle=wave*.16;size=34+e*2;break;
  case 'rug':x=11;y=-14-e*4;size=37;scaleX=.65+e*.35;left=[-13,2];right=[13,2];break;
  case 'burn':x=17;y=-12+e*2;size=44;angle=-.42+wave*.14;left=[-1,1];right=[-10,14];break;
  case 'whale':x=13;y=-14-e*3;size=30;angle=-e*.1;left=[-8,8];right=[8,8];break;
  case 'satellite':x=14;y=-15-e*6;size=30;angle=-.1+e*.1;left=[-8,9];right=[7,5];break;
  case 'swarm':x=16;y=-16-e*10;size=29;left=[-8,10+e*7];right=[8,10+e*7];open=pose.active&&p>.3;break;
  case 'vortex':x=12;y=-17-e*4;size=32+e*3;angle=pose.active?p*Math.PI*2:0;left=[-13,3];right=[13,3];break;
  case 'fork':x=17;y=-13+Math.abs(wave)*3;size=44;angle=-.48;left=[0,1];right=[-10,14];break;
  case 'oracle':x=-14;y=-17-e*10;size=34;left=[0,13];right=[23,12];angle=-e*.1;break;
  case 'dragon':x=13;y=-17-e*6;size=34+e*5;angle=-e*.18;left=[-8,12];right=[8,12];open=pose.active&&p>.5;break;
 }
 const l=transform(left,x,y,angle),rr=transform(right,x,y,angle);
 c.save();c.translate(r.heroX,r.heroY);
 sleeve(c,{x:-12,y:-3},l,true);back(c);sleeve(c,{x:8,y:-3},rr);
 c.save();c.translate(x,y);c.rotate(angle);c.scale(scaleX,1);c.globalAlpha=alpha;drawArt(c,id,0,0,size);c.restore();
 hand(c,l,angle,open);hand(c,rr,angle,open);
 // Small activation glows link held devices to their distinct battlefield effects.
 if(p>0&&!reduced&&['chain','whale','satellite','vortex','oracle','dragon'].includes(id)){
  c.globalAlpha=e*.45;c.strokeStyle=id==='chain'||id==='vortex'||id==='oracle'?'#c4a2ff':'#76f1e0';c.lineWidth=1.3;c.beginPath();c.arc(x,y,size*.45+e*4,0,Math.PI*2);c.stroke();
 }
 c.restore();return true;
}
