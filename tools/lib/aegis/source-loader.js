"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fail } = require("./diagnostics.js");
const { parseStrictJsonBytes } = require("./strict-json.js");
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

function loadSourceTree(sourceRoot) {
  if (typeof sourceRoot !== "string" || !sourceRoot) fail("SOURCE_READ", "/", "Content source root is required");
  let root;
  try {
    root = fs.realpathSync(path.resolve(sourceRoot));
    if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
  } catch (error) {
    fail("SOURCE_READ", "/", "Content source root must be an existing directory");
  }
  const manifestPath = resolveReference(root, "schema-version.json", "/");
  const manifest = validateSourceManifest(readJson(manifestPath, "schema-version.json"));
  const abiPath = resolveReference(root, manifest.abiDescriptor, "/abiDescriptor");
  const behaviorPath = resolveReference(root, manifest.behaviorContracts, "/behaviorContracts");
  const abi = validateAbiDescriptor(readJson(abiPath, manifest.abiDescriptor));
  const behaviorContracts = validateBehaviorContracts(
    readJson(behaviorPath, manifest.behaviorContracts),
    abi.behaviorRegistry.contracts
  );
  return Object.freeze({
    sourceRoot: root,
    manifest: manifest,
    abi: abi,
    behaviorContracts: behaviorContracts,
    paths: Object.freeze({ manifest: manifestPath, abi: abiPath, behaviors: behaviorPath }),
  });
}

module.exports = Object.freeze({
  readBytes: readBytes,
  readJson: readJson,
  resolveReference: resolveReference,
  loadSourceTree: loadSourceTree,
});
