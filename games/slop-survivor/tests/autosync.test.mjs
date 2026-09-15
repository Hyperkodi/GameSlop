import test from 'node:test';import assert from 'node:assert/strict';import {AutoSync} from '../autosync.mjs';
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(local,cloud){let current=clone(local),remote=clone(cloud),writes=[],restores=0;
 const storage={async load(){return clone(remote);},async save(v){writes.push(clone(v));remote={savedAt:Date.now(),save:clone(v)};}};
 const sync=new AutoSync({storage,read:()=>current,restore:v=>{current=v;restores++;},delay:60000,retryDelay:60000});
 return {sync,storage,writes,get local(){return current;},get restores(){return restores;},change(v){current=clone(v);sync.changed();}};
}
test('fresh launch restores Telegram progress automatically before any writes',async()=>{
 const f=fixture({updatedAt:0,coins:240},{savedAt:200,save:{updatedAt:100,coins:900,run:{state:'choice'}}});
 try{await f.sync.start();assert.equal(f.local.coins,900);assert.equal(f.local.run.state,'choice');assert.equal(f.restores,1);assert.equal(f.writes.length,0);}finally{f.sync.stop();}
});
test('newer offline progress wins over an older cloud snapshot',async()=>{
 const f=fixture({updatedAt:300,coins:700},{savedAt:200,save:{updatedAt:200,coins:100}});
 try{await f.sync.start();assert.equal(f.restores,0);assert.equal(f.writes[0].coins,700);}finally{f.sync.stop();}
});
test('failed initial load never overwrites cloud; retry restores it',async()=>{
 const f=fixture({updatedAt:0,coins:240},{savedAt:100,save:{coins:999}}),load=f.storage.load;let fail=true;
 f.storage.load=()=>fail?Promise.reject(new Error('offline')):load();
 try{await f.sync.start();assert.equal(f.writes.length,0);assert.equal(f.sync.ready,false);fail=false;await f.sync.flush();assert.equal(f.local.coins,999);assert.equal(f.writes.length,0);}finally{f.sync.stop();}
});
test('actions taken while loading cannot be rolled back by a delayed response',async()=>{
 const f=fixture({updatedAt:1,coins:240},null);let resolve;
 f.storage.load=()=>new Promise(r=>resolve=r);
 try{const start=f.sync.start();f.change({updatedAt:300,coins:777});resolve({savedAt:200,save:{updatedAt:200,coins:100}});await start;assert.equal(f.restores,0);assert.equal(f.writes[0].coins,777);}finally{f.sync.stop();}
});
test('writes coalesce without overlap; changes made during a write are saved next',async()=>{
 const f=fixture({updatedAt:1,coins:240},null);await f.sync.start();f.writes.length=0;let resolve;
 f.storage.save=v=>{f.writes.push(clone(v));return new Promise(r=>resolve=r);};
 try{f.change({updatedAt:2,coins:400});f.change({updatedAt:3,coins:600});const pending=f.sync.flush();
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].coins,600);f.change({updatedAt:4,coins:800});await f.sync.flush();assert.equal(f.writes.length,1);resolve();await pending;
  f.storage.save=async v=>f.writes.push(clone(v));await f.sync.flush();assert.equal(f.writes.length,2);assert.equal(f.writes[1].coins,800);
 }finally{f.sync.stop();}
});
test('write failures retain local progress and retry the most recent snapshot',async()=>{
 const f=fixture({updatedAt:1,coins:240},null);await f.sync.start();const write=f.storage.save;let fail=true;
 f.storage.save=v=>fail?Promise.reject(new Error('offline')):write(v);
 try{f.change({updatedAt:2,coins:500});await f.sync.flush();assert.equal(f.local.coins,500);assert.equal(f.sync.dirty,true);f.change({updatedAt:3,coins:600});fail=false;await f.sync.flush();assert.equal(f.writes.at(-1).coins,600);assert.equal(f.sync.dirty,false);}finally{f.sync.stop();}
});
test('a fresh device migrates v1 cloud progress, but an existing v2 save rejects it',async()=>{
 for(const hasLocalSave of [false,true]){let local={version:2,updatedAt:1,coins:240},restores=0;const sync=new AutoSync({hasLocalSave,storage:{load:async()=>({savedAt:200,save:{version:1,updatedAt:200,coins:999}}),save:async()=>{}},read:()=>local,restore:s=>{local={...s,version:2};restores++;}});try{await sync.start();assert.equal(restores,hasLocalSave?0:1);assert.equal(local.coins,hasLocalSave?240:999);}finally{sync.stop();}}
});
