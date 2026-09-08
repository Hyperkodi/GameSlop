import test from 'node:test';
import assert from 'node:assert/strict';
import {Music} from '../js/music.mjs';

function audio(){
  const sources=[],param=()=>({value:.18,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}});
  const ctx={state:'running',currentTime:10,destination:{},
    decodeAudioData:async data=>({duration:60,id:data}),
    createGain:()=>({gain:param(),connect(){},disconnect(){}}),
    createBufferSource:()=>{const s={connect(){},disconnect(){},start(...args){s.args=args;},stop(){s.stopped=true;}};sources.push(s);return s;}};
  return {ctx,muted:false,sources};
}
const response=url=>({ok:true,arrayBuffer:async()=>String(url)});

test('music loads lazily, loops separately, and preserves position across pause and mute',async t=>{
  const requests=[];t.mock.method(globalThis,'fetch',async url=>{requests.push(String(url));return response(url);});
  const a=audio(),m=new Music(a);m.sync(0,false);await m.loading.promise;
  assert.equal(requests.length,1);assert.equal(a.sources.length,0);
  m.sync(0,true);const first=m.source;assert.equal(first.loop,true);assert.equal(first.loopEnd,60);
  m.sync(0,true);assert.equal(a.sources.length,1);
  a.ctx.currentTime=14;m.sync(0,false);assert.ok(first.stopped);assert.equal(m.offset,4);
  a.ctx.currentTime=22;m.sync(0,true);assert.equal(m.source.args[1],4);
  a.ctx.currentTime=23;a.muted=true;m.sync(0,true);assert.equal(m.source,null);assert.equal(m.offset,5);
  a.muted=false;m.sync(0,true);assert.equal(m.source.args[1],5);
  m.reset();assert.equal(m.source,null);assert.equal(m.stage,null);
});

test('all stages switch to their own tracks, with only two decoded tracks retained',async t=>{
  t.mock.method(globalThis,'fetch',async url=>response(url));const a=audio(),m=new Music(a);
  for(let stage=0;stage<10;stage++){
    const old=m.source;m.sync(stage,true);await m.loading.promise;
    assert.equal(m.stage,stage);assert.ok(m.source.buffer.id.includes('music-'));assert.equal(m.offset,0);
    assert.ok(m.buffers.size<=2);if(old)assert.ok(old.stopped);
  }
  m.sync(null,false);assert.equal(m.source,null);assert.equal(m.retiring.size,0);
});

test('unsupported Ogg falls back to MP3 and total failure leaves gameplay audio optional',async t=>{
  const requests=[];t.mock.method(globalThis,'fetch',async url=>{requests.push(String(url));return response(url);});
  const a=audio(),m=new Music(a);
  a.ctx.decodeAudioData=async id=>{if(id.endsWith('.ogg'))throw Error('unsupported');return {id,duration:60};};
  m.sync(1,true);await m.loading.promise;assert.equal(requests.length,2);assert.ok(m.source.buffer.id.endsWith('.mp3'));m.reset();
  t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});m.sync(4,true);await m.loading.promise;
  assert.equal(m.source,null);assert.ok(m.failed.has(4));m.sync(4,true);assert.equal(m.loading,null);m.reset();
});

test('a late download cannot start music after pause, restart, or a different stage',async t=>{
  let resolve;t.mock.method(globalThis,'fetch',url=>new Promise(r=>{resolve=()=>r(response(url));}));
  const a=audio(),m=new Music(a);m.sync(0,true);const job=m.loading.promise;m.pause();resolve();await job;assert.equal(m.source,null);
  m.sync(1,true);const old=m.loading.promise;const resolveOld=resolve;m.reset();resolveOld();await old;assert.equal(m.source,null);assert.equal(m.stage,null);
  m.sync(2,true);const pending=m.loading.promise;const resolveStale=resolve;m.sync(3,true);const current=m.loading.promise;
  resolveStale();await pending;assert.equal(m.source,null);resolve();await current;assert.equal(m.stage,3);assert.equal(m.source.buffer.id.includes('sunset-strip'),true);m.reset();
});
