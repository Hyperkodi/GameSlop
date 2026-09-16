// The snake enters at the portal rather than starting deep inside the arena.
// Preserve the specified movement multipliers and wave counts. Derive body-piece
// spacing from travel time, with the original 32px spacing as the lower bound.
export const CAMPAIGN_ENTRY=0;
export const BASE_FEED_SECONDS=480;
export const waveMovement=wave=>11+wave*1.5;
export function campaignSpacing(level){
 const travelUnits=Array.from({length:level.waves},(_,i)=>Math.min(64,level.segments+3*i)/waveMovement(i+1)).reduce((a,b)=>a+b,0);
 return Math.max(32,BASE_FEED_SECONDS*level.speed/travelUnits);
}
