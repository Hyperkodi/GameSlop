// Original offline sound design. No APIs, samples, voice models or runtime synthesis needed.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),SR=44100,TAU=Math.PI*2;
const note=m=>440*2**((m-69)/12);
let seed=0x504143;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296*2-1;}
function envelope(t,d,attack=.006,decay=3){
  return Math.min(1,t/attack)*Math.exp(-decay*t/d)*Math.min(1,(d-t)/Math.min(.025,d/4));
}
class Clip {
  constructor(duration){this.data=new Float64Array(Math.ceil(duration*SR));}
  tone(at,duration,f0,f1=f0,amp=.4,flavor='round',decay=3){
    let phase=0;const begin=Math.round(at*SR),length=Math.round(duration*SR);
    for(let i=0;i<length&&begin+i<this.data.length;i++){
      const t=i/SR,u=i/length,f=f0*(f1/f0)**u;phase+=TAU*f/SR;
      let v=Math.sin(phase);
      if(flavor==='bell')v=Math.sin(phase+1.5*Math.exp(-12*u)*Math.sin(phase*2))+.16*Math.sin(phase*3)*Math.exp(-8*u);
      if(flavor==='warm')v+=.25*Math.sin(2*phase)+.09*Math.sin(3*phase);
      if(flavor==='hollow')v=Math.sin(phase+1.4*(1-u)*Math.sin(phase*1.5));
      if(flavor==='grit')v=Math.tanh(1.5*(v+.2*Math.sin(3*phase)))*.8;
      this.data[begin+i]+=v*amp*envelope(t,duration,.004,decay);
    }return this;
  }
  noise(at,duration,amp,low=180,high=1600,shape='decay'){
    let lp=0,slow=0;const a=1-Math.exp(-TAU*high/SR),b=1-Math.exp(-TAU*low/SR),begin=Math.round(at*SR);
    for(let i=0;i<duration*SR&&begin+i<this.data.length;i++){
      const t=i/SR,u=t/duration,n=random();lp+=a*(n-lp);slow+=b*(lp-slow);
      const env=shape==='swell'?Math.sin(Math.PI*u)**1.5:envelope(t,duration,.002,5);
      this.data[begin+i]+=(lp-slow)*amp*env;
    }return this;
  }
  notes(at,notes,spacing=.085,length=.32,amp=.25){
    notes.forEach((m,i)=>this.tone(at+i*spacing,length,note(m),note(m),amp,'bell',4));return this;
  }
  echo(delay=.07,amount=.2){
    const original=this.data.slice(),shift=Math.round(delay*SR);
    for(let i=shift;i<this.data.length;i++)this.data[i]+=original[i-shift]*amount;
    return this;
  }
  finish(){
    // Remove DC, then normalize with generous headroom and smooth file boundaries.
    const mean=this.data.reduce((a,b)=>a+b,0)/this.data.length;
    let peak=0;
    for(let i=0;i<this.data.length;i++){
      this.data[i]=(this.data[i]-mean)*Math.min(1,i/88,(this.data.length-1-i)/220);
      peak=Math.max(peak,Math.abs(this.data[i]));
    }
    const pcm=new Int16Array(this.data.length);let energy=0;
    for(let i=0;i<pcm.length;i++){const v=this.data[i]*.72/(peak||1);pcm[i]=Math.round(v*32767);energy+=v*v;}
    const wav=Buffer.alloc(44+pcm.length*2);
    wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
    wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)wav.writeInt16LE(pcm[i],44+i*2);
    return {wav,pcm,rms:Math.sqrt(energy/pcm.length),peak:.72,duration:pcm.length/SR};
  }
}

// Each cue has its own envelope, timbre and musical gesture; no stock beep reskins.
const pack=[
  {id:'pellet',label:'Chomp',volume:.19,cooldown:.10,clip:new Clip(.115).tone(0,.10,480,145,.5,'hollow',4).tone(.006,.055,980,360,.12,'round').noise(0,.028,.13,250,2100)},
  {id:'power',label:'Power pellet',volume:.43,cooldown:.3,clip:new Clip(1.1).tone(0,.28,95,380,.55,'hollow').tone(.05,.38,240,820,.18,'warm').noise(.02,.25,.25,300,2600,'swell').notes(.18,[72,79,84,86],.095,.42,.22).echo(.09,.18)},
  {id:'ghost',label:'Ghost capture',volume:.38,cooldown:.08,clip:new Clip(.52).tone(0,.12,340,105,.35,'hollow').tone(.04,.22,420,1280,.38,'bell').notes(.09,[79,86],.065,.22,.19).noise(0,.05,.2,300,2300)},
  {id:'dash',label:'Dash',volume:.36,cooldown:.2,clip:new Clip(.40).noise(0,.30,.85,280,3900,'swell').tone(0,.15,180,780,.2,'hollow').tone(.05,.27,1200,270,.16,'round')},
  {id:'decoy',label:'Decoy',volume:.36,cooldown:.2,clip:new Clip(.76).tone(0,.25,190,490,.4,'hollow').tone(.13,.28,490,310,.27,'hollow').notes(.2,[74,81,86],.095,.26,.17).echo(.09,.3)},
  {id:'hit',label:'Lose a life',volume:.43,cooldown:.3,clip:new Clip(.65).tone(0,.16,165,52,.7,'round',4).noise(0,.11,.45,120,2200).tone(.06,.44,245,63,.32,'grit',3).tone(.14,.29,185,80,.13,'hollow')},
  {id:'warning',label:'Enemy charge warning',volume:.25,cooldown:.45,clip:new Clip(.27).tone(0,.09,790,850,.25,'warm').tone(.13,.10,980,1040,.27,'warm')},
  {id:'gate-warning',label:'Shortcut warning',volume:.25,cooldown:.5,clip:new Clip(.49).notes(0,[69,72,76],.125,.17,.3)},
  {id:'gate',label:'Shortcut opens',volume:.35,cooldown:.3,clip:new Clip(.68).noise(0,.065,.45,700,3500).noise(.045,.3,.5,200,1400,'swell').tone(.05,.25,190,440,.24,'hollow').notes(.22,[76,83],.095,.26,.28)},
  {id:'combo',label:'Combo increase',volume:.3,cooldown:.2,clip:new Clip(.48).notes(0,[76,81,88],.07,.25,.36).echo(.06,.15)},
  {id:'stage',label:'Maze clear',volume:.43,cooldown:.5,clip:new Clip(1.48).notes(0,[72,76,79,86,84],.13,.46,.28).tone(.52,.83,note(60),note(60),.2,'warm',3).tone(.52,.78,note(67),note(67),.13,'round',3).noise(.51,.25,.17,1200,4500,'swell').echo(.095,.15)},
  {id:'start',label:'Go!',volume:.36,cooldown:.5,clip:new Clip(.64).notes(0,[67,74,79],.09,.3,.34).tone(.18,.36,note(55),note(55),.2,'warm')},
  {id:'end',label:'Run complete',volume:.39,cooldown:.5,clip:new Clip(1.12).notes(0,[76,72,67,60],.16,.40,.3).tone(.50,.47,180,65,.2,'hollow')},
  {id:'select',label:'Menu select',volume:.22,cooldown:.07,clip:new Clip(.17).tone(0,.11,690,960,.25,'bell').noise(0,.022,.05,400,2500)},
  {id:'countdown',label:'Countdown tick',volume:.27,cooldown:.45,clip:new Clip(.19).tone(0,.15,520,520,.3,'warm',5).tone(0,.075,1040,1040,.10,'round')},
  {id:'pause',label:'Pause',volume:.23,cooldown:.1,clip:new Clip(.28).notes(0,[76,69],.075,.15,.3)},
  {id:'resume',label:'Resume',volume:.23,cooldown:.1,clip:new Clip(.28).notes(0,[69,76],.075,.15,.3)},
  {id:'ready',label:'Ability recharged',volume:.25,cooldown:.5,clip:new Clip(.46).notes(0,[81,88],.08,.28,.25).echo(.06,.16)},
  {id:'power-end',label:'Power wears off',volume:.28,cooldown:.5,clip:new Clip(.48).tone(0,.38,720,180,.3,'hollow').noise(.04,.29,.19,200,2100,'swell')},
  {id:'best',label:'New personal best',volume:.42,cooldown:.5,clip:new Clip(1.62).notes(0,[72,79,76,84,86,91],.13,.48,.3).tone(.66,.8,note(60),note(60),.17,'warm').tone(.66,.75,note(67),note(67),.13,'round').echo(.11,.18)}
];

const bank={},report={provider:'Original local synthesis',sampleRate:SR,channels:1,encoding:'PCM 16-bit WAV',effects:{}};
const previews=[];
for(const e of pack){
  const {wav,pcm,...stats}=e.clip.finish(),file=`assets/sfx-${e.id}.wav`;
  await writeFile(new URL(file,root),wav);
  bank[e.id]={file,volume:e.volume,cooldown:e.cooldown,label:e.label};
  report.effects[e.id]={...stats,bytes:wav.length,sha256:createHash('sha256').update(wav).digest('hex')};
  previews.push({id:e.id,label:e.label,at:previews.reduce((sum,p)=>sum+p.duration+.32,0),duration:stats.duration,pcm,volume:e.volume});
}
await writeFile(new URL('js/sound-bank.mjs',root),'// Original locally synthesized sound pack. Rebuild: npm run audio:build\nexport const SOUND_BANK = '+JSON.stringify(bank,null,2)+';\n');
await writeFile(new URL('audio/local-generated.json',root),JSON.stringify(report,null,2)+'\n');
// A paced audition reel at the in-game relative mix, kept outside production assets.
const reel=new Clip(previews.reduce((sum,p)=>sum+p.duration+.32,0));
for(const p of previews)for(let i=0;i<p.pcm.length;i++)reel.data[Math.round(p.at*SR)+i]=p.pcm[i]/32767*p.volume;
await writeFile(new URL('audio/sound-pack-preview.wav',root),reel.finish().wav);
await writeFile(new URL('audio/preview-cues.json',root),JSON.stringify(previews.map(({pcm,volume,...rest})=>rest),null,2)+'\n');
console.log(`Built ${pack.length} original sounds, ${(Object.values(report.effects).reduce((s,e)=>s+e.bytes,0)/1024).toFixed(0)} KiB total.`);
await import('../integration/build-manifest.mjs');
