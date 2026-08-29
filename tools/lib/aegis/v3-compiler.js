"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { fail } = require("./diagnostics.js");
const AssetInspector = require("./asset-inspector.js");
const Annex = require("./v3-annex.js");
const CrossReferences = require("./v3-cross-references.js");
const Presentation = require("./v3-presentation.js");
const Provenance = require("./v3-provenance.js");
const Artifacts = require("./v3-artifacts.js");

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepFrozenClone(value[key]); });
  return Object.freeze(output);
}

function exactAbiBytes(preflight) {
  const encoded = preflight && preflight.verifiedRawSources && preflight.verifiedRawSources.abiDescriptorBase64;
  if (typeof encoded !== "string" || !encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    fail("V3_ABI_BYTES", "/abiDescriptor", "Verified exact ABI descriptor bytes are required for v3 ruleset framing");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) fail("V3_ABI_BYTES", "/abiDescriptor", "Verified ABI byte encoding is noncanonical");
  const expected = preflight.manifest.abiDescriptor.sha256;
  const actual = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) fail("V3_ABI_BYTES", "/abiDescriptor/sha256", "Verified ABI bytes do not match the manifest source hash");
  return bytes;
}

function buildSimulationContent(preflight, resolved, abiHash) {
  const tree = resolved.lockTree;
  return deepFrozenClone({
    schemaVersion: 3,
    contentVersion: preflight.manifest.contentVersion,
    abiHash: abiHash,
    eventSchemaVersion: resolved.eventSchemaVersion,
    behaviorRegistryVersion: resolved.behaviorRegistryVersion,
    behaviorContracts: resolved.behaviorContracts,
    campaignRules: tree.campaignRules,
    defenses: tree.defenses,
    summons: tree.summons,
    enemies: tree.enemies,
    bosses: tree.bosses,
    missions: tree.missions,
    maps: tree.maps,
    eventCatalog: tree.eventCatalog,
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
  const isFileBacked = fileBackedPreflight(preflight);

  if (isFileBacked) {
    if (typeof preflight.sourceRoot !== "string" || typeof preflight.repositoryRoot !== "string") {
      fail(
        "V3_ASSET_ROOT",
        "/presentationCatalog/assetRecords",
        "File-backed v3 asset verification requires the source and repository root identities"
      );
    }
    if (injectedVerifier !== undefined) {
      fail(
        "V3_ASSET_VERIFIER",
        "/presentationCatalog/assetRecords",
        "File-backed v3 compilation cannot replace repository asset inspection"
      );
    }
    const expectedRoot = path.resolve(preflight.repositoryRoot, "games", "aegis");
    if (typeof assetRoot !== "string" || path.resolve(assetRoot) !== expectedRoot) {
      fail(
        "V3_ASSET_ROOT",
        "/presentationCatalog/assetRecords",
        "File-backed v3 compilation requires the canonical games/aegis repository asset root"
      );
    }
  } else if (assetRoot === undefined && typeof injectedVerifier !== "function") {
    fail(
      "V3_ASSET_VERIFIER",
      "/presentationCatalog/assetRecords",
      "Synthetic schema-v2 compilation requires an explicit asset root or measured-claim verifier"
    );
  }
  if (assetRoot !== undefined && injectedVerifier !== undefined) {
    fail(
      "V3_ASSET_VERIFIER",
      "/presentationCatalog/assetRecords",
      "Choose repository asset inspection or the synthetic verifier, never both"
    );
  }

  const inspections = presentation.assetRecords.map(function (claim, index) {
    const diagnosticPath = "/presentationCatalog/assetRecords/" + index;
    if (assetRoot !== undefined) {
      return AssetInspector.inspectManifestClaim(assetRoot, claim, {
        diagnosticPath: diagnosticPath,
      });
    }
    const measured = injectedVerifier(claim, diagnosticPath);
    return AssetInspector.compareManifestClaim(claim, measured, diagnosticPath);
  });
  return Object.freeze(inspections.slice());
}

// Production callers must pass the direct immutable loadSourceTree result
// returned by the strict v3 source loader. Synthetic object graphs are
// accepted only so isolated compiler tests can exercise post-loader contracts.
function compileVerifiedV3Source(preflight, options) {
  options = options || {};
  if (!preflight || !preflight.manifest || preflight.manifest.schemaVersion !== 3) {
    fail("V3_COMPILER_SCHEMA", "/schemaVersion", "Complete v3 compilation accepts only a verified schema-3 source preflight");
  }
  if (options.simulationBytes === undefined) {
    fail("SIMULATION_REQUIRED", "/simulation", "Complete v3 compilation requires explicit immutable simulation bytes");
  }
  const abiBytes = exactAbiBytes(preflight);
  const abiHash = "sha256:" + crypto.createHash("sha256").update(abiBytes).digest("hex");
  const resolved = CrossReferences.resolveV3Graph(preflight, {
    normalizeAndValidateMap: options.normalizeAndValidateMap,
    validatePendingPreviewProofs: options.validatePendingPreviewProofs,
  });
  const lockCoverage = Annex.validateLockCoverage(preflight.annex, resolved.lockTree, {
    semanticArrayPaths: resolved.semanticArrayPaths,
    annexContext: {
      manifestAnnexId: preflight.manifest.annex.id,
      approvalState: preflight.manifest.approvalState,
    },
  });
  const content = buildSimulationContent(preflight, resolved, abiHash);
  const presentation = Presentation.buildPresentationCompanion({
    approvalState: preflight.manifest.approvalState,
    contentVersion: preflight.manifest.contentVersion,
    missions: preflight.normalizedSource.missions.map(function (record) { return record.definition; }),
    eventCatalog: preflight.normalizedSource.eventCatalog,
    stringCatalog: preflight.normalizedSource.stringCatalog,
    presentationCatalog: preflight.normalizedSource.presentationCatalog,
  });
  verifyPresentationAssetClaims(preflight, presentation, options);
  const provenance = Provenance.buildV3Provenance(preflight);
  const includedIds = deepFrozenClone({
    missions: Object.keys(resolved.lockTree.missions).sort(),
    defenses: Object.keys(resolved.lockTree.defenses).sort(),
    enemies: Object.keys(resolved.lockTree.enemies).sort(),
    bosses: Object.keys(resolved.lockTree.bosses).sort(),
  });
  const artifacts = Artifacts.buildV3Artifacts({
    schemaVersion: 3,
    abi: preflight.normalizedSource.abiDescriptor,
    abiBytes: abiBytes,
    simulationBytes: Buffer.from(options.simulationBytes),
    simulationLabel: options.simulationLabel || "explicit v3 simulation bytes",
    contentVersion: preflight.manifest.contentVersion,
    approvalState: preflight.manifest.approvalState,
    annexHash: preflight.manifest.annex.sha256,
    sourceManifestHash: provenance.sourceManifestHash,
    sourceProvenance: provenance.sourceProvenance,
    includedIds: includedIds,
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
  buildSimulationContent: buildSimulationContent,
  compileVerifiedV3Source: compileVerifiedV3Source,
  verifyPresentationAssetClaims: verifyPresentationAssetClaims,
});
