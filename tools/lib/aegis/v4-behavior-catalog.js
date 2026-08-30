"use strict";

/* Closed data-only catalog for compiled-content schema v4.
   Behavior-registry v2 retains every reviewed v1 contract/delivery byte-for-byte and adds
   version-2 deliveries whose parameter sets are closed records. Nothing here is executable
   content: every entry is a declarative field specification consumed by v4-record-contracts.js. */

const V3Catalog = require("./v3-rule-catalog.js");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

const EVENT_SCHEMA_VERSION = 2;
const BEHAVIOR_REGISTRY_VERSION = 2;
const COMMAND_SCHEMA_VERSION = 2;
const REPLAY_FORMAT_VERSION = 2;
const CONTENT_SCHEMA_VERSION = 4;
const PRESENTATION_SCHEMA_VERSION = 2;
const CAMPAIGN_RULES_SCHEMA_VERSION = 2;
const DEFENSE_SOURCE_SCHEMA_VERSION = 2;
const MISSION_SOURCE_SCHEMA_VERSION = 2;

/* ABI v1 phase identities remain the resolution order for every retained combat phase.
   ABI v2 adds the ten unlock-runtime phases from games/aegis/js/sim/abi-v2.js DESCRIPTOR. */
const ABI_V1_PHASE_IDS = V3Catalog.PHASE_IDS;
const ABI_V2_PHASE_IDS = [
  "commands-and-aether-payments",
  "expiry-and-enable-transitions",
  "scheduled-protocol-mechanism-resolutions-and-spawns",
  "spawn-movement-control-and-contact",
  "tower-and-reinforcement-acquisition-and-attacks",
  "persistent-zone-pulses-and-terminal-damage",
  "leak-arbitration-and-ward",
  "bounty-income-objectives-and-score-facts",
  "cooldown-and-effect-decrement",
  "guarded-boss-wave-mission-transition-and-event-finalization",
];
const PHASE_IDS = ABI_V1_PHASE_IDS.concat(ABI_V2_PHASE_IDS).slice().sort();

/* Authored v4 event records may declare a retained ABI-v1 phase name. Compiled v4 content is
   bound by an ABI-v2 kernel, whose phase table is the ten-entry v2 order, so the compiler
   translates each v1 phase to the v2 phase that now executes it. The mapping is total over
   ABI_V1_PHASE_IDS and is asserted as such by the compiler. */
const V1_TO_V2_PHASE_IDS = Object.freeze({
  "commands": "commands-and-aether-payments",
  "scheduled-spawns": "spawn-movement-control-and-contact",
  "status-expiry": "expiry-and-enable-transitions",
  "movement": "spawn-movement-control-and-contact",
  "leaks": "leak-arbitration-and-ward",
  "tower-acquisition-and-attacks": "tower-and-reinforcement-acquisition-and-attacks",
  "shield-damage-and-status": "persistent-zone-pulses-and-terminal-damage",
  "guarded-boss-threshold-transition": "persistent-zone-pulses-and-terminal-damage",
  "terminal-death-execute-children-and-revival": "persistent-zone-pulses-and-terminal-damage",
  "bounty": "bounty-income-objectives-and-score-facts",
  "wave-clear": "guarded-boss-wave-mission-transition-and-event-finalization",
});

const TARGET_SHAPE_IDS = ["none", "route-point", "tower", "world-vector"];
const COMBAT_SOURCE_KINDS = ["mechanism", "protocol", "tower", "unit"];
const REINFORCEMENT_MARKER_KINDS = [
  "reinforcement-guard", "reinforcement-heavy", "reinforcement-ranged",
];
const PROFILE_GRANT_KINDS = [
  "set-defense-slot-cap", "set-protocol-slot-cap", "set-recon-tier",
  "set-reinforcement-slot-cap", "set-relic-slot-cap", "unlock-campaign-action",
  "unlock-campaign-modifier", "unlock-defense", "unlock-mode", "unlock-protocol",
  "unlock-reinforcement", "unlock-relic", "unlock-specialization",
];

/* Mirrors games/aegis/js/sim/relics.js STAT_POLICIES exactly. content-v4-records.test.js
   asserts the parity so a runtime edit can never silently diverge from authored content. */
const RELIC_STAT_POLICIES = [
  { statId: "bounty", operation: "multiply-bp", rounding: "mission-remainder", baseAmount: 10000, minimum: 5000, maximum: 15000 },
  { statId: "build-cost", operation: "multiply-bp", rounding: "ceil", baseAmount: 10000, minimum: 7000, maximum: 14000 },
  { statId: "protocol-cost", operation: "multiply-bp", rounding: "ceil", baseAmount: 10000, minimum: 7000, maximum: 14000 },
  { statId: "specialization-cost", operation: "multiply-bp", rounding: "ceil", baseAmount: 10000, minimum: 7000, maximum: 14000 },
  { statId: "starting-aether", operation: "add", rounding: "none", baseAmount: 0, minimum: null, maximum: null },
  { statId: "starting-integrity", operation: "add", rounding: "none", baseAmount: 0, minimum: null, maximum: null },
  { statId: "tower-control-duration", operation: "multiply-bp", rounding: "floor", baseAmount: 10000, minimum: 5000, maximum: 14000 },
  { statId: "tower-control-magnitude", operation: "multiply-bp", rounding: "floor", baseAmount: 10000, minimum: 5000, maximum: 14000 },
  { statId: "tower-direct-damage", operation: "multiply-bp", rounding: "floor", baseAmount: 10000, minimum: 7000, maximum: 14000 },
  { statId: "tower-displacement", operation: "multiply-bp", rounding: "floor", baseAmount: 10000, minimum: 5000, maximum: 14000 },
  { statId: "tower-dot-damage", operation: "multiply-bp", rounding: "floor", baseAmount: 10000, minimum: 7000, maximum: 14000 },
  { statId: "tower-range", operation: "add-bp", rounding: "floor", baseAmount: 0, minimum: -2500, maximum: 2500 },
  { statId: "tower-rate", operation: "add-bp", rounding: "floor", baseAmount: 0, minimum: -3000, maximum: 4000 },
  { statId: "upgrade-cost", operation: "multiply-bp", rounding: "ceil", baseAmount: 10000, minimum: 7000, maximum: 14000 },
];

const DEFENSE_COSTS = {
  apollo: [120, 110, 175],
  artemis: [110, 100, 155],
  athena: [90, 95, 155],
  chronos: [75, 70, 115],
  hades: [120, 110, 175],
  hephaestus: [110, 105, 165],
  hermes: [85, 80, 130],
  hoplite: [80, 75, 120],
  medusa: [95, 90, 145],
  oracle: [70, 70, 110],
  poseidon: [100, 95, 150],
  sentinel: [60, 55, 95],
  siege: [90, 85, 140],
  talos: [130, 120, 190],
  zeus: [125, 115, 185],
};
const DEFENSE_IDS = Object.keys(DEFENSE_COSTS).sort();
/* Families whose Level-1/Level-2 records are copied verbatim from the reviewed
   schema-v3 slice source and therefore keep their behavior version 1. */
const RETAINED_DEFENSE_IDS = ["chronos", "hoplite", "oracle", "sentinel", "siege"];

const STATUS_IDS = [
  "armorBreak", "block", "burn", "drench", "exposed", "link", "mark", "petrify",
  "resolve", "reveal", "reviveSuppressed", "shield", "slow", "stun",
];
const DAMAGE_TYPE_IDS = ["arcane", "kinetic", "solar", "storm", "temporal", "thermal", "void"];

const TYPED_STAT_FIELD_IDS = V3Catalog.TYPED_STAT_FIELD_IDS;
const TARGET_KINDS = V3Catalog.TARGET_KINDS;
const RULE_CATALOG = V3Catalog.RULE_CATALOG;
const TARGET_POLICY_RECORDS = V3Catalog.TARGET_POLICY_RECORDS;
const ABI_V1_TIMER_MINIMA = V3Catalog.ABI_V1_TIMER_MINIMA;
const PRESENTATION_FALLBACK_STYLE_IDS = V3Catalog.PRESENTATION_FALLBACK_STYLE_IDS;
const MISSION_CATALOG_IDS = V3Catalog.MISSION_CATALOG_IDS;

/* Canonical roster order: ascending contract id, then version. The runtime authority in
   games/aegis/js/sim/abi-v2.js and every authored behavior-contracts.json declare a
   byte-equal copy, and the kernel authenticates compiled content against the runtime. */
const BEHAVIOR_CONTRACTS = [
  { id: "armorBreak", version: 1 },
  { id: "armorBreak", version: 2 },
  { id: "aura", version: 1 },
  { id: "aura", version: 2 },
  { id: "beam", version: 2 },
  { id: "block", version: 1 },
  { id: "block", version: 2 },
  { id: "bossScript", version: 1 },
  { id: "chain", version: 1 },
  { id: "chain", version: 2 },
  { id: "control", version: 2 },
  { id: "direct", version: 1 },
  { id: "direct", version: 2 },
  { id: "dot", version: 1 },
  { id: "drone", version: 2 },
  { id: "execute", version: 1 },
  { id: "execute", version: 2 },
  { id: "link", version: 2 },
  { id: "mine", version: 2 },
  { id: "slow", version: 1 },
  { id: "slow", version: 2 },
  { id: "spawnUnit", version: 1 },
  { id: "spawnUnit", version: 2 },
  { id: "splash", version: 1 },
  { id: "splash", version: 2 },
];

/* ---- closed parameter-specification vocabulary -------------------------------------- */

function int(minimum, maximum) { return { t: "int", min: minimum, max: maximum }; }
function timer(minimum) { return { t: "timer", min: minimum }; }
function dec(positive) { return { t: "dec", positive: positive === true }; }
function bp(minimum, maximum) { return { t: "int", min: minimum, max: maximum }; }
function bool() { return { t: "bool" }; }
function id() { return { t: "id" }; }
function konst(value) { return { t: "const", value: value }; }
function cat(name) { return { t: "cat", catalog: name }; }
function statusRef() { return { t: "status" }; }
function damageRef() { return { t: "damageType" }; }
function rangeSource() { return { t: "rangeSource" }; }
function policySource() { return { t: "policySource" }; }
function targetKinds() { return { t: "targetKinds" }; }
function event(phase) { return { t: "event", phase: phase }; }
function bpArray(minimum, maximum, minLength, maxLength) {
  return { t: "bpArray", min: minimum, max: maximum, minLength: minLength, maxLength: maxLength };
}
function record(fields) { return { t: "record", fields: fields, nullable: false }; }
function optional(fields) { return { t: "record", fields: fields, nullable: true }; }

const ATTACK_MINIMUM = ABI_V1_TIMER_MINIMA.attackCooldownMsAtMaximumExternalRate;
const PERIODIC_MINIMUM = ABI_V1_TIMER_MINIMA.uncappedPeriodicCadenceMs;
const DAMAGE_PHASE = "shield-damage-and-status";
const MOVEMENT_PHASE = "movement";
const SPAWN_PHASE = "scheduled-spawns";
const ATTACK_PHASE = "tower-acquisition-and-attacks";
const EXPIRY_PHASE = "status-expiry";
const TERMINAL_PHASE = "terminal-death-execute-children-and-revival";
const BOUNTY_PHASE = "bounty";

const CONSECUTIVE_HIT_COUNTER = optional({
  kind: konst("same-target-accepted-hits"),
  requiredAcceptedHits: int(1, 1000),
  bonusDamageBp: bp(1, 10000),
  bonusAppliesToThresholdHit: bool(),
  resetOnTargetChange: bool(),
  resetAfterNoTargetMs: int(1, 86400000),
  emptyActivationAdvances: bool(),
  secondaryEffectsAdvance: bool(),
  semanticEventId: event(DAMAGE_PHASE),
});

const CRIT_COUNTER = optional({
  kind: konst("every-n-accepted-primary-attacks"),
  requiredAttacks: int(2, 1000),
  damageBp: bp(10000, 30000),
  appliesToSecondaryTargets: bool(),
  emptyActivationAdvances: bool(),
  resetRuleId: cat("removalRuleIds"),
  recursive: bool(),
  semanticEventId: event(DAMAGE_PHASE),
});

const COLLATERAL = optional({
  kind: konst("nearest-additional-target"),
  maximumTargets: int(1, 8),
  radiusWorldUnits: dec(true),
  damageBp: bp(1, 10000),
  advancesInternalCounters: bool(),
  inheritsInternalCoefficients: bool(),
  comparatorId: cat("comparatorIds"),
  eligibilityRuleId: cat("eligibilityRuleIds"),
  semanticEventId: event(DAMAGE_PHASE),
});

const PIERCE = optional({
  kind: konst("aligned-pierce-chain"),
  maximumAdditionalTargets: int(1, 8),
  falloffBp: bpArray(1, 10000, 1, 8),
  inheritsInternalCoefficients: bool(),
  comparatorId: cat("comparatorIds"),
  eligibilityRuleId: cat("eligibilityRuleIds"),
  semanticEventId: event(DAMAGE_PHASE),
});

const STACK_CONSUMPTION = optional({
  kind: konst("consume-source-stacks-on-consecutive-hit"),
  requiredAcceptedHits: int(2, 1000),
  damage: dec(true),
  damageTypeId: damageRef(),
  consumedStatusId: statusRef(),
  emptyActivationAdvances: bool(),
  resetOnTargetChange: bool(),
  resetRuleId: cat("removalRuleIds"),
  semanticEventId: event(DAMAGE_PHASE),
});

const BURST_ON_COUNT = optional({
  kind: konst("every-n-accepted-primary-attacks"),
  requiredAttacks: int(2, 1000),
  damage: dec(true),
  damageTypeId: damageRef(),
  radiusWorldUnits: dec(true),
  maximumTargets: int(1, 32),
  comparatorId: cat("comparatorIds"),
  emptyActivationAdvances: bool(),
  recursive: bool(),
  resetRuleId: cat("removalRuleIds"),
  semanticEventId: event(DAMAGE_PHASE),
});

const STORM_COUNTER = optional({
  kind: konst("every-n-accepted-primary-attacks"),
  requiredAttacks: int(2, 1000),
  maximumTargets: int(1, 32),
  damageBp: bp(1, 10000),
  jumpRangeWorldUnits: dec(true),
  comparatorId: cat("comparatorIds"),
  emptyActivationAdvances: bool(),
  recursive: bool(),
  resetRuleId: cat("removalRuleIds"),
  semanticEventId: event(DAMAGE_PHASE),
});

const CENTER_BONUS = optional({
  kind: konst("central-radius-bonus"),
  radiusWorldUnits: dec(true),
  bonusDamageBp: bp(1, 10000),
  semanticEventId: event(DAMAGE_PHASE),
});

const ECHO_COUNTER = optional({
  kind: konst("every-n-accepted-primary-hits"),
  requiredAcceptedHits: int(1, 1000),
  maximumSecondaryTargets: int(1, 32),
  radiusWorldUnits: dec(true),
  magnitudeBp: bp(1, 10000),
  durationMs: int(1, 86400000),
  comparatorId: cat("comparatorIds"),
  emptyActivationAdvances: bool(),
  recursive: bool(),
  resetRuleId: cat("removalRuleIds"),
  semanticEventId: event(DAMAGE_PHASE),
});

const BASH = optional({
  kind: konst("first-eligible-contact-per-summon"),
  damage: dec(true),
  damageTypeId: damageRef(),
  statusId: statusRef(),
  durationMs: int(1, 86400000),
  hardControlBucketId: id(),
  semanticEventId: event(MOVEMENT_PHASE),
});

const SCAN_COUNTER = optional({
  kind: konst("every-n-scans"),
  requiredScans: int(1, 1000),
  emptyScanAdvances: bool(),
  maximumTargets: int(1, 1000),
  durationMs: int(1, 86400000),
  targetPolicySource: policySource(),
  resetRuleId: cat("removalRuleIds"),
  recursive: bool(),
  semanticEventId: event(DAMAGE_PHASE),
});

const DIRECT_V2_FIELDS = {
  cooldownMs: timer(ATTACK_MINIMUM),
  baseDamage: dec(true),
  damageTypeId: damageRef(),
  maximumTargets: int(1, 1000),
  rangeSource: rangeSource(),
  targetPolicySource: policySource(),
  shieldCoefficientBp: bp(0, 20000),
  armorIgnoreBp: bp(0, 10000),
  bossCoefficientBp: bp(0, 20000),
  airCoefficientBp: bp(0, 20000),
  consecutiveHitCounter: CONSECUTIVE_HIT_COUNTER,
  critCounter: CRIT_COUNTER,
  collateral: COLLATERAL,
  pierce: PIERCE,
  stackConsumption: STACK_CONSUMPTION,
};

const SPLASH_V2_FIELDS = {
  cooldownMs: timer(ATTACK_MINIMUM),
  baseDamage: dec(true),
  damageTypeId: damageRef(),
  maximumPrimaryTargets: int(1, 1000),
  maximumSecondaryTargets: { t: "nullableInt", min: 1, max: 1000 },
  rangeSource: rangeSource(),
  targetPolicySource: policySource(),
  radiusWorldUnits: dec(true),
  primaryFirst: bool(),
  secondaryComparatorId: cat("comparatorIds"),
  shieldCoefficientBp: bp(0, 20000),
  armorIgnoreBp: bp(0, 10000),
  bossCoefficientBp: bp(0, 20000),
  centerBonus: CENTER_BONUS,
};

const SLOW_V2_FIELDS = {
  triggerBehaviorId: id(),
  statusId: statusRef(),
  magnitudeBp: bp(1, 10000),
  durationMs: int(1, 86400000),
  controlKind: { t: "enum", values: ["drench", "slow"] },
  echoCounter: ECHO_COUNTER,
};

const CHAIN_ORDERED_FIELDS = {
  cooldownMs: timer(ATTACK_MINIMUM),
  baseDamage: dec(true),
  damageTypeId: damageRef(),
  falloffBp: bpArray(1, 10000, 1, 16),
  rangeSource: rangeSource(),
  targetPolicySource: policySource(),
  jumpRangeWorldUnits: dec(true),
  comparatorId: cat("comparatorIds"),
  shieldCoefficientBp: bp(0, 20000),
  armorIgnoreBp: bp(0, 10000),
  bossCoefficientBp: bp(0, 20000),
  airCoefficientBp: bp(0, 20000),
  stormCounter: STORM_COUNTER,
  burstOnCount: BURST_ON_COUNT,
  semanticEventId: event(DAMAGE_PHASE),
};

const CHAIN_LINE_FIELDS = {
  cooldownMs: timer(ATTACK_MINIMUM),
  baseDamage: dec(true),
  damageTypeId: damageRef(),
  maximumTargets: int(1, 32),
  rangeSource: rangeSource(),
  targetPolicySource: policySource(),
  lineWidthWorldUnits: dec(true),
  comparatorId: cat("comparatorIds"),
  displacementWorldUnits: dec(true),
  displacementCooldownMs: int(1, 86400000),
  shieldCoefficientBp: bp(0, 20000),
  armorIgnoreBp: bp(0, 10000),
  bossCoefficientBp: bp(0, 20000),
  burstOnCount: BURST_ON_COUNT,
  semanticEventId: event(DAMAGE_PHASE),
};

const BEAM_FIELDS = {
  pulseIntervalMs: timer(PERIODIC_MINIMUM),
  startDamage: dec(true),
  incrementDamage: dec(true),
  peakDamage: dec(true),
  damageTypeId: damageRef(),
  rangeSource: rangeSource(),
  targetPolicySource: policySource(),
  shieldCoefficientBp: bp(0, 30000),
  armorIgnoreBp: bp(0, 10000),
  bossCoefficientBp: bp(0, 20000),
  resetRuleId: cat("removalRuleIds"),
  resetAfterNoTargetMs: int(1, 86400000),
  fork: optional({
    kind: konst("secondary-fork"),
    maximumTargets: int(1, 8),
    damageBp: bp(1, 10000),
    shieldedTargetDamageBp: bp(1, 10000),
    comparatorId: cat("comparatorIds"),
    eligibilityRuleId: cat("eligibilityRuleIds"),
    recursive: bool(),
    semanticEventId: event(DAMAGE_PHASE),
  }),
  pulseEventId: event(DAMAGE_PHASE),
};

const CONTROL_FIELDS = {
  triggerBehaviorId: id(),
  statusId: statusRef(),
  requiredAttacks: int(1, 1000),
  primaryDurationMs: int(1, 86400000),
  emptyActivationAdvances: bool(),
  resetRuleId: cat("removalRuleIds"),
  resolveStatusId: statusRef(),
  hardControlBucketId: id(),
  secondary: optional({
    kind: konst("radius-secondary-control"),
    radiusWorldUnits: dec(true),
    durationMs: int(1, 86400000),
    maximumTargets: int(1, 32),
    comparatorId: cat("comparatorIds"),
    recursive: bool(),
  }),
  applyEventId: event(DAMAGE_PHASE),
  rejectedEventId: event(DAMAGE_PHASE),
};

const EXECUTE_FIELDS = {
  triggerBehaviorId: id(),
  thresholdBp: bp(1, 5000),
  bossEligible: bool(),
  reviveSuppressedStatusId: statusRef(),
  banish: optional({
    kind: konst("every-n-executes"),
    requiredExecutes: int(1, 1000),
    cooldownMs: int(1, 86400000),
    maximumTargets: int(1, 8),
    maximumTargetHpBp: bp(1, 10000),
    comparatorId: cat("comparatorIds"),
    bossEligible: bool(),
    recursive: bool(),
    semanticEventId: event(TERMINAL_PHASE),
  }),
  income: optional({
    kind: konst("per-execute-aether"),
    aetherPerExecute: int(1, 1000),
    maximumPerWave: int(1, 1000),
    ledgerId: konst("specializationAetherEarned"),
    excludeFromUnspentScore: bool(),
    resetRuleId: cat("removalRuleIds"),
    semanticEventId: event(BOUNTY_PHASE),
  }),
  semanticEventId: event(TERMINAL_PHASE),
};

const ARMOR_BREAK_FIELDS = {
  triggerBehaviorId: id(),
  statusId: statusRef(),
  amount: int(1, 100),
  durationMs: int(1, 86400000),
  stackRuleId: cat("stackRuleIds"),
  applyEventId: event(DAMAGE_PHASE),
};

const DRONE_FIELDS = {
  summonRecordId: id(),
  activeSlotCount: int(1, 4),
  replenishMs: int(1, 86400000),
  initialReady: bool(),
  projectionRangeSource: rangeSource(),
  patrolRadiusWorldUnits: dec(true),
  travelSpeedWorldUnitsPerSecond: dec(true),
  slotPolicyId: { t: "enum", values: ["patrol-slot-index-then-drone-id"] },
  maximumCreateEventsPerTick: int(1, 32000),
  attack: record({
    cooldownMs: timer(ATTACK_MINIMUM),
    baseDamage: dec(true),
    damageTypeId: damageRef(),
    targetKinds: targetKinds(),
    airPriority: bool(),
    airCoefficientBp: bp(0, 20000),
    shieldCoefficientBp: bp(0, 20000),
    armorIgnoreBp: bp(0, 10000),
    bossCoefficientBp: bp(0, 20000),
    targetPolicySource: policySource(),
    bonusShotCounter: optional({
      kind: konst("every-n-drone-attacks"),
      requiredAttacks: int(2, 1000),
      bonusShots: int(1, 4),
      emptyActivationAdvances: bool(),
      recursive: bool(),
      resetRuleId: cat("removalRuleIds"),
      semanticEventId: event(DAMAGE_PHASE),
    }),
    attackEventId: event(DAMAGE_PHASE),
  }),
  createEventId: event(SPAWN_PHASE),
};

const MINE_FIELDS = {
  summonRecordId: id(),
  activeSlotCount: int(1, 4),
  replenishMs: int(1, 86400000),
  initialReady: bool(),
  projectionRangeSource: rangeSource(),
  armingRadiusWorldUnits: dec(true),
  blastDamage: dec(true),
  blastRadiusWorldUnits: dec(true),
  damageTypeId: damageRef(),
  slotPolicyId: { t: "enum", values: ["arming-marker-order-then-mine-id"] },
  maximumCreateEventsPerTick: int(1, 32000),
  burn: record({
    statusId: statusRef(),
    damagePerSecond: dec(true),
    durationMs: int(1, 86400000),
    stackRuleId: cat("stackRuleIds"),
    semanticEventId: event(DAMAGE_PHASE),
  }),
  persistentField: optional({
    kind: konst("anti-regeneration-field"),
    statusId: statusRef(),
    durationMs: int(1, 86400000),
    radiusWorldUnits: dec(true),
    semanticEventId: event(DAMAGE_PHASE),
  }),
  createEventId: event(SPAWN_PHASE),
  detonateEventId: event(DAMAGE_PHASE),
};

const LINK_FIELDS = {
  statusId: statusRef(),
  affectedSide: konst("friendly"),
  maximumLinks: int(1, 8),
  rangeSource: rangeSource(),
  rangeBp: bp(0, 1200),
  rateBp: bp(0, 1500),
  selectionPolicyId: { t: "enum", values: ["nearest-eligible-then-tower-id"] },
  eligibilityRuleId: cat("eligibilityRuleIds"),
  removalRuleId: cat("removalRuleIds"),
  stackRuleId: cat("stackRuleIds"),
  sourceTypeId: id(),
  coordinatedFire: optional({
    kind: konst("shared-target-damage-bonus"),
    requiredSharedLinks: int(2, 8),
    damageBp: bp(1, 2000),
    semanticEventId: event(DAMAGE_PHASE),
  }),
  applyEventId: event(DAMAGE_PHASE),
  removeEventId: event(EXPIRY_PHASE),
};

const AURA_CONTINUOUS_V2_FIELDS = {
  statusId: statusRef(),
  affectedSide: { t: "enum", values: ["enemy", "friendly"] },
  targetKinds: targetKinds(),
  rangeSource: rangeSource(),
  eligibilityRuleId: cat("eligibilityRuleIds"),
  removalRuleId: cat("removalRuleIds"),
  stackRuleId: cat("stackRuleIds"),
  statusPayload: record({
    kind: konst("acquisition-reveal"),
    collateralEligibilityRuleId: cat("eligibilityRuleIds"),
  }),
  applyEventId: event(DAMAGE_PHASE),
  removeEventId: event(EXPIRY_PHASE),
};

const AURA_PERIODIC_V2_FIELDS = {
  statusId: statusRef(),
  affectedSide: { t: "enum", values: ["enemy", "friendly"] },
  targetKinds: targetKinds(),
  rangeSource: rangeSource(),
  cadenceMs: timer(PERIODIC_MINIMUM),
  initialReady: bool(),
  maximumTargets: int(1, 1000),
  durationMs: int(1, 86400000),
  targetPolicySource: policySource(),
  stackRuleId: cat("stackRuleIds"),
  statusPayload: record({
    kind: konst("external-damage-amplification"),
    amountBp: bp(1, 2000),
    sourceTypeId: id(),
  }),
  scanCounter: SCAN_COUNTER,
  scanEventId: event(ATTACK_PHASE),
  applyEventId: event(DAMAGE_PHASE),
  expireEventId: event(EXPIRY_PHASE),
};

const SPAWN_UNIT_V2_FIELDS = {
  summonRecordId: id(),
  activeSlotCount: int(1, 4),
  replenishMs: int(1, 86400000),
  initialReady: bool(),
  projectionRangeSource: rangeSource(),
  markerProofKind: konst("guard"),
  markerProofVersion: konst(1),
  slotComparatorId: cat("comparatorIds"),
  maximumCreateEventsPerTick: int(1, 32000),
  createEventId: event(SPAWN_PHASE),
};

const BLOCK_V2_FIELDS = {
  summonRecordId: id(),
  statusId: statusRef(),
  durationMs: int(1, 86400000),
  contactDamage: dec(false),
  damageTypeId: damageRef(),
  prefilterRuleId: cat("prefilterRuleIds"),
  contactComparatorId: cat("comparatorIds"),
  resolveStatusId: statusRef(),
  bash: BASH,
  contactEventId: event(MOVEMENT_PHASE),
  rejectedEventId: event(MOVEMENT_PHASE),
};

/* Version-1 deliveries are declared with the identical field order used by
   tools/lib/aegis/v3-rule-catalog.js so a verbatim record still validates. */
const V1_DELIVERY_SPECS = {
  "aura@1/continuous-range-status": AURA_CONTINUOUS_V2_FIELDS,
  "aura@1/periodic-targeted-status": AURA_PERIODIC_V2_FIELDS,
  "block@1/marker-contact-control": {
    summonRecordId: id(),
    statusId: statusRef(),
    durationMs: int(1, 86400000),
    contactDamage: dec(false),
    damageTypeId: damageRef(),
    prefilterRuleId: cat("prefilterRuleIds"),
    contactComparatorId: cat("comparatorIds"),
    resolveStatusId: statusRef(),
    bash: BASH,
    contactEventId: event(MOVEMENT_PHASE),
    rejectedEventId: event(MOVEMENT_PHASE),
  },
  "direct@1/instant-primary-hit": {
    cooldownMs: timer(ATTACK_MINIMUM),
    baseDamage: dec(true),
    damageTypeId: damageRef(),
    maximumTargets: int(1, 1000),
    rangeSource: rangeSource(),
    targetPolicySource: policySource(),
    shieldCoefficientBp: bp(0, 20000),
    armorIgnoreBp: bp(0, 10000),
    bossCoefficientBp: bp(0, 20000),
    consecutiveHitCounter: CONSECUTIVE_HIT_COUNTER,
  },
  "slow@1/primary-status": {
    triggerBehaviorId: id(),
    statusId: statusRef(),
    magnitudeBp: bp(1, 10000),
    durationMs: int(1, 86400000),
    controlKind: konst("slow"),
    echoCounter: ECHO_COUNTER,
  },
  "spawnUnit@1/guard-slots": SPAWN_UNIT_V2_FIELDS,
  "splash@1/primary-centered-radius": {
    cooldownMs: timer(ATTACK_MINIMUM),
    baseDamage: dec(true),
    damageTypeId: damageRef(),
    maximumPrimaryTargets: int(1, 1000),
    rangeSource: rangeSource(),
    targetPolicySource: policySource(),
    radiusWorldUnits: dec(true),
    primaryFirst: bool(),
    secondaryComparatorId: cat("comparatorIds"),
    centerBonus: CENTER_BONUS,
  },
};

const V2_DELIVERY_SPECS = {
  "armorBreak@2/status-application": ARMOR_BREAK_FIELDS,
  "aura@2/continuous-range-status": AURA_CONTINUOUS_V2_FIELDS,
  "aura@2/periodic-targeted-status": AURA_PERIODIC_V2_FIELDS,
  "beam@2/ramping-pulse": BEAM_FIELDS,
  "block@2/marker-contact-control": BLOCK_V2_FIELDS,
  "chain@2/line-multi-target": CHAIN_LINE_FIELDS,
  "chain@2/ordered-falloff-targets": CHAIN_ORDERED_FIELDS,
  "control@2/counted-hard-control": CONTROL_FIELDS,
  "direct@2/instant-primary-hit": DIRECT_V2_FIELDS,
  "drone@2/patrol-slots": DRONE_FIELDS,
  "execute@2/threshold-terminal": EXECUTE_FIELDS,
  "link@2/friendly-link-amplification": LINK_FIELDS,
  "mine@2/proximity-slots": MINE_FIELDS,
  "slow@2/primary-status": SLOW_V2_FIELDS,
  "spawnUnit@2/guard-slots": SPAWN_UNIT_V2_FIELDS,
  "splash@2/primary-centered-radius": SPLASH_V2_FIELDS,
};

const DELIVERY_SPECS = Object.assign({}, V1_DELIVERY_SPECS, V2_DELIVERY_SPECS);
const DELIVERY_KEYS = Object.keys(DELIVERY_SPECS).sort();

/* Summon kinds a v4 defense may declare. Guard summons keep the reviewed v3 contract. */
const SUMMON_KINDS = ["fixed-marker-guard", "patrol-drone", "proximity-mine"];

module.exports = deepFreeze({
  ABI_V1_PHASE_IDS: ABI_V1_PHASE_IDS,
  ABI_V1_TIMER_MINIMA: ABI_V1_TIMER_MINIMA,
  ABI_V2_PHASE_IDS: ABI_V2_PHASE_IDS,
  V1_TO_V2_PHASE_IDS: V1_TO_V2_PHASE_IDS,
  BEHAVIOR_CONTRACTS: BEHAVIOR_CONTRACTS,
  BEHAVIOR_REGISTRY_VERSION: BEHAVIOR_REGISTRY_VERSION,
  CAMPAIGN_RULES_SCHEMA_VERSION: CAMPAIGN_RULES_SCHEMA_VERSION,
  COMBAT_SOURCE_KINDS: COMBAT_SOURCE_KINDS,
  COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
  CONTENT_SCHEMA_VERSION: CONTENT_SCHEMA_VERSION,
  DAMAGE_TYPE_IDS: DAMAGE_TYPE_IDS,
  DEFENSE_COSTS: DEFENSE_COSTS,
  DEFENSE_IDS: DEFENSE_IDS,
  DEFENSE_SOURCE_SCHEMA_VERSION: DEFENSE_SOURCE_SCHEMA_VERSION,
  DELIVERY_KEYS: DELIVERY_KEYS,
  DELIVERY_SPECS: DELIVERY_SPECS,
  EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
  MISSION_CATALOG_IDS: MISSION_CATALOG_IDS,
  MISSION_SOURCE_SCHEMA_VERSION: MISSION_SOURCE_SCHEMA_VERSION,
  PHASE_IDS: PHASE_IDS,
  PRESENTATION_FALLBACK_STYLE_IDS: PRESENTATION_FALLBACK_STYLE_IDS,
  PRESENTATION_SCHEMA_VERSION: PRESENTATION_SCHEMA_VERSION,
  PROFILE_GRANT_KINDS: PROFILE_GRANT_KINDS,
  REINFORCEMENT_MARKER_KINDS: REINFORCEMENT_MARKER_KINDS,
  RELIC_STAT_POLICIES: RELIC_STAT_POLICIES,
  REPLAY_FORMAT_VERSION: REPLAY_FORMAT_VERSION,
  RETAINED_DEFENSE_IDS: RETAINED_DEFENSE_IDS,
  RULE_CATALOG: RULE_CATALOG,
  STATUS_IDS: STATUS_IDS,
  SUMMON_KINDS: SUMMON_KINDS,
  TARGET_KINDS: TARGET_KINDS,
  TARGET_POLICY_RECORDS: TARGET_POLICY_RECORDS,
  TARGET_SHAPE_IDS: TARGET_SHAPE_IDS,
  TYPED_STAT_FIELD_IDS: TYPED_STAT_FIELD_IDS,
});
