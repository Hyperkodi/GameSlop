"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { AegisContentError, diagnostic, fail } = require("./diagnostics.js");
const { canonicalBytes, canonicalEncode } = require("./canonical.js");
const { parseStrictJsonBytes } = require("./strict-json.js");
const SourceLoader = require("./source-loader.js");
const { loadSourceTree } = SourceLoader;
const { buildArtifacts } = require("./artifacts.js");
const V3Compiler = require("./v3-compiler.js");
const V3Artifacts = require("./v3-artifacts.js");
const V3MapAdapter = require("./v3-map-adapter.js");
const V4Compiler = require("./v4-compiler.js");
const V4Artifacts = require("./v4-artifacts.js");
const V4SourceLoader = require("./v4-source-loader.js");

const ARTIFACT_NAME = /^(aegis-sim|aegis-content|aegis-presentation|aegis-release|manifest)\.([0-9a-f]{64})\.(js|json)$/;
const RELEASE_ALIAS_NAME = /^release\.([a-z0-9][a-z0-9-]*)\.(js|json)$/;
const RELEASE_ALIAS_FIELDS = Object.freeze([
  "approvalState", "contentVersion", "id", "releaseArtifact", "releaseEligible",
  "releaseHash", "schemaVersion",
]);

function readSimulation(input) {
  if (input.simulationBytes !== undefined) return Buffer.from(input.simulationBytes);
  if (!input.simulationPath) {
    fail("SIMULATION_REQUIRED", "/simulation", "Provide explicit simulationBytes or simulationPath at the compiler integration seam");
  }
  try { return fs.readFileSync(input.simulationPath); }
  catch (error) { fail("SIMULATION_READ", "/simulation", "Cannot read simulation artifact: " + String(error && error.code || error)); }
}

// The schema-4 branch cannot reuse the v1-v3 loader dispatcher: it authenticates a different
// manifest field set. Peek at the declared version, then hand a schema-4 tree to its own loader.
function declaredSourceSchemaVersion(input) {
  if (typeof input.sourceRoot !== "string" || !input.sourceRoot) return null;
  let root;
  try {
    root = fs.realpathSync(path.resolve(input.sourceRoot));
    if (!fs.statSync(root).isDirectory()) return null;
  } catch (error) { return null; }
  let parsed;
  try {
    const selected = SourceLoader.selectManifest(root, input.manifestPath);
    parsed = SourceLoader.readJson(selected.path, selected.source);
  } catch (error) { return null; }
  return parsed && parsed.schemaVersion === 4 ? 4 : null;
}

function compileSourceTree(input) {
  const simulationBytesForV4 = declaredSourceSchemaVersion(input) === 4 ? readSimulation(input) : null;
  if (simulationBytesForV4 !== null) {
    const v4Source = V4SourceLoader.preflightV4SourceTree({
      sourceRoot: input.sourceRoot,
      repositoryRoot: input.repositoryRoot,
      manifestSource: input.manifestPath === undefined
        ? undefined
        : path.relative(fs.realpathSync(path.resolve(input.sourceRoot)), path.resolve(input.manifestPath))
          .split(path.sep).join("/"),
    });
    return V4Compiler.compileVerifiedV4Source(v4Source, {
      assetRoot: path.join(v4Source.repositoryRoot, "games", "aegis"),
      simulationBytes: simulationBytesForV4,
      simulationLabel: input.simulationPath ? path.basename(input.simulationPath) : "explicit simulation bytes",
      normalizeAndValidateMap: V3MapAdapter.normalizeAndValidateMap,
    });
  }
  const source = loadSourceTree(input.sourceRoot, {
    manifestPath: input.manifestPath,
    repositoryRoot: input.repositoryRoot,
  });
  const simulationBytes = readSimulation(input);
  const simulationLabel = input.simulationPath ? path.basename(input.simulationPath) : "explicit simulation bytes";
  if (source.manifest.schemaVersion === 3) {
    const repositoryAssetRoot = path.join(source.repositoryRoot, "games", "aegis");
    return V3Compiler.compileVerifiedV3Source(source, {
      assetRoot: repositoryAssetRoot,
      simulationBytes: simulationBytes,
      simulationLabel: simulationLabel,
      normalizeAndValidateMap: V3MapAdapter.normalizeAndValidateMap,
    });
  }
  const missionIds = source.manifest.schemaVersion === 1
    ? source.manifest.missionIds.slice()
    : source.missionMaps.map(function (mission) { return mission.id; });
  const artifacts = buildArtifacts({
    abi: source.abi,
    behaviorContracts: source.behaviorContracts,
    simulationBytes: simulationBytes,
    simulationLabel: simulationLabel,
    contentVersion: source.manifest.contentVersion,
    missionIds: missionIds,
    missionMaps: source.manifest.schemaVersion === 2 ? source.missionMaps : undefined,
    schemaVersion: source.manifest.schemaVersion,
    sourceKind: source.manifest.sourceKind,
  });
  return Object.freeze({ source: source, artifacts: artifacts });
}

function outputDirectory(result, override) {
  if (override) return path.resolve(override);
  const schemaVersion = result && result.source && result.source.manifest && result.source.manifest.schemaVersion;
  if (schemaVersion === 4) {
    // Schema-4 artifacts join the one committed generated directory the release selector's
    // artifact-root allow-list already covers; the alias name keeps them separate.
    return path.resolve(path.join(result.source.repositoryRoot, "games", "aegis", "content", "generated"));
  }
  return path.resolve(path.join(result.source.sourceRoot, "generated"));
}

function artifactEntries(result) {
  const outputs = result && result.artifacts && result.artifacts.outputs;
  if (!outputs || typeof outputs[Symbol.iterator] !== "function") {
    fail("ARTIFACT_SET", "/generated", "Compiler result does not contain an iterable artifact set");
  }
  const entries = [];
  const kinds = new Set();
  const entriesByKind = new Map();
  for (const entry of outputs) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") {
      fail("ARTIFACT_SET", "/generated", "Artifact entries must be [name, bytes] pairs");
    }
    const name = entry[0];
    const match = ARTIFACT_NAME.exec(name);
    if (!match || (match[1] === "manifest") !== (match[3] === "json")) {
      fail("ARTIFACT_NAME", "/generated/" + name, "Artifact filename is not an immutable Aegis artifact name");
    }
    if (kinds.has(match[1])) fail("ARTIFACT_SET", "/generated", "Artifact set contains duplicate " + match[1] + " entries");
    kinds.add(match[1]);
    let bytes;
    try { bytes = Buffer.from(entry[1]); }
    catch (error) { fail("ARTIFACT_BYTES", "/generated/" + name, "Artifact bytes are invalid"); }
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    if (digest !== match[2]) {
      fail("ARTIFACT_IDENTITY", "/generated/" + name, "Artifact bytes do not match the immutable filename digest");
    }
    entries.push([name, bytes]);
    entriesByKind.set(match[1], [name, bytes]);
  }
  const schemaVersion = result && result.source && result.source.manifest && result.source.manifest.schemaVersion;
  const expectedKinds = (schemaVersion === 3 || schemaVersion === 4)
    ? ["aegis-content", "aegis-presentation", "aegis-release", "aegis-sim", "manifest"]
    : (schemaVersion === 1 || schemaVersion === 2
      ? ["aegis-content", "aegis-sim", "manifest"]
      : null);
  if (!expectedKinds || entries.length !== expectedKinds.length ||
      expectedKinds.some(function (kind) { return !kinds.has(kind); })) {
    fail(
      "ARTIFACT_SET",
      "/generated",
      (schemaVersion === 3 || schemaVersion === 4)
        ? "Schema " + schemaVersion + " artifact set must contain exactly one simulation, content, presentation, release, and manifest artifact"
        : "Artifact set must contain exactly one simulation, content, and manifest artifact"
    );
  }
  if (schemaVersion === 4) {
    const releaseEntry = entriesByKind.get("aegis-release");
    const manifestEntry = entriesByKind.get("manifest");
    const verified = V4Artifacts.verifyV4ReleaseSelection({
      pinnedReleaseName: releaseEntry[0],
      releaseName: releaseEntry[0],
      releaseBytes: releaseEntry[1],
      manifestBytes: manifestEntry[1],
      artifacts: new Map(entries),
    });
    if (
      result.artifacts.releaseName !== releaseEntry[0] ||
      result.artifacts.manifestName !== manifestEntry[0] ||
      result.artifacts.rulesetHash !== verified.release.rulesetHash ||
      result.source.manifestHash !== verified.release.sourceManifestHash
    ) {
      fail("ARTIFACT_SET", "/generated", "Schema 4 artifact metadata must bind the exact verified release selection");
    }
  }
  if (schemaVersion === 3) {
    const releaseEntry = entriesByKind.get("aegis-release");
    const manifestEntry = entriesByKind.get("manifest");
    const verified = V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: releaseEntry[0],
      releaseName: releaseEntry[0],
      releaseBytes: releaseEntry[1],
      manifestBytes: manifestEntry[1],
      artifacts: new Map(entries),
    });
    if (
      result.artifacts.releaseName !== releaseEntry[0] ||
      result.artifacts.manifestName !== manifestEntry[0] ||
      result.artifacts.rulesetHash !== verified.release.rulesetHash ||
      result.source.manifestHash !== verified.release.sourceManifestHash
    ) {
      fail("ARTIFACT_SET", "/generated", "Schema 3 artifact metadata must bind the exact verified release selection");
    }
  }
  entries.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
  return entries;
}

function validateReleaseAliasRecord(alias, expectedId) {
  const prototype = alias && typeof alias === "object" ? Object.getPrototypeOf(alias) : undefined;
  if (!alias || typeof alias !== "object" || Array.isArray(alias) ||
      (prototype !== Object.prototype && prototype !== null) ||
      canonicalEncode(Object.keys(alias).sort()) !== canonicalEncode(RELEASE_ALIAS_FIELDS.slice().sort())) {
    fail("RELEASE_ALIAS", "/generated/releaseAlias", "Release alias must contain exactly the approved data fields");
  }
  if (alias.schemaVersion !== 1 || typeof alias.id !== "string" ||
      !/^[a-z0-9][a-z0-9-]*$/.test(alias.id) || alias.contentVersion !== alias.id ||
      (expectedId !== undefined && alias.id !== expectedId)) {
    fail("RELEASE_ALIAS", "/generated/releaseAlias/id", "Release alias identity is invalid");
  }
  if (["candidate-balance", "balance-approved"].indexOf(alias.approvalState) === -1 ||
      alias.releaseEligible !== false) {
    fail("RELEASE_ALIAS", "/generated/releaseAlias/approvalState", "Release alias must remain developer-only");
  }
  const artifact = typeof alias.releaseArtifact === "string"
    ? /^aegis-release\.([0-9a-f]{64})\.js$/.exec(alias.releaseArtifact)
    : null;
  if (!artifact || alias.releaseHash !== "sha256:" + artifact[1]) {
    fail("RELEASE_ALIAS", "/generated/releaseAlias/releaseHash", "Release alias filename and hash identity differ");
  }
  return alias;
}

function releaseAliasEntries(result, verifiedArtifactEntries) {
  const schemaVersion = result && result.source && result.source.manifest &&
    result.source.manifest.schemaVersion;
  if (schemaVersion !== 3 && schemaVersion !== 4) return [];
  const entries = verifiedArtifactEntries || artifactEntries(result);
  const releaseEntry = entries.find(function (entry) {
    return entry[0].startsWith("aegis-release.");
  });
  if (!releaseEntry) {
    fail("RELEASE_ALIAS", "/generated", "Schema " + schemaVersion + " alias requires an immutable release artifact");
  }
  const release = V3Artifacts.readGeneratedData(
    releaseEntry[1], "AegisRelease", "RELEASE", releaseEntry[0]
  );
  if (schemaVersion === 4) V4Artifacts.validateV4ReleaseRecord(release);
  else V3Artifacts.validateReleaseRecord(release);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(release.contentVersion)) {
    fail("RELEASE_ALIAS", "/generated/contentVersion", "Release alias contentVersion is not filename-safe");
  }
  if (["candidate-balance", "balance-approved"].indexOf(release.approvalState) === -1 ||
      release.releaseEligible !== false) {
    fail("RELEASE_ALIAS", "/generated/approvalState", "Developer release aliases require a non-production approval state");
  }
  const match = /^aegis-release\.([0-9a-f]{64})\.js$/.exec(releaseEntry[0]);
  if (!match) fail("RELEASE_ALIAS", "/generated/releaseArtifact", "Release alias target must be immutable");
  const alias = Object.freeze({
    schemaVersion: 1,
    id: release.contentVersion,
    contentVersion: release.contentVersion,
    approvalState: release.approvalState,
    releaseEligible: false,
    releaseArtifact: releaseEntry[0],
    releaseHash: "sha256:" + match[1],
  });
  validateReleaseAliasRecord(alias, release.contentVersion);
  const jsonBytes = Buffer.concat([canonicalBytes(alias), Buffer.from("\n", "utf8")]);
  const jsBytes = V3Artifacts.renderDataArtifact(
    "AegisReleaseAlias", "RELEASE_ALIAS", alias, "stable developer release alias"
  );
  return [
    ["release." + release.contentVersion + ".js", jsBytes],
    ["release." + release.contentVersion + ".json", jsonBytes],
  ];
}

function verifyHistoricalReleaseAlias(directory, id) {
  const jsonName = "release." + id + ".json";
  const jsName = "release." + id + ".js";
  let jsonBytes;
  let jsBytes;
  [jsonName, jsName].forEach(function (name) {
    let stat;
    try { stat = fs.lstatSync(path.join(directory, name)); }
    catch (error) { fail("RELEASE_ALIAS", "/generated/" + name, "Historical release alias pair is incomplete"); }
    if (!stat.isFile()) fail("ARTIFACT_TYPE", "/generated/" + name, "Historical release alias must be a regular file");
  });
  try {
    jsonBytes = fs.readFileSync(path.join(directory, jsonName));
    jsBytes = fs.readFileSync(path.join(directory, jsName));
  } catch (error) {
    fail("ARTIFACT_READ", "/generated/release." + id, "Cannot read historical release alias pair");
  }
  let alias;
  try {
    alias = parseStrictJsonBytes(jsonBytes, jsonName, {
      maxDepth: 4, maxObjectFields: 8, rejectNegativeZero: true,
    });
  } catch (error) {
    fail("RELEASE_ALIAS", "/generated/" + jsonName, "Historical release alias JSON is invalid");
  }
  validateReleaseAliasRecord(alias, id);
  const expectedJson = Buffer.concat([canonicalBytes(alias), Buffer.from("\n", "utf8")]);
  const expectedJs = V3Artifacts.renderDataArtifact(
    "AegisReleaseAlias", "RELEASE_ALIAS", alias, "stable developer release alias"
  );
  if (!jsonBytes.equals(expectedJson) || !jsBytes.equals(expectedJs)) {
    fail("ARTIFACT_STALE", "/generated/release." + id, "Historical release alias pair is not canonical");
  }
  const releaseTarget = path.join(directory, alias.releaseArtifact);
  let releaseType;
  let releaseBytes;
  try {
    releaseType = fs.lstatSync(releaseTarget);
    releaseBytes = fs.readFileSync(releaseTarget);
  } catch (error) {
    fail("RELEASE_ALIAS", "/generated/" + alias.releaseArtifact, "Historical release alias target is missing");
  }
  if (!releaseType.isFile() ||
      "sha256:" + crypto.createHash("sha256").update(releaseBytes).digest("hex") !== alias.releaseHash) {
    fail("RELEASE_ALIAS", "/generated/" + alias.releaseArtifact, "Historical release alias target identity is invalid");
  }
}

function expectedOutputEntries(result) {
  const immutable = artifactEntries(result);
  return immutable.concat(releaseAliasEntries(result, immutable)).sort(function (a, b) {
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
  });
}

function checkArtifacts(result, override) {
  const directory = outputDirectory(result, override);
  const diagnostics = [];
  const entries = expectedOutputEntries(result);
  const names = entries.map(function (entry) { return entry[0]; });
  const expectedNames = new Set(names);
  const historicalAliasIds = new Set();
  for (const entry of entries) {
    const name = entry[0];
    const expected = entry[1];
    const target = path.join(directory, name);
    let targetType;
    try { targetType = fs.lstatSync(target); }
    catch (error) {
      if (error && error.code === "ENOENT") {
        diagnostics.push(diagnostic("ARTIFACT_MISSING", "/generated/" + name, "Expected generated artifact is missing"));
        continue;
      }
      diagnostics.push(diagnostic("ARTIFACT_READ", "/generated/" + name, "Cannot inspect generated artifact"));
      continue;
    }
    if (!targetType.isFile()) {
      diagnostics.push(diagnostic("ARTIFACT_TYPE", "/generated/" + name, "Expected generated artifact must be a regular file, not a link or special entry"));
      continue;
    }
    let actual;
    try { actual = fs.readFileSync(target); }
    catch (error) {
      diagnostics.push(diagnostic("ARTIFACT_READ", "/generated/" + name, "Cannot read generated artifact"));
      continue;
    }
    if (!actual.equals(expected)) {
      diagnostics.push(diagnostic("ARTIFACT_STALE", "/generated/" + name, "Generated artifact differs from deterministic compiler output"));
    }
  }
  let directoryEntries = [];
  try {
    directoryEntries = fs.readdirSync(directory, { withFileTypes: true }).sort(function (a, b) {
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      diagnostics.push(diagnostic("ARTIFACT_READ", "/generated", "Cannot inspect generated artifact directory"));
    }
  }
  for (const directoryEntry of directoryEntries) {
    const name = directoryEntry.name;
    if (expectedNames.has(name)) continue;
    const aliasMatch = RELEASE_ALIAS_NAME.exec(name);
    if (aliasMatch) {
      historicalAliasIds.add(aliasMatch[1]);
      continue;
    }
    const match = ARTIFACT_NAME.exec(name);
    if (!directoryEntry.isFile() || !match || (match[1] === "manifest") !== (match[3] === "json")) {
      diagnostics.push(diagnostic("ARTIFACT_UNEXPECTED", "/generated/" + name, "Unexpected mutable or non-artifact entry in generated directory"));
      continue;
    }
    let bytes;
    try { bytes = fs.readFileSync(path.join(directory, name)); }
    catch (error) {
      diagnostics.push(diagnostic("ARTIFACT_READ", "/generated/" + name, "Cannot read historical immutable artifact"));
      continue;
    }
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    if (digest !== match[2]) {
      diagnostics.push(diagnostic("ARTIFACT_IDENTITY", "/generated/" + name, "Historical artifact bytes do not match the immutable filename digest"));
    }
  }
  historicalAliasIds.forEach(function (id) {
    try { verifyHistoricalReleaseAlias(directory, id); }
    catch (error) {
      if (error instanceof AegisContentError) diagnostics.push.apply(diagnostics, error.diagnostics);
      else diagnostics.push(diagnostic("RELEASE_ALIAS", "/generated/release." + id, String(error)));
    }
  });
  if (diagnostics.length) throw new AegisContentError(diagnostics);
  return names;
}

function writeArtifacts(result, override) {
  const immutableEntries = artifactEntries(result);
  const aliasEntries = releaseAliasEntries(result, immutableEntries);
  const entries = immutableEntries.concat(aliasEntries).sort(function (a, b) {
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0);
  });
  const directory = outputDirectory(result, override);
  fs.mkdirSync(directory, { recursive: true });
  const names = entries.map(function (entry) { return entry[0]; });
  for (const entry of immutableEntries) {
    const name = entry[0];
    const bytes = entry[1];
    const target = path.join(directory, name);
    let targetType = null;
    try { targetType = fs.lstatSync(target); }
    catch (error) {
      if (!error || error.code !== "ENOENT") {
        fail("ARTIFACT_WRITE", "/generated/" + name, "Cannot inspect generated artifact target");
      }
    }
    if (targetType !== null) {
      if (!targetType.isFile()) {
        fail("ARTIFACT_COLLISION", "/generated/" + name, "Immutable artifact target must be a regular file, not a link or special entry");
      }
      const current = fs.readFileSync(target);
      if (!current.equals(bytes)) {
        fail("ARTIFACT_COLLISION", "/generated/" + name, "Immutable artifact filename already exists with different bytes");
      }
      continue;
    }
    try { fs.writeFileSync(target, bytes, { flag: "wx" }); }
    catch (error) { fail("ARTIFACT_WRITE", "/generated/" + name, "Cannot write generated artifact: " + String(error && error.code || error)); }
  }
  aliasEntries.forEach(function (entry, index) {
    const name = entry[0];
    if (!RELEASE_ALIAS_NAME.test(name)) {
      fail("RELEASE_ALIAS", "/generated/" + name, "Stable release alias filename is invalid");
    }
    const target = path.join(directory, name);
    let targetType = null;
    try { targetType = fs.lstatSync(target); }
    catch (error) {
      if (!error || error.code !== "ENOENT") {
        fail("ARTIFACT_WRITE", "/generated/" + name, "Cannot inspect stable release alias target");
      }
    }
    if (targetType !== null && !targetType.isFile()) {
      fail("ARTIFACT_COLLISION", "/generated/" + name, "Stable release alias target must be a regular file");
    }
    const temporary = path.join(directory, "." + name + "." + process.pid + "." + index + ".tmp");
    try {
      fs.writeFileSync(temporary, entry[1], { flag: "wx" });
      fs.renameSync(temporary, target);
    } catch (error) {
      try { fs.unlinkSync(temporary); } catch (_cleanupError) {}
      fail("ARTIFACT_WRITE", "/generated/" + name, "Cannot atomically write stable release alias: " + String(error && error.code || error));
    }
  });
  return names;
}

function executeBuild(input) {
  if (input.mode !== "check" && input.mode !== "write") fail("CLI_MODE", "/", "Build mode must be check or write");
  const result = compileSourceTree(input);
  const files = input.mode === "check"
    ? checkArtifacts(result, input.outputRoot)
    : writeArtifacts(result, input.outputRoot);
  return Object.freeze({
    files: Object.freeze(files.slice()),
    manifestName: result.artifacts.manifestName,
    rulesetHash: result.artifacts.rulesetHash,
    result: result,
  });
}

module.exports = Object.freeze({
  compileSourceTree: compileSourceTree,
  artifactEntries: artifactEntries,
  releaseAliasEntries: releaseAliasEntries,
  validateReleaseAliasRecord: validateReleaseAliasRecord,
  checkArtifacts: checkArtifacts,
  writeArtifacts: writeArtifacts,
  executeBuild: executeBuild,
});
