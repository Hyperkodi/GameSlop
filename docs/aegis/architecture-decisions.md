# Armara Aegis campaign foundation decisions

**Status:** Accepted for implementation

**Decision date:** 2026-08-26

**Owner:** Ryan

**Binding specification:** `docs/superpowers/specs/2026-08-26-armara-aegis-campaign-expansion.md`

**Implementation plan:** `docs/superpowers/plans/2026-08-26-armara-aegis-campaign-expansion.md`

This record freezes the Phase 0 architecture and the baseline against which the campaign runtime is developed. It does not replace the binding specification. Any conflict is resolved in favor of that specification until Ryan approves an amendment.

## Reproducible baseline

| Item | Recorded value |
|---|---|
| Private repository HEAD | `2177d2a18c24e7a3d0b2176411c9cd719dadc425` on `main` |
| Public games mirror HEAD | `1fefd2a1de1f4dbbd492d9d1c3edf18334caa3fa` |
| Required Pages sentinel | `games/.nojekyll` exists |
| Armara hourglass SHA-256 | `5b1204c1957949f05842903ec4c5c3931e83b414ddc0c1fe60caa02133584cc2` |
| Worktree exclusions | Never stage `research/`, `Assets/`, `.superpowers/`, or the untracked root handoff copy |
| Bare-suite baseline | 102/102: `_kit` 12, Armaratris 35, Serpent 11, Breaker 9, Flight 7, Starfall 9, Aegis 19 |

The committed visual baseline is:

| View | Evidence | Dimensions | SHA-256 |
|---|---|---:|---|
| Desktop | `docs/game-screenshots/aegis-desktop.png` | `1280 × 800` | `b065f7e05e33c35f680a63ebfba694717e616609c12b9b960e53743431511d6e` |
| Mobile | `docs/game-screenshots/aegis-mobile.png` | `390 × 844` | `a62e9208d4b2a4c6cfdac458ca2ba69d397cf6e15f7520faed1f547e19ab16c2` |

Both images were inspected during Phase 0. A fresh interactive local/live capture could not be produced because no controllable browser instance was connected in the implementation environment. That is a recorded environment limitation, not a waived release gate: before any campaign publish, `_kit/shell.js` must return 200 and a fresh local and live boot must reach `document.body.dataset.ready === "1"` at both target viewports.

## Accepted decisions

### ADR-001 — Hidden authored grid, fixed player pads

All battlefields use the existing `160 × 100` logical world and a hidden `40 × 25` authoring grid. One cell is four world units and a cell center resolves as `world = 4 × cell + 2`. Routes are continuous fixed-point polylines through grid-snapped control nodes; enemies never move cell by cell. Gameplay exposes only authored construction pads, never free placement or a visible modern grid.

The ordinary road buffer is twelve world units. Ordinary pad centers remain at least sixteen world units from a lane center, twenty from another pad, eight inside the board, and twenty from gates, breaches, large props, or stricter exclusion masks. Authored exceptions require a named annex waiver and validator coverage.

### ADR-002 — Three linear in-run levels

Every defense has exactly three complete authored level records. No renderer, HTML file, skin, or fallback table may own combat values. Level 2 concentrates a role; Level 3 spends scarce pad capacity on a capstone. Mission 1's Wave-1 tutorial reveal is the only upgrade-availability gate.

### ADR-003 — Deterministic ABI before campaign scale

Campaign simulation advances in fixed integer ticks and uses integer time, distance, milli-damage, and basis-point units. Exact parsing, rounding, overflow checks, named RNG streams, command phase order, canonical encoding, and hashes are versioned ABI data. Node, browser, replay viewer, and any later validator consume the same immutable simulation/content bytes.

The current variable-delta game remains a `legacy-proving-ground` compatibility fixture until the new runtime passes parity and replay tests. Its 160 Aether start, old costs, full-wave shuffle, hidden HP escalation, and duplicate reward model are prohibited in production campaign manifests.

### ADR-004 — Static, offline-first campaign with optional services

The complete campaign, local profile, replay viewer, victory cards, and guided recording work from committed static files on GitHub Pages and through the documented direct-file fallback. Social verification, identity, ranked play, and provider adapters are optional HTTPS services behind honest feature flags; their absence never blocks play or progression.

### ADR-005 — Canonical IndexedDB storage

Campaign profiles, results, and replays use versioned canonical IndexedDB records with transactional victory writes, migration journals, quota pruning, recovery export/import, and a visible Session Only fallback. Storage state, timestamps, provider data, and presentation settings never enter combat hashes.

### ADR-006 — Generated immutable content artifacts

Validated authoring JSON is source. A dependency-light Node compiler emits deterministic, canonical, immutable content/simulation artifacts plus manifests that are committed for no-build hosting and classic-script/direct-file loading. Behavior IDs select reviewed engine functions; executable content JSON and mutable filename mixing are forbidden.

### ADR-007 — Explicit sprite records and lazy mission packs

Every production sprite/atlas record declares its exact rectangle, pivot, logical size, animation, fallback, transfer bytes, and decoded bytes. Asset packs are immutable and loaded by mission/loadout need. Missing or corrupt optional art falls back honestly without changing simulation.

The current Armara Aegis PNG baseline demonstrates why this is binding:

| Measurement | Transfer bytes | Decoded RGBA bytes |
|---|---:|---:|
| All 30 current PNGs | 16,314,839 | 46,736,784 |
| Current eagerly referenced shell/art candidate | 9,434,848 | 30,039,696 |
| Representative three-level Sentinel pack | 1,727,092 | 4,718,592 |
| Current six-pose Guardian atlas | 684,278 | 1,572,864 |
| Linear eight-pose Guardian projection | about 912,371 | about 2,097,152 |

The decoded set remains under the proposed 64 MB mobile ceiling, but the current eager transfer set exceeds the 5 MB initial ceiling. The 5 MB initial and 3 MB additional-pack ceilings therefore remain accepted and enforce a concrete implementation requirement: split/lazy-load mission packs and optimize production images before release. Mass asset generation cannot begin until explicit atlas records and budget validation exist.

### ADR-008 — Bound replay kernel and authoritative validation boundaries

Canonical replay state uses completed-tick boundaries. A state whose `tick` is `N` represents exactly `N` completed fixed combat ticks and is the boundary at which the current-tick command bucket for tick `N` may be consumed. Checkpoint 0 hashes the canonical initial state before any tick-0 command. Checkpoint `N` hashes the boundary after command buckets `0` through `N - 1` and every declared simulation phase for those ticks.

Planning is clock-suspended. The kernel groups commands into one explicit current-tick bucket and applies that bucket in `seq` order. A planning bucket that does not accept `startWave` does not advance combat time; commands recorded at a later tick cannot bypass that suspended boundary. When wave clear produces planning state during tick `N`, the next planning/current-tick bucket is at boundary `N + 1`.

Replay `durationTicks` identifies the first terminal boundary. Terminal padding and post-terminal no-op ticks are invalid. If a leak causes defeat, the kernel enters every remaining named phase for that tick as a deterministic no-op and commits the completed tick boundary; it never exposes or hashes an ambiguous partial-tick state.

The semantic event schema is an artifact-owned version independent from the command schema. Replay code must not infer `eventSchemaVersion` from the commands descriptor merely because both versions currently equal 1.

Checkpoint and final hashes cover canonical boundary simulation state only. Semantic event logs, diagnostics, renderer or presentation state, cached seek snapshots, pause or speed state, and platform metadata are excluded. A hash remains a comparison result, not gameplay proof.

The immutable release loader or server validator authenticates exact manifest, simulation-artifact, and compiled-content bytes and filenames. The bound kernel receives those authenticated records explicitly and verifies their semantic agreement: ruleset, ABI, content, mission, event-schema, and behavior-registry identities. It does not discover content through globals or platform I/O, and semantic binding alone does not claim to reauthenticate source bytes.

Compiled content schema v2 is insufficient for authoritative replay simulation because it contains the map foundation but not the complete combat, economy, objective, scoring, and behavior records. The production replay kernel must reject it with a stable unsupported-schema result rather than fall back to the variable-delta legacy engine. Synthetic immutable fixtures may exercise the kernel seam, tick driver, management transitions, limits, diagnostics, and execution-mode parity, but they are nonproduction and cannot validate a live Aegis run.

A replay outcome, score, Laurels total, checkpoint, or final-state hash becomes authoritative only after the matching immutable ruleset is fully re-simulated through its first terminal boundary by the complete combat kernel. Plan Task 1.3 remains explicitly incomplete until content schema v3 and the required artifact-owned behavior registry can reproduce those production results; implementing a fail-closed seam or passing synthetic fixtures does not satisfy that exit gate.

### ADR-009 — Bounded noncanonical balance telemetry

The authoritative kernel has one advancement seam. `advanceTick` returns exactly frozen `{ events, state, telemetry }`; a second diagnostic or balance-only advancement path is forbidden because two reducers could drift. `telemetry` is deterministic output from the same resolved phases, but it is not canonical simulation state. It never enters replay envelopes, checkpoint hashes, final claims, score, objectives, progression, presentation behavior, or semantic event catalogs.

Balance-telemetry schema v1 is exactly `{ schemaVersion, tick, records }`. `tick` is the input boundary tick, records use contiguous zero-based ordinals in actual reducer order, and every record has one closed kind-specific shape from the Candidate-slice specification. The kernel exports the frozen authorities `BALANCE_TELEMETRY_SCHEMA_VERSION = 1`, `MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536`, and `MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096`. Unknown kinds or fields, unsafe integers, free-form text, noncanonical values, reordered/duplicate ordinals, target-list overflow, or record overflow fail the tick without truncated output. Telemetry contains raw authoritative facts and conserved attribution inputs; it does not embed a mutable report formula or claim that a human-playtest target passed.

The replay runner validates that telemetry is exact, deeply frozen, canonical, correctly ticked, ordinally contiguous, and within those exported bounds, then deliberately ignores it when hashing or verifying claims. The balance harness folds the per-tick stream into bounded aggregates and does not retain an unbounded session log. A telemetry-schema or report-formula revision changes the simulation artifact identity because the producing/validating code changes, but it does not add diagnostic history to canonical state or make a report-only formula part of gameplay consensus.

## Initial risk register

| Risk | Evidence | Required mitigation | Gate |
|---|---|---|---|
| Variable-delta legacy behavior cannot satisfy fixed-tick ABI | Existing tests intentionally call `tick(0)`, `tick(1)`, `tick(448)`, and large deltas | Preserve a legacy kernel/facade; build ABI-v1 separately; swap only after compatibility and replay evidence | Phase 1 |
| Combat constants are duplicated in engine, renderer, and HTML | Renderer contains local paths, pads, tower stats, refund math, and wave assumptions | Add a content-backed battle view model, then delete presentation fallbacks before campaign release | Phases 1–2 |
| Existing input hash is not a state/replay proof | `hash()` covers only the legacy input log | Preserve bridge compatibility while adding separate checkpoint and final-state hashes | Phase 1 |
| Current whole-wave RNG and mutable module exports can drift | One closure RNG and exported mutable tables | Named streams, immutable compiled records, and golden vectors | Phase 1 |
| Initial art transfer exceeds budget | Measured eager candidate is about 9.43 MB | Immutable lazy packs, optimized formats/assets, byte checks in the release manifest | Phases 1–2 |
| Existing enemy atlases use implicit `3 × 2` slicing | Renderer infers cells and pivots | Explicit rectangles/pivots and validation before new production atlases | Phase 2 |
| Mobile baseline leaves most portrait viewport unused | Committed `390 × 844` evidence | Approved responsive command-deck/reflow work plus physical-device review | Phase 2 |
| Fresh browser baseline unavailable in current environment | No connected controllable browser | Preserve hashed evidence now; require fresh local/live readiness capture before publish | Release |
| Provider capabilities and policy may change | Social service is intentionally deferred | One batched Ryan decision set and staging spikes before provider implementation | Phase 9 |

## Development and release boundary

The normal public Aegis route remains on the current proving ground while new campaign work runs behind an explicit development manifest/profile. No slice completion can mutate a production profile. Production art follows reviewed behavior and balance records, not speculative content. A release is live only after the committed suites pass, `games/.nojekyll` is present, public `_kit/shell.js` returns 200, and a live boot reaches the ready state with required art loaded.

The remaining Ryan decisions are the single deferred operational set in specification Section 23: backend/operator/budget/domains, official provider IDs and credentials, provider terms/copy, account recovery/merge, retention/deletion periods, ranked scope, downloadable-video scope, and final measured release budgets. None blocks offline campaign implementation.
