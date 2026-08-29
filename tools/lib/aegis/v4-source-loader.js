"use strict";

const crypto = require("node:crypto");
const { fail, pointerJoin } = require("./diagnostics.js");
const { parseStrictJsonBytes } = require("./strict-json.js");
const { APPROVAL_STATES, validateRepositoryPath } = require("./v3-annex.js");

const MAX_SOURCE_BYTES = 1048576;
const MAX_MISSIONS = 20;
const V4_JSON_OPTIONS = Object.freeze({
  maxDepth: 32,
  maxObjectFields: 64,
  rejectNegativeZero: true,
});
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MISSION_ID = /^m(?:0[1-9]|1[0-9]|20)$/;
const CONTENT_VERSION = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const SHA256_REFERENCE = /^sha256:[0-9a-f]{64}$/;

const STANDARD_REFERENCE_KEYS = Object.freeze([
  "abiDescriptor",
  "behaviorContracts",
  "campaignRules",
  "defenses",
  "enemies",
  "bosses",
  "eventCatalog",
  "stringCatalog",
  "presentationCatalog",
  "protocols",
  "relics",
  "specializations",
  "reinforcements",
  "mechanisms",
  "progression",
]);

const MANIFEST_KEYS = Object.freeze([
  "schemaVersion",
  "contentVersion",
  "sourceKind",
  "approvalState",
  "abiDescriptor",
  "behaviorContracts",
  "annex",
  "campaignRules",
  "defenses",
  "enemies",
  "bosses",
  "eventCatalog",
  "stringCatalog",
  "presentationCatalog",
  "protocols",
  "relics",
  "specializations",
  "reinforcements",
  "mechanisms",
  "progression",
  "missions",
]);

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  return Object.getOwnPropertyNames(value).every(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && descriptor.enumerable && !descriptor.get && !descriptor.set;
  });
}

function requireRecord(value, diagnosticPath) {
  if (!isPlainRecord(value)) fail("SCHEMA_OBJECT", diagnosticPath, "Expected a plain data object");
  return value;
}

function requireExactKeys(value, keys, diagnosticPath) {
  requireRecord(value, diagnosticPath);
  const allowed = new Set(keys);
  keys.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("SCHEMA_MISSING_KEY", pointerJoin(diagnosticPath, key), "Missing required key " + key);
    }
  });
  Object.getOwnPropertyNames(value).forEach(function (key) {
    if (!allowed.has(key)) fail("SCHEMA_UNKNOWN_KEY", pointerJoin(diagnosticPath, key), "Unknown key " + key);
  });
  return value;
}

function requireStableId(value, diagnosticPath) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail("SCHEMA_STRING", diagnosticPath, "Expected a stable 1-64 character ASCII ID");
  }
  return value;
}

function requireHash(value, diagnosticPath) {
  if (typeof value !== "string" || !SHA256_REFERENCE.test(value)) {
    fail("SOURCE_HASH_FORMAT", diagnosticPath, "Expected sha256: followed by 64 lowercase hexadecimal digits");
  }
  return value;
}

function validateSourcePath(value, diagnosticPath) {
  validateRepositoryPath(value, diagnosticPath);
  if (!value.endsWith(".json")) {
    fail("SOURCE_REFERENCE", diagnosticPath, "V4 JSON source references must use a lowercase .json extension");
  }
  return value;
}

function validateReference(value, diagnosticPath, extraKey) {
  const keys = extraKey ? [extraKey, "source", "sha256"] : ["source", "sha256"];
  requireExactKeys(value, keys, diagnosticPath);
  if (extraKey === "id") requireStableId(value.id, pointerJoin(diagnosticPath, "id"));
  if (extraKey === "schemaVersion") {
    if (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3) {
      fail("SCHEMA_LITERAL", pointerJoin(diagnosticPath, "schemaVersion"), "Map schemaVersion must be 1, 2, or 3");
    }
  }
  validateSourcePath(value.source, pointerJoin(diagnosticPath, "source"));
  requireHash(value.sha256, pointerJoin(diagnosticPath, "sha256"));
  return value;
}

function validateV4SourceManifest(value) {
  requireExactKeys(value, MANIFEST_KEYS, "/");
  if (value.schemaVersion !== 4) {
    fail("SCHEMA_LITERAL", "/schemaVersion", "V4 campaign manifest schemaVersion must be exactly 4");
  }
  if (typeof value.contentVersion !== "string" || !CONTENT_VERSION.test(value.contentVersion)) {
    fail("SCHEMA_STRING", "/contentVersion", "contentVersion must be a lowercase portable stable version ID");
  }
  if (value.sourceKind !== "campaign") {
    fail("SCHEMA_LITERAL", "/sourceKind", "V4 sourceKind must be exactly campaign");
  }
  if (!APPROVAL_STATES.includes(value.approvalState)) {
    fail("SCHEMA_LITERAL", "/approvalState", "Unknown v4 approval state");
  }

  STANDARD_REFERENCE_KEYS.forEach(function (key) {
    validateReference(value[key], pointerJoin("/", key));
  });
  validateReference(value.annex, "/annex", "id");

  if (!Array.isArray(value.missions) || value.missions.length < 1 || value.missions.length > MAX_MISSIONS) {
    fail("SCHEMA_ARRAY", "/missions", "V4 missions must contain 1-" + MAX_MISSIONS + " records");
  }
  const missionIds = new Set();
  let priorMissionId = null;
  value.missions.forEach(function (mission, index) {
    const base = pointerJoin("/missions", index);
    requireRecord(mission, base);
    if (!Object.prototype.hasOwnProperty.call(mission, "map")) {
      fail("SCHEMA_MISSING_KEY", pointerJoin(base, "map"), "Missing required key map");
    }
    validateReference(mission.map, pointerJoin(base, "map"), "schemaVersion");
    const keys = mission.map.schemaVersion === 1
      ? ["id", "definition", "map", "mapProofSupplement"]
      : ["id", "definition", "map"];
    requireExactKeys(mission, keys, base);
    if (typeof mission.id !== "string" || !MISSION_ID.test(mission.id)) {
      fail("SCHEMA_STRING", pointerJoin(base, "id"), "Mission IDs must be m01 through m20");
    }
    if (missionIds.has(mission.id)) {
      fail("SCHEMA_DUPLICATE_ID", pointerJoin(base, "id"), "Duplicate mission ID");
    }
    if (priorMissionId !== null && compareAscii(priorMissionId, mission.id) >= 0) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(base, "id"), "Mission records must be strictly ASCII sorted by ID");
    }
    validateReference(mission.definition, pointerJoin(base, "definition"));
    if (mission.map.schemaVersion === 1) {
      validateReference(mission.mapProofSupplement, pointerJoin(base, "mapProofSupplement"), "schemaVersion");
      if (mission.mapProofSupplement.schemaVersion !== 1) {
        fail(
          "SCHEMA_LITERAL",
          pointerJoin(pointerJoin(base, "mapProofSupplement"), "schemaVersion"),
          "Map-v1 proof supplement schemaVersion must be exactly 1"
        );
      }
    }
    missionIds.add(mission.id);
    priorMissionId = mission.id;
  });

  const sourceOwners = new Map();
  function register(reference, diagnosticPath) {
    if (sourceOwners.has(reference.source)) {
      fail("SCHEMA_DUPLICATE_SOURCE", pointerJoin(diagnosticPath, "source"), "V4 references must use unique source paths");
    }
    sourceOwners.set(reference.source, diagnosticPath);
  }
  STANDARD_REFERENCE_KEYS.forEach(function (key) { register(value[key], pointerJoin("/", key)); });
  register(value.annex, "/annex");
  value.missions.forEach(function (mission, index) {
    const base = pointerJoin("/missions", index);
    register(mission.definition, pointerJoin(base, "definition"));
    register(mission.map, pointerJoin(base, "map"));
    if (mission.mapProofSupplement) register(mission.mapProofSupplement, pointerJoin(base, "mapProofSupplement"));
  });
  return value;
}

function parseV4JsonBytes(bytes, label) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length > MAX_SOURCE_BYTES) {
    fail("SOURCE_SIZE", "/", (label || "V4 source") + " exceeds the one-MiB source limit");
  }
  return parseStrictJsonBytes(buffer, label || "V4 source", V4_JSON_OPTIONS);
}

function sha256Reference(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

module.exports = Object.freeze({
  MAX_SOURCE_BYTES: MAX_SOURCE_BYTES,
  V4_JSON_OPTIONS: V4_JSON_OPTIONS,
  MANIFEST_KEYS: MANIFEST_KEYS,
  STANDARD_REFERENCE_KEYS: STANDARD_REFERENCE_KEYS,
  parseV4JsonBytes: parseV4JsonBytes,
  sha256Reference: sha256Reference,
  validateReference: validateReference,
  validateSourcePath: validateSourcePath,
  validateV4SourceManifest: validateV4SourceManifest,
});
