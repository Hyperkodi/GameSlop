import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {MUSIC_BANK} from '../js/music-bank.mjs';
import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';

const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/games/pac-chad/`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={errors:[]};
try{
  const context=await browser.newContext();
  await context.route('**/js/app.mjs',async route=>{
    const code=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
    await route.fulfill({contentType:'text/javascript',body:code+'\nwindow.__musicQA={music,audio,get state(){return state},get phase(){return phase},pause};'});
  });
  const page=await context.newPage(),requests=[];page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/music-'))requests.push(r.url());});
  await page.goto(base);await page.waitForFunction(()=>window.__musicQA);assert.equal(requests.length,0);
  assert.equal(await page.locator('#music-tracks li').count(),10);
  await page.locator('#start').click();await page.waitForFunction(()=>window.__musicQA.music.source?.loop);
  await page.evaluate(()=>{window.__musicQA.state.invulnerable=100000;window.__musicQA.state.ghosts.forEach(g=>g.wait=100000);});
  assert.equal(requests.length,1);await page.locator('#pause').click();
  const pausedAt=await page.evaluate(()=>{const m=window.__musicQA.music;if(m.source)throw Error('Music playing while paused');return m.offset;});
  await page.locator('#resume').click();await page.waitForFunction(()=>window.__musicQA.music.source);
  assert.ok(await page.evaluate(offset=>window.__musicQA.music.offset>=offset,pausedAt));
  await page.locator('#sound').click();await page.waitForFunction(()=>!window.__musicQA.music.source);
  await page.locator('#sound').click();await page.waitForFunction(()=>window.__musicQA.music.source);
  for(let stage=1;stage<10;stage++){
    // Exercise the actual model transition and app music selection.
    await page.evaluate(()=>{window.__musicQA.state.transition=2;});
    await page.waitForFunction(stage=>window.__musicQA.state.stage===stage&&window.__musicQA.music.stage===stage&&!!window.__musicQA.music.source,stage);
    assert.ok(await page.evaluate(()=>window.__musicQA.music.buffers.size<=2));
  }
  report.lifecycle='No title downloads; start, all ten levels, pause/resume, mute/unmute, and two-track cache verified';
  await page.evaluate(()=>{const q=window.__musicQA;q.state.done=true;q.state.reason='campaign_complete';});
  await page.waitForFunction(()=>window.__musicQA.phase==='results'&&!window.__musicQA.music.source);
  await page.locator('#again').click();await page.waitForFunction(()=>window.__musicQA.music.stage===0&&!!window.__musicQA.music.source);
  await page.locator('#pause').click();await page.locator('#quit').click();await page.waitForFunction(()=>window.__musicQA.music.stage===null);
  report.assets=await page.evaluate(async tracks=>{
    const ctx=window.__musicQA.audio.ctx,rows=[];
    for(const track of tracks)for(const file of [track.file,track.fallback]){
      const response=await fetch(file);if(!response.ok)throw Error(file+' HTTP '+response.status);
      const mime=response.headers.get('content-type');if(!mime.includes(file.endsWith('.ogg')?'audio/ogg':'audio/mpeg'))throw Error('Wrong MIME: '+file);
      const buffer=await ctx.decodeAudioData(await response.arrayBuffer());let peak=0,energy=0,jump=0;
      for(let c=0;c<buffer.numberOfChannels;c++){
        const samples=buffer.getChannelData(c);jump=Math.max(jump,Math.abs(samples[0]-samples.at(-1)));
        for(let i=0;i<samples.length;i+=16){const v=samples[i];peak=Math.max(peak,Math.abs(v));energy+=v*v;}
      }
      const rms=Math.sqrt(energy/(Math.ceil(buffer.length/16)*buffer.numberOfChannels));
      // Render across the end of each track with the actual browser loop engine.
      const offline=new OfflineAudioContext(1,Math.round(buffer.sampleRate*.2),buffer.sampleRate),source=offline.createBufferSource();
      const loopStart=file===track.fallback&&buffer.duration>track.duration+.01?track.fallbackStart:0;
      const loopEnd=file===track.fallback?Math.min(buffer.duration,loopStart+track.duration):buffer.duration;
      source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;source.connect(offline.destination);source.start(0,loopEnd-.1);
      const looped=await offline.startRendering(),out=looped.getChannelData(0);let after=0;
      for(let i=Math.round(out.length/2);i<out.length;i++)after+=out[i]*out[i];
      rows.push({file,duration:buffer.duration,loopStart,loopEnd,channels:buffer.numberOfChannels,peak,rms,playbackRms:rms*track.volume,boundaryJump:jump,loopResumeRms:Math.sqrt(after/(out.length/2))});
    }
    return rows;
  },MUSIC_BANK);
  for(const row of report.assets){assert.ok(row.duration>30&&row.duration<180,row.file);assert.ok(row.rms>.001,row.file+' silent');assert.ok(row.loopResumeRms>.0001,row.file+' loop did not resume');}
  await context.close();
  // A browser with no Ogg decoder must still get the soundtrack on mobile.
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.addInitScript(()=>{const decode=AudioContext.prototype.decodeAudioData;AudioContext.prototype.decodeAudioData=function(data,...args){if(new Uint8Array(data,0,4).every((v,i)=>v===[79,103,103,83][i]))return Promise.reject(Error('Simulated unsupported Ogg'));return decode.call(this,data,...args);};});
  await mobile.route('**/js/app.mjs',async route=>{const code=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');await route.fulfill({contentType:'text/javascript',body:code+'\nwindow.__musicQA={music,audio,get state(){return state},get phase(){return phase}};'});});
  const phone=await mobile.newPage();phone.on('pageerror',e=>report.errors.push(e.message));const mobileRequests=[];phone.on('request',r=>mobileRequests.push(r.url()));
  await phone.goto(base);await phone.locator('#start').tap();await phone.waitForFunction(()=>!!window.__musicQA.music.source);
  assert.ok(mobileRequests.some(url=>url.endsWith('music-afterhours.mp3')));
  const bounds=await phone.evaluate(()=>{const s=window.__musicQA.music.source;return {start:s.loopStart,length:s.loopEnd-s.loopStart,duration:s.buffer.duration};});
  assert.ok(Math.abs(bounds.length-MUSIC_BANK[0].duration)<.001);assert.ok(bounds.start>.02);
  report.mobileLoop=bounds;
  await phone.locator('#pause').tap();await phone.waitForFunction(()=>!window.__musicQA.music.source);
  assert.ok(await phone.locator('.pause-credit').isVisible());await phone.locator('#quit').tap();
  await phone.goto(base+'sound-lab.html');assert.equal(await phone.locator('#music button').count(),10);
  await phone.locator('#music button').last().tap();await phone.waitForFunction(()=>document.getElementById('status').textContent==='Cyberpunk Action — looping');
  await phone.locator('#stop').tap();assert.equal(await phone.locator('#status').textContent(),'Stopped.');
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await phone.screenshot({path:new URL('../art/qa-music-lab.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  report.mobile='MP3 fallback, pause credit, soundtrack preview and stop verified';await mobile.close();
  assert.deepEqual(report.errors,[]);await writeFile(new URL('../audio/music-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
