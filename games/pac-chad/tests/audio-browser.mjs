import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {SOUND_BANK} from '../js/sound-bank.mjs';
import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';

const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/games/pac-chad/`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
const errors=[],report={};
try{
  for(const spec of Object.values(SOUND_BANK)){
    const response=await fetch(base+spec.file);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),spec.file.endsWith('.mp3')?/audio\/mpeg/:/audio\/wav/);
    if(spec.file.endsWith('.mp3'))continue;
    const data=Buffer.from(await response.arrayBuffer());assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt32LE(40),data.length-44);
    let peak=0;for(let i=44;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i))/32768);
    assert.ok(peak>.1&&peak<.74,spec.file+' clipping or silent');
    assert.equal(data.readInt16LE(44),0);assert.equal(data.readInt16LE(data.length-2),0);
  }
  const ctx=await browser.newContext();
  await ctx.route('**/js/app.mjs',async route=>{
    const code=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
    await route.fulfill({contentType:'text/javascript',body:code+`\nwindow.__audioQA={audio,get state(){return state},get phase(){return phase},pause};window.__cues=[];const emit=audio.event.bind(audio);audio.event=(e,a)=>{window.__cues.push(e.type==='ability'?a:e.type);return emit(e,a);};`});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.__audioQA);await page.locator('#start').click();
  await page.waitForFunction(()=>window.__audioQA.phase==='run');
  report.decoded=await page.evaluate(async()=>{const a=window.__audioQA.audio;await a.loading;return {count:a.buffers.size,failed:[...a.failed]};});
  report.recordings=await page.evaluate(()=>Object.fromEntries([...window.__audioQA.audio.buffers].filter(([id])=>id.startsWith('ghost-')||id==='hit').map(([id,{buffer}])=>[id,{duration:buffer.duration,channels:buffer.numberOfChannels}])));
  assert.deepEqual(report.decoded,{count:Object.keys(SOUND_BANK).length,failed:[]});
  await page.evaluate(()=>{window.__audioQA.pause(true,true);window.__audioQA.audio.fallback=()=>{throw Error('Unexpected fallback after loading');};});
  report.mix=await page.evaluate(async()=>{
    const {audio:a}=window.__audioQA,offline=new OfflineAudioContext(1,44100*3,44100);
    const master=offline.createGain();master.gain.value=.8;const comp=offline.createDynamicsCompressor();
    comp.threshold.value=-9;comp.knee.value=6;comp.ratio.value=8;comp.attack.value=.003;comp.release.value=.12;master.connect(comp);comp.connect(offline.destination);
    const {SOUND_BANK:bank}=await import('./js/sound-bank.mjs');
    const play=(id,t)=>{const s=offline.createBufferSource(),g=offline.createGain();s.buffer=a.buffers.get(id).buffer;g.gain.value=bank[id].volume;s.connect(g);g.connect(master);s.start(t);};
    for(let i=0;i<15;i++)play('pellet',i*.12);
    ['power','dash','ghost-rook','ghost-hex','ghost-ivy','ghost-riot','combo','warning','gate'].forEach((id,i)=>play(id,.3+i*.05));
    play('ghost',.65);play('ghost',.8);play('ghost',1);play('stage',1.1);
    const rendered=await offline.startRendering(),samples=rendered.getChannelData(0);let peak=0,sum=0;
    for(const v of samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;}
    return {peak,rms:Math.sqrt(sum/samples.length)};
  });
  assert.ok(report.mix.peak<.95&&report.mix.rms>.005);
  report.playback=await page.evaluate(async()=>{
    const a=window.__audioQA.audio;let starts=0;const create=a.ctx.createBufferSource.bind(a.ctx);
    a.ctx.createBufferSource=()=>{const s=create(),start=s.start.bind(s);s.start=(...args)=>{starts++;start(...args);};return s;};
    for(const id of a.buffers.keys()){a.last.clear();a.event({type:id,tick:1});}
    const voices=a.active.size;a.muted=true;const stopped=a.active.size;const count=starts;a.event({type:'hit'});
    const silent=starts===count;a.muted=false;a.reset();a.event({type:'pellet',tick:1});
    const restarted=starts===count+1;a.stop();return {starts:count,voices,stopped,silent,restarted};
  });
  assert.equal(report.playback.starts,Object.keys(SOUND_BANK).length);assert.ok(report.playback.voices<=8);assert.equal(report.playback.stopped,0);assert.ok(report.playback.silent&&report.playback.restarted);
  await page.evaluate(()=>{window.__cues=[];const q=window.__audioQA;q.state.energy=599;q.state.power=1;q.pause(false,true);});
  await page.waitForFunction(()=>window.__cues.includes('ready')&&window.__cues.includes('power-end'));
  await page.locator('#pause').click();await page.waitForFunction(()=>window.__cues.includes('pause'));
  await page.locator('#resume').click();await page.waitForFunction(()=>window.__cues.includes('resume'));
  report.transitions='recharge, power expiry, pause and resume cues passed';await ctx.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base+'sound-lab.html');
  await phone.locator('#sounds button').first().tap();await phone.waitForFunction(()=>document.getElementById('status').textContent==='Chomp');
  assert.equal(await phone.locator('#sounds button').count(),Object.keys(SOUND_BANK).length);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await phone.locator('#all').tap();await phone.locator('#stop').tap();assert.equal(await phone.locator('#status').textContent(),'Stopped.');
  await phone.screenshot({path:new URL('../art/qa-sound-lab.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  await mobile.close();report.mobile='sound picker loads, plays and stops with touch';
  assert.deepEqual(errors,[]);report.errors=errors;
  await writeFile(new URL('../audio/validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
