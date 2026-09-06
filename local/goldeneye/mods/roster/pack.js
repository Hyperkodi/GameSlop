// Format conversion: generated artwork -> N64 CI4 (16-colour indexed) textures.
const names=['Donald Trump','Melania Trump','Donald Trump Jr.','Eric Trump','Ivanka Trump','Tiffany Trump','Barron Trump','JD Vance','Benjamin Netanyahu','Anthony Fauci','Osama bin Laden','Barack Obama','Michelle Obama','Bill Clinton','Hillary Clinton','Bill Gates','Pepe','Shiba Inu','Brett','Squirrel','Vlad Tenev','Celina Tenev'];
window.packedTextures=[];
function quantize(pixels){
 let boxes=[pixels.slice()];
 function range(box){return [0,1,2].map(c=>Math.max(...box.map(p=>p[c]))-Math.min(...box.map(p=>p[c])));}
 while(boxes.length<16){
  boxes.sort((a,b)=>Math.max(...range(b))*b.length-Math.max(...range(a))*a.length);
  const box=boxes.shift(),r=range(box),axis=r.indexOf(Math.max(...r));box.sort((a,b)=>a[axis]-b[axis]);
  const middle=Math.floor(box.length/2);boxes.push(box.slice(0,middle),box.slice(middle));
 }
 return boxes.map(box=>[0,1,2].map(c=>Math.round(box.reduce((s,p)=>s+p[c],0)/box.length)));
}
for(const [file,grid,start] of [['public-figures.png',4,0],['scientists.png',2,16],['vlad-tenev.png',1,20],['celina-tenev.png',1,21]]){
 const image=new Image();image.src='art/'+file;await image.decode();
 for(let cell=0;cell<grid*grid;cell++){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const size=image.width/grid,originX=cell%grid*size,originY=Math.floor(cell/grid)*size;
  // Use the available pixels for facial features instead of the atlas backdrop.
  // Long hair and headwear need individual crops to retain identity cues.
  const crops=[[.08,.10,.84,.90],[.18,.19,.68,.80],[.09,.13,.83,.86],[.08,.13,.84,.86],
    [.19,.20,.66,.79],[.16,.17,.69,.82],[.09,.13,.83,.86],[.09,.13,.83,.86],
    [.08,.10,.84,.89],[.08,.10,.84,.89],[.10,.08,.80,.91],[.08,.10,.84,.89],
    [.16,.17,.71,.82],[.08,.08,.84,.91],[.16,.17,.71,.82],[.08,.10,.84,.89]];
  const crop=start===0?crops[cell]:start===20?[.05,.02,.9,.98]:start===21?[.13,.02,.78,.92]:[0,0,1,1];
  ctx.drawImage(image,originX+crop[0]*size,originY+crop[1]*size,crop[2]*size,crop[3]*size,0,0,32,32);
  const rgba=ctx.getImageData(0,0,32,32),pixels=Array.from({length:1024},(_,i)=>Array.from(rgba.data.slice(i*4,i*4+3)));
  const palette=quantize(pixels),indices=pixels.map(p=>{let best=0,d=Infinity;palette.forEach((c,i)=>{const v=c.reduce((s,n,j)=>s+(n-p[j])**2,0);if(v<d){d=v;best=i;}});return best;});
  indices.forEach((v,i)=>palette[v].forEach((c,j)=>rgba.data[i*4+j]=c));ctx.putImageData(rgba,0,0);
  packedTextures.push({name:names[start+cell],palette,indices,crop});
  const fig=document.createElement('figure'),label=document.createElement('figcaption');label.textContent=names[start+cell];fig.append(canvas,label);document.body.append(fig);
 }
}
document.body.dataset.ready='1';
