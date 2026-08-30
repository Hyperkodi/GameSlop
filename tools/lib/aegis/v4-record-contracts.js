"use strict";

/* Compiled-content schema v4 record contracts.
   Every retained v1-v3 record shape is validated by importing the reviewed v3 contracts;
   only the genuinely new v4 shapes (campaign unlock rules, two-level defenses with two
   Level-3 specialization records, v2 event catalog, v4 mission additions) are defined here. */

const { fail, pointerJoin } = require("./diagnostics.js");
const Catalog = require("./v4-behavior-catalog.js");
const V3Records = require("./v3-record-contracts.js");

const LIMITS = Object.freeze({
  maxSourceBytes: 1048576,
  maxDepth: 32,
  maxObjectFields: 64,
  maxDefenses: 15,
  levelsPerDefense: 2,
  specializationsPerDefense: 2,
  maxBehaviorsPerLevel: 16,
  maxSemanticEventsPerOwner: 32,
  maxSummonRecords: 64,
  maxMilliseconds: 86400000,
  maxAether: 1000000,
  maxCatalogRecords: 1000,
  maxReinforcementMarkers: 32,
  maxMechanismActivations: 32,
  boardColumns: 40,
  boardRows: 25,
});

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const STRING_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const EXACT_DECIMAL = /^(0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/;

/* ---- shared primitives -------------------------------------------------------------- */

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function preflight(value, path) {
  const seen = new WeakSet();
  function visit(current, currentPath, depth) {
    if (depth > LIMITS.maxDepth) fail("SCHEMA_DEPTH", currentPath, "Record nesting exceeds " + LIMITS.maxDepth);
    if (current === null || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
        fail("SCHEMA_INTEGER", currentPath, "Numbers must be non-negative-zero safe integers");
      }
      return;
    }
    if (typeof current === "string") {
      for (let index = 0; index < current.length; index++) {
        const code = current.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
          const next = current.charCodeAt(index + 1);
          if (!(next >= 0xdc00 && next <= 0xdfff)) {
            fail("SCHEMA_UNICODE", currentPath, "Strings cannot contain lone surrogate code units");
          }
          index++;
        } else if (code >= 0xdc00 && code <= 0xdfff) {
          fail("SCHEMA_UNICODE", currentPath, "Strings cannot contain lone surrogate code units");
        }
      }
      return;
    }
    if (!current || typeof current !== "object") fail("SCHEMA_TYPE", currentPath, "Records contain JSON data only");
    if (seen.has(current)) fail("SCHEMA_SHARED_REFERENCE", currentPath, "Cycles and shared references are forbidden");
    seen.add(current);
    if (Object.getOwnPropertySymbols(current).length !== 0) {
      fail("SCHEMA_DATA_PROPERTY", currentPath, "Symbol properties are forbidden");
    }
    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) {
        fail("SCHEMA_OBJECT", currentPath, "Expected an ordinary JSON array prototype");
      }
      for (let index = 0; index < current.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
          fail("SCHEMA_DATA_PROPERTY", pointerJoin(currentPath, index), "Array elements must be enumerable data properties");
        }
        visit(descriptor.value, pointerJoin(currentPath, index), depth + 1);
      }
      Object.getOwnPropertyNames(current).forEach(function (name) {
        if (name === "length") return;
        if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= current.length) {
          fail("SCHEMA_DATA_PROPERTY", pointerJoin(currentPath, name), "Arrays cannot have extra properties");
        }
      });
      return;
    }
    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("SCHEMA_OBJECT", currentPath, "Expected a plain data object");
    }
    const names = Object.getOwnPropertyNames(current);
    if (names.length > LIMITS.maxObjectFields) {
      fail("SCHEMA_LIMIT", currentPath, "Object exceeds " + LIMITS.maxObjectFields + " fields");
    }
    names.forEach(function (name) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        fail("SCHEMA_DATA_PROPERTY", pointerJoin(currentPath, name), "Object fields must be enumerable data properties");
      }
      visit(descriptor.value, pointerJoin(currentPath, name), depth + 1);
    });
  }
  visit(value, path || "/", 0);
}

function deepOrdinaryClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepOrdinaryClone);
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepOrdinaryClone(value[key]); });
  return output;
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepFrozenClone(value[key]); });
  return Object.freeze(output);
}

function requireObject(value, path) {
  if (!isPlainRecord(value)) fail("SCHEMA_OBJECT", path, "Expected an object");
  return value;
}

function exactFields(value, fields, path) {
  requireObject(value, path);
  const allowed = new Set(fields);
  Object.keys(value).forEach(function (key) {
    if (!allowed.has(key)) fail("SCHEMA_UNKNOWN_KEY", pointerJoin(path, key), "Unknown key " + JSON.stringify(key));
  });
  fields.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("SCHEMA_REQUIRED", pointerJoin(path, key), "Missing required key " + JSON.stringify(key));
    }
  });
  return value;
}

function requireArray(value, path, minimum, maximum) {
  if (!Array.isArray(value)) fail("SCHEMA_ARRAY", path, "Expected an array");
  if (minimum !== undefined && value.length < minimum) fail("SCHEMA_LIMIT", path, "Array has too few records");
  if (maximum !== undefined && value.length > maximum) fail("SCHEMA_LIMIT", path, "Array exceeds its record limit");
  return value;
}

function requireInteger(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail("SCHEMA_INTEGER", path, "Expected a safe integer");
  if (value < minimum || value > maximum) fail("SCHEMA_RANGE", path, "Integer is outside its allowed range");
  return value;
}

function requireBoolean(value, path) {
  if (typeof value !== "boolean") fail("SCHEMA_BOOLEAN", path, "Expected a boolean");
  return value;
}

function requireId(value, path) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) fail("SCHEMA_STRING", path, "Expected a stable ASCII ID");
  return value;
}

function requireStringKey(value, path) {
  if (typeof value !== "string" || !STRING_KEY.test(value)) fail("SCHEMA_STRING", path, "Expected a localization key");
  return value;
}

function requireEnum(value, allowed, path) {
  if (typeof value !== "string" || allowed.indexOf(value) === -1) {
    fail("SCHEMA_ENUM", path, "Unsupported value " + JSON.stringify(value));
  }
  return value;
}

function requireDecimal(value, path, positive) {
  if (typeof value !== "string" || !EXACT_DECIMAL.test(value)) {
    fail("SCHEMA_DECIMAL", path, "Expected an exact authored decimal string with at most three places");
  }
  if (positive && /^0(?:\.0{1,3})?$/.test(value)) fail("SCHEMA_DECIMAL", path, "Expected a positive authored decimal");
  return value;
}

function requireSortedUniqueIds(value, path, minimum, maximum) {
  requireArray(value, path, minimum, maximum);
  let previous = null;
  const output = new Set();
  value.forEach(function (item, index) {
    requireId(item, pointerJoin(path, index));
    if (previous !== null && previous >= item) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(path, index), "IDs must be unique and strictly ASCII sorted");
    }
    previous = item;
    output.add(item);
  });
  return output;
}

function requireRecordOrder(records, path, field) {
  const idField = field || "id";
  let previous = null;
  const ids = new Set();
  records.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    requireObject(record, recordPath);
    const value = record[idField];
    requireId(value, pointerJoin(recordPath, idField));
    if (previous !== null && previous >= value) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(recordPath, idField), "Records must be unique and strictly ASCII sorted");
    }
    previous = value;
    ids.add(value);
  });
  return ids;
}

/* ---- parameter-specification interpreter -------------------------------------------- */

function validateSpecValue(spec, value, path, context) {
  switch (spec.t) {
    case "int":
      return requireInteger(value, path, spec.min, spec.max);
    case "nullableInt":
      if (value === null) return null;
      return requireInteger(value, path, spec.min, spec.max);
    case "timer":
      requireInteger(value, path, spec.min, LIMITS.maxMilliseconds);
      return value;
    case "dec":
      return requireDecimal(value, path, spec.positive);
    case "bool":
      return requireBoolean(value, path);
    case "id":
      return requireId(value, path);
    case "key":
      return requireStringKey(value, path);
    case "const":
      if (value !== spec.value) {
        fail("BEHAVIOR_PARAMETER_VALUE", path, "Value must be exactly " + JSON.stringify(spec.value));
      }
      return value;
    case "enum":
      return requireEnum(value, spec.values, path);
    case "cat": {
      requireId(value, path);
      if (Catalog.RULE_CATALOG[spec.catalog].indexOf(value) === -1) {
        fail("REFERENCE_UNKNOWN", path, "ID is not present in the closed compiler rule catalog");
      }
      return value;
    }
    case "status": {
      requireId(value, path);
      context.statusReferences.push({ id: value, path: path });
      return value;
    }
    case "damageType": {
      requireId(value, path);
      context.damageTypeReferences.push({ id: value, path: path });
      return value;
    }
    case "rangeSource":
      exactFields(value, ["kind"], path);
      if (value.kind !== "level-range") {
        fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Only level-range is supported");
      }
      return value;
    case "policySource":
      requireObject(value, path);
      if (value.kind === "equipped-policy") {
        exactFields(value, ["kind"], path);
        return value;
      }
      if (value.kind === "fixed") {
        exactFields(value, ["kind", "targetPolicyId"], path);
        requireEnum(
          value.targetPolicyId,
          Object.keys(Catalog.TARGET_POLICY_RECORDS),
          pointerJoin(path, "targetPolicyId")
        );
        return value;
      }
      fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Unsupported target-policy source");
      return value;
    case "targetKinds": {
      const kinds = requireSortedUniqueIds(value, path, 1, Catalog.TARGET_KINDS.length);
      Array.from(kinds).forEach(function (kind, index) {
        if (Catalog.TARGET_KINDS.indexOf(kind) === -1) {
          fail("REFERENCE_UNKNOWN", pointerJoin(path, index), "Unknown target kind");
        }
      });
      return value;
    }
    case "event": {
      requireId(value, path);
      context.eventReferences.push({ id: value, path: path, phase: spec.phase });
      return value;
    }
    case "bpArray": {
      requireArray(value, path, spec.minLength, spec.maxLength);
      value.forEach(function (item, index) {
        requireInteger(item, pointerJoin(path, index), spec.min, spec.max);
      });
      return value;
    }
    case "record": {
      if (spec.nullable && value === null) return null;
      if (value === null) fail("SCHEMA_REQUIRED", path, "Record is not nullable");
      const fields = Object.keys(spec.fields);
      exactFields(value, fields, path);
      fields.forEach(function (fieldName) {
        validateSpecValue(spec.fields[fieldName], value[fieldName], pointerJoin(path, fieldName), context);
      });
      return value;
    }
    default:
      fail("BEHAVIOR_PARAMETER_VALUE", path, "Unknown parameter specification");
      return value;
  }
}

function validateBehaviorRecord(behavior, path, context, priorBehaviors) {
  exactFields(behavior, ["id", "contractId", "version", "deliveryKind", "parameters"], path);
  requireId(behavior.id, pointerJoin(path, "id"));
  if (priorBehaviors.has(behavior.id)) {
    fail("SCHEMA_DUPLICATE_ID", pointerJoin(path, "id"), "Duplicate behavior ID in level");
  }
  requireId(behavior.contractId, pointerJoin(path, "contractId"));
  requireInteger(behavior.version, pointerJoin(path, "version"), 1, 2);
  requireId(behavior.deliveryKind, pointerJoin(path, "deliveryKind"));
  const deliveryKey = behavior.contractId + "@" + behavior.version + "/" + behavior.deliveryKind;
  const spec = Object.prototype.hasOwnProperty.call(Catalog.DELIVERY_SPECS, deliveryKey)
    ? Catalog.DELIVERY_SPECS[deliveryKey]
    : null;
  if (!spec) fail("BEHAVIOR_DELIVERY", path, "Unsupported behavior contract/version/delivery combination");
  context.deliveryKeys.add(deliveryKey);
  const parameterPath = pointerJoin(path, "parameters");
  const fields = Object.keys(spec);
  exactFields(behavior.parameters, fields, parameterPath);
  fields.forEach(function (fieldName) {
    validateSpecValue(spec[fieldName], behavior.parameters[fieldName], pointerJoin(parameterPath, fieldName), context);
  });
  if (Object.prototype.hasOwnProperty.call(spec, "triggerBehaviorId")) {
    const trigger = priorBehaviors.get(behavior.parameters.triggerBehaviorId);
    if (!trigger) {
      fail(
        "BEHAVIOR_TRIGGER_ORDER",
        pointerJoin(parameterPath, "triggerBehaviorId"),
        "Trigger must reference an earlier behavior in the same record"
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(spec, "summonRecordId")) {
    context.summonReferences.push({
      id: behavior.parameters.summonRecordId,
      path: pointerJoin(parameterPath, "summonRecordId"),
      contractId: behavior.contractId,
    });
  }
  priorBehaviors.set(behavior.id, behavior);
}

function validateCombatRecordBody(record, path, context) {
  requireDecimal(record.rangeWorldUnits, pointerJoin(path, "rangeWorldUnits"), true);
  const behaviorsPath = pointerJoin(path, "behaviors");
  requireArray(record.behaviors, behaviorsPath, 1, LIMITS.maxBehaviorsPerLevel);
  const priorBehaviors = new Map();
  record.behaviors.forEach(function (behavior, index) {
    validateBehaviorRecord(behavior, pointerJoin(behaviorsPath, index), context, priorBehaviors);
  });
  const uiPath = pointerJoin(path, "ui");
  exactFields(record.ui, ["descriptionKey", "statFieldIds"], uiPath);
  requireStringKey(record.ui.descriptionKey, pointerJoin(uiPath, "descriptionKey"));
  context.stringReferences.push({
    id: record.ui.descriptionKey,
    path: pointerJoin(uiPath, "descriptionKey"),
  });
  const statPath = pointerJoin(uiPath, "statFieldIds");
  requireArray(record.ui.statFieldIds, statPath, 1, 8);
  const seenStats = new Set();
  record.ui.statFieldIds.forEach(function (statId, index) {
    requireEnum(statId, Catalog.TYPED_STAT_FIELD_IDS, pointerJoin(statPath, index));
    if (seenStats.has(statId)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(statPath, index), "Duplicate stat field");
    seenStats.add(statId);
  });
}

/* ---- campaign rules ----------------------------------------------------------------- */

const V3_CAMPAIGN_FIELDS = [
  "schemaVersion", "id", "difficultyPresets", "assistRecord", "targetPolicyRecords",
  "statusIds", "damageTypeIds", "ruleCatalog", "campaignModifierRecords", "accessGrantIds",
  "missionCatalogIds", "scoreRules",
];
const V4_CAMPAIGN_EXTENSION_FIELDS = [
  "protocolRules", "relicRules", "reinforcementRules", "reconRules", "targetShapeIds",
  "combatSourceKinds", "reinforcementMarkerKinds", "profileGrantKinds",
];
const V4_CAMPAIGN_FIELDS = V3_CAMPAIGN_FIELDS.concat(V4_CAMPAIGN_EXTENSION_FIELDS);

function validateV4CampaignRulesCore(value, path) {
  exactFields(value, V4_CAMPAIGN_FIELDS, path);
  requireInteger(
    value.schemaVersion,
    pointerJoin(path, "schemaVersion"),
    Catalog.CAMPAIGN_RULES_SCHEMA_VERSION,
    Catalog.CAMPAIGN_RULES_SCHEMA_VERSION
  );

  // Reuse the reviewed v3 contract verbatim for every retained campaign field.
  const projection = deepOrdinaryClone(value);
  V4_CAMPAIGN_EXTENSION_FIELDS.forEach(function (field) { delete projection[field]; });
  projection.schemaVersion = 1;
  V3Records.validateCampaignRules(projection);

  const protocolPath = pointerJoin(path, "protocolRules");
  exactFields(value.protocolRules, [
    "initialSlotCap", "maximumSlotCap", "maximumLaurels", "repeatCostStepBp",
    "sharedCooldownMs", "respecPolicyId", "tierCosts",
  ], protocolPath);
  requireInteger(value.protocolRules.initialSlotCap, pointerJoin(protocolPath, "initialSlotCap"), 0, 0);
  requireInteger(value.protocolRules.maximumSlotCap, pointerJoin(protocolPath, "maximumSlotCap"), 2, 2);
  requireInteger(value.protocolRules.maximumLaurels, pointerJoin(protocolPath, "maximumLaurels"), 180, 180);
  requireInteger(value.protocolRules.repeatCostStepBp, pointerJoin(protocolPath, "repeatCostStepBp"), 2500, 2500);
  requireInteger(value.protocolRules.sharedCooldownMs, pointerJoin(protocolPath, "sharedCooldownMs"), 15000, 15000);
  requireEnum(
    value.protocolRules.respecPolicyId,
    ["free-out-of-run-refund"],
    pointerJoin(protocolPath, "respecPolicyId")
  );
  const tierPath = pointerJoin(protocolPath, "tierCosts");
  requireArray(value.protocolRules.tierCosts, tierPath, 3, 3);
  const expectedTiers = [[1, 0, 0], [2, 6, 6], [3, 12, 18]];
  value.protocolRules.tierCosts.forEach(function (record, index) {
    const recordPath = pointerJoin(tierPath, index);
    exactFields(record, ["tier", "incrementalLaurels", "cumulativeLaurels"], recordPath);
    const expected = expectedTiers[index];
    if (record.tier !== expected[0] || record.incrementalLaurels !== expected[1] ||
        record.cumulativeLaurels !== expected[2]) {
      fail("V4_PROTOCOL_TIER_LOCK", recordPath, "Protocol tier Laurel costs are binding");
    }
  });

  const relicPath = pointerJoin(path, "relicRules");
  exactFields(value.relicRules, [
    "initialSlotCap", "maximumSlotCap", "compositionOrderId", "clampPolicyId", "statPolicies",
  ], relicPath);
  requireInteger(value.relicRules.initialSlotCap, pointerJoin(relicPath, "initialSlotCap"), 0, 0);
  requireInteger(value.relicRules.maximumSlotCap, pointerJoin(relicPath, "maximumSlotCap"), 2, 2);
  requireEnum(
    value.relicRules.compositionOrderId,
    ["sum-basis-point-deltas-in-ascii-relic-order"],
    pointerJoin(relicPath, "compositionOrderId")
  );
  requireEnum(
    value.relicRules.clampPolicyId,
    ["clamp-once-then-round-once"],
    pointerJoin(relicPath, "clampPolicyId")
  );
  const policyPath = pointerJoin(relicPath, "statPolicies");
  const expectedPolicies = Catalog.RELIC_STAT_POLICIES;
  requireArray(value.relicRules.statPolicies, policyPath, expectedPolicies.length, expectedPolicies.length);
  value.relicRules.statPolicies.forEach(function (record, index) {
    const recordPath = pointerJoin(policyPath, index);
    exactFields(record, ["statId", "operation", "rounding", "baseAmount", "minimum", "maximum"], recordPath);
    const expected = expectedPolicies[index];
    Object.keys(expected).forEach(function (field) {
      if (record[field] !== expected[field]) {
        fail("V4_RELIC_CLAMP_LOCK", pointerJoin(recordPath, field), "Relic stat policy differs from the approved clamp table");
      }
    });
  });

  const reinforcementPath = pointerJoin(path, "reinforcementRules");
  exactFields(value.reinforcementRules, ["initialSlotCap", "maximumSlotCap", "maximumActive"], reinforcementPath);
  requireInteger(value.reinforcementRules.initialSlotCap, pointerJoin(reinforcementPath, "initialSlotCap"), 0, 0);
  requireInteger(value.reinforcementRules.maximumSlotCap, pointerJoin(reinforcementPath, "maximumSlotCap"), 1, 1);
  requireInteger(value.reinforcementRules.maximumActive, pointerJoin(reinforcementPath, "maximumActive"), 1, 1);

  const reconPath = pointerJoin(path, "reconRules");
  exactFields(value.reconRules, ["initialTier", "maximumTier", "simulationAffecting"], reconPath);
  requireInteger(value.reconRules.initialTier, pointerJoin(reconPath, "initialTier"), 0, 0);
  requireInteger(value.reconRules.maximumTier, pointerJoin(reconPath, "maximumTier"), 3, 3);
  if (value.reconRules.simulationAffecting !== false) {
    fail("V4_RECON_LOCK", pointerJoin(reconPath, "simulationAffecting"), "Recon can never affect simulation");
  }

  [
    ["targetShapeIds", Catalog.TARGET_SHAPE_IDS],
    ["combatSourceKinds", Catalog.COMBAT_SOURCE_KINDS],
    ["reinforcementMarkerKinds", Catalog.REINFORCEMENT_MARKER_KINDS],
    ["profileGrantKinds", Catalog.PROFILE_GRANT_KINDS],
  ].forEach(function (entry) {
    const fieldPath = pointerJoin(path, entry[0]);
    requireArray(value[entry[0]], fieldPath, entry[1].length, entry[1].length);
    value[entry[0]].forEach(function (item, index) {
      if (item !== entry[1][index]) {
        fail("V4_MEMBERSHIP_LOCK", pointerJoin(fieldPath, index), "Membership list differs from the approved catalog");
      }
    });
  });
}

function validateV4CampaignRules(value) {
  preflight(value, "/");
  validateV4CampaignRulesCore(value, "/");
  return deepFrozenClone(value);
}

/* ---- defenses ----------------------------------------------------------------------- */

function validateSummonRecords(value, path) {
  requireArray(value, path, 0, LIMITS.maxSummonRecords);
  const ids = requireRecordOrder(value, path);
  value.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    exactFields(record, ["id", "kind", "targetKinds", "acceptedContactsBeforeConsume", "semanticEventIds"], recordPath);
    requireEnum(record.kind, Catalog.SUMMON_KINDS, pointerJoin(recordPath, "kind"));
    requireSortedUniqueIds(record.targetKinds, pointerJoin(recordPath, "targetKinds"), 1, Catalog.TARGET_KINDS.length);
    record.targetKinds.forEach(function (kind, kindIndex) {
      if (Catalog.TARGET_KINDS.indexOf(kind) === -1) {
        fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(recordPath, "targetKinds"), kindIndex), "Unknown target kind");
      }
    });
    if (record.kind === "fixed-marker-guard") {
      if (record.targetKinds.length !== 1 || record.targetKinds[0] !== "ground" ||
          record.acceptedContactsBeforeConsume !== 1) {
        fail("SUMMON_FIXED_MARKER_CONTRACT", recordPath, "Guard summons are consumed after exactly one ground contact");
      }
    } else {
      requireInteger(record.acceptedContactsBeforeConsume, pointerJoin(recordPath, "acceptedContactsBeforeConsume"), 0, 32);
    }
    requireSortedUniqueIds(
      record.semanticEventIds,
      pointerJoin(recordPath, "semanticEventIds"),
      1,
      LIMITS.maxSemanticEventsPerOwner
    );
  });
  return ids;
}

function validateDefenseRecord(record, path, context) {
  exactFields(record, [
    "id", "nameKey", "roleKey", "weaknessKey", "unlockId", "targetKinds",
    "allowedTargetPolicyIds", "defaultTargetPolicyId", "defenseTags", "levels",
    "specializations", "semanticEventIds",
  ], path);
  requireId(record.id, pointerJoin(path, "id"));
  ["nameKey", "roleKey", "weaknessKey"].forEach(function (field) {
    requireStringKey(record[field], pointerJoin(path, field));
    context.stringReferences.push({ id: record[field], path: pointerJoin(path, field) });
  });
  requireId(record.unlockId, pointerJoin(path, "unlockId"));
  requireSortedUniqueIds(record.targetKinds, pointerJoin(path, "targetKinds"), 1, Catalog.TARGET_KINDS.length);
  record.targetKinds.forEach(function (kind, index) {
    if (Catalog.TARGET_KINDS.indexOf(kind) === -1) {
      fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(path, "targetKinds"), index), "Unknown target kind");
    }
  });
  requireSortedUniqueIds(record.allowedTargetPolicyIds, pointerJoin(path, "allowedTargetPolicyIds"), 1, 3);
  if (record.allowedTargetPolicyIds.indexOf(record.defaultTargetPolicyId) === -1) {
    fail("REFERENCE_UNKNOWN", pointerJoin(path, "defaultTargetPolicyId"), "Default policy must be allowed");
  }
  requireSortedUniqueIds(record.defenseTags, pointerJoin(path, "defenseTags"), 1, 32);
  const ownedEvents = requireSortedUniqueIds(
    record.semanticEventIds,
    pointerJoin(path, "semanticEventIds"),
    0,
    LIMITS.maxSemanticEventsPerOwner
  );

  const levelsPath = pointerJoin(path, "levels");
  requireArray(record.levels, levelsPath, LIMITS.levelsPerDefense, LIMITS.levelsPerDefense);
  const costs = Catalog.DEFENSE_COSTS[record.id];
  if (!costs) fail("V4_DEFENSE_ROSTER", pointerJoin(path, "id"), "Unknown campaign defense family");
  const recordEvents = [];
  record.levels.forEach(function (level, index) {
    const levelPath = pointerJoin(levelsPath, index);
    exactFields(level, ["level", "purchase", "rangeWorldUnits", "behaviors", "ui"], levelPath);
    requireInteger(level.level, pointerJoin(levelPath, "level"), index + 1, index + 1);
    const purchasePath = pointerJoin(levelPath, "purchase");
    exactFields(level.purchase, ["kind", "costAether"], purchasePath);
    requireEnum(level.purchase.kind, [index === 0 ? "build" : "upgrade"], pointerJoin(purchasePath, "kind"));
    if (level.purchase.costAether !== costs[index]) {
      fail("V4_DEFENSE_COST_LOCK", pointerJoin(purchasePath, "costAether"), "Level cost differs from the binding campaign baseline");
    }
    const before = context.eventReferences.length;
    validateCombatRecordBody(level, levelPath, context);
    for (let cursor = before; cursor < context.eventReferences.length; cursor++) {
      recordEvents.push(context.eventReferences[cursor]);
    }
  });

  const specializationsPath = pointerJoin(path, "specializations");
  requireArray(
    record.specializations,
    specializationsPath,
    LIMITS.specializationsPerDefense,
    LIMITS.specializationsPerDefense
  );
  requireRecordOrder(record.specializations, specializationsPath);
  let defaultCount = 0;
  record.specializations.forEach(function (specialization, index) {
    const specializationPath = pointerJoin(specializationsPath, index);
    exactFields(specialization, [
      "id", "defenseId", "isDefault", "branchRoleId", "nameKey", "unlockGrantId", "level",
      "purchase", "rangeWorldUnits", "behaviors", "ui",
    ], specializationPath);
    requireId(specialization.id, pointerJoin(specializationPath, "id"));
    if (specialization.defenseId !== record.id) {
      fail("V4_SPECIALIZATION_OWNER", pointerJoin(specializationPath, "defenseId"), "Specialization must belong to its defense family");
    }
    requireBoolean(specialization.isDefault, pointerJoin(specializationPath, "isDefault"));
    if (specialization.isDefault) defaultCount++;
    requireId(specialization.branchRoleId, pointerJoin(specializationPath, "branchRoleId"));
    requireStringKey(specialization.nameKey, pointerJoin(specializationPath, "nameKey"));
    context.stringReferences.push({
      id: specialization.nameKey,
      path: pointerJoin(specializationPath, "nameKey"),
    });
    requireId(specialization.unlockGrantId, pointerJoin(specializationPath, "unlockGrantId"));
    requireInteger(specialization.level, pointerJoin(specializationPath, "level"), 3, 3);
    const purchasePath = pointerJoin(specializationPath, "purchase");
    exactFields(specialization.purchase, ["kind", "costAether"], purchasePath);
    requireEnum(specialization.purchase.kind, ["specialize"], pointerJoin(purchasePath, "kind"));
    if (specialization.purchase.costAether !== costs[2]) {
      fail(
        "V4_SPECIALIZATION_COST",
        pointerJoin(purchasePath, "costAether"),
        "Both branches must charge the family Level-3 cost"
      );
    }
    const before = context.eventReferences.length;
    validateCombatRecordBody(specialization, specializationPath, context);
    for (let cursor = before; cursor < context.eventReferences.length; cursor++) {
      recordEvents.push(context.eventReferences[cursor]);
    }
    context.specializationRecords.push({ record: specialization, path: specializationPath });
  });
  if (defaultCount !== 1) {
    fail("V4_SPECIALIZATION_DEFAULT", specializationsPath, "Exactly one specialization per family is the default branch");
  }

  recordEvents.forEach(function (reference) {
    if (!ownedEvents.has(reference.id)) {
      fail("EVENT_OWNERSHIP", reference.path, "Emitted event is absent from defense semanticEventIds");
    }
  });
  context.defenseRecords.push({ record: record, path: path });
}

function validateV4DefenseSourceCore(value, path, context) {
  exactFields(value, ["schemaVersion", "id", "summonRecords", "records"], path);
  requireInteger(
    value.schemaVersion,
    pointerJoin(path, "schemaVersion"),
    Catalog.DEFENSE_SOURCE_SCHEMA_VERSION,
    Catalog.DEFENSE_SOURCE_SCHEMA_VERSION
  );
  requireId(value.id, pointerJoin(path, "id"));
  const summonIds = validateSummonRecords(value.summonRecords, pointerJoin(path, "summonRecords"));

  const recordsPath = pointerJoin(path, "records");
  requireArray(value.records, recordsPath, LIMITS.maxDefenses, LIMITS.maxDefenses);
  const ids = requireRecordOrder(value.records, recordsPath);
  Catalog.DEFENSE_IDS.forEach(function (defenseId, index) {
    if (value.records[index].id !== defenseId) {
      fail("V4_DEFENSE_ROSTER", pointerJoin(pointerJoin(recordsPath, index), "id"), "The fifteen campaign families are binding and ASCII ordered");
    }
  });
  value.records.forEach(function (record, index) {
    validateDefenseRecord(record, pointerJoin(recordsPath, index), context);
  });
  context.summonReferences.forEach(function (reference) {
    if (!summonIds.has(reference.id)) fail("REFERENCE_UNKNOWN", reference.path, "Unknown summon record");
  });
  const referenced = new Set(context.summonReferences.map(function (reference) { return reference.id; }));
  value.summonRecords.forEach(function (record, index) {
    if (!referenced.has(record.id)) {
      fail("SUMMON_UNUSED", pointerJoin(pointerJoin(pointerJoin(path, "summonRecords"), index), "id"), "Summon record is unused");
    }
    record.semanticEventIds.forEach(function (eventId, eventIndex) {
      context.eventReferences.push({
        id: eventId,
        path: pointerJoin(pointerJoin(pointerJoin(pointerJoin(path, "summonRecords"), index), "semanticEventIds"), eventIndex),
        phase: null,
      });
    });
  });
  return ids;
}

function createReferenceContext() {
  return {
    eventReferences: [],
    stringReferences: [],
    statusReferences: [],
    damageTypeReferences: [],
    summonReferences: [],
    specializationRecords: [],
    defenseRecords: [],
    missionRecords: [],
    deliveryKeys: new Set(),
  };
}

function validateV4DefenseSource(value) {
  preflight(value, "/");
  const context = createReferenceContext();
  validateV4DefenseSourceCore(value, "/", context);
  return deepFrozenClone(value);
}

/* ---- event catalog ------------------------------------------------------------------ */

function validateV4EventCatalogCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "records"], path);
  requireInteger(
    value.schemaVersion,
    pointerJoin(path, "schemaVersion"),
    Catalog.EVENT_SCHEMA_VERSION,
    Catalog.EVENT_SCHEMA_VERSION
  );
  requireId(value.id, pointerJoin(path, "id"));
  const recordsPath = pointerJoin(path, "records");
  requireArray(value.records, recordsPath, 1, LIMITS.maxCatalogRecords);
  requireRecordOrder(value.records, recordsPath);
  value.records.forEach(function (record, index) {
    const recordPath = pointerJoin(recordsPath, index);
    exactFields(record, ["id", "version", "phaseId", "payloadFields", "highlightTags", "presentationCueId"], recordPath);
    requireInteger(record.version, pointerJoin(recordPath, "version"), 1, 2);
    requireEnum(record.phaseId, Catalog.PHASE_IDS, pointerJoin(recordPath, "phaseId"));
    const fieldsPath = pointerJoin(recordPath, "payloadFields");
    requireArray(record.payloadFields, fieldsPath, 0, 64);
    const names = new Set();
    record.payloadFields.forEach(function (field, fieldIndex) {
      const fieldPath = pointerJoin(fieldsPath, fieldIndex);
      exactFields(field, ["name", "type", "required", "nullable"], fieldPath);
      requireId(field.name, pointerJoin(fieldPath, "name"));
      if (names.has(field.name)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(fieldPath, "name"), "Duplicate payload field name");
      names.add(field.name);
      requireEnum(field.type, ["boolean", "id", "id-array", "integer", "string-key"], pointerJoin(fieldPath, "type"));
      requireBoolean(field.required, pointerJoin(fieldPath, "required"));
      requireBoolean(field.nullable, pointerJoin(fieldPath, "nullable"));
    });
    requireSortedUniqueIds(record.highlightTags, pointerJoin(recordPath, "highlightTags"), 0, 32);
    requireId(record.presentationCueId, pointerJoin(recordPath, "presentationCueId"));
  });
}

function validateV4EventCatalog(value) {
  preflight(value, "/");
  validateV4EventCatalogCore(value, "/");
  return deepFrozenClone(value);
}

/* ---- missions ----------------------------------------------------------------------- */

const V4_MISSION_EXTENSION_FIELDS = ["protocolLoan", "mechanism", "reinforcementMarkers"];
/* Spec 18.3 narrative additions. They are authored inside the retained v3 briefing and wave
   records, so they are lifted out of the v3 projection and validated here instead. */
const V4_BRIEFING_EXTENSION_FIELDS = ["storyKey"];
const V4_WAVE_EXTENSION_FIELDS = ["noteKey"];

function validateV4MissionCore(value, path, context) {
  requireObject(value, path);
  V4_MISSION_EXTENSION_FIELDS.forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      fail("SCHEMA_REQUIRED", pointerJoin(path, field), "Missing required key " + JSON.stringify(field));
    }
  });
  if (value.schemaVersion !== Catalog.MISSION_SOURCE_SCHEMA_VERSION) {
    fail("SCHEMA_LITERAL", pointerJoin(path, "schemaVersion"), "V4 mission source schemaVersion must be exactly 2");
  }

  // Retained v3 mission body: validate through the reviewed v3 contract verbatim.
  const projection = deepOrdinaryClone(value);
  V4_MISSION_EXTENSION_FIELDS.forEach(function (field) { delete projection[field]; });
  if (isPlainRecord(projection.briefing)) {
    V4_BRIEFING_EXTENSION_FIELDS.forEach(function (field) { delete projection.briefing[field]; });
  }
  if (Array.isArray(projection.waves)) {
    projection.waves.forEach(function (wave) {
      if (!isPlainRecord(wave)) return;
      V4_WAVE_EXTENSION_FIELDS.forEach(function (field) { delete wave[field]; });
    });
  }
  projection.schemaVersion = 1;
  V3Records.validateMissionSource(projection);

  const briefingPath = pointerJoin(path, "briefing");
  requireObject(value.briefing, briefingPath);
  V4_BRIEFING_EXTENSION_FIELDS.forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(value.briefing, field)) {
      fail("SCHEMA_REQUIRED", pointerJoin(briefingPath, field), "Missing required key " + JSON.stringify(field));
    }
    requireStringKey(value.briefing[field], pointerJoin(briefingPath, field));
  });

  const wavesPath = pointerJoin(path, "waves");
  requireArray(value.waves, wavesPath, 1, LIMITS.maxCatalogRecords);
  value.waves.forEach(function (wave, index) {
    const wavePath = pointerJoin(wavesPath, index);
    requireObject(wave, wavePath);
    V4_WAVE_EXTENSION_FIELDS.forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(wave, field)) {
        fail("SCHEMA_REQUIRED", pointerJoin(wavePath, field), "Missing required key " + JSON.stringify(field));
      }
      requireStringKey(wave[field], pointerJoin(wavePath, field));
    });
  });

  const loanPath = pointerJoin(path, "protocolLoan");
  if (value.protocolLoan !== null) {
    exactFields(value.protocolLoan, ["protocolId", "tier"], loanPath);
    requireId(value.protocolLoan.protocolId, pointerJoin(loanPath, "protocolId"));
    if (value.protocolLoan.tier !== 1) {
      fail("V4_PROTOCOL_LOAN_TIER", pointerJoin(loanPath, "tier"), "Tutorial loans are exactly Tier 1");
    }
  }

  const mechanismPath = pointerJoin(path, "mechanism");
  if (value.mechanism !== null) {
    exactFields(value.mechanism, ["mechanismId", "activations"], mechanismPath);
    requireId(value.mechanism.mechanismId, pointerJoin(mechanismPath, "mechanismId"));
    const activationsPath = pointerJoin(mechanismPath, "activations");
    requireArray(value.mechanism.activations, activationsPath, 1, LIMITS.maxMechanismActivations);
    requireRecordOrder(value.mechanism.activations, activationsPath);
    value.mechanism.activations.forEach(function (activation, index) {
      const activationPath = pointerJoin(activationsPath, index);
      exactFields(activation, ["id", "kind", "geometryId"], activationPath);
      requireEnum(
        activation.kind,
        ["beam-line", "gate-contact", "rubble-region", "zone"],
        pointerJoin(activationPath, "kind")
      );
      requireId(activation.geometryId, pointerJoin(activationPath, "geometryId"));
    });
  }

  const markersPath = pointerJoin(path, "reinforcementMarkers");
  requireArray(value.reinforcementMarkers, markersPath, 0, LIMITS.maxReinforcementMarkers);
  requireRecordOrder(value.reinforcementMarkers, markersPath);
  value.reinforcementMarkers.forEach(function (marker, index) {
    const markerPath = pointerJoin(markersPath, index);
    exactFields(marker, ["id", "column", "row", "supportedReinforcementIds"], markerPath);
    requireInteger(marker.column, pointerJoin(markerPath, "column"), 0, LIMITS.boardColumns - 1);
    requireInteger(marker.row, pointerJoin(markerPath, "row"), 0, LIMITS.boardRows - 1);
    requireSortedUniqueIds(marker.supportedReinforcementIds, pointerJoin(markerPath, "supportedReinforcementIds"), 1, 8);
  });
  if (context) {
    context.missionRecords.push({ record: value, path: path });
  }
}

function validateV4MissionSource(value) {
  preflight(value, "/");
  validateV4MissionCore(value, "/", null);
  return deepFrozenClone(value);
}

/* ---- acts ---------------------------------------------------------------------------- */

/* Spec 18.2. Act records are presentation copy: four contiguous acts, each naming its own
   localized title, era, story, and premise, plus the missions that belong to it. The recon
   briefing lines live in the same authored file because campaign `reconRules` is a closed
   three-field simulation record and recon copy is briefing prose, not a simulation value. */
const ACT_SOURCE_SCHEMA_VERSION = 1;
const ACT_COUNT = 4;
const ACT_RECORD_FIELDS = ["index", "titleKey", "eraKey", "storyKey", "premiseKey", "missionIds"];
const ACT_STRING_KEY_FIELDS = ["titleKey", "eraKey", "storyKey", "premiseKey"];
const RECON_TIER_COUNT = 4;
const ACT_MISSION_ID = /^m(?:0[1-9]|1[0-9]|20)$/;

function validateV4ActSourceCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "records", "reconRecords"], path);
  requireInteger(
    value.schemaVersion,
    pointerJoin(path, "schemaVersion"),
    ACT_SOURCE_SCHEMA_VERSION,
    ACT_SOURCE_SCHEMA_VERSION
  );
  requireId(value.id, pointerJoin(path, "id"));

  const recordsPath = pointerJoin(path, "records");
  requireArray(value.records, recordsPath, ACT_COUNT, ACT_COUNT);
  const claimedMissionIds = new Set();
  value.records.forEach(function (record, index) {
    const recordPath = pointerJoin(recordsPath, index);
    exactFields(record, ACT_RECORD_FIELDS, recordPath);
    requireInteger(record.index, pointerJoin(recordPath, "index"), index + 1, index + 1);
    ACT_STRING_KEY_FIELDS.forEach(function (field) {
      requireStringKey(record[field], pointerJoin(recordPath, field));
    });
    const missionIdsPath = pointerJoin(recordPath, "missionIds");
    requireArray(record.missionIds, missionIdsPath, 0, 20);
    let priorMissionId = null;
    record.missionIds.forEach(function (missionId, missionIndex) {
      const missionPath = pointerJoin(missionIdsPath, missionIndex);
      if (typeof missionId !== "string" || !ACT_MISSION_ID.test(missionId)) {
        fail("SCHEMA_STRING", missionPath, "Act mission IDs must be m01 through m20");
      }
      if (priorMissionId !== null && priorMissionId >= missionId) {
        fail("SCHEMA_UNSTABLE_ORDER", missionPath, "Act mission IDs must be strictly ASCII sorted");
      }
      if (claimedMissionIds.has(missionId)) {
        fail("SCHEMA_DUPLICATE_ID", missionPath, "A mission belongs to exactly one act");
      }
      claimedMissionIds.add(missionId);
      priorMissionId = missionId;
    });
  });

  const reconPath = pointerJoin(path, "reconRecords");
  requireArray(value.reconRecords, reconPath, RECON_TIER_COUNT, RECON_TIER_COUNT);
  value.reconRecords.forEach(function (record, index) {
    const recordPath = pointerJoin(reconPath, index);
    exactFields(record, ["tier", "detailKey"], recordPath);
    requireInteger(record.tier, pointerJoin(recordPath, "tier"), index, index);
    requireStringKey(record.detailKey, pointerJoin(recordPath, "detailKey"));
  });
}

function validateV4ActSource(value) {
  preflight(value, "/");
  validateV4ActSourceCore(value, "/");
  return deepFrozenClone(value);
}

module.exports = Object.freeze({
  ACT_COUNT: ACT_COUNT,
  ACT_RECORD_FIELDS: ACT_RECORD_FIELDS,
  ACT_SOURCE_SCHEMA_VERSION: ACT_SOURCE_SCHEMA_VERSION,
  LIMITS: LIMITS,
  RECON_TIER_COUNT: RECON_TIER_COUNT,
  V4_BRIEFING_EXTENSION_FIELDS: V4_BRIEFING_EXTENSION_FIELDS,
  V4_CAMPAIGN_FIELDS: V4_CAMPAIGN_FIELDS,
  V4_CAMPAIGN_EXTENSION_FIELDS: V4_CAMPAIGN_EXTENSION_FIELDS,
  V4_MISSION_EXTENSION_FIELDS: V4_MISSION_EXTENSION_FIELDS,
  V4_WAVE_EXTENSION_FIELDS: V4_WAVE_EXTENSION_FIELDS,
  createReferenceContext: createReferenceContext,
  deepFrozenClone: deepFrozenClone,
  deepOrdinaryClone: deepOrdinaryClone,
  exactFields: exactFields,
  isPlainRecord: isPlainRecord,
  preflight: preflight,
  requireArray: requireArray,
  requireId: requireId,
  requireInteger: requireInteger,
  requireRecordOrder: requireRecordOrder,
  requireSortedUniqueIds: requireSortedUniqueIds,
  requireStringKey: requireStringKey,
  validateV4ActSource: validateV4ActSource,
  validateV4ActSourceCore: validateV4ActSourceCore,
  validateV4CampaignRules: validateV4CampaignRules,
  validateV4CampaignRulesCore: validateV4CampaignRulesCore,
  validateV4DefenseSource: validateV4DefenseSource,
  validateV4DefenseSourceCore: validateV4DefenseSourceCore,
  validateV4EventCatalog: validateV4EventCatalog,
  validateV4EventCatalogCore: validateV4EventCatalogCore,
  validateV4MissionCore: validateV4MissionCore,
  validateV4MissionSource: validateV4MissionSource,
});
