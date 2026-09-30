const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function fixture({state=1,rejected=false}={}){
 const videos=[],posters=[],drawn=[];
 const sandbox={window:{},matchMedia:()=>({matches:false}),BitDogEnvironment:{loadImage:()=>{const p={complete:true,naturalWidth:1280,naturalHeight:604};posters.push(p);return p;}},document:{createElement:()=>{const v={readyState:state,duration:state>=2?5:NaN,currentTime:0,ended:false,seeking:false,videoWidth:1280,videoHeight:604,playCalls:0,setAttribute(){},addEventListener(){},pause(){this.paused=true;},play(){this.playCalls++;this.paused=false;return rejected?Promise.reject(Object.assign(new Error('Denied'),{name:'NotAllowedError'})):Promise.resolve();}};videos.push(v);return v;}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/intro-video.js'),'utf8'),sandbox);
 const player=sandbox.window.BitDogIntroVideo.create({fillRect(){},drawImage(im){drawn.push(im);}});
 return {player,videos,posters,drawn};
}
test('deferred video frames never block starting; playback is requested before loadeddata',()=>{
 const {player,videos,posters,drawn}=fixture();assert.equal(player.ready,true);
 player.draw({id:'throw',local:0},600,400);
 assert.equal(videos[0].playCalls,1);assert.equal(drawn.at(-1),posters[0]);assert.equal(videos[0].playbackRate,undefined);
 videos[0].readyState=2;videos[0].duration=5;
 player.draw({id:'throw',local:.2},600,400);assert.equal(drawn.at(-1),videos[0]);assert.ok(Number.isFinite(videos[0].playbackRate));
});
test('denied video playback retains the approved poster and does not block the next shot',async()=>{
 const {player,videos,posters,drawn}=fixture({rejected:true});
 player.draw({id:'throw',local:0},600,400);await Promise.resolve();
 player.draw({id:'throw',local:.2},600,400);assert.equal(drawn.at(-1),posters[0]);assert.equal(player.ready,true);
 player.draw({id:'sprint',local:0},600,400);await Promise.resolve();assert.equal(videos[1].playCalls,1);
 player.stop();assert.ok(videos.every(v=>v.paused));
});
test('posters are required and pausing does not trigger deferred playback',()=>{
 const {player,videos,posters}=fixture();posters[0].naturalWidth=0;assert.equal(player.ready,false);posters[0].naturalWidth=1280;
 player.draw({id:'throw',local:0},600,400,true);assert.equal(videos[0].playCalls,0);
 player.draw({id:'throw',local:0},600,400,false);assert.equal(videos[0].playCalls,1);
});
