import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio} from '../js/audio.mjs';
import {SOUND_BANK} from '../js/sound-bank.mjs';

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
