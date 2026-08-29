# Armara Aegis — campaign authoring reference

**Status:** Derived reference, not an authority. Every value here is transcribed from the binding specifications; where this file and a specification disagree, the specification wins and this file is the defect.

**Sources:** `docs/superpowers/specs/2026-08-26-armara-aegis-campaign-expansion.md` (§6 structure, §6.6 grid, §6.7 Mission 1, §7 Laurels/difficulty/score, §8–9 roster and costs, §10 enemies, §11 waves) and `docs/superpowers/specs/2026-08-29-armara-aegis-divine-protocols-and-unlocks.md` (§4 cadence, §8.1 Relics, §9 reinforcements, §10 mechanisms, §11 Recon, §17 rulings). Grant identities are checked in at `games/aegis/content-v4/progression/binding-v1.json` and are the machine authority for rewards.

**Purpose:** one page a mission-authoring agent can hold while writing `content-v4/missions/mNN.*.json` and `content-v4/maps/mNN.*.json`, so nobody re-derives the campaign from two 900-line documents.

## 1. Mission table with the unlock overlay

Waves: regular missions 6, act bosses (`m05`, `m10`, `m15`) 8, finale (`m20`) 12. "Loan" is the mission-local Tier-1 Divine Protocol tutorial slot; "Mechanism" is the map-owned control first featured there (ruling R8: at most one mechanism per mission). Rewards are first-clear only and are granted by the progression binding, not by the mission record.

| ID | Mission | Battlefield / route | New pressure | Loan | Mechanism | First-clear grants |
|---|---|---|---|---|---|---|
| `m01` | Gate of Dawn | Sunrise limestone gate, broad S road (§6.7 binding geometry) | Staged Aether/pad/build tutorial; Upgrade reveals after Wave 1 | — | — | Hoplite Node |
| `m02` | Agora Circuit | Colonnaded agora, Greek-key route, two chokepoints | Armored Guardian screens, target priority | — | — | Oracle Relay |
| `m03` | Olive Cipher | Olive grove, marble serpentine | Echo cloak; attacks expose briefly, Oracle reveals | — | — | Artemis Rail |
| `m04` | Piraeus Switchyard | Harbor causeways, two entrances that merge | Route-labelled simultaneous timing | — | — | Reserve Capacitor I (+10 start Aether) |
| `m05` | Bronze Warden | Bronze foundry terrace, clockwise spiral | **Boss:** Talos Prototype, threshold Scout pods | `temporal-edict` | `bronze-city-gate` | Defense slot 5, Protocol slot 1, Temporal Edict |
| `m06` | Delos Airspace | Island temple, parallel ground route + air corridor | Harpy Drone (air) | — | — | Hermes Wing, Recon I, Relic slot 1, Bronze Obol |
| `m07` | Naxos Labyrinth | Mosaic labyrinth, figure-eight overpass | Crossings are presentation layers only | — | `harbor-chain` | Poseidon Coil, Owl Lens |
| `m08` | Poseidon's Clock | Tide temple, short low + long high routes | Tide selects the next wave's authored route | `zeus-skyfire` | — | Medusa Lens, Zeus Skyfire |
| `m09` | Rhodes Ring | Colossus plaza, circular road | Rotating solar-shield sectors | — | — | Blueprint Reset, Reinforcement slot 1, Spartan Phalanx, Broken Aegis |
| `m10` | Cyclops Kernel | Cyclopean crater, three spokes that merge | **Boss:** Cyclops Kernel, telegraphed EMP sectors | `aegis-ward` | — | Defense slot 6, Protocol slot 2, Aegis Ward |
| `m11` | Thermopylae Firewall | Canyon walls, sawtooth route, only six pads | Myrmidon regeneration | `poseidon-surge` | `sacred-braziers` | Hephaestus Forge, Poseidon's Surge, Forge Ember |
| `m12` | Delphi Duplex | Oracle terraces, two crossing non-merging routes | Splitters, simultaneous route pressure | — | — | Athena Nexus |
| `m13` | Forge Perimeter | Volcanic workshop, outer loop + scripted shortcuts | Declared shortcut wave groups | `athena-command` | — | Apollo Prism, Athena's Command, Tideglass |
| `m14` | Acropolis Mesh | Moonlit acropolis, mirrored arcs that merge | Shield Bearers, visible shield regeneration | — | `athena-statue-beam` | Recon II, Artemis Scout |
| `m15` | Oracle's Black Box | Subterranean double spiral | **Boss:** Oracle Core, rotating ≤30% resistances | `hephaestus-overclock` | — | Reserve Capacitor II, Hephaestus Overclock, Relic slot 2, Laurel of Ares |
| `m16` | Styx Packet Loss | Obsidian underworld, two sections joined by portals | Wraith teleport/revival | `hermes-rewind` | — | Hades Gate, Hermes Rewind |
| `m17` | Trident Convergence | Storm coast, three parallel prongs | Armor, speed, and air lane compositions | `medusa-lock` | `bridgefall` | Talos Bastion, Medusa Lock, Hermes' Greaves |
| `m18` | Titan Assembly | Titan workshop, loop past three assembly nodes | Power Couriers strengthen Titan Prime | `hades-bargain` | — | Zeus Array, Hades' Bargain, Recon III, Talos Automaton |
| `m19` | Olympus Uplink | Storm-lit mountain switchbacks | Telegraphed divine lightning | — | — | Titan Gear |
| `m20` | Eternal Singularity | Cosmic Olympus, Ω-shaped twin entrances | **Boss:** Chronarch Titan at 75/50/25% | `armara-ascension` | — | Endless Ascension, Armara Ascension |

Amendment notes that override the older campaign text: the `m19` "Olympian Overcharge" reward is replaced by the Titan Gear Relic, and the single ultimate is `armara-ascension` at `m20` (unlock spec §1.3). The `m14` "Oracle Forecast" reward is replaced by Recon II (unlock spec §11.1).

From `m10` onward a mission must either author at least one visible reinforcement marker or warn before Start that the equipped unit cannot deploy there (unlock spec §9). Markers obey the same clearance rules as pads.

## 2. Hidden grid and pad grammar (ADR-001, §6.6)

- World `160 × 100`; hidden authoring grid `40 × 25` of 4-unit cells; cell `(c, r)` → world center `{x: 4c + 2, y: 4r + 2}`.
- Route control nodes snap to cell centers and compile to continuous fixed-point polylines; entry/exit nodes may sit outside the board. No Manhattan stair-stepping; rings, arcs, spirals, and the Ω route must compile. The compiler rejects zero-length segments, undeclared self-overlap or crossing, and bends too tight for the road width.
- Road mask: 12 world units around the compiled centerline. Rendering may dress the road (ashlar, marble, packed earth, mosaic, bridge stone, bronze channel) but never changes the compiled centerline or collision width.
- Pad clearance: ≥16 units from a lane center, ≥20 from another pad, ≥8 inside the board, ≥20 from a gate, breach, large prop, or declared exclusion mask. Exceptions need a named annex waiver.
- Ten authored pads per mission is the norm; deliberate scarcity (`m11` has six) is declared in the briefing and must pass balance simulation with the starter trio.
- Every pad carries an intent tag: `early`, `bend`, `double-pass`, `mid`, `late`, `air`, `support`, `line`, `guard`, `mine`. Mission 1 contains no far-away or specialist-only pad.

Exposure bands at the range-22 probe, where `Q22 = E(p, r, 22) / 30.2`:

| Q band | Classification |
|---:|---|
| `< 0.60` | Invalid ordinary pad |
| `0.60–<0.85` | Specialist (needs visible authored purpose) |
| `0.85–<1.25` | Standard |
| `1.25–<1.70` | Strong |
| `1.70–2.00` | Power |
| `> 2.00` | Rejected unless the annex records a reviewed exception |

Every ordinary pad has `E20 >= 18`. Across Act I at least 60% of pads are Standard and at most 20% are Strong or Power. These are geometry diagnostics; role probes and wave fixtures remain authoritative. `tools/analyze-aegis-map.js` must pass for every production map. Pad classifications, Q values, grid coordinates, and heatmaps are debug-only and never shown in ordinary play (unlock spec §15.2).

Mission 1's binding geometry is fixed and must not drift: route `(-2,5) → (11,5) → (11,18) → (28,18) → (28,9) → (41,9)` in grid cells (260 world units), ten pads at world `(14,38) (62,34) (30,58) (66,58) (62,90) (82,90) (102,90) (98,54) (126,22) (146,54)` with `p04`/`p08` the two Strong double-pass pockets, all `E20 >= 24`, Standard pads measuring `29.539–30.199`, pockets `48.530`, max/min ratio `1.643` (report `1.65`; anything above fails).

## 3. Difficulty, economy, and score

| Mode | Availability | Start Aether | Integrity | Enemy HP | Speed | Bounty | Score |
|---|---|---:|---:|---:|---:|---:|---:|
| Story | Always | 119% | 25 | 85% | 95% | 110% | 75% |
| Strategos | Always (default) | 100% | 20 | 100% | 100% | 100% | 100% |
| Titan | After clearing an act | 91% | 15 | 125% | 108% | 100% | 150% |

```text
startAether = floor(baseStartAether × difficultyAetherBp / 10000)
            + campaignModifierAether + assistAether      (Relic additive resolves before the modifiers)
enemyHp     = max(1, ceil(base × hpBp / 10000))
speed       = max(1, floor(baseSpeedUnits × difficultySpeedBp × assistSpeedBp / 100000000))
bountyNumerator = bountyRemainder + baseLineageBounty × difficultyBountyBp
bountyAward     = floor(bountyNumerator / 10000)
bountyRemainder = bountyNumerator % 10000
```

`bountyRemainder` starts at zero, carries across waves, updates only on earned original-lineage bounty events in stable terminal order, is authoritative simulation state, and is discarded after the run. Fixed deployment and clear grants never enter the remainder and never scale with bounty basis points. Assist is `+20` Aether and `assistSpeedBp = 9200`.

Score: `eligibleUnspentAether = max(0, finalBank − campaignModifierAether − assistAether − protocolAetherEarned − specializationAetherEarned)`; `unspentScore = min(rawUnspentScore, floor(nonAetherScore / 19))`; `finalScore = nonAetherScore + unspentScore`, so unspent Aether is at most 5% of the total. Hades' Bargain and Soul Tithe income are subtracted so a Protocol cannot manufacture efficiency score.

Wave economy proof (§11): each mission declares an integer `baseStartAether` and each wave one inclusive `baseAetherEnvelope`; the compiler proves wave-start deployment grant + original-lineage kill bounties + authored clear grant equals that envelope exactly on Strategos. A Splitter's descendants divide their lineage's bounty; a revived Wraith, repeated boss phase, summoned child, or secondary death cannot pay a lineage twice. A final wave's post-clear grant is always zero. Mission 1's envelopes are `30 / 40 / 45 / 50 / 55 / 60` (280 earned, 430 gross, Wave 6 pays its whole 60 as a deployment grant with zero kill/clear Aether).

Laurels (three per mission per difficulty): Victory, Integrity (mission threshold), Mastery (one authored tactical objective shown before Start, testing the introduced idea, never ownership of a defense). Laurels never gate the next mission; they fund Protocol tiers (6 for Tier 2, 12 more for Tier 3; 180 total maximizes all ten Protocols).

## 4. Defense roster (costs L1/L2/L3, role, deliberate weakness)

Level 3 is a branch: each family has a default and an alternate specialization at the same L3 cost (unlock spec §7.2). The alternate unlocks after a verified victory fielding that family at Level 2+.

| Defense | Unlock | L1/L2/L3 | Role | Deliberate weakness |
|---|---|---:|---|---|
| Sentinel | Starter | 60/55/95 | Fast focused universal fire | Armor and crowds |
| Chronos | Starter | 75/70/115 | Persistent soft slow, lane control | Low damage; Resolve/boss scaling |
| Siege | Starter | 90/85/140 | Heavy circular splash | Slow cadence; no air |
| Hoplite Node | `m01` | 80/75/120 | Hard-light guard slots halt threats | Short blocks, weak damage, air immune |
| Oracle Relay | `m02` | 70/70/110 | Reveal cloak, mark for damage | No meaningful solo damage |
| Artemis Rail | `m03` | 110/100/155 | Extreme-range armor-piercing precision | Expensive; weak to swarms |
| Hermes Wing | `m06` | 85/80/130 | Mobile interceptors, air priority | Light hits struggle with armor |
| Poseidon Coil | `m07` | 100/95/150 | Line damage, drench, bounded knockback | Heavy/boss displacement resistance |
| Medusa Lens | `m08` | 95/90/145 | Periodic charged petrify | Cadence-dependent; Resolve/bosses |
| Hephaestus Forge | `m11` | 110/105/165 | Deterministic mines, burn, anti-regen | Setup time; poor air coverage |
| Athena Nexus | `m12` | 90/95/155 | Capped range/rate/coordinated-fire support | Occupies a pad; cannot carry alone |
| Apollo Prism | `m13` | 120/110/175 | Ramping beam, shield stripping | Loses ramp on target change |
| Hades Gate | `m16` | 120/110/175 | Executes wounded non-bosses, blocks revival | Expensive; weak on healthy targets |
| Talos Bastion | `m17` | 130/120/190 | Armor break, boss specialization | Very slow; poor vs light groups/air |
| Zeus Array | `m18` | 125/115/185 | Chain lightning for dense formations | Expensive; inefficient on isolated targets |

Golden cumulative sell refunds (`floor(invested × 70 / 100)`, from actual paid investment) at L1/L2/L3: Sentinel 42/80/147, Chronos 52/101/182, Siege 63/122/220, Hoplite 56/108/192, Oracle 49/98/175, Artemis 77/147/255, Hermes 59/115/206, Poseidon 70/136/241, Medusa 66/129/231, Hephaestus 77/150/266, Athena 63/129/238, Apollo 84/161/283, Hades 84/161/283, Talos 91/175/308, Zeus 87/168/297. Relic-discounted or surcharged purchases refund from what was actually paid, so these goldens hold only with no cost-modifying Relic equipped.

Loadout slots: 4 initially, 5 after `m05`, 6 after `m10`. A loadout holds one defense through the cap with no duplicates; multiple copies may still be built on pads.

## 5. Enemy and boss roster

| Enemy | First seen | Readable behavior |
|---|---|---|
| Scout | `m01` | Fast, fragile, one integrity leak |
| Raider | `m01` | Baseline body and timing |
| Guardian | `m02` | Heavy visible armor, two integrity leak |
| Echo | `m03` | Cloaked; damage exposes briefly, reveal removes cloak in range |
| Titan | `m05` preview | Slow heavy unit, large leak |
| Harpy Drone | `m06` | Flies a separate air route; ignores ground-only effects |
| Shield Bearer | `m09` preview | Visible personal/nearby shield with its own bar |
| Myrmidon | `m11` | Regenerates after a displayed no-damage delay |
| Splitter | `m12` | Spawns exactly two ordered children on death |
| Wraith | `m16` | Revives once after a fixed delay at the same route distance |
| Power Courier | `m18` | Objective; surviving at an assembly node buffs Titan Prime |

| Boss | Mission | Deterministic script |
|---|---|---|
| Talos Prototype | `m05` | Scout pods at fixed HP thresholds; telegraphed exposed-core windows |
| Cyclops Kernel | `m10` | EMP on a fixed warned sector sequence; disabled towers stay inspectable/sellable |
| Oracle Core | `m15` | Rotates visible projectile/temporal/blast resistance at thresholds, capped at 30% |
| Titan Prime | `m18` | Starts with exactly the buffs Couriers earned |
| Chronarch Titan | `m20` | Shield, summon, and fixed teleport phases at 75/50/25% |

Blanket or hidden immunity is forbidden; every boss declares block, slow, petrify, stun, knockback, execute, shield strip, phase transition, leak, bounty, and status behavior. A harmless preview of each signature mechanic appears before the boss wave. Default `bossControlBp = 2000`; regular enemies default `enemySlowControlBp = 10000`, `enemyMinMovementBp = 5200`. Execute never applies to bosses; resistance never exceeds 35%.

## 6. Wave authoring contract

A wave is an ordered list of spawn groups; global roster shuffling is forbidden. Random order is allowed only inside a group explicitly marked interchangeable, using its named RNG stream.

```js
{ id, enemyId, routeId, count, firstTick, intervalTicks, shuffleWithinGroup, modifierIds }
```

Regular mission pacing: familiar opener → safe preview of the new mechanic → mixed application → route or economy choice → pressure check → elite finale. Boss missions add a seventh mixed escalation and an eighth boss wave. Mission 20 uses twelve authored beats and never pads with repeated high-HP copies.

Each mission declares one `headlineMechanicId`, every newly lethal component, and an earlier `previewGroupId`/tutorial reference; the validator rejects a novel lethal mechanic appearing before its harmless preview. Across routes of different length, target priority compares least remaining distance to that enemy's destination, then declared threat priority, then runtime ID.

## 7. Per-mission authoring checklist

1. Mission record: id, titleKey, actIndex, missionIndex, seedNamespace, mapId, `prerequisiteMissionIds` (the linear predecessor), headlineMechanicId, briefing keys, enemy/boss rosters, `availableDefenseIds`, `baseStartAether`, waves, objectives, `protocolLoan`, `mechanism`, `reinforcementMarkers`.
2. Map record: board, road width, lane segments on the hidden grid, routes, joins, crossings, ten pads with intent and claimed routes, mechanism geometry, reinforcement markers, anchors.
3. Run `tools/analyze-aegis-map.js`: grid legality, clearance, Q bands, role probes, reachable gates, intent tags.
4. Prove the wave economy envelope on Strategos, then confirm the Story/Titan ledgers resolve.
5. Deterministic clear and defeat fixtures; a no-unlock Story and Strategos victory (no Protocol, Relic, reinforcement, or mechanism used); the mastery objective; replay fixture with checkpoint and final hashes.
6. Semantic review: route labels, briefing copy, accessibility, and no developer data (ticks, hashes, grid cells, pad quality, runtime IDs) in ordinary play.
7. Roads follow map and environment geometry and read narrower than the legacy proving-ground road through edge treatment only — the compiled collision width stays 12 units and no road art is created or edited here (Codex owns art; use semantic treatments and placeholders).
