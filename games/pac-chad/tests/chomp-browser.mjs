import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/games/pac-chad/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[],report={};
try{
  const ctx=await browser.newContext({viewport:{width:1100,height:950}});
  await ctx.route('**/js/app.mjs',async route=>{const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');await route.fulfill({contentType:'text/javascript',body:source+`\nwindow.__chompQA={get state(){return state},get phase(){return phase},renderer,images,pause};window.__jawFrames=[];const realSprite=renderer.sprite.bind(renderer);renderer.sprite=(...args)=>{if(args[0]==='chad'){window.__jawFrames.push(args[8]);if(window.__jawFrames.length>300)window.__jawFrames.shift();}return realSprite(...args);};`});});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start').disabled);
  report.atlas=await page.evaluate(()=>{const img=window.__chompQA.images['chad-chomp'];const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(img,0,0);return {width:img.naturalWidth,height:img.naturalHeight,cornerAlpha:x.getImageData(0,0,1,1).data[3]};});assert.deepEqual(report.atlas,{width:1254,height:1254,cornerAlpha:0});
  await page.locator('#start').click();await page.waitForFunction(()=>window.__chompQA.phase==='run');await page.evaluate(()=>{window.__jawFrames=[];});await page.waitForTimeout(430);
  report.runningFrames=await page.evaluate(()=>[...new Set(window.__jawFrames)].sort());assert.deepEqual(report.runningFrames,[0,1,2,3]);
  await page.evaluate(()=>{window.__chompQA.pause(true);window.__jawFrames=[];});await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>new Set(window.__jawFrames).size),1);report.pause='mouth frame freezes';
  await page.locator('#resume').click();await page.waitForFunction(()=>window.__chompQA.state.player.x===21&&!window.__chompQA.state.player.moving);await page.evaluate(()=>{window.__jawFrames=[];});await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>[...new Set(window.__jawFrames)]),[0]);report.wall='mouth closes when blocked';
  await page.keyboard.press('ArrowLeft');await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>window.__chompQA.state.player.dir),3);assert.ok((await page.evaluate(()=>[...new Set(window.__jawFrames)])).length>1);report.reverse='left-facing chomp resumes';
  await page.evaluate(()=>window.__chompQA.pause(true));
  // Use the actual renderer for an enlarged and mobile-size frame contact sheet.
  await page.evaluate(async()=>{
    const {Renderer}=await import('./js/renderer.mjs');const images=window.__chompQA.images;
    const sheet=document.createElement('section');sheet.style.cssText='position:fixed;inset:0;z-index:1000;background:#10110e';sheet.innerHTML='<main style="padding:32px;background:#10110e;color:#fff1d0;min-height:100vh"><p style="font:12px monospace;letter-spacing:2px">GAMESLOP / MOUTH ANIMATION</p><h1 style="font:50px Impact;margin:12px 0">PAC-CHAD CHOMPS.</h1><canvas id="jaw-sheet" style="width:1000px;height:410px"></canvas></main>';document.body.append(sheet);
    const c=document.getElementById('jaw-sheet');c.width=1000;c.height=410;const r=new Renderer(c,images);r.metrics={tile:1};r.reduced=true;const g=c.getContext('2d');g.fillStyle='#10110e';g.fillRect(0,0,1000,410);
    const order=[0,3,1,2,1,3],labels=['CLOSED','OPENING','OPEN','BIG CHOMP','CLOSING','CLOSING'];
    for(let i=0;i<order.length;i++){const x=83+i*166;g.strokeStyle='#39442c';g.strokeRect(x-77,8,154,220);r.sprite('chad',x-.5,124-.5,142,0,1,false,undefined,order[i]);g.fillStyle='#bdff6b';g.font='11px monospace';g.textAlign='center';g.fillText(labels[i],x,215);r.sprite('chad',x-.5,301-.5,38,0,1,false,undefined,order[i]);}
    g.textAlign='left';g.fillStyle='#b4c39f';g.font='12px monospace';g.fillText('MOBILE SIZE / 38 PX TILES / SAME IN-GAME RENDERER',8,369);
  });
  await page.screenshot({path:new URL('../art/chomp-preview.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),clip:{x:0,y:0,width:1100,height:620}});
  await ctx.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.waitForFunction(()=>!document.getElementById('start').disabled);await phone.locator('#start').tap();await phone.waitForFunction(()=>document.getElementById('countdown').hidden);await phone.locator('[data-dir="3"]').tap();await phone.waitForTimeout(300);await phone.locator('#pause').tap();await phone.waitForFunction(()=>!document.getElementById('pause-panel').hidden);await phone.locator('#resume').tap();report.mobile='updated art loads, touch movement and pause/resume work';await mobile.close();
  assert.deepEqual(errors,[]);report.errors=errors;await writeFile(new URL('../art/qa-chomp-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
