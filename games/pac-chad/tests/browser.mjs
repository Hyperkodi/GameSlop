import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright-core'));}catch{({chromium}=await import('../../../local/mariokart/node_modules/playwright-core/index.mjs'));}
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/games/pac-chad/`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
const errors=[],report={};
async function context(options={}){
  const ctx=await browser.newContext(options);
  // Read-only and stepping hooks exist solely in the intercepted test response.
  await ctx.route('**/js/app.mjs',async route=>{const code=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');await route.fulfill({contentType:'text/javascript',body:code+`\nwindow.__pacQA={get state(){return state},get phase(){return phase},get renderer(){return renderer},get recorder(){return recorder},get platform(){return platform},step,createRun,setState(s){state=s},finish,pause,validate:async(e,c)=>(await import('./replay.mjs')).validateReplay(e,c)};`});});
  ctx.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));});return ctx;
}
try{
  const desktop=await context({viewport:{width:1440,height:1050},deviceScaleFactor:1});const page=await desktop.newPage();await page.goto(base);await page.locator('#start').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('start').disabled);
  await page.screenshot({path:new URL('../art/qa-desktop.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  report.assets=await page.evaluate(()=>Object.fromEntries([...document.images].filter(i=>i.src.includes('/assets/')).map(i=>[i.src.split('/').pop(),{loaded:i.complete&&i.naturalWidth>0,width:i.naturalWidth}])));
  await page.locator('#start').click();await page.waitForFunction(()=>window.__pacQA.phase==='run');await page.keyboard.press('ArrowLeft');await page.waitForTimeout(650);const before=await page.evaluate(()=>window.__pacQA.state.tick);
  await page.keyboard.press('Space');await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>window.__pacQA.state.energy<600));
  await page.keyboard.press('KeyP');await page.waitForTimeout(100);const paused=await page.evaluate(()=>window.__pacQA.state.tick);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__pacQA.state.tick),paused);assert.ok(paused>=before);
  await page.locator('#cabinet').screenshot({path:new URL('../art/qa-game-paused.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  await page.locator('#resume').click();await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>window.__pacQA.state.tick)>paused);
  await page.locator('#cabinet').screenshot({path:new URL('../art/qa-gameplay.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  await page.locator('#fullscreen').click();assert.ok(await page.evaluate(()=>!!document.fullscreenElement||document.getElementById('cabinet').classList.contains('full-window')));await page.locator('#fullscreen').click();
  // Finish a real deterministic run rapidly in the same imported simulation.
  report.completed=await page.evaluate(async()=>{const q=window.__pacQA;q.pause(true);while(!q.state.done){q.recorder.add(4);q.step(q.state,4);}await q.finish();const evidence=q.recorder.export();return await q.validate(evidence,{version:q.state.version,seed:q.state.seed,ability:q.state.ability,score:q.state.score});});
  assert.ok(report.completed.score>0);assert.match(await page.locator('#personal-board').textContent(),/DASH/);await page.reload();await page.waitForFunction(()=>!document.getElementById('start').disabled);assert.ok((await page.locator('#best').textContent())!=='000000');
  await page.locator('[data-ability="decoy"]').click();await page.locator('#start').click();await page.waitForFunction(()=>window.__pacQA.phase==='run');await page.keyboard.press('Space');await page.waitForTimeout(70);assert.ok(await page.evaluate(()=>!!window.__pacQA.state.decoy));report.desktop='keyboard, pause, ability, fullscreen, completed replay, persistent personal best, decoy passed';await desktop.close();
  const mobile=await context({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const phone=await mobile.newPage();await phone.goto(base);await phone.waitForFunction(()=>!document.getElementById('start').disabled);
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.screenshot({path:new URL('../art/qa-phone-title.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  await phone.locator('#start').tap();await phone.waitForFunction(()=>window.__pacQA.phase==='run');await phone.locator('[data-dir="3"]').tap();await phone.waitForTimeout(160);assert.equal(await phone.evaluate(()=>window.__pacQA.state.player.dir),3);await phone.locator('#touch-ability').tap();await phone.waitForTimeout(50);assert.ok(await phone.evaluate(()=>window.__pacQA.state.energy<600));
  const canvas=await phone.locator('#game').boundingBox();const client=await mobile.newCDPSession(phone);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:canvas.x+180,y:canvas.y+220}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:canvas.x+240,y:canvas.y+220}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phone.waitForTimeout(100);assert.equal(await phone.evaluate(()=>window.__pacQA.state.player.dir),1);
  report.mobileTile=await phone.evaluate(()=>window.__pacQA.renderer.metrics.tile);assert.ok(report.mobileTile>=38);
  await phone.locator('#cabinet').screenshot({path:new URL('../art/qa-phone-gameplay.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  await phone.setViewportSize({width:844,height:390});await phone.waitForTimeout(150);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await phone.evaluate(()=>{window.__fsEvents=[];for(const type of ['pointerdown','click','pointerup'])document.addEventListener(type,e=>window.__fsEvents.push({type,target:e.target.id||e.target.tagName,x:e.clientX,y:e.clientY}),true);const cabinet=document.getElementById('cabinet'),original=cabinet.requestFullscreen.bind(cabinet);cabinet.requestFullscreen=async()=>{window.__fsEvents.push({request:true,active:navigator.userActivation.isActive});try{const r=await original();window.__fsEvents.push({resolved:true});return r;}catch(e){window.__fsEvents.push({error:e.message});throw e;}};});
  await phone.locator('#fullscreen').tap();try{await phone.waitForFunction(()=>!!document.fullscreenElement||document.getElementById('cabinet').classList.contains('full-window'),null,{timeout:4000});}catch(e){console.log('FULLSCREEN DEBUG',await phone.evaluate(()=>({events:window.__fsEvents,rect:document.getElementById('fullscreen').getBoundingClientRect().toJSON(),scrollY,viewport:{w:innerWidth,h:innerHeight},phase:window.__pacQA.phase})));throw e;}
  await phone.locator('#cabinet').screenshot({path:new URL('../art/qa-landscape.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  report.mobile='portrait + landscape, direction pad, swipe, ability, fullscreen passed';await mobile.close();
  const hostCtx=await context({viewport:{width:1280,height:900}});
  await hostCtx.route('**/pac-test-host',route=>route.fulfill({contentType:'text/html',body:`<iframe src="${base}" style="width:1100px;height:800px"></iframe><script>window.events=[];addEventListener('message',e=>{if(e.source!==document.querySelector('iframe').contentWindow||e.origin!==location.origin)return;events.push(e.data);if(e.data.id)e.source.postMessage({source:'gameslop-host',id:e.data.id,payload:e.data.type==='start'?{runId:'test-only-run',recordable:true}:{}},e.origin);});</script>`}));
  const host=await hostCtx.newPage();await host.goto(new URL('/pac-test-host',base).href);const frame=host.frames().find(f=>f.url()===base);await frame.waitForFunction(()=>window.__pacQA?.platform.sdk);await frame.locator('#start').click();await frame.waitForFunction(()=>window.__pacQA.phase==='run');await frame.evaluate(async()=>{const q=window.__pacQA;q.pause(true);while(!q.state.done){q.recorder.add(4);q.step(q.state,4);}await q.finish();});
  const events=await host.evaluate(()=>window.events);assert.ok(events.some(e=>e.type==='ready'));assert.ok(events.some(e=>e.type==='start'));const submit=events.find(e=>e.type==='submit');assert.equal(submit.runId,'test-only-run');assert.equal(submit.slug,'pac-chad');assert.ok(submit.score>=0);report.platform='existing SDK ready/start/complete bound to parent-issued run; mock host only';await hostCtx.close();
  assert.deepEqual(errors,[]);report.errors=errors;await writeFile(new URL('../art/qa-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
