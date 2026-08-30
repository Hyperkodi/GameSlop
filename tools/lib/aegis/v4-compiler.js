"use strict";

/* Complete schema-v4 compilation.
   Reuses the reviewed v3 map adapter, presentation companion, and asset inspector; adds only the
   v4 lock tree, unlock partitions, annex coverage, and ABI-v2 release identity. */

const crypto = require("node:crypto");
const path = require("node:path");
const { canonicalBytes } = require("./canonical.js");
const { fail, pointerJoin } = require("./diagnostics.js");
const AssetInspector = require("./asset-inspector.js");
const Annex = require("./v4-annex.js");
const Artifacts = require("./v4-artifacts.js");
const Catalog = require("./v4-behavior-catalog.js");
const CrossReferences = require("./v4-cross-references.js");
const Presentation = require("./v4-presentation.js");
const V3Annex = require("./v3-annex.js");

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/* Every classic-script global a descriptor-driven loader must find before a v4 boot:
   the twenty declared simulation modules plus the three generated data artifacts. */
const REQUIRED_GLOBALS = Object.freeze([
  "AegisBehaviors", "AegisCommands", "AegisCommandsV2", "AegisContent", "AegisEconomy",
  "AegisEffects", "AegisGeometry", "AegisKernel", "AegisManagement", "AegisMovement",
  "AegisObjectives", "AegisPresentation", "AegisProtocols", "AegisRelease", "AegisRelics",
  "AegisReplay", "AegisReplayFormats", "AegisReplayRunner", "AegisReplayV2", "AegisSim",
  "AegisSimV2", "AegisTargeting", "AegisTimers",
].slice().sort());

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepFrozenClone(value[key]); });
  return Object.freeze(output);
}

function exactAbiBytes(preflight) {
  const encoded = preflight && preflight.verifiedRawSources && preflight.verifiedRawSources.abiDescriptorBase64;
  if (typeof encoded !== "string" || !encoded ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    fail("V4_ABI_BYTES", "/abiDescriptor", "Verified exact ABI descriptor bytes are required for v4 ruleset framing");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) {
    fail("V4_ABI_BYTES", "/abiDescriptor", "Verified ABI byte encoding is noncanonical");
  }
  const expected = preflight.manifest.abiDescriptor.sha256;
  const actual = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    fail("V4_ABI_BYTES", "/abiDescriptor/sha256", "Verified ABI bytes do not match the manifest source hash");
  }
  return bytes;
}

function buildV4Provenance(preflight) {
  if (!isPlainRecord(preflight) || !preflight.manifest || preflight.manifest.schemaVersion !== 4) {
    fail("PROVENANCE_SCHEMA", "/schemaVersion", "V4 provenance accepts only source schema 4");
  }
  if (typeof preflight.manifestHash !== "string" || !SHA256.test(preflight.manifestHash)) {
    fail("PROVENANCE_HASH", "/manifestHash", "Verified source-manifest hash is required");
  }
  const declared = Array.isArray(preflight.provenance) ? preflight.provenance : null;
  const repository = Array.isArray(preflight.repositoryProvenance) ? preflight.repositoryProvenance : null;
  if (!declared || !repository) {
    fail("PROVENANCE_INPUT", "/sourceProvenance", "Verified declared and repository provenance arrays are required");
  }
  const records = declared.concat(repository).map(function (record, index) {
    const recordPath = "/sourceProvenance/" + index;
    if (!isPlainRecord(record)) fail("PROVENANCE_RECORD", recordPath, "Source provenance entries must be plain objects");
    if (typeof record.kind !== "string" || !STABLE_ID.test(record.kind)) {
      fail("PROVENANCE_KIND", pointerJoin(recordPath, "kind"), "Provenance kind must be a stable ASCII ID");
    }
    if (typeof record.id !== "string" || !STABLE_ID.test(record.id)) {
      fail("PROVENANCE_ID", pointerJoin(recordPath, "id"), "Provenance id must be a stable ASCII ID");
    }
    V3Annex.validateRepositoryPath(record.source, pointerJoin(recordPath, "source"));
    if (typeof record.sha256 !== "string" || !SHA256.test(record.sha256)) {
      fail("PROVENANCE_HASH", pointerJoin(recordPath, "sha256"), "Provenance hash must be a lowercase SHA-256 reference");
    }
    return { kind: record.kind, id: record.id, source: record.source, sha256: record.sha256 };
  });
  records.sort(function (left, right) {
    return compareAscii(left.kind, right.kind) || compareAscii(left.id, right.id);
  });
  const seen = new Set();
  records.forEach(function (record, index) {
    const key = record.kind + "/" + record.id;
    if (seen.has(key)) fail("PROVENANCE_DUPLICATE", "/sourceProvenance/" + index, "Provenance kind/id pairs must be unique");
    seen.add(key);
  });
  const sourceProvenance = deepFrozenClone(records);
  canonicalBytes(sourceProvenance);
  return Object.freeze({
    sourceManifestHash: preflight.manifestHash,
    sourceProvenance: sourceProvenance,
  });
}

/* Compiled v4 content is bound by an ABI-v2 kernel, so every semantic event declares a v2 phase
   and registry version 2. Authored records may still name the retained v1 phase that used to run
   the event; the total map in the behavior catalog translates it exactly once here. */
function toAbiV2EventCatalog(eventCatalog) {
  const v2Phases = new Set(Catalog.ABI_V2_PHASE_IDS);
  const output = {};
  Object.keys(eventCatalog).sort(compareAscii).forEach(function (eventId) {
    const definition = eventCatalog[eventId];
    let phaseId = definition.phaseId;
    if (!v2Phases.has(phaseId)) {
      phaseId = Catalog.V1_TO_V2_PHASE_IDS[phaseId];
      if (!phaseId) {
        fail(
          "V4_EVENT_PHASE",
          pointerJoin("/eventCatalog", eventId),
          "Semantic event declares a phase that is neither an ABI-v2 phase nor a mapped ABI-v1 phase"
        );
      }
    }
    output[eventId] = Object.keys(definition).sort(compareAscii).reduce(function (record, key) {
      record[key] = key === "phaseId" ? phaseId : definition[key];
      return record;
    }, {});
    output[eventId].version = Catalog.BEHAVIOR_REGISTRY_VERSION;
  });
  return output;
}

function buildSimulationContent(preflight, resolved, abiHash) {
  const tree = resolved.lockTree;
  const unlocks = resolved.unlockContent;
  return deepFrozenClone({
    schemaVersion: 4,
    contentVersion: preflight.manifest.contentVersion,
    abiHash: abiHash,
    abiVersion: 2,
    eventSchemaVersion: resolved.eventSchemaVersion,
    behaviorRegistryVersion: resolved.behaviorRegistryVersion,
    commandSchemaVersion: resolved.commandSchemaVersion,
    replayFormatVersion: resolved.replayFormatVersion,
    /* The kernel's compiled-v4 Protocol adapter reads the profile schema the run header was
       constructed against, so the content declares every versioned contract it binds. */
    profileSchemaVersion: resolved.profileSchemaVersion,
    behaviorContracts: resolved.behaviorContracts,
    campaignRules: tree.campaignRules,
    defenses: tree.defenses,
    specializations: tree.specializations,
    summons: tree.summons,
    enemies: tree.enemies,
    bosses: tree.bosses,
    missions: tree.missions,
    maps: tree.maps,
    eventCatalog: toAbiV2EventCatalog(tree.eventCatalog),
    protocolRules: unlocks.protocolRules,
    relicRules: unlocks.relicRules,
    reinforcementRules: unlocks.reinforcementRules,
    protocols: unlocks.protocols,
    relics: unlocks.relics,
    reinforcements: unlocks.reinforcements,
    mechanisms: unlocks.mechanisms,
    grantRecords: unlocks.grantRecords,
    missionProgression: unlocks.missionProgression,
    defenseUnlockGrantMappings: resolved.defenseUnlockGrantMappings,
    previewProofRecords: resolved.previewProofRecords,
  });
}

function fileBackedPreflight(preflight) {
  return typeof preflight.sourceRoot === "string" || typeof preflight.repositoryRoot === "string";
}

function verifyPresentationAssetClaims(preflight, presentation, options) {
  if (!presentation || presentation.schemaVersion !== 2) return Object.freeze([]);
  options = options || {};
  const assetRoot = options.assetRoot;
  const injectedVerifier = options.verifyAssetClaim;
  if (fileBackedPreflight(preflight)) {
    if (typeof preflight.sourceRoot !== "string" || typeof preflight.repositoryRoot !== "string") {
      fail("V4_ASSET_ROOT", "/presentationCatalog/assetRecords", "File-backed v4 asset verification requires the source and repository root identities");
    }
    if (injectedVerifier !== undefined) {
      fail("V4_ASSET_VERIFIER", "/presentationCatalog/assetRecords", "File-backed v4 compilation cannot replace repository asset inspection");
    }
    const expectedRoot = path.resolve(preflight.repositoryRoot, "games", "aegis");
    if (typeof assetRoot !== "string" || path.resolve(assetRoot) !== expectedRoot) {
      fail("V4_ASSET_ROOT", "/presentationCatalog/assetRecords", "File-backed v4 compilation requires the canonical games/aegis repository asset root");
    }
  } else if (assetRoot === undefined && typeof injectedVerifier !== "function") {
    fail("V4_ASSET_VERIFIER", "/presentationCatalog/assetRecords", "Synthetic v4 compilation requires an explicit asset root or measured-claim verifier");
  }
  if (assetRoot !== undefined && injectedVerifier !== undefined) {
    fail("V4_ASSET_VERIFIER", "/presentationCatalog/assetRecords", "Choose repository asset inspection or the synthetic verifier, never both");
  }
  const inspections = presentation.assetRecords.map(function (claim, index) {
    const diagnosticPath = "/presentationCatalog/assetRecords/" + index;
    if (assetRoot !== undefined) {
      return AssetInspector.inspectManifestClaim(assetRoot, claim, { diagnosticPath: diagnosticPath });
    }
    return AssetInspector.compareManifestClaim(claim, injectedVerifier(claim, diagnosticPath), diagnosticPath);
  });
  return Object.freeze(inspections.slice());
}

// Production callers must pass the direct immutable preflightV4SourceTree result. Synthetic
// object graphs are accepted only so isolated compiler tests can exercise post-loader contracts.
function compileVerifiedV4Source(preflight, options) {
  options = options || {};
  if (!preflight || !preflight.manifest || preflight.manifest.schemaVersion !== 4) {
    fail("V4_COMPILER_SCHEMA", "/schemaVersion", "Complete v4 compilation accepts only a verified schema-4 source preflight");
  }
  if (options.simulationBytes === undefined) {
    fail("SIMULATION_REQUIRED", "/simulation", "Complete v4 compilation requires explicit immutable simulation bytes");
  }
  const abiBytes = exactAbiBytes(preflight);
  const abiHash = "sha256:" + crypto.createHash("sha256").update(abiBytes).digest("hex");
  const resolved = CrossReferences.resolveV4Graph(preflight, {
    normalizeAndValidateMap: options.normalizeAndValidateMap,
  });
  const lockCoverage = Annex.validateV4LockCoverage(preflight.annex, resolved.lockTree, {
    semanticArrayPaths: resolved.semanticArrayPaths,
    annexContext: {
      manifestAnnexId: preflight.manifest.annex.id,
      approvalState: preflight.manifest.approvalState,
    },
  });
  const content = buildSimulationContent(preflight, resolved, abiHash);
  const presentation = Presentation.buildV4PresentationCompanion({
    approvalState: preflight.manifest.approvalState,
    contentVersion: preflight.manifest.contentVersion,
    missions: preflight.normalizedSource.missions.map(function (record) { return record.definition; }),
    eventCatalog: preflight.normalizedSource.eventCatalog,
    stringCatalog: preflight.normalizedSource.stringCatalog,
    presentationCatalog: preflight.normalizedSource.presentationCatalog,
  });
  verifyPresentationAssetClaims(preflight, presentation, options);
  const provenance = buildV4Provenance(preflight);
  const includedIds = deepFrozenClone({
    bosses: Object.keys(resolved.lockTree.bosses).sort(compareAscii),
    defenses: Object.keys(resolved.lockTree.defenses).sort(compareAscii),
    enemies: Object.keys(resolved.lockTree.enemies).sort(compareAscii),
    missions: Object.keys(resolved.lockTree.missions).sort(compareAscii),
    specializations: Object.keys(resolved.lockTree.specializations).sort(compareAscii),
  });
  const artifacts = Artifacts.buildV4Artifacts({
    schemaVersion: 4,
    abi: preflight.normalizedSource.abiDescriptor,
    abiBytes: abiBytes,
    simulationBytes: Buffer.from(options.simulationBytes),
    simulationLabel: options.simulationLabel || "explicit v4 simulation bytes",
    contentVersion: preflight.manifest.contentVersion,
    approvalState: preflight.manifest.approvalState,
    annexHash: preflight.manifest.annex.sha256,
    sourceManifestHash: provenance.sourceManifestHash,
    sourceProvenance: provenance.sourceProvenance,
    includedIds: includedIds,
    contentIds: includedIds.missions.slice(),
    requiredGlobals: REQUIRED_GLOBALS.slice(),
    content: content,
    presentation: presentation,
  });
  return Object.freeze({
    source: preflight,
    resolved: resolved,
    lockCoverage: lockCoverage,
    provenance: provenance,
    artifacts: artifacts,
  });
}

module.exports = Object.freeze({
  REQUIRED_GLOBALS: REQUIRED_GLOBALS,
  buildSimulationContent: buildSimulationContent,
  buildV4Provenance: buildV4Provenance,
  compileVerifiedV4Source: compileVerifiedV4Source,
  verifyPresentationAssetClaims: verifyPresentationAssetClaims,
});
