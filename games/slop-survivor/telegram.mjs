// Telegram CloudStorage is scoped to this bot/user by the host. No bot token is used.
// A revision pointer is committed only after every chunk has been stored successfully.
const PREFIX='slop_survivor_2_',CHUNK=3500,MAX_CHUNKS=96;
const checksum=s=>{let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16);};
export class TelegramSaves{
 constructor(api){this.api=api;this.busy=false;}
 call(method,...args){return new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{settled=true;reject(new Error('Telegram did not respond. Your local save is safe.'));},12000);try{this.api[method](...args,(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(new Error(String(err))):resolve(value);});}catch(e){clearTimeout(timer);reject(e);}});}
 async save(snapshot){if(this.busy)throw new Error('A cloud operation is already in progress.');this.busy=true;let head=null,keys=[];try{
  const body=JSON.stringify({format:1,savedAt:Date.now(),save:snapshot}),parts=[];for(let i=0;i<body.length;i+=CHUNK)parts.push(body.slice(i,i+CHUNK));if(parts.length>MAX_CHUNKS)throw new Error('Save is too large for Telegram sync. Progress remains on this device.');
  const old=await this.call('getItem',PREFIX+'head');if(old){try{head=JSON.parse(old);}catch{}}
  // Unique revision keys keep simultaneous device writes from mixing chunks.
  const id=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);keys=parts.map((_,i)=>PREFIX+id+'_'+i);
  for(let i=0;i<parts.length;i++){const stored=await this.call('setItem',keys[i],parts[i]);if(stored!==true)throw new Error('Telegram could not store this save.');}
  const meta={id,count:parts.length,hash:checksum(body)};if(await this.call('setItem',PREFIX+'head',JSON.stringify(meta))!==true)throw new Error('Cloud save was not committed.');
  // Keep the preceding snapshot intact if cleanup fails; it cannot affect this revision.
  if(head&&Number.isInteger(head.count)&&head.count>0&&head.count<=MAX_CHUNKS&&/^[a-z0-9_]+$/.test(head.id))try{await this.call('removeItems',Array.from({length:head.count},(_,i)=>PREFIX+head.id+'_'+i));}catch{}
  return {savedAt:JSON.parse(body).savedAt};
 }catch(e){if(keys.length)try{const active=await this.call('getItem',PREFIX+'head');if(!active||!keys[0].startsWith(PREFIX+JSON.parse(active).id+'_'))await this.call('removeItems',keys);}catch{}throw e;}finally{this.busy=false;}}
 async load(){if(this.busy)throw new Error('A cloud operation is already in progress.');this.busy=true;try{
  const raw=await this.call('getItem',PREFIX+'head');if(!raw)return null;const meta=JSON.parse(raw);if(!/^[a-z0-9_]+$/.test(meta.id)||!Number.isInteger(meta.count)||meta.count<1||meta.count>MAX_CHUNKS)throw new Error('Invalid cloud save manifest.');
  const keys=Array.from({length:meta.count},(_,i)=>PREFIX+meta.id+'_'+i),items=await this.call('getItems',keys);if(keys.some(k=>typeof items[k]!=='string'))throw new Error('Cloud save is incomplete. Your local progress is unchanged.');const body=keys.map(k=>items[k]).join('');if(checksum(body)!==meta.hash)throw new Error('Cloud save integrity check failed.');
  const data=JSON.parse(body);if(data.format!==1||![1,2].includes(data.save?.version)||!data.save.levels)throw new Error('Unsupported cloud save.');return data;
 }finally{this.busy=false;}}
}
export async function connectTelegram(){
 if(typeof window==='undefined')return null;
 if(!window.Telegram?.WebApp&&/tgWebApp(?:Data|Version|Platform)=/.test(location.hash+location.search)){
  await new Promise(resolve=>{const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js?63';script.onload=resolve;script.onerror=resolve;document.head.append(script);setTimeout(resolve,8000);});
 }
 const app=window.Telegram?.WebApp;if(!app?.initData||!app.CloudStorage||!app.isVersionAtLeast?.('6.9'))return null;
 app.ready();app.expand();if(app.isVersionAtLeast('7.7'))app.disableVerticalSwipes();
 return {app,saves:new TelegramSaves(app.CloudStorage)};
}
