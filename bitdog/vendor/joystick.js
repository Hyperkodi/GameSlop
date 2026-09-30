/* Gameslop mobile directional controls. Joysticks only; action buttons stay separate. */
(function(root){
  'use strict';
  function create(element,{onChange=()=>{},onMove=()=>{},enabled=()=>true,axes='both',signal}={}){
    element.classList.add('slop-joystick');element.setAttribute('data-mobile-joystick','');
    const thumb=document.createElement('span');thumb.className='slop-joystick-thumb';thumb.setAttribute('aria-hidden','true');element.replaceChildren(thumb);
    let pointer=null,direction=null;const events=[];
    const on=(target,type,fn)=>{target.addEventListener(type,fn);events.push([target,type,fn]);};
    function reset(){
      const id=pointer;pointer=null;direction=null;element.classList.remove('active');delete element.dataset.direction;
      element.style.setProperty('--stick-x','0px');element.style.setProperty('--stick-y','0px');
      if(id!==null){onChange(null);onMove({x:0,y:0});if(element.hasPointerCapture?.(id))element.releasePointerCapture(id);}
    }
    function update(event){
      if(!enabled()){reset();return;}
      const box=element.getBoundingClientRect(),radius=Math.min(box.width,box.height)*.3;
      if(!radius)return;
      let x=axes==='vertical'?0:(event.clientX-box.left-box.width/2)/radius;
      let y=axes==='horizontal'?0:(event.clientY-box.top-box.height/2)/radius;
      const length=Math.hypot(x,y),scale=Math.max(1,length);x/=scale;y/=scale;
      element.style.setProperty('--stick-x',x*radius+'px');element.style.setProperty('--stick-y',y*radius+'px');
      let next=null;
      if(length>=.2){
        const horizontal=Math.abs(x),vertical=Math.abs(y);
        const keepHorizontal=['left','right'].includes(direction)&&vertical<horizontal*1.15;
        const keepVertical=['up','down'].includes(direction)&&horizontal<vertical*1.15;
        next=keepHorizontal||(!keepVertical&&horizontal>vertical)?x<0?'left':'right':y<0?'up':'down';
      }
      if(next!==direction){direction=next;element.dataset.direction=next||'';onChange(next);}
      onMove(length<.2?{x:0,y:0}:{x,y});
    }
    on(element,'pointerdown',event=>{if(pointer!==null||event.button!==0||!enabled())return;event.preventDefault();pointer=event.pointerId;element.setPointerCapture(pointer);element.classList.add('active');update(event);});
    on(element,'pointermove',event=>{if(event.pointerId===pointer){event.preventDefault();update(event);}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])on(element,type,event=>{if(event.pointerId===pointer)reset();});
    on(element,'contextmenu',event=>event.preventDefault());on(window,'blur',reset);on(window,'resize',reset);
    on(document,'visibilitychange',()=>{if(document.hidden)reset();});
    const destroy=()=>{reset();events.forEach(([target,type,fn])=>target.removeEventListener(type,fn));signal?.removeEventListener('abort',destroy);};
    signal?.addEventListener('abort',destroy,{once:true});return {reset,destroy};
  }
  root.GameslopJoystick={create};
})(typeof window==='undefined'?globalThis:window);
