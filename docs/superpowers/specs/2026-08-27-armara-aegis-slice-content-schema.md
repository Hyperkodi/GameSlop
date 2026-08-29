# Armara Aegis Slice Content Schema

**Date:** 2026-08-27

**Status:** Architecture specification for the Phase 2 content system; balance examples are non-binding until their annex is reviewed and promoted

**Owner:** Ryan / Armara

**Authority:** Extends `2026-08-26-armara-aegis-campaign-expansion.md` and `docs/aegis/architecture-decisions.md`; those documents remain authoritative for product rules and already binding values

## 1. Purpose and boundary

This specification defines the source and compiled-content contracts needed for the Phase 2 vertical slice:

- Missions `m01`, `m04`, and `m05`.
- Sentinel, Chronos, Siege, Hoplite Node, and Oracle Relay.
- Scout, Raider, Guardian, Echo, Titan, and Talos Prototype.
- A true two-entrance merge, a clockwise spiral, route-local pad analysis, specialist-pad proof, complete deterministic combat records, ordered wave economies, objectives, rewards, semantic events, and localized strings.

It defines architecture and acceptance only. It is not an implementation plan, does not approve candidate balance numbers, does not authorize production art, and does not change any product decision.

The existing content schemas remain supported:

- Source-manifest schema v1 remains the byte-stable minimal fixture/foundation contract.
- Source-manifest schema v2 remains the byte-stable map-foundation contract.
- Map schema v1 remains valid and is the authoritative source form for the currently approved `m01` geometry.
- Source-manifest schema v3 and map schema v2 add campaign-scale records without changing v1/v2 validation or canonical compiled-content bytes. A v1/v2 build supplied the same simulation bytes remains artifact-identical. Deliberately extending the default deterministic simulation bundle still changes its simulation hash, manifest, and `rulesetHash` as required by ABI-v1; historical immutable artifacts remain retained and verified.

The current `legacy-proving-ground` data is never an implicit default or migration source. Its 160 Aether start, old costs, global route/pads/waves, hidden HP escalation, and duplicate reward model remain fixture-only and are forbidden in a v3 campaign manifest.

## 2. Terms and approval states

**Physical lane segment** means one directed, authored polyline compiled once for movement, range analysis, and road rendering. More than one logical route may reference the same physical lane segment.

**Logical route** means an ordered, finite traversal of directed physical lane segments from one entry/breach to one gate. An enemy owns a logical `routeId`; route distance and remaining distance are always route-local even on shared geometry.

**Simulation content** means every value that can affect command legality, movement, targeting, damage, status, economy, outcome, objective completion, score, reward, semantic-event sequence, replay, or state hash.

**Presentation companion** means localized text values and mappings from semantic IDs to visual/audio assets. It may not supply or override simulation values.

**Binding lock** means a value already approved in the campaign specification or an approved amendment. A binding lock cannot be tuned through an annex.

**Candidate-BAL** means a complete, deterministic candidate that may enter behavior tests and the balance lab but is not approved for production art or public campaign release.

Every v3 source manifest has exactly one `approvalState`:

| State | Permitted use | Prohibited use |
|---|---|---|
| `candidate-balance` | Compiler, deterministic behavior tests, developer-only slice, balance lab, witness replay iteration | Production art, default route, production profile, public campaign release |
| `balance-approved` | All prior uses plus production art and wider campaign implementation | Default/public release until the campaign release gates pass |
| `production-approved` | Eligible to be referenced by a separately validated production release manifest | Release without the repository, device, accessibility, performance, and live-delivery gates |

Changing approval state without changing simulation values must not change `rulesetHash`. Approval/provenance data lives outside the ruleset-framed simulation bytes.

## 3. Source-manifest schema v3

### 3.1 Exact top-level record

A source-manifest v3 document contains exactly these keys:

```json
{
  "schemaVersion": 3,
  "contentVersion": "slice-dev-v1",
  "sourceKind": "campaign",
  "approvalState": "candidate-balance",
  "abiDescriptor": { "source": "abi/abi-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "behaviorContracts": { "source": "behavior-contracts.json", "sha256": "sha256:<64 lowercase hex>" },
  "annex": { "id": "slice-dev-v1", "source": "annexes/slice-dev-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "campaignRules": { "source": "campaign-rules/slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "defenses": { "source": "defenses/slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "enemies": { "source": "enemies/slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "bosses": { "source": "bosses/slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "eventCatalog": { "source": "events/slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "stringCatalog": { "source": "strings/en.slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "presentationCatalog": { "source": "presentation/slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
  "missions": [
    {
      "id": "m01",
      "definition": { "source": "missions/m01.slice-v1.json", "sha256": "sha256:<64 lowercase hex>" },
      "map": { "schemaVersion": 1, "source": "maps/m01.json", "sha256": "sha256:<64 lowercase hex>" },
      "mapProofSupplement": { "schemaVersion": 1, "source": "map-proofs/m01.guard-v1.json", "sha256": "sha256:<64 lowercase hex>" }
    }
  ]
}
```

Unknown or missing keys fail. `schemaVersion` is exactly `3`, `sourceKind` is exactly `campaign`, and mission records are in ascending ASCII ID order with no duplicate ID, source path, or real file identity.

Each reference object contains exactly `source` and `sha256`, except `annex`, which also contains exactly `id`, and a mission `map` or `mapProofSupplement`, which also contains exactly `schemaVersion`. A v3 mission record whose map has schema version 1 contains exactly `id`, `definition`, `map`, and `mapProofSupplement`; a mission whose map has schema version 2 contains exactly `id`, `definition`, and `map`, and is forbidden from declaring the supplement because its `roleProofs` are in-map. References use canonical relative POSIX paths, lowercase `.json`, no empty/dot/parent segment, no alternate stream, no percent-encoding, and no symlink or special-file target. Realpath containment and real-file deduplication use the same strict policy as source schema v2.

The hash is SHA-256 over the exact source-file bytes, including line endings and final newline. It proves reviewed source provenance; it is not substituted for strict parsing or semantic validation. Source paths and raw-source hashes appear in generated provenance but are excluded from simulation content and `rulesetHash`. Moving or reformatting semantically identical non-ABI authoring source may change provenance/release-manifest identity without invalidating a gameplay replay; the ABI descriptor remains an exact-byte ruleset input and is not normalized by this rule.

### 3.2 Campaign-rules source

The campaign-rules file contains exactly:

```text
schemaVersion
id
difficultyPresets
assistRecord
targetPolicyRecords
statusIds
damageTypeIds
ruleCatalog
campaignModifierRecords
accessGrantIds
missionCatalogIds
scoreRules
```

It owns the binding Story/Strategos/Titan basis points and integrity values, target-policy membership, stable status and damage-type membership, Reserve/Assist resolution records, complete campaign mission-ID universe, defense/profile access-grant membership, and score formulas/constants. Mission/defense/enemy files reference these IDs; they may not redefine them. Arrays whose order has no gameplay meaning are unique and strictly ASCII sorted. Difficulty records are sorted by the authored stable order Story, Strategos, Titan and contain complete integer records rather than deltas.

Each target-policy record contains exactly `id`, `eligibilityRuleId`, and `comparatorIds`. The comparator list is nonempty and semantic order; it must end in the compiler-owned immutable-enemy-ID comparator so every eligible set has a total order. The three binding player policies are complete records rather than aliases for renderer sorting: `FRONT` is remaining route distance ascending, threat priority descending, immutable enemy ID ascending; `STRONG` is current HP plus all shield pools descending, remaining route distance ascending, immutable enemy ID ascending; and `FAST` is unmodified base speed descending, remaining route distance ascending, immutable enemy ID ascending.

`ruleCatalog` contains exactly `comparatorIds`, `eligibilityRuleIds`, `removalRuleIds`, `stackRuleIds`, `prefilterRuleIds`, and `scoreFormulaIds`. Each is a unique ASCII-sorted set of IDs implemented and reviewed by the v3 compiler/simulation artifact. Referencing an ID composes that closed implementation; JSON cannot define an expression, callback, script, property path, or executable comparator. Missing implementations and catalog entries fail closed.

Each difficulty record contains exactly `id`, `availabilityId`, `startAetherBp`, `integrity`, `enemyHpBp`, `enemySpeedBp`, `bountyBp`, and `scoreBp`. The three records encode the already binding `11900/25/8500/9500/11000/7500`, `10000/20/10000/10000/10000/10000`, and `9100/15/12500/10800/10000/15000` values in Story/Strategos/Titan order. `assistRecord` contains exactly `id`, `startAetherAdd`, `enemySpeedBp`, and `competitiveScoreEligible`; it encodes `+20`, `9200`, and `false`. Campaign modifiers use strict discriminators; the slice permits `start-aether-add`, containing exactly `id`, `kind`, `amountAether`, and `scope`, with scope `campaign`.

`scoreRules` contains exactly `id`, `eligibleUnspentFormulaId`, `unspentCapDivisor`, `difficultyApplicationId`, and `minimumNonzeroScore`. The divisor is the binding integer 19. Per-mission candidate point values live only in the mission's `scoreRecord`; the universal eligibility/cap/difficulty formulas cannot be overridden there.

Every defense `unlockId` resolves to exactly one ID in `accessGrantIds`; two defenses cannot share one unlock ID. Starter ownership is represented by resolved initial access grants, not a null or magic unlock. An accepted `unlock-defense` first-clear reward names the defense ID and transactionally grants that defense's resolved `unlockId`. Replay `accessGrantIds` records the ordered resolved grants used for that run, so neither the kernel nor renderer infers ownership from current profile state.

## 4. Shared strict-source rules and bounds

All v3 files use strict UTF-8 JSON: no BOM, comments, trailing data, duplicate decoded key, lone surrogate, invalid UTF-8, exponent notation, `-0`, non-finite number, accessor/prototype behavior, or unknown key. Authored decimals are parsed lexically, permit at most three fractional digits, and compile through the ABI exact-decimal rules. Integers must be safe before compilation; every compiled intermediate must pass the ABI safe-integer analysis.

Stable authored IDs are case-sensitive ASCII, 1–64 characters, and match the existing backward-compatible grammar:

```text
^[A-Za-z0-9][A-Za-z0-9._:-]*$
```

String keys use the same grammar with a 96-character maximum. Existing frozen spellings such as `FRONT`, `armorBreak`, and `reviveSuppressed` retain their exact case; comparisons and uniqueness never case-fold. Human text is well-formed Unicode, contains no control character other than an escaped line feed where the field explicitly allows it, contains no HTML, and is at most 1,024 UTF-8 bytes per value.

The following hard source limits apply before deeper validation:

| Item | Bound |
|---|---:|
| One source file | 1,048,576 bytes |
| JSON nesting depth | 32 |
| Object fields | 64 |
| Defenses / levels per defense | 15 / exactly 3 |
| Regular enemies / bosses | 11 / 5 |
| Missions / routes per map | 20 / 16 |
| Lane segments / nodes per segment | 128 / 64 |
| Joins or crossings / pads / exclusions / probes | 128 / 32 / 128 / 32 |
| Waves per mission / groups per wave | 12 / 32 |
| Spawn count per group | 1–1,000 |
| Behavior records per level / trait records per enemy | 16 / 16 |
| Semantic event references per owner record | 32 |
| Maximum simulation tick | 5,184,000 (24 hours at 60 Hz) |
| Aether cost/grant/envelope | 0–1,000,000 |
| Authored HP, shield, armor, damage, speed, range | 0–1,000,000 with at most three decimals; fields documented positive cannot be zero |
| Score field | 0–1,000,000,000 |
| General basis points | 0–10,000 unless a typed coefficient explicitly allows up to 20,000 |
| Native resistance | 0–3,500 |
| Authored milliseconds | 0–86,400,000; positive cadence/duration fields cannot be zero |

An off-board route endpoint must be declared as a portal and remain within four grid cells of the board (`column -4..43`, `row -4..28`). Every other route node, pad, exclusion center, and non-endpoint anchor is in bounds. Aggregate counts, transfer bytes, decoded bytes, timer event caps, and worst-case arithmetic must also pass their specification/ABI budgets; passing a per-record maximum is not sufficient.

## 5. Annex, source provenance, and binding locks

The annex file contains exactly:

```text
schemaVersion = 1
id
approvalState
authorityRecords
bindingLocks
candidateScopes
evidenceRecords
```

Every `authorityRecords` entry contains exactly `id`, `repositoryPath`, and `sha256`, is ASCII sorted by ID, and pins the exact reviewed authority bytes. Every `bindingLocks` entry contains exactly `id`, `authorityId`, `jsonPointer`, and `expectedCanonicalValueHash`, is ASCII sorted by ID, and binds one RFC 6901 pointer into the normalized v3 simulation-source tree. `candidateScopes` is a unique ASCII-sorted array of canonical RFC 6901 pointers. Every `evidenceRecords` entry contains exactly `id`, `kind`, `repositoryPath`, and `sha256`, is ASCII sorted by `(kind,id)`, and uses one of the schema-v1 kinds `balance-report` or `witness-replay`. Candidate annexes may use an empty evidence array; `balance-approved` and `production-approved` annexes require at least one of each evidence kind. Repository paths are canonical contained POSIX paths, and every hash is lowercase SHA-256 over exact bytes. The compiler resolves every authority, evidence record, and lock pointer and fails on a missing or mismatched value.

The normalized simulation lock tree contains exactly `schemaVersion`, `campaignRules`, `defenses`, `summons`, `enemies`, `bosses`, `missions`, `maps`, and `eventCatalog`. `schemaVersion` is 1 for this lock-tree contract. Every collection except the singleton campaign-rules record is a plain ASCII-keyed object keyed by stable authored ID, regardless of the array order used in source files. `maps` contains the normalized map-v2 IR, including compiled exact geometry, analyzer review values, role proofs, and a map-v1 supplement where applicable. All authored decimals have already compiled to exact ABI integers. Approval/provenance fields, localized string values, UI-only copy fields, presentation-pack IDs, and asset/cue mappings are absent. The remaining tree is the exact deterministic input from which canonical simulation content is emitted.

`bindingLocks` and `candidateScopes` address only that lock tree. `expectedCanonicalValueHash` is exactly `sha256:` followed by lowercase SHA-256 of the ABI-v1 canonical UTF-8 bytes of the dereferenced value; compiler/runtime canonical encoders must pass parity goldens. One pointer covers its addressed node and every descendant. Duplicate pointers and ancestor/descendant overlap within one scope list fail, any binding/candidate intersection fails, and every simulation-value leaf must be covered exactly once by either a binding lock or candidate scope. JSON-pointer array indices are allowed only inside semantic-order arrays such as levels or waves; ID collections always use their escaped ID key. Missing nodes, presentation-only targets, the root pointer, invalid `~` escapes, and tokens that fail to use the required canonical `~0`/`~1` form all fail.

The annex `id` and `approvalState` must exactly equal the source manifest's annex ID and manifest approval state. Any disagreement fails before compilation.

At minimum the slice annex locks:

- Mission identities, order, wave counts, headline mechanics, and first-clear rewards.
- All five defense costs, roles, weaknesses, target masks, and named level mechanics.
- Mission 1 route, pads, review goldens, 150 Strategos start, inclusive `30/40/45/50/55/60` envelopes, 430 gross ceiling, and Wave-6 pre-spawn 60 with zero kill/clear Aether.
- Universal three-level, targeting, control, refund, and fairness rules.

`candidateScopes` lists every simulation-value JSON-pointer subtree that remains Candidate-BAL. A pointer may not be both binding and candidate. Simulation values outside a binding or declared candidate scope fail annex completeness; presentation-only values are governed by source hashes and copy/art review instead. Candidate values become balance-approved only by replacing the annex with a reviewed `balance-approved` annex that pins deterministic balance-report and witness-replay hashes in `evidenceRecords`.

Changing a binding lock requires a specification amendment and Ryan approval. Changing a candidate value during balance work requires a new source hash, regenerated artifacts, and rerun evidence, but is not itself a product decision.

No production bitmap generation, production atlas work, or mass battlefield art begins while the applicable annex is `candidate-balance`.

## 6. Map schema v2: shared directed physical lanes

### 6.1 Exact top-level record

A map-v2 file contains exactly:

```text
schemaVersion
id
title
sourceKind
board
road
laneSegments
routes
joins
crossings
pads
anchors
exclusions
probes
roleProofs
review
```

`schemaVersion` is exactly `2`; `sourceKind` is exactly `campaign`. The board remains exactly `40 × 25` cells, four world units per cell, and `160 × 100` world units. Campaign road width remains exactly 12 world units. Existing inset, lane-clearance, pad-spacing, anchor/prop clearance, Q-band, and ordinary `E20` policies remain binding.

### 6.2 Lane segments and logical routes

A physical lane-segment record contains exactly:

```json
{
  "id": "lane.shared.trunk",
  "kind": "ground",
  "layerId": "surface",
  "nodes": [
    { "column": 24, "row": 12 },
    { "column": 31, "row": 12 },
    { "column": 31, "row": 19 },
    { "column": 41, "row": 19, "portal": true }
  ]
}
```

Lane-segment records are in strict ASCII ID order. A record is directed from its first node to its last; reverse traversal is not supported in v2. Nodes and compiled subsegments follow the existing exact grid, length, tangent, interpolation, bend, and safe-integer rules. Zero length, straight-through redundant nodes, undeclared self-intersection, illegal U-turn, or road-buffer self-collision fails.

A logical-route record contains exactly:

```json
{
  "id": "route.north",
  "kind": "ground",
  "laneSegmentIds": ["lane.north.approach", "lane.shared.trunk"],
  "entryAnchorId": "entry.north",
  "gateAnchorId": "gate.east"
}
```

Route records are in strict ASCII ID order. `laneSegmentIds` is traversal order, is nonempty, contains no repeated ID, and references segments of the same route kind. Consecutive segment endpoints must coincide exactly and be covered by one declared join. The first/last point must match the referenced entry/breach and gate anchors. A route is finite, directed, connected, and reaches exactly one gate. Route length is the checked sum of referenced compiled segment lengths.

Two or more routes may reference the same lane-segment ID. The compiler stores and renders that physical geometry once but creates a route-local segment-offset table for each route. It is invalid to duplicate identical or overlapping geometry under different lane IDs to simulate sharing.

### 6.3 Declared joins and crossings

A join contains exactly:

```json
{
  "id": "join.harbor-merge",
  "kind": "merge",
  "column": 24,
  "row": 12,
  "incomingLaneSegmentIds": ["lane.north.approach", "lane.south.approach"],
  "outgoingLaneSegmentIds": ["lane.shared.trunk"]
}
```

Join kind is `continuation`, `merge`, or `split`. Incoming/outgoing arrays are unique and ASCII sorted; their directed endpoints all equal the declared cell center. `continuation` is exactly one-in/one-out, `merge` is at least two-in/one-out, and `split` is one-in/at least two-out. A stale join, an undeclared route transition, a directed cycle inside one logical route, or a route taking an edge in the wrong direction fails.

At a declared join, distinct road masks may converge only inside a closed radius equal to the 12-world-unit road width around the join center. Outside that join neighborhood, the ordinary overlap/near-pass policy applies. This exception is derived solely from the declared join and cannot waive a collision elsewhere.

Crossings are physical-lane records, not logical-route records. A crossing contains exactly `id`, `kind`, `laneAId`, `subsegmentAIndex`, `laneBId`, `subsegmentBIndex`, and, only for an overpass, `upperLayerId`. Pair ordering is canonical. At-grade lanes share a layer; overpass lanes use distinct layers and name one upper layer. A join is never encoded as a crossing. Every geometric point crossing is declared exactly once; overlap remains forbidden.

### 6.4 Anchors, pads, probes, and route-local grading

Endpoint anchors contain `id`, `kind`, `column`, `row`, `laneSegmentId`, and sorted `routeIds`. An entry/breach matches the start of the first segment for every named route. A gate matches the end of the last segment and may serve multiple routes through one shared physical segment. A large-prop anchor has no lane or route fields. Other existing exclusion rules remain unchanged.

The unchanged structural records are explicit: `board` contains exactly `columns`, `rows`, `cellWorldUnits`, `widthWorldUnits`, and `heightWorldUnits`; `road` contains exactly `widthWorldUnits`; a circle exclusion contains exactly `id`, `kind`, `column`, `row`, and `radiusWorldUnits`; and a probe contains exactly `id`, `rangeWorldUnits`, `targetKinds`, `routeIds`, plus optional `baselineMilliUnits`. An endpoint anchor contains exactly the six fields above; a large-prop anchor contains exactly `id`, `kind`, `column`, and `row`. Board, road, anchor, exclusion, and probe arrays preserve the current v1 bounds, ASCII ordering, reference, clearance, and exact-integer compilation rules. Probe `routeIds` refers to logical routes, never physical lane segments.

A map-v2 pad contains exactly:

```text
id
kind
column
row
intent
declaredQuality
claimedRouteIds
selectionOrder
```

Pad IDs remain ASCII ordered in source. `selectionOrder` is a unique contiguous integer `0..padCount-1` and defines keyboard/touch cycling. A pad's selection stage is the minimum quality-probe mean stage across its claimed routes; the smallest route ID attaining that minimum is its selection route. Selection order must follow `(selectionStageBp ascending, selectionRouteId ASCII, padId ASCII)`. `claimedRouteIds` is nonempty, unique, ASCII sorted, and declares the routes used to justify that pad. It never restricts actual spatial targeting.

The analyzer still reports physical exposure to every route selected by a probe. Approval grading is route-local:

1. Intersect the probe's route IDs with the pad's `claimedRouteIds`.
2. Require every claimed route needed by the entry/quality probe to be present.
3. Compute exact exposure/windows/re-entry/stage separately for each claimed route.
4. Set `qualityExposure` to the minimum exposure across claimed routes; never average or sum away a zero.
5. Ignore unclaimed-route exposure only for the declared-quality decision; retain it as diagnostic and use physical geometry normally in simulation.

Thus an entrance-specific pad can claim only `route.north`, while a merge pad can claim both routes. A claimed route below the ordinary threshold fails even when another route has high exposure.

The review record retains `entryProbeId`, `qualityProbeId`, `minimumEntryExposureMilliUnits`, and integer `maximumSpread`, and adds exactly `selectionOrderPolicy: "route-stage-route-id-pad-id"`. All reports include physical lane IDs, logical route IDs, route-local offsets/remaining distances, claimed/unclaimed exposure, and shared-lane provenance.

## 7. Role proofs and Hoplite markers

Every role proof contains `id`, `kind`, `version`, and `padId`, followed by the exact fields for its discriminator. IDs are unique and ASCII sorted.

### 7.1 Support proof v1

Support v1 has two strict modes:

- `route-status`: exactly `rangeWorldUnits` and `routeProofRecords`. Each route proof is exactly `{ routeId, minimumExposureMilliUnits, expectedCoverageWindowCount }`; records are unique and ASCII sorted by route ID and cover every claimed route exactly once. It proves a support/status defense can affect every claimed lane.
- `friendly-neighbor`: exactly `rangeWorldUnits`, `eligibleDefenseTagIds`, `expectedNeighborPadIds`, and `minimumEligibleNeighborCount`. The analyzer derives the squared-distance neighbor graph and requires the authored list to match it exactly.

A pad with intent `support` requires one passing support-v1 proof and player-visible specialist copy. Merely being far from a road is never proof.

### 7.2 Guard proof and compiled marker v1

Every map on which Hoplite can be equipped supplies one guard-v1 proof for every buildable pad, not only pads whose visible intent is `guard`. The source proof contains exactly:

```text
id
kind = guard
version = 1
padId
projectionRangeWorldUnits
markers
```

It contains exactly three marker source records, one for each possible Hoplite guard slot. A marker contains exactly:

```text
id
slotIndex
laneSegmentId
laneOffsetMilliUnits
routeIds
```

`slotIndex` is `0`, `1`, or `2`, each exactly once. Offset is an integer from the compiled beginning of the directed physical lane segment, inclusive of zero and inclusive of the endpoint. `routeIds` is the exact sorted set of every logical route that traverses that physical point; authoring cannot suppress an unclaimed route on shared geometry. A pad's `claimedRouteIds` still controls proof/grading only and never makes a physically coincident enemy untargetable. Each marker is within the authored projection range using the ABI squared-range comparison, lies on a ground lane traversed by at least one claimed route, and is a distinct physical point. On any one route, markers are at least 8,000 distance units apart. Every claimed route has at least one marker.

`projectionRangeWorldUnits` equals the minimum compiled Hoplite `rangeWorldUnits` among levels legal on that mission. Consequently all three fixed markers are legal at Level 1; upgrades activate additional authored slot indices but never move, regenerate, or renderer-pick a marker. The behavior's `slotComparatorId` and `contactComparatorId` are annex-pinned closed-rule references and jointly define replenish assignment and simultaneous contact queue order.

The compiler emits each marker as a complete immutable record containing:

```text
id, slotIndex, padId, laneSegmentId, laneOffset,
x, y, tangentX, tangentY,
routeDistances[{ routeId, routeDistance, remainingDistance }]
```

The marker object and every nested route-distance object contain exactly those fields. `laneOffset`, `x`, `y`, `routeDistance`, and `remainingDistance` are compiled integer distance units; tangents are the exact checked integer segment deltas used by ABI interpolation. Route-distance records are ASCII sorted, `routeDistance + remainingDistance` equals the referenced route length, and every listed route traverses the marker's physical segment in the authored direction. Runtime code may not reconstruct a marker from source cells or renderer geometry.

Guard contact processing prefilters air, occupied hard-control bucket, Resolve, and every other ineligible target before consuming a guard. A forward-moving enemy crosses a marker only when `priorRouteDistance < markerDistance <= nextRouteDistance`; a displacement onto/from a marker follows its separately declared displacement phase and cannot double-trigger contact. For contacts in one movement phase, crossing fraction is the exact rational `(markerDistance - priorRouteDistance) / requestedForwardAdvance` compared by cross multiplication, never floating point. Order is crossing fraction, route ID, route-local marker distance, marker ID, then immutable enemy ID. The authored marker/slot record, defense level, and canonical runtime state determine availability; presentation animation never does.

A pad whose visible intent is `guard` additionally must prove either markers on at least two claimed routes or markers in at least two disconnected coverage windows on one route. The briefing/selection UI names that specialist purpose.

### 7.3 Fail-closed later proofs

Role-proof kind/version is compiler-owned. Schema v3 implements only `support@1` and `guard@1`. Pads with intent `line`, `mine`, or `air`, or proof records claiming those kinds, fail with a stable `ROLE_PROOF_UNIMPLEMENTED` diagnostic until a later reviewed schema version defines and tests the relevant geometry. Unknown proof kinds/versions always fail; placeholders and blanket waivers cannot enter an approval-eligible map.

## 8. Defense and complete-level schema

The defense source contains exactly `schemaVersion`, `id`, `summonRecords`, and `records`. Schema version is 1. Defense and summon records are unique and independently ASCII sorted.

The slice summon catalog exists because `spawnUnit@1` and `block@1` may not reference an implied renderer object. Each summon record contains exactly `id`, `kind`, `targetKinds`, `acceptedContactsBeforeConsume`, and `semanticEventIds`. Schema v3 supports only `kind: "fixed-marker-guard"`: it is not independently targetable, does not reroute enemies, occupies its compiled guard marker, targets exactly `ground`, and has `acceptedContactsBeforeConsume: 1`. Creation, eligible-contact consumption, and replenishment are canonical simulation events/state; animation never changes readiness. The Hoplite level behaviors reference the same resolved summon ID, and an unknown, unused, or multiply defined summon fails.

A defense record contains exactly:

```text
id
nameKey
roleKey
weaknessKey
unlockId
targetKinds
allowedTargetPolicyIds
defaultTargetPolicyId
defenseTags
levels
semanticEventIds
```

Target kinds, policy IDs, tags, and events are unique ASCII-sorted references. The default policy must be allowed. Target masks, role, weakness, unlock, and costs are binding-lock fields for the five slice defenses.

There are exactly three level records in numeric order. Every level is complete and contains exactly:

```text
level
purchase
rangeWorldUnits
behaviors
ui
```

Level 1 purchase is `{ "kind": "build", "costAether": <integer> }`; Levels 2–3 use `{ "kind": "upgrade", "costAether": <integer> }`. No level inherits a prior value. `ui` contains exactly `descriptionKey` and `statFieldIds`; the latter is a nonempty, unique authored display-order array from the compiler-owned typed-stat catalog. Numeric display values derive from the compiled purchase/range/behavior record.

Behavior records are ordered because their pipeline order is semantic. Each record contains exactly `id`, `contractId`, `version`, `deliveryKind`, and `parameters`. `contractId` must exist, at the same version, in the frozen ABI-v1 behavior-contract membership. `parameters` contains exactly the fields in its row:

| Contract | Delivery kind | Exact `parameters` fields |
|---|---|---|
| `direct@1` | `instant-primary-hit` | `cooldownMs`, `baseDamage`, `damageTypeId`, `maximumTargets`, `rangeSource`, `targetPolicySource`, `shieldCoefficientBp`, `armorIgnoreBp`, `bossCoefficientBp`, `consecutiveHitCounter` |
| `splash@1` | `primary-centered-radius` | `cooldownMs`, `baseDamage`, `damageTypeId`, `maximumPrimaryTargets`, `rangeSource`, `targetPolicySource`, `radiusWorldUnits`, `primaryFirst`, `secondaryComparatorId`, `centerBonus` |
| `slow@1` | `primary-status` | `triggerBehaviorId`, `statusId`, `magnitudeBp`, `durationMs`, `controlKind`, `echoCounter` |
| `spawnUnit@1` | `guard-slots` | `summonRecordId`, `activeSlotCount`, `replenishMs`, `initialReady`, `projectionRangeSource`, `markerProofKind`, `markerProofVersion`, `slotComparatorId`, `maximumCreateEventsPerTick`, `createEventId` |
| `block@1` | `marker-contact-control` | `summonRecordId`, `statusId`, `durationMs`, `contactDamage`, `damageTypeId`, `prefilterRuleId`, `contactComparatorId`, `resolveStatusId`, `bash`, `contactEventId`, `rejectedEventId` |
| `aura@1` | `continuous-range-status` | `statusId`, `affectedSide`, `targetKinds`, `rangeSource`, `eligibilityRuleId`, `removalRuleId`, `stackRuleId`, `statusPayload`, `applyEventId`, `removeEventId` |
| `aura@1` | `periodic-targeted-status` | `statusId`, `affectedSide`, `targetKinds`, `rangeSource`, `cadenceMs`, `initialReady`, `maximumTargets`, `durationMs`, `targetPolicySource`, `stackRuleId`, `statusPayload`, `scanCounter`, `scanEventId`, `applyEventId`, `expireEventId` |

`rangeSource` and `projectionRangeSource` are exactly `{ "kind": "level-range" }` in schema v3; the indirection prevents duplicate range constants while leaving a versioned discriminator for a later reviewed form. `targetPolicySource` is either exactly `{ "kind": "equipped-policy" }` or `{ "kind": "fixed", "targetPolicyId": <id> }`. Referenced fixed/equipped policies and every comparator, eligibility, removal, stack, and prefilter rule resolve through the campaign-rules closed catalogs. Attack acquisition uses the selected policy's complete comparator chain; area secondaries use `secondaryComparatorId`; guard contacts use `contactComparatorId`. All total orders end in an immutable runtime ID.

`consecutiveHitCounter` is `null` or contains exactly `kind: "same-target-accepted-hits"`, `requiredAcceptedHits`, `bonusDamageBp`, `bonusAppliesToThresholdHit`, `resetOnTargetChange`, `resetAfterNoTargetMs`, `emptyActivationAdvances`, `secondaryEffectsAdvance`, and `semanticEventId`. `centerBonus` is `null` or exactly `{ "radiusWorldUnits", "damageCoefficientBp", "appliesToPrimary", "appliesToSecondary", "semanticEventId" }`. `echoCounter` is `null` or contains exactly `kind: "every-n-accepted-primary-hits"`, `requiredAcceptedHits`, `maximumSecondaryTargets`, `radiusWorldUnits`, `magnitudeBp`, `durationMs`, `comparatorId`, `emptyActivationAdvances`, `recursive`, `resetRuleId`, and `semanticEventId`. A `slow` trigger must reference an earlier same-level `direct` behavior; it cannot own a second cooldown or damage value.

`bash` is `null` or contains exactly `kind: "first-eligible-contact-per-summon"`, `damage`, `damageTypeId`, `statusId`, `durationMs`, `hardControlBucketId`, and `semanticEventId`. A non-null bash composes atomically with its enclosing accepted marker contact. Its `statusId` and `hardControlBucketId` must identify the enclosing contact's one hard-control occupancy; its nested `durationMs` is the bash-impact subwindow inside the enclosing `durationMs`, not another status duration. It therefore deals its damage and emits its semantic event on that accepted contact, but never applies, replaces, extends, or queues a second hard control. For Hoplite L3 this is 12 damage, one 1,200 ms block, a 250 ms opening impact subwindow, and Resolve beginning only after the 1,200 ms block ends. Continuous Oracle `statusPayload` is exactly `{ "kind": "acquisition-reveal", "collateralEligibilityRuleId": <id> }`. Periodic Oracle `statusPayload` is exactly `{ "kind": "external-damage-amplification", "amountBp": <integer>, "sourceTypeId": <id> }`. `scanCounter` is `null` or contains exactly `kind: "every-n-scans"`, `requiredScans`, `emptyScanAdvances`, `maximumTargets`, `durationMs`, `targetPolicySource`, `resetRuleId`, `recursive`, and `semanticEventId`. These nested objects are strict; their explicit flags fix empty-activation, recursion, reset, and threshold-activation semantics rather than relying on implementation defaults.

Cooldowns, replenishment, status durations, radii, damage, coefficients, target/slot counts, and per-tick caps obey Section 4; a defense behavior requiring positive cadence/range/count cannot encode zero. A referenced trigger precedes its consumer, behavior IDs are unique within the level, and every emitted event appears in the defense's declared event set. `bossScript@1` is not legal in a defense level and is defined only by the boss discriminator in Section 9.2. An omitted/extra parameter or a contract/delivery-kind mismatch fails.

Oracle does not add `reveal` or `mark` to ABI-v1 behavior-contract membership. It uses the existing `aura@1` contract twice:

- Continuous reveal is `continuous-range-status` with semantic `statusId: "reveal"`.
- Target marks are `periodic-targeted-status` with semantic `statusId: "mark"` and a typed external-damage amplification payload.

`reveal` and `mark` remain stable status/event data already allowed by the campaign status model. This preserves the frozen ABI-v1 descriptor and behavior-contract set. Any future need for genuinely different executable behavior requires a new versioned contract/ABI, never an in-place edit.

## 9. Enemy and boss schemas

### 9.1 Regular enemies

The enemy source contains exactly `schemaVersion`, `id`, and ASCII-sorted `records`. Each complete enemy record contains exactly:

```text
id
nameKey
descriptionKey
tags
routeKinds
hp
speedWorldUnitsPerSecond
armor
resistances
shieldPools
baseLineageBountyAether
score
leakIntegrity
threatPriority
control
traits
spawnBehavior
deathBehavior
semanticEventIds
ui
```

`hp` and `speedWorldUnitsPerSecond` are positive; `armor`, `baseLineageBountyAether`, `score`, and `threatPriority` are nonnegative integers; `leakIntegrity` is a positive integer. Tags and route kinds are nonempty unique ASCII-sorted sets. Resistances are unique ASCII-sorted records containing exactly `damageTypeId` and `reductionBp` and never exceed 3,500 bp.

A shield-pool record contains exactly `id`, `capacity`, `initialAmount`, `durationMs`, `sourceTypeId`, `consumeEventId`, and `expireEventId`. Capacity is positive, initial amount is `1..capacity`, and duration is either a positive integer or `null` for a non-expiring pool. Pools are unique and ASCII sorted by ID; runtime consumption follows the frozen ABI expiry/source comparator. An enemy with no shield authors `[]`, never an omitted/default aggregate.

`control` contains exactly `slowControlBp`, `minimumMovementBp`, `hardControlBp`, and `displacementBp`. Each is `0..10000`, minimum movement is positive, and the resulting strongest slow still applies the ABI minimum-movement clamp. Heavy records and bosses may not inherit regular defaults.

The slice trait list accepts only a strict cloak-v1 record containing exactly `kind: "cloak"`, `version: 1`, `revealStatusId`, `damageExposeStatusId`, `damageExposeDurationMs`, `directTargetEligibilityRuleId`, `collateralEligibilityRuleId`, `continuousRevealRuleId`, and `semanticEventIds`. The rule/event/status references resolve through closed catalogs. A cloaked target's acquisition eligibility and damage exposure are canonical simulation state/derived state, never renderer alpha.

`spawnBehavior` is either exactly `{ "kind": "none" }` or an `ordered-children` record containing exactly `kind`, `trigger: "on-create"`, `childSpawnRecords`, `maximumCreateEventsPerTick`, and `semanticEventIds`. `deathBehavior` is exactly `{ "kind": "terminal" }`, an `ordered-children` record with trigger `on-terminal-death`, or a `single-revival` record containing exactly `kind`, `delayTicks`, `restoredHpBp`, `routeOffsetDistance`, `lineageOwnership`, `bountyPolicy`, `statusIds`, `maximumRevivals`, and `semanticEventIds`.

Every ordered child record contains exactly `order`, `enemyId`, `count`, `firstDelayTicks`, `intervalTicks`, `routeOwnership`, `fixedRouteId`, `routeOffsetDistance`, `lineageOwnership`, and `bountyPolicy`. Order is contiguous from zero. Route ownership is `inherit` with `fixedRouteId:null` or `fixed` with one mission-compatible route ID. In v3, lineage ownership is exactly `parent-lineage`, and child/revival bounty policy is exactly `suppressed`; counts and finite due ticks obey the group bounds. `single-revival` likewise requires `parent-lineage`, `suppressed`, and `maximumRevivals:1`. The five regular slice enemies explicitly author `none`/`terminal`; adding a child/revival mechanic is outside Candidate-BAL number tuning and would require an approved product-spec amendment.

`ui` contains exactly `statFieldIds`, a nonempty unique authored display-order array from the compiler-owned typed-stat catalog. `baseLineageBountyAether` belongs to one original lineage. Children, revivals, boss phases, and secondary deaths reference that lineage and cannot mint another bounty. Suppressed groups retain a lineage but pay zero.

### 9.2 Bosses

Boss source has the same wrapper and repeats every common enemy field; runtime inheritance is forbidden. It additionally contains exactly:

```text
bossControlBp
bossMinimumMovementBp
executeBehavior
thresholdScript
phaseRecords
```

`executeBehavior` is exactly `{ "kind": "forbidden" }`. `thresholdScript` contains exactly `contractId: "bossScript"`, `version: 1`, `deliveryKind: "guarded-hp-thresholds"`, and `parameters`. Its parameters contain exactly `maximumTransitionsPerResolvedHit` and `thresholds`; the maximum is exactly one. Threshold records are in semantic order and contain exactly:

```text
id
order
thresholdHpBp
clampHpToThreshold
warningDelayTicks
exposedWindowDurationMs
exposedDamageCoefficientBp
resistanceOverrides
statusDeliveries
childSpawnRecords
maximumCreateEventsPerTick
transitionEventIds
```

Orders are contiguous from zero and HP thresholds are strictly descending, unique basis points from 1 to 9,999. Clamp is `true`. Resistance overrides reuse the exact resistance record and cap; an exposed coefficient is positive and at most 20,000 bp, so vulnerability never requires negative resistance. A status delivery contains exactly `order`, `statusId`, `magnitudeBp`, `durationMs`, `stackRuleId`, and `semanticEventIds`. Threshold child records use the exact ordered-child shape above, require `parent-lineage`/`suppressed`, and resolve their `routeOwnership` against the boss's current mission route. One resolved hit can cross at most one guarded threshold; excess damage stops at the clamp and later thresholds cannot cascade in the same hit.

An accepted threshold immediately clamps HP, exits and enters the applicable phase records, emits its threshold warning, and records a pending release for exactly `warningDelayTicks` later. Exposure does not start at the hit: when the warning expires, `exposedDamageCoefficientBp`, `resistanceOverrides`, and every ordered `statusDeliveries` record activate together, then the threshold's ordered child-release schedules are accepted. A child record's `firstDelayTicks` and `intervalTicks` are relative to that release tick. The release captures the boss's route position, route ownership, and lineage at acceptance; its scheduled child jobs are canonical state independent of the parent entity and survive the boss's later terminal death or leak. `transitionEventIds` is authored in chronology as threshold warning, exposure opening, then pod-release scheduling, and each event still emits only in the ABI phase declared by its event record. Exposure expiry, statuses, children, and transition events have explicit finite timers and authored order.

Every `phaseRecords` entry contains exactly `id`, `order`, `hpUpperInclusiveBp`, `hpLowerInclusiveBp`, `nativeResistanceOverrides`, `activeStatusIds`, `enterEventId`, and `exitEventId`. Records are contiguous descending closed integer intervals, do not overlap, cover every alive HP ratio basis point `10000..1`, and agree exactly with threshold boundaries. No phase is immune; native resistance remains within the campaign cap. Talos Prototype's Scout-pod/exposed-core thresholds use this boss script; exact thresholds, pod counts/timing, and exposed durations/coefficient remain Candidate-BAL unless already locked by an approved annex.

## 10. Mission, economy, wave, objective, and reward schema

The mission source contains exactly:

```text
schemaVersion
id
titleKey
actIndex
missionIndex
seedNamespace
mapId
prerequisiteMissionIds
headlineMechanicId
briefing
enemyRosterIds
bossRosterIds
availableDefenseIds
baseStartAether
waves
objectives
firstClearRewards
tutorial
previewDeclarations
scoreRecord
semanticEventIds
presentationPackId
```

Schema version is 1. IDs/references are validated against the v3 source tree and campaign-rules catalog. A developer slice may bypass prerequisites only in its developer-only profile/entry configuration; mission data retains production prerequisites and rewards.

`briefing` contains exactly `summaryKey`, `objectiveKey`, `routeNoticeKeys`, and `mechanicNoticeKeys`; the two key arrays are authored display order. `tutorial` is exactly `{ "kind": "none" }` or contains exactly `kind: "guided"`, `modeId`, `stepIds`, `upgradeGateMode`, `skipCommandType`, and `semanticEventIds`. The guided form for `m01` references the frozen ABI tutorial gate; no other mission can silently inherit it. `availableDefenseIds` is the mission-compatible set, not an unlock grant: loadout resolution intersects it with canonical profile unlocks before Start. Thus Hoplite remains unavailable on an uncleared new profile, is granted after the Mission 1 victory transaction, and can be selected only for a later run.

`scoreRecord` contains exactly `scoreRuleId`, `victoryScore`, `integrityPointScore`, `masteryObjectiveScore`, and `rawUnspentScorePerEligibleAether`. Enemy kill points come only from enemy `score`; wave-clear points come only from `waveClearScore`. These candidate point values cannot replace the binding eligible-bank, divisor-19 cap, or difficulty-application formulas referenced by `scoreRuleId`.

### 10.1 Economy and ordered waves

Wave records are in numeric order and contain exactly:

```text
id
index
baseAetherEnvelope
deploymentGrantAether
clearGrantAether
groups
previewDeclarationIds
waveClearScore
titleKey
deploymentGrantEventId
clearGrantEventId
```

Indices are contiguous from 1. A deployment grant resolves only when the accepted `startWave` command executes and therefore precedes scheduled spawns under ABI-v1. Clear grants resolve only after wave-clear detection. Waves never overlap.

Grant event IDs are `null` exactly when the corresponding grant is zero and otherwise reference an event whose payload includes wave ID and resolved amount. Spawn groups are authored event order. Each contains exactly `id`, `order`, `spawnKind`, the discriminator-specific `enemyId` or `bossId`, `routeId`, `count`, `firstTick`, `intervalTicks`, `shuffleWithinGroup`, `rngStreamId`, `modifierIds`, `bountyPolicy`, and `spawnEventId`.

- `order` is contiguous from zero and breaks simultaneous group ties before runtime ID.
- `firstTick` is relative to the accepted wave start; `intervalTicks` is positive even when count is one.
- `shuffleWithinGroup:false` requires `rngStreamId:null`; `true` requires one unique named stream and an explicitly interchangeable group.
- `bountyPolicy` is `base-lineage` or `suppressed`. It cannot override the numeric bounty.
- Route compatibility, enemy/boss reference, modifiers, timer cap, maximum simultaneous due spawns, and final finite spawn tick are validated statically.

For Strategos, the compiler proves:

```text
baseAetherEnvelope =
  deploymentGrantAether
  + sum(original lineages with base-lineage policy × referenced baseLineageBountyAether)
  + clearGrantAether
```

Story/Titan bounty resolution uses the mission-scoped ABI remainder; fixed grants do not. The final wave requires `clearGrantAether = 0`. Any final-wave income must resolve while a tactical command remains possible; in schema v3, final-wave lineage bounties are therefore suppressed and the final envelope is credited through the deployment grant before first spawn. A later schema may add another explicitly pre-spawn grant kind, but cannot infer one.

### 10.2 Objectives

There are exactly three player-visible objective records—`victory`, `integrity`, and `mastery`—in that order, and they are evaluated independently for each difficulty. Every objective contains exactly `id`, `kind`, `titleKey`, `descriptionKey`, `progressKey`, and its discriminator payload. Victory adds exactly `predicate: "mission-victory"`. Integrity adds exactly `thresholdRecords`, three `{ difficultyId, minimumIntegrity }` records in Story/Strategos/Titan order. Mastery adds exactly `predicate`; all are fixed before Start.

Integrity contains exact Story/Strategos/Titan integer thresholds. Slice mastery predicate v1 is a strict discriminator supporting:

- `maximum-owned-towers-at-victory` with one integer maximum.
- `no-leaks-from-routes` with a nonempty sorted route-ID list.
- `no-leaks-from-lineage-tag` with one enemy/child lineage tag.

An unsupported predicate fails closed. Objective predicates consume canonical hashed state facts, not presentation callbacks or a reconstruction of the semantic-event log. The kernel initializes sorted integer leak counters for every mission route ID and authored lineage tag, increments the applicable route and lineage counters exactly once for each accepted leak, and snapshots the nonnegative owned-tower count when victory becomes terminal. Outcome, final integrity, these leak counters, and the victory tower-count snapshot enter canonical state/checkpoint hashes; the three predicates read only those facts. Semantic events may report the same transitions for evidence or presentation, but dropping or replaying an event cannot change objective completion.

### 10.3 Rewards and previews

First-clear reward records contain exactly `id`, `order`, `kind`, and the discriminator fields, with contiguous order from zero. Strict kinds are:

- `unlock-defense` with one defense ID.
- `campaign-modifier` with one campaign-modifier ID and exact grant amount already owned by that modifier record.
- `loadout-slot` with the resulting integer slot cap.

The compiler checks duplicate grants, reward/mission consistency, and unlock-graph cycles. Social entitlement is not a mission prerequisite or core reward.

Every newly lethal mechanic has a `previewDeclarations` record containing exactly `id`, `mechanicId`, `briefingKey`, `previewKind`, discriminator-specific `previewEventId` or `previewGroupId`, `firstLethalWaveIndex`, and `semanticCueIds`. Preview kind is `briefing`, `nonlethal-semantic-event`, or `harmless-group`; briefing has neither event nor group field, and each other kind has only its matching field. The first lethal appearance must follow its declared preview.

## 11. Semantic events and localized strings

The event catalog contains exactly `schemaVersion`, `id`, and ASCII-sorted `records`. An event definition contains exactly:

```text
id
version
phaseId
payloadFields
highlightTags
presentationCueId
```

`phaseId` references the frozen ABI phase or the accepted command phase. Each payload-field record contains exactly `name`, `type`, `required`, and `nullable`. Fields have unique ASCII names, an explicit canonical type (`integer`, `boolean`, `id`, `id-array`, or `string-key`), and Boolean required/nullable status. Their authored order is the schema order; payload object keys canonicalize normally. Every emitted/referenced event resolves exactly once. Event IDs and deterministic payloads enter replay/state evidence; `presentationCueId` is only a stable lookup key and has no combat effect.

### 11.1 Candidate slice simulation-kernel and replay contract

The Candidate slice kernel uses the ABI-v1 `preShieldDamageMilli` exact rational chain and performs its one floor only at that existing named boundary. Every later damage stage is a checked integer operation with its own boundary, in this exact order:

```text
shieldDamageMilli = floor(preShieldDamageMilli * shieldCoefficientBp / 10000)
shieldConsumedMilli = ordered consumption from shieldDamageMilli across the target's shield pools
overflowDamageMilli = max(0, shieldDamageMilli - shieldConsumedMilli)
effectiveArmorMilli = max(0, armorMilli - strongestEligibleArmorBreakMilli)
mitigatingArmorMilli = floor(effectiveArmorMilli * (10000 - armorIgnoreBp) / 10000)
postArmorDamageMilli = max(0, overflowDamageMilli - mitigatingArmorMilli)
postResistanceDamageMilli = floor(postArmorDamageMilli * (10000 - reductionBp) / 10000)
```

Shield pools consume in their already-authored stable order and cannot consume more than their current pool or the remaining `shieldDamageMilli`. `strongestEligibleArmorBreakMilli` is the one winning armor-break status under the status comparator, never a sum. `reductionBp` is the winning native resistance for the hit's damage type after any active override. Final HP damage is zero when `postArmorDamageMilli` is zero or `reductionBp` is immune at 10,000 bp; otherwise it is `max(1, postResistanceDamageMilli)`. Thus the one-milli minimum applies only when positive damage survived armor and resistance was nonimmune. No stage rounds to authored whole damage.

Within one attack-resolution tick, tower-generated hit intents resolve by the total tuple `(towerRuntimeId ascending, authored behavior index ascending, primary before secondary, behavior-selected target order)`. The behavior's returned target sequence is preserved. Each behavior takes one target-eligibility snapshot for that activation; an earlier intent killing or changing a target never causes a later intent to retarget or refill an empty position. Movement and aggregate guard contact/control remain in their earlier frozen ABI phase. Boss hit reducers consume the ordered hit intents sequentially, so Talos applies its one-threshold-per-resolved-hit clamp before the next tuple member resolves.

The kernel has exactly one behavior-adapter boundary. It resolves behavior parameters from the bound canonical content definition and authored index; attaches the canonical tower, summon, boss, target, and lineage source IDs; snapshots and filters target kind, route compatibility, range, cloak/reveal eligibility, and terminal state; normalizes all hit/status/spawn intents to the kernel shape; invokes aggregate guard arbitration once with the complete same-phase guard/contact set; and drives timer/status expiry before the affected later eligibility snapshot. No tower-specific caller, renderer, replay, or balance harness may duplicate those responsibilities or pass an alternate content definition. Adapter validation failure rejects the tick without truncated output or partial canonical mutation.

Combat target kind and map geometry layer are separate namespaces. An enemy's Targeting `layerId` is the logical route's authored `kind` (`ground` or `air`), and a defense query's `targetLayerIds` are its compiled `targetKinds` in authored order. The historical Targeting field names remain ABI-v1 API names but carry combat target-kind IDs. A physical lane segment's map `layerId` (for example `surface`) is used only for geometry/crossing ownership and is never passed to Targeting or matched against a defense `targetKinds` array.

Every accepted original regular-enemy or boss spawn allocates from the shared ABI `enemy` runtime-ID domain and creates exactly one unique lineage ID formatted as `lineage.` followed by that base-10 runtime ID with no leading zeroes. The original entity's `lineageTags` are the owner's compiled ASCII-sorted `tags`. A child or revival preserves its parent's `lineageId`; its entity `lineageTags` are the ASCII-sorted unique union of the parent's tags and its own compiled owner tags. Lineage ID is identity for one-bounty accounting, while lineage tags are classification facts for objectives; neither may stand in for the other. The lineage ledger is canonical hashed state sorted by lineage ID and records the original group's bounty policy, declared base bounty, and claimed flag. Every entity records a leak exactly once, incrementing each tag in that entity's `lineageTags`; Talos pods therefore retain the `boss` tag and cannot evade Mission 5 mastery. Talos pending releases and the `talos.pods` payload carry singular `lineageId`, never a classification tag. Suppressed lineages never pay; within this slice, every `base-lineage` owner has no child/revival behavior and pays its declared bounty exactly once on its irreversible terminal death. Future split-bounty apportionment requires a separately authored contract and is not inferred here.

During the leaks phase, every nonterminal hostile that has reached its route end resolves in enemy runtime-ID ascending order. Each accepted leak records its route/lineage facts once and sets `integrity = max(0, integrity - leakIntegrity)`. The first result of zero makes defeat terminal immediately; no later leak or subsequent phase in that tick mutates canonical state or emits gameplay events.

Talos exposure contributes exactly one internal boss damage coefficient: `exposedDamageCoefficientBp`. The simultaneous `exposed` status delivery is the canonical state/semantic representation of that same window for expiry, events, and presentation. Its magnitude is never added or multiplied again as external amplification. Exposure, resistance overrides, and the status share the authored start and expiry boundaries.

`campaign-score-v1` resolves only from checked nonnegative integers. `killScore` adds an owner's compiled `score` once when that runtime entity reaches irreversible terminal death; a pending revival is not a scored death, while each separately allocated child is a separate runtime entity. `waveScore` adds each accepted wave's `waveClearScore` exactly once when that wave clears. At terminal resolution, evaluate the fixed objectives first, then compute `rawBaseNonAetherScore = killScore + waveScore + (outcome == victory ? victoryScore + integrity * integrityPointScore + (mastery complete ? masteryObjectiveScore : 0) : 0)`. Compute `scaledBase = floor(rawBaseNonAetherScore * difficulty.scoreBp / 10000)` once; if the raw base is positive and this floor is zero, use `scoreRules.minimumNonzeroScore`. This is `nonAetherScore`. Compute `excludedStartAether` as the checked sum of applied `start-aether-add` campaign modifiers plus `assistRecord.startAetherAdd` only when Assist is enabled, then `eligibleUnspentAether = max(0, finalBank - excludedStartAether)`, `rawUnspentScore = eligibleUnspentAether * rawUnspentScorePerEligibleAether`, `unspentScore = min(rawUnspentScore, floor(nonAetherScore / unspentCapDivisor))`, and `finalScore = nonAetherScore + unspentScore`. No component, multiplier, minimum, or cap is applied twice; defeat cannot receive victory, integrity, or mastery points.

A wave clears only when all of that wave's authored spawn jobs, pending Talos warning releases, accepted child-spawn jobs, and active hostile entities are exhausted. Player tower summons and finite status/effect timers are not hostile wave blockers. The wave-clear phase applies its fixed clear grant, adds `waveClearScore`, calls `Management.completeActiveWave`, and, for the final wave, resolves victory in that same phase and order.

Ruleset binding compares the release record and compiled content for exact `contentVersion`, `contentHash`, `abiHash`, `eventSchemaVersion`, and `behaviorRegistryVersion`, requires the release's included IDs to equal the compiled Candidate slice IDs, and requires the runtime ABI event/behavior/command versions to match before initial state exists. `abiHash` is the hash of the authored descriptor bytes, whereas `ABI.DESCRIPTOR_SHA256` is the hash of its canonical semantic value; they are different hash domains and are not compared as strings. Runtime semantic compatibility is established by the generated artifact's build-time descriptor check plus the version/registry checks above; the pinned simulation artifact and `rulesetHash` bind the exact executable bytes.

The kernel-owned resource ceilings are `MAX_ACTIVE_ENTITIES = 4096`, `MAX_TARGET_CANDIDATES = 4096`, and `MAX_SEMANTIC_EVENTS_PER_TICK = 16384`. They are hashed Candidate slice simulation-contract constants, not balance knobs. The compiler proves every compiled content worst case remains within them, and the kernel adapter supplies the same fixed ceilings to behaviors. Content, replay data, tests, and other callers cannot override or relax them. Runtime overflow throws deterministically before partial mutation; target/event/entity arrays are never truncated.

Replay binding obtains `EVENT_SCHEMA_VERSION` only from `ABI.EVENT_SCHEMA_VERSION` and compares the replay envelope and bound simulation content against it. Independently, it compares `Commands.COMMAND_SCHEMA_VERSION` with the ABI command-schema version; equality of the current numeric versions never permits one check to stand in for the other, and a mismatch fails before initial state exists. The replay envelope header adds canonical integer `loadoutSlotCap` in the inclusive range `1..6`. Initial canonical state copies that exact value, validates the resolved loadout against it, and includes it in checkpoint/final hashes. Replay parsing and simulation never infer the cap from a current profile, mission-clear history, renderer, or mutable tutorial state.

### 11.2 Bounded balance telemetry and conserved value formula

The kernel's sole `advanceTick` seam returns exactly frozen `{ events, state, telemetry }`. Balance telemetry is deterministic noncanonical evidence from the same reducer invocation, not simulation state or a semantic-event substitute. It is excluded from checkpoints, final hashes, replay envelopes, score, objectives, progression, and presentation. The replay runner validates it and then ignores it for every authoritative claim. A second balance-only reducer or advancement seam is forbidden.

Telemetry schema v1 is exactly `{ schemaVersion: 1, tick, records }`. `tick` equals the input state's current-tick boundary. `records` is actual reducer order with contiguous zero-based `ordinal`; records never reorder by kind after resolution. The kernel exports exact constants `BALANCE_TELEMETRY_SCHEMA_VERSION = 1`, `MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536`, and `MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096`. Every record is deeply frozen and canonical. IDs and enum values come from the bound artifacts or closed runtime domains; no record contains prose, timestamps, paths, URLs, platform values, or renderer data. Unknown/missing/extra fields, an unsafe integer, invalid null, duplicate/reordered ordinal, oversized target list, or record overflow rejects the tick without truncation.

Every record contains `kind` and `ordinal` plus exactly its listed fields:

```text
spawn:
  entityKind enemyRuntimeId ownerId lineageId routeId waveId
  maximumHpMilli initialShieldMilli baseSpeedDistanceUnitsPerSecond

aether-transaction:
  action sourceId commandSeq towerRuntimeId padId defenseId levelBefore levelAfter
  debitAether creditAether investedBeforeAether investedAfterAether
  bankBeforeAether bankAfterAether bountyRemainderBefore bountyRemainderAfter

activation:
  actionId behaviorId sourceTowerRuntimeId sourceRuntimeId defenseId level padId outcome
  eligibleTargetRuntimeIds selectedTargetRuntimeIds

movement-control:
  enemyRuntimeId ownerId lineageId routeId priorRouteDistance nextRouteDistance
  actualAdvanceDistance effectiveSpeedBp scaledReductionBp
  sourceEffectRuntimeIds sourceRuntimeIds sourceTowerRuntimeIds

damage:
  sourceTowerRuntimeId sourceRuntimeId defenseId level padId
  targetRuntimeId targetOwnerId targetLineageId targetRouteId damageTypeId
  baseDamageMilli preShieldDamageMilli attemptedShieldDamageMilli appliedShieldDamageMilli
  eligibleHpDamageMilli appliedHpDamageMilli deferredHpDamageMilli overkillHpDamageMilli
  noExternalAppliedShieldDamageMilli noExternalAppliedHpDamageMilli
  targetShieldBeforeMilli targetShieldAfterMilli targetHpBeforeMilli targetHpAfterMilli
  supportSourceTowerRuntimeIds revealSourceTowerRuntimeIds

effect:
  action sourceTowerRuntimeId sourceRuntimeId defenseId level padId
  targetRuntimeId targetOwnerId targetRouteId effectKind statusId
  requestedMagnitude appliedMagnitude requestedDurationTimeUnits appliedDurationTimeUnits outcome

leak:
  enemyRuntimeId ownerId lineageId routeId hpMilli shieldMilli integrityDamage
```

Closed schema-v1 values are: `spawn.entityKind = enemy|boss`; Aether action `build|upgrade|sell|wave-start-grant|wave-clear-grant|bounty`; activation action `direct-hit|splash-blast|mark-scan|guard-contact|guard-create` with outcome `accepted|no-target|rejected`; effect action `apply|refresh|remove|expire`, runtime effect kind `status|delayed-status|external-amplification|boss-exposure|resistance-override`, and outcome `applied|refreshed|removed|expired|rejected`. Activation emits accepted actual shots/scans/contacts/creates, ready-but-empty `no-target`, and rejected guard-contact decisions; it emits no cooldown-wait or continuous-Reveal-sync record.

In Aether records, `sourceId` is exactly `command.build`, `command.upgrade`, or `command.sell` for those actions, wave ID for either grant, and lineage ID for bounty. `commandSeq` is nonnull only for build/upgrade/sell/wave-start-grant. Tower/pad/defense/level/investment fields are nonnull only for build/upgrade/sell; build uses zero before values and sell uses zero after values. Effect source runtime and target identity are always nonnull. Apply and ordinary refresh from a player source require nonnull source-tower/defense/level/pad. Remove/expire may set those four fields all null only when a consumed summon or sold tower makes current source provenance unresolvable; the earlier streamed apply/refresh record remains the bounded report mapping. The sole player-source refresh exception is activation of an already-streamed `delayed-status`: it emits `action: "refresh"`, `outcome: "refreshed"`, and the active `effectKind: "status"` with those four fields all null when the consumed summon makes current tower provenance unresolvable. The streaming fold must find exactly one prior `delayed-status` mapping with the same `statusId`, `sourceRuntimeId`, and `targetRuntimeId`, inherit its player provenance, delete the delayed key, and install the active-status key; otherwise it rejects the transition. If any of the four fields is present, all four are present. A non-player boss source may also use all four null. The replay validator checks the closed transition shape but does not reconstruct history; the streaming balance fold rejects every unmatched null-provenance lifecycle record. Other nullable fields are limited to genuinely inapplicable authored/runtime identity slots; numeric measurements are never nullable and use zero when inapplicable. Target/source arrays are ascending unique runtime IDs. Movement `sourceEffectRuntimeIds` and `sourceRuntimeIds` are equal-length and align by ascending effect ID. `sourceTowerRuntimeIds` is the ascending unique set of owners resolvable at the current boundary; it may omit consumed-summon or sold-tower ownership and need not align. The streaming fold recovers every omission from the earlier effect apply/refresh mapping or rejects it; a summon ID never masquerades as a tower ID. All three arrays are empty when no control applies.

A `spawn` record precedes every same-tick fact for that entity, and a `leak` record exists for each actually accepted leak only. `damage` reports actual pool deltas, not inferred nominal damage: `appliedShieldDamageMilli = targetShieldBeforeMilli - targetShieldAfterMilli` and `appliedHpDamageMilli = targetHpBeforeMilli - targetHpAfterMilli`. A Talos threshold clamp puts unapplied eligible HP damage in `deferredHpDamageMilli`, not overkill. Only terminal excess after all guarded clamps is `overkillHpDamageMilli`. The two `noExternalApplied*` values re-resolve the same accepted hit against the same pre-hit pools with external amplification removed through the same kernel damage functions. The record's support-source list is the exact surviving external-amplification source set; reveal sources are the active sources without which direct acquisition was illegal.

`movement-control` exists for every moved or movement-eligible hostile tick, including zero advance. It records the actual strongest-only result and exact winning source; no-control shadow progress is not canonical state. The balance harness advances that shadow with the same bundled Movement API, resolved spawn speed, route, and fixed tick sequence while omitting slow/stun. It may not copy the movement formula. A positive shadow-minus-actual advance with no current winning source is valid only as a post-expiry fixed-point remainder tail for an entity that already has positive accumulated winning control-source weights. The fold allocates only that tail across those historical weights by integer largest remainder then source runtime ID and creates no new source; the same delta with no historical positive source rejects the evidence. Similarly, starting-economy components are obtained from the same bundled Economy resolver and bound header/content; they are not reconstructed from renderer constants and need no repeated tick record.

The slice report formula is `combat-value-v1-conserved`. For each runtime hostile `e` at shared checkpoint `K`, let `B[e]` be spawned HP plus spawned shields, `A[e]` be actual shield/HP decrements through `K`, and partition every applied damage milli-unit into direct `D`, support-enabled `S`, or control-enabled `C`, so `D + S + C = A`. Attempted damage, overkill, and threshold-deferred damage contribute zero. External-amplification credit is the nonnegative actual-applied difference from the same hit's no-external result and is deducted from its firing source's direct share; multiple surviving amplification sources split it in proportion to contributed damage basis points by integer largest remainder then source runtime ID. If a hit was legal only because of Reveal, its remaining applied share goes to the lowest-runtime-ID active Reveal source and is deducted from direct. After that support allocation, a hit is control-enabled only when the no-control shadow target would already have leaked or would be outside the firing tower's compiled range at that acquisition tick. The range comparison resolves the target's exact shadow route position through the bundled bound Geometry API and compares it with the firing pad using the tower's exact compiled level range; analyzer review probes are sparse map evidence and may not be required, interpolated, or substituted for gameplay geometry. The hit's remaining applied share is deducted from direct and allocated among accumulated winning control sources in proportion to their prevented distance, using integer largest-remainder allocation and source runtime ID as the final tie-break.

`P[e]`, prevented-leak durability, is nonzero only when the no-control/no-support shadow leaks `e` by `K` and the real run does not: `P[e] = min(B[e] - A[e], actual remaining durability of e at K)`. `P[e]` is allocated only among that entity's accumulated winning control sources in proportion to their prevented distance, using the same integer largest-remainder/runtime-ID rule as control-enabled applied damage; direct, amplification, and Reveal sources receive zero prevented-leak credit. Positive `P[e]` without at least one positive resolved control-source weight rejects the evidence. If an earlier same-tick leak reduces integrity to zero and terminates leak arbitration, a later live hostile already at its exact route endpoint is terminally unprocessed rather than a real control-preserved survivor; it receives `P[e] = 0` and cannot create or require a control weight. Therefore `D + S + C + P <= B` for every non-healing slice entity and no credited support/control/leak value can duplicate applied damage. `combatNumeratorMilli = sum(D + S + C + P)`. Pair checkpoint `K` is the larger terminal duration; a shorter terminal run's report counters carry forward unchanged without advancing canonical state. Ratios retain integer numerator/denominator. Placement-pair timing is compared by zero-based distinct command-bucket ordinal and within-bucket command order, not by absolute tick, because placement itself changes the preceding wave's terminal duration. Every paired bucket contains exactly one accepted `startWave`; corresponding buckets have identical command count, `seq`, type, and payload except for exactly two normalized build-pad IDs, with no inserted, omitted, or mid-wave-only bucket. The placement gate uses cross multiplication: `awareNumerator * naiveNetConsumed * 10000 >= naiveNumerator * awareNetConsumed * 11500`; a zero/nonpositive denominator fails the witness. Campaign score is excluded.

For `m01`, the Sentinel-focus, Chronos-control, and Siege-clustering witnesses are purchase/placement witnesses of the same resolved new-profile starter-trio loadout. The requirement that three fixtures differ pairwise by at least two equipped defense IDs applies only where three materially different loadout fixtures are required; it cannot apply to these three starter-loadout emphasis witnesses. They instead use pairwise-distinct first accepted build pads and first paid-upgrade `(waveIndex,tick)`, and each named family is the unique largest family by both final investment and conserved combat value, with at least 35% of each and a lead of at least ten percentage points over the next family. Post-clear, trial, or developer access cannot substitute.

Version-1 material use requires a build before the final wave, at least 60 wave-active owned ticks, at least 1,000 conserved milli-value, and at least 5% of witness value. It additionally requires: Sentinel ten positive applied hits; Chronos selection as strongest movement reducer for 60 enemy-ticks; Siege three activations damaging at least two targets; Hoplite two accepted guard contacts; Oracle one Reveal-enabled acquisition/hit and three positively amplified marked hits. Two `m04`/`m05` witnesses are materially different only when their loadout symmetric difference has at least two defense IDs, each differing defense is materially used, and both are unassisted Strategos wins with at least five integrity.

`roughly two paid upgrades` means each representative `m01` witness ends with one through three upgrade units, where `upgradeUnits = sum(finalTower.level - 1)`, and their median is exactly two; sold/lifetime upgrades and L3-before-Wave-4 remain diagnostics. The route-aware/imperfect pair holds the already-bound inputs constant, changes exactly two build-pad assignments, uses legal nonzero-coverage substitutes whose role-matched exposure is 60–95% of the aware pad, and the imperfect run wins with 12–17 integrity while both retain four/five final towers, one through three upgrade units, and 360–410 net consumed.

Mission 4 is materially exercised only when the witness builds a north-local, south-local, and shared-route pad; each local tower applies damage/control before `join.harbor-merge`; the shared tower materially affects both route IDs after the merge; and one acquisition observes live candidates from both routes on `lane.shared.trunk` and selects by the compiled comparator. Mission 5 is materially exercised only when Talos spawns and dies without a boss-lineage leak, all three 75/50/25 transitions occur, all warnings mature, each exposure window receives positive applied damage, exactly all `3 + 4 + 5` authored Scout children release, and victory follows those facts.

Every defense's matched weakness scenario uses a plausible equal-budget substitute. A weakness is visible when the substitute has a better terminal result or at least 10% better role value per Aether by exact cross multiplication. Slice scenarios are armored density for Sentinel, sparse unarmored targets without allied damage for Chronos, separated single targets for Siege, sustained pressure beyond guard replenishment for Hoplite, and non-cloaked targets without nearby attackers for Oracle. Strict dominance means no worse victory, integrity, score, and conserved value per Aether in every common matched scenario plus strictly better in at least one; it fails the candidate. Each defense must also beat all plausible substitutes in one role scenario by terminal result or at least 5% value per Aether.

Seeded legal-random control v1 uses strategy ID `legal-random-placement-spend-v1`, named stream `balance.legal-random-placement-spend-v1`, and seeds `[0,1,2,17,257,65537,324508639,610839776,2147483647,2147483648,3735928559,4294967295]`. It runs new-profile `m01` Strategos with no Assist/modifier, starter trio, and default policies; attempts exactly two uniformly selected legal options initially and one at each later planning boundary; never sells; then starts immediately. Affordable candidates sort by build-before-upgrade, pad selection order, defense ID, and resulting level, recomputing after every purchase. If no affordable candidate exists for a required attempt, the strategy consumes no RNG value, skips that attempt, and starts immediately; it never issues a knowingly denied command. Selection uses the bundled named Mulberry32 stream with unbiased rejection sampling, never modulo bias. The exact twelve-seed aggregate must contain at least eight terminal defeats, no more than four victories, and at least one defeat during Wave 5 or 6. The one-tower/no-upgrade control remains the exact late-loss calibration; random early losses remain truthful evidence rather than being discarded or coerced.

The current three-mission compiled slice contains no air-route hostile and no shield pool. Its balance report must mark the full-campaign air and shield matrix axes `unavailable`, cite the exact compiled roster facts, and must not synthesize or mutate an enemy to claim a pass. The first reviewed compiled campaign content that introduces those mechanics must close the deferred axes before its applicable balance approval. This scoped deferral does not waive target-mask kernel tests or the other authored weakness scenarios.

The string catalog contains exactly `schemaVersion`, `id`, `locale`, `fallbackLocale`, and ASCII-sorted `entries`. Each entry contains exactly `key`, `value`, and `placeholders`; each placeholder contains exactly `name` and `type`. Placeholder names/types are explicit and unique; the text must use every declared placeholder exactly and may not introduce another. Numeric tower/enemy/economy UI is supplied through typed placeholders derived from compiled records. A localized string cannot become a second balance table.

The presentation catalog contains exactly `schemaVersion`, `id`, `packRecords`, and `cueMappings`. Schema version 1 is deliberately Candidate-BAL-only and supports no bitmap/atlas records. Each ASCII-sorted pack record contains exactly `id`, `kind: "procedural-placeholder"`, `missionIds`, and `fallbackStyleId`; mission IDs are unique ASCII sorted, and one mission belongs to exactly one pack. Each ASCII-sorted cue mapping contains exactly `cueId`, `kind: "semantic-fallback"`, and `fallbackStyleId`. Every mission `presentationPackId` and event `presentationCueId` resolves exactly once. Fallback style IDs select reviewed presentation code only and carry no simulation value. An unknown key/kind, asset URL/path, sprite rectangle, transfer byte claim, or unresolved/duplicate mission or cue fails. A later reviewed presentation-catalog version must define explicit immutable asset/sprite records and byte budgets before production art or a production-approved manifest; schema v1 can never be production-approved.

Localized values, mission prose, audio files, sprite records, and cue-to-asset mappings compile into a separately hashed presentation companion. They are excluded from `rulesetHash`. Simulation records retain only stable string/event/cue keys where needed. An art/copy-only correction can therefore preserve replay compatibility while changing release-manifest identity.

## 12. Deterministic compilation and delivery

Compilation has four explicit partitions:

1. Strictly parse and hash-check every referenced source without directory scanning.
2. Normalize v1/v2 maps into one immutable map IR and validate all cross-file references, bounds, role proofs, locks, economies, unlocks, previews, and arithmetic.
3. Emit canonical simulation content containing only compiled deterministic values and stable semantic IDs.
4. Emit a separate immutable presentation companion containing localized values and semantic cue mappings.

The ruleset identity remains the ABI-v1 length-framed SHA-256 over the exact ABI descriptor bytes, exact self-contained simulation artifact bytes, and exact canonical simulation-content bytes. Source paths/hashes, approval evidence, localized values, and art are excluded. Generated provenance pins their hashes separately.

Canonical simulation content declares its own `schemaVersion: 3`, `contentVersion`, `abiHash`, independent `eventSchemaVersion`, and `behaviorRegistryVersion` before its compiled campaign records. The simulation artifact exports the same event-schema and behavior-registry versions. The event-schema version is artifact-owned and is never inferred from the command-schema version merely because both currently equal 1; any mismatch fails binding before initial state exists.

The generated v3 manifest contains exactly:

```text
schemaVersion = 3
contentVersion
approvalState
annexHash
abiHash
eventSchemaVersion
behaviorRegistryVersion
simulationArtifact
simulationHash
contentArtifact
contentHash
presentationArtifact
presentationHash
rulesetHash
sourceManifestHash
sourceProvenance
includedIds
releaseEligible
```

`sourceProvenance` is ASCII sorted by `(kind,id)` and each record contains exactly `kind`, `id`, `source`, and `sha256`. `includedIds` contains exactly `missions`, `defenses`, `enemies`, and `bosses`, each a sorted unique ID set. Artifact names are content-hashed basenames, every declared hash matches exact bytes, and `releaseEligible` is false for `candidate-balance` and `balance-approved`. A production-approved value means only eligibility for a separately validated release descriptor, not automatic deployment.

Immutable filenames use content hashes. Current expected artifacts must be regular files; historical immutable artifacts remain verified and retained. A compiler rerun over unchanged bytes is byte-identical.

Browsers never fetch authoring JSON or the generated JSON manifest. The release build emits a classic script `aegis-release.<sha256>.js` containing one deeply frozen copy of the exact generated-manifest fields and relative content-hashed artifact names; the checked-in game HTML pins that hashed filename. Under both `file://` and HTTP(S), scripts load in order: release record, simulation artifact, simulation content, presentation companion, then runtime boot. Every later artifact verifies against the pinned release record before Start. Node tests consume those same immutable bytes through their supported CommonJS/VM seam. HTTP may use the Aegis service worker and immutable cache; `file://` uses relative classic scripts and no service worker. Neither mode may select a mutable filename, directory listing, query-supplied manifest/artifact URL, renderer constant, or network-fetched balance data. Missing/corrupt presentation data may use an honest presentation fallback; missing/mismatched simulation content fails closed before play.

## 13. Mission 1 map-schema migration

`maps/m01.json` remains schema v1 until a reviewed source-only migration is useful. A v3 manifest references it with `map.schemaVersion: 1` and must also reference one proof supplement. The supplement file contains exactly:

```text
schemaVersion = 1
id
mapId
normalizedMapSchemaVersion = 2
roleProofs
```

`mapId` is exactly `m01`; `roleProofs` uses the exact Section 7 source records and is the only extra field merged into the normalized map IR. It cannot add or replace lanes, pads, anchors, probes, selection order, review policy, or any other v1 geometry. Its source bytes are hash-pinned like every other v3 reference, while its compiled marker/proof values enter simulation content and `rulesetHash`. Reformatting the same normalized proof data may change source provenance/release identity without changing `rulesetHash`; changing a marker or proof value changes compiled content and therefore the ruleset.

The compiler normalizes map v1 as follows:

- Each v1 logical route `R` becomes one v2-IR physical lane segment with exact ID `lane.migrated.R` and the exact existing compiled subsegments (for example, `route.main` becomes `lane.migrated.route.main`).
- The logical route references that physical segment.
- Existing endpoint anchors become v2-IR entry/gate anchors with the route-ID set.
- Existing pads, probes, exclusions, and crossings retain their exact geometry and report values.
- Selection order is existing pad order after the current route-stage golden passes.
- No join is synthesized for a single physical segment.

Normalization must reproduce the binding length 260,000, all ten pad centers/intents/qualities, every R20/R22/R24 exposure, clearances, stage order, and spread bit-for-bit. A later authored schema-v2 transcription of `m01` is accepted only if its normalized simulation/map IR and analyzer report are canonical-byte identical to the schema-v1 normalization. Schema migration alone may not change Mission 1's ruleset behavior.

Mission 1's first-clear reward remains the Hoplite unlock. Hoplite is unavailable on the uncleared new-profile run, the reward resolves only after victory, and the defense becomes loadout-eligible on a later Mission 1 replay. The required guard-v1 proofs therefore cannot be omitted merely because the first run does not own Hoplite: the v1-map proof supplement supplies exactly three markers for every Mission 1 pad before any replay can equip it. Map-v2 missions instead author those proofs directly in `roleProofs`; supplements on map v2 fail. Hoplite marker proofs do not alter the approved construction-pad geometry.

## 14. Candidate-BAL examples (non-binding)

This section illustrates the schema shape. Every value here that is not already a binding lock remains Candidate-BAL and requires the balance lab and annex promotion.

Examples in this section are prose only: they are not compiler inputs, do not satisfy a binding lock or candidate-scope declaration, and cannot be promoted by copying the document. Promotion requires reviewed source bytes, a new annex/source hash set, and the required deterministic evidence.

### 14.1 Shared-route example

An `m04` candidate may use north/south approach segments that join a shared trunk:

```text
lane.north.approach: (-2,4) → (9,4) → (9,10) → (20,10) → (24,12)
lane.south.approach: (-2,21) → (9,21) → (9,15) → (20,15) → (24,12)
lane.shared.trunk:   (24,12) → (31,12) → (31,19) → (41,19)
```

This is an example of the approved two-entrance-merge concept, not approval of those coordinates or pads.

An `m05` candidate may exercise the same schema with one clockwise spiral route:

```text
(-2,3) → (35,3) → (35,22) → (4,22) → (4,13) → (25,13)
```

Its audited candidate length is 468,000 compiled distance units. Both the coordinates and length remain illustrative Candidate-BAL map authoring; they do not replace the approved Bronze Warden/clockwise-spiral product lock or pass map review without pads, proofs, exclusions, probes, and goldens.

### 14.2 Complete behavior example

An Oracle candidate may encode continuous `reveal` as `aura@1 / continuous-range-status` and a 1,000 ms targeted `mark` scan as `aura@1 / periodic-targeted-status`. The binding mark counts, amplification, ranges, and Level-3 every-fifth-scan mechanic remain locks where specified; scan cadence and ordinary mark duration remain Candidate-BAL until reviewed. No `reveal` or `mark` executable contract is added.

### 14.3 Enemy/wave example

A Scout candidate may completely declare HP 24, speed 11, armor 0, bounty 2, score 40, leak 1, threat 30, and regular control values. A wave group may reference that record with a count, route, first tick, interval, and `base-lineage` bounty policy. Those numeric values are examples, not binding enemy balance.

The Mission 1 values already locked by the campaign specification are not examples: Strategos start 150, envelopes `30/40/45/50/55/60`, gross 430, and the Wave-6 pre-spawn 60 with zero kill/clear Aether remain exact.

## 15. Acceptance criteria

The architecture is accepted only when tests prove all of the following:

### 15.1 Compatibility and strict parsing

- Existing schema-v1 fixture and schema-v2 foundation canonical compiled-content bytes remain byte-identical. A build supplied identical simulation bytes retains every artifact hash; an intentional default-simulation byte change creates the expected new simulation/manifest/ruleset identities while historical immutable artifacts remain valid.
- Valid schema-v3 sources compile twice to byte-identical artifacts.
- Unknown/missing key, duplicate decoded key/ID/source/realpath, bad UTF-8/BOM, unsafe/excess-precision number, bad hash, noncanonical reference, symlink/special file, limit overflow, and unsorted unordered set all fail with a stable path diagnostic.
- Candidate/approval or raw-source-provenance-only changes alter the generated manifest hash/release identity but not `rulesetHash` when normalized simulation values are unchanged; changing one simulation value changes both identities.

### 15.2 Shared lanes and maps

- Two logical routes reference one compiled physical trunk; geometry/render records contain it once while both route-local offset tables are exact.
- Undeclared overlap, duplicate physical sharing under another ID, illegal direction, disconnected route, stale/invalid join, join-neighborhood escape, crossing error, and unreachable gate fail.
- Route-local target remaining distance remains correct before, within, and after the shared trunk.
- A route-specific pad is graded only on its claims; zero exposure on a claimed route fails; high unclaimed exposure cannot rescue it.
- Selection order, Q bands, Act-I distribution, clearance, spacing, exclusions, and claimed/unclaimed report fields are deterministic.
- Schema-v1 `m01` normalization reproduces every existing binding map golden exactly.
- A schema-v1 map in a v3 mission requires its exact proof supplement; a schema-v2 map forbids one. Mission 1's supplement compiles into normalized role proofs without changing geometry, is present for post-clear Hoplite replays, and any proof-value change changes `rulesetHash`.

### 15.3 Role proofs and behaviors

- Every Hoplite-enabled pad has exactly three source and compiled markers with exact coordinates, tangents, route distances, range, spacing, ordering, and Node/browser parity.
- Shared-lane marker records produce distinct correct route-local distances without duplicating the physical marker.
- Simultaneous guard contacts, Resolve/occupied-control prefilter, multi-route ties, upgrade-added slots, and replenish events follow the declared comparator and never consume a guard on rejection.
- Support route/neighbor proofs match exact derived geometry. `line`, `mine`, `air`, unknown proof kind, and unknown proof version fail closed.
- Oracle reveal/mark records validate only as typed `aura@1` delivery, and the frozen ABI-v1 descriptor/contract hashes remain exact.
- Hoplite summon references resolve to one strict fixed-marker guard archetype; one accepted contact consumes it, and no renderer state can create, consume, move, or replenish it.
- Every defense has three complete levels, exact cumulative investment/refunds, valid policies/targets, bounded cooldown/effects, resolved event/string references, and no inherited/renderer fallback value.

### 15.4 Enemies, bosses, missions, and economy

- Every enemy/boss record is complete; tags/routes/resistance/shield/control/trait/lineage/event references resolve and resistance/control bounds hold.
- Echo cloak/reveal eligibility, Talos guarded thresholds/pods/exposed windows, child lineage, one-bounty rule, and transition/event order are replay deterministic.
- All groups are finite and ordered; named RNG is consumed only by explicitly interchangeable groups.
- Every wave envelope reconciles exactly; difficulty bounty remainder and fixed grants remain separate; final clear income is zero and final income is available pre-spawn.
- The exact binding Mission 1 economy and geometry locks cannot compile when changed under Candidate-BAL.
- Objectives are fixed before Start and derive from canonical state/events. Rewards resolve once, references/cycles are valid, and developer-slice bypass cannot mutate production prerequisites/profile state.
- A lethal mechanic before its declared harmless preview fails.

### 15.5 Events, strings, and delivery

- Every emitted event matches one payload schema and deterministic phase/order; unknown event/payload field fails.
- Every string key/placeholder resolves, numeric stat copy derives from compiled records, and localized-value changes affect only presentation/release identity.
- Every mission pack and semantic cue resolves through the hash-pinned Candidate-BAL procedural presentation catalog; schema-v1 presentation data contains no bitmap/atlas path and cannot be production-approved.
- The same pinned simulation and presentation artifacts boot under direct file and HTTP without runtime authoring-JSON fetch.
- Mixed ABI/simulation/content, mutable artifact path, missing simulation content, corrupt hash, or query-supplied manifest fails before play.
- A Candidate-BAL manifest cannot be selected by a production release descriptor, and production-art validation cannot accept a Candidate-BAL annex.

## 16. Product-decision status

No new product decision is required for this architecture. It preserves all approved mission identities, rewards, roles, weaknesses, target masks, costs, three-level mechanics, Mission 1 geometry/economy, deterministic rules, art gate, and offline/static delivery boundary.

Ryan is needed only if later evidence proposes changing one of those binding locks or another stop condition in the campaign specification. Ordinary schema implementation, candidate tuning inside declared Candidate-BAL scopes, deterministic route/pad authoring within the approved mission concepts, and test-driven defect correction do not require a phase-boundary question.
