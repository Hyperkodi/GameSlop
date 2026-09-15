# Progression, combat and automatic saves: v2

## Campaign

100 generated levels use all 15 original definitions as visual and narrative anchors across ten acts. Five recurring bosses, four arenas, rotating traits and late combined boss phases vary encounters. Easy clears unlock the next level and that level's Hard. Hard clears unlock Impossible. The picker follows the highest unlocked level until the player explicitly selects a farming level; its follow-highest button restores automatic selection.

For level `n`, total encounter health relative to level 1 is `exp(.124*(n-1)-.000193*(n-1)^2)`. Speed is `1+.5*(1-exp(-(n-1)/28))`. Base piece count is `min(64,24+n)`. Each subsequent wave adds three pieces, but the actual per-wave count remains capped at 64. Body sections group up to four pieces into a shared health pool.

Waves: 3 through level 10, 4 through 40, 5 through 70, then 6. The level HP coefficient is solved from the actual raw health pool, including head/body and wave multipliers. It is not set directly to the encounter-health multiplier. Tests verify all 100 spawned pools within 1% of the target.

| Difficulty | HP | Speed | Base shields | Boons | Rerolls | Reward |
|---|---:|---:|---:|---:|---:|---:|
| Easy | 1 | 1 | 5 | 1 | 2 | 1 |
| Hard | 1.9 | 1.10 | 4 | 2 | 1 | 2.2 |
| Impossible | 2.8 | 1.22 | 3 | 3 | 0 | 4.5 |

Impossible enables armor, regeneration and volatile section traits. Cold Storage adds two shields; Foundry Vault adds up to three. Maximum health is ten. Copium only repairs missing shields.

## Permanent power and currencies

Weapon damage: `base * 1.135^(level-1) * 1.12^(rank-1) * 1.08^ordnance`. Ranks 1 through 5 cap weapon level at 10/20/30/40/50. Rank upgrades cost 8/22/55/130 cores and require reaching the current rank's level cap.

Weapon level upgrades cost `ceil(6*1.115^(L-1)*grade)` parts and `round(90*1.115^(L-1)*grade)` coins. Grade factors are C .78, B .92, A 1.10, S 1.30. Grade does not multiply hit damage.

| Foundry | Maximum | Effect per level |
|---|---:|---|
| Ordnance | 25 | Compounding 8% damage |
| Precision | 20 | +1 percentage point crit and +.02 critical multiplier |
| Overclock | 20 | .55% shorter cooldown, linear, 11% at maximum |
| Vault | 24 | One shield per eight levels |

Each Foundry track level `k` costs `round(400*1.18^(k-1))` coins. Purchases affect the next run, preserving an already saved battle's exact stats. Six battle slots expand to seven after Easy 30 and eight after Easy 65.

First-clear coins are `round(round(60*1.056^(n-1))*tierReward)`. Parts use 2 instead of 60. Rewards are integer totals, distributed across the run's distinct collected weapons. Repeat clears give 25%, rounded, and no first-clear cores or blueprints. A defensive empty-arsenal reward falls back to coin parts.

Hard first clears grant `ceil(n/12)+1` cores. Impossible grants `ceil(n/6)+2`. An S weapon's discovery-level Hard first clear grants ten blueprints; each fourth Impossible first clear grants one. Every tenth Easy first clear grants three blueprints and a Vault chest. At capacity, one low-tier chest is opened automatically to preserve the milestone reward and its displaced loot.

Blueprints are a shared currency. Each S weapon requires 22, after its Easy discovery level. The Refinery exchanges three source parts for one target part, with no additional currency cost. Target weapons must be unlocked.

## Idle chest tiers

One chest every ten minutes, including while closed. All tiers share a 32-chest cap; time at capacity does not create a hidden backlog. Four Rusty welcome chests are provided.

| Tier | Coins | Total parts | Distinct weapons | Cores | Blueprint chance and amount |
|---|---|---|---:|---|---|
| Rusty | 40 to 70 | 3 to 5 | 1 | 0 | 4%, 1 |
| Reinforced | 140 to 220 | 10 to 16 | 2 | 0 to 1 | 12%, 1 to 2 |
| Armored | 420 to 650 | 30 to 45 | 3 | 2 to 3 | 30%, 2 to 3 |
| Vault | 1200 to 1800 | 90 to 130 | 4 | 6 to 9 | 100%, 3 to 5 |

Parts are distributed over the listed number of unlocked weapons, or fewer if the roster is smaller. Idle tier rolls shift at Easy 20, 40 and 70. The UI displays each tier's inventory and supports opening one, a tier batch or everything.

## Battle builds

Every new campaign or tournament attempt starts with Mint Condition only. All unlocked weapons are eligible. Green unlock-card weight is `2*(1+.06*(level-1)+.5*(rank-1))`. Investment affects weight, never eligibility. Weapon collection, battle cards, gold evolutions and boons reset on a fresh attempt.

Ordinary card options roll rarity independently before selecting an eligible card: Green 60%, Blue 28%, Red 10%, Gold 2%. The opening chest uses Green collection cards when another weapon is available. A fresh account with only Mint Condition receives ordinary upgrades instead. Chance of at least one Gold among three ordinary cards is about 5.88%.

| Card tier | Damage | Crit points | Cooldown reduction | Critical multiplier |
|---|---:|---:|---:|---:|
| Green | +25% | +5 | 10% | +.20 |
| Blue | +50% | +10 | 15% | +.35 |
| Red | +100% | +15 | 20% | +.50 |
| Gold | +200% | +25 | 30% | +1.00 |

Signature upgrades begin at Blue, grant 1/2/3 ranks, and cap at four ranks. Gold evolution needs three prior upgrades and is available once per weapon per run. Crit chance caps at 85%; Sniper uses a separate guaranteed-crit flag. Cooldowns floor at .09 seconds. Choice screens freeze combat.

Campaign Market Crash and volatile explosions use the highest-damage collected weapon. Campaign special charge counts effective damage, scaled by the encounter's health curve, preventing late permanent damage from refilling the special every frame. Tournament charge and special scaling retain their existing rules.

Armory DPS is nominal single-target expected hit throughput, including permanent crit and cooldown bonuses and initial simultaneous shots. Conditional effects, piercing, area overlap, marks, healing and executions vary with the encounter and are described separately. K/M/B formatting is shared by the HUD, damage numbers and card previews.

## Migration and sync

Version 1 coins are retained and shards become parts. Weapon level conversion rounds upward when needed to avoid losing damage; old level 10 becomes new level 7. Removed upgrade steps refund their actual legacy parts costs. Each old level-10 weapon starts at rank 2 and grants eight cores, following the requested migration benefit.

The explicit old chapter 1 to new level 1 and old chapter 15 to new level 21 endpoints take precedence over the old chapter-15 coefficient, whose literal nearest match would be level 23. A calibrated logarithmic mapping preserves intermediate clears. Matching earlier levels are also cleared. Normal maps to Easy and Hell to Impossible. Best scores, unlocks, settings, currencies, total runs, tournament best and both active run slots carry over.

Run validation covers level 100, six waves, eight weapons, ten shields, level-50 bases, ranks, Foundry and all new weapon timers and effects. Original engine fixtures verify preservation of rolled cards and projectiles. New effects are tested for deterministic continuation after normalization.

Local saving is automatic. Telegram reads before writing. An existing v2 local save cannot be overwritten by v1 cloud progress even if its timestamp is newer. Fresh devices may restore and migrate legacy cloud progress before creating their first local save. Service-worker cache v2.0.0 includes all runtime modules and sprites.

## Full weapon roster

C/B discovery requires an Easy clear, A requires Hard. S requires Easy discovery and blueprints. Existing owned weapons survive migration regardless of their new gate.

| Weapon | Grade | Discovery | Class | Behavior and gold evolution |
|---|---|---:|---|---|
| Mint Condition (coin) | C | 0 | Single target | Rapid-fire minted coins. Reliable, precise and gloriously excessive. Gold: Coins split into a three-shot fan. |
| Liquidator (laser) | A | 16 | Pierce line | A concentrated margin-call beam burns through aligned segments. Gold: The beam pierces every aligned segment. |
| Gas Fees (gas) | B | 9 | Burst area | Lob volatile gas canisters. The whole neighborhood pays. Gold: Blasts leave a burning aftershock. |
| Diamond Hands (diamond) | A | 21 | Multi-pass | Faceted diamond blades slice outward and return for a second pass. Gold: Returning blades deal double damage. |
| Block Lightning (chain) | B | 14 | Chain | Lightning validates its way across neighboring segments. Gold: Lightning hits twice as many targets. |
| Rug Pull (rug) | C | 4 | Control | An enchanted rug unrolls beneath Slippy and drags him back. Gold: Fields also deal three seconds of continuous damage. |
| Burn Address (burn) | B | 18 | Damage over time | Send Slippy to the burn address. Fire keeps dealing damage. Gold: Flames ignite a 60% wider area. |
| Whale Drop (whale) | S | 26 | Burst nuke | An enormous golden whale falls from orbit. A very bearish event. Gold: Every impact is followed by a second strike. |
| Hash Satellite (satellite) | S | 44 | Percent current health | An orbiting hash cannon shaves 1.5% of current segment health, capped at 4× its hit damage. Gold: Current-health damage doubles to 3%, capped per hit. |
| MEV Swarm (swarm) | B | 23 | Homing multi | Three predatory trading bots independently home in on different targets. Gold: Launch twice as many homing bots. |
| Ledger Singularity (vortex) | S | 58 | Zone control | A black hole repeatedly damages nearby segments for three seconds and slows the connected snake. Gold: Singularities last twice as long. |
| Hard Fork (fork) | A | 31 | Splitting | A blockchain bolt forks into two homing fragments when it strikes. Gold: Fragments split a second time. |
| Oracle of Doom (oracle) | S | 68 | Support amplifier | Marks three segments for five seconds. Marked targets take 25% extra damage from your entire arsenal. Gold: Execute marked segments below 10% health. |
| Genesis Dragon (dragon) | A | 46 | Head hunter | A crypto dragon hunts the front of the snake, leaving a trail of fire before bursting on impact. Gold: Summon a second dragon and extend the flame trail. |
| Paper Hands (paper) | C | 7 | Comeback volley | Three shots deal double damage while the vault is hurt. Gold: Fire five shots instead of three. |
| Money Printer (printer) | B | 28 | Ramping turret | Keep firing at one section to ramp from 0.55 to 0.18 seconds. Gold: Keep the firing ramp when changing targets. |
| Sniper Bot (sniper) | A | 38 | Guaranteed crit | Always critically hits the visible section with the lowest current health. Gold: Execute a target below 15% health. |
| Halving Hammer (halving) | A | 62 | Percent max health | Every fourth cast adds 2% maximum health damage, capped at 5x base damage. Gold: Apply maximum-health damage every second cast. |
| Slippage (slippage) | B | 40 | Stacking vulnerability | Apply up to five vulnerability stacks, each increasing incoming damage by 8%. Gold: Stack vulnerability up to ten times. |
| Copium Tank (copium) | C | 11 | Shield sustain | Cloud contact charges a shield repair every 45 seconds. Gold: Accrue shield contact charge twice as fast. |
| Bear Trap (trap) | B | 34 | Path trap and root | Place an armed path trap that blasts sections and roots the snake for 2 seconds. Gold: Arm a second trap at the nearest section. |
| Nonce Nuke (nuke) | S | 92 | Screen clear | Hit every visible section with damage falling away from the head. Gold: Strike every visible section without distance falloff. |
| Wen Lambo (lambo) | A | 54 | Path sweep | Drive along the snake body path, striking each section once per pass. Gold: Make a return pass along the snake body path. |
| Flash Loan (flashloan) | S | 80 | Debt burst | Deliver a huge hit, then repay for 2.5 seconds. A target kill forgives the debt. Gold: Forgiving a debt refunds the cooldown for an immediate new cast. |
