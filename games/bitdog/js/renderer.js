(function () {
  'use strict';
  const { FETCH, HOME, END } = window.BitDog;
  window.BitDog.createRenderer = function (canvas,levelId=1) {
    const level=BitDogLevels.get(levelId),ground=x=>BitDog.ground(x,levelId);
    const c = canvas.getContext('2d');
    const environment = BitDogEnvironment.create(c,levelId);
    const introVideo = BitDogIntroVideo.create(c,levelId);
    let W = 1100, H = 600, camera = 0, cameraY = 0, time = 0, particles = [];
    const gateOpenedAt=new Map();
    const springReleasedAt=new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const poses = BitDogEnvironment.loadImage('art/sprites/bitdog-poses-v2.png');
    const posesLeft = BitDogEnvironment.loadImage('art/sprites/bitdog-poses-left-v2.png');
    const sittingLeft = BitDogEnvironment.loadImage('art/sprites/bitdog-sitting-left-v2.png');
    // Hand-authored rectangles refer to the original, unmodified transparent atlas.
    const frames = [
      [28, 28, 412, 415], [454, 31, 378, 413], [798, 83, 547, 285], [1346, 87, 420, 341],
      [7, 497, 432, 305], [446, 510, 439, 317], [896, 465, 439, 401], [1355, 491, 409, 363]
    ];
    const leftFrames = [[28,28,414,415],[455,28,395,418],[815,83,518,286],[1347,81,414,347],
      [20,495,434,306],[453,490,458,341],[894,466,438,398],[1339,490,420,360]];
    // The four gameplay gallop poses were painted at different crop sizes.
    // Register their eyes to one screen point so the body stays steady while
    // the paws, ears and tail provide the motion. The stretched first pose
    // needs a wider draw size to keep its head the same size as the others.
    const runRegistration = {
      right: [[170,447,83],[132,346,86],[132,365,78],[132,382,69]],
      left: [[160,113,84],[132,80,88],[132,66,81],[132,73,86]]
    };
    function sprite(frame, x, y, width, direction = 1, alpha = 1) {
      if (frame === 0 && direction < 0 && sittingLeft.complete && sittingLeft.naturalWidth) {
        const height=width*1.3;
        c.save();c.globalAlpha*=alpha;c.drawImage(sittingLeft,85,75,925,1380,x-width/2,y-height,width,height);c.restore();return true;
      }
      const atlas = direction < 0 ? posesLeft : poses;
      if (!atlas.complete || !atlas.naturalWidth) return false;
      const [sx, sy, sw, sh] = (direction < 0 ? leftFrames : frames)[frame], height = width * sh / sw;
      c.save(); c.translate(x, y); c.globalAlpha *= alpha;
      // These two silhouettes have interleaved transparent margins in the source sheet.
      if (direction > 0 && (frame === 1 || frame === 2)) {
        c.beginPath();
        const points = frame === 1 ? [[0,0],[318,0],[318,258],[378,280],[378,413],[0,413]] : [[0,0],[547,0],[547,285],[42,285],[42,178],[0,148]];
        points.forEach(([px,py],i) => i ? c.lineTo(-width/2+px/sw*width,-height+py/sh*height) : c.moveTo(-width/2+px/sw*width,-height+py/sh*height)); c.closePath(); c.clip();
      }
      if (direction < 0 && (frame === 2 || frame === 5 || frame === 6)) {
        const points=frame===2?[[0,0],[518,0],[518,286],[48,286],[48,254],[0,238]]:frame===5?[[0,0],[437,0],[437,240],[458,270],[458,341],[0,341]]:[[0,0],[438,0],[438,398],[45,398],[45,260],[0,260]];
        c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(-width/2+px/sw*width,-height+py/sh*height):c.moveTo(-width/2+px/sw*width,-height+py/sh*height));c.closePath();c.clip();
      }
      c.drawImage(atlas, sx, sy, sw, sh, -width / 2, -height, width, height); c.restore(); return true;
    }
    function runningSprite(frame,direction) {
      const left=direction<0,index=frame-2,[width,eyeX,eyeY]=runRegistration[left?'left':'right'][index];
      const [, , sw, sh]=(left?leftFrames:frames)[frame],unit=width/sw;
      const x=(left?-48:48)-(-width/2+eyeX*unit);
      const y=-76-(eyeY-sh)*unit;
      return sprite(frame,x,y,width,direction);
    }
    function resize() {
      // Keep high-density displays sharp without making the large painted
      // canvas expensive enough to miss animation frames.
      const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
      H = 620; W = Math.max(540, H * box.width / box.height);
    }
    function path(points, fill, stroke, width = 2) {
      c.beginPath(); points(c); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function ellipse(x, y, rx, ry, fill, angle = 0) {
      c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
    }
    function line(x, y, xx, yy, color, width = 2) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(xx, yy); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
    }
    function text(str, x, y, size, fill, align = 'center', font = 'Fredoka') {
      c.fillStyle = fill; c.font = `600 ${size}px ${font}, sans-serif`; c.textAlign = align; c.fillText(str, x, y);
    }
    function coin(x, y, r, t = 0) {
      if (r < 7) { ellipse(x, y, Math.max(.5,r), Math.max(.5,r), '#ffd86d'); return; }
      c.save(); c.translate(x, y); c.scale(.85 + .15 * Math.cos(t * 3), 1);
      if(environment.prop('coin',0,r,r*2,r*2)){c.restore();return;}
      ellipse(2, 3, r, r, '#b77b2b'); ellipse(0, 0, r, r, '#f1ad39'); ellipse(-1, -1, r - 3, r - 3, '#ffd86d');
      c.beginPath(); c.arc(-1, -1, r - 6, 0, Math.PI * 2); c.lineWidth = 1; c.strokeStyle = '#e9ae43'; c.stroke();
      text('₿', -1, r * .4, r * 1.38, '#bf8126', 'center', 'Arial');
      c.restore();
    }
    function cloud(x, y, scale) {
      c.save(); c.translate(x, y); c.scale(scale, scale); c.globalAlpha = .73;
      ellipse(0, 0, 57, 12, '#fffcec'); ellipse(-20, -10, 26, 20, '#fffcec'); ellipse(11, -17, 27, 29, '#fffcec'); ellipse(39, -7, 23, 18, '#fffcec'); c.restore();
    }
    function tree(x, y, scale, pale = false) {
      if(levelId===2&&environment.orchard('tree',x,y,180*scale,220*scale))return;
      if(environment.prop('tree',x,y,180*scale,220*scale))return;
      c.save(); c.translate(x, y); c.scale(scale, scale);
      const leaf = pale ? '#afc595' : '#75945b', light = pale ? '#b9cea0' : '#87a568';
      line(0, 0, 0, -120, pale ? '#a7b68c' : '#a2a271', 9);
      line(0, -47, -24, -88, pale ? '#a7b68c' : '#a2a271', 6);
      ellipse(-28, -133, 38, 48, leaf); ellipse(21, -128, 43, 47, leaf); ellipse(-4, -172, 39, 45, light);
      ellipse(-17, -176, 13, 20, pale ? '#c1d4aa' : '#91af73'); c.restore();
    }
    function background(s) {
      if(environment.drawBackground(camera,W,H))return;
      const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#e9efda'); sky.addColorStop(1, '#cee1b9'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      ellipse(W * .79 - camera * .018, 104, 44, 44, '#fff5ce'); ellipse(W * .79 - camera * .018, 104, 58, 58, '#fff6d32b');
      for (let i = 0; i < 8; i++) cloud(i * 280 - (camera * .12 % 280) + 65, 90 + (i % 3) * 47, .65 + (i % 2) * .3);
      for (let layer = 0; layer < 3; layer++) {
        const base = 310 + layer * 65, par = .12 + layer * .14;
        path(p => { p.moveTo(0, H); for (let x = 0; x <= W + 12; x += 12) p.lineTo(x, base + Math.sin((x + camera * par) / (180 - layer * 25)) * (30 + layer * 8)); p.lineTo(W, H); p.closePath(); }, ['#c7d8b3', '#b4c99d', '#a3bd88'][layer]);
      }
      for (let i = 0; i < 14; i++) tree(i * 180 - camera * .4, 435 + Math.sin(i * 5) * 25, .48 + (i % 3) * .12, true);
      for (let i = 0; i < 20; i++) {
        const x = i * 130 - (camera * .6 % 130); line(x, 414, x, 455, '#b4bf90', 5);
        line(x, 426, x + 131, 426, '#b4bf90', 4);
      }
      if (s.phase === 'return') { c.fillStyle = '#ffc3550b'; c.fillRect(0, 0, W, H); }
    }
    function terrain() {
      if(environment.drawGround(camera,W,H,ground))return;
      const start = Math.floor(camera / 12) * 12 - 24, stop = camera + W + 24;
      path(p => { p.moveTo(start, H + 100); for (let x = start; x <= stop; x += 12) p.lineTo(x, ground(x)); p.lineTo(stop, H + 100); p.closePath(); }, '#b6c087');
      path(p => { for (let x = start; x <= stop; x += 8) { if (x === start) p.moveTo(x, ground(x) + 8); else p.lineTo(x, ground(x) + 8); } }, null, '#7b9b55', 17);
      path(p => { for (let x = start; x <= stop; x += 8) { if (x === start) p.moveTo(x, ground(x) + 24); else p.lineTo(x, ground(x) + 24); } }, null, '#c4b783', 15);
      for (let x = Math.floor(start / 54) * 54; x < stop; x += 54) {
        const y = ground(x); ellipse(x + 13, y + 80 + Math.sin(x) * 25, 3, 2, '#9da771');
        line(x, y - 2, x - 3, y - 10, '#72934e', 1.5); line(x, y - 2, x + 4, y - 9, '#72934e', 1.5);
        if (Math.sin(x * 42) > .35) { line(x + 19, y + 1, x + 19, y - 14, '#719753', 1); ellipse(x + 19, y - 15, 3, 3, '#fff2bf'); ellipse(x + 20, y - 16, 1, 1, '#dba557'); }
      }
    }
    function house(d) {
      // Ground both props on the path across their complete visible footprint.
      // The small inset places their bases below the grassy rear edge.
      const houseFoot=BitDogLevels.groundFoot(ground,78,214);
      const ownerFoot=BitDogLevels.groundFoot(ground,215,305);
      ellipse(146,houseFoot-3,68,6,'#17201642');
      environment.drawHomeHouse(146,houseFoot,155);
      ellipse(260,ownerFoot-2,46,4,'#17201642');
      environment.drawWaitingOwner(260,ownerFoot,260,d.x<260?-1:1);
      text('HOME',146,houseFoot+44,11,'#f8ebc8');
    }
    function dog(x, y, scale, d, hero = false) {
      // Never substitute the retired procedural dog while artwork is loading.
      const atlas = d.facing < 0 ? posesLeft : poses;
      if (!atlas.complete || !atlas.naturalWidth) return;
      c.save(); c.translate(x, y); c.scale(scale, scale);
      if (d.invincible > 0 && Math.sin(time * 35) < 0) c.globalAlpha = .4;
      if(!d.muddy)ellipse(0, 1, 36, 5, '#35451e24');
      if (d.rolling && !hero) {
        const width=78,box=(d.facing<0?leftFrames:frames)[7],radius=width*box[3]/box[2]/2;
        c.save();c.translate(0,-radius);c.rotate(d.x/32.4);
        sprite(7,0,radius,width,d.facing);c.restore();
      }
      else {
        const running=!hero&&Math.abs(d.vx)>45;
        const frame=running?2+Math.floor(time*13)%4:6;
        // The standing atlas frame includes a small transparent margin below
        // the paws; compensate so its visible feet meet the collision surface.
        const feet=frame===6&&!hero?(d.facing<0?12*132/438:16*132/439):0;
        if(running)runningSprite(frame,d.facing);
        else sprite(frame,0,feet,132,d.facing);
      }
      if (d.carrying) coin((d.rolling?48:Math.abs(d.vx)>45?65:43)*d.facing,d.rolling?-36:Math.abs(d.vx)>45?-69:-78,12);
      if(d.snowball>0&&!hero){
        const r=28+d.snowball*22;
        c.save();c.scale(d.facing,1);environment.asset('snow-shell',0,7,r*3);c.restore();
        if(!reduced)for(let i=0;i<5;i++)ellipse(-d.facing*(30+(time*95+i*13)%70),-4-i*2,3,2,'#effaff');
      }
      if(d.gliding&&!hero){
        c.save();c.translate(0,-36);c.rotate(reduced?0:Math.sin(time*2)*.045);
        environment.asset('umbrella',0,0,150);c.restore();
      }
      if(d.electricTimer>0&&!hero){
        // Energy stays around the silhouette so the face and BIT tag stay clear.
        const phase=reduced?0:time*13,alpha=Math.min(1,d.electricTimer/.4);c.globalAlpha*=alpha;
        for(let i=0;i<4;i++){
          const px=-49+i*30,py=-13-Math.sin(phase+i*1.7)*5;
          path(p=>{p.moveTo(px,py);p.lineTo(px+7,py-12);p.lineTo(px+3,py-14);p.lineTo(px+12,py-25);},null,'#1c607c',4);
          path(p=>{p.moveTo(px,py);p.lineTo(px+7,py-12);p.lineTo(px+3,py-14);p.lineTo(px+12,py-25);},null,'#bffbff',2);
        }
        if(!reduced)for(let i=0;i<5;i++){const shift=(time*140+i*17)%85;ellipse(-d.facing*(55+shift),-20-i*9,2.5,2.5,'#b5f8ff');}
      }
      c.restore();
    }
    function obstacle(o, returning) {
      const y = ground(o.x); if (o.broken) return;
      // Ground contact and one native silhouette shadow distinguish obstacles
      // without a per-frame chain of expensive image filters.
      const open=o.type==='fence'&&returning;
      ellipse(o.x+3,y+3,o.type==='rock'?48:o.type==='crate'?34:43,8,open?'#26342125':'#26342160');
      c.save();
      if(!open){c.shadowColor='#25301ecc';c.shadowBlur=2;c.shadowOffsetY=3;}
      let drawn=false;
      if(o.skin&&levelId>=4)drawn=environment.obstacleAsset(o.skin,o.x,y+3,o.h+3);
      if(!drawn&&o.skin==='roadwork')drawn=environment.barrier(o.x,y+3,o.h);
      else if(!drawn&&o.skin)drawn=environment.orchard(o.skin,o.x,y+3,o.skin==='hay'?88:68,o.h+10);
      if(!drawn&&o.type==='rock')drawn=environment.obstacle('rock',o.x,y+3,94,o.h+10);
      else if(!drawn&&o.type==='crate')drawn=environment.prop('crate',o.x,y+2,62,58);
      if(o.type==='fence'){
        if(returning&&!gateOpenedAt.has(o.x))gateOpenedAt.set(o.x,time);
        const elapsed=returning?time-gateOpenedAt.get(o.x):0;
        const pose=!returning?0:reduced||elapsed>.32?2:elapsed>.12?1:0;
        drawn=environment.fence(pose,o.x,y+4,o.h+12);
      }
      c.restore();if(drawn)return;
      if (o.type === 'crate') {
        c.fillStyle = '#c6a064'; c.fillRect(o.x - 23, y - 46, 46, 46);
        c.strokeStyle = '#a8834c'; c.lineWidth = 3; c.strokeRect(o.x - 20, y - 43, 40, 40);
        line(o.x - 19, y - 41, o.x + 19, y - 5, '#e0bb7e', 5); line(o.x + 19, y - 41, o.x - 19, y - 5, '#e0bb7e', 5);
      } else {
        c.save(); c.translate(o.x, y); if (returning) c.scale(1,.2);
        for (let j = -1; j <= 1; j++) { c.fillStyle = '#f5e6bd'; c.fillRect(j * 23 - 6, -o.h, 12, o.h); path(p => { p.moveTo(j * 23 - 6, -o.h); p.lineTo(j * 23, -o.h - 8); p.lineTo(j * 23 + 6, -o.h); }, '#f5e6bd'); }
        line(-33, -o.h + 17, 32, -o.h + 17, '#e9d7a8', 9); line(-33, -18, 32, -18, '#e9d7a8', 9); c.restore();
      }
    }
    function sign(x, label, direction = 1) {
      const y = ground(x);
      if(environment.prop('sign',x,y,166,164)){text(label,x-8,y-108,label.length>7?15:20,'#352813');return;}
      line(x, y - 2, x, y - 100, '#a99463', 6);
      c.fillStyle = '#f6edcd'; c.beginPath(); c.roundRect(x - 58, y - 121, 116, 34, 5); c.fill();
      text(label + (direction > 0 ? ' →' : ' ←'), x, y - 100, 18, '#35452a');
    }
    function burst(e) {
      if(e.type==='mushroom')springReleasedAt.set(Math.round(e.x/50),time);
      const count = reduced ? 3 : e.type === 'win' ? 50 : e.type === 'fetch' ? 35 : 9;
      for (let i = 0; i < count; i++) particles.push({ x: e.x, y: e.y, vx: Math.cos(i * 2.4) * (60 + i * 7), vy: -90 - (i % 7) * 35, age: 0, life: .5 + (i % 4) * .17, color: e.type.startsWith('snow')?'#eefaff':e.type==='mushroom'?['#f4b7ca','#e9e9d0','#ccb6f4'][i%3]:e.type === 'smash' ? '#ba955e' : ['#f6c958', '#fff5c5', '#edaa4b'][i % 3] });
    }
    function mudPond(z){
      const cx=(z.x+z.end)/2,width=z.end-z.x+58,height=width*.13;
      // Place the water's midline at paw height, with the near bank below
      // the trail. Follow the local ground grade instead of floating above it.
      const grade=(ground(z.end)-ground(z.x))/(z.end-z.x);
      c.save();c.translate(cx,ground(cx)-6);c.transform(1,grade,0,1,0,0);
      environment.asset('mud',0,(350/491-.5)*height,width,height);
      c.restore();
    }
    function mudContact(s){
      const d=s.dog;if(!d.muddy)return;
      const z=s.zones.find(z=>z.kind==='mud'&&d.x>=z.x&&d.x<=z.end);if(!z)return;
      const depth=7*Math.min(1,(d.x-z.x)/35,(z.end-d.x)/35);
      // Repaint water over the submerged tips of the paws, using exactly the
      // same world position as the pond beneath the dog.
      c.save();c.beginPath();c.rect(d.x-78,d.y-depth,156,35);c.clip();mudPond(z);c.restore();
      const moving=Math.abs(d.vx)>35,phase=reduced?0:(time*3)%1;
      for(const offset of [-25,24]){
        c.beginPath();c.ellipse(d.x+offset,d.y-depth+2,9+(moving?phase*12:2),2+(moving?phase*2:0),0,0,Math.PI*2);
        c.strokeStyle=moving?`rgba(228,204,155,${.55*(1-phase)})`:'#d9c59966';c.lineWidth=1.3;c.stroke();
        if(moving&&!reduced)ellipse(d.x+offset-d.facing*phase*15,d.y-depth-Math.sin(phase*Math.PI)*9,1.8,2.5,'#d9c59999');
      }
    }
    function zones(s){
      for(const z of s.zones||[]){
        if(z.end<camera-80||z.x>camera+W+80)continue;
        if(z.kind==='mud'){
          mudPond(z);
          if(!reduced)for(let x=z.x+60;x<z.end-30;x+=125){const r=7+Math.sin(time*1.5+x)*1.5;c.beginPath();c.ellipse(x,ground(x)-8,r,2,0,0,Math.PI*2);c.strokeStyle='#e8c7aa99';c.lineWidth=1;c.stroke();}
        }
        if(z.kind==='gust'){
          c.save();
          const left=Math.max(z.x,camera-70),right=Math.min(z.end,camera+W+70);
          for(let row=0;row<3;row++)for(let x=Math.floor(left/210)*210;x<right;x+=210){
            const px=x+(reduced?0:(time*40*z.direction)%90),y=ground(px)-85-row*84;
            path(p=>{p.moveTo(px,y);p.bezierCurveTo(px+35,y-20,px+70,y+17,px+102,y-3);},null,'#16455777',5);
            path(p=>{p.moveTo(px,y);p.bezierCurveTo(px+35,y-20,px+70,y+17,px+102,y-3);},null,'#dcfff5bb',2.4);
            const tip=z.direction>0?px+102:px,side=z.direction>0?-1:1;
            line(tip,y-3,tip+side*11,y-10,'#dcfff5bb',2);line(tip,y-3,tip+side*11,y+3,'#dcfff5bb',2);
          }c.restore();
        }
        if(z.kind==='gravity'){
          c.save();const cx=(z.x+z.end)/2,y=ground(cx);
          const glow=c.createLinearGradient(0,y-270,0,y+28);
          glow.addColorStop(0,'#8bc9ef00');glow.addColorStop(.7,'#8bc9ef18');glow.addColorStop(1,'#8bc9ef50');
          c.fillStyle=glow;c.fillRect(z.x,y-270,z.end-z.x,298);
          // One continuous field with clear edges, rather than rings that
          // resemble landing targets. Falling motes communicate stronger pull.
          for(const edge of [z.x,z.end])line(edge,ground(edge)-105,edge,ground(edge)+15,'#bceaffaa',2);
          path(p=>{p.moveTo(z.x,ground(z.x)+13);for(let x=z.x+8;x<z.end;x+=8)p.lineTo(x,ground(x)+13);p.lineTo(z.end,ground(z.end)+13);},null,'#bceaff99',2);
          if(!reduced)for(let i=0;i<13;i++){
            const x=z.x+24+i*(z.end-z.x-48)/12,fall=(time*105+i*29)%195,py=ground(x)-220+fall;
            line(x,py,x,py+5,'#d7f4ff88',1.5);
          }
          c.fillStyle='#192c45e8';c.beginPath();c.roundRect(cx-89,y+24,178,27,7);c.fill();
          text('NORMAL GRAVITY',cx,y+43,12,'#e1f5ff');
          c.restore();
        }
      }
      for(const u of s.umbrellas||[])if(u.cooldown<=0&&u.x>camera-90&&u.x<camera+W+90){
        ellipse(u.x,ground(u.x)+3,28,5,'#293e4e55');
        environment.asset('umbrella',u.x,u.y+28+(reduced?0:Math.sin(time*2)*3),94);
      }
    }
    function draw(s, dt, title = false) {
      time += Math.min(dt, .05);
      const d = s.dog;
      const lookingLeft=Math.abs(d.vx)>40?d.vx<0:d.facing<0;
      const target = Math.max(0, Math.min(END - W + 100, d.x - W * (lookingLeft ? 2/3 : 1/3)));
      camera=Math.max(0,Math.min(END-W+100,camera+d.vx*dt));
      camera += (target - camera) * (1 - Math.exp(-dt * 8));
      const mobile=matchMedia('(pointer:coarse), (max-width:700px), (max-height:520px)').matches;
      const verticalTarget=mobile?Math.max(-320,d.y-H*.66+Math.min(0,(d.vy||0)*.08)):levelId>1?Math.max(-320,Math.min(0,d.y-320+Math.min(0,(d.vy||0)*.08))):0;
      cameraY += (verticalTarget-cameraY)*(1-Math.exp(-dt*12));
      if (title) {camera = 0;cameraY=0;}
      c.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      background(s);
      c.save(); c.translate(-camera, -cameraY);
      for (let i = 0; i < ([1,2,8].includes(levelId)?66:0); i++) {
        const x = 650 + i * 330;
        if (i%3===0 && x > camera - 120 && x < camera + W + 120 && s.obstacles.every(o=>Math.abs(o.x-x)>260)&&s.platforms.every(p=>x<p.x-180||x>p.end+180)) {
          const scale=.7+(i%3)*.15;
          // The sprite includes transparent padding below its roots. Anchor the
          // visible root flare below the deepest terrain across its footprint.
          // Trees and soil share the world camera; soil occludes the buried base.
          const rootY=BitDogLevels.groundFoot(ground,x-45*scale,x+45*scale)+220*scale*.10;
          tree(x,rootY,scale);
        }
      }
      if(levelId>1&&!title){
        // Equipment is grounded on graded loading yards. Paint soil over the
        // lowest two pixels of the supports, without burying wheels or legs.
        for(const p of [...s.platforms].reverse()){
          if(p.kind==='cable'){
            for(const x of p.poles)if(x>camera-100&&x<camera+W+100)environment.pole(x,p.y+5,ground(x)+10);
          }
          if(p.kind==='stoop'&&p.end>camera-80&&p.x<camera+W+80)environment.prop('crate',(p.x+p.end)/2,ground(p.x)+4,p.end-p.x,ground(p.x)-p.y+8);
          if(!p.art||p.art.x+p.art.w<camera-80||p.art.x>camera+W+80)continue;
          let compression=1;
          if(p.kind==='spring'&&!reduced){
            if(d.platformId===p.id&&d.springTimer>0)compression=1-.10*(1-d.springTimer/.085);
            const release=[...springReleasedAt].find(([x,t])=>x*50>=p.x-25&&x*50<=p.end+25&&time-t<.4);
            if(release){const t=time-release[1];compression=1+Math.sin(t*22)*.07*(1-t/.4);}
          }
          environment.structure(p,compression);
        }
        for(const a of s.arches||[])if(a.end>camera-80&&a.x<camera+W+80)environment.asset('hollow',(a.x+a.end)/2,BitDogLevels.groundFoot(ground,a.x,a.end),a.end-a.x);
      }
      terrain();
      if (!title) {
        zones(s);
        if(s.platforms.some(p=>p.energized)){
          for(const p of s.platforms.filter(p=>p.energized&&p.end>camera-60&&p.x<camera+W+60)){
            const wire=(offset,color,width)=>path(ctx=>p.surface.forEach(([x,y],i)=>i?ctx.lineTo(x,y+offset):ctx.moveTo(x,y+offset)),null,color,width);
            wire(5,'#213641',11);wire(4,'#508c9c',6);wire(2,'#b2e5dd',1.5);wire(8,'#294653',2);
            if(!reduced)for(let x=p.x+(time*65)%170;x<p.end;x+=170){const y=BitDogLevels.surfaceY(p,x);ellipse(x,y+3,2,1.5,'#d0ffff');}
          }
          for(const j of s.junctions){
            if(j.x<camera-60||j.x>camera+W+60)continue;
            environment.junction(j.x,j.y);
            const k=reduced?1:1+Math.sin(time*9)*.14;
            path(p=>{p.moveTo(j.x-25,j.y-16);p.lineTo(j.x-15,j.y-39*k);p.lineTo(j.x-4,j.y-29);p.lineTo(j.x+9,j.y-44*k);p.lineTo(j.x+26,j.y-17);},null,'#6e4722',5);
            path(p=>{p.moveTo(j.x-25,j.y-16);p.lineTo(j.x-15,j.y-39*k);p.lineTo(j.x-4,j.y-29);p.lineTo(j.x+9,j.y-44*k);p.lineTo(j.x+26,j.y-17);},null,'#ffe18a',2.5);
          }
        }
        if(s.leaves.length){
          for(const patch of s.leaves){
            if(patch.end<camera||patch.x>camera+W)continue;
            c.save();c.globalAlpha=patch.cleared?.2:1;
            environment.orchard('leaves',(patch.x+patch.end)/2,ground((patch.x+patch.end)/2)+22,patch.end-patch.x,78);c.restore();
          }
        }
        for(const pond of s.ponds){if(pond.end<camera-100||pond.x>camera+W+100)continue;environment.obstacle('pond',(pond.x+pond.end)/2,ground(pond.x)+65,pond.end-pond.x+75,175);}
        if(s.bridge.end>camera&&s.bridge.x<camera+W){
          environment.obstacle('tunnel',(s.tunnel.x+s.tunnel.end)/2,ground(s.tunnel.x)+10,s.tunnel.end-s.tunnel.x,125);
          environment.obstacle('boardwalk',(s.bridge.x+s.bridge.end)/2,s.bridge.y+72,s.bridge.end-s.bridge.x,86);
        }
        house(d);
        if (s.phase === 'won') coin(287, ground(HOME) - 63, 23, 0);
        if(530>camera-180&&530<camera+W+180)sign(530,'FETCH');
        for (const coinItem of s.pickups) if (!coinItem.taken && coinItem.x > camera - 30 && coinItem.x < camera + W + 30) coin(coinItem.x, coinItem.y + Math.sin(time * 3 + coinItem.x) * 4, 13, time + coinItem.x);
        for (const o of s.obstacles) if (Math.abs(o.x - camera - W / 2) < W) obstacle(o, s.phase === 'return');
        for (const x of s.pads) {
          const y = ground(x); c.fillStyle = '#f8df82'; c.fillRect(x - 35, y - 7, 70, 8);
          text(s.phase === 'return' ? '‹‹‹' : '›››', x, y - 12, 23, '#e8a03d');
        }
        if (!d.carrying) {
          const y = ground(FETCH) - 55; ellipse(FETCH, ground(FETCH) - 3, 39, 8, '#54723e27');
          ellipse(FETCH, y, 60 + Math.sin(time * 3) * 3, 60 + Math.sin(time * 3) * 3, '#ffeab34b');
          coin(FETCH, y + Math.sin(time * 3) * 6, 37, time * .4); text('THE BIG ONE', FETCH, y - 81, 12, '#6e804f');
        }
        if (Math.abs(d.vx) > 620 && !reduced) for (let i = 0; i < 4; i++) line(d.x - Math.sign(d.vx) * (50 + i * 7), d.y - 13 - i * 12, d.x - Math.sign(d.vx) * (80 + i * 13), d.y - 13 - i * 12, '#fff6cf99', 2);
        dog(d.x, d.y, 1, d);
        mudContact(s);
        if (d.charge > 0) { c.fillStyle = '#5c7746'; c.fillRect(d.x - 25, d.y - 73, 50, 5); c.fillStyle = '#ffd66b'; c.fillRect(d.x - 25, d.y - 73, d.charge * 50, 5); }
      }
      for (const p of particles) {
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt;
        c.globalAlpha = Math.max(0, 1 - p.age / p.life); c.fillStyle = p.color; c.fillRect(p.x, p.y, 5, 5);
      }
      particles = particles.filter(p => p.age < p.life); c.globalAlpha = 1;
      c.restore();
      if (title) {
        const narrow = W < 800, x = narrow ? W * .78 : W * .74, y = ground(x) - 4, scale = narrow ? 1.65 : 2.65;
        for (let i = 0; i < 4; i++) coin(x - 40 + i * 65, y - 190 - Math.sin(i * .7) * 32, 15, time + i);
        dog(x, y, scale, { x: 0, vx: 0, facing: -1, carrying: false }, true);
        text('✦', x - 105, y - 75 + Math.sin(time * 2) * 5, 27, '#f4bb57');
        text('✦', x + 135, y - 129 + Math.sin(time * 2 + 1) * 5, 20, '#f4bb57');
      }
    }
    function drawOpening(shot, s, paused = false) {
      time = shot.time;
      c.setTransform(canvas.width / W,0,0,canvas.height / H,0,0);
      if (introVideo.draw(shot,W,H,paused)) {
        // Continuous authored footage; no sprite swapping or face crossfades.
      } else if(shot.id==='flight') {
        // Same sky, hills and tree primitives as gameplay; level obstacles are
        // projected in their actual distance order into the owner's forward view.
        camera=0; const illustratedPOV=environment.drawPOV(W,H); if(!illustratedPOV)background(s);
        const horizon=275,vx=W*.58;
        if(!illustratedPOV){
        path(p=>{p.moveTo(0,H);p.lineTo(0,410);p.quadraticCurveTo(W*.25,325,vx,horizon);p.quadraticCurveTo(W*.8,340,W,410);p.lineTo(W,H);p.closePath();},'#91ac71');
        path(p=>{p.moveTo(W*.24,H);p.bezierCurveTo(W*.27,450,W*.7,370,vx,horizon);p.bezierCurveTo(W*.79,370,W*.7,465,W*.86,H);p.closePath();},'#c4b783');
        path(p=>{p.moveTo(W*.24,H);p.bezierCurveTo(W*.27,450,W*.7,370,vx,horizon);},null,'#7b9b55',7);
        const perspective=z=>1/(1+z/760);
        for(let i=12;i>=0;i--){const z=650+i*330,k=perspective(z),y=horizon+(H-horizon)*k;
          tree(vx-W*.65*k,y,k*1.6,i>6);tree(vx+W*.57*k,y+3,k*1.55,i>6);
        }
        for(const o of [...s.obstacles].reverse()) {
          const k=perspective(o.x-HOME),y=horizon+(H-horizon)*k;
          c.save();c.translate(vx+Math.sin(o.x/330)*W*.14*k,y);c.scale(k*1.2,k*1.2);c.translate(-o.x,-ground(o.x));obstacle(o,false);c.restore();
        }
        for(let i=0;i<14;i++){const k=perspective(350+i*310),y=horizon+(H-horizon)*k;line(vx-W*.47*k,y,vx-W*.47*k,y-42*k,'#eee4bd',4*k);}
        }
        if(shot.local<.65) {const a=1-shot.local/.65;c.globalAlpha=a;
          if(!environment.drawOwner(7,W*.83,H+120,340)){line(W*.86,H+50,W*.73,H-110,'#969f7c',75);line(W*.73,H-110,W*.67,H-155,'#dfad83',38);ellipse(W*.67,H-155,24,14,'#e6b58c',-.5);}c.globalAlpha=1;}
        const t=Math.min(1,shot.local/2.35),arc=1-Math.pow(1-t,2);
        const x=W*.69+(vx-W*.69)*arc,y=455+(horizon-48-455)*arc-Math.sin(t*Math.PI)*95;
        if(!shot.star){
          if(!reduced)for(let i=1;i<=7;i++){c.globalAlpha=(1-t)*.16*(1-i/8);coin(x+8*i,y+15*i,Math.max(2,(1-t)*43-i*2),shot.local*9);}
          c.globalAlpha=1;coin(x,y,Math.max(2,43*Math.pow(1-t,1.4)),shot.local*10);
        } else {
          const tStar=(shot.local-2.35)/1.15,pulse=reduced?1: .6+.4*Math.sin(tStar*Math.PI*3),r=(10+pulse*17)*(1-tStar*.6);
          c.save();c.translate(vx,horizon-48);c.globalAlpha=Math.max(0,1-Math.max(0,tStar-.72)/.28);
          ellipse(0,0,r*1.6,r*1.6,'#fff3b524');
          path(p=>{p.moveTo(0,-r);p.lineTo(r*.17,-r*.17);p.lineTo(r,0);p.lineTo(r*.17,r*.17);p.lineTo(0,r);p.lineTo(-r*.17,r*.17);p.lineTo(-r,0);p.lineTo(-r*.17,-r*.17);p.closePath();},'#fffce6');c.restore();
        }
      }
      // Consistent cinematic framing; the dog remains clear of the controls.
      const bars=W<800?24:30;c.fillStyle='#263729';c.fillRect(0,0,W,bars);c.fillRect(0,H-bars,W,bars);
      text('BITDOG  /  '+level.name.toUpperCase(),W/2,H-10,9,'#d3dabc','center','DM Sans');
      c.globalAlpha=1;
    }
    canvas.bitdogResizeObserver?.disconnect();
    canvas.bitdogResizeObserver=new ResizeObserver(resize);
    canvas.bitdogResizeObserver.observe(canvas);
    resize(); return { draw, drawOpening, resize, burst, seekOpening: introVideo.seek, pauseOpening: introVideo.pause, get openingReady() { return introVideo.ready; }, get openingStatus() { return introVideo.status; }, get artReady() { return introVideo.ready && poses.complete && poses.naturalWidth > 0 && posesLeft.complete && posesLeft.naturalWidth > 0 && sittingLeft.complete && sittingLeft.naturalWidth > 0 && environment.ready; }, reset() { introVideo.stop(); camera = 0; cameraY=0; particles = []; gateOpenedAt.clear();springReleasedAt.clear(); } };
  };
})();
