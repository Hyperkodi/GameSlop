// Typeset the native title and composite the same generated overlay as the DOM logo.
const image=new Image();image.src='../../art/branding/slop-brush.png';await image.decode();
const large=document.createElement('canvas');large.width=1024;large.height=256;
const c=large.getContext('2d');c.font='180px Impact';c.textBaseline='alphabetic';
const golden=c.measureText('GOLDEN').width,eye=c.measureText('EYE').width;
c.font='114px Impact';const edition=c.measureText('64').width;
const scale=960/(golden+eye+edition+25);c.translate(32,0);c.scale(scale,1);
const gold=c.createLinearGradient(0,25,0,200);gold.addColorStop(0,'#fff1b1');gold.addColorStop(.45,'#e8bf67');gold.addColorStop(1,'#936025');
c.fillStyle=gold;c.font='180px Impact';c.fillText('GOLDENEYE',0,196);c.font='114px Impact';c.fillStyle='#f3d892';c.fillText('64',golden+eye+25,196);
c.save();c.translate(golden+eye*.5,124);c.rotate(-9*Math.PI/180);c.drawImage(image,-eye*.76,-eye*.76/image.width*image.height,eye*1.52,eye*1.52/image.width*image.height);c.restore();
const canvas=document.getElementById('logo'),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(large,0,0,256,64);
const rgba=ctx.getImageData(0,0,256,64),palette=[[0,0,0],[87,48,18],[127,79,27],[163,109,42],[194,143,63],[222,176,87],[243,208,135],[255,239,176],[76,4,0],[114,7,0],[150,12,2],[187,18,4],[217,25,7],[243,33,10],[255,57,20],[255,87,39]];
const indices=Array.from({length:256*64},(_,i)=>{
 if(rgba.data[i*4+3]<96)return 0;
 let best=1,d=Infinity;for(let j=1;j<palette.length;j++){const n=palette[j].reduce((s,v,k)=>s+(v-rgba.data[i*4+k])**2,0);if(n<d){d=n;best=j;}}
 return best;
});
indices.forEach((n,i)=>{palette[n].forEach((v,k)=>rgba.data[i*4+k]=v);rgba.data[i*4+3]=n?255:0;});ctx.putImageData(rgba,0,0);
window.titleTexture={width:256,height:64,palette,indices};document.body.dataset.ready='1';
