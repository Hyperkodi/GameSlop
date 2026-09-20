// These suites pin v2 in-progress-save behavior. New runs are covered separately
// by action-combat.test.mjs; never use this adapter in the shipped game.
export * from '../engine.mjs';
import {createRun as currentRun,createTournamentRun as currentTournament} from '../engine.mjs';
function legacy(r){delete r.combatVersion;delete r.heat;delete r.overheated;delete r.ventUntil;return r;}
export const createRun=(...args)=>legacy(currentRun(...args));
export const createTournamentRun=(...args)=>legacy(currentTournament(...args));
