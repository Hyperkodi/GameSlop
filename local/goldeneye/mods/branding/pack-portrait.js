// Convert the generated portrait into an opaque, reproducible N64 CI4 texture.
const image=new Image();image.src='../../art/portraits/mascot-tux.png';await image.decode();
const canvas=document.getElementById('portrait'),ctx=canvas.getContext('2d',{willReadFrequently:true});
// Sample at the dossier's small on-screen size, then store in four 32px tiles.
// This keeps the portrait inside the original ROM slot without moving assets.
const sample=document.createElement('canvas');sample.width=32;sample.height=32;
sample.getContext('2d').drawImage(image,0,0,32,32);
ctx.imageSmoothingEnabled=false;ctx.drawImage(sample,0,0,64,64);
const rgba=ctx.getImageData(0,0,64,64);
const palette=[[9,10,10],[27,29,29],[49,54,54],[55,84,89],[67,99,105],[78,112,117],[77,3,0],[117,5,0],[156,8,0],[194,13,0],[225,22,4],[250,41,14],[255,91,58],[173,155,124],[223,207,174],[255,245,219]];
const indices=Array.from({length:4096},(_,i)=>{
 let best=0,d=Infinity;for(let j=0;j<16;j++){const n=palette[j].reduce((s,v,k)=>s+(v-rgba.data[i*4+k])**2,0);if(n<d){d=n;best=j;}}
 return best;
});
indices.forEach((n,i)=>{palette[n].forEach((v,k)=>rgba.data[i*4+k]=v);rgba.data[i*4+3]=255;});ctx.putImageData(rgba,0,0);
window.portraitTexture={width:64,height:64,palette,indices};document.body.dataset.ready='1';
