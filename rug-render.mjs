// A woven carpet laid on the floor, below the enemies, with a rolling leading edge.
import {rugBounds} from './rug-field.mjs';
export function drawRug(c,e,reduced=false){
 const {unroll,width,height}=rugBounds(e);
 c.save();c.translate(e.x-width/2,e.y-height/2);c.globalAlpha=Math.min(1,e.life/.3);
 c.fillStyle='#120e2599';c.fillRect(4,6,width*unroll,height);
 c.save();c.beginPath();c.rect(-9,-2,width*unroll+9,height+8);c.clip();
 c.fillStyle='#f4c777';c.fillRect(0,0,width,height);
 c.fillStyle='#702b69';c.fillRect(4,4,width-8,height-8);
 c.strokeStyle='#e9b963';c.lineWidth=2;c.strokeRect(10,10,width-20,height-20);
 c.strokeStyle='#ed8fac';c.lineWidth=1;c.strokeRect(15,15,width-30,height-30);
 const diamond=(x,y,w,h,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(x,y-h);c.lineTo(x+w,y);c.lineTo(x,y+h);c.lineTo(x-w,y);c.closePath();c.fill();};
 for(let x=23;x<width-18;x+=16){diamond(x,8,3,3,'#f6d28e');diamond(x,height-8,3,3,'#f6d28e');}
 for(let y=24;y<height-20;y+=17)for(let x=27;x<width-20;x+=21)diamond(x,y,4,3,'#b6508a');
 diamond(width/2,height/2,width*.25,height*.34,'#f4c777');
 diamond(width/2,height/2,width*.20,height*.27,'#ba4f86');
 diamond(width/2,height/2,width*.12,height*.18,'#382e59');
 diamond(width/2,height/2,7,9,'#fff0b6');
 // Woven threads and tassels remain visible at mobile scale.
 c.strokeStyle='#ffe7af26';c.lineWidth=.6;for(let y=6;y<height;y+=4){c.beginPath();c.moveTo(4,y);c.lineTo(width-4,y);c.stroke();}
 c.strokeStyle='#ffe1a2';c.lineWidth=2;for(let y=5;y<height;y+=7){for(const x of [0,width]){c.beginPath();c.moveTo(x,y);c.lineTo(x+(x?7:-7),y+2);c.stroke();}}
 c.restore();
 if(unroll<1){const x=width*unroll;c.fillStyle='#eab966';c.fillRect(x-5,-2,10,height+4);c.fillStyle='#a74478';c.fillRect(x-2,0,4,height);}
 c.restore();
}
