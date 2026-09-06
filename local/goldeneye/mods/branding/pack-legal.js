// Reuse the approved GoldenEye 64 / SLOP title artwork at the certificate size.
const title=await(await fetch('title-texture.json')).json();
const canvas=document.getElementById('logo'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const rgba=ctx.createImageData(128,32);
const indices=[];
for(let i=0;i<4096;i++){
 const x=i%128,y=Math.floor(i/128),index=title.indices[y*2*256+x*2];
 indices.push(index);rgba.data.set([...title.palette[index],index?255:0],i*4);
}
ctx.putImageData(rgba,0,0);
window.legalTexture={width:128,height:32,palette:title.palette,indices};document.body.dataset.ready='1';
