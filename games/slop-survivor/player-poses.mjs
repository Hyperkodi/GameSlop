// Presentation only: weapon ownership, damage, cooldowns and saves stay in the engine.
export const BAKED_WEAPONS=new Set(['coin','laser','gas']);
export const WEAPON_POSES={
 coin:{duration:.30,muzzle:[24,-26],action:'Short two-handed recoil'},
 laser:{duration:.48,muzzle:[25,-31],action:'Shouldered beam rifle'},
 gas:{duration:.55,muzzle:[24,-24],action:'Heavy launcher recoil'},
 diamond:{duration:.45,muzzle:[25,-10],action:'Forward chakram throw'},
 chain:{duration:.48,muzzle:[20,-15],action:'Two-handed coil discharge'},
 rug:{duration:.55,muzzle:[-16,-12],action:'Unroll and cast the scroll'},
 burn:{duration:.60,muzzle:[25,-24],action:'Braced flame sweep'},
 whale:{duration:.50,muzzle:[16,-12],action:'Activate a whale beacon'},
 satellite:{duration:.48,muzzle:[15,-12],action:'Aim and trigger orbital remote'},
 swarm:{duration:.55,muzzle:[20,-17],action:'Release a drone from the palm'},
 vortex:{duration:.60,muzzle:[12,-20],action:'Open the gravity gyroscope'},
 fork:{duration:.40,muzzle:[25,-27],action:'Alternating twin-barrel recoil'},
 oracle:{duration:.60,muzzle:[-17,-22],action:'Raise the eye talisman'},
 dragon:{duration:.65,muzzle:[15,-23],action:'Two-handed dragon summoning'}
};
export const poseAsset=(weapon,frame=0)=>`rear-${WEAPON_POSES[weapon]?weapon:'coin'}-${Math.max(0,Math.min(3,frame|0))}`;
export function muzzlePoint(r,weapon,aspect=1){const [x,y]=(WEAPON_POSES[weapon]||WEAPON_POSES.coin).muzzle;return {x:r.heroX+x,y:r.heroY+y*aspect};}

export class WeaponPosePlayer{
 constructor(){this.reset(null);}
 reset(run){this.run=run;this.weapon='coin';this.started=-Infinity;this.seen=-Infinity;this.pending=new Map();}
 update(run){
  if(this.run!==run||run.time<this.seen)this.reset(run);
  const now=run.time,owned=new Set(run.weapons.map(w=>w.id));
  if(!owned.has(this.weapon)){this.weapon=owned.values().next().value||'coin';this.started=-Infinity;}
  if(now!==this.seen){
   this.seen=now;
   for(const event of run.events||[])if(event.type==='fire'&&owned.has(event.weapon)&&WEAPON_POSES[event.weapon]){
    // Coalesce repeated auto-fire without allowing the starting gun to bury rarer actions.
    if(!this.pending.has(event.weapon))this.pending.set(event.weapon,now);
   }
   for(const [id,time] of this.pending)if(!owned.has(id)||now-time>1.25)this.pending.delete(id);
   if(now-this.started>=WEAPON_POSES[this.weapon].duration&&this.pending.size){
    const choices=[...this.pending].sort((a,b)=>(a[0]==='coin')-(b[0]==='coin')||a[1]-b[1]);
    this.weapon=choices[0][0];this.started=now;this.pending.delete(this.weapon);
   }
  }
  const elapsed=now-this.started,duration=WEAPON_POSES[this.weapon].duration;
  const frame=elapsed<duration?Math.min(3,Math.floor(elapsed/duration*4)):0;
  return {weapon:this.weapon,frame,active:elapsed<duration,elapsed,duration};
 }
}
