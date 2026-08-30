"use strict";

/* Immutable schema-v4 artifact emission and release verification.
   The v4 release record authenticates the ABI-v2 identity exported by the simulation artifact's
   AegisSimV2 module instead of the ABI-v1 AegisSim descriptor used by schema v3. */

const crypto = require("node:crypto");
const vm = require("node:vm");
const { canonicalEncode, canonicalBytes } = require("./canonical.js");
const { fail } = require("./diagnostics.js");
const { decodeUtf8, parseStrictJsonBytes } = require("./strict-json.js");
const { frameRulesetBytes, immutableOutputs } = require("./artifacts.js");
const V3Artifacts = require("./v3-artifacts.js");
const V3Annex = require("./v3-annex.js");
const Presentation = require("./v4-presentation.js");

const HASH_REFERENCE = /^sha256:[0-9a-f]{64}$/;
const CONTENT_VERSION = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const CONTENT_ID = /^[a-z0-9][a-z0-9-]*$/;
const GLOBAL_NAME = /^Aegis[A-Za-z0-9]*$/;
const IMMUTABLE_JS = /^(aegis-sim|aegis-content|aegis-presentation)\.([0-9a-f]{64})\.js$/;
const IMMUTABLE_RELEASE = /^aegis-release\.([0-9a-f]{64})\.js$/;
const INCLUDED_ID_PARTITIONS = Object.freeze([
  "bosses", "defenses", "enemies", "missions", "specializations",
]);
const RELEASE_KEYS = Object.freeze([
  "abiHash", "abiVersion", "annexHash", "approvalState", "behaviorRegistryVersion",
  "commandSchemaVersion", "contentArtifact", "contentHash", "contentIds", "contentVersion",
  "developerOnly", "eventSchemaVersion", "includedIds", "presentationArtifact",
  "presentationHash", "releaseEligible", "replayFormatVersion", "requiredGlobals", "rulesetHash",
  "schemaVersion", "simulationArtifact", "simulationHash", "sourceManifestHash",
  "sourceProvenance",
].slice().sort());

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256Reference(bytes) {
  return "sha256:" + sha256Hex(bytes);
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

function requireHash(value, path) {
  if (typeof value !== "string" || !HASH_REFERENCE.test(value)) {
    fail("V4_ARTIFACT_HASH", path, "Expected a lowercase SHA-256 reference");
  }
}

function requireStableId(value, path, label) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail("V4_RELEASE_RECORD", path, label + " must be a stable ASCII ID");
  }
}

/* ---- ABI v2 simulation bindings ------------------------------------------------------ */

function executeApi(source, label, commonJs) {
  const sandbox = Object.create(null);
  if (commonJs) {
    sandbox.module = Object.create(null);
    sandbox.module.exports = Object.create(null);
    sandbox.exports = sandbox.module.exports;
  }
  sandbox.globalThis = sandbox;
  try {
    const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(source, context, { filename: label, timeout: 5000 });
  } catch (error) {
    fail(
      "V4_SIMULATION_LOAD",
      "/simulation",
      label + " failed in " + (commonJs ? "CommonJS" : "classic-script") +
        " mode: " + String(error && error.message || error)
    );
  }
  if (commonJs) return sandbox.module.exports;
  return sandbox.Game;
}

function ownValue(api, key, label, mode, predicate, description) {
  const descriptor = api && typeof api === "object" ? Object.getOwnPropertyDescriptor(api, key) : null;
  if (!descriptor || descriptor.get || descriptor.set || !predicate(descriptor.value)) {
    fail(
      "SIMULATION_BINDING_MISSING",
      "/simulation/" + key,
      label + " must explicitly export " + key + " as " + description + " in " + mode + " mode"
    );
  }
  return descriptor.value;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && !Object.is(value, -0);
}

function abiV2Bindings(api, label, mode) {
  const simV2 = ownValue(
    api, "AegisSimV2", label, mode,
    function (value) { return value && typeof value === "object"; },
    "the authenticated ABI v2 module"
  );
  return {
    descriptor: JSON.parse(JSON.stringify(ownValue(
      simV2, "DESCRIPTOR", label, mode,
      function (value) { return value && typeof value === "object"; },
      "a DESCRIPTOR data record"
    ))),
    descriptorSha256: ownValue(
      simV2, "DESCRIPTOR_SHA256", label, mode,
      function (value) { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); },
      "a lowercase SHA-256 hex identity"
    ),
    eventSchemaVersion: ownValue(simV2, "EVENT_SCHEMA_VERSION", label, mode, safeInteger, "an own safe integer"),
    behaviorRegistryVersion: ownValue(simV2, "BEHAVIOR_REGISTRY_VERSION", label, mode, safeInteger, "an own safe integer"),
    commandSchemaVersion: ownValue(simV2, "COMMAND_SCHEMA_VERSION", label, mode, safeInteger, "an own safe integer"),
  };
}

function simulationBindingsV2(simulationBytes, label) {
  label = label || "v4 simulation artifact";
  const source = decodeUtf8(simulationBytes, label);
  if (source.indexOf("\r") !== -1 || !source.endsWith("\n") || source.endsWith("\n\n")) {
    fail("SIMULATION_LINE_ENDINGS", "/simulation", label + " must use LF and end with exactly one newline");
  }
  const commonBindings = abiV2Bindings(executeApi(source, label, true), label, "CommonJS");
  const classicBindings = abiV2Bindings(executeApi(source, label, false), label, "classic-script");
  if (canonicalEncode(commonBindings) !== canonicalEncode(classicBindings)) {
    fail("SIMULATION_BINDING_MODE_MISMATCH", "/simulation", "Simulation bindings differ between CommonJS and classic-script modes");
  }
  return deepFrozenClone(commonBindings);
}

/* ---- release record ------------------------------------------------------------------ */

function validateContentIds(value, path) {
  if (!Array.isArray(value) || value.length === 0) {
    fail("V4_RELEASE_RECORD", path, "Release contentIds must be a nonempty array");
  }
  let prior = null;
  value.forEach(function (id, index) {
    if (typeof id !== "string" || !CONTENT_ID.test(id)) {
      fail("V4_RELEASE_RECORD", path + "/" + index, "contentIds must be stable lowercase identifiers");
    }
    if (prior !== null && compareAscii(prior, id) >= 0) {
      fail("V4_RELEASE_RECORD", path + "/" + index, "contentIds must be unique and strict ASCII sorted");
    }
    prior = id;
  });
}

function validateRequiredGlobals(value, path) {
  if (!Array.isArray(value) || value.length === 0) {
    fail("V4_RELEASE_RECORD", path, "Release requiredGlobals must be a nonempty array");
  }
  let prior = null;
  value.forEach(function (name, index) {
    if (typeof name !== "string" || !GLOBAL_NAME.test(name)) {
      fail("V4_RELEASE_RECORD", path + "/" + index, "Required globals must be Aegis-owned classic-script names");
    }
    if (prior !== null && compareAscii(prior, name) >= 0) {
      fail("V4_RELEASE_RECORD", path + "/" + index, "Required globals must be unique and strict ASCII sorted");
    }
    prior = name;
  });
}

function validateIncludedIds(includedIds) {
  if (!isPlainRecord(includedIds) ||
      Object.keys(includedIds).sort(compareAscii).join(",") !== INCLUDED_ID_PARTITIONS.join(",")) {
    fail("V4_RELEASE_RECORD", "/release/includedIds", "Release includedIds has an invalid partition shape");
  }
  INCLUDED_ID_PARTITIONS.forEach(function (partition) {
    const values = includedIds[partition];
    const path = "/release/includedIds/" + partition;
    if (!Array.isArray(values)) fail("V4_RELEASE_RECORD", path, "Included IDs must be arrays");
    let prior = null;
    values.forEach(function (id, index) {
      requireStableId(id, path + "/" + index, "Included ID");
      if (prior !== null && compareAscii(prior, id) >= 0) {
        fail("V4_RELEASE_RECORD", path + "/" + index, "Included IDs must be unique and strict ASCII sorted");
      }
      prior = id;
    });
  });
}

function validateReleaseProvenance(records) {
  if (!Array.isArray(records)) {
    fail("V4_RELEASE_RECORD", "/release/sourceProvenance", "Release source provenance must be an array");
  }
  let prior = null;
  records.forEach(function (record, index) {
    const path = "/release/sourceProvenance/" + index;
    if (!isPlainRecord(record)) fail("V4_RELEASE_RECORD", path, "Release provenance entries must be plain records");
    const keys = Object.keys(record).sort(compareAscii);
    const expected = ["id", "kind", "sha256", "source"];
    if (keys.length !== expected.length || keys.some(function (key, keyIndex) { return key !== expected[keyIndex]; })) {
      fail("V4_RELEASE_RECORD", path, "Release provenance entries contain exactly kind, id, source, and sha256");
    }
    requireStableId(record.kind, path + "/kind", "Provenance kind");
    requireStableId(record.id, path + "/id", "Provenance id");
    V3Annex.validateRepositoryPath(record.source, path + "/source");
    requireHash(record.sha256, path + "/sha256");
    const key = record.kind + "\u0000" + record.id;
    if (prior !== null && compareAscii(prior, key) >= 0) {
      fail("V4_RELEASE_RECORD", path, "Release provenance kind/id pairs must be unique and strict ASCII sorted");
    }
    prior = key;
  });
}

function validateV4ReleaseRecord(release) {
  if (!isPlainRecord(release)) fail("V4_RELEASE_RECORD", "/release", "Release record must be a plain data object");
  const keys = Object.keys(release).sort(compareAscii);
  if (keys.length !== RELEASE_KEYS.length || keys.some(function (key, index) { return key !== RELEASE_KEYS[index]; })) {
    fail("V4_RELEASE_RECORD", "/release", "Release record fields must exactly match the v4 generated-manifest contract");
  }
  if (release.schemaVersion !== 4) fail("V4_RELEASE_SCHEMA", "/release/schemaVersion", "Release record must bind schema 4");
  if (release.abiVersion !== 2) fail("V4_RELEASE_SCHEMA", "/release/abiVersion", "Release record must bind ABI v2");
  if (["candidate-balance", "balance-approved"].indexOf(release.approvalState) === -1) {
    fail("V4_RELEASE_RECORD", "/release/approvalState", "Schema v4 releases remain non-production");
  }
  if (release.releaseEligible !== false || release.developerOnly !== true) {
    fail("V4_RELEASE_RECORD", "/release/releaseEligible", "Schema v4 releases are developer-only and release-ineligible");
  }
  if (typeof release.contentVersion !== "string" || !CONTENT_VERSION.test(release.contentVersion)) {
    fail("V4_RELEASE_RECORD", "/release/contentVersion", "Release contentVersion must be a stable lowercase version ID");
  }
  [
    "annexHash", "abiHash", "simulationHash", "contentHash", "presentationHash", "rulesetHash",
    "sourceManifestHash",
  ].forEach(function (key) { requireHash(release[key], "/release/" + key); });
  [
    ["eventSchemaVersion", 2], ["behaviorRegistryVersion", 2],
    ["commandSchemaVersion", 2], ["replayFormatVersion", 2],
  ].forEach(function (entry) {
    if (release[entry[0]] !== entry[1]) {
      fail("V4_RELEASE_RECORD", "/release/" + entry[0], "Schema v4 pins " + entry[0] + " to " + entry[1]);
    }
  });
  validateContentIds(release.contentIds, "/release/contentIds");
  validateRequiredGlobals(release.requiredGlobals, "/release/requiredGlobals");
  validateIncludedIds(release.includedIds);
  validateReleaseProvenance(release.sourceProvenance);
  return release;
}

function validateIncludedIdParity(release, content) {
  [
    ["missions", content.missions], ["defenses", content.defenses], ["enemies", content.enemies],
    ["bosses", content.bosses], ["specializations", content.specializations],
  ].forEach(function (entry) {
    if (!isPlainRecord(entry[1])) {
      fail("V4_INCLUDED_IDS_MISMATCH", "/content/" + entry[0], "Compiled content lacks the declared ID partition");
    }
    const actual = Object.keys(entry[1]).sort(compareAscii);
    const expected = release.includedIds[entry[0]];
    if (actual.length !== expected.length || actual.some(function (id, index) { return id !== expected[index]; })) {
      fail("V4_INCLUDED_IDS_MISMATCH", "/release/includedIds/" + entry[0], "Release included IDs differ from loaded compiled content");
    }
  });
}

function presentationBindings(content, includedIds) {
  if (!isPlainRecord(content) || !isPlainRecord(content.eventCatalog) || !isPlainRecord(content.missions)) {
    fail("PRESENTATION_CONTENT_BINDING", "/content", "Compiled content must expose mission and event records for presentation binding");
  }
  const cueIds = new Set();
  Object.keys(content.eventCatalog).forEach(function (eventId) {
    const event = content.eventCatalog[eventId];
    if (!isPlainRecord(event)) {
      fail("PRESENTATION_CONTENT_BINDING", "/content/eventCatalog/" + eventId, "Compiled event record is invalid");
    }
    requireStableId(event.presentationCueId, "/content/eventCatalog/" + eventId + "/presentationCueId", "Presentation cue ID");
    cueIds.add(event.presentationCueId);
  });
  includedIds.missions.forEach(function (missionId) {
    const mission = content.missions[missionId];
    const missionPath = "/content/missions/" + missionId;
    if (!isPlainRecord(mission) || !Array.isArray(mission.previewDeclarations)) {
      fail("PRESENTATION_CONTENT_BINDING", missionPath, "Compiled mission must expose preview cue declarations");
    }
    mission.previewDeclarations.forEach(function (declaration, declarationIndex) {
      const declarationPath = missionPath + "/previewDeclarations/" + declarationIndex;
      if (!isPlainRecord(declaration) || !Array.isArray(declaration.semanticCueIds)) {
        fail("PRESENTATION_CONTENT_BINDING", declarationPath, "Compiled preview declaration must expose semantic cue IDs");
      }
      declaration.semanticCueIds.forEach(function (cueId, cueIndex) {
        requireStableId(cueId, declarationPath + "/semanticCueIds/" + cueIndex, "Presentation cue ID");
        cueIds.add(cueId);
      });
    });
  });
  return Object.freeze({
    missionIds: Object.freeze(includedIds.missions.slice()),
    cueIds: Object.freeze(Array.from(cueIds).sort(compareAscii)),
  });
}

function buildV4Artifacts(input) {
  if (!input || input.schemaVersion !== 4) {
    fail("V4_ARTIFACT_SCHEMA", "/schemaVersion", "V4 artifact builder accepts exactly source schema 4");
  }
  const abiBytes = Buffer.from(input.abiBytes);
  const simulationBytes = Buffer.from(input.simulationBytes);
  const bindings = simulationBindingsV2(simulationBytes, input.simulationLabel || "v4 simulation artifact");
  const authoredAbiBytes = canonicalBytes(input.abi);
  if (!canonicalBytes(bindings.descriptor).equals(authoredAbiBytes)) {
    fail("ABI_RUNTIME_MISMATCH", "/abiDescriptor", "Authored ABI v2 descriptor does not semantically match the simulation AegisSimV2 DESCRIPTOR");
  }
  if (sha256Hex(authoredAbiBytes) !== bindings.descriptorSha256) {
    fail("ABI_RUNTIME_MISMATCH", "/abiDescriptor/sha256", "Authored ABI v2 descriptor hash differs from the module DESCRIPTOR_SHA256");
  }
  if (!abiBytes.equals(authoredAbiBytes)) {
    fail("V4_ABI_BYTES", "/abiDescriptor", "The authored ABI v2 source file must contain exactly the canonical descriptor bytes");
  }
  if (bindings.eventSchemaVersion !== input.content.eventSchemaVersion) {
    fail("EVENT_SCHEMA_BINDING_MISMATCH", "/eventSchemaVersion", "Simulation and compiled content event-schema versions differ");
  }
  if (bindings.behaviorRegistryVersion !== input.content.behaviorRegistryVersion) {
    fail("BEHAVIOR_REGISTRY_BINDING_MISMATCH", "/behaviorRegistryVersion", "Simulation and compiled content behavior-registry versions differ");
  }
  if (bindings.commandSchemaVersion !== input.content.commandSchemaVersion) {
    fail("COMMAND_SCHEMA_BINDING_MISMATCH", "/commandSchemaVersion", "Simulation and compiled content command-schema versions differ");
  }
  const abiHash = sha256Reference(abiBytes);
  if (input.content.abiHash !== abiHash) {
    fail("ABI_HASH_BINDING_MISMATCH", "/abiHash", "Compiled content abiHash must bind the exact verified ABI source bytes");
  }

  const content = deepFrozenClone(input.content);
  validateIncludedIds(input.includedIds);
  validateIncludedIdParity({ includedIds: input.includedIds }, content);
  const presentation = Presentation.validatePresentationCompanion(
    input.presentation, "/presentation", presentationBindings(content, input.includedIds)
  );
  if (content.contentVersion !== input.contentVersion || presentation.contentVersion !== input.contentVersion) {
    fail("CONTENT_VERSION_BINDING_MISMATCH", "/contentVersion", "Compiled content and presentation versions must match the release version");
  }

  const contentBytes = V3Artifacts.renderDataArtifact(
    "AegisContent", "CONTENT", content, "canonical simulation-content artifact"
  );
  const presentationBytes = V3Artifacts.renderDataArtifact(
    "AegisPresentation", "PRESENTATION", presentation, "presentation companion artifact"
  );
  const simulationHash = sha256Reference(simulationBytes);
  const contentHash = sha256Reference(contentBytes);
  const presentationHash = sha256Reference(presentationBytes);
  const simulationName = "aegis-sim." + simulationHash.slice(7) + ".js";
  const contentName = "aegis-content." + contentHash.slice(7) + ".js";
  const presentationName = "aegis-presentation." + presentationHash.slice(7) + ".js";
  requireHash(input.annexHash, "/annexHash");
  requireHash(input.sourceManifestHash, "/sourceManifestHash");

  const manifest = deepFrozenClone({
    schemaVersion: 4,
    abiVersion: 2,
    contentVersion: input.contentVersion,
    approvalState: input.approvalState,
    developerOnly: true,
    releaseEligible: false,
    annexHash: input.annexHash,
    abiHash: abiHash,
    eventSchemaVersion: content.eventSchemaVersion,
    behaviorRegistryVersion: content.behaviorRegistryVersion,
    commandSchemaVersion: content.commandSchemaVersion,
    replayFormatVersion: content.replayFormatVersion,
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
    contentIds: input.contentIds,
    requiredGlobals: input.requiredGlobals,
  });
  validateV4ReleaseRecord(manifest);
  const manifestBytes = Buffer.concat([canonicalBytes(manifest), Buffer.from("\n", "utf8")]);
  const manifestName = "manifest." + sha256Hex(manifestBytes) + ".json";
  const releaseBytes = V3Artifacts.renderDataArtifact(
    "AegisRelease", "RELEASE", manifest, "immutable release record"
  );
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
    Object.defineProperty(result, entry[0], {
      enumerable: true,
      get: function () { return Buffer.from(entry[1]); },
    });
  });
  return Object.freeze(result);
}

function artifactBytes(input, name, expectedHash, expectedKind) {
  const match = IMMUTABLE_JS.exec(name);
  if (!match || match[1] !== expectedKind || "sha256:" + match[2] !== expectedHash) {
    fail("V4_ARTIFACT_NAME", "/release/" + expectedKind, "Release record contains a mutable or hash-mismatched artifact filename");
  }
  let bytes;
  if (input.artifacts instanceof Map) bytes = input.artifacts.get(name);
  else if (input.artifacts && typeof input.artifacts.get === "function") bytes = input.artifacts.get(name);
  else if (input.artifacts && Object.prototype.hasOwnProperty.call(input.artifacts, name)) bytes = input.artifacts[name];
  if (bytes === undefined) fail("V4_ARTIFACT_MISSING", "/artifacts/" + name, "Pinned immutable artifact is missing");
  bytes = copyBytes(bytes, "V4_ARTIFACT_BYTES", "/artifacts/" + name, "Pinned immutable artifact");
  if (sha256Reference(bytes) !== expectedHash) {
    fail("V4_ARTIFACT_CORRUPT", "/artifacts/" + name, "Pinned immutable artifact bytes fail their release hash");
  }
  return bytes;
}

// pinnedReleaseName is a trust input: boot callers must source it from the committed bootstrap
// or a reviewed allow-list, never from request state.
function verifyV4ReleaseSelection(input) {
  if (!input || input.queryReleaseUrl !== undefined || input.queryManifestUrl !== undefined ||
      input.queryArtifactUrl !== undefined) {
    fail("V4_RELEASE_SELECTION", "/release", "V4 boot selection forbids query-supplied releases, manifests, and artifacts");
  }
  if (typeof input.pinnedReleaseName !== "string" || input.releaseName !== input.pinnedReleaseName) {
    fail("V4_RELEASE_SELECTION", "/release", "Release name must match an independent pin from the committed bootstrap");
  }
  const releaseBytes = copyBytes(input.releaseBytes, "V4_RELEASE_BYTES", "/release", "Pinned release artifact");
  const releaseNameMatch = IMMUTABLE_RELEASE.exec(input.releaseName);
  if (!releaseNameMatch || releaseNameMatch[1] !== sha256Hex(releaseBytes)) {
    fail("V4_RELEASE_IDENTITY", "/release", "Boot selection requires a pinned content-hashed release filename matching its exact bytes");
  }
  const release = V3Artifacts.readGeneratedData(releaseBytes, "AegisRelease", "RELEASE", "v4 release record");
  validateV4ReleaseRecord(release);
  const simulationBytes = artifactBytes(input, release.simulationArtifact, release.simulationHash, "aegis-sim");
  const contentBytes = artifactBytes(input, release.contentArtifact, release.contentHash, "aegis-content");
  const presentationBytes = artifactBytes(input, release.presentationArtifact, release.presentationHash, "aegis-presentation");
  const content = V3Artifacts.readGeneratedData(contentBytes, "AegisContent", "CONTENT", release.contentArtifact);
  const presentation = V3Artifacts.readGeneratedData(presentationBytes, "AegisPresentation", "PRESENTATION", release.presentationArtifact);
  validateIncludedIdParity(release, content);
  const validatedPresentation = Presentation.validatePresentationCompanion(
    presentation, "/presentation", presentationBindings(content, release.includedIds)
  );
  const bindings = simulationBindingsV2(simulationBytes, release.simulationArtifact);
  if (content.abiHash !== release.abiHash) {
    fail("ABI_HASH_BINDING_MISMATCH", "/content/abiHash", "Release and compiled content ABI hashes differ");
  }
  if (content.schemaVersion !== 4) {
    fail("V4_RELEASE_SCHEMA", "/content/schemaVersion", "A v4 release must bind compiled content schema 4");
  }
  [
    ["eventSchemaVersion", "EVENT_SCHEMA_BINDING_MISMATCH"],
    ["behaviorRegistryVersion", "BEHAVIOR_REGISTRY_BINDING_MISMATCH"],
    ["commandSchemaVersion", "COMMAND_SCHEMA_BINDING_MISMATCH"],
  ].forEach(function (entry) {
    if (content[entry[0]] !== release[entry[0]] || bindings[entry[0]] !== release[entry[0]]) {
      fail(entry[1], "/" + entry[0], "Release, simulation, and content " + entry[0] + " differ");
    }
  });
  if (validatedPresentation.contentVersion !== release.contentVersion ||
      content.contentVersion !== release.contentVersion) {
    fail("CONTENT_VERSION_BINDING_MISMATCH", "/contentVersion", "Release, simulation content, and presentation content versions differ");
  }
  if (input.manifestBytes !== undefined) {
    const manifestBytes = copyBytes(input.manifestBytes, "V4_MANIFEST_PARSE", "/manifest", "Generated manifest");
    let parsed;
    try {
      parsed = parseStrictJsonBytes(manifestBytes, "v4 generated manifest", {
        maxDepth: 32, maxObjectFields: 64, rejectNegativeZero: true,
      });
    } catch (error) {
      if (error && error.name === "AegisContentError") throw error;
      fail("V4_MANIFEST_PARSE", "/manifest", "Generated manifest is not strict JSON data");
    }
    const expectedManifestBytes = Buffer.concat([canonicalBytes(parsed), Buffer.from("\n", "utf8")]);
    if (!manifestBytes.equals(expectedManifestBytes)) {
      fail("V4_MANIFEST_CANONICAL", "/manifest", "Generated manifest bytes must be canonical JSON with exactly one LF");
    }
    if (canonicalEncode(parsed) !== canonicalEncode(release)) {
      fail("V4_RELEASE_MANIFEST_MISMATCH", "/manifest", "JSON manifest and classic release record fields differ");
    }
  }
  return Object.freeze({
    release: release, content: content, presentation: validatedPresentation, bindings: bindings,
  });
}

module.exports = Object.freeze({
  INCLUDED_ID_PARTITIONS: INCLUDED_ID_PARTITIONS,
  RELEASE_KEYS: RELEASE_KEYS,
  buildV4Artifacts: buildV4Artifacts,
  presentationBindings: presentationBindings,
  simulationBindingsV2: simulationBindingsV2,
  validateV4ReleaseRecord: validateV4ReleaseRecord,
  verifyV4ReleaseSelection: verifyV4ReleaseSelection,
});
