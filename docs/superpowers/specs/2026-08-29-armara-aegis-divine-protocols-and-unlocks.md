# Armara Aegis — Divine Protocols and Campaign Unlock Systems

**Date:** 2026-08-29

**Status:** Approved product amendment; implementation and Candidate-BAL tuning authority

**Owner:** Ryan / Armara
**Applies to:** the deterministic campaign runtime, profile, replay viewer, candidate preview, Codex, and presentation companion

## 1. Authority and amendment boundary

Ryan approved implementation of the complete unlock-system brainstorm on 2026-08-29. This document is the binding product and engineering contract for:

- ten active Divine Protocols with three expensive progression tiers;
- two Protocol loadout slots earned through campaign play;
- a two-branch Level 3 specialization for every one of the fifteen defense families;
- eight tradeoff Relics and two Relic slots;
- three temporary reinforcement units;
- five player-activated battlefield mechanisms;
- three non-combat Recon tiers;
- defense mastery, Protocol proficiency, Codex, cosmetic, and post-campaign unlocks;
- the Mission 20 Armara Ascension ultimate.

It amends these older authorities only where they conflict:

1. Campaign-expansion Section 9 and ADR-002 no longer require a single linear Level 3. A defense still has exactly three paid in-run levels, but Level 2 must specialize into one of two complete Level-3 records.
2. Campaign-expansion Sections 7 and 9 no longer restrict Laurels to cosmetics. Laurels may be allocated to Protocol tiers under the refundable rules below. They never increase a tower's permanent base stats.
3. The older `Olympian Overcharge` concept is replaced by `armara-ascension`. There is one final ultimate, not two overlapping systems.
4. Campaign mission, defense, enemy, map-grid, 70% sell, difficulty, accessibility, offline-first, and deterministic-replay contracts remain binding.
5. Historical ABI-v1, source/compiled-content v1–v3, command-schema-v1, replay-v1, and their immutable artifacts remain supported. New behavior is additive through versioned contracts and never changes an old replay's meaning.

This approval does not authorize a public route switch, GitHub push, social verification, or rewards for X/Telegram engagement. The full campaign must remain beatable without a social account, a Protocol cast, a Relic, a reinforcement, or a mechanism.

## 2. Player promise

The player should feel that Armara's ancient-Greek defense network is gaining new divine capabilities as the campaign escalates. Unlocks create tactical choices, not an automatic power curve:

- Protocols are dramatic, scarce, player-aimed interventions paid from the same visible Aether bank as towers.
- Specializations ask what role a placed tower should finish, not merely whether to buy a larger number.
- Relics exchange one advantage for a clearly stated drawback.
- Reinforcements temporarily solve a local emergency but compete with permanent construction.
- Map mechanisms make each battlefield matter without changing an enemy's route invisibly.
- Recon improves information, never hidden combat math.
- Every effect is readable at ordinary play scale in the bright, cartoon-forward “ancient Greece meets AI” Armara style.

## 3. Terminology and persistent progression

- **Protocol:** an active campaign ability. “Spell” may appear in onboarding search/help copy, but player-facing names use **Divine Protocol**.
- **Tier:** the equipped strength/cost package for a Protocol. Tiers are complete immutable records.
- **Specialization:** the one-time Level-3 branch selected for a Level-2 tower during a run.
- **Relic:** an equipped, run-wide passive with one benefit and one drawback.
- **Reinforcement:** one equipped temporary unit deployed at an authored reinforcement marker.
- **Mechanism:** a mission-owned battlefield control with authored activation targets.
- **Recon:** presentation-only preview detail.
- **Laurel allocation:** refundable out-of-run spend used to make a higher Protocol tier available.

Laurels remain earned once per objective, mission, and difficulty as already specified. Tier 1 is granted with each Protocol. Tier 2 costs 6 allocated Laurels. Tier 3 requires Tier 2 and another 12, for 18 allocated Laurels total per maximized Protocol. All ten Protocols therefore require exactly 180 Laurels to maximize, matching all three Laurels on all twenty missions across all three difficulties.

Laurel allocation is freely and atomically refundable outside a run. A refund that would invalidate the saved loadout automatically lowers that equipped Protocol to its highest still-owned tier and tells the player what changed. No refund, purchase, loadout edit, or profile read is legal after a run's immutable start state exists.

## 4. Campaign cadence

An unlock mission loans its featured Protocol at Tier 1 in a dedicated tutorial slot even if the player's permanent slots are full. The loan is mission-local, cannot be upgraded during the run, and enters the replay header. First victory grants Tier 1 permanently. Every mission remains winnable without using the loan.

| Available in mission | Unlock after victory | Additional milestone |
|---|---|---|
| `m05` | `temporal-edict` | First permanent Protocol slot |
| `m08` | `zeus-skyfire` | — |
| `m10` | `aegis-ward` | Second permanent Protocol slot |
| `m11` | `poseidon-surge` | First permanent Relic slot already exists from `m06` |
| `m13` | `athena-command` | — |
| `m15` | `hephaestus-overclock` | Second permanent Relic slot |
| `m16` | `hermes-rewind` | — |
| `m17` | `medusa-lock` | — |
| `m18` | `hades-bargain` | — |
| `m20` | `armara-ascension` | Permanent post-victory access in replays, challenges, and Endless Ascension |

The first permanent slot becomes available for the `m05` loan tutorial and is retained after victory. The second becomes available only after the first `m10` victory. A valid Protocol loadout may contain fewer than the slot cap and cannot contain duplicate IDs. The player may deliberately equip a lower owned tier to pay its lower cast cost.

## 5. Universal Protocol rules

### 5.1 Cost and cooldown

Every accepted cast pays from the same pinned, always-visible Aether balance used by Build, Upgrade, Sell, Reinforcement, and Mechanism actions. A card always shows current resolved cost, base cost, individual cooldown, shared cooldown, tier, target kind, duration, and exact effect before targeting begins.

For a Protocol with base tier cost `baseCost`, let `priorAcceptedCasts` be the number of earlier accepted casts of that same Protocol in the current mission:

```text
resolvedCastCost = ceil(baseCost × (10000 + 2500 × priorAcceptedCasts) / 10000)
```

The first, second, third, and fourth casts therefore cost 100%, 125%, 150%, and 175% of base. Rejected commands do not pay, start cooldown, or increment the count. Accepted casts immediately pay, start their individual cooldown, and start a 15,000 ms shared Protocol cooldown. A Protocol is legal only when both cooldowns are zero.

Ordinary `repeat-surcharge` Protocol tiers declare `maximumAcceptedCasts: null`: the rising Aether cost and replay/command resource ceilings bound them, not an arbitrary gameplay cap. Only Armara Ascension uses `castPolicyId: once-per-mission` and `maximumAcceptedCasts: 1`; its second-cast denial derives from that policy identity.

Cooldowns, telegraphs, buffs, debuffs, zones, and summons use ABI integer time and advance only during combat ticks. Planning and Pause suspend them. Cooldowns carry across wave boundaries. Temporary active effects end at wave clear unless their record explicitly says `carryAcrossWave: true`; campaign v1 declares none. An accepted delayed strike keeps the combat wave open through its final scheduled resolution so a telegraph cannot freeze in planning.

### 5.2 Targeting and rejection

Target selection freezes simulation but not presentation animation. Cancel is free. Confirm creates one command against the current simulation boundary. Legal target shapes are closed records:

- `none` for global Protocols;
- `route-point` with a compiled route ID and clamped route distance;
- `tower` with one live eligible tower runtime ID;
- `world-vector` with an in-board origin and aim point for a cone.

The command rejects with stable reasons for a locked/unequipped tier, wrong target kind, planning/terminal state, shared or individual cooldown, insufficient Aether, missing eligible target, stale tower, out-of-board vector, or mission-local loan mismatch. Presentation may explain the reason but may not repair or retarget the command.

The deterministic geometry selector supplies a command-bound `targetSelection` proof containing exactly `{ protocolId, target, eligibleTargetIds }`. Its Protocol and canonical target must match the submitted command. Route, tower, cone, and immediate global-damage casts require a nonempty sorted eligible-ID list; an eligible unit elsewhere cannot authorize payment for an empty selected area. Future-spawn global fields and Aegis Ward explicitly permit an empty list because their effects attach to future simulation events rather than the current selection.

### 5.3 Effect composition

- Protocol movement reduction enters the existing strongest-only `slow`/`drench` bucket. It never adds to Chronos or Poseidon movement reduction.
- Protocol hard control uses the existing block/stun/petrify bucket, Resolve, boss scaling, and deterministic rejection rules.
- Protocol displacement uses the existing per-target displacement cooldown, Heavy 50% scaling, and boss control basis points.
- Protocol tower amplification is a distinct `protocol-amplification` source. At most one Protocol amplification can affect a tower. If two overlap, the stronger complete instance wins; equal magnitude prefers later expiry, then lower Protocol ID.
- Protocol damage and rate bonuses are applied after ordinary external support sums and before an attack's authored target-specific coefficient. Each is capped at +8500 bp. Protocol range is capped at +1500 bp. Exact integer rounding follows the ABI once per stage.
- A Protocol cannot advance a tower's shot, scan, summon, mine, guard, chain, or capstone counter except by reducing the next ordinary attack cooldown through the defined rate formula. A cooldown already in progress is never rescaled.
- Power damage has runtime source kind `protocol`, never impersonates a tower, earns no tower mastery attribution, and obeys shield, armor, resistance, boss-transition, child, revival, bounty, and terminal ordering.
- All selection orders end in immutable runtime ID. No canvas coordinate, animation frame, wall clock, or frame delta is authoritative.

## 6. Binding Divine Protocol catalog

All damage values are whole display damage compiled to milli-damage. Distances are world units. Durations/cooldowns below compile from exact milliseconds.

### 6.1 Temporal Edict (`temporal-edict`)

Global, immediate, ground and air. It creates one global field and applies its movement-reduction instance to every active enemy at acceptance and every enemy spawned while the field remains active, including bosses through normal control scaling. Each affected enemy's expiry is the field's original expiry, not a fresh full duration from spawn.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 75 | 80 s | 25% slow for 10 s |
| 2 | 115 | 95 s | 50% slow for 10 s |
| 3 | 165 | 110 s | 50% slow for 15 s |

### 6.2 Zeus Protocol: Skyfire (`zeus-skyfire`)

Global, delayed, ground and air. A thundercloud telegraph begins at acceptance; each strike snapshots all live enemies at its resolution boundary in route-ID, route-distance-descending, runtime-ID order. Boss HP damage uses a 5000 bp coefficient.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 90 | 90 s | One strike after 900 ms; 40 damage to every active enemy |
| 2 | 135 | 100 s | One strike after 900 ms; 70 damage; 15000 bp shield coefficient |
| 3 | 190 | 115 s | 65 damage after 900 ms and again 700 ms later; 17500 bp shield coefficient; the second hit attempts a 350 ms non-boss stun |

The second strike can hit enemies spawned between strikes. A rejected stun still deals damage and does not postpone Resolve.

### 6.3 Aegis Ward (`aegis-ward`)

Global, immediate. Ward charges intercept the next eligible leak events before integrity is deducted. Each charge prevents up to its per-leak cap; excess integrity damage still applies. A charge is consumed if it prevents at least one point. Ward expires at its duration or wave clear.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 70 | 85 s | 1 charge for 12 s; prevent at most 2 integrity on that leak |
| 2 | 105 | 100 s | 2 charges for 15 s; prevent at most 3 per leak |
| 3 | 145 | 115 s | 3 charges for 18 s; prevent at most 4 per leak |

Prevented integrity counts for victory, Integrity Laurels, and score because it was bought with combat Aether. The result screen separately reports Ward prevention.

### 6.4 Poseidon’s Surge (`poseidon-surge`)

Target: route point. It affects at most the first 12 eligible ground enemies within 18 world units, sorted by distance to target, route progress descending, then runtime ID. It applies displacement and drench atomically in that order.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 95 | 90 s | Push back 8 units; 20% drench for 4 s |
| 2 | 135 | 100 s | Push back 12 units; 25% drench for 5 s |
| 3 | 180 | 110 s | Push back 16 units; 30% drench for 6 s |

Air is ineligible. Heavy and boss displacement/control scaling remains binding.

### 6.5 Athena’s Command (`athena-command`)

Target: one eligible non-support damage tower. The target and nearest eligible towers within 28 units form the cluster, ordered by squared distance to the selected tower then runtime ID. Disabled towers may be selected but receive no value until re-enabled; the timer continues.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 85 | 80 s | Up to 3 towers; +25% rate for 8 s |
| 2 | 125 | 95 s | Up to 4 towers; +35% rate for 10 s |
| 3 | 170 | 110 s | Up to 5 towers; +40% rate and +10% range for 12 s |

### 6.6 Hephaestus Overclock (`hephaestus-overclock`)

Target: one live damage tower. The selected tower receives amplification, then a forced shutdown. Sell remains legal during either state; selling cancels both without refunding the cast. Upgrade/specialize does not reset timers.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 70 | 75 s | +45% damage and rate for 10 s; disabled for 4 s afterward |
| 2 | 105 | 90 s | +65% damage and rate for 12 s; disabled for 4 s afterward |
| 3 | 150 | 105 s | +85% damage/rate and +10% range for 14 s; disabled for 5 s afterward |

Protocol shutdown is a distinct disable source. A tower becomes enabled only when every active disable source is gone.

### 6.7 Hermes Rewind (`hermes-rewind`)

Target: route point; the point selects a route, not a radius. It rewinds the frontmost eligible live enemies on that route. Selection snapshots route distance descending then runtime ID. Rewind distance is a percentage of that route's compiled total length and clamps at route start.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 80 | 90 s | Frontmost 3; rewind 12% |
| 2 | 120 | 105 s | Frontmost 5; rewind 18% |
| 3 | 170 | 120 s | Frontmost 8; rewind 25% |

This is displacement: Heavy receives 50%, bosses receive their control basis points, air is eligible, and the per-target displacement cooldown applies.

### 6.8 Medusa Lock (`medusa-lock`)

Target: world vector. The origin clamps to the valid battlefield; the nonzero origin-to-aim vector defines a cone. Eligible ground enemies sort by forward projection, perpendicular distance, then runtime ID. Every selected target receives one petrify attempt in that order.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 100 | 100 s | 36-unit range, 50° cone, at most 8 targets, 2 s petrify |
| 2 | 145 | 110 s | 42-unit range, 60° cone, at most 12 targets, 3 s petrify |
| 3 | 195 | 120 s | 48-unit range, 70° cone, at most 16 targets, 4 s petrify |

Resolve and boss scaling apply individually. A rejected target does not transfer its unused slot to an unselected enemy.

### 6.9 Hades’ Bargain (`hades-bargain`)

Target: route point. At acceptance, it marks the closest eligible active enemies within 16 units. Marked enemies move faster, deal one additional integrity if they leak, and award bonus bounty if killed while marked. This is the only Protocol that can directly earn Aether.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 65 | 80 s | At most 12 for 10 s; +10% speed, +25% bounty |
| 2 | 90 | 95 s | At most 18 for 12 s; +12% speed, +35% bounty |
| 3 | 125 | 110 s | At most 24 for 15 s; +15% speed, +50% bounty |

Bonus bounty uses the mission's deterministic basis-point remainder and increments `protocolAetherEarned`. Score computes `eligibleUnspentAether` after subtracting this amount, so the Protocol cannot manufacture unspent-Aether score. Bounty still resolves once per lineage.

### 6.10 Armara Ascension (`armara-ascension`)

Global, immediate, once per mission. It combines one enemy movement-reduction field with one tower amplification instance. Enemies spawned during the field inherit only its remaining duration. The `m20` loan is Tier 1. Victory grants permanent Tier 1; Tiers 2 and 3 use the normal 6/12 Laurel allocation.

| Tier | Base cost | Cooldown | Effect |
|---:|---:|---:|---|
| 1 | 220 | Once | 25% enemy slow, +15% tower damage, +25% tower rate for 8 s |
| 2 | 260 | Once | 35% slow, +20% damage, +35% rate for 10 s |
| 3 | 320 | Once | 45% slow, +25% damage, +45% rate for 12 s |

It uses a luminous Armara hourglass aperture, never a generic magic circle. It respects the shared cooldown and may not be cast a second time even if refunded by a test harness or profile mutation.

## 7. Level-3 defense specializations

### 7.1 Rules

- Build creates Level 1. Upgrade creates Level 2. From Level 2, the player selects one of two Level-3 specialization cards and pays the existing Level-3 upgrade cost.
- Each family’s current campaign Level-3 capstone becomes its default specialization. The alternate specialization unlocks permanently after the profile records a victory in which that family reached at least Level 2. Training may trial both without profile mutation.
- The selected branch is final for that tower. Sell at 70% and rebuild is the only in-run branch change.
- Both branches use the same existing Level-3 cost, so cumulative investment and golden 70% refund remain unchanged.
- The pre-purchase card compares complete values and explicitly names what is lost. No card says merely “more damage.”
- `specializeTower` replaces `upgrade` for Level 2 → Level 3 under content schema v4. An old schema-v3 run keeps its historical linear `upgrade` semantics.

### 7.2 Binding branch records

Unmentioned targeting, air eligibility, armor, statuses, range, source caps, and counter rules inherit the family’s reviewed Level-2 contract. The table below is the complete Level-3 override; these are immutable records, not runtime deltas.

| Family | Default specialization | Alternate specialization |
|---|---|---|
| Sentinel | `sentinel-lock-on`: 18 damage / 360 ms / range 26; three consecutive primary hits grant +15% internal damage until switch | `sentinel-twin-lance`: 15 / 340 ms / range 25; closest second target within 6 units takes 60%; collateral never advances Lock-On/counters |
| Chronos | `chronos-echo-field`: 6 / 720 ms; 48% slow for 1.5 s; every fifth attack echoes a weaker slow to at most two | `chronos-time-debt`: 5 / 760 ms; 55% slow for 1.8 s; third consecutive hit on one target consumes its source stacks for 18 temporal damage; no echo |
| Siege | `siege-breach-core`: 52 / 1.20 s / range 28 / radius 6.5; central 2.5 units take +35% | `siege-sun-shrapnel`: 42 / 1.05 s / range 28 / radius 8; at most eight targets; no center bonus |
| Hoplite | `hoplite-phalanx`: three guards, 1.2 s block, 5 s replenish; first eligible contact bashes for 12 | `hoplite-spearwall`: two guards, 1.0 s block, 4.25 s replenish; every accepted contact deals 24; no opening bash window |
| Oracle | `oracle-chorus`: two +11% marks; every fifth scan marks at most five for 2 s; range 32 | `oracle-judgment`: three simultaneous +15% marks; range 30; no mass-scan capstone |
| Artemis | `artemis-execution-line`: 118 / 1.8 s / range 46; every fourth primary deals 150%; one 50% pierce never crits | `artemis-threader`: 96 / 1.65 s / range 44; up to three aligned targets at 100/65/40%; no crit |
| Hermes | `hermes-wing-command`: two drones, 8 each / 400 ms; every sixth drone attack fires one bonus shot | `hermes-sky-swarm`: three drones, 7 each / 450 ms; air priority and 15000 bp internal air coefficient; no bonus-shot counter |
| Poseidon | `poseidon-maelstrom`: 30 / 1.05 s to five; 2.5 push; 15% drench 2.5 s; every fifth attack is 40 damage to six | `poseidon-undertow`: 24 / 1.10 s to four; 3.5 push; 25% drench 3.5 s; no maelstrom counter |
| Medusa | `medusa-gorgon-bloom`: 16 / 550 ms; every fifth shot petrifies primary 1 s and radius-2.5 secondaries 0.35 s | `medusa-basilisk-focus`: 19 / 600 ms; every fourth shot petrifies only the primary for 1.5 s |
| Hephaestus | `hephaestus-molten-field`: two mines; 60 blast + 6/s for 4 s; 4.5 s replenish; 2.5 s anti-regeneration field | `hephaestus-triple-foundry`: three mines; 46 blast + 5/s for 3.5 s; 3.8 s replenish; no persistent field |
| Athena | `athena-coordinated-fire`: four links, +10% range/rate; +8% damage when two links share a target | `athena-command-mesh`: five links, +12% range and +15% rate; no coordinated-damage bonus |
| Apollo | `apollo-forked-ray`: pulses ramp 4→18; +50% shield; fork at 45%, or 70% against shield | `apollo-solar-lance`: pulses ramp 4→24, peak 25% faster, +100% shield damage; no fork |
| Hades | `hades-twin-banish`: 28 / 1.10 s; execute 18%; every third execute may banish one nearby wounded non-boss, 8 s cooldown | `hades-soul-tithe`: 30 / 1.0 s; execute 20%; first six executes each wave grant 2 Aether; no nearby banish |
| Talos | `talos-titan-hunter`: 145 / 2.0 s / range 26; 50% armor ignore, -4 armor 3 s, +30% boss damage | `talos-earthbreaker`: 105 / 1.8 s / range 25 / radius 4; 35% armor ignore and -3 armor 3 s; no boss coefficient |
| Zeus | `zeus-storm-crown`: 30 / 900 ms to five at 100/75/55/40/30%; every sixth adds up to three 30% storm targets | `zeus-thunderhead`: 38 / 1.05 s to three at 100/70/50%; every eighth primary creates a 70-damage radius-3 burst; burst cannot recurse |

Soul Tithe Aether increments `specializationAetherEarned` and is also subtracted from eligible unspent-Aether score. The same lineage cannot pay twice.

## 8. Relics

### 8.1 Slots and unlock cadence

The first Relic slot unlocks after `m06`; the second after `m15`. Relics are campaign rewards, cost no Laurels, and are optional. Duplicate IDs are forbidden. Their exact resolved IDs and slot cap enter the run header and record key.

| First victory | Relic |
|---|---|
| `m06` | `bronze-obol` |
| `m07` | `owl-lens` |
| `m09` | `broken-aegis` |
| `m11` | `forge-ember` |
| `m13` | `tideglass` |
| `m15` | `laurel-of-ares` and second slot |
| `m17` | `hermes-greaves` |
| `m19` | `titan-gear` |

### 8.2 Binding records

| ID | Benefit | Drawback |
|---|---|---|
| `bronze-obol` | +25 starting Aether after difficulty | All earned bounty × 8500 bp before remainder resolution |
| `owl-lens` | Tower range +1000 bp | Tower attack rate −800 bp |
| `broken-aegis` | +5 maximum and starting integrity | −20 starting Aether after difficulty |
| `forge-ember` | Paid upgrade/specialization costs × 8800 bp, rounded up | Build costs × 10800 bp, rounded up |
| `tideglass` | Tower slow/drench magnitude and displacement × 12000 bp | Tower direct and damage-over-time output × 9200 bp |
| `laurel-of-ares` | Tower direct and damage-over-time output × 11200 bp | Tower slow/drench magnitude and hard-control duration × 8500 bp |
| `hermes-greaves` | Tower attack rate +800 bp | Tower range −800 bp |
| `titan-gear` | Protocol base and escalated cast costs × 8500 bp, rounded up | Build and upgrade/specialization costs × 10800 bp, rounded up |

Relic modifiers sum by named stat in ASCII ID order and clamp before one rounding operation: cost multipliers 7000–14000 bp, damage 7000–14000, rate −3000–4000, range −2500–2500, control 5000–14000. Additive starting Aether resolves after difficulty and before campaign Reserve/Assist additions. Actual paid investment controls sell refund; discounted upgrades do not refund their undiscounted price.

## 9. Temporary reinforcements

The reinforcement slot unlocks with Spartan Phalanx after `m09`. Artemis Scout and Talos Automaton unlock after `m14` and `m18`. The player equips at most one. A mission from `m10` onward must either author at least one visible reinforcement marker or warn before Start that the equipped unit cannot deploy there. One live reinforcement per player is allowed; its cooldown starts at accepted deployment and its lifetime ends at wave clear.

| ID | Cost | Cooldown/lifetime | Exact role |
|---|---:|---|---|
| `spartan-phalanx` | 70 | 50 s / 14 s | Three ordered guard contacts at the marker; each deals 12 and blocks an eligible ground non-air target for 1 s; no replenishment |
| `artemis-scout` | 90 | 60 s / 18 s | Stationary animated archer at marker; 11 damage every 450 ms, range 32, ground + air, armor-piercing; Focus target policy |
| `talos-automaton` | 155 | 100 s / 22 s | Stationary animated automaton; 42 ground damage every 1.2 s in radius 3, range 22, applies −2 armor for 2.5 s |

Markers declare supported reinforcement kinds and role proofs. Deploying to an occupied, unsupported, stale, or out-of-wave marker rejects without cost. Runtime IDs come from the ordinary monotonic entity allocator. Expiry, sell-like removal, and wave clear never refund Aether.

## 10. Player-activated battlefield mechanisms

Mechanisms belong to maps, not loadouts. Their large illustrated control sits beside the Protocol tray only on missions that contain them. A mechanism has its own cooldown and uses Aether; it does not use the shared Protocol cooldown or Protocol escalation.

| First featured mission | ID | Cost | Cooldown | Binding effect |
|---|---|---:|---:|---|
| `m05` | `bronze-city-gate` | 55 | 75 s | 500 ms close telegraph, then at its authored marker blocks at most the first three eligible ground contacts for 4 s total; normal hard-control/Resolve/boss rules |
| `m07` | `harbor-chain` | 50 | 65 s | All eligible ground enemies in its authored harbor zone receive 30% slow for 8 s; air immune |
| `m11` | `sacred-braziers` | 60 | 70 s | Authored zone burns for 8 s; 4 damage pulses every 500 ms to at most 20 ground enemies, sorted by route progress then ID |
| `m14` | `athena-statue-beam` | 90 | 90 s | 900 ms visible line telegraph; 100 energy damage to ground and air in the authored 8-unit-wide beam; bosses use 6000 bp damage coefficient |
| `m17` | `bridgefall` | 110 | Once | 1.2 s telegraph; 80 blast damage to ground in the authored region, then 25% rubble slow there until wave clear; it never deletes, adds, or reroutes a live lane |

Mechanism targets are authored activation IDs. The player may click the illustrated structure or its semantic control; hidden developer geometry, strategic-pad labels, and debug overlays are never shown in ordinary play.

## 11. Recon, mastery, and non-combat unlocks

### 11.1 Recon

Recon reads immutable compiled waves and affects presentation only. It never enters simulation state, ruleset hash, replay header, score, or record key.

- **Baseline:** always shows route labels, enemy types/traits, air/ground status, hazards, boss phase rules, and relative group size for the next wave.
- **Recon I**, after `m06`: exact count and route for each next-wave group.
- **Recon II**, after `m14` and replacing the older Oracle Forecast reward: exact groups for the next two waves plus one-second spawn-time bands.
- **Recon III**, after `m18`: exact groups/routes/timing for all remaining waves and a compact boss-threshold timeline.

Recon cannot hide baseline information when unavailable. Reduced information is never a difficulty modifier.

### 11.2 Defense mastery

Each family records only these monotonic milestones:

1. `fielded`: finish a victory with at least one Level-1 copy;
2. `tempered`: finish a victory with that family at Level 2 or higher; unlocks its alternate Level-3 specialization;
3. `mastered`: finish a Strategos-or-higher victory with both specializations represented across the profile's verified results; unlocks a cosmetic chassis, Codex motion study, and profile emblem.

Mastery never modifies combat stats. A replay/profile validator, not mutable presentation state, supplies the qualifying result.

### 11.3 Victory and sharing

Every level result keeps the local victory/share card. It adds optional badges for the Protocols, Relics, specialization mix, reinforcement, and mechanism actually used. The card contains no claim that a player joined or followed a social account. The existing guided 10–20 second screen-recording flow remains presentation-only.

## 12. Player experience and controls

### 12.1 Pre-battle loadout

The loadout screen has four plainly named sections: **Towers**, **Divine Protocols**, **Relics**, and **Reinforcement**. Each section shows its slot count, unlock source, exact tradeoffs, and a one-click clear action. Locked items remain inspectable. Laurel allocation is a separate reversible panel and always previews the resulting cast cost/effect before confirmation.

### 12.2 In-battle command deck

- Desktop shows up to two large Protocol controls with icon, key hint, tier, resolved Aether cost, and radial cooldown. Reinforcement and the mission mechanism use distinct silhouettes and labels.
- Mobile uses one expandable **Powers** tray. Opening it pauses; it never covers the Aether bank, integrity, wave, selected target, or confirm/cancel controls.
- Starting a targeted action darkens noneligible targets slightly, preserves the road and enemy contrast, and shows the exact legal area. It never reveals hidden strategic-pad classifications.
- `Escape`, right click, or the visible Cancel exits targeting. Confirm is a separate click/tap; a first click never both selects and spends.
- Controls have semantic names such as “Temporal Edict, Tier 2, costs 115 plus repeat surcharge, ready” and expose remaining cooldown in whole seconds.
- Keyboard defaults are `1`/`2` for Protocol slots, `R` for reinforcement, and `M` for mechanism. All are rebindable and never collide with browser-reserved shortcuts.

### 12.3 Readability and motion

Enemy/tower art remains brighter and more cartoon-forward than the battlefield. Protocol effects use high-contrast cyan, gold, violet, sea-green, and ember-orange accents against the warm stone/earth environments. Effects cannot obscure HP, shields, route direction, selected tower range, or Aether feedback.

Reduced Motion replaces cloud travel, camera shake, flashes, radial streaks, and long statue/Ascension motion with a short opacity/scale cue while preserving the exact telegraph boundary. Photosensitivity mode caps full-field luminance changes, prohibits rapid alternating flashes, and renders lightning as one sustained high-contrast bolt per authoritative strike.

## 13. Versioned deterministic contracts

### 13.1 New immutable versions

New-system campaign content uses:

- source manifest and canonical compiled-content schema v4;
- behavior-registry v2 and semantic-event schema v2;
- command schema v2;
- deterministic ABI v2 and a new self-contained simulation artifact identity;
- replay format v2;
- local profile schema v2;
- presentation catalog v2 with explicit asset/sprite records.

The runtime must keep a fail-closed v1 path for historical artifacts/replays. It may not translate a v1 command or replay into v2 and claim the original hash.

### 13.2 Content schema v4

V4 extends the normalized simulation lock tree with exact ASCII-keyed collections:

```text
powers
specializations
relics
reinforcements
mechanisms
progression
```

Campaign rules additionally own Protocol/relic/reinforcement slot caps, modifier clamps/order, shared cooldown, repeat-cost formula, target-shape IDs, new status/damage/source memberships, and profile grant memberships. Missions reference authored mechanism activation records and reinforcement markers. Defense records reference two complete L3 specialization IDs. Every reference resolves exactly once; unknown/missing/extra keys fail.

No localized sentence, icon path, animation duration, sprite rectangle, screen coordinate, or visual particle count may affect simulation content. No UI or renderer duplicates a cost, cooldown, radius, tier, branch stat, modifier, or unlock milestone.

### 13.3 Command schema v2

V2 retains v1 commands and adds these strict payload families:

```text
specializeTower     { towerRuntimeId, specializationId }
activatePower       { protocolId, tier, target }
deployReinforcement { reinforcementId, markerId }
activateMechanism   { mechanismId, activationId }
resetPlan           { }
```

`tier` is repeated in `activatePower` so a replay cannot reinterpret an equipped lower tier; it must equal the header-resolved loadout. Targets use the closed shape/discriminator records in Section 5. Unknown commands or payload keys fail before reducer mutation. Per-tick sequence order remains binding.

### 13.4 Replay-v2 start header

In addition to retained v1 identities, the canonical start header contains exact resolved records for:

```text
protocolLoadout: [{ slot, protocolId, tier }]
protocolSlotCap
protocolAuthority: [{ protocolId, availableTier }]
missionProtocolLoan: null | { protocolId, tier }
relicIds
relicSlotCap
reinforcementId: null | id
specializationAccessIds
```

Arrays are unique and ASCII sorted unless slot order affects controls, in which case the record contains explicit `slot` and sorts by slot. Campaign progression is consulted only to construct and authenticate this header. The running kernel never reads the mutable profile.

Permanent Protocol authority is distinct from equipment: every equipped tier must be no greater than its matching `availableTier`. Mission loans never enter permanent authority, must be Tier 1, and remain a separate nullable header record.

`activatePower` remains the stable command verb, while every Protocol identity field uses the unambiguous name `protocolId` across commands, profiles, replay headers, runtime ledgers, and presentation models.

Recon, presentation settings, key bindings, Reduced Motion, share-card selections, timestamps, and provider/social data remain noncanonical.

### 13.5 Canonical state and phase order

V2 state adds bounded Protocol cooldown/cast-count/effect/schedule records, Ward charges, per-wave income exclusions, specialization IDs, Relic-resolved modifiers, reinforcement runtime state/cooldown, and mechanism cooldown/use state. Every collection is bounded by compiled proof and closed schema.

Within a combat tick, new work resolves in this order:

1. command bucket and accepted Aether payments;
2. expiry/enable transitions due at the boundary;
3. scheduled Protocol/mechanism resolutions and spawns;
4. existing spawn/movement/control/contact phases;
5. tower and reinforcement acquisition/attacks;
6. persistent zone pulses and terminal damage ordering;
7. leak arbitration with Aegis Ward;
8. bounty, Protocol/specialization income attribution, objectives, and score facts;
9. cooldown/effect timer decrement;
10. guarded boss/wave/mission transition and canonical event finalization.

The implementation annex must lock exact same-tick ordering against the existing ABI rather than maintain two reducers. If the existing phase authority requires a different placement to preserve a safety invariant, the annex records the sole reviewed order and updates this section before promotion beyond Candidate-BAL.

### 13.6 Profile-v2 transactions

Profile v2 stores mission results, earned Laurel identities, current Laurel allocations, Protocol grants/tiers, loadouts, Relics/slots, reinforcement grants/loadout, specialization mastery/grants, Recon tier, cosmetic grants, migration journal, and content identities. Victory writes result/replay reference, Laurels, mastery, rewards, and first-clear grants in one atomic IndexedDB transaction. Quota failure retains a session result and never writes half an unlock.

Migration from profile v1 is monotonic, resumable, and idempotent. It grants only rewards proven by existing completed missions and never invents mastery from an old result that lacks the required branch evidence.

## 14. Presentation and generated-art contract

Production presentation requires, at minimum:

- ten square Protocol icons at 1×/2× with a shared bronze-and-cyan Armara frame;
- Temporal clock-field, Skyfire cloud/bolt, Aegis shield, Poseidon wave, Athena command lattice, Hephaestus overclock/vent, Hermes rewind trail, Medusa petrify, Hades bargain zone, and Armara hourglass-Ascension effect sheets;
- a readable selected/ready/cooldown/insufficient-Aether treatment that does not recolor the effect art into ambiguity;
- thirty visually distinct Level-3 tower variants, each retaining the family silhouette while changing weapon/emitter/motion layers;
- three animated reinforcement unit sheets with idle, deploy, attack/contact, hit, and dismiss/expiry actions;
- five illustrated map mechanisms with idle, armed/telegraph, resolve, cooldown, and unavailable states;
- eight Relic icons, three Recon icons, branch emblems, mastery emblems, Codex plates, and loadout/menu panels;
- reduced-motion fallbacks and semantic DOM companions for every essential state.

AI-generated raster work follows the reviewed Armara reference images: bright readable units, clean cartoon-mechanical forms, ancient Greek materials and motifs, cyan/gold/violet energy, restrained surface texture, transparent background where required, no text, no generic asphalt, no unrelated logo, and no tiny baked-in UI. The canonical Armara hourglass remains the logo source; generated art may frame it but may not redesign it.

Generated raster output is reference/source material until it passes alpha, atlas-bleed, scale, contrast, silhouette, frame-order, and in-game composite review. Simulation timing never derives from frame count. Presentation catalog v2 pins every production asset byte/hash and explicit rectangle.

## 15. Balance, safety, and acceptance

### 15.1 Automated balance gates

For every mission/difficulty fixture introduced with these systems, automated evidence must include:

- victory with no Protocol/Relic/reinforcement/mechanism on Story and Strategos;
- each Protocol tier accepted, rejected for every stable reason, cooled down, repeated with exact 25% escalation, paused, carried across planning, replayed, and hash-compared;
- matched-budget witnesses in which casting is useful and negative controls in which saving the same Aether for construction is better;
- both specializations of every defense producing their declared role while retaining the family weakness;
- each Relic's benefit and drawback changing the intended exact integer values;
- reinforcement expiry, wave cleanup, cooldown, marker eligibility, and entity ceilings;
- mechanism telegraph, target geometry, cooldown/once rule, no rerouting, and boss/air handling;
- no double bounty, score laundering, free cast, stale target, cooldown rescale, Resolve bypass, duplicate source, unbounded event, or profile-dependent replay.

Candidate tuning may adjust only values explicitly marked Candidate-BAL in the implementation annex. The IDs, player promise, 10-Protocol roster, three-tier structure, two Protocol slots, two Relic slots, 15×2 specialization structure, 70% sell rule, explicit drawbacks, offline completion, and social non-gating require Ryan approval to change.

### 15.2 Usability gates

At desktop and required mobile viewports, a fresh player can answer without opening developer tools:

- how much Aether they have;
- what each action currently costs;
- why an action is unavailable;
- what will be targeted;
- what Tier/branch/Relic changes and sacrifices;
- how long an active effect/cooldown remains;
- which unlock happens next.

No ordinary player view shows hidden-grid coordinates, pad quality labels, strategy ranks, tick numbers, integrity formulas, source/runtime IDs, mission-setup JSON, or replay hashes. Those remain developer/Codex diagnostics behind an explicit debug flag.

### 15.3 Release gates

Implementation proceeds behind the candidate preview/release descriptor. A phase is not “implemented” because a button renders: it requires authoritative content, reducer behavior, replay round trip, semantic companion state, responsive UI, and tests. Before any public route change:

1. every game folder's bare `node --test` suite is green;
2. syntax checks and deterministic compiler reruns pass;
3. `games/.nojekyll` exists;
4. the served `_kit/shell.js` returns HTTP 200;
5. a live CDP shot boots Aegis and exercises a Protocol, specialization, Relic, reinforcement, and mechanism without console errors;
6. desktop/mobile/reduced-motion visual evidence is reviewed;
7. Ryan separately approves the public route switch and push.

## 16. Delivery slices

The systems ship to the candidate preview through independently green checkpoints:

1. versioned v2 command/replay/state foundation and source/compiled-content-v4 scaffolding;
2. Temporal Edict plus one Protocol slot and complete HUD/loadout interaction;
3. remaining ordinary Protocols, then Ascension;
4. specialization framework and all thirty branch records/behaviors;
5. Relics and profile allocation/migration;
6. reinforcements and authored markers;
7. mechanisms and mission hooks;
8. Recon/mastery/Codex/result-card integration;
9. production presentation assets, animation, audio/feedback, and accessibility fallbacks;
10. twenty-mission integration, balance witnesses, replay corpus, live preview QA, and release review.

Each slice retains historical replay fixtures and the current candidate vertical slice. No slice is allowed to make the public proving-ground route less reliable while the campaign is still behind its development descriptor.

## 17. Implementation rulings annex (2026-08-29, foundation re-audit)

These rulings resolve ambiguities found by adversarial review. Each is the recommended default and was adopted so implementation could continue; Ryan may overturn any of them, and a reversal is a content/annex change, not an architecture change.

| # | Ruling | Rationale |
|---|---|---|
| R1 | Relic multipliers on one named stat sum as basis-point deltas from `10000` (Forge Ember + Titan Gear build = `11600` bp, upgrade/specialization = `9600` bp), then clamp once, then round once. | Literal reading of §8.2 "sum by named stat … clamp before one rounding operation". |
| R2 | Titan Gear folds into the Protocol cast formula as one ceiling: `ceil(base × (10000 + 2500 × prior) × relicBp / 10^8)`. Cards display the folded value. | §8.2 forbids a second rounding stage; two ceilings differ from one in 9 of 40 sampled cases. |
| R3 | `add-bp` Relic stats (`tower-range`, `tower-rate`) resolve as `floor(base × (10000 + bp) / 10000)` with the declared policy rounding, never raw integer addition. | Basis points are dimensionless; raw addition was a defect. |
| R4 | Additive starting Aether that would resolve below zero clamps to `0`; it never throws and never blocks run creation. | Broken Aegis on a low difficulty envelope must remain a legal loadout. |
| R5 | Bounty multiplier stat has authored bounds `5000–15000` bp. | Every other stat has a clamp; an unbounded `×0` bounty would be authorable. |
| R6 | Tutorial loans are exactly Tier 1 everywhere (profile, header, presentation). | §4 and §13.4. |
| R7 | Key bindings are one printable ASCII letter/digit, compared case-insensitively; chords, `Escape`, `Tab`, `Enter`, `Space`, and function keys are rejected. `Escape` remains the fixed cancel key. | §12.2 "never collide with browser-reserved shortcuts". |
| R8 | A mission features at most one player mechanism; its control uses the single mechanism binding. | §10 "the mission mechanism"; two runtimes on one key would collide. |
| R9 | Zeus Skyfire is treated as immediate global damage for selection: acceptance requires a nonempty eligible list even though strikes resolve later. Temporal Edict, Armara Ascension, and Aegis Ward remain the only empty-selection Protocols. | §5.2 prevents paying Aether against an empty battlefield. |
| R10 | Specialization cards resolve their displayed cost through the run's `specialization-cost` Relic multiplier exactly as the reducer charges it. | §15.2 "what each action currently costs". |
| R11 | Verified-victory records carry a `runAuthorization` derived from the authenticated replay-v2 header (`formatVersion 2`, `rulesetHash`, `profileContentIdentity`, `missionId`, `difficultyId`, `loadoutIds`, `specializationAccessIds`). Evidence is authorized only by that record; the pre-application profile only bounds it (every authorized defense/branch must already be granted, and the loadout must fit the slot cap). The campaign is linear: `m01` has no prerequisite and `mNN` requires `m(N-1)` completed. | §11.2 "a replay/profile validator, not mutable presentation state, supplies the qualifying result". |
| R12 | `resolveRunSnapshot` never exposes the generic applied-grant ledger; Recon grants cannot reach a run header, ruleset hash, or record key. | §11.1. |
| R13 | One kernel, one reducer. The kernel binds an ABI version from the authenticated content schema (`schemaVersion 3 → ABI v1 phase order`, `schemaVersion 4 → ABI v2 phase order`). Historical v1/v3 releases keep their exact phase order and outcomes; v2 phases run only under a v4 binding. | ADR-009 and §13.5. |
| R14 | Content-v4 mission sources reuse the v3 mission/map record formats and add `protocolLoan`, `mechanism` (one authored activation record set), and `reinforcementMarkers`. The v4 compiler is the v3 compiler plus the unlock collections and their cross-references. | §13.2; avoids a second map grammar. |
| R15 | `mastered` flips only at a verified Strategos-or-higher victory that leaves both branches represented; a Story victory that adds the second branch does not master the family until the next Strategos-or-higher victory fielding it. Stored `completedMissionIds` must be a prefix of the linear campaign; reconciliation fails closed rather than inventing intermediate completions. Victory/first-clear plans report every reconciliation repair. | §11.2 literal reading; §13.6 "never invents". |
