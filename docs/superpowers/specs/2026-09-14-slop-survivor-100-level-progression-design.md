# Slop Survivor: 100-level campaign and weapon progression

Design spec, 14 September 2026. Status: proposed, not implemented.

## 1. What changes and why

Today the player advances one way: clear a chapter, unlock the next chapter and the
next weapon. Permanent power is a single axis (weapon levels 1 to 10, +12% of base
damage each) worth at most 2.08x. That is enough for 15 chapters. It is nowhere near
enough for 100.

This spec replaces the campaign and the meta-game with four connected systems:

1. **100 levels**, each with three difficulties, on a single smooth health curve.
2. **Weapon grades**, so every weapon has a published rating for damage and role,
   and that rating sets its upgrade price.
3. **Weapon levels and ranks**, paid for with parts and cores that chests award, done
   from the home screen between runs.
4. **Weapon acquisition**, so most weapons are earned rather than handed over.

The design goal is stated as a number: at every one of the 100 levels, a player whose
account is on the intended upgrade curve should need roughly the same in-run luck to
clear it. Section 8 shows that this holds within a narrow band.

Two existing decisions are preserved deliberately. Every run still starts with Mint
Condition and a fresh battle arsenal, and every unlocked weapon stays eligible for
battle chests rather than being hidden behind a pre-equipped loadout.

## 2. The level curve

Total encounter health for level `n`, relative to level 1:

```
EHP(n) = exp(0.124 * (n - 1) - 0.000193 * (n - 1)^2)
```

Per-level growth is `exp(0.124 - 0.000386 * (n - 1))`, which falls smoothly from
13.2% at level 2 to 9.0% at level 100. Level 100 holds 32,351 times the health of
level 1. The curve is monotonic and has no step at any point, so no single level is
ever a wall.

Supporting curves:

| Quantity | Formula | Range |
|---|---|---|
| Snake speed | `1 + 0.5 * (1 - exp(-(n-1)/28))` | 1.00 to 1.49 |
| Sections | `min(64, 32 + n)` | 33 to 64, capped at level 32 |
| Waves | 3 below level 11, 4 to level 40, 5 to level 70, 6 above | 3 to 6 |

The section cap of 64 is the existing mobile rendering bound and is kept. Past level
40 all growth goes into per-section health and wave count, not section count.

Health is distributed as it is today: head sections carry a fixed premium, body
sections scale with index, and later waves within a level are heavier than earlier
ones. Those factors already grow the raw pool 11.3x between level 1 and level 100
before any multiplier is applied, so the level's `hp` field is **solved**, not set to
`EHP(n)`:

```
hp(n) = EHP(n) * rawPool(1) / rawPool(n)
```

where `rawPool` is the simulated total with `hp = 1`. At level 100 this gives an `hp`
field of roughly 2,853. Setting it to 32,351 would make the level 11.3 times harder
than designed.

The cap of 64 applies to the **per-wave total** including the three sections each
later wave adds, not to the level's base count.

The section base started at 25. It was raised to 33 after the first build, because
the eight-minute feed budget stretched a 25-piece level 1 to 80 px body spacing. More,
weaker pieces fill the same time with content instead of gaps. The absolute health
anchor stays the original 25-piece level 1, so raising the count changed how health is
divided, not how much there is.

### Battle chest cadence

Battle chests arrive every `chestStride` kills, where
`chestStride = max(4, round(totalPieces / 24))` and `totalPieces` is the level's piece
count summed across its waves. The original fixed stride of 4 kills scaled cards per
run from 28 at level 1 to 101 at level 80, which let an optimal player out-kill the
snake at every tier. Deriving the stride from piece count holds every level near 30
cards, so the difficulty multipliers show in the shield bar rather than being buried
under card volume. The endless tournament keeps the fixed stride of 4.

### Feed budget

Campaign body spacing is derived from a travel budget of `420 + 60 * min(1, (n-1)/30)`
seconds, so seven minutes at level 1 rising to eight by level 31, with 32 px as the
floor. Easy runs must land between 360 and 720 active seconds. Hard and Impossible
lose shields by design, and every breach pushes the snake back, so their ceilings are
840 and 960 seconds.

### Acts, arenas and bosses

Ten acts of ten levels. Levels ending in zero are boss encounters using the existing
`encounterPhase` system. The five bosses and four arenas already in `world.mjs` cover
the first five acts directly; acts six to ten reuse them as escalated variants with a
second phase behaviour enabled. New boss art is a content axis this spec does not
require.

Within an act, the nine non-boss levels draw their section traits (armored,
regenerating, volatile) from a fixed eight-entry rotation indexed by `n mod 8`, with
all-three combinations becoming the common case above level 40. This makes the level
table generated rather than hand-authored, which is the only way 100 levels stays
maintainable.

## 3. Difficulties

The three tiers replace Normal, Hard and Hell.

| Tier | Health | Speed | Shields | Boons | Rerolls | Rescue chest | Rewards |
|---|---:|---:|---:|---:|---:|---:|---:|
| Easy | 1.00x | 1.00x | 5 | 1 | 2 | 24 s | 1.0x |
| Hard | 1.90x | 1.10x | 4 | 2 | 1 | 28 s | 2.2x |
| Impossible | 2.80x | 1.22x | 3 | 3 | 0 | 28 s | 4.5x |

The rescue chest is the battle chest handed out when no chest has arrived for that many
seconds. It exists to prevent card droughts, but it also rescues a struggling run, and
it rescues it more the longer the fight drags on. A slightly longer timer on the harder
tiers is the lever that made them bite without making them unwinnable. Timers of 32
seconds or more tipped Impossible into losses at intended power.

Impossible is set at 2.80x rather than 3.60x because level 100 Impossible must be
beatable by a maxed account. At 2.80x it needs a 2.62x in-run card multiplier, which a
strong run reaches. At 3.60x it needed 3.37x, which was luck-dependent to the point of
being unreliable.

Impossible also forces all three section traits on regardless of the level's own
rotation.

Clearing **Easy** on level `n` unlocks level `n+1`. Hard and Impossible are optional
and exist to be farmed. They are not a detour: they are the only meaningful source of
cores and blueprints, so a player who ignores them will stall around level 45 when
rank 3 becomes necessary.

## 4. Weapon grades

Every weapon gets a published **Class** telling the player what it is for, and a
**Grade** setting its power budget. Grade multiplies upgrade cost, so a top-grade
weapon is stronger but slower to raise. This is what keeps low-grade weapons useful
early instead of being dead content.

Effective damage per second below is base hit damage times expected hits per cast
against a dense snake, divided by cooldown. It is the rating shown in the Armory.

The roster grows from 14 weapons to **24**. Ten new weapons are specified in section
4b. Fourteen weapons across 100 levels is a new unlock every seven levels with nothing
to chase in the last quarter; 24 is a new unlock roughly every four levels all the way
to level 92.

| Weapon | Class | Base dmg | Cooldown | Effective DPS | Grade | Cost | Discovery |
|---|---|---:|---:|---:|---|---:|---:|
| Ledger Singularity | Zone control | 35 | 5.00 | 245 | S | 1.30 | 58 |
| Whale Drop | Burst nuke | 210 | 5.20 | 202 | S | 1.30 | 26 |
| Nonce Nuke | Screen clear | 150 | 9.00 | 140 | S | 1.30 | 92 |
| Flash Loan | Debt burst | 340 | 3.20 | 106 | S | 1.30 | 80 |
| Hash Satellite | Percent current health | 65 | 3.10 | 84 rising to 419 | S | 1.30 | 44 |
| Oracle of Doom | Support amplifier | 70 | 2.80 | 75 plus 25% arsenal | S | 1.30 | 68 |
| Diamond Hands | Multi-pass | 27 | 1.15 | 141 | A | 1.10 | 21 |
| Sniper Bot | Guaranteed crit | 120 | 2.40 | 130 | A | 1.10 | 38 |
| Liquidator | Pierce line | 34 | 0.90 | 113 | A | 1.10 | 16 |
| Halving Hammer | Percent max health | 88 | 2.60 | 108 | A | 1.10 | 62 |
| Wen Lambo | Path sweep | 42 | 3.60 | 105 | A | 1.10 | 54 |
| Genesis Dragon | Head hunter | 100 | 4.50 | 89 plus trail | A | 1.10 | 46 |
| Hard Fork | Splitting | 48 | 1.30 | 85 | A | 1.10 | 31 |
| Gas Fees | Burst area | 80 | 2.40 | 100 | B | 0.92 | 9 |
| Bear Trap | Path trap and root | 130 | 4.00 | 98 | B | 0.92 | 34 |
| Burn Address | Damage over time | 32 | 1.40 | 69 | B | 0.92 | 18 |
| Block Lightning | Chain | 29 | 1.80 | 64 | B | 0.92 | 14 |
| Slippage | Stacking vulnerability | 26 | 1.50 | 52 | B | 0.92 | 40 |
| MEV Swarm | Homing multi | 24 | 1.40 | 51 | B | 0.92 | 23 |
| Money Printer | Ramping turret | 16 | 0.55 to 0.18 | 29 rising to 89 | B | 0.92 | 28 |
| Mint Condition | Single target | 14 | 0.26 | 54 | C | 0.78 | free |
| Paper Hands | Comeback volley | 7 | 0.50 | 42, doubled when hurt | C | 0.78 | 7 |
| Rug Pull | Control | 21 | 3.20 | 33 plus slow | C | 0.78 | 4 |
| Copium Tank | Shield sustain | 9 | 1.60 | 23 plus shield regen | C | 0.78 | 11 |

Grades are 6 S, 7 A, 7 B, 4 C. Effective DPS is base damage times expected hits per
cast against a dense snake, divided by cooldown.

Four weapons are graded on scaling rather than raw output. Hash Satellite's percent of
current health is worth almost nothing at level 1 and near its cap at level 100.
Halving Hammer uses percent of **maximum** health, so it is the answer to regenerating
sections that Satellite cannot solve. Oracle's mark applies to the whole arsenal, so it
grows with every other weapon levelled. Money Printer's listed DPS is its ramp range,
not a fixed figure.

## 4b. The ten new weapons

Every new weapon introduces a new `type` in the engine's `fire` switch. None is a stat
reskin of an existing weapon, because a reskin adds inventory without adding a reason
to build differently.

**Paper Hands** (`paper`, C, discovery 7). Fires a three-shot panic volley.
While the vault has lost at least one shield this run, its damage doubles. A comeback
weapon that is weak when you are winning. Gold evolution *Diamond Conversion*: five
shots instead of three.

**Copium Tank** (`copium`, C, discovery 11). Sprays a lingering cloud dealing light
area damage. Accumulates shield charge while the cloud is touching any section, and
grants a vault shield every 45 seconds of contact. The only defensive weapon in the
game. Gold evolution *Maximum Cope*: shield charge accrues twice as fast.

**Money Printer** (`printer`, B, discovery 28). A turret whose cooldown drops from
0.55s toward 0.18s the longer it keeps firing at the same section, resetting when the
target changes. Rewards manual focus fire, which is currently an underused control.
Gold evolution *Brrr Unlimited*: the ramp no longer resets on target change.

**Bear Trap** (`trap`, B, discovery 34). Places an armed trap on the snake's path
ahead of the head. Detonates for heavy area damage plus a hard two-second root when a
section crosses it. Placement rather than aim. Gold evolution *Liquidation Cascade*:
detonation arms a second trap at the nearest section.

**Slippage** (`slippage`, B, discovery 40). Applies a stacking vulnerability, up to
five stacks at +8% damage taken each, decaying over time. The gradual counterpart to
Oracle's flat timed mark, and the two stack with each other. Gold evolution *Maximum
Extractable*: cap rises to ten stacks.

**Sniper Bot** (`sniper`, A, discovery 38). Always targets the visible section with
the lowest current health and always critically hits it, ignoring armor. A guaranteed
finisher that turns chip damage into kills. Gold evolution *One Shot One Coin*:
outright executes any section below 15% health.

**Wen Lambo** (`lambo`, A, discovery 54). Launches a vehicle that drives along the
snake's own body path, damaging every section it passes over. Distance travelled scales
with weapon level. Gold evolution *Full Send*: makes a return pass.

**Halving Hammer** (`halving`, A, discovery 62). Every fourth cast deals bonus damage
equal to 2% of the target's **maximum** health, capped at five times base damage. This
is the intended counter to regenerating sections, which percent-of-current-health
weapons handle badly. Gold evolution *The Halvening*: fires every second cast.

**Flash Loan** (`flashloan`, S, discovery 80). Deals a single massive hit, then enters
a 2.5 second repayment window during which it cannot fire. If the target dies inside
that window the debt is forgiven and the window is skipped. The highest skill ceiling
in the roster. Gold evolution *Infinite Leverage*: a forgiven debt refunds the cast, so
it fires again immediately.

**Nonce Nuke** (`nuke`, S, discovery 92). Very long cooldown. Damages every visible
section, with damage falling off by distance from the head. The last weapon in the
game and the answer to level 90-plus section counts. Gold evolution *Genesis Block*: no
falloff, every section takes full damage.

## 5. Weapon levels, ranks and the Foundry

Three permanent power axes replace the current single one.

**Weapon level, 1 to 50.** Each level multiplies that weapon's damage by **1.135**.
This replaces the current additive `damage * (1 + 0.12 * (level - 1))`. At level 50 a
weapon deals 320 times its base damage.

**Weapon rank, 1 to 5.** Rank caps weapon level at 10, 20, 30, 40 and 50. Ranking up
costs cores and grants a further 1.12x damage. Ranks are a cost wall first and a power
bump second, which is what keeps the power curve smooth instead of sawtoothed.

**The Foundry, account-wide.** Paid for in coins alone, so coins never become a dead
currency.

| Track | Levels | Per level | At max |
|---|---:|---|---:|
| Ordnance | 25 | +8% damage, compounding | 6.85x |
| Precision | 20 | +1 point crit chance, +0.02x crit multiplier | +20 points, +0.4x |
| Overclock | 20 | -0.55% cooldown | -10.4% |
| Vault | 24 | +1 shield every 8 levels | +3 shields |

Foundry track level `k` costs `round(400 * 1.18^(k-1))` coins. Fully funding all four
tracks costs 370,000 coins: Ordnance 137,000, Precision 58,700, Overclock 58,700, Vault
115,800. Six weapons to level 50 cost a further 1,065,000, so total coin demand for a
maxed core account is 1,435,000.

Arsenal slots rise from six to seven at campaign level 30 and to eight at level 65.
This needs the engine's hard six-weapon cap and the matching `validRun` check to
become a save-driven value.

Together the axes are worth **36,000x** at full investment, against the 32,351x health
growth of the level curve. The remainder is covered by in-run cards.

## 6. Currencies and chests

| Currency | Scope | Spent on | Main source |
|---|---|---|---|
| Coins | Account | Foundry tracks, part of every weapon level | Everything |
| Parts | Per weapon | Weapon levels | Level clears, idle chests |
| Cores | Account | Weapon ranks | Hard and Impossible clears |
| Blueprints | Per weapon | Unlocking S-grade weapons | Impossible clears, milestones |

Parts are per weapon, which creates a distribution problem: the chest gives you parts
for a weapon you do not use. The **Refinery** solves it by converting three parts of
one weapon into one part of another. Lossy on purpose, so targeted income still
matters.

### Chest tiers

| Tier | Coins | Parts | Cores | Blueprint chance |
|---|---|---|---:|---|
| Rusty | 40 to 70 | 3 to 5, one weapon | 0 | 4% for 1 |
| Reinforced | 140 to 220 | 10 to 16, two weapons | 0 to 1 | 12% for 1 to 2 |
| Armored | 420 to 650 | 30 to 45, three weapons | 2 to 3 | 30% for 2 to 3 |
| Vault | 1200 to 1800 | 90 to 130, four weapons | 6 to 9 | always 3 to 5 |

The idle chest timer, the cap of 32 and the ten-minute interval stay as they are. What
changes is that the tier an idle chest rolls shifts with the highest level cleared, so
idle income stays relevant instead of decaying into irrelevance by level 30. Below
level 20 chests are Rusty; the weights move through Reinforced, Armored and Vault as
the player advances, with a small chance of the next tier up always present.

Every tenth level awards a guaranteed Vault chest on first Easy clear.

### First-clear rewards

Parts awarded for a first clear of level `n` on Easy:

```
parts(n) = round(2 * 1.056^(n-1))
```

Hard multiplies by 2.2 and Impossible by 4.5. The growth rate of 1.056 is deliberate:
weapon level cost grows at 1.115 per weapon level and the intended weapon level is
`n/2`, so `1.115^0.5 = 1.056` keeps income and cost locked together for the whole
campaign.

Coins from a first clear follow the same growth: `round(60 * 1.056^(n-1))` on Easy,
with the same 2.2 and 4.5 multipliers. Over the campaign that supplies 1,910,000 coins
against the 1,435,000 demand in section 5, a ratio of 1.33 before chest coins. The
surplus is what funds weapons beyond the core six.

Cores come only from the harder tiers. Hard first clear gives `ceil(n/12) + 1`,
Impossible gives `ceil(n/6) + 2`.

Repeat clears award 25% of the first-clear value, which is what makes farming a lower
level a real option when a player is stuck.

## 7. Earning weapons

Mint Condition is owned from the start. Each other weapon has a **discovery level**
where it first appears as an enemy-dropped preview, and an acquisition condition that
depends on its grade.

| Grade | Count | How it is earned |
|---|---:|---|
| C and B | 10 | Clear the discovery level on Easy. Granted outright. |
| A | 7 | Clear the discovery level on **Hard**. |
| S | 6 | Collect 22 blueprints. Clearing the discovery level on Hard grants 10 of them; the rest come from chests and Impossible clears. |

Discovery levels run from level 4 to level 92, listed in the section 4 table, so there
is a new weapon to chase roughly every four levels for the whole campaign.

Blueprint demand is 6 times 22, so 132. Guaranteed supply is 60 from the six Hard
discovery clears, 30 from milestone levels at 3 each, and 25 from Impossible clears at
one every four levels: 115 in total. The remaining 17 come from Armored and Vault
chests, which means the last two S weapons genuinely require chest farming rather than
arriving on schedule.

This is the answer to "not all weapons available right off the hop". The C and B
weapons keep the early game moving, the A weapons require engaging with Hard, and the
four S weapons are long chases that a player works toward across many levels.

Battle chests keep offering every unlocked weapon, as decided previously. What changes
is the **weighting**: a weapon's unlock-card weight scales with the account investment
in it, so a leveled weapon shows up more often without any weapon becoming unreachable.
This gives the player their build without reintroducing a loadout that hides new
unlocks.

## 8. Does the maths hold up

The check that matters: at each level, how much in-run card multiplier does a player on
the intended upgrade curve need in order to clear it? A flat row means a consistent
difficulty. The intended curve is weapon level `n/2` across six weapons, Foundry
progress `n/95`, and the arsenal slots of that level.

| Level | Health vs L1 | Sections | Waves | Weapon level | Rank | Easy | Hard | Impossible |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 33 | 3 | 1 | 1 | 0.97 | 1.85 | 2.73 |
| 10 | 3.01 | 42 | 3 | 5 | 1 | 0.87 | 1.65 | 2.43 |
| 20 | 10 | 52 | 4 | 10 | 1 | 0.91 | 1.72 | 2.53 |
| 30 | 31 | 62 | 4 | 15 | 2 | 0.88 | 1.67 | 2.47 |
| 40 | 94 | 64 | 4 | 20 | 2 | 1.05 | 1.99 | 2.93 |
| 50 | 274 | 64 | 5 | 25 | 3 | 1.06 | 2.01 | 2.96 |
| 60 | 768 | 64 | 5 | 30 | 3 | 1.21 | 2.30 | 3.39 |
| 70 | 2,074 | 64 | 5 | 35 | 4 | 1.10 | 2.09 | 3.08 |
| 80 | 5,386 | 64 | 6 | 40 | 4 | 1.17 | 2.23 | 3.28 |
| 90 | 13,457 | 64 | 6 | 45 | 5 | 1.08 | 2.06 | 3.04 |
| 100 | 32,351 | 64 | 6 | 50 | 5 | 1.22 | 2.32 | 3.43 |

Swept across all 100 levels rather than only the rows above, the required multiplier
stays inside 0.78 to 1.22 on Easy, 1.49 to 2.32 on Hard, and 2.20 to 3.43 on
Impossible, against a health curve that grows by a factor of 32,351 over the same span.
These bands moved up from the first draft because the model's card allowance was
corrected to the piece-derived chest stride; the earlier draft assumed far fewer late
cards than the game actually gave and far more than it gives now.

Read it like this. **Easy is always clearable by a player on the curve even with a
poor card run**, which is what keeps the campaign moving. **Hard needs a decent run**,
roughly doubling arsenal damage through cards, which a 20-card run reaches comfortably
but not automatically. **Impossible needs a strong run**, roughly tripling arsenal
damage, which needs good rarity luck or an account ahead of the curve. Level 100
Impossible lands at 2.62x, which a maxed account can reach: it is beatable, as
intended, but not on a mediocre run. A player who neglects
upgrades falls off this line immediately, because their own multiplier drops out of
the denominator: that is the mechanism by which later levels force upgrades.

### The economy balances at 0.90

Parts income from first clears against the cost of keeping six weapons on the intended
level:

| Level | Easy clear | All three tiers | Cumulative income | Six-weapon cost | Ratio |
|---:|---:|---:|---:|---:|---:|
| 10 | 3 | 23 | 192 | 188 | 1.02 |
| 20 | 6 | 46 | 539 | 573 | 0.94 |
| 40 | 17 | 131 | 2,148 | 2,380 | 0.90 |
| 60 | 50 | 385 | 6,953 | 7,746 | 0.90 |
| 80 | 148 | 1,140 | 21,237 | 23,684 | 0.90 |
| 100 | 440 | 3,388 | 63,664 | 71,017 | 0.90 |

The ratio locks at 0.90 from level 40 onward. First clears fund 90% of a six-weapon
core build. The last 10%, everything spent on weapons seven through twenty-four, and
the Refinery's conversion loss all come from idle chests and repeat farming. With 24
weapons the tail is deliberately larger than any player will fund: the Refinery at
3 to 1 is what lets a player concentrate scattered income into the build they actually
want rather than levelling everything thinly. That is the
intended role of idle income, and it means the idle timer is a real part of the
progression rather than decoration.

Cost of one grade-A weapon, where `parts(L) = ceil(6 * 1.115^(L-1) * gradeFactor)`:

| Reaching weapon level | Step cost | Cumulative parts | Cumulative coins |
|---:|---:|---:|---:|
| 10 | 16 | 101 | 1,432 |
| 20 | 47 | 406 | 5,950 |
| 30 | 140 | 1,305 | 19,366 |
| 40 | 414 | 3,966 | 59,209 |
| 50 | 1,227 | 11,859 | 177,543 |

Coin cost per level is `round(90 * 1.115^(L-1) * gradeFactor)`.

Cores: rank-ups cost 8, 22, 55 and 130 per weapon, so 215 to fully rank one weapon and
1,290 for six. Hard and Impossible first clears supply 1,652 across the campaign. The
28% headroom is what a player spends ranking a seventh or eighth weapon. A player who
skips the harder difficulties gets none of it, and stalls at rank 2.

## 9. Migration

Existing saves must not lose anything.

**Campaign progress.** Each old chapter is matched to the new level whose health
multiplier is closest to its own. Old chapter 1 maps to new level 1 and old chapter 15
maps to new level 21, because the old curve was far steeper. A player who cleared
everything receives clears on new levels 1 to 21 at the matching difficulties and
resumes at level 22. The old chapter arenas, bosses and phase behaviours survive as the
act anchors for levels 1 to 21.

**Weapon levels.** Old level 10 was 2.08x base damage. The nearest new level at 1.135
compounding is 7. Every weapon converts to the new level whose multiplier is closest to
its old one, and the parts already spent above that point are refunded at full value.
No weapon loses damage in the conversion.

**Difficulty ids.** `normal` maps to `easy`, `hard` stays, `hell` maps to
`impossible`. Clear records and best scores carry across.

**Currencies.** Existing shards become parts at 1:1. Coins carry across unchanged.
Cores and blueprints start at zero, with a one-off grant of 8 cores per weapon that was
already at old level 10, so a heavily invested account starts at rank 2 rather than
being knocked back.

`VERSION` increments to 2 and `normalizeSave` gains a version-1 migration branch rather
than the current behaviour of discarding any save whose version does not match.

## 10. Resuming where you left off

The save gains `furthest` per difficulty. The home screen defaults the level picker to
the highest unlocked level rather than the last one manually selected, and the launch
button reads as continuing the campaign. The existing `selected` field still records a
manual override so a player browsing back to farm level 30 is not bounced forward.

This is close to what already exists. The behaviour change is only in the default.

## 11. Code impact

Ordered by risk, highest first.

1. **`data.mjs` gains a generated level table.** `CHAPTERS` becomes `LEVELS`, produced
   by a pure function from the formulas in section 2 rather than 100 literal entries.
   The 15 existing chapter definitions become act anchor data feeding that function.
2. **`validRun` needs widening.** It currently hard-codes `r.chapter < CHAPTERS.length`,
   `r.weapons.length <= 6`, `finite(r.wave, 0, 4)` and `finite(r.health, 1, 7)`. All
   four become save-driven or take the new maxima. This function is the save integrity
   boundary, so every bound needs a test.
3. **`makeWeapon` damage becomes compounding** and reads rank as well as level.
4. **Number formatting.** Section health reaches roughly 2.1 million per section and
   run scores reach the billions at level 100. The HUD, damage numbers and card
   previews all need K/M/B formatting. Values stay far inside the `1e12` guard in
   `validRun`, so there is no overflow risk, only a readability one.
5. **New home screen surfaces:** Foundry tab, Refinery, blueprint progress on locked
   weapons, rank-up flow in the Armory.
6. **`openChests` is replaced** by the tiered chest model with cores and blueprints.
7. **`completeRun`** awards parts, cores and blueprints on the new curves and records
   `furthest`.

## 12. Verification

`tests/balance.mjs` already simulates every encounter deterministically and fails the
build if any is unwinnable. It is the right arbiter for this design and it needs to
grow with it.

The extended harness sweeps all 300 encounters at the account power the curve intends
for that level, and reports the clear margin for each. It also requires the tiers to
differ in the fight itself, not only in the win column. Because a deterministic bot
either keeps up with the feed or collapses, remaining shields are bimodal and are given
only a floor: Impossible must cost a shield in at least a tenth of encounters and at
least as often as Hard. The graded signal is **feed overrun**, active seconds divided by
the level's feed budget: Hard must exceed Easy by 5% and Impossible by 20% at the
median. Falling behind the feed is exactly the pressure a player feels.

Easy and Hard must win every level on the canonical seed. Impossible is meant to sit on
a knife edge, so a canonical-seed loss there is retried on up to two alternate seeds
and the retry is reported; the level fails only if none of the three wins. In the first
full sweep after tuning, level 74 was the only level that needed this. Level 100
Impossible must win, and did, with two shields left. It fails if any Easy encounter
is unclearable on the curve, if any Hard encounter is clearable with no cards at all,
or if the required card multiplier for any tier falls outside the band in section 8 by
more than 25%. That last check is what stops a later tuning change from quietly
reintroducing a difficulty wall.

A second harness replays the economy: it walks levels 1 to 100 awarding the specified
income, spends it greedily on the cheapest useful upgrade, and asserts the account
never falls below 85% of the intended power curve. This is what catches an income
change that looks small and starves the player forty levels later.

300 full encounter simulations will take noticeably longer than the current 45. If it
becomes slow enough to hurt, the sweep runs every fifth level by default and the full
300 behind a flag.

## 13. Deliberately not in scope

- New boss art for acts six to ten. The five existing bosses are reused as escalated
  variants.
- Any change to the endless tournament, beyond it reading the new permanent power axes.
- Online leaderboards, server-authoritative scoring and monetisation, all of which
  remain unconnected as documented today.

## 14. Decisions taken

These were open when the spec was first drafted and have since been settled.

1. **Session length.** 100 levels at roughly six to twelve minutes each is the target.
   The wave counts in section 2 are what set it, so they are now fixed.
2. **Level 100 Impossible must be beatable by a maxed account.** The Impossible health
   multiplier is therefore 2.80x, not the 3.60x first drafted. See section 3.
3. **Refinery rate is 3 to 1.** Parts stay meaningfully weapon-specific, so which
   weapon a chest rolls still matters, while a player is never hard-blocked from
   funding the build they want.
