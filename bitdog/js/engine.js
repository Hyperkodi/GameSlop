(function (root) {
  'use strict';
  const Levels=root.BitDogLevels||(typeof require==='function'?require('./levels.js'):null);
  const END = 22000, HOME = 190, FETCH = 21700, RETURN_TIME = 75;
  const PONDS = [{x:4300,end:4950},{x:15700,end:16250}];
  const BRIDGE = {x:7300,end:8400,y:390};
  const TUNNEL = {x:7370,end:8330};
  const COIN_POINTS = 100, TIME_POINTS = 50, DELIVERY_POINTS = 1000, OBSTACLE_POINTS = 1000;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function ground(x,levelId=1) {
    if(levelId===3||levelId===6)return 490;
    if(levelId===4)return 490+Math.sin(x/1100)*12;
    if(levelId===5)return 480+Math.sin(x/1250)*32;
    if(levelId===7)return 490+Math.sin(x/1600)*18;
    if(levelId===2||levelId===8){
      let y=480+Math.sin(x/570)*22+Math.sin(x/1200)*16;
      // Graded loading yards give every wheel and support a common ground plane.
      for(const yard of Levels.harvestYards){
        const t=Math.min(clamp((x-yard.x+220)/220,0,1),clamp((yard.end+220-x)/220,0,1));
        y+=(yard.y-y)*t*t*(3-2*t);
      }
      return y;
    }
    const t = clamp((x - 450) / 400, 0, 1);
    let y=460+t*(Math.sin(x/330)*55+Math.sin(x/690)*38);
    for(const zone of [...PONDS,{x:7100,end:8600}]) {
      const blend=Math.min(clamp((x-zone.x+180)/180,0,1),clamp((zone.end+180-x)/180,0,1));
      y+=(500-y)*blend;
    }
    return y;
  }
  function slope(x) { return (ground(x + 2) - ground(x - 2)) / 4; }
  function createEngine(levelId=1,{hearts=5}={}) {
    const startingHearts=Math.max(1,Math.min(5,Math.floor(hearts)||5));
    const level=Levels.get(levelId);levelId=level.id;
    const ground=x=>api.ground(x,levelId),slope=x=>(ground(x+2)-ground(x-2))/4;
    const PONDS=levelId===1?api.PONDS:[],RETURN_TIME=level.returnTime;
    let s;
    function reset() {
      s = { level,platforms:Levels.platforms(levelId,ground),leaves:levelId===2?[{x:3920,end:4490},{x:11400,end:12000},{x:18100,end:18750}].map(z=>({...z,cleared:false})):[], phase: 'ready', elapsed: 0, returnTime: RETURN_TIME, score: 0, obstaclePoints: 0, coins: 0, hearts:startingHearts, failure:null, result:null,
        distance: 0, combo: 0, comboTime: 0, events: [], particles: [],
        dog: { x: HOME, y: ground(HOME), vx: 0, vy: 0, facing: 1, grounded: true,
          rolling: false, sprinting: false, charge: 0, invincible: 0, coyote: .1, jumpBuffer: 0, carrying: false, platform:false,platformId:null,springTimer:0, electricTimer:0,railCooldown:0, wet:false, snowball:0,gliding:false,glideCooldown:0,gravityScale:1,muddy:false,gustId:null,gravityPocket:false },
        pickups: Array.from({ length: 150 }, (_, i) => {
          const x = 570 + i * 139;
          return { x, y: ground(x) - 56 - Math.max(0, Math.sin(i * .65)) * 90, taken: false };
        }).filter(p=>p.x<7100||p.x>8650).concat(Array.from({length:10},(_,i)=>({x:7360+i*108,y:BRIDGE.y-45,taken:false}))),
        obstacles: [
          { x: 1350, type: 'fence', h: 59 }, { x: 1930, type: 'crate', h: 48 },
          { x: 2760, type: 'fence', h: 65 }, { x: 3610, type: 'crate', h: 48 },
          { x: 5600, type: 'rock', h: 54 }, { x: 6400, type: 'crate', h: 48 },
          { x: 9400, type: 'fence', h: 60 }, { x: 10450, type: 'crate', h: 48 },
          { x: 12000, type: 'rock', h: 57 }, { x: 13200, type: 'fence', h: 60 },
          { x: 14600, type: 'crate', h: 48 }, { x: 17400, type: 'rock', h: 54 },
          { x: 19000, type: 'fence', h: 60 }, { x: 20400, type: 'crate', h: 48 }
        ].map(o => ({ ...o, broken: false, cooldown: 0 })),
        ponds:PONDS,bridge:BRIDGE,tunnel:TUNNEL,
        pads: [980, 3200, 4090, 5210, 7230, 8450, 11100, 15350, 16500, 19700], lastJump: false, lastRoll: false, intro: 1.5 };
      if(levelId===2){
        s.bridge={x:-2000,end:-1000,y:390};s.tunnel={x:-2000,end:-1000};
        s.pads=[980,6900,9200,14300,15800,20900];
        s.obstacles=[1450,2300,6550,7750,8650,9640,13800,14900,15870,16350,20600,21200].map((x,i)=>({x,type:i%3?'crate':'rock',skin:i%3?'apples':'hay',h:i%3?50:48,broken:false,cooldown:0}));
        s.pickups=Array.from({length:140},(_,i)=>{const x=570+i*148;return{x,y:ground(x)-65,taken:false};});
        for(const p of s.platforms)for(let x=p.x+45;x<p.end-25;x+=90)s.pickups.push({x,y:Levels.surfaceY(p,x)-46,taken:false});
      }
      s.junctions=[];
      if(levelId===3){
        s.bridge={x:-2000,end:-1000,y:390};s.tunnel={x:-2000,end:-1000};s.pads=[];
        s.obstacles=[1400,2200,6200,7200,8350,9000,12700,13800,14900,15700,19900,20800].map((x,i)=>({x,type:i%3?'crate':'rock',skin:i%3?null:'roadwork',h:i%3?48:52,broken:false,cooldown:0}));
        s.pickups=Array.from({length:140},(_,i)=>{const x=570+i*148;return{x,y:ground(x)-60,taken:false};});
        for(const p of s.platforms){
          for(let x=p.x+45;x<p.end-25;x+=p.energized?75:90)s.pickups.push({x,y:Levels.surfaceY(p,x)-46,taken:false});
          if(p.energized)for(const offset of [460,1090])s.junctions.push({x:p.x+offset,y:Levels.surfaceY(p,p.x+offset),platformId:p.id,cooldown:0});
        }
      }
      s.zones=[];s.umbrellas=[];s.arches=[];
      if(levelId>=4){
        s.bridge={x:-2000,end:-1000,y:390};s.tunnel={x:-2000,end:-1000};s.pads=[];
        s.pickups=Array.from({length:140},(_,i)=>{const x=570+i*148;return{x,y:ground(x)-60,taken:false};});
        const skins={4:['stump','mushroomCrate'],5:['iceRock','snow'],6:['sandbag','luggage'],7:['moonrock','moonCrate'],8:['hay','apples']};
        s.obstacles=[1450,2350,5600,6850,8250,9200,12900,13950,15250,15900,19700,20800].map((x,i)=>({x,type:i%3?'crate':'rock',skin:skins[levelId][i%3?1:0],h:i%3?48:50,broken:false,cooldown:0}));
        for(const p of s.platforms){
          for(let x=p.x+40;x<p.end-20;x+=p.energized?75:90)s.pickups.push({x,y:Levels.surfaceY(p,x)-46,taken:false});
          if(p.energized)for(const offset of [460,1090])s.junctions.push({x:p.x+offset,y:Levels.surfaceY(p,p.x+offset),platformId:p.id,cooldown:0});
        }
        if(levelId===4){
          s.zones=[3400,10400,17000].map(x=>({kind:'mud',x,end:x+650}));
          s.arches=[{x:6600,end:7060},{x:14500,end:14960}];
        }
        if(levelId===5)s.zones=[{kind:'snow',x:450,end:END-200}];
        if(levelId===6){
          s.obstacles[0].x=950;s.obstacles[3].x=7450;
          s.zones=[3000,9800,16600].map((x,i)=>({id:`gust-${i}`,kind:'gust',x,end:x+2600,bottom:ground(x)+5,top:115,strength:290,direction:i%2?-1:1}));
          s.umbrellas=s.zones.flatMap(z=>[z.x+50,z.end-50].map(x=>({x,y:ground(x)-130,cooldown:0})));
          for(const z of s.zones)for(let x=z.x+250;x<z.end-100;x+=125)s.pickups.push({x,y:250+35*Math.cos((x-z.x)/250),taken:false});
        }
        if(levelId===7)s.zones=[4900,12000,18600].map(x=>({kind:'gravity',x,end:x+520}));
        if(levelId===8)s.leaves=[{x:3920,end:4490,cleared:false}];
      }
      return s;
    }
    reset();
    const event = (type, x = s.dog.x, y = s.dog.y - 24) => s.events.push({ type, x, y });
    function start() { reset(); s.phase = 'outbound'; event('start'); }
    function update(dt, input = {}) {
      s.events.length = 0;
      if (s.phase !== 'outbound' && s.phase !== 'return') return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const jumpPressed = !!input.jump && !s.lastJump;
      if (jumpPressed) s.dog.jumpBuffer = .14;
      for (let n = 0; n < steps; n++) tick(dt / steps, input);
      s.lastJump = !!input.jump; s.lastRoll = !!input.roll;
    }
    function tick(dt, input) {
      if (s.phase !== 'outbound' && s.phase !== 'return') return;
      const d = s.dog, move = clamp(Number(input.move) || 0, -1, 1), roll = !!input.roll;
      s.elapsed += dt; s.intro = Math.max(0, s.intro - dt);
      s.comboTime -= dt; if (s.comboTime <= 0) s.combo = 0;
      d.invincible = Math.max(0, d.invincible - dt);
      d.electricTimer=Math.max(0,d.electricTimer-dt);d.railCooldown=Math.max(0,d.railCooldown-dt);
      d.glideCooldown=Math.max(0,d.glideCooldown-dt);
      for(const u of s.umbrellas)u.cooldown=Math.max(0,u.cooldown-dt);
      const pocket=s.zones.some(z=>z.kind==='gravity'&&d.x>=z.x&&d.x<=z.end);
      if(pocket&&!d.gravityPocket)event('gravity');d.gravityPocket=pocket;d.gravityScale=levelId===7?(pocket?1:.48):1;
      d.jumpBuffer = Math.max(0, d.jumpBuffer - dt);
      d.coyote = d.grounded ? .10 : Math.max(0, d.coyote - dt);
      if (s.phase === 'return') {
        s.returnTime = Math.max(0, s.returnTime - dt);
        if (s.returnTime <= 0) { s.phase = 'lost'; s.failure='time'; event('timeout'); return; }
      }
      d.rolling=roll;d.charge=0;
      d.sprinting=!!input.sprint&&!roll&&Math.abs(move)>.12;
      if(!roll&&Math.abs(move)>.12)d.facing=Math.sign(move);
      const supportBefore=s.platforms.find(p=>p.id===d.platformId);
      const incline=d.platform&&supportBefore?(Levels.surfaceY(supportBefore,d.x+2)-Levels.surfaceY(supportBefore,d.x-2))/4:slope(d.x);
      if(roll){
        // Gravity follows the supporting surface; controls never propel a roll.
        // Downhill builds momentum, uphill brakes it, and flat ground stops it.
        if(d.grounded)d.vx+=clamp(incline,-.4,.4)*1750*d.gravityScale*dt;
        const speed=Math.max(0,Math.abs(d.vx)*Math.exp(-dt*.3)-100*dt);
        d.vx=speed>0?Math.sign(d.vx)*speed:0;
        if(speed>5)d.facing=Math.sign(d.vx);
      }else{
        const accel=d.grounded?(d.sprinting?1600:1300):630;
        const max=(d.sprinting?(s.phase==='return'?880:820):(s.phase==='return'?560:490))*(d.electricTimer>0?1.35:1);
        if(Math.abs(d.vx)<max||Math.sign(move)!==Math.sign(d.vx))d.vx+=move*accel*dt;
        if(d.grounded){
          d.vx+=clamp(incline,-.4,.4)*360*dt;
          if(Math.abs(move)<.12)d.vx*=Math.exp(-dt*6);
          else if(Math.sign(move)!==Math.sign(d.vx))d.vx*=Math.exp(-dt*5);
        }
        if(Math.abs(d.vx)>max)d.vx*=Math.exp(-dt*1.5);
      }
      d.vx = clamp(d.vx, d.electricTimer>0?-1350:-1100, d.electricTimer>0?1350:1100);
      if(d.jumpBuffer>0&&d.gliding){d.gliding=false;d.glideCooldown=.7;d.jumpBuffer=0;event('umbrellaFold');}
      if (d.jumpBuffer > 0 && d.coyote > 0 && d.springTimer<=0) {
        if(s.platforms.find(p=>p.id===d.platformId)?.energized)d.railCooldown=.22;
        if(d.snowball>0){d.snowball=0;event('snowshed');}
        d.vy = -660; d.grounded = false; d.platform=false;d.platformId=null; d.coyote = 0; d.jumpBuffer = 0; event('jump');
      }
      if (!input.jump && d.vy < -240) d.vy += 1600 * d.gravityScale * dt;
      const oldX = d.x;
      const oldY = d.y;
      d.x = clamp(d.x + d.vx * dt, 85, END - 60);
      if (d.x === 85 || d.x === END - 60) d.vx = 0;
      let support=s.platforms.find(p=>p.id===d.platformId);
      if(d.grounded&&!d.platform){
        // A loading ramp can be entered on foot at its low end, without a jump.
        const ramp=s.platforms.find(p=>p.walkIn&&((oldX<=p.x&&d.x>=p.x&&d.x<=p.end&&Math.abs(oldY-Levels.surfaceY(p,p.x))<12)||(p.bidirectional&&oldX>=p.end&&d.x<=p.end&&d.x>=p.x&&Math.abs(oldY-Levels.surfaceY(p,p.end))<12)));
        if(ramp){support=ramp;d.platform=true;d.platformId=ramp.id;}
      }
      if(d.grounded&&d.platform&&(!support||d.x<support.x||d.x>support.end)){d.grounded=false;d.platform=false;d.platformId=null;d.springTimer=0;d.vy=0;support=null;}
      if(d.grounded){
        d.y=d.platform&&support?Levels.surfaceY(support,d.x):ground(d.x);
        if(d.springTimer>0){d.springTimer=Math.max(0,d.springTimer-dt);if(!d.springTimer){d.vy=input.jump?-820:-560;d.grounded=false;d.platform=false;d.platformId=null;d.coyote=0;d.jumpBuffer=0;event('mushroom',d.x,d.y);}}
      }else{
        d.vy+=1750*d.gravityScale*dt;
        if(d.gliding){
          const gust=s.zones.find(z=>z.kind==='gust'&&d.x>=z.x&&d.x<=z.end&&d.y>z.top&&d.y<z.bottom);
          if(gust){
            if(d.gustId!==gust.id)event('gust');d.gustId=gust.id;
            if(!d.rolling)d.vx+=gust.direction*gust.strength*dt;
            // Lift is gentle, height-bounded and available on both legs of the fetch.
            d.vy=Math.max(-220,d.vy-2050*dt);
          }else d.gustId=null;
          d.vy=Math.min(gust?115:190,d.vy);
        }
        d.y+=d.vy*dt;
        const landing=d.vy>=0?s.platforms.filter(p=>(!p.energized||d.railCooldown<=0)&&d.x>=p.x&&d.x<=p.end&&oldY<=Levels.surfaceY(p,oldX)+.1&&d.y>=Levels.surfaceY(p,d.x)).sort((a,b)=>Levels.surfaceY(a,d.x)-Levels.surfaceY(b,d.x))[0]:null;
        if(landing){d.y=Levels.surfaceY(landing,d.x);d.vy=0;d.grounded=true;d.platform=true;d.platformId=landing.id;d.springTimer=landing.kind==='spring'?.085:0;event('land');}
        else if(d.y>=ground(d.x)&&d.vy>=0){d.y=ground(d.x);d.vy=0;d.grounded=true;d.platform=false;d.platformId=null;event('land');}
      }
      if(d.grounded&&d.gliding){d.gliding=false;d.glideCooldown=.5;event('umbrellaFold');}
      for(const u of s.umbrellas){
        if(u.cooldown<=0&&d.glideCooldown<=0&&!d.gliding&&Math.hypot(d.x-u.x,d.y-30-u.y)<65){
          u.cooldown=3;d.gliding=true;d.vy=-440;d.grounded=false;d.platform=false;d.platformId=null;d.coyote=0;d.jumpBuffer=0;event('umbrella');
        }
      }
      const onSnow=s.zones.some(z=>z.kind==='snow'&&d.x>=z.x&&d.x<=z.end);
      if(onSnow&&d.grounded&&d.rolling&&Math.abs(d.vx)>120){
        if(d.snowball===0)event('snowgrow');d.snowball=Math.min(1,d.snowball+dt*.5);
      }else if(d.snowball>0){d.snowball=Math.max(0,d.snowball-dt*.8);}
      d.muddy=d.grounded&&!d.platform&&s.zones.some(z=>z.kind==='mud'&&d.x>=z.x&&d.x<=z.end);
      if(d.muddy)d.vx*=Math.exp(-dt*4);
      if(d.grounded&&s.platforms.find(p=>p.id===d.platformId)?.energized){
        if(d.electricTimer<=0)event('electric');d.electricTimer=.8;
      }
      for(const junction of s.junctions){
        junction.cooldown=Math.max(0,junction.cooldown-dt);
        if(Math.abs(d.x-junction.x)<27&&Math.abs(d.y-junction.y)<31&&d.invincible<=0&&junction.cooldown<=0){
          junction.cooldown=1.6;d.invincible=1.6;d.vx=-Math.sign(d.vx||d.facing)*170;d.vy=-290;
          d.grounded=false;d.platform=false;d.platformId=null;d.electricTimer=0;d.railCooldown=.35;d.coyote=0;
          s.hearts=Math.max(0,s.hearts-1);s.combo=0;event('zap');
          if(s.hearts===0){s.phase='lost';s.failure='hearts';d.vx=0;event('exhausted');return;}
        }
      }
      for(const leaves of s.leaves){if(!leaves.cleared&&d.grounded&&!d.platform&&d.x>=leaves.x&&d.x<=leaves.end){if(d.rolling&&Math.abs(d.vx)>150){leaves.cleared=true;event('leaves');}else d.vx*=Math.exp(-dt*1.8);}}
      const wet=d.grounded&&!d.platform&&PONDS.some(p=>d.x>=p.x&&d.x<=p.end);
      if(wet&&!d.wet)event('splash');d.wet=wet;
      if(wet)d.vx*=Math.exp(-dt*5.5);
      for (const coin of s.pickups) {
        if (!coin.taken && Math.hypot(coin.x - d.x, coin.y - (d.y - 29)) < 49) {
          coin.taken = true; s.coins++; s.combo++; s.comboTime = 1.5;
          s.score += COIN_POINTS; event('coin', coin.x, coin.y);
        }
      }
      for (const o of s.obstacles) {
        o.cooldown = Math.max(0, o.cooldown - dt);
        if (o.broken || (s.phase === 'return' && o.type === 'fence')) continue;
        if (Math.abs(d.x - o.x) < 44 && d.y > ground(o.x) - o.h + 10 && o.cooldown <= 0) {
          if (o.type === 'crate' && d.rolling && Math.abs(d.vx) > 220 && (o.skin!=='snow'||d.snowball>.18)) {
            o.broken = true; s.obstaclePoints += OBSTACLE_POINTS; s.score += OBSTACLE_POINTS; event(o.skin==='snow'?'snowbreak':'smash', o.x, ground(o.x) - 20);
          } else if (d.invincible <= 0) {
            d.x = oldX < o.x ? o.x - 47 : o.x + 47;
            d.vx = oldX < o.x ? -170 : 170; d.vy = -270; d.grounded = false;
            d.gliding=false;d.glideCooldown=.7;d.snowball=0;d.invincible = 1.6; o.cooldown = 1.6; s.combo = 0; d.platform=false;d.platformId=null;d.springTimer=0;
            s.hearts=Math.max(0,s.hearts-1);event('bump');
            if(s.hearts===0){s.phase='lost';s.failure='hearts';d.vx=0;event('exhausted');return;}
          }
        }
      }
      for (const x of s.pads) {
        if (!d.rolling && d.grounded && !d.platform && Math.abs(d.x - x) < 24 && Math.abs(d.vx) < 850) {
          d.vx = (s.phase === 'return' ? -1 : 1) * 1020; event('boost', x, ground(x));
        }
      }
      s.distance = Math.max(s.distance, d.x);
      if (s.phase === 'outbound' && Math.abs(d.x - FETCH) < 62 && d.y > ground(FETCH) - 115) {
        s.phase = 'return'; d.carrying = true; s.combo = 0;
        s.returnTime = RETURN_TIME; event('fetch');
      }
      if (s.phase === 'return' && d.x < HOME + 55) {
        s.phase = 'won'; d.vx = 0; d.rolling = false; d.carrying = false;
        s.result={obstacles:s.obstaclePoints,coins:s.coins*COIN_POINTS,time:Math.floor(s.returnTime)*TIME_POINTS,delivery:DELIVERY_POINTS,perfect:s.hearts===startingHearts};
        s.score=s.result.coins+s.result.time+s.result.delivery+s.result.obstacles;event('win');
      }
    }
    return { get state() { return s; }, start, reset, update };
  }
  const api = { createEngine, ground, slope, END, HOME, FETCH, RETURN_TIME, PONDS, BRIDGE, TUNNEL, COIN_POINTS, TIME_POINTS, DELIVERY_POINTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BitDog = api;
})(typeof window !== 'undefined' ? window : globalThis);
