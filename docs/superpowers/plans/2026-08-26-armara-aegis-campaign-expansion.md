# Armara Aegis Campaign Expansion — Implementation Plan

**Date:** 2026-08-26
**Goal:** Deliver a world-class, offline-first twenty-mission Armara tower-defense campaign with fifteen fully upgraded defense families, distinct Greek-AI battlefields, deterministic replays, victory/share cards, and optional social verification.
**Binding spec:** `docs/superpowers/specs/2026-08-26-armara-aegis-campaign-expansion.md`
**Starting point:** Live landscape Aegis with one map, three towers, four enemies, twelve waves, contextual management pause, animation, and 70% selling.

## 1. Non-negotiable execution constraints

- Work on `main` in `D:\ClaudeCode\GameSlop`.
- Preserve all unrelated worktree changes. Never stage or commit `research/`, `Assets/`, or `.superpowers/`.
- Use `apply_patch` for source and documentation edits. Generated/formatting output may use the approved build tools once those tools exist.
- Commit as `Ryan <ryan@xynco.io>` and include exactly:

  ```text
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```

- Run bare `node --test` from inside every game owner folder. The current repository baseline is 102/102 and may only increase.
- Keep classic-script/file-safe boot unless a separately approved architecture change replaces it. No runtime npm install, bundler, or external CDN dependency is assumed.
- Preserve the exact canonical Armara hourglass and `games/.nojekyll`.
- A release is live only after public `/_kit/shell.js` returns 200 and a live CDP-driven Aegis session boots a game with its required art ready.
- Batch product/operations questions into one Ryan decision set at the phase gate that needs them. Implementation agents may not invent provider policy, credentials, public copy, reward value, or data retention.
- Any material architecture work follows brainstorming → binding spec → implementation plan → subagent-driven delivery. This document completes the spec/plan stages; it does not authorize skipping phase gates.

## 2. Delivery strategy

Do not attempt twenty maps and dozens of generated atlases in one pass. The critical sequence is:

1. Freeze stable IDs, deterministic content/replay contracts, and asset validation.
2. Preserve the current live game through a compatibility layer while extracting the kernel.
3. Prove a three-mission/five-defense vertical slice that includes multi-route play and a boss.
4. Build the campaign shell and ship one complete act at a time.
5. Add replay viewing/highlights and post-campaign modes after the simulation contract is stable.
6. Add optional accounts/social proof only after the offline campaign is complete and provider risks are measured.
7. Add ranked/server validation only if Ryan separately approves it.

Every phase must leave a playable green build. Art is generated only after the relevant mechanics and asset schema are proven with procedural/temporary stand-ins.

The existing live single-map Aegis remains the default public route while campaign acts are incomplete. Act checkpoints may be exposed only through an explicit non-default preview flag after Ryan approves a preview; the twenty-mission campaign becomes the default only after Phase 8 release gates. This also prevents the offline/social early-Athena routes from exposing unfinished Act III content.

## 3. Subagent working model

The root integrator owns architecture decisions, shared contracts, integration order, repository state, final verification, commits, publishing, and questions for Ryan. At most three implementation subagents work in parallel with non-overlapping owned paths.

Standard roles:

- **Simulation agent:** pure engine, fixed-point geometry, behaviors, replay, golden tests.
- **Content/balance agent:** JSON authoring, compiler/validators, missions, waves, balance harness.
- **Experience agent:** campaign shell, progression, accessibility layer, loadout/result/replay UI.
- **Art/animation agent:** used in a later turn after another role completes; generated source review, atlases, manifests, renderer presentation, visual QA.

For each parallel batch:

1. Root writes/finalizes the interface contract and assigns exact files.
2. Agents add tests before or with behavior and report assumptions; they do not commit independently unless root explicitly assigns a checkpoint.
3. Root reviews diffs and test evidence, resolves integration, and runs the complete regression matrix.
4. An independent review agent audits determinism/content, UX/accessibility, or art/performance as appropriate.
5. Only root stages exact intended paths, audits the index, commits, pushes, and publishes.

Do not give two agents ownership of `engine.js`, `renderer.js`, generated manifests, or the same content pack in one batch.

From the vertical slice onward, every gameplay phase carries the same experience gate instead of deferring accessibility to final polish: keyboard-only mission journey, focus return, 200% zoom/reflow, `320×568` and `390×844` no-horizontal-scroll checks, Windows Chrome + NVDA, iOS Safari + VoiceOver, and Android Chrome + TalkBack smoke journeys with zero task-blocking issues. The semantic pad list and paused/on-demand route-threat/objective summary grow with each new mechanic.

## 4. Target repository shape

The exact split may be adjusted during Phase 1, but the ownership boundaries must remain equivalent.

```text
games/aegis/
  content/
    schema-version.json
    towers.json
    enemies.json
    bosses.json
    missions/m01.json ... m20.json
    generated/aegis-content.<hash>.js
    generated/aegis-sim.<hash>.js
    generated/manifest.<hash>.json
    generated/release.<hash>.json
  js/
    sim/commands.js
    sim/geometry.js
    sim/behaviors.js
    sim/replay.js
    sim/engine.js
    campaign/profile-store.js
    campaign/migrations.js
    campaign/progression.js
    campaign/entitlements.js
    online/account-client.js
    online/proof-client.js
    delivery/release-loader.js
    replay/player.js
    replay/highlights.js
    ui/campaign.js
    ui/loadout.js
    ui/results.js
    game.js
    renderer.js
  assets/
    common/
    packs/act-1/... act-4/...
  tests/
    content.test.js
    geometry.test.js
    balance.test.js
    engine.test.js
    behaviors.test.js
    replay.test.js
    progression.test.js
    migrations.test.js
    highlights.test.js
    fixtures/...
  sw.js
tools/
  build-aegis-content.js
  analyze-aegis-map.js
  validate-aegis-assets.js
  simulate-aegis.js
docs/aegis-balance/maps/
  m01-pad-report.json
  m01-pad-heatmap.svg
```

Authoring JSON is the source of truth. The hashed generated content/simulation files are browser-safe classic-script artifacts and CommonJS-compatible test artifacts. They must be reproducible and committed so GitHub Pages needs no build step. Arbitrary functions are forbidden in content JSON; stable behavior IDs select reviewed engine implementations.

If splitting the live engine into several browser scripts creates avoidable boot risk, retain a thin `js/engine.js` compatibility facade that exports the same `Game`/CommonJS surface while delegating to the new modules.

## 5. Phase 0 — Baseline, decisions, and risk register

### Outcome

Establish a reproducible baseline and prevent irreversible scale mistakes before changing gameplay.

### Root tasks

1. Record current HEAD, live Pages mirror HEAD, branch, worktree exclusions, current hourglass hash, and `games/.nojekyll` state.
2. Run all seven bare suites and record individual counts: `_kit`, `armaratris`, `serpent`, `breaker`, `flight`, `starfall`, `aegis`.
3. Capture desktop `1280×800` and mobile `390×844` live/local Aegis boot shots as baseline evidence.
4. Add an architecture decision log covering:
   - Fixed authored lanes and fixed pads on the approved hidden `40 × 25` authoring grid; gameplay does not expose free placement.
   - Four world units per grid cell, center conversion `world = 4 × cell + 2`, snapped control-node polylines with no cell-by-cell movement, a buffered twelve-unit road, ordinary-pad road clearance of at least sixteen world units, pad spacing of at least twenty, and authored gate/breach/prop exclusion masks.
   - Three linear levels.
   - Fixed-point/tick simulation before content scale.
   - Static offline campaign; optional service adapters.
   - IndexedDB canonical profile/replay storage.
   - Generated JSON-to-classic-script content artifact.
   - Explicit atlas rectangles/pivots and lazy packs.
5. Create one batched future Ryan decision list for provider/backend/retention/ranked choices. Do not block the offline work on it.

### Parallel risk spikes

- **Simulation agent:** prove fixed-point path movement/target ordering matches Node and browser for a representative grid-authored route, including two different-length lanes, route corners, and a disconnected double-pass coverage window.
- **Content/balance agent:** spike the deterministic map analyzer against the current live map. Its report must identify current pads 2, 5, and 8 as weak/dead placements and pads 6 and 9 as dominant placements before the analyzer is trusted to approve new maps.
- **Experience agent:** prove an IndexedDB victory transaction, migration rollback, and a per-game service-worker scope on GitHub Pages paths.
- **Art/animation agent:** measure one representative 3-level tower pack, one 8-pose enemy atlas, and one battlefield at actual decoded memory/transfer size; verify explicit rectangles eliminate sprite bleed.

Optional-provider spikes are deferred unless Ryan supplies credentials. Documentation-only checks may confirm current official API requirements, but no promise is made from untested provider access.

### Exit gate

- ADR/risk findings reviewed.
- Baseline 102/102 or higher green.
- Proposed 5 MB initial, 3 MB additional pack, 64 MB decoded-mobile, and render budgets accepted or adjusted based on measurements.
- The hidden-grid constants, fixed-pad model, route/pad quality metrics, and deterministic heatmap/report format are recorded before mission authoring begins.
- No mass content or image generation has started.

### Checkpoint commit

`Document Aegis campaign architecture decisions`

## 6. Phase 1 — Content compiler, deterministic kernel, and replay v1

### Outcome

Move the current game behind versioned data and replay contracts without changing its visible play yet.

### Task 1.0 — Freeze the deterministic ABI

**Owner:** Root + Simulation agent
**Files:** architecture decision record, machine-readable ABI descriptor, initial golden fixtures

Before implementation, freeze and test the Specification Section 13 contract: integer time/distance/milli-damage/basis-point scales, exact decimal parsing, safe-integer cross-cancelled rational multiplication/division, named floor/ceiling boundaries, internal/external/shield/mitigation coefficient order, sub-tick cooldown/spawn/status due boundaries and overshoot carry, movement and mission-scoped bounty numerator/remainder carry, idle/reacquisition behavior, command phase and `seq`, tick/status/boss order, runtime ID allocation, named RNG derivation/algorithm, canonical state encoding/hashes, comparator ties, and the simulation/presentation boundary. Node and browser must consume the same descriptor and golden vectors before Tasks 1.1/1.2 are accepted.

### Task 1.1 — Stable schemas and compiler

**Owner:** Content/balance agent
**Files:** `games/aegis/content/**`, `tools/build-aegis-content.js`, `games/aegis/tests/content.test.js`

Steps:

1. Define JSON schemas/validators for ruleset manifest, tower, enemy, boss, grid, route, fixed pad, prop/exclusion mask, wave group, mission economy envelope, objective, reward, asset pack, and localized string key.
2. Use stable string IDs everywhere. Add duplicate, missing-reference, unlock-cycle, path-end, grid-snap, zero-length/illegal segment, route-connectivity, undeclared crossing/near-pass, road-buffer, pad-bounds/spacing/clearance, prop-mask, negative timing/economy, unknown behavior, and unordered simultaneous-event failures.
3. Compile full level records, exact integer time units, fixed-point grid/route geometry, road occupancy, route lengths/tangents, pad coverage windows, derived stat copy, and canonical key order. Route endpoints may use declared off-board portal cells; ordinary route nodes and every pad remain grid-snapped.
4. Hash length-prefixed ABI descriptor bytes plus the exact immutable self-contained simulation artifact and exact compiled content bytes into `rulesetHash`; renderer/art/UI bytes are excluded. The artifact embeds all deterministic RNG/hash/fixed-point/canonical helpers and rejects undeclared globals/imports.
5. Emit deterministic immutable simulation/content filenames and manifests using only Node built-ins. Node, browser, replay viewer, and later validator load the same bytes; CI rejects mixed/mutable artifacts or a simulation/helper change without a new ruleset identity.
6. Encode the current live `160 × 100` map, old tower costs/stats, enemies, and waves only inside a temporary `legacy-proving-ground` parity fixture. Production `m01` and later manifests must reject references to those legacy records; no legacy cost/stat fallback remains in renderer, HTML, store copy, or production content.
7. Prove a second compiler run produces byte-identical output.

Tests:

- Valid fixture compiles.
- Every invalid-reference class fails with a useful path/message.
- Bounded decimal authoring converts through the ABI's exact parser to time/fixed-point/basis-point integers; extra precision/overflow is rejected.
- Output and hash are stable across repeat runs.
- Changing one deterministic helper byte changes `rulesetHash`; the simulation artifact runs with `_kit` deterministic globals absent.

### Task 1.1A — Hidden-grid map analyzer and review artifacts

**Owner:** Content/balance agent after Task 1.1 schema review
**Files:** `tools/analyze-aegis-map.js`, compiler-side geometry helpers, `games/aegis/tests/content.test.js`, `games/aegis/tests/fixtures/maps/**`, `docs/aegis-balance/maps/**`

Write failing geometry fixtures before the analyzer implementation, then add:

1. One universal `160 × 100` logical board represented by a hidden `40 × 25` grid of four-world-unit cells. Convert cell centers with `world = 4 × cell + 2`; do not add free-placement input or expose the grid as a visible game mechanic.
2. Routes authored as ordered grid-snapped control-node polylines with stable route/layer IDs. Consecutive nodes may form cardinal, diagonal, or other straight lattice segments; the compiler emits continuous fixed-point segments for movement/rendering rather than cell-by-cell enemy motion. A buffered twelve-unit road mask and explicit crossing/overpass declarations drive validation. Zero-length segments, undeclared overlap/crossing, and bends too tight for the road fail, while rings, arcs, spirals, and the Ω finale remain representable without Manhattan stair steps.
3. Fixed pads authored by grid cell and intent tag. Ordinary pads require at least sixteen world units from a lane centerline, at least twenty between pad centers, at least eight inside the board, and at least twenty from breach/gate/large-prop centers unless a stricter authored exclusion mask applies.
4. Exact circle/polyline coverage analysis. For every pad/range/targetable route, calculate total in-range arc length, merged continuous windows, re-entry count, longest window, mean route stage, per-route/worst-route exposure, air-route exposure, neighbor/support graph, and tower-behavior probe inputs. Multi-route averages may not hide zero coverage on a route that the pad claims to serve.
5. A deterministic JSON report and self-contained, script-free SVG heatmap for each reviewed mission. Normal play shows only the selected defense's range circle and covered-road glow; numeric tiers/heatmaps remain authoring/debug evidence.
6. Production `--check` mode that rebuilds reports in memory and fails on stale checked-in artifacts, unstable sort/order, changed grid constants, invalid intent declarations, or a pad outside its approved quality band. A separate `--report-known-issues` mode exists only for `legacy-proving-ground`, must reproduce its approved dead/dominant-pad findings, and can never approve that fixture for a campaign manifest.

Golden tests must cover a straight, an inside corner, a diagonal, a multi-node arc/spiral approximation, two disconnected passes, two routes, an overpass layer, an air lane, tangent/no-coverage boundaries, gate/prop masks, and stable fixed-point rounding. Include a deliberately invalid version of the legacy layout so dead pads and an excessive power spread remain regression failures rather than visual opinions.

Verification from the repository root after the tool exists:

```powershell
node tools/build-aegis-content.js --check
node tools/analyze-aegis-map.js --mission legacy-proving-ground --report-known-issues
node tools/analyze-aegis-map.js --mission m01 --check
Push-Location games/aegis
node --test
Pop-Location
```

### Task 1.2 — Simulation extraction and fixed-point geometry

**Owner:** Simulation agent
**Files:** `games/aegis/js/sim/**`, compatibility `games/aegis/js/engine.js`, `games/aegis/tests/geometry.test.js`, focused engine fixtures

Steps:

1. Preserve the public engine API long enough for current `game.js`/`renderer.js` to run.
2. Replace global `PATH/PADS/WAVES/LAST_WAVE` assumptions with a resolved mission record compiled from the hidden grid. The simulation consumes the exact compiled route segments/pad coordinates used by the analyzer; it does not independently reinterpret source cells.
3. Compile/store enemy `routeId`, fixed-point distance, remaining distance, segment, and destination.
4. Target across lanes by least remaining distance, then threat priority, then runtime enemy ID.
5. Convert authored integer milliseconds to exact ABI time units while the scheduler advances fixed ticks; compile geometry, percentages, HP/shields/flat armor, direct damage, and damage-over-time through the same fixed-point descriptor. Preserve milli-damage through internal coefficients, summed/clamped external amplification, shield pools, armor, resistance, and HP rather than rounding between authored whole-damage values.
6. Introduce the ABI's exact named seed-derived RNG streams. Remove whole-wave shuffle; retain only explicit group shuffle.
7. Add mission-scoped `bountyRemainder` to canonical simulation state. For each earned original-lineage bounty event in stable terminal-event order, compute `bountyNumerator = bountyRemainder + baseLineageBounty × difficultyBountyBp`, award `floor(bountyNumerator / 10000)`, and retain `bountyNumerator % 10000`. Initialize it only at mission start; include it in checkpoint/final hashes and replay validation. Fixed wave-start deployment and wave-clear grants do not enter bounty scaling.
8. Preserve cumulative integer investment and compute the exact refund as `floor(invested × 70 / 100)` with checked safe-integer multiplication/division. Never use `Math.floor(invested * 0.70)`, whose binary floating-point result can underpay values such as 90.
9. Keep simulation state plain canonical-serializable data with no DOM/network/storage/renderer access.

Tests:

- Legacy-fixture tower costs/damage/cooldowns and production selling semantics. Generate cumulative investment/refund goldens from all fifteen defenses' three content levels; include explicit Siege `90 → 63`, `175 → 122`, `315 → 220` and Athena `90 → 63`, `185 → 129`, `340 → 238` fixtures so a floating-point `90 → 62` regression fails.
- Long golden vectors for 410 ms and 1350 ms cooldown carry, idle/reacquisition/upgrade/link/unlink/enable cadence, exact external-rate ceiling without in-progress rescaling, non-divisible movement remainder, spawn overshoot, and status expiry exactly on an attack/command tick.
- Milli-damage goldens cover exact rational coefficient ordering and one named final floor: base `8` plus only `+8%` external damage is `8640`, small bonuses survive shield/armor/resistance stages, positive non-immune HP damage floors at one milli-damage, and Node/browser/replay hashes agree.
- Path end/corner/no-overshoot on single and multiple lanes.
- Grid-to-world conversion, road/pad compiled coordinates, coverage-boundary rounding, and an `m01` power-pocket golden vector match compiler fixtures exactly.
- Different-length-lane priority and deterministic ties.
- Ordered spawn groups and explicitly shuffled interchangeable groups.
- Difficulty/start-Aether goldens: base Mission 1 resolves to Story/Strategos/Titan `178 / 150 / 136`; no-Reserve Assist resolves to `198 / 170 / 156`; Reserve adds its declared `+10` or `+20` after difficulty and Assist adds `+20` last. Small sub-ten Story bounties accumulate the `110%` modifier through the mission-scoped remainder, fixed deployment/clear grants remain unscaled, and Node/browser/replay hashes retain the same remainder.
- Fixed tick-order golden scenarios.

### Task 1.3 — Structured commands and replay envelope

**Owner:** Simulation agent after Task 1.2
**Files:** `commands.js`, `replay.js`, `replay.test.js`, golden fixtures

Steps:

1. Replace string parsing internally with structured commands; use `defenseId` for authored tower families and distinct integer runtime entity IDs; keep a temporary adapter for existing shell actions.
2. Add monotonically ordered `{tick, seq}` for multiple management actions while simulation is suspended.
3. Define replay format v1 with ruleset/event versions, mission, difficulty, Assist, seed, loadout, campaign/access modifiers, resolved `tutorialUpgradeGateMode`, commands, checkpoints, and final claim. Resolved modifier IDs, tutorial gate mode/state, and the canonical mission-scoped bounty remainder participate in state hashes. Keep run IDs, timestamps, pause/speed, media, cached snapshots, and presentation state in an outer noncanonical record. Add the recorded `skipTutorialGate` command and stable `tutorial-gated` Upgrade denial; replay validation never consults mutable profile tutorial state.
4. Implement canonical state hashing and `simulateReplay`.
5. Add bounded parser limits for bytes, ticks, entity counts, commands per tick, and action types.
6. Create golden fixtures for build/upgrade/sell, wave clear, defeat, victory, multi-route targeting, integer-time cooldowns, IDs/RNG, and command-phase order.

### Task 1.4 — Immutable release loader and minimal offline protocol

**Owner:** Experience/delivery agent
**Files:** release manifest/compiler output, `js/delivery/release-loader.js`, `sw.js`, delivery tests

1. Generate a versioned release manifest that pins ruleset artifact and transitive asset-pack hashes, compressed bytes, and decoded-byte estimates.
2. Use only relative deployment URLs; never assume domain-root `/aegis/`.
3. Under HTTP(S), register a per-Aegis service worker that precaches the shell/current proving-ground pack and installs immutable updates beside active caches.
4. Never activate an update into an active run. Add a multi-tab run lease and between-run update prompt.
5. Under `file://`, load committed classic-script content and relative art without runtime JSON `fetch()` or a service worker. Capability-test durable storage and show Session Only when it cannot be proven.
6. Test HTTP/file boot, update during run, two tabs, missing/corrupt cache, and old-engine/new-content mismatch rejection.

### Root integration

1. Review generated diff and module load order.
2. Update `index.html` only as needed to load compatibility modules.
3. Prove both declared local HTTP and direct `file:` boot/storage contracts.
4. Compare current visible mission behavior to baseline through `legacy-proving-ground` only; document intentional replay-format changes. Production `m01` deliberately uses the approved new grid, costs, waves, and economy and must never inherit parity fallbacks.
5. Run Aegis and all-game regressions plus `node --check`.

### Exit gate

- Current live experience still boots and is playable.
- The same golden replay yields identical checkpoint/final hashes in Node and browser.
- No combat data is duplicated in renderer/HTML.
- Compiler output is deterministic.
- Release manifests prevent mixed rulesets; HTTP and direct-file modes pass their distinct boot/storage contracts.
- All suites green.

### Checkpoint commits

1. `Add versioned Aegis content compiler`
2. `Add deterministic Aegis map analysis`
3. `Extract deterministic Aegis simulation`
4. `Add Aegis replay format v1`
5. `Pin immutable Aegis release bundles`

## 7. Phase 2 — Three-mission/five-defense vertical slice

### Outcome

Prove the hardest campaign architecture before scaling art or authoring all acts.

Technical slice content:

- `m01` Gate of Dawn: tutorial/single path.
- `m04` Piraeus Switchyard: two authored entrances that merge.
- `m05` Bronze Warden: boss script and eight-wave pacing.
- Sentinel, Chronos, Siege, Hoplite Node, and Oracle Relay.
- Scout, Raider, Guardian, Echo, Titan, and Talos Prototype.
- Temporary Artemis reward record may exist, but production combat/art for Artemis waits for Act I completion.

The slice uses a non-default `slice-dev-v1` manifest, explicit developer entry, and disposable `aegis-slice-dev` profile/database. It never changes production `m01 → m02 → m03` prerequisites or writes completion into a production profile. The normal public Aegis route remains the current live game until Act I passes its release gate.

Before implementation, review a complete slice content annex with exact route/pad geometry, integer economy/timing, all five defenses' full level records, enemy/boss values, ordered waves, target/status rules, objectives, and harmless-preview declarations. The candidate annex may use procedural stand-ins for behavior tests, but it is not balance-approved and production art may not begin until Task 2.1A passes.

### Approved Mission 1 slice lock

`m01` is the first production proof of the hidden grid. Its authored Greek-key S uses:

```text
grid route:  (-2,5) → (11,5) → (11,18) → (28,18) → (28,9) → (41,9)
world route: (-6,22) → (46,22) → (46,74) → (114,74) → (114,38) → (166,38)
```

The route length is 260 world units. The ten fixed pads are ordered by covered route stage so keyboard cycling remains meaningful:

| Pad | World center | Intent | L1 exposure evidence at ranges 20 / 22 / 24 |
|---:|---:|---|---:|
| 1 | `(14,38)` | Early standard | `24.0 / 30.2 / 35.8` |
| 2 | `(62,34)` | Standard | `24.0 / 29.5 / 34.7` |
| 3 | `(30,58)` | Standard | `24.0 / 30.2 / 35.8` |
| 4 | `(66,58)` | Deliberate double-pass power pocket | `24.0 / 48.5 / 62.3` |
| 5 | `(62,90)` | Standard | `24.0 / 30.2 / 35.8` |
| 6 | `(82,90)` | Standard | `24.0 / 30.2 / 35.8` |
| 7 | `(102,90)` | Standard | `24.0 / 29.5 / 34.7` |
| 8 | `(98,54)` | Deliberate double-pass power pocket | `24.0 / 48.5 / 62.3` |
| 9 | `(126,22)` | Standard | `24.0 / 29.5 / 34.7` |
| 10 | `(146,54)` | Late standard | `24.0 / 30.2 / 35.8` |

All ten centers are exactly sixteen world units from their nearest lane; minimum pad separation is twenty. At range 22 the Standard pads measure `29.539–30.199` and the two Strong pockets measure `48.530`, so the exact maximum/minimum ratio is approximately `1.643` and the review ceiling is `1.65`. Pads 4 and 8 are the only authored power pockets; their disconnected passes, route stage, and reacquisition behavior are preserved as tradeoffs rather than flattened away. The checked-in analyzer report and SVG are part of the slice review.

Baseline Mission 1 Strategos without Assist or Reserve starts at exactly `150` Aether. Its six inclusive perfect-kill maximum earnable/spendable wave envelopes are `30 / 40 / 45 / 50 / 55 / 60`; each envelope already includes every declared wave-start deployment grant, original-lineage bounty, and wave-clear grant attributable to that wave and must never be added on top of another reward table. Leaks/escapes can reduce realized bounty income. The maximum gross available Aether is exactly `150 + 280 = 430`. The accepted Wave-6 start command credits its entire `60` deployment grant before the first spawn; Wave-6 kill and post-clear Aether are zero, so the full amount remains tactically spendable. Other difficulty/Assist/campaign modifiers resolve to separate declared ledgers and record keys rather than silently changing this baseline.

The slice annex uses the revised binding costs: Sentinel `60 / 55 / 95`, Chronos `75 / 70 / 115`, Siege `90 / 85 / 140`, Hoplite `80 / 75 / 120`, and Oracle `70 / 70 / 110` for Level 1 / Level 2 / Level 3. These are complete immutable level records when combined with the binding spec's revised damage/cadence/range/effect values; no old renderer fallback or starting-target table may survive. Later act annexes perform the same complete-record review for their newly activated defenses before their behavior/art batches. The approved costs and Mission 1 start/envelopes are binding balance anchors, not values covered by the generic tuning allowance; changing one requires a short spec amendment and Ryan approval.

For the unassisted, unmodified new-profile Strategos 430-gross ledger only, winning balance targets are `360–410` net consumed (`resolved start + realized earnings − final bank`), a final simultaneous state of four or five built towers plus roughly two meaningful paid upgrades, no more than seven cheapest Level-1 towers simultaneously at any state (`7 × 60 = 420`, while `8 × 60 > 430`), and median unspent Aether below `65`. Story, Assist, Reserve, and later campaign modifiers use their own declared ledgers and do not inherit those absolute build/bank thresholds. Because selling returns 70%, lifetime build count and gross purchase debits may exceed seven/430 without violating the simultaneous-investment ceiling; selling cannot increase that ceiling. The harness reports gross purchase debits, sale refunds, net consumed, final invested Aether, final tower/upgrade state, and final bank separately; it also records the full bank distribution diagnostically without introducing an unapproved percentile threshold. For every ledger, resolve `eligibleUnspentAether = max(0, finalBank - campaignModifierAether - assistAether)`, compute the content-versioned `rawUnspentScore`, and cap `unspentScore = min(rawUnspentScore, floor(nonAetherScore / 19))` before adding it, which guarantees no more than `5%` of final total score comes from unspent Aether.

Only on a new profile's first non-skipped `m01` tutorial run, Upgrade stays hidden or disabled through Wave 1, appears immediately after the Wave 1 clear, and receives one contextual prompt around Wave 2. The resolved replay/header gate mode and canonical state—not mutable profile lookup—control legality: a hostile pre-clear Upgrade is denied `tutorial-gated`, while a recorded `skipTutorialGate` command opens it immediately. Replaying the mission normally uses mode `none`; Replay Tutorial explicitly restores the gate. Level 2 and Level 3 have no later wave locks in any mission; affordability and player choice govern them.

### Task 2.1 — Behavior registry

**Owner:** Simulation agent
**Files:** `sim/behaviors.js`, `behaviors.test.js`, engine integrations

Implement composable reviewed behaviors before tower-specific content:

- direct projectile, splash, slow, reveal, mark, block/spawn unit, armor, shield, boss threshold, child spawn, EMP/disable, damage-over-time, aura, chain, execute, displacement.
- Deterministic status registry/order/stacking and boss scaling.
- A visible `Resolve` status after hard control ends: `1.0 s` regular, `1.5 s` heavy, `2.5 s` boss. Block, stun, and petrify cannot reapply during Resolve. Slow and drench use one strongest movement-reduction instance, then `scaledReductionBp = floor(strongestReductionBp × enemySlowControlBp / 10000)` and `effectiveSpeedBp = max(enemyMinMovementBp, 10000 - scaledReductionBp)` against post-difficulty/Assist base speed. Regular defaults are `10000` control and a `5200` minimum; every Heavy declares both values, and every boss declares its minimum while defaulting control to visible `bossControlBp = 2000`. Knockback has a per-target `1.5 s` cooldown.
- Global external support/debuff amplification resolves same-name strongest sources first, sums distinct surviving source types in stable order, and clamps to `externalDamageBp <= 2000`, `externalRateBp <= 1500`, and `externalRangeBp <= 1200`. Preserve milli-damage through internal hit coefficients, the summed external damage coefficient, shield coefficient/pools, armor/ignore/break, resistance, and HP. Range floors once before squared fixed-point comparison; rate uses exact integer ceiling, and upgrade/link/unlink/enable/source changes never rescale an already-running cooldown.
- Semantic events for animation/audio/highlight selection.

The slice only turns on behaviors it uses, but the registry API must accommodate the final set without adding fifteen `if (tower.type)` branches.

Behavior tests are written first and cover Resolve start/end boundaries and simultaneous hard-control bucket collisions; rejected reapplication leaves Resolve itself neither consumed nor postponed, an already-fired rejected Medusa charge is consumed, and Hoplite prefilters ineligible targets before assigning a guard. They also cover Heavy/boss durations and declared slow controls/floors, strongest-only slow/drench with exact pre-floor scaling, knockback cooldown, same-name strongest-source selection, distinct-source sums and cap saturation, `8 + 8% = 8640` milli-damage, internal Lock-On/crit/center/pierce/chain/boss coefficient order, shield/armor/resistance boundaries, exact range/rate arithmetic, no in-progress cooldown rescaling, source removal/recalculation, and replay-identical semantic events.

### Task 2.1A — Tower, placement, and economy balance lab

**Owner:** Content/balance agent after Task 2.1 behavior interfaces are frozen
**Files:** `tools/simulate-aegis.js`, `games/aegis/tests/balance.test.js`, `games/aegis/tests/fixtures/balance/**`, slice content annex and witness replays

Build this before production tower/map art. Start with failing assertions for the approved Mission 1 economy, dead/random placement negative controls, and matched-cost tower weaknesses. The lab must:

1. Load the same compiled mission, defense, enemy, ABI, and geometry bytes as the game; renderer constants or separate calculator copies are forbidden.
2. Audit each source in the six inclusive perfect-kill wave envelopes, prove no duplicate deployment/bounty/clear path, prove exact baseline `150` start and `430` unrecycled gross ceiling, prove escapes reduce rather than defer bounty income, and prove the Wave-6 start command credits `60` before its first spawn while Wave-6 kill/final-clear Aether remains zero. Assert Story/Strategos/Titan starts `178 / 150 / 136`, no-Reserve Assist starts `198 / 170 / 156`, modifier order, compact-bounty remainder carry, and separately resolved ledgers. Report lifetime purchase debits and sale refunds separately so legitimate 70%-refund churn cannot be mistaken for creating Aether.
3. Exercise each starter and slice defense at all three exact annex levels on standard and power-pocket pads. Report cost, total investment/refund, shots/effect activations, overkill, leak prevention, Aether timing, coverage/re-entry behavior, and marginal value per paid upgrade.
4. Check the full legal build/upgrade sequence space with bounded strategy templates, then retain human-readable winning witness replays and intentionally poor controls. A one-tower/no-upgrade run and seeded legal-random placement/spending must fail during Wave 5 or 6 on Strategos; route-aware play should finish at `18–20` integrity and reasonable imperfect play at `12–17`. For the placement gate, pair runs at the same seed, loadout, resolved spend, command/upgrade timing, target policies, and wave inputs. The route-aware plan must deliver at least `15%` higher versioned `combatValuePerAether = (non-overkill damage + declared control/support credit + prevented-leak damage at the same checkpoint) / net Aether consumed`; campaign score is excluded. A route-aware clear paired with a naive Wave-5/6 defeat passes automatically, but both raw values and the exact versioned formula/scenario ID remain in the report.
5. Reject strict same-budget dominance across the defense role matrix. Every defense must retain its declared weakness, at least one favorable scenario, and a meaningful Level-2 and Level-3 purchase; raw DPS alone cannot approve control/support/spawn defenses.
6. Emit a deterministic matrix report covering Story/Strategos/Titan, all reviewed pads, three representative spawn-density profiles, armor/air/control/resistance cases, and negative controls. Automated results select candidates for human playtesting; they never substitute for it.

Required focused commands after implementation:

```powershell
node tools/build-aegis-content.js --check
node tools/analyze-aegis-map.js --mission m01 --check
node tools/simulate-aegis.js --mission m01 --difficulty strategos --matrix
Push-Location games/aegis
node --test
Pop-Location
```

### Task 2.2 — Campaign shell skeleton

**Owner:** Experience agent
**Files:** `index.html`, `css/aegis.css`, `ui/campaign.js`, `ui/loadout.js`, `game.js`

Implement:

- Hub, three-node temporary campaign map, mission briefing, difficulty selection, loadout builder, and return navigation.
- One-through-four-slot loadouts with locked previews and exact unlock text; a new-profile Mission 1 begins with the starter trio in a four-slot-cap loadout.
- Mission-select loading while keeping the page/file-safe.
- Context store derived from equipped IDs; no hard-coded three-card UI.
- Fixed-pad selection derived from the compiled grid record. Comparing a defense draws its true Level-1 range and highlights only the targetable route segments/air lanes covered from that pad; the authoring grid and numeric quality tier stay hidden.
- Mission 1's one-wave upgrade reveal, exact current/projected Aether, and inclusive wave-income events. The UI never implies that the wave envelope is a second bonus pool.
- Semantic companion state for canvas and keyboard/touch parity.
- Recovery/error state for missing or corrupt mission data.

### Task 2.3 — Profile/progression transaction

**Owner:** Experience agent after storage spike
**Files:** `campaign/profile-store.js`, `migrations.js`, `progression.js`, tests

Implement:

- IndexedDB database/profile schema v1 plus the direct-file fallback contract. Blocked/unavailable durable storage is visibly Session Only before Start, never a silent memory save.
- Atomic result + replay + unlock write.
- Quota recovery that prunes eligible old replays and retries, then preserves compact victory/progression even if replay storage remains unavailable.
- Separate progression and record rows keyed by mission/difficulty/ruleset/resolved-modifier hash/Assist, with distinct referenced replay IDs for best score, fastest time, and best Laurels.
- Pure idempotent migration harness, recovery copy, import/export.
- No network dependency.

### Task 2.4 — Representative production art pipeline

**Owner:** Art/animation agent
**Files:** `tools/validate-aegis-assets.js`, slice asset packs/manifests, relevant renderer code

Steps:

1. Read and follow the image-generation skill for production bitmap work.
2. Inspect the user-provided Armara references read-only and the current canonical hourglass before generation.
3. Generate and normalize one battlefield, one three-level modular tower, one summon, one regular enemy, and one boss/phase set in ancient-Greece-meets-AI style.
4. Write explicit rectangles, pivots, anchors, projectile origins, and gutters to the manifest.
5. Mechanically reject missing alpha, frame bleed, clipped silhouettes, unexpected dimensions, bad hashes, and budget violations.
6. Inspect every frame at source size and actual gameplay size against the real background.
7. Do not add to, alter, rename, or stage the user-owned `Assets/` directory. Keep generated masters in the image-generation output location or a separately approved source-art repository; commit only optimized runtime assets under `games/aegis/`.

### Root integration and test scenarios

- Complete `m01`, unlock Hoplite, reload, and prove persistence. Reconcile the event ledger to exact `150` start, six inclusive envelopes, Wave-6 pre-spawn `60`, `430` unrecycled maximum gross, zero Wave-6 kill/final-clear Aether, gross purchase debits, sale refunds, net consumed, final investment/state, bank, and clamped score contribution.
- Drive all ten `m01` pads, verify the two approved power pockets and eight standards against the checked-in analyzer report, and prove range/covered-road preview matches simulation targeting at boundary cells.
- Prove the first non-skipped `m01` tutorial gate is resolved into the replay header/canonical state, denies a hostile pre-clear Upgrade with `tutorial-gated`, opens on recorded Skip or Wave-1 clear, and never consults current profile state during replay; normal replay mode exposes Upgrade immediately and Replay Tutorial restores the gate explicitly.
- Start `m04` with two routes; prove route preview, target tie-break, leak, and replay match.
- Complete/fail `m05`; prove boss phases are simulation events and animation timing cannot affect them.
- Build/upgrade/sell all five slice defenses, including exact refunds and confirmation.
- Resize/orient mid-run without mutation.
- Disable IndexedDB/network/art and prove honest fallbacks.

### Exit gate

- Three missions meet the specification's newcomer task-completion, clarity/enjoyment, active-time, and zero-task-blocker moderated thresholds.
- New-profile `m01` has at least three committed Strategos purchase/placement witness replays with materially different first pads, upgrade timing, and Sentinel-focus/Chronos-control/Siege-cluster emphasis; `m04`/`m05` have at least two materially different available-slice-loadout witnesses; starter trio clears all three.
- Mission 1 calibration, with Assist off, lands at `60–70%` Strategos first-attempt victory and greater than `85%` cumulative cohort success after at most one informed retry, using at least twenty first-time Strategos participants across at least two instrumented rounds. A separate cohort of at least twenty first-time Story participants has a greater-than-`90%` first-attempt target. Treat these as balance-calibration gates, not statistically powered population claims: record tower-defense experience/device/sample mix, retain the separate five-session moderated qualitative review, and rerun after a material map, economy, wave, or starter-defense change.
- Successful route-aware Strategos runs finish at `18–20` integrity, reasonable imperfect wins at `12–17`; one-tower and seeded-random controls fail on Wave 5 or 6; matched placement-aware strategies meet Task 2.1A's versioned `combatValuePerAether` definition and beat paired naive placement by at least `15%` (or satisfy its documented aware-clear/naive-defeat auto-pass).
- Unassisted, unmodified new-profile Strategos economy evidence on the 430-gross ledger meets `360–410` typical net consumed, a final state of four or five towers plus roughly two meaningful upgrades, at most seven cheapest Level-1 towers simultaneously at any state, and median bank below `65`; sale/rebuild lifetime totals remain separately visible and never increase simultaneous investment above realized gross. Separate Story/Assist/Reserve/campaign ledgers are judged against their own declared targets. Every ledger proves the exact integer unspent-score formula and a final-total score share no greater than `5%`.
- Asset and decoded-memory budgets pass with extrapolation for six equipped towers.
- Five moderated first-time-player sessions reach the Mission 1 comprehension target or defects are fixed/retested; their qualitative findings are recorded separately from the instrumented rate cohort.
- The standard per-phase keyboard/focus/zoom/reflow/screen-reader/mobile gate passes for the slice.
- Root and an independent architecture/UX review approve scaling.

### Checkpoint commit

`Prove Aegis campaign vertical slice`

## 8. Phase 3 — Campaign foundation and Act I production

### Outcome

Complete a polished five-mission first act and all cross-act foundation systems behind the non-default campaign preview.

### Parallel assignments

- **Content/balance:** final `m01`–`m05`, hidden-grid routes/fixed pads plus deterministic reports/heatmaps, six/eight-wave groups, first five regular enemies, Talos Prototype, Laurel objectives, Story/Strategos/Titan presets, and balance-lab scenarios.
- **Simulation:** finish Hoplite/Oracle/Artemis behavior records, boss controls/resistances, target policies, Blueprint/Reserve modifier plumbing even if later rewards are locked.
- **Experience:** full four-act/twenty-node map states, mission briefings, tutorial steps, codex shell, result screen, reward transaction, five-slot unlock presentation.

The complete Act I JSON—exact grid routes/pad cells and intent tags, analyzer reports/heatmaps, integer base economy and reward ledgers, complete immutable defense/enemy/boss values, ordered groups, objectives/thresholds, and harmless-preview declarations—is reviewed as the binding Act I content annex before the art batch or behavior implementation proceeds. The reviewer must reconcile every activated defense against the binding revised three-level annex and the balance lab; copied legacy costs, incomplete effect parameters, or renderer fallbacks block approval.

### Art batch

After mechanics/data review, the art agent produces:

- Five distinct Act I quiet battlefields and route/pad overlays.
- Hoplite, Oracle, and Artemis portraits, three-level base/top atlases, required Hoplite sub-units.
- Scout/Raider/Guardian/Echo/Titan production animation coverage.
- Talos Prototype phases/ability art.
- Act I props, HUD/codex silhouettes, and loading thumbnails.

All starter assets are migrated into the new manifest and revalidated; do not assume legacy atlases have correct gutters/anchors.

### Foundation UX requirements

1. `CONTINUE MISSION` in two actions or fewer.
2. All twenty node names/numbers/rewards visible, with only Act I playable.
3. Tutorial order is Aether → highlighted pad → compare true coverage/build → launch Wave 1. On the first non-skipped Mission 1 tutorial only, Upgrade remains hidden/disabled until Wave 1 clears, then appears with one contextual prompt around Wave 2; Skip and mission replay expose it immediately, and no Level-2/Level-3 wave locks exist after that reveal. Sell is an optional later contextual lesson, never a forced destructive step. Skip/Replay Tutorial persists.
4. One-through-four-slot loadout, locked previews, training trials, and exact next unlock.
5. `FRONT/STRONG/FAST` controls only where valid.
6. Result saves before UI; Next Mission primary; defeat cause/hint.
7. Local 1200×675 victory card may use a temporary layout now; final polish occurs in Phase 7.

### Balance/QA gate

- Headless scripted runs for every Act I mission on all three difficulties.
- Compiler/analyzer `--check` passes for all five grid maps; checked-in reports prove route/pad/prop clearance, per-route coverage, declared power/specialist intent, and no undeclared dead or strictly dominated pad.
- Starter-trio clear on Story/Strategos.
- New-profile `m01` has one available-roster loadout witness plus the three distinct starter purchase/placement witnesses required above, `m02` has two materially different available-roster loadout witnesses, and `m03`–`m05` have at least three; full-roster debug runs are supplemental only.
- Manual no-guide first-run testing.
- Every tower level/refund/status/boss threshold/mission reward direct-tested.
- Every economy source reconciles to its inclusive mission envelope; build/upgrade timing, bank distribution, pad occupancy, and upgrade marginal value are reported rather than inferred from victory alone.
- Desktop/mobile visual set for all five maps and every Act I tower level.
- Standard per-phase keyboard/focus/zoom/reflow/screen-reader/mobile gate with zero task-blocking issues.
- All-game regressions remain green.

### Checkpoint commit

`Ship Armara Aegis Act I campaign`

## 9. Phase 4 — Act II: routes, air, displacement, and EMP

### Outcome

Add `m06`–`m10`, the fifth/sixth-slot progression, three new defenses, air routes, authored route-state mechanics, and a second boss.

### Content/balance agent

- Author Delos Airspace, Naxos Labyrinth, Poseidon's Clock, Rhodes Ring, and Cyclops Kernel.
- Author every ground/air route, fixed pad, crossing layer, hazard sector, gate/breach/prop mask, intent tag, and deterministic map report on the approved hidden grid. A high combined exposure score cannot conceal a dead claimed route or air lane.
- Add Harpy Drone and Shield Bearer records/waves.
- Author tide schedules, solar sectors, and three-spoke EMP script in ticks.
- Ensure Sentinel/Artemis already answer air and raw damage can answer shields.
- Add Story/Strategos/Titan simulation matrix and Laurel objectives.

Review the complete Act II content annex—grid cells/compiled coordinates, pad-quality reports/heatmaps, integer economy, all complete level/effect values, ordered groups, objectives, preview declarations, hazards, and boss script—before behavior/art production. Run the matched-budget balance lab for Hermes, Poseidon, and Medusa and record their favorable cases, deliberate weaknesses, all three upgrade values, and negative controls before art begins.

### Simulation agent

- Implement target masks and independent air-route interpolation.
- Add Hermes multi-drone targeting with stable assignment.
- Add Poseidon bounded path-distance decrease with heavy/boss resistance and no underflow.
- Add Medusa cadence/petrify and bounded splash.
- Implement solar shields and warned EMP disable state; towers remain inspectable/sellable.
- Add Blueprint Reset as a distinct pre-Wave-1 atomic command available after first clearing `m09`: remove all towers, restore resolved starting Aether, clear simulation selection, and never rewind tick/sequence/log/entity IDs.

### Experience agent

- Show route layer/ID at overpasses and the next authored tide route.
- Present airborne/ground target masks and shield/control resistance clearly.
- Expand store/loadout to five slots after `m05`, six after `m10`; keep all cards readable.
- Add Blueprint Reset UI and replay/result copy.
- Add boss telegraph accessibility text without live-region spam.

### Art agent after behavior lock

- Five Act II battlefields with ancient stone/mosaic/temple routes, never asphalt.
- Hermes/Poseidon/Medusa three-level modular atlases, portraits, drones, and signature effects.
- Harpy/Shield Bearer atlases and Cyclops Kernel phase/EMP art.
- Actual-size/readability review on every new background at mobile and desktop scale.

### Exit gate

- All five missions, air/ground targeting, tide/solar/EMP, fifth/sixth slots, upgrades, rewards, replays, and art validators pass.
- All five Act II map analyzer reports pass per-route/air-route coverage, crossing layers, clearance, intent, and stale-artifact checks.
- At least three Strategos loadouts per mission and starter-trio clears.
- Existing ten missions can be completed in sequence from a new production profile; the isolated disposable slice profile never migrates into production.
- Standard per-phase keyboard/focus/zoom/reflow/screen-reader/mobile gate passes.

### Checkpoint commit

`Ship Armara Aegis Act II campaign`

## 10. Phase 5 — Act III: regeneration, splitters, support, and resistance

### Outcome

Add `m11`–`m15`, Hephaestus/Athena/Apollo, advanced multi-route pressure, and Oracle Core.

### Content/balance agent

- Author Thermopylae Firewall, Delphi Duplex, Forge Perimeter, Acropolis Mesh, and Oracle's Black Box.
- Produce hidden-grid route/pad/exclusion records and checked-in reports/heatmaps for all five maps, including the intentional six-pad scarcity map and support-neighbor graphs.
- Add Myrmidon and Splitter waves plus shield combinations.
- Author fixed shortcut groups and visible Oracle resistance phases.
- Define Oracle Forecast and Reserve Capacitor II rewards.
- Ensure regeneration/shields/resistances remain beatable with starter damage and no hidden counter requirement.

Review the complete Act III content annex, map reports, and matched-budget Hephaestus/Athena/Apollo balance-lab matrix before behavior/art production. The six-pad mission may be scarce, but scarcity cannot excuse an accidental dead pad.

### Simulation agent

- Implement no-damage-delay regeneration and anti-regen burn/field.
- Implement Splitter children with exact spawn order/route distance.
- Implement mines with deterministic placement/arming slots.
- Implement non-stacking support aura selection/ties and the global `+20%` damage / `+15%` rate / `+12%` range caps. Athena auto-links at most three eligible attacking towers at Level 1 and four at Levels 2/3, selecting by fixed-point squared distance then immutable tower ID; there is no manual link command. It cannot link itself or another support-only defense, and cannot accelerate guard replenishment, mine replenishment/arming, summon creation, capstone counters, or other non-attack production. Recompute only at mission initialization or after accepted build/upgrade/sell/reset, disable/reenable, or Athena source activation/removal events—not on ordinary ticks or presentation frames. Equidistant ID ties, cap overflow, upgrade from three to four, every recompute trigger, and stable non-relink ticks are direct replay tests; active links, eligible unlinked towers, and every ineligible/excluded reason enter the semantic companion state.
- Implement ramping beam/target-change reset/shield strip.
- Implement resistance phase thresholds capped at 30%.
- Add campaign modifier snapshot to replay for Reserve I/II and early Athena ownership provenance outside mission state.

### Experience agent

- Six-pad scarcity briefing, split/revival child preview conventions, shield/regen bars, aura boundary, beam ramp, and resistance legend.
- Athena's current links, level cap (`3 / 4 / 4`), ineligible targets, and capped effective bonuses are inspectable without exposing implementation-only grid scores.
- Oracle Forecast shows exact next-two-wave counts while preserving baseline route/hazard telegraphs for everyone.
- Guaranteed Athena unlock at `m12` handles already-owned early access idempotently and shows cosmetic compensation if approved.
- Codex expands with status stacking/boss resistance and complete upgrade comparisons.

### Art agent

- Five Act III battlefields and mission props.
- Hephaestus/Athena/Apollo three-level atlases, portraits, mines, beam/aura presentation.
- Myrmidon/Splitter animation and Oracle Core phases.
- Alpha/pivot/gutter/actual-size and decoded-pack validation.

### Exit gate

- Act III mechanics, modifiers, early/guaranteed unlock idempotence, and all replays pass direct tests.
- All five Act III map reports, support-neighbor probes, Athena link/cap cases, Resolve/control interactions, and matched-budget weakness/dominance gates pass.
- Fifteen-mission new-profile playthrough works offline after packs are cached.
- Starter trio and three diverse loadout passes per mission.
- No essential intel is gated by Oracle Forecast.
- Standard per-phase keyboard/focus/zoom/reflow/screen-reader/mobile gate passes.

### Checkpoint commit

`Ship Armara Aegis Act III campaign`

## 11. Phase 6 — Act IV, final boss, and complete roster

### Outcome

Finish `m16`–`m20`, all fifteen defenses/three levels, final enemy behaviors, Olympian Overcharge, and campaign ending.

### Content/balance agent

- Author Styx Packet Loss, Trident Convergence, Titan Assembly, Olympus Uplink, Eternal Singularity.
- Produce approved hidden-grid route/pad/exclusion records and checked-in reports/heatmaps for all five maps, including portal-linked sections, three specialty lanes, assembly nodes, twin entrances, and every declared power/specialist pad.
- Add Wraith and Power Courier plus final elite mixes.
- Script Titan Prime buffs and Chronarch 75/50/25 phases.
- Author Mission 20's twelve distinct beats; avoid HP-padding/repeated waves.
- Define final Laurels, ending/recap, Ascension unlock, and challenge variants.

Review the complete Act IV content annex, map reports, and matched-budget Hades/Talos/Zeus balance-lab matrix before behavior/art production.

### Simulation agent

- Implement Wraith fixed-distance revival and Hades suppression.
- Implement execute thresholds, bounded secondary banish, and boss exclusion.
- Implement armor break/boss bonus with stable status order.
- Implement chain jumps with deterministic nearest/tie order and bounded storm.
- Implement Courier node receipts and Titan Prime derived buffs.
- Implement teleports that preserve stable route/distance semantics.
- Implement the mission-local `m19` Olympus mast and the post-victory permanent Olympian modifier as distinct access paths, with deterministic charge/target/telegraph/strike commands and separate resolved record hashes.
- Implement Chronarch phase state machine and final victory ordering.

### Experience agent

- Make revival, armor, air lane, Courier objective, Overcharge meter/targeting, twin entrances, and phase health readable.
- Keep management simple: one optional late active, contextual pause while targeting, clear keyboard/touch/semantic controls.
- Add campaign recap with act results, favorite loadout, MVP defense, total Laurels, and next modes.
- Ensure result/progression is safe before ending/share UI.

### Art agent

- Five Act IV Greek-underworld/Olympus battlefields.
- Hades/Talos/Zeus complete three-level atlases and portraits.
- Wraith/Power Courier animation; Titan Prime and Chronarch full phases/abilities.
- Overcharge effects, ending card elements, Ascension/challenge thumbnails.
- Full all-fifteen upgrade silhouette contact sheet at actual size for consistency review.

### Complete-campaign balance gate

1. Run schema/compiler/map/asset validators: exactly 20 missions, 20 current deterministic pad reports/heatmaps, 15 towers × 3 complete immutable levels, 11 regular enemies, 5 boss records, and no unresolved/draft/legacy-fallback IDs or stale generated artifacts.
2. Run deterministic headless matrix for every mission/difficulty with:
   - Starter trio where applicable, proving all twenty Story/Strategos clears.
   - At least three materially different legal Strategos loadouts per mission.
   - One intentionally poor loadout to ensure the harness is not merely forcing victory.
3. Run seeded fuzz/soak tests for status stacks, entity caps, sell/build churn, multi-route leaks, bosses, and replay parsing.
4. Conduct at least five moderated qualitative sessions per act for difficulty curve, downtime, clarity, placement reasoning, upgrade comprehension, and mission length; simulation success is not a fun test. Keep the separate `m01` instrumented calibration cohort and rerun it after material relevant changes.
5. Tuning may change a non-cost damage/cadence/effect value only inside a bounded range declared in its reviewed content annex before balance work; there is no generic percentage allowance. The approved defense costs and Mission 1 start/wave envelopes are binding; changing them, or a role, weakness, unlock, mechanic, target mask, or cost order, requires a short spec amendment and Ryan approval.

### Exit gate

- New local profile completes all twenty missions without network.
- Starter trio campaign completion and diversity goals hold.
- All defense levels/assets/statuses/boss phases are exercised in automated and visual coverage.
- Every map's fixed pads have an authored tactical reason, analyzer evidence, visible coverage preview, and no undeclared dead/dominated placement; all declared power/specialist pads retain their reviewed tradeoff.
- Mission 20 meets the specification's active-time p90 and moderated clarity/enjoyment thresholds, with zero finale-specific task blocker.
- Standard per-phase keyboard/focus/zoom/reflow/screen-reader/mobile gate passes.

### Checkpoint commit

`Complete Armara Aegis twenty-mission campaign`

## 12. Phase 7 — World-class replay, victory sharing, and post-campaign modes

### Outcome

Turn each run into a useful replayable/shareable artifact and add respectful long-term play.

### Task 7.1 — Replay archive/viewer

**Owner:** Simulation/replay agent
**Files:** `replay/player.js`, profile replay storage, tests

- Seek from periodic derived/untrusted snapshots/event indexes that can always be discarded and regenerated from the authoritative replay.
- Playback at pause/1×/2×/4× with speed label; renderer presentation clock is explicit.
- Favorite/export/import/delete with quota policy that protects best/favorite/latest first.
- Resolve immutable rulesets retained for at least the declared 12-month support window; show an unsupported-ruleset state instead of attempting a mismatched replay.

### Task 7.2 — Deterministic highlight plan

**Owner:** Simulation/replay agent
**Files:** `replay/highlights.js`, `highlights.test.js`

- Score semantic events: boss phase/kill, multi-kill, closest integrity crisis, signature defense action, final defense/victory.
- Produce a 10–20 second plan targeting about 15 seconds with ordered ranges and title/result slates, plus a chronological closest-threat/final-attack/victory fallback for quiet runs.
- Version/hash the selector separately from gameplay. Prove identical plan for identical replay/ruleset/event-schema/selector hash and truthful speed/cut ordering.

### Task 7.3 — Result and share experience

**Owner:** Experience agent
**Files:** `ui/results.js`, result HTML/CSS, canvas card renderer, accessibility tests

- Render local 1200×675 card after saved result with canonical hourglass, mission/Laurels/stats/loadout/MVP/snapshot/reward/replay marker.
- Generate complete alt text; omit player name by default.
- Separate Download, Copy/Web Share, Local X Replay Highlight, Replay, Retry, and Next Mission.
- Add a 3-second record countdown, privacy-safe local view, prepared editable X copy, and platform guidance. The offline/local phase has no nonce, Run Seal, gold badge, pending state, or verification implication.
- Reserve `SUBMIT VERIFIED X REPLAY` for the enabled Phase 9 service state machine. Never auto-post or label local results verified.

### Task 7.4 — Media fallback

**Owner:** Experience/art agent

- Feature-detect 720p/30 fps `canvas.captureStream`/`MediaRecorder` WebM export.
- Test formats on target browsers; never promise X acceptance from browser support alone.
- Guided OS screen recording is the required fallback and remains first-class on the named physical target devices.
- The app can mute its own game audio and hide personal data; it cannot control an OS recorder's microphone. Give accurate current-device instructions for disabling the mic.

### Task 7.5 — Post-campaign modes

**Owner:** Content/balance agent

- Endless Ascension with declared seed/ruleset and bounded authored cycles.
- Bundled Oracle weekly challenges with fixed seed/loadout/trial towers and cosmetic-only rewards.
- Titan variants, Laurel Hunts, Training Courtyard controls, and loadout code sharing.
- No streak, energy, expiring power, or server dependency.

### Exit gate

- Every mission victory produces a correct share card and highlight plan.
- Save-before-share and quota-without-replay fallback are fault-injection tested.
- Same gameplay replay/hash across Node/browser and same separately versioned highlight plan for the same selector artifact.
- Guided 10–20 second recording instructions/playback pass on the named physical iOS/Android and desktop targets.
- Post-campaign modes cannot mutate story records or bypass unlock integrity.
- Standard per-phase keyboard/focus/zoom/reflow/screen-reader/mobile gate passes.

### Checkpoint commit

`Add Aegis replays sharing and Ascension`

## 13. Phase 8 — Accessibility, performance, audio, and offline hardening

### Outcome

Meet the measurable quality bar after all content exists, while correcting architectural issues rather than masking them.

### Accessibility/UX agent

- Complete keyboard-only flow through hub, map, loadout, battle management, result, replay, and settings.
- Complete semantic companion state and focus restoration.
- Run automated scan with zero critical/serious findings, manual desktop/mobile screen-reader passes, 200% zoom, color-blind simulation, and Reduced Motion.
- Test `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080` plus orientation changes.
- Re-run five-player newcomer comprehension and representative later-game management sessions.

### Art/performance agent

- Enforce pack/hash/alpha/frame/pivot/byte/decode validators on all assets.
- Profile representative 100-enemy/15-tower stress scene; bound effects/object pools and release inactive decoded assets.
- Ensure initial shell/Mission 1 and per-pack budgets.
- Inspect all twenty roads for Greek materials/no asphalt and all units at smallest CSS sizes.
- Run full visual-regression set including missing-art fallbacks.

### Audio/game-feel agent

- Add original/licensed-safe act ambience and battle layers, clear unique attack/impact/status/boss cues, UI confirmations, and restrained victory/defeat stingers.
- Mix for intelligibility; persist master/music/effects/mute settings.
- Ensure no gameplay information is audio-only.
- Reduced Motion and screen-shake toggles affect presentation only; no unsafe flashes or unbounded particles.

### Offline/update agent

- Harden the Phase 1 per-game service worker/release loader; do not introduce the delivery architecture here.
- Audit shell/index/Mission 1 precache and lazy pack size/progress/offline state.
- Stress immutable hashed packs, transitive dependencies, multi-tab leases, side-by-side rulesets, between-run activation, update interruption, and cache corruption.
- API/network failure cannot block boot; corrupted/missing pack gives repair state without losing profile.

### Exit gate

- Physical iOS Safari and Android Chrome passes.
- Performance/network/decode budgets pass or receive a documented Ryan-approved adjustment.
- Thirty-minute soak, repeated resize, background/resume, storage-full, offline/update, missing-art, and Reduced Motion runs pass.
- Audio licenses/provenance recorded; no external runtime dependency.

### Checkpoint commit

`Harden Armara Aegis for campaign release`

## 14. Phase 9 — Optional account and social verification service

This phase is blocked until the batched Ryan approval gate in the binding spec is answered. It is a separate security/privacy project, not a normal static-site task.

### 9.1 Architecture and operations first

Choose the service repository/host, production domains, relational store, validator queue, key management, monitoring, provider plan, official immutable IDs, secure session/recovery/merge/unlink, age/region eligibility, privacy copy, retention/deletion, support owner, and incident runbook.

No secrets, refresh tokens, bot tokens, entitlement signing keys, or unrestricted API endpoints may be committed to GameSlop or shipped to GitHub Pages.

### 9.2 Account/entitlement foundation

- First-party UUID account with secure HttpOnly/SameSite session or equivalent token binding, CSRF defense, recovery, and explicit link/unlink. A local device UUID is not authentication.
- Provider adapter interface and feature flags.
- Idempotent proof state machine and audit record.
- Durable backend grant records plus short-lived ES256 or equivalent signed snapshots, JWKS/public-key rotation/retention, subject/audience/expiry/clock-skew binding. Envelope expiry never deletes a permanent grant.
- IndexedDB cached snapshots with honest offline expiry/revocation behavior and refresh materialization.
- Export/delete/recovery paths before public linking.
- Explicit consent before cross-linking provider identities and exact-field/retention disclosure before link and proof upload.

### 9.3 Telegram and X adapters

- Telegram identity link and admin-bot `getChatMember` membership snapshot.
- X OAuth 2.0 PKCE with minimum read scopes; immutable X ID.
- Staging proof of exact follow-check endpoint/field on the purchased provider tier.
- Rate limits, backoff, idempotency, privacy minimization, and sanitized CI fixtures.
- Real-provider smoke tests stay out of ordinary CI and use staging secrets.

### 9.4 X Replay Highlight verification

- Build a minimal isolated replay validator and immutable ruleset registry in this phase. After explicit upload consent, validate bounded schema/resources, load the exact shared Phase 1 artifact, fully re-simulate, compare the canonical final claim, and only then issue a signed run receipt plus short-lived one-time Run Seal.
- Accept only allowlisted X status URL/ID.
- Verify author, current nonce text, issue/post times, one direct video, 10–20 second duration, public visibility, no quoted source media, and no proof/post/media ID already used by this service. Do not claim metadata detects re-encoded pixel reuse.
- Hold pending and re-fetch after the documented 30-minute edit window.
- Require that exact validated run receipt; never infer gameplay truth from pixels/metadata.
- Reward Replay Sigil/frame/Herald progress only; campaign already works without it.
- Model queued, processing, not found, protected, token missing, mismatch, duplicate, rejected, verified, expired, and provider outage states.

### 9.5 Social early Athena path

- Telegram and X proof grants are separate signed cosmetic entitlements.
- After validated evidence of `m04`, both verified grants produce one early Athena entitlement route. Independently, 10 local Laurels across `m01`–`m04` provide the same early access without an account.
- `m12` campaign completion always grants Athena locally/online. Grant merge is idempotent and never removes access.
- Fixed-loadout/trial challenge modes ignore ownership for fairness.

### 9.6 Later community adapters

Referral, cross-game receipts, long-catch-up dispatch codes, and polls are separate feature-flagged adapters after the initial Telegram/X service. Each receives its own spec amendment, idempotency/abuse/privacy tests, and operational owner. Referrals accept a player-entered code/link only—no contact upload, automatic invitations, or provider spam.

### Exit gate

- Provider terms/incentive review complete.
- API outage has zero effect on campaign.
- Proof replay/duplicate/rate-limit/edit/error tests pass.
- Validator byte/tick/action/entity/CPU/memory exhaustion, malicious replay, ruleset retention, signature/rotation/clock-skew, session/CSRF, and cross-link-consent tests pass.
- Privacy notice, retention, deletion, unlink, key rotation, and outage runbooks pass review.
- No social action grants stats/economy or competitive/token/reward-sensitive advantage; ordinary campaign has the equivalent 10-Laurel early-Athena route.

### Checkpoint commits

Keep service and static-client commits separately auditable. Suggested client commit after service staging is proven:

`Add optional Aegis community entitlements`

## 15. Phase 10 — Optional ranked validation

Do not implement unless Ryan explicitly approves ranked/leaderboard product scope after replay v1 succeeds.

If approved:

1. Server issues one-use signed run ticket with account, mission, exact ruleset hash, seed, fixed loadout/modifiers, issue/expiry, and validator policy.
2. Client submits bounded ticket + replay with idempotency key.
3. Extend the Phase 9 isolated Node validator with ticket ownership/one-use/ranked result provenance; it still loads the immutable matching ruleset, validates schema/ticket/limits, fully re-simulates, and compares final canonical state.
4. Only accepted ticketed runs reach ranked results. Unticketed offline runs stay local/unranked.
5. Retain every supported ruleset bundle for the published replay/season support window.
6. Limit bytes, ticks, inputs, commands/tick, entities, memory, CPU, and queue retries to resist denial of service.

Competitive modes use fixed loadouts or all-unit trial access and ignore campaign Reserve modifiers/social ownership.

## 16. Full verification matrix

### 16.1 Bare unit suites

Run each command from the listed working directory, without wrapper arguments:

| Working directory | Command | Current baseline |
|---|---|---:|
| `games/_kit` | `node --test` | 12 |
| `games/armaratris` | `node --test` | 35 |
| `games/serpent` | `node --test` | 11 |
| `games/breaker` | `node --test` | 9 |
| `games/flight` | `node --test` | 7 |
| `games/starfall` | `node --test` | 9 |
| `games/aegis` | `node --test` | 19 and increasing |

No release proceeds with a failure or a lost test.

### 16.2 Static validation

- `node --check` for every changed/generated JavaScript file.
- Build compiler twice and byte-compare output.
- Validate JSON syntax/schema/references/counts/hashes, exact ruleset byte inputs, immutable artifact names, and release-manifest transitive compressed/decoded totals.
- Run `node tools/analyze-aegis-map.js --all --check`; validate grid snap, route connectivity/layers, road/prop masks, pad clearance/spacing/intent, coverage windows, route/air/support probes, and deterministic JSON/SVG outputs for all twenty maps.
- Validate all asset dimensions/alpha/rectangles/gutters/pivots/bytes/packs.
- Verify generated browser content and source content share the manifest hash.
- Verify no placeholder/draft ID in a production manifest.
- `git diff --check`.

### 16.3 Determinism/balance

- Golden Node/browser replays and checkpoint/final hashes using the frozen ABI/artifacts.
- Multi-route, different-length target ties.
- Status order/stack/boss resistance.
- All three upgrade records and safe-integer `floor(invested × 70 / 100)` cumulative refunds for all fifteen defenses, including explicit Siege/Athena `90 → 63` regression goldens.
- Exact unassisted/unmodified Strategos Mission 1 `150` start, inclusive `30/40/45/50/55/60` envelope ledger, `430` unrecycled gross ceiling, Wave-6 start-command `60` before first spawn, zero Wave-6 kill/final-clear Aether, separate purchase/refund/net-consumed/final-investment/bank reports, and Strategos-only final simultaneous build/upgrade/bank targets. Across every ledger, verify `eligibleUnspentAether = max(0, finalBank - campaignModifierAether - assistAether)`, `unspentScore = min(rawUnspentScore, floor(nonAetherScore / 19))`, zero-score/modifier-exclusion boundaries, and a final-total unspent-Aether score share no greater than `5%`.
- Difficulty/modifier economy order and mission-scoped bounty remainder: base Story/Strategos/Titan `178/150/136`, no-Reserve Assist `198/170/156`, Reserve then Assist addition, compact Story bounty aggregation, fixed deployment/clear exclusion, and replay/hash parity.
- Mission 1 route/pad golden: all ten approved centers, eight standards at E22 `29.539–30.199`, two double-pass power pockets at `48.530`, maximum/minimum at most `1.65`, exact range-20/24 evidence, minimum clearances/spacing, and range-preview/simulation agreement.
- Resolve durations, simultaneous-bucket/reapplication behavior, Medusa charged-shot consumption, Hoplite target prefiltering, exact strongest-only slow/drench control scaling and per-enemy speed floors, and knockback cooldown. Verify same-name external-source selection, distinct-source summation/caps, milli-damage internal/external/shield/armor/resistance order (including `8 + 8% = 8640`), range floor/squared comparison, rate ceiling/no active-cooldown rescale, Athena `3/4/4` links/eligibility/source removal, and Node/browser/replay parity.
- Ordered waves, boss thresholds, children/revival, hazards, Blueprint Reset, campaign modifiers, Overcharge.
- Seeded fuzz and long-run soak.
- Checked-in winning witness replays for the specification's new-profile/diversity requirements plus negative controls and matched-cost weakness/dominance fixtures.
- Paired route-aware/naive fixtures hold seed, loadout, resolved spend, command/upgrade timing, target policy, and waves constant and prove Task 2.1A's same-checkpoint versioned non-overkill/control-support/prevented-leak `combatValuePerAether` uplift with campaign score excluded and exact formula/scenario ID retained.
- 20 × 3 difficulty matrix plus measured active-time and moderated clarity/enjoyment/readability review; preserve Mission 1's calibrated Story/Strategos success, retry, integrity, naive-placement, and negative-control gates.
- Database/profile migrations, blocked storage, quota/prune/fallback, transaction abort/crash, refresh, bounded malicious import, recovery export/import, and protected replay references.
- Release update during run, multi-tab lease, cache corruption/repair, and direct-file versus HTTP boot/storage contracts.

### 16.4 Browser/device journeys

Drive and visually inspect:

1. New profile → exact `150` Aether → staged Mission 1 pad/true-coverage compare/build → Wave 1 with replay-resolved Upgrade gate → hostile denial plus recorded Skip variant → Wave 1 clear/reveal and one Wave-2-context prompt → unrestricted later upgrades → Wave-6 pre-spawn deployment grant → optional confirmed sell lesson → economy reconciliation → victory → durable saved unlock → Next Mission.
2. Loadout edit → locked preview → training trial → return without progression mutation.
3. Multi-route/air/overpass/tide/EMP/regen/split/revive/Courier/Overcharge/final boss representative missions.
4. Six-card contextual store, target policy, exact costs/refunds, management auto-pause, manual pause, 1×/2×.
5. Defeat/retry/hint/Assist.
6. Victory card download/copy/share and deterministic replay/highlight.
7. Resize/orientation/background/resume; reduced motion; keyboard; screen reader.
8. HTTP offline cached play, uncached pack, direct-file boot, explicit Session Only, storage failure/retry/export, missing/corrupt art, provider unavailable.

### 16.5 Visual review

- Five required viewport sizes and physical iOS/Android.
- All twenty battlefield thumbnails/full boards.
- Debug map review overlays match checked-in heatmaps; normal play keeps the authoring grid/numeric tiers hidden while range circles and covered-road highlights remain legible.
- All fifteen defenses at Levels 1/2/3 plus summons.
- All eleven enemies/statuses and five boss phases.
- Greek road/material audit with zero asphalt.
- Actual play scale, color-blind filters, high contrast, Reduced Motion.
- No sprite bleed, clipped neighbor, baked checkerboard/matte, fake logo, text, or inconsistent ground anchor.

## 17. Commit, stage, and release procedure

At every checkpoint:

1. Inspect `git status --short --branch` and `git diff`.
2. Stage exact intended files only; never use broad staging that could catch `research/`, `Assets/`, or `.superpowers/`.
3. Inspect `git diff --cached --name-only` and fail the checkpoint if an excluded path appears.
4. Run phase tests and full regression matrix.
5. Set/check Ryan author identity.
6. Commit with the required Claude co-author trailer.
7. Confirm the commit contains only intended paths, then push `origin main`.

Source checkpoints may be pushed to `main` when green, but they are not automatically public release gates. Keep the existing public Aegis route as default through Phases 2–7; an incomplete campaign may appear only behind a Ryan-approved non-default preview flag. Switch/publish the campaign as default only at the Phase 8 release gate after `main` is green. Preserve `games/.nojekyll`. Then verify:

- The public mirror points at the intended source commit/content version.
- Public `/_kit/shell.js` returns HTTP 200.
- Live Aegis reaches `body.dataset.ready === "1"` and the selected mission's critical art-ready signal.
- A live CDP drive can start a mission, open a pad store, build, start a wave, and capture an inspectable shot.

A source push or a green deployment job alone is not live proof.

## 18. Review gates and stop conditions

Stop and return one batched question set to Ryan when:

- A requested change would alter a defense role/weakness, mission/reward order, three-level structure, social early-Athena rule, difficulty/fairness policy, or approved art direction.
- Provider credentials, official account/group IDs, backend spending/ownership, public copy, terms, privacy, or retention must be chosen.
- Measured art/performance budgets cannot be met without visibly reducing scope/quality.
- A content change breaks starter-trio viability or makes one defense dominant.
- A live deployment would overwrite/omit unrelated user work or the Pages mirror cannot be verified safely.

Ordinary implementation details that fit the binding contracts are delegated and completed without piecemeal questions.

## 19. Definition of done

This definition closes the offline campaign through Phase 8. Phases 9–10 remain separate optional deliverables unless Ryan activates them; their absence is not a campaign-release failure.

The expansion is complete only when:

- A new player can finish a coherent twenty-mission campaign offline with every mechanic taught and every defense earnable.
- Fifteen defenses each have three useful, legible, fully animated upgrade levels and no strict power-creep replacement.
- Twenty distinct ancient-Greek/Armara-AI battlefields, eleven enemy archetypes, and five bosses are readable and performant.
- All twenty battlefields derive routes and fixed pads from the hidden `40 × 25` grid, pass deterministic geometry/quality reports, and present intentional standard/power/specialist tradeoffs without dead or unexplained far-away placements.
- Mission 1 retains the approved route, ten pads/two power pockets, `150 → 430` economy envelope, one-wave upgrade reveal, calibrated difficulty/integrity targets, and meaningful unfilled-pad/upgrade choices at victory.
- Every mission supports loadout planning, contextual management, exact Aether/refunds, Laurels, difficulty, save/retry, replay, victory card, and 10–20 second highlight planning.
- Determinism, migrations, balance, accessibility, device, asset, performance, and all-game regressions pass.
- Optional provider failure never harms campaign play and no secret ships in the static client.
- The intended commits are authored/staged correctly, excluded paths remain untouched, Pages is published, `/_kit/shell.js` returns 200, and a live CDP shot proves Aegis boot and gameplay.
