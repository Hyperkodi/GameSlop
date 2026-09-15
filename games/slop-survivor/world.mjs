export const BOSSES={
 slippy:{name:'Slippy',title:'The original bad investment',color:'#f5a300',accent:'#f5a300',hue:0,portrait:'assets/illustrated/slippy-0.webp',sheet:'slippy',description:'Sleepy eyes. Wide grin. Absolutely no intention of stopping.'},
 baron:{name:'Brass Baron',title:'The vault has teeth',color:'#dba33b',accent:'#12c9c4',hue:0,portrait:'assets/illustrated/baron-0.webp',sheet:'baron',description:'An armored mechanical cobra with a turquoise reactor and an expensive attitude.'},
 coldbyte:{name:'Coldbyte',title:'Cold storage, colder heart',color:'#8dd7eb',accent:'#3d84ea',hue:145,portrait:'assets/illustrated/coldbyte-0.webp',sheet:'coldbyte',description:'A glacial serpent with crystalline fins and a talent for recovering lost health.'},
 mamba:{name:'Madame Mamba',title:'Hostile takeover, darling',color:'#bf84d6',accent:'#d33387',hue:240,portrait:'assets/illustrated/mamba-0.webp',sheet:'mamba',description:'A jeweled violet viper who treats every siege like an invitation-only party.'},
 rattler:{name:'Rattlesatoshi',title:'The fastest rug in the west',color:'#e5a455',accent:'#e8502a',hue:-12,portrait:'assets/illustrated/rattler-0.webp',sheet:'rattler',description:'A copper-scaled outlaw with a crooked hat and a dangerous turn of speed.'}
};
const CAST=['slippy','baron','coldbyte','rattler','mamba','slippy','baron','coldbyte','rattler','mamba','baron','slippy','rattler','mamba','baron'];
export const bossForChapter=chapter=>BOSSES[CAST[chapter]||'slippy'];
export function arenaForChapter(ch){return ch===12?'canyon':ch===13?'marina':ch===14?'citadel':['glasshouse','citadel','marina','canyon'][ch%4];}
export function encounterPhase(r){
 if(r.chapter===12){const t=r.time%14;return t>=12?{id:'rush',active:true,label:'STAMPEDE! · BREAK A SECTION',speed:1.6}:t>=10?{id:'warning',active:false,label:'RATTLER IS WINDING UP',speed:1}:{id:'calm',active:false,label:'',speed:1};}
 if(r.chapter===13&&r.time%16>=13)return {id:'mend',active:true,label:'PEARL CHANT · FOCUS ONE SECTION',speed:1};
 if(r.chapter===14&&r.time%12>=9)return {id:'shutters',active:true,label:'VAULT SHUTTERS · AIM FOR THE HEAD',speed:.8};
 return {id:'calm',active:false,label:'',speed:1};
}
