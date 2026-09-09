import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {chromium} from '../../../local/mariokart/node_modules/playwright-core/index.mjs';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/games/pac-chad/`;
const out=new URL('../art/',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[];
try{
 for(const mobile of [false,true]){
  const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
  await ctx.route('**/js/app.mjs',async route=>route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../js/app.mjs',import.meta.url),'utf8')+'\nwindow.__pelletQA={get state(){return state},get phase(){return phase},renderer,images,pause,updateHUD,step,setState(s){state=s}};'}));
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.__pelletQA);
  const alpha=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');return Object.entries(window.__pelletQA.images).filter(([id])=>id.startsWith('pickup-')).map(([id,img])=>{ctx.clearRect(0,0,256,256);ctx.drawImage(img,0,0);return {id,loaded:img.naturalWidth===256,alpha:ctx.getImageData(0,0,1,1).data[3]};});});
  assert.equal(alpha.length,4);assert.ok(alpha.every(x=>x.loaded&&x.alpha===0));
  await page.locator('#start').click();await page.waitForFunction(()=>window.__pelletQA.phase==='run');
  await page.evaluate(()=>{window.__pelletQA.pause(true);document.getElementById('pause-panel').hidden=true;});
  for(const [index,[x,y]] of [[1,1],[21,1],[1,17],[21,17]].entries()){
    await page.evaluate(async ([x,y])=>{const m=await import('./js/model.mjs'),q=window.__pelletQA,s=m.createRun();const n=m.neighbors(s,x,y)[0];Object.assign(s.player,{x:n.x,y:n.y,tx:n.x,ty:n.y,dir:(n.dir+2)%4,progress:0,moving:false});for(const g of s.ghosts)g.wait=999999;q.setState(s);q.updateHUD();q.renderer.draw(s,0);},[x,y]);
    await page.locator('#game').screenshot({path:out+`qa-pellet-${index}-${mobile?'mobile':'desktop'}.png`});
    const effect=await page.evaluate(([x,y])=>{const q=window.__pelletQA;for(let i=0;i<13;i++)q.step(q.state,q.state.player.dir);return {power:q.state.power,collected:q.state.maze.pellets[y*23+x]===0};},[x,y]);
    assert.equal(effect.power,420);assert.equal(effect.collected,true);
  }
  await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log('Four transparent pellet icons render on desktop/mobile and each triggers 420 ticks of Chad Mode.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
