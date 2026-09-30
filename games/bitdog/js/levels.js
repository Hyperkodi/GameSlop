(function(root){
 'use strict';
 const catalog=[
  {id:1,name:'Satoshi Park',subtitle:'The first fetch',available:true,returnTime:75,music:'funky-chunk.mp3',track:'Funky Chunk',isrc:'USUAN1500054',hint:'Leap ponds. Roll through crates. Remember the way home.'},
  {id:2,name:'Harvest Hustle',subtitle:'A shortcut through the harvest',available:true,returnTime:80,throwAt:3.15,music:'fretless.mp3',track:'Fretless',isrc:'USUAN1500074',hint:'Hop across apple bins and picking wagons. Take the loading ramp for extra coins; roll through leaves to clear the way home.'},
  {id:3,name:'Electric Avenue',subtitle:'Powered rooftop shortcuts',available:true,returnTime:80,music:'electro-cabello.mp3',track:'Electro Cabello',isrc:'USUAN1400048',hint:'Climb the workshops and run the blue cables for an electric boost. Jump sparking junctions; the street catches missed jumps.'},
  {id:4,name:'Mushroom Moonwood',subtitle:'A forest with spring',available:true,returnTime:90,music:'flutey-funk.mp3',track:'Flutey Funk',isrc:'USUAN1100519',hint:'Land on broad mushroom caps to bounce. Hold Jump for extra height; shallow mud only slows you down.'},
  {id:5,name:'Snowball Summit',subtitle:'Roll into a snowball',available:true,returnTime:85,music:'cold-funk.mp3',track:'Cold Funk',isrc:'USUAN1100499',hint:'Sprint, then hold Roll on snow to gather a fluffy shell and burst through snow piles. Jump to shed it; broad snowbanks lead to extra coins.'},
  {id:6,name:'Cloudburst Carnival',subtitle:'Catch the next breeze',available:true,returnTime:90,music:'acid-trumpet.mp3',track:'Acid Trumpet',isrc:'USUAN1100339',hint:'Jump into an umbrella to glide into the ribbon-marked gusts. Steer with the wind and tap Jump to fold it. The boardwalk catches every miss.'},
  {id:7,name:'Moon Cheese Chase',subtitle:'One giant leap for dogkind',available:true,returnTime:90,music:'space-jazz.mp3',track:'Space Jazz',isrc:'USUAN2100030',hint:'Low gravity carries long jumps onto crater shelves. Blue fields restore normal gravity: expect shorter jumps and a quicker landing inside them.'},
  {id:8,name:'The Impossible Backyard',subtitle:'Bring the adventure home',available:true,returnTime:90,music:'funkorama.mp3',track:'Funkorama',isrc:'USUAN1100474',hint:'One last impossible fetch: harvest equipment, a powered garden cable and springy mushrooms. Every shortcut has a safe path underneath.'}
 ];
 function get(id){return catalog.find(l=>l.id===Number(id)&&l.available)||catalog[0];}
 function surfaceY(p,x){
  if(!p.surface)return p.y;
  const points=p.surface;if(x<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
  return points[points.length-1][1];
 }
 function groundFoot(ground,left,right){let y=-Infinity;for(let i=0;i<=32;i++)y=Math.max(y,ground(left+(right-left)*i/32));return y+16;}
 const harvestYards=[{x:2850,end:5140,y:480},{x:10050,end:12340,y:472},{x:16750,end:19040,y:492}];
 // Source-pixel contact profiles. Uniform scaling keeps wheels round and supports credible.
 const equipment={
  bins:{size:[1254,1254],foot:1180,edge:[[125,185],[785,225],[1110,165]]},
  wagon:{size:[1774,887],foot:744,edge:[[235,365],[1710,365]]},
  loading:{size:[1774,887],foot:633,edge:[[205,616],[830,361],[1720,361]]}
 };
 // Contact lines follow the painted near edge of each three-quarter surface.
 // All assets keep their native proportions; soil hides only the rooted base.
 const campaignArt={
  mushroom:{size:[1223,1286],foot:1235,edge:[[35,345],[250,380],[600,450],[900,450],[1185,435]]},
  snowbank:{size:[2172,724],foot:585,edge:[[50,560],[150,525],[250,481],[350,398],[450,345],[550,253],[650,181],[750,165],[850,175],[1000,189],[1200,199],[1400,189],[1550,212],[1650,310],[1750,382],[1850,455],[1950,504],[2050,539],[2120,570]]},
  boardwalk:{size:[2079,756],foot:661,edge:[[95,241],[195,251],[1878,251],[1978,241]]},
  moonshelf:{size:[2170,725],foot:625,edge:[[225,285],[400,290],[800,345],[1150,365],[1510,330],[1870,265]]}
 };
 function rootedPlatform(p,asset,ground){
  const source=campaignArt[asset],scale=(p.end-p.x)/(source.edge[source.edge.length-1][0]-source.edge[0][0]);
  const ax=p.x-source.edge[0][0]*scale,aw=source.size[0]*scale;
  const foot=groundFoot(ground,ax,ax+aw);
  p.art={kind:asset,x:ax,y:foot-source.foot*scale,w:aw,h:source.size[1]*scale,foot};
  p.surface=source.edge.map(([x,y])=>[ax+x*scale,p.art.y+y*scale]);
  if(p.walkIn){
   // The buried snowbank toes intersect the actual terrain, so both entrances
   // remain continuous even where the foreground snow gently slopes.
   const authored={surface:p.surface};p.surface=Array.from({length:81},(_,i)=>{const x=p.x+(p.end-p.x)*i/80;return[x,Math.min(ground(x),surfaceY(authored,x))];});
   p.surface[0][1]=ground(p.x);p.surface[p.surface.length-1][1]=ground(p.end);
  }
  p.y=surfaceY(p,(p.x+p.end)/2);return p;
 }
 function platforms(id,ground=()=>480){
  if(id===1)return [{id:'bridge',x:7300,end:8400,y:390,kind:'boardwalk'}];
  if(id===3){
   const route=[];
   for(const [n,start]of [[0,3100],[1,9600],[2,16400]]){
    // Grounded packing crates form two easy steps up to either workshop roof.
    for(const [i,offset,w,kind,y]of [[0,0,110,'stoop',425],[5,110,100,'stoop',375],[1,180,450,'workshop',330],[2,710,1420,'cable',260],[3,2210,450,'workshop',330],[6,2630,100,'stoop',375],[4,2730,110,'stoop',425]]){
     const p={id:`electric-${n}-${i}`,x:start+offset,end:start+offset+w,kind,y};
     if(kind==='workshop'){
      const scale=w/1470,foot=ground((p.x+p.end)/2)+8;
      p.art={kind:'workshop',x:p.x-150*scale,y:foot-797*scale,w:1774*scale,h:887*scale,foot};
      p.surface=[[150,345],[406,125],[1320,223],[1620,375]].map(([x,y])=>[p.art.x+x*scale,p.art.y+y*scale]);
      p.y=surfaceY(p,(p.x+p.end)/2);
     }
     if(kind==='cable'){
      p.surface=Array.from({length:41},(_,j)=>[p.x+w*j/40,y+30*Math.sin(Math.PI*(j%20)/20)]);
      p.poles=[p.x,p.x+w/2,p.end];p.energized=true;
     }
     route.push(p);
    }
   }
   return route;
  }
  if(id===4)return [3100,10100,16700].flatMap((start,n)=>[
   {id:`mushroom-${n}-0`,x:start,end:start+140,kind:'spring'},
   {id:`mushroom-${n}-1`,x:start+420,end:start+600,kind:'spring'},
   {id:`mushroom-${n}-2`,x:start+900,end:start+1040,kind:'spring'}].map(p=>rootedPlatform(p,'mushroom',ground)));
  if(id===5)return [3100,10200,16800].map((x,n)=>rootedPlatform({id:`snowbank-${n}`,x,end:x+1000,kind:'snowbank',walkIn:true,bidirectional:true},'snowbank',ground));
  if(id===6)return [3700,10500,17300].flatMap((x,n)=>[
   {id:`canopy-${n}-0`,x,end:x+560,y:ground(x+280)-115,kind:'canopy'},
   {id:`canopy-${n}-1`,x:x+880,end:x+1440,y:ground(x+1160)-135,kind:'canopy'}].map(p=>rootedPlatform(p,'boardwalk',ground)));
  if(id===7)return [3000,10100,16700].flatMap((x,n)=>[
   {id:`moon-shelf-${n}-0`,x,end:x+520,y:ground(x+260)-85,kind:'moonShelf'},
   {id:`moon-shelf-${n}-1`,x:x+850,end:x+1470,y:ground(x+1160)-145,kind:'moonShelf'},
   {id:`moon-shelf-${n}-2`,x:x+1830,end:x+2350,y:ground(x+2090)-85,kind:'moonShelf'}].map(p=>rootedPlatform(p,'moonshelf',ground)));
  if(id===8)return [...platforms(2,ground).slice(0,5),...platforms(3,ground).filter(p=>p.id.startsWith('electric-1-')),...platforms(4,ground).slice(6)];
  const list=[];
  for(const [n,start]of [[0,3000],[1,10200],[2,16900]]){
   for(const [i,offset,w,kind]of [[0,0,112,'bins'],[1,230,350,'wagon'],[2,750,660,'loading'],[3,1490,350,'wagon'],[4,1920,170,'step']]){
    const p={id:`orchard-${n}-${i}`,x:start+offset,end:start+offset+w,kind};
    const foot=ground((p.x+p.end)/2)+2;
    if(kind==='step'){
     const h=w*220/418;
     p.y=foot-h+8;p.art={kind:'hay',x:p.x,y:foot-h,w,h,foot};
    }else{
     const source=equipment[kind],scale=w/(source.edge[source.edge.length-1][0]-source.edge[0][0]);
     p.art={kind,x:p.x-source.edge[0][0]*scale,y:foot-source.foot*scale,w:source.size[0]*scale,h:source.size[1]*scale,foot};
     p.surface=source.edge.map(([x,y])=>[p.art.x+x*scale,p.art.y+y*scale]);
     p.y=surfaceY(p,(p.x+p.end)/2);p.walkIn=kind==='loading';
    }
    list.push(p);
   }
  }
  return list;
 }
 const api={catalog,get,platforms,surfaceY,groundFoot,harvestYards};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BitDogLevels=api;
})(typeof window!=='undefined'?window:globalThis);
