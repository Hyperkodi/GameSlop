// Shared formatting keeps high-level damage readable without hiding exact tooltips.
export function compactNumber(value){
 const n=Number(value);if(!Number.isFinite(n))return '0';
 const a=Math.abs(n);for(const [scale,label] of [[1e9,'B'],[1e6,'M'],[1e3,'K']])if(a>=scale)return (n/scale).toFixed(a/scale<10?2:a/scale<100?1:0).replace(/\.0+$|(?<=\.[0-9])0$/,'')+label;
 return String(Math.round(n));
}
export function effectiveDps(w){
 const crit=w.guaranteedCrit?w.mult:1+w.crit*(w.mult-1);
 // Single-target nominal throughput, no conditional effects or area overlap.
 const hits=['paper','swarm'].includes(w.id)?w.count:1;
 return w.damage*hits*crit/w.cooldown;
}
