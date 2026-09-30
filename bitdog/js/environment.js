(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function loadImage(src){
  const image=new Image();let retry=0;
  image.addEventListener('error',()=>{if(retry<3){retry++;setTimeout(()=>{image.src=src+(src.includes('?')?'&':'?')+'retry='+retry;},retry*400);}});
  image.src=src;return image;
 }
 function layout(manifest,width,height,camera,end=22000){
  const scale=Math.max(height/manifest.height,width*1.5/manifest.width);
  const travel=Math.max(0,manifest.width*scale-width),progress=clamp(camera/Math.max(1,end-width),0,1);
  const offset=travel*progress,y=(height-manifest.height*scale)/2;
  return {scale,offset,y,travel,visible:manifest.tiles.map((t,index)=>({index,x:t.x*scale-offset,y,w:t.w*scale,h:t.h*scale})).filter(t=>t.x<width&&t.x+t.w>0)};
 }
 function create(c,levelId=1){
  const themes={1:['environment','Environment'],2:['orchard','Orchard'],3:['electric','Electric'],4:['moonwood','Moonwood'],5:['snow','Snow'],6:['carnival','Carnival'],7:['moon','Moon'],8:['backyard','Backyard']};
  const [folder,key]=themes[levelId]||themes[1],manifest=root['BitDog'+key+'Manifest'],base='art/environment/',scene='art/'+folder+'/';
  const loaded=new Map(),load=src=>{if(!loaded.has(src))loaded.set(src,loadImage(src));return loaded.get(src);};
  const master=load(scene+manifest.master),tiles=manifest.tiles.map(t=>load(scene+t.file)),pov=load(scene+(levelId>1?'pov-v1.png':'satoshi-park-pov-v1.png'));
  const orchardArt=[2,8].includes(levelId)?load('art/orchard/props-v1.png'):null;
  const orchardBoxes={hay:[1102,230,418,220],leaves:[12,695,567,250],apples:[597,579,411,369],tree:[1021,480,515,480]};
  const structures={};
  if([3,8].includes(levelId))for(const kind of ['workshop','pole','barrier'])structures[kind]=load('art/electric/'+kind+'-v1.png');
  if([2,8].includes(levelId))for(const kind of ['bins','wagon','loading'])structures[kind]=load('art/orchard/harvest-'+kind+'-v1.png');
  const assets=Object.fromEntries(Object.entries(manifest.assets||{}).map(([kind,meta])=>[kind,{...meta,image:load(scene+meta.file)}]));
  const props=load(base+'park-props-v1.png'),owner=load('art/sprites/owner-poses-v1.png'),waitingOwner=load('art/sprites/owner-waiting-cap-v2.png'),homeHouse=load('art/environment/doghouse-right-v2.png'),groundArt=load(levelId>=3?scene+'ground-v1.png':base+'park-ground-v1.png');
  const groundChunks=new Map(),groundChunkWidth=1024;
  const obstacles=load(base+'park-obstacles-v1.png');
  const fences=load(base+'fence-perspective-v2.png');
  const fenceBoxes=[[69,72,580,584],[775,173,660,483],[1520,332,636,345]];
  const obstacleBoxes={pond:[10,160,758,330],tunnel:[799,183,733,303],boardwalk:[24,720,905,210],rock:[960,670,570,256]};
  const ok=im=>im.complete&&im.naturalWidth>0;
  const boxes={tree:[23,24,572,528],house:[610,141,438,378],crate:[1147,215,340,305],fence:[77,619,456,330],coin:[621,599,359,356],sign:[1109,576,388,400]};
  const ownerBoxes=[[95,16,240,491,110],[458,19,226,488,112],[824,14,279,493,115],[1167,13,303,499,158],[62,521,300,486,131],[433,520,344,487,119],[845,520,216,487,108],[1160,582,360,420,180]];
  function drawBackground(camera,W,H){
   const p=layout(manifest,W,H,camera);c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
   if(tiles.every(ok))for(const t of p.visible)c.drawImage(tiles[t.index],t.x,t.y,t.w,t.h);
   else if(ok(master))c.drawImage(master,-p.offset,p.y,manifest.width*p.scale,manifest.height*p.scale);
   else {c.restore();return false;}
   c.restore();return true;
  }
  function drawPOV(W,H){if(!ok(pov))return false;const scale=Math.max(W/pov.naturalWidth,H/pov.naturalHeight),w=pov.naturalWidth*scale,h=pov.naturalHeight*scale;c.drawImage(pov,(W-w)/2,(H-h)/2,w,h);return true;}
  function groundChunk(block,H,ground){
   const cacheKey=block+':'+H;
   if(groundChunks.has(cacheKey)){const cached=groundChunks.get(cacheKey);groundChunks.delete(cacheKey);groundChunks.set(cacheKey,cached);return cached;}
   const canvas=document.createElement('canvas'),g=canvas.getContext('2d');
   canvas.width=groundChunkWidth+4;canvas.height=H+364;
   const origin=block*groundChunkWidth-2,sw=groundArt.naturalWidth,sh=groundArt.naturalHeight,period=sw/2;
   // Prepaint the original two-pixel terrain samples once. A four-pixel overlap
   // makes adjacent cached chunks sample the same source pixels at their join.
   for(let x=origin;x<origin+canvas.width;x+=2){
    const pos=x+400,tile=Math.floor(pos/period),local=((pos%period)+period)%period,reverse=Math.abs(tile%2)===1;
    const sx=clamp(reverse?sw-local*2-4:local*2,0,sw-4),y=ground(x),dx=x-origin;
    g.save();g.translate(reverse?dx+2.1:dx,y);if(reverse)g.scale(-1,1);
    g.drawImage(groundArt,sx,0,4,sh,0,0,2.1,H-y+3);
    // Fade the deep foreground into soil rather than stretching the last
    // texture row into long streaks when the mobile camera raises the path.
    const deep=g.createLinearGradient(0,H-y-32,0,H-y+48);
    deep.addColorStop(0,levelId===3?'#68675e00':'#76502d00');
    deep.addColorStop(1,levelId===3?'#68675e':'#76502d');
    g.fillStyle=deep;g.fillRect(0,H-y-32,2.1,396);g.restore();
   }
   groundChunks.set(cacheKey,canvas);
   if(groundChunks.size>5)groundChunks.delete(groundChunks.keys().next().value);
   return canvas;
  }
  function drawGround(camera,W,H,ground){
   if(!ok(groundArt))return false;
   if(levelId>=4){
    // Clip a continuous, world-anchored texture to the terrain. Drawing narrow
    // rescaled image strips produces visible vertical sampling lines on snow
    // and planks, and makes the ground shimmer while the camera moves.
    const left=camera-4,right=camera+W+4,period=groundArt.naturalWidth/2;
    c.save();c.beginPath();c.moveTo(left,H+400);
    for(let x=left;x<=right+4;x+=4)c.lineTo(x,ground(x));
    c.lineTo(right+4,H+400);c.closePath();c.clip();
    for(let block=Math.floor(left/period);block*period<right;block++){
     const x=block*period,reverse=Math.abs(block%2)===1;
     c.save();c.translate(reverse?x+period:x,0);if(reverse)c.scale(-1,1);
     c.drawImage(groundArt,0,400,period+.2,H-376);
     c.drawImage(groundArt,0,groundArt.naturalHeight-100,groundArt.naturalWidth,100,0,H+23,period+.2,380);c.restore();
    }
    c.restore();return true;
   }
   for(let block=Math.floor((camera-4)/groundChunkWidth);block*groundChunkWidth<camera+W+4;block++)
    c.drawImage(groundChunk(block,H,ground),block*groundChunkWidth-2,0);
   return true;
  }
  function prop(kind,x,y,w,h){if(!ok(props))return false;const b=boxes[kind];h??=w*b[3]/b[2];c.drawImage(props,...b,x-w/2,y-h,w,h);return true;}
  function orchard(kind,x,y,w,h){if(!orchardArt||!ok(orchardArt)||!orchardBoxes[kind])return false;const b=orchardBoxes[kind];h??=w*b[3]/b[2];c.drawImage(orchardArt,...b,x-w/2,y-h,w,h);return true;}
  function asset(kind,x,foot,w,h){
   const a=assets[kind];if(!a||!ok(a.image))return false;
   const sw=a.image.naturalWidth,sh=a.image.naturalHeight;h??=w*sh/sw;
   c.drawImage(a.image,x-w/2,foot-(a.foot??sh)*h/sh,w,h);return true;
  }
  function obstacleAsset(kind,x,foot,height){
   const a=assets[kind];if(!a||!ok(a.image))return false;
   const top=a.alphaBounds?.[1]??0,sourceFoot=a.foot??a.image.naturalHeight;
   return asset(kind,x,foot,a.image.naturalWidth*height/Math.max(1,sourceFoot-top));
  }
  function structure(p,compression=1){const a=p.art;if(a?.kind==='hay')return orchard('hay',a.x+a.w/2,a.foot,a.w,a.h);const im=a&&(structures[a.kind]||assets[a.kind]?.image);if(!im||!ok(im))return false;
   c.save();if(compression!==1){c.translate(a.x+a.w/2,a.foot??a.y+a.h);c.scale(1,compression);c.translate(-a.x-a.w/2,-(a.foot??a.y+a.h));}c.drawImage(im,a.x,a.y,a.w,a.h);c.restore();return true;}
  function pole(x,wireY,foot){const im=structures.pole;if(!im||!ok(im))return false;const scale=(foot-wireY)/(1700-148);c.drawImage(im,x-465*scale,wireY-148*scale,887*scale,1774*scale);return true;}
  function junction(x,y){const im=structures.pole;if(!im||!ok(im))return false;c.drawImage(im,420,133,100,112,x-15,y-26,30,34);return true;}
  function barrier(x,y,h){const im=structures.barrier;if(!im||!ok(im))return false;const scale=h/663;c.drawImage(im,x-830*scale,y-844*scale,im.naturalWidth*scale,im.naturalHeight*scale);return true;}
  function obstacle(kind,x,y,w,h){
   if(!ok(obstacles))return false;const b=obstacleBoxes[kind];h??=w*b[3]/b[2];
   if(kind==='tunnel'){
    // Preserve round entrances; only the straight cutaway interior stretches.
    const cap=165,dw=cap*h/b[3];
    c.drawImage(obstacles,b[0],b[1],cap,b[3],x-w/2,y-h,dw,h);
    c.drawImage(obstacles,b[0]+cap,b[1],b[2]-2*cap,b[3],x-w/2+dw,y-h,w-2*dw,h);
    c.drawImage(obstacles,b[0]+b[2]-cap,b[1],cap,b[3],x+w/2-dw,y-h,dw,h);
   }else c.drawImage(obstacles,...b,x-w/2,y-h,w,h);return true;
  }
  function drawOwner(frame,x,y,height){if(!ok(owner))return false;const [sx,sy,sw,sh,anchor]=ownerBoxes[frame],scale=height/sh;c.drawImage(owner,sx,sy,sw,sh,x-anchor*scale,y-height,sw*scale,height);return true;}
  function drawHomeHouse(x,foot,width){
   if(!ok(homeHouse))return false;
   const scale=width/1077;
   // Anchor the wooden threshold, not the transparent image edge or grass.
   c.drawImage(homeHouse,160,106,1077,924,x-width/2,foot-(1010-106)*scale,width,924*scale);
   return true;
  }
  function drawWaitingOwner(x,y,height,direction){
   if(!ok(waitingOwner))return false;
   // Trim transparent padding at draw time; the soles stay on the trail.
   const scale=height/1432;
   c.save();c.translate(x,y);c.scale(direction,1);
   c.drawImage(waitingOwner,200,14,620,1432,-310*scale,-height,620*scale,height);
   c.restore();return true;
  }
  function fence(frame,x,y,height){if(!ok(fences))return false;const b=fenceBoxes[frame],scale=height/fenceBoxes[0][3];c.drawImage(fences,...b,x-b[2]*scale/2,y-b[3]*scale,b[2]*scale,b[3]*scale);return true;}
  return {drawBackground,drawPOV,drawGround,prop,orchard,asset,obstacleAsset,structure,pole,junction,barrier,obstacle,fence,drawOwner,drawWaitingOwner,drawHomeHouse,get ready(){return [...tiles,master,pov,props,owner,waitingOwner,homeHouse,groundArt,obstacles,fences,...Object.values(structures),...Object.values(assets).map(a=>a.image),...(orchardArt?[orchardArt]:[])].every(ok);},get manifest(){return manifest;}};
 }
 const api={layout,create,loadImage};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BitDogEnvironment=api;
})(typeof window!=='undefined'?window:globalThis);
