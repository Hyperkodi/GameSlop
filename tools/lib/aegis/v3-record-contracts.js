"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");
const { parseExactDecimal } = require("./exact-decimal.js");
const Catalog = require("./v3-rule-catalog.js");

const MAX_GROUPS_PER_WAVE = 32;
const MAX_SPAWN_COUNT = 1000;

const LIMITS = Object.freeze({
  maxSourceBytes: 1048576,
  maxDepth: 32,
  maxObjectFields: 64,
  maxDefenses: 15,
  levelsPerDefense: 3,
  maxRegularEnemies: 11,
  maxBosses: 5,
  maxMissions: 20,
  maxWavesPerMission: 12,
  maxGroupsPerWave: MAX_GROUPS_PER_WAVE,
  maxSpawnCount: MAX_SPAWN_COUNT,
  maxTotalSpawnsPerWave: MAX_GROUPS_PER_WAVE * MAX_SPAWN_COUNT,
  maxTotalChildrenPerSchedule: MAX_GROUPS_PER_WAVE * MAX_SPAWN_COUNT,
  maxSimultaneousWaveSpawns: MAX_GROUPS_PER_WAVE,
  maxBehaviorsPerLevel: 16,
  maxTraitsPerEnemy: 16,
  maxSemanticEventsPerOwner: 32,
  maxSimulationTick: 5184000,
  maxAether: 1000000,
  maxAuthoredQuantity: 1000000,
  maxScore: 1000000000,
  maxMilliseconds: 86400000,
  maxCatalogRecords: 1000,
  maxStringEntries: 4096,
});

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const STRING_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const LOCALE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const EXACT_DECIMAL = /^(0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/;
const PLACEHOLDER = /\{([A-Za-z0-9][A-Za-z0-9._:-]{0,63})\}/g;

const DELIVERY_BY_KEY = new Map(Catalog.BEHAVIOR_DELIVERIES.map(function (record) {
  return [record.contractId + "@" + record.version + "/" + record.deliveryKind, record];
}));

function preflight(value, path, options) {
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
    if (!current || typeof current !== "object") {
      fail("SCHEMA_TYPE", currentPath, "Records contain JSON data only");
    }
    if (seen.has(current)) {
      fail("SCHEMA_SHARED_REFERENCE", currentPath, "Cycles and shared references are forbidden");
    }
    seen.add(current);
    if (Object.getOwnPropertySymbols(current).length !== 0) {
      fail("SCHEMA_DATA_PROPERTY", currentPath, "Symbol properties are forbidden");
    }

    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) {
        fail("SCHEMA_OBJECT", currentPath, "Expected an ordinary JSON array prototype");
      }
      const names = Object.getOwnPropertyNames(current);
      for (let index = 0; index < current.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(current, index)) {
          fail("SCHEMA_DATA_PROPERTY", pointerJoin(currentPath, index), "Sparse arrays are forbidden");
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
          fail("SCHEMA_DATA_PROPERTY", pointerJoin(currentPath, index), "Array elements must be enumerable data properties");
        }
        visit(descriptor.value, pointerJoin(currentPath, index), depth + 1);
      }
      names.forEach(function (name) {
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
  let serialized;
  try { serialized = JSON.stringify(value); }
  catch (error) { fail("SCHEMA_TYPE", path || "/", "Record must be JSON serializable"); }
  if ((!options || options.sourceByteLimit !== false) && Buffer.byteLength(serialized, "utf8") > LIMITS.maxSourceBytes) {
    fail("SCHEMA_LIMIT", path || "/", "Record exceeds the one-source-file byte limit");
  }
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const result = Object.create(Object.getPrototypeOf(value));
  Object.keys(value).forEach(function (key) {
    Object.defineProperty(result, key, {
      value: deepFrozenClone(value[key]), enumerable: true, writable: true, configurable: true,
    });
  });
  return Object.freeze(result);
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("SCHEMA_OBJECT", path, "Expected an object");
  }
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
}

function requireArray(value, path, minimum, maximum) {
  if (!Array.isArray(value)) fail("SCHEMA_ARRAY", path, "Expected an array");
  if (minimum !== undefined && value.length < minimum) fail("SCHEMA_LIMIT", path, "Array has too few records");
  if (maximum !== undefined && value.length > maximum) fail("SCHEMA_LIMIT", path, "Array exceeds its record limit");
  return value;
}

function requireInteger(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail("SCHEMA_INTEGER", path, "Expected a safe integer");
  if ((minimum !== undefined && value < minimum) || (maximum !== undefined && value > maximum)) {
    fail("SCHEMA_RANGE", path, "Integer is outside its allowed range");
  }
  return value;
}

function requireTimerMinimum(value, path, minimum) {
  requireInteger(value, path, 1, LIMITS.maxMilliseconds);
  if (value < minimum) {
    fail("TIMER_MINIMUM", path, "ABI-v1 timer is shorter than its safe authored minimum");
  }
  return value;
}

function requireBoolean(value, path) {
  if (typeof value !== "boolean") fail("SCHEMA_BOOLEAN", path, "Expected a Boolean");
  return value;
}

function requireString(value, path) {
  if (typeof value !== "string") fail("SCHEMA_STRING", path, "Expected a string");
  return value;
}

function requireId(value, path) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) fail("SCHEMA_ID", path, "Expected a stable authored ID");
  return value;
}

function requireStringKey(value, path) {
  if (typeof value !== "string" || !STRING_KEY.test(value)) fail("SCHEMA_STRING_KEY", path, "Expected a stable string key");
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
    fail("DECIMAL_FORMAT", path, "Expected a plain nonnegative decimal with at most three fractional places");
  }
  const compiled = parseExactDecimal(value, 1000, path);
  const maximum = LIMITS.maxAuthoredQuantity * 1000;
  if (compiled > maximum || (positive && compiled === 0)) {
    fail("SCHEMA_RANGE", path, "Authored quantity is outside its allowed range");
  }
  return value;
}

function requireSortedUniqueIds(value, path, options) {
  options = options || {};
  requireArray(value, path, options.minimum, options.maximum);
  const seen = new Set();
  let prior = null;
  value.forEach(function (id, index) {
    const itemPath = pointerJoin(path, index);
    (options.stringKeys ? requireStringKey : requireId)(id, itemPath);
    if (seen.has(id)) fail("SCHEMA_DUPLICATE_ID", itemPath, "Duplicate ID " + JSON.stringify(id));
    if (prior !== null && prior > id) fail("SCHEMA_UNSTABLE_ORDER", itemPath, "Set IDs must use strict ASCII order");
    seen.add(id);
    prior = id;
  });
  return seen;
}

function requireUniqueDisplayIds(value, path, allowed) {
  requireArray(value, path, 1, 64);
  const seen = new Set();
  value.forEach(function (id, index) {
    const itemPath = pointerJoin(path, index);
    requireId(id, itemPath);
    if (seen.has(id)) fail("SCHEMA_DUPLICATE_ID", itemPath, "Duplicate display ID");
    if (allowed && allowed.indexOf(id) === -1) fail("REFERENCE_UNKNOWN", itemPath, "Unknown compiler-owned display ID");
    seen.add(id);
  });
  return seen;
}

function requireUniqueStringKeys(value, path, minimum) {
  requireArray(value, path, minimum === undefined ? 0 : minimum, 64);
  const seen = new Set();
  value.forEach(function (key, index) {
    const itemPath = pointerJoin(path, index);
    requireStringKey(key, itemPath);
    if (seen.has(key)) fail("SCHEMA_DUPLICATE_ID", itemPath, "Duplicate authored string key");
    seen.add(key);
  });
  return seen;
}

function requireExactArray(actual, expected, path, code) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some(function (value, index) {
    return value !== expected[index];
  })) {
    fail(code, path, "Record does not match the closed compiler-owned catalog");
  }
}

function requireRecordOrder(records, path, idField) {
  const seen = new Set();
  let prior = null;
  records.forEach(function (record, index) {
    const idPath = pointerJoin(pointerJoin(path, index), idField || "id");
    requireObject(record, pointerJoin(path, index));
    const id = record[idField || "id"];
    (idField === "key" ? requireStringKey : requireId)(id, idPath);
    if (seen.has(id)) fail("SCHEMA_DUPLICATE_ID", idPath, "Duplicate record ID " + JSON.stringify(id));
    if (prior !== null && prior > id) fail("SCHEMA_UNSTABLE_ORDER", idPath, "Records must use strict ASCII ID order");
    seen.add(id);
    prior = id;
  });
  return seen;
}

function requireContiguousOrder(records, path, start) {
  records.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    requireObject(record, recordPath);
    requireInteger(record.order, pointerJoin(recordPath, "order"), start + index, start + index);
  });
}

function analyzeAuthoredSchedule(records, path, fields, aggregateLimit, simultaneousLimit) {
  let aggregateTotal = 0;
  let finalTick = 0;
  let maximumSimultaneousDue = 0;
  const dueByTick = new Map();

  records.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    const count = record[fields.count];
    const firstTick = record[fields.firstTick];
    const intervalTicks = record[fields.intervalTicks];
    const nextAggregate = aggregateTotal + count;
    if (!Number.isSafeInteger(nextAggregate) || nextAggregate > aggregateLimit) {
      fail("SCHEDULE_AGGREGATE_LIMIT", pointerJoin(recordPath, fields.count), "Authored schedule exceeds its closed aggregate create-event limit");
    }
    aggregateTotal = nextAggregate;

    const recordFinalTick = firstTick + (count - 1) * intervalTicks;
    if (!Number.isSafeInteger(recordFinalTick) || recordFinalTick > LIMITS.maxSimulationTick) {
      fail("SCHEMA_RANGE", pointerJoin(recordPath, fields.intervalTicks), "Authored schedule exceeds the maximum tick");
    }
    if (recordFinalTick > finalTick) finalTick = recordFinalTick;

    for (let occurrence = 0; occurrence < count; occurrence++) {
      const dueTick = firstTick + occurrence * intervalTicks;
      const simultaneous = (dueByTick.get(dueTick) || 0) + 1;
      if (!Number.isSafeInteger(simultaneous) || simultaneous > simultaneousLimit) {
        fail("SCHEDULE_SIMULTANEOUS_LIMIT", recordPath, "Authored schedule exceeds its closed simultaneous create-event limit");
      }
      dueByTick.set(dueTick, simultaneous);
      if (simultaneous > maximumSimultaneousDue) maximumSimultaneousDue = simultaneous;
    }
  });

  return Object.freeze({
    aggregateTotal: aggregateTotal,
    finalTick: finalTick,
    maximumSimultaneousDue: maximumSimultaneousDue,
  });
}

function requireCatalogReference(value, catalog, path) {
  requireId(value, path);
  if (catalog.indexOf(value) === -1) fail("REFERENCE_UNKNOWN", path, "ID is not present in the closed compiler catalog");
}

const CAMPAIGN_FIELDS = [
  "schemaVersion", "id", "difficultyPresets", "assistRecord", "targetPolicyRecords",
  "statusIds", "damageTypeIds", "ruleCatalog", "campaignModifierRecords", "accessGrantIds",
  "missionCatalogIds", "scoreRules",
];

const DIFFICULTY_LOCKS = [
  { id: "story", availabilityId: "difficulty.story", startAetherBp: 11900, integrity: 25, enemyHpBp: 8500, enemySpeedBp: 9500, bountyBp: 11000, scoreBp: 7500 },
  { id: "strategos", availabilityId: "difficulty.strategos", startAetherBp: 10000, integrity: 20, enemyHpBp: 10000, enemySpeedBp: 10000, bountyBp: 10000, scoreBp: 10000 },
  { id: "titan", availabilityId: "difficulty.titan", startAetherBp: 9100, integrity: 15, enemyHpBp: 12500, enemySpeedBp: 10800, bountyBp: 10000, scoreBp: 15000 },
];

function validateCampaignRulesCore(value, path) {
  exactFields(value, CAMPAIGN_FIELDS, path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));

  requireArray(value.difficultyPresets, pointerJoin(path, "difficultyPresets"), 3, 3);
  value.difficultyPresets.forEach(function (record, index) {
    const recordPath = pointerJoin(pointerJoin(path, "difficultyPresets"), index);
    exactFields(record, [
      "id", "availabilityId", "startAetherBp", "integrity", "enemyHpBp", "enemySpeedBp",
      "bountyBp", "scoreBp",
    ], recordPath);
    requireId(record.availabilityId, pointerJoin(recordPath, "availabilityId"));
    const lock = DIFFICULTY_LOCKS[index];
    Object.keys(lock).forEach(function (key) {
      if (record[key] !== lock[key]) fail("CAMPAIGN_DIFFICULTY_LOCK", pointerJoin(recordPath, key), "Difficulty binding value changed");
    });
  });

  const assistPath = pointerJoin(path, "assistRecord");
  exactFields(value.assistRecord, ["id", "startAetherAdd", "enemySpeedBp", "competitiveScoreEligible"], assistPath);
  if (value.assistRecord.id !== "assist" || value.assistRecord.startAetherAdd !== 20 ||
      value.assistRecord.enemySpeedBp !== 9200 || value.assistRecord.competitiveScoreEligible !== false) {
    fail("CAMPAIGN_ASSIST_LOCK", assistPath, "Assist binding record changed");
  }

  const policyPath = pointerJoin(path, "targetPolicyRecords");
  requireArray(value.targetPolicyRecords, policyPath, 3, 3);
  const expectedPolicies = [Catalog.TARGET_POLICY_RECORDS.FAST, Catalog.TARGET_POLICY_RECORDS.FRONT, Catalog.TARGET_POLICY_RECORDS.STRONG];
  value.targetPolicyRecords.forEach(function (record, index) {
    const recordPath = pointerJoin(policyPath, index);
    exactFields(record, ["id", "eligibilityRuleId", "comparatorIds"], recordPath);
    const expected = expectedPolicies[index];
    if (record.id !== expected.id || record.eligibilityRuleId !== expected.eligibilityRuleId) {
      fail("TARGET_POLICY_LOCK", recordPath, "Target policy binding changed");
    }
    requireExactArray(record.comparatorIds, expected.comparatorIds, pointerJoin(recordPath, "comparatorIds"), "TARGET_POLICY_LOCK");
  });

  requireSortedUniqueIds(value.statusIds, pointerJoin(path, "statusIds"), { minimum: 1, maximum: 64 });
  requireSortedUniqueIds(value.damageTypeIds, pointerJoin(path, "damageTypeIds"), { minimum: 1, maximum: 64 });

  const rulePath = pointerJoin(path, "ruleCatalog");
  exactFields(value.ruleCatalog, [
    "comparatorIds", "eligibilityRuleIds", "removalRuleIds", "stackRuleIds", "prefilterRuleIds",
    "scoreFormulaIds",
  ], rulePath);
  Object.keys(Catalog.RULE_CATALOG).forEach(function (key) {
    requireExactArray(value.ruleCatalog[key], Catalog.RULE_CATALOG[key], pointerJoin(rulePath, key), "RULE_CATALOG_MISMATCH");
  });

  const modifierPath = pointerJoin(path, "campaignModifierRecords");
  requireArray(value.campaignModifierRecords, modifierPath, 0, 64);
  requireRecordOrder(value.campaignModifierRecords, modifierPath);
  value.campaignModifierRecords.forEach(function (record, index) {
    const recordPath = pointerJoin(modifierPath, index);
    exactFields(record, ["id", "kind", "amountAether", "scope"], recordPath);
    if (record.kind !== "start-aether-add" || record.scope !== "campaign") {
      fail("SCHEMA_ENUM", recordPath, "Only campaign start-aether-add modifiers are supported");
    }
    requireInteger(record.amountAether, pointerJoin(recordPath, "amountAether"), 0, LIMITS.maxAether);
  });

  requireSortedUniqueIds(value.accessGrantIds, pointerJoin(path, "accessGrantIds"), { minimum: 1, maximum: 64 });
  requireExactArray(value.missionCatalogIds, Catalog.MISSION_CATALOG_IDS, pointerJoin(path, "missionCatalogIds"), "MISSION_CATALOG_MISMATCH");

  const scorePath = pointerJoin(path, "scoreRules");
  exactFields(value.scoreRules, [
    "id", "eligibleUnspentFormulaId", "unspentCapDivisor", "difficultyApplicationId",
    "minimumNonzeroScore",
  ], scorePath);
  requireId(value.scoreRules.id, pointerJoin(scorePath, "id"));
  requireCatalogReference(value.scoreRules.eligibleUnspentFormulaId, Catalog.RULE_CATALOG.scoreFormulaIds, pointerJoin(scorePath, "eligibleUnspentFormulaId"));
  requireCatalogReference(value.scoreRules.difficultyApplicationId, Catalog.RULE_CATALOG.scoreFormulaIds, pointerJoin(scorePath, "difficultyApplicationId"));
  if (value.scoreRules.eligibleUnspentFormulaId !== "eligible-unspent-excluding-assist-modifiers" ||
      value.scoreRules.difficultyApplicationId !== "difficulty-before-unspent-cap") {
    fail("SCORE_RULE_LOCK", scorePath, "The universal eligibility and difficulty formulas are binding");
  }
  if (value.scoreRules.unspentCapDivisor !== 19) {
    fail("SCORE_RULE_LOCK", pointerJoin(scorePath, "unspentCapDivisor"), "The unspent score divisor is binding at 19");
  }
  requireInteger(value.scoreRules.minimumNonzeroScore, pointerJoin(scorePath, "minimumNonzeroScore"), 1, LIMITS.maxScore);
}

function validateCampaignRules(value) {
  preflight(value, "/");
  validateCampaignRulesCore(value, "/");
  return deepFrozenClone(value);
}

function validateRangeSource(value, path) {
  exactFields(value, ["kind"], path);
  if (value.kind !== "level-range") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Only level-range is supported");
}

function validateTargetPolicySource(value, path) {
  requireObject(value, path);
  if (value.kind === "equipped-policy") {
    exactFields(value, ["kind"], path);
    return;
  }
  if (value.kind === "fixed") {
    exactFields(value, ["kind", "targetPolicyId"], path);
    requireCatalogReference(value.targetPolicyId, Object.keys(Catalog.TARGET_POLICY_RECORDS), pointerJoin(path, "targetPolicyId"));
    return;
  }
  fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Unsupported target-policy source");
}

function collectEvent(value, path, events) {
  requireId(value, path);
  events.push({ id: value, path: path });
}

function collectEventArray(value, path, events) {
  requireSortedUniqueIds(value, path, { minimum: 0, maximum: LIMITS.maxSemanticEventsPerOwner });
  value.forEach(function (id, index) { events.push({ id: id, path: pointerJoin(path, index) }); });
}

function collectOrderedEventArray(value, path, events) {
  requireArray(value, path, 0, LIMITS.maxSemanticEventsPerOwner);
  const seen = new Set();
  value.forEach(function (id, index) {
    const itemPath = pointerJoin(path, index);
    requireId(id, itemPath);
    if (seen.has(id)) fail("SCHEMA_DUPLICATE_ID", itemPath, "Duplicate semantic event ID");
    seen.add(id);
    events.push({ id: id, path: itemPath });
  });
}

function validateConsecutiveHitCounter(value, path, events) {
  if (value === null) return;
  exactFields(value, [
    "kind", "requiredAcceptedHits", "bonusDamageBp", "bonusAppliesToThresholdHit",
    "resetOnTargetChange", "resetAfterNoTargetMs", "emptyActivationAdvances",
    "secondaryEffectsAdvance", "semanticEventId",
  ], path);
  if (value.kind !== "same-target-accepted-hits") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Unsupported consecutive-hit counter");
  requireInteger(value.requiredAcceptedHits, pointerJoin(path, "requiredAcceptedHits"), 1, 1000);
  requireInteger(value.bonusDamageBp, pointerJoin(path, "bonusDamageBp"), 0, 20000);
  requireBoolean(value.bonusAppliesToThresholdHit, pointerJoin(path, "bonusAppliesToThresholdHit"));
  requireBoolean(value.resetOnTargetChange, pointerJoin(path, "resetOnTargetChange"));
  requireInteger(value.resetAfterNoTargetMs, pointerJoin(path, "resetAfterNoTargetMs"), 1, LIMITS.maxMilliseconds);
  requireBoolean(value.emptyActivationAdvances, pointerJoin(path, "emptyActivationAdvances"));
  requireBoolean(value.secondaryEffectsAdvance, pointerJoin(path, "secondaryEffectsAdvance"));
  collectEvent(value.semanticEventId, pointerJoin(path, "semanticEventId"), events);
}

function validateCenterBonus(value, path, events) {
  if (value === null) return;
  exactFields(value, [
    "radiusWorldUnits", "damageCoefficientBp", "appliesToPrimary", "appliesToSecondary",
    "semanticEventId",
  ], path);
  requireDecimal(value.radiusWorldUnits, pointerJoin(path, "radiusWorldUnits"), true);
  requireInteger(value.damageCoefficientBp, pointerJoin(path, "damageCoefficientBp"), 1, 20000);
  requireBoolean(value.appliesToPrimary, pointerJoin(path, "appliesToPrimary"));
  requireBoolean(value.appliesToSecondary, pointerJoin(path, "appliesToSecondary"));
  collectEvent(value.semanticEventId, pointerJoin(path, "semanticEventId"), events);
}

function validateEchoCounter(value, path, events) {
  if (value === null) return;
  exactFields(value, [
    "kind", "requiredAcceptedHits", "maximumSecondaryTargets", "radiusWorldUnits",
    "magnitudeBp", "durationMs", "comparatorId", "emptyActivationAdvances", "recursive",
    "resetRuleId", "semanticEventId",
  ], path);
  if (value.kind !== "every-n-accepted-primary-hits") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Unsupported echo counter");
  requireInteger(value.requiredAcceptedHits, pointerJoin(path, "requiredAcceptedHits"), 1, 1000);
  requireInteger(value.maximumSecondaryTargets, pointerJoin(path, "maximumSecondaryTargets"), 1, 1000);
  requireDecimal(value.radiusWorldUnits, pointerJoin(path, "radiusWorldUnits"), true);
  requireInteger(value.magnitudeBp, pointerJoin(path, "magnitudeBp"), 1, 10000);
  requireInteger(value.durationMs, pointerJoin(path, "durationMs"), 1, LIMITS.maxMilliseconds);
  requireCatalogReference(value.comparatorId, Catalog.RULE_CATALOG.comparatorIds, pointerJoin(path, "comparatorId"));
  requireBoolean(value.emptyActivationAdvances, pointerJoin(path, "emptyActivationAdvances"));
  requireBoolean(value.recursive, pointerJoin(path, "recursive"));
  if (value.recursive) fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "recursive"), "Recursive echo is forbidden");
  requireCatalogReference(value.resetRuleId, Catalog.RULE_CATALOG.removalRuleIds, pointerJoin(path, "resetRuleId"));
  collectEvent(value.semanticEventId, pointerJoin(path, "semanticEventId"), events);
}

function validateBash(value, path, events) {
  if (value === null) return;
  exactFields(value, [
    "kind", "damage", "damageTypeId", "statusId", "durationMs", "hardControlBucketId",
    "semanticEventId",
  ], path);
  if (value.kind !== "first-eligible-contact-per-summon") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Unsupported bash behavior");
  requireDecimal(value.damage, pointerJoin(path, "damage"), true);
  requireId(value.damageTypeId, pointerJoin(path, "damageTypeId"));
  requireId(value.statusId, pointerJoin(path, "statusId"));
  requireInteger(value.durationMs, pointerJoin(path, "durationMs"), 1, LIMITS.maxMilliseconds);
  requireId(value.hardControlBucketId, pointerJoin(path, "hardControlBucketId"));
  collectEvent(value.semanticEventId, pointerJoin(path, "semanticEventId"), events);
}

function validateScanCounter(value, path, events) {
  if (value === null) return;
  exactFields(value, [
    "kind", "requiredScans", "emptyScanAdvances", "maximumTargets", "durationMs",
    "targetPolicySource", "resetRuleId", "recursive", "semanticEventId",
  ], path);
  if (value.kind !== "every-n-scans") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "kind"), "Unsupported scan counter");
  requireInteger(value.requiredScans, pointerJoin(path, "requiredScans"), 1, 1000);
  requireBoolean(value.emptyScanAdvances, pointerJoin(path, "emptyScanAdvances"));
  requireInteger(value.maximumTargets, pointerJoin(path, "maximumTargets"), 1, 1000);
  requireInteger(value.durationMs, pointerJoin(path, "durationMs"), 1, LIMITS.maxMilliseconds);
  validateTargetPolicySource(value.targetPolicySource, pointerJoin(path, "targetPolicySource"));
  requireCatalogReference(value.resetRuleId, Catalog.RULE_CATALOG.removalRuleIds, pointerJoin(path, "resetRuleId"));
  requireBoolean(value.recursive, pointerJoin(path, "recursive"));
  if (value.recursive) fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(path, "recursive"), "Recursive scans are forbidden");
  collectEvent(value.semanticEventId, pointerJoin(path, "semanticEventId"), events);
}

function validateBehaviorParameters(record, path, priorBehaviors, events, summonReferences) {
  const parameters = record.parameters;
  const parameterPath = pointerJoin(path, "parameters");
  const key = record.contractId + "@" + record.version + "/" + record.deliveryKind;
  const delivery = DELIVERY_BY_KEY.get(key);
  if (!delivery) fail("BEHAVIOR_DELIVERY", path, "Unsupported behavior contract/version/delivery combination");
  exactFields(parameters, delivery.parameterFields, parameterPath);

  if (record.contractId === "direct") {
    requireTimerMinimum(
      parameters.cooldownMs,
      pointerJoin(parameterPath, "cooldownMs"),
      Catalog.ABI_V1_TIMER_MINIMA.attackCooldownMsAtMaximumExternalRate
    );
    requireDecimal(parameters.baseDamage, pointerJoin(parameterPath, "baseDamage"), true);
    requireId(parameters.damageTypeId, pointerJoin(parameterPath, "damageTypeId"));
    requireInteger(parameters.maximumTargets, pointerJoin(parameterPath, "maximumTargets"), 1, 1000);
    validateRangeSource(parameters.rangeSource, pointerJoin(parameterPath, "rangeSource"));
    validateTargetPolicySource(parameters.targetPolicySource, pointerJoin(parameterPath, "targetPolicySource"));
    requireInteger(parameters.shieldCoefficientBp, pointerJoin(parameterPath, "shieldCoefficientBp"), 0, 20000);
    requireInteger(parameters.armorIgnoreBp, pointerJoin(parameterPath, "armorIgnoreBp"), 0, 10000);
    requireInteger(parameters.bossCoefficientBp, pointerJoin(parameterPath, "bossCoefficientBp"), 0, 20000);
    validateConsecutiveHitCounter(parameters.consecutiveHitCounter, pointerJoin(parameterPath, "consecutiveHitCounter"), events);
    return;
  }
  if (record.contractId === "splash") {
    requireTimerMinimum(
      parameters.cooldownMs,
      pointerJoin(parameterPath, "cooldownMs"),
      Catalog.ABI_V1_TIMER_MINIMA.attackCooldownMsAtMaximumExternalRate
    );
    requireDecimal(parameters.baseDamage, pointerJoin(parameterPath, "baseDamage"), true);
    requireId(parameters.damageTypeId, pointerJoin(parameterPath, "damageTypeId"));
    requireInteger(parameters.maximumPrimaryTargets, pointerJoin(parameterPath, "maximumPrimaryTargets"), 1, 1000);
    validateRangeSource(parameters.rangeSource, pointerJoin(parameterPath, "rangeSource"));
    validateTargetPolicySource(parameters.targetPolicySource, pointerJoin(parameterPath, "targetPolicySource"));
    requireDecimal(parameters.radiusWorldUnits, pointerJoin(parameterPath, "radiusWorldUnits"), true);
    requireBoolean(parameters.primaryFirst, pointerJoin(parameterPath, "primaryFirst"));
    requireCatalogReference(parameters.secondaryComparatorId, Catalog.RULE_CATALOG.comparatorIds, pointerJoin(parameterPath, "secondaryComparatorId"));
    validateCenterBonus(parameters.centerBonus, pointerJoin(parameterPath, "centerBonus"), events);
    return;
  }
  if (record.contractId === "slow") {
    requireId(parameters.triggerBehaviorId, pointerJoin(parameterPath, "triggerBehaviorId"));
    const trigger = priorBehaviors.get(parameters.triggerBehaviorId);
    if (!trigger || trigger.contractId !== "direct") {
      fail("BEHAVIOR_TRIGGER_ORDER", pointerJoin(parameterPath, "triggerBehaviorId"), "Slow must reference an earlier direct behavior");
    }
    requireId(parameters.statusId, pointerJoin(parameterPath, "statusId"));
    requireInteger(parameters.magnitudeBp, pointerJoin(parameterPath, "magnitudeBp"), 1, 10000);
    requireInteger(parameters.durationMs, pointerJoin(parameterPath, "durationMs"), 1, LIMITS.maxMilliseconds);
    if (parameters.controlKind !== "slow") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(parameterPath, "controlKind"), "Only slow control is supported");
    validateEchoCounter(parameters.echoCounter, pointerJoin(parameterPath, "echoCounter"), events);
    return;
  }
  if (record.contractId === "spawnUnit") {
    requireId(parameters.summonRecordId, pointerJoin(parameterPath, "summonRecordId"));
    summonReferences.push({
      id: parameters.summonRecordId,
      path: pointerJoin(parameterPath, "summonRecordId"),
      kind: "spawnUnit",
      roleEvents: [{
        id: parameters.createEventId,
        path: pointerJoin(parameterPath, "createEventId"),
        role: "create",
      }],
    });
    requireInteger(parameters.activeSlotCount, pointerJoin(parameterPath, "activeSlotCount"), 1, 3);
    requireInteger(parameters.replenishMs, pointerJoin(parameterPath, "replenishMs"), 1, LIMITS.maxMilliseconds);
    requireBoolean(parameters.initialReady, pointerJoin(parameterPath, "initialReady"));
    validateRangeSource(parameters.projectionRangeSource, pointerJoin(parameterPath, "projectionRangeSource"));
    if (parameters.markerProofKind !== "guard" || parameters.markerProofVersion !== 1) {
      fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(parameterPath, "markerProofKind"), "Guard slots require guard@1 marker proof");
    }
    requireCatalogReference(parameters.slotComparatorId, Catalog.RULE_CATALOG.comparatorIds, pointerJoin(parameterPath, "slotComparatorId"));
    requireInteger(parameters.maximumCreateEventsPerTick, pointerJoin(parameterPath, "maximumCreateEventsPerTick"), 1, LIMITS.maxSpawnCount);
    collectEvent(parameters.createEventId, pointerJoin(parameterPath, "createEventId"), events);
    return;
  }
  if (record.contractId === "block") {
    requireId(parameters.summonRecordId, pointerJoin(parameterPath, "summonRecordId"));
    summonReferences.push({
      id: parameters.summonRecordId,
      path: pointerJoin(parameterPath, "summonRecordId"),
      kind: "block",
      roleEvents: [
        { id: parameters.contactEventId, path: pointerJoin(parameterPath, "contactEventId"), role: "contact" },
        { id: parameters.rejectedEventId, path: pointerJoin(parameterPath, "rejectedEventId"), role: "rejected" },
      ],
    });
    requireId(parameters.statusId, pointerJoin(parameterPath, "statusId"));
    requireInteger(parameters.durationMs, pointerJoin(parameterPath, "durationMs"), 1, LIMITS.maxMilliseconds);
    requireDecimal(parameters.contactDamage, pointerJoin(parameterPath, "contactDamage"), false);
    requireId(parameters.damageTypeId, pointerJoin(parameterPath, "damageTypeId"));
    requireCatalogReference(parameters.prefilterRuleId, Catalog.RULE_CATALOG.prefilterRuleIds, pointerJoin(parameterPath, "prefilterRuleId"));
    requireCatalogReference(parameters.contactComparatorId, Catalog.RULE_CATALOG.comparatorIds, pointerJoin(parameterPath, "contactComparatorId"));
    requireId(parameters.resolveStatusId, pointerJoin(parameterPath, "resolveStatusId"));
    validateBash(parameters.bash, pointerJoin(parameterPath, "bash"), events);
    collectEvent(parameters.contactEventId, pointerJoin(parameterPath, "contactEventId"), events);
    collectEvent(parameters.rejectedEventId, pointerJoin(parameterPath, "rejectedEventId"), events);
    return;
  }
  if (record.contractId === "aura" && record.deliveryKind === "continuous-range-status") {
    requireId(parameters.statusId, pointerJoin(parameterPath, "statusId"));
    requireEnum(parameters.affectedSide, ["enemy", "friendly"], pointerJoin(parameterPath, "affectedSide"));
    if (parameters.statusId !== "reveal" || parameters.affectedSide !== "enemy") {
      fail("BEHAVIOR_PARAMETER_VALUE", parameterPath, "Continuous slice aura is the enemy reveal delivery");
    }
    requireSortedUniqueIds(parameters.targetKinds, pointerJoin(parameterPath, "targetKinds"), { minimum: 1, maximum: Catalog.TARGET_KINDS.length });
    parameters.targetKinds.forEach(function (kind, index) { requireCatalogReference(kind, Catalog.TARGET_KINDS, pointerJoin(pointerJoin(parameterPath, "targetKinds"), index)); });
    validateRangeSource(parameters.rangeSource, pointerJoin(parameterPath, "rangeSource"));
    requireCatalogReference(parameters.eligibilityRuleId, Catalog.RULE_CATALOG.eligibilityRuleIds, pointerJoin(parameterPath, "eligibilityRuleId"));
    requireCatalogReference(parameters.removalRuleId, Catalog.RULE_CATALOG.removalRuleIds, pointerJoin(parameterPath, "removalRuleId"));
    requireCatalogReference(parameters.stackRuleId, Catalog.RULE_CATALOG.stackRuleIds, pointerJoin(parameterPath, "stackRuleId"));
    const payloadPath = pointerJoin(parameterPath, "statusPayload");
    exactFields(parameters.statusPayload, ["kind", "collateralEligibilityRuleId"], payloadPath);
    if (parameters.statusPayload.kind !== "acquisition-reveal") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(payloadPath, "kind"), "Continuous aura must deliver acquisition-reveal");
    requireCatalogReference(parameters.statusPayload.collateralEligibilityRuleId, Catalog.RULE_CATALOG.eligibilityRuleIds, pointerJoin(payloadPath, "collateralEligibilityRuleId"));
    collectEvent(parameters.applyEventId, pointerJoin(parameterPath, "applyEventId"), events);
    collectEvent(parameters.removeEventId, pointerJoin(parameterPath, "removeEventId"), events);
    return;
  }
  if (record.contractId === "aura" && record.deliveryKind === "periodic-targeted-status") {
    requireId(parameters.statusId, pointerJoin(parameterPath, "statusId"));
    requireEnum(parameters.affectedSide, ["enemy", "friendly"], pointerJoin(parameterPath, "affectedSide"));
    if (parameters.statusId !== "mark" || parameters.affectedSide !== "enemy") {
      fail("BEHAVIOR_PARAMETER_VALUE", parameterPath, "Periodic slice aura is the enemy mark delivery");
    }
    requireSortedUniqueIds(parameters.targetKinds, pointerJoin(parameterPath, "targetKinds"), { minimum: 1, maximum: Catalog.TARGET_KINDS.length });
    parameters.targetKinds.forEach(function (kind, index) { requireCatalogReference(kind, Catalog.TARGET_KINDS, pointerJoin(pointerJoin(parameterPath, "targetKinds"), index)); });
    validateRangeSource(parameters.rangeSource, pointerJoin(parameterPath, "rangeSource"));
    requireTimerMinimum(
      parameters.cadenceMs,
      pointerJoin(parameterPath, "cadenceMs"),
      Catalog.ABI_V1_TIMER_MINIMA.uncappedPeriodicCadenceMs
    );
    requireBoolean(parameters.initialReady, pointerJoin(parameterPath, "initialReady"));
    requireInteger(parameters.maximumTargets, pointerJoin(parameterPath, "maximumTargets"), 1, 1000);
    requireInteger(parameters.durationMs, pointerJoin(parameterPath, "durationMs"), 1, LIMITS.maxMilliseconds);
    validateTargetPolicySource(parameters.targetPolicySource, pointerJoin(parameterPath, "targetPolicySource"));
    requireCatalogReference(parameters.stackRuleId, Catalog.RULE_CATALOG.stackRuleIds, pointerJoin(parameterPath, "stackRuleId"));
    const payloadPath = pointerJoin(parameterPath, "statusPayload");
    exactFields(parameters.statusPayload, ["kind", "amountBp", "sourceTypeId"], payloadPath);
    if (parameters.statusPayload.kind !== "external-damage-amplification") fail("BEHAVIOR_PARAMETER_VALUE", pointerJoin(payloadPath, "kind"), "Periodic aura must deliver external damage amplification");
    requireInteger(parameters.statusPayload.amountBp, pointerJoin(payloadPath, "amountBp"), 1, 2000);
    requireId(parameters.statusPayload.sourceTypeId, pointerJoin(payloadPath, "sourceTypeId"));
    validateScanCounter(parameters.scanCounter, pointerJoin(parameterPath, "scanCounter"), events);
    collectEvent(parameters.scanEventId, pointerJoin(parameterPath, "scanEventId"), events);
    collectEvent(parameters.applyEventId, pointerJoin(parameterPath, "applyEventId"), events);
    collectEvent(parameters.expireEventId, pointerJoin(parameterPath, "expireEventId"), events);
  }
}

function validateDefenseSourceCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "summonRecords", "records"], path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));

  const summonPath = pointerJoin(path, "summonRecords");
  requireArray(value.summonRecords, summonPath, 0, 64);
  const summonIds = requireRecordOrder(value.summonRecords, summonPath);
  value.summonRecords.forEach(function (record, index) {
    const recordPath = pointerJoin(summonPath, index);
    exactFields(record, ["id", "kind", "targetKinds", "acceptedContactsBeforeConsume", "semanticEventIds"], recordPath);
    requireSortedUniqueIds(record.targetKinds, pointerJoin(recordPath, "targetKinds"), { minimum: 1, maximum: 1 });
    if (record.kind !== "fixed-marker-guard" || record.targetKinds.length !== 1 || record.targetKinds[0] !== "ground" ||
        record.acceptedContactsBeforeConsume !== 1) {
      fail("SUMMON_FIXED_MARKER_CONTRACT", recordPath, "Schema v3 summons are fixed-marker guards consumed after one ground contact");
    }
    requireSortedUniqueIds(record.semanticEventIds, pointerJoin(recordPath, "semanticEventIds"), { minimum: 1, maximum: LIMITS.maxSemanticEventsPerOwner });
  });

  const recordPath = pointerJoin(path, "records");
  requireArray(value.records, recordPath, 1, LIMITS.maxDefenses);
  requireRecordOrder(value.records, recordPath);
  const allSummonReferences = [];
  value.records.forEach(function (record, defenseIndex) {
    const defensePath = pointerJoin(recordPath, defenseIndex);
    exactFields(record, [
      "id", "nameKey", "roleKey", "weaknessKey", "unlockId", "targetKinds",
      "allowedTargetPolicyIds", "defaultTargetPolicyId", "defenseTags", "levels", "semanticEventIds",
    ], defensePath);
    requireStringKey(record.nameKey, pointerJoin(defensePath, "nameKey"));
    requireStringKey(record.roleKey, pointerJoin(defensePath, "roleKey"));
    requireStringKey(record.weaknessKey, pointerJoin(defensePath, "weaknessKey"));
    requireId(record.unlockId, pointerJoin(defensePath, "unlockId"));
    requireSortedUniqueIds(record.targetKinds, pointerJoin(defensePath, "targetKinds"), { minimum: 1, maximum: Catalog.TARGET_KINDS.length });
    record.targetKinds.forEach(function (kind, index) { requireCatalogReference(kind, Catalog.TARGET_KINDS, pointerJoin(pointerJoin(defensePath, "targetKinds"), index)); });
    requireSortedUniqueIds(record.allowedTargetPolicyIds, pointerJoin(defensePath, "allowedTargetPolicyIds"), { minimum: 1, maximum: 3 });
    record.allowedTargetPolicyIds.forEach(function (policy, index) { requireCatalogReference(policy, Object.keys(Catalog.TARGET_POLICY_RECORDS), pointerJoin(pointerJoin(defensePath, "allowedTargetPolicyIds"), index)); });
    requireId(record.defaultTargetPolicyId, pointerJoin(defensePath, "defaultTargetPolicyId"));
    if (record.allowedTargetPolicyIds.indexOf(record.defaultTargetPolicyId) === -1) fail("REFERENCE_UNKNOWN", pointerJoin(defensePath, "defaultTargetPolicyId"), "Default policy must be allowed");
    requireSortedUniqueIds(record.defenseTags, pointerJoin(defensePath, "defenseTags"), { minimum: 1, maximum: 32 });
    const ownedEvents = requireSortedUniqueIds(record.semanticEventIds, pointerJoin(defensePath, "semanticEventIds"), { minimum: 0, maximum: LIMITS.maxSemanticEventsPerOwner });

    const levelsPath = pointerJoin(defensePath, "levels");
    requireArray(record.levels, levelsPath);
    if (record.levels.length !== LIMITS.levelsPerDefense) fail("DEFENSE_LEVEL_COUNT", levelsPath, "Every defense requires exactly three levels");
    let defenseSummonId = null;
    record.levels.forEach(function (level, levelIndex) {
      const levelPath = pointerJoin(levelsPath, levelIndex);
      exactFields(level, ["level", "purchase", "rangeWorldUnits", "behaviors", "ui"], levelPath);
      requireInteger(level.level, pointerJoin(levelPath, "level"), levelIndex + 1, levelIndex + 1);
      const purchasePath = pointerJoin(levelPath, "purchase");
      exactFields(level.purchase, ["kind", "costAether"], purchasePath);
      const expectedKind = levelIndex === 0 ? "build" : "upgrade";
      if (level.purchase.kind !== expectedKind) fail("DEFENSE_PURCHASE_KIND", pointerJoin(purchasePath, "kind"), "Level purchase kind is fixed by level");
      requireInteger(level.purchase.costAether, pointerJoin(purchasePath, "costAether"), 1, LIMITS.maxAether);
      requireDecimal(level.rangeWorldUnits, pointerJoin(levelPath, "rangeWorldUnits"), true);

      const behaviorsPath = pointerJoin(levelPath, "behaviors");
      requireArray(level.behaviors, behaviorsPath, 1, LIMITS.maxBehaviorsPerLevel);
      const priorBehaviors = new Map();
      const emittedEvents = [];
      const levelSummonReferences = [];
      level.behaviors.forEach(function (behavior, behaviorIndex) {
        const behaviorPath = pointerJoin(behaviorsPath, behaviorIndex);
        exactFields(behavior, ["id", "contractId", "version", "deliveryKind", "parameters"], behaviorPath);
        requireId(behavior.id, pointerJoin(behaviorPath, "id"));
        if (priorBehaviors.has(behavior.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(behaviorPath, "id"), "Duplicate behavior ID in level");
        requireId(behavior.contractId, pointerJoin(behaviorPath, "contractId"));
        requireInteger(behavior.version, pointerJoin(behaviorPath, "version"), 1, 1);
        requireId(behavior.deliveryKind, pointerJoin(behaviorPath, "deliveryKind"));
        validateBehaviorParameters(behavior, behaviorPath, priorBehaviors, emittedEvents, levelSummonReferences);
        priorBehaviors.set(behavior.id, behavior);
      });
      emittedEvents.forEach(function (event) {
        if (!ownedEvents.has(event.id)) fail("EVENT_OWNERSHIP", event.path, "Emitted event is absent from defense semanticEventIds");
      });
      if (levelSummonReferences.length > 0) {
        const kinds = new Set(levelSummonReferences.map(function (reference) { return reference.kind; }));
        const ids = new Set(levelSummonReferences.map(function (reference) { return reference.id; }));
        if (!kinds.has("spawnUnit") || !kinds.has("block") || ids.size !== 1) {
          fail("SUMMON_REFERENCE", levelPath, "Guard levels require matching spawnUnit and block references to one summon");
        }
        const levelSummonId = levelSummonReferences[0].id;
        if (defenseSummonId !== null && defenseSummonId !== levelSummonId) {
          fail("SUMMON_REFERENCE", levelPath, "All levels must reference the same guard summon");
        }
        defenseSummonId = levelSummonId;
      }
      levelSummonReferences.forEach(function (reference) { allSummonReferences.push(reference); });

      const uiPath = pointerJoin(levelPath, "ui");
      exactFields(level.ui, ["descriptionKey", "statFieldIds"], uiPath);
      requireStringKey(level.ui.descriptionKey, pointerJoin(uiPath, "descriptionKey"));
      requireUniqueDisplayIds(level.ui.statFieldIds, pointerJoin(uiPath, "statFieldIds"), Catalog.TYPED_STAT_FIELD_IDS);
    });
  });

  const summonById = new Map(value.summonRecords.map(function (record) { return [record.id, record]; }));
  const referencedSummons = new Set();
  const operationalEventsBySummon = new Map();
  allSummonReferences.forEach(function (reference) {
    if (!summonIds.has(reference.id)) fail("REFERENCE_UNKNOWN", reference.path, "Unknown summon record");
    referencedSummons.add(reference.id);
    const summonEvents = new Set(summonById.get(reference.id).semanticEventIds);
    let operationalEvents = operationalEventsBySummon.get(reference.id);
    if (!operationalEvents) {
      operationalEvents = new Set();
      operationalEventsBySummon.set(reference.id, operationalEvents);
    }
    reference.roleEvents.forEach(function (event) {
      if (!summonEvents.has(event.id)) {
        fail("SUMMON_EVENT_CONTRACT", event.path, "Guard create/contact/rejected event is absent from the referenced summon semantic event set");
      }
      operationalEvents.add(event.id);
    });
  });
  value.summonRecords.forEach(function (record, index) {
    const currentPath = pointerJoin(summonPath, index);
    if (!referencedSummons.has(record.id)) fail("SUMMON_UNUSED", pointerJoin(currentPath, "id"), "Summon record is unused");
    const operationalEvents = operationalEventsBySummon.get(record.id);
    const consumeRemainder = record.semanticEventIds.filter(function (eventId) { return !operationalEvents.has(eventId); });
    if (consumeRemainder.length !== 1) {
      fail("SUMMON_EVENT_CONTRACT", pointerJoin(currentPath, "semanticEventIds"), "A fixed guard summon requires exactly one consume event after create/contact/rejected roles");
    }
  });
}

function validateDefenseSource(value) {
  preflight(value, "/");
  validateDefenseSourceCore(value, "/");
  return deepFrozenClone(value);
}

const COMMON_ENEMY_FIELDS = [
  "id", "nameKey", "descriptionKey", "tags", "routeKinds", "hp",
  "speedWorldUnitsPerSecond", "armor", "resistances", "shieldPools",
  "baseLineageBountyAether", "score", "leakIntegrity", "threatPriority", "control",
  "traits", "spawnBehavior", "deathBehavior", "semanticEventIds", "ui",
];

function validateResistanceRecords(value, path) {
  requireArray(value, path, 0, 64);
  let prior = null;
  const seen = new Set();
  value.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    exactFields(record, ["damageTypeId", "reductionBp"], recordPath);
    requireId(record.damageTypeId, pointerJoin(recordPath, "damageTypeId"));
    if (seen.has(record.damageTypeId)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(recordPath, "damageTypeId"), "Duplicate resistance damage type");
    if (prior !== null && prior > record.damageTypeId) fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(recordPath, "damageTypeId"), "Resistance records must use ASCII order");
    requireInteger(record.reductionBp, pointerJoin(recordPath, "reductionBp"), 0, 3500);
    seen.add(record.damageTypeId);
    prior = record.damageTypeId;
  });
}

function validateOrderedChildRecords(value, path) {
  requireArray(value, path, 1, LIMITS.maxGroupsPerWave);
  requireContiguousOrder(value, path, 0);
  value.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    exactFields(record, [
      "order", "enemyId", "count", "firstDelayTicks", "intervalTicks", "routeOwnership",
      "fixedRouteId", "routeOffsetDistance", "lineageOwnership", "bountyPolicy",
    ], recordPath);
    requireId(record.enemyId, pointerJoin(recordPath, "enemyId"));
    requireInteger(record.count, pointerJoin(recordPath, "count"), 1, LIMITS.maxSpawnCount);
    requireInteger(record.firstDelayTicks, pointerJoin(recordPath, "firstDelayTicks"), 0, LIMITS.maxSimulationTick);
    requireInteger(record.intervalTicks, pointerJoin(recordPath, "intervalTicks"), 1, LIMITS.maxSimulationTick);
    requireEnum(record.routeOwnership, ["fixed", "inherit"], pointerJoin(recordPath, "routeOwnership"));
    if (record.routeOwnership === "inherit") {
      if (record.fixedRouteId !== null) fail("SCHEMA_ENUM", pointerJoin(recordPath, "fixedRouteId"), "Inherited routes require null fixedRouteId");
    } else {
      requireId(record.fixedRouteId, pointerJoin(recordPath, "fixedRouteId"));
    }
    requireDecimal(record.routeOffsetDistance, pointerJoin(recordPath, "routeOffsetDistance"), false);
    if (record.lineageOwnership !== "parent-lineage" || record.bountyPolicy !== "suppressed") {
      fail("LINEAGE_POLICY", recordPath, "Children must retain parent lineage with suppressed bounty");
    }
  });
  return analyzeAuthoredSchedule(
    value,
    path,
    { count: "count", firstTick: "firstDelayTicks", intervalTicks: "intervalTicks" },
    LIMITS.maxTotalChildrenPerSchedule,
    LIMITS.maxGroupsPerWave
  );
}

function validateSpawnOrDeathBehavior(value, path, trigger, events) {
  requireObject(value, path);
  if (value.kind === "none") {
    exactFields(value, ["kind"], path);
    if (trigger !== "on-create") fail("SCHEMA_ENUM", pointerJoin(path, "kind"), "none is only a spawn behavior");
    return;
  }
  if (value.kind === "terminal") {
    exactFields(value, ["kind"], path);
    if (trigger !== "on-terminal-death") fail("SCHEMA_ENUM", pointerJoin(path, "kind"), "terminal is only a death behavior");
    return;
  }
  if (value.kind === "ordered-children") {
    exactFields(value, ["kind", "trigger", "childSpawnRecords", "maximumCreateEventsPerTick", "semanticEventIds"], path);
    if (value.trigger !== trigger) fail("SCHEMA_ENUM", pointerJoin(path, "trigger"), "Ordered child trigger does not match its owner phase");
    const scheduleBudget = validateOrderedChildRecords(value.childSpawnRecords, pointerJoin(path, "childSpawnRecords"));
    requireInteger(value.maximumCreateEventsPerTick, pointerJoin(path, "maximumCreateEventsPerTick"), 1, LIMITS.maxSpawnCount);
    if (scheduleBudget.maximumSimultaneousDue > value.maximumCreateEventsPerTick) {
      fail("CREATE_EVENT_CAP_UNDERRUN", pointerJoin(path, "maximumCreateEventsPerTick"), "Authored cap is below the exact maximum simultaneous child creates");
    }
    collectEventArray(value.semanticEventIds, pointerJoin(path, "semanticEventIds"), events);
    return;
  }
  if (value.kind === "single-revival" && trigger === "on-terminal-death") {
    exactFields(value, [
      "kind", "delayTicks", "restoredHpBp", "routeOffsetDistance", "lineageOwnership",
      "bountyPolicy", "statusIds", "maximumRevivals", "semanticEventIds",
    ], path);
    requireInteger(value.delayTicks, pointerJoin(path, "delayTicks"), 1, LIMITS.maxSimulationTick);
    requireInteger(value.restoredHpBp, pointerJoin(path, "restoredHpBp"), 1, 10000);
    requireDecimal(value.routeOffsetDistance, pointerJoin(path, "routeOffsetDistance"), false);
    if (value.lineageOwnership !== "parent-lineage" || value.bountyPolicy !== "suppressed" || value.maximumRevivals !== 1) {
      fail("LINEAGE_POLICY", path, "Revival must retain parent lineage, suppress bounty, and occur once");
    }
    requireSortedUniqueIds(value.statusIds, pointerJoin(path, "statusIds"), { minimum: 0, maximum: 32 });
    collectEventArray(value.semanticEventIds, pointerJoin(path, "semanticEventIds"), events);
    return;
  }
  fail("SCHEMA_ENUM", pointerJoin(path, "kind"), "Unsupported spawn/death behavior discriminator");
}

function validateCommonEnemyRecord(record, path, extraFields) {
  exactFields(record, COMMON_ENEMY_FIELDS.concat(extraFields || []), path);
  requireId(record.id, pointerJoin(path, "id"));
  requireStringKey(record.nameKey, pointerJoin(path, "nameKey"));
  requireStringKey(record.descriptionKey, pointerJoin(path, "descriptionKey"));
  requireSortedUniqueIds(record.tags, pointerJoin(path, "tags"), { minimum: 1, maximum: 32 });
  requireSortedUniqueIds(record.routeKinds, pointerJoin(path, "routeKinds"), { minimum: 1, maximum: 16 });
  requireDecimal(record.hp, pointerJoin(path, "hp"), true);
  requireDecimal(record.speedWorldUnitsPerSecond, pointerJoin(path, "speedWorldUnitsPerSecond"), true);
  requireDecimal(record.armor, pointerJoin(path, "armor"), false);
  validateResistanceRecords(record.resistances, pointerJoin(path, "resistances"));

  const shieldPath = pointerJoin(path, "shieldPools");
  requireArray(record.shieldPools, shieldPath, 0, 32);
  requireRecordOrder(record.shieldPools, shieldPath);
  const nestedEvents = [];
  record.shieldPools.forEach(function (shield, index) {
    const itemPath = pointerJoin(shieldPath, index);
    exactFields(shield, [
      "id", "capacity", "initialAmount", "durationMs", "sourceTypeId", "consumeEventId",
      "expireEventId",
    ], itemPath);
    requireDecimal(shield.capacity, pointerJoin(itemPath, "capacity"), true);
    requireDecimal(shield.initialAmount, pointerJoin(itemPath, "initialAmount"), true);
    if (parseExactDecimal(shield.initialAmount, 1000, pointerJoin(itemPath, "initialAmount")) >
        parseExactDecimal(shield.capacity, 1000, pointerJoin(itemPath, "capacity"))) {
      fail("SCHEMA_RANGE", pointerJoin(itemPath, "initialAmount"), "Initial shield exceeds capacity");
    }
    if (shield.durationMs !== null) requireInteger(shield.durationMs, pointerJoin(itemPath, "durationMs"), 1, LIMITS.maxMilliseconds);
    requireId(shield.sourceTypeId, pointerJoin(itemPath, "sourceTypeId"));
    collectEvent(shield.consumeEventId, pointerJoin(itemPath, "consumeEventId"), nestedEvents);
    collectEvent(shield.expireEventId, pointerJoin(itemPath, "expireEventId"), nestedEvents);
  });

  requireInteger(record.baseLineageBountyAether, pointerJoin(path, "baseLineageBountyAether"), 0, LIMITS.maxAether);
  requireInteger(record.score, pointerJoin(path, "score"), 0, LIMITS.maxScore);
  requireInteger(record.leakIntegrity, pointerJoin(path, "leakIntegrity"), 1, 1000000);
  requireInteger(record.threatPriority, pointerJoin(path, "threatPriority"), 0, LIMITS.maxScore);

  const controlPath = pointerJoin(path, "control");
  exactFields(record.control, ["slowControlBp", "minimumMovementBp", "hardControlBp", "displacementBp"], controlPath);
  requireInteger(record.control.slowControlBp, pointerJoin(controlPath, "slowControlBp"), 0, 10000);
  requireInteger(record.control.minimumMovementBp, pointerJoin(controlPath, "minimumMovementBp"), 1, 10000);
  requireInteger(record.control.hardControlBp, pointerJoin(controlPath, "hardControlBp"), 0, 10000);
  requireInteger(record.control.displacementBp, pointerJoin(controlPath, "displacementBp"), 0, 10000);

  const traitPath = pointerJoin(path, "traits");
  requireArray(record.traits, traitPath, 0, LIMITS.maxTraitsPerEnemy);
  record.traits.forEach(function (trait, index) {
    const itemPath = pointerJoin(traitPath, index);
    exactFields(trait, [
      "kind", "version", "revealStatusId", "damageExposeStatusId", "damageExposeDurationMs",
      "directTargetEligibilityRuleId", "collateralEligibilityRuleId", "continuousRevealRuleId",
      "semanticEventIds",
    ], itemPath);
    if (trait.kind !== "cloak" || trait.version !== 1) fail("SCHEMA_ENUM", itemPath, "Only cloak-v1 is supported");
    requireId(trait.revealStatusId, pointerJoin(itemPath, "revealStatusId"));
    requireId(trait.damageExposeStatusId, pointerJoin(itemPath, "damageExposeStatusId"));
    requireInteger(trait.damageExposeDurationMs, pointerJoin(itemPath, "damageExposeDurationMs"), 1, LIMITS.maxMilliseconds);
    requireCatalogReference(trait.directTargetEligibilityRuleId, Catalog.RULE_CATALOG.eligibilityRuleIds, pointerJoin(itemPath, "directTargetEligibilityRuleId"));
    requireCatalogReference(trait.collateralEligibilityRuleId, Catalog.RULE_CATALOG.eligibilityRuleIds, pointerJoin(itemPath, "collateralEligibilityRuleId"));
    requireCatalogReference(trait.continuousRevealRuleId, Catalog.RULE_CATALOG.eligibilityRuleIds, pointerJoin(itemPath, "continuousRevealRuleId"));
    collectEventArray(trait.semanticEventIds, pointerJoin(itemPath, "semanticEventIds"), nestedEvents);
  });

  validateSpawnOrDeathBehavior(record.spawnBehavior, pointerJoin(path, "spawnBehavior"), "on-create", nestedEvents);
  validateSpawnOrDeathBehavior(record.deathBehavior, pointerJoin(path, "deathBehavior"), "on-terminal-death", nestedEvents);
  const ownedEvents = requireSortedUniqueIds(record.semanticEventIds, pointerJoin(path, "semanticEventIds"), { minimum: 0, maximum: LIMITS.maxSemanticEventsPerOwner });
  nestedEvents.forEach(function (event) {
    if (!ownedEvents.has(event.id)) fail("EVENT_OWNERSHIP", event.path, "Nested event is absent from owner semanticEventIds");
  });

  const uiPath = pointerJoin(path, "ui");
  exactFields(record.ui, ["statFieldIds"], uiPath);
  requireUniqueDisplayIds(record.ui.statFieldIds, pointerJoin(uiPath, "statFieldIds"), Catalog.TYPED_STAT_FIELD_IDS);
  return { ownedEvents: ownedEvents, nestedEvents: nestedEvents };
}

function validateEnemySourceCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "records"], path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));
  const recordsPath = pointerJoin(path, "records");
  requireArray(value.records, recordsPath, 1, LIMITS.maxRegularEnemies);
  requireRecordOrder(value.records, recordsPath);
  value.records.forEach(function (record, index) {
    const recordPath = pointerJoin(recordsPath, index);
    validateCommonEnemyRecord(record, recordPath);
    if (Catalog.SLICE_IDS.enemies.indexOf(record.id) !== -1 &&
        (record.spawnBehavior.kind !== "none" || record.deathBehavior.kind !== "terminal")) {
      fail("SLICE_ENEMY_TERMINAL_ONLY", recordPath, "The five regular slice enemies explicitly use none/terminal behavior");
    }
  });
}

function validateEnemySource(value) {
  preflight(value, "/");
  validateEnemySourceCore(value, "/");
  return deepFrozenClone(value);
}

const BOSS_EXTRA_FIELDS = [
  "bossControlBp", "bossMinimumMovementBp", "executeBehavior", "thresholdScript", "phaseRecords",
];

function validateBossSourceCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "records"], path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));
  const recordsPath = pointerJoin(path, "records");
  requireArray(value.records, recordsPath, 1, LIMITS.maxBosses);
  requireRecordOrder(value.records, recordsPath);
  value.records.forEach(function (record, index) {
    const recordPath = pointerJoin(recordsPath, index);
    const common = validateCommonEnemyRecord(record, recordPath, BOSS_EXTRA_FIELDS);
    requireInteger(record.bossControlBp, pointerJoin(recordPath, "bossControlBp"), 0, 10000);
    requireInteger(record.bossMinimumMovementBp, pointerJoin(recordPath, "bossMinimumMovementBp"), 1, 10000);
    exactFields(record.executeBehavior, ["kind"], pointerJoin(recordPath, "executeBehavior"));
    if (record.executeBehavior.kind !== "forbidden") {
      fail("BOSS_EXECUTE_FORBIDDEN", pointerJoin(pointerJoin(recordPath, "executeBehavior"), "kind"), "Boss execute is forbidden");
    }

    const scriptPath = pointerJoin(recordPath, "thresholdScript");
    exactFields(record.thresholdScript, ["contractId", "version", "deliveryKind", "parameters"], scriptPath);
    if (record.thresholdScript.contractId !== "bossScript" || record.thresholdScript.version !== 1 ||
        record.thresholdScript.deliveryKind !== "guarded-hp-thresholds") {
      fail("BEHAVIOR_DELIVERY", scriptPath, "Boss thresholds require bossScript@1 guarded-hp-thresholds");
    }
    const parametersPath = pointerJoin(scriptPath, "parameters");
    exactFields(record.thresholdScript.parameters, ["maximumTransitionsPerResolvedHit", "thresholds"], parametersPath);
    if (record.thresholdScript.parameters.maximumTransitionsPerResolvedHit !== 1) {
      fail("BOSS_TRANSITION_LIMIT", pointerJoin(parametersPath, "maximumTransitionsPerResolvedHit"), "Exactly one transition per resolved hit is required");
    }
    const thresholdsPath = pointerJoin(parametersPath, "thresholds");
    requireArray(record.thresholdScript.parameters.thresholds, thresholdsPath, 1, 32);
    requireContiguousOrder(record.thresholdScript.parameters.thresholds, thresholdsPath, 0);
    let priorThreshold = 10000;
    const thresholdIds = new Set();
    const thresholdEvents = [];
    record.thresholdScript.parameters.thresholds.forEach(function (threshold, thresholdIndex) {
      const thresholdPath = pointerJoin(thresholdsPath, thresholdIndex);
      exactFields(threshold, [
        "id", "order", "thresholdHpBp", "clampHpToThreshold", "warningDelayTicks",
        "exposedWindowDurationMs", "exposedDamageCoefficientBp", "resistanceOverrides",
        "statusDeliveries", "childSpawnRecords", "maximumCreateEventsPerTick", "transitionEventIds",
      ], thresholdPath);
      requireId(threshold.id, pointerJoin(thresholdPath, "id"));
      if (thresholdIds.has(threshold.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(thresholdPath, "id"), "Duplicate boss threshold ID");
      thresholdIds.add(threshold.id);
      requireInteger(threshold.thresholdHpBp, pointerJoin(thresholdPath, "thresholdHpBp"), 1, 9999);
      if (threshold.thresholdHpBp >= priorThreshold) fail("BOSS_THRESHOLD_ORDER", pointerJoin(thresholdPath, "thresholdHpBp"), "Threshold HP values must strictly descend");
      priorThreshold = threshold.thresholdHpBp;
      if (threshold.clampHpToThreshold !== true) fail("BOSS_THRESHOLD_CLAMP", pointerJoin(thresholdPath, "clampHpToThreshold"), "Threshold clamp must be true");
      requireInteger(threshold.warningDelayTicks, pointerJoin(thresholdPath, "warningDelayTicks"), 0, LIMITS.maxSimulationTick);
      requireInteger(threshold.exposedWindowDurationMs, pointerJoin(thresholdPath, "exposedWindowDurationMs"), 1, LIMITS.maxMilliseconds);
      requireInteger(threshold.exposedDamageCoefficientBp, pointerJoin(thresholdPath, "exposedDamageCoefficientBp"), 1, 20000);
      validateResistanceRecords(threshold.resistanceOverrides, pointerJoin(thresholdPath, "resistanceOverrides"));

      const deliveriesPath = pointerJoin(thresholdPath, "statusDeliveries");
      requireArray(threshold.statusDeliveries, deliveriesPath, 0, 32);
      requireContiguousOrder(threshold.statusDeliveries, deliveriesPath, 0);
      threshold.statusDeliveries.forEach(function (delivery, deliveryIndex) {
        const deliveryPath = pointerJoin(deliveriesPath, deliveryIndex);
        exactFields(delivery, ["order", "statusId", "magnitudeBp", "durationMs", "stackRuleId", "semanticEventIds"], deliveryPath);
        requireId(delivery.statusId, pointerJoin(deliveryPath, "statusId"));
        requireInteger(delivery.magnitudeBp, pointerJoin(deliveryPath, "magnitudeBp"), 0, 10000);
        requireInteger(delivery.durationMs, pointerJoin(deliveryPath, "durationMs"), 1, LIMITS.maxMilliseconds);
        requireCatalogReference(delivery.stackRuleId, Catalog.RULE_CATALOG.stackRuleIds, pointerJoin(deliveryPath, "stackRuleId"));
        collectEventArray(delivery.semanticEventIds, pointerJoin(deliveryPath, "semanticEventIds"), thresholdEvents);
      });
      const scheduleBudget = validateOrderedChildRecords(threshold.childSpawnRecords, pointerJoin(thresholdPath, "childSpawnRecords"));
      requireInteger(threshold.maximumCreateEventsPerTick, pointerJoin(thresholdPath, "maximumCreateEventsPerTick"), 1, LIMITS.maxSpawnCount);
      if (scheduleBudget.maximumSimultaneousDue > threshold.maximumCreateEventsPerTick) {
        fail("CREATE_EVENT_CAP_UNDERRUN", pointerJoin(thresholdPath, "maximumCreateEventsPerTick"), "Authored cap is below the exact maximum simultaneous boss child creates");
      }
      collectOrderedEventArray(threshold.transitionEventIds, pointerJoin(thresholdPath, "transitionEventIds"), thresholdEvents);
    });

    const phasesPath = pointerJoin(recordPath, "phaseRecords");
    requireArray(record.phaseRecords, phasesPath, 2, 33);
    requireContiguousOrder(record.phaseRecords, phasesPath, 0);
    const phaseIds = new Set();
    record.phaseRecords.forEach(function (phase, phaseIndex) {
      const phasePath = pointerJoin(phasesPath, phaseIndex);
      exactFields(phase, [
        "id", "order", "hpUpperInclusiveBp", "hpLowerInclusiveBp", "nativeResistanceOverrides",
        "activeStatusIds", "enterEventId", "exitEventId",
      ], phasePath);
      requireId(phase.id, pointerJoin(phasePath, "id"));
      if (phaseIds.has(phase.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(phasePath, "id"), "Duplicate boss phase ID");
      phaseIds.add(phase.id);
      requireInteger(phase.hpUpperInclusiveBp, pointerJoin(phasePath, "hpUpperInclusiveBp"), 1, 10000);
      requireInteger(phase.hpLowerInclusiveBp, pointerJoin(phasePath, "hpLowerInclusiveBp"), 1, 10000);
      if (phase.hpUpperInclusiveBp < phase.hpLowerInclusiveBp) fail("BOSS_PHASE_COVERAGE", phasePath, "Phase interval is reversed");
      validateResistanceRecords(phase.nativeResistanceOverrides, pointerJoin(phasePath, "nativeResistanceOverrides"));
      requireSortedUniqueIds(phase.activeStatusIds, pointerJoin(phasePath, "activeStatusIds"), { minimum: 0, maximum: 32 });
      collectEvent(phase.enterEventId, pointerJoin(phasePath, "enterEventId"), thresholdEvents);
      collectEvent(phase.exitEventId, pointerJoin(phasePath, "exitEventId"), thresholdEvents);
    });
    if (record.phaseRecords[0].hpUpperInclusiveBp !== 10000 ||
        record.phaseRecords[record.phaseRecords.length - 1].hpLowerInclusiveBp !== 1) {
      fail("BOSS_PHASE_COVERAGE", phasesPath, "Boss phases must cover alive HP basis points 10000 through 1");
    }
    for (let phaseIndex = 0; phaseIndex < record.phaseRecords.length - 1; phaseIndex++) {
      const current = record.phaseRecords[phaseIndex];
      const next = record.phaseRecords[phaseIndex + 1];
      const threshold = record.thresholdScript.parameters.thresholds[phaseIndex];
      if (current.hpLowerInclusiveBp !== next.hpUpperInclusiveBp + 1 || !threshold ||
          threshold.thresholdHpBp !== next.hpUpperInclusiveBp) {
        fail("BOSS_PHASE_COVERAGE", pointerJoin(phasesPath, phaseIndex + 1), "Boss phases must be contiguous and agree with thresholds");
      }
    }
    if (record.thresholdScript.parameters.thresholds.length !== record.phaseRecords.length - 1) {
      fail("BOSS_PHASE_COVERAGE", phasesPath, "Every phase boundary requires one threshold");
    }
    thresholdEvents.forEach(function (event) {
      if (!common.ownedEvents.has(event.id)) fail("EVENT_OWNERSHIP", event.path, "Boss event is absent from semanticEventIds");
    });
  });
}

function validateBossSource(value) {
  preflight(value, "/");
  validateBossSourceCore(value, "/");
  return deepFrozenClone(value);
}

const MISSION_FIELDS = [
  "schemaVersion", "id", "titleKey", "actIndex", "missionIndex", "seedNamespace", "mapId",
  "prerequisiteMissionIds", "headlineMechanicId", "briefing", "enemyRosterIds", "bossRosterIds",
  "availableDefenseIds", "baseStartAether", "waves", "objectives", "firstClearRewards", "tutorial",
  "previewDeclarations", "scoreRecord", "semanticEventIds", "presentationPackId",
];

function validateObjectiveRecords(value, path) {
  requireArray(value, path, 3, 3);
  const expected = ["victory", "integrity", "mastery"];
  value.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    if (!record || record.id !== expected[index] || record.kind !== expected[index]) {
      fail("OBJECTIVE_ORDER", recordPath, "Objectives must be victory, integrity, mastery in that order");
    }
    const baseFields = ["id", "kind", "titleKey", "descriptionKey", "progressKey"];
    if (record.kind === "victory") {
      exactFields(record, baseFields.concat(["predicate"]), recordPath);
      if (record.predicate !== "mission-victory") fail("SCHEMA_ENUM", pointerJoin(recordPath, "predicate"), "Victory predicate is fixed");
    } else if (record.kind === "integrity") {
      exactFields(record, baseFields.concat(["thresholdRecords"]), recordPath);
      const thresholdPath = pointerJoin(recordPath, "thresholdRecords");
      requireArray(record.thresholdRecords, thresholdPath, 3, 3);
      ["story", "strategos", "titan"].forEach(function (difficultyId, thresholdIndex) {
        const threshold = record.thresholdRecords[thresholdIndex];
        const itemPath = pointerJoin(thresholdPath, thresholdIndex);
        exactFields(threshold, ["difficultyId", "minimumIntegrity"], itemPath);
        if (threshold.difficultyId !== difficultyId) fail("OBJECTIVE_ORDER", pointerJoin(itemPath, "difficultyId"), "Integrity difficulties use Story/Strategos/Titan order");
        requireInteger(threshold.minimumIntegrity, pointerJoin(itemPath, "minimumIntegrity"), 0, DIFFICULTY_LOCKS[thresholdIndex].integrity);
      });
    } else {
      exactFields(record, baseFields.concat(["predicate"]), recordPath);
      const predicatePath = pointerJoin(recordPath, "predicate");
      requireObject(record.predicate, predicatePath);
      if (record.predicate.kind === "maximum-owned-towers-at-victory") {
        exactFields(record.predicate, ["kind", "maximum"], predicatePath);
        requireInteger(record.predicate.maximum, pointerJoin(predicatePath, "maximum"), 0, 32);
      } else if (record.predicate.kind === "no-leaks-from-routes") {
        exactFields(record.predicate, ["kind", "routeIds"], predicatePath);
        requireSortedUniqueIds(record.predicate.routeIds, pointerJoin(predicatePath, "routeIds"), { minimum: 1, maximum: 16 });
      } else if (record.predicate.kind === "no-leaks-from-lineage-tag") {
        exactFields(record.predicate, ["kind", "lineageTag"], predicatePath);
        requireId(record.predicate.lineageTag, pointerJoin(predicatePath, "lineageTag"));
      } else {
        fail("SCHEMA_ENUM", pointerJoin(predicatePath, "kind"), "Unsupported mastery predicate");
      }
    }
    requireStringKey(record.titleKey, pointerJoin(recordPath, "titleKey"));
    requireStringKey(record.descriptionKey, pointerJoin(recordPath, "descriptionKey"));
    requireStringKey(record.progressKey, pointerJoin(recordPath, "progressKey"));
  });
}

function validateRewardRecords(value, path) {
  requireArray(value, path, 0, 32);
  requireContiguousOrder(value, path, 0);
  const ids = new Set();
  const grants = new Set();
  value.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    requireId(record.id, pointerJoin(recordPath, "id"));
    if (ids.has(record.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(recordPath, "id"), "Duplicate reward ID");
    ids.add(record.id);
    let grantKey;
    if (record.kind === "unlock-defense") {
      exactFields(record, ["id", "order", "kind", "defenseId"], recordPath);
      requireId(record.defenseId, pointerJoin(recordPath, "defenseId"));
      grantKey = "unlock-defense:" + record.defenseId;
    } else if (record.kind === "campaign-modifier") {
      exactFields(record, ["id", "order", "kind", "campaignModifierId", "amountAether"], recordPath);
      requireId(record.campaignModifierId, pointerJoin(recordPath, "campaignModifierId"));
      requireInteger(record.amountAether, pointerJoin(recordPath, "amountAether"), 0, LIMITS.maxAether);
      grantKey = "campaign-modifier:" + record.campaignModifierId;
    } else if (record.kind === "loadout-slot") {
      exactFields(record, ["id", "order", "kind", "slotCap"], recordPath);
      requireInteger(record.slotCap, pointerJoin(recordPath, "slotCap"), 1, 15);
      grantKey = "loadout-slot:" + record.slotCap;
    } else {
      fail("SCHEMA_ENUM", pointerJoin(recordPath, "kind"), "Unsupported first-clear reward kind");
    }
    if (grants.has(grantKey)) fail("REWARD_DUPLICATE_GRANT", recordPath, "A first-clear grant may appear only once per mission");
    grants.add(grantKey);
  });
}

function validatePreviewRecords(value, path, waveCount, groupIds, events) {
  requireArray(value, path, 0, 64);
  requireRecordOrder(value, path);
  const mechanicIds = new Set();
  value.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    const common = [
      "id", "mechanicId", "briefingKey", "previewKind", "firstLethalWaveIndex", "semanticCueIds",
    ];
    if (record.previewKind === "briefing") {
      exactFields(record, common, recordPath);
    } else if (record.previewKind === "nonlethal-semantic-event") {
      exactFields(record, common.concat(["previewEventId"]), recordPath);
      collectEvent(record.previewEventId, pointerJoin(recordPath, "previewEventId"), events);
    } else if (record.previewKind === "harmless-group") {
      exactFields(record, common.concat(["previewGroupId"]), recordPath);
      requireId(record.previewGroupId, pointerJoin(recordPath, "previewGroupId"));
      const group = groupIds.get(record.previewGroupId);
      if (!group) fail("REFERENCE_UNKNOWN", pointerJoin(recordPath, "previewGroupId"), "Unknown preview group");
      if (group.waveIndex >= record.firstLethalWaveIndex) fail("PREVIEW_ORDER", pointerJoin(recordPath, "firstLethalWaveIndex"), "Harmless preview must occur before first lethal wave");
    } else {
      fail("SCHEMA_ENUM", pointerJoin(recordPath, "previewKind"), "Unsupported preview kind");
    }
    requireId(record.mechanicId, pointerJoin(recordPath, "mechanicId"));
    if (mechanicIds.has(record.mechanicId)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(recordPath, "mechanicId"), "A lethal mechanic may have only one preview declaration");
    mechanicIds.add(record.mechanicId);
    requireStringKey(record.briefingKey, pointerJoin(recordPath, "briefingKey"));
    requireInteger(record.firstLethalWaveIndex, pointerJoin(recordPath, "firstLethalWaveIndex"), 1, waveCount);
    requireSortedUniqueIds(record.semanticCueIds, pointerJoin(recordPath, "semanticCueIds"), { minimum: 1, maximum: 32 });
  });
}

function validateMissionSourceCore(value, path) {
  exactFields(value, MISSION_FIELDS, path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));
  requireStringKey(value.titleKey, pointerJoin(path, "titleKey"));
  requireInteger(value.actIndex, pointerJoin(path, "actIndex"), 1, 4);
  requireInteger(value.missionIndex, pointerJoin(path, "missionIndex"), 1, 20);
  requireId(value.seedNamespace, pointerJoin(path, "seedNamespace"));
  requireId(value.mapId, pointerJoin(path, "mapId"));
  requireSortedUniqueIds(value.prerequisiteMissionIds, pointerJoin(path, "prerequisiteMissionIds"), { minimum: 0, maximum: 20 });
  if (value.prerequisiteMissionIds.indexOf(value.id) !== -1) fail("MISSION_PREREQUISITE_CYCLE", pointerJoin(path, "prerequisiteMissionIds"), "Mission cannot require itself");
  requireId(value.headlineMechanicId, pointerJoin(path, "headlineMechanicId"));

  const briefingPath = pointerJoin(path, "briefing");
  exactFields(value.briefing, ["summaryKey", "objectiveKey", "routeNoticeKeys", "mechanicNoticeKeys"], briefingPath);
  requireStringKey(value.briefing.summaryKey, pointerJoin(briefingPath, "summaryKey"));
  requireStringKey(value.briefing.objectiveKey, pointerJoin(briefingPath, "objectiveKey"));
  requireUniqueStringKeys(value.briefing.routeNoticeKeys, pointerJoin(briefingPath, "routeNoticeKeys"));
  requireUniqueStringKeys(value.briefing.mechanicNoticeKeys, pointerJoin(briefingPath, "mechanicNoticeKeys"));

  requireSortedUniqueIds(value.enemyRosterIds, pointerJoin(path, "enemyRosterIds"), { minimum: 0, maximum: LIMITS.maxRegularEnemies });
  requireSortedUniqueIds(value.bossRosterIds, pointerJoin(path, "bossRosterIds"), { minimum: 0, maximum: LIMITS.maxBosses });
  requireSortedUniqueIds(value.availableDefenseIds, pointerJoin(path, "availableDefenseIds"), { minimum: 1, maximum: LIMITS.maxDefenses });
  requireInteger(value.baseStartAether, pointerJoin(path, "baseStartAether"), 0, LIMITS.maxAether);

  const ownedEvents = requireSortedUniqueIds(value.semanticEventIds, pointerJoin(path, "semanticEventIds"), { minimum: 0, maximum: LIMITS.maxSemanticEventsPerOwner });
  const emittedEvents = [];
  const wavesPath = pointerJoin(path, "waves");
  requireArray(value.waves, wavesPath, 1, LIMITS.maxWavesPerMission);
  const waveIds = new Set();
  const groupIds = new Map();
  const rngStreams = new Set();
  value.waves.forEach(function (wave, waveIndex) {
    const wavePath = pointerJoin(wavesPath, waveIndex);
    exactFields(wave, [
      "id", "index", "baseAetherEnvelope", "deploymentGrantAether", "clearGrantAether", "groups",
      "previewDeclarationIds", "waveClearScore", "titleKey", "deploymentGrantEventId", "clearGrantEventId",
    ], wavePath);
    requireId(wave.id, pointerJoin(wavePath, "id"));
    if (waveIds.has(wave.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(wavePath, "id"), "Duplicate wave ID");
    waveIds.add(wave.id);
    requireInteger(wave.index, pointerJoin(wavePath, "index"), waveIndex + 1, waveIndex + 1);
    requireInteger(wave.baseAetherEnvelope, pointerJoin(wavePath, "baseAetherEnvelope"), 0, LIMITS.maxAether);
    requireInteger(wave.deploymentGrantAether, pointerJoin(wavePath, "deploymentGrantAether"), 0, LIMITS.maxAether);
    requireInteger(wave.clearGrantAether, pointerJoin(wavePath, "clearGrantAether"), 0, LIMITS.maxAether);
    if ((wave.deploymentGrantAether === 0) !== (wave.deploymentGrantEventId === null)) {
      fail("WAVE_GRANT_EVENT", pointerJoin(wavePath, "deploymentGrantEventId"), "Deployment event is null exactly when its grant is zero");
    }
    if ((wave.clearGrantAether === 0) !== (wave.clearGrantEventId === null)) {
      fail("WAVE_GRANT_EVENT", pointerJoin(wavePath, "clearGrantEventId"), "Clear event is null exactly when its grant is zero");
    }
    if (wave.deploymentGrantEventId !== null) collectEvent(wave.deploymentGrantEventId, pointerJoin(wavePath, "deploymentGrantEventId"), emittedEvents);
    if (wave.clearGrantEventId !== null) collectEvent(wave.clearGrantEventId, pointerJoin(wavePath, "clearGrantEventId"), emittedEvents);

    const groupsPath = pointerJoin(wavePath, "groups");
    requireArray(wave.groups, groupsPath, 1, LIMITS.maxGroupsPerWave);
    requireContiguousOrder(wave.groups, groupsPath, 0);
    wave.groups.forEach(function (group, groupIndex) {
      const groupPath = pointerJoin(groupsPath, groupIndex);
      const common = [
        "id", "order", "spawnKind", "routeId", "count", "firstTick", "intervalTicks",
        "shuffleWithinGroup", "rngStreamId", "modifierIds", "bountyPolicy", "spawnEventId",
      ];
      if (group.spawnKind === "enemy") {
        exactFields(group, common.concat(["enemyId"]), groupPath);
        requireId(group.enemyId, pointerJoin(groupPath, "enemyId"));
      } else if (group.spawnKind === "boss") {
        exactFields(group, common.concat(["bossId"]), groupPath);
        requireId(group.bossId, pointerJoin(groupPath, "bossId"));
      } else {
        fail("SCHEMA_ENUM", pointerJoin(groupPath, "spawnKind"), "Spawn kind must be enemy or boss");
      }
      requireId(group.id, pointerJoin(groupPath, "id"));
      if (groupIds.has(group.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(groupPath, "id"), "Duplicate group ID");
      groupIds.set(group.id, { waveIndex: wave.index, record: group });
      requireId(group.routeId, pointerJoin(groupPath, "routeId"));
      requireInteger(group.count, pointerJoin(groupPath, "count"), 1, LIMITS.maxSpawnCount);
      requireInteger(group.firstTick, pointerJoin(groupPath, "firstTick"), 0, LIMITS.maxSimulationTick);
      requireInteger(group.intervalTicks, pointerJoin(groupPath, "intervalTicks"), 1, LIMITS.maxSimulationTick);
      const finalTick = group.firstTick + (group.count - 1) * group.intervalTicks;
      if (!Number.isSafeInteger(finalTick) || finalTick > LIMITS.maxSimulationTick) fail("SCHEMA_RANGE", pointerJoin(groupPath, "intervalTicks"), "Spawn schedule exceeds maximum tick");
      requireBoolean(group.shuffleWithinGroup, pointerJoin(groupPath, "shuffleWithinGroup"));
      if (group.shuffleWithinGroup) {
        requireId(group.rngStreamId, pointerJoin(groupPath, "rngStreamId"));
        if (rngStreams.has(group.rngStreamId)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(groupPath, "rngStreamId"), "RNG stream may be consumed by only one shuffled group");
        rngStreams.add(group.rngStreamId);
      } else if (group.rngStreamId !== null) {
        fail("SCHEMA_ENUM", pointerJoin(groupPath, "rngStreamId"), "Unshuffled groups require null rngStreamId");
      }
      requireSortedUniqueIds(group.modifierIds, pointerJoin(groupPath, "modifierIds"), { minimum: 0, maximum: 32 });
      if (group.modifierIds.length !== 0) {
        fail("GROUP_MODIFIER_UNIMPLEMENTED", pointerJoin(groupPath, "modifierIds"), "Schema-v3 slice groups cannot reference modifiers until a closed group-modifier catalog exists");
      }
      requireEnum(group.bountyPolicy, ["base-lineage", "suppressed"], pointerJoin(groupPath, "bountyPolicy"));
      collectEvent(group.spawnEventId, pointerJoin(groupPath, "spawnEventId"), emittedEvents);
    });
    analyzeAuthoredSchedule(
      wave.groups,
      groupsPath,
      { count: "count", firstTick: "firstTick", intervalTicks: "intervalTicks" },
      LIMITS.maxTotalSpawnsPerWave,
      LIMITS.maxSimultaneousWaveSpawns
    );
    requireSortedUniqueIds(wave.previewDeclarationIds, pointerJoin(wavePath, "previewDeclarationIds"), { minimum: 0, maximum: 64 });
    requireInteger(wave.waveClearScore, pointerJoin(wavePath, "waveClearScore"), 0, LIMITS.maxScore);
    requireStringKey(wave.titleKey, pointerJoin(wavePath, "titleKey"));
  });
  const finalWave = value.waves[value.waves.length - 1];
  if (finalWave.clearGrantAether !== 0) fail("FINAL_WAVE_CLEAR_GRANT", pointerJoin(wavesPath, value.waves.length - 1), "Final wave clear grant must be zero");
  finalWave.groups.forEach(function (group, index) {
    if (group.bountyPolicy !== "suppressed") fail("FINAL_WAVE_BOUNTY", pointerJoin(pointerJoin(pointerJoin(wavesPath, value.waves.length - 1), "groups"), index), "Final-wave lineage bounty must be suppressed");
  });

  validateObjectiveRecords(value.objectives, pointerJoin(path, "objectives"));
  validateRewardRecords(value.firstClearRewards, pointerJoin(path, "firstClearRewards"));

  const tutorialPath = pointerJoin(path, "tutorial");
  requireObject(value.tutorial, tutorialPath);
  if (value.tutorial.kind === "none") {
    exactFields(value.tutorial, ["kind"], tutorialPath);
  } else if (value.tutorial.kind === "guided") {
    exactFields(value.tutorial, [
      "kind", "modeId", "stepIds", "upgradeGateMode", "skipCommandType", "semanticEventIds",
    ], tutorialPath);
    if (value.id !== "m01" || value.tutorial.upgradeGateMode !== "m01-wave1" ||
        value.tutorial.skipCommandType !== "skipTutorialGate") {
      fail("TUTORIAL_SCOPE", tutorialPath, "Guided upgrade-gate tutorial is valid only for m01");
    }
    requireId(value.tutorial.modeId, pointerJoin(tutorialPath, "modeId"));
    requireUniqueDisplayIds(value.tutorial.stepIds, pointerJoin(tutorialPath, "stepIds"));
    collectEventArray(value.tutorial.semanticEventIds, pointerJoin(tutorialPath, "semanticEventIds"), emittedEvents);
  } else {
    fail("SCHEMA_ENUM", pointerJoin(tutorialPath, "kind"), "Unsupported tutorial kind");
  }

  validatePreviewRecords(value.previewDeclarations, pointerJoin(path, "previewDeclarations"), value.waves.length, groupIds, emittedEvents);
  const previewById = new Map(value.previewDeclarations.map(function (record) { return [record.id, record]; }));
  if (!value.previewDeclarations.some(function (record) { return record.mechanicId === value.headlineMechanicId; })) {
    fail("PREVIEW_MISSING", pointerJoin(path, "headlineMechanicId"), "The headline lethal mechanic requires a preview declaration");
  }
  const assignedPreviewIds = new Set();
  value.waves.forEach(function (wave, waveIndex) {
    wave.previewDeclarationIds.forEach(function (id, index) {
      const itemPath = pointerJoin(pointerJoin(pointerJoin(wavesPath, waveIndex), "previewDeclarationIds"), index);
      const declaration = previewById.get(id);
      if (!declaration) fail("REFERENCE_UNKNOWN", itemPath, "Unknown preview declaration");
      if (assignedPreviewIds.has(id)) fail("PREVIEW_DUPLICATE_ASSIGNMENT", itemPath, "A preview declaration may be assigned to only one wave");
      if (wave.index > declaration.firstLethalWaveIndex) {
        fail("PREVIEW_ORDER", itemPath, "A preview must be declared no later than its first lethal wave");
      }
      assignedPreviewIds.add(id);
    });
  });
  value.previewDeclarations.forEach(function (record, index) {
    if (!assignedPreviewIds.has(record.id)) {
      fail("PREVIEW_UNUSED", pointerJoin(pointerJoin(pointerJoin(path, "previewDeclarations"), index), "id"), "Every preview declaration must be assigned to one wave");
    }
  });

  const scorePath = pointerJoin(path, "scoreRecord");
  exactFields(value.scoreRecord, [
    "scoreRuleId", "victoryScore", "integrityPointScore", "masteryObjectiveScore",
    "rawUnspentScorePerEligibleAether",
  ], scorePath);
  requireId(value.scoreRecord.scoreRuleId, pointerJoin(scorePath, "scoreRuleId"));
  ["victoryScore", "integrityPointScore", "masteryObjectiveScore", "rawUnspentScorePerEligibleAether"].forEach(function (key) {
    requireInteger(value.scoreRecord[key], pointerJoin(scorePath, key), 0, LIMITS.maxScore);
  });
  requireId(value.presentationPackId, pointerJoin(path, "presentationPackId"));
  emittedEvents.forEach(function (event) {
    if (!ownedEvents.has(event.id)) fail("EVENT_OWNERSHIP", event.path, "Mission event is absent from semanticEventIds");
  });
}

function validateMissionSource(value) {
  preflight(value, "/");
  validateMissionSourceCore(value, "/");
  return deepFrozenClone(value);
}

function validateEventCatalogCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "records"], path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), Catalog.EVENT_SCHEMA_VERSION, Catalog.EVENT_SCHEMA_VERSION);
  requireId(value.id, pointerJoin(path, "id"));
  const recordsPath = pointerJoin(path, "records");
  requireArray(value.records, recordsPath, 0, LIMITS.maxCatalogRecords);
  requireRecordOrder(value.records, recordsPath);
  value.records.forEach(function (record, index) {
    const recordPath = pointerJoin(recordsPath, index);
    exactFields(record, ["id", "version", "phaseId", "payloadFields", "highlightTags", "presentationCueId"], recordPath);
    requireInteger(record.version, pointerJoin(recordPath, "version"), 1, 1);
    requireCatalogReference(record.phaseId, Catalog.PHASE_IDS, pointerJoin(recordPath, "phaseId"));
    const fieldsPath = pointerJoin(recordPath, "payloadFields");
    requireArray(record.payloadFields, fieldsPath, 0, 64);
    const names = new Set();
    record.payloadFields.forEach(function (field, fieldIndex) {
      const fieldPath = pointerJoin(fieldsPath, fieldIndex);
      exactFields(field, ["name", "type", "required", "nullable"], fieldPath);
      requireId(field.name, pointerJoin(fieldPath, "name"));
      if (names.has(field.name)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(fieldPath, "name"), "Duplicate payload field name");
      names.add(field.name);
      requireEnum(field.type, Catalog.EVENT_PAYLOAD_TYPES, pointerJoin(fieldPath, "type"));
      requireBoolean(field.required, pointerJoin(fieldPath, "required"));
      requireBoolean(field.nullable, pointerJoin(fieldPath, "nullable"));
    });
    requireSortedUniqueIds(record.highlightTags, pointerJoin(recordPath, "highlightTags"), { minimum: 0, maximum: 32 });
    requireId(record.presentationCueId, pointerJoin(recordPath, "presentationCueId"));
  });
}

function validateEventCatalog(value) {
  preflight(value, "/");
  validateEventCatalogCore(value, "/");
  return deepFrozenClone(value);
}

function validateStringCatalogCore(value, path) {
  exactFields(value, ["schemaVersion", "id", "locale", "fallbackLocale", "entries"], path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));
  if (typeof value.locale !== "string" || !LOCALE.test(value.locale)) fail("SCHEMA_STRING", pointerJoin(path, "locale"), "Invalid locale");
  if (value.fallbackLocale !== null && (typeof value.fallbackLocale !== "string" || !LOCALE.test(value.fallbackLocale) || value.fallbackLocale === value.locale)) {
    fail("SCHEMA_STRING", pointerJoin(path, "fallbackLocale"), "Fallback locale must be null or another valid locale");
  }
  const entriesPath = pointerJoin(path, "entries");
  requireArray(value.entries, entriesPath, 1, LIMITS.maxStringEntries);
  requireRecordOrder(value.entries, entriesPath, "key");
  value.entries.forEach(function (entry, index) {
    const entryPath = pointerJoin(entriesPath, index);
    exactFields(entry, ["key", "value", "placeholders"], entryPath);
    requireStringKey(entry.key, pointerJoin(entryPath, "key"));
    requireString(entry.value, pointerJoin(entryPath, "value"));
    if (Buffer.byteLength(entry.value, "utf8") > 1024) fail("SCHEMA_LIMIT", pointerJoin(entryPath, "value"), "Localized value exceeds 1024 UTF-8 bytes");
    if (/[\x00-\x09\x0b-\x1f\x7f]/.test(entry.value)) fail("STRING_CONTROL", pointerJoin(entryPath, "value"), "Localized value contains a forbidden control character");
    if (/[<>]/.test(entry.value)) fail("STRING_HTML_FORBIDDEN", pointerJoin(entryPath, "value"), "Localized strings cannot contain HTML");

    const placeholdersPath = pointerJoin(entryPath, "placeholders");
    requireArray(entry.placeholders, placeholdersPath, 0, 64);
    const declared = new Map();
    entry.placeholders.forEach(function (placeholder, placeholderIndex) {
      const placeholderPath = pointerJoin(placeholdersPath, placeholderIndex);
      exactFields(placeholder, ["name", "type"], placeholderPath);
      requireId(placeholder.name, pointerJoin(placeholderPath, "name"));
      if (declared.has(placeholder.name)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(placeholderPath, "name"), "Duplicate placeholder name");
      requireEnum(placeholder.type, Catalog.PLACEHOLDER_TYPES, pointerJoin(placeholderPath, "type"));
      declared.set(placeholder.name, 0);
    });
    const actual = new Map();
    let match;
    PLACEHOLDER.lastIndex = 0;
    while ((match = PLACEHOLDER.exec(entry.value)) !== null) actual.set(match[1], (actual.get(match[1]) || 0) + 1);
    if (/[{}]/.test(entry.value.replace(PLACEHOLDER, ""))) fail("STRING_PLACEHOLDER_MISMATCH", pointerJoin(entryPath, "value"), "Malformed placeholder braces");
    if (actual.size !== declared.size || Array.from(declared.keys()).some(function (name) { return actual.get(name) !== 1; })) {
      fail("STRING_PLACEHOLDER_MISMATCH", pointerJoin(entryPath, "value"), "Text must use every declared placeholder exactly once and no others");
    }
  });
}

function validateStringCatalog(value) {
  preflight(value, "/");
  validateStringCatalogCore(value, "/");
  return deepFrozenClone(value);
}

function normalizePresentationOptions(options) {
  preflight(options, "/options", { sourceByteLimit: false });
  exactFields(options, ["approvalState", "missionIds", "missionPackRecords", "cueIds"], "/options");
  return deepFrozenClone({
    approvalState: options.approvalState,
    missionIds: options.missionIds,
    missionPackRecords: options.missionPackRecords,
    cueIds: options.cueIds,
  });
}

function validatePresentationCatalogCore(value, path, options) {
  if (options.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", path, "Presentation catalog schema v1 can never be production-approved");
  }
  requireEnum(options.approvalState, ["balance-approved", "candidate-balance"], "/approvalState");
  requireSortedUniqueIds(options.missionIds, "/options/missionIds", { minimum: 1, maximum: LIMITS.maxMissions });
  requireSortedUniqueIds(options.cueIds, "/options/cueIds", { minimum: 0, maximum: LIMITS.maxCatalogRecords });
  exactFields(value, ["schemaVersion", "id", "packRecords", "cueMappings"], path);
  requireInteger(value.schemaVersion, pointerJoin(path, "schemaVersion"), 1, 1);
  requireId(value.id, pointerJoin(path, "id"));

  const packsPath = pointerJoin(path, "packRecords");
  requireArray(value.packRecords, packsPath, 1, LIMITS.maxMissions);
  requireRecordOrder(value.packRecords, packsPath);
  const missionAssignments = new Map();
  const packIds = new Set();
  value.packRecords.forEach(function (record, index) {
    const recordPath = pointerJoin(packsPath, index);
    exactFields(record, ["id", "kind", "missionIds", "fallbackStyleId"], recordPath);
    packIds.add(record.id);
    if (record.kind !== "procedural-placeholder") {
      fail("PRESENTATION_KIND", pointerJoin(recordPath, "kind"), "Schema v1 permits procedural-placeholder packs only");
    }
    requireSortedUniqueIds(record.missionIds, pointerJoin(recordPath, "missionIds"), { minimum: 1, maximum: LIMITS.maxMissions });
    requireCatalogReference(record.fallbackStyleId, Catalog.PRESENTATION_FALLBACK_STYLE_IDS, pointerJoin(recordPath, "fallbackStyleId"));
    record.missionIds.forEach(function (missionId, missionIndex) {
      const missionPath = pointerJoin(pointerJoin(recordPath, "missionIds"), missionIndex);
      if (missionAssignments.has(missionId)) fail("PRESENTATION_MISSION_ASSIGNMENT", missionPath, "Mission is assigned to more than one presentation pack");
      missionAssignments.set(missionId, record.id);
    });
  });

  const expectedMissions = new Set(options.missionIds);
  if (missionAssignments.size !== expectedMissions.size || Array.from(expectedMissions).some(function (id) { return !missionAssignments.has(id); })) {
    fail("PRESENTATION_MISSION_ASSIGNMENT", packsPath, "Every included mission must belong to exactly one pack");
  }
  requireArray(options.missionPackRecords, "/options/missionPackRecords", options.missionIds.length, options.missionIds.length);
  const assignmentMissions = new Set();
  options.missionPackRecords.forEach(function (assignment, index) {
    const assignmentPath = pointerJoin("/options/missionPackRecords", index);
    exactFields(assignment, ["missionId", "presentationPackId"], assignmentPath);
    requireId(assignment.missionId, pointerJoin(assignmentPath, "missionId"));
    requireId(assignment.presentationPackId, pointerJoin(assignmentPath, "presentationPackId"));
    if (assignmentMissions.has(assignment.missionId) || !expectedMissions.has(assignment.missionId) ||
        !packIds.has(assignment.presentationPackId) || missionAssignments.get(assignment.missionId) !== assignment.presentationPackId) {
      fail("PRESENTATION_MISSION_ASSIGNMENT", assignmentPath, "Mission presentationPackId does not match its unique pack assignment");
    }
    assignmentMissions.add(assignment.missionId);
  });

  const cuesPath = pointerJoin(path, "cueMappings");
  requireArray(value.cueMappings, cuesPath, 0, LIMITS.maxCatalogRecords);
  requireRecordOrder(value.cueMappings, cuesPath, "cueId");
  const mappedCues = new Set();
  value.cueMappings.forEach(function (record, index) {
    const recordPath = pointerJoin(cuesPath, index);
    exactFields(record, ["cueId", "kind", "fallbackStyleId"], recordPath);
    mappedCues.add(record.cueId);
    if (record.kind !== "semantic-fallback") {
      fail("PRESENTATION_KIND", pointerJoin(recordPath, "kind"), "Schema v1 permits semantic-fallback cues only");
    }
    requireCatalogReference(record.fallbackStyleId, Catalog.PRESENTATION_FALLBACK_STYLE_IDS, pointerJoin(recordPath, "fallbackStyleId"));
  });
  const expectedCues = new Set(options.cueIds);
  if (mappedCues.size !== expectedCues.size || Array.from(expectedCues).some(function (id) { return !mappedCues.has(id); })) {
    fail("PRESENTATION_CUE_ASSIGNMENT", cuesPath, "Every referenced cue must resolve exactly once and no extra cue is allowed");
  }
}

function validatePresentationCatalog(value, optionInput) {
  const options = normalizePresentationOptions(optionInput);
  if (options.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/", "Presentation catalog schema v1 can never be production-approved");
  }
  preflight(value, "/");
  validatePresentationCatalogCore(value, "/", options);
  return deepFrozenClone(value);
}

function requireSliceIds(records, expected, path, code) {
  const actual = records.map(function (record) { return record.id; });
  requireExactArray(actual, expected, path, code);
}

function walkReferences(value, path, singularKeys, arrayKeys, output) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { walkReferences(item, pointerJoin(path, index), singularKeys, arrayKeys, output); });
    return;
  }
  Object.keys(value).forEach(function (key) {
    const childPath = pointerJoin(path, key);
    const child = value[key];
    if (singularKeys.has(key) && child !== null) {
      output.push({ id: child, path: childPath });
    } else if (arrayKeys.has(key)) {
      child.forEach(function (id, index) { output.push({ id: id, path: pointerJoin(childPath, index) }); });
    }
    walkReferences(child, childPath, singularKeys, arrayKeys, output);
  });
}

function assertReferences(references, known, code) {
  references.forEach(function (reference) {
    if (!known.has(reference.id)) fail(code || "REFERENCE_UNKNOWN", reference.path, "Referenced ID does not resolve");
  });
}

function orderedChildReferencesForOwner(owner, ownerPath) {
  const references = [];
  [
    { behavior: owner.spawnBehavior, path: pointerJoin(ownerPath, "spawnBehavior") },
    { behavior: owner.deathBehavior, path: pointerJoin(ownerPath, "deathBehavior") },
  ].forEach(function (entry) {
    if (entry.behavior.kind !== "ordered-children") return;
    entry.behavior.childSpawnRecords.forEach(function (child, index) {
      references.push({
        id: child.enemyId,
        path: pointerJoin(pointerJoin(entry.path, "childSpawnRecords"), index) + "/enemyId",
      });
    });
  });
  if (owner.thresholdScript) {
    owner.thresholdScript.parameters.thresholds.forEach(function (threshold, thresholdIndex) {
      threshold.childSpawnRecords.forEach(function (child, childIndex) {
        references.push({
          id: child.enemyId,
          path: pointerJoin(
            pointerJoin(
              pointerJoin(
                pointerJoin(
                  pointerJoin(ownerPath, "thresholdScript"),
                  "parameters"
                ),
                "thresholds"
              ),
              thresholdIndex
            ),
            "childSpawnRecords"
          ) + "/" + childIndex + "/enemyId",
        });
      });
    });
  }
  return references;
}

function normalizeNonMapSliceOptions(optionInput) {
  if (optionInput === undefined) {
    return Object.freeze({ previewProofMode: "reject-unproven" });
  }
  preflight(optionInput, "/options");
  exactFields(optionInput, ["previewProofMode"], "/options");
  requireEnum(optionInput.previewProofMode, ["defer-to-map-compiler"], "/options/previewProofMode");
  return Object.freeze({ previewProofMode: optionInput.previewProofMode });
}

// Canonical Task-4 aggregate validation. Map IDs, route compatibility, route
// mastery, and compiler-verifiable lethality provenance remain fail-closed for
// Task 5, where normalized map IR is available.
function validateNonMapSliceRecordSet(value, optionInput) {
  const options = normalizeNonMapSliceOptions(optionInput);
  preflight(value, "/", { sourceByteLimit: false });
  exactFields(value, [
    "approvalState", "campaignRules", "defenses", "enemies", "bosses", "missions",
    "eventCatalog", "stringCatalog", "presentationCatalog",
  ], "/");
  requireEnum(value.approvalState, ["candidate-balance", "balance-approved", "production-approved"], "/approvalState");
  if (value.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/presentationCatalog", "Presentation catalog schema v1 can never be production-approved");
  }
  requireArray(value.missions, "/missions", 1, LIMITS.maxMissions);
  [
    [value.campaignRules, "/campaignRules"],
    [value.defenses, "/defenses"],
    [value.enemies, "/enemies"],
    [value.bosses, "/bosses"],
    [value.eventCatalog, "/eventCatalog"],
    [value.stringCatalog, "/stringCatalog"],
    [value.presentationCatalog, "/presentationCatalog"],
  ].forEach(function (entry) { preflight(entry[0], entry[1]); });
  value.missions.forEach(function (mission, index) { preflight(mission, pointerJoin("/missions", index)); });
  validateCampaignRulesCore(value.campaignRules, "/campaignRules");
  validateDefenseSourceCore(value.defenses, "/defenses");
  validateEnemySourceCore(value.enemies, "/enemies");
  validateBossSourceCore(value.bosses, "/bosses");
  validateEventCatalogCore(value.eventCatalog, "/eventCatalog");
  validateStringCatalogCore(value.stringCatalog, "/stringCatalog");

  const missionsPath = "/missions";
  requireRecordOrder(value.missions, missionsPath);
  value.missions.forEach(function (mission, index) { validateMissionSourceCore(mission, pointerJoin(missionsPath, index)); });
  const pendingPreviewProofRecords = [];
  value.missions.forEach(function (mission, missionIndex) {
    mission.previewDeclarations.forEach(function (record, previewIndex) {
      if (record.previewKind !== "briefing") {
        if (options.previewProofMode !== "defer-to-map-compiler") {
          fail(
            "PREVIEW_PROOF_UNIMPLEMENTED",
            pointerJoin(pointerJoin(pointerJoin(pointerJoin(missionsPath, missionIndex), "previewDeclarations"), previewIndex), "previewKind"),
            "Non-briefing previews require Task-5 compiler lethality provenance"
          );
        }
        const pending = {
          missionId: mission.id,
          previewDeclarationId: record.id,
          mechanicId: record.mechanicId,
          previewKind: record.previewKind,
          firstLethalWaveIndex: record.firstLethalWaveIndex,
        };
        if (record.previewKind === "nonlethal-semantic-event") {
          pending.previewEventId = record.previewEventId;
        } else {
          pending.previewGroupId = record.previewGroupId;
        }
        pendingPreviewProofRecords.push(pending);
      }
    });
  });

  requireSliceIds(value.defenses.records, Catalog.SLICE_IDS.defenses, "/defenses/records", "SLICE_RECORD_SET");
  requireSliceIds(value.enemies.records, Catalog.SLICE_IDS.enemies, "/enemies/records", "SLICE_RECORD_SET");
  requireSliceIds(value.bosses.records, Catalog.SLICE_IDS.bosses, "/bosses/records", "SLICE_RECORD_SET");
  requireSliceIds(value.missions, Catalog.SLICE_IDS.missions, "/missions", "SLICE_RECORD_SET");

  const echo = value.enemies.records.find(function (record) { return record.id === "echo"; });
  if (!echo || echo.traits.length !== 1 || echo.traits[0].kind !== "cloak" || echo.traits[0].version !== 1) {
    fail("SLICE_ECHO_CLOAK", "/enemies/records", "Echo requires exactly one cloak-v1 trait");
  }
  value.enemies.records.forEach(function (record, index) {
    if (record.id !== "echo" && record.traits.length !== 0) {
      fail("SLICE_ENEMY_TRAIT", pointerJoin(pointerJoin("/enemies/records", index), "traits"), "Only Echo has a slice trait");
    }
  });

  const accessGrants = new Set(value.campaignRules.accessGrantIds);
  const unlocks = new Set();
  const defenseIds = new Set();
  // This is the alphabetical defense-to-unlock mapping, not the ordered
  // resolved accessGrantIds captured by the Task-7 replay Start record.
  const defenseUnlockGrantMappings = [];
  value.defenses.records.forEach(function (defense, index) {
    const defensePath = pointerJoin("/defenses/records", index);
    defenseIds.add(defense.id);
    if (unlocks.has(defense.unlockId)) fail("ACCESS_GRANT_MAPPING", pointerJoin(defensePath, "unlockId"), "Two defenses cannot share one access grant");
    if (!accessGrants.has(defense.unlockId)) fail("REFERENCE_UNKNOWN", pointerJoin(defensePath, "unlockId"), "Defense unlockId is absent from campaign access grants");
    unlocks.add(defense.unlockId);
    defenseUnlockGrantMappings.push({ defenseId: defense.id, accessGrantId: defense.unlockId });
  });

  const policyIds = new Set(value.campaignRules.targetPolicyRecords.map(function (record) { return record.id; }));
  value.defenses.records.forEach(function (defense, defenseIndex) {
    defense.allowedTargetPolicyIds.forEach(function (policyId, index) {
      if (!policyIds.has(policyId)) fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(pointerJoin("/defenses/records", defenseIndex), "allowedTargetPolicyIds"), index), "Unknown campaign target policy");
    });
  });

  const enemyById = new Map(value.enemies.records.map(function (record) { return [record.id, record]; }));
  const bossById = new Map(value.bosses.records.map(function (record) { return [record.id, record]; }));
  const enemyIds = new Set(enemyById.keys());
  const bossIds = new Set(bossById.keys());
  const modifierById = new Map(value.campaignRules.campaignModifierRecords.map(function (record) { return [record.id, record]; }));
  const missionCatalogIds = new Set(value.campaignRules.missionCatalogIds);
  const missionById = new Map(value.missions.map(function (record) { return [record.id, record]; }));

  const childrenByOwner = new Map();
  [
    { records: value.enemies.records, path: "/enemies/records" },
    { records: value.bosses.records, path: "/bosses/records" },
  ].forEach(function (source) {
    source.records.forEach(function (owner, ownerIndex) {
      const references = orderedChildReferencesForOwner(owner, pointerJoin(source.path, ownerIndex));
      references.forEach(function (reference) {
        if (!enemyIds.has(reference.id)) {
          fail("REFERENCE_UNKNOWN", reference.path, "Child enemy does not resolve globally");
        }
      });
      childrenByOwner.set(owner, references.map(function (reference) { return enemyById.get(reference.id); }));
    });
  });

  const m05Binding = missionById.get("m05");
  if (!m05Binding || m05Binding.bossRosterIds.indexOf("talos-prototype") === -1) {
    fail("SLICE_M05_TALOS", "/missions/2/bossRosterIds", "Mission 5 requires Talos Prototype in its boss roster");
  }
  const hasTalosGroup = m05Binding.waves.some(function (wave) {
    return wave.groups.some(function (group) {
      return group.spawnKind === "boss" && group.bossId === "talos-prototype";
    });
  });
  if (!hasTalosGroup) {
    fail("SLICE_M05_TALOS", "/missions/2/waves", "Mission 5 requires at least one Talos Prototype spawn group");
  }

  function reachableOwners(initialOwners) {
    const output = [];
    const seen = new Set();
    const pending = initialOwners.slice();
    while (pending.length > 0) {
      const owner = pending.pop();
      if (!owner || seen.has(owner)) continue;
      seen.add(owner);
      output.push(owner);
      (childrenByOwner.get(owner) || []).forEach(function (child) { pending.push(child); });
    }
    return output;
  }

  value.missions.forEach(function (mission, missionIndex) {
    const missionPath = pointerJoin("/missions", missionIndex);
    if (!missionCatalogIds.has(mission.id)) fail("REFERENCE_UNKNOWN", pointerJoin(missionPath, "id"), "Mission is absent from campaign mission catalog");
    mission.prerequisiteMissionIds.forEach(function (id, index) {
      if (!missionCatalogIds.has(id)) fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "prerequisiteMissionIds"), index), "Prerequisite is absent from campaign mission catalog");
    });
    mission.enemyRosterIds.forEach(function (id, index) {
      if (!enemyIds.has(id)) fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "enemyRosterIds"), index), "Unknown enemy roster ID");
    });
    mission.bossRosterIds.forEach(function (id, index) {
      if (!bossIds.has(id)) fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "bossRosterIds"), index), "Unknown boss roster ID");
    });
    mission.availableDefenseIds.forEach(function (id, index) {
      if (!defenseIds.has(id)) fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "availableDefenseIds"), index), "Unknown available defense ID");
    });
    if (mission.scoreRecord.scoreRuleId !== value.campaignRules.scoreRules.id) {
      fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "scoreRecord"), "scoreRuleId"), "Mission score rule does not resolve");
    }

    const missionOwners = reachableOwners(
      mission.enemyRosterIds.map(function (id) { return enemyById.get(id); }).concat(
        mission.bossRosterIds.map(function (id) { return bossById.get(id); })
      )
    );
    const missionLineageTags = new Set();
    missionOwners.forEach(function (owner) {
      owner.tags.forEach(function (tag) { missionLineageTags.add(tag); });
    });
    const masteryPredicate = mission.objectives[2].predicate;
    if (masteryPredicate.kind === "no-leaks-from-lineage-tag" && !missionLineageTags.has(masteryPredicate.lineageTag)) {
      fail("MASTERY_LINEAGE_TAG", pointerJoin(pointerJoin(pointerJoin(pointerJoin(missionPath, "objectives"), 2), "predicate"), "lineageTag"), "Mastery lineage tag is absent from the mission roster and statically reachable children");
    }
    // no-leaks-from-routes is intentionally deferred to Task-5 normalized map IR.

    mission.waves.forEach(function (wave, waveIndex) {
      const wavePath = pointerJoin(pointerJoin(missionPath, "waves"), waveIndex);
      let lineageBounty = 0;
      wave.groups.forEach(function (group, groupIndex) {
        const groupPath = pointerJoin(pointerJoin(wavePath, "groups"), groupIndex);
        let owner;
        if (group.spawnKind === "enemy") {
          owner = enemyById.get(group.enemyId);
          if (!owner) fail("REFERENCE_UNKNOWN", pointerJoin(groupPath, "enemyId"), "Unknown group enemy");
          if (mission.enemyRosterIds.indexOf(group.enemyId) === -1) fail("MISSION_ROSTER", pointerJoin(groupPath, "enemyId"), "Group enemy is absent from mission roster");
        } else {
          owner = bossById.get(group.bossId);
          if (!owner) fail("REFERENCE_UNKNOWN", pointerJoin(groupPath, "bossId"), "Unknown group boss");
          if (mission.bossRosterIds.indexOf(group.bossId) === -1) fail("MISSION_ROSTER", pointerJoin(groupPath, "bossId"), "Group boss is absent from mission roster");
          reachableOwners([owner]).slice(1).forEach(function (child) {
            if (mission.enemyRosterIds.indexOf(child.id) === -1) {
              fail("MISSION_ROSTER", pointerJoin(missionPath, "enemyRosterIds"), "Statically reachable child is absent from the mission enemy roster");
            }
          });
        }
        if (group.bountyPolicy === "base-lineage") {
          const product = group.count * owner.baseLineageBountyAether;
          if (!Number.isSafeInteger(product) || !Number.isSafeInteger(lineageBounty + product)) fail("SCHEMA_RANGE", groupPath, "Wave bounty arithmetic exceeds safe integers");
          lineageBounty += product;
        }
      });
      const envelope = wave.deploymentGrantAether + lineageBounty + wave.clearGrantAether;
      if (!Number.isSafeInteger(envelope) || envelope !== wave.baseAetherEnvelope) {
        fail("WAVE_ENVELOPE_MISMATCH", pointerJoin(wavePath, "baseAetherEnvelope"), "Strategos wave envelope does not reconcile exactly");
      }
    });

    mission.firstClearRewards.forEach(function (reward, rewardIndex) {
      const rewardPath = pointerJoin(pointerJoin(missionPath, "firstClearRewards"), rewardIndex);
      if (reward.kind === "unlock-defense") {
        const defense = value.defenses.records.find(function (record) { return record.id === reward.defenseId; });
        if (!defense || !accessGrants.has(defense.unlockId)) fail("REWARD_UNLOCK_MAPPING", pointerJoin(rewardPath, "defenseId"), "Reward defense cannot resolve transactionally to one access grant");
      } else if (reward.kind === "campaign-modifier") {
        const modifier = modifierById.get(reward.campaignModifierId);
        if (!modifier || modifier.amountAether !== reward.amountAether) fail("REWARD_MODIFIER_MAPPING", rewardPath, "Modifier reward must match its declared grant exactly");
      }
    });
  });

  const m01 = missionById.get("m01");
  const m04 = missionById.get("m04");
  const m05 = missionById.get("m05");
  if (!m01 || m01.firstClearRewards.length !== 1 || m01.firstClearRewards[0].kind !== "unlock-defense" ||
      m01.firstClearRewards[0].defenseId !== "hoplite") {
    fail("REWARD_UNLOCK_MAPPING", "/missions/0/firstClearRewards", "Mission 1 first clear must unlock Hoplite through its defense access grant");
  }
  if (!m04 || m04.firstClearRewards.length !== 1 || m04.firstClearRewards[0].kind !== "campaign-modifier" ||
      m04.firstClearRewards[0].campaignModifierId !== "reserve-1") {
    fail("SLICE_REWARD_LOCK", "/missions/1/firstClearRewards", "Mission 4 first clear must grant Reserve I");
  }
  if (!m05 || m05.firstClearRewards.length !== 1 || m05.firstClearRewards[0].kind !== "loadout-slot" ||
      m05.firstClearRewards[0].slotCap !== 5) {
    fail("SLICE_REWARD_LOCK", "/missions/2/firstClearRewards", "Mission 5 first clear must produce a five-slot cap");
  }

  const visiting = new Set();
  const visited = new Set();
  function visitMission(id) {
    if (visited.has(id) || !missionById.has(id)) return;
    if (visiting.has(id)) fail("MISSION_PREREQUISITE_CYCLE", "/missions", "Mission prerequisite graph contains a cycle");
    visiting.add(id);
    missionById.get(id).prerequisiteMissionIds.forEach(visitMission);
    visiting.delete(id);
    visited.add(id);
  }
  value.missions.forEach(function (mission) { visitMission(mission.id); });

  const eventById = new Map(value.eventCatalog.records.map(function (record) { return [record.id, record]; }));
  const eventIds = new Set(eventById.keys());
  const eventReferences = [];
  const eventSingular = new Set([
    "applyEventId", "clearGrantEventId", "consumeEventId", "contactEventId", "createEventId",
    "deploymentGrantEventId", "enterEventId", "exitEventId", "expireEventId", "previewEventId",
    "rejectedEventId", "removeEventId", "scanEventId", "semanticEventId", "spawnEventId",
  ]);
  const eventArrays = new Set(["semanticEventIds", "transitionEventIds"]);
  [value.defenses, value.enemies, value.bosses, value.missions].forEach(function (owner, index) {
    walkReferences(owner, ["/defenses", "/enemies", "/bosses", "/missions"][index], eventSingular, eventArrays, eventReferences);
  });
  assertReferences(eventReferences, eventIds, "REFERENCE_UNKNOWN");
  function requireEventAllowedPhases(eventId, allowedPhaseIds, path) {
    const event = eventById.get(eventId);
    if (event && allowedPhaseIds.indexOf(event.phaseId) === -1) {
      fail("EVENT_PHASE_MISMATCH", path, "Semantic event does not belong to its required ABI phase");
    }
    return event;
  }
  function requireEventPhase(eventId, expectedPhaseId, path) {
    return requireEventAllowedPhases(eventId, [expectedPhaseId], path);
  }
  function requireWaveGrantPayload(event, path) {
    if (!event) return;
    const fields = new Map(event.payloadFields.map(function (field) { return [field.name, field]; }));
    const waveId = fields.get("waveId");
    const amount = fields.get("amountAether");
    if (!waveId || waveId.type !== "id" || waveId.required !== true || waveId.nullable !== false ||
        !amount || amount.type !== "integer" || amount.required !== true || amount.nullable !== false) {
      fail("EVENT_PAYLOAD_MISMATCH", path, "Wave grants require non-null waveId and amountAether payload fields");
    }
  }
  value.missions.forEach(function (mission, missionIndex) {
    mission.waves.forEach(function (wave, waveIndex) {
      const wavePath = pointerJoin(pointerJoin(pointerJoin("/missions", missionIndex), "waves"), waveIndex);
      if (wave.deploymentGrantEventId !== null) {
        const eventPath = pointerJoin(wavePath, "deploymentGrantEventId");
        requireWaveGrantPayload(requireEventPhase(wave.deploymentGrantEventId, "commands", eventPath), eventPath);
      }
      if (wave.clearGrantEventId !== null) {
        const eventPath = pointerJoin(wavePath, "clearGrantEventId");
        requireWaveGrantPayload(requireEventPhase(wave.clearGrantEventId, "wave-clear", eventPath), eventPath);
      }
      wave.groups.forEach(function (group, groupIndex) {
        requireEventPhase(
          group.spawnEventId,
          "scheduled-spawns",
          pointerJoin(pointerJoin(pointerJoin(wavePath, "groups"), groupIndex), "spawnEventId")
        );
      });
    });
    if (mission.tutorial.kind === "guided") {
      mission.tutorial.semanticEventIds.forEach(function (eventId, eventIndex) {
        requireEventPhase(
          eventId,
          "commands",
          pointerJoin(pointerJoin(pointerJoin(pointerJoin("/missions", missionIndex), "tutorial"), "semanticEventIds"), eventIndex)
        );
      });
    }
  });

  const summonOperationalEvents = new Map();
  value.defenses.records.forEach(function (defense, defenseIndex) {
    defense.levels.forEach(function (level, levelIndex) {
      level.behaviors.forEach(function (behavior, behaviorIndex) {
        const parameterPath = pointerJoin(
          pointerJoin(
            pointerJoin(
              pointerJoin(
                pointerJoin(pointerJoin("/defenses/records", defenseIndex), "levels"),
                levelIndex
              ),
              "behaviors"
            ),
            behaviorIndex
          ),
          "parameters"
        );
        const parameters = behavior.parameters;
        if (behavior.contractId === "direct" && parameters.consecutiveHitCounter !== null) {
          requireEventPhase(parameters.consecutiveHitCounter.semanticEventId, "shield-damage-and-status", pointerJoin(pointerJoin(parameterPath, "consecutiveHitCounter"), "semanticEventId"));
        } else if (behavior.contractId === "splash" && parameters.centerBonus !== null) {
          requireEventPhase(parameters.centerBonus.semanticEventId, "shield-damage-and-status", pointerJoin(pointerJoin(parameterPath, "centerBonus"), "semanticEventId"));
        } else if (behavior.contractId === "slow" && parameters.echoCounter !== null) {
          requireEventPhase(parameters.echoCounter.semanticEventId, "shield-damage-and-status", pointerJoin(pointerJoin(parameterPath, "echoCounter"), "semanticEventId"));
        } else if (behavior.contractId === "spawnUnit") {
          requireEventPhase(parameters.createEventId, "scheduled-spawns", pointerJoin(parameterPath, "createEventId"));
          let operational = summonOperationalEvents.get(parameters.summonRecordId);
          if (!operational) {
            operational = new Set();
            summonOperationalEvents.set(parameters.summonRecordId, operational);
          }
          operational.add(parameters.createEventId);
        } else if (behavior.contractId === "block") {
          requireEventPhase(parameters.contactEventId, "movement", pointerJoin(parameterPath, "contactEventId"));
          requireEventPhase(parameters.rejectedEventId, "movement", pointerJoin(parameterPath, "rejectedEventId"));
          if (parameters.bash !== null) {
            requireEventPhase(parameters.bash.semanticEventId, "movement", pointerJoin(pointerJoin(parameterPath, "bash"), "semanticEventId"));
          }
          let operational = summonOperationalEvents.get(parameters.summonRecordId);
          if (!operational) {
            operational = new Set();
            summonOperationalEvents.set(parameters.summonRecordId, operational);
          }
          operational.add(parameters.contactEventId);
          operational.add(parameters.rejectedEventId);
        } else if (behavior.contractId === "aura" && behavior.deliveryKind === "continuous-range-status") {
          requireEventPhase(parameters.applyEventId, "shield-damage-and-status", pointerJoin(parameterPath, "applyEventId"));
          requireEventPhase(parameters.removeEventId, "status-expiry", pointerJoin(parameterPath, "removeEventId"));
        } else if (behavior.contractId === "aura" && behavior.deliveryKind === "periodic-targeted-status") {
          requireEventPhase(parameters.scanEventId, "tower-acquisition-and-attacks", pointerJoin(parameterPath, "scanEventId"));
          requireEventPhase(parameters.applyEventId, "shield-damage-and-status", pointerJoin(parameterPath, "applyEventId"));
          requireEventPhase(parameters.expireEventId, "status-expiry", pointerJoin(parameterPath, "expireEventId"));
          if (parameters.scanCounter !== null) {
            requireEventPhase(parameters.scanCounter.semanticEventId, "shield-damage-and-status", pointerJoin(pointerJoin(parameterPath, "scanCounter"), "semanticEventId"));
          }
        }
      });
    });
  });
  value.defenses.summonRecords.forEach(function (summon, summonIndex) {
    const operational = summonOperationalEvents.get(summon.id) || new Set();
    const consumeEvents = summon.semanticEventIds.filter(function (eventId) { return !operational.has(eventId); });
    consumeEvents.forEach(function (eventId) {
      requireEventPhase(
        eventId,
        "movement",
        pointerJoin(pointerJoin(pointerJoin("/defenses/summonRecords", summonIndex), "semanticEventIds"), summon.semanticEventIds.indexOf(eventId))
      );
    });
  });

  function validateSpawnDeathEventPhases(owner, ownerPath) {
    [
      { behavior: owner.spawnBehavior, path: pointerJoin(ownerPath, "spawnBehavior") },
      { behavior: owner.deathBehavior, path: pointerJoin(ownerPath, "deathBehavior") },
    ].forEach(function (entry) {
      if (entry.behavior.kind !== "ordered-children" && entry.behavior.kind !== "single-revival") return;
      const requiredPhase = entry.behavior.kind === "ordered-children" && entry.behavior.trigger === "on-create"
        ? "scheduled-spawns"
        : "terminal-death-execute-children-and-revival";
      entry.behavior.semanticEventIds.forEach(function (eventId, eventIndex) {
        requireEventPhase(
          eventId,
          requiredPhase,
          pointerJoin(pointerJoin(entry.path, "semanticEventIds"), eventIndex)
        );
      });
    });
  }
  value.enemies.records.forEach(function (enemy, enemyIndex) {
    const enemyPath = pointerJoin("/enemies/records", enemyIndex);
    enemy.shieldPools.forEach(function (shield, shieldIndex) {
      const shieldPath = pointerJoin(pointerJoin(enemyPath, "shieldPools"), shieldIndex);
      requireEventPhase(shield.consumeEventId, "shield-damage-and-status", pointerJoin(shieldPath, "consumeEventId"));
      requireEventPhase(shield.expireEventId, "status-expiry", pointerJoin(shieldPath, "expireEventId"));
    });
    enemy.traits.forEach(function (trait, traitIndex) {
      trait.semanticEventIds.forEach(function (eventId, eventIndex) {
        requireEventAllowedPhases(
          eventId,
          ["status-expiry", "shield-damage-and-status"],
          pointerJoin(pointerJoin(pointerJoin(pointerJoin(enemyPath, "traits"), traitIndex), "semanticEventIds"), eventIndex)
        );
      });
    });
    validateSpawnDeathEventPhases(enemy, enemyPath);
  });
  value.bosses.records.forEach(function (boss, bossIndex) {
    const bossPath = pointerJoin("/bosses/records", bossIndex);
    boss.shieldPools.forEach(function (shield, shieldIndex) {
      const shieldPath = pointerJoin(pointerJoin(bossPath, "shieldPools"), shieldIndex);
      requireEventPhase(shield.consumeEventId, "shield-damage-and-status", pointerJoin(shieldPath, "consumeEventId"));
      requireEventPhase(shield.expireEventId, "status-expiry", pointerJoin(shieldPath, "expireEventId"));
    });
    boss.traits.forEach(function (trait, traitIndex) {
      trait.semanticEventIds.forEach(function (eventId, eventIndex) {
        requireEventAllowedPhases(
          eventId,
          ["status-expiry", "shield-damage-and-status"],
          pointerJoin(pointerJoin(pointerJoin(pointerJoin(bossPath, "traits"), traitIndex), "semanticEventIds"), eventIndex)
        );
      });
    });
    validateSpawnDeathEventPhases(boss, bossPath);
    boss.phaseRecords.forEach(function (phase, phaseIndex) {
      const phasePath = pointerJoin(pointerJoin(bossPath, "phaseRecords"), phaseIndex);
      requireEventPhase(phase.enterEventId, "guarded-boss-threshold-transition", pointerJoin(phasePath, "enterEventId"));
      requireEventPhase(phase.exitEventId, "guarded-boss-threshold-transition", pointerJoin(phasePath, "exitEventId"));
    });
    boss.thresholdScript.parameters.thresholds.forEach(function (threshold, thresholdIndex) {
      const thresholdPath = pointerJoin(
        pointerJoin(
          pointerJoin(
            pointerJoin(pointerJoin(bossPath, "thresholdScript"), "parameters"),
            "thresholds"
          ),
          thresholdIndex
        ),
        "statusDeliveries"
      );
      threshold.statusDeliveries.forEach(function (delivery, deliveryIndex) {
        delivery.semanticEventIds.forEach(function (eventId, eventIndex) {
          requireEventPhase(
            eventId,
            "shield-damage-and-status",
            pointerJoin(pointerJoin(pointerJoin(thresholdPath, deliveryIndex), "semanticEventIds"), eventIndex)
          );
        });
      });
      const transitionPath = pointerJoin(
        pointerJoin(
          pointerJoin(
            pointerJoin(pointerJoin(bossPath, "thresholdScript"), "parameters"),
            "thresholds"
          ),
          thresholdIndex
        ),
        "transitionEventIds"
      );
      threshold.transitionEventIds.forEach(function (eventId, eventIndex) {
        requireEventAllowedPhases(
          eventId,
          ["guarded-boss-threshold-transition", "terminal-death-execute-children-and-revival"],
          pointerJoin(transitionPath, eventIndex)
        );
      });
    });
  });
  const referencedEventIds = new Set(eventReferences.map(function (reference) { return reference.id; }));
  value.eventCatalog.records.forEach(function (record, index) {
    if (!referencedEventIds.has(record.id)) fail("EVENT_UNUSED", pointerJoin(pointerJoin("/eventCatalog/records", index), "id"), "Event definition is unused");
  });

  const statusIds = new Set(value.campaignRules.statusIds);
  const statusReferences = [];
  walkReferences(value.defenses, "/defenses", new Set(["statusId", "resolveStatusId"]), new Set([]), statusReferences);
  walkReferences(value.enemies, "/enemies", new Set(["revealStatusId", "damageExposeStatusId"]), new Set(["statusIds"]), statusReferences);
  walkReferences(value.bosses, "/bosses", new Set(["revealStatusId", "damageExposeStatusId", "statusId"]), new Set(["statusIds", "activeStatusIds"]), statusReferences);
  assertReferences(statusReferences, statusIds, "REFERENCE_UNKNOWN");
  const damageTypeIds = new Set(value.campaignRules.damageTypeIds);
  const damageReferences = [];
  [value.defenses, value.enemies, value.bosses].forEach(function (owner, index) {
    walkReferences(owner, ["/defenses", "/enemies", "/bosses"][index], new Set(["damageTypeId"]), new Set([]), damageReferences);
  });
  assertReferences(damageReferences, damageTypeIds, "REFERENCE_UNKNOWN");

  const stringKeys = new Set(value.stringCatalog.entries.map(function (entry) { return entry.key; }));
  const stringReferences = [];
  const stringSingular = new Set([
    "briefingKey", "descriptionKey", "nameKey", "objectiveKey", "progressKey", "roleKey",
    "summaryKey", "titleKey", "weaknessKey",
  ]);
  const stringArrays = new Set(["mechanicNoticeKeys", "routeNoticeKeys"]);
  [value.defenses, value.enemies, value.bosses, value.missions].forEach(function (owner, index) {
    walkReferences(owner, ["/defenses", "/enemies", "/bosses", "/missions"][index], stringSingular, stringArrays, stringReferences);
  });
  assertReferences(stringReferences, stringKeys, "REFERENCE_UNKNOWN");
  const referencedStringKeys = new Set(stringReferences.map(function (reference) { return reference.id; }));
  value.stringCatalog.entries.forEach(function (entry, index) {
    if (!referencedStringKeys.has(entry.key)) fail("STRING_UNUSED", pointerJoin(pointerJoin("/stringCatalog/entries", index), "key"), "String entry is unused");
  });

  const cueIdSet = new Set(value.eventCatalog.records.map(function (record) { return record.presentationCueId; }));
  value.missions.forEach(function (mission) {
    mission.previewDeclarations.forEach(function (declaration) {
      declaration.semanticCueIds.forEach(function (cueId) { cueIdSet.add(cueId); });
    });
  });
  const cueIds = Array.from(cueIdSet).sort();
  const missionIds = value.missions.map(function (mission) { return mission.id; });
  validatePresentationCatalogCore(value.presentationCatalog, "/presentationCatalog", {
    approvalState: value.approvalState,
    missionIds: missionIds,
    missionPackRecords: value.missions.map(function (mission) {
      return { missionId: mission.id, presentationPackId: mission.presentationPackId };
    }),
    cueIds: cueIds,
  });

  const normalized = {
    approvalState: value.approvalState,
    eventSchemaVersion: Catalog.EVENT_SCHEMA_VERSION,
    behaviorRegistryVersion: Catalog.BEHAVIOR_REGISTRY_VERSION,
    campaignRules: value.campaignRules,
    defenses: value.defenses,
    enemies: value.enemies,
    bosses: value.bosses,
    missions: value.missions,
    eventCatalog: value.eventCatalog,
    stringCatalog: value.stringCatalog,
    presentationCatalog: value.presentationCatalog,
    pendingPreviewProofRecords: pendingPreviewProofRecords,
    defenseUnlockGrantMappings: defenseUnlockGrantMappings,
    // Compatibility for the in-flight Task-5 compiler. This alias is the same
    // alphabetical mapping and must never be serialized as replay Start grants.
    defenseAccessGrantRecords: defenseUnlockGrantMappings,
  };
  return deepFrozenClone(normalized);
}

module.exports = Object.freeze({
  LIMITS: LIMITS,
  validateCampaignRules: validateCampaignRules,
  validateDefenseSource: validateDefenseSource,
  validateEnemySource: validateEnemySource,
  validateBossSource: validateBossSource,
  validateMissionSource: validateMissionSource,
  validateEventCatalog: validateEventCatalog,
  validateStringCatalog: validateStringCatalog,
  validatePresentationCatalog: validatePresentationCatalog,
  validateNonMapSliceRecordSet: validateNonMapSliceRecordSet,
  validateSliceRecordSet: validateNonMapSliceRecordSet,
});
