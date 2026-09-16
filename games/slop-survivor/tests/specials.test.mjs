import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSave,normalizeSave,validRun,SPECIALS,SPECIAL_RANKS,specialRankCost,specialUnlocked,buySpecial,equipSpecial} from '../data.mjs';
import {createRun,createTournamentRun,chooseBoon,tick,ultimate,makeWeapon} from '../engine.mjs';
import {updatePositions,sectionVisible} from '../snake.mjs';

function cleared(n){const s=defaultSave(0);for(let i=0;i<n;i++)s.clears[`${i}:easy`]=true;return s;}
function armed(save,extra=[]){const r=createRun(save,0,'easy',5);chooseBoon(r,'damage');r.pending=0;r.choices=[];r.state='playing';r.headDistance=640;r.weapons=[makeWeapon('coin'),...extra.map(id=>makeWeapon(id))];for(const w of r.weapons)w.crit=0;r.segments.forEach(s=>{s.spacing=32;s.hp=s.maxHp=1e7;s.armor=false;});updatePositions(r);r.charge=100;return r;}

test('specials unlock by Easy clears, cost their rank price, and the first purchase equips itself',()=>{
 const s=cleared(2);s.coins=1e6;assert.equal(specialUnlocked(s,'crash'),false);assert.equal(buySpecial(s,'crash'),false);
 s.clears['2:easy']=true;assert.ok(specialUnlocked(s,'crash'));assert.equal(buySpecial(s,'crash'),true);assert.equal(s.coins,1e6-900);assert.equal(s.specials.equipped,'crash');assert.equal(s.specials.owned.crash,1);
 assert.equal(specialRankCost('crash',2),1440);assert.ok(buySpecial(s,'crash'));assert.ok(buySpecial(s,'crash'));assert.equal(buySpecial(s,'crash'),false,'rank 3 is the cap');
 assert.equal(buySpecial(s,'wave'),false,'level 12 not cleared');assert.equal(equipSpecial(s,'wave'),false,'cannot equip an unowned special');
 const poor=cleared(3);poor.coins=899;assert.equal(buySpecial(poor,'crash'),false);assert.equal(poor.coins,899);
});

test('saves sanitise specials and a pre-specials save that cleared level 3 keeps Market Crash',()=>{
 assert.deepEqual(defaultSave(0).specials,{owned:{},equipped:null});
 const fresh=normalizeSave({version:2},0);assert.equal(fresh.specials.equipped,null);
 const legacy=normalizeSave({version:2,clears:{'0:easy':true,'1:easy':true,'2:easy':true}},0);assert.equal(legacy.specials.owned.crash,1);assert.equal(legacy.specials.equipped,'crash');
 const junk=normalizeSave({version:2,specials:{owned:{crash:9,bogus:2},equipped:'bogus'}},0);assert.equal(junk.specials.owned.crash,3);assert.equal(junk.specials.owned.bogus,undefined);assert.equal(junk.specials.equipped,'crash');
 const none=normalizeSave({version:2,specials:{owned:{},equipped:'crash'}},0);assert.equal(none.specials.equipped,null);
});

test('without an equipped special there is nothing to fire; the tournament keeps its free Market Crash',()=>{
 const r=armed(cleared(5));assert.equal(r.special,null);assert.equal(ultimate(r),false);assert.equal(r.charge,100);
 const t=createTournamentRun(cleared(0),3);chooseBoon(t,'damage');t.pending=0;t.choices=[];t.state='playing';t.charge=100;const hp=t.segments[0].hp;assert.ok(ultimate(t));assert.ok(t.segments[0].hp<hp);
});

test('Market Crash hits every visible section for 12x the best hit and rank 3 raises it to 18x',()=>{
 const s=cleared(3);s.coins=1e6;buySpecial(s,'crash');
 const r=armed(s,['whale']);const best=r.weapons[1].damage,shown=r.segments.filter(sectionVisible);assert.ok(shown.length>0);assert.ok(ultimate(r));
 for(const seg of shown)assert.ok(Math.abs((1e7-seg.hp)-best*12)<1e-6,'12x best hit');for(const seg of r.segments.filter(x=>!sectionVisible(x)))assert.equal(seg.hp,1e7,'off-board sections untouched');
 assert.ok(r.slowUntil>r.time&&r.slowAmount===.7);assert.equal(r.charge,0);assert.ok(r.events.some(e=>e.type==='ultimate'&&e.special==='crash'));assert.ok(validRun(r));
 buySpecial(s,'crash');buySpecial(s,'crash');const r3=armed(s,['whale']);assert.equal(r3.specialRank,3);ultimate(r3);const first=r3.segments.filter(sectionVisible)[0];assert.ok(Math.abs((1e7-first.hp)-best*12*SPECIAL_RANKS[2].damage)<1e-6);
});

test('Liquidation Wave sweeps down the arena, hits each section once, and pushes the snake back',()=>{
 const s=cleared(12);s.coins=1e6;buySpecial(s,'wave');equipSpecial(s,'wave');
 const r=armed(s);const before=r.headDistance;assert.ok(ultimate(r));assert.equal(r.headDistance,before-200);
 const sweep=r.effects.find(e=>e.type==='sweep');assert.ok(sweep);assert.ok(validRun(r));
 for(let i=0;i<40;i++){r.weapons[0].timer=10;tick(r,.05);}
 const hitOnce=r.segments.filter(seg=>Math.abs((1e7-seg.hp)-r.weapons[0].damage*6)<1e-6).length;assert.ok(hitOnce>=1,'sections crossed by the wall took exactly one 6x hit');
 assert.ok(r.segments.every(seg=>1e7-seg.hp<=r.weapons[0].damage*6+1e-6),'no section was hit twice by the wall');
});

test('The Halving takes 15% of current health capped at 8x the best hit, and Hard Fork Bomb spawns two fragments per section',()=>{
 const s=cleared(40);s.coins=1e6;buySpecial(s,'halving');equipSpecial(s,'halving');
 const r=armed(s);const shown=r.segments.filter(sectionVisible);assert.ok(shown.length>=2);shown[0].hp=100;assert.ok(ultimate(r));assert.ok(Math.abs(shown[0].hp-85)<1e-6,'15% of a small section');assert.ok(Math.abs((1e7-shown[1].hp)-r.weapons[0].damage*8)<1e-6,'cap on a huge section');
 buySpecial(s,'forkbomb');equipSpecial(s,'forkbomb');const f=armed(s);const n=f.segments.filter(sectionVisible).length;assert.ok(ultimate(f));
 assert.equal(f.bullets.filter(b=>b.type==='fragment').length,Math.min(240,n*Math.min(2,n-1)));assert.ok(validRun(f));
});

test('special run state is validated',()=>{
 const s=cleared(3);s.coins=1e6;buySpecial(s,'crash');const r=armed(s);assert.ok(validRun(r));
 r.specialRank=4;assert.equal(validRun(r),false);r.specialRank=1;r.special='nonsense';assert.equal(validRun(r),false);r.special=null;assert.ok(validRun(r));
 r.effects.push({type:'sweep',y:NaN,speed:900,amount:1,hits:[],life:1,max:1});assert.equal(validRun(r),false);
});
