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

It preserves `2026-08-26-armara-aegis-landscape-redesign.md` as the binding presentation and interaction foundation:

- Landscape `160 × 100` logical battlefields.
- Bright, cartoon-readable units over quieter terrain.
- Contextual build and tower-management panels that suspend combat while open.
- Visible Aether and exact costs.
- Three in-run tower levels.
- Selling for `floor(total invested Aether × 0.70)`.
- Smooth deterministic presentation, accessible controls, and the exact canonical Armara hourglass.

Where the earlier redesign says all three choices are visible, this expansion changes that to all equipped loadout choices: four initially, five after Mission 5, and six after Mission 10.

This specification covers the offline campaign, content and art pipelines, progression, difficulty, accessibility, local replays, victory/share cards, and the optional online social-proof boundary. It does not authorize a token economy, wallet integration, paid stat boosts, gambling, loot boxes, or a public leaderboard.

The named missions, rewards, defense identities/unlocks, three-level structure, fairness rules, UX, and technical contracts are binding now. The upgrade numbers in Section 9 are starting targets, not yet complete production records. Exact routes, pad coordinates, starting economy, ordered wave groups, enemy/boss values, Laurel thresholds, and every effect parameter must be committed as a reviewed versioned content annex for an act before that act's mass art production or gameplay implementation proceeds.

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
- The starter trio can complete all twenty missions on Story and Standard. Unlocks improve choice, not eligibility.
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
| `m01` | Gate of Dawn | Sunrise limestone gate, broad S road | Staged Aether, pad, compare/build, and first-wave tutorial; upgrade appears when useful and sell remains optional | 6 | Hoplite Node |
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
  floor(missionBaseAether × difficultyAetherBp / 10000)
  + campaignModifierAether
  + assistAether
```

Enemy HP uses `ceil(base × bp / 10000)` with a minimum of 1. Bounty and score use `floor(base × bp / 10000)` with their declared nonzero minimums. Speed composes difficulty and Assist before its only rounding step:

```text
resolvedSpeed =
  max(1, floor(baseSpeedUnits × difficultySpeedBp × assistSpeedBp / 100000000))
```

`assistSpeedBp` is 10000 normally and 9200 when Assist is enabled. The compiler's safe-intermediate check applies to the combined numerator. No intermediate result is rounded twice. The exact resolved values and modifier IDs enter the record/replay key.

Story awards all campaign unlocks and Laurels. It is not described as a lesser victory. Titan may append authored elite groups, but it cannot procedurally reorder a wave or apply invisible affixes.

After two failures, the game offers an explicit Assist toggle for that mission. Assist can add 20 starting Aether and slow enemies by 8%; it is recorded in the result/replay, retains campaign unlocks and Laurels, and is separated from competitive scores.

### 7.3 Score and records

Score rewards kills, wave clears, remaining integrity, normalized unspent Aether efficiency, and objective completion. Reserve/Assist Aether is subtracted from the efficiency numerator so an unlock does not grant free efficiency points. It never rewards social actions or owned cosmetics. Exact score constants are content-versioned and visible in the Codex.

Records are keyed by mission, difficulty, ruleset hash, resolved simulation-modifier hash, and Assist state. The result screen separately presents best score, fastest clear, and highest Laurels so one metric cannot silently replace another.

## 8. Defense roster and loadouts

There are exactly fifteen player defense families. Sentinel, Chronos, and Siege are starters. The other twelve unlock at the campaign milestones below. Every defense has exactly three linear in-run levels and a materially different weakness.

| Defense | Unlock | Targets | Role | Deliberate weakness |
|---|---|---|---|---|
| Sentinel | Starter | Ground + air | Fast focused universal fire | Loses efficiency to armor and crowds |
| Chronos | Starter | Ground + air | Slow and lane control | Low damage; bosses cap slow |
| Siege | Starter | Ground | Heavy circular splash | Slow cadence; cannot hit air |
| Hoplite Node | `m01` | Ground | Hard-light guard slots halt threats without rerouting | Short blocks, weak damage, air immune |
| Oracle Relay | `m02` | Ground + air support | Reveal cloak and mark targets for damage | No meaningful solo damage |
| Artemis Rail | `m03` | Ground + air | Extreme-range armor-piercing precision | Expensive and vulnerable to swarms |
| Hermes Wing | `m06` | Ground + air | Mobile interceptors with air priority | Light hits struggle with armor |
| Poseidon Coil | `m07` | Ground | Line damage, drench, bounded knockback | Heavy/boss displacement resistance |
| Medusa Lens | `m08` | Ground | Periodic petrify and brittle control | Cadence-dependent; bosses heavily resist |
| Hephaestus Forge | `m11` | Ground | Deterministic mines, burn, anti-regeneration | Setup time and poor air coverage |
| Athena Nexus | `m12` or approved early access | Friendly towers | Non-stacking range/rate/mark support | Occupies a pad and cannot carry alone |
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

In production content, every level is a complete immutable stat record, never a runtime delta. UI cards, damage per second, special copy, affordability, next-level comparisons, investment, and refunds derive from those records. The values below are identity/cost-band starting targets, not complete records. Tuning may move a numeric target by up to 15% during the dedicated balance phase without changing the listed role, target mask, cadence identity, level mechanic, or cost order.

### 9.1 Universal rules

- Level 1 uses `buildCost`; Levels 2 and 3 use `upgradeCost`.
- `invested = buildCost + paid upgrade costs`; `sellRefund = floor(invested × 0.70)`.
- Level 2 strengthens the core role. Level 3 adds or completes the visible capstone.
- Upgrade visuals must change silhouette, energy treatment, and at least one moving layer at normal play scale.
- No out-of-run mastery increases combat stats. Mastery is codex/cosmetic progression only.
- Effects use integer ABI time/fixed-point units in simulation; seconds below are player-facing copy.

### 9.2 Level identities and starting costs

| Defense | Costs L1/L2/L3 | Level 1 | Level 2 | Level 3 capstone |
|---|---:|---|---|---|
| Sentinel | 40 / 35 / 60 | 8 damage, 450 ms, range 22 | 12 damage, 410 ms, range 24 | 18 damage, 360 ms, range 26; rail-ballista silhouette |
| Chronos | 55 / 45 / 75 | 3 damage; 35% slow for 1.5 s | 5 damage; 45% for 1.7 s | 8 damage; 55% for 1.9 s; temporal-lock pulse |
| Siege | 75 / 60 / 90 | 18 damage, 1.35 s, radius 5 | 28 damage, 1.25 s, radius 6 | 42 damage, 1.15 s, radius 7; heavy bombard |
| Hoplite Node | 50 / 45 / 75 | One guard slot; 1.2 s block; 5 s recharge | Two slots; 1.4 s block; 4.5 s recharge | Three-slot phalanx; first contact shield-bashes for 25 and 0.4 s stun |
| Oracle Relay | 45 / 40 / 65 | Continuous reveal; marked target takes +8% | +12% mark and larger relay range | Every fifth scan marks up to five targets for 2.5 s |
| Artemis Rail | 80 / 70 / 100 | 55 damage, 1.9 s, range 38, ignores armor | 85 damage; range 42; pierces one aligned target for 60% | 130 damage; range 46; every fourth shot crits for 175% |
| Hermes Wing | 65 / 55 / 85 | One drone, 7 damage every 0.4 s, air priority | Two independent 6-damage drones | Every sixth attack triggers a three-shot intercept burst |
| Poseidon Coil | 75 / 65 / 95 | 15 line damage; 2.5-unit push; drench slow | 22 damage; 3.5 push; longer drench | Every fifth attack is a wide 30-damage maelstrom with 4.5 push |
| Medusa Lens | 70 / 60 / 90 | Every fifth hit petrifies for 1.0 s | Every fourth hit petrifies for 1.2 s | Petrify lasts 1.4 s and splashes in radius 3 |
| Hephaestus Forge | 85 / 70 / 105 | One armed mine; 28 blast plus 3 s burn | Two mine slots; 45 blast; longer burn | 65 blast leaves a 2.5 s molten anti-regen field |
| Athena Nexus | 70 / 65 / 100 | Non-stacking +8% range aura | Adds non-stacking +10% attack rate | Cluster gains +10% damage against Oracle-marked targets |
| Apollo Prism | 90 / 75 / 110 | Beam pulses every 250 ms, ramps from 6 to 24 damage per pulse, and strips shields | Reaches maximum 30% faster | Forks at 60% power to one additional shielded target |
| Hades Gate | 95 / 80 / 120 | Executes non-bosses below 10%; its kills cannot revive | Execute threshold 15% | Threshold 20%; every third execute banishes one nearby wounded non-boss |
| Talos Bastion | 105 / 90 / 130 | 70 armor-piercing damage every 2.2 s | 105 damage and -3 armor for 3 s | 155 damage, stronger break, +40% explicit boss damage |
| Zeus Array | 110 / 95 / 140 | 20 damage chains to three targets | 28 damage chains to five | Every sixth attack adds a bounded eight-target storm pulse |

Before a defense's behavior implementation or production art begins, its reviewed content-annex record receives exact range, cadence, damage/effect values, durations, placement/queue rules, summon/chain caps, boss multipliers, comparator/tie rules, target policies, audio/visual event IDs, and derived UI text at every level. This explicitly includes Oracle scan/mark cadence, Hoplite projection point/queue/recharge, Poseidon drench, Medusa base attack, Forge mine placement/arming, Athena aura radius/source removal, Apollo beam pulse/ramp reset, Hades base attack, and Zeus jump range/falloff. No renderer or HTML file may duplicate balance constants.

### 9.3 Control and status rules

- `reveal`, `mark`, `slow`, `drench`, `block`, `stun`, `petrify`, `burn`, `armorBreak`, `shield`, and `reviveSuppressed` are stable status IDs.
- Each status instance retains its own source, magnitude, application tick, and expiry. Resolution uses the strongest currently active complete instance; equal magnitude prefers later expiry, then lower immutable source ID. It never combines one source's magnitude with another source's duration. Different named statuses may coexist.
- Damage-over-time from the same source refreshes that complete instance rather than stacking. Different sources require an explicit small stack cap and stable source-ID processing order in the content annex.
- Shield pools remain separate source instances and damage consumes the pool with the earliest expiry, then lowest source ID. Aura removal removes only that source's contribution and recomputes the strongest remaining aura.
- Friendly auras never stack with the same aura; the strongest eligible source wins, then lowest tower ID breaks a tie.
- Air ignores block, ground mines, and knockback unless a level explicitly says otherwise.
- Heavy enemies receive 50% displacement. Unless a boss record declares another visible value, `bossControlBp = 2000`: block/stun/petrify duration, displacement magnitude, and slow magnitude resolve at 20% of the ordinary value; slow duration remains unchanged. Nonzero scaled duration has a one-tick minimum. The UI shows `RESISTED` rather than unexplained immunity.
- Execute never applies to bosses. Resistance cannot reduce incoming damage by more than 35% in campaign v1.
- Status/attack order matches the global tick ABI: reveal/target eligibility → shields → armor/resistance → damage/status → guarded boss-threshold transition → terminal death/execute → child/revival scheduling → bounty. Boss execute remains forbidden.

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

Authoring uses validated JSON and a dependency-light Node compiler. It canonicalizes keys, resolves complete level records, compiles path segments/tangents/fixed-point lengths, rejects unknown IDs, and emits a no-bundler classic browser artifact plus a canonical ruleset manifest.

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
- `DISTANCE_SCALE = 1000` and `BASIS_POINTS = 10000`. Authored coordinates/distances permit at most three decimal places and compile with an exact decimal parser; extra precision is rejected. Runtime uses integers only.
- Nonnegative division floors; signed division truncates toward zero. The compiler rejects any configuration whose validated worst-case intermediate can leave JavaScript's safe-integer range. These constants, rounding rules, and caps are part of the ABI descriptor.
- Stable ASCII string IDs identify authored objects. Runtime tower, enemy, summon, projectile, and effect IDs use separate monotonic integer counters allocated only when creation is accepted; denial/reset never rewinds a counter. Batch children/summons allocate in source-ID then authored-index order.
- Named RNG stream seed is `fnv1a32(UTF8(unsignedMissionSeed + "\\0" + streamId))`, consumed by the existing specified `mulberry32` algorithm. Streams and consumption sites are part of the ABI; cosmetics never consume them.
- Durations are not rounded to whole ticks, but state changes resolve only at their named tick phase. A remaining timer is due/expired when, after that phase's 1000-unit decrement, it is `<= 0`; negative overshoot is carried into repeated schedules.
- Tower cooldown begins ready at 0. During the attack phase, subtract 1000 only from a positive remaining cooldown; 0 is already due. If due and a target exists, make at most one attack that tick and add the current level's full cooldown to the negative/zero remainder. If no target exists, clamp to 0 so reacquisition attacks on the next eligible attack phase. Build is immediately ready; upgrade does not rescale an already running cooldown, and the next attack schedules the new level's duration. Content validation requires cooldown at least one tick.
- Spawn/boss repeating timers use the same overshoot carry and a strict authored per-tick event cap; simultaneous due events use authored order then stable ID.
- Movement retains an integer remainder per enemy. Each movement phase computes `numerator = speedDistanceUnitsPerSecond × effectiveSpeedBp + remainder`, divides once by `60 × 10000`, advances by the floor quotient, and stores the modulus. Speed/status changes keep the remainder because the denominator is constant. Signed displacement uses the ABI's truncation rule and route bounds.
- Statuses applied after the expiry phase begin decrementing on the next tick. At the status-expiry phase subtract 1000 and remove before movement/targeting when remaining is `<= 0`; a sub-tick remainder therefore resolves at the first legal phase boundary, never by wall clock.
- Simulation commands are structured records with `{tick, seq, type, ...}`. `seq` is zero-based and strictly increasing within one tick. At the beginning of a tick, accepted commands apply in `seq` order; then scheduled spawns → status expiry/movement → leaks → tower acquisition/attacks → shield/damage/status → guarded boss-threshold transition → terminal death/execute/children/revival → bounty → wave clear. A guarded boss threshold clamps HP and permits at most one authored transition per resolved hit, so a large hit cannot silently skip a required phase.
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
  inputs: [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }],
  checkpoints: [{ tick: 600, diagnosticHash: "fnv1a32:..." }],
  finalClaim: { outcome: "victory", score: 12345, laurels: 3, durationTicks: 18420, finalStateHash: "..." }
}
```

`runId`, timestamps, player/provider identity, media, local notes, pause/speed history, cached snapshots, and presentation settings live in an optional outer metadata/presentation record excluded from canonical gameplay input and state hashes. Cached seek snapshots and event indexes are derived, untrusted, discardable data.

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

- Mission 1 teaches: identify Aether → select highlighted pad → compare/build → start wave. Upgrade and sell appear only when first useful, with Skip/Replay Tutorial.
- For the first three missions the HUD says `AETHER — BUILD CURRENCY`.
- Build cards show portrait, name, role, exact cost, damage, attacks/second, range, target mask, and special from engine data.
- Unaffordable cards say `NEED N MORE`; color/dimming is supplemental.
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
- Every reference resolves; IDs are unique/stable; paths reach a gate; pads are legal; waves are ordered and finite; unlock graph has no cycle.
- Automated headless simulations and manual review show starter-trio campaign completion on Story/Strategos. Strategos diversity requires one available-roster fixture for new-profile `m01`, two for `m02`, and at least three materially different available-roster fixtures for `m03`–`m20`.
- No defense has a strictly dominant cost/damage/control profile across the test matrix.
- Every mission has a distinct battlefield/path/rule, a briefing, a preview, and measurable Laurel objective.

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

Moderated timing uses active simulation time at `1×`, excluding planning, manual pause, and contextual management suspension: Mission 1 median time to first launched wave is at most 90 wall-clock seconds; regular-mission clear median is 5–9 active minutes and p90 at most 12; boss/finale p90 is at most 15. Per-act testing uses at least five representative players, median post-session clarity and enjoyment of at least 4/5, and zero unassisted task-blocking failures in the core loop. A task-blocking issue means a participant cannot discover or complete the required next action without facilitator intervention. Any different sample or device matrix requires a recorded test-plan amendment rather than an informal exception.

### 22.5 Repository and live delivery

- The current bare `node --test` suites in `_kit`, `armaratris`, `serpent`, `breaker`, `flight`, `starfall`, and `aegis` all remain green as tests are added; the current repository baseline is 102/102, above the original 90/90 requirement.
- All JavaScript passes `node --check`; content and asset compilers/validators pass.
- `games/.nojekyll` exists.
- Release commits contain no `research/`, `Assets/`, or `.superpowers/` files.
- The site is considered live only after public `/_kit/shell.js` returns HTTP 200 and a live CDP-driven Aegis boot reaches `body.dataset.ready === "1"` with the current mission's required art ready.

## 23. Deferred approval gates

The offline campaign can proceed with the defaults in this specification. Before the relevant later phase, Ryan must approve one batched decision set covering:

1. Backend operator/host/budget and production domains.
2. Official immutable Armara X account ID and Telegram group/channel ID; bot/admin readiness.
3. Provider credentials, approved scopes, incentive/platform-term review, and exact public copy.
4. First-party account recovery/merge/unlink policy.
5. Identity, proof, replay, audit, IP/rate-limit retention and deletion periods.
6. Whether public ranked/leaderboards are wanted at all; they are not assumed.
7. Whether cross-browser downloadable video beyond guided 10–20 second screen recording is worth a separate encoding project.
8. Final measured asset/network/frame-time budgets after the vertical slice.

No implementation subagent may silently decide these operational/product matters.
