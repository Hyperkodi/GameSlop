'use strict';
window.EJS_player='#emulator';
window.EJS_core=new URLSearchParams(location.search).get('core')==='parallel'?'parallel_n64':'mupen64plus_next';
window.EJS_pathtodata='runtime/';
const originalBond=new URLSearchParams(location.search).get('original')==='1';
// Preserve the roster save namespace when only the title branding changes.
window.EJS_gameName=originalBond?'Gameslop GoldenEye USA Original':'Gameslop GoldenEye Roster v1';
window.EJS_color='#ff4439';
window.EJS_backgroundColor='#101312';
window.EJS_startOnLoaded=true;
window.EJS_language='en-US';
window.EJS_disableAutoLang=true;
window.EJS_threads=false;
window.EJS_defaultOptions={webgl2Enabled:'enabled','save-state-location':'browser','save-save-interval':'30'};
window.EJS_Buttons={saveState:true,loadState:true,gamepad:true,settings:true,volume:true,fullscreen:true,screenRecord:false,netplay:false};
window.EJS_defaultControls={0:{
  0:{value:'x',value2:'BUTTON_1'},1:{value:'z',value2:'BUTTON_3'},8:{value:'',value2:'BUTTON_2'},9:{value:'',value2:'BUTTON_4'},3:{value:'enter',value2:'START'},
  4:{value:'up arrow',value2:'DPAD_UP'},5:{value:'down arrow',value2:'DPAD_DOWN'},6:{value:'left arrow',value2:'DPAD_LEFT'},7:{value:'right arrow',value2:'DPAD_RIGHT'},
  10:{value:'q',value2:'LEFT_TOP_SHOULDER'},11:{value:'e',value2:'RIGHT_TOP_SHOULDER'},12:{value:'space',value2:'LEFT_BOTTOM_SHOULDER'},
  16:{value:'d',value2:'LEFT_STICK_X:+1'},17:{value:'a',value2:'LEFT_STICK_X:-1'},18:{value:'s',value2:'LEFT_STICK_Y:+1'},19:{value:'w',value2:'LEFT_STICK_Y:-1'},
  20:{value:'l',value2:'RIGHT_STICK_X:+1'},21:{value:'j',value2:'RIGHT_STICK_X:-1'},22:{value:'k',value2:'RIGHT_STICK_Y:+1'},23:{value:'i',value2:'RIGHT_STICK_Y:-1'}
},1:{},2:{},3:{}};
window.EJS_onGameStart=()=>{
  parent.postMessage({type:'started'},location.origin);
  window.installGoldenEyeMouseControls(window.EJS_emulator);
};
// These APIs are tied to the pinned EmulatorJS 4.2.3 runtime manifest.
window.GoldenEyeLocal={async flushSaves(){
  const manager=window.EJS_emulator?.gameManager;if(!manager)return;
  manager.saveSaveFiles();
  await new Promise((resolve,reject)=>manager.FS.syncfs(false,error=>error?reject(error):resolve()));
}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.GoldenEyeLocal.flushSaves().catch(()=>{});});
window.addEventListener('error',event=>parent.postMessage({type:'error',message:event.message},location.origin));
window.addEventListener('unhandledrejection',event=>parent.postMessage({type:'error',message:String(event.reason)},location.origin));

// EmulatorJS 4.2.3 caches ROMs by URL filename and Content-Length, not bytes.
// A rebuilt N64 ROM has the same length, so use its full content hash in the
// cache key. Keep gameName and the URL basename stable to preserve saves.
(async()=>{
  const response=await fetch('build-manifest.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the current game build. Restart the local launcher.');
  const manifest=await response.json(),build=manifest[originalBond?'original':'roster'];
  if(manifest.schema!==1||!/^[a-f0-9]{64}$/.test(build?.sha256))throw new Error('Invalid game build manifest.');
  const expectedFile=originalBond?'data/goldeneye.z64':'data/goldeneye-slop64.z64';
  if(build.file!==expectedFile)throw new Error('Unexpected game file in build manifest.');
  const url=new URL(build.file,location.href);url.searchParams.set('build',build.sha256);
  window.EJS_gameUrl=url.href;
  window.GoldenEyeLocal.build={mode:originalBond?'original':'roster',sha256:build.sha256};
  const loader=document.createElement('script');loader.src='runtime/loader.js';
  loader.onerror=()=>parent.postMessage({type:'error',message:'Could not load the emulator runtime.'},location.origin);
  document.body.append(loader);
})().catch(error=>{
  document.getElementById('emulator').textContent=error.message;
  parent.postMessage({type:'error',message:error.message},location.origin);
});
