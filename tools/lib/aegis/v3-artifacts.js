"use strict";

const crypto = require("node:crypto");
const vm = require("node:vm");
const { canonicalEncode, canonicalBytes } = require("./canonical.js");
const { fail } = require("./diagnostics.js");
const { validateRepositoryPath } = require("./v3-annex.js");
const {
  frameRulesetBytes,
  immutableOutputs,
  simulationDescriptor,
} = require("./artifacts.js");
const { decodeUtf8 } = require("./strict-json.js");
const { parseStrictJsonBytes } = require("./strict-json.js");

const HASH_REFERENCE = /^sha256:[0-9a-f]{64}$/;
const CONTENT_VERSION = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const IMMUTABLE_JS = /^(aegis-sim|aegis-content|aegis-presentation)\.([0-9a-f]{64})\.js$/;
const IMMUTABLE_RELEASE = /^aegis-release\.([0-9a-f]{64})\.js$/;
const RELEASE_KEYS = Object.freeze([
  "schemaVersion", "contentVersion", "approvalState", "annexHash", "abiHash",
  "eventSchemaVersion", "behaviorRegistryVersion", "simulationArtifact", "simulationHash",
  "contentArtifact", "contentHash", "presentationArtifact", "presentationHash", "rulesetHash",
  "sourceManifestHash", "sourceProvenance", "includedIds", "releaseEligible",
].sort());

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256Reference(bytes) {
  return "sha256:" + sha256Hex(bytes);
}

function copyBytes(value, code, path, label) {
  try { return Buffer.from(value); }
  catch (error) { fail(code, path, label + " must be a valid byte sequence"); }
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepFrozenClone(value[key]); });
  return Object.freeze(output);
}

function renderDataArtifact(globalName, exportName, data, description) {
  const encoded = canonicalEncode(data);
  const lines = [
    "/* Generated Armara Aegis " + description + ". */",
    "(function (root) {",
    "  \"use strict\";",
    "  function deepFreeze(value) {",
    "    if (!value || typeof value !== \"object\" || Object.isFrozen(value)) return value;",
    "    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });",
    "    return Object.freeze(value);",
    "  }",
    "  const DATA = deepFreeze(JSON.parse(" + JSON.stringify(encoded) + "));",
    "  const api = deepFreeze({ " + exportName + ": DATA });",
    "  if (typeof module !== \"undefined\" && module.exports) { module.exports = api; return; }",
    "  const game = root.Game = root.Game || {};",
    "  if (Object.prototype.hasOwnProperty.call(game, " + JSON.stringify(globalName) + ")) throw new Error(" + JSON.stringify("Game." + globalName + " is already installed") + ");",
    "  Object.defineProperty(game, " + JSON.stringify(globalName) + ", { value: api, writable: false, configurable: false, enumerable: true });",
    "})(typeof globalThis !== \"undefined\" ? globalThis : this);",
    "",
  ];
  return Buffer.from(lines.join("\n"), "utf8");
}

function executeApi(source, label, commonJs, globalName) {
  const sandbox = Object.create(null);
  if (commonJs) {
    sandbox.module = Object.create(null);
    sandbox.module.exports = Object.create(null);
    sandbox.exports = sandbox.module.exports;
  }
  sandbox.globalThis = sandbox;
  try {
    const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(source, context, { filename: label, timeout: 1000 });
  } catch (error) {
    fail("V3_ARTIFACT_LOAD", "/artifacts", label + " failed in " + (commonJs ? "CommonJS" : "classic-script") + " mode: " + String(error && error.message || error));
  }
  return commonJs ? sandbox.module.exports : sandbox.Game && sandbox.Game[globalName];
}

function ownInteger(api, key, label, mode) {
  const descriptor = api && typeof api === "object" ? Object.getOwnPropertyDescriptor(api, key) : null;
  if (!descriptor || descriptor.get || descriptor.set || !Number.isSafeInteger(descriptor.value) || Object.is(descriptor.value, -0)) {
    fail("SIMULATION_BINDING_MISSING", "/simulation/" + key, label + " must explicitly export " + key + " as an own safe integer in " + mode + " mode");
  }
  return descriptor.value;
}

function simulationBindings(simulationBytes, label) {
  label = label || "simulation artifact";
  const source = decodeUtf8(simulationBytes, label);
  if (source.indexOf("\r") !== -1 || !source.endsWith("\n") || source.endsWith("\n\n")) {
    fail("SIMULATION_LINE_ENDINGS", "/simulation", label + " must use LF and end with exactly one newline");
  }
  const common = executeApi(source, label, true, "AegisSim");
  const classic = executeApi(source, label, false, "AegisSim");
  const commonBindings = {
    eventSchemaVersion: ownInteger(common, "EVENT_SCHEMA_VERSION", label, "CommonJS"),
    behaviorRegistryVersion: ownInteger(common, "BEHAVIOR_REGISTRY_VERSION", label, "CommonJS"),
  };
  const classicBindings = {
    eventSchemaVersion: ownInteger(classic, "EVENT_SCHEMA_VERSION", label, "classic-script"),
    behaviorRegistryVersion: ownInteger(classic, "BEHAVIOR_REGISTRY_VERSION", label, "classic-script"),
  };
  if (canonicalEncode(commonBindings) !== canonicalEncode(classicBindings)) {
    fail("SIMULATION_BINDING_MODE_MISMATCH", "/simulation", "Simulation bindings differ between CommonJS and classic-script modes");
  }
  return Object.freeze(commonBindings);
}

function readGeneratedData(bytes, globalName, exportName, label) {
  const source = decodeUtf8(bytes, label);
  const common = executeApi(source, label, true, globalName);
  const classic = executeApi(source, label, false, globalName);
  function data(api, mode) {
    const property = api && typeof api === "object" ? Object.getOwnPropertyDescriptor(api, exportName) : null;
    if (!property || property.get || property.set || !property.value || typeof property.value !== "object") {
      fail("V3_ARTIFACT_EXPORT", "/artifacts/" + exportName, label + " lacks the exact " + exportName + " data export in " + mode + " mode");
    }
    let serialized;
    try { serialized = JSON.stringify(property.value); }
    catch (error) { fail("V3_ARTIFACT_EXPORT", "/artifacts/" + exportName, label + " export is not JSON data"); }
    return JSON.parse(serialized);
  }
  const commonData = data(common, "CommonJS");
  const classicData = data(classic, "classic-script");
  if (canonicalEncode(commonData) !== canonicalEncode(classicData)) {
    fail("V3_ARTIFACT_MODE_MISMATCH", "/artifacts/" + exportName, label + " differs between CommonJS and classic-script modes");
  }
  return deepFrozenClone(commonData);
}

function requireHash(value, path) {
  if (typeof value !== "string" || !HASH_REFERENCE.test(value)) fail("V3_ARTIFACT_HASH", path, "Expected a lowercase SHA-256 reference");
}

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
    return descriptor.enumerable && !descriptor.get && !descriptor.set;
  });
}

function requireStableId(value, path, label) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail("V3_RELEASE_RECORD", path, label + " must be a stable ASCII ID");
  }
}

function validateReleaseProvenance(records) {
  if (!Array.isArray(records)) {
    fail("V3_RELEASE_RECORD", "/release/sourceProvenance", "Release source provenance must be an array");
  }
  let prior = null;
  records.forEach(function (record, index) {
    const path = "/release/sourceProvenance/" + index;
    if (!isPlainRecord(record)) fail("V3_RELEASE_RECORD", path, "Release provenance entries must be plain records");
    const keys = Object.keys(record).sort(compareAscii);
    const expected = ["id", "kind", "sha256", "source"];
    if (keys.length !== expected.length || keys.some(function (key, keyIndex) { return key !== expected[keyIndex]; })) {
      fail("V3_RELEASE_RECORD", path, "Release provenance entries contain exactly kind, id, source, and sha256");
    }
    requireStableId(record.kind, path + "/kind", "Provenance kind");
    requireStableId(record.id, path + "/id", "Provenance id");
    validateRepositoryPath(record.source, path + "/source");
    requireHash(record.sha256, path + "/sha256");
    const key = record.kind + "\u0000" + record.id;
    if (prior !== null && compareAscii(prior, key) >= 0) {
      fail("V3_RELEASE_RECORD", path, "Release provenance kind/id pairs must be unique and strict ASCII sorted");
    }
    prior = key;
  });
}

function validateIncludedIds(includedIds) {
  if (!isPlainRecord(includedIds) || Object.keys(includedIds).sort(compareAscii).join(",") !== "bosses,defenses,enemies,missions") {
    fail("V3_RELEASE_RECORD", "/release/includedIds", "Release includedIds has an invalid partition shape");
  }
  ["missions", "defenses", "enemies", "bosses"].forEach(function (partition) {
    const values = includedIds[partition];
    const path = "/release/includedIds/" + partition;
    if (!Array.isArray(values)) fail("V3_RELEASE_RECORD", path, "Included IDs must be arrays");
    let prior = null;
    values.forEach(function (id, index) {
      requireStableId(id, path + "/" + index, "Included ID");
      if (prior !== null && compareAscii(prior, id) >= 0) {
        fail("V3_RELEASE_RECORD", path + "/" + index, "Included IDs must be unique and strict ASCII sorted");
      }
      prior = id;
    });
  });
}

function validateReleaseRecord(release) {
  if (!isPlainRecord(release)) {
    fail("V3_RELEASE_RECORD", "/release", "Release record must be a plain data object");
  }
  const keys = Object.keys(release).sort();
  if (keys.length !== RELEASE_KEYS.length || keys.some(function (key, index) { return key !== RELEASE_KEYS[index]; })) {
    fail("V3_RELEASE_RECORD", "/release", "Release record fields must exactly match the v3 generated-manifest contract");
  }
  if (release.schemaVersion !== 3) fail("V3_RELEASE_SCHEMA", "/release/schemaVersion", "Release record must bind schema 3");
  if (["candidate-balance", "balance-approved", "production-approved"].indexOf(release.approvalState) === -1) {
    fail("V3_RELEASE_RECORD", "/release/approvalState", "Release record has an unknown approval state");
  }
  if (release.releaseEligible !== (release.approvalState === "production-approved")) {
    fail("V3_RELEASE_RECORD", "/release/releaseEligible", "Release eligibility must derive exactly from approval state");
  }
  if (typeof release.contentVersion !== "string" || !CONTENT_VERSION.test(release.contentVersion)) {
    fail("V3_RELEASE_RECORD", "/release/contentVersion", "Release contentVersion must be a stable lowercase version ID");
  }
  ["annexHash", "abiHash", "simulationHash", "contentHash", "presentationHash", "rulesetHash", "sourceManifestHash"].forEach(function (key) {
    requireHash(release[key], "/release/" + key);
  });
  if (!Number.isSafeInteger(release.eventSchemaVersion) || release.eventSchemaVersion <= 0 || Object.is(release.eventSchemaVersion, -0)) {
    fail("V3_RELEASE_RECORD", "/release/eventSchemaVersion", "Release event-schema version must be a positive safe integer");
  }
  if (!Number.isSafeInteger(release.behaviorRegistryVersion) || release.behaviorRegistryVersion <= 0 || Object.is(release.behaviorRegistryVersion, -0)) {
    fail("V3_RELEASE_RECORD", "/release/behaviorRegistryVersion", "Release behavior-registry version must be a positive safe integer");
  }
  validateIncludedIds(release.includedIds);
  validateReleaseProvenance(release.sourceProvenance);
  return release;
}

function validateIncludedIdParity(release, content) {
  ["missions", "defenses", "enemies", "bosses"].forEach(function (partition) {
    const records = content && content[partition];
    if (!isPlainRecord(records)) {
      fail("V3_INCLUDED_IDS_MISMATCH", "/content/" + partition, "Compiled content lacks the declared ID partition");
    }
    const actual = Object.keys(records).sort(compareAscii);
    const expected = release.includedIds[partition];
    if (actual.length !== expected.length || actual.some(function (id, index) { return id !== expected[index]; })) {
      fail("V3_INCLUDED_IDS_MISMATCH", "/release/includedIds/" + partition, "Release included IDs differ from loaded compiled content");
    }
  });
}

function buildV3Artifacts(input) {
  if (!input || input.schemaVersion !== 3) fail("V3_ARTIFACT_SCHEMA", "/schemaVersion", "V3 artifact builder accepts exactly source schema 3");
  const abiBytes = Buffer.from(input.abiBytes);
  const simulationBytes = Buffer.from(input.simulationBytes);
  const descriptor = simulationDescriptor(simulationBytes, input.simulationLabel || "v3 simulation artifact");
  if (!canonicalBytes(descriptor).equals(canonicalBytes(input.abi))) {
    fail("ABI_RUNTIME_MISMATCH", "/abiDescriptor", "Authored ABI descriptor does not semantically match the simulation DESCRIPTOR");
  }
  const bindings = simulationBindings(simulationBytes, input.simulationLabel || "v3 simulation artifact");
  if (bindings.eventSchemaVersion !== input.content.eventSchemaVersion) {
    fail("EVENT_SCHEMA_BINDING_MISMATCH", "/eventSchemaVersion", "Simulation and compiled content event-schema versions differ");
  }
  if (bindings.behaviorRegistryVersion !== input.content.behaviorRegistryVersion) {
    fail("BEHAVIOR_REGISTRY_BINDING_MISMATCH", "/behaviorRegistryVersion", "Simulation and compiled content behavior-registry versions differ");
  }
  const abiHash = sha256Reference(abiBytes);
  if (input.content.abiHash !== abiHash) fail("ABI_HASH_BINDING_MISMATCH", "/abiHash", "Compiled content abiHash must bind the exact verified ABI source bytes");

  const content = deepFrozenClone(input.content);
  const presentation = deepFrozenClone(input.presentation);
  if (input.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/approvalState", "No implemented presentation schema can authorize production approval");
  }
  if (!presentation || presentation.schemaVersion !== 1) {
    fail("PRESENTATION_SCHEMA_UNIMPLEMENTED", "/presentation/schemaVersion", "Only presentation schema v1 is implemented");
  }
  const contentBytes = renderDataArtifact("AegisContent", "CONTENT", content, "canonical simulation-content artifact");
  const presentationBytes = renderDataArtifact("AegisPresentation", "PRESENTATION", presentation, "presentation companion artifact");
  const simulationHash = sha256Reference(simulationBytes);
  const contentHash = sha256Reference(contentBytes);
  const presentationHash = sha256Reference(presentationBytes);
  const simulationName = "aegis-sim." + simulationHash.slice(7) + ".js";
  const contentName = "aegis-content." + contentHash.slice(7) + ".js";
  const presentationName = "aegis-presentation." + presentationHash.slice(7) + ".js";
  requireHash(input.annexHash, "/annexHash");
  requireHash(input.sourceManifestHash, "/sourceManifestHash");

  const manifest = deepFrozenClone({
    schemaVersion: 3,
    contentVersion: input.contentVersion,
    approvalState: input.approvalState,
    annexHash: input.annexHash,
    abiHash: abiHash,
    eventSchemaVersion: content.eventSchemaVersion,
    behaviorRegistryVersion: content.behaviorRegistryVersion,
    simulationArtifact: simulationName,
    simulationHash: simulationHash,
    contentArtifact: contentName,
    contentHash: contentHash,
    presentationArtifact: presentationName,
    presentationHash: presentationHash,
    rulesetHash: sha256Reference(frameRulesetBytes(abiBytes, simulationBytes, contentBytes)),
    sourceManifestHash: input.sourceManifestHash,
    sourceProvenance: input.sourceProvenance,
    includedIds: input.includedIds,
    releaseEligible: input.approvalState === "production-approved",
  });
  validateReleaseRecord(manifest);
  const manifestBytes = Buffer.concat([canonicalBytes(manifest), Buffer.from("\n", "utf8")]);
  const manifestName = "manifest." + sha256Hex(manifestBytes) + ".json";
  const releaseBytes = renderDataArtifact("AegisRelease", "RELEASE", manifest, "immutable release record");
  const releaseName = "aegis-release." + sha256Hex(releaseBytes) + ".js";
  const outputs = immutableOutputs([
    [simulationName, simulationBytes],
    [contentName, contentBytes],
    [presentationName, presentationBytes],
    [manifestName, manifestBytes],
    [releaseName, releaseBytes],
  ]);
  const result = {
    content: content,
    presentation: presentation,
    manifest: manifest,
    manifestName: manifestName,
    releaseName: releaseName,
    outputs: outputs,
    rulesetHash: manifest.rulesetHash,
  };
  [
    ["abiBytes", abiBytes], ["simulationBytes", simulationBytes], ["contentBytes", contentBytes],
    ["presentationBytes", presentationBytes], ["manifestBytes", manifestBytes], ["releaseBytes", releaseBytes],
  ].forEach(function (entry) {
    Object.defineProperty(result, entry[0], { enumerable: true, get: function () { return Buffer.from(entry[1]); } });
  });
  return Object.freeze(result);
}

function artifactBytes(input, name, expectedHash, expectedKind) {
  const match = IMMUTABLE_JS.exec(name);
  if (!match || match[1] !== expectedKind || "sha256:" + match[2] !== expectedHash) {
    fail("V3_ARTIFACT_NAME", "/release/" + expectedKind, "Release record contains a mutable or hash-mismatched artifact filename");
  }
  let bytes;
  if (input.artifacts instanceof Map) bytes = input.artifacts.get(name);
  else if (input.artifacts && typeof input.artifacts.get === "function") bytes = input.artifacts.get(name);
  else if (input.artifacts && Object.prototype.hasOwnProperty.call(input.artifacts, name)) bytes = input.artifacts[name];
  if (bytes === undefined) fail("V3_ARTIFACT_MISSING", "/artifacts/" + name, "Pinned immutable artifact is missing");
  bytes = copyBytes(bytes, "V3_ARTIFACT_BYTES", "/artifacts/" + name, "Pinned immutable artifact");
  if (sha256Reference(bytes) !== expectedHash) fail("V3_ARTIFACT_CORRUPT", "/artifacts/" + name, "Pinned immutable artifact bytes fail their release hash");
  return bytes;
}

// pinnedReleaseName is a trust input: boot callers must source it from the
// committed bootstrap or a reviewed allow-list, never from request state.
function verifyV3ReleaseSelection(input) {
  if (
    !input ||
    input.queryReleaseUrl !== undefined ||
    input.queryManifestUrl !== undefined ||
    input.queryArtifactUrl !== undefined
  ) {
    fail("V3_RELEASE_SELECTION", "/release", "V3 boot selection forbids query-supplied releases, manifests, and artifacts");
  }
  if (typeof input.pinnedReleaseName !== "string" || input.releaseName !== input.pinnedReleaseName) {
    fail(
      "V3_RELEASE_SELECTION",
      "/release",
      "Release name must match an independent pin from the committed bootstrap or trusted allow-list"
    );
  }
  const releaseBytes = copyBytes(input.releaseBytes, "V3_RELEASE_BYTES", "/release", "Pinned release artifact");
  const releaseNameMatch = typeof input.releaseName === "string" ? IMMUTABLE_RELEASE.exec(input.releaseName) : null;
  if (!releaseNameMatch || releaseNameMatch[1] !== sha256Hex(releaseBytes)) {
    fail("V3_RELEASE_IDENTITY", "/release", "Boot selection requires a pinned content-hashed release filename matching its exact bytes");
  }
  const release = readGeneratedData(releaseBytes, "AegisRelease", "RELEASE", "v3 release record");
  validateReleaseRecord(release);
  if (release.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/release/approvalState", "No implemented presentation schema can authorize production approval");
  }
  const simulationBytes = artifactBytes(input, release.simulationArtifact, release.simulationHash, "aegis-sim");
  const contentBytes = artifactBytes(input, release.contentArtifact, release.contentHash, "aegis-content");
  const presentationBytes = artifactBytes(input, release.presentationArtifact, release.presentationHash, "aegis-presentation");
  const content = readGeneratedData(contentBytes, "AegisContent", "CONTENT", release.contentArtifact);
  const presentation = readGeneratedData(presentationBytes, "AegisPresentation", "PRESENTATION", release.presentationArtifact);
  validateIncludedIdParity(release, content);
  if (!presentation || presentation.schemaVersion !== 1) {
    fail("PRESENTATION_SCHEMA_UNIMPLEMENTED", "/presentation/schemaVersion", "Only presentation schema v1 is implemented");
  }
  const bindings = simulationBindings(simulationBytes, release.simulationArtifact);
  if (content.abiHash !== release.abiHash) fail("ABI_HASH_BINDING_MISMATCH", "/content/abiHash", "Release and compiled content ABI hashes differ");
  if (content.eventSchemaVersion !== release.eventSchemaVersion || bindings.eventSchemaVersion !== release.eventSchemaVersion) {
    fail("EVENT_SCHEMA_BINDING_MISMATCH", "/eventSchemaVersion", "Release, simulation, and content event-schema versions differ");
  }
  if (content.behaviorRegistryVersion !== release.behaviorRegistryVersion || bindings.behaviorRegistryVersion !== release.behaviorRegistryVersion) {
    fail("BEHAVIOR_REGISTRY_BINDING_MISMATCH", "/behaviorRegistryVersion", "Release, simulation, and content behavior-registry versions differ");
  }
  if (presentation.contentVersion !== release.contentVersion || content.contentVersion !== release.contentVersion) {
    fail("CONTENT_VERSION_BINDING_MISMATCH", "/contentVersion", "Release, simulation content, and presentation content versions differ");
  }
  if (input.manifestBytes !== undefined) {
    const manifestBytes = copyBytes(input.manifestBytes, "V3_MANIFEST_PARSE", "/manifest", "Generated manifest");
    let parsed;
    try { parsed = parseStrictJsonBytes(manifestBytes, "v3 generated manifest", {
      maxDepth: 32,
      maxObjectFields: 64,
      rejectNegativeZero: true,
    }); }
    catch (error) {
      if (error && error.name === "AegisContentError") throw error;
      fail("V3_MANIFEST_PARSE", "/manifest", "Generated manifest is not strict JSON data");
    }
    const expectedManifestBytes = Buffer.concat([canonicalBytes(parsed), Buffer.from("\n", "utf8")]);
    if (!manifestBytes.equals(expectedManifestBytes)) {
      fail("V3_MANIFEST_CANONICAL", "/manifest", "Generated manifest bytes must be canonical JSON with exactly one LF");
    }
    if (canonicalEncode(parsed) !== canonicalEncode(release)) {
      fail("V3_RELEASE_MANIFEST_MISMATCH", "/manifest", "JSON manifest and classic release record fields differ");
    }
  }
  return Object.freeze({ release: release, content: content, presentation: presentation, bindings: bindings });
}

module.exports = Object.freeze({
  buildV3Artifacts: buildV3Artifacts,
  readGeneratedData: readGeneratedData,
  renderDataArtifact: renderDataArtifact,
  simulationBindings: simulationBindings,
  validateReleaseRecord: validateReleaseRecord,
  verifyV3ReleaseSelection: verifyV3ReleaseSelection,
});
