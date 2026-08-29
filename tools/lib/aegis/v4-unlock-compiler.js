"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");
const Catalog = require("./v4-rule-catalog.js");
const Contracts = require("./v4-unlock-contracts.js");

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) {
    output[key] = deepFrozenClone(value[key]);
  });
  return Object.freeze(output);
}

function compileProtocol(record) {
  return {
    id: record.id,
    unlockGrantId: record.unlockGrantId,
    castPolicyId: record.castPolicyId,
    targetKind: record.targetKind,
    tiers: record.tiers.map(function (tier) {
      return {
        tier: tier.tier,
        incrementalLaurels: tier.incrementalLaurels,
        cumulativeLaurels: tier.cumulativeLaurels,
        baseCostAether: tier.baseCostAether,
        cooldownMs: tier.cooldownMs,
        sharedCooldownMs: tier.sharedCooldownMs,
        maximumAcceptedCasts: tier.maximumAcceptedCasts,
        effect: deepFrozenClone(tier.effect),
        eventIds: tier.eventIds.slice(),
      };
    }),
    eventIds: record.eventIds.slice(),
  };
}

function compileRelic(record) {
  return {
    id: record.id,
    unlockGrantId: record.unlockGrantId,
    benefitModifiers: deepFrozenClone(record.benefitModifiers),
    drawbackModifiers: deepFrozenClone(record.drawbackModifiers),
  };
}

function compileSpecialization(record) {
  return {
    id: record.id,
    defenseId: record.defenseId,
    unlockGrantId: record.unlockGrantId,
    branchRoleId: record.branchRoleId,
    level3CostAether: record.level3CostAether,
    isDefault: record.isDefault,
  };
}

function compileReinforcement(record) {
  return {
    id: record.id,
    unlockGrantId: record.unlockGrantId,
    costAether: record.costAether,
    cooldownMs: record.cooldownMs,
    lifetimeMs: record.lifetimeMs,
    markerKind: record.markerKind,
    targetKinds: record.targetKinds.slice(),
    maximumActive: record.maximumActive,
    effect: deepFrozenClone(record.effect),
  };
}

function compileMechanism(record) {
  return {
    id: record.id,
    firstMissionId: record.firstMissionId,
    costAether: record.costAether,
    cooldownMs: record.cooldownMs,
    maximumActivations: record.maximumActivations,
    effect: deepFrozenClone(record.effect),
  };
}

function requireGrant(grantsById, grantId, expectedKind, expectedTargetId, expectedValue, path) {
  const grant = grantsById.get(grantId);
  if (!grant) {
    fail("V4_UNLOCK_CROSS_REFERENCE", path, "Unknown unlock grant " + JSON.stringify(grantId));
  }
  if (
    grant.kind !== expectedKind ||
    grant.targetId !== expectedTargetId ||
    grant.integerValue !== expectedValue
  ) {
    fail(
      "V4_UNLOCK_CROSS_REFERENCE",
      path,
      "Unlock grant " + JSON.stringify(grantId) + " does not match its approved domain record"
    );
  }
}

function validateCrossReferences(compiled) {
  const grantsById = new Map();
  compiled.grantRecords.forEach(function (grant, index) {
    if (grantsById.has(grant.id)) {
      fail(
        "V4_UNLOCK_CROSS_REFERENCE",
        pointerJoin("/progression/grantRecords", index) + "/id",
        "Duplicate grant ID " + JSON.stringify(grant.id)
      );
    }
    grantsById.set(grant.id, grant);
  });

  [
    [compiled.protocols, "unlock-protocol", 1, "/protocols/records"],
    [compiled.relics, "unlock-relic", 0, "/relics/records"],
    [compiled.specializations, "unlock-specialization", 0, "/specializations/records"],
    [compiled.reinforcements, "unlock-reinforcement", 0, "/reinforcements/records"],
  ].forEach(function (domain) {
    domain[0].forEach(function (record, index) {
      requireGrant(
        grantsById,
        record.unlockGrantId,
        domain[1],
        record.id,
        domain[2],
        pointerJoin(pointerJoin(domain[3], index), "unlockGrantId")
      );
    });
  });

  const protocolIds = new Set(compiled.protocols.map(function (record) { return record.id; }));
  const missionIds = new Set(compiled.missionProgression.map(function (record) { return record.missionId; }));
  compiled.missionProgression.forEach(function (mission, missionIndex) {
    mission.loanProtocolIds.forEach(function (protocolId, protocolIndex) {
      if (!protocolIds.has(protocolId)) {
        fail(
          "V4_UNLOCK_CROSS_REFERENCE",
          pointerJoin(pointerJoin(pointerJoin("/progression/records", missionIndex), "loanProtocolIds"), protocolIndex),
          "Unknown loan Protocol " + JSON.stringify(protocolId)
        );
      }
    });
    mission.firstVictoryGrantIds.forEach(function (grantId, grantIndex) {
      if (!grantsById.has(grantId)) {
        fail(
          "V4_UNLOCK_CROSS_REFERENCE",
          pointerJoin(pointerJoin(pointerJoin("/progression/records", missionIndex), "firstVictoryGrantIds"), grantIndex),
          "Unknown first-victory grant " + JSON.stringify(grantId)
        );
      }
    });
  });

  compiled.mechanisms.forEach(function (record, index) {
    if (!missionIds.has(record.firstMissionId)) {
      fail(
        "V4_UNLOCK_CROSS_REFERENCE",
        pointerJoin(pointerJoin("/mechanisms/records", index), "firstMissionId"),
        "Unknown mechanism mission " + JSON.stringify(record.firstMissionId)
      );
    }
  });
}

function compileUnlockSimulationContent(recordSet) {
  const source = Contracts.validateUnlockRecordSet(recordSet);
  const progression = source.progression;
  const compiled = {
    schemaVersion: Catalog.CONTENT_SCHEMA_VERSION,
    eventSchemaVersion: Catalog.EVENT_SCHEMA_VERSION,
    behaviorRegistryVersion: Catalog.BEHAVIOR_REGISTRY_VERSION,
    commandSchemaVersion: Catalog.COMMAND_SCHEMA_VERSION,
    replayFormatVersion: Catalog.REPLAY_FORMAT_VERSION,
    profileSchemaVersion: Catalog.PROFILE_SCHEMA_VERSION,
    protocolRules: deepFrozenClone(progression.protocolRules),
    relicRules: deepFrozenClone(progression.relicRules),
    reinforcementRules: deepFrozenClone(progression.reinforcementRules),
    protocols: source.protocols.records.map(compileProtocol),
    relics: source.relics.records.map(compileRelic),
    specializations: source.specializations.records.map(compileSpecialization),
    reinforcements: source.reinforcements.records.map(compileReinforcement),
    mechanisms: source.mechanisms.records.map(compileMechanism),
    grantRecords: deepFrozenClone(progression.grantRecords),
    missionProgression: deepFrozenClone(progression.records),
  };
  validateCrossReferences(compiled);
  return deepFrozenClone(compiled);
}

module.exports = Object.freeze({
  compileUnlockSimulationContent: compileUnlockSimulationContent,
});
