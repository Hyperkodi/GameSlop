(function(root){
  'use strict';
  root.BitDogIntroVideo={create(c,levelId=1){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const theme={1:'cinematics',2:'orchard',3:'electric',4:'moonwood',5:'snow',6:'carnival',7:'moon',8:'backyard'}[levelId]||'cinematics';
    const clips=Object.fromEntries(['throw','sprint'].map(id=>{
      const video=document.createElement('video'),poster=BitDogEnvironment.loadImage(`art/${theme}/${id}-poster.jpg`);
      video.muted=true;video.playsInline=true;video.preload='auto';
      video.src=levelId>1?`art/${theme}/${id}-kling-v1.mp4`:`art/cinematics/${id}-kling-${id==='throw'?'v3':'v1'}.mp4`;
      return [id,{video,poster,failed:false}];
    }));
    for(const clip of Object.values(clips))clip.video.addEventListener('error',()=>{clip.failed=true;});
    let active=null,playing=false,lastRateUpdate=-1;
    function stop(){for(const {video} of Object.values(clips))video.pause();active=null;playing=false;}
    function draw(shot,W,H,paused=false){
      const clip=clips[shot.id];
      if(!clip){stop();return false;}
      const {video,poster}=clip,duration=shot.id==='throw'?4:3.3;
      const playable=!reduced&&!clip.failed&&video.readyState>=2;
      if(active!==shot.id){stop();active=shot.id;lastRateUpdate=-1;if(playable&&video.currentTime>.01)video.currentTime=0;}
      if(playable){
        const rate=video.duration/duration,target=Math.min(video.duration-.04,Math.max(0,shot.local*rate));
        // Follow the timeline with small rate corrections, never in-play seeks.
        // Seeking a progressive MP4 can reset decoding and show its poster.
        if(!paused&&(lastRateUpdate<0||shot.local-lastRateUpdate>.2)){
          video.playbackRate=rate*Math.max(.8,Math.min(1.15,1-(video.currentTime-target)*.6));
          lastRateUpdate=shot.local;
        }
        if(paused){video.pause();playing=false;}
        else if(!playing&&!video.ended){playing=true;video.play().catch(()=>{playing=false;clip.failed=true;});}
      }
      // A replay can briefly seek back from its last frame. Keep the approved
      // first frame visible until that seek completes, avoiding a flash of the end.
      const showVideo=playable&&!(video.seeking&&shot.local<.12);
      const image=showVideo?video:poster;
      const iw=showVideo?video.videoWidth:poster.naturalWidth,ih=showVideo?video.videoHeight:poster.naturalHeight;
      c.fillStyle='#263729';c.fillRect(0,0,W,H);
      if(!iw||!ih)return true;
      // Contain the full shot on narrow screens: never crop a muzzle, paw,
      // throwing hand or owner out to make a landscape movie fill portrait.
      const scale=Math.min(W/iw,H/ih),w=iw*scale,h=ih*scale;
      c.drawImage(image,(W-w)/2,(H-h)/2,w,h);
      return true;
    }
    async function seek(shot){
      const clip=clips[shot.id];if(!clip||reduced||clip.failed)return;
      const video=clip.video;video.pause();playing=false;active=shot.id;
      if(video.readyState<2)await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',reject,{once:true});});
      const target=Math.max(0,Math.min(video.duration-.04,shot.local*video.duration/(shot.id==='throw'?4:3.3)));
      if(Math.abs(video.currentTime-target)<.001)return;
      await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=target;});
    }
    return {draw,stop,seek,pause(){for(const {video}of Object.values(clips))video.pause();playing=false;},get ready(){return Object.values(clips).every(({video,poster,failed})=>poster.complete&&poster.naturalWidth&&(reduced||failed||video.readyState>=2));},
      get status(){return Object.fromEntries(Object.entries(clips).map(([id,{video,failed}])=>[id,{time:video.currentTime,ready:video.readyState,paused:video.paused,failed,frames:video.getVideoPlaybackQuality?.().totalVideoFrames,dropped:video.getVideoPlaybackQuality?.().droppedVideoFrames}]));}};
  }};
})(window);
