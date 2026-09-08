import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio} from '../js/audio.mjs';
import {SOUND_BANK} from '../js/sound-bank.mjs';
import {createRun,step} from '../js/model.mjs';

test('each captured character plays its own recording once at natural pitch',()=>{
  const s=createRun(),audio=new Audio();audio.ctx=context();s.power=100;
  for(const id of Object.keys(SOUND_BANK))audio.buffers.set(id,{buffer:{id},offset:0});
  for(const g of s.ghosts)Object.assign(g,{x:11,y:17,tx:11,ty:17,progress:0,moving:false,wait:0});
  step(s,4);
  const captures=s.events.filter(e=>e.type==='ghost');
  assert.deepEqual(captures.map(e=>e.character),['rook','hex','ivy','riot']);
  captures.forEach(e=>audio.event(e));
  assert.deepEqual(audio.ctx.sources.map(s=>SOUND_BANK[s.buffer.id].file),['assets/Blue.mp3','assets/Purple.mp3','assets/Green.mp3','assets/Rainbow.mp3']);
  assert.ok(audio.ctx.sources.every(s=>s.playbackRate.value===1));
  captures.forEach(e=>audio.event(e));assert.equal(audio.ctx.sources.length,4);
  step(s,4);assert.equal(s.events.filter(e=>e.type==='ghost').length,0);
  audio.muted=true;assert.ok(audio.ctx.sources.every(s=>s.stopped));audio.reset();
});

test('missing character recording uses the generic capture cue',()=>{
  const audio=new Audio();audio.ctx=context();audio.buffers.set('ghost',{buffer:{id:'ghost'},offset:0});
  audio.event({type:'ghost',character:'hex',points:400});
  assert.equal(audio.ctx.sources[0].buffer.id,'ghost');audio.stop();
});

test('losing a life plays Chad recording without changing its pitch',()=>{
  const s=createRun(),audio=new Audio();audio.ctx=context();s.invulnerable=0;
  audio.buffers.set('hit',{buffer:{id:'hit'},offset:0});
  Object.assign(s.ghosts[0],{x:11,y:17,tx:11,ty:17,progress:0,moving:false,wait:0});
  step(s,4);const hit=s.events.find(e=>e.type==='hit');assert.ok(hit);audio.event(hit);
  assert.equal(SOUND_BANK[audio.ctx.sources[0].buffer.id].file,'assets/Chad.mp3');
  assert.equal(audio.ctx.sources[0].playbackRate.value,1);audio.stop();
});

function context(){
  const sources=[];
  const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const source=()=>{const s={playbackRate:param(),frequency:param(),connect(){},disconnect(){},start(...args){s.started=args;},stop(){s.stopped=true;}};sources.push(s);return s;};
  return {sources,currentTime:10,state:'running',destination:{},createBufferSource:source,createOscillator:source,createGain:()=>({gain:param(),connect(){},disconnect(){}})};
}

test('sample routing, repeat limits, mute, restart and voice limits',()=>{
  const saved={...SOUND_BANK};
  try{
    for(const id of ['pellet','dash','decoy','ghost'])SOUND_BANK[id]={file:`assets/sfx-${id}.mp3`,volume:.2,cooldown:id==='pellet'?.12:0};
    const audio=new Audio();audio.ctx=context();
    for(const id of ['pellet','dash','decoy','ghost'])audio.buffers.set(id,{buffer:{id},offset:.04});
    audio.event({type:'ability'},'decoy');assert.equal(audio.ctx.sources.at(-1).buffer.id,'decoy');
    audio.event({type:'ability'},'dash');assert.equal(audio.ctx.sources.at(-1).buffer.id,'dash');
    audio.event({type:'pellet',tick:500});const count=audio.ctx.sources.length;
    assert.equal(audio.ctx.sources.at(-1).started[1],.04);
    audio.event({type:'pellet',tick:501});assert.equal(audio.ctx.sources.length,count);
    audio.muted=true;assert.ok(audio.ctx.sources.every(s=>s.stopped));
    audio.event({type:'ghost'});assert.equal(audio.ctx.sources.length,count);
    audio.muted=false;audio.reset();audio.event({type:'pellet',tick:1});assert.equal(audio.ctx.sources.length,count+1);
    for(let i=0;i<20;i++)audio.event({type:'ghost'});
    assert.ok(audio.active.size<=8);audio.stop();assert.equal(audio.active.size,0);
  }finally{for(const id of Object.keys(SOUND_BANK))delete SOUND_BANK[id];Object.assign(SOUND_BANK,saved);}
});

test('missing audio falls back immediately; loading failure cannot break play',async()=>{
  const saved={...SOUND_BANK},fetchBefore=globalThis.fetch;
  try{
    for(const id of Object.keys(SOUND_BANK))delete SOUND_BANK[id];
    SOUND_BANK.hit={file:'assets/sfx-hit.mp3',volume:.2,cooldown:0};
    globalThis.fetch=async()=>{throw Error('offline');};
    const audio=new Audio();audio.ctx=context();await audio.load();assert.ok(audio.failed.has('hit'));
    audio.event({type:'hit'});assert.equal(audio.ctx.sources.length,2);
    audio.ctx.state='suspended';audio.event({type:'hit'});assert.equal(audio.ctx.sources.length,2);
    audio.stop();
  }finally{globalThis.fetch=fetchBefore;for(const id of Object.keys(SOUND_BANK))delete SOUND_BANK[id];Object.assign(SOUND_BANK,saved);}
});

test('special pickup, shield impact and expiry route to real sound samples',()=>{
  const audio=new Audio();audio.ctx=context();
  for(const id of ['power','gate','power-end'])audio.buffers.set(id,{buffer:{id},offset:0});
  for(const [type,id] of [['special','power'],['repel','gate'],['special-end','power-end']]){
    audio.event({type});assert.equal(audio.ctx.sources.at(-1).buffer.id,id);
  }
  audio.stop();
});
