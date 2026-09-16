import {campaignSpacing,waveMovement,BASE_FEED_SECONDS} from '../../../games/slop-survivor/campaign-pacing.mjs';
// Derivation and verification for the Slop Survivor 100-level progression spec.
// Run: node docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs
//
// Every table in the spec is produced here. Change a constant and re-run to see
// what it does to the difficulty band and the economy ratio before touching game code.

// ---------- level curve (spec section 2) ----------
export const EHP = n => Math.exp(0.124 * (n - 1) - 0.000193 * (n - 1) ** 2);
export const speed = n => 1 + 0.5 * (1 - Math.exp(-(n - 1) / 28));
export const sections = n => Math.min(64, 32 + n);
export const waves = n => (n <= 10 ? 3 : n <= 40 ? 4 : n <= 70 ? 5 : 6);

// Battle chests arrive every chestStride kills, with the stride derived from the level's
// total pieces so card counts stay near 25 to 35 at every level. runBonus is the in-run
// card advantage relative to level 1, estimated from that card count.
export const wavePieces = (n, wave) => Math.min(64, sections(n) + (wave - 1) * 3);
export const totalPieces = n => Array.from({ length: waves(n) }, (_, i) => wavePieces(n, i + 1)).reduce((a, b) => a + b, 0);
export const chestStride = n => Math.max(4, Math.round(totalPieces(n) / 24));
export const cardsPerRun = n => totalPieces(n) / chestStride(n) + waves(n) + 4;
export const runBonus = n => Math.sqrt(cardsPerRun(n) / cardsPerRun(1));

// ---------- difficulties (spec section 3) ----------
export const DIFFICULTY = { easy: 1.0, hard: 1.9, impossible: 2.8 };

// ---------- permanent power axes (spec section 5) ----------
const targetWeaponLevel = n => Math.min(50, Math.max(1, Math.round(n / 2)));
const rankOf = L => (L <= 10 ? 1 : L <= 20 ? 2 : L <= 30 ? 3 : L <= 40 ? 4 : 5);
const foundryFraction = n => Math.min(1, n / 95);
const slotMultiplier = n => (n >= 65 ? 1.12 * 1.09 : n >= 30 ? 1.12 : 1);

export function accountPower(n) {
  const L = targetWeaponLevel(n);
  const f = foundryFraction(n);
  const weaponLevels = Math.pow(1.135, L - 1);
  const ranks = Math.pow(1.12, rankOf(L) - 1);
  const foundry = Math.pow(1.08, 25 * f) * (1 + 0.4 * f) * (1 + 0.11 * f);
  const arsenal = (1 + 2.6 * (1 - Math.exp(-(n - 1) / 24))) * slotMultiplier(n);
  return weaponLevels * ranks * foundry * arsenal;
}

// In-run card multiplier a player on the intended curve needs to clear the encounter.
export const cardsNeeded = (n, difficulty) =>
  (EHP(n) * DIFFICULTY[difficulty] * speed(n)) / runBonus(n) / accountPower(n);

// ---------- economy (spec sections 6 and 8) ----------
export const GRADE = { S: 1.3, A: 1.1, B: 0.92, C: 0.78 };
export const partsCost = (L, grade = 'A') => Math.ceil(6 * Math.pow(1.115, L - 1) * GRADE[grade]);
export const coinCost = (L, grade = 'A') => Math.round(90 * Math.pow(1.115, L - 1) * GRADE[grade]);
export const firstClearParts = (n, difficulty) =>
  Math.round(2 * Math.pow(1.056, n - 1)) * { easy: 1, hard: 2.2, impossible: 4.5 }[difficulty];

const cumulativePartsToLevel = (L, grade = 'A') =>
  (6 * GRADE[grade] * (Math.pow(1.115, L - 1) - 1)) / 0.115;

// ---------- report ----------
function main() {
  const marks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  console.log(`Campaign entrance: portal; baseline feed target ${BASE_FEED_SECONDS}s, minimum 32px piece spacing.`);
  console.table(marks.map(n=>{const level={number:n,segments:sections(n),waves:waves(n),speed:speed(n)},spacing=campaignSpacing(level);return {level:n,pieceSpacing:+spacing.toFixed(2),travelSeconds:+Array.from({length:level.waves},(_,i)=>Math.min(64,level.segments+3*i)*spacing/(waveMovement(i+1)*level.speed)).reduce((a,b)=>a+b,0).toFixed(1),chestStride:chestStride(n),cardsPerRun:+cardsPerRun(n).toFixed(1),runBonus:+runBonus(n).toFixed(3)};}));
  console.log('=== Level curve and difficulty band (spec section 8) ===');
  console.table(
    marks.map(n => ({
      level: n,
      healthVsL1: +EHP(n).toFixed(n < 20 ? 2 : 0),
      growth: +(EHP(n) / EHP(Math.max(1, n - 1))).toFixed(3),
      sections: sections(n),
      waves: waves(n),
      speed: +speed(n).toFixed(2),
      weaponLevel: targetWeaponLevel(n),
      rank: rankOf(targetWeaponLevel(n)),
      easy: +cardsNeeded(n, 'easy').toFixed(2),
      hard: +cardsNeeded(n, 'hard').toFixed(2),
      impossible: +cardsNeeded(n, 'impossible').toFixed(2),
    }))
  );

  const band = { easy: [9, 0], hard: [9, 0], impossible: [9, 0] };
  for (let n = 1; n <= 100; n++)
    for (const d of Object.keys(band)) {
      const v = cardsNeeded(n, d);
      band[d] = [Math.min(band[d][0], v), Math.max(band[d][1], v)];
    }
  for (const [d, [lo, hi]] of Object.entries(band))
    console.log(`${d.padEnd(11)} card multiplier band ${lo.toFixed(2)} to ${hi.toFixed(2)}`);

  console.log('\n=== One grade-A weapon, level 1 to 50 (spec section 8) ===');
  let parts = 0;
  let coins = 0;
  const rows = [];
  for (let L = 1; L < 50; L++) {
    parts += partsCost(L);
    coins += coinCost(L);
    if ([9, 19, 29, 39, 49].includes(L))
      rows.push({ reachLevel: L + 1, stepParts: partsCost(L), cumParts: parts, cumCoins: coins });
  }
  console.table(rows);

  console.log('\n=== Parts income against the six-weapon core build ===');
  let income = 0;
  const econ = [];
  for (let n = 1; n <= 100; n++) {
    income += ['easy', 'hard', 'impossible'].reduce((a, d) => a + firstClearParts(n, d), 0);
    if (n % 20 === 0 || n === 10) {
      const need = 6 * cumulativePartsToLevel(targetWeaponLevel(n));
      econ.push({
        level: n,
        easyClear: firstClearParts(n, 'easy'),
        allThree: Math.round(['easy', 'hard', 'impossible'].reduce((a, d) => a + firstClearParts(n, d), 0)),
        cumIncome: Math.round(income),
        sixWeaponCost: Math.round(need),
        ratio: +(income / need).toFixed(2),
      });
    }
  }
  console.table(econ);

  console.log('\n=== Cores (spec section 8) ===');
  const rankCosts = [8, 22, 55, 130];
  let coreIncome = 0;
  for (let n = 1; n <= 100; n++) coreIncome += Math.ceil(n / 12) + 1 + (Math.ceil(n / 6) + 2);
  const perWeapon = rankCosts.reduce((a, b) => a + b);
  console.log(`rank costs ${rankCosts.join(', ')} = ${perWeapon} per weapon, ${perWeapon * 6} for six`);
  console.log(`income from Hard and Impossible first clears = ${coreIncome}`);
  console.log(`headroom = ${((coreIncome / (perWeapon * 6) - 1) * 100).toFixed(0)}%`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.includes('curve-model'))
  main();
