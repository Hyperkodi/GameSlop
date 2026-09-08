import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {VERSION} from '../js/model.mjs';
const root=new URL('../',import.meta.url);
const files=['index.html','sound-lab.html','style.css','ruleset.json','integration/gameslop-sdk.js'];
for(const dir of ['js','assets'])for(const file of await readdir(new URL(dir+'/',root)))files.push(dir+'/'+file);
files.sort();const entries=[];
for(const file of files){const data=await readFile(new URL(file,root));entries.push({path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const buildHash=createHash('sha256').update(entries.map(f=>f.path+'\0'+f.sha256+'\n').join('')).digest('hex');
await writeFile(new URL('build-manifest.json',root),JSON.stringify({version:VERSION,buildHash,files:entries},null,2)+'\n');
console.log(`Pac-Chad build: ${buildHash}`);
