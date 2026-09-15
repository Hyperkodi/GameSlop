import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {WEAPONS} from '../data.mjs';
import {WEAPON_ART} from '../illustrated.mjs';
import {drawIcon} from '../art.mjs';
test('all 24 weapons have cached illustrated assets and distinct procedural silhouettes',()=>{
 assert.equal(WEAPON_ART.length,24);
 const cache=readFileSync(new URL('../sw.js',import.meta.url),'utf8'),signatures=new Set();
 for(const w of WEAPONS){
  assert.ok(WEAPON_ART.includes(w.id));
  assert.ok(existsSync(new URL('../assets/illustrated/'+w.id+'.webp',import.meta.url)));
  assert.ok(cache.includes('./assets/illustrated/'+w.id+'.webp'));
  const calls=[],c=new Proxy({}, {get:(o,k)=>o[k]??((...a)=>calls.push([k,...a])),set:(o,k,v)=>(calls.push([k,v]),o[k]=v,true)});
  drawIcon(c,w.id,0,0,40,true);assert.ok(calls.length>15,w.id);signatures.add(JSON.stringify(calls));
 }
 assert.equal(signatures.size,24);
});
test('every precached file exists so an asset typo cannot break offline installation',()=>{
 const cache=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const path of cache.match(/const ASSETS=\[(.*?)\];/s)[1].matchAll(/"(.*?)"/g))assert.ok(existsSync(new URL('.'+path[1],import.meta.url)),path[1]);
});
