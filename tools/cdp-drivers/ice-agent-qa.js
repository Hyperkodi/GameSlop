 'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
module.exports=async(cdp,evaluate,sleep)=>{
 const check=async(code,label)=>{assert.ok(await evaluate(code),label);console.log('PASS '+label);};
 const key=(key,down)=>cdp('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key,code:key.length===1?'Key'+key.toUpperCase():key});
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await sleep(70);};
 await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));localStorage.setItem('playerName','Browser QA')");
 await check("game.state==='menu'&&document.body.dataset.ready==='1'",'imported game initializes');
 await click('#startGame');await click('#easyMode');await sleep(500);await check("game.state==='playing'&&game.player.health>0",'difficulty selection starts real gameplay');
 const before=await evaluate('game.player.x');await key('d',true);await sleep(300);await key('d',false);await check(`game.player.x>${before+10}`,'keyboard movement');
 await key('w',true);await sleep(90);await key('w',false);await check('game.player.vy<0||!game.player.onGround','jump launches');
 const ammo=await evaluate('game.player.weapons.pistol.ammo');await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:400});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:900,y:400,button:'left',clickCount:1});await sleep(300);await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:900,y:400,button:'left',clickCount:1});await check(`game.player.weapons.pistol.ammo<${ammo}`,'mouse shooting consumes ammunition');
 await click('#arcade-pause');await check("game.state==='paused'",'host pause button');await click('#resumeGame');await check("game.state==='playing'",'original resume menu');
 await click('#arcade-fullscreen');await check('!!document.fullscreenElement','browser fullscreen');await click('#arcade-fullscreen');
 for(let i=1;i<=7;i++){await evaluate(`game.startLevel(${i});game.level.spawnBoss();game.draw()`);await sleep(90);await check(`game.currentLevelNumber===${i}&&game.level.boss&&game.player.health>0`,'level and boss render '+i);}
 await check('__errors.length===0','no game runtime errors');
 // Reload with a phone identity so the original mobile detection initializes.
 await cdp('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await cdp('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'});await cdp('Page.reload',{});await sleep(700);
 await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));localStorage.setItem('playerName','Browser QA')");
 await click('#startGame');await click('#easyMode');await sleep(500);
 await check("mobileControls.enabled&&getComputedStyle(document.querySelector('#mobileJoystick')).display!=='none'",'mobile controls initialize and show');
 await check('game.player.y+game.player.height<=game.canvas.height&&game.canvas.height===720','authored ground stays inside the phone viewport');
 const stick=await evaluate("(()=>{const r=document.querySelector('#mobileJoystick').getBoundingClientRect();return {x:r.x+r.width/2+35,y:r.y+r.height/2};})()");const startX=await evaluate('game.player.x');await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...stick}]});await sleep(300);await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await check(`game.player.x>${startX+10}&&!game.player.keys.d`,'mobile thumbstick moves and releases');
 const shoot=await evaluate("(()=>{const r=document.querySelector('#mobileShootArea').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");const mobileAmmo=await evaluate('game.player.weapons.pistol.ammo');await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...stick}]});await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...stick},{id:2,...shoot}]});await sleep(180);await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await check(`game.player.weapons.pistol.ammo<${mobileAmmo}&&!game.player.keys.shoot&&!game.player.keys.d`,'two-thumb shooting and release');
 await check("(()=>{const selectors=['#mobileJoystick','#mobileShootArea','#weaponPanel','#actionPanel','#arcade-tools'],r=selectors.map(s=>document.querySelector(s).getBoundingClientRect());return r.every(a=>a.left>=0&&a.right<=innerWidth+1&&a.top>=0&&a.bottom<=innerHeight+1)&&r.every((a,i)=>r.every((b,j)=>i===j||a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));})()",'landscape controls fit without overlap');
 const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/game-screenshots/ice-agent-mobile.png',Buffer.from(shot.data,'base64'));
 await check('__errors.length===0','mobile gameplay has no runtime errors');console.log('All ICE Agent import checks passed.');
};
