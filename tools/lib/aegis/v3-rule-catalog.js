"use strict";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

const EVENT_SCHEMA_VERSION = 1;
const BEHAVIOR_REGISTRY_VERSION = 1;

// ABI-v1 authors milliseconds at 60 time-units per millisecond. At the frozen
// +1,500 bp external rate cap, 20 ms is the first base cooldown whose effective
// cooldown remains at least the ABI's 1,000-unit tick. An uncapped periodic
// timer needs 17 ms (1,020 units) to remain at least one tick on its own.
const ABI_V1_TIMER_MINIMA = {
  attackCooldownMsAtMaximumExternalRate: 20,
  uncappedPeriodicCadenceMs: 17,
};

const BEHAVIOR_CONTRACTS = [
  { id: "armorBreak", version: 1 },
  { id: "aura", version: 1 },
  { id: "block", version: 1 },
  { id: "bossScript", version: 1 },
  { id: "chain", version: 1 },
  { id: "direct", version: 1 },
  { id: "dot", version: 1 },
  { id: "execute", version: 1 },
  { id: "slow", version: 1 },
  { id: "spawnUnit", version: 1 },
  { id: "splash", version: 1 },
];

const BEHAVIOR_DELIVERIES = [
  {
    contractId: "aura",
    version: 1,
    deliveryKind: "continuous-range-status",
    parameterFields: [
      "statusId", "affectedSide", "targetKinds", "rangeSource", "eligibilityRuleId",
      "removalRuleId", "stackRuleId", "statusPayload", "applyEventId", "removeEventId",
    ],
  },
  {
    contractId: "aura",
    version: 1,
    deliveryKind: "periodic-targeted-status",
    parameterFields: [
      "statusId", "affectedSide", "targetKinds", "rangeSource", "cadenceMs", "initialReady",
      "maximumTargets", "durationMs", "targetPolicySource", "stackRuleId", "statusPayload",
      "scanCounter", "scanEventId", "applyEventId", "expireEventId",
    ],
  },
  {
    contractId: "block",
    version: 1,
    deliveryKind: "marker-contact-control",
    parameterFields: [
      "summonRecordId", "statusId", "durationMs", "contactDamage", "damageTypeId",
      "prefilterRuleId", "contactComparatorId", "resolveStatusId", "bash", "contactEventId",
      "rejectedEventId",
    ],
  },
  {
    contractId: "direct",
    version: 1,
    deliveryKind: "instant-primary-hit",
    parameterFields: [
      "cooldownMs", "baseDamage", "damageTypeId", "maximumTargets", "rangeSource",
      "targetPolicySource", "shieldCoefficientBp", "armorIgnoreBp", "bossCoefficientBp",
      "consecutiveHitCounter",
    ],
  },
  {
    contractId: "slow",
    version: 1,
    deliveryKind: "primary-status",
    parameterFields: [
      "triggerBehaviorId", "statusId", "magnitudeBp", "durationMs", "controlKind",
      "echoCounter",
    ],
  },
  {
    contractId: "spawnUnit",
    version: 1,
    deliveryKind: "guard-slots",
    parameterFields: [
      "summonRecordId", "activeSlotCount", "replenishMs", "initialReady",
      "projectionRangeSource", "markerProofKind", "markerProofVersion", "slotComparatorId",
      "maximumCreateEventsPerTick", "createEventId",
    ],
  },
  {
    contractId: "splash",
    version: 1,
    deliveryKind: "primary-centered-radius",
    parameterFields: [
      "cooldownMs", "baseDamage", "damageTypeId", "maximumPrimaryTargets", "rangeSource",
      "targetPolicySource", "radiusWorldUnits", "primaryFirst", "secondaryComparatorId",
      "centerBonus",
    ],
  },
];

const RULE_CATALOG = {
  comparatorIds: [
    "base-speed-desc",
    "guard-contact-v1",
    "hp-plus-shields-desc",
    "immutable-enemy-id-asc",
    "remaining-route-distance-asc",
    "secondary-route-front-v1",
    "threat-priority-desc",
  ],
  eligibilityRuleIds: [
    "collateral-cloak-eligible",
    "continuous-reveal-eligible",
    "direct-visible-or-exposed",
    "target-kind-and-state-eligible",
  ],
  removalRuleIds: [
    "counter-reset-on-gap-or-target-change",
    "counter-reset-on-wave-start",
    "source-out-of-range-or-removed",
  ],
  stackRuleIds: [
    "refresh-same-source",
    "strongest-magnitude-expiry-source",
  ],
  prefilterRuleIds: [
    "guard-ground-control-resolve-eligible",
  ],
  scoreFormulaIds: [
    "difficulty-before-unspent-cap",
    "eligible-unspent-excluding-assist-modifiers",
  ],
};

const TARGET_POLICY_RECORDS = {
  FAST: {
    id: "FAST",
    eligibilityRuleId: "target-kind-and-state-eligible",
    comparatorIds: [
      "base-speed-desc",
      "remaining-route-distance-asc",
      "immutable-enemy-id-asc",
    ],
  },
  FRONT: {
    id: "FRONT",
    eligibilityRuleId: "target-kind-and-state-eligible",
    comparatorIds: [
      "remaining-route-distance-asc",
      "threat-priority-desc",
      "immutable-enemy-id-asc",
    ],
  },
  STRONG: {
    id: "STRONG",
    eligibilityRuleId: "target-kind-and-state-eligible",
    comparatorIds: [
      "hp-plus-shields-desc",
      "remaining-route-distance-asc",
      "immutable-enemy-id-asc",
    ],
  },
};

const TYPED_STAT_FIELD_IDS = [
  "armor",
  "bounty-aether",
  "cadence-ms",
  "control-duration-ms",
  "damage",
  "hp",
  "leak-integrity",
  "range",
  "score",
  "shield",
  "slow-bp",
  "speed",
  "summon-slots",
];

const PRESENTATION_FALLBACK_STYLE_IDS = [
  "ancient-greece-ai-procedural",
];

const PHASE_IDS = [
  "commands",
  "scheduled-spawns",
  "status-expiry",
  "movement",
  "leaks",
  "tower-acquisition-and-attacks",
  "shield-damage-and-status",
  "guarded-boss-threshold-transition",
  "terminal-death-execute-children-and-revival",
  "bounty",
  "wave-clear",
];

const MISSION_CATALOG_IDS = Array.from({ length: 20 }, function (_, index) {
  return "m" + String(index + 1).padStart(2, "0");
});

const SLICE_IDS = {
  defenses: ["chronos", "hoplite", "oracle", "sentinel", "siege"],
  enemies: ["echo", "guardian", "raider", "scout", "titan"],
  bosses: ["talos-prototype"],
  missions: ["m01", "m04", "m05"],
};

module.exports = deepFreeze({
  EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION_SOURCE: "aegis-event-schema-v1",
  COMMAND_SCHEMA_VERSION_SOURCE: "abi-command-schema-v1",
  BEHAVIOR_REGISTRY_VERSION: BEHAVIOR_REGISTRY_VERSION,
  BEHAVIOR_REGISTRY_VERSION_SOURCE: "abi-behavior-registry-v1",
  ABI_V1_TIMER_MINIMA: ABI_V1_TIMER_MINIMA,
  BEHAVIOR_CONTRACTS: BEHAVIOR_CONTRACTS,
  BEHAVIOR_DELIVERIES: BEHAVIOR_DELIVERIES,
  RULE_CATALOG: RULE_CATALOG,
  TARGET_POLICY_RECORDS: TARGET_POLICY_RECORDS,
  TYPED_STAT_FIELD_IDS: TYPED_STAT_FIELD_IDS,
  PRESENTATION_FALLBACK_STYLE_IDS: PRESENTATION_FALLBACK_STYLE_IDS,
  PHASE_IDS: PHASE_IDS,
  MISSION_CATALOG_IDS: MISSION_CATALOG_IDS,
  SLICE_IDS: SLICE_IDS,
  TARGET_KINDS: ["air", "ground"],
  EVENT_PAYLOAD_TYPES: ["boolean", "id", "id-array", "integer", "string-key"],
  PLACEHOLDER_TYPES: ["id", "integer", "string", "string-key"],
});
