# Armara Aegis Slice Content Schema — Implementation Plan

**Date:** 2026-08-27

**Goal:** Implement the accepted Phase 2 source/content architecture for a complete Candidate-BAL `m01`/`m04`/`m05` vertical slice while preserving schema-v1/schema-v2 validation and canonical compiled-content bytes, keeping the public Aegis route on `legacy-proving-ground`, and preventing Candidate-BAL data from authorizing production art or release.

**Binding architecture specification:** `docs/superpowers/specs/2026-08-27-armara-aegis-slice-content-schema.md`

**Higher authority:** `docs/superpowers/specs/2026-08-26-armara-aegis-campaign-expansion.md` and `docs/aegis/architecture-decisions.md`

**Execution model:** Test-first, subagent-driven implementation with root-owned integration, immutable artifact generation, commits, and release decisions.

## 1. Non-negotiable boundaries

- Work on `main` in `D:\ClaudeCode\GameSlop` and preserve unrelated worktree changes.
- Never stage or commit `research/`, `Assets/`, `.superpowers/`, or the untracked root handoff copy.
- Use `apply_patch` for source, test, content, and documentation edits. Only reviewed build tools may write generated artifacts.
- Preserve the repository's `.gitattributes` LF contract for Aegis content, simulation/delivery code, fixtures, Aegis/spec/plan/balance documentation, and compiler/analyzer sources. Raw-source hashes are over the exact settled LF bytes; no formatter or line-ending rewrite may run after hashes are recorded.
- Only the root integrator stages, commits, pushes, regenerates production artifacts, or changes shared bundle/module lists.
- Commit as `Ryan <ryan@xynco.io>` with exactly:

  ```text
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```

- Run bare `node --test` inside `games/aegis` and every other game owner folder. Do not use `node --test <directory>`.
- Source-manifest v1 and v2 validation and canonical compiled-content bytes are compatibility locks. Given identical simulation bytes, their builds must remain artifact-identical. Historical immutable artifacts, filenames, and identities must remain retained and verified. Task 7's deliberate deterministic simulation-bundle extension is expected to produce new simulation, manifest, and `rulesetHash` identities; it must not alter the locked v1/v2 compiled-content bytes or invalidate/overwrite the historical artifacts.
- `games/aegis/content/maps/m01.json` remains the authoritative map-v1 source. Do not rewrite it as map v2 during this plan.
- Candidate-BAL permits deterministic tests, developer-only play, balance iteration, and witness replay work only.
- Candidate-BAL does **not** authorize production bitmap generation, production atlases, mass battlefield art, default-route selection, production-profile writes, hub links, public campaign release, or publishing.
- No production-art task may start until the applicable annex is `balance-approved`; no default/public campaign switch may occur before the full campaign Phase 8 gates.
- The existing `games/aegis/index.html`, hub entry, legacy namespace, and public/default route remain unchanged through Tasks 1–7.
- A separate developer preview may be implemented only in Task 8 after the candidate is truthfully playable. It stays unlinked and non-default, and it is not published without Ryan's explicit preview approval.
- Keep `games/.nojekyll`. “Live” still requires public `/_kit/shell.js` HTTP 200 plus a fresh CDP-driven boot reaching `body.dataset.ready === "1"` with required art settled.
- Do not edit the frozen ABI-v1 descriptor or behavior-contract membership to add reveal, mark, guard, or boss behavior. V3 composes the accepted existing contracts and closed rule catalogs.

## 2. Stop conditions and approval policy

Stop the affected task and escalate to the root integrator when any of these occurs:

1. A proposed source value changes a binding lock: mission identity/order/wave count/reward, a defense cost/role/weakness/target mask/named mechanic, Mission 1 geometry/economy, the universal refund/control/targeting/fairness rules, or an ABI rule.
2. A behavior needed for the slice cannot be expressed by the contracts and delivery kinds in the accepted v3 specification.
3. A map requires a `line`, `mine`, or `air` proof, an unknown proof version, a waiver, duplicated physical geometry, or another fail-open substitute.
4. A Candidate-BAL tuning change would have to sit outside a declared `candidateScopes` pointer or overlap a binding lock.
5. V1/v2 validation or canonical compiled-content bytes drift; a same-simulation build changes any artifact identity; historical immutable artifacts disappear or change; or a simulation/manifest/`rulesetHash` identity changes without the deliberate reviewed simulation-bundle byte change at Task 7.
6. Any task would need legacy-proving-ground values as a fallback or migration source.
7. A preview would claim `m01`/`m04`/`m05` playability before all three missions, the five defenses, five regular enemies, Talos, replay, events, objectives, and economy are authoritative and tested.
8. Any work would generate production art, mutate the default route, publish, or write a production profile before its explicit gate.

Ryan is required only when a proposal changes a binding product lock or another campaign-specification stop condition. Candidate tuning inside declared Candidate-BAL scopes, schema defects, deterministic implementation corrections, and map/pad iteration inside the approved mission concepts proceed without a Ryan question. Batch any genuine Ryan decisions into one set rather than interrupting after each task.

## 3. Recorded technical rulings

The final specification resolves the three former representation questions. These are implementation contracts, not open choices:

1. **Normalized lock tree and value hashes.** `bindingLocks` and `candidateScopes` address one normalized tree containing exactly `schemaVersion`, `campaignRules`, `defenses`, `summons`, `enemies`, `bosses`, `missions`, `maps`, and `eventCatalog`; `schemaVersion` is exactly 1. Every collection except singleton `campaignRules` is a plain ASCII-keyed object keyed by authored ID. Maps are normalized v2 IR, authored decimals are exact ABI integers, and approval/provenance, localized/UI-only values, presentation-pack IDs, and asset/cue mappings are absent. `expectedCanonicalValueHash` is exactly `sha256:` plus lowercase SHA-256 of the ABI-v1 canonical UTF-8 bytes of the dereferenced value. One pointer covers its node and all descendants; duplicate or ancestor/descendant pointers within a scope list fail, any binding/candidate intersection fails, and every simulation leaf is covered exactly once. The root pointer, presentation-only targets, missing nodes, noncanonical escapes, and array indices outside semantic-order arrays fail.
2. **Defense access grants.** Every defense `unlockId` resolves one-to-one to campaign `accessGrantIds`; no two defenses share it. Starter ownership uses resolved initial grants. An accepted `unlock-defense` first-clear reward names the defense ID and transactionally grants that defense's resolved `unlockId`; replay state pins the ordered resolved `accessGrantIds` used for the run.
3. **Candidate presentation catalog.** The hash-pinned top-level `presentationCatalog` reference resolves schema v1 containing exactly `schemaVersion`, `id`, `packRecords`, and `cueMappings`. Pack records are ASCII sorted and exactly `{ id, kind: "procedural-placeholder", missionIds, fallbackStyleId }`; cue mappings are ASCII sorted and exactly `{ cueId, kind: "semantic-fallback", fallbackStyleId }`. Every mission belongs to exactly one pack and every mission `presentationPackId` and event `presentationCueId` resolves exactly once. Asset paths/URLs, sprite rectangles, transfer-byte claims, duplicate/unresolved assignments, and other kinds fail. Presentation-catalog v1 can never be production-approved; production assets require a later reviewed schema version.

No residual product or technical decision is needed for these contracts. If implementation would require behavior outside them or a binding gameplay/release change, use the Section 2 stop policy rather than widening the schema.

## 4. Dependency graph and ownership model

```text
Task 0 baseline
  ├─ Task 1 v3 loader / raw hashes / annex shell
  ├─ Task 2 normalized map IR / map-v2 physical lanes
  │    └─ Task 3 analyzer / selection / role proofs / m01 supplement
  └─ Task 4 strict campaign record schemas
          └──────────────┬───────────────────────┘
                         ▼
              Task 5 cross-file compiler and artifacts
                         ▼
              Task 6 complete Candidate-BAL sources
                         ▼
              Task 7 kernel, replay, behavior, balance
                         ▼
              Task 8 isolated developer preview
```

At most three implementation subagents run concurrently. Each subagent writes tests before or with implementation, owns only its assigned paths, does not commit, does not regenerate checked-in production artifacts, and reports assumptions and exact commands/results.

### Root-owned shared files

Only the root integrator edits these shared seams after reviewing agent work:

- `tools/lib/aegis/compiler.js`
- `tools/lib/aegis/artifacts.js`
- `tools/lib/aegis/source-loader.js`
- `tools/lib/aegis/simulation-bundle.js`
- `tools/build-aegis-content.js`
- `tools/analyze-aegis-map.js` when two agent outputs meet there
- `games/aegis/content/generated/**`
- `games/aegis/content/manifests/slice-dev-v1.json`
- `games/aegis/content/annexes/slice-dev-v1.json`
- `games/aegis/js/delivery/release-selector.js`
- `games/aegis/index.html`, `games/index.html`, and any public/default routing

### Standard nonoverlapping roles

- **Strict-source agent:** new v3 reference/annex loader modules, loader fixtures, focused tests.
- **Map agent:** normalized map IR, map-v2 validation, analyzer/role-proof modules, map fixtures/reports.
- **Record-schema agent:** campaign/defense/enemy/boss/mission/event/string/presentation strict record contracts and focused tests.
- **Compiler agent:** new v3 compiler partitions, provenance/presentation artifact modules, synthetic complete fixture tests; it does not own generated production artifacts.
- **Content/map-authoring agents:** separate source directories in Task 6; the root owns the final manifest/annex hash wiring.
- **Simulation agents:** behavior registry first, authoritative kernel/replay second, balance harness third, with no file overlap.
- **Delivery agent:** Task 8 preview-only loader/service-worker/entry files after the playability gate.

## 5. Task 0 — Freeze the compatibility baseline

### Files

- No source edits required.
- Evidence is recorded in the execution ledger or checkpoint notes, not in forbidden/untracked paths.

### Steps

1. Record HEAD, branch, worktree exclusions, `games/.nojekyll`, current ABI hash, current simulation bundle hash, and every checked-in generated artifact filename/hash.
2. Record the schema-v1 fixture output bytes and the schema-v2 production-map-foundation output bytes.
3. Run the current focused content, map, delivery, command, management, and replay tests before v3 edits.
4. Run the serialized all-game matrix in Section 15 and record owner-by-owner counts.
5. Copy no legacy values into candidate fixtures. The legacy proving ground remains report/parity-only.

### Exit gate

- The repository baseline is green.
- V1/v2 canonical compiled-content byte strings and same-simulation artifact hashes are available as test constants before v3 parsing begins.
- Unrelated dirty/untracked files are unchanged.

## 6. Task 1 — V3 strict loader, hash references, annex contracts, and compatibility locks

**Dependency:** Task 0 and the recorded lock-tree/hash contracts in Section 3.

### Owner and files

Strict-source agent owns only:

- `tools/lib/aegis/v3-source-loader.js` — new
- `tools/lib/aegis/v3-annex.js` — new
- `games/aegis/tests/content-v3-loader.test.js` — new
- `games/aegis/tests/fixtures/compiler/v3-loader/**` — new
  - `valid-v3-structural/presentation/slice-v1.json` is the canonical valid reference/hash fixture.
  - `invalid-presentation-reference/**` contains missing-key, unknown-key, bad-hash, missing-file, and duplicate-real-file cases.

Root later wires these into `source-loader.js`, `compiler.js`, and `build-aegis-content.js`.

### Red tests first

Add fixtures/tests for:

- One valid minimal structural v3 graph with exact top-level/ref/mission shapes, including a required hash-pinned `presentationCatalog` reference and a real `presentation/slice-v1.json` procedural-placeholder fixture.
- Exact `sha256:`-prefixed source-byte SHA-256 for every reference, including presentation, CRLF/final-newline changes.
- Unknown/missing keys at every reference shape.
- Bad/missing hash, uppercase hash, wrong bytes, stale annex ID/state, and source/annex approval disagreement.
- Noncanonical paths, uppercase/non-JSON extension, empty/dot/parent/percent/colon/backslash segments, out-of-root targets, duplicate source strings, duplicate real files, symlinks, junctions, and special files.
- BOM, invalid/overlong UTF-8, duplicate decoded keys, trailing data, exponent, `-0`, unsafe number, excessive decimal precision/depth/bytes/fields.
- Authority/evidence repository containment and exact-byte hashes.
- The exact version-1 normalized lock tree, singleton campaign rules, ID-keyed collections, normalized map IR, excluded presentation/provenance values, and exact ABI-canonical `sha256:` value-hash goldens.
- Missing/root/presentation-only lock pointer, noncanonical JSON-pointer escape, illegal ID-collection/array index, mismatched canonical value hash, duplicate or ancestor/descendant scope, binding/candidate intersection, multiply covered leaf, and uncovered simulation leaf.
- Missing/duplicate/bad-hash/unknown-key `presentationCatalog` references fail before schema dispatch; a valid referenced catalog is exact-byte hash-checked and strict-parsed before the v3 `incomplete-schema` stop.
- Empty evidence accepted only for Candidate-BAL; promoted states require balance-report and witness-replay records.
- V1/v2 fixture and production builds supplied the unchanged simulation bytes remain artifact-identical and retain their pre-Task hashes.
- After a structurally valid v3 manifest and annex pass parse/hash checks, the partially integrated compiler fails with one stable `incomplete-schema` diagnostic before `buildArtifacts` or any emission path is called. A spy/no-output assertion proves schema 3 cannot fall through the current schema-1 artifact builder.

Confirm the focused tests fail for the intended missing implementation before writing the loader.

### Implementation

1. Reuse `strict-json.js`, `canonical.js`, `diagnostics.js`, and the v2 realpath policy rather than adding a permissive JSON path.
2. Dispatch by exact source-manifest schema version before reading version-specific fields. Do not normalize v1/v2 through the v3 record.
3. Read only manifest-declared references; never scan a directory.
4. Hash exact raw bytes first, then strict-parse, then validate exact structure and semantics.
5. Require and hash-check `presentationCatalog` exactly like every other top-level v3 reference; the valid-minimal loader fixture includes the schema-v1 procedural-placeholder catalog, not a fabricated in-memory pack.
6. Build/accept only the exact ID-keyed normalized lock-tree shape from Section 3. Hash a dereferenced lock value as `sha256:` plus lowercase SHA-256 over ABI-v1 canonical UTF-8 bytes, then enforce exact-once descendant coverage.
7. Return deeply frozen plain-data records with separate raw provenance and normalized-source views.
8. Keep approval/provenance and all presentation-only values outside the simulation lock tree and the tree used for ruleset framing.
9. Add explicit CLI support for an alternate manifest without changing the default:

   ```text
   --manifest games/aegis/content/manifests/slice-dev-v1.json
   ```

   It must be a contained repo-relative path, may not combine ambiguously with `--fixture`, and never comes from a browser query.
10. Add a temporary fail-closed v3 compiler preflight at the shared dispatch boundary. Until Task 5 installs the complete v3 compiler, successful v3 reference/hash/annex/presentation validation must end in the stable `incomplete-schema` diagnostic before `buildArtifacts`, filesystem writes, or valid-looking artifact metadata. Do not route schema 3 through the schema-1 builder.

### Focused verification

```powershell
Push-Location games/aegis
try {
  node --test tests/content-v3-loader.test.js
  node --test tests/content.test.js
} finally { Pop-Location }
node tools/build-aegis-content.js --check
node tools/build-aegis-content.js --check --fixture valid-minimal
```

### Exit gate

- V3 references, the exact lock-tree/coverage contract, annex structure, and the hash-pinned presentation-catalog reference fail closed with stable paths.
- A first v3 slice can be parsed and hash-checked but cannot emit any artifact until Task 5 replaces the explicit `incomplete-schema` preflight with the complete v3 compiler.
- V1/v2 code paths and bytes are unchanged.
- No production manifest is replaced, no generated candidate artifact is committed, and no art/release work starts.

## 7. Task 2 — Normalized map IR and map-v2 physical/shared routes

**Dependency:** Task 0; consumes strict parsed map records from Task 1 but may use frozen synthetic objects while Task 1 is in parallel.

### Owner and files

Map agent owns:

- `tools/lib/aegis/map-ir.js` — new
- `tools/lib/aegis/map-v2-validation.js` — new
- `games/aegis/tests/map-ir.test.js` — new
- `games/aegis/tests/fixtures/maps-v2/**` — new

The agent does not edit current `maps/m01.json`, candidate mission maps, the top-level compiler, or generated artifacts.

### Red tests first

1. Normalize the current map-v1 `m01` into a frozen v2 IR and assert byte-exact existing route length, segments, pads, probes, exposures, clearances, stage order, and spread.
2. Compile a synthetic two-entry map whose two logical routes share one physical trunk. Assert:
   - One physical trunk geometry record.
   - Two route-local segment-offset tables.
   - Correct route lengths and remaining distance before, inside, and after the trunk.
   - One rendered/analysis geometry identity with shared provenance.
3. Add invalid cases: duplicate geometry under another lane ID, reverse traversal, repeated segment, disconnected endpoint, wrong kind, missing/stale/invalid merge, split/continuation arity, directed cycle, join-neighborhood escape, undeclared crossing/overlap, invalid overpass, unreachable gate, bad portal bound, and unsafe aggregate length.
4. Assert source arrays requiring ASCII order reject reorder rather than silently sort.
5. Assert normalization never mutates or freezes caller data and outputs canonical deeply frozen records.

### Implementation

- Define one exact compiler-internal normalized map IR used by movement, range analysis, road rendering, role proofs, and simulation content.
- Preserve physical lane identity separately from logical route identity.
- Compile physical lane subsegments once; route-local tables reference them and own route offsets/remaining distance.
- Derive join collision exceptions only inside the specified closed join radius.
- Keep crossings physical-lane based and joins distinct from crossings.
- Map-v1 normalization uses `lane.migrated.<routeId>`, preserves exact compiled subsegments, derives endpoint route sets, preserves pad order as selection order, and synthesizes no joins.
- Provide no renderer-owned reconstruction and no floating-point route math.

### Focused verification

```powershell
Push-Location games/aegis
try {
  node --test tests/map-ir.test.js
  node --test tests/map-geometry.test.js
} finally { Pop-Location }
```

### Exit gate

- Shared physical geometry and route-local progress are proven independently of candidate maps.
- M1 normalization is bit-for-bit compatible.
- No candidate coordinate is treated as approved and no default analyzer output changes yet.

## 8. Task 3 — Route-local analyzer, selection order, role proofs, M1 supplement, and Hoplite markers

**Dependency:** Task 2 plus the resolved Hoplite Level-1 projection range and closed comparator IDs from strict defense/campaign records. Synthetic resolved values may drive early unit tests; final integration waits for Task 4.

### Owner and files

The same map agent continues with:

- `tools/lib/aegis/map-role-proofs.js` — new
- `tools/lib/aegis/map-selection.js` — new
- `tools/lib/aegis/map-validation.js` — extend
- `tools/lib/aegis/map-report.js` — extend
- `games/aegis/tests/map-role-proofs.test.js` — new
- `games/aegis/tests/map-analysis.test.js` — extend
- `games/aegis/tests/fixtures/map-proofs/**` — new

Root alone reconciles changes to `tools/analyze-aegis-map.js` and adds its explicit `--manifest` option after review.

### Red tests first

- Route-local claimed/unclaimed exposure: a zero claimed route fails; high unclaimed exposure cannot rescue it; route-specific and merge pads grade correctly.
- Selection order is the unique contiguous `0..n-1` order derived from `(minimum claimed-route stage, smallest attaining route ID, pad ID)`.
- Support `route-status` proves every claimed route and exact window count.
- Support `friendly-neighbor` proves the exact squared-distance neighbor graph and eligible tag filter.
- Unknown/`line`/`mine`/`air` proof kinds and versions fail `ROLE_PROOF_UNIMPLEMENTED`.
- Guard proof has exactly slots 0/1/2, distinct physical points, range legality, per-route 8,000 spacing, every claimed route coverage, and exact shared-route membership.
- Guard-intent pads prove two routes or two disconnected windows.
- Compiled markers have exact lane offsets, coordinates, integer tangents, sorted route distances, and `routeDistance + remainingDistance = routeLength`.
- Forward crossing uses `prior < marker <= next`; exact rational crossing order uses cross multiplication and the full route/marker/enemy tie chain.
- Air/Resolve/occupied-control/ineligible contacts prefilter before guard consumption.
- Map-v1 v3 missions require one exact supplement; map-v2 missions forbid it; supplements cannot alter geometry or selection order.
- A proof-only change changes normalized simulation content; equivalent source formatting changes provenance only.
- Node and classic-script simulation helpers produce the same marker/contact ordering bytes.

### Implementation

1. Extend reports with physical lane IDs, logical route IDs, shared-lane provenance, route-local offsets/remaining distance, and claimed/unclaimed exposure.
2. Keep all existing m01/legacy report modes working; legacy remains report-only.
3. Make role-proof validation consume the resolved compiled defense range and closed rule IDs rather than duplicating Hoplite values.
4. Emit complete immutable guard markers; runtime must never project from cells or renderer paths.
5. Add `--manifest <path>` to analyzer integration so the default v2 manifest remains unchanged and candidate maps are discoverable only through the explicit manifest.

### Focused verification

```powershell
Push-Location games/aegis
try {
  node --test tests/map-role-proofs.test.js
  node --test tests/map-analysis.test.js
  node --test tests/map-geometry.test.js
} finally { Pop-Location }
node tools/analyze-aegis-map.js --mission m01 --check
node tools/analyze-aegis-map.js --mission legacy-proving-ground --report-known-issues
```

### Exit gate

- Map-v1 m01 goldens remain exact.
- Route-local grading and role proofs fail closed.
- No m04/m05 map is accepted until Task 6 authoring passes these same tests.
- No production art or visible specialist copy is authored in this task.

## 9. Task 4 — Strict defense, summon, enemy, boss, mission, economy, event, string, and presentation schemas

**Dependency:** Task 1 and the recorded access-grant/presentation contracts in Section 3. Can run in parallel with Tasks 2–3 because it owns no map files.

### Owner and files

Record-schema agent owns:

- `tools/lib/aegis/v3-record-contracts.js` — new
- `tools/lib/aegis/v3-rule-catalog.js` — new
- `games/aegis/tests/content-v3-records.test.js` — new
- `games/aegis/tests/fixtures/compiler/v3-records/**` — new
  - `valid/presentation/slice-v1.json` is the exact valid schema-v1 record fixture.
  - `invalid-presentation/**` contains bad kind/order/assignment/asset-field/approval cases.

It does not edit source content, compiler integration, simulation modules, or generated artifacts.

### Red tests first

Build strict constructor/validator tables and invalid fixtures for every exact record in specification Sections 3.2 and 8–11:

- Campaign rules, three exact difficulty records, Assist, target comparators, status/damage IDs, closed catalogs, campaign modifiers, access grants, mission universe, and score divisor 19.
- Defense wrappers, fixed-marker summons, five defense records, exactly three complete levels, purchase kinds, UI typed stat IDs, policy/target/event/string references.
- Exact behavior contract/version/delivery-kind/parameter matrices for `direct`, `splash`, `slow`, `spawnUnit`, `block`, and the two `aura` forms.
- Strict nested counters, source forms, payloads, recursion/reset/empty-activation flags, event ownership, trigger-before-consumer, and per-tick caps.
- Regular enemy completeness, resistances/shields/control, cloak-v1, child/revival discriminators, lineage/bounty suppression, and terminal five-slice-enemy constraints.
- Boss completeness, execute forbidden, guarded descending thresholds, one-transition clamp, phase interval coverage, resistance cap, children/timers/events.
- Mission/briefing/tutorial/score, exact ordered waves/groups/economy, objectives, rewards, previews, prerequisite/unlock graph, and mission compatibility.
- Event payload schemas/phases and string placeholders/text safety.
- Defense `unlockId` resolves one-to-one to campaign `accessGrantIds`; duplicate grants, shared unlocks, magic/null starter access, and an `unlock-defense` reward that cannot transactionally resolve defense ID to its grant all fail. Replay-facing fixtures retain ordered resolved access grants rather than current-profile inference.
- Presentation catalog schema v1 exact keys and ordering; only `procedural-placeholder` packs and `semantic-fallback` cues; one pack per mission; exact mission/event pack/cue resolution; fallback style IDs resolve to reviewed presentation code; no asset path/URL, sprite rectangle, transfer-byte claim, duplicate assignment, or production-approved state.
- Maximum counts, byte/depth/field limits, safe arithmetic, positive/zero rules, ordering, IDs, and exact unknown-key diagnostics.
- Oracle reveal/mark accepted only as typed `aura@1`; any new contract or changed ABI membership fails.

Use a synthetic complete record set whose numbers are clearly test sentinels, not Candidate-BAL source values. Confirm red tests before validators.

### Implementation

- Use data-driven exact-field/discriminator tables rather than permissive optional-object parsing.
- Preserve semantic authored order only where the specification names it; reject unsorted unordered sets.
- Resolve all rule IDs against compiler-owned closed catalogs that are also represented in the self-contained simulation bundle.
- Resolve every defense unlock through campaign `accessGrantIds` and expose the defense-ID-to-grant mapping to reward/replay cross-validation without inventing a second unlock catalog.
- Parse the referenced presentation catalog as strict companion-only data. Schema v1 is unconditionally ineligible for `production-approved` regardless of source/annex assertions.
- Keep presentation keys as stable references; never derive combat values from strings/UI fields.
- Return frozen normalized records with no prototype/accessor/shared-reference laundering.

### Focused verification

```powershell
Push-Location games/aegis
try {
  node --test tests/content-v3-records.test.js
  node --test tests/abi.test.js
  node --test tests/effects.test.js
  node --test tests/targeting.test.js
} finally { Pop-Location }
```

### Exit gate

- Every v3 non-map source record, including the presentation catalog, has an exact fail-closed schema.
- No candidate gameplay number has been copied from the non-binding examples.
- ABI-v1 descriptor and behavior membership hashes remain unchanged.

## 10. Task 5 — Cross-file compiler and simulation/presentation/provenance artifacts

**Dependency:** Tasks 1–4 and the recorded Section 3 contracts.

### Owner and files

Compiler agent owns new modules/tests:

- `tools/lib/aegis/v3-compiler.js`
- `tools/lib/aegis/v3-cross-references.js`
- `tools/lib/aegis/v3-provenance.js`
- `tools/lib/aegis/v3-presentation.js`
- `tools/lib/aegis/v3-artifacts.js`
- `games/aegis/tests/content-v3-compiler.test.js`
- `games/aegis/tests/fixtures/compiler/valid-v3-synthetic/**`

Root integrates these into existing `compiler.js`, `artifacts.js`, `source-loader.js`, CLI code, and generated artifact handling.

### Red tests first

1. A complete synthetic v3 graph compiles twice byte-identically.
2. Cross-file references resolve for IDs, maps, routes, policies, behaviors, summons, enemies, bosses, groups, objectives, rewards, access grants, events, strings, semantic-fallback cues, procedural-placeholder packs, annex locks, and authority/evidence.
3. Missing/duplicate/unused/mismatched references, cycles, unavailable route kinds, illegal tutorial inheritance, premature lethal mechanics, and economy mismatches fail at stable source paths.
4. Exact M1 binding-lock mutations fail even when placed in Candidate-BAL scope.
5. Strategos envelope equations, final-wave zero clear/bounty and pre-spawn deployment, Story/Titan bounty remainder, one-lineage bounty, finite spawn maxima, and safe intermediate bounds are proven.
6. Generated v3 manifest has exactly the specified fields, sorted provenance/included IDs, correct `releaseEligible`, and exact hashes.
7. Simulation content excludes paths, raw hashes, approval state, prose, localized values, and assets.
8. Presentation companion contains only localized values, procedural-placeholder packs, and semantic-fallback cue data from the hash-pinned presentation catalog; it cannot carry assets or override simulation values, and schema v1 makes `production-approved` invalid.
9. Provenance/raw-source/approval-only changes alter source/manifest/release identity but preserve ruleset identity when normalized simulation values are unchanged.
10. One simulation value changes content/ruleset/manifest identities.
11. JSON manifest and classic `aegis-release.<hash>.js` record have canonical field parity and deeply frozen classic/CommonJS behavior.
12. Missing/corrupt/mixed ABI, simulation, content, presentation, or mutable filename fails before boot selection.
13. Historical immutable artifacts remain present and byte-verified.
14. V1/v2 canonical compiled-content bytes remain byte-identical; supplied the unchanged simulation bytes, every resulting artifact identity also remains identical.
15. Canonical v3 simulation content and the generated manifest each carry independent `eventSchemaVersion` and `behaviorRegistryVersion` fields, and the simulation artifact exports exact matching versions.
16. A mismatch in either binding fails before initial state exists. `eventSchemaVersion` is never inferred from `commandSchemaVersion`, including when their numeric values happen to match.
17. Before the full v3 compiler is installed, valid v3 input stops at the Task 1 `incomplete-schema` preflight with no `buildArtifacts` call or output; after installation, schema 3 dispatches only to the complete v3 compiler and never to schema 1.

### Implementation partitions

1. Parse/hash declared files only.
2. Normalize maps into one IR and resolve/validate the complete simulation-source graph, the one-to-one defense/access-grant/reward mapping, every presentation pack/cue reference, and each fallback style against the closed reviewed presentation implementation registry.
3. Replace the Task 1 `incomplete-schema` preflight only when the complete v3 graph validator and all four output partitions are present; keep an explicit schema-version dispatch that cannot fall through to v1.
4. Emit canonical simulation content with explicit independent `eventSchemaVersion` and `behaviorRegistryVersion`, and frame ruleset identity from exact ABI bytes, exact simulation artifact bytes, and exact simulation-content bytes.
5. Emit the separately hashed presentation companion exclusively from the strict hash-pinned presentation catalog and string data; presentation-catalog v1 emits no asset record and can never authorize production approval.
6. Emit provenance and the exact v3 generated manifest, with independent `eventSchemaVersion` and `behaviorRegistryVersion` copied from the bound compiled simulation content rather than inferred from command schema.
7. Bind the ABI hash plus the content and simulation exports' exact event-schema and behavior-registry versions before any initial state can be created.
8. Emit a content-hashed classic release record, but do not add it to the default HTML or release selector.

The CLI gains explicit candidate commands while retaining the current defaults:

```powershell
node tools/build-aegis-content.js --check --manifest games/aegis/content/manifests/slice-dev-v1.json
node tools/build-aegis-content.js --write --manifest games/aegis/content/manifests/slice-dev-v1.json
```

Only root may run `--write` against checked-in candidate artifacts.

### Focused verification

```powershell
Push-Location games/aegis
try {
  node --test tests/content-v3-compiler.test.js
  node --test tests/content-v3-loader.test.js
  node --test tests/content-v3-records.test.js
  node --test tests/content.test.js
} finally { Pop-Location }
node tools/build-aegis-content.js --check
node tools/build-aegis-content.js --check --fixture valid-minimal
```

### Exit gate

- All four compiler partitions and identities are directly tested, including exact event-schema/behavior-registry binder failures in CommonJS and classic-script execution.
- Default v2 build remains selected by the existing command.
- The candidate release record is inert and unreferenced.
- No candidate source, production art, preview route, or release change is part of this checkpoint.

## 11. Task 6 — Author the complete Candidate-BAL m01/m04/m05 annex

**Dependency:** Tasks 1–5. The compiler and map analyzer must reject incomplete records before authoring begins.

### Parallel ownership

Run at most three nonoverlapping authoring agents:

**Map-authoring agent owns:**

- `games/aegis/content/maps/m04.slice-v1.json`
- `games/aegis/content/maps/m05.slice-v1.json`
- `games/aegis/content/map-proofs/m01.guard-v1.json`
- Candidate map fixtures/reports for those exact maps, excluding generated immutable artifacts

**Simulation-content author owns:**

- `games/aegis/content/campaign-rules/slice-v1.json`
- `games/aegis/content/defenses/slice-v1.json`
- `games/aegis/content/enemies/slice-v1.json`
- `games/aegis/content/bosses/slice-v1.json`
- `games/aegis/content/events/slice-v1.json`

**Mission/presentation author owns:**

- `games/aegis/content/missions/m01.slice-v1.json`
- `games/aegis/content/missions/m04.slice-v1.json`
- `games/aegis/content/missions/m05.slice-v1.json`
- `games/aegis/content/strings/en.slice-v1.json`
- `games/aegis/content/presentation/slice-v1.json` — schema-v1 procedural-placeholder packs and semantic-fallback cues only

**Root integrator owns after all source bytes settle:**

- `games/aegis/content/manifests/slice-dev-v1.json`
- `games/aegis/content/annexes/slice-dev-v1.json`
- Exact raw hashes including `presentationCatalog`, authority records, binding locks, candidate scopes, and the empty Candidate-BAL evidence set

### Authoring sequence

1. Write exact binding-lock tests before candidate data.
2. Author all three maps. M04 must contain a real two-entry merge with one shared physical trunk; M05 must be one clockwise spiral. Coordinates in specification Section 14 are inspiration only, not approved data.
3. Pass map clearance, route-local grading, selection order, shared-lane, support, and guard-proof checks before wave/tower tuning depends on pad values.
4. Author the exact five defenses and all three complete levels. Lock approved costs/roles/weaknesses/targets/named mechanics; declare every remaining candidate value under nonoverlapping candidate scopes.
5. Author fixed-marker guard summons, five complete regular enemies, Echo cloak, Talos thresholds/phases/pods/exposed windows, complete event schemas, and all referenced strings/placeholders. Prove each defense has one unique campaign access grant and each `unlock-defense` reward resolves defense ID to that grant.
6. Author the strict presentation catalog with exactly one procedural-placeholder pack per mission and one semantic-fallback mapping per referenced event cue; include no asset path, URL, sprite record, or byte claim.
7. Author six waves for m01/m04 and eight for m05, explicit groups/routes/timers/RNG policies, objectives, rewards, tutorials, previews, score records, and exact envelope ledgers.
8. M1 must retain map-v1 geometry, proof supplement, Strategos 150 start, `30/40/45/50/55/60`, gross 430, Wave-6 deployment 60 before spawn, zero Wave-6 lineage/clear income, Hoplite first-clear unlock, and tutorial gate semantics.
9. M04 retains two entrances/merge and Reserve Capacitor I reward. M05 retains the spiral, Talos, eight waves, and fifth loadout slot.
10. Populate the annex only after the exact version-1, ID-keyed normalized lock tree is stable. Hash lock values with ABI canonical `sha256:` framing; every simulation leaf must be covered exactly once and no presentation value may be targeted.
11. Hash exact settled source bytes and compile through the explicit candidate manifest. The generated v3 manifest carries independent event-schema and behavior-registry versions matching both compiled simulation content and simulation exports.

### Candidate tuning rules

- Do not copy non-binding numbers from specification examples as if approved.
- Candidate values may change only inside declared scopes, with new source/artifact hashes and rerun tests.
- If no viable candidate can satisfy a binding lock, do not weaken the lock; stop and bring evidence to Ryan.
- Candidate evidence remains empty until Task 7 produces reviewed balance reports and witness replays.

### Verification

```powershell
node tools/build-aegis-content.js --check --manifest games/aegis/content/manifests/slice-dev-v1.json
node tools/analyze-aegis-map.js --manifest games/aegis/content/manifests/slice-dev-v1.json --mission m01 --check
node tools/analyze-aegis-map.js --manifest games/aegis/content/manifests/slice-dev-v1.json --mission m04 --check
node tools/analyze-aegis-map.js --manifest games/aegis/content/manifests/slice-dev-v1.json --mission m05 --check
Push-Location games/aegis
try {
  node --test tests/content-v3-loader.test.js
  node --test tests/content-v3-records.test.js
  node --test tests/content-v3-compiler.test.js
  node --test tests/map-ir.test.js
  node --test tests/map-role-proofs.test.js
} finally { Pop-Location }
```

### Exit gate

- All declared Candidate-BAL source is complete and compiler-valid.
- The candidate generated manifest reports `approvalState: candidate-balance` and `releaseEligible: false`.
- The hash-pinned presentation catalog is schema v1, contains only placeholder/fallback records, and cannot be promoted to `production-approved`.
- No production art exists, no release selector references the candidate, and no public/default route changes.

## 12. Task 7 — Authoritative kernel, replay, behaviors, and balance gates

**Dependency:** Task 6 compiled Candidate-BAL content. This task proves truthful playability before any preview work.

### Batch 7A — Closed behavior implementation

Simulation-behavior agent owns:

- `games/aegis/js/sim/behaviors.js` — new
- `games/aegis/tests/behaviors.test.js` — new
- `games/aegis/tests/fixtures/behaviors/**` — new

Tests precede implementation for:

- Sentinel direct/Lock-On accepted-hit counter and reset semantics.
- Chronos direct/slow/echo, strongest-only movement bucket, empty activation and recursion flags.
- Siege splash comparator/primary-first/center bonus and bounded targets.
- Hoplite guard creation/replenishment/contact/block/bash/Resolve prefilter and deterministic marker order.
- Oracle continuous reveal and periodic mark using `aura@1`, exact scan counters/targets/durations/amplification.
- Echo cloak/damage exposure/reveal eligibility.
- Talos guarded thresholds, clamp, warning/exposure windows, ordered suppressed-bounty pods, one transition per hit.
- Semantic event payload/phase/order validation for every behavior.
- Caller immutability, safe integers, entity/event caps, and Node/classic parity.

Unknown behavior/rule/event IDs fail closed. No renderer state participates.

### Batch 7B — Canonical kernel and replay execution

After 7A is reviewed, kernel agent owns:

- `games/aegis/js/sim/kernel.js` — new authoritative fixed-tick composite state/reducer
- `games/aegis/js/sim/objectives.js` — new
- `games/aegis/js/sim/replay-runner.js` — new
- `games/aegis/js/sim/replay.js` — extend only for the reviewed `simulateReplay` seam
- `games/aegis/tests/kernel.test.js` — new
- `games/aegis/tests/objectives.test.js` — new
- `games/aegis/tests/replay-simulation.test.js` — new
- `games/aegis/tests/fixtures/replays/slice/**` — new

The kernel must:

1. Refuse to create initial state until ABI, simulation, and compiled content bind on exact `eventSchemaVersion` and `behaviorRegistryVersion`; never infer the event schema from the command schema.
2. Own the current tick and call `AegisManagement.applyCommandBucket` only for that exact tick.
3. Apply ABI phases in frozen order, advancing combat/wave clear between buckets; it never collapses cross-tick inputs.
4. Own complete canonical state: management, routes/enemies, timers, effects, lineages, boss phases, objectives, score, RNG streams, runtime IDs, bounty remainder, outcome, and events.
5. Apply wave-start grants before spawns and wave-clear grants only at wave clear.
6. Use compiled map IR/markers only; no source-cell or renderer reconstruction.
7. Emit only catalog-valid events and evaluate objectives/rewards from canonical state/events.
8. Make defeat/victory terminal at the kernel boundary; commands never reach management after terminal outcome.
9. Implement `simulateReplay` from the pinned immutable ruleset, verify checkpoints/final claim, and never consult mutable profile/tutorial state.

Golden scenarios cover m01 gate/build/upgrade/sell, m04 shared-route priority/leaks, m05 thresholds/pods/exposure, Story remainder, defeat, victory, IDs, simultaneous events, objectives, rewards, and Node/classic final hashes.

### Batch 7C — Balance harness and evidence

After 7B, balance agent owns:

- `tools/simulate-aegis.js` — new
- `games/aegis/tests/balance.test.js` — new
- `games/aegis/tests/fixtures/balance/**` — new
- `docs/aegis-balance/slice/**` — generated/reviewable deterministic reports and witness replay evidence only

The harness reports exact economy sources, purchase debits, refunds, net consumed Aether, simultaneous investment, bank, owned state, upgrade timing, route/pad use, overkill, control/support credit, leak prevention, objective results, and `combatValuePerAether`.

Required gates include:

- Starter-trio Strategos wins for all three slice missions.
- Three materially different m01 witnesses: Sentinel focus, Chronos control, Siege clustering.
- At least two materially different available-slice witnesses for m04/m05 at this slice checkpoint; retain the higher full-campaign diversity target for later acts.
- M1 representative final four/five towers and roughly two upgrades, 360–410 net consumed, no ten-pad saturation, median bank below 65, and exact score cap.
- One-tower/no-upgrade and seeded legal-random controls fail in Wave 5/6.
- Route-aware versus naïve paired evidence holds seed/loadout/spend/timing/policies/waves constant and meets the binding placement gate.
- Each defense has one matched role win and one visible weakness; no strict dominance.
- M04 route-local and M05 boss behavior are materially exercised, not merely equipped.
- Seeded fuzz/soak covers sell/build churn, shared routes, status stacks, guard markers, boss thresholds, entity/event caps, parser limits, and replay parity.

### Task 7 verification

```powershell
Push-Location games/aegis
try {
  node --test tests/behaviors.test.js
  node --test tests/kernel.test.js
  node --test tests/objectives.test.js
  node --test tests/replay-simulation.test.js
  node --test tests/balance.test.js
  node --test
} finally { Pop-Location }
node tools/simulate-aegis.js --manifest games/aegis/content/manifests/slice-dev-v1.json --check
```

Root then deliberately extends `simulation-bundle.js`, verifies its exported event-schema and behavior-registry versions, regenerates immutable candidate artifacts once, and reruns compiler/bundle parity. The changed simulation bytes intentionally create new simulation, manifest, and `rulesetHash` identities. The v1/v2 canonical compiled-content bytes stay unchanged, and every historical immutable artifact remains retained and byte-verified rather than overwritten.

### Exit gate

- All three missions are deterministically playable from briefing resolution through terminal result/replay.
- Candidate source and immutable artifacts match reviewed behavior/balance evidence.
- Annex remains Candidate-BAL unless Ryan/review explicitly promotes it with required evidence hashes.
- No production art, preview exposure, publish, or default route change.

## 13. Task 8 — Separate unlinked developer preview and immutable release loader

**Dependency:** Every Task 7 playability, replay, content, balance, and artifact gate. This task is skipped if the candidate is not truthfully playable.

### Owner and files

Delivery agent owns:

- `games/aegis/preview.html` — new, unlinked developer entry
- `games/aegis/js/delivery/release-loader.js` — new
- `games/aegis/js/delivery/preview-bootstrap.js` — new
- `games/aegis/sw.js` — new, Aegis-scoped
- `games/aegis/tests/release-loader.test.js` — new
- `games/aegis/tests/service-worker.test.js` — new
- `games/aegis/tests/preview-boot.test.js` — new

Root alone updates `release-selector.js` and pins the reviewed content-hashed candidate release record in `preview.html`. `index.html` and the hub remain unchanged.

### Tests first

- Default/ordinary/hostile release queries still boot legacy and cannot elevate the developer release.
- Only the dedicated preview bootstrap supplies the trusted developer option.
- Candidate-BAL cannot validate as a production descriptor; its isolated namespace cannot collide with legacy/production state.
- JSON manifest/classic release record and every pinned artifact hash/identity match.
- Query-supplied manifest/artifact URL, mutable filename, path escape, mixed ABI/simulation/content/presentation, missing simulation, and corrupt hash fail before profile open or Start.
- `file://` loads committed relative classic scripts without fetch/service worker and shows honest Session Only when durability is unproven.
- HTTP registers only an Aegis-scoped worker, uses release-hash caches, precaches declared shell/current candidate dependencies, and supports offline replay after caching.
- No unconditional `skipWaiting`; active-run lease, two-tab behavior, between-run activation, corrupt/missing cache repair, and retained replay ruleset bundles are tested.
- Preview writes only its developer namespace/profile and displays an unmistakable Candidate-BAL/Developer Preview state.
- Direct file and local HTTP CDP drives start m01, build, start a wave, and reach an inspectable ready/art-ready state.

### Implementation

1. Keep `preview.html` unlinked and non-default.
2. Load in exact order: content-hashed release record, simulation artifact, simulation content, presentation companion, preview runtime.
3. Verify all identities before starting the kernel.
4. Use procedural/temporary validated presentation only. Candidate-BAL still forbids production bitmap generation/atlas work.
5. Make service/network/storage failure honest and nonblocking for the existing legacy route.
6. Do not publish. If Ryan later approves a public preview, root performs Section 15 live gates without changing the default route.

### Exit gate

- Local direct-file and HTTP preview boot truthfully and remain isolated.
- Public/default Aegis is still legacy.
- No hub link, production descriptor, production profile, production art, publish, or default/live switch has occurred.

## 14. Root integration and immutable artifact procedure

At every task boundary root must:

1. Review owned diffs, assumptions, exact diagnostics, and focused test evidence.
2. Reject duplicated constants, directory scans, permissive parsing, source/renderer fallback, mutable artifact names, and unbounded loops/entities/events.
3. Run `git diff --check` before staging. Confirm `.gitattributes` still pins the exact Aegis content, simulation/delivery, fixture, Aegis/spec/plan/balance documentation, build/analyzer, and compiler paths to `text eol=lf`.
4. Stage explicit intended paths only. Audit:

   ```powershell
   git diff --cached --name-only
   git diff --cached --check
   ```

5. Confirm staged text reports `i/lf` and `w/lf` under the pinned paths before recording raw-source hashes:

   ```powershell
   git ls-files --eol -- games/aegis/content games/aegis/js/sim games/aegis/js/delivery games/aegis/tests/fixtures docs/aegis docs/superpowers/specs docs/superpowers/plans docs/aegis-balance tools/build-aegis-content.js tools/analyze-aegis-map.js tools/lib/aegis
   ```

   Any `w/crlf`, `w/mixed`, or unexpected attribute is a stop; normalize through the reviewed source edit and recompute every affected exact-byte hash before continuing.
6. Confirm no staged path begins with `research/`, `Assets/`, or `.superpowers/` and no unrelated user file is present.
7. Generate immutable artifacts only after source/tests are reviewed and exact LF source bytes have settled:

   ```powershell
   node tools/build-aegis-content.js --write --manifest games/aegis/content/manifests/slice-dev-v1.json
   node tools/build-aegis-content.js --check --manifest games/aegis/content/manifests/slice-dev-v1.json
   ```

8. Retain every historical immutable artifact. Delete or overwrite no content-hashed historical file.
9. Load generated simulation/content/presentation/release records in both CommonJS and classic-script VM contexts with dynamic code, DOM, network, storage, and kit helpers absent unless the artifact explicitly owns that presentation capability.
10. Run full serialized verification before each checkpoint commit.

## 15. Verification matrix

### Focused static/content verification

```powershell
node tools/build-aegis-content.js --check
node tools/build-aegis-content.js --check --fixture valid-minimal
node tools/build-aegis-content.js --check --manifest games/aegis/content/manifests/slice-dev-v1.json
node tools/analyze-aegis-map.js --mission legacy-proving-ground --report-known-issues
node tools/analyze-aegis-map.js --manifest games/aegis/content/manifests/slice-dev-v1.json --mission m01 --check
node tools/analyze-aegis-map.js --manifest games/aegis/content/manifests/slice-dev-v1.json --mission m04 --check
node tools/analyze-aegis-map.js --manifest games/aegis/content/manifests/slice-dev-v1.json --mission m05 --check
node tools/simulate-aegis.js --manifest games/aegis/content/manifests/slice-dev-v1.json --check
```

Run `simulate-aegis.js` only after Task 7 creates it.

### JavaScript syntax

```powershell
$aegisJs = Get-ChildItem -LiteralPath 'games\aegis','tools' -Recurse -File -Filter '*.js'
foreach ($file in $aegisJs) {
  node --check $file.FullName
  if ($LASTEXITCODE -ne 0) { throw "node --check failed: $($file.FullName)" }
}
```

### Serialized bare suites

Do not run the owner suites concurrently; the content/map tests create bounded temporary trees and concurrent full runs can exhaust the Windows temp volume.

```powershell
$suiteOwners = @('_kit','armaratris','serpent','breaker','flight','starfall','aegis')
foreach ($owner in $suiteOwners) {
  Push-Location (Join-Path 'games' $owner)
  try {
    node --test
    if ($LASTEXITCODE -ne 0) { throw "Bare suite failed: $owner" }
  } finally {
    Pop-Location
  }
}
```

### Browser parity and preview gates

Before Task 8 completion, run local direct-file and HTTP journeys at `390×844` and `1280×800`. If and only if Ryan authorizes publishing a developer preview:

1. Publish only through the root-owned games subtree workflow.
2. Confirm `games/.nojekyll` exists in the published tree.
3. Confirm public `/_kit/shell.js` returns 200.
4. CDP-drive the default `/aegis/` route and prove it still boots legacy.
5. CDP-drive the explicit unlinked preview URL and prove the pinned candidate release ID/ruleset, `body.dataset.ready === "1"`, required presentation ready, m01 start/build/wave, and isolated developer namespace.
6. Verify every pinned release/simulation/content/presentation artifact returns 200 and no authoring JSON is fetched.
7. Verify service-worker scope cannot control the arcade root or another game.

Publishing a preview is not a default-route switch. The campaign remains non-default until the separate full-campaign release plan and Phase 8 gates.

## 16. Checkpoint boundaries

Only root creates these commits after the complete checkpoint matrix is green:

1. **`Add strict Aegis v3 source contracts`**
   - Tasks 1 and 4.
   - Includes v1/v2 canonical compiled-content byte identity and same-simulation artifact-identity evidence.
   - No candidate source or generated v3 production artifacts.

2. **`Add shared-lane Aegis map compilation`**
   - Tasks 2 and 3.
   - Includes normalized m01 compatibility, shared-route fixtures, route-local analyzer, and role-proof machinery.
   - No m04/m05 approval claim.

3. **`Compile partitioned Aegis slice artifacts`**
   - Task 5 synthetic complete v3 compiler/provenance/presentation work.
   - Candidate release record remains inert/unselected.

4. **`Author Candidate-BAL Aegis vertical slice`**
   - Task 6 complete source annex and immutable candidate artifacts.
   - Manifest is `candidate-balance`, `releaseEligible:false`.
   - No production art/release/default route.

5. **`Add authoritative Aegis slice simulation`**
   - Task 7 behaviors, kernel, replay, objectives, balance harness/evidence, and regenerated immutable bundle with explicit new simulation/manifest/`rulesetHash` identities and retained historical artifacts.
   - Still no public/default route change.

6. **`Add isolated Aegis developer preview`**
   - Task 8 only after truthful playability.
   - Separate unlinked entry and developer namespaces.
   - Commit does not imply publish; public preview still requires Ryan approval.

At every checkpoint, push only `origin main` after the root verifies author/trailer, staged path scope, and clean required suites.

## 17. Definition of done

- Schema-v1 and schema-v2 validation and canonical compiled-content bytes remain identical. Same-simulation builds retain every artifact identity; Task 7's intentional simulation-bundle change produces explicit new simulation/manifest/`rulesetHash` identities while all historical immutable artifacts remain retained and valid.
- V3 strict parsing, raw-source hashes, provenance, exact ID-keyed lock tree, ABI-canonical `sha256:` lock values, exact-once annex coverage, limits, and diagnostics are complete.
- One normalized map IR supports map v1 and v2, shared physical lanes, route-local progress, exact joins/crossings, route-local grading, deterministic selection, support/guard proofs, and compiled Hoplite markers.
- Every required campaign, defense/summon, enemy, boss, mission, wave/economy, objective/reward/preview, event, string, and presentation record is strict and cross-file validated, including one-to-one defense access grants and reward/replay resolution.
- Canonical simulation content, presentation companion, provenance, generated manifest, and classic release record are separately hashed and reproducible; content/manifest/simulation bind independently versioned event schema and behavior registry values before initial state exists.
- The complete m01/m04/m05 source graph is Candidate-BAL, fully scoped/locked, and `releaseEligible:false`.
- The authoritative fixed-tick kernel and `simulateReplay` produce matching Node/classic/browser checkpoints and final hashes.
- M1 binding geometry/economy and required balance witnesses/negative controls pass; m04 shared routes and m05 Talos are materially exercised.
- Candidate-BAL uses only hash-pinned presentation-schema-v1 procedural placeholders/semantic fallbacks, has generated no production art, cannot be production-approved, and has selected no production descriptor.
- Any developer preview is truthful, separate, unlinked, isolated, and local unless Ryan explicitly approves publishing it.
- The default/public Aegis route remains the legacy proving ground, `games/.nojekyll` remains present, and all serialized bare suites are green.
