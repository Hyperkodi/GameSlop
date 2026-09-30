(function(root){
 'use strict';
 const defaults={left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],jump:['Space','ArrowUp','KeyW'],sprint:['ShiftLeft','ShiftRight'],roll:['KeyS','ArrowDown'],pause:['Escape','KeyP'],skip:['Enter']};
 const names={left:'Run left',right:'Run right',jump:'Jump',sprint:'Sprint',roll:'Roll',pause:'Pause / resume',skip:'Skip intro'};
 const storageKey='gameslop:bitdog:controls:v1';
 const copyDefaults=()=>Object.fromEntries(Object.entries(defaults).map(([action,keys])=>[action,[...keys]]));
 const label=code=>({Space:'Space',Escape:'Esc',ArrowLeft:'Left arrow',ArrowRight:'Right arrow',ArrowUp:'Up arrow',ArrowDown:'Down arrow',ShiftLeft:'Left Shift',ShiftRight:'Right Shift'}[code]||code.replace(/^Key|^Digit/,'').replace(/([a-z])([A-Z])/g,'$1 $2'));
 function create({clearInput,levelName}){
  const $=id=>document.getElementById(id),dialog=$('controls-dialog');
  let bindings=copyDefaults(),capture=null;
  try{
   const saved=JSON.parse(localStorage.getItem(storageKey));
   if(saved&&Object.keys(defaults).every(a=>Array.isArray(saved[a])&&saved[a].length===defaults[a].length&&saved[a].every(k=>typeof k==='string'&&/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(k)))&&new Set(Object.values(saved).flat()).size===Object.values(saved).flat().length)bindings=saved;
  }catch{}
  // Upgrade a saved copy of the old defaults without overwriting custom keys.
  const oldDefaults={...defaults,roll:['KeyX','ArrowDown']};
  if(Object.keys(defaults).every(a=>JSON.stringify(bindings[a])===JSON.stringify(oldDefaults[a])))bindings=copyDefaults();
  function paint(){
   const list=$('controls-bindings');list.replaceChildren();
   for(const [action,keys] of Object.entries(bindings)){
    const row=document.createElement('div'),name=document.createElement('strong'),buttons=document.createElement('div');row.className='binding-row';name.textContent=names[action];row.append(name,buttons);
    keys.forEach((code,index)=>{
     const button=document.createElement('button');button.textContent=label(code);button.dataset.action=action;button.dataset.slot=index;button.setAttribute('aria-label',`${names[action]}: ${label(code)}. Change key`);
     button.onclick=()=>{capture={action,index};button.textContent='Press a key…';$('controls-status').textContent=`Press a new key for ${names[action]}. Click Done to cancel.`;};buttons.append(button);
    });list.append(row);
   }
   const instructions=document.querySelector('.desktop-instructions');instructions.replaceChildren();
   for(const action of ['left','right','jump','sprint','roll']){const key=document.createElement('kbd');key.textContent=label(bindings[action][0]);instructions.append(key,document.createTextNode(' '+names[action].toLowerCase()+' '));}
   $('skip-intro').textContent=label(bindings.skip[0])+' to skip intro';
   $('skip-intro').removeAttribute('aria-keyshortcuts');
   $('game').setAttribute('aria-label',levelName()+'. '+Object.keys(names).map(a=>names[a]+': '+bindings[a].map(label).join(' or ')).join('. '));
  }
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(bindings));$('controls-status').textContent='Saved on this device.';}catch{$('controls-status').textContent='Applied for this visit. Browser storage is unavailable.';}paint();clearInput();}
  const isOpen=()=>dialog.hasAttribute('open');
  $('controls-setup').onclick=()=>{clearInput();capture=null;paint();if(dialog.showModal)dialog.showModal();else{dialog.setAttribute('open','');dialog.classList.add('dialog-fallback');}};
  $('controls-done').onclick=()=>{if(dialog.close)dialog.close();else{dialog.removeAttribute('open');capture=null;clearInput();}};
  $('controls-reset').onclick=()=>{bindings=copyDefaults();capture=null;save();};
  dialog.addEventListener('close',()=>{capture=null;clearInput();});
  dialog.addEventListener('cancel',e=>{if(capture)e.preventDefault();});
  addEventListener('keydown',e=>{
   if(!isOpen())return;
   if(!capture){e.stopImmediatePropagation();return;}
   e.preventDefault();e.stopImmediatePropagation();
   if(e.repeat||!e.code||e.code==='Unidentified')return;
   const {action,index}=capture,old=bindings[action][index];
   for(const keys of Object.values(bindings))for(let i=0;i<keys.length;i++)if(keys[i]===e.code)keys[i]=old;
   bindings[action][index]=e.code;capture=null;save();
   document.querySelector(`[data-action="${action}"][data-slot="${index}"]`).focus();
  },true);
  return {paint,label,codes:action=>bindings[action],matches:(action,code)=>bindings[action].includes(code),isOpen,isMovement:code=>['left','right','jump','sprint','roll'].some(a=>bindings[a].includes(code))};
 }
 root.BitDogControls={create};
})(window);
