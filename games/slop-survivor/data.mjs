import {campaignSpacing} from './campaign-pacing.mjs';
import {groupSections} from './snake.mjs';
export const VERSION = 2;
export const CHEST_INTERVAL = 600000;
export const CHEST_CAP = 32;
export const UPGRADE_RARITIES = [
 {id:'green',name:'Green · Basic',weight:60,damage:.25,crit:.05,haste:.10,mult:.20,ranks:1},
 {id:'blue',name:'Blue · Rare',weight:28,damage:.50,crit:.10,haste:.15,mult:.35,ranks:1},
 {id:'red',name:'Red · Epic',weight:10,damage:1,crit:.15,haste:.20,mult:.50,ranks:2},
 {id:'gold',name:'Gold · Legendary',weight:2,damage:2,crit:.25,haste:.30,mult:1,ranks:3}
];
export const LEGENDARY = {
 coin:['Infinite Mint','Coins split into a three-shot fan.'],laser:['Total Liquidation','The beam pierces every aligned segment.'],gas:['Fee Avalanche','Blasts leave a burning aftershock.'],diamond:['Diamond Forever','Returning blades deal double damage.'],chain:['Proof of Thunder','Lightning hits twice as many targets.'],rug:['No Exit Liquidity','Fields also deal three seconds of continuous damage.'],burn:['Deflation Spiral','Flames ignite a 60% wider area.'],whale:['Whale Season','Every impact is followed by a second strike.'],satellite:['Orbital Monopoly','Current-health damage doubles to 3%, capped per hit.'],swarm:['51% Attack','Launch twice as many homing bots.'],vortex:['Event Horizon','Singularities last twice as long.'],fork:['Infinite Fork','Fragments split a second time.'],oracle:['Final Verdict','Execute marked segments below 10% health.'],dragon:['Genesis Unchained','Summon a second dragon and extend the flame trail.']
};
export const WEAPONS = [
 {id:'coin',name:'Mint Condition',tag:'COIN CANNON',icon:'coin',color:'#ffd276',damage:14,cooldown:.26,crit:.10,mult:2,speed:540,type:'bolt',unlock:0,description:'Rapid-fire minted coins. Reliable, precise and gloriously excessive.',special:'pierce',specialName:'Double spend',specialText:'Coins pierce one additional segment.'},
 {id:'laser',name:'Liquidator',tag:'PIERCING BEAM',icon:'laser',color:'#78f8d7',damage:34,cooldown:.9,crit:.08,mult:2.2,type:'beam',unlock:0,description:'A concentrated margin-call beam burns through aligned segments.',special:'pierce',specialName:'Margin call',specialText:'Beam pierces two additional segments.'},
 {id:'gas',name:'Gas Fees',tag:'AREA EXPLOSIVES',icon:'gas',color:'#f8a86a',damage:80,cooldown:2.4,crit:.12,mult:1.8,speed:350,type:'bomb',unlock:0,radius:65,description:'Lob volatile gas canisters. The whole neighborhood pays.',special:'radius',specialName:'Network congestion',specialText:'Explosion radius increases by 35%.'},
 {id:'diamond',name:'Diamond Hands',tag:'RETURNING BLADES',icon:'diamond',color:'#a5c9ff',damage:27,cooldown:1.15,crit:.18,mult:2.3,speed:320,type:'disc',unlock:0,description:'Faceted diamond blades slice outward and return for a second pass.',special:'count',specialName:'Never selling',specialText:'Launch one additional diamond blade.'},
 {id:'chain',name:'Block Lightning',tag:'CHAIN REACTION',icon:'chain',color:'#c2a5ff',damage:29,cooldown:1.8,crit:.15,mult:2,type:'chain',unlock:1,description:'Lightning validates its way across neighboring segments.',special:'chain',specialName:'More validators',specialText:'Lightning jumps to two more targets.'},
 {id:'rug',name:'Rug Pull',tag:'SLOWING FIELD',icon:'rug',color:'#ed9dc7',damage:21,cooldown:3.2,crit:.10,mult:2,type:'field',unlock:2,radius:105,description:'An enchanted rug unrolls beneath Slippy and drags him back.',special:'slow',specialName:'Liquidity lock',specialText:'Rug slows Slippy an extra 10 percentage points.'},
 {id:'burn',name:'Burn Address',tag:'DAMAGE OVER TIME',icon:'burn',color:'#ff795e',damage:32,cooldown:1.4,crit:.10,mult:1.9,type:'burn',unlock:3,radius:63,description:'Send Slippy to the burn address. Fire keeps dealing damage.',special:'burn',specialName:'Supply shock',specialText:'Burn duration increases by 2 seconds.'},
 {id:'whale',name:'Whale Drop',tag:'ORBITAL IMPACT',icon:'whale',color:'#85daff',damage:210,cooldown:5.2,crit:.06,mult:2.5,type:'meteor',unlock:4,radius:100,description:'An enormous golden whale falls from orbit. A very bearish event.',special:'radius',specialName:'Market impact',specialText:'Impact radius increases by 35%.'},
 {id:'satellite',name:'Hash Satellite',tag:'ORBITAL HP SHREDDER',color:'#9ceaff',damage:65,cooldown:3.1,crit:.09,mult:2,type:'satellite',unlock:5,radius:85,description:'An orbiting hash cannon shaves 1.5% of current segment health, capped at 4× its hit damage.',special:'radius',specialName:'Orbital coverage',specialText:'Strike radius increases by 35%.'},
 {id:'swarm',name:'MEV Swarm',tag:'HOMING ATTACK BOTS',color:'#adff70',damage:24,cooldown:1.4,crit:.18,mult:2.1,type:'swarm',speed:330,unlock:6,description:'Three predatory trading bots independently home in on different targets.',special:'count',specialName:'Bot farm',specialText:'Launch one additional homing bot.'},
 {id:'vortex',name:'Ledger Singularity',tag:'PERSISTENT GRAVITY WELL',color:'#d4a3ff',damage:35,cooldown:5,crit:.10,mult:2,type:'vortex',unlock:7,radius:110,description:'A black hole repeatedly damages nearby segments for three seconds and slows the connected snake.',special:'radius',specialName:'Liquidity vacuum',specialText:'Gravity-well radius increases by 35%.'},
 {id:'fork',name:'Hard Fork',tag:'SPLITTING PROJECTILES',color:'#ffa778',damage:48,cooldown:1.3,crit:.15,mult:2.2,type:'fork',speed:470,unlock:8,description:'A blockchain bolt forks into two homing fragments when it strikes.',special:'count',specialName:'Chain split',specialText:'Fire one additional splitting bolt.'},
 {id:'oracle',name:'Oracle of Doom',tag:'DAMAGE MARKS & EXECUTIONS',color:'#ff7e9c',damage:70,cooldown:2.8,crit:.12,mult:2.4,type:'oracle',unlock:9,description:'Marks three segments for five seconds. Marked targets take 25% extra damage from your entire arsenal.',special:'chain',specialName:'More prophecies',specialText:'Mark two additional segments.'},
 {id:'dragon',name:'Genesis Dragon',tag:'HEAD-HUNTING FLAME DRAGON',color:'#ffba58',damage:100,cooldown:4.5,crit:.15,mult:2,type:'dragon',speed:230,unlock:10,radius:75,description:'A crypto dragon hunts the front of the snake, leaving a trail of fire before bursting on impact.',special:'burn',specialName:'Eternal genesis',specialText:'Flame-trail duration increases by two seconds.'}
];
const additions=[
 ['paper','Paper Hands','Comeback volley',7,.50,'C',7,.14,2,600,0,'count','Panic selling','Fire an additional paper note.','Three shots deal double damage while the vault is hurt.','#ffe9b1'],
 ['printer','Money Printer','Ramping turret',16,.55,'B',28,.10,2,520,0,'haste','Brrr','Ramp to maximum firing speed two seconds sooner.','Keep firing at one section to ramp from 0.55 to 0.18 seconds.','#93e9ad'],
 ['sniper','Sniper Bot','Guaranteed crit',120,2.40,'A',38,.15,2.6,900,0,'pierce','Through and through','Pierce an additional low-health section.','Always critically hits the visible section with the lowest current health.','#f4cd69'],
 ['halving','Halving Hammer','Percent max health',88,2.60,'A',62,.11,2.3,0,50,'radius','Wider swing','Increase the hammer radius by 35%.','Every fourth cast adds 2% maximum health damage, capped at 5x base damage.','#dca7ff'],
 ['slippage','Slippage','Stacking vulnerability',26,1.50,'B',40,.16,2,0,55,'chain','Cascading slip','Affect two additional nearby sections.','Apply up to five vulnerability stacks, each increasing incoming damage by 8%.','#b1f0bd'],
 ['copium','Copium Tank','Shield sustain',9,1.60,'C',11,.06,1.6,0,70,'radius','Maximum dosage','Increase the cloud radius by 35%.','Cloud contact charges a shield repair every 45 seconds.','#91e1cb'],
 ['trap','Bear Trap','Path trap and root',130,4,'B',34,.12,2.2,0,60,'radius','Wider jaws','Increase the trap blast radius by 35%.','Place an armed path trap that blasts sections and roots the snake for 2 seconds.','#edb074'],
 ['nuke','Nonce Nuke','Screen clear',150,9,'S',92,.08,2.4,0,999,'radius','Wider blast','Reduce distance falloff by expanding the blast radius.','Hit every visible section with damage falling away from the head.','#ffa270'],
 ['lambo','Wen Lambo','Path sweep',42,3.60,'A',54,.13,2.1,420,0,'count','Second gear','Launch one additional vehicle.','Drive along the snake body path, striking each section once per pass.','#efd45a'],
 ['flashloan','Flash Loan','Debt burst',340,3.20,'S',80,.20,3,0,0,'count','Leveraged','Add 25% damage to the loan burst.','Deliver a huge hit, then repay for 2.5 seconds. A target kill forgives the debt.','#88dfe8']
];
for(const [id,name,cls,damage,cooldown,grade,discovery,crit,mult,speed,radius,special,specialName,specialText,description,color] of additions)WEAPONS.push({id,name,class:cls,tag:cls.toUpperCase(),type:id,damage,cooldown,grade,discovery,crit,mult,speed,radius,special,specialName,specialText,description,color});
Object.assign(LEGENDARY,{
 paper:['Diamond Conversion','Fire five shots instead of three.'],printer:['Brrr Unlimited','Keep the firing ramp when changing targets.'],sniper:['One Shot One Coin','Execute a target below 15% health.'],halving:['The Halvening','Apply maximum-health damage every second cast.'],slippage:['Maximum Extractable','Stack vulnerability up to ten times.'],copium:['Maximum Cope','Accrue shield contact charge twice as fast.'],trap:['Liquidation Cascade','Arm a second trap at the nearest section.'],nuke:['Genesis Block','Strike every visible section without distance falloff.'],lambo:['Full Send','Make a return pass along the snake body path.'],flashloan:['Infinite Leverage','Forgiving a debt refunds the cooldown for an immediate new cast.']
});
export const ACT_ANCHORS = [
 {name:'The Glasshouse',subtitle:'A very expensive infestation.',skin:'gold',color:'#efb64c',hue:0,hp:1,speed:1,segments:25,waves:3,modifier:'Classic',detail:'Slippy is warming up. Break the body, collect chests, protect the vault.'},
 {name:'Jade Exchange',subtitle:'The market has teeth.',skin:'jade',color:'#74d9a4',hue:35,hp:1.3,speed:1.05,segments:28,waves:3,modifier:'Armored',detail:'Every fourth segment wears armor. Critical hits ignore its damage reduction.'},
 {name:'The Cold Wallet',subtitle:'Some assets should stay frozen.',skin:'ice',color:'#92d6fa',hue:140,hp:1.65,speed:1.08,segments:29,waves:3,modifier:'Regeneration',detail:'Glowing segments slowly regenerate. Focus your aim to finish them.'},
 {name:'Gasworks',subtitle:'Fees are about to explode.',skin:'ember',color:'#f88859',hue:305,hp:2.05,speed:1.12,segments:31,waves:3,modifier:'Volatile',detail:'Volatile segments explode into their neighbors when destroyed.'},
 {name:'The Whale Vault',subtitle:'Something big is overleveraged.',skin:'violet',color:'#b393ee',hue:190,hp:2.5,speed:1.14,segments:32,waves:4,modifier:'Heavy armor',detail:'More armor, more body mass. Bring piercing attacks and critical upgrades.'},
 {name:'Last Liquidation',subtitle:'One vault. One very tired Wojak.',skin:'blood',color:'#ffbd66',hue:330,hp:3,speed:1.18,segments:34,waves:4,modifier:'Mixed threats',detail:'Armor, regeneration and volatile segments combine. The outer vaults await.'},
 {name:'Botnet Boulevard',subtitle:'The bots are buying the dip.',skin:'jade',color:'#9ce77a',hue:35,hp:3.65,speed:1.22,segments:36,waves:4,modifier:'Armored swarm',detail:'Longer armored snakes. Homing bots and critical hits pick apart the crowd.'},
 {name:'Gravity Exchange',subtitle:'All liquidity goes down the hole.',skin:'violet',color:'#c5a3ff',hue:190,hp:4.5,speed:1.25,segments:38,waves:4,modifier:'Regenerating armor',detail:'Armor and regeneration overlap. Persistent fields help maintain pressure.'},
 {name:'Forked Futures',subtitle:'One problem becomes two.',skin:'ember',color:'#ffa778',hue:305,hp:5.55,speed:1.29,segments:40,waves:4,modifier:'Volatile armor',detail:'Explosive segments hide among plates of armor. Chain your area attacks.'},
 {name:'The Oracle Gate',subtitle:'The forecast is extremely Slippy.',skin:'ice',color:'#82dcea',hue:140,hp:6.85,speed:1.33,segments:42,waves:4,modifier:'Heavy regeneration',detail:'Regenerating targets demand focused damage. Marks make the whole arsenal stronger.'},
 {name:'Genesis Furnace',subtitle:'A very warm cold wallet.',skin:'ember',color:'#ffc570',hue:305,hp:8.4,speed:1.37,segments:44,waves:4,modifier:'Mixed siege',detail:'All three segment traits return in a faster, denser siege. Unleash the dragon.'},
 {name:'The Forever Vault',subtitle:'The final block will not validate itself.',skin:'blood',color:'#ff99b3',hue:330,hp:10.3,speed:1.42,segments:46,waves:4,modifier:'Ultimate siege',detail:'A brutal inner vault: layered armor, regeneration, volatile chains and four escalating waves.'},
 {name:'Copper Canyon',subtitle:'There is a new snake in town.',skin:'ember',color:'#e8502a',hue:0,hp:11.2,speed:1.44,segments:48,waves:4,modifier:'Outlaw stampede',detail:'Rattlesatoshi winds up, then charges. Break a section during the warning to pull him back before the rush.'},
 {name:'Midnight Marina',subtitle:'Your invitation has been revoked.',skin:'violet',color:'#d33387',hue:240,hp:12.2,speed:1.46,segments:50,waves:4,modifier:'Pearl chant',detail:'Madame Mamba briefly mends her damaged body sections. Focus one health pool and finish it before her chant.'},
 {name:'Clockwork Citadel',subtitle:'The vault is fighting back.',skin:'gold',color:'#12c9c4',hue:0,hp:13.3,speed:1.48,segments:52,waves:4,modifier:'Vault shutters',detail:'Brass Baron closes his body shutters for three seconds at a time. The head stays exposed; critical hits bypass the extra protection.'}
];
// The encounter pool includes every wave and uses the same capped piece count as spawnWave.
export const encounterHealth=n=>Math.exp(.124*(n-1)-.000193*(n-1)**2);
export const waveCount=n=>n<=10?3:n<=40?4:n<=70?5:6;
export const wavePieces=(level,wave)=>Math.min(64,level.segments+(wave-1)*3);
// Battle chests arrive every chestStride kills. Deriving the stride from the level's total
// pieces keeps every level near 25 to 35 cards instead of scaling from 28 to 101.
export function chestStride(level){let pieces=0;for(let wave=1;wave<=level.waves;wave++)pieces+=wavePieces(level,wave);return Math.max(4,Math.round(pieces/24));}
export function rawPool(level){let pool=0;for(let wave=1;wave<=level.waves;wave++)for(let i=0;i<wavePieces(level,wave);i++)pool+=(i===0?1000:260+i*3)*(1+(wave-1)*1.6);return pool;}
// Absolute health anchor: the original 25-piece, three-wave level 1. EHP(n) scales from it,
// so changing the section curve never changes how much total health a level carries.
export const BASE_POOL=rawPool({segments:25,waves:3});
export function generateLevels(anchors=ACT_ANCHORS){
 const cast=['slippy','baron','coldbyte','rattler','mamba','slippy','baron','coldbyte','rattler','mamba','baron','slippy','rattler','mamba','baron'];
 return Array.from({length:100},(_,index)=>{const n=index+1,anchorIndex=Math.min(anchors.length-1,Math.floor(index*anchors.length/100)),act=Math.floor(index/10),anchor=anchors[anchorIndex];
  const level={...anchor,number:n,act,anchorIndex,boss:['slippy','baron','coldbyte','rattler','mamba'][act%5],arena:['glasshouse','citadel','marina','canyon','marina'][act%5],phase:n%10===0?['calm','shutters','mend','stampede','mend'][act%5]:'calm',secondaryPhase:n>50&&n%10===0?['stampede','mend','shutters','mend','shutters'][act%5]:'calm',traits:{armor:n>40||!!(n%8&1),regen:n>40||!!(n%8&2),volatile:n>40||!!(n%8&4)},segments:Math.min(64,32+n),waves:waveCount(n),speed:1+.5*(1-Math.exp(-index/28)),ehp:encounterHealth(n)};
  level.hp=level.ehp*BASE_POOL/rawPool(level);
  level.pieceSpacing=campaignSpacing(level);
  level.modifier=Object.entries(level.traits).filter(([,active])=>active).map(([id])=>({armor:'Armor',regen:'Regeneration',volatile:'Volatile'})[id]).join(' + ')||'Classic';
  const phases={calm:'',shutters:'Body shutters periodically reduce damage. Critical hits bypass them.',mend:'Damaged body sections periodically heal. Focus a section to finish it.',stampede:'A warning precedes a speed burst. Break sections to push the snake back.'};
  level.detail=`${level.waves} waves. ${level.modifier==='Classic'?'Break the body, collect chests and protect the vault.':level.modifier+' sections appear in this siege.'} ${[...new Set([level.phase,level.secondaryPhase])].map(id=>phases[id]).filter(Boolean).join(' ')} Impossible enables all three section traits.`.trim();
  return level;
 });
}
export const LEVELS=generateLevels();
// Compatibility export for the existing renderer and campaign UI.
export const CHAPTERS=LEVELS;
export const DIFFICULTIES = [
 // chestTimer: seconds without a chest before one is handed out anyway. Longer on harder
 // tiers so a struggling run is rescued less often; the tournament keeps 24.
 // headWeight multiplies only the head's health. A heavier head reaches the vault with health
 // left, breaches, is pushed back and dies on the second pass: graded shield loss instead of a
 // coin flip. coreDiv/coreAdd: first-clear cores are ceil(level/coreDiv)+coreAdd.
 {id:'easy',name:'Easy',hp:1,speed:1,reward:1,boons:1,shields:5,rerolls:2,chestTimer:24,color:'#8ed7aa'},
 {id:'hard',name:'Hard',hp:2.2,speed:1.16,reward:2.8,boons:2,shields:4,rerolls:1,chestTimer:28,headWeight:2,coreDiv:9,coreAdd:1,color:'#f5bb66'},
 {id:'impossible',name:'Impossible',hp:2.8,speed:1.42,reward:4.5,boons:3,shields:3,rerolls:0,chestTimer:28,headWeight:3.5,coreDiv:6,coreAdd:2,color:'#fd8c86'}
];
const roster={coin:['C',0,'Single target'],rug:['C',4,'Control'],gas:['B',9,'Burst area'],chain:['B',14,'Chain'],laser:['A',16,'Pierce line'],burn:['B',18,'Damage over time'],diamond:['A',21,'Multi-pass'],swarm:['B',23,'Homing multi'],whale:['S',26,'Burst nuke'],fork:['A',31,'Splitting'],satellite:['S',44,'Percent current health'],dragon:['A',46,'Head hunter'],vortex:['S',58,'Zone control'],oracle:['S',68,'Support amplifier']};
for(const w of WEAPONS)if(roster[w.id]){[w.grade,w.discovery,w.class]=roster[w.id];}
export const GRADE_FACTOR={S:1.30,A:1.10,B:.92,C:.78};
// Specials are bought in the Foundry with coins once a level is cleared on Easy. One is
// equipped per run. Rank 1 is the purchase; ranks 2 and 3 raise damage and charge speed.
export const SPECIALS={
 crash:{name:'Market Crash',unlock:3,price:900,multiplier:12,icon:'coin',description:'A screen-wide shockwave hits every visible section for 12x your best weapon hit and slows Slippy for three seconds.'},
 wave:{name:'Liquidation Wave',unlock:12,price:3500,multiplier:6,icon:'chain',description:'A wall sweeps from the top of the arena to the vault, hitting every section it crosses for 6x your best hit and pushing Slippy back.'},
 halving:{name:'The Halving',unlock:25,price:9000,multiplier:8,icon:'diamond',description:'Every visible section loses 15% of its current health, capped at 8x your best hit each.'},
 forkbomb:{name:'Hard Fork Bomb',unlock:40,price:22000,multiplier:3,icon:'fork',description:'Every visible section spawns two homing fragments that each hit for 3x your best hit.'}
};
export const SPECIAL_RANKS=[{damage:1,charge:1},{damage:1.25,charge:1.15},{damage:1.5,charge:1.3}];
// A special hits three times harder than the old free Market Crash, so it charges a third as
// fast: each firing is an event, and its total output over a run stays where the tiers were tuned.
export const SPECIAL_CHARGE=1/3;
export const specialRankCost=(id,rank)=>Math.round(SPECIALS[id].price*[1,1.6,2.6][rank-1]);
export const specialUnlocked=(s,id)=>!!SPECIALS[id]&&!!s.clears[`${SPECIALS[id].unlock-1}:easy`];
export function buySpecial(s,id){const rank=s.specials.owned[id]||0;if(!SPECIALS[id]||rank>=3||!specialUnlocked(s,id))return false;const cost=specialRankCost(id,rank+1);if(s.coins<cost)return false;s.coins-=cost;s.specials.owned[id]=rank+1;if(!s.specials.equipped)s.specials.equipped=id;return true;}
export function equipSpecial(s,id){if(!s.specials.owned[id])return false;s.specials.equipped=id;return true;}
export const FOUNDRY={ordnance:{name:'Ordnance',max:25,description:'+8% weapon damage per level, compounding.'},precision:{name:'Precision',max:20,description:'+1 crit point and +0.02x critical damage per level.'},overclock:{name:'Overclock',max:20,description:'0.55% shorter cooldown per level.'},vault:{name:'Vault',max:24,description:'+1 shield every 8 levels, up to 3.'}};
export const foundryCost=k=>Math.round(400*1.18**(k-1));
export const rankCost=rank=>[8,22,55,130][rank-1]??Infinity;
export const firstClearParts=(n,d)=>Math.round(Math.round(2*1.056**(n-1))*DIFFICULTIES.find(x=>x.id===d).reward);
export const firstClearCoins=(n,d)=>Math.round(Math.round(60*1.056**(n-1))*DIFFICULTIES.find(x=>x.id===d).reward);
export const CHESTS={rusty:{coins:[40,70],parts:[3,5],weapons:1,cores:[0,0],chance:.04,blueprints:[1,1]},reinforced:{coins:[140,220],parts:[10,16],weapons:2,cores:[0,1],chance:.12,blueprints:[1,2]},armored:{coins:[420,650],parts:[30,45],weapons:3,cores:[2,3],chance:.30,blueprints:[2,3]},vault:{coins:[1200,1800],parts:[90,130],weapons:4,cores:[6,9],chance:1,blueprints:[3,5]}};
export const BOONS = [
 {id:'damage',name:'Bull Market',description:'All weapons start with +25% damage.',icon:'coin'},
 {id:'crit',name:'Lucky Block',description:'All weapons gain +10 percentage points of critical chance.',icon:'diamond'},
 {id:'slow',name:'Circuit Breaker',description:'Slippy moves 15% slower for the entire run.',icon:'rug'},
 {id:'health',name:'Cold Storage',description:'Start with 2 additional vault shields.',icon:'shield'},
 {id:'rapid',name:'Fast Finality',description:'All weapons have 15% shorter cooldowns.',icon:'chain'},
 // Frenzy boons appear only on Hard and Impossible, and not every time. They soften the
 // 5x entrance rush that runs until three sections are on the board.
 {id:'frenzy25',name:'Speed Bump',description:'The entrance frenzy is 25% slower.',icon:'rug',frenzy:.25},
 {id:'frenzy50',name:'Circuit Halt',description:'The entrance frenzy is 50% slower.',icon:'rug',frenzy:.5},
 {id:'frenzy100',name:'Trading Halt',description:'No entrance frenzy at all this run.',icon:'rug',frenzy:1}
];
export const FRENZY_SPEED=5,FRENZY_SECTIONS=3;
export const frenzyReduction=boons=>Math.max(0,...boons.map(id=>BOONS.find(b=>b.id===id)?.frenzy||0));
export const weapon = id => WEAPONS.find(w=>w.id===id);
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function random(state){let x=state.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;state.seed=x>>>0;return state.seed/4294967296;}
export const chestTotal=s=>Object.values(s.chests).reduce((a,b)=>a+b,0);
export const arsenalSlots=s=>(s.furthest.easy>=65?8:s.furthest.easy>=30?7:6);
export const highestUnlocked=s=>Math.min(99,s.furthest.easy);
export function defaultSave(now=Date.now()) {return {version:VERSION,coins:240,levels:Object.fromEntries(WEAPONS.map(w=>[w.id,1])),ranks:Object.fromEntries(WEAPONS.map(w=>[w.id,1])),parts:Object.fromEntries(WEAPONS.map(w=>[w.id,0])),cores:0,blueprints:0,foundry:Object.fromEntries(Object.keys(FOUNDRY).map(k=>[k,0])),furthest:{easy:0,hard:0,impossible:0},owned:['coin'],clears:{},best:{},chests:{rusty:4,reinforced:0,armored:0,vault:0},chestAt:now,deck:['coin'],selected:0,selectedManual:false,difficulty:'easy',settings:{sfx:.35,music:.22,reduced:false,speed:1},specials:{owned:{},equipped:null},totalKills:0,totalRuns:0,tutorial:false,updatedAt:0,tournamentBest:0,tournamentRuns:0,tournamentRun:null,run:null};}
export function unlockedChapter(s,index){return Number.isInteger(index)&&index>=0&&index<LEVELS.length&&(index===0||!!s.clears[`${index-1}:easy`]);}
export function unlockedDifficulty(s,index,id){return DIFFICULTIES.some(d=>d.id===id)&&unlockedChapter(s,index)&&(id==='easy'||!!s.clears[`${index}:${id==='hard'?'easy':'hard'}`]);}
export function weaponUnlocked(s,w){return w.id==='coin'||s.owned?.includes(w.id)||w.grade!=='S'&&!!s.clears[`${w.discovery-1}:${w.grade==='A'?'hard':'easy'}`];}
export function unlockWeapon(s,id){const w=weapon(id);if(!w||w.grade!=='S'||weaponUnlocked(s,w)||s.furthest.easy<w.discovery||s.blueprints<22)return false;s.blueprints-=22;s.owned.push(id);return true;}
export function idleTier(s,rng=Math.random){const n=s.furthest.easy,roll=rng();if(n>=70)return roll<.2?'vault':roll<.75?'armored':'reinforced';if(n>=40)return roll<.08?'vault':roll<.55?'armored':'reinforced';if(n>=20)return roll<.15?'armored':roll<.8?'reinforced':'rusty';return roll<Math.min(.5,n*.025)?'reinforced':'rusty';}
export function addChest(s,tier){if(!CHESTS[tier]||chestTotal(s)>=CHEST_CAP)return false;s.chests[tier]++;return true;}
export function syncChests(s,now=Date.now(),rng=Math.random) {
 if(now<s.chestAt)return 0;if(chestTotal(s)>=CHEST_CAP){s.chestAt=now;return 0;}
 const n=Math.min(CHEST_CAP-chestTotal(s),Math.floor((now-s.chestAt)/CHEST_INTERVAL));
 for(let i=0;i<n;i++)addChest(s,idleTier(s,rng));s.chestAt=chestTotal(s)===CHEST_CAP?now:s.chestAt+n*CHEST_INTERVAL;return n;
}
export function openChests(s,count,now=Date.now(),rng=Math.random,tier=null){
 syncChests(s,now,rng);count=Math.min(chestTotal(s),CHEST_CAP,Math.max(0,Math.floor(count)));const loot={count:0,coins:0,parts:{},cores:0,blueprints:0,tiers:{}};
 const integer=([lo,hi])=>lo+Math.floor(clamp(rng(),0,.999999999)*(hi-lo+1));
 const pool=WEAPONS.filter(w=>weaponUnlocked(s,w));
 for(let i=0;i<count;i++){const key=tier||Object.keys(CHESTS).find(k=>s.chests[k]>0);if(!CHESTS[key]||!s.chests[key])break;const c=CHESTS[key];s.chests[key]--;loot.count++;loot.tiers[key]=(loot.tiers[key]||0)+1;
  const coins=integer(c.coins),cores=integer(c.cores),blueprints=rng()<c.chance?integer(c.blueprints):0;s.coins+=coins;s.cores+=cores;s.blueprints+=blueprints;loot.coins+=coins;loot.cores+=cores;loot.blueprints+=blueprints;
  const available=[...pool],chosen=[];for(let j=0;j<Math.min(c.weapons,pool.length);j++)chosen.push(available.splice(integer([0,available.length-1]),1)[0]);
  const total=integer(c.parts);for(let j=0;j<total;j++){const id=chosen[j%chosen.length].id;s.parts[id]++;loot.parts[id]=(loot.parts[id]||0)+1;}
 }return loot;
}
export function upgradeCost(level,grade='A'){return {coins:Math.round(90*1.115**(level-1)*GRADE_FACTOR[grade]),parts:Math.ceil(6*1.115**(level-1)*GRADE_FACTOR[grade])};}
export function upgradeWeapon(s,id){const w=weapon(id);if(!w||!weaponUnlocked(s,w))return false;const l=s.levels[id];if(l>=s.ranks[id]*10)return false;const c=upgradeCost(l,w.grade);if(s.coins<c.coins||s.parts[id]<c.parts)return false;s.coins-=c.coins;s.parts[id]-=c.parts;s.levels[id]++;return true;}
export function rankUp(s,id){const w=weapon(id),rank=s.ranks[id];if(!w||!weaponUnlocked(s,w)||rank>=5||s.levels[id]<rank*10||s.cores<rankCost(rank))return false;s.cores-=rankCost(rank);s.ranks[id]++;return true;}
export function upgradeFoundry(s,track){const t=FOUNDRY[track];if(!t||s.foundry[track]>=t.max)return false;const cost=foundryCost(s.foundry[track]+1);if(s.coins<cost)return false;s.coins-=cost;s.foundry[track]++;return true;}
export function refine(s,from,to,count=1){if(from===to||!weapon(from)||!weapon(to)||!weaponUnlocked(s,weapon(to))||!Number.isSafeInteger(count)||count<1||s.parts[from]<count*3)return false;s.parts[from]-=count*3;s.parts[to]+=count;return true;}
export const migratedLevel=old=>Math.min(10,1+Math.ceil(Math.log(1+.12*(old-1))/Math.log(1.135)-1e-10));
export function migratedChapter(index){const hp=ACT_ANCHORS[clamp(index,0,14)].hp**(Math.log(encounterHealth(21))/Math.log(ACT_ANCHORS[14].hp));return LEVELS.reduce((best,c,i)=>Math.abs(c.ehp-hp)<Math.abs(LEVELS[best].ehp-hp)?i:best,0);}
function migrateV1(raw){
 const s=JSON.parse(JSON.stringify(raw));s.version=VERSION;s.parts={...s.shards};delete s.shards;s.ranks={};s.owned=WEAPONS.filter(w=>w.unlock===0||w.unlock!==undefined&&raw.clears?.[`${w.unlock-1}:normal`]).map(w=>w.id);s.cores=0;s.blueprints=0;s.clears={};s.best={};
 for(const w of WEAPONS){const old=clamp(Math.floor(raw.levels?.[w.id]||1),1,10),level=migratedLevel(old);s.levels??={};s.levels[w.id]=level;s.ranks[w.id]=old===10?2:1;if(old===10)s.cores+=8;for(let l=level;l<old;l++)s.parts[w.id]=(s.parts[w.id]||0)+(l<=2?0:l-1);}
 const ids={normal:'easy',hard:'hard',hell:'impossible'};
 for(let i=0;i<15;i++)for(const [old,d] of Object.entries(ids)){const k=`${i}:${old}`,index=migratedChapter(i);if(raw.clears?.[k])for(let j=0;j<=index;j++)s.clears[`${j}:${d}`]=true;s.best[`${index}:${d}`]=Math.max(s.best[`${index}:${d}`]||0,raw.best?.[k]||0);}
 s.chests={rusty:raw.chests||0,reinforced:0,armored:0,vault:0};s.selected=migratedChapter(raw.selected||0);s.selectedManual=true;s.difficulty=ids[raw.difficulty]||'easy';
 for(const slot of ['run','tournamentRun']){const r=s[slot];if(!r)continue;r.version=VERSION;r.chapter=migratedChapter(r.chapter);r.difficulty=ids[r.difficulty]||'easy';r.baseRanks={...s.ranks};r.foundry={ordnance:0,precision:0,overclock:0,vault:0};r.slots=6;if(r.baseLevels)for(const w of WEAPONS)r.baseLevels[w.id]=migratedLevel(r.baseLevels[w.id]||1);}
 return s;
}
function validCombatState(r){
 const number=(v,min=-1e12,max=1e12)=>Number.isFinite(v)&&v>=min&&v<=max;
 const optional=(o,keys,min=-1e12,max=1e12)=>keys.every(k=>o[k]===undefined||number(o[k],min,max));
 const ids=xs=>Array.isArray(xs)&&xs.length<=200&&xs.every(x=>Number.isSafeInteger(x)&&x>=0);
 if(!Array.isArray(r.weapons)||!Array.isArray(r.deck)||!Array.isArray(r.segments)||!Array.isArray(r.effects)||!Array.isArray(r.bullets)||!Array.isArray(r.numbers))return false;
 if(r.rootTargets!==undefined&&!ids(r.rootTargets))return false;
 if(new Set(r.weapons.map(w=>w?.id)).size!==r.weapons.length||new Set(r.deck).size!==r.deck.length)return false;
 if(!r.weapons.every(w=>w&&Number.isInteger(w.level)&&number(w.level,1,50)&&optional(w,['rank'],1,5)))return false;
 if(!r.segments.every(s=>s&&optional(s,['spacing'],32,100)&&optional(s,['distance','markedUntil','slipUntil'])&&(!s.points||Array.isArray(s.points)&&s.points.length<=100&&s.points.every(p=>p&&number(p.x)&&number(p.y)&&number(p.angle)))))return false;
 if(!r.effects.every(e=>e&&optional(e,['x','y','x2','y2','angle','start','distance'])&&optional(e,['r'],0,4000)&&(!['trap','lambo'].includes(e.type)||e.weapon===e.type)&&
  (e.type!=='lambo'||number(e.start,-6400,10000)&&[-1,1].includes(e.direction)&&typeof e.returning==='boolean'&&ids(e.hits))&&
  (e.type!=='trap'||e.secondary===undefined||typeof e.secondary==='boolean')))return false;
 if(!r.bullets.every(b=>b&&ids(b.hits)&&optional(b,['factor'],0,100)&&optional(b,['r'],0,100)&&optional(b,['targetX','targetY','launchX','launchY','turnAt','targetId','ignoreId','generation','pierce'])))return false;
 return r.numbers.every(n=>n&&number(n.x)&&number(n.y)&&number(n.life,0,2)&&number(Number(n.text),0));
}
export function validRun(r){
 const finite=(v,min=0,max=r?.mode==='tournament'?Number.MAX_SAFE_INTEGER:1e12)=>Number.isFinite(v)&&v>=min&&v<=max;
 return !!r&&validCombatState(r)&&(r.baseRanks===undefined||r.baseRanks&&WEAPONS.every(w=>Number.isInteger(r.baseRanks[w.id])&&finite(r.baseRanks[w.id],1,5)))&&(r.foundry===undefined||r.foundry&&Object.entries(FOUNDRY).every(([k,t])=>Number.isInteger(r.foundry[k])&&finite(r.foundry[k],0,t.max)))&&r.version===VERSION&&['playing','choice','boon','paused','revive'].includes(r.state)&&['campaign','tournament'].includes(r.mode||'campaign')&&(r.mode!=='tournament'||(Number.isInteger(r.revivesUsed)&&finite(r.revivesUsed,0,3)))&&(r.state!=='revive'||r.mode==='tournament'&&r.health===0&&r.revivesUsed<3)&&finite(r.time,0,r.mode==='tournament'?1e12:86400)&&Number.isInteger(r.chapter)&&r.chapter>=0&&r.chapter<CHAPTERS.length&&DIFFICULTIES.some(d=>d.id===r.difficulty)&&finite(r.seed,0,4294967295)&&finite(r.health,r.state==='revive'?0:1,10)&&finite(r.maxHealth,1,10)&&r.health<=r.maxHealth&&finite(r.headDistance,-6400,5000)&&(r.entered===undefined||Number.isInteger(r.entered)&&finite(r.entered,0,300))&&Number.isInteger(r.wave)&&finite(r.wave,0,r.mode==='tournament'?1e9:6)&&finite(r.score)&&finite(r.charge,0,100)&&!!(r.special==null||SPECIALS[r.special]&&Number.isInteger(r.specialRank)&&finite(r.specialRank,1,3))&&r.effects.every(e=>e.type!=='sweep'||finite(e.y,-200,1000)&&finite(e.speed,1,5000)&&finite(e.amount,0)&&Array.isArray(e.hits))&&finite(r.pending,0,200)&&finite(r.lastChoice)&&finite(r.nextChest)&&finite(r.castId)&&finite(r.kills)&&finite(r.waveKills)&&finite(r.slowUntil)&&finite(r.slowAmount,0,1)&&finite(r.aimX,0,480)&&finite(r.aimY,0,760)&&finite(r.heroX,0,480)&&finite(r.heroY,0,760)&&finite(r.rerolls,0,2)&&finite(r.boonsLeft,0,3)&&Array.isArray(r.boons)&&r.boons.every(b=>BOONS.some(x=>x.id===b))&&Array.isArray(r.boonOptions)&&r.boonOptions.every(b=>BOONS.some(x=>x.id===b))&&Array.isArray(r.deck)&&r.deck.length>0&&r.deck.length<=WEAPONS.length&&r.deck.every(id=>weapon(id))&&r.baseLevels&&WEAPONS.every(w=>Number.isInteger(r.baseLevels[w.id])&&finite(r.baseLevels[w.id],1,50))&&Array.isArray(r.segments)&&r.segments.length<200&&r.segments.every(s=>finite(s.hp,-1e12)&&finite(s.maxHp,1)&&finite(s.x,-10000,10000)&&finite(s.y,-2000,5000)&&finite(s.id)&&finite(s.burn)&&finite(s.burnDps)&&finite(s.angle,-20,20)&&finite(s.flash)&&(s.pieces===undefined||Number.isInteger(s.pieces)&&finite(s.pieces,1,4))&&(s.retreat===undefined||finite(s.retreat,0,6400)))&&Array.isArray(r.weapons)&&r.weapons.length<=(r.slots||6)&&finite(r.slots||6,6,8)&&Number.isInteger(r.slots||6)&&r.weapons.every(w=>weapon(w.id)&&finite(w.damage,1)&&finite(w.cooldown,.09,20)&&finite(w.crit,0,.85)&&finite(w.mult,1,100)&&finite(w.timer,-1,20)&&finite(w.pierce,0,100)&&finite(w.count,1,20)&&finite(w.radius,0,w.id==='nuke'?4000:1000)&&finite(w.chains,1,50)&&finite(w.slow,0,1)&&finite(w.burnTime,0,20)&&finite(w.tier,1,1000)&&finite(w.upgrades,0,1000)&&finite(w.totalDamage)&&finite(w.specialRanks,0,4))&&Array.isArray(r.bullets)&&r.bullets.length<=240&&r.bullets.every(b=>weapon(b.weapon)&&finite(b.x,-2000,5000)&&finite(b.y,-2000,5000)&&finite(b.vx,-2000,2000)&&finite(b.vy,-2000,2000)&&finite(b.life,0,10)&&finite(b.age,0,10)&&Array.isArray(b.hits))&&Array.isArray(r.effects)&&r.effects.length<300&&r.effects.every(e=>finite(e.life,0,20)&&finite(e.max,.001,20))&&Array.isArray(r.numbers)&&r.numbers.length<=55&&Array.isArray(r.events)&&Array.isArray(r.choices)&&r.choices.length<=3&&r.choices.every(c=>c&&weapon(c.weapon)&&['unlock','damage','power','crit','haste','special','criticalDamage','legendary'].includes(c.kind)&&c.id===`${c.weapon}:${c.kind}`&&(c.legacy===true||UPGRADE_RARITIES.some(t=>t.id===c.rarity)))&&r.weapons.every(w=>typeof w.legendary==='boolean'&&(w.guaranteedCrit===undefined||typeof w.guaranteedCrit==='boolean'&&w.guaranteedCrit===(w.id==='sniper'))&&['ramp','lastFireTime','shieldCharge','debtUntil','debtTarget','printerTarget','casts'].every(k=>w[k]===undefined||finite(w[k],0,k==='shieldCharge'?45:k==='ramp'?30:1e12)))&&r.effects.every(e=>e.type!=='hazard'||weapon(e.weapon)&&finite(e.amount)&&finite(e.tick,-1,20))&&r.segments.every(s=>s.markedUntil===undefined||finite(s.markedUntil))&&(r.rootUntil===undefined||finite(r.rootUntil))&&r.segments.every(s=>(s.slipStacks===undefined||Number.isInteger(s.slipStacks)&&finite(s.slipStacks,0,10))&&(s.slipUntil===undefined||finite(s.slipUntil)))&&r.effects.every(e=>!['trap','lambo'].includes(e.type)||weapon(e.weapon)&&finite(e.id)&&finite(e.distance,-6400,10000)&&(e.type!=='trap'||typeof e.armed==='boolean')&&(e.type!=='lambo'||finite(e.travel,0,10000)&&finite(e.range,1,10000)&&Array.isArray(e.hits)))&&!(r.state==='choice'&&!r.choices.length);
}
export function normalizeSave(raw,now=Date.now()){
 const s=defaultSave(now);if(!raw||![1,VERSION].includes(raw.version))return s;
 if(raw.version===1)raw=migrateV1(raw);
 const num=(n,d,max)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):d;
 s.coins=num(raw.coins,s.coins,1e12);s.cores=num(raw.cores,0,1e9);s.blueprints=num(raw.blueprints,0,1e9);
 let remaining=32;for(const k of Object.keys(CHESTS)){s.chests[k]=num(raw.chests?.[k],0,remaining);remaining-=s.chests[k];}
 s.chestAt=Number.isFinite(raw.chestAt)&&raw.chestAt>=0?raw.chestAt:now;
 for(const w of WEAPONS){s.ranks[w.id]=Math.max(1,num(raw.ranks?.[w.id],1,5));s.levels[w.id]=Math.max(1,num(raw.levels?.[w.id],1,s.ranks[w.id]*10));s.parts[w.id]=num(raw.parts?.[w.id],0,1e12);}
 for(const [k,t] of Object.entries(FOUNDRY))s.foundry[k]=num(raw.foundry?.[k],0,t.max);
 for(let i=0;i<LEVELS.length;i++)for(const d of DIFFICULTIES){const k=`${i}:${d.id}`;if(raw.clears?.[k]===true){s.clears[k]=true;s.furthest[d.id]=i+1;}s.best[k]=num(raw.best?.[k],0,1e12);}
 for(const id of Object.keys(SPECIALS)){const rank=num(raw.specials?.owned?.[id],0,3);if(rank)s.specials.owned[id]=rank;}
 s.specials.equipped=s.specials.owned[raw.specials?.equipped]?raw.specials.equipped:Object.keys(s.specials.owned)[0]||null;
 // Market Crash used to be free. A save from before specials that has cleared level 3 keeps it.
 if(raw.specials===undefined&&specialUnlocked(s,'crash')&&!s.specials.owned.crash){s.specials.owned.crash=1;s.specials.equipped=s.specials.equipped||'crash';}
 s.owned=[...new Set(['coin',...(Array.isArray(raw.owned)?raw.owned:[])])].filter(id=>weapon(id));
 s.deck=WEAPONS.filter(w=>weaponUnlocked(s,w)).map(w=>w.id);
 s.selectedManual=raw.selectedManual===true;s.selected=s.selectedManual?num(raw.selected,0,99):highestUnlocked(s);s.difficulty=DIFFICULTIES.some(d=>d.id===raw.difficulty)?raw.difficulty:'easy';
 for(const k of ['sfx','music'])s.settings[k]=Number.isFinite(raw.settings?.[k])?clamp(raw.settings[k],0,1):s.settings[k];s.settings.reduced=raw.settings?.reduced===true;s.settings.speed=raw.settings?.speed===2?2:1;
 s.totalKills=num(raw.totalKills,0,1e12);s.totalRuns=num(raw.totalRuns,0,1e9);s.tutorial=raw.tutorial===true;
 s.updatedAt=num(raw.updatedAt,0,Number.MAX_SAFE_INTEGER);s.tournamentBest=num(raw.tournamentBest,0,Number.MAX_SAFE_INTEGER);s.tournamentRuns=num(raw.tournamentRuns,0,1e9);
 for(const slot of ['run','tournamentRun'])if(raw[slot]&&typeof raw[slot]==='object'){
  const r=JSON.parse(JSON.stringify(raw[slot]));
  if(r.baseLevels)for(const w of WEAPONS)if(r.baseLevels[w.id]===undefined)r.baseLevels[w.id]=s.levels[w.id];
  if(Array.isArray(r.weapons))for(const w of r.weapons){if(w.legendary===undefined)w.legendary=false;if(r.mode==='tournament')w.endless=true;}
  if(Array.isArray(r.choices))for(const c of r.choices)if(!UPGRADE_RARITIES.some(t=>t.id===c.rarity)){c.legacy=true;c.rarity=c.rarity==='epic'?'red':c.rarity==='new'?'green':'blue';}
  if(validRun(r)&&((slot==='tournamentRun')===(r.mode==='tournament'))){groupSections(r);s[slot]=r;}
 }
 syncChests(s,now);return s;
}
