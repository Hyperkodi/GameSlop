"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fail, pointerJoin } = require("./diagnostics.js");
const { parseStrictJsonBytes } = require("./strict-json.js");
const { APPROVAL_STATES, validateAnnex, validateRepositoryPath } = require("./v3-annex.js");

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
  "acts",
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
  "acts",
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

/* ---- strict file-backed preflight ---------------------------------------------------- */

function resolveDirectory(input, diagnosticPath, label) {
  if (typeof input !== "string" || input.length === 0) {
    fail("SOURCE_READ", diagnosticPath, label + " is required");
  }
  const resolved = path.resolve(input);
  let stats;
  try { stats = fs.lstatSync(resolved); }
  catch (error) { fail("SOURCE_READ", diagnosticPath, label + " must be an existing directory"); }
  if (stats.isSymbolicLink()) fail("SOURCE_SYMLINK", diagnosticPath, label + " cannot be a symlink or junction");
  if (!stats.isDirectory()) fail("SOURCE_READ", diagnosticPath, label + " must be an existing directory");
  try { return fs.realpathSync(resolved); }
  catch (error) { fail("SOURCE_READ", diagnosticPath, label + " real path cannot be resolved"); }
}

function physicalIdentity(resolvedPath, stats, diagnosticPath) {
  const real = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
  let inode;
  try {
    const big = fs.statSync(resolvedPath, { bigint: true });
    if (big.ino === 0n) {
      fail("SOURCE_IDENTITY_UNAVAILABLE", diagnosticPath, "Filesystem did not provide a stable physical file identity");
    }
    inode = String(big.dev) + ":" + String(big.ino);
  } catch (error) {
    if (error instanceof Error && error.name === "AegisContentError") throw error;
    fail("SOURCE_IDENTITY_UNAVAILABLE", diagnosticPath, "Stable physical file identity could not be read");
  }
  return Object.freeze({ real: real, inode: inode, size: stats.size });
}

function createIdentityRegistry() {
  return { reals: new Map(), inodes: new Map() };
}

function registerPhysicalIdentity(registry, identity, diagnosticPath) {
  if (registry.reals.has(identity.real) || registry.inodes.has(identity.inode)) {
    fail("SOURCE_DUPLICATE_REALPATH", diagnosticPath, "Declared files must have unique physical identities");
  }
  registry.reals.set(identity.real, diagnosticPath);
  registry.inodes.set(identity.inode, diagnosticPath);
}

function resolveDeclaredFile(root, relativePath, diagnosticPath) {
  const segments = relativePath.split("/");
  let current = root;
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    let stats;
    try { stats = fs.lstatSync(current); }
    catch (error) { fail("SOURCE_READ", diagnosticPath, "Declared file does not exist"); }
    if (stats.isSymbolicLink()) {
      fail("SOURCE_SYMLINK", diagnosticPath, "Declared paths cannot traverse a symlink or junction");
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      fail("SOURCE_READ", diagnosticPath, "Declared path has a non-directory component");
    }
    if (index === segments.length - 1 && !stats.isFile()) {
      fail("SOURCE_SPECIAL_FILE", diagnosticPath, "Declared target must be a regular file");
    }
  }
  let real;
  let stats;
  try {
    real = fs.realpathSync(current);
    stats = fs.statSync(real);
  } catch (error) {
    fail("SOURCE_READ", diagnosticPath, "Declared file identity cannot be resolved");
  }
  const relative = path.relative(root, real);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Declared path resolves outside its root");
  }
  const identity = physicalIdentity(real, stats, diagnosticPath);
  return Object.freeze({
    path: real,
    realIdentity: identity.real,
    size: identity.size,
    inode: identity.inode,
  });
}

function readRegularFile(file, diagnosticPath, maximumBytes, registry) {
  if (maximumBytes !== undefined && file.size > maximumBytes) {
    fail("SOURCE_SIZE", diagnosticPath, "Declared source exceeds the one-MiB source limit");
  }
  let descriptor;
  try {
    descriptor = fs.openSync(file.path, "r");
    const stats = fs.fstatSync(descriptor);
    if (!stats.isFile()) fail("SOURCE_SPECIAL_FILE", diagnosticPath, "Declared target must remain a regular file");
    const big = fs.fstatSync(descriptor, { bigint: true });
    if (big.ino === 0n) {
      fail("SOURCE_IDENTITY_UNAVAILABLE", diagnosticPath, "Opened file did not provide a stable physical identity");
    }
    const openedIdentity = String(big.dev) + ":" + String(big.ino);
    if (openedIdentity !== file.inode) {
      fail("SOURCE_IDENTITY_CHANGED", diagnosticPath, "Declared file identity changed while it was being opened");
    }
    registerPhysicalIdentity(registry, { real: file.realIdentity, inode: openedIdentity }, diagnosticPath);
    if (maximumBytes !== undefined && stats.size > maximumBytes) {
      fail("SOURCE_SIZE", diagnosticPath, "Declared source exceeds the one-MiB source limit");
    }
    return fs.readFileSync(descriptor);
  } catch (error) {
    if (error instanceof Error && error.name === "AegisContentError") throw error;
    fail("SOURCE_READ", diagnosticPath, "Declared file cannot be read");
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); }
      catch (error) { /* Preserve the primary deterministic diagnostic. */ }
    }
  }
}

function verifyExpectedHash(bytes, expected, diagnosticPath) {
  const actual = sha256Reference(bytes);
  if (actual !== expected) {
    fail("SOURCE_HASH_MISMATCH", diagnosticPath, "Exact source bytes do not match the declared SHA-256");
  }
  return actual;
}

function deepFreeze(value, seen) {
  if (!value || typeof value !== "object") return value;
  seen = seen || new WeakSet();
  if (seen.has(value)) return value;
  seen.add(value);
  Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key], seen); });
  return Object.freeze(value);
}

function preflightV4SourceTree(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    fail("SOURCE_READ", "/", "V4 preflight options must be a plain object");
  }
  const allowedOptions = new Set(["sourceRoot", "repositoryRoot", "manifestSource"]);
  Object.getOwnPropertyNames(options).forEach(function (key) {
    if (!allowedOptions.has(key)) throw new TypeError("Unknown v4 preflight option " + key);
  });
  const sourceRoot = resolveDirectory(options.sourceRoot, "/", "V4 source root");
  const repositoryRoot = resolveDirectory(
    options.repositoryRoot === undefined ? sourceRoot : options.repositoryRoot,
    "/repositoryRoot",
    "Repository root"
  );
  const registry = createIdentityRegistry();
  const manifestSource = options.manifestSource === undefined
    ? "manifests/candidate-v4.json"
    : options.manifestSource;
  validateSourcePath(manifestSource, "/manifestSource");
  const manifestFile = resolveDeclaredFile(sourceRoot, manifestSource, "/manifestSource");
  const manifestBytes = readRegularFile(manifestFile, "/manifestSource", MAX_SOURCE_BYTES, registry);
  const manifest = validateV4SourceManifest(parseV4JsonBytes(manifestBytes, manifestSource));

  const provenance = [];
  const resolvedPaths = [];
  let abiDescriptorBytesBase64 = null;
  function loadJsonReference(reference, diagnosticPath, kind, recordId) {
    const file = resolveDeclaredFile(sourceRoot, reference.source, pointerJoin(diagnosticPath, "source"));
    const bytes = readRegularFile(file, pointerJoin(diagnosticPath, "source"), MAX_SOURCE_BYTES, registry);
    verifyExpectedHash(bytes, reference.sha256, pointerJoin(diagnosticPath, "sha256"));
    const parsed = parseV4JsonBytes(bytes, reference.source);
    if (kind === "abiDescriptor") abiDescriptorBytesBase64 = bytes.toString("base64");
    provenance.push({ kind: kind, id: recordId, source: reference.source, sha256: reference.sha256 });
    resolvedPaths.push({ source: reference.source, resolvedPath: file.path });
    return parsed;
  }

  const abiDescriptor = loadJsonReference(manifest.abiDescriptor, "/abiDescriptor", "abiDescriptor", "abiDescriptor");
  const acts = loadJsonReference(manifest.acts, "/acts", "acts", "acts");
  const behaviorContracts = loadJsonReference(
    manifest.behaviorContracts, "/behaviorContracts", "behaviorContracts", "behaviorContracts"
  );
  const annex = loadJsonReference(manifest.annex, "/annex", "annex", manifest.annex.id);
  validateAnnex(annex, {
    manifestAnnexId: manifest.annex.id,
    approvalState: manifest.approvalState,
  });
  const campaignRules = loadJsonReference(manifest.campaignRules, "/campaignRules", "campaignRules", "campaignRules");
  const defenses = loadJsonReference(manifest.defenses, "/defenses", "defenses", "defenses");
  const enemies = loadJsonReference(manifest.enemies, "/enemies", "enemies", "enemies");
  const bosses = loadJsonReference(manifest.bosses, "/bosses", "bosses", "bosses");
  const eventCatalog = loadJsonReference(manifest.eventCatalog, "/eventCatalog", "eventCatalog", "eventCatalog");
  const stringCatalog = loadJsonReference(manifest.stringCatalog, "/stringCatalog", "stringCatalog", "stringCatalog");
  const presentationCatalog = loadJsonReference(
    manifest.presentationCatalog, "/presentationCatalog", "presentationCatalog", "presentationCatalog"
  );
  const unlocks = {};
  ["protocols", "relics", "specializations", "reinforcements", "mechanisms", "progression"].forEach(
    function (domain) {
      unlocks[domain] = loadJsonReference(manifest[domain], pointerJoin("/", domain), "unlock:" + domain, domain);
    }
  );

  const missions = manifest.missions.map(function (mission, index) {
    const base = pointerJoin("/missions", index);
    const definition = loadJsonReference(
      mission.definition, pointerJoin(base, "definition"), "missionDefinition", mission.id
    );
    const map = loadJsonReference(mission.map, pointerJoin(base, "map"), "missionMap", mission.id);
    const record = { id: mission.id, definition: definition, map: map };
    if (mission.mapProofSupplement) {
      record.mapProofSupplement = loadJsonReference(
        mission.mapProofSupplement, pointerJoin(base, "mapProofSupplement"), "mapProofSupplement", mission.id
      );
    }
    return record;
  });

  const repositoryProvenance = [];
  function verifyRepositoryRecord(record, diagnosticPath, kind) {
    const pathField = pointerJoin(diagnosticPath, "repositoryPath");
    validateRepositoryPath(record.repositoryPath, pathField);
    const file = resolveDeclaredFile(repositoryRoot, record.repositoryPath, pathField);
    const bytes = readRegularFile(file, pathField, undefined, registry);
    verifyExpectedHash(bytes, record.sha256, pointerJoin(diagnosticPath, "sha256"));
    repositoryProvenance.push({
      kind: kind, id: record.id, source: record.repositoryPath, sha256: record.sha256,
    });
    resolvedPaths.push({ source: record.repositoryPath, resolvedPath: file.path });
  }
  annex.authorityRecords.forEach(function (record, index) {
    verifyRepositoryRecord(record, pointerJoin("/authorityRecords", index), "authority");
  });
  annex.evidenceRecords.forEach(function (record, index) {
    verifyRepositoryRecord(record, pointerJoin("/evidenceRecords", index), "evidence:" + record.kind);
  });

  provenance.sort(function (left, right) {
    return compareAscii(left.kind, right.kind) || compareAscii(left.id, right.id);
  });
  repositoryProvenance.sort(function (left, right) {
    return compareAscii(left.kind, right.kind) || compareAscii(left.id, right.id);
  });
  resolvedPaths.sort(function (left, right) { return compareAscii(left.source, right.source); });

  return deepFreeze({
    preflightOnly: true,
    sourceRoot: sourceRoot,
    repositoryRoot: repositoryRoot,
    manifestSource: manifestSource,
    manifestHash: sha256Reference(manifestBytes),
    manifest: manifest,
    annex: annex,
    normalizedSource: {
      abiDescriptor: abiDescriptor,
      acts: acts,
      behaviorContracts: behaviorContracts,
      campaignRules: campaignRules,
      defenses: defenses,
      enemies: enemies,
      bosses: bosses,
      eventCatalog: eventCatalog,
      stringCatalog: stringCatalog,
      presentationCatalog: presentationCatalog,
      unlocks: unlocks,
      missions: missions,
    },
    provenance: provenance,
    repositoryProvenance: repositoryProvenance,
    verifiedRawSources: { abiDescriptorBase64: abiDescriptorBytesBase64 },
    paths: { manifest: manifestFile.path, declared: resolvedPaths },
  });
}

module.exports = Object.freeze({
  MAX_SOURCE_BYTES: MAX_SOURCE_BYTES,
  V4_JSON_OPTIONS: V4_JSON_OPTIONS,
  MANIFEST_KEYS: MANIFEST_KEYS,
  STANDARD_REFERENCE_KEYS: STANDARD_REFERENCE_KEYS,
  parseV4JsonBytes: parseV4JsonBytes,
  preflightV4SourceTree: preflightV4SourceTree,
  sha256Reference: sha256Reference,
  validateReference: validateReference,
  validateSourcePath: validateSourcePath,
  validateV4SourceManifest: validateV4SourceManifest,
});
