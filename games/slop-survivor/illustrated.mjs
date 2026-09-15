import {poseAsset,BAKED_WEAPONS} from './player-poses.mjs';
import {bossForChapter,arenaForChapter} from './world.mjs';
export const WEAPON_ART=['coin','laser','gas','diamond','chain','rug','burn','whale','satellite','swarm','vortex','fork','oracle','dragon','paper','copium','printer','sniper','halving','slippage','trap','nuke','lambo','flashloan'];
const cache=new Map(),skins=new Map();
export const artUrl=id=>`assets/illustrated/${id}.webp`;
export function getArt(id){
 if(!cache.has(id)){const image=new Image();image.src=artUrl(id);image.addEventListener('load',()=>window.dispatchEvent(new Event('illustrated-art-ready')));cache.set(id,image);}
 return cache.get(id);
}
export const artReady=image=>image.complete&&image.naturalWidth>0;
export function drawArt(c,id,x,y,w,h=w,rotation=0){
 const image=getArt(id);if(!artReady(image))return false;
 c.save();c.translate(x,y);c.rotate(rotation);c.drawImage(image,-w/2,-h/2,w,h);c.restore();return true;
}
export function actorPose(time,{hurt=false,attack=false,reduced=false}={}){
 if(hurt)return 2;if(attack)return 3;if(reduced)return 0;
 return time%4.8>4.4?1:0;
}
export function drawActor(c,id,x,y,size,time,options={}){return drawArt(c,`${id}-${actorPose(time,options)}`,x,y,size,size);}
export function skinForChapter(chapter){
 const boss=bossForChapter(chapter),image=getArt('skin');if(!artReady(image))return null;
 if(!skins.has(boss.sheet)){const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');c.filter=`hue-rotate(${boss.hue}deg)`;c.drawImage(image,0,0,96,96);skins.set(boss.sheet,canvas);}return skins.get(boss.sheet);
}
export function prepareChapterArt(chapter){
 const boss=bossForChapter(chapter);
 for(let i=0;i<4;i++){getArt(`${boss.sheet}-${i}`);getArt(`rear-coin-${i}`);getArt(`burst-${i}`);getArt(`flame-${i}`);getArt(`projectiles-${i}`);}
 getArt('skin');getArt(`arena-${arenaForChapter(chapter)}`);
 for(const id of WEAPON_ART)getArt(id);
}

export function preparePlayerArt(weapons){for(const w of weapons){getArt(w.id);if(BAKED_WEAPONS.has(w.id))for(let i=0;i<4;i++)getArt(poseAsset(w.id,i));}}
