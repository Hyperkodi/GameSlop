import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/games/pac-chad/`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={errors:[],desktop:[],mobile:[]};
const output=name=>new URL('../art/qa-'+name+'.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
try{
 for(const mobile of [false,true]){
  const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1100}});
  await ctx.route('**/js/app.mjs',async route=>{const code=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');await route.fulfill({contentType:'text/javascript',body:code+'\nwindow.__powerQA={get state(){return state},get phase(){return phase},renderer,images,pause,updateHUD,step,setState(s){state=s}};'});});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.__powerQA);
  assert.equal(await page.locator('#powerup-guide article').count(),10);
  const images=await page.evaluate(()=>Object.entries(window.__powerQA.images).filter(([id])=>id.startsWith('power-')).map(([id,img])=>({id,loaded:img.complete&&img.naturalWidth===256})));
  assert.equal(images.length,10);assert.ok(images.every(i=>i.loaded));
  if(!mobile)await page.locator('.powerup-guide').screenshot({path:output('powerup-guide')});
  await page.locator('#start').click();await page.waitForFunction(()=>window.__powerQA.phase==='run').catch(async error=>{console.log(await page.evaluate(()=>({phase:window.__powerQA.phase,hidden:document.hidden,start:document.getElementById('start').textContent,errors:document.getElementById('platform-note').textContent})));throw error;});await page.evaluate(()=>{window.__powerQA.pause(true);document.getElementById('pause-panel').hidden=true;});
  // Draw real pickups and activate by walking into each one, using test-only hooks.
  for(let stage=0;stage<10;stage++){
   const pickup=await page.evaluate(async stage=>{
    const m=await import('./js/model.mjs'),q=window.__powerQA,s=m.createRun();s.stage=stage;s.maze=m.makeMaze(s.seed,stage);
    const item=s.maze.pickup,n=m.neighbors(s,item.x,item.y)[0];Object.assign(s.player,{x:n.x,y:n.y,tx:n.x,ty:n.y,dir:(n.dir+2)%4,progress:0,moving:false});for(const g of s.ghosts)g.wait=999999;
    q.setState(s);q.updateHUD();q.renderer.draw(s,0);return {id:item.id,name:document.getElementById('special-name').textContent};
   },stage);
   if(stage===0)await page.locator('#cabinet').screenshot({path:output('powerup-pickup-'+(mobile?'mobile':'desktop'))});
   const active=await page.evaluate(()=>{
    const q=window.__powerQA,s=q.state;for(let i=0;i<13;i++)q.step(s,s.player.dir);q.updateHUD();q.renderer.draw(s,0);
    return {id:s.special?.id,ticks:s.special?.ticks,collected:s.maze.pickup.collected};
   });
   assert.equal(active.id,pickup.id);assert.equal(active.ticks,300);assert.ok(active.collected);
   assert.equal(await page.locator('#special-time').textContent(),'5.0s');assert.ok(await page.locator('#special-status').evaluate(e=>e.classList.contains('active')));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.locator('#special-name').evaluate(e=>e.scrollWidth<=e.clientWidth));
   // Pause freezes the countdown as well as the movement.
   await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>window.__powerQA.state.special.ticks),300);
   if([2,4,7,9].includes(stage))await page.locator('#cabinet').screenshot({path:output('powerup-'+pickup.id+'-'+(mobile?'mobile':'desktop'))});
   await page.evaluate(()=>{const q=window.__powerQA;for(let i=0;i<300;i++)q.step(q.state,4);q.updateHUD();});
   assert.equal(await page.locator('#special-time').textContent(),'USED');report[mobile?'mobile':'desktop'].push(pickup);
  }
  if(mobile){await page.setViewportSize({width:844,height:390});await page.locator('[data-dir="3"]').tap();await page.waitForFunction(()=>!!document.fullscreenElement||document.getElementById('cabinet').classList.contains('full-window'));assert.ok(await page.locator('#game').evaluate(e=>e.clientHeight>=170));await page.locator('#cabinet').screenshot({path:output('powerup-landscape')});}
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(new URL('../art/qa-powerups.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
