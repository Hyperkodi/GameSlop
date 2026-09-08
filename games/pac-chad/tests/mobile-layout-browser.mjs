import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/games/pac-chad/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={sizes:[],errors:[]};
try{
 for(const [pw,ph] of [[390,844],[375,667],[320,568]]){
  const ctx=await browser.newContext({viewport:{width:pw,height:ph},isMobile:true,hasTouch:true});
  await ctx.route('**/js/app.mjs',async route=>{const body=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');await route.fulfill({contentType:'text/javascript',body:body+'\nwindow.__layoutQA={get state(){return state},get phase(){return phase},renderer,pause};'});});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.__layoutQA);
  await page.locator('#start').tap();await page.waitForFunction(()=>window.__layoutQA.phase==='run');await page.locator('[data-dir="3"]').tap();await page.waitForFunction(()=>window.__layoutQA.state.score>0);
  await page.evaluate(()=>{window.__layoutQA.pause(true);document.getElementById('pause-panel').hidden=true;window.__nativeAttempts=0;document.getElementById('cabinet').requestFullscreen=async()=>{window.__nativeAttempts++;throw new DOMException('Gesture unavailable','NotAllowedError');};});
  for(const button of await page.locator('.dpad button').all()){const r=await button.boundingBox();assert.ok(r.width>=54&&r.height>=54);}
  const before=await page.evaluate(()=>({tick:window.__layoutQA.state.tick,score:window.__layoutQA.state.score}));
  await page.setViewportSize({width:ph,height:pw});await page.waitForFunction(()=>document.getElementById('cabinet').classList.contains('auto-landscape'));
  await page.locator('[data-dir="3"]').tap();
  const layout=await page.evaluate(()=>{
   const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
   return {screen:{w:innerWidth,h:innerHeight},cabinet:rect('#cabinet'),game:rect('#game'),pad:rect('.dpad'),button:rect('[data-dir="3"]'),ability:rect('#touch-ability'),map:window.__layoutQA.renderer.overviewMetrics,nativeAttempts:window.__nativeAttempts,tick:window.__layoutQA.state.tick,score:window.__layoutQA.state.score};
  });
  assert.equal(layout.cabinet.x,0);assert.equal(layout.cabinet.y,0);assert.equal(layout.cabinet.width,ph);assert.equal(layout.cabinet.height,pw);
  assert.ok(layout.pad.right<=layout.game.x);assert.ok(layout.ability.x>=layout.game.right);assert.ok(layout.button.width>=54&&layout.button.height>=54);
  assert.ok(layout.game.height>=pw-45);assert.ok(layout.map.width<=62&&layout.map.height<=52);
  assert.equal(layout.tick,before.tick);assert.equal(layout.score,before.score);assert.equal(layout.nativeAttempts,1);
  assert.ok(await page.evaluate(()=>document.getElementById('cabinet').classList.contains('full-window')));
  await page.locator('#cabinet').screenshot({path:new URL(`../art/qa-mobile-layout-${ph}x${pw}.png`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  // Exit is respected, even if the browser resizes again in the same orientation.
  await page.locator('#fullscreen').tap();await page.evaluate(()=>dispatchEvent(new Event('resize')));assert.equal(await page.evaluate(()=>document.getElementById('cabinet').classList.contains('full-window')),false);
  await page.setViewportSize({width:pw,height:ph});await page.waitForFunction(()=>!document.getElementById('cabinet').classList.contains('touch-landscape'));
  assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
  await page.setViewportSize({width:ph,height:pw});await page.waitForFunction(()=>document.getElementById('cabinet').classList.contains('auto-landscape'));
  assert.equal(await page.evaluate(()=>window.__layoutQA.state.score),before.score);report.sizes.push(layout);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(new URL('../art/qa-mobile-layout.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
