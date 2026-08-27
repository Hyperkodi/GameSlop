"use strict";

const crypto = require("node:crypto");
const { canonicalBytes } = require("./canonical.js");
const { fail, pointerJoin } = require("./diagnostics.js");

const APPROVAL_STATES = Object.freeze([
  "candidate-balance",
  "balance-approved",
  "production-approved",
]);
const EVIDENCE_KINDS = Object.freeze(["balance-report", "witness-replay"]);
const LOCK_TREE_KEYS = Object.freeze([
  "schemaVersion",
  "campaignRules",
  "defenses",
  "summons",
  "enemies",
  "bosses",
  "missions",
  "maps",
  "eventCatalog",
]);
const ID_COLLECTION_KEYS = Object.freeze([
  "defenses",
  "summons",
  "enemies",
  "bosses",
  "missions",
  "maps",
  "eventCatalog",
]);
const PRESENTATION_ONLY_ROOTS = new Set([
  "annex",
  "approvalState",
  "localizedStrings",
  "presentationCatalog",
  "provenance",
  "sourceProvenance",
  "stringCatalog",
  "ui",
]);
const FORBIDDEN_LOCK_TREE_KEYS = new Set([
  "annex",
  "approvalState",
  "assetPath",
  "assetUrl",
  "authorityRecords",
  "bindingLocks",
  "candidateScopes",
  "evidenceRecords",
  "localizedStrings",
  "presentationCatalog",
  "presentationPackId",
  "provenance",
  "sourceProvenance",
  "spriteRect",
  "stringCatalog",
  "transferBytes",
  "ui",
]);
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_REFERENCE = /^sha256:[0-9a-f]{64}$/;
const MAX_POINTER_BYTES = 1024;
const MAX_ANNEX_RECORDS = 4096;

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

function requireRecord(value, diagnosticPath) {
  if (!isPlainRecord(value)) {
    fail("SCHEMA_OBJECT", diagnosticPath, "Expected a plain data object");
  }
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
    if (!allowed.has(key)) {
      fail("SCHEMA_UNKNOWN_KEY", pointerJoin(diagnosticPath, key), "Unknown key " + key);
    }
  });
  return value;
}

function requireArray(value, diagnosticPath, maximum) {
  if (!Array.isArray(value)) fail("SCHEMA_ARRAY", diagnosticPath, "Expected an array");
  if (value.length > maximum) {
    fail("SCHEMA_ARRAY_BOUND", diagnosticPath, "Array exceeds the maximum of " + maximum + " records");
  }
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

function validateRepositoryPath(value, diagnosticPath) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 512 ||
    !/^[\x21-\x7e]+$/.test(value) ||
    value.indexOf("\\") !== -1 ||
    value.indexOf("%") !== -1 ||
    value.indexOf(":") !== -1 ||
    value.startsWith("/")
  ) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Repository paths must be canonical relative portable POSIX paths");
  }
  const segments = value.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
  })) {
    fail("SOURCE_REFERENCE", diagnosticPath, "Repository paths cannot contain aliases or non-portable segments");
  }
  return value;
}

function validateCanonicalJsonPointer(value, diagnosticPath) {
  diagnosticPath = diagnosticPath || "/jsonPointer";
  if (typeof value !== "string") {
    fail("ANNEX_POINTER_FORMAT", diagnosticPath, "JSON pointer must be a string");
  }
  if (value === "") {
    fail("ANNEX_POINTER_ROOT", diagnosticPath, "The normalized lock-tree root pointer is forbidden");
  }
  if (
    Buffer.byteLength(value, "utf8") > MAX_POINTER_BYTES ||
    !/^[\x20-\x7e]+$/.test(value) ||
    value[0] !== "/"
  ) {
    fail("ANNEX_POINTER_FORMAT", diagnosticPath, "JSON pointer must be non-root canonical ASCII RFC 6901");
  }
  const rawTokens = value.slice(1).split("/");
  const decoded = rawTokens.map(function (token) {
    let output = "";
    for (let index = 0; index < token.length; index++) {
      if (token[index] !== "~") {
        output += token[index];
        continue;
      }
      const escape = token[index + 1];
      if (escape !== "0" && escape !== "1") {
        fail("ANNEX_POINTER_FORMAT", diagnosticPath, "JSON pointer contains a noncanonical tilde escape");
      }
      output += escape === "0" ? "~" : "/";
      index++;
    }
    const encoded = output.replace(/~/g, "~0").replace(/\//g, "~1");
    if (encoded !== token) {
      fail("ANNEX_POINTER_FORMAT", diagnosticPath, "JSON pointer token is not canonically escaped");
    }
    return output;
  });
  return Object.freeze(decoded);
}

function validateSortedUniqueStrings(values, diagnosticPath, validator) {
  const seen = new Set();
  let prior = null;
  values.forEach(function (value, index) {
    const itemPath = pointerJoin(diagnosticPath, index);
    validator(value, itemPath);
    if (seen.has(value)) fail("SCHEMA_DUPLICATE_ID", itemPath, "Duplicate value " + value);
    if (prior !== null && compareAscii(prior, value) >= 0) {
      fail("SCHEMA_UNSTABLE_ORDER", itemPath, "Values must be unique and strictly ASCII sorted");
    }
    seen.add(value);
    prior = value;
  });
}

function validateAnnex(value, context) {
  context = context || {};
  requireExactKeys(value, [
    "schemaVersion",
    "id",
    "approvalState",
    "authorityRecords",
    "bindingLocks",
    "candidateScopes",
    "evidenceRecords",
  ], "/");
  if (value.schemaVersion !== 1) {
    fail("SCHEMA_LITERAL", "/schemaVersion", "Annex schemaVersion must be exactly 1");
  }
  requireStableId(value.id, "/id");
  if (context.manifestAnnexId !== undefined && value.id !== context.manifestAnnexId) {
    fail("ANNEX_ID_MISMATCH", "/id", "Annex ID must exactly match the manifest annex ID");
  }
  if (!APPROVAL_STATES.includes(value.approvalState)) {
    fail("SCHEMA_LITERAL", "/approvalState", "Unknown annex approval state");
  }
  if (context.approvalState !== undefined && value.approvalState !== context.approvalState) {
    fail("ANNEX_APPROVAL_MISMATCH", "/approvalState", "Annex approvalState must exactly match the manifest");
  }

  const authorityRecords = requireArray(value.authorityRecords, "/authorityRecords", MAX_ANNEX_RECORDS);
  const authorityIds = new Set();
  let priorAuthorityId = null;
  authorityRecords.forEach(function (record, index) {
    const base = pointerJoin("/authorityRecords", index);
    requireExactKeys(record, ["id", "repositoryPath", "sha256"], base);
    requireStableId(record.id, pointerJoin(base, "id"));
    if (authorityIds.has(record.id)) {
      fail("SCHEMA_DUPLICATE_ID", pointerJoin(base, "id"), "Duplicate authority ID");
    }
    if (priorAuthorityId !== null && compareAscii(priorAuthorityId, record.id) >= 0) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(base, "id"), "Authority records must be ASCII sorted by ID");
    }
    validateRepositoryPath(record.repositoryPath, pointerJoin(base, "repositoryPath"));
    requireHash(record.sha256, pointerJoin(base, "sha256"));
    authorityIds.add(record.id);
    priorAuthorityId = record.id;
  });

  const bindingLocks = requireArray(value.bindingLocks, "/bindingLocks", MAX_ANNEX_RECORDS);
  const bindingIds = new Set();
  let priorBindingId = null;
  bindingLocks.forEach(function (record, index) {
    const base = pointerJoin("/bindingLocks", index);
    requireExactKeys(record, [
      "id",
      "authorityId",
      "jsonPointer",
      "expectedCanonicalValueHash",
    ], base);
    requireStableId(record.id, pointerJoin(base, "id"));
    requireStableId(record.authorityId, pointerJoin(base, "authorityId"));
    if (bindingIds.has(record.id)) {
      fail("SCHEMA_DUPLICATE_ID", pointerJoin(base, "id"), "Duplicate binding-lock ID");
    }
    if (priorBindingId !== null && compareAscii(priorBindingId, record.id) >= 0) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(base, "id"), "Binding locks must be ASCII sorted by ID");
    }
    validateCanonicalJsonPointer(record.jsonPointer, pointerJoin(base, "jsonPointer"));
    requireHash(record.expectedCanonicalValueHash, pointerJoin(base, "expectedCanonicalValueHash"));
    if (!authorityIds.has(record.authorityId)) {
      fail("ANNEX_AUTHORITY_MISSING", pointerJoin(base, "authorityId"), "Binding lock references an unknown authority ID");
    }
    bindingIds.add(record.id);
    priorBindingId = record.id;
  });

  const candidateScopes = requireArray(value.candidateScopes, "/candidateScopes", MAX_ANNEX_RECORDS);
  validateSortedUniqueStrings(candidateScopes, "/candidateScopes", validateCanonicalJsonPointer);
  const bindingPointers = bindingLocks.map(function (record) { return record.jsonPointer; });
  validateNoInternalOverlap(bindingPointers, function (index) {
    return "/bindingLocks/" + index + "/jsonPointer";
  });
  validateNoInternalOverlap(candidateScopes, function (index) {
    return "/candidateScopes/" + index;
  });
  candidateScopes.forEach(function (candidatePointer, candidateIndex) {
    bindingPointers.forEach(function (bindingPointer) {
      if (pointersIntersect(candidatePointer, bindingPointer)) {
        fail(
          "ANNEX_SCOPE_INTERSECTION",
          "/candidateScopes/" + candidateIndex,
          "Binding and Candidate-BAL scopes cannot intersect"
        );
      }
    });
  });

  const evidenceRecords = requireArray(value.evidenceRecords, "/evidenceRecords", MAX_ANNEX_RECORDS);
  const evidenceIds = new Set();
  let priorEvidenceKey = null;
  const seenEvidenceKinds = new Set();
  evidenceRecords.forEach(function (record, index) {
    const base = pointerJoin("/evidenceRecords", index);
    requireExactKeys(record, ["id", "kind", "repositoryPath", "sha256"], base);
    requireStableId(record.id, pointerJoin(base, "id"));
    if (!EVIDENCE_KINDS.includes(record.kind)) {
      fail("SCHEMA_LITERAL", pointerJoin(base, "kind"), "Unknown annex evidence kind");
    }
    if (evidenceIds.has(record.id)) {
      fail("SCHEMA_DUPLICATE_ID", pointerJoin(base, "id"), "Duplicate evidence ID");
    }
    const orderKey = record.kind + "\u0000" + record.id;
    if (priorEvidenceKey !== null && compareAscii(priorEvidenceKey, orderKey) >= 0) {
      fail("SCHEMA_UNSTABLE_ORDER", pointerJoin(base, "id"), "Evidence records must be ASCII sorted by kind then ID");
    }
    validateRepositoryPath(record.repositoryPath, pointerJoin(base, "repositoryPath"));
    requireHash(record.sha256, pointerJoin(base, "sha256"));
    evidenceIds.add(record.id);
    seenEvidenceKinds.add(record.kind);
    priorEvidenceKey = orderKey;
  });

  if (
    value.approvalState !== "candidate-balance" &&
    (!seenEvidenceKinds.has("balance-report") || !seenEvidenceKinds.has("witness-replay"))
  ) {
    fail(
      "ANNEX_EVIDENCE_REQUIRED",
      "/evidenceRecords",
      "Promoted annexes require both balance-report and witness-replay evidence"
    );
  }
  return value;
}

function validateNormalizedLockTree(tree) {
  requireExactKeys(tree, LOCK_TREE_KEYS, "/");
  if (tree.schemaVersion !== 1) {
    fail("SCHEMA_LITERAL", "/schemaVersion", "Normalized lock-tree schemaVersion must be exactly 1");
  }
  requireRecord(tree.campaignRules, "/campaignRules");
  if (!Object.prototype.hasOwnProperty.call(tree.campaignRules, "id")) {
    fail("SCHEMA_MISSING_KEY", "/campaignRules/id", "Campaign-rules lock record requires its authored ID");
  }
  requireStableId(tree.campaignRules.id, "/campaignRules/id");
  ID_COLLECTION_KEYS.forEach(function (collectionKey) {
    const collectionPath = pointerJoin("/", collectionKey);
    const collection = tree[collectionKey];
    if (!isPlainRecord(collection)) {
      fail("LOCK_TREE_COLLECTION", collectionPath, "Normalized collections must be plain ID-keyed objects");
    }
    Object.getOwnPropertyNames(collection).forEach(function (id) {
      const recordPath = pointerJoin(collectionPath, id);
      requireStableId(id, recordPath);
      const record = collection[id];
      requireRecord(record, recordPath);
      if (!Object.prototype.hasOwnProperty.call(record, "id")) {
        fail("SCHEMA_MISSING_KEY", pointerJoin(recordPath, "id"), "ID-keyed records must retain their authored ID");
      }
      if (record.id !== id) {
        fail("LOCK_TREE_ID_MISMATCH", pointerJoin(recordPath, "id"), "Record ID must exactly match its collection key");
      }
    });
  });
  const visited = new WeakSet();
  function rejectCompanionData(value, path) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(function (item, index) {
        rejectCompanionData(item, pointerJoin(path, index));
      });
      return;
    }
    Object.getOwnPropertyNames(value).forEach(function (key) {
      const keyPath = pointerJoin(path, key);
      if (FORBIDDEN_LOCK_TREE_KEYS.has(key)) {
        fail(
          "LOCK_TREE_PRESENTATION",
          keyPath,
          "Presentation, provenance, approval, and UI companion fields are forbidden in the simulation lock tree"
        );
      }
      rejectCompanionData(value[key], keyPath);
    });
  }
  rejectCompanionData(tree, "/");
  canonicalBytes(tree);
  return tree;
}

function canonicalValueHash(value) {
  return "sha256:" + crypto.createHash("sha256").update(canonicalBytes(value)).digest("hex");
}

function encodePointerToken(value) {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizeSemanticArrayPaths(value) {
  if (value === undefined) return new Set();
  const paths = value instanceof Set ? Array.from(value) : value;
  if (!Array.isArray(paths)) {
    throw new TypeError("semanticArrayPaths must be a Set or array of canonical JSON pointers");
  }
  const normalized = new Set();
  paths.forEach(function (pointer, index) {
    validateCanonicalJsonPointer(pointer, "/semanticArrayPaths/" + index);
    normalized.add(pointer);
  });
  return normalized;
}

function resolvePointer(tree, pointer, diagnosticPath, semanticArrayPaths) {
  const tokens = validateCanonicalJsonPointer(pointer, diagnosticPath);
  if (PRESENTATION_ONLY_ROOTS.has(tokens[0])) {
    fail("ANNEX_POINTER_PRESENTATION", diagnosticPath, "Lock pointers cannot target presentation or provenance values");
  }
  let current = tree;
  let currentPointer = "";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (Array.isArray(current)) {
      if (!semanticArrayPaths.has(currentPointer)) {
        fail("ANNEX_POINTER_ARRAY", diagnosticPath, "Array indices are permitted only in declared semantic-order arrays");
      }
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        fail("ANNEX_POINTER_ARRAY", diagnosticPath, "Semantic array indices must be canonical nonnegative integers");
      }
      const arrayIndex = Number(token);
      if (!Number.isSafeInteger(arrayIndex) || arrayIndex >= current.length) {
        fail("ANNEX_POINTER_MISSING", diagnosticPath, "Lock pointer does not resolve in the normalized tree");
      }
      current = current[arrayIndex];
    } else if (
      current &&
      typeof current === "object" &&
      Object.prototype.hasOwnProperty.call(current, token)
    ) {
      current = current[token];
    } else {
      fail("ANNEX_POINTER_MISSING", diagnosticPath, "Lock pointer does not resolve in the normalized tree");
    }
    currentPointer += "/" + encodePointerToken(token);
  }
  return current;
}

function pointersIntersect(left, right) {
  return left === right || left.startsWith(right + "/") || right.startsWith(left + "/");
}

function validateNoInternalOverlap(entries, pathForIndex) {
  for (let index = 0; index < entries.length; index++) {
    for (let prior = 0; prior < index; prior++) {
      if (pointersIntersect(entries[index], entries[prior])) {
        fail(
          "ANNEX_SCOPE_OVERLAP",
          pathForIndex(index),
          "Duplicate or ancestor/descendant lock scopes are forbidden"
        );
      }
    }
  }
}

function collectLeafPointers(value, pointer, output) {
  if (value === null || typeof value !== "object") {
    output.push(pointer);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      output.push(pointer);
      return;
    }
    value.forEach(function (item, index) {
      collectLeafPointers(item, pointer + "/" + index, output);
    });
    return;
  }
  const keys = Object.getOwnPropertyNames(value).sort(compareAscii);
  if (keys.length === 0) {
    output.push(pointer);
    return;
  }
  keys.forEach(function (key) {
    collectLeafPointers(value[key], pointer + "/" + encodePointerToken(key), output);
  });
}

function validateLockCoverage(annex, tree, options) {
  options = options || {};
  validateAnnex(annex, options.annexContext);
  validateNormalizedLockTree(tree);
  const semanticArrayPaths = normalizeSemanticArrayPaths(options.semanticArrayPaths);
  const bindingPointers = annex.bindingLocks.map(function (record) { return record.jsonPointer; });
  const candidatePointers = annex.candidateScopes.slice();
  validateNoInternalOverlap(bindingPointers, function (index) {
    return "/bindingLocks/" + index + "/jsonPointer";
  });
  validateNoInternalOverlap(candidatePointers, function (index) {
    return "/candidateScopes/" + index;
  });
  for (let candidateIndex = 0; candidateIndex < candidatePointers.length; candidateIndex++) {
    for (let bindingIndex = 0; bindingIndex < bindingPointers.length; bindingIndex++) {
      if (pointersIntersect(candidatePointers[candidateIndex], bindingPointers[bindingIndex])) {
        fail(
          "ANNEX_SCOPE_INTERSECTION",
          "/candidateScopes/" + candidateIndex,
          "Binding and Candidate-BAL scopes cannot intersect"
        );
      }
    }
  }

  const bindingValues = annex.bindingLocks.map(function (record, index) {
    const value = resolvePointer(
      tree,
      record.jsonPointer,
      "/bindingLocks/" + index + "/jsonPointer",
      semanticArrayPaths
    );
    const actual = canonicalValueHash(value);
    if (actual !== record.expectedCanonicalValueHash) {
      fail(
        "ANNEX_LOCK_HASH_MISMATCH",
        "/bindingLocks/" + index + "/expectedCanonicalValueHash",
        "Binding lock canonical value hash does not match the normalized value"
      );
    }
    return value;
  });
  candidatePointers.forEach(function (pointer, index) {
    resolvePointer(tree, pointer, "/candidateScopes/" + index, semanticArrayPaths);
  });

  const allScopes = bindingPointers.concat(candidatePointers);
  const leaves = [];
  collectLeafPointers(tree, "", leaves);
  leaves.forEach(function (leafPointer) {
    const covering = allScopes.filter(function (scope) {
      return scope === leafPointer || leafPointer.startsWith(scope + "/");
    });
    if (covering.length === 0) {
      fail("ANNEX_COVERAGE_UNCOVERED", leafPointer || "/", "Simulation-value leaf is not covered by the annex");
    }
    if (covering.length > 1) {
      fail("ANNEX_COVERAGE_MULTIPLE", leafPointer || "/", "Simulation-value leaf is covered more than once");
    }
  });
  return Object.freeze({
    bindingValues: Object.freeze(bindingValues.slice()),
    coveredLeafCount: leaves.length,
  });
}

module.exports = Object.freeze({
  APPROVAL_STATES: APPROVAL_STATES,
  EVIDENCE_KINDS: EVIDENCE_KINDS,
  LOCK_TREE_KEYS: LOCK_TREE_KEYS,
  canonicalValueHash: canonicalValueHash,
  validateAnnex: validateAnnex,
  validateCanonicalJsonPointer: validateCanonicalJsonPointer,
  validateLockCoverage: validateLockCoverage,
  validateNormalizedLockTree: validateNormalizedLockTree,
  validateRepositoryPath: validateRepositoryPath,
});
