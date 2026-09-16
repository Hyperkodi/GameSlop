import {armoryView,foundryView,vaultView,refineryView} from './home-view.mjs';
import {compactNumber} from './presentation.mjs';
import {bossForChapter,arenaForChapter} from './world.mjs';
import {AutoSync} from './autosync.mjs';
import {connectTelegram} from './telegram.mjs';
import {WEAPONS,CHAPTERS,DIFFICULTIES,BOONS,UPGRADE_RARITIES,LEGENDARY,CHEST_CAP,CHEST_INTERVAL,defaultSave,normalizeSave,syncChests,openChests,upgradeCost,upgradeWeapon,weaponUnlocked,unlockedChapter,unlockedDifficulty,weapon,clamp,chestTotal,rankUp,upgradeFoundry,refine,unlockWeapon,highestUnlocked} from './data.mjs';
import {createRun,createTournamentRun,reviveTournament,endTournament,chooseBoon,chooseUpgrade,reroll,tick,ultimate,completeRun} from './engine.mjs';
import {Renderer,iconUrl} from './art.mjs';
import {Sound} from './audio.mjs';
const $=s=>document.querySelector(s),KEY='gameslop.slop-survivor.v1';let storageOK=true,save,hasLocalSave=false;
try{const raw=JSON.parse(localStorage.getItem(KEY));hasLocalSave=!!raw;save=normalizeSave(raw);}catch{save=defaultSave();}
let telegram=null,autoSync=null,cloudStatus='Progress saves automatically on this device.',savedBody=JSON.stringify(save);let run=null,tab='expedition',dialog='',lastFocus=null,uiTime=0,saveTime=0,last=performance.now(),toastTimer,calloutTimer;
const renderer=new Renderer($('#arena')),sound=new Sound(save.settings);
let frameRequest=0;
function requestFrame(){if(!frameRequest&&!document.hidden)frameRequest=requestAnimationFrame(frame);}
function stopFrames(){if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;}
for(const sprite of [renderer.headSprite,renderer.heroSprite])sprite.addEventListener('load',requestFrame);
window.addEventListener('resize',requestFrame);window.addEventListener('illustrated-art-ready',requestFrame);

const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=compactNumber,clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const icon=(id,cls='')=>`<img src="${iconUrl(id)}" alt="" class="${cls}">`;
const icoAll=()=>document.querySelectorAll('img[data-icon]').forEach(i=>i.src=iconUrl(i.dataset.icon));
function persist(){
 if(run&&['playing','paused','choice','boon','revive'].includes(run.state))save[run.mode==='tournament'?'tournamentRun':'run']=run;
 const body=JSON.stringify(save);if(body!==savedBody){save.updatedAt=Math.max(Date.now(),(save.updatedAt||0)+1);savedBody=JSON.stringify(save);autoSync?.changed();}
 try{localStorage.setItem(KEY,savedBody);storageOK=true;}catch{storageOK=false;}
 $('#coins').textContent=fmt(save.coins);$('#chest-badge').textContent=chestTotal(save);$('#cores').textContent=fmt(save.cores);$('#blueprints').textContent=fmt(save.blueprints);
}

function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
function modal(html,id){releaseInputs();sound.pause();if($('#modal').hidden)lastFocus=document.activeElement;dialog=id;$('#modal').dataset.kind=id;$('#modal-content').innerHTML=html;$('#modal').hidden=false;$('.modal').focus();requestFrame();}
function closeModal(){dialog='';delete $('#modal').dataset.kind;$('#modal').hidden=true;if(lastFocus?.isConnected)lastFocus.focus();requestFrame();}
function stats(){const clears=Object.keys(save.clears).filter(k=>save.clears[k]).length;return {clears,total:CHAPTERS.length*DIFFICULTIES.length};}
function intro(k,title,desc){return `<div class="page-intro"><div><span class="eyebrow">${k}</span><h1>${title}</h1></div><p>${desc}</p></div>`;}
function renderHome(){
 stopFrames();
 $('#home').hidden=false;$('#battle').hidden=true;document.body.classList.remove('playing');$('#footer').hidden=false;
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));
 syncChests(save);persist();let html='';
 if(!storageOK)html+='<div class="save-warning">Browser storage is unavailable. Progress can only be kept for this session unless Telegram sync is available. Enable browser storage to keep playing offline.</div>';
 if(tab==='expedition'){
  if(save.run)html+='<div class="resume-banner"><span>Your siege is safely paused.</span><button class="primary" data-action="resume-run">Resume run →</button></div>';
  html+=`<section class="tournament-card"><div>${icon('chain')}<span class="eyebrow">ENDLESS TOURNAMENT</span><h2>How long can you hold?</h2><p>Slippy keeps coming. Stronger waves, one score, three revives per attempt.</p><small>PERSONAL BEST ${fmt(save.tournamentBest)} · ${save.tournamentRuns} COMPLETED</small></div><button class="primary" data-action="${save.tournamentRun?'resume-tournament':'start-tournament'}">${save.tournamentRun?'Continue tournament':'Play tournament'} →</button></section>`;
  if(!save.selectedManual)save.selected=highestUnlocked(save);const s=stats(),c=CHAPTERS[save.selected],d=DIFFICULTIES.find(x=>x.id===save.difficulty);
  if(!unlockedDifficulty(save,save.selected,save.difficulty)){save.difficulty='easy';}
  html+=`<div class="expedition-grid"><article class="hero-card"><img class="garden-plate" src="assets/illustrated/arena-${arenaForChapter(save.selected)}.webp" alt="Illustrated ${c.name} arena"><div class="boss-plaque"><span>LEVEL ${String(save.selected+1).padStart(2,'0')}</span><h1>${c.name}</h1><b>${save.difficulty.toUpperCase()}</b></div><div class="boss-preview" aria-label="${bossForChapter(save.selected).name}"><img src="${bossForChapter(save.selected).portrait}" alt="${bossForChapter(save.selected).name}"></div><img class="home-sloppy" src="assets/illustrated/wojak-0.webp" alt="Wojak, the starting defender"><div class="hero-caption">${bossForChapter(save.selected).name.toUpperCase()} · ${bossForChapter(save.selected).title}</div></article><section class="chapter-panel"><div class="section-heading"><h2>Ready, Wojak?</h2><small>${s.clears} / ${s.total} cleared</small></div><button class="subtle" data-action="latest-level">Follow highest unlocked level</button><details class="chapter-picker"><summary>Choose level <span>${save.selected+1} / ${CHAPTERS.length} ▾</span></summary><div class="chapter-list">${CHAPTERS.map((c,i)=>`<button class="chapter ${i===save.selected?'active':''}" data-chapter="${i}" ${unlockedChapter(save,i)?'':'disabled'} aria-label="Level ${i+1}: ${c.name}${unlockedChapter(save,i)?'':', locked'}"><span class="chapter-num">${String(i+1).padStart(2,'0')}</span><span><b>${c.name}</b><small>${unlockedChapter(save,i)?c.modifier:'Clear level '+i}</small><span class="stars">${DIFFICULTIES.map(d=>save.clears[`${i}:${d.id}`]?'★':'·').join('')}</span></span></button>`).join('')}</div></details><div class="chapter-info"><span class="eyebrow">LEVEL ${String(save.selected+1).padStart(2,'0')} · ${c.waves} WAVES</span><h3>${bossForChapter(save.selected).name}</h3><p class="boss-description">${bossForChapter(save.selected).description}</p><p>${c.detail}</p><div class="difficulties">${DIFFICULTIES.map(d=>`<button class="difficulty ${save.difficulty===d.id?'active':''}" data-difficulty="${d.id}" ${unlockedDifficulty(save,save.selected,d.id)?'':'disabled'}>${d.name}<small>${unlockedDifficulty(save,save.selected,d.id)?d.boons+' starting '+(d.boons===1?'bonus':'bonuses'):'Clear '+(d.id==='hard'?'Easy':'Hard')}</small></button>`).join('')}</div></div><div class="launch-row"><button class="primary" data-action="start"><span>Enter the siege <small> · ${save.difficulty.toUpperCase()}</small></span><span>↗</span></button></div><p style="font-size:10px;text-align:center">New level = fresh arsenal · Unlocks & workshop levels stay saved</p></section></div><div class="bottom-strip">${icon('chest','strip-icon')}<div class="strip-copy"><b>Your vault is working overtime.</b><p>${chestTotal(save)} / 32 idle chests · One arrives every 10 minutes.</p></div><button class="secondary" data-tab="vault">Open vault →</button><div class="mini-deck" title="Unlocked weapons">${WEAPONS.filter(w=>weaponUnlocked(save,w)).slice(0,6).map(w=>icon(w.id)).join('')}</div></div>`;
 }
 if(tab==='armory')html+=intro('THE WORKSHOP','Build your permanent arsenal.','24 weapons, 50 levels and 5 ranks. Levels use coins and parts; ranks use cores.')+armoryView(save,icon);
 if(tab==='foundry')html+=intro('THE FOUNDRY','A stronger foundation.','Four permanent tracks improve every future run.')+foundryView(save);
 if(tab==='vault')html+=intro('PASSIVE LOOT','The idle vault.','Open a tier or the whole batch. Your rewards stay with you.')+vaultView(save,icon);
 if(tab==='guide')html+=intro('KNOW YOUR ENEMY', 'A short field guide.', 'Wojak has a vault to protect. Slippy has absolutely no respect for personal property.')+`<div class="guide-grid">${[
 ['coin','Fire automatically','Weapons fire on their own. Use the <strong>thumb joystick</strong> to focus a section of the snake, or let go for automatic targeting. On desktop, point inside the arena or use arrow keys / WASD to aim.'],
 ['chest','Build as you break','Break a large section by hitting any of its four body pieces. Each break pulls the snake ahead backward and earns progress toward battle chests. Time pauses while you choose one of three cards. All account-unlocked weapons can appear. Every new level resets collected weapons and battle upgrades. Easy gives 2 rerolls, Hard 1 and Impossible 0.'],
 ['diamond','Make every crit count','Every weapon starts with its own critical chance and multiplier. Green / Blue / Red / Gold crit cards add <strong>5 / 10 / 15 / 25 percentage points</strong>. Chance is capped at 85%. Critical hits ignore armor.'],
 ['shield','Keep the vault intact','Slippy follows a winding route toward the vault. Each breach removes a shield and pushes him back. Destroy every segment and the head in every wave to clear the level.'],
 ['chain','Market Crash','Dealing damage charges your special. When it reaches 100%, tap the star button or press <strong>Space</strong> for a screen-wide coin shockwave and a powerful slow.'],
 ['burn','Easy. Hard. Impossible.','Clear Easy to unlock the next level and Hard on that level. Clear Hard to unlock Impossible. Higher difficulties give more starting bonuses, tougher snakes and larger victory rewards.'],
 ['laser','A weapon for every job','Beams pierce lines; bombs hit clusters; diamonds return; lightning chains; rugs slow; fire burns over time; whales hit hard. C and B weapons unlock from Easy clears, A weapons from Hard clears. Discover S weapons and spend 22 shared blueprints to unlock each one. Expand to seven and eight battle slots after Easy levels 30 and 65.'],
 ['rug','Take a break','Pause with the corner button or Esc. Switching apps automatically pauses. Progress saves automatically, including your current run. Telegram sync is automatic inside the Mini App. Return to the menu at any time; your campaign and tournament attempts are kept separately.'],
 ['chain','Endless tournament','Slippy keeps coming in stronger waves until you lose. You have three full-health revives per attempt. Your score and arsenal survive revives. Returning to the menu or reloading never refills them. Personal bests are saved; online leaderboard submission is not connected yet.'],
 ['whale','A home-screen game','On Android, use your browser’s install option. On iPhone, use Safari → Share → Add to Home Screen. Offline play is available after the game finishes caching on a supported HTTPS host.']
 ].map(([i,t,p])=>`<div class="info-card">${icon(i)}<h3>${t}</h3><p>${p}</p></div>`).join('')}</div>`;
 $('#page').innerHTML=html;updateVault();
}
function updateVault(){if(!$('#vault-timer'))return;$('#vault-timer').textContent=chestTotal(save)===32?'Vault full · open chests to make room':`Next chest in ${clock(Math.max(0,(CHEST_INTERVAL-(Date.now()-save.chestAt))/1000))}`;}
function start(){if(save.run){modal('<span class="eyebrow">A SIEGE IS ALREADY UNDERWAY</span><h2 id="modal-title">Continue the defense?</h2><p>Resume your saved run, or abandon it and begin a fresh siege. Permanent upgrades and vault loot are kept.</p><div class="modal-actions"><button class="secondary" data-action="new-run">Abandon saved run</button><button class="primary" data-action="resume-run">Resume siege</button></div>','existing');return;}newRun();}
function newRun(){save.run=null;run=createRun(save,save.selected,save.difficulty);enterBattle();showBoon();persist();}
function startTournament(){run=createTournamentRun(save);enterBattle();showBoon();persist();}
function enterBattle(){last=performance.now();closeModal();$('#home').hidden=true;$('#battle').hidden=false;document.body.classList.add('playing');$('#footer').hidden=true;$('#battle-name').textContent=run.mode==='tournament'?'Endless tournament':CHAPTERS[run.chapter].name;$('#battle-mode').textContent=run.mode==='tournament'?`ENDLESS · ${3-run.revivesUsed} REVIVES LEFT`:`${run.difficulty.toUpperCase()} · LEVEL ${String(run.chapter+1).padStart(2,'0')}`;updateHUD(true);sound.unlock().catch(()=>{});}
function resumeRun(tournament=false){const saved=save[tournament?'tournamentRun':'run'];if(!saved)return;run=saved;run.events=[];enterBattle();if(run.state==='paused')run.state='playing';if(run.state==='boon')showBoon();if(run.state==='choice')showChoices();if(run.state==='revive')showRevive();persist();}
function showBoon(){modal(`<span class="eyebrow">${run.difficulty.toUpperCase()} · STARTING ADVANTAGE</span><h2 id="modal-title">Stack the odds.</h2><p class="modal-intro">Choose ${run.boonsLeft===1?'your final bonus':run.boonsLeft+' bonuses, one at a time'}. These last for the entire siege.</p><div class="choice-grid">${run.boonOptions.slice(0,3).map(id=>{const b=BOONS.find(x=>x.id===id);return `<button class="choice new" data-boon="${id}">${icon(b.icon)}<span class="eyebrow">STARTING BONUS</span><b>${b.name}</b><p>${b.description}</p><small>SELECT BONUS →</small></button>`;}).join('')}</div><div class="modal-actions"><button class="subtle" data-action="rotate-boons">See other bonuses</button><button class="subtle" data-action="save-exit">Return to menu</button></div>`,'boon');}
function showChoices(){modal(`<div class="upgrade-heading"><span class="eyebrow">BATTLE FROZEN · ${run.weapons.length} / ${run.slots||6} WEAPONS</span><h2 id="modal-title">${run.openingChoice?'Choose your first weapon':'Choose an upgrade'}</h2><p>${run.openingChoice?'Opening chest: three unlocked weapons.':`Green 60% · Blue 28% · Red 10% · Gold 2% per option`}</p></div><div class="choice-grid">${run.choices.map(c=>`<button class="choice ${c.rarity}" data-choice="${c.id}">${icon(c.weapon)}<span class="eyebrow">${UPGRADE_RARITIES.find(t=>t.id===c.rarity)?.name||'UPGRADE'}</span><b>${escapeText(c.title)}</b><p>${escapeText(c.description)}</p><small>${c.kind==='unlock'?'COLLECT WEAPON':weapon(c.weapon).name.toUpperCase()} →</small></button>`).join('')}</div><div class="modal-actions"><button class="secondary" data-action="reroll" ${run.rerolls?'':'disabled'}>↻ Reroll · ${run.rerolls} left</button><button class="secondary" data-action="save-exit">Return to menu</button></div>`,'choice');}

function pause(){releaseInputs();if(!run||run.state!=='playing')return;run.state='paused';sound.pause();persist();modal('<span class="eyebrow">THE VAULT CAN WAIT</span><h2 id="modal-title">Take a breather.</h2><p>Your snake, projectiles and cooldowns are paused. Your run is saved.</p><div class="modal-actions"><button class="secondary" data-action="save-exit">Return to menu</button><button class="secondary" data-action="audio-settings">Audio & settings</button><button class="primary" data-action="continue">Continue siege →</button></div>','pause');}
function showRevive(){
 persist();modal(`<span class="eyebrow">ENDLESS TOURNAMENT · WAVE ${run.wave}</span><h2 id="modal-title">Back for more?</h2><p>Your score is ${fmt(run.score)}. Restore all shields and push Slippy back. Your weapons and score stay with you.</p><div class="revive-count">${3-run.revivesUsed} / 3 revives remaining</div><div class="modal-actions"><button class="secondary" data-action="end-tournament">End attempt</button><button class="secondary" data-action="save-exit">Return to menu</button><button class="primary" data-action="revive-tournament">Revive · ${3-run.revivesUsed} left</button></div>`,'revive');
}
function finishTournament(reward){
 modal(`<div class="result-top">${icon('chain')}<span class="eyebrow">ENDLESS TOURNAMENT</span><h2 id="modal-title">A siege to remember.</h2><p>${run.revivesUsed===3?'All three revives used.':'Attempt ended.'} Your personal best is ${fmt(save.tournamentBest)}.</p></div><div class="result-grid"><div><b>${fmt(reward.score)}</b><small>FINAL SCORE</small></div><div><b>${run.wave}</b><small>WAVE REACHED</small></div><div><b>${clock(reward.time)}</b><small>SURVIVED</small></div><div><b>+${fmt(reward.coins)}</b><small>COINS</small></div></div><p>Saved automatically. Online leaderboard submission is not connected yet.</p><div class="modal-actions"><button class="secondary" data-action="finish-home">Return to menu</button><button class="primary" data-action="retry">New tournament attempt</button></div>`,'result');
}
function finish(){releaseInputs();const reward=completeRun(save,run);if(!reward)return;persist();sound.event(reward.win?'won':'lost');if(reward.tournament){finishTournament(reward);return;}const d=run.difficulty,c=run.chapter;let message=reward.win?(reward.first?d==='easy'?`Hard unlocked for this level.${c<CHAPTERS.length-1?' Level '+(c+2)+' is now open.':''}`:d==='hard'?'Impossible unlocked for this level.':'Impossible cleared. That vault is in good hands.':'Another clean defense. Your rewards are in the vault.'):'Your permanent upgrades are safe. Focus critical hits on armor, and try a different weapon mix.';
 if(reward.unlocked?.length)message+=' New weapons: '+reward.unlocked.map(id=>weapon(id).name).join(', ')+'. Find them in battle.';
 modal(`<div class="result-top">${icon(reward.win?'chest':'shield')}<span class="eyebrow">${CHAPTERS[c].name} · ${d.toUpperCase()}</span><h2 id="modal-title">${reward.win?'Vault secured.':'The vault was breached.'}</h2><p>${message}</p></div><div class="result-grid"><div><b>${fmt(reward.score)}</b><small>SCORE</small></div><div><b>+${fmt(reward.coins)}</b><small>COINS</small></div><div><b>+${fmt(Object.values(reward.parts||{}).reduce((a,b)=>a+b,0))}</b><small>PARTS</small></div><div><b>+${reward.cores||0}</b><small>CORES</small></div><div><b>+${reward.blueprints||0}</b><small>BLUEPRINTS</small></div><div><b>${clock(reward.time)}</b><small>SIEGE TIME</small></div></div><div class="result-weapons">${[...run.weapons].sort((a,b)=>b.totalDamage-a.totalDamage).map(w=>`<div class="result-weapon">${icon(w.id)}<span>${weapon(w.id).name}</span><b>${fmt(w.totalDamage)} damage</b></div>`).join('')}</div><div class="modal-actions"><button class="secondary" data-action="finish-home">Return to expedition</button>${reward.win&&c<CHAPTERS.length-1&&unlockedChapter(save,c+1)?'<button class="primary" data-action="next-chapter">Next level →</button>':''}<button class="primary" data-action="retry">${reward.win?'Play again':'Try again'} →</button></div>`,'result');
}
function updateHUD(full=false){if(!run)return;$('#wave').textContent=run.mode==='tournament'?`WAVE ${run.wave} · ENDLESS`:`WAVE ${run.wave} / ${CHAPTERS[run.chapter].waves}`;if(run.mode==='tournament')$('#battle-mode').textContent=`ENDLESS · ${3-run.revivesUsed} REVIVES LEFT`;$('#remaining').textContent=`${run.segments.length} SECTIONS`;const frenzy=run.frenzy>1.01;$('#frenzy-tag').hidden=!frenzy;if(frenzy)$('#frenzy-tag').textContent=`FRENZY ${run.frenzy.toFixed(run.frenzy%1?1:0)}x`;const total=run.waveMaxHp||run.segments.reduce((n,s)=>n+s.maxHp,0),hp=run.segments.reduce((n,s)=>n+Math.max(0,s.hp),0);$('#snake-health').style.width=`${total?hp/total*100:0}%`;$('#score').textContent=fmt(run.score);$('#clock').textContent=clock(run.time);$('#charge').textContent=run.charge>=100?'READY':Math.floor(run.charge)+'%';$('#ultimate').classList.toggle('ready',run.charge>=100);$('#ultimate').setAttribute('aria-label',run.charge>=100?'Market Crash ready':'Market Crash charging '+Math.floor(run.charge)+' percent');if(full)$('#run-weapons').innerHTML=run.weapons.map(w=>`<div class="run-item">${icon(w.id)}<div><b>${weapon(w.id).name}</b><small>${fmt(w.damage)} DMG · ${Math.round(w.crit*100)}% CRIT · ${w.mult.toFixed(1)}×</small></div></div>`).join('');}
function settings(){if(run?.state==='playing')pause();modal(`<button class="modal-close" data-action="close-settings" aria-label="Close settings">×</button><span class="eyebrow">MAKE YOURSELF COMFORTABLE</span><h2 id="modal-title">Settings.</h2><label class="setting">Sound effects<input type="range" min="0" max="1" step=".05" value="${save.settings.sfx}" data-setting="sfx" aria-label="Sound effects volume"></label><label class="setting">Music<input type="range" min="0" max="1" step=".05" value="${save.settings.music}" data-setting="music" aria-label="Music volume"></label><label class="setting"><span>Reduced effects<p>Less flashing, particles and background motion.</p></span><input type="checkbox" data-setting="reduced" ${save.settings.reduced?'checked':''}></label><div class="cloud-settings"><b>Automatic progress</b><p>${escapeText(cloudStatus)}</p><p>Campaign unlocks, upgrades, loot and both active runs are kept automatically. Inside Telegram, progress also syncs with your account.</p></div><div class="modal-actions"><button class="secondary" data-action="fullscreen">Fullscreen</button><button class="primary" data-action="close-settings">Done</button></div><p style="margin-top:15px;font-size:10px">An original fan-made GameSlop game. No wallet or purchases required. Artwork and sound made for this game.</p>`,'settings');}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;sound.unlock().catch(()=>{});
 if(b.dataset.tab){tab=b.dataset.tab;renderHome();return;}
 if(b.dataset.chapter!==undefined){save.selected=+b.dataset.chapter;save.selectedManual=true;renderHome();return;}
 if(b.dataset.difficulty){save.difficulty=b.dataset.difficulty;renderHome();return;}

 if(b.dataset.rank){if(rankUp(save,b.dataset.rank)){sound.event('upgrade');renderHome();}return;}
 if(b.dataset.foundry){if(upgradeFoundry(save,b.dataset.foundry)){sound.event('upgrade');renderHome();}return;}
 if(b.dataset.unlock){if(unlockWeapon(save,b.dataset.unlock)){sound.event('upgrade');renderHome();}return;}
 if(b.dataset.upgrade){if(upgradeWeapon(save,b.dataset.upgrade)){sound.event('upgrade');toast(weapon(b.dataset.upgrade).name+' permanently upgraded.');renderHome();}return;}
 if(b.dataset.open){const loot=openChests(save,+b.dataset.open,Date.now(),Math.random,b.dataset.tier||null);persist();renderHome();sound.event('chest');modal(`<span class="eyebrow">${loot.count} IDLE CHEST${loot.count===1?'':'S'} OPENED</span><h2 id="modal-title">A healthy return.</h2><p>These rewards are permanent. Put them to work in the Armory.</p><div class="loot"><div>${icon('coin')}<b>+${fmt(loot.coins)} coins</b></div><div><b>+${loot.cores} cores</b></div><div><b>+${loot.blueprints} blueprints</b></div>${Object.entries(loot.parts).map(([id,n])=>`<div>${icon(id)}<span>${weapon(id).name}<br><b>+${n} parts</b></span></div>`).join('')}</div><div class="modal-actions"><button class="secondary" data-action="close">Back to vault</button><button class="primary" data-action="loot-armory">Upgrade weapons →</button></div>`,'loot');return;}
 if(b.dataset.boon){if(chooseBoon(run,b.dataset.boon)){persist();if(run.state==='boon')showBoon();else if(run.state==='choice')showChoices();else closeModal();updateHUD(true);}return;}
 if(b.dataset.choice){if(chooseUpgrade(run,b.dataset.choice)){sound.event('upgrade');persist();updateHUD(true);if(run.state==='choice')showChoices();else closeModal();}return;}
 const action=b.dataset.action;
 if(action==='latest-level'){save.selectedManual=false;save.selected=highestUnlocked(save);renderHome();}
 if(action==='refinery'){modal(refineryView(save),'refinery');updateRefinery();}
 if(action==='refine'){if(refine(save,$('#refine-from').value,$('#refine-to').value,Number($('#refine-count').value))){persist();renderHome();modal(refineryView(save),'refinery');updateRefinery();toast('Parts exchanged.');}}

 if(action==='start')start();
 if(action==='start-tournament')startTournament();
 if(action==='resume-tournament')resumeRun(true);
 if(action==='revive-tournament'&&reviveTournament(run)){closeModal();updateHUD(true);persist();}
 if(action==='end-tournament'&&endTournament(run))finish();
 if(action==='audio-settings')settings();
 if(action==='new-run')newRun();
 if(action==='next-chapter'&&run&&unlockedChapter(save,run.chapter+1)){save.selected=run.chapter+1;save.difficulty='easy';run=null;closeModal();newRun();}
 if(action==='resume-run')resumeRun();
 if(action==='rotate-boons'){run.boonOptions.push(run.boonOptions.shift());showBoon();persist();}
 if(action==='reroll'&&reroll(run)){showChoices();persist();}
 if(action==='continue'){closeModal();run.state='playing';persist();}
 if(action==='save-exit'){if(run.state==='playing')run.state='paused';persist();run=null;closeModal();renderHome();void autoSync?.flush();}
 if(action==='finish-home'){run=null;closeModal();tab='expedition';renderHome();}
 if(action==='retry'){const c=run.chapter,d=run.difficulty;run=run.mode==='tournament'?createTournamentRun(save):createRun(save,c,d);enterBattle();showBoon();persist();}
 if(action==='close')closeModal();
 if(action==='loot-armory'){closeModal();tab='armory';renderHome();}
 if(action==='close-settings'){closeModal();if(run?.state==='paused'){run.state='playing';persist();}else if(run?.state==='revive')showRevive();else if(run?.state==='choice')showChoices();else if(run?.state==='boon')showBoon();else renderHome();}
 if(action==='fullscreen'){try{await document.documentElement.requestFullscreen();}catch{toast('Use Add to Home Screen for a fullscreen experience on this browser.');}}
});
function updateRefinery(){if(dialog!=='refinery')return;const from=$('#refine-from').value,to=$('#refine-to').value,n=Number($('#refine-count').value),valid=from&&from!==to&&Number.isSafeInteger(n)&&n>0&&save.parts[from]>=3*n;$('#refine-submit').disabled=!valid;$('#refine-preview').textContent=valid?'Spend '+fmt(n*3)+' '+weapon(from).name+' parts to receive '+fmt(n)+' '+weapon(to).name+' parts.':'Choose different weapons and an amount you can afford.';}
 document.addEventListener('input',e=>{if(e.target.id.startsWith('refine-'))updateRefinery();const key=e.target.dataset.setting;if(key){save.settings[key]=key==='reduced'?e.target.checked:+e.target.value;persist();if(key==='sfx')sound.event('upgrade');}});
$('#settings').onclick=settings;$('#pause').onclick=pause;
function updateSpeedButton(){const fast=save.settings.speed===2;$('#speed').textContent=fast?'2x':'1x';$('#speed').classList.toggle('fast',fast);$('#speed').setAttribute('aria-label',fast?'Game speed 2x. Press to return to normal speed':'Game speed 1x. Press to play at double speed');}
function toggleSpeed(){save.settings.speed=save.settings.speed===2?1:2;persist();updateSpeedButton();sound.event('upgrade');}
$('#speed').onclick=toggleSpeed;updateSpeedButton();
// One pointer owns the joystick. Action buttons retain independent pointer ownership.
let stickPointer=null,canvasPointer=null,keys=new Set(),stickX=0,stickY=0;
const stick=$('#joystick'),thumb=$('#stick-thumb');
function releaseInputs(){if(typeof keys!=='undefined')keys.clear();stickX=stickY=0;if(typeof thumb!=='undefined')thumb.style.transform='translate(0px,0px)';if(run)run.manual=false;if(typeof stick!=='undefined'&&stickPointer!==null){const id=stickPointer;stickPointer=null;try{stick.releasePointerCapture(id);}catch{}}if(canvasPointer!==null){const id=canvasPointer;canvasPointer=null;try{$('#arena').releasePointerCapture(id);}catch{}}$('#aim-mode').textContent='AUTO TARGETING';}
function moveStick(e){if(e.pointerId!==stickPointer||!run||run.state!=='playing')return;const b=stick.getBoundingClientRect(),dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,len=Math.hypot(dx,dy),max=b.width*.33,f=Math.min(1,len/max);stickX=len?dx/len*f:0;stickY=len?dy/len*f:0;thumb.style.transform=`translate(${stickX*max}px,${stickY*max}px)`;if(f<.16){run.manual=false;$('#aim-mode').textContent='AUTO TARGETING';}else{run.manual=true;run.aimX=clamp(240+stickX*205,45,435);run.aimY=clamp(330+stickY*235,90,550);$('#aim-mode').textContent='FOCUS FIRE';}}
stick.addEventListener('pointerdown',e=>{if(stickPointer!==null||run?.state!=='playing')return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});stick.addEventListener('pointermove',moveStick);for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(e.pointerId===stickPointer)releaseInputs();});
$('#ultimate').addEventListener('pointerdown',e=>{e.preventDefault();if(run&&ultimate(run)){sound.event('ultimate');updateHUD();}else if(run?.state==='playing')toast('Deal damage to charge Market Crash.');});
$('#ultimate').addEventListener('click',e=>{if(e.detail===0&&run&&ultimate(run)){sound.event('ultimate');updateHUD();}});
$('#battle').addEventListener('contextmenu',e=>e.preventDefault());
$('#arena').addEventListener('pointerdown',e=>{if(run?.state!=='playing'||canvasPointer!==null)return;e.preventDefault();canvasPointer=e.pointerId;$('#arena').setPointerCapture(e.pointerId);aimCanvas(e);});
function aimCanvas(e){if(run?.state!=='playing')return;if(e.pointerType!=='mouse'&&e.pointerId!==canvasPointer)return;const rect=$('#arena').getBoundingClientRect();run.aimX=clamp((e.clientX-rect.left)/rect.width*480,35,445);run.aimY=clamp((e.clientY-rect.top)/rect.height*760,80,550);run.manual=true;$('#aim-mode').textContent='FOCUS FIRE';}
$('#arena').addEventListener('pointermove',aimCanvas);// A mouse keeps focus fire while it stays over the arena; only leaving the arena releases it.
// Touch and pen still release on lift, because there is no hover to follow.
for(const type of ['pointerup','pointercancel','lostpointercapture','pointerleave'])$('#arena').addEventListener(type,e=>{if(e.pointerType==='mouse'&&type!=='pointerleave'&&type!=='pointercancel')return;if(canvasPointer===null||e.pointerId===canvasPointer)releaseInputs();});
document.addEventListener('keydown',e=>{
 if(e.key==='Tab'&&!$('#modal').hidden){const focusable=[...$('.modal').querySelectorAll('button:not(:disabled),a,input')].filter(x=>!x.hidden);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('.modal'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
 if(e.key==='Escape'){if(dialog==='pause'){closeModal();run.state='playing';}else if(run?.state==='playing')pause();else if(dialog==='settings'){closeModal();if(run?.state==='paused')run.state='playing';}return;}
 if(e.key==='f'||e.key==='F'){if(run&&!$('#battle').hidden){e.preventDefault();toggleSpeed();}return;}
 if(run?.state!=='playing')return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d',' '].includes(e.key)){e.preventDefault();keys.add(e.key);if(e.key===' '&&!e.repeat)ultimate(run);}
});document.addEventListener('keyup',e=>{keys.delete(e.key);if(!keys.size&&stickPointer===null)releaseInputs();});
window.addEventListener('blur',()=>{releaseInputs();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFrames();releaseInputs();pause();persist();void autoSync?.flush();sound.pause();}else{requestFrame();const n=syncChests(save);if(n&&$('#battle').hidden)renderHome();}});window.addEventListener('pagehide',()=>{stopFrames();releaseInputs();if(run?.state==='playing')run.state='paused';persist();void autoSync?.flush();});window.addEventListener('orientationchange',()=>{releaseInputs();pause();});window.addEventListener('resize',releaseInputs);
let deferredInstall;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#install').hidden=false;});$('#install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('#install').hidden=true;}};
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
function frame(now){
 frameRequest=0;if(document.hidden||!run||$('#battle').hidden)return;
 // Cap active rendering on high-refresh displays; frozen scenes need one draw only.
 if(run.state==='playing'&&now-last<1000/60-.5){requestFrame();return;}
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(run&&!$('#battle').hidden){
  if(run.state==='playing'){
   let kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),ky=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
   const gp=navigator.getGamepads?.()[0];if(gp){if(Math.hypot(gp.axes[0],gp.axes[1])>.18){kx=gp.axes[0];ky=gp.axes[1];}if(gp.buttons[0]?.pressed)ultimate(run);}
   if(kx||ky){run.manual=true;run.aimX=clamp(run.aimX+kx*dt*240,40,440);run.aimY=clamp(run.aimY+ky*dt*240,85,545);}
   // 2x speed steps the simulation twice per frame with the same dt, so the result is
   // identical to playing at 1x for twice as long. Events from both steps are kept.
   const events=[];for(let step=0;step<(save.settings.speed===2?2:1)&&run.state==='playing';step++){tick(run,dt);events.push(...run.events);}for(const e of events){sound.event(e.type,e.weapon);if(e.type==='wave'){clearTimeout(calloutTimer);$('#battle-callout').textContent=`WAVE ${e.wave} · ${bossForChapter(run.chapter).name}`;$('#battle-callout').style.opacity='1';calloutTimer=setTimeout(()=>$('#battle-callout').style.opacity='0',2000);}}
   if(run.state==='choice'){showChoices();persist();}else if(run.state==='revive'){showRevive();}else if(['won','lost'].includes(run.state))finish();
  }
  renderer.draw(run,run.time,save.settings.reduced);sound.update(run.state==='playing');uiTime+=dt;if(uiTime>.2){updateHUD();uiTime=0;}saveTime+=dt;if(saveTime>3){persist();saveTime=0;}
 }
 if(run?.state==='playing'&&!$('#battle').hidden)requestFrame();
}
icoAll();setInterval(()=>{const n=syncChests(save);if(n){persist();if($('#battle').hidden&&$('#modal').hidden)renderHome();}updateVault();},1000);
// Read-only diagnostics for local QA; no progression cheats in the player interface.
window.slopSurvivor={snapshot:()=>JSON.parse(JSON.stringify({run,save,storageOK,dialog})),version:'2.0.1'};

async function boot(){
 $('#app').inert=true;$('#page').innerHTML='<div class="info-card"><h2>Getting your progress ready…</h2><p>Your adventure will continue automatically.</p></div>';
 try{
  telegram=await connectTelegram();
  if(telegram){
   autoSync=new AutoSync({hasLocalSave,storage:telegram.saves,read:()=>save,restore:remote=>{
    // Keep a recovery snapshot privately; restoring never requires a player control.
    try{localStorage.setItem(KEY+'.before-auto-sync',JSON.stringify(save));}catch{}
    save=normalizeSave(remote);savedBody=JSON.stringify(save);sound.settings=save.settings;
    try{localStorage.setItem(KEY,savedBody);}catch{storageOK=false;}
    if(!run&&$('#modal').hidden)renderHome();
   },status:message=>{cloudStatus=message;if(dialog==='settings')settings();}});
   // Read cloud progress before showing playable controls on a fresh launch.
   await autoSync.start();
   telegram.app.onEvent?.('deactivated',()=>{releaseInputs();pause();persist();void autoSync.flush();});
  }
 }catch{cloudStatus='Saved on this device. Telegram is currently unavailable.';}
 finally{$('#app').inert=false;persist();renderHome();}
}
window.addEventListener('online',()=>{void autoSync?.flush();});
void boot();
