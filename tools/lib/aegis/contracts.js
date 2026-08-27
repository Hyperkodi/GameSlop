"use strict";

const crypto = require("node:crypto");
const { fail, pointerJoin } = require("./diagnostics.js");
const { canonicalEncode } = require("./canonical.js");

const CONTENT_ID = /^[a-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/;
const CONTENT_VERSION = /^[a-z0-9][a-z0-9.-]*$/;
const CAMPAIGN_MISSION_ID = /^[a-z][a-z0-9-]*$/;
const PORTABLE_SOURCE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const ABI_V1_SHA256 = "4a788f71581d4b1c4e79318d72ae45ffa1c6b79281c3ae32e6c29f22a8b2256b";

const ABI_SHAPE = Object.freeze({
  id: null,
  version: null,
  canonicalVersion: null,
  safeIntegerMax: null,
  ticksPerSecond: null,
  timeUnitsPerSecond: null,
  timeUnitsPerTick: null,
  distanceScale: null,
  damageScale: null,
  basisPoints: null,
  maxAuthoredDecimalPlaces: null,
  externalCapsBp: { damage: null, range: null, rate: null },
  phaseOrder: null,
  commands: {
    schemaVersion: null, recordFields: null, sequence: null, application: null,
    acceptedWaveStartGrant: null,
  },
  runtimeIds: {
    domains: null, initialValue: null, allocation: null, denialOrPlanReset: null,
    batchOrder: null,
  },
  timers: {
    decrementUnitsPerTick: null, due: null, overshoot: null, repeatingEventCap: null,
    simultaneousOrder: null,
  },
  cooldown: {
    initialRemainingUnits: null, decrement: null, due: null, attacksPerTowerPerTickMax: null,
    noTarget: null, scheduleFormula: null, activeRescale: null, minimumEffectiveCooldownUnits: null,
  },
  movement: {
    formula: null, divisor: null, advance: null, remainder: null, remainderOnSpeedChange: null,
    displacementDivision: null, routeBounds: null,
  },
  geometry: {
    coordinates: null, compilerSegmentLength: null, routeLength: null, waypointOwnership: null,
    interpolation: null, rangeEligibility: null, arithmetic: null,
  },
  statuses: {
    expiryPhase: null, decrementUnitsPerTick: null, removal: null, appliedAfterExpiry: null,
    instanceComparator: null,
  },
  division: { nonnegative: null, signed: null, ceiling: null, rational: null },
  formulas: {
    authoredMilliseconds: null, effectiveCooldown: null, effectiveRange: null, scaledSlow: null,
    effectiveSpeed: null, preShieldDamage: null, sellRefund: null,
  },
  damagePipeline: {
    internalCoefficientOrder: null, externalResolution: null, resolutionOrder: null,
    coefficientRounding: null, shieldPoolOrder: null,
    minimumPositiveNonimmuneHpDamageMilli: null, executeBosses: null,
  },
  behaviorRegistry: {
    id: null, version: null, dispatch: null, membership: null, arbitraryExecutableContent: null,
    contracts: null,
  },
  canonicalEncoding: {
    version: null, format: null, keys: null, arrays: null, numbers: null, objectGraph: null,
    allowedTypes: null,
  },
  hashes: {
    diagnostic: { algorithm: null, input: null, output: null },
    finalState: { algorithm: null, input: null, output: null },
    ruleset: { algorithm: null, framing: null, inputs: null },
  },
  rng: {
    algorithm: null, namedSeed: null, streamId: null, state: null, stateTransition: null,
    floatProjection: null, consumption: null, cosmeticConsumption: null, groupShuffle: null,
    consumptionChange: null,
  },
  tutorialUpgradeGate: {
    modes: null, skipCommand: null, denialReason: null, profileLookupDuringReplay: null,
  },
});

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("SCHEMA_OBJECT", path, "Expected an object");
}

function rejectUnknownKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("SCHEMA_UNKNOWN_KEY", pointerJoin(path, key), "Unknown key " + JSON.stringify(key));
  }
}

function requireKeys(value, required, path) {
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("SCHEMA_REQUIRED", pointerJoin(path, key), "Missing required key " + JSON.stringify(key));
    }
  }
}

function requireSafeInteger(value, path, expected) {
  if (!Number.isSafeInteger(value) || (expected !== undefined && value !== expected)) {
    fail("SCHEMA_INTEGER", path, expected === undefined ? "Expected a safe integer" : "Expected integer " + expected);
  }
}

function requireString(value, path, pattern) {
  if (typeof value !== "string" || (pattern && !pattern.test(value))) fail("SCHEMA_STRING", path, "Invalid string value");
}

function requireStringArray(value, path, pattern) {
  if (!Array.isArray(value)) fail("SCHEMA_ARRAY", path, "Expected an array");
  const seen = new Set();
  value.forEach(function (item, index) {
    const itemPath = pointerJoin(path, index);
    requireString(item, itemPath, pattern);
    if (seen.has(item)) fail("SCHEMA_DUPLICATE_ID", itemPath, "Duplicate ID " + JSON.stringify(item));
    seen.add(item);
  });
}

function requirePortableSourceReference(value, path) {
  requireString(value, path);
  if (value.indexOf("\\") !== -1 || value.startsWith("/") || value.endsWith("/")) {
    fail("SOURCE_REFERENCE", path, "Source references must be nonempty relative POSIX paths");
  }
  const segments = value.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !PORTABLE_SOURCE_SEGMENT.test(segment);
  })) {
    fail("SOURCE_REFERENCE", path, "Source references must use portable path segments without aliases or alternate streams");
  }
  return value;
}

function validateSourceManifestV1(value) {
  const path = "/";
  const keys = new Set([
    "schemaVersion", "contentVersion", "sourceKind", "abiDescriptor",
    "behaviorContracts", "missionIds",
  ]);
  rejectUnknownKeys(value, keys, path);
  requireKeys(value, keys, path);
  requireSafeInteger(value.schemaVersion, "/schemaVersion", 1);
  requireString(value.contentVersion, "/contentVersion", CONTENT_VERSION);
  if (value.sourceKind !== "foundation" && value.sourceKind !== "fixture") {
    fail("SCHEMA_ENUM", "/sourceKind", "Expected sourceKind foundation or fixture");
  }
  requireString(value.abiDescriptor, "/abiDescriptor");
  requireString(value.behaviorContracts, "/behaviorContracts");
  requireStringArray(value.missionIds, "/missionIds", CONTENT_ID);
  if (value.missionIds.length !== 0) {
    fail("FOUNDATION_SCOPE", "/missionIds", "The foundation compiler slice cannot author campaign missions yet");
  }
  return value;
}

function validateSourceManifestV2(value) {
  const path = "/";
  const keys = new Set([
    "schemaVersion", "contentVersion", "sourceKind", "abiDescriptor",
    "behaviorContracts", "missionMaps",
  ]);
  rejectUnknownKeys(value, keys, path);
  requireKeys(value, keys, path);
  requireSafeInteger(value.schemaVersion, "/schemaVersion", 2);
  requireString(value.contentVersion, "/contentVersion", CONTENT_VERSION);
  if (value.sourceKind !== "foundation") {
    fail("SCHEMA_ENUM", "/sourceKind", "Source schema v2 requires sourceKind foundation");
  }
  requirePortableSourceReference(value.abiDescriptor, "/abiDescriptor");
  requirePortableSourceReference(value.behaviorContracts, "/behaviorContracts");
  if (!Array.isArray(value.missionMaps) || value.missionMaps.length === 0) {
    fail("SCHEMA_ARRAY", "/missionMaps", "Source schema v2 requires a nonempty missionMaps array");
  }
  const ids = new Set();
  const sources = new Set();
  let previousId = null;
  value.missionMaps.forEach(function (record, index) {
    const itemPath = pointerJoin("/missionMaps", index);
    requireObject(record, itemPath);
    const recordKeys = new Set(["id", "source"]);
    rejectUnknownKeys(record, recordKeys, itemPath);
    requireKeys(record, recordKeys, itemPath);
    requireString(record.id, pointerJoin(itemPath, "id"), CAMPAIGN_MISSION_ID);
    if (record.id === "legacy-proving-ground") {
      fail("MISSION_LEGACY_FORBIDDEN", pointerJoin(itemPath, "id"), "Legacy proving ground cannot enter a campaign manifest");
    }
    if (ids.has(record.id)) {
      fail("SCHEMA_DUPLICATE_ID", pointerJoin(itemPath, "id"), "Duplicate mission ID " + JSON.stringify(record.id));
    }
    if (previousId !== null && previousId > record.id) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(itemPath, "id"), "Mission map records must use ascending ASCII ID order");
    }
    requirePortableSourceReference(record.source, pointerJoin(itemPath, "source"));
    if (!record.source.endsWith(".json")) {
      fail("SOURCE_REFERENCE", pointerJoin(itemPath, "source"), "Mission sources must use the lowercase .json extension");
    }
    if (sources.has(record.source)) {
      fail("SCHEMA_DUPLICATE_SOURCE", pointerJoin(itemPath, "source"), "Duplicate mission source " + JSON.stringify(record.source));
    }
    ids.add(record.id);
    sources.add(record.source);
    previousId = record.id;
  });
  return value;
}

function validateSourceManifest(value) {
  requireObject(value, "/");
  requireSafeInteger(value.schemaVersion, "/schemaVersion");
  if (value.schemaVersion === 1) return validateSourceManifestV1(value);
  if (value.schemaVersion === 2) return validateSourceManifestV2(value);
  fail("SCHEMA_INTEGER", "/schemaVersion", "Expected source schemaVersion 1 or 2");
}

function validateBehaviorContracts(value, registryContracts) {
  const path = "/";
  requireObject(value, path);
  const keys = new Set(["schemaVersion", "contracts"]);
  rejectUnknownKeys(value, keys, path);
  requireKeys(value, keys, path);
  requireSafeInteger(value.schemaVersion, "/schemaVersion", 1);
  if (!Array.isArray(value.contracts)) fail("SCHEMA_ARRAY", "/contracts", "Expected an array");
  const seen = new Set();
  const normalized = value.contracts.map(function (contract, index) {
    const itemPath = pointerJoin("/contracts", index);
    requireObject(contract, itemPath);
    const contractKeys = new Set(["id", "version"]);
    rejectUnknownKeys(contract, contractKeys, itemPath);
    requireKeys(contract, contractKeys, itemPath);
    requireString(contract.id, pointerJoin(itemPath, "id"), CONTENT_ID);
    requireSafeInteger(contract.version, pointerJoin(itemPath, "version"), 1);
    if (seen.has(contract.id)) fail("SCHEMA_DUPLICATE_ID", pointerJoin(itemPath, "id"), "Duplicate behavior ID " + JSON.stringify(contract.id));
    seen.add(contract.id);
    return { id: contract.id, version: contract.version };
  });
  if (!Array.isArray(registryContracts)) fail("ABI_BEHAVIOR_REGISTRY", "/behaviorRegistry/contracts", "ABI behavior registry contracts must be an array");
  const approved = new Map();
  registryContracts.forEach(function (contract, index) {
    const itemPath = pointerJoin("/behaviorRegistry/contracts", index);
    requireObject(contract, itemPath);
    requireString(contract.id, pointerJoin(itemPath, "id"), CONTENT_ID);
    requireSafeInteger(contract.version, pointerJoin(itemPath, "version"));
    if (approved.has(contract.id)) fail("ABI_BEHAVIOR_REGISTRY", pointerJoin(itemPath, "id"), "Duplicate ABI behavior contract");
    approved.set(contract.id, contract.version);
  });
  for (const contract of normalized) {
    if (!approved.has(contract.id)) fail("BEHAVIOR_UNKNOWN", "/contracts", "Unknown behavior contract " + JSON.stringify(contract.id));
    if (approved.get(contract.id) !== contract.version) {
      fail("BEHAVIOR_VERSION", "/contracts", "Behavior contract version does not match the ABI registry for " + JSON.stringify(contract.id));
    }
  }
  for (const id of approved.keys()) {
    if (!seen.has(id)) fail("BEHAVIOR_MISSING", "/contracts", "Missing approved behavior contract " + JSON.stringify(id));
  }
  normalized.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
  return normalized;
}

function validateAbiDescriptor(value) {
  function validateShape(current, shape, path) {
    requireObject(current, path);
    const keys = new Set(Object.keys(shape));
    rejectUnknownKeys(current, keys, path);
    requireKeys(current, keys, path);
    for (const key of keys) {
      if (shape[key]) validateShape(current[key], shape[key], pointerJoin(path, key));
    }
  }
  validateShape(value, ABI_SHAPE, "/");
  canonicalEncode(value);
  requireString(value.id, "/id", CONTENT_ID);
  if (value.id !== "armara-aegis-sim-abi") fail("ABI_ID", "/id", "Unexpected ABI descriptor ID");
  requireSafeInteger(value.version, "/version", 1);
  const identity = crypto.createHash("sha256").update(canonicalEncode(value), "utf8").digest("hex");
  if (identity !== ABI_V1_SHA256) {
    fail("ABI_DESCRIPTOR_IDENTITY", "/", "ABI v1 descriptor does not match its frozen canonical identity");
  }
  return value;
}

module.exports = Object.freeze({
  ABI_V1_SHA256: ABI_V1_SHA256,
  CAMPAIGN_MISSION_ID: CAMPAIGN_MISSION_ID,
  validateSourceManifest: validateSourceManifest,
  validateBehaviorContracts: validateBehaviorContracts,
  validateAbiDescriptor: validateAbiDescriptor,
  rejectUnknownKeys: rejectUnknownKeys,
  requireKeys: requireKeys,
  requireObject: requireObject,
  requireSafeInteger: requireSafeInteger,
  requireString: requireString,
});
