import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EFFECTS,MODEL,FORMAT} from './effects.mjs';
import {SOUND_BANK} from '../js/sound-bank.mjs';

const root=new URL('../',import.meta.url);
const args=process.argv.slice(2),dry=args.includes('--dry-run');
const ids=args.filter(a=>!a.startsWith('--'));
if(args.some(a=>a.startsWith('--')&&a!=='--dry-run')||ids.some(id=>!EFFECTS.some(e=>e.id===id)))throw Error('Usage: node audio/generate.mjs [--dry-run] [effect-id ...]');
const effects=ids.length?EFFECTS.filter(e=>ids.includes(e.id)):EFFECTS;
async function exists(url){try{return (await stat(url)).size>0;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
let ledger={provider:'ElevenLabs',model:MODEL,format:FORMAT,effects:{}};
try{ledger=JSON.parse(await readFile(new URL('audio/generated.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const pending=[];
for(const effect of effects){
  const file=`assets/sfx-${effect.id}.mp3`,target=new URL(file,root);
  if(await exists(target)){console.log(`Keep existing ${effect.id}`);continue;}
  pending.push({...effect,file,target});
}
console.log(`${pending.length} effects pending; ${pending.reduce((n,e)=>n+e.duration,0).toFixed(1)} seconds requested.`);
if(dry){for(const e of pending)console.log(`${e.id} (${e.duration}s): ${e.prompt}`);process.exit(0);}
const key=process.env.ELEVENLABS_API_KEY;
if(pending.length&&!key){console.error('ELEVENLABS_API_KEY is not configured. No generation requests made. Set it in your local environment; never put it in browser code.');process.exit(1);}
async function saveBank(){
  const bank={...SOUND_BANK}; // Preserve the local pack and its additional UI cues.
  for(const e of EFFECTS){const entry=ledger.effects[e.id];if(entry&&await exists(new URL(entry.file,root)))bank[e.id]={file:entry.file,volume:e.volume,cooldown:e.cooldown};}
  const url=new URL('js/sound-bank.mjs',root),tmp=new URL('js/sound-bank.mjs.tmp',root);
  await writeFile(tmp,'// Generated ElevenLabs files. No API credentials are shipped to the browser.\nexport const SOUND_BANK = '+JSON.stringify(bank,null,2)+';\n');await rename(tmp,url);
}
for(const e of pending){
  console.log(`Generating ${e.id}...`);
  // No automatic retries: a timed-out billable request may already have succeeded.
  const response=await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${FORMAT}`,{
    method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},
    body:JSON.stringify({text:e.prompt,duration_seconds:e.duration,model_id:MODEL,prompt_influence:.4,loop:false}),
    signal:AbortSignal.timeout(120000)
  });
  if(!response.ok)throw Error(`ElevenLabs returned HTTP ${response.status} for ${e.id}. Generation stopped; completed files are kept.`);
  const data=Buffer.from(await response.arrayBuffer());
  if(!response.headers.get('content-type')?.startsWith('audio/')||data.length<100)throw Error(`Invalid audio response for ${e.id}; not saved.`);
  await writeFile(e.target,data,{flag:'wx'});
  ledger.effects[e.id]={file:e.file,prompt:e.prompt,durationRequested:e.duration,createdAt:new Date().toISOString(),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  await writeFile(new URL('audio/generated.json',root),JSON.stringify(ledger,null,2)+'\n');
  await saveBank();console.log(`Saved ${e.file}`);
}
await saveBank();
await import('../integration/build-manifest.mjs');
console.log('Generation complete. Listen to and balance the effects before publishing.');
