import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS} from '../data.mjs';
import {WEAPON_POSES,WeaponPosePlayer,poseAsset,muzzlePoint} from '../player-poses.mjs';
const run=ids=>({time:1,weapons:ids.map(id=>({id})),events:[]});
test('every weapon has its own four-frame action and a finite hand/muzzle anchor',()=>{
 assert.deepEqual(Object.keys(WEAPON_POSES).sort(),WEAPONS.map(w=>w.id).sort());
 assert.equal(new Set(Object.values(WEAPON_POSES).map(x=>x.action)).size,WEAPONS.length);
 for(const w of WEAPONS){assert.ok(WEAPON_POSES[w.id].duration>0);const p=muzzlePoint({heroX:240,heroY:650},w.id,.75);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.y<650);assert.equal(poseAsset(w.id,3),`rear-${w.id}-3`);}
});
test('an individual shot advances all four frames and settles without replaying a paused event',()=>{
 const p=new WeaponPosePlayer(),r=run(['gas']);r.events=[{type:'fire',weapon:'gas'}];
 assert.equal(p.update(r).frame,0);r.events=[];
 for(const frame of [1,2,3]){r.time=1+WEAPON_POSES.gas.duration*(frame+.1)/4;assert.equal(p.update(r).frame,frame);}
 const before=JSON.stringify(p.update(r));for(let i=0;i<8;i++)assert.equal(JSON.stringify(p.update(r)),before);
 r.time=2;assert.equal(p.update(r).active,false);assert.equal(p.update(r).frame,0);
});
test('simultaneous fire shows the rarer weapon and coalesces repeated coin events',()=>{
 const p=new WeaponPosePlayer(),r=run(['coin','laser']);r.events=[{type:'fire',weapon:'coin'},{type:'fire',weapon:'laser'}];assert.equal(p.update(r).weapon,'laser');
 for(let i=1;i<5;i++){r.time=1+i*.05;r.events=[{type:'fire',weapon:'coin'}];assert.equal(p.update(r).weapon,'laser');}
 r.time=1.6;r.events=[];assert.equal(p.update(r).weapon,'coin');assert.equal(p.pending.size,0);
});
test('run changes and removed weapons cannot keep another run\'s queued animation',()=>{
 const p=new WeaponPosePlayer(),r=run(['dragon']);r.events=[{type:'fire',weapon:'dragon'}];p.update(r);
 const next=run(['coin']);assert.equal(p.update(next).weapon,'coin');assert.equal(p.pending.size,0);
 next.events=[{type:'fire',weapon:'dragon'}];next.time++;assert.equal(p.update(next).weapon,'coin');
});
