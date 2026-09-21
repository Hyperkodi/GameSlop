import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionInView,sectionVisible,updatePositions} from '../snake.mjs';

test('body sections draw through the top edge before entering the combat targeting area',()=>{
 const s={hp:10,points:[{x:150,y:24},{x:150,y:0},{x:150,y:-24},{x:150,y:-48}]};
 assert.equal(sectionInView(s),true);
 assert.equal(sectionVisible(s),false,'rendering must not move the combat targeting boundary');
 assert.equal(sectionInView({points:[{x:150,y:-80},{x:150,y:-150}]}),false);
 assert.equal(sectionInView({points:[{x:150,y:-8}]}),true,'stroke and head edges can enter before their center');
});

test('each route feeds body points from above the canvas without an entrance jump',()=>{
 for(let chapter=0;chapter<10;chapter++)for(let snakeId=0;snakeId<4;snakeId++){
  const r={combatVersion:3,routeVersion:2,mode:'campaign',chapter,wave:1,routeSeed:77,time:0,
   snakes:[{id:snakeId,distance:80,phase:0}],
   segments:[{snakeId,head:true,pieces:1,spacing:24},{snakeId,pieces:4,spacing:24}]};
  updatePositions(r);const body=r.segments[1];
  assert.ok(body.points.some(p=>p.y>0&&p.y<60));
  assert.ok(body.points.some(p=>p.y<0));assert.equal(sectionInView(body),true);
  const before=body.points.map(p=>({...p}));r.snakes[0].distance+=1;updatePositions(r);
  assert.ok(body.points.every((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)<1.3));
 }
});
