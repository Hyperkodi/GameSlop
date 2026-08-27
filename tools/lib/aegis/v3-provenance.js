"use strict";

const crypto = require("node:crypto");
const { canonicalBytes } = require("./canonical.js");
const { fail, pointerJoin } = require("./diagnostics.js");
const { validateRepositoryPath } = require("./v3-annex.js");

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(cloneAndFreeze));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = cloneAndFreeze(value[key]); });
  return Object.freeze(output);
}

function sha256Reference(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateRecord(record, diagnosticPath) {
  if (!isPlainRecord(record)) fail("PROVENANCE_RECORD", diagnosticPath, "Source provenance entries must be plain objects");
  const keys = Object.keys(record).sort(compareAscii);
  const expected = ["id", "kind", "sha256", "source"];
  if (keys.length !== expected.length || keys.some(function (key, index) { return key !== expected[index]; })) {
    fail("PROVENANCE_RECORD", diagnosticPath, "Source provenance entries contain exactly kind, id, source, and sha256");
  }
  if (typeof record.kind !== "string" || !STABLE_ID.test(record.kind)) {
    fail("PROVENANCE_KIND", pointerJoin(diagnosticPath, "kind"), "Provenance kind must be a stable ASCII ID");
  }
  if (typeof record.id !== "string" || !STABLE_ID.test(record.id)) {
    fail("PROVENANCE_ID", pointerJoin(diagnosticPath, "id"), "Provenance id must be a stable ASCII ID");
  }
  validateRepositoryPath(record.source, pointerJoin(diagnosticPath, "source"));
  if (typeof record.sha256 !== "string" || !SHA256.test(record.sha256)) {
    fail("PROVENANCE_HASH", pointerJoin(diagnosticPath, "sha256"), "Provenance hash must be a lowercase SHA-256 reference");
  }
  return {
    kind: record.kind,
    id: record.id,
    source: record.source,
    sha256: record.sha256,
  };
}

function buildV3Provenance(preflight) {
  if (!isPlainRecord(preflight)) fail("PROVENANCE_INPUT", "/", "V3 provenance requires the verified preflight result");
  if (!preflight.manifest || preflight.manifest.schemaVersion !== 3) {
    fail("PROVENANCE_SCHEMA", "/schemaVersion", "V3 provenance accepts only source schema 3");
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
    return validateRecord(record, "/sourceProvenance/" + index);
  });
  records.sort(function (left, right) {
    return compareAscii(left.kind, right.kind) || compareAscii(left.id, right.id);
  });
  const seen = new Set();
  records.forEach(function (record, index) {
    const key = record.kind + "\u0000" + record.id;
    if (seen.has(key)) fail("PROVENANCE_DUPLICATE", "/sourceProvenance/" + index, "Provenance kind/id pairs must be unique");
    seen.add(key);
  });
  const sourceProvenance = cloneAndFreeze(records);
  const bytes = canonicalBytes(sourceProvenance);
  const result = {
    sourceManifestHash: preflight.manifestHash,
    sourceProvenance: sourceProvenance,
    provenanceHash: sha256Reference(bytes),
  };
  Object.defineProperty(result, "provenanceBytes", {
    enumerable: true,
    get: function () { return Buffer.from(bytes); },
  });
  return Object.freeze(result);
}

module.exports = Object.freeze({
  buildV3Provenance: buildV3Provenance,
  sha256Reference: sha256Reference,
});
