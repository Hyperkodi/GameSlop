"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");
const Catalog = require("./v4-rule-catalog.js");

const LIMITS = Object.freeze({
  maxDepth: 32,
  maxObjectFields: 64,
  maxSourceBytes: 1048576,
  maxArrayLength: 4096,
});

function preflight(value, path) {
  const seen = new WeakSet();

  function visit(current, currentPath, depth) {
    if (depth > LIMITS.maxDepth) fail("SCHEMA_DEPTH", currentPath, "Record nesting exceeds " + LIMITS.maxDepth);
    if (current === null || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
        fail("SCHEMA_INTEGER", currentPath, "Numbers must be safe integers and cannot be negative zero");
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
    if (seen.has(current)) fail("SCHEMA_SHARED_REFERENCE", currentPath, "Cycles and shared references are forbidden");
    seen.add(current);
    if (Object.getOwnPropertySymbols(current).length !== 0) {
      fail("SCHEMA_DATA_PROPERTY", currentPath, "Symbol properties are forbidden");
    }

    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) {
        fail("SCHEMA_OBJECT", currentPath, "Expected an ordinary JSON array prototype");
      }
      if (current.length > LIMITS.maxArrayLength) {
        fail("SCHEMA_LIMIT", currentPath, "Array exceeds " + LIMITS.maxArrayLength + " entries");
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
  if (Buffer.byteLength(serialized, "utf8") > LIMITS.maxSourceBytes) {
    fail("SCHEMA_LIMIT", path || "/", "Record exceeds the one-source-file byte limit");
  }
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const result = Object.create(Object.getPrototypeOf(value));
  Object.keys(value).forEach(function (key) {
    Object.defineProperty(result, key, {
      value: deepFrozenClone(value[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  });
  return Object.freeze(result);
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("SCHEMA_OBJECT", path, "Expected an object");
  }
}

function requireArray(value, path) {
  if (!Array.isArray(value)) fail("SCHEMA_ARRAY", path, "Expected an array");
}

function compareExact(actual, expected, path, bindingCode) {
  if (Array.isArray(expected)) {
    requireArray(actual, path);
    if (actual.length !== expected.length) {
      fail(bindingCode, path, "Array length differs from the approved binding");
    }
    for (let index = 0; index < expected.length; index++) {
      compareExact(actual[index], expected[index], pointerJoin(path, index), bindingCode);
    }
    return;
  }

  if (expected && typeof expected === "object") {
    requireObject(actual, path);
    const expectedKeys = Object.keys(expected);
    const expectedSet = new Set(expectedKeys);
    Object.keys(actual).forEach(function (key) {
      if (!expectedSet.has(key)) {
        fail("SCHEMA_UNKNOWN_KEY", pointerJoin(path, key), "Unknown key " + JSON.stringify(key));
      }
    });
    expectedKeys.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        fail("SCHEMA_REQUIRED", pointerJoin(path, key), "Missing required key " + JSON.stringify(key));
      }
      compareExact(actual[key], expected[key], pointerJoin(path, key), bindingCode);
    });
    return;
  }

  if (!Object.is(actual, expected)) {
    fail(bindingCode, path, "Value differs from the approved binding");
  }
}

function assertStrictlySortedRecords(records, path) {
  requireArray(records, path);
  let previous = null;
  records.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    requireObject(record, recordPath);
    if (typeof record.id !== "string") fail("SCHEMA_TYPE", pointerJoin(recordPath, "id"), "Expected string ID");
    if (previous !== null && record.id <= previous) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(recordPath, "id"), "Records must be unique and strictly ASCII sorted by ID");
    }
    previous = record.id;
  });
}

function assertStrictlySortedStrings(values, path) {
  requireArray(values, path);
  let previous = null;
  values.forEach(function (value, index) {
    if (typeof value !== "string") fail("SCHEMA_TYPE", pointerJoin(path, index), "Expected string ID");
    if (previous !== null && value <= previous) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(path, index), "IDs must be unique and strictly ASCII sorted");
    }
    previous = value;
  });
}

function assertExactIds(records, expectedIds, path, code) {
  const actualIds = records.map(function (record) { return record.id; });
  if (actualIds.length !== expectedIds.length || actualIds.some(function (id, index) { return id !== expectedIds[index]; })) {
    fail(code, path, "Record IDs differ from the approved domain roster");
  }
}

function validateDomainSource(value, expected, path, bindingCode, idCode, expectedIds) {
  const basePath = path || "/";
  preflight(value, basePath);
  requireObject(value, basePath);
  if (!Object.prototype.hasOwnProperty.call(value, "records")) {
    fail("SCHEMA_REQUIRED", pointerJoin(basePath, "records"), "Missing required key \"records\"");
  }
  assertStrictlySortedRecords(value.records, pointerJoin(basePath, "records"));
  assertExactIds(value.records, expectedIds, pointerJoin(basePath, "records"), idCode);
  compareExact(value, expected, basePath, bindingCode);
  return deepFrozenClone(value);
}

function validateProtocolSourceAt(value, path) {
  return validateDomainSource(
    value,
    Catalog.BINDING_SOURCES.protocols,
    path,
    "V4_PROTOCOL_BINDING",
    "V4_PROTOCOL_IDS",
    Catalog.PROTOCOL_IDS
  );
}

function validateRelicSourceAt(value, path) {
  return validateDomainSource(
    value,
    Catalog.BINDING_SOURCES.relics,
    path,
    "V4_RELIC_BINDING",
    "V4_RELIC_IDS",
    Catalog.RELIC_IDS
  );
}

function validateSpecializationSourceAt(value, path) {
  return validateDomainSource(
    value,
    Catalog.BINDING_SOURCES.specializations,
    path,
    "V4_SPECIALIZATION_BINDING",
    "V4_SPECIALIZATION_IDS",
    Catalog.SPECIALIZATION_IDS
  );
}

function validateReinforcementSourceAt(value, path) {
  return validateDomainSource(
    value,
    Catalog.BINDING_SOURCES.reinforcements,
    path,
    "V4_REINFORCEMENT_BINDING",
    "V4_REINFORCEMENT_IDS",
    Catalog.REINFORCEMENT_IDS
  );
}

function validateMechanismSourceAt(value, path) {
  return validateDomainSource(
    value,
    Catalog.BINDING_SOURCES.mechanisms,
    path,
    "V4_MECHANISM_BINDING",
    "V4_MECHANISM_IDS",
    Catalog.MECHANISM_IDS
  );
}

function validateProgressionSourceAt(value, path) {
  const basePath = path || "/";
  preflight(value, basePath);
  requireObject(value, basePath);
  if (!Object.prototype.hasOwnProperty.call(value, "grantRecords")) {
    fail("SCHEMA_REQUIRED", pointerJoin(basePath, "grantRecords"), "Missing required key \"grantRecords\"");
  }
  if (!Object.prototype.hasOwnProperty.call(value, "records")) {
    fail("SCHEMA_REQUIRED", pointerJoin(basePath, "records"), "Missing required key \"records\"");
  }
  assertStrictlySortedRecords(value.grantRecords, pointerJoin(basePath, "grantRecords"));
  requireArray(value.records, pointerJoin(basePath, "records"));
  let previousMissionId = null;
  value.records.forEach(function (record, index) {
    const recordPath = pointerJoin(pointerJoin(basePath, "records"), index);
    requireObject(record, recordPath);
    if (typeof record.missionId !== "string") {
      fail("SCHEMA_TYPE", pointerJoin(recordPath, "missionId"), "Expected mission ID");
    }
    if (previousMissionId !== null && record.missionId <= previousMissionId) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(recordPath, "missionId"), "Mission records must be strictly ASCII sorted");
    }
    previousMissionId = record.missionId;
    if (Object.prototype.hasOwnProperty.call(record, "loanProtocolIds")) {
      assertStrictlySortedStrings(record.loanProtocolIds, pointerJoin(recordPath, "loanProtocolIds"));
    }
    if (Object.prototype.hasOwnProperty.call(record, "firstVictoryGrantIds")) {
      assertStrictlySortedStrings(record.firstVictoryGrantIds, pointerJoin(recordPath, "firstVictoryGrantIds"));
    }
  });
  compareExact(value, Catalog.BINDING_SOURCES.progression, basePath, "V4_PROGRESSION_BINDING");
  return deepFrozenClone(value);
}

function validateUnlockRecordSet(value) {
  preflight(value, "/");
  requireObject(value, "/");
  const fields = ["protocols", "relics", "specializations", "reinforcements", "mechanisms", "progression"];
  const allowed = new Set(fields);
  Object.keys(value).forEach(function (key) {
    if (!allowed.has(key)) fail("SCHEMA_UNKNOWN_KEY", pointerJoin("/", key), "Unknown key " + JSON.stringify(key));
  });
  fields.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("SCHEMA_REQUIRED", pointerJoin("/", key), "Missing required key " + JSON.stringify(key));
    }
  });

  const normalized = {
    protocols: validateProtocolSourceAt(value.protocols, "/protocols"),
    relics: validateRelicSourceAt(value.relics, "/relics"),
    specializations: validateSpecializationSourceAt(value.specializations, "/specializations"),
    reinforcements: validateReinforcementSourceAt(value.reinforcements, "/reinforcements"),
    mechanisms: validateMechanismSourceAt(value.mechanisms, "/mechanisms"),
    progression: validateProgressionSourceAt(value.progression, "/progression"),
  };
  return deepFrozenClone(normalized);
}

module.exports = Object.freeze({
  LIMITS: LIMITS,
  validateProtocolSource: function (value) { return validateProtocolSourceAt(value, "/"); },
  validateRelicSource: function (value) { return validateRelicSourceAt(value, "/"); },
  validateSpecializationSource: function (value) { return validateSpecializationSourceAt(value, "/"); },
  validateReinforcementSource: function (value) { return validateReinforcementSourceAt(value, "/"); },
  validateMechanismSource: function (value) { return validateMechanismSourceAt(value, "/"); },
  validateProgressionSource: function (value) { return validateProgressionSourceAt(value, "/"); },
  validateUnlockRecordSet: validateUnlockRecordSet,
});
