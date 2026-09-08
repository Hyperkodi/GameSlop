import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
test('local preview serves the game, modules and artwork but no workspace files',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const index=await fetch(base+'/games/pac-chad/');assert.equal(index.status,200);assert.match(await index.text(),/PAC<span>-CHAD/);
    assert.match((await fetch(base+'/games/pac-chad/js/model.mjs')).headers.get('content-type'),/javascript/);
    assert.equal((await fetch(base+'/games/pac-chad/assets/chad.png')).status,200);
    for(const url of ['/games/goldeneye/data/gameslop.z64','/games/pac-chad/server.mjs','/games/pac-chad/../../.git/config','/games/pac-chad/%2e%2e%5cpackage.json'])assert.equal((await fetch(base+url)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
