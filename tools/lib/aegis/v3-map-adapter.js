"use strict";

const { fail } = require("./diagnostics.js");
const { parseExactDecimal } = require("./exact-decimal.js");
const MapIr = require("./map-ir.js");

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_RANGE_WORLD_UNITS = 1000000;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireObject(value, path, label, code) {
  if (!isPlainObject(value)) fail(code, path, label + " must be a validated plain record");
  return value;
}

function requireArray(value, path, label, code, allowEmpty) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(code, path, label + " must be " + (allowEmpty ? "an array" : "a nonempty array"));
  }
  return value;
}

function requireId(value, path, label, code) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail(code, path, label + " must be a stable ASCII ID");
  }
  return value;
}

function requireSortedUniqueIds(value, path, label, code, allowEmpty) {
  const source = requireArray(value, path, label, code, allowEmpty);
  const output = [];
  let prior = null;
  source.forEach(function (item, index) {
    const itemPath = path + "/" + index;
    const id = requireId(item, itemPath, label + " item", code);
    if (prior !== null && prior >= id) {
      fail(code, itemPath, label + " must be unique and strict ASCII sorted");
    }
    output.push(id);
    prior = id;
  });
  return output;
}

function missionRecordPath(input) {
  return Number.isSafeInteger(input.missionIndex) && input.missionIndex >= 0
    ? "/missions/" + input.missionIndex
    : "/mission";
}

function defenseIndex(records) {
  const byId = new Map();
  let hoplite = null;
  records.forEach(function (record, index) {
    const recordPath = "/defenses/records/" + index;
    requireObject(record, recordPath, "Defense", "V3_MAP_ADAPTER_DEFENSES");
    const id = requireId(record.id, recordPath + "/id", "Defense ID", "V3_MAP_ADAPTER_DEFENSES");
    if (byId.has(id)) {
      fail(
        id === "hoplite" ? "V3_MAP_ADAPTER_HOPLITE" : "V3_MAP_ADAPTER_DEFENSES",
        recordPath + "/id",
        "Defense IDs must be unique"
      );
    }
    const indexed = { record: record, index: index };
    byId.set(id, indexed);
    if (id === "hoplite") hoplite = indexed;
  });
  if (!hoplite) {
    fail("V3_MAP_ADAPTER_HOPLITE", "/defenses/records", "The validated defense catalog requires exactly one Hoplite record");
  }
  return { byId: byId, hoplite: hoplite };
}

function compiledIntegralRange(level, path) {
  const rangePath = path + "/rangeWorldUnits";
  if (typeof level.rangeWorldUnits !== "string") {
    fail("V3_MAP_ADAPTER_RANGE", rangePath, "Hoplite range must be an authored exact-decimal string");
  }
  const scaled = parseExactDecimal(level.rangeWorldUnits, 1000, rangePath);
  if (scaled <= 0 || scaled > MAX_RANGE_WORLD_UNITS * 1000 || scaled % 1000 !== 0) {
    fail(
      "V3_MAP_ADAPTER_RANGE",
      rangePath,
      "Every mission-legal Hoplite range must compile to a positive integral world-unit value"
    );
  }
  return scaled / 1000;
}

function exactBehavior(behaviors, levelPath, contractId, deliveryKind) {
  const behaviorsPath = levelPath + "/behaviors";
  requireArray(behaviors, behaviorsPath, "Hoplite behaviors", "V3_MAP_ADAPTER_BEHAVIOR", false);
  const matches = [];
  behaviors.forEach(function (behavior, index) {
    const behaviorPath = behaviorsPath + "/" + index;
    requireObject(behavior, behaviorPath, "Hoplite behavior", "V3_MAP_ADAPTER_BEHAVIOR");
    if (behavior.contractId === contractId && behavior.version === 1 && behavior.deliveryKind === deliveryKind) {
      matches.push({ record: behavior, path: behaviorPath });
    }
  });
  if (matches.length !== 1) {
    fail(
      "V3_MAP_ADAPTER_BEHAVIOR",
      behaviorsPath,
      "Each Hoplite level requires exactly one " + contractId + "@1/" + deliveryKind + " behavior; found " + matches.length
    );
  }
  return matches[0];
}

function behaviorComparator(candidate, fieldName) {
  const parameterPath = candidate.path + "/parameters";
  const parameters = requireObject(
    candidate.record.parameters,
    parameterPath,
    "Hoplite behavior parameters",
    "V3_MAP_ADAPTER_COMPARATOR"
  );
  const comparatorPath = parameterPath + "/" + fieldName;
  return {
    id: requireId(parameters[fieldName], comparatorPath, "Guard comparator ID", "V3_MAP_ADAPTER_COMPARATOR"),
    path: comparatorPath,
  };
}

function deriveHopliteContext(hopliteEntry, closedComparatorIds) {
  const hoplitePath = "/defenses/records/" + hopliteEntry.index;
  const levelsPath = hoplitePath + "/levels";
  const levels = requireArray(
    hopliteEntry.record.levels,
    levelsPath,
    "Hoplite levels",
    "V3_MAP_ADAPTER_HOPLITE",
    false
  );
  let minimumRange = null;
  let slotComparator = null;
  let contactComparator = null;
  levels.forEach(function (level, levelIndex) {
    const levelPath = levelsPath + "/" + levelIndex;
    requireObject(level, levelPath, "Hoplite level", "V3_MAP_ADAPTER_HOPLITE");
    const range = compiledIntegralRange(level, levelPath);
    if (minimumRange === null || range < minimumRange) minimumRange = range;

    const spawn = exactBehavior(level.behaviors, levelPath, "spawnUnit", "guard-slots");
    const block = exactBehavior(level.behaviors, levelPath, "block", "marker-contact-control");
    const currentSlot = behaviorComparator(spawn, "slotComparatorId");
    const currentContact = behaviorComparator(block, "contactComparatorId");
    if (slotComparator && currentSlot.id !== slotComparator.id) {
      fail(
        "V3_MAP_ADAPTER_COMPARATOR",
        currentSlot.path,
        "Hoplite slot comparator must be identical across mission-legal levels"
      );
    }
    if (contactComparator && currentContact.id !== contactComparator.id) {
      fail(
        "V3_MAP_ADAPTER_COMPARATOR",
        currentContact.path,
        "Hoplite contact comparator must be identical across mission-legal levels"
      );
    }
    if (!slotComparator) slotComparator = currentSlot;
    if (!contactComparator) contactComparator = currentContact;
  });

  const closed = new Set(closedComparatorIds);
  if (!closed.has(slotComparator.id)) {
    fail("V3_MAP_ADAPTER_COMPARATOR", slotComparator.path, "Hoplite slot comparator is absent from the closed campaign catalog");
  }
  if (!closed.has(contactComparator.id)) {
    fail("V3_MAP_ADAPTER_COMPARATOR", contactComparator.path, "Hoplite contact comparator is absent from the closed campaign catalog");
  }
  return {
    projectionRangeWorldUnits: minimumRange,
    slotComparatorId: slotComparator.id,
    contactComparatorId: contactComparator.id,
  };
}

function deriveEligibleDefenseTags(availableDefenseIds, defenseById, missionPath) {
  const tags = new Set();
  availableDefenseIds.forEach(function (defenseId, index) {
    const resolved = defenseById.get(defenseId);
    if (!resolved) {
      fail(
        "V3_MAP_ADAPTER_MISSION_DEFENSES",
        missionPath + "/availableDefenseIds/" + index,
        "Mission-eligible defense ID does not resolve in the validated defense catalog"
      );
    }
    const tagPath = "/defenses/records/" + resolved.index + "/defenseTags";
    const recordTags = requireSortedUniqueIds(
      resolved.record.defenseTags,
      tagPath,
      "Defense tags",
      "V3_MAP_ADAPTER_DEFENSE_TAGS",
      false
    );
    recordTags.forEach(function (tag) { tags.add(tag); });
  });
  return Array.from(tags).sort();
}

function normalizeAndValidateMap(input) {
  requireObject(input, "/mapAdapter", "Map adapter input", "V3_MAP_ADAPTER_INPUT");
  const mission = requireObject(input.mission, "/mission", "Mission", "V3_MAP_ADAPTER_INPUT");
  const defenses = requireObject(input.defenses, "/defenses", "Defense catalog", "V3_MAP_ADAPTER_INPUT");
  const campaignRules = requireObject(
    input.campaignRules,
    "/campaignRules",
    "Campaign rules",
    "V3_MAP_ADAPTER_INPUT"
  );
  requireObject(input.mapSource, "/mapSource", "Map source", "V3_MAP_ADAPTER_INPUT");

  const currentMissionPath = missionRecordPath(input);
  const availableDefenseIds = requireSortedUniqueIds(
    mission.availableDefenseIds,
    currentMissionPath + "/availableDefenseIds",
    "Mission-eligible defense IDs",
    "V3_MAP_ADAPTER_MISSION_DEFENSES",
    false
  );
  const defenseRecords = requireArray(
    defenses.records,
    "/defenses/records",
    "Defense records",
    "V3_MAP_ADAPTER_DEFENSES",
    false
  );
  const indexedDefenses = defenseIndex(defenseRecords);
  const ruleCatalog = requireObject(
    campaignRules.ruleCatalog,
    "/campaignRules/ruleCatalog",
    "Campaign rule catalog",
    "V3_MAP_ADAPTER_CLOSED_COMPARATORS"
  );
  const closedComparatorIds = requireSortedUniqueIds(
    ruleCatalog.comparatorIds,
    "/campaignRules/ruleCatalog/comparatorIds",
    "Closed comparator IDs",
    "V3_MAP_ADAPTER_CLOSED_COMPARATORS",
    false
  );
  const hoplite = deriveHopliteContext(indexedDefenses.hoplite, closedComparatorIds);
  const eligibleDefenseTagIds = deriveEligibleDefenseTags(
    availableDefenseIds,
    indexedDefenses.byId,
    currentMissionPath
  );

  const roleProofContext = Object.freeze({
    projectionRangeWorldUnits: hoplite.projectionRangeWorldUnits,
    slotComparatorId: hoplite.slotComparatorId,
    contactComparatorId: hoplite.contactComparatorId,
    closedComparatorIds: Object.freeze(closedComparatorIds.slice()),
    eligibleDefenseTagIds: Object.freeze(eligibleDefenseTagIds),
    requireGuardProofs: availableDefenseIds.indexOf("hoplite") !== -1,
  });
  const normalizeOptions = { roleProofContext: roleProofContext };
  if (Object.prototype.hasOwnProperty.call(input, "mapProofSupplement") && input.mapProofSupplement !== undefined) {
    normalizeOptions.mapProofSupplement = input.mapProofSupplement;
  }
  return MapIr.normalizeMapForV3(input.mapSource, normalizeOptions);
}

module.exports = Object.freeze({ normalizeAndValidateMap: normalizeAndValidateMap });
