# Codex build prompt: Slop Survivor 100-level progression

Historical brief. The build it describes shipped on 2026-09-15 as PR #1. Numbers that
changed afterwards live in the design spec, which is authoritative: the section base is
now `min(64, 32 + n)`, battle chests use a piece-derived stride, and the feed budget ramps
from 420 to 480 seconds.

Paste everything below this line into Codex as the task brief.

---

## 0. Repository and setup

The project is **GameSlop**, a public GitHub repository under the **Hyperkodi**
organisation: `https://github.com/Hyperkodi/GameSlop`.

The Slop Survivor game and this design work live on the branch
**`slop-survivor-progression`**, not on `main`. Check that branch out first or you will
not find the game.

```
git clone https://github.com/Hyperkodi/GameSlop.git
cd GameSlop
git checkout slop-survivor-progression
cd games/slop-survivor
npm start     # serves on http://localhost:8193
npm test      # node --test, engine and economy tests
node tests/balance.mjs   # deterministic campaign simulation, exits non-zero on failure
```

There is no build step and no npm dependencies. The game is plain ES modules served
statically. Do not introduce a bundler, a framework or a package dependency.

Work on a branch off `slop-survivor-progression`. Do not commit to `main` directly.

The authoritative design document is
`docs/superpowers/specs/2026-09-14-slop-survivor-100-level-progression-design.md` and
its numbers are reproduced by
`docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs`. Run that model
before and after any balance change. Every figure in this brief comes from it.

**This brief is self-contained.** If either file is missing from the clone, create the
curve model from Appendix A at that exact path and treat this brief as the spec.

## 1. What you are building

Slop Survivor is a mobile browser defence game. Wojak defends a vault, Slippy is a
segmented snake boss. It currently has 15 chapters, 14 weapons, and a single permanent
upgrade axis worth at most 2.08x.

You are replacing the campaign and the meta-game with:

- **100 levels**, each with Easy, Hard and Impossible.
- **24 weapons**, up from 14. Ten are new and need both code and art.
- **Weapon levels 1 to 50 and ranks 1 to 5**, bought from the home screen.
- **Four currencies**: coins, per-weapon parts, cores, blueprints.
- **Earned weapons**, so most of the roster is unlocked through play rather than given.

Two existing design decisions must be preserved. Every run still starts with only Mint
Condition and builds a fresh battle arsenal from battle chests. Every unlocked weapon
stays eligible for those chests: do not reintroduce a pre-equipped loadout, because it
hides new unlocks. Bias the unlock-card **weight** by account investment instead.

## 2. The numbers

### Level curve

```
EHP(n)      = exp(0.124 * (n - 1) - 0.000193 * (n - 1)^2)   // total encounter health vs level 1
growth(n)   = exp(0.124 - 0.000386 * (n - 1))               // 13.2% per level falling to 9.0%
speed(n)    = 1 + 0.5 * (1 - exp(-(n - 1) / 28))            // 1.00 to 1.49
sections(n) = min(64, 24 + n)                               // 64 cap is a mobile rendering bound, keep it
waves(n)    = 3 if n<=10, 4 if n<=40, 5 if n<=70, else 6
```

Level 100 holds 32,351 times the health of level 1. The curve is monotonic with no
step, so no single level is a wall. Target session length is **six to twelve minutes
per level**; the wave counts above are what set it, so do not change them casually.

### Difficulties

| Tier | Health | Speed | Shields | Boons | Rerolls | Rewards |
|---|---:|---:|---:|---:|---:|---:|
| Easy | 1.00x | 1.00x | 5 | 1 | 2 | 1.0x |
| Hard | 1.90x | 1.10x | 4 | 2 | 1 | 2.2x |
| Impossible | 2.80x | 1.22x | 3 | 3 | 0 | 4.5x |

Impossible also forces all three section traits on. Clearing **Easy** on level `n`
unlocks level `n+1`; Hard and Impossible are optional but are the only meaningful
source of cores and blueprints.

### Permanent power

| Axis | Range | Effect |
|---|---|---|
| Weapon level | 1 to 50 | x1.135 damage per level, compounding. Replaces the current additive `damage * (1 + 0.12 * (level-1))`. |
| Weapon rank | 1 to 5 | Caps weapon level at 10/20/30/40/50. Costs cores. Grants a further x1.12. |
| Foundry Ordnance | 25 | +8% damage compounding, account-wide |
| Foundry Precision | 20 | +1 point crit chance and +0.02x crit multiplier per level |
| Foundry Overclock | 20 | -0.55% cooldown per level |
| Foundry Vault | 24 | +1 shield every 8 levels, maximum +3 |
| Arsenal slots | 6 to 8 | 7th slot at campaign level 30, 8th at level 65 |

Foundry is paid for in coins alone, so coins never become dead currency.

### Economy

```
partsCost(L, grade) = ceil(6  * 1.115^(L-1) * gradeFactor)
coinCost(L, grade)  = round(90 * 1.115^(L-1) * gradeFactor)
gradeFactor         = S 1.30, A 1.10, B 0.92, C 0.78
firstClearParts(n)  = round(2 * 1.056^(n-1))  * (Easy 1, Hard 2.2, Impossible 4.5)
repeatClear         = 25% of first clear
rankCost (cores)    = 8, 22, 55, 130   per weapon
coreIncome          = Hard first clear ceil(n/12)+1, Impossible first clear ceil(n/6)+2
```

The 1.056 growth on income is not arbitrary. Cost grows at 1.115 per weapon level and
the intended weapon level is `n/2`, so `1.115^0.5 = 1.056` locks income to cost for
the whole campaign. **Do not change one without the other.**

Parts are per weapon. The **Refinery** converts **3 parts of one weapon into 1 part of
another**. The 3 to 1 rate is deliberate and confirmed: it keeps chest rolls
meaningful while never hard-blocking a player from funding the build they want.

### Chests

| Tier | Coins | Parts | Cores | Blueprints |
|---|---|---|---:|---|
| Rusty | 40 to 70 | 3 to 5, one weapon | 0 | 4% for 1 |
| Reinforced | 140 to 220 | 10 to 16, two weapons | 0 to 1 | 12% for 1 to 2 |
| Armored | 420 to 650 | 30 to 45, three weapons | 2 to 3 | 30% for 2 to 3 |
| Vault | 1200 to 1800 | 90 to 130, four weapons | 6 to 9 | always 3 to 5 |

Idle chests keep the existing 10 minute interval and cap of 32. What changes is that
the tier they roll shifts with the highest level cleared, so idle income stays
relevant instead of decaying by level 30. Every tenth level awards a guaranteed Vault
chest on first Easy clear.

### The check that matters

At every level, a player on the intended curve should need roughly the same in-run
card multiplier. Verified across all 100 levels:

| Difficulty | Card multiplier band |
|---|---|
| Easy | 0.73 to 0.98 |
| Hard | 1.39 to 1.87 |
| Impossible | 2.04 to 2.76 |

Level 100 Impossible lands at 2.62x, which a maxed account reaches on a strong run.
**Level 100 must remain beatable.** Parts income tracks the six-weapon build cost at a
locked ratio of 0.90 from level 40 onward; idle chests and repeat farming cover the
rest.

## 3. The 24 weapons

Fourteen exist. Ten are new. Discovery level is where the weapon first becomes
obtainable.

| Weapon | id | Class | Dmg | CD | Grade | Discovery | Status |
|---|---|---|---:|---:|---|---:|---|
| Ledger Singularity | `vortex` | Zone control | 35 | 5.00 | S | 58 | exists |
| Whale Drop | `whale` | Burst nuke | 210 | 5.20 | S | 26 | exists |
| Nonce Nuke | `nuke` | Screen clear | 150 | 9.00 | S | 92 | **NEW** |
| Flash Loan | `flashloan` | Debt burst | 340 | 3.20 | S | 80 | **NEW** |
| Hash Satellite | `satellite` | Percent current health | 65 | 3.10 | S | 44 | exists |
| Oracle of Doom | `oracle` | Support amplifier | 70 | 2.80 | S | 68 | exists |
| Diamond Hands | `diamond` | Multi-pass | 27 | 1.15 | A | 21 | exists |
| Sniper Bot | `sniper` | Guaranteed crit | 120 | 2.40 | A | 38 | **NEW** |
| Liquidator | `laser` | Pierce line | 34 | 0.90 | A | 16 | exists |
| Halving Hammer | `halving` | Percent max health | 88 | 2.60 | A | 62 | **NEW** |
| Wen Lambo | `lambo` | Path sweep | 42 | 3.60 | A | 54 | **NEW** |
| Genesis Dragon | `dragon` | Head hunter | 100 | 4.50 | A | 46 | exists |
| Hard Fork | `fork` | Splitting | 48 | 1.30 | A | 31 | exists |
| Gas Fees | `gas` | Burst area | 80 | 2.40 | B | 9 | exists |
| Bear Trap | `trap` | Path trap and root | 130 | 4.00 | B | 34 | **NEW** |
| Burn Address | `burn` | Damage over time | 32 | 1.40 | B | 18 | exists |
| Block Lightning | `chain` | Chain | 29 | 1.80 | B | 14 | exists |
| Slippage | `slippage` | Stacking vulnerability | 26 | 1.50 | B | 40 | **NEW** |
| MEV Swarm | `swarm` | Homing multi | 24 | 1.40 | B | 23 | exists |
| Money Printer | `printer` | Ramping turret | 16 | 0.55 to 0.18 | B | 28 | **NEW** |
| Mint Condition | `coin` | Single target | 14 | 0.26 | C | free | exists |
| Paper Hands | `paper` | Comeback volley | 7 | 0.50 | C | 7 | **NEW** |
| Rug Pull | `rug` | Control | 21 | 3.20 | C | 4 | exists |
| Copium Tank | `copium` | Shield sustain | 9 | 1.60 | C | 11 | **NEW** |

Suggested remaining stats for the new weapons, tune against `tests/balance.mjs`:

| id | crit | mult | speed | radius | special | specialName |
|---|---:|---:|---:|---:|---|---|
| `paper` | .14 | 2.0 | 600 | 0 | count | Panic selling |
| `copium` | .06 | 1.6 | 0 | 70 | radius | Maximum dosage |
| `printer` | .10 | 2.0 | 520 | 0 | haste | Brrr |
| `trap` | .12 | 2.2 | 0 | 60 | radius | Wider jaws |
| `slippage` | .16 | 2.0 | 0 | 55 | chain | Cascading slip |
| `sniper` | 1.00 | 2.6 | 900 | 0 | pierce | Through and through |
| `lambo` | .13 | 2.1 | 420 | 0 | count | Second gear |
| `halving` | .11 | 2.3 | 0 | 50 | radius | Wider swing |
| `flashloan` | .20 | 3.0 | 0 | 0 | count | Leveraged |
| `nuke` | .08 | 2.4 | 0 | 999 | radius | Wider blast |

### New weapon mechanics

Each introduces a new `type` in the engine `fire` switch. None is a stat reskin.

1. **Paper Hands** (`paper`). Three-shot panic volley. Damage **doubles while the
   vault has lost at least one shield this run**. Weak when you are winning.
   Gold evolution *Diamond Conversion*: five shots instead of three.
2. **Copium Tank** (`copium`). Lingering cloud, light area damage. Accumulates shield
   charge while touching any section and grants a vault shield every 45 seconds of
   contact. The only defensive weapon. Gold *Maximum Cope*: charge accrues twice as
   fast.
3. **Money Printer** (`printer`). Cooldown ramps from 0.55s down to 0.18s the longer
   it fires at the same section, resetting on target change. Rewards manual focus
   fire, currently an underused control. Gold *Brrr Unlimited*: ramp never resets.
4. **Bear Trap** (`trap`). Places an armed trap on the snake's path ahead of the head.
   Detonates for heavy area damage plus a hard 2 second root when a section crosses
   it. Gold *Liquidation Cascade*: arms a second trap at the nearest section.
5. **Slippage** (`slippage`). Stacking vulnerability, up to 5 stacks at +8% damage
   taken each, decaying over time. Stacks with Oracle's flat mark. Gold *Maximum
   Extractable*: cap rises to 10 stacks.
6. **Sniper Bot** (`sniper`). Always targets the **lowest current health** visible
   section and always critically hits, ignoring armor. Gold *One Shot One Coin*:
   executes anything below 15% health.
7. **Wen Lambo** (`lambo`). Launches a vehicle that drives along the snake's own body
   path, damaging every section it passes. Distance scales with weapon level. Gold
   *Full Send*: makes a return pass.
8. **Halving Hammer** (`halving`). Every fourth cast adds damage equal to 2% of the
   target's **maximum** health, capped at 5x base damage. This is the intended counter
   to regenerating sections. Gold *The Halvening*: fires every second cast.
9. **Flash Loan** (`flashloan`). One massive hit, then a 2.5 second repayment window
   during which it cannot fire. If the target dies inside the window the debt is
   forgiven and the window is skipped. Gold *Infinite Leverage*: a forgiven debt
   refunds the cast so it fires again immediately.
10. **Nonce Nuke** (`nuke`). Very long cooldown, damages every visible section with
    falloff by distance from the head. Gold *Genesis Block*: no falloff.

### Weapon acquisition

| Grade | Count | How it is earned |
|---|---:|---|
| C and B | 10 | Clear the discovery level on Easy. Granted outright. |
| A | 7 | Clear the discovery level on **Hard**. |
| S | 6 | Collect **22 blueprints**. The Hard discovery clear grants 10; the rest come from chests and Impossible clears. |

Blueprint demand is 132. Guaranteed supply is 115: 60 from the six Hard discovery
clears, 30 from milestone levels at 3 each, 25 from Impossible clears at one per four
levels. The remaining 17 come from Armored and Vault chests, so the last two S weapons
genuinely require farming.

## 4. Art brief

**Use GPT Images 2.0 for all generated art.** Every new asset must match the existing
style, not invent a new one. Study these before generating anything:

- `games/slop-survivor/assets/illustrated/*.webp`, especially the 14 existing weapon
  sprites: `coin, laser, gas, diamond, chain, rug, burn, whale, satellite, swarm,
  vortex, fork, oracle, dragon`.
- `games/slop-survivor/ART-PROMPTS.md` and `CARTOON-ART.md` for the prompts that
  produced the current art and the house rules for them.

The established style is: **premium hand-painted 2D cel shading, thick dark outlines,
dimensional highlights, rich saturated colour, a crypto-meme object rendered as a
chunky readable game icon, real transparent alpha, no text, no background, no cast
shadow, square, centred and uncropped.** The palette runs jade, ink-teal, antique gold
and scarlet. Match the existing sprites' silhouette weight and level of detail so a new
weapon sitting next to Whale Drop in the Armory does not look out of place.

### Art pipeline, both paths are required

There are two rendering paths and each new weapon needs both.

**Path 1, procedural icon (mandatory).** `drawIcon` in `art.mjs` draws every weapon
from Canvas 2D primitives using the local helpers `ellipse`, `poly`, `round` and
`line`, on a 40x40 design grid centred at the origin. This is the fallback whenever the
WebP has not loaded and it is also used directly for HUD chips, hazard markers and
effect overlays. Add a branch for all ten new ids. Copy the structure of the existing
branches exactly; read the `dragon` and `satellite` branches as reference for the level
of detail expected.

**Path 2, illustrated sprite.** Generate `assets/illustrated/<id>.webp` for each of the
ten new ids and add the id to the `WEAPON_ART` array in `illustrated.mjs`. Produce PNG
first, then convert to WebP preserving real alpha, matching how the existing assets were
made. Keep file sizes in line with the current sprites.

**Also needed:**

- Effect rendering in `art.mjs` for the new types: the trap marker and its armed state,
  the Lambo body travelling the path, the Nonce Nuke shockwave, the Money Printer ramp
  indicator, Slippage stack pips on a section, and the Flash Loan debt timer.
- Record every generation prompt you use in `ART-PROMPTS.md`, following the existing
  entry format, including which source generation produced the shipped file.
- Baked player-pose sprites (`rear-<id>-0..3.webp`) are optional. Only `coin`, `gas`
  and `laser` have them today; new weapons fall back to the generic pose correctly.

All artwork must be original. No Cell Survivor assets, and nothing that implies
affiliation with Robinhood or Cell Survivor.

## 5. Implementation plan

Work in phases. **Each phase ends with `npm test` and `node tests/balance.mjs` both
passing before you start the next.** Commit at each phase boundary.

### Phase 1: data model and save migration

The riskiest phase, so it goes first and gets the most tests.

1. `data.mjs`: replace `CHAPTERS` with a generated `LEVELS` table built by a pure
   function from the section 2 formulas. Feed it the 15 existing chapter definitions
   as act anchors; do not hand-author 100 literal entries.
2. Add the new save fields: weapon `ranks`, `cores`, `blueprints`, Foundry track
   levels, `furthest` per difficulty.
3. Rewrite `upgradeCost` and add `rankCost` per the section 2 formulas.
4. Bump `VERSION` to 2 and give `normalizeSave` a version-1 migration branch. It
   currently discards any save whose version does not match, which would wipe every
   existing player.
5. **Widen `validRun`.** It hard-codes `r.chapter < CHAPTERS.length`,
   `r.weapons.length <= 6`, `finite(r.wave, 0, 4)` and `finite(r.health, 1, 7)`. All
   four must become save-driven or take the new maxima. This function is the save
   integrity boundary: write a test for every bound you touch.

Migration rules:

- **Campaign.** Map each old chapter to the new level whose health multiplier is
  closest. Old chapter 1 maps to new level 1, old chapter 15 maps to new level 21,
  because the old curve was far steeper. Grant clears on levels 1 to 21 at the matching
  difficulties.
- **Weapon levels.** Old level 10 was 2.08x base damage; the nearest new level at 1.135
  compounding is 7. Convert each weapon to the nearest-multiplier new level and refund
  the difference in parts at full value. **No weapon may lose damage.**
- **Difficulty ids.** `normal` becomes `easy`, `hard` stays, `hell` becomes
  `impossible`. Clear records and best scores carry across.
- **Currencies.** Shards become parts 1:1. Coins unchanged. Grant 8 cores per weapon
  already at old level 10, so an invested account starts at rank 2 rather than being
  knocked back.

### Phase 2: engine

1. `makeWeapon`: compounding damage, and read rank as well as level.
2. Apply Foundry bonuses when a run is created.
3. Arsenal slot count becomes save-driven, replacing the hard cap of 6.
4. `completeRun`: award parts, cores and blueprints on the new curves, record
   `furthest`, and handle the milestone Vault chest.
5. Weight unlock cards by account investment in each weapon, keeping every unlocked
   weapon eligible.

### Phase 3: the ten new weapons

Add each as a `type` in the `fire` switch with its own tests. Add `LEGENDARY` entries
for all ten gold evolutions. Extend the `validRun` weapon checks to cover any new
per-weapon run state (ramp timers, debt windows, stack counts, trap ids).

Take them in this order, easiest first: `paper`, `printer`, `sniper`, `halving`,
`slippage`, `copium`, `trap`, `nuke`, `lambo`, `flashloan`. The last two are the
hardest because they touch path-following and cooldown suppression.

### Phase 4: art

Everything in section 4. Do not start before phase 3, so you are drawing mechanics
that already work.

### Phase 5: home screen

1. Armory: grade badge, class, effective DPS rating, level and rank display, rank-up
   flow, blueprint progress on locked weapons.
2. New Foundry tab for the four account tracks.
3. New Refinery surface for 3 to 1 part conversion.
4. Vault: the four chest tiers and the new currencies.
5. Level picker for 100 levels. It must default to the highest unlocked level rather
   than the last manually selected one, while `selected` still records a manual
   override so a player farming level 30 is not bounced forward.
6. **Number formatting.** Section health reaches roughly 2.1 million and run scores
   reach the billions at level 100. HUD, floating damage numbers and card previews all
   need K/M/B formatting. Values stay far inside the existing `1e12` guard in
   `validRun`, so this is a readability problem, not an overflow one.

### Phase 6: verification

1. Extend `tests/balance.mjs` to sweep all 300 encounters at the account power the
   curve intends for that level, reporting the clear margin for each. Fail if any Easy
   encounter is unclearable on the curve, if any Hard encounter is clearable with no
   cards at all, or if any tier falls outside its section 2 band by more than 25%.
2. Add an economy harness that walks levels 1 to 100 awarding the specified income,
   spends it greedily on the cheapest useful upgrade, and asserts the account never
   drops below 85% of the intended power curve. This catches an income change that
   looks small and starves the player forty levels later.
3. 300 simulations will be much slower than the current 45. If it hurts, sweep every
   fifth level by default and put the full 300 behind a flag.
4. Update `PROGRESSION.md` and `README.md` to describe the shipped systems.

## 5b. Traps found on review

These came out of re-reading the engine against the plan. Each one would have cost a
debugging session. Treat them as requirements.

### The `hp` field is not EHP(n). Solve it.

`spawnWave` already multiplies health by section index, by section count, and by
`1 + (wave - 1) * 1.6` per wave. Those factors alone grow the raw pool **11.3x**
between level 1 (25 sections, 3 waves) and level 100 (64 sections, 6 waves). If you
set the level's `hp` multiplier to `EHP(n)` directly, level 100 is 11.3 times harder
than designed and nothing will clear it.

Compute the raw pool for a level with `hp = 1` using the existing formula, then solve:

```
hp(n) = EHP(n) * rawPool(1) / rawPool(n)
```

At level 100 that gives an `hp` field of roughly **2,853**, not 32,351. Write a test
that asserts the simulated total pool of every level is within 1% of `EHP(n)` times
the level 1 pool.

### Section cap semantics

`spawnWave` adds 3 sections per wave on top of the level's base count. A base of 64
with 6 waves puts 79 sections on screen in the last wave, above the mobile bound the
64 cap exists to protect. Cap the **per-wave total** at 64, not the base. Health that
would have gone into the missing sections goes into the `hp` solve above
automatically, because the solve uses the actual simulated pool.

### Difficulty id rename breaks the tournament

`createTournamentRun` calls `createRun(save, 0, 'normal', seed)` with a literal id, and
`app.mjs` compares against `'normal'` in three places (lines 44, 85 to 86, 109) and
`unlockedDifficulty` hard-codes the `normal` to `hard` to `hell` chain. Grep for every
literal difficulty id before renaming, and make the tournament read the first
difficulty from `DIFFICULTIES` rather than a string.

### Sniper Bot cannot use a crit chance of 1.0

Crit is capped at 0.85 in three places: `makeWeapon`, `applyCard` and `validRun`.
Setting Sniper Bot's `crit` to 1.0 is rejected by save validation. Implement the
guaranteed crit as a **weapon flag** checked inside `hit`, and leave its `crit` stat
at a normal value. The same applies to Sniper's armor bypass: do it through the crit
path that already ignores armor, not a separate branch.

### Coin income and Foundry costs were never specified

Coins pay for weapon levels and for all four Foundry tracks, so they need a curve.

```
firstClearCoins(n) = round(60 * 1.056^(n-1)) * (Easy 1, Hard 2.2, Impossible 4.5)
foundryCost(k)     = round(400 * 1.18^(k-1))      // per track level k
```

Demand: six weapons to level 50 cost 1,065,000 coins and all four Foundry tracks cost
370,000, total 1,435,000. First-clear supply over the campaign at those rates is
1,910,000, a ratio of 1.33 before chest coins. Foundry per track: Ordnance 137,000,
Precision 58,700, Overclock 58,700, Vault 115,800.

### Chapter-index hard-codes that must move into the level table

- `spawnWave`: armor `r.chapter === 1 || r.chapter >= 4`, regeneration
  `[2,5,7,9,10,11].includes(r.chapter)`, volatile `[3,5,8,10,11].includes(r.chapter)`,
  each written **twice** (once before and once after `groupSections`).
- `world.mjs`: `encounterPhase` keys boss behaviour on `r.chapter === 12/13/14`, the
  `CAST` array has exactly 15 entries, `arenaForChapter` special-cases indices 12 to
  14.
- `completeRun`: coin reward `150 + r.chapter * 55`.
- `tests/balance.mjs`: `save.levels[w.id] = Math.min(10, 1 + ch)`.

All of these become fields on the generated level entry: `traits`, `boss`, `arena`,
`phase`.

### Save rollout can destroy progress through Telegram sync

`telegram.mjs` line 22 throws on `save.version !== 1`, so an old cached client cannot
read a version 2 cloud snapshot. That part is safe. The danger is the reverse: an old
client that keeps playing writes a version 1 snapshot with a **newer** `updatedAt`,
and `autosync.mjs` line 19 restores whichever snapshot is newer. The upgraded device
would then restore and migrate the stale version 1 save, losing everything done on
version 2.

Two guards, both required:

1. A version 2 client never restores a cloud snapshot whose `save.version` is lower
   than its local save's version, regardless of timestamp.
2. Bump `CACHE` in `sw.js` (currently `slop-survivor-v1.6.0`) so every installed
   client picks up the new build on next load.

### Smaller ones

- `save.chests` is a single integer. Tiered chests need a structure, for example
  `{rusty, reinforced, armored, vault}`, with the cap of 32 applied to the total.
  `syncChests`, `openChests`, the Vault tab and the home strip all read the integer.
- Shields compose from three sources now: difficulty base (5/4/3), the Cold Storage
  boon (+2), Foundry Vault (up to +3). Maximum is 10. `validRun` caps `health` and
  `maxHealth` at 7 and `chooseBoon` hard-codes `r.health = r.maxHealth = 7`.
- Market Crash (`ultimate`) and volatile-section explosions both deal damage from
  `r.weapons[0]`, which is always Mint Condition, a C-grade weapon. At level 100 that
  makes the special irrelevant. Scale both from the highest-damage weapon in the run.
- `createRun` hard-codes `rerolls: 2`. It becomes the difficulty's value (2/1/0).
- `sw.js` `ASSETS` lists every illustrated sprite by name. Add all ten new WebP files
  and any new effect sprites, or offline play loses the new art.
- The Guide tab and the post-run `finish` message in `app.mjs` describe "six
  specialized weapons unlock after Normal chapters 5 to 10" and name Hard and Hell.
  Rewrite that copy.
- Copium Tank's shield grant restores up to `maxHealth`, never above it. Paper Hands'
  "hurt" condition is `r.health < r.maxHealth`. Slippage's vulnerability multiplies
  with Oracle's mark; they do not add.
- When `tests/balance.mjs` fails after these changes, the correct fix is the `0.124`
  coefficient in the EHP formula or the constants in the curve model, re-derived and
  re-run. Never hand-edit individual levels.

## 6. Rules

- **No em dashes anywhere**, in code comments, UI copy, docs or commit messages. This
  is a standing project rule.
- UI copy must be actionable: say what the player should do, not just what happened.
- Do not claim work is complete without running `npm test` and `node tests/balance.mjs`
  and showing the output.
- Do not add dependencies, a bundler or a framework.
- Preserve the existing automatic-save behaviour, including Telegram CloudStorage sync,
  the separate campaign and tournament run slots, and the absence of manual save or
  load controls.
- The endless tournament stays as it is, beyond reading the new permanent power axes.
- Online leaderboards, server-authoritative scoring and monetisation remain out of
  scope and must not be claimed as working.

## 7. Definition of done

- 100 levels x 3 difficulties all reachable and all winnable on the intended curve,
  proven by the extended `tests/balance.mjs` output.
- 24 weapons implemented, each with a procedural icon, an illustrated sprite, a gold
  evolution and tests.
- A version-1 save migrates with no loss of progress, coins, shards or weapon damage.
- Level 100 Impossible is beatable by a maxed account.
- `npm test` and `node tests/balance.mjs` both green, with output shown.

## Appendix A: curve model

Save as `docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs` and run with
`node`. Every table in this brief comes from it.

```js
// Derivation and verification for the Slop Survivor 100-level progression spec.
// Run: node docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs
//
// Every table in the spec is produced here. Change a constant and re-run to see
// what it does to the difficulty band and the economy ratio before touching game code.

// ---------- level curve (spec section 2) ----------
export const EHP = n => Math.exp(0.124 * (n - 1) - 0.000193 * (n - 1) ** 2);
export const speed = n => 1 + 0.5 * (1 - Math.exp(-(n - 1) / 28));
export const sections = n => Math.min(64, 24 + n);
export const waves = n => (n <= 10 ? 3 : n <= 40 ? 4 : n <= 70 ? 5 : 6);

// More waves means more battle chests, so more cards per run.
const runBonus = n => (1 + 0.08 * (waves(n) - 3)) * (1 + 0.15 * Math.min(1, n / 60));

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
```
