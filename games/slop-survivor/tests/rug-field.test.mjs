import test from 'node:test';
import assert from 'node:assert/strict';
import {rugBounds,rugTouches,rugSlowAmount,snakeSlowFactor} from '../rug-field.mjs';
import {defaultSave,normalizeSave,validRun,LEVELS,DIFFICULTIES} from '../data.mjs';
import {createRun,chooseBoon,makeWeapon,fire,tick} from '../engine.mjs';
import {updatePositions,sectionVisible} from '../snake.mjs';
import {upgradeCombat,actionSpeed} from '../action-combat.mjs';

const carpet=(extra={})=>({type:'field',weapon:'rug',x:200,y:250,r:100,slow:.2,life:2,max:2.7,...extra});
const segment=(x,y,extra={})=>({hp:100,head:false,points:[{x,y}],...extra});
function ready(){
 const save=defaultSave(0);for(let i=0;i<4;i++)save.clears[`${i}:easy`]=true;
 const r=createRun(save,4,'easy',77);chooseBoon(r,'damage');r.state='playing';r.pending=0;r.choices=[];r.lastChoice=1e6;r.manual=false;r.boons=['frenzy100'];
 r.weapons=[makeWeapon('rug')];for(const n of r.snakes)n.distance=600+n.id*180;updatePositions(r);
 return {save,r};
}

test('rug contact uses the rendered rectangle, snake thickness and visible unrolled portion',()=>{
 const rug=carpet(),b=rugBounds(rug);
 assert.equal(b.right-b.left,180);assert.ok(Math.abs(b.bottom-b.top-112)<1e-8);
 assert.ok(rugTouches(rug,segment(200,250)));
 assert.ok(rugTouches(rug,segment(b.right+9,250)),'body edge touches the carpet');
 assert.equal(rugTouches(rug,segment(b.right+11,250)),false);
 assert.equal(rugTouches(rug,segment(200,b.bottom+11)),false,'old circular field must not slow outside carpet');
 assert.equal(rugTouches(rug,segment(b.right+8,b.bottom+8)),false,'outside the rounded body contact at corner');
 assert.equal(rugTouches(rug,segment(200,250,{hp:0})),false);
 const rolling=carpet({life:2.54});assert.ok(rugTouches(rolling,segment(130,250)));assert.equal(rugTouches(rolling,segment(270,250)),false);
 assert.equal(rugTouches(carpet({life:2.7}),segment(130,250)),false);
 assert.equal(rugTouches(carpet({life:0}),segment(200,250)),false);
});

test('any living body point can slow its snake, but the effect ends off the rug',()=>{
 const r={effects:[carpet()],weapons:[],time:1,slowUntil:0,slowAmount:0};
 const head=segment(400,400,{head:true}),body=segment(200,250);
 assert.equal(snakeSlowFactor(r,[head,body]),.8);assert.equal(snakeSlowFactor(r,[head]),1);
 body.points=[{x:400,y:400}];assert.equal(snakeSlowFactor(r,[head,body]),1);
});

test('overlapping and upgraded rugs use the strongest local slow without stacking Market Crash',()=>{
 const r={effects:[carpet(),carpet({slow:.4})],weapons:[],time:1,slowUntil:0,slowAmount:0},body=[segment(200,250)];
 assert.equal(snakeSlowFactor(r,body),.6);
 r.slowUntil=4;r.slowAmount=.7;assert.ok(Math.abs(snakeSlowFactor(r,body)-.3)<1e-9);
 r.slowUntil=0;assert.equal(snakeSlowFactor(r,body),.6);
 r.effects[1].life=0;assert.equal(snakeSlowFactor(r,body),.8);
 r.effects[0].life=0;assert.equal(snakeSlowFactor(r,body),1);
});

test('rug casts no longer create a global slow, including when aimed at empty floor',()=>{
 const {r}=ready();r.aimX=240;r.aimY=545;
 fire(r,r.weapons[0],r.segments.find(sectionVisible));
 assert.equal(r.slowUntil,0);assert.equal(r.slowAmount,0);
 assert.ok(r.effects.some(e=>e.weapon==='rug'&&e.slow===.2));
});

test('four-snake simulation slows only the touching snake and restores full speed on exit',()=>{
 const {r}=ready(),body=r.segments.filter(s=>s.snakeId===0),others=r.segments.filter(s=>s.snakeId!==0);
 const point=body.flatMap(s=>s.points).find(p=>p.y>90&&p.y<520&&!others.some(s=>rugTouches(carpet({x:p.x,y:p.y,r:12}),s)));
 assert.ok(point);r.effects=[carpet({x:point.x,y:point.y,r:12})];
 assert.equal(rugSlowAmount(r,body),.2);assert.equal(rugSlowAmount(r,others),0);
 const before=r.snakes.map(n=>n.distance);tick(r,.05);
 for(const n of r.snakes)assert.ok(Math.abs(n.distance-before[n.id]-.05*actionSpeed(r)*n.speed*(n.id===0?.8:1))<1e-8);
 r.effects[0].x=-1000;const onExit=r.snakes.map(n=>n.distance);tick(r,.05);
 for(const n of r.snakes)assert.ok(Math.abs(n.distance-onExit[n.id]-.05*actionSpeed(r)*n.speed)<1e-8);
});

test('local rug effects pause and survive save/resume, including legendary carpets',()=>{
 const {r,save}=ready();r.weapons[0].legendary=true;const target=r.segments.find(sectionVisible);r.aimX=target.x;r.aimY=target.y;
 fire(r,r.weapons[0],target);assert.ok(r.effects.some(e=>e.style==='rug'));tick(r,.05);
 r.state='paused';const before=JSON.stringify(r);tick(r,.05);assert.equal(JSON.stringify(r),before);
 save.run=r;const resumed=normalizeSave(save,0).run;assert.ok(resumed);assert.ok(validRun(resumed));
 resumed.state=r.state='playing';for(let i=0;i<65;i++){tick(r,.05);tick(resumed,.05);}assert.deepEqual(resumed,r);
 const bad=structuredClone(r);bad.effects.push(carpet({slow:NaN}));assert.equal(validRun(bad),false);
});

test('previous rug globals are removed on resume while Market Crash remains active',()=>{
 for(const amount of [.2,.6,.7]){
  const {r}=ready();r.effects=[carpet()];r.slowUntil=2.7;r.slowAmount=amount;
  upgradeCombat(r,LEVELS[r.chapter],DIFFICULTIES[0]);assert.equal(r.slowUntil,amount===.7?2.7:0);
 }
});
