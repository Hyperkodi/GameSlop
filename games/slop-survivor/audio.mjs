// Original synthesized audio. No third-party sound library or remote requests.
export class Sound {
 constructor(settings){this.settings=settings;this.ctx=null;this.last={};this.beat=0;this.next=0;this.musicNodes=[];}
 async unlock(){if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.5;this.comp=this.ctx.createDynamicsCompressor();this.master.connect(this.comp);this.comp.connect(this.ctx.destination);}if(this.ctx.state==='suspended')await this.ctx.resume();}
 tone(freq,duration,volume,type='sine',slide=0,music=false){if(!this.ctx||this.ctx.state!=='running')return;const amount=volume*(music?this.settings.music:this.settings.sfx);if(amount<=0)return;const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),now+duration);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(amount,now+.006);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(this.master);o.start();o.stop(now+duration+.02);if(music)this.musicNodes.push(o);o.onended=()=>{o.disconnect();g.disconnect();this.musicNodes=this.musicNodes.filter(n=>n!==o);};}
 event(type,id){if(!this.ctx)return;const now=this.ctx.currentTime,key=type==='fire'?'fire':type;if(now-(this.last[key]??-10)<(type==='fire'?.13:.06))return;this.last[key]=now;
  if(type==='fire')this.tone(id==='laser'?320:id==='gas'?100:190,.06,.10,'triangle',70);
  if(type==='kill')this.tone(440,.06,.05,'sine',250);
  if(type==='chest'||type==='upgrade'){this.tone(659,.20,.22,'sine');this.tone(988,.35,.12,'triangle');}
  if(type==='breach'||type==='lost')this.tone(90,.5,.28,'triangle',35);
  if(type==='ultimate'||type==='impact')this.tone(150,.5,.23,'triangle',40);
  if(type==='won'){[392,494,587,784].forEach((f,i)=>setTimeout(()=>this.tone(f,.65,.18,'triangle'),i*130));}
 }
 update(playing){if(!this.ctx)return;const now=this.ctx.currentTime;if(!playing){this.next=now;return;}if(now<this.next)return;this.next=now+.24;const bass=[98,98,130.81,116.54],mel=[392,0,587,494,0,440,0,349,392,0,523,587,0,494,440,0];if(this.beat%4===0)this.tone(bass[Math.floor(this.beat/16)%4],.35,.16,'triangle',0,true);if(mel[this.beat%16])this.tone(mel[this.beat%16],.15,.075,'triangle',0,true);if(this.beat%4===2)this.tone(110,.055,.06,'sine',40,true);this.beat++;}
 pause(){this.musicNodes.forEach(o=>{try{o.stop();}catch{}});this.musicNodes=[];}
}
