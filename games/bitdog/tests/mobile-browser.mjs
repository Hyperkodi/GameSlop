const {webkit,chromium,devices}=await import(process.env.BITDOG_PLAYWRIGHT_MODULE||'@playwright/test');
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/bitdog',{recursive:true});
import assert from 'node:assert/strict';
const base=process.env.BITDOG_URL||'http://127.0.0.1:8765/bitdog/';
for(const kind of ['webkit','chromium']){
 const browser=await (kind==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}));
 try{
  for(const scenario of ['normal','deferred-media-older-apis']){
   const page=await browser.newPage({...devices['iPhone 13'],viewport:{width:390,height:844}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/engine.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+';const original=BitDog.createEngine;BitDog.createEngine=(...args)=>window.qe=original(...args);'});});
   await page.route('**/js/renderer.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+';const originalRenderer=BitDog.createRenderer;BitDog.createRenderer=(...args)=>window.qr=originalRenderer(...args);'});});
   if(scenario!=='normal')await page.addInitScript(()=>{
    window.structuredClone=undefined;Array.prototype.at=undefined;CanvasRenderingContext2D.prototype.roundRect=undefined;
    if(window.HTMLDialogElement){HTMLDialogElement.prototype.showModal=undefined;HTMLDialogElement.prototype.close=undefined;}
    Object.defineProperty(HTMLVideoElement.prototype,'readyState',{get:()=>1});
    HTMLVideoElement.prototype.play=function(){return Promise.reject(new DOMException('Test deferred media','NotAllowedError'));};
    window.AudioContext=window.webkitAudioContext=function(){throw new Error('Test audio unavailable');};
   });
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.querySelector('#play').disabled,{timeout:60000});
   await page.locator('#controls-setup').tap();assert.equal(await page.locator('#controls-dialog').getAttribute('open'),'');
   await page.locator('#controls-reset').tap();await page.locator('#controls-done').tap();
   await page.locator('#sound').tap();await page.locator('#sound').tap();
   await page.locator('#fullscreen').tap();assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'),'true');
   await page.locator('#fullscreen').tap();
   await page.locator('#play').tap();
   await page.waitForTimeout(800);
   await page.locator('#cinematic-pause').tap();assert.equal(await page.locator('#cinematic-pause').getAttribute('aria-label'),'Resume opening');
   await page.locator('#cinematic-pause').tap();
   if(scenario==='normal')console.log(kind,'intro',await page.evaluate(()=>qr.openingStatus));
   await page.locator('#skip-intro').tap();
   await page.waitForFunction(()=>qe.state.phase==='outbound');
   for(let i=0;i<3;i++){
    await page.waitForFunction(()=>qe.state.dog.grounded);
    await page.locator('#jump').tap();
    await page.waitForFunction(()=>!qe.state.dog.grounded,{timeout:1500});
   }
   await page.waitForFunction(()=>qe.state.dog.grounded);
   // Trusted held pointer tests plus real touchscreen taps above.
   await page.locator('#joystick').scrollIntoViewIfNeeded();const stick=await page.locator('#joystick').boundingBox();const x=await page.evaluate(()=>qe.state.dog.x);
   await page.mouse.move(stick.x+stick.width*.82,stick.y+stick.height/2);await page.mouse.down();await page.waitForTimeout(350);
   await page.waitForFunction(start=>qe.state.dog.x>start+10,x,{timeout:5000});
   await page.mouse.up();
   for(const name of ['sprint','roll']){
    const box=await page.locator('#'+name).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(80);
    assert.ok(await page.locator('#'+name).evaluate(el=>el.classList.contains('active')));
    if(name==='roll')await page.waitForFunction(()=>qe.state.dog.rolling);
    await page.mouse.up();assert.ok(!await page.locator('#'+name).evaluate(el=>el.classList.contains('active')));
   }
   await page.locator('#pause').tap();assert.ok(await page.locator('#overlay').isVisible());await page.locator('#play').tap();assert.ok(!await page.locator('#overlay').isVisible());
   // Rotate while holding a stick; all ownership must be released.
   await page.mouse.move(stick.x+stick.width*.85,stick.y+stick.height/2);await page.mouse.down();
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);await page.mouse.up();
   assert.ok(!await page.locator('#joystick').evaluate(el=>el.classList.contains('active')));
   const layout=await page.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:b.top,bottom:b.bottom,width:b.width,left:b.left,right:b.right};};return {canvas:r('#game'),stick:r('#joystick'),jump:r('#jump'),height:innerHeight,width:innerWidth};});
   assert.ok(layout.stick.top>=layout.canvas.bottom-1);assert.ok(layout.stick.bottom<=layout.height+1);assert.ok(layout.jump.right<=layout.width);assert.ok(layout.stick.width>=100);
   await page.waitForFunction(()=>{const c=document.querySelector('#game');return c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]>0;});
   await page.screenshot({path:`artifacts/bitdog/mobile-${kind}-${scenario}.png`});
   await page.setViewportSize({width:320,height:568});
   for(const id of ['pause','joystick','jump','roll','sprint']){
    await page.locator('#'+id).scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),id+' is reachable at 320px');
   }
   assert.deepEqual(errors,[]);
   console.log('PASS',kind,scenario,'title, settings, sound, fullscreen, intro pause/skip, repeated quick jump, joystick, roll/sprint, pause/resume, rotation, landscape shelf');
   await page.close();
  }
 }finally{await browser.close();}
}
