import test from 'node:test';import assert from 'node:assert/strict';
import {compactNumber,effectiveDps} from '../presentation.mjs';
import {defaultSave} from '../data.mjs';import {makeWeapon} from '../engine.mjs';
import {armoryView,foundryView,vaultView,refineryView} from '../home-view.mjs';
test('damage formatting covers K M B and nonfinite inputs',()=>{for(const [n,v] of [[999,'999'],[4080,'4.08K'],[2e6,'2M'],[4e9,'4B'],[NaN,'0']])assert.equal(compactNumber(n),v);});
test('nominal sniper DPS includes guaranteed critical without violating probability cap',()=>{const w=makeWeapon('sniper',50,[],5,{precision:20});assert.equal(effectiveDps(w),w.damage*w.mult/w.cooldown);});
test('home surfaces expose exact costs, all weapons, all tiers and all Foundry tracks',()=>{const s=defaultSave(),icon=()=>'';assert.equal((armoryView(s,icon).match(/data-weapon=/g)||[]).length,24);assert.equal((foundryView(s).match(/data-foundry=/g)||[]).length,4);for(const tier of ['rusty','reinforced','armored','vault'])assert.ok(vaultView(s,icon).includes('data-tier="'+tier+'"'));assert.ok(refineryView(s).includes('3 spare parts'));for(const html of [armoryView(s,icon),foundryView(s),vaultView(s,icon)])assert.ok(!/undefined|NaN|\[object Object\]/.test(html));});
