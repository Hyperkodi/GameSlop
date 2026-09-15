import {groupSections} from './snake.mjs';
export const VERSION = 1;
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
export const CHAPTERS = [
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
export const DIFFICULTIES = [
 {id:'normal',name:'Normal',hp:1,speed:1,reward:1,boons:1,color:'#8ed7aa'},
 {id:'hard',name:'Hard',hp:1.45,speed:1.12,reward:1.65,boons:2,color:'#f5bb66'},
 {id:'hell',name:'Hell',hp:2.05,speed:1.23,reward:2.4,boons:3,color:'#fd8c86'}
];
export const BOONS = [
 {id:'damage',name:'Bull Market',description:'All weapons start with +25% damage.',icon:'coin'},
 {id:'crit',name:'Lucky Block',description:'All weapons gain +10 percentage points of critical chance.',icon:'diamond'},
 {id:'slow',name:'Circuit Breaker',description:'Slippy moves 15% slower for the entire run.',icon:'rug'},
 {id:'health',name:'Cold Storage',description:'Start with 2 additional vault shields.',icon:'shield'},
 {id:'rapid',name:'Fast Finality',description:'All weapons have 15% shorter cooldowns.',icon:'chain'}
];
export const weapon = id => WEAPONS.find(w=>w.id===id);
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function random(state){let x=state.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;state.seed=x>>>0;return state.seed/4294967296;}
export function defaultSave(now=Date.now()) {return {version:VERSION,coins:240,levels:Object.fromEntries(WEAPONS.map(w=>[w.id,1])),shards:Object.fromEntries(WEAPONS.map(w=>[w.id,0])),clears:{},best:{},chests:4,chestAt:now,deck:['coin','laser','gas','diamond'],selected:0,difficulty:'normal',settings:{sfx:.35,music:.22,reduced:false},totalKills:0,totalRuns:0,tutorial:false,updatedAt:0,tournamentBest:0,tournamentRuns:0,tournamentRun:null,run:null};}
export function unlockedChapter(s,index){return index===0||!!s.clears[`${index-1}:normal`];}
export function unlockedDifficulty(s,index,id){return unlockedChapter(s,index)&&(id==='normal'||!!s.clears[`${index}:${id==='hard'?'normal':'hard'}`]);}
export function weaponUnlocked(s,w){return w.unlock===0||!!s.clears[`${w.unlock-1}:normal`];}
export function syncChests(s,now=Date.now()) {
 if(now<s.chestAt)return 0;
 if(s.chests>=CHEST_CAP){s.chests=CHEST_CAP;s.chestAt=now;return 0;}
 const n=Math.min(CHEST_CAP-s.chests,Math.floor((now-s.chestAt)/CHEST_INTERVAL));
 s.chests+=n;s.chestAt=s.chests===CHEST_CAP?now:s.chestAt+n*CHEST_INTERVAL;return n;
}
export function openChests(s,count,now=Date.now(),rng=Math.random){syncChests(s,now);count=Math.min(s.chests,CHEST_CAP,Math.max(0,Math.floor(count)));const loot={count,coins:0,shards:{}};const pool=WEAPONS.filter(w=>weaponUnlocked(s,w));for(let i=0;i<count;i++){const coins=35+Math.floor(rng()*31);s.coins+=coins;loot.coins+=coins;const w=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];const n=2+Math.floor(rng()*3);s.shards[w.id]+=n;loot.shards[w.id]=(loot.shards[w.id]||0)+n;}s.chests-=count;return loot;}
export function upgradeCost(level){return {coins:70+level*45,shards:level<=2?0:level-1};}
export function upgradeWeapon(s,id){const w=weapon(id);if(!w||!weaponUnlocked(s,w))return false;const l=s.levels[id];if(l>=10)return false;const c=upgradeCost(l);if(s.coins<c.coins||s.shards[id]<c.shards)return false;s.coins-=c.coins;s.shards[id]-=c.shards;s.levels[id]++;return true;}
export function validRun(r){
 const finite=(v,min=0,max=r?.mode==='tournament'?Number.MAX_SAFE_INTEGER:1e12)=>Number.isFinite(v)&&v>=min&&v<=max;
 return !!r&&r.version===VERSION&&['playing','choice','boon','paused','revive'].includes(r.state)&&['campaign','tournament'].includes(r.mode||'campaign')&&(r.mode!=='tournament'||(Number.isInteger(r.revivesUsed)&&finite(r.revivesUsed,0,3)))&&(r.state!=='revive'||r.mode==='tournament'&&r.health===0&&r.revivesUsed<3)&&finite(r.time,0,r.mode==='tournament'?1e12:86400)&&Number.isInteger(r.chapter)&&r.chapter>=0&&r.chapter<CHAPTERS.length&&DIFFICULTIES.some(d=>d.id===r.difficulty)&&finite(r.seed,0,4294967295)&&finite(r.health,r.state==='revive'?0:1,7)&&finite(r.maxHealth,1,7)&&finite(r.headDistance,-6400,5000)&&Number.isInteger(r.wave)&&finite(r.wave,0,r.mode==='tournament'?1e9:4)&&finite(r.score)&&finite(r.charge,0,100)&&finite(r.pending,0,200)&&finite(r.lastChoice)&&finite(r.nextChest)&&finite(r.castId)&&finite(r.kills)&&finite(r.waveKills)&&finite(r.slowUntil)&&finite(r.slowAmount,0,1)&&finite(r.aimX,0,480)&&finite(r.aimY,0,760)&&finite(r.heroX,0,480)&&finite(r.heroY,0,760)&&finite(r.rerolls,0,2)&&finite(r.boonsLeft,0,3)&&Array.isArray(r.boons)&&r.boons.every(b=>BOONS.some(x=>x.id===b))&&Array.isArray(r.boonOptions)&&r.boonOptions.every(b=>BOONS.some(x=>x.id===b))&&Array.isArray(r.deck)&&r.deck.length>0&&r.deck.length<=WEAPONS.length&&r.deck.every(id=>weapon(id))&&r.baseLevels&&WEAPONS.every(w=>finite(r.baseLevels[w.id],1,10))&&Array.isArray(r.segments)&&r.segments.length<200&&r.segments.every(s=>finite(s.hp,-1e12)&&finite(s.maxHp,1)&&finite(s.x,-10000,10000)&&finite(s.y,-2000,5000)&&finite(s.id)&&finite(s.burn)&&finite(s.burnDps)&&finite(s.angle,-20,20)&&finite(s.flash)&&(s.pieces===undefined||Number.isInteger(s.pieces)&&finite(s.pieces,1,4))&&(s.retreat===undefined||finite(s.retreat,0,6400)))&&Array.isArray(r.weapons)&&r.weapons.length<=6&&r.weapons.every(w=>weapon(w.id)&&finite(w.damage,1)&&finite(w.cooldown,.09,20)&&finite(w.crit,0,.85)&&finite(w.mult,1,100)&&finite(w.timer,-1,20)&&finite(w.pierce,0,100)&&finite(w.count,1,20)&&finite(w.radius,0,1000)&&finite(w.chains,1,50)&&finite(w.slow,0,1)&&finite(w.burnTime,0,20)&&finite(w.tier,1,1000)&&finite(w.upgrades,0,1000)&&finite(w.totalDamage)&&finite(w.specialRanks,0,4))&&Array.isArray(r.bullets)&&r.bullets.length<=240&&r.bullets.every(b=>weapon(b.weapon)&&finite(b.x,-2000,5000)&&finite(b.y,-2000,5000)&&finite(b.vx,-2000,2000)&&finite(b.vy,-2000,2000)&&finite(b.life,0,10)&&finite(b.age,0,10)&&Array.isArray(b.hits))&&Array.isArray(r.effects)&&r.effects.length<300&&r.effects.every(e=>finite(e.life,0,20)&&finite(e.max,.001,20))&&Array.isArray(r.numbers)&&r.numbers.length<=55&&Array.isArray(r.events)&&Array.isArray(r.choices)&&r.choices.length<=3&&r.choices.every(c=>weapon(c.weapon)&&['unlock','damage','power','crit','haste','special','criticalDamage','legendary'].includes(c.kind)&&c.id===`${c.weapon}:${c.kind}`&&(c.legacy===true||UPGRADE_RARITIES.some(t=>t.id===c.rarity)))&&r.weapons.every(w=>typeof w.legendary==='boolean')&&r.effects.every(e=>e.type!=='hazard'||weapon(e.weapon)&&finite(e.amount)&&finite(e.tick,-1,20))&&r.segments.every(s=>s.markedUntil===undefined||finite(s.markedUntil))&&!(r.state==='choice'&&!r.choices.length);
}
export function normalizeSave(raw,now=Date.now()){
 const s=defaultSave(now);if(!raw||raw.version!==VERSION)return s;
 const num=(n,d,max)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):d;
 s.coins=num(raw.coins,s.coins,1e9);s.chests=num(raw.chests,4,32);s.chestAt=Number.isFinite(raw.chestAt)&&raw.chestAt>=0?raw.chestAt:now;
 for(const w of WEAPONS){s.levels[w.id]=Math.max(1,num(raw.levels?.[w.id],1,10));s.shards[w.id]=num(raw.shards?.[w.id],0,1e6);}
 for(let i=0;i<CHAPTERS.length;i++)for(const d of DIFFICULTIES){const k=`${i}:${d.id}`;if(raw.clears?.[k]===true)s.clears[k]=true;s.best[k]=num(raw.best?.[k],0,1e9);}
 s.deck=[...new Set(Array.isArray(raw.deck)?raw.deck:[])].filter(id=>weapon(id)&&weaponUnlocked(s,weapon(id))).slice(0,6);if(!s.deck.includes('coin'))s.deck.unshift('coin');s.deck=s.deck.slice(0,6);
 s.selected=num(raw.selected,0,CHAPTERS.length-1);s.difficulty=DIFFICULTIES.some(d=>d.id===raw.difficulty)?raw.difficulty:'normal';
 for(const k of ['sfx','music'])s.settings[k]=Number.isFinite(raw.settings?.[k])?clamp(raw.settings[k],0,1):s.settings[k];s.settings.reduced=raw.settings?.reduced===true;
 s.totalKills=num(raw.totalKills,0,1e9);s.totalRuns=num(raw.totalRuns,0,1e9);s.tutorial=raw.tutorial===true;
 s.updatedAt=num(raw.updatedAt,0,Number.MAX_SAFE_INTEGER);s.tournamentBest=num(raw.tournamentBest,0,Number.MAX_SAFE_INTEGER);s.tournamentRuns=num(raw.tournamentRuns,0,1e9);
 for(const slot of ['run','tournamentRun'])if(raw[slot]&&typeof raw[slot]==='object'){
  const r=JSON.parse(JSON.stringify(raw[slot]));
  // Migrate old runs without losing account upgrades or altering the active build.
  if(r.baseLevels)for(const w of WEAPONS)if(r.baseLevels[w.id]===undefined)r.baseLevels[w.id]=s.levels[w.id];
  if(Array.isArray(r.weapons))for(const w of r.weapons){if(w.legendary===undefined)w.legendary=false;if(r.mode==='tournament')w.endless=true;}
  if(Array.isArray(r.choices))for(const c of r.choices)if(!UPGRADE_RARITIES.some(t=>t.id===c.rarity)){c.legacy=true;c.rarity=c.rarity==='epic'?'red':c.rarity==='new'?'green':'blue';}
  if(validRun(r)&&((slot==='tournamentRun')===(r.mode==='tournament'))){groupSections(r);s[slot]=r;}
 }
 syncChests(s,now);return s;
}
