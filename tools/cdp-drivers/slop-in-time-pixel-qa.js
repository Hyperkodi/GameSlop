'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(cdp,evaluate,sleep)=>{
  for(let i=0;i<250&&!await evaluate('window.__gameslop?.renderer.ready');i++)await sleep(40);
  assert.ok(await evaluate('__gameslop.renderer.ready'),'all pixel assets load');
  const info=await evaluate('__gameslop.renderer.inspect()');assert.deepEqual(info.world,[480,270]);assert.equal(info.panoramas.length,6);assert.ok(info.panoramas.every(p=>p[0]===4352&&p[1]===340));assert.ok(info.redPalette);assert.equal(info.bosses,12);
  await evaluate("window.__errors=[];addEventListener('error',e=>__errors.push(e.message));document.querySelector('.cabinet').scrollIntoView({block:'center'});const style=document.createElement('style');style.textContent='#overlay,#title-screen{display:none!important}';document.head.append(style)");
  const shot=async name=>{const r=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.resolve('docs/game-screenshots/slop-in-time-pixel-'+name+'.png'),Buffer.from(r.data,'base64'));};
  for(let era=0;era<6;era++){
    const result=await evaluate(`(()=>{
      const e=__gameslop.engine,r=__gameslop.renderer;e.start({difficulty:'normal'});for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}e.state.status='paused';e.state.transition=0;e.state.players=[];e.state.enemies=[];e.state.props=[];
      const s=e.state,art=SlopInTime.stages[s.stage],ratio=(4352-960)/(art.width-960),ctx=document.querySelector('canvas').getContext('2d'),differences=[];
      for(const offset of [1408,2816]){s.camera=offset/ratio;s.cameraY=SlopInTime.content.floor(art,s.camera+310);r.draw(s,0);const a=ctx.getImageData(0,170,960,140).data;s.camera+=2;r.draw(s,0);const b=ctx.getImageData(0,170,960,140).data;let difference=0;for(let i=0;i<a.length;i+=4)difference+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);differences.push(difference/(a.length*.75));}
      s.camera=art.width-960;s.cameraY=art.depth;r.draw(s,0);const end=ctx.getImageData(850,180,100,100).data;let occupied=0;for(let i=0;i<end.length;i+=4)if(end[i]+end[i+1]+end[i+2]>45)occupied++;
      return {differences,occupied};})()`);
    assert.ok(result.differences.every(n=>n<45),'continuous scenery joins era '+era);assert.ok(result.occupied>200,'background covers route end '+era);await shot('era-'+(era+1)+'-end');
    await evaluate(`(()=>{const e=__gameslop.engine;e.start();for(let i=0;i<${era};i++){e.state.status='clear';e.advance();}e.state.gate=9;const p=e.state.players[0];p.x=SlopInTime.stages[e.state.stage].encounters[9]-300;p.y=416+SlopInTime.content.floor(SlopInTime.stages[e.state.stage],p.x);e.state.cameraY=SlopInTime.content.floor(SlopInTime.stages[e.state.stage],p.x);e.state.camera=p.x-310;p.invincible=100;e.tick();const b=e.state.enemies.find(x=>x.boss);e.state.enemies=[b];Object.assign(b,{x:b.entrance.landX,y:b.entrance.landY,z:0,entrance:null});e.state.props=[];b.hp=b.maxHp*.28;b.superTimer=0;b.cooldown=0;for(let i=0;i<70;i++)e.tick();e.state.transition=0;window.__boss=b;e.state.status='paused';__gameslop.renderer.draw(e.state,0);})()`);
    assert.ok(await evaluate('__boss.enraged&&__gameslop.engine.state.hazards.length>=2&&__boss.y-__gameslop.engine.state.cameraY<490'),'red boss and superpower era '+era);
    // Freeze the same pose and compare actual sprite pixels before/after rage.
    const redPixels=await evaluate(`(()=>{const s=__gameslop.engine.state,r=__gameslop.renderer,b=__boss,ctx=document.querySelector('canvas').getContext('2d'),x=Math.max(0,Math.round(b.x-s.camera-75)),y=Math.round(b.y-(s.cameraY||0)-165);b.hp=b.maxHp;r.draw(s,0);const a=ctx.getImageData(x,y,150,160).data;b.hp=b.maxHp*.28;r.draw(s,0);const z=ctx.getImageData(x,y,150,160).data;let changed=0;for(let i=0;i<a.length;i+=4)if(z[i]>z[i+1]*2&&z[i]>z[i+2]*2&&Math.abs(z[i]-a[i])+Math.abs(z[i+1]-a[i+1])>25)changed++;return changed;})()`);
    assert.ok(redPixels>400,'boss pixels switch to persistent red palette era '+era);
    // Keep the HTML pause overlay away from visual combat captures.
    await evaluate("document.querySelector('#overlay').hidden=true");await shot('era-'+(era+1)+'-boss');await evaluate('__boss.hp=__boss.maxHp;__gameslop.renderer.draw(__gameslop.engine.state,0)');await shot('era-'+(era+1)+'-boss-normal');console.log('PASS long panorama, seam continuity, red boss and unique power: era '+(era+1));
  }
  assert.deepEqual(await evaluate('__errors'),[]);console.log('All 16-bit campaign browser checks passed.');
};
