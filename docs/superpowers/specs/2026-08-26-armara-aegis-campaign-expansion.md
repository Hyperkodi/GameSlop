# Armara Aegis — Campaign Expansion Specification

**Date:** 2026-08-26
**Status:** Binding product/system specification; numeric balance and per-mission data become binding through reviewed content annexes before production art
**Owner:** Ryan / Armara
**Implementation plan:** `docs/superpowers/plans/2026-08-26-armara-aegis-campaign-expansion.md`

## 1. Authority and scope

This document expands Armara Aegis from one twelve-wave battlefield into a complete, replayable tower-defense campaign.

It supersedes the following parts of `2026-08-26-armara-aegis-design.md` wherever they conflict:

- The single-map, three-defense, four-enemy content ceiling.
- The statement that campaign progression, unlocks, rewards, multiple maps, and endless play are out of scope.
- The global `PATH`, `PADS`, `WAVES`, and twelve-wave assumptions.
- The live prototype's 160 starting Aether, original starter costs, duplicate bounty-plus-clear economy, and hidden 12%-per-wave enemy-HP escalation. Those values remain only as a legacy proving-ground compatibility fixture; no campaign compiler, mission annex, balance test, or UI fallback may inherit them.

It preserves `2026-08-26-armara-aegis-landscape-redesign.md` as the binding presentation and interaction foundation:

- Landscape `160 × 100` logical battlefields.
- Bright, cartoon-readable units over quieter terrain.
- Contextual build and tower-management panels that suspend combat while open.
- Visible Aether and exact costs.
- Three in-run tower levels.
- Selling for exact integer `floor(total invested Aether × 70 / 100)`.
- Smooth deterministic presentation, accessible controls, and the exact canonical Armara hourglass.

Where the earlier redesign says all three choices are visible, this expansion changes that to all equipped loadout choices: four initially, five after Mission 5, and six after Mission 10.

This specification covers the offline campaign, content and art pipelines, progression, difficulty, accessibility, local replays, victory/share cards, and the optional online social-proof boundary. It does not authorize a token economy, wallet integration, paid stat boosts, gambling, loot boxes, or a public leaderboard.

The named missions, rewards, defense identities/unlocks, three-level structure, fairness rules, UX, and technical contracts are binding now. Mission 1's route, pads, Strategos economy, upgrade reveal, and placement-quality gates are also binding in Sections 6.6–6.7. Section 9's costs are the binding round-zero campaign baseline; changing a cost, Mission 1 envelope, role, weakness, target mask, or level mechanic requires a specification amendment and Ryan's approval. Exact routes and pad coordinates for Missions 2–20, their starting economies, ordered wave groups, enemy/boss values, Laurel thresholds, and every still-unspecified effect parameter must be committed as a reviewed versioned content annex for an act before that act's mass art production or gameplay implementation proceeds.

## 2. Player promise

Armara Aegis should feel like a premium arcade tower-defense game that happens to run instantly on the web:

> Command a vivid army of Greek-machine defenses across twenty hand-authored battlefields, understand every decision at a glance, discover new tactical sidegrades at a steady pace, and finish a satisfying mission in one sitting.

Five pillars govern every implementation choice:

1. **Readable spectacle.** A player can identify a tower, enemy, attack, status, route, price, and threat without zooming or guessing.
2. **Tactical variety without power creep.** Fifteen defenses create different solutions; no late defense is a strictly better starter.
3. **Hand-authored pressure.** Routes, spawn groups, hazards, and boss phases are designed and telegraphed, not produced by opaque dynamic difficulty.
4. **Respectful progression.** Campaign play unlocks every mechanic. Social actions are optional early access or cosmetics, never required progression.
5. **Deterministic mastery.** The same seed, ruleset, loadout, campaign modifiers, and commands always produce the same result.

## 3. Product principles and non-goals

### 3.1 Required principles

- A returning player reaches `CONTINUE MISSION` in no more than two deliberate actions from the Aegis hub.
- Progress is committed before a victory card, share prompt, or community prompt appears.
- Every failure explains the cause and offers `RETRY`, `EDIT LOADOUT`, and one relevant optional hint.
- The starter trio can complete all twenty missions on Story and Strategos. Unlocks improve choice, not eligibility.
- No core campaign/progression interaction depends on an unexplained icon, color alone, hover, drag, sound, an online account, or a social account. Optional community verification may, by definition, require the named provider.
- Each mission has one headline new mechanic, shown in the briefing and previewed harmlessly before it becomes lethal. Previously taught supporting mechanics may then be combined with it.
- No hidden stat scaling, rubber-banding, forced grind, energy meter, streak loss, or expiring combat power.

### 3.2 Explicit non-goals for the campaign release

- Player-created mazes or dynamic pathfinding.
- Heroes, gacha, inventory consumables, equipment rarity, or permanent tower-stat grinding.
- PvP, clans, chat, or a public user-content gallery.
- Server-required campaign play.
- Automatic posting to X or Telegram.
- Treating a shared image or video as proof that a run was legitimate.

## 4. Experience architecture

The Aegis page contains these stateful screens without reloading the document:

1. **Aegis Hub:** Continue, Campaign, Training Courtyard, Codex, Replays, Challenges, Community, Settings.
2. **Campaign Map:** all twenty numbered mission nodes in four visible acts, with locked/current/completed state and best Laurels.
3. **Mission Briefing:** route thumbnail, entrances, gate, pad count, wave count, expected duration, enemy roster, new rule, objectives, reward, difficulty, and current loadout.
4. **Loadout Builder:** unlocked and previewable locked defenses, four to six slots, comparable stats, saved last valid loadout.
5. **Battle:** persistent Aether/integrity/wave HUD, landscape board, contextual pad store, tower inspector, target policy, speed, pause, and wave preview.
6. **Result:** victory or defeat explanation, earned progress, next action, replay, and share actions.
7. **Codex:** tower/enemy mechanics, unlock paths, upgrade previews, status rules, and discovered lore.
8. **Replay Viewer:** deterministic playback, speed, timeline markers, highlight plan, favorite/export/delete.

All twenty map nodes remain visible without horizontal scrolling at desktop/tablet widths. A node is a real button. Locked nodes state the exact prerequisite; social actions never appear as mission locks.

At `320×568` and `390×844`, acts stack vertically with deterministic act-then-mission focus order and no horizontal page scrolling. The current mission and next unlocked mission are exposed at the top without panning; the remaining nodes are reachable by ordinary vertical scroll. Locked text names the exact preceding mission.

## 5. Core mission loop

### 5.1 Before battle

1. Select or continue a mission.
2. Read the short briefing and wave/enemy preview.
3. Choose difficulty.
4. Equip a valid loadout; swapping is free and unlimited.
5. Start with the mission's Aether and campaign modifiers resolved into the replay header.

### 5.2 During battle

- Battle alternates between untimed planning and authored combat waves; waves never overlap in campaign v1.
- Select an empty fixed pad to open the store for only the equipped defenses.
- Select an occupied pad to inspect, upgrade, set target policy, or sell.
- Mission 1 hides and disables Upgrade only through the first wave. Clearing Wave 1 reveals it permanently for that run and future runs. No later wave, mission, account, or mastery tier locks an in-run L2 or L3 purchase; price, wave pressure, pad quality, and matchup create the timing decision.
- Opening a store, inspector, objective panel, or Overcharge targeting panel suspends simulation. Closing resumes unless the player manually paused.
- `1×` and `2×` runner speeds are available at all times. Speed is explicit in the HUD and changes only how quickly fixed ticks are presented in wall-clock time; commands are recorded at their simulation tick, and speed never changes combat math or simulation-time score.
- Each upcoming wave shows routes, enemy silhouettes/count bands, trait icons, and a boss warning. Exact hidden surprises are not used as difficulty.
- The default target policy is `FRONT`: least remaining distance to that enemy's gate, then threat priority, then immutable enemy ID.
- Damage towers may choose `FRONT`, `STRONG`, or `FAST`; support/spawn towers expose only policies that make sense for their behavior. `STRONG` compares current HP plus shield, then remaining distance and ID. `FAST` compares unmodified base speed, then remaining distance and ID. Status changes therefore cannot make a target-selection tie oscillate.

### 5.3 After battle

- A victory transaction stores the replay, best record, Laurels, unlocks, and next mission atomically before result/share UI.
- A worse replay never overwrites a better score, Laurel count, or fastest time.
- `NEXT MISSION` is primary. `SHARE VICTORY`, `X REPLAY HIGHLIGHT`, `REPLAY`, and `RETRY FOR LAURELS` are secondary and dismissible.
- Defeat states name the largest leak cause or pressure pattern and offer one specific, non-shaming hint after two failures.

## 6. Campaign structure

The campaign contains four acts of five missions. Regular missions have six waves, act bosses have eight waves, and the finale has twelve waves. Planning time is untimed. Target playtime is 3–5 minutes for Mission 1 and 5–9 minutes for regular missions; the measured p90 limits are defined in the acceptance gates.

Every mission has its own stable ID, seed namespace, battlefield, routes, pads, waves, objectives, rewards, and asset pack. Routes are fixed authored lanes. Spawn groups choose a route explicitly; enemies never inspect defenses and choose a supposedly weak route.

### 6.1 Act I — Attican Boot Sequence

| ID | Mission | Battlefield and route | New pressure | Waves | First-clear reward |
|---|---|---|---|---:|---|
| `m01` | Gate of Dawn | Sunrise limestone gate, broad S road on the binding hidden grid in Section 6.7 | Staged Aether, pad, compare/build, and first-wave tutorial; Upgrade reveals after Wave 1 and sell remains optional | 6 | Hoplite Node |
| `m02` | Agora Circuit | Colonnaded agora, Greek-key route and two chokepoints | Armored Guardian screens and target priority | 6 | Oracle Relay |
| `m03` | Olive Cipher | Olive grove and marble serpentine | Echo cloak; all attacks briefly expose, Oracle reveals continuously | 6 | Artemis Rail |
| `m04` | Piraeus Switchyard | Harbor causeways, two entrances that merge | Route-labelled simultaneous timing | 6 | Reserve Capacitor I: +10 campaign starting Aether |
| `m05` | Bronze Warden | Bronze foundry terrace, clockwise spiral | Talos Prototype boss with threshold Scout pods | 8 | Fifth loadout slot |

### 6.2 Act II — Shards of the Aegean

| ID | Mission | Battlefield and route | New pressure | Waves | First-clear reward |
|---|---|---|---|---:|---|
| `m06` | Delos Airspace | Island temple, parallel ground route and air corridor | Harpy Drone; Sentinel and Artemis can already hit air | 6 | Hermes Wing |
| `m07` | Naxos Labyrinth | Mosaic labyrinth, figure-eight overpass | Crossings are presentation layers; route IDs remain explicit | 6 | Poseidon Coil |
| `m08` | Poseidon's Clock | Tide temple, short low and long high routes | Tide selects the next wave's authored route; never moves a live enemy | 6 | Medusa Lens |
| `m09` | Rhodes Ring | Colossus plaza, circular road | Rotating solar-shield sectors on simulation ticks | 6 | Blueprint Reset before Wave 1 |
| `m10` | Cyclops Kernel | Cyclopean crater, three spokes that merge | Cyclops Kernel boss and telegraphed EMP sectors | 8 | Sixth loadout slot |

### 6.3 Act III — Oracle War

| ID | Mission | Battlefield and route | New pressure | Waves | First-clear reward |
|---|---|---|---|---:|---|
| `m11` | Thermopylae Firewall | Canyon walls, sawtooth route and only six pads | Myrmidon regeneration; raw starter damage remains viable | 6 | Hephaestus Forge |
| `m12` | Delphi Duplex | Oracle terraces, two crossing non-merging routes | Splitters and simultaneous route pressure | 6 | Athena Nexus, guaranteed even if earned early |
| `m13` | Forge Perimeter | Volcanic workshop, outer loop and scripted shortcuts | Shortcut wave groups are declared in the briefing | 6 | Apollo Prism |
| `m14` | Acropolis Mesh | Moonlit acropolis, mirrored arcs that merge | Shield Bearers and visible shield regeneration | 6 | Oracle Forecast: exact roster for the next two waves |
| `m15` | Oracle's Black Box | Subterranean double spiral | Oracle Core boss rotates visible 30% resistances; never immunity | 8 | Reserve Capacitor II: another +10 starting Aether |

### 6.4 Act IV — Titan Singularity

| ID | Mission | Battlefield and route | New pressure | Waves | First-clear reward |
|---|---|---|---|---:|---|
| `m16` | Styx Packet Loss | Obsidian underworld, two route sections joined by portals | Wraith teleport/revival | 6 | Hades Gate |
| `m17` | Trident Convergence | Storm coast, three parallel prongs | Dedicated armor, speed, and air lane compositions | 6 | Talos Bastion |
| `m18` | Titan Assembly | Titan workshop, loop past three assembly nodes | Power Couriers deterministically strengthen Titan Prime | 6 | Zeus Array |
| `m19` | Olympus Uplink | Storm-lit mountain switchbacks | Player-charged, telegraphed divine lightning | 6 | Olympian Overcharge for Mission 20 and replays |
| `m20` | Eternal Singularity | Cosmic Olympus, Ω-shaped twin entrances | Chronarch Titan at 75/50/25% phase thresholds | 12 | Endless Ascension and challenge variants |

### 6.5 Mission rules that must not drift

- `m09` Blueprint Reset is not a sale. The reward becomes available from `m10` onward and when replaying `m09`; it is not available during the first `m09` clear. Before Wave 1 only, `RESET PLAN` atomically removes every current tower, restores the exact resolved starting Aether, and clears simulation selection. It does not rewind tick, command sequence, input history, or next entity IDs. Once Wave 1 starts, every sell uses the universal 70% rule.
- Reserve Capacitors apply only to campaign missions and are included as a versioned `campaignModifierIds` array in the replay. Weekly/ranked challenges use their advertised fixed economy.
- Oracle Forecast adds exact counts one extra wave ahead. Route, hazard, resistance, boss, and next-wave telegraphs are baseline information and are never gated.
- `m19` loans a mission-local Olympus mast so the Overcharge mechanic can be taught and tested without prior ownership. Victory permanently unlocks Olympian Overcharge for `m20` and campaign replays. Damage fills a deterministic meter, the player selects a route point, and lightning resolves after a fixed telegraph. Its charge, targeting command, damage, and cooldown live entirely in simulation state. Replays with permanent Overcharge use a distinct resolved modifier hash and never replace incomparable earlier records. Mission 20 remains beatable without using it.
- Every mission normally has ten authored pads. Missions that deliberately use fewer declare that scarcity in the briefing and must pass balance simulations with the starter trio.
- An overpass does not change range or target masks unless the route data explicitly says so.

### 6.6 Hidden authoring grid and fixed-pad grammar

All campaign battlefields retain the `160 × 100` logical world but are authored on a hidden `40 × 25` grid of four-world-unit cells. The grid is a design and validation system, not a free-placement UI and not a visible modern tile treatment.

- Cell `(column, row)` converts to world center `{x: 4 × column + 2, y: 4 × row + 2}`. Authored route control nodes snap to those centers and compile into continuous fixed-point polyline segments; consecutive nodes may form cardinal, diagonal, or other straight lattice segments, while entry/exit nodes may sit outside the visible board. Enemies never move cell by cell. The compiler rejects zero-length segments, undeclared self-overlap/crossing, and bends too tight for the declared road width, but it must support the campaign's rings, arcs, spirals, and Ω route without Manhattan stair-step motion.
- Roads use a 12-world-unit buffered mask around the compiled centerline. Rendering rounds joins and dresses the route as Greek ashlar, marble, packed earth, mosaic, bridge stone, or bronze channel while preserving the exact compiled centerline and collision width.
- Construction remains fixed-pad only. An ordinary pad center is at least 16 world units from a lane center, at least 20 units from another pad, at least 8 units inside the board, and at least 20 units from a gate, breach, large prop, or declared exclusion mask. Any authored exception requires a named reason and validator waiver in the mission annex.
- Every pad carries an intent tag such as `early`, `bend`, `double-pass`, `mid`, `late`, `air`, `support`, `line`, `guard`, or `mine`. A later specialist pad is visibly described in the briefing/selection UI; Mission 1 contains no far-away or specialist-only pad.
- Selecting a tower or previewing a build shows its exact range circle and glows the road arc(s) it can affect. Numeric coverage heatmaps remain debug-only.

For pad `p`, route `r`, and range/role probe `k`, `E(p,r,k)` is the compiled route arc length that the defense can affect. The analyzer also reports merged coverage windows, re-entry count, route stage, estimated shot windows, and separate probes for ground routes, air routes, support links, line attacks, guard projection, and mine markers. At the ordinary range-22 probe, `B22 = 30.2` and `Q22 = E(p,r,22) / B22`.

| Q band | Authoring classification |
|---:|---|
| `< 0.60` | Invalid ordinary pad |
| `0.60–<0.85` | Specialist; allowed only with visible authored purpose |
| `0.85–<1.25` | Standard |
| `1.25–<1.70` | Strong |
| `1.70–2.00` | Power |
| `> 2.00` | Rejected unless the mission annex records a reviewed exception |

Every ordinary pad has `E20 >= 18`. Across Act I, at least 60% of pads are Standard and no more than 20% are Strong or Power. These bands are geometry diagnostics, not a promise that all towers receive equal combat value; role probes and deterministic wave fixtures remain authoritative.

`tools/analyze-aegis-map.js` must compile each map and emit machine-readable JSON plus an SVG/heatmap report. CI rejects a production campaign map with off-grid control nodes, zero-length/illegal route segments, undeclared overlap/crossing, illegal clearance/separation, unreachable gates, missing intent tags, failed Q-band policy, or a role-specific pad whose declared probe cannot perform its purpose. The non-production `legacy-proving-ground` fixture runs in report-only mode and must reproduce its known dead/dominant-pad findings; its waiver can never make it eligible for a campaign manifest.

### 6.7 Gate of Dawn binding geometry and economy

Mission 1 uses this 260-unit route:

```text
grid:  (-2,5) → (11,5) → (11,18) → (28,18) → (28,9) → (41,9)
world: (-6,22) → (46,22) → (46,74) → (114,74) → (114,38) → (166,38)
```

Its pads are ordered by route stage, not arbitrary screen position:

| Pad | World center | Intent | Range-22 classification |
|---|---:|---|---|
| `p01` | `(14,38)` | Early standard coverage | Standard |
| `p02` | `(62,34)` | Early standard coverage after the first turn | Standard |
| `p03` | `(30,58)` | First-bend standard coverage | Standard |
| `p04` | `(66,58)` | Deliberate double-pass power pocket | Strong |
| `p05` | `(62,90)` | Mid-route standard coverage | Standard |
| `p06` | `(82,90)` | Mid-route standard coverage | Standard |
| `p07` | `(102,90)` | Late-mid standard coverage | Standard |
| `p08` | `(98,54)` | Deliberate double-pass power pocket | Strong |
| `p09` | `(126,22)` | Late-route standard coverage | Standard |
| `p10` | `(146,54)` | Last-stand standard coverage | Standard |

All ten pads have `E20 >= 24`. At range 22, Standard pads measure `29.539–30.199` (player-facing/debug summary `29.5–30.2`) and `p04`/`p08` measure `48.530` (`48.5`). The exact Mission 1 range-22 max/min exposure ratio is `1.643` and may be reported as `1.65`; any compiled value above `1.65` fails. `p04` and `p08` are called power pockets as a player-facing intent, but remain Strong under the numeric Q bands; neither may become a universally best pad across all three starters and all six waves.

An unassisted, unmodified new-profile Mission 1 Strategos run starts at exactly 150 Aether. Its six inclusive perfect-kill Aether envelopes are `30 / 40 / 45 / 50 / 55 / 60`, for 280 earned and 430 gross. Each envelope includes its declared wave-start deployment grant, all original-lineage bounties, and any clear grant; those sources may not be budgeted a second time. Wave 6 credits its entire 60 as a declared deployment grant when the accepted Wave-6 start command resolves and before its first spawn; its kill-bounty and post-clear Aether are both zero. The full 430 is therefore available while a tactical decision remains. Story starts at 178 rather than 150; its earned wave totals differ from Strategos only through the resolved 110% bounty component, while fixed deployment/clear grants never scale. Titan starts at 136 and retains the 100% bounty component.

On a first non-skipped Mission 1 tutorial run, the replay header resolves `tutorialUpgradeGateMode = "m01-wave1"`; tutorial skip/replay choices resolve to the declared mode rather than being read from mutable profile storage during simulation. While active, an `upgrade` command before Wave 1 clears is rejected with stable reason `tutorial-gated`. A recorded `skipTutorialGate` command or the Wave-1 clear opens Upgrade permanently for that run. Replays with mode `none` expose Upgrade immediately, and no mode creates a later L2/L3 wave lock.

For the unassisted, unmodified new-profile Strategos ledger above, the intended final simultaneous owned state is four or five towers with roughly two paid upgrades, with 360–410 net Aether consumed. Here `net consumed = resolved start + realized earnings - final bank`; it is not lifetime purchase debits. At any state in that ledger, seven L1 Sentinels is the absolute cheapest-pad simultaneous maximum and filling all ten pads is mathematically impossible because eight cost 480, above the 430 gross ceiling; selling loses 30% and cannot raise that ceiling. Selling can nevertheless make lifetime purchase debits exceed 430 Aether and lifetime build events exceed seven; the report records gross purchase debits, sale refunds, net consumed, final invested Aether, final owned state, and final bank separately. Across representative successful fixtures for that same Strategos ledger, median ending bank is less than 65 Aether. Story, Assist, Reserve, and later campaign modifiers resolve against their own declared ledgers and do not inherit these absolute 430-ledger build/bank thresholds. The full bank distribution, including p90, is reported diagnostically rather than used as a binding threshold. Unspent Aether contributes at most 5% of final total score, so saving can break a close score tie but cannot outperform sound defense.

## 7. Laurels, objectives, difficulty, and scoring

### 7.1 Laurels

Each completed mission awards up to three permanent Laurels per difficulty:

1. **Victory Laurel:** complete the mission.
2. **Integrity Laurel:** finish at or above the displayed mission threshold.
3. **Mastery Laurel:** complete one mission-specific tactical objective shown before Start.

Mastery objectives test the introduced idea, not ownership of a particular defense. Examples include stopping all air units, preventing a full regeneration, intercepting a number of Couriers, or taking no leaks from either entrance. No objective changes after Start. Laurels unlock codex lore, challenge variants, profile frames, battlefield palettes, and cosmetic tower chassis; they never gate the next story mission.

### 7.2 Difficulty presets

All percentages are stored as integer basis points and all differences are shown before Start.

| Mode | Availability | Starting Aether | Integrity | Enemy HP | Enemy speed | Bounty | Score multiplier |
|---|---|---:|---:|---:|---:|---:|---:|
| Story | Always | 119% of mission base | 25 | 85% | 95% | 110% | 75% |
| Strategos | Always; default | 100% | 20 | 100% | 100% | 100% | 100% |
| Titan | After clearing an act | 91% | 15 | 125% | 108% | 100% | 150% |

Every mission has an explicit integer base economy. Difficulty and progression resolve in this binding order:

```text
startAether =
  floor(baseStartAether × difficultyAetherBp / 10000)
  + campaignModifierAether
  + assistAether
```

Enemy HP uses `ceil(base × bp / 10000)` with a minimum of 1. Score uses `floor(base × bp / 10000)` with its declared nonzero minimum. Compact bounty values use one mission-scoped deterministic basis-point remainder so Story's 110% modifier cannot become inert through per-kill flooring:

```text
bountyNumerator = bountyRemainder + baseLineageBounty × difficultyBountyBp
bountyAward = floor(bountyNumerator / 10000)
bountyRemainder = bountyNumerator % 10000
```

`bountyRemainder` initializes to zero at mission start, carries across waves, updates only on an earned original-lineage bounty event in stable terminal-event order, and is discarded after the run. It is authoritative simulation state included in checkpoints/final hashes and replay validation. The HUD shows each whole-Aether award when resolved; the wave preview may show the compiled perfect-kill total. Fixed deployment and clear grants never enter the remainder and never scale with bounty basis points.

Speed composes difficulty and Assist before its only rounding step:

```text
resolvedSpeed =
  max(1, floor(baseSpeedUnits × difficultySpeedBp × assistSpeedBp / 100000000))
```

`assistSpeedBp` is 10000 normally and 9200 when Assist is enabled. The compiler's safe-intermediate check applies to the combined numerator. No intermediate result is rounded twice. The exact resolved values and modifier IDs enter the record/replay key.

For Mission 1, the unmodified base starts resolve to Story `178`, Strategos `150`, and Titan `136`. Assist then produces `198 / 170 / 156`. Reserve Capacitors are added after the difficulty multiplication (`+10` or cumulative `+20`), then Assist adds `+20`; all applied modifier IDs enter the replay header and ruleset-derived record key.

Story awards all campaign unlocks and Laurels. It is not described as a lesser victory. Titan may append authored elite groups, but it cannot procedurally reorder a wave or apply invisible affixes.

After two failures, the game offers an explicit Assist toggle for that mission. Assist can add 20 starting Aether and slow enemies by 8%; it is recorded in the result/replay, retains campaign unlocks and Laurels, and is separated from competitive scores.

### 7.3 Score and records

Score rewards kills, wave clears, remaining integrity, bounded unspent-Aether efficiency, and objective completion. Define `eligibleUnspentAether = max(0, finalBank - campaignModifierAether - assistAether)` so Reserve/Assist can neither grant free efficiency points nor produce a negative component. `nonAetherScore` is the final nonnegative integer score from every other component after the difficulty multiplier, and the content-versioned Aether conversion produces nonnegative integer `rawUnspentScore`. Resolve `unspentScore = min(rawUnspentScore, floor(nonAetherScore / 19))`, then `finalScore = nonAetherScore + unspentScore`. This non-circular formula guarantees that unspent Aether contributes at most 5% of the final total score; when `nonAetherScore` is zero, the component is zero. It never rewards social actions or owned cosmetics. Exact conversion and score constants are content-versioned and visible in the Codex.

Records are keyed by mission, difficulty, ruleset hash, resolved simulation-modifier hash, and Assist state. The result screen separately presents best score, fastest clear, and highest Laurels so one metric cannot silently replace another.

## 8. Defense roster and loadouts

There are exactly fifteen player defense families. Sentinel, Chronos, and Siege are starters. The other twelve unlock at the campaign milestones below. Every defense has exactly three linear in-run levels and a materially different weakness.

| Defense | Unlock | Targets | Role | Deliberate weakness |
|---|---|---|---|---|
| Sentinel | Starter | Ground + air | Fast focused universal fire | Loses efficiency to armor and crowds |
| Chronos | Starter | Ground + air | Persistent soft slow and lane control | Low damage; Resolve and boss scaling prevent locks |
| Siege | Starter | Ground | Heavy circular splash | Slow cadence; cannot hit air |
| Hoplite Node | `m01` | Ground | Hard-light guard slots halt threats without rerouting | Short blocks, weak damage, air immune |
| Oracle Relay | `m02` | Ground + air support | Reveal cloak and mark targets for damage | No meaningful solo damage |
| Artemis Rail | `m03` | Ground + air | Extreme-range armor-piercing precision | Expensive and vulnerable to swarms |
| Hermes Wing | `m06` | Ground + air | Mobile interceptors with air priority | Light hits struggle with armor |
| Poseidon Coil | `m07` | Ground | Line damage, drench, bounded knockback | Heavy/boss displacement resistance |
| Medusa Lens | `m08` | Ground | Periodic charged petrify | Cadence-dependent; Resolve and bosses heavily limit it |
| Hephaestus Forge | `m11` | Ground | Deterministic mines, burn, anti-regeneration | Setup time and poor air coverage |
| Athena Nexus | `m12` or approved early access | Friendly towers | Capped spatial range/rate/coordinated-fire support | Occupies a pad, links only a few attackers, and cannot carry alone |
| Apollo Prism | `m13` | Ground + air | Ramping beam and shield stripping | Loses ramp when targets change |
| Hades Gate | `m16` | Ground + air | Executes wounded non-bosses and prevents revival | Expensive; little benefit on healthy targets |
| Talos Bastion | `m17` | Ground | Armor break and boss specialization | Very slow; poor against light groups/air |
| Zeus Array | `m18` | Ground + air | Chain lightning for dense formations | Expensive and inefficient on isolated targets |

### 8.1 Loadout rules

- The player begins with four slots, gains a fifth after `m05`, and a sixth after `m10`.
- A valid loadout contains from one defense through the current slot cap. Starter trio prefill the first run. The player may equip any unlocked mix; duplicates are not allowed in the loadout, but multiple copies may be built on pads.
- The contextual store displays every equipped defense simultaneously on desktop as a responsive grid and as an independently scrollable bottom sheet on mobile. At every required viewport the Aether balance and selected pad/tower context remain pinned, pad targets do not overlap the sheet, and each card's name, cost, affordability, and action are readable without horizontal scrolling.
- Locked defenses are still previewable in the Codex/Training Courtyard with exact campaign and optional community unlock paths.
- Training grants temporary trial access without altering campaign progress, rewards, or records.
- Mission recommendations name useful traits, such as `ANTI-AIR` or `SHIELD STRIP`, and never label one defense required.
- Shareable loadout codes contain stable IDs and content version only, never player identity.

## 9. Upgrade contract

In production content, every level is a complete immutable stat record, never a runtime delta. UI cards, damage per second, special copy, affordability, next-level comparisons, investment, and refunds derive from those records. The costs below are the binding round-zero campaign baseline, and the listed behaviors are the required identity targets. A reviewed content annex may declare a bounded tuning range for a non-cost combat number before balance work begins; it grants no generic ±15% discretion. Changing any cost, Mission 1 envelope, role, deliberate weakness, target mask, or level mechanic requires a specification amendment and Ryan's approval.

### 9.1 Universal rules

- Level 1 uses `buildCost`; Levels 2 and 3 use `upgradeCost`.
- `invested = buildCost + paid upgrade costs`; `sellRefund = floor(invested × 70 / 100)` using bounded integer multiplication/division. Floating-point `invested × 0.70` is forbidden because binary underflow can produce an incorrect whole-Aether refund.
- Level 2 strengthens the core role. Level 3 adds or completes the visible capstone.
- On an ordinary unused pad, L1 is normally the best raw output per Aether because it consumes another placement. L2 concentrates role value at a modest efficiency premium; L3 is chosen for pad scarcity, an exceptional coverage window, or its matchup capstone rather than as an automatic cheapest purchase.
- The Mission 1 first-wave teaching reveal is the only upgrade-availability gate. Once Upgrade is revealed, every unlocked defense may buy L2/L3 whenever its exact Aether cost can be paid.
- Upgrade visuals must change silhouette, energy treatment, and at least one moving layer at normal play scale.
- No out-of-run mastery increases combat stats. Mastery is codex/cosmetic progression only.
- Effects use integer ABI time/fixed-point units in simulation; seconds below are player-facing copy.

### 9.2 Level identities and starting costs

| Defense | Costs L1/L2/L3 | Level 1 | Level 2 | Level 3 capstone |
|---|---:|---|---|---|
| Sentinel | 60 / 55 / 95 | 8 damage, 450 ms, range 22 | 12 damage, 410 ms, range 24 | 18 damage, 360 ms, range 26; after three consecutive hits on one target, Lock-On adds 15% damage until target switch |
| Chronos | 75 / 70 / 115 | 2 damage, 900 ms; 32% slow for 1.2 s | 4 damage, 800 ms; 40% slow for 1.35 s | 6 damage, 720 ms; 48% slow for 1.5 s; every fifth attack echoes a weaker slow to at most two nearby enemies, never a hard stun |
| Siege | 90 / 85 / 140 | 22 damage, 1.50 s, range 24, radius 4.5 | 34 damage, 1.35 s, range 26, radius 5.5 | 52 damage, 1.20 s, range 28, radius 6.5; targets inside the central 2.5 units take 35% extra |
| Hoplite Node | 80 / 75 / 120 | One guard; 1.0 s block; 6.0 s replenish | Two guards; 1.1 s block; 5.5 s replenish | Three guards; 1.2 s block; 5.0 s replenish; first contact bashes for 12 and stuns for 0.25 s |
| Oracle Relay | 70 / 70 / 110 | Continuous reveal; one mark grants +8% damage; range 26 | Continuous reveal; two simultaneous +11% marks; range 29 | Continuous reveal and two +11% marks; every fifth scan marks at most five targets for 2.0 s; range 32 |
| Artemis Rail | 110 / 100 / 155 | 52 damage, 2.0 s, range 38, ignores armor | 80 damage, 1.9 s, range 42; pierces one aligned target for 50% | 118 damage, 1.8 s, range 46; every fourth primary shot deals 150%; the pierce never inherits the crit |
| Hermes Wing | 85 / 80 / 130 | One drone, 8 damage every 450 ms, air priority | Two independent drones, 7 damage each every 450 ms | Two drones, 8 damage each every 400 ms; every sixth drone attack fires one bonus shot |
| Poseidon Coil | 100 / 95 / 150 | 16 line damage every 1.25 s to at most three; 1.5 push; 10% drench for 2.0 s | 24 every 1.15 s to at most four; 2.0 push; 12% drench for 2.2 s | 30 every 1.05 s to at most five; 2.5 push; 15% drench for 2.5 s; every fifth attack is a 40-damage six-target maelstrom |
| Medusa Lens | 95 / 90 / 145 | 8 damage every 650 ms; every sixth tower shot petrifies its primary for 0.75 s | 12 every 600 ms; every fifth shot petrifies for 0.9 s | 16 every 550 ms; every fifth shot petrifies the primary for 1.0 s and secondary targets in radius 2.5 for only 0.35 s |
| Hephaestus Forge | 110 / 105 / 165 | At most one active mine; 30 blast plus 4/s for 3 s; 5.5 s replenish | At most two; 44 blast plus 5/s for 3.5 s; 5.0 s replenish | At most two; 60 blast plus 6/s for 4 s; 4.5 s replenish; leaves a 2.5 s anti-regeneration molten field |
| Athena Nexus | 90 / 95 / 155 | Links at most three eligible attackers and grants +10% range | Links at most four and grants +10% range/rate | Links at most four with +10% range/rate; Coordinated Fire adds +8% damage when two linked towers share a target; an Oracle mark may satisfy, but is not required for, that condition |
| Apollo Prism | 120 / 110 / 175 | 250 ms beam pulses ramp from 4 to 14 damage on one target; +50% shield damage | Pulses ramp from 4 to 16, reach peak 30% faster, and retain +50% shield damage | Pulses ramp from 4 to 18 with +50% shield damage; forks at 45% to any second target or 70% against a shielded second target |
| Hades Gate | 120 / 110 / 175 | 14 damage every 1.25 s; executes non-bosses below 10%; its kills cannot revive | 20 every 1.20 s; execute threshold 14%; its kills cannot revive | 28 every 1.10 s; threshold 18%; kills cannot revive; every third execute may banish one nearby wounded non-boss, with an 8 s cooldown |
| Talos Bastion | 130 / 120 / 190 | 68 damage every 2.3 s, range 24; ignores 50% armor and applies -2 armor for 2.5 s | 100 every 2.2 s, range 25; ignores 50% armor and applies -3 armor for 3 s | 145 every 2.0 s, range 26; ignores 50% armor, applies -4 armor for 3 s, and gains +30% explicit boss damage |
| Zeus Array | 125 / 115 / 185 | 18 damage every 1.0 s to three total targets at 100/70/50% | 24 every 950 ms to five at 100/75/55/40/30% | 30 every 900 ms with the same five-target falloff; every sixth attack adds at most three 30%-damage storm targets |

Golden cumulative sell refunds are binding:

| Defense | Refund at L1/L2/L3 |
|---|---:|
| Sentinel | 42 / 80 / 147 |
| Chronos | 52 / 101 / 182 |
| Siege | 63 / 122 / 220 |
| Hoplite Node | 56 / 108 / 192 |
| Oracle Relay | 49 / 98 / 175 |
| Artemis Rail | 77 / 147 / 255 |
| Hermes Wing | 59 / 115 / 206 |
| Poseidon Coil | 70 / 136 / 241 |
| Medusa Lens | 66 / 129 / 231 |
| Hephaestus Forge | 77 / 150 / 266 |
| Athena Nexus | 63 / 129 / 238 |
| Apollo Prism | 84 / 161 / 283 |
| Hades Gate | 84 / 161 / 283 |
| Talos Bastion | 91 / 175 / 308 |
| Zeus Array | 87 / 168 / 297 |

Before a defense's behavior implementation or production art begins, its reviewed content-annex record receives every remaining exact range, cadence, damage/effect value, duration, placement/queue rule, summon/chain cap, boss multiplier, comparator/tie rule, target policy, audio/visual event ID, and derived UI string at every level. In particular, the annex fixes Oracle scan cadence/selection, Hoplite legal interception markers/queue order, Hermes patrol radius/travel speed, Poseidon line comparator, Forge arming radius/marker choice, Athena link radius/selection/removal, Apollo ramp increment/reset gap, Hades banish comparator, and Zeus jump range/comparator. Hermes never patrols map-wide; Forge can never bank more than its active-mine cap; Apollo resets its ramp on target change or the declared no-target gap; Hades banish and Zeus storm hits cannot recurse or advance their own capstone counters. No renderer or HTML file may duplicate balance constants.

### 9.3 Control and status rules

- `reveal`, `mark`, `slow`, `drench`, `block`, `stun`, `petrify`, `resolve`, `burn`, `armorBreak`, `shield`, and `reviveSuppressed` are stable status IDs.
- Each status instance retains its own source, magnitude, application tick, and expiry. Resolution uses the strongest currently active complete instance; equal magnitude prefers later expiry, then lower immutable source ID. It never combines one source's magnitude with another source's duration. Different named statuses may coexist except that `slow` and the movement reduction from `drench` enter one strongest-only movement bucket; they are never added or multiplied together.
- The strongest movement reduction resolves in basis points before movement: `scaledReductionBp = floor(strongestReductionBp × enemySlowControlBp / 10000)` and `effectiveSpeedBp = max(enemyMinMovementBp, 10000 - scaledReductionBp)`. This multiplier applies to the enemy's already-resolved post-difficulty/Assist base speed, and control scaling occurs before the floor. Regular enemies default to `enemySlowControlBp = 10000` and `enemyMinMovementBp = 5200`. Every Heavy record declares both visible values; every boss declares `enemyMinMovementBp` and defaults `enemySlowControlBp` to its visible `bossControlBp = 2000` unless its record overrides it. With no active movement reduction, `effectiveSpeedBp = 10000`.
- Damage-over-time from the same source refreshes that complete instance rather than stacking. Different sources require an explicit small stack cap and stable source-ID processing order in the content annex.
- Shield pools remain separate source instances and damage consumes the pool with the earliest expiry, then lowest source ID. Aura removal removes only that source's contribution and recomputes the strongest remaining aura.
- Friendly auras never stack with the same aura; the strongest eligible source wins, then lowest tower ID breaks a tie.
- For external marks, coordinated-fire bonuses, auras, and equivalent support/debuff sources, same-name instances first resolve to one strongest eligible source using the status comparator. Distinct surviving bonuses then add in stable ASCII source-type order and clamp as `externalDamageBp = min(2000, sumDamageBp)`, `externalRateBp = min(1500, sumRateBp)`, and `externalRangeBp = min(1200, sumRangeBp)`. An attack's own Lock-On, crit, center-hit, pierce, chain/fork falloff, and boss coefficients are internal attack coefficients, not external amplification; execute is a terminal predicate. The engine preserves milli-damage precision and applies the combined external damage bonus only after all internal hit coefficients, so a base `8` attack with only `+8%` external damage resolves to `8640` milli-damage rather than rounding back to `8`. The attack's authored shield coefficient then applies before ordered shield-pool consumption; positive overflow continues in milli-damage through armor/ignore/break, native resistance, and HP. Any positive, non-immune post-mitigation HP hit deals at least one milli-damage. Unusual shield/overflow rules must be explicit content-annex behavior IDs rather than hidden tower branches.
- Effective external range is `floor(baseRangeUnits × (10000 + externalRangeBp) / 10000)` and targeting compares fixed-point squared distances against that squared integer range. Effective attack cooldown is `ceil(baseCooldownUnits × 10000 / (10000 + externalRateBp))` using the ABI's exact integer ceiling. A build starts ready, but an upgrade, link/unlink, enable/disable, or amplification-source change never rescales a cooldown already in progress; the next accepted attack schedules the then-current effective cooldown.
- Athena automatically links the nearest `3 / 4 / 4` eligible non-support damage towers within its aura by level. Its comparator uses fixed-point squared distance, then immutable tower ID; there is no manual link command. Links recompute only at mission initialization or after an accepted build, upgrade, sell/reset, disable, enable, or Athena source activation/removal changes eligibility; they never relink on an ordinary simulation tick or presentation frame. It cannot link itself or another support-only tower, and cannot directly accelerate guard replenishment, mine replenishment/arming, summon creation, capstone counters, or other non-attack production. Active links, eligible unlinked towers, and each ineligible/excluded reason are visible and available through the semantic companion state.
- Air ignores block, ground mines, and knockback unless a level explicitly says otherwise.
- `block`, `stun`, and `petrify` share one exclusive hard-control bucket. The first accepted application in stable simulation order wins; another hard control while that bucket is occupied is rejected rather than queued. When the accepted control ends, a surviving target gains visible `RESOLVE`: 1.0 s for regular enemies, 1.5 s for Heavy enemies, and 2.5 s for bosses. A new hard-control application during Resolve is rejected deterministically, displays `RESISTED`, and does not consume or postpone Resolve. Slow/drench and direct damage continue to work. A rejected Medusa control still consumes its already-fired charged shot, while a Hoplite comparator skips an ineligible target before assigning a guard. Resolve itself is never shortened by control scaling.
- Knockback has a 1.5 s per-target displacement cooldown measured from the accepted displacement event. A rejected knockback does not move the target or restart the cooldown. Heavy enemies receive 50% displacement. Unless a boss record declares another visible value, `bossControlBp = 2000`: block/stun/petrify duration, displacement magnitude, and slow magnitude resolve at 20% of the ordinary value, and that same value supplies its default `enemySlowControlBp`; slow duration remains unchanged. Nonzero scaled duration has a one-tick minimum. The UI shows `RESISTED` rather than unexplained immunity.
- Execute never applies to bosses. Resistance cannot reduce incoming damage by more than 35% in campaign v1.
- Per-hit attack order matches the global tick ABI: reveal/target eligibility snapshot → base milli-damage and authored internal Lock-On/crit/center/pierce/chain/fork/boss coefficients → summed/clamped external damage amplification → authored shield coefficient and ordered shield-pool consumption → armor/ignore/armor-break mitigation → native resistance → minimum-positive HP application and authored status application → guarded boss-threshold transition → terminal death/execute → child/revival scheduling → bounty. Each numeric stage uses the ABI's declared exact rational operation and named rounding boundary; boss execute remains forbidden.

## 10. Enemy and boss roster

### 10.1 Regular enemies

The four existing silhouettes remain and seven new regular archetypes are added:

| Enemy | First seen | Readable behavior |
|---|---|---|
| Scout | `m01` | Fast, fragile, one integrity leak |
| Raider | `m01` | Baseline body and timing |
| Guardian | `m02` | Heavy visible armor, two integrity leak |
| Titan | `m05` preview | Slow heavy unit with large leak |
| Echo | `m03` | Cloaked; damage exposes briefly, reveal removes cloak in range |
| Harpy Drone | `m06` | Flies on a separate air route; ignores ground-only effects |
| Shield Bearer | `m09` preview | Visible personal/nearby energy shield with separate bar |
| Splitter | `m12` | Spawns exactly two ordered child units on death |
| Myrmidon | `m11` | Regenerates after a displayed no-damage delay |
| Wraith | `m16` | Revives once after a fixed delay at the same route distance |
| Power Courier | `m18` | Mission objective; surviving at an assembly node buffs Titan Prime |

Every enemy record contains a stable ID, tags, route compatibility, HP, fixed-point speed, armor/resistances, shield, bounty, score, leak, threat priority, control scaling, animation set, semantic audio/effect IDs, and deterministic death/spawn behavior.

### 10.2 Bosses and scripted elites

| Boss | Mission | Deterministic script |
|---|---|---|
| Talos Prototype | `m05` | Releases Scout pods at fixed HP thresholds and telegraphs fixed exposed-core vulnerability windows |
| Cyclops Kernel | `m10` | Fires EMP at a fixed warned sector sequence; disabled towers remain inspectable/sellable |
| Oracle Core | `m15` | Rotates visible projectile/temporal/blast resistance at HP thresholds, capped at 30% |
| Titan Prime | `m18` | Starts with only the exact buffs earned by Couriers that reached authored nodes |
| Chronarch Titan | `m20` | Shield, summon, and fixed teleport phases at 75%, 50%, and 25% HP |

Boss data explicitly defines block, slow, petrify, stun, knockback, execute, shield strip, phase transition, leak, bounty, and status behavior. Blanket or hidden immunity is forbidden. A harmless preview of each signature mechanic appears before the boss wave.

## 11. Wave and route authoring contract

Global roster shuffling is removed. A wave is an ordered list of spawn groups. Random order is allowed only inside a group explicitly marked interchangeable and uses its named RNG stream.

```js
{
  id: "m07-w04-g02",
  enemyId: "shield-bearer",
  routeId: "upper",
  count: 3,
  firstTick: 144,
  intervalTicks: 54,
  shuffleWithinGroup: false,
  modifierIds: []
}
```

Each mission declares an integer `baseStartAether` and each wave declares one inclusive `baseAetherEnvelope`. The compiler proves that the wave-start deployment grant plus original-lineage kill bounties plus the authored clear grant equal that envelope exactly on Strategos. A Splitter's descendants divide their original lineage's declared bounty; a revived Wraith, repeated boss phase, summoned child, or secondary death cannot pay the same lineage twice. A final wave's post-clear Aether grant is always zero because no later tactical purchase exists; any final-wave Aether must resolve early enough to leave a declared tactical command window. Mission 1 satisfies that rule with a 60-Aether Wave-6 start grant and zero Wave-6 kill/clear Aether. Victory progression, Laurels, and score are separate transactions.

Difficulty applies its advertised bounty basis points to eligible kill-bounty records using Section 7.2's mission-scoped remainder; it does not silently scale fixed deployment or clear grants. The compiled preview exposes the expected wave envelope, while hidden bonus-income, interest, streak, and early-call multipliers are forbidden. Content validation reports resolved start, realized/potential earnings, gross purchase debits, sale refunds, net consumed Aether, final invested Aether, final owned state, cheapest-pad simultaneous saturation, earliest observed L2/L3 in benchmark fixtures, final bank/distribution, and the share of score attributable to banked Aether.

Regular mission pacing is:

1. Familiar opener.
2. Safe preview of the new mechanic.
3. Mixed application.
4. Route or economy choice.
5. Pressure check.
6. Elite finale.

Boss missions add a seventh mixed escalation and an eighth boss wave. Mission 20 uses twelve authored beats and never pads duration with repeated high-HP copies.

Mission data declares one `headlineMechanicId`, every newly lethal component, and an earlier `previewGroupId`/tutorial reference. The content validator rejects a novel lethal mechanic that appears before its harmless preview or briefing entry.

Across different-length routes, target priority compares the least remaining distance to that enemy's destination, not raw path progress. Ties resolve by declared threat priority and immutable runtime ID. Route assignment, tides, shortcuts, EMP sectors, teleport destinations, solar shields, assembly buffs, and boss transitions use simulation ticks and fixed scripts only.

## 12. Campaign progression and persistence

### 12.1 Unlock rules

- Completing a mission on any difficulty atomically unlocks the next mission and its listed reward.
- Missions are linear for the first playthrough. Laurels reveal optional variants and cosmetics, not the next story node.
- All fifteen defenses are permanently obtainable through campaign play.
- After `m04`, a profile with at least 10 Laurels across `m01`–`m04` earns Athena early; Telegram+X verification is an alternative route only. `m12` remains the unconditional campaign guarantee.
- A social early unlock does not remove or replace the campaign reward; reaching that milestone records it as already owned and grants the associated cosmetic compensation if defined.
- Competitive/challenge runs advertise and enforce a fixed loadout or trial-unlock all defenses, so campaign/social history never affects reward potential.

### 12.2 Local profile

On HTTP(S), IndexedDB is the canonical store for profiles and replay archives; localStorage is limited to tiny settings and last-profile pointers. Direct `file://` boot uses the separately capability-tested fallback in Section 20 and must advertise Session Only if durable storage cannot be proven.

```js
{
  databaseVersion: 1,
  profileSchemaVersion: 1,
  profileId: "local:<uuid>",
  missionProgress: {
    m01: { completed: true, bestLaurelsOverall: 3, attempts: 2 }
  },
  records: {
    "m01|strategos|sha256:ruleset|sha256:resolved-modifiers|assist-0": {
      bestScore: { value: 12000, replayId: "replay-score" },
      fastest: { ticks: 18320, replayId: "replay-time" },
      bestLaurels: { value: 3, replayId: "replay-laurels" }
    }
  },
  campaignUnlockIds: ["tower.hoplite", "modifier.reserve-1"],
  loadoutIds: ["sentinel", "chronos", "siege", "hoplite"],
  cosmeticSelectionIds: [],
  cachedEntitlements: [],
  settings: {},
  migrationJournal: []
}
```

- Result, replay, and derived progression normally write in one transaction. On quota failure the game prunes eligible old replays and retries; if replay storage still fails, it commits the compact result/progression without the replay and explains that the replay could not be retained. A storage limit must never erase a victory.
- Before a run, unavailable durable storage produces a persistent `SESSION ONLY — PROGRESS WILL NOT BE SAVED` state with Retry Storage and Export options. The game never displays `SAVED`, a verified/share-success claim, or durable unlock copy until a read-after-write check succeeds.
- If a result transaction aborts, the result screen retains the compact result in memory, offers Retry Save and Export Recovery, and does not expose actions whose copy implies a durable replay. Refresh-loss, blocked IndexedDB, quota exhaustion, transaction abort, and recovery import are direct fault tests.
- IndexedDB structural `databaseVersion` upgrades and serialized `profileSchemaVersion` migrations are separate, pure/ordered/idempotent where applicable, and tested against frozen fixtures. A recovery copy is retained before profile migration.
- Unknown newer schemas open read-only with an update message; they are never silently downgraded.
- Renamed content uses aliases/tombstones; saved array indexes and display names are forbidden.
- The record key contains mission, difficulty, ruleset, resolved simulation-modifier hash, and Assist state. Reserve Capacitors, permanent Overcharge, and any other combat-affecting campaign modifier enter that hash; incomparable records never overwrite one another.
- Replay quota protects every replay referenced by a best-score, fastest, or best-Laurels record, then favorites and latest attempts. Export/import has explicit byte/entity/string limits, validates every record before mutation, and writes only after a successful dry run.
- Local checksums detect corruption, not cheating. Local campaign play is intentionally user-owned.

## 13. Deterministic simulation and replay contract

The simulation remains pure and authoritative. DOM, renderer state, wall-clock time, storage, network responses, animation completion, provider identity, and image loading never enter combat state.

### 13.1 Content compilation

Authoring uses validated JSON and a dependency-light Node compiler. It canonicalizes keys, resolves complete level records, expands hidden-grid control nodes into exact continuous road polylines, compiles path segments/tangents/fixed-point lengths, validates pad geometry/coverage and Aether envelopes, rejects unknown IDs, and emits a no-bundler classic browser artifact plus a canonical ruleset manifest.

```js
{
  schemaVersion: 1,
  contentVersion: "campaign-1",
  abiHash: "sha256:<deterministic-abi-descriptor-bytes>",
  simulationArtifact: "aegis-sim.<simulation-hash>.js",
  contentArtifact: "aegis-content.<content-hash>.js",
  rulesetHash: "sha256:<length-prefixed ABI + exact simulation artifact + exact compiled content bytes>",
  missionIds: ["m01", "m02", "...", "m20"]
}
```

The generated simulation artifact is self-contained for all deterministic behavior, including its exact RNG, hashing, fixed-point, and canonical-encoding helpers; it may not read mutable shared globals such as `_kit/rng.js`. Node tests, browsers, replay viewers, and any later server validator load those same immutable simulation/content bytes and reject undeclared deterministic imports/globals. A release manifest pins the exact ruleset and asset-pack hashes. Presentation code/art/assets are excluded from `rulesetHash` so an art-only fix preserves gameplay replays, but they change the release-manifest hash. CI proves that any deterministic helper-byte change changes the ruleset identity, that the artifact runs without shared mutable helpers, and that a mutable filename cannot mix versions.

Content can compose only reviewed behavior IDs such as `direct`, `splash`, `slow`, `dot`, `chain`, `armorBreak`, `aura`, `spawnUnit`, `block`, `execute`, and `bossScript`. Arbitrary executable code in JSON is forbidden.

### 13.2 Simulation invariants

- Simulation advances at 60 integer ticks/second. `TIME_UNITS_PER_SECOND = 60000` and one tick advances 1000 time units, so an authored integer millisecond duration compiles exactly as `ms × 60`; existing 410 ms and 1350 ms cooldowns do not require quantization.
- `DISTANCE_SCALE = 1000`, `DAMAGE_SCALE = 1000`, and `BASIS_POINTS = 10000`. Authored coordinates/distances and authored HP, shield pools, flat armor, direct damage, and damage-over-time values permit at most three decimal places and compile with an exact decimal parser; extra precision is rejected. Runtime stores those combat quantities as integer milli-units, so authored `8` damage is `8000` until presentation formatting.
- Nonnegative division floors; signed division truncates toward zero. Exact rational coefficient chains cross-cancel before checked multiplication and floor only at their named final boundary: `preShieldDamageMilli = floor(baseDamageMilli × Π(internalDamageBp) × (10000 + externalDamageBp) / 10000^(internalCoefficientCount + 1))`. The compiler rejects any configuration whose validated worst-case intermediate can leave JavaScript's safe-integer range after cross-cancellation. Integer ceiling uses `ceil(n / d) = floor((n + d - 1) / d)` only after the same range check. These constants, rounding rules, coefficient order, and caps are part of the ABI descriptor.
- Stable ASCII string IDs identify authored objects. Runtime tower, enemy, summon, projectile, and effect IDs use separate monotonic integer counters allocated only when creation is accepted; denial/reset never rewinds a counter. Batch children/summons allocate in source-ID then authored-index order.
- Named RNG stream seed is `fnv1a32(UTF8(unsignedMissionSeed + "\\0" + streamId))`, consumed by the existing specified `mulberry32` algorithm. Streams and consumption sites are part of the ABI; cosmetics never consume them.
- Durations are not rounded to whole ticks, but state changes resolve only at their named tick phase. A remaining timer is due/expired when, after that phase's 1000-unit decrement, it is `<= 0`; negative overshoot is carried into repeated schedules.
- Tower cooldown begins ready at 0. During the attack phase, subtract 1000 only from a positive remaining cooldown; 0 is already due. If due and a target exists, make at most one attack that tick and add the current effective cooldown `ceil(baseCooldownUnits × 10000 / (10000 + externalRateBp))` to the negative/zero remainder. If no target exists, clamp to 0 so reacquisition attacks on the next eligible attack phase. Build is immediately ready; upgrade, support link/unlink, enable/disable, and amplification-source changes do not rescale an already running cooldown, and the next attack schedules from the then-current level and external rate. Content validation requires every possible effective cooldown to remain at least one tick.
- Spawn/boss repeating timers use the same overshoot carry and a strict authored per-tick event cap; simultaneous due events use authored order then stable ID.
- Movement retains an integer remainder per enemy. Each movement phase first resolves Section 9.3's strongest-only `scaledReductionBp` and minimum movement floor against the post-difficulty/Assist base speed, then computes `numerator = speedDistanceUnitsPerSecond × effectiveSpeedBp + remainder`, divides once by `60 × 10000`, advances by the floor quotient, and stores the modulus. Speed/status changes keep the remainder because the denominator is constant. Signed displacement uses the ABI's truncation rule and route bounds.
- Statuses applied after the expiry phase begin decrementing on the next tick. At the status-expiry phase subtract 1000 and remove before movement/targeting when remaining is `<= 0`; a sub-tick remainder therefore resolves at the first legal phase boundary, never by wall clock.
- Simulation commands are structured records with `{tick, seq, type, ...}`. `seq` is zero-based and strictly increasing within one tick. The kernel groups replay input into one explicit current-tick bucket; the management reducer may consume only that bucket and cannot apply commands from multiple ticks contiguously. At the beginning of a tick, accepted commands apply in `seq` order; an accepted start-wave command credits that wave's declared deployment grant before spawning. Then scheduled spawns → status expiry/movement → leaks → tower acquisition/attacks → shield/damage/status → guarded boss-threshold transition → terminal death/execute/children/revival → bounty → wave clear. A guarded boss threshold clamps HP and permits at most one authored transition per resolved hit, so a large hit cannot silently skip a required phase.
- `tutorialUpgradeGateMode` is resolved into the replay header and canonical initial state. `m01-wave1` rejects pre-clear Upgrade until either the recorded `skipTutorialGate` command or Wave-1 clear opens it; `none` never gates Upgrade. Replay validation never consults the current profile to infer this legality.
- Manual pause, runner/playback speed, panel state, recording UI, wall-clock timestamps, and animation are scheduler/presentation data, not simulation commands or state.
- The canonical state encoder accepts integers, ASCII-keyed objects with lexicographically sorted keys, ordered arrays, booleans, strings, and null; it emits UTF-8 JSON with no whitespace. Lightweight checkpoints use the named FNV-1a diagnostic hash and final claims use SHA-256. A hash alone is never gameplay proof.
- All collection iteration, target comparator, simultaneous event, status source, and allocation ties are explicit and stable.
- Campaign progression is not mutable mission state. Any modifier that changes a run is copied into the replay header.

### 13.3 Replay envelope

```js
{
  formatVersion: 1,
  rulesetHash: "sha256:...",
  eventSchemaVersion: 1,
  missionId: "m07",
  difficultyId: "strategos",
  assist: false,
  seed: 123,
  loadoutIds: ["sentinel", "chronos", "siege", "oracle", "artemis"],
  campaignModifierIds: ["reserve-1"],
  accessGrantIds: ["campaign.oracle", "campaign.artemis"],
  tutorialUpgradeGateMode: "none",
  inputs: [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }],
  checkpoints: [{ tick: 600, diagnosticHash: "fnv1a32:..." }],
  finalClaim: { outcome: "victory", score: 12345, laurels: 3, durationTicks: 18420, finalStateHash: "..." }
}
```

`runId`, timestamps, player/provider identity, media, local notes, pause/speed history, cached snapshots, and presentation settings live in an optional outer metadata/presentation record excluded from canonical gameplay input and state hashes. Cached seek snapshots and event indexes are derived, untrusted, discardable data.

`durationTicks` is the number of completed fixed ticks in the claimed final state. A replay of duration `N` may contain commands only at ticks `0` through `N - 1`; a zero-duration replay contains no commands. A diagnostic checkpoint may be recorded at tick `N`, including the final-state boundary. `loadoutIds` and `accessGrantIds` are unique ordered arrays whose authored/resolved order is preserved. `campaignModifierIds` is a unique set serialized in strict ASCII order.

`simulateReplay(envelope)` must reproduce canonical checkpoints/final state in Node and supported browsers. Any server validation fully re-simulates the immutable ruleset; a hash alone is not proof. Published ruleset artifacts remain addressable for at least 12 months, and the local cache protects bundles referenced by best/favorite replays. A longer ranked retention window must be declared before ranked launch.

## 14. Replay viewer and 10–20 second X highlight

Replay data, a highlight plan, and rendered media are separate artifacts.

- The viewer re-simulates from the seed and seeks from bounded periodic snapshots/event indexes.
- A pure versioned selector with `highlightSelectorVersion` and artifact hash scores boss defeat/phase events, multi-kills, closest gate threats, signature tower actions, and the final defense.
- The same replay, ruleset, event-schema version, and selector hash produce the same selected moment order. Highlight hashes are separate from gameplay hashes.
- A highlight lasts 10–20 seconds, targeting about 15 seconds: roughly 1.5–2 seconds of Armara/run-identifier intro, 10–14 seconds of one to three exciting ordered clips, and 2 seconds of result slate. Only the enabled verified flow adds a Run Seal/proof state.
- If a quiet victory has no high-scoring event, the deterministic fallback uses the closest gate approach, the final attack sequence, and victory in chronological order; every victory still has a truthful 10–20 second plan.
- Accelerated playback displays `2×` or `4×`; cuts cannot reorder events or imply something that did not happen.
- A three-second recording countdown, privacy-safe HUD, and game-audio toggle support OS screen recording. The page cannot control an operating-system recorder's microphone; device-specific instructions tell the player how to disable it.
- Feature-detected `canvas.captureStream`/`MediaRecorder` export may provide 720p/30 fps WebM where reliable. Guided OS recording is the required fallback; dependable cross-browser MP4 export is a separate later project.
- The player previews, manually posts to X, and pastes the public post URL. The game never auto-posts.

A video is a social artifact, not anti-cheat proof. Only deterministic replay validation can establish that the gameplay claim is authentic.

Two UI states must remain unmistakable:

- **Local X Replay Highlight:** no Run Seal, nonce, gold badge, pending state, or verification claim; it can be recorded/shared like any local replay.
- **Verified X Replay Highlight:** available only when the optional service is enabled; server issues the Run Seal before recording, then the player posts, pastes the URL, and sees explicit pending/verified/rejected states.

## 15. Victory and share card

Every completed mission offers a locally rendered `1200 × 675` (16:9) victory card after progress is safe.

Required card content:

- Exact canonical Armara hourglass and Aegis branding.
- `MISSION N/20`, mission name, act, and difficulty.
- One to three Laurels and objective checks.
- Integrity, score, clear time, and Assist/verification state.
- Loadout silhouettes and MVP defense.
- A readable battlefield snapshot.
- Earned reward or next-unlock progress.
- Small replay ID/seed/ruleset marker.

The card has generated alt text and contains no player display name by default. `DOWNLOAD`, `COPY / WEB SHARE`, and `X REPLAY HIGHLIGHT` are distinct. The primary result action remains `NEXT MISSION`. A local result says `LOCAL VICTORY`; only an independently validated run may show a verified gold badge. The still card never qualifies as replay-video proof.

## 16. Community visibility and optional social rewards

### 16.1 Fair reward policy

- Campaign completion is the guaranteed path to every gameplay mechanic.
- Social actions may grant training/fixed-challenge trial access, an optional early route to a sidegrade that has an equivalent gameplay route and later guaranteed unlock, profile titles, victory frames, tower chassis, palettes, and challenge variants. Time-limited access never applies to ordinary campaign ownership.
- No social reward increases tower stats, starting Aether, ranked score, token/reward earning, or leaderboard eligibility.
- Every competitive/reward-sensitive mode uses a fixed loadout or temporarily unlocks everything.
- No reward is clawed back because a post is later deleted or a membership changes.
- No newsletter action exists because Armara has no newsletter.

### 16.2 Approved rollout pathways

| Action | Verification | Reward | Rollout |
|---|---|---|---|
| Join official Armara Telegram | Linked Telegram identity + server membership snapshot | Messenger of Delphi title and cosmetic palette | Initial optional service |
| Follow official Armara account on X | Linked immutable X ID + server follow check | Olympus Signal title and victory-frame accent | Initial optional service |
| Complete both after clearing `m04` | Both verified | One early Athena Nexus route; it remains guaranteed at `m12` | Initial optional service |
| Earn 10 Laurels across `m01`–`m04` | Local campaign record | Equivalent offline early Athena route | Offline campaign |
| Publish one verified 10–20 second X Replay Highlight | Public direct-video post + nonce + validated replay receipt | Replay Sigil, share-card frame, and Herald progress | Initial optional service |
| Qualified referral whose new player completes `m03` | Server referral record + validated completion | Cosmetic chassis choice; no recurring pyramid reward | Later adapter |
| Complete cross-game Armara challenge | Versioned local/server receipt from another Armara game | Aegis cosmetic/lore unlock | Later adapter |
| Enter weekly Telegram/X dispatch code | Signed, long-catch-up code | Cosmetic or bundled fixed challenge; never unique combat power | Later adapter |
| Vote in a community map/event poll | One account/device vote | Participation badge; winning content remains available to all | Later adapter |

The post-run UI shows at most one optional community prompt. Community progress lives in a dedicated hub and can be hidden in Settings.

Weekly dispatch codes remain redeemable for at least 90 days. Armara may editorially feature opt-in victory cards, replay links, and loadout codes, but an open user-upload gallery/moderation system is not part of the campaign release.

### 16.3 Static/client boundary

GitHub Pages can host the entire game, local share card, replay viewer, guided proof clip, and cached signed entitlements. It cannot securely store provider secrets or prove Telegram membership, X follows, X posts, referrals, or ranked runs.

Optional verification therefore uses a separately deployed HTTPS service behind feature flags. If it is unavailable, campaign boot/play/save/replay/share still works and social actions show an honest `SERVICE UNAVAILABLE — TRY LATER` state.

## 17. Optional identity, proof, and entitlement service

This service is a later deliverable and cannot begin until Ryan supplies official provider identifiers, hosting/operator choices, credentials, privacy/retention decisions, and approved incentive terms.

### 17.1 Trust model

- A first-party account uses a secure server session and may link immutable provider subjects. A local device UUID is correlation metadata, never authentication.
- Provider proofs establish identity/social action only.
- A separate isolated Aegis validator establishes gameplay only.
- Local state is not trusted by online reward/ranked services.
- Provider scopes and secrets remain server-side; exact-origin CORS is required.

### 17.2 Telegram

- Link the exact Telegram user identity using Telegram's supported login flow.
- The Armara bot must be an administrator in the target group/channel for dependable checks of other members.
- The server calls `getChatMember` and accepts current member/administrator/creator states according to an approved policy.
- Launch grants are one-time snapshots; continuous revocation is out of scope.

Official reference: <https://core.telegram.org/bots/api#getchatmember>

### 17.3 X identity, follow, and replay post

- Link the exact immutable X user ID using OAuth 2.0 Authorization Code with PKCE and minimum read scopes.
- Confirm the affordable X product tier and the exact follow lookup in a staging spike before implementation; provider capabilities and pricing may change.
- For a replay post, first upload the consented bounded replay to the isolated validator. Only a successful full re-simulation creates a signed run receipt and an unguessable short-lived one-time Run Seal bound to the linked X subject/receipt.
- The player posts one direct video with the Run Seal, then pastes its X URL.
- Parse only an allowlisted numeric post ID. Verify current author ID, issue/post time, current text nonce, direct `video` attachment, 10–20 second duration metadata, uniqueness, and public availability.
- Reject quoted/reposted source media, protected/unavailable posts, proof/post/media IDs already known to this service, and mismatched authors. Metadata cannot prove that a re-encoded upload's pixels are original.
- X posts can be edited; hold the grant pending and re-fetch after the documented 30-minute edit window before finalizing. Permanent rewards are not later clawed back.
- X metadata proves that the linked account posted the public video, not that its pixels show an authentic run. The matching deterministic run receipt is a separate requirement.

Before any provider link or proof submission, the UI checks applicable age/region/provider eligibility, explains protected/private-account and provider-outage limitations, and shows the exact fields and retention period. Linking Telegram and X into one first-party account requires explicit cross-link consent. Referrals use a player-entered code/link only; Aegis never uploads contacts, sends invitations, or spams provider accounts.

Official references: <https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code>, <https://docs.x.com/x-api/posts/lookup/integrate>, and <https://help.x.com/en/using-x/x-videos>.

### 17.4 Proof and entitlement state

Proof records follow:

```text
issued → submitted → pending → verified | rejected | expired
```

They are idempotent and unique by provider subject, policy version, external proof ID, and nonce. Verification creates a signed entitlement; providers never write campaign progression directly.

Run Seals, OAuth/session tokens, and cached entitlement envelopes expire. A verified permanent reward is a durable backend grant and is not revoked when an envelope expires; refresh materializes it into a newly signed snapshot. The client accepts only signed, subject/audience-bound, expiry-checked bundles using browser-verifiable public-key signatures. The private key never ships to GitHub Pages, and public verification keys remain available for the declared offline-support window. Tokens contain grant IDs and provenance, never provider access tokens or unnecessary profile data. Secure HttpOnly/SameSite session or equivalent token binding, CSRF protection, key rotation, clock-skew policy, unlink, export, recovery, and deletion must be designed/tested before public linking.

## 18. Art direction and asset coverage

### 18.1 World style

The visual language is **ancient Greece meets luminous Armara AI**:

- Worn limestone, marble, mosaics, olive wood, bronze mechanisms, colonnades, harbors, temples, foundries, underworld glass, and storm-lit Olympus.
- Cyan/violet/gold circuitry appears as inlaid magical technology, not modern roads or city hardware.
- Every travel route is ancient material: limestone paving, marble blocks, mosaic, packed earth, bridge stone, temple tile, or bronze channels. No asphalt, lane paint, modern curb, or highway texture.
- The hidden authoring grid never appears as a modern gameplay grid. Road art may soften or ornament compiled polyline joins, but its visible centerline, twelve-unit buffered width, pad clearance, and tactical coverage must remain faithful to compiled geometry.
- Backgrounds remain lower contrast and less saturated than gameplay pieces. Route edges and intersections remain clear.
- Towers and enemies use thick navy contours, bright faction color, ivory/gold rim light, large readable shapes, and three-value cartoon shading.
- User-provided Armara reference images guide palette, shape language, material, and finish. They are not copied into generated scenes unless licensed and intentionally used.
- The exact canonical hourglass is always composited from the approved asset; image generation never invents or redraws it.

### 18.2 Twenty battlefield packs

Every mission gets a distinct quiet 16:10 battlefield illustration matching its named environment, plus authored code/manifest route overlays, pads, gates, hazards, and props. Similar act palettes may share modular prop sheets, but no mission may feel like only a recolor. Only the selected mission pack is decoded.

### 18.3 Tower coverage

Every one of the fifteen defenses requires:

- One shop/Codex portrait.
- Three visually distinct upgrade bases.
- Three visually distinct weapon/core layers.
- Idle A/B, anticipation, attack/fire, recoil/recovery, selected, disabled/hit, build, upgrade, and sell presentation coverage through atlas frames plus code-driven transforms/effects.
- Explicit anchor, pivot, bounds, shadow ellipse, projectile origin, and range origin metadata per level.
- Extra sub-unit atlases where required: Hoplite guards, Hermes drones, Hephaestus mines, and any other independently moving summon.

The preferred production format is modular layered atlases rather than hundreds of full-tower frames. Base and weapon/core layers may reuse frames across presentation states, but every level must visibly change at normal gameplay size.

### 18.4 Enemy/boss coverage

Each regular enemy has at least idle/contact, left-step, right-step, hit, special/trait, stagger/control, defeat, and breach frames. Bosses additionally cover each phase transition and signature ability. Facing, movement interpolation, projectile paths, range rings, shadows, health/shield/status bars, and bounded particles remain code-driven where that produces better clarity and smaller packs.

### 18.5 Atlas quality gate

Generated images are source material, never dropped raw into runtime folders. The production pipeline normalizes and validates them:

- Genuine alpha; no checkerboard, matte, text, watermark, fake logo, or baked terrain.
- Explicit frame rectangles; equal grids are not assumed.
- At least a 2–4 pixel transparent/extruded gutter at production scale.
- No opaque pixel crosses a frame rectangle or appears as a neighboring clipped sprite.
- Consistent ground contact, scale, facing, light direction, and anchor across every upgrade/frame.
- Readable silhouette at the smallest required CSS size and in color-blind simulation.
- Visual review at actual gameplay scale, not only the full source image.
- Asset manifest includes relative URL, compressed byte size, decoded byte estimate, SHA-256, dimensions, alpha requirement, frame rectangles, pivots, pack ID, and transitive pack dependencies.

This gate exists specifically to prevent the frame bleed, clipping, partial neighboring towers, and inconsistent anchors seen in early Aegis sprite attempts.

### 18.6 Performance budgets

- Initial Aegis shell plus Mission 1 critical art: at most 5 MB compressed; critical art at most 4 MB.
- Each additional mission/biome pack: target at most 3 MB compressed.
- No production atlas dimension above 2048 pixels and no unexplained individual file above 1 MB.
- Active mobile decoded-art budget: at most 64 MB.
- Only current mission enemies, boss, equipped defenses, and immediate UI portraits decode at battle start.
- Runtime pixel flood-fill/background cleanup is a fallback for legacy art only, not the production workflow.
- Representative stress target: 100 enemies and 15 built towers at renderer p95 no worse than 16.7 ms desktop and 33.3 ms mobile on agreed reference devices.

Budgets are reviewed after the three-mission vertical slice and may be tightened before mass art production.

### 18.7 Audio and game feel

- Each act has an original or license-safe ambient identity and a battle layer that intensifies without masking UI or status cues.
- Every defense family has a short recognizable charge/fire/impact signature; enemies and bosses have distinct arrival, trait, phase, leak, and defeat cues.
- Build, unaffordable, upgrade, sell, wave ready, objective complete, victory, and defeat feedback is immediate and restrained.
- Master, music, effects, and mute controls persist. No unique tactical information is audio-only.
- Screen shake, recoil, hit flash, haptics, and particles are bounded presentation effects and never enter simulation. Reduced Motion removes or softens them.
- No unsafe rapid flashing, unbounded bass/volume jumps, copyrighted commercial track, or runtime audio CDN dependency is permitted.

## 19. Accessibility, usability, and responsive acceptance

### 19.1 Interaction and comprehension

- Mission 1 teaches: identify Aether → select highlighted pad → compare/build → start wave. On a new profile's first non-skipped tutorial run, Upgrade is absent/disabled through Wave 1, then reveals with exact cost/comparison; skipping or completing that reveal keeps it visible on replays and it has no later tier lock. Sell appears when a built tower is first inspected and remains optional. Skip/Replay Tutorial is always available.
- For the first three missions the HUD says `AETHER — BUILD CURRENCY`.
- Build cards show portrait, name, role, exact cost, damage, attacks/second, range, target mask, and special from engine data.
- Unaffordable cards say `NEED N MORE`; color/dimming is supplemental.
- Build preview and tower selection show the exact range boundary plus a high-contrast glow on every covered road window; the effect remains readable without color and does not expose numeric debug heatmaps.
- Sell shows the exact refund and requires a second deliberate confirmation while management is suspended. Only the confirmed `sell` command reaches simulation; once dispatched it is final, with no wall-clock undo ambiguity.
- Primary battle controls and construction pads are at least `48 × 48` CSS pixels. Secondary non-battle controls are at least `44 × 44`.
- Moderated target: at least four of five first-time players can begin Mission 1, build, explain price/current Aether, and launch Wave 1 without outside instruction; four of five can later find Upgrade and Sell.

### 19.2 Accessibility

- Target WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text/control boundaries, visible focus, semantic names/headings/errors.
- Entire hub, loadout, briefing, gameplay command, result, replay, and settings flow works by keyboard.
- Dialog focus is contained, Escape closes, and focus returns sensibly.
- Canvas has a semantic companion state for selected pad/tower, wave, Aether, integrity, status, and available actions. Attack spam is not announced.
- The companion also provides a keyboard-accessible ordered pad list and a paused/on-demand route summary: active routes, nearest threat, air/armor traits, boss HP/phase, and current objective progress.
- Identity uses silhouette, name/icon, and shape as well as color.
- Reduced Motion preserves positional interpolation but removes bob, recoil, shake, large bursts, and rapid flashes.
- Sound communicates no unique information; mute persists.
- Text remains usable at 200% zoom without clipped essential controls.
- Automated scans must have zero critical/serious findings, followed by manual keyboard and at least one desktop/mobile screen-reader pass.
- Each act ships only after keyboard, focus-return, 200% zoom, reflow, Windows Chrome + NVDA, iOS Safari + VoiceOver, and Android Chrome + TalkBack smoke journeys have zero task-blocking issues on supported current versions.

### 19.3 Responsive/device gates

Required visual and interaction passes: `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`. Orientation/resize never resets a run. Mobile keeps the full landscape visible and scrolls contextual sheets independently. Real iOS Safari and Android Chrome touch passes are release gates; screenshots alone are insufficient.

## 20. Offline delivery, telemetry, and privacy

- The entire static campaign runs without the optional API. Once a mission pack is cached, it remains playable offline.
- Under HTTP(S)/GitHub Pages, IndexedDB, a per-game service worker, and lazy immutable packs provide the full durable/offline experience. The worker uses only relative deployment URLs, is scoped to Aegis, and must not control the rest of the arcade.
- Under direct `file://`, committed classic-script content and relative scripts/images boot without runtime JSON fetch. Service workers are unavailable and durable browser storage is capability-tested; if unavailable, the explicit Session Only contract applies. `file://` and HTTP boot/progression behavior have separate tests.
- A versioned release manifest pins transitive engine/content/asset dependencies plus compressed and decoded byte totals before download. A new ruleset/cache installs beside the current version and activates only between runs, never mid-replay; no unconditional `skipWaiting` may mix an active run. Multi-tab run leases, update-during-run, and cache-corruption recovery are direct tests.
- Core gameplay works when telemetry is blocked. Telemetry is opt-in/minimal and can be dropped without changing progress.
- Define a versioned event dictionary before adding analytics. Useful aggregate events include mission start/end, failure reason, loadout diversity, build/upgrade/sell/denial, tutorial steps, Assist, share opt-in, and proof failure.
- Do not upload full input logs, screen contents, microphone, wallet, X identity, or post URL by default. Replay/proof data uploads only after explicit consent.
- Before proof submission, state exactly what is stored and for how long. Public-gallery use is a separate unchecked opt-in.
- Provide privacy notice, analytics opt-out, export, unlink, and deletion paths before any account/provider launch.

## 21. Post-campaign replayability

Completing `m20` unlocks:

- **Endless Ascension:** escalating authored cycles on selected campaign maps with a declared seed and ruleset; it ends cleanly on defeat and awards local records/cosmetics only at first launch.
- **Oracle Challenge:** a weekly fixed seed, fixed mission modifier, and fixed/trial loadout. Bundled offline challenges precede any live CMS.
- **Titan Variants:** remixed authored groups and boss scripts for completed acts.
- **Training Courtyard:** sandbox controls for enemy waves and all tower levels, with no progression rewards.
- **Laurel Hunts:** direct retry from the result/map for missed mastery objectives.
- **Replay and loadout sharing:** versioned codes/data without embedded identity.

There are no daily streak losses, energy timers, expiring power, or modal claim cascades. Post-run shows at most two nearby goals and one optional share/community action.

## 22. Acceptance and release gates

### 22.1 Content and balance

- Exactly 20 valid missions, 15 defenses × 3 complete levels, 11 regular enemies, and 5 boss/scripted-elite records.
- Every reference resolves; IDs are unique/stable; paths reach a gate; pads are legal; waves are ordered and finite; unlock graph has no cycle. The map analyzer also proves snapped control nodes, legal continuous segments/joins, road width, exclusion/clearance/separation, intent tags, route-stage ordering, and role-probe coverage.
- Automated headless simulations and manual review show starter-trio campaign completion on Story/Strategos. Strategos diversity requires one available-roster fixture for new-profile `m01`, two for `m02`, and at least three materially different available-roster fixtures for `m03`–`m20`.
- No defense has a strictly dominant cost/damage/control profile across the test matrix.
- Every mission has a distinct battlefield/path/rule, a briefing, a preview, and measurable Laurel objective.

Mission 1 has direct binding gates:

- Compiled geometry matches Section 6.7 exactly: route length 260, ten named pads, all `E20 >= 24`, Standard-pad `E22 = 29.539–30.199`, Strong-pad `E22 = 48.530`, max/min `1.643` (never above 1.65), no Specialist pad, and only `p04`/`p08` in the Strong band. Neither Strong pocket is best for all three starter roles across all waves.
- An unassisted, unmodified new-profile Strategos run compiles to 150 starting Aether and inclusive perfect-kill envelopes `30 / 40 / 45 / 50 / 55 / 60`; cumulative gross is exactly 430. Wave 6 credits its 60 before its first spawn, has zero kill/clear Aether, and leaves the full envelope spendable before victory. The validator fails any deployment/bounty/clear double count and golden tests cover Story's remainder timing/hash plus `178 / 150 / 136` base and `198 / 170 / 156` Assist starts.
- At least three deterministic purchase/placement witnesses win with materially different emphasis: focused Sentinel fire, Chronos control, and Siege clustering. Their representative final simultaneous states use four or five towers and approximately two paid upgrades, consume 360–410 net Aether, and never fill all ten pads. The 430 gross budget can own at most seven cheapest L1 defenses simultaneously at any state; sell-churn/refund tests separately prove lifetime purchase debits may exceed gross without creating Aether or increasing simultaneous investment.
- In representative successful unassisted, unmodified Strategos fixtures using that 430-gross ledger, median ending bank is less than 65 Aether. The analyzer reports p90 and the full bank distribution diagnostically without imposing a p90 threshold. Goldens prove `eligibleUnspentAether`, `unspentScore = min(rawUnspentScore, floor(nonAetherScore / 19))`, and a final-total unspent-Aether share never above 5%, including zero-score and modifier-exclusion boundaries.
- On a new profile's first non-skipped tutorial run, Upgrade is unavailable only through Wave 1 and permanently available thereafter; tutorial skip reveals it immediately. Replay/header fixtures prove the initial gate mode, stable hostile-command denial, recorded skip, Wave-1 release, and profile-independent replay validation. Typical winning fixtures do not rush an L3 before Wave 4; this is a balance observation and regression signal, never an engine lock.
- A route-aware Strategos fixture finishes with 18–20 integrity; a reasonable but deliberately imperfect placement finishes with 12–17. Both use legal new-profile information and no Assist/debug command. One-tower/no-upgrade and seeded legal-random baselines fail during Wave 5 or Wave 6.
- At the same seed, loadout, resolved spend, command timing, upgrade timing, target policies, and wave inputs, a route-aware pad plan achieves at least 15% greater `combatValuePerAether` than its paired naïve placement. `combatValuePerAether = (non-overkill damage + declared control/support credit + prevented-leak damage at the same checkpoint) / net Aether consumed`; campaign score is excluded. A route-aware clear paired with a naïve Wave-5/6 defeat passes automatically, but both raw values remain in the versioned balance report.

The automated tower matrix measures damage per 100 Aether against unarmored, armored, shielded, air, boss, single-, three-, and six-target fixtures; actual delivered damage after overkill/idle/retarget time; coverage-adjusted marginal L2/L3 value on Standard and Strong pads; credited support/control value; and pair/trio synergy. It flags any interaction above 35% uplift over its matched independent baseline for review. Direct tests prove strongest-only slow/drench, exclusive hard control and Resolve windows, knockback cooldown, amplification caps, Athena's deterministic auto-link comparator/recompute triggers, mine/drone/guard limits, non-recursive capstones, exact integer refunds against every Section 9.2 golden, and one-bounty-per-lineage behavior.

For this gate, a viable loadout has a committed deterministic replay fixture that wins Strategos with at least 5 integrity and no debug/Assist command. Where three are required, the fixtures differ from one another by at least two equipped defense IDs and materially use those differences in their command logs. A defense is not accepted until it has at least one matched-cost fixture where its role outperforms each plausible substitute and one fixture that visibly exposes its listed weakness; no defense may improve victory/score in every matched role scenario. Full-roster debug fixtures may broaden regression coverage but do not satisfy an unavailable new-profile slot.

### 22.2 Determinism and persistence

- Golden replays match checkpoint/final hashes in Node and supported browsers.
- Multi-route priority, status order, boss thresholds, spawn ordering, selling, Blueprint Reset, Overcharge, and campaign modifiers have direct tests.
- Migration fixtures prove idempotence, rollback, unknown-newer handling, aliases/tombstones, and atomic victory writes.
- Adversarial replay parsing has bounded bytes, ticks, entities, and commands.

### 22.3 Presentation and art

- Every tower level, summon, enemy state, and boss phase passes atlas containment, alpha, pivot, actual-size silhouette, contrast, and color-blind review.
- No asphalt/modern road appears in any battlefield.
- Exact Armara hourglass pixels remain unchanged.
- Desktop/mobile visual regressions cover hub, all acts, loadout/store with six cards, multi-route combat, upgrades, bosses, result/share, replay, offline/error states.
- Performance and decoded-memory budgets pass under representative stress.

### 22.4 Usability and access

- Newcomer comprehension target, keyboard path, screen-reader path, Reduced Motion, 200% zoom, and physical iOS/Android touch gates pass.
- All actionable icons have visible labels or unambiguous accompanying text.
- Progress saves before any share/community UI and provider outages cannot block play.

Moderated timing uses active simulation time at `1×`, excluding planning, manual pause, and contextual management suspension: Mission 1 median time to first launched wave is at most 90 wall-clock seconds; regular-mission clear median is 5–9 active minutes and p90 at most 12; boss/finale p90 is at most 15. Mission 1 Strategos calibration uses at least 20 first-time participants across at least two moderated rounds: 60–70% should win their first attempt, and cumulative cohort success after at most one informed retry must exceed 85% after seeing the game's ordinary failure explanation, without facilitator advice or Assist. A separate cohort of at least 20 first-time Story participants has a greater-than-90% first-attempt win target. These rates are tuning targets; comprehension/task-blocking failures remain release blockers independently of win rate. Per-act qualitative testing separately uses at least five representative players, median post-session clarity and enjoyment of at least 4/5, and zero unassisted task-blocking failures in the core loop. A task-blocking issue means a participant cannot discover or complete the required next action without facilitator intervention. Any different sample or device matrix requires a recorded test-plan amendment rather than an informal exception.

### 22.5 Repository and live delivery

- The current bare `node --test` suites in `_kit`, `armaratris`, `serpent`, `breaker`, `flight`, `starfall`, and `aegis` all remain green as tests are added; the current repository baseline is 102/102, above the original 90/90 requirement.
- All JavaScript passes `node --check`; content and asset compilers/validators pass.
- `games/.nojekyll` exists.
- Release commits contain no `research/`, `Assets/`, or `.superpowers/` files.
- The site is considered live only after public `/_kit/shell.js` returns HTTP 200 and a live CDP-driven Aegis boot reaches `body.dataset.ready === "1"` with the current mission's required art ready.

## 23. Deferred approval gates

Ryan resolved the campaign-balance decision set on 2026-08-26: compact Aether values and binding round-zero costs; the 150-start/430-gross Mission 1 envelope with no post-final clear payment; the one-wave tutorial reveal with no later upgrade tier locks; visible Resolve plus control/amplification caps; the hidden `40 × 25` fixed-pad authoring grid and binding Gate of Dawn geometry; and the 60–70% first-attempt and >85% informed-retry Strategos targets plus >90% first-attempt Story calibration. These decisions are no longer deferred and may not be silently reopened during implementation.

The offline campaign can proceed with those binding defaults. Before the relevant later phase, Ryan must still approve one batched operational decision set covering:

1. Backend operator/host/budget and production domains.
2. Official immutable Armara X account ID and Telegram group/channel ID; bot/admin readiness.
3. Provider credentials, approved scopes, incentive/platform-term review, and exact public copy.
4. First-party account recovery/merge/unlink policy.
5. Identity, proof, replay, audit, IP/rate-limit retention and deletion periods.
6. Whether public ranked/leaderboards are wanted at all; they are not assumed.
7. Whether cross-browser downloadable video beyond guided 10–20 second screen recording is worth a separate encoding project.
8. Final measured asset/network/frame-time budgets after the vertical slice.

No implementation subagent may silently decide these operational/product matters.
