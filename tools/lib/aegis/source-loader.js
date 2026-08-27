"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fail } = require("./diagnostics.js");
const { parseStrictJsonBytes } = require("./strict-json.js");
const { validateMissionMap } = require("./map-validation.js");
const { preflightV3SourceTree } = require("./v3-source-loader.js");
const {
  validateSourceManifest,
  validateBehaviorContracts,
  validateAbiDescriptor,
} = require("./contracts.js");

function readBytes(filePath, diagnosticPath) {
  try { return fs.readFileSync(filePath); }
  catch (error) { fail("SOURCE_READ", diagnosticPath, "Cannot read " + path.basename(filePath) + ": " + String(error && error.code || error)); }
}

function resolveReference(root, reference, diagnosticPath) {
  if (typeof reference !== "string" || !reference || reference.indexOf("\\") !== -1 || path.isAbsolute(reference)) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Source references must be nonempty relative POSIX paths");
  }
  const segments = reference.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
  })) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Source references must use portable path segments without aliases or alternate streams");
  }
  const normalized = path.posix.normalize(reference);
  if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Source reference escapes the content root");
  }
  const resolved = path.resolve(root, normalized.split("/").join(path.sep));
  const relative = path.relative(path.resolve(root), resolved);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Source reference escapes the content root");
  }
  let realRoot;
  let realResolved;
  try {
    realRoot = fs.realpathSync(root);
    realResolved = fs.realpathSync(resolved);
    if (!fs.statSync(realResolved).isFile()) throw new Error("not a regular file");
  } catch (error) {
    fail("SOURCE_READ", diagnosticPath, "Referenced source must be an existing regular file");
  }
  const realRelative = path.relative(realRoot, realResolved);
  if (realRelative === ".." || realRelative.startsWith(".." + path.sep) || path.isAbsolute(realRelative)) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Source reference resolves outside the content root");
  }
  return realResolved;
}

function readJson(filePath, label) {
  return parseStrictJsonBytes(readBytes(filePath, "/"), label || path.basename(filePath));
}

function selectManifest(root, manifestPath) {
  if (manifestPath === undefined) {
    return Object.freeze({
      source: "schema-version.json",
      path: resolveReference(root, "schema-version.json", "/"),
    });
  }
  if (typeof manifestPath !== "string" || !manifestPath) {
    fail("SOURCE_REFERENCE", "/manifest", "Alternate manifest path must be a nonempty path string");
  }
  const selected = path.resolve(manifestPath);
  const relative = path.relative(path.resolve(root), selected);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    fail("SOURCE_REFERENCE", "/manifest", "Alternate manifest must stay inside the content source root");
  }
  const source = relative.split(path.sep).join("/");
  return Object.freeze({
    source: source,
    path: resolveReference(root, source, "/manifest"),
  });
}

function loadMissionMaps(root, manifest) {
  if (manifest.schemaVersion === 1) {
    return Object.freeze({
      records: Object.freeze([]),
      paths: Object.freeze([]),
    });
  }
  const resolvedIdentities = new Set();
  const paths = [];
  const records = manifest.missionMaps.map(function (reference, index) {
    const basePath = "/missionMaps/" + index;
    const resolved = resolveReference(root, reference.source, basePath + "/source");
    const identity = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (resolvedIdentities.has(identity)) {
      fail("SOURCE_DUPLICATE_REALPATH", basePath + "/source", "Mission sources must resolve to unique regular files");
    }
    resolvedIdentities.add(identity);
    const parsed = readJson(resolved, reference.source);
    if (!parsed || parsed.id !== reference.id) {
      fail("MAP_MANIFEST_ID", basePath + "/id", "Manifest mission ID must exactly match the referenced map ID");
    }
    const compiled = validateMissionMap(parsed);
    if (compiled.approvalEligible !== true || compiled.sourceKind !== "campaign") {
      fail("MAP_MANIFEST_APPROVAL", basePath + "/source", "Manifest mission map must be campaign approval eligible");
    }
    paths.push(resolved);
    return Object.freeze({
      id: reference.id,
      source: reference.source,
      compiled: compiled,
    });
  });
  return Object.freeze({
    records: Object.freeze(records),
    paths: Object.freeze(paths),
  });
}

function loadSourceTree(sourceRoot, options) {
  if (typeof sourceRoot !== "string" || !sourceRoot) fail("SOURCE_READ", "/", "Content source root is required");
  options = options || {};
  let root;
  try {
    root = fs.realpathSync(path.resolve(sourceRoot));
    if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
  } catch (error) {
    fail("SOURCE_READ", "/", "Content source root must be an existing directory");
  }
  const selectedManifest = selectManifest(root, options.manifestPath);
  const parsedManifest = readJson(selectedManifest.path, selectedManifest.source);
  if (parsedManifest && parsedManifest.schemaVersion === 3) {
    return preflightV3SourceTree({
      sourceRoot: root,
      repositoryRoot: options.repositoryRoot === undefined ? root : options.repositoryRoot,
      manifestSource: selectedManifest.source,
    });
  }
  const manifestPath = selectedManifest.path;
  const manifest = validateSourceManifest(parsedManifest);
  const abiPath = resolveReference(root, manifest.abiDescriptor, "/abiDescriptor");
  const behaviorPath = resolveReference(root, manifest.behaviorContracts, "/behaviorContracts");
  const abi = validateAbiDescriptor(readJson(abiPath, manifest.abiDescriptor));
  const behaviorContracts = validateBehaviorContracts(
    readJson(behaviorPath, manifest.behaviorContracts),
    abi.behaviorRegistry.contracts
  );
  const missionMaps = loadMissionMaps(root, manifest);
  return Object.freeze({
    sourceRoot: root,
    manifest: manifest,
    abi: abi,
    behaviorContracts: behaviorContracts,
    missionMaps: missionMaps.records,
    paths: Object.freeze({
      manifest: manifestPath,
      abi: abiPath,
      behaviors: behaviorPath,
      missionMaps: missionMaps.paths,
    }),
  });
}

module.exports = Object.freeze({
  readBytes: readBytes,
  readJson: readJson,
  resolveReference: resolveReference,
  selectManifest: selectManifest,
  loadMissionMaps: loadMissionMaps,
  loadSourceTree: loadSourceTree,
});
