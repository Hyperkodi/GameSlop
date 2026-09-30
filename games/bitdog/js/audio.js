(function(root){
 'use strict';
 const names=['paw-grass','paw-wood','land','jump','roll','boost','bump-a','bump-b','smash','coin','fetch','splash','water','tag','throw','star','win','timeout','ambient','intro-gallop-v3','spring','leaves','electric','wire-hum','zap','paw-stone','intro-gallop-electric','mushroom','snowgrow','snowshed','snowbreak','umbrella','gust','gravity','paw-snow','paw-moon','intro-gallop-snow','intro-gallop-wood','intro-gallop-moon','snow-roll','umbrella-wind'];
 root.BitDogAudio={create(){
  let context,master,musicGain,effectsGain,loading,muted=false,paused=false,mode='ready',step=0,jingle=0;
  const buffers=new Map(),failed=[],loops=new Map(),voices=new Set(),lastPlayed=new Map();
  const music=new Audio('audio/funky-chunk.mp3');music.loop=true;music.preload='none';
  function init(){
   if(context)return;const AudioContext=root.AudioContext||root.webkitAudioContext;if(!AudioContext)return;
   context=new AudioContext();master=context.createGain();master.connect(context.destination);master.gain.value=muted?0:1;
   musicGain=context.createGain();musicGain.gain.value=.16;musicGain.connect(master);context.createMediaElementSource(music).connect(musicGain);
   effectsGain=context.createGain();effectsGain.gain.value=.65;effectsGain.connect(master);
   loading=Promise.all(names.map(async name=>{try{const response=await fetch('audio/'+(name==='throw'?'throw-v3':name)+'.mp3');if(!response.ok)throw Error('HTTP');buffers.set(name,await context.decodeAudioData(await response.arrayBuffer()));}catch{failed.push(name);}}));
  }
  function sync(){
   if(!context)return;master.gain.setTargetAtTime(muted?0:1,context.currentTime,.03);
   musicGain.gain.setTargetAtTime(mode==='return'?.23:mode==='opening'?.10:mode==='won'||mode==='lost'?.08:.16,context.currentTime,.35);
   if(paused||muted||mode==='ready')music.pause();else if(music.paused)music.play().catch(()=>{});
   if(paused){context.suspend().catch(()=>{});}else if(context.state==='suspended')context.resume().catch(()=>{});
  }
  function unlock(){init();if(context?.state==='suspended')context.resume().catch(()=>{});sync();return loading;}
  function play(type,volume=1){
   if(!context||muted||paused||context.state!=='running')return;
   let name=type==='bump'?(Math.random()<.5?'bump-a':'bump-b'):type==='start'?'tag':type==='exhausted'?'timeout':type==='umbrellaFold'?'umbrella':type;
   if(type==='umbrellaFold')volume*=.45;
   const buffer=buffers.get(name);if(!buffer)return;
   const now=context.currentTime,cooldown=name==='coin'?.055:.06;
   if(now-(lastPlayed.get(name)??-10)<cooldown||voices.size>=12)return;lastPlayed.set(name,now);
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume*(name==='throw'?.55:1);
   if(['paw-grass','paw-wood','bump-a','bump-b','tag'].includes(name))source.playbackRate.value=.94+Math.random()*.12;
   source.connect(gain);gain.connect(effectsGain);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  function loop(name,enabled,volume,rate=1){
   const current=loops.get(name);
   if(!enabled){if(current){current.gain.gain.setTargetAtTime(0,context.currentTime,.025);current.source.stop(context.currentTime+.12);loops.delete(name);}return;}
   if(!context||!buffers.has(name))return;
   if(current){current.gain.gain.setTargetAtTime(volume,context.currentTime,.07);current.source.playbackRate.value=rate;return;}
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);source.loop=true;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(effectsGain);source.onended=()=>{source.disconnect();gain.disconnect();};source.start();loops.set(name,{source,gain});
  }
  function update(s,active,dt){
   if(!context)return;const d=s.dog,moving=active&&d.grounded&&Math.abs(d.vx)>50;
   loop('ambient',active&&s.level?.id!==7,.09);loop('water',moving&&d.wet,.26);loop('roll',moving&&d.rolling&&!d.wet&&!d.snowball,.19,Math.min(1.3,.7+Math.abs(d.vx)/1500));
   loop('snow-roll',moving&&d.snowball>0,.15);loop('umbrella-wind',active&&d.gliding,.13);
   loop('wire-hum',active&&d.electricTimer>0,.12);
   if(moving&&!d.rolling&&!d.wet&&d.electricTimer<=0){step+=dt;const interval=Math.max(.12,85/Math.abs(d.vx));if(step>interval){step=0;play(s.level?.id===5?'paw-snow':s.level?.id===7?'paw-moon':s.level?.id===3?'paw-stone':s.level?.id===6||d.platform?'paw-wood':'paw-grass',.26);jingle++;if(jingle%11===0)play('tag',.12);}}else step=0;
  }
  return {unlock,play,update,introGallop(levelId){play(levelId===3?'intro-gallop-electric':levelId===5?'intro-gallop-snow':levelId===6?'intro-gallop-wood':levelId===7?'intro-gallop-moon':'intro-gallop-v3',.65);},setTrack(file){music.pause();music.src='audio/'+file;music.load();sync();},stopEffects(){for(const source of voices)source.stop();voices.clear();lastPlayed.clear();for(const name of [...loops.keys()])loop(name,false,0);},setMuted(value){muted=value;sync();},setMode(value,isPaused=false){if(mode===value&&paused===isPaused)return;mode=value;paused=isPaused;sync();},
   get ready(){return buffers.size===names.length;},get status(){return {loaded:buffers.size,failed:[...failed],mode,paused,muted,musicReady:music.readyState>=2,context:context?.state};}};
 }};
})(window);
