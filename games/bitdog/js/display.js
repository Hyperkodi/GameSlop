(function(){
 const app=document.querySelector('.app'),button=document.getElementById('fullscreen');
 const embedded=window.self!==window.top||new URLSearchParams(location.search).get('embed')==='1';
 document.body.classList.toggle('embedded',embedded);
 let theatre=false;
 function paint(){
  const full=!!document.fullscreenElement||theatre;
  document.body.classList.toggle('fullscreen-game',full);
  button.textContent=full?'EXIT FULL SCREEN':'FULL SCREEN';
  button.setAttribute('aria-pressed',String(full));
  dispatchEvent(new Event('resize'));
 }
 button.addEventListener('click',async()=>{
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else if(theatre)theatre=false;
   else if(app.requestFullscreen&&document.fullscreenEnabled)await app.requestFullscreen();
   else theatre=true;
  }catch{theatre=!theatre;}
  paint();
 });
 document.addEventListener('fullscreenchange',paint);
 addEventListener('keydown',e=>{if(e.code==='Escape'&&theatre){theatre=false;paint();}});
 paint();
})();
