const test=require('node:test'),assert=require('node:assert/strict');
const manifest=require('../art/environment/manifest.json');
const {layout}=require('../js/environment.js');
test('adjacent background tiles keep their authored 96-pixel overlap',()=>{
 assert.equal(manifest.tiles[0].x,0);
 for(let i=1;i<manifest.tiles.length;i++){const a=manifest.tiles[i-1],b=manifest.tiles[i];assert.equal(a.x+a.w-b.x,96);assert.equal(a.h,b.h);}
 const last=manifest.tiles.at(-1);assert.equal(last.x+last.w,manifest.width);
});
test('panorama covers every camera position without gaps in portrait, landscape and desktop',()=>{
 for(const width of [540,938,1313,2100])for(let camera=0;camera<=22000;camera+=73){
  const p=layout(manifest,width,620,camera);assert.ok(p.visible[0].x<=.001);assert.ok(p.visible.at(-1).x+p.visible.at(-1).w>=width-.001);
  assert.ok(p.y<=0);assert.ok(p.y+manifest.height*p.scale>=620-.001);
  for(let i=1;i<p.visible.length;i++)assert.ok(p.visible[i].x<=p.visible[i-1].x+p.visible[i-1].w);
 }
});
