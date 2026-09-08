import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['games/cash-cannon/server.mjs'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,CASH_CANNON_PORT:'8784'},windowsHide:true});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8784');await page.locator('#start:not([disabled])').waitFor();await page.screenshot({path:'games/cash-cannon/art/qa-desktop.png',fullPage:true});
 assert.equal(await page.locator('#hazards article').count(),5);
 assert.equal(await page.locator('#exchanges article').count(),11);
 assert.equal(await page.evaluate(async()=>{const {loadExchangeLogos}=await import('/js/exchanges.mjs');return (await loadExchangeLogos()).size;}),11);
 await page.locator('.exchange-guide').screenshot({path:'games/cash-cannon/art/qa-cex-lineup.png'});
 await page.locator('.field-guide').screenshot({path:'games/cash-cannon/art/qa-new-hazards.png'});
 await page.evaluate(async()=>{
  const {createRun,launch,step}=await import('/js/model.mjs'),{Renderer}=await import('/js/renderer.mjs'),{loadExchangeLogos}=await import('/js/exchanges.mjs');
  const logos=await loadExchangeLogos(),cat=document.querySelector('.hero-cat');
  const panel=document.createElement('div');panel.id='qa-rug';panel.style.cssText='display:grid;grid-template-columns:repeat(2,500px);gap:10px;background:#10170f;padding:12px;width:1034px;';
  document.body.append(panel);
  for(const seconds of [0,.55,1.1,2.1]){
   const frame=document.createElement('div'),caption=document.createElement('p'),canvas=document.createElement('canvas');caption.textContent=['LAND / STOP','RUG WHIPS AWAY','SPIN / FALL','LAND ON SIDE'][[0,.55,1.1,2.1].indexOf(seconds)];caption.style.cssText='padding:5px;font:14px monospace;color:white';canvas.style.cssText='width:500px;height:340px;display:block';frame.append(caption,canvas);panel.append(frame);
   const s=createRun(1);launch(s,1);s.x=335;s.y=31;s.vx=350;s.vy=-240;s.nextX=100000;s.objects=[{id:99,kind:'rug',x:355,y:0,phase:0,used:false}];step(s);
   s.tick+=Math.round(seconds*120);s.endTicks-=Math.round(seconds*120);const r=new Renderer(canvas,cat,logos);r.draw(s);
  }
 });
 await page.locator('#qa-rug').screenshot({path:'games/cash-cannon/art/qa-rug-sequence.png'});await page.locator('#qa-rug').evaluate(e=>e.remove());
 await page.locator('#start').click();await page.locator('#angle').fill('30');await page.locator('#fire').click();await page.waitForTimeout(700);await page.locator('#pause').click();
 const distance=await page.locator('#distance').innerText();await page.waitForTimeout(500);assert.equal(await page.locator('#distance').innerText(),distance);await page.locator('#resume').click();
 await page.locator('#results-panel:not([hidden])').waitFor({timeout:180000});assert.ok(parseFloat(await page.locator('#final-distance').innerText())>0);await page.screenshot({path:'games/cash-cannon/art/qa-result.png'});
 await page.locator('#again').click();assert.equal(await page.locator('#distance').innerText(),'0.0 m');await page.keyboard.press('Space');assert.equal(await page.locator('#fire').innerText(),'IN FLIGHT ↗');
 await page.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8784');await p.locator('#start:not([disabled])').waitFor();
 await p.screenshot({path:'games/cash-cannon/art/qa-mobile.png',fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('#start').click();await p.setViewportSize({width:844,height:390});await p.waitForTimeout(300);
 const cabinet=await p.locator('#cabinet').boundingBox(),controls=await p.locator('.launch-controls').boundingBox(),game=await p.locator('#game').boundingBox();
 await p.screenshot({path:'games/cash-cannon/art/qa-landscape.png'});
 assert.equal(Math.round(cabinet.width),844);assert.equal(Math.round(cabinet.height),390);assert.ok(controls.x<game.x);assert.ok(game.width>600);
 await p.locator('#fire').click();await p.waitForTimeout(900);await p.screenshot({path:'games/cash-cannon/art/qa-flight.png'});
 await p.locator('#pause').click();await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);assert.equal(await p.locator('#cabinet').evaluate(e=>e.classList.contains('full-window')),false);assert.ok(await p.locator('#pause-panel').isVisible());
 await p.setViewportSize({width:320,height:568});assert.equal(await p.evaluate(()=>innerWidth),320);assert.ok((await p.locator('#fire').boundingBox()).height>=48);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({desktop:'launch/pause/results/retry passed',mobile:'portrait, landscape, rotation back and 320px passed',errors,landscape:{cabinet,controls,game}}));
}finally{await browser?.close();server.kill();}
