"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { AegisContentError, diagnostic, fail } = require("./diagnostics.js");
const { loadSourceTree } = require("./source-loader.js");
const { buildArtifacts } = require("./artifacts.js");

const ARTIFACT_NAME = /^(aegis-sim|aegis-content|manifest)\.([0-9a-f]{64})\.(js|json)$/;

function readSimulation(input) {
  if (input.simulationBytes !== undefined) return Buffer.from(input.simulationBytes);
  if (!input.simulationPath) {
    fail("SIMULATION_REQUIRED", "/simulation", "Provide explicit simulationBytes or simulationPath at the compiler integration seam");
  }
  try { return fs.readFileSync(input.simulationPath); }
  catch (error) { fail("SIMULATION_READ", "/simulation", "Cannot read simulation artifact: " + String(error && error.code || error)); }
}

function compileSourceTree(input) {
  const source = loadSourceTree(input.sourceRoot);
  const simulationBytes = readSimulation(input);
  const missionIds = source.manifest.schemaVersion === 1
    ? source.manifest.missionIds.slice()
    : source.missionMaps.map(function (mission) { return mission.id; });
  const artifacts = buildArtifacts({
    abi: source.abi,
    behaviorContracts: source.behaviorContracts,
    simulationBytes: simulationBytes,
    simulationLabel: input.simulationPath ? path.basename(input.simulationPath) : "explicit simulation bytes",
    contentVersion: source.manifest.contentVersion,
    missionIds: missionIds,
    missionMaps: source.manifest.schemaVersion === 2 ? source.missionMaps : undefined,
    schemaVersion: source.manifest.schemaVersion,
    sourceKind: source.manifest.sourceKind,
  });
  return Object.freeze({ source: source, artifacts: artifacts });
}

function outputDirectory(result, override) {
  return path.resolve(override || path.join(result.source.sourceRoot, "generated"));
}

function artifactEntries(result) {
  const outputs = result && result.artifacts && result.artifacts.outputs;
  if (!outputs || typeof outputs[Symbol.iterator] !== "function") {
    fail("ARTIFACT_SET", "/generated", "Compiler result does not contain an iterable artifact set");
  }
  const entries = [];
  const kinds = new Set();
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
  }
  if (entries.length !== 3 || !kinds.has("aegis-sim") || !kinds.has("aegis-content") || !kinds.has("manifest")) {
    fail("ARTIFACT_SET", "/generated", "Artifact set must contain exactly one simulation, content, and manifest artifact");
  }
  entries.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
  return entries;
}

function checkArtifacts(result, override) {
  const directory = outputDirectory(result, override);
  const diagnostics = [];
  const entries = artifactEntries(result);
  const names = entries.map(function (entry) { return entry[0]; });
  const expectedNames = new Set(names);
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
  if (diagnostics.length) throw new AegisContentError(diagnostics);
  return names;
}

function writeArtifacts(result, override) {
  const directory = outputDirectory(result, override);
  fs.mkdirSync(directory, { recursive: true });
  const entries = artifactEntries(result);
  const names = entries.map(function (entry) { return entry[0]; });
  for (const entry of entries) {
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
  checkArtifacts: checkArtifacts,
  writeArtifacts: writeArtifacts,
  executeBuild: executeBuild,
});
