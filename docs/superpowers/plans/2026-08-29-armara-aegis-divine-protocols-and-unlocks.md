# Armara Aegis Divine Protocols and Unlock Systems — Implementation Plan

**Date:** 2026-08-29

**Specification:** `docs/superpowers/specs/2026-08-29-armara-aegis-divine-protocols-and-unlocks.md`

**Delivery target:** candidate campaign preview first; no public route switch or push without separate Ryan approval
**Method:** red test → smallest implementation → focused tests → full bare `node --test` → checkpoint commit

## 1. Outcomes and guardrails

This plan delivers all approved Protocols, tower specializations, Relics, reinforcements, mechanisms, Recon/mastery progression, presentation, and campaign integration without weakening the existing deterministic slice.

Every checkpoint must:

- preserve historical v1/v3 immutable fixtures and fail-closed behavior;
- keep simulation data out of renderer/HTML constants;
- keep mutable profile state out of a running mission and replay;
- keep all user-facing costs/effects derived from compiled records;
- keep the current public Aegis route unchanged;
- avoid staging `research/`, `Assets/`, `.superpowers/`, the root handoff, QA captures, and obsolete road scratch files;
- use author `Ryan <ryan@xynco.io>` and exact trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

The work is intentionally split into reviewable green commits. “All implemented” means every system has authoritative data, reducer behavior, replay coverage, semantic UI, and candidate-preview integration; production promotion additionally requires balance and art acceptance.

## 2. Parallel ownership model

Workstreams may run concurrently only when their write sets do not overlap:

| Workstream | Primary write area | Integration owner |
|---|---|---|
| Contract/compiler | `tools/lib/aegis/v4-*`, v4 content source/fixtures/tests | Root |
| Simulation | `games/aegis/js/sim/*-v2` or narrowly reviewed existing modules; sim tests | Root |
| Profile/progression | `games/aegis/js/progression/`, profile tests | Root |
| Presentation/UI | preview controller/view-model/CSS/presentation tests | Root |
| Content authoring | v4 JSON for powers/relics/branches/units/mechanisms/missions | Root |
| Raster art | versioned `games/aegis/art/v3/` source outputs and asset records | Root review |
| Balance/evidence | fixtures/reports/witness replays | Root review |

Shared files such as `kernel.js`, `preview-controller.js`, release descriptors, manifests, and architecture decisions have one owner at a time. Subagents do not commit independently unless assigned an isolated checkpoint.

## 3. Checkpoint A — bind the architecture amendment

### Files

- Add the approved specification.
- Add this implementation plan.
- Update `docs/aegis/architecture-decisions.md` with new ADRs for branched Level 3, Protocol/relic progression, and versioned v2 compatibility.

### Tests and review

- Confirm Markdown references resolve.
- Confirm old authorities are amended explicitly rather than silently contradicted.
- Confirm exact counts: 10 Protocols, 15 families × 2 branches, 8 Relics, 3 reinforcements, 5 mechanisms.
- Confirm no social engagement is a combat/progression gate.

### Commit

`Specify Aegis divine protocols and unlock systems`

## 4. Checkpoint B — content-schema-v4 structural foundation

### 4.1 Red tests

Add:

- `games/aegis/tests/content-v4-records.test.js`
- `games/aegis/tests/content-v4-loader.test.js`
- `games/aegis/tests/content-v4-compiler.test.js`
- minimal valid/invalid fixtures under `games/aegis/tests/fixtures/compiler/v4-*`

Cover:

- exact top-level and nested fields;
- ASCII ordering/uniqueness;
- every Protocol tier and target shape;
- exactly two specialization records per defense;
- Relic benefit plus drawback and clamp membership;
- reinforcement marker-kind compatibility;
- mechanism mission/activation references;
- progression reward/grant/slot references;
- no executable/free-form behavior payload;
- source containment, byte hash, immutable output, and deterministic rebuild;
- v1–v3 fixture byte identity.

### 4.2 Implement

Add versioned modules rather than mutating v3 semantics:

- `tools/lib/aegis/v4-source-loader.js`
- `tools/lib/aegis/v4-record-contracts.js`
- `tools/lib/aegis/v4-rule-catalog.js`
- `tools/lib/aegis/v4-cross-references.js`
- `tools/lib/aegis/v4-annex.js`
- `tools/lib/aegis/v4-compiler.js`
- `tools/lib/aegis/v4-artifacts.js`
- `tools/lib/aegis/v4-presentation.js`

Extend the dispatcher in the smallest compatible seam so source schema 4 selects v4 and old schemas retain old code. Emit a normalized v4 lock tree, canonical simulation content, presentation companion v2, provenance, and immutable release descriptor.

### 4.3 Source records

Create `games/aegis/content-v4/` so candidate-v4 authoring cannot be confused with the active slice-v3 tree. Add strict source records for:

- campaign rules and progression;
- all ten Protocols/tiers;
- all thirty specialization records;
- eight Relics;
- three reinforcements;
- five mechanisms;
- closed event catalog additions;
- candidate presentation catalog v2 using semantic fallbacks until reviewed rasters exist.

Use a Candidate-BAL annex that pins the new specification and declares only reviewed numeric scopes candidate. Do not mark production-approved.

### 4.4 Exit gate

- New v4 compiler tests green.
- Existing v1–v3 compiler/loader/artifact tests green.
- Two clean v4 builds are byte-identical.
- Generated v4 artifacts are not selected by the current public page.

### Commit

`Add versioned Aegis unlock content contracts`

## 5. Checkpoint C — command-v2, replay-v2, and pure Protocol legality

### 5.1 Red tests

Add:

- `games/aegis/tests/commands-v2.test.js`
- `games/aegis/tests/protocols.test.js`
- `games/aegis/tests/replay-v2.test.js`

Test exact shapes for retained commands plus:

- `activatePower`;
- `specializeTower`;
- `deployReinforcement`;
- `activateMechanism`;
- `resetPlan`.

Test target tagged unions, wrong/extra fields, safe integers, slot order, unknown IDs, tier mismatch, unlock snapshot mismatch, loan behavior, shared/individual cooldown boundaries, once-per-mission state, insufficient Aether, no-target policy, and exact repeat-cost rounding/overflow.

### 5.2 Implement

- Add a command-v2 parser/validator without changing command-v1 exports.
- Add `games/aegis/js/sim/protocols.js` as a pure legality/planning module.
- Add checked repeat-cost helpers to `economy.js` or a v2 economy companion.
- Add replay-v2 envelope/header parsing and canonical encoding.
- Extend replay-runner dispatch by declared format/ABI; never infer a version from fields.

Protocol planning returns a frozen accepted/denied plan. It performs no DOM/profile I/O and allocates no runtime ID on denial.

### 5.3 Exit gate

- Golden command/replay encodings.
- Rejected commands are side-effect-free.
- Historical replay-v1 fixtures retain their hashes and outcomes.

### Commit

`Add deterministic Protocol command and replay contracts`

## 6. Checkpoint D — generic combat provenance and v2 telemetry

### 6.1 Red tests

Extend kernel/behavior/balance tests for source kinds:

- `tower`;
- `protocol`;
- `mechanism`;
- `unit`.

Assert all kinds use the same shield → armor → resistance → boss transition → death/child/revival → bounty pipeline. Assert tower-only fixtures produce byte-identical v1 events and outcomes.

### 6.2 Implement

- Introduce one closed generic combat-source record for the v2 kernel.
- Generalize damage/status attribution without copying damage resolution.
- Add telemetry-v2 records for power activation/denial, Ward consumption, displacement, unit lifecycle, mechanism activation, specialization, and new Aether actions.
- Add bounded v2 state collections and resource-ceiling proofs.
- Add checked backward displacement that clamps at route zero and preserves movement remainder.

### Exit gate

- Zero gameplay change with all new systems unequipped.
- No second damage reducer.
- Entity/event/telemetry overflows fail before partial mutation.

### Commit

`Generalize Aegis combat provenance for unlock systems`

## 7. Checkpoint E — Temporal Edict vertical slice

This is the end-to-end pattern used by every later Protocol.

### 7.1 Red tests

- Tier 1/2/3 exact cost, cooldown, duration, magnitude.
- Spawn-during-field inherits remaining duration.
- Strongest-only composition with Chronos/drench.
- boss/minimum-speed scaling.
- planning and Pause freeze.
- shared cooldown and repeat surcharge.
- accepted/rejected semantic events, state hashes, replay round trip.
- no-Protocol Strategos baseline unchanged.

### 7.2 Implement

- Wire Management as sole Aether authority for accepted v2 commands.
- Add canonical Protocol runtime/ready-tick/cast-count/global-field records.
- Insert effect materialization after expiry at the reviewed v2 phase.
- Add semantic companion/view-model fields.
- Add one slot to the candidate development profile and the `m05` loan/grant path.

### 7.3 Candidate UI

- Add pre-battle Protocol slot and Tier-1 loan copy.
- Add one in-battle control with exact Aether/cooldown state.
- Add confirm/cancel targeting framework even though Temporal is global.
- Add semantic announcements and Reduced Motion fallback.

### Exit gate

A live candidate preview can cast Temporal, replay it to the same final hash, pause it, finish the mission, and display its result-card badge.

### Commit

`Add Temporal Edict end to end`

## 8. Checkpoint F — damage, Ward, and scheduled Protocols

### 8.1 Skyfire

Red tests cover both scheduled strike snapshots, spawn between strikes, shield coefficient, boss coefficient, second-hit hard control/Resolve, threshold pods, child/revival/bounty, no-target rejection, and wave-clear hold through final resolution.

Implement scheduled Protocol intents through the generic damage pipeline. Emit telegraph and resolution events separately.

### 8.2 Aegis Ward

Red tests cover charge/per-leak caps, multi-integrity leaks, same-tick leak order, excess damage, expiry/wave cleanup, objective/Laurel/score facts, and result attribution.

Implement Ward in leak arbitration, not presentation or post-hoc integrity repair.

### 8.3 Ascension foundation

Add the once-per-mission ledger and combined field/amplification representation now, but defer player unlock/content activation until its full UI/art checkpoint.

### Exit gate and commit

- Protocol replay corpus has all three tiers of Temporal/Skyfire/Ward.
- No shield/threshold/revival bypass.

Commit: `Add Skyfire and Aegis Ward Protocols`

## 9. Checkpoint G — displacement and hard-control Protocols

### Red tests

For Poseidon, Hermes, and Medusa:

- strict target geometry and stable selection ties;
- route-zero clamp and movement remainder;
- displacement cooldown;
- Heavy/boss coefficients exactly once;
- ground/air masks;
- hard-control bucket/Resolve/rejection;
- stale/out-of-board targets;
- all three tier goldens and replay hashes.

### Implement

- Poseidon radius selection plus atomic displacement/drench.
- Hermes route-front selection plus proportional rewind.
- Medusa fixed-point cone inclusion without floating-point trig in simulation; compile half-angle comparison constants and compare dot/cross products.

### UI

Add route-point and drag-vector target overlays driven from semantic target records. Confirm/cancel stays two-step and mobile-safe.

### Commit

`Add Poseidon Hermes and Medusa Protocols`

## 10. Checkpoint H — tower-amplification and economy Protocols

### Athena and Hephaestus

- Wire friendly modifier queries into effective range, damage, and next cooldown.
- Preserve in-progress cooldowns.
- Use stable nearest-tower selection.
- Compose with Athena Nexus/external caps as specified.
- Implement multi-source disable accounting and post-Overclock shutdown.

### Hades

- Add speed-risk mark, leak penalty, basis-point bonus-bounty remainder, lineage guard, and `protocolAetherEarned` score exclusion.
- Test that a cast can lose value, cannot pay twice, and cannot launder unspent-Aether score.

### Ascension

- Finish all three tiers, the `m20` loan/permanent grant, once ledger, spawn-during-field behavior, and result badge.
- Remove/reject any old Overcharge gameplay record in v4 while retaining historical text/artifacts where needed for v1 compatibility.

### Exit gate and commit

Commit: `Complete the Aegis Divine Protocol roster`

## 11. Checkpoint I — all tower specializations

### 11.1 Framework red tests

- Level 2 ordinary Upgrade rejects `specialization-required` in v4.
- `specializeTower` accepts exactly one branch available in the run header.
- Wrong family, locked alternate, stale/non-L2 tower, repeat branch, insufficient Aether, and extra fields reject without side effects.
- Existing Level-3 cost is paid and added to actual investment.
- Sell refund remains `floor(actualInvested × 70 / 100)`.
- v3 linear upgrades remain unchanged.

### 11.2 Framework implementation

- Resolve complete branch records through the behavior registry.
- Add branch ID to canonical tower state and semantic inspection.
- Add the two-card contextual branch chooser, exact comparisons, and “what you give up” copy.
- Add profile `tempered` grant to the next run only.

### 11.3 Behavior batches

Implement and test in isolated batches:

1. Sentinel, Chronos, Siege;
2. Hoplite, Oracle, Artemis;
3. Hermes, Poseidon, Medusa;
4. Hephaestus, Athena, Apollo;
5. Hades, Talos, Zeus.

Each family receives focused behavior goldens for counters, collateral, recursion guards, target caps/ties, statuses, Aether attribution, and intended weakness. Add matched-budget role witnesses only after the behavior tests pass.

### Exit gate and commits

Use one green commit per behavior batch, then one UI/profile integration commit. All thirty branches must be selectable in Training even before full campaign missions exist.

## 12. Checkpoint J — Relics and Laurel allocation/profile v2

### Red tests

- v1→v2 migration is idempotent/resumable.
- victory writes results, Laurel identities, rewards, mastery, and grants atomically.
- Tier allocations cost 6/12, refund atomically, and lower invalid equipped tiers.
- all ten maximized Protocols total exactly 180 Laurels.
- Relic slot unlocks and duplicate/locked/over-cap loadouts reject.
- each benefit/drawback, composition clamp, order, and rounding boundary.
- actual paid investment controls 70% refund.
- running missions/replays never consult changed profile state.
- quota/session-only/recovery behavior.

### Implement

Add versioned modules under `games/aegis/js/progression/` for profile validation, migration, reward transaction, Laurel allocation, mastery, and loadout resolution. Keep storage adapters outside pure reducers and provide an in-memory adapter for tests/direct-file fallback.

Add the four-section pre-battle loadout, Laurel allocation panel, Relic comparison cards, next-unlock ribbon, and Codex entries.

### Commit

`Add Aegis profile progression and Relics`

## 13. Checkpoint K — reinforcements

### Red tests

- one slot, grants, mission marker support, stale/occupied markers, one live unit, cost/cooldown/lifetime/wave cleanup;
- runtime-ID monotonicity and entity cap;
- Spartan hard-control/Resolve and three-contact exhaustion;
- Artemis air/ground acquisition and armor ignore;
- Talos radius/armor-break ordering;
- generic damage attribution, bounty, objectives, replay/hash, and no refund.

### Implement

- Add v2 summon kinds and marker role proof.
- Add deploy command and Management payment.
- Add deterministic unit acquisition/attack/contact/expiry.
- Add one candidate marker to `m05` developer content for Training-only coverage without changing its production mission promise; campaign missions `m10+` receive authored markers during campaign integration.
- Add loadout and in-battle control.

### Commit

`Add temporary Aegis reinforcements`

## 14. Checkpoint L — battlefield mechanisms

### Red tests and implementation order

1. Bronze City Gate: authored contacts, capacity, hard control/Resolve/boss.
2. Harbor Chain: zone eligibility, air immunity, strongest slow.
3. Sacred Braziers: pulse timing, cap/tie, common damage pipeline.
4. Athena Statue Beam: telegraph, fixed line geometry, boss coefficient, air.
5. Bridgefall: once ledger, blast, rubble until wave clear, no topology mutation.

Every mechanism also tests cost, cooldown, stale/unknown activation ID, pause/planning, replay/hash, result facts, and presentation semantic state.

Add mechanism hooks only to their specified mission maps; Training may use a dedicated deterministic mechanism yard rather than contaminating campaign geometry.

### Commit

`Add player controlled Aegis map mechanisms`

## 15. Checkpoint M — Recon, mastery, Codex, and share cards

### Tests

- Baseline never hides routes/traits/hazards/resistances.
- Recon I/II/III reveal only compiled immutable data at exact horizons.
- No Recon field appears in canonical sim state/header/hash/key.
- Defense mastery derives only from verified results; alternate branch and cosmetic unlock timing.
- Victory/share card badges reflect actual canonical use facts without affecting them.
- 10–20 second guided recording remains local/presentation-only.

### Implement

- Add preview projection helpers and responsive wave timeline.
- Replace older Oracle Forecast with Recon II.
- Add mastery/Codex panels and reward reveal.
- Extend result/share-card rendering with Protocol/Relic/branch/unit/mechanism badges.

### Commit

`Add Aegis Recon mastery and result rewards`

## 16. Checkpoint N — generated and production presentation assets

### 16.1 Reference preparation

- Inspect Ryan's supplied Armara references read-only.
- Inspect the canonical hourglass/logo and current bright tower/enemy composites.
- Lock transparent canvas, safe zone, camera, light direction, palette, outline, and per-asset action/frame requirements.

### 16.2 Generate in reviewed batches

Use image generation once per distinct raster asset or deliberately composed atlas source. Save selected project assets under versioned `games/aegis/art/v3/`, never only in a temporary/Codex directory.

Batches:

1. ten Protocol icons;
2. ten effect-sheet sources and Reduced Motion stills;
3. eight Relic icons plus Recon/mastery emblems;
4. three reinforcement action sheets;
5. five mechanism state sheets;
6. thirty Level-3 specialization visual variants;
7. loadout/Codex/result menu panels that complement the GameSlop brand shell.

### 16.3 Inspect and integrate

- Render alpha against white, near-black, and representative mission backgrounds.
- Validate silhouette at gameplay size and atlas gutters/extrusion.
- Reject baked text, logos other than approved hourglass use, muddy low contrast, photoreal inconsistency, asphalt, cropped weapons, frame drift, and false transparency.
- Pin exact asset bytes/rectangles/cues in presentation catalog v2.
- Bind animations to semantic events; never derive simulation time from frames.

### Tests

Extend asset-inspector, sprite-atlas, presentation-dispatch, delivery-budget, and art-manifest tests. Add desktop/mobile/Reduced Motion visual evidence outside the staged source set unless a reviewed guide is intentionally committed.

### Commits

Use one reviewed commit per asset family so defective art can be replaced without mixing simulation changes.

## 17. Checkpoint O — twenty-mission integration

The existing campaign plan remains the mission authority. Integrate systems as their unlock missions become available:

- author exact v4 mission/map records for `m02–m03`, `m06–m20` in act order;
- retain hidden grid/fixed-pad strategy and natural player presentation;
- add Protocol loans, reward grants, Relic/slot milestones, reinforcement markers, and specified mechanisms;
- add waves/enemies/bosses required by the campaign spec;
- add environment/road packs in ancient-Greek earth, limestone, cobble, harbor, volcanic, underworld, storm-coast, and Olympus variants; no asphalt;
- keep roads visually integrated with terrain and narrower-looking through edge treatment without changing the approved collision width silently.

Each mission requires source validation, map proof, deterministic clear/defeat fixtures, no-unlock Story/Strategos victory, mastery objective, result/reward transaction, replay fixture, semantic route/pad/accessibility review, and desktop/mobile live boot before the next act is promoted.

Use act-level commits after every contained mission set passes full tests.

## 18. Checkpoint P — balance and release-candidate verification

### Simulation evidence

- Regenerate the full role/weakness matrix.
- Add matched-budget Protocol-versus-build witnesses and negative controls.
- Add branch witnesses for all families.
- Add Relic tradeoff, reinforcement timing, and mechanism timing scenarios.
- Run deterministic seeded controls, boss/air/shield/control axes, score-exclusion audits, replay corpus, compiler rebuild, and cross-execution hash checks.

### Full repository checks

- Run bare `node --test` inside every game folder and preserve at least the required 90/90 legacy baseline plus all new tests.
- Run JS syntax checks on every changed/generated script.
- Confirm no forbidden paths are staged.
- Confirm `games/.nojekyll` exists.
- Serve the repository and verify `_kit/shell.js` returns 200.
- Boot `games/aegis/preview.html` through live CDP at desktop and mobile widths.
- Exercise at least one of each new action family and inspect console/network/semantic state.
- Verify direct-file fallback where required.

### Handoff

Report the candidate URL/path, tests, replay/content identities, known Candidate-BAL scopes, visual evidence, and exact commits. Ask Ryan for one consolidated playtest covering comprehension, feel, visual readability, and balance. Do not switch the public route or push without separate approval.

## 19. Definition of ready for Ryan's playtest

Ryan's test build is ready when:

- the candidate preview offers a campaign/profile or deterministic developer grant that exposes every approved system;
- all ten Protocols and tiers function with visible Aether/cooldown/targeting;
- all thirty tower branches are inspectable and usable in Training;
- all eight Relics, three reinforcements, and five mechanisms are demonstrable;
- Recon/mastery/rewards persist locally and replay independently;
- generated/integrated art is readable, animated, Armara-branded, and Reduced-Motion-safe;
- the full test/replay/compiler/live-boot gates pass;
- no debug-only strategic-pad labels, ticks, hashes, or mission setup appear in ordinary play.
