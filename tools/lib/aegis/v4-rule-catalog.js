"use strict";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function tier(tierNumber, baseCostAether, cooldownMs, maximumAcceptedCasts, effect, eventIds) {
  const laurel = PROTOCOL_TIER_COSTS[tierNumber - 1];
  return {
    tier: tierNumber,
    incrementalLaurels: laurel.incrementalLaurels,
    cumulativeLaurels: laurel.cumulativeLaurels,
    baseCostAether: baseCostAether,
    cooldownMs: cooldownMs,
    sharedCooldownMs: 15000,
    maximumAcceptedCasts: maximumAcceptedCasts,
    effect: effect,
    eventIds: eventIds,
  };
}

function protocol(id, targetKind, castPolicyId, tiers) {
  return {
    id: id,
    nameKey: "protocol." + id + ".name",
    unlockGrantId: "grant.protocol." + id,
    castPolicyId: castPolicyId,
    targetKind: targetKind,
    tiers: tiers,
    eventIds: ["protocol." + id + ".accepted", "protocol." + id + ".resolved"],
  };
}

const CONTENT_SCHEMA_VERSION = 4;
const EVENT_SCHEMA_VERSION = 2;
const BEHAVIOR_REGISTRY_VERSION = 2;
const COMMAND_SCHEMA_VERSION = 2;
const REPLAY_FORMAT_VERSION = 2;
const PROFILE_SCHEMA_VERSION = 2;
const PRESENTATION_SCHEMA_VERSION = 2;

const PROTOCOL_TIER_COSTS = [
  { tier: 1, incrementalLaurels: 0, cumulativeLaurels: 0 },
  { tier: 2, incrementalLaurels: 6, cumulativeLaurels: 6 },
  { tier: 3, incrementalLaurels: 12, cumulativeLaurels: 18 },
];

const DEFENSE_LEVEL3_COSTS = {
  apollo: 175,
  artemis: 155,
  athena: 155,
  chronos: 115,
  hades: 175,
  hephaestus: 165,
  hermes: 130,
  hoplite: 120,
  medusa: 145,
  oracle: 110,
  poseidon: 150,
  sentinel: 95,
  siege: 140,
  talos: 190,
  zeus: 185,
};

const SPECIALIZATION_DEFINITIONS = [
  ["apollo-forked-ray", "apollo", true, "forked-ray"],
  ["apollo-solar-lance", "apollo", false, "solar-lance"],
  ["artemis-execution-line", "artemis", true, "execution-line"],
  ["artemis-threader", "artemis", false, "threader"],
  ["athena-command-mesh", "athena", false, "command-mesh"],
  ["athena-coordinated-fire", "athena", true, "coordinated-fire"],
  ["chronos-echo-field", "chronos", true, "echo-field"],
  ["chronos-time-debt", "chronos", false, "time-debt"],
  ["hades-soul-tithe", "hades", false, "soul-tithe"],
  ["hades-twin-banish", "hades", true, "twin-banish"],
  ["hephaestus-molten-field", "hephaestus", true, "molten-field"],
  ["hephaestus-triple-foundry", "hephaestus", false, "triple-foundry"],
  ["hermes-sky-swarm", "hermes", false, "sky-swarm"],
  ["hermes-wing-command", "hermes", true, "wing-command"],
  ["hoplite-phalanx", "hoplite", true, "phalanx"],
  ["hoplite-spearwall", "hoplite", false, "spearwall"],
  ["medusa-basilisk-focus", "medusa", false, "basilisk-focus"],
  ["medusa-gorgon-bloom", "medusa", true, "gorgon-bloom"],
  ["oracle-chorus", "oracle", true, "chorus"],
  ["oracle-judgment", "oracle", false, "judgment"],
  ["poseidon-maelstrom", "poseidon", true, "maelstrom"],
  ["poseidon-undertow", "poseidon", false, "undertow"],
  ["sentinel-lock-on", "sentinel", true, "lock-on"],
  ["sentinel-twin-lance", "sentinel", false, "twin-lance"],
  ["siege-breach-core", "siege", true, "breach-core"],
  ["siege-sun-shrapnel", "siege", false, "sun-shrapnel"],
  ["talos-earthbreaker", "talos", false, "earthbreaker"],
  ["talos-titan-hunter", "talos", true, "titan-hunter"],
  ["zeus-storm-crown", "zeus", true, "storm-crown"],
  ["zeus-thunderhead", "zeus", false, "thunderhead"],
];

const PROTOCOL_RECORDS = [
  protocol("aegis-ward", "none", "repeat-surcharge", [
    tier(1, 70, 85000, 32, {
      kind: "leak-ward", durationMs: 12000, charges: 1, maximumPreventedIntegrityPerLeak: 2,
      carryAcrossWave: false,
    }, ["protocol.aegis-ward.accepted", "protocol.aegis-ward.resolved"]),
    tier(2, 105, 100000, 32, {
      kind: "leak-ward", durationMs: 15000, charges: 2, maximumPreventedIntegrityPerLeak: 3,
      carryAcrossWave: false,
    }, ["protocol.aegis-ward.accepted", "protocol.aegis-ward.resolved"]),
    tier(3, 145, 115000, 32, {
      kind: "leak-ward", durationMs: 18000, charges: 3, maximumPreventedIntegrityPerLeak: 4,
      carryAcrossWave: false,
    }, ["protocol.aegis-ward.accepted", "protocol.aegis-ward.resolved"]),
  ]),
  protocol("armara-ascension", "none", "once-per-mission", [
    tier(1, 220, 0, 1, {
      kind: "global-ascension-field", durationMs: 8000, movementReductionBp: 2500,
      towerDamageBp: 1500, towerRateBp: 2500, towerRangeBp: 0,
      affectsFutureSpawns: true, carryAcrossWave: false,
    }, ["protocol.armara-ascension.accepted", "protocol.armara-ascension.resolved"]),
    tier(2, 260, 0, 1, {
      kind: "global-ascension-field", durationMs: 10000, movementReductionBp: 3500,
      towerDamageBp: 2000, towerRateBp: 3500, towerRangeBp: 0,
      affectsFutureSpawns: true, carryAcrossWave: false,
    }, ["protocol.armara-ascension.accepted", "protocol.armara-ascension.resolved"]),
    tier(3, 320, 0, 1, {
      kind: "global-ascension-field", durationMs: 12000, movementReductionBp: 4500,
      towerDamageBp: 2500, towerRateBp: 4500, towerRangeBp: 0,
      affectsFutureSpawns: true, carryAcrossWave: false,
    }, ["protocol.armara-ascension.accepted", "protocol.armara-ascension.resolved"]),
  ]),
  protocol("athena-command", "tower", "repeat-surcharge", [
    tier(1, 85, 80000, 32, {
      kind: "tower-cluster-amplification", radiusWorldUnits: 28, maximumTowers: 3,
      damageBp: 0, rateBp: 2500, rangeBp: 0, durationMs: 8000, carryAcrossWave: false,
    }, ["protocol.athena-command.accepted", "protocol.athena-command.resolved"]),
    tier(2, 125, 95000, 32, {
      kind: "tower-cluster-amplification", radiusWorldUnits: 28, maximumTowers: 4,
      damageBp: 0, rateBp: 3500, rangeBp: 0, durationMs: 10000, carryAcrossWave: false,
    }, ["protocol.athena-command.accepted", "protocol.athena-command.resolved"]),
    tier(3, 170, 110000, 32, {
      kind: "tower-cluster-amplification", radiusWorldUnits: 28, maximumTowers: 5,
      damageBp: 0, rateBp: 4000, rangeBp: 1000, durationMs: 12000, carryAcrossWave: false,
    }, ["protocol.athena-command.accepted", "protocol.athena-command.resolved"]),
  ]),
  protocol("hades-bargain", "route-point", "repeat-surcharge", [
    tier(1, 65, 80000, 32, {
      kind: "bargain-mark", radiusWorldUnits: 16, maximumTargets: 12, durationMs: 10000,
      enemySpeedIncreaseBp: 1000, bountyIncreaseBp: 2500, addedLeakIntegrity: 1,
      targetKinds: ["air", "ground"], selectionComparatorId: "distance-progress-id",
    }, ["protocol.hades-bargain.accepted", "protocol.hades-bargain.resolved"]),
    tier(2, 90, 95000, 32, {
      kind: "bargain-mark", radiusWorldUnits: 16, maximumTargets: 18, durationMs: 12000,
      enemySpeedIncreaseBp: 1200, bountyIncreaseBp: 3500, addedLeakIntegrity: 1,
      targetKinds: ["air", "ground"], selectionComparatorId: "distance-progress-id",
    }, ["protocol.hades-bargain.accepted", "protocol.hades-bargain.resolved"]),
    tier(3, 125, 110000, 32, {
      kind: "bargain-mark", radiusWorldUnits: 16, maximumTargets: 24, durationMs: 15000,
      enemySpeedIncreaseBp: 1500, bountyIncreaseBp: 5000, addedLeakIntegrity: 1,
      targetKinds: ["air", "ground"], selectionComparatorId: "distance-progress-id",
    }, ["protocol.hades-bargain.accepted", "protocol.hades-bargain.resolved"]),
  ]),
  protocol("hephaestus-overclock", "tower", "repeat-surcharge", [
    tier(1, 70, 75000, 32, {
      kind: "tower-overclock", damageBp: 4500, rateBp: 4500, rangeBp: 0,
      durationMs: 10000, shutdownMs: 4000, carryAcrossWave: false,
    }, ["protocol.hephaestus-overclock.accepted", "protocol.hephaestus-overclock.resolved"]),
    tier(2, 105, 90000, 32, {
      kind: "tower-overclock", damageBp: 6500, rateBp: 6500, rangeBp: 0,
      durationMs: 12000, shutdownMs: 4000, carryAcrossWave: false,
    }, ["protocol.hephaestus-overclock.accepted", "protocol.hephaestus-overclock.resolved"]),
    tier(3, 150, 105000, 32, {
      kind: "tower-overclock", damageBp: 8500, rateBp: 8500, rangeBp: 1000,
      durationMs: 14000, shutdownMs: 5000, carryAcrossWave: false,
    }, ["protocol.hephaestus-overclock.accepted", "protocol.hephaestus-overclock.resolved"]),
  ]),
  protocol("hermes-rewind", "route-point", "repeat-surcharge", [
    tier(1, 80, 90000, 32, {
      kind: "route-front-rewind", maximumTargets: 3, routeLengthBp: 1200,
      targetKinds: ["air", "ground"], selectionComparatorId: "route-front-id",
    }, ["protocol.hermes-rewind.accepted", "protocol.hermes-rewind.resolved"]),
    tier(2, 120, 105000, 32, {
      kind: "route-front-rewind", maximumTargets: 5, routeLengthBp: 1800,
      targetKinds: ["air", "ground"], selectionComparatorId: "route-front-id",
    }, ["protocol.hermes-rewind.accepted", "protocol.hermes-rewind.resolved"]),
    tier(3, 170, 120000, 32, {
      kind: "route-front-rewind", maximumTargets: 8, routeLengthBp: 2500,
      targetKinds: ["air", "ground"], selectionComparatorId: "route-front-id",
    }, ["protocol.hermes-rewind.accepted", "protocol.hermes-rewind.resolved"]),
  ]),
  protocol("medusa-lock", "world-vector", "repeat-surcharge", [
    tier(1, 100, 100000, 32, {
      kind: "aimed-petrify-cone", rangeWorldUnits: 36, fullAngleDegrees: 50,
      maximumTargets: 8, durationMs: 2000, targetKinds: ["ground"],
      selectionComparatorId: "projection-perpendicular-id",
    }, ["protocol.medusa-lock.accepted", "protocol.medusa-lock.resolved"]),
    tier(2, 145, 110000, 32, {
      kind: "aimed-petrify-cone", rangeWorldUnits: 42, fullAngleDegrees: 60,
      maximumTargets: 12, durationMs: 3000, targetKinds: ["ground"],
      selectionComparatorId: "projection-perpendicular-id",
    }, ["protocol.medusa-lock.accepted", "protocol.medusa-lock.resolved"]),
    tier(3, 195, 120000, 32, {
      kind: "aimed-petrify-cone", rangeWorldUnits: 48, fullAngleDegrees: 70,
      maximumTargets: 16, durationMs: 4000, targetKinds: ["ground"],
      selectionComparatorId: "projection-perpendicular-id",
    }, ["protocol.medusa-lock.accepted", "protocol.medusa-lock.resolved"]),
  ]),
  protocol("poseidon-surge", "route-point", "repeat-surcharge", [
    tier(1, 95, 90000, 32, {
      kind: "route-point-surge", radiusWorldUnits: 18, maximumTargets: 12,
      displacementWorldUnits: 8, drenchBp: 2000, durationMs: 4000,
      targetKinds: ["ground"], selectionComparatorId: "distance-progress-id",
    }, ["protocol.poseidon-surge.accepted", "protocol.poseidon-surge.resolved"]),
    tier(2, 135, 100000, 32, {
      kind: "route-point-surge", radiusWorldUnits: 18, maximumTargets: 12,
      displacementWorldUnits: 12, drenchBp: 2500, durationMs: 5000,
      targetKinds: ["ground"], selectionComparatorId: "distance-progress-id",
    }, ["protocol.poseidon-surge.accepted", "protocol.poseidon-surge.resolved"]),
    tier(3, 180, 110000, 32, {
      kind: "route-point-surge", radiusWorldUnits: 18, maximumTargets: 12,
      displacementWorldUnits: 16, drenchBp: 3000, durationMs: 6000,
      targetKinds: ["ground"], selectionComparatorId: "distance-progress-id",
    }, ["protocol.poseidon-surge.accepted", "protocol.poseidon-surge.resolved"]),
  ]),
  protocol("temporal-edict", "none", "repeat-surcharge", [
    tier(1, 75, 80000, 32, {
      kind: "global-slow-field", magnitudeBp: 2500, durationMs: 10000,
      targetKinds: ["air", "ground"], affectsFutureSpawns: true, carryAcrossWave: false,
    }, ["protocol.temporal-edict.accepted", "protocol.temporal-edict.resolved"]),
    tier(2, 115, 95000, 32, {
      kind: "global-slow-field", magnitudeBp: 5000, durationMs: 10000,
      targetKinds: ["air", "ground"], affectsFutureSpawns: true, carryAcrossWave: false,
    }, ["protocol.temporal-edict.accepted", "protocol.temporal-edict.resolved"]),
    tier(3, 165, 110000, 32, {
      kind: "global-slow-field", magnitudeBp: 5000, durationMs: 15000,
      targetKinds: ["air", "ground"], affectsFutureSpawns: true, carryAcrossWave: false,
    }, ["protocol.temporal-edict.accepted", "protocol.temporal-edict.resolved"]),
  ]),
  protocol("zeus-skyfire", "none", "repeat-surcharge", [
    tier(1, 90, 90000, 32, {
      kind: "scheduled-global-damage", targetKinds: ["air", "ground"],
      strikes: [{ offsetMs: 900, damage: 40, shieldCoefficientBp: 10000, bossCoefficientBp: 5000, hardControl: null }],
    }, ["protocol.zeus-skyfire.accepted", "protocol.zeus-skyfire.resolved"]),
    tier(2, 135, 100000, 32, {
      kind: "scheduled-global-damage", targetKinds: ["air", "ground"],
      strikes: [{ offsetMs: 900, damage: 70, shieldCoefficientBp: 15000, bossCoefficientBp: 5000, hardControl: null }],
    }, ["protocol.zeus-skyfire.accepted", "protocol.zeus-skyfire.resolved"]),
    tier(3, 190, 115000, 32, {
      kind: "scheduled-global-damage", targetKinds: ["air", "ground"],
      strikes: [
        { offsetMs: 900, damage: 65, shieldCoefficientBp: 17500, bossCoefficientBp: 5000, hardControl: null },
        { offsetMs: 1600, damage: 65, shieldCoefficientBp: 17500, bossCoefficientBp: 5000,
          hardControl: { statusId: "stun", durationMs: 350, bossEligible: false } },
      ],
    }, ["protocol.zeus-skyfire.accepted", "protocol.zeus-skyfire.resolved"]),
  ]),
];

const RELIC_RECORDS = [
  {
    id: "broken-aegis", nameKey: "relic.broken-aegis.name", unlockGrantId: "grant.relic.broken-aegis",
    benefitKey: "relic.broken-aegis.benefit", drawbackKey: "relic.broken-aegis.drawback",
    benefitModifiers: [{ statId: "starting-integrity", operation: "add", amount: 5, rounding: "none" }],
    drawbackModifiers: [{ statId: "starting-aether", operation: "add", amount: -20, rounding: "none" }],
  },
  {
    id: "bronze-obol", nameKey: "relic.bronze-obol.name", unlockGrantId: "grant.relic.bronze-obol",
    benefitKey: "relic.bronze-obol.benefit", drawbackKey: "relic.bronze-obol.drawback",
    benefitModifiers: [{ statId: "starting-aether", operation: "add", amount: 25, rounding: "none" }],
    drawbackModifiers: [{ statId: "bounty", operation: "multiply-bp", amount: 8500, rounding: "mission-remainder" }],
  },
  {
    id: "forge-ember", nameKey: "relic.forge-ember.name", unlockGrantId: "grant.relic.forge-ember",
    benefitKey: "relic.forge-ember.benefit", drawbackKey: "relic.forge-ember.drawback",
    benefitModifiers: [
      { statId: "specialization-cost", operation: "multiply-bp", amount: 8800, rounding: "ceil" },
      { statId: "upgrade-cost", operation: "multiply-bp", amount: 8800, rounding: "ceil" },
    ],
    drawbackModifiers: [{ statId: "build-cost", operation: "multiply-bp", amount: 10800, rounding: "ceil" }],
  },
  {
    id: "hermes-greaves", nameKey: "relic.hermes-greaves.name", unlockGrantId: "grant.relic.hermes-greaves",
    benefitKey: "relic.hermes-greaves.benefit", drawbackKey: "relic.hermes-greaves.drawback",
    benefitModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: 800, rounding: "none" }],
    drawbackModifiers: [{ statId: "tower-range", operation: "add-bp", amount: -800, rounding: "floor" }],
  },
  {
    id: "laurel-of-ares", nameKey: "relic.laurel-of-ares.name", unlockGrantId: "grant.relic.laurel-of-ares",
    benefitKey: "relic.laurel-of-ares.benefit", drawbackKey: "relic.laurel-of-ares.drawback",
    benefitModifiers: [
      { statId: "tower-direct-damage", operation: "multiply-bp", amount: 11200, rounding: "floor" },
      { statId: "tower-dot-damage", operation: "multiply-bp", amount: 11200, rounding: "floor" },
    ],
    drawbackModifiers: [
      { statId: "tower-control-duration", operation: "multiply-bp", amount: 8500, rounding: "floor" },
      { statId: "tower-control-magnitude", operation: "multiply-bp", amount: 8500, rounding: "floor" },
    ],
  },
  {
    id: "owl-lens", nameKey: "relic.owl-lens.name", unlockGrantId: "grant.relic.owl-lens",
    benefitKey: "relic.owl-lens.benefit", drawbackKey: "relic.owl-lens.drawback",
    benefitModifiers: [{ statId: "tower-range", operation: "add-bp", amount: 1000, rounding: "floor" }],
    drawbackModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: -800, rounding: "none" }],
  },
  {
    id: "tideglass", nameKey: "relic.tideglass.name", unlockGrantId: "grant.relic.tideglass",
    benefitKey: "relic.tideglass.benefit", drawbackKey: "relic.tideglass.drawback",
    benefitModifiers: [
      { statId: "tower-control-magnitude", operation: "multiply-bp", amount: 12000, rounding: "floor" },
      { statId: "tower-displacement", operation: "multiply-bp", amount: 12000, rounding: "floor" },
    ],
    drawbackModifiers: [
      { statId: "tower-direct-damage", operation: "multiply-bp", amount: 9200, rounding: "floor" },
      { statId: "tower-dot-damage", operation: "multiply-bp", amount: 9200, rounding: "floor" },
    ],
  },
  {
    id: "titan-gear", nameKey: "relic.titan-gear.name", unlockGrantId: "grant.relic.titan-gear",
    benefitKey: "relic.titan-gear.benefit", drawbackKey: "relic.titan-gear.drawback",
    benefitModifiers: [{ statId: "protocol-cost", operation: "multiply-bp", amount: 8500, rounding: "ceil" }],
    drawbackModifiers: [
      { statId: "build-cost", operation: "multiply-bp", amount: 10800, rounding: "ceil" },
      { statId: "specialization-cost", operation: "multiply-bp", amount: 10800, rounding: "ceil" },
      { statId: "upgrade-cost", operation: "multiply-bp", amount: 10800, rounding: "ceil" },
    ],
  },
];

const SPECIALIZATION_RECORDS = SPECIALIZATION_DEFINITIONS.map(function (record) {
  return {
    id: record[0],
    defenseId: record[1],
    nameKey: "specialization." + record[0] + ".name",
    unlockGrantId: "grant.specialization." + record[0],
    branchRoleId: record[3],
    level3CostAether: DEFENSE_LEVEL3_COSTS[record[1]],
    isDefault: record[2],
  };
});

const REINFORCEMENT_RECORDS = [
  {
    id: "artemis-scout", nameKey: "reinforcement.artemis-scout.name",
    unlockGrantId: "grant.reinforcement.artemis-scout", costAether: 90, cooldownMs: 60000,
    lifetimeMs: 18000, markerKind: "reinforcement-ranged", targetKinds: ["air", "ground"],
    maximumActive: 1,
    effect: { kind: "stationary-direct-unit", damage: 11, cooldownMs: 450, rangeWorldUnits: 32,
      armorIgnoreBp: 10000, targetPolicyId: "FRONT" },
  },
  {
    id: "spartan-phalanx", nameKey: "reinforcement.spartan-phalanx.name",
    unlockGrantId: "grant.reinforcement.spartan-phalanx", costAether: 70, cooldownMs: 50000,
    lifetimeMs: 14000, markerKind: "reinforcement-guard", targetKinds: ["ground"],
    maximumActive: 1,
    effect: { kind: "finite-guard-contacts", contactCount: 3, contactDamage: 12,
      blockDurationMs: 1000, replenishes: false },
  },
  {
    id: "talos-automaton", nameKey: "reinforcement.talos-automaton.name",
    unlockGrantId: "grant.reinforcement.talos-automaton", costAether: 155, cooldownMs: 100000,
    lifetimeMs: 22000, markerKind: "reinforcement-heavy", targetKinds: ["ground"],
    maximumActive: 1,
    effect: { kind: "stationary-splash-unit", damage: 42, cooldownMs: 1200, rangeWorldUnits: 22,
      radiusWorldUnits: 3, armorBreakAmount: 2, armorBreakDurationMs: 2500 },
  },
];

const MECHANISM_RECORDS = [
  {
    id: "athena-statue-beam", nameKey: "mechanism.athena-statue-beam.name", firstMissionId: "m14",
    costAether: 90, cooldownMs: 90000, maximumActivations: 32,
    effect: { kind: "authored-line-damage", telegraphMs: 900, lineWidthWorldUnits: 8,
      damage: 100, bossCoefficientBp: 6000, targetKinds: ["air", "ground"], mutatesRouteTopology: false },
  },
  {
    id: "bridgefall", nameKey: "mechanism.bridgefall.name", firstMissionId: "m17",
    costAether: 110, cooldownMs: 0, maximumActivations: 1,
    effect: { kind: "blast-rubble-zone", telegraphMs: 1200, damage: 80,
      movementReductionBp: 2500, durationPolicyId: "until-wave-clear", targetKinds: ["ground"],
      mutatesRouteTopology: false },
  },
  {
    id: "bronze-city-gate", nameKey: "mechanism.bronze-city-gate.name", firstMissionId: "m05",
    costAether: 55, cooldownMs: 75000, maximumActivations: 32,
    effect: { kind: "finite-gate-block", telegraphMs: 500, maximumContacts: 3,
      durationMs: 4000, targetKinds: ["ground"], mutatesRouteTopology: false },
  },
  {
    id: "harbor-chain", nameKey: "mechanism.harbor-chain.name", firstMissionId: "m07",
    costAether: 50, cooldownMs: 65000, maximumActivations: 32,
    effect: { kind: "authored-slow-zone", magnitudeBp: 3000, durationMs: 8000,
      targetKinds: ["ground"], mutatesRouteTopology: false },
  },
  {
    id: "sacred-braziers", nameKey: "mechanism.sacred-braziers.name", firstMissionId: "m11",
    costAether: 60, cooldownMs: 70000, maximumActivations: 32,
    effect: { kind: "authored-damage-zone", durationMs: 8000, pulseMs: 500, pulseDamage: 4,
      maximumTargetsPerPulse: 20, targetKinds: ["ground"], mutatesRouteTopology: false },
  },
];

function grant(id, kind, targetId, integerValue) {
  return { id: id, kind: kind, targetId: targetId, integerValue: integerValue };
}

const GRANT_RECORDS = [
  grant("grant.blueprint-reset", "unlock-campaign-action", "blueprint-reset", 0),
  grant("grant.campaign.reserve-1", "unlock-campaign-modifier", "reserve-1", 10),
  grant("grant.campaign.reserve-2", "unlock-campaign-modifier", "reserve-2", 10),
  grant("grant.defense-slots.5", "set-defense-slot-cap", null, 5),
  grant("grant.defense-slots.6", "set-defense-slot-cap", null, 6),
  grant("grant.defense.apollo", "unlock-defense", "apollo", 0),
  grant("grant.defense.artemis", "unlock-defense", "artemis", 0),
  grant("grant.defense.athena", "unlock-defense", "athena", 0),
  grant("grant.defense.hades", "unlock-defense", "hades", 0),
  grant("grant.defense.hephaestus", "unlock-defense", "hephaestus", 0),
  grant("grant.defense.hermes", "unlock-defense", "hermes", 0),
  grant("grant.defense.hoplite", "unlock-defense", "hoplite", 0),
  grant("grant.defense.medusa", "unlock-defense", "medusa", 0),
  grant("grant.defense.oracle", "unlock-defense", "oracle", 0),
  grant("grant.defense.poseidon", "unlock-defense", "poseidon", 0),
  grant("grant.defense.talos", "unlock-defense", "talos", 0),
  grant("grant.defense.zeus", "unlock-defense", "zeus", 0),
  grant("grant.mode.endless-ascension", "unlock-mode", "endless-ascension", 0),
  grant("grant.protocol-slots.1", "set-protocol-slot-cap", null, 1),
  grant("grant.protocol-slots.2", "set-protocol-slot-cap", null, 2),
].concat(PROTOCOL_RECORDS.map(function (record) {
  return grant(record.unlockGrantId, "unlock-protocol", record.id, 1);
})).concat([
  grant("grant.recon.1", "set-recon-tier", null, 1),
  grant("grant.recon.2", "set-recon-tier", null, 2),
  grant("grant.recon.3", "set-recon-tier", null, 3),
  grant("grant.reinforcement-slots.1", "set-reinforcement-slot-cap", null, 1),
]).concat(REINFORCEMENT_RECORDS.map(function (record) {
  return grant(record.unlockGrantId, "unlock-reinforcement", record.id, 0);
})).concat(SPECIALIZATION_RECORDS.map(function (record) {
  return grant(record.unlockGrantId, "unlock-specialization", record.id, 0);
})).concat([
  grant("grant.relic-slots.1", "set-relic-slot-cap", null, 1),
  grant("grant.relic-slots.2", "set-relic-slot-cap", null, 2),
]).concat(RELIC_RECORDS.map(function (record) {
  return grant(record.unlockGrantId, "unlock-relic", record.id, 0);
})).sort(function (left, right) {
  return left.id < right.id ? -1 : (left.id > right.id ? 1 : 0);
});

const MISSION_PROGRESSION = [
  ["m01", [], ["grant.defense.hoplite"]],
  ["m02", [], ["grant.defense.oracle"]],
  ["m03", [], ["grant.defense.artemis"]],
  ["m04", [], ["grant.campaign.reserve-1"]],
  ["m05", ["temporal-edict"], ["grant.defense-slots.5", "grant.protocol-slots.1", "grant.protocol.temporal-edict"]],
  ["m06", [], ["grant.defense.hermes", "grant.recon.1", "grant.relic-slots.1", "grant.relic.bronze-obol"]],
  ["m07", [], ["grant.defense.poseidon", "grant.relic.owl-lens"]],
  ["m08", ["zeus-skyfire"], ["grant.defense.medusa", "grant.protocol.zeus-skyfire"]],
  ["m09", [], ["grant.blueprint-reset", "grant.reinforcement-slots.1", "grant.reinforcement.spartan-phalanx", "grant.relic.broken-aegis"]],
  ["m10", ["aegis-ward"], ["grant.defense-slots.6", "grant.protocol-slots.2", "grant.protocol.aegis-ward"]],
  ["m11", ["poseidon-surge"], ["grant.defense.hephaestus", "grant.protocol.poseidon-surge", "grant.relic.forge-ember"]],
  ["m12", [], ["grant.defense.athena"]],
  ["m13", ["athena-command"], ["grant.defense.apollo", "grant.protocol.athena-command", "grant.relic.tideglass"]],
  ["m14", [], ["grant.recon.2", "grant.reinforcement.artemis-scout"]],
  ["m15", ["hephaestus-overclock"], ["grant.campaign.reserve-2", "grant.protocol.hephaestus-overclock", "grant.relic-slots.2", "grant.relic.laurel-of-ares"]],
  ["m16", ["hermes-rewind"], ["grant.defense.hades", "grant.protocol.hermes-rewind"]],
  ["m17", ["medusa-lock"], ["grant.defense.talos", "grant.protocol.medusa-lock", "grant.relic.hermes-greaves"]],
  ["m18", ["hades-bargain"], ["grant.defense.zeus", "grant.protocol.hades-bargain", "grant.recon.3", "grant.reinforcement.talos-automaton"]],
  ["m19", [], ["grant.relic.titan-gear"]],
  ["m20", ["armara-ascension"], ["grant.mode.endless-ascension", "grant.protocol.armara-ascension"]],
].map(function (record) {
  return {
    missionId: record[0],
    loanProtocolIds: record[1].slice().sort(),
    firstVictoryGrantIds: record[2].slice().sort(),
  };
});

const BINDING_SOURCES = {
  protocols: { schemaVersion: 1, id: "aegis-protocols-v1", records: PROTOCOL_RECORDS },
  relics: { schemaVersion: 1, id: "aegis-relics-v1", records: RELIC_RECORDS },
  specializations: { schemaVersion: 1, id: "aegis-specializations-v1", records: SPECIALIZATION_RECORDS },
  reinforcements: { schemaVersion: 1, id: "aegis-reinforcements-v1", records: REINFORCEMENT_RECORDS },
  mechanisms: { schemaVersion: 1, id: "aegis-mechanisms-v1", records: MECHANISM_RECORDS },
  progression: {
    schemaVersion: 1,
    id: "aegis-progression-v1",
    protocolRules: {
      initialSlotCap: 0,
      maximumSlotCap: 2,
      maximumLaurels: 180,
      repeatCostStepBp: 2500,
      sharedCooldownMs: 15000,
      respecPolicyId: "free-out-of-run-refund",
      tierCosts: PROTOCOL_TIER_COSTS,
    },
    relicRules: { initialSlotCap: 0, maximumSlotCap: 2 },
    reinforcementRules: { initialSlotCap: 0, maximumSlotCap: 1, maximumActive: 1 },
    reconRules: { initialTier: 0, maximumTier: 3, simulationAffecting: false },
    grantRecords: GRANT_RECORDS,
    records: MISSION_PROGRESSION,
  },
};

const exportValue = {
  CONTENT_SCHEMA_VERSION: CONTENT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
  BEHAVIOR_REGISTRY_VERSION: BEHAVIOR_REGISTRY_VERSION,
  COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
  REPLAY_FORMAT_VERSION: REPLAY_FORMAT_VERSION,
  PROFILE_SCHEMA_VERSION: PROFILE_SCHEMA_VERSION,
  PRESENTATION_SCHEMA_VERSION: PRESENTATION_SCHEMA_VERSION,
  PROTOCOL_TIER_COSTS: PROTOCOL_TIER_COSTS,
  PROTOCOL_IDS: PROTOCOL_RECORDS.map(function (record) { return record.id; }),
  DEFENSE_IDS: Object.keys(DEFENSE_LEVEL3_COSTS).sort(),
  SPECIALIZATION_IDS: SPECIALIZATION_RECORDS.map(function (record) { return record.id; }),
  RELIC_IDS: RELIC_RECORDS.map(function (record) { return record.id; }),
  REINFORCEMENT_IDS: REINFORCEMENT_RECORDS.map(function (record) { return record.id; }),
  MECHANISM_IDS: MECHANISM_RECORDS.map(function (record) { return record.id; }),
  BINDING_SOURCES: BINDING_SOURCES,
};

module.exports = deepFreeze(exportValue);
