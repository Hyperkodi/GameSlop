"use strict";

/* Schema-v4 annex coverage.
   The annex record contract itself is the reviewed v3 record (imported, never forked); only the
   v4 lock-tree shape and its exactly-once binding/candidate coverage are defined here. */

const { canonicalBytes } = require("./canonical.js");
const { fail, pointerJoin } = require("./diagnostics.js");
const V3Annex = require("./v3-annex.js");

const LOCK_TREE_KEYS = Object.freeze([
  "schemaVersion",
  "campaignRules",
  "defenses",
  "specializations",
  "summons",
  "enemies",
  "bosses",
  "missions",
  "maps",
  "eventCatalog",
]);
const ID_COLLECTION_KEYS = Object.freeze([
  "defenses", "specializations", "summons", "enemies", "bosses", "missions", "maps", "eventCatalog",
]);
const PRESENTATION_ONLY_ROOTS = new Set([
  "annex", "approvalState", "localizedStrings", "presentationCatalog", "provenance",
  "sourceProvenance", "stringCatalog",
]);
/* `ui` stays legal inside a v4 specialization record: it is a closed
   { descriptionKey, statFieldIds } pair of authored identities, never a localized sentence,
   sprite rectangle, animation duration, or screen coordinate. */
const FORBIDDEN_LOCK_TREE_KEYS = new Set([
  "annex", "approvalState", "assetPath", "assetUrl", "authorityRecords", "bindingLocks",
  "candidateScopes", "evidenceRecords", "localizedStrings", "presentationCatalog",
  "presentationPackId", "provenance", "sourceProvenance", "spriteRect", "stringCatalog",
  "transferBytes",
]);
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodePointerToken(value) {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function validateV4NormalizedLockTree(tree) {
  if (!isPlainRecord(tree)) fail("SCHEMA_OBJECT", "/", "Expected a plain normalized lock tree");
  const allowed = new Set(LOCK_TREE_KEYS);
  LOCK_TREE_KEYS.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(tree, key)) {
      fail("SCHEMA_MISSING_KEY", pointerJoin("/", key), "Missing required lock-tree key " + key);
    }
  });
  Object.getOwnPropertyNames(tree).forEach(function (key) {
    if (!allowed.has(key)) fail("SCHEMA_UNKNOWN_KEY", pointerJoin("/", key), "Unknown lock-tree key " + key);
  });
  if (tree.schemaVersion !== 1) {
    fail("SCHEMA_LITERAL", "/schemaVersion", "Normalized lock-tree schemaVersion must be exactly 1");
  }
  if (!isPlainRecord(tree.campaignRules) ||
      !Object.prototype.hasOwnProperty.call(tree.campaignRules, "id") ||
      typeof tree.campaignRules.id !== "string" || !STABLE_ID.test(tree.campaignRules.id)) {
    fail("SCHEMA_MISSING_KEY", "/campaignRules/id", "Campaign-rules lock record requires its authored ID");
  }
  ID_COLLECTION_KEYS.forEach(function (collectionKey) {
    const collectionPath = pointerJoin("/", collectionKey);
    const collection = tree[collectionKey];
    if (!isPlainRecord(collection)) {
      fail("LOCK_TREE_COLLECTION", collectionPath, "Normalized collections must be plain ID-keyed objects");
    }
    Object.getOwnPropertyNames(collection).forEach(function (id) {
      const recordPath = pointerJoin(collectionPath, id);
      if (typeof id !== "string" || !STABLE_ID.test(id)) {
        fail("SCHEMA_STRING", recordPath, "Expected a stable 1-64 character ASCII ID");
      }
      const record = collection[id];
      if (!isPlainRecord(record)) fail("SCHEMA_OBJECT", recordPath, "Expected a plain data object");
      if (!Object.prototype.hasOwnProperty.call(record, "id")) {
        fail("SCHEMA_MISSING_KEY", pointerJoin(recordPath, "id"), "ID-keyed records must retain their authored ID");
      }
      if (record.id !== id) {
        fail("LOCK_TREE_ID_MISMATCH", pointerJoin(recordPath, "id"), "Record ID must exactly match its collection key");
      }
    });
  });
  const visited = new WeakSet();
  (function rejectCompanionData(value, path) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(function (item, index) { rejectCompanionData(item, pointerJoin(path, index)); });
      return;
    }
    Object.getOwnPropertyNames(value).forEach(function (key) {
      const keyPath = pointerJoin(path, key);
      if (FORBIDDEN_LOCK_TREE_KEYS.has(key)) {
        fail(
          "LOCK_TREE_PRESENTATION",
          keyPath,
          "Presentation, provenance, approval, and asset companion fields are forbidden in the simulation lock tree"
        );
      }
      rejectCompanionData(value[key], keyPath);
    });
  })(tree, "/");
  canonicalBytes(tree);
  return tree;
}

function normalizeSemanticArrayPaths(value) {
  if (value === undefined) return new Set();
  const paths = value instanceof Set ? Array.from(value) : value;
  if (!Array.isArray(paths)) {
    throw new TypeError("semanticArrayPaths must be a Set or array of canonical JSON pointers");
  }
  const normalized = new Set();
  paths.forEach(function (pointer, index) {
    V3Annex.validateCanonicalJsonPointer(pointer, "/semanticArrayPaths/" + index);
    normalized.add(pointer);
  });
  return normalized;
}

function resolvePointer(tree, pointer, diagnosticPath, semanticArrayPaths) {
  const tokens = V3Annex.validateCanonicalJsonPointer(pointer, diagnosticPath);
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
    } else if (current && typeof current === "object" &&
        Object.prototype.hasOwnProperty.call(current, token)) {
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
        fail("ANNEX_SCOPE_OVERLAP", pathForIndex(index), "Duplicate or ancestor/descendant lock scopes are forbidden");
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
    if (value.length === 0) { output.push(pointer); return; }
    value.forEach(function (item, index) { collectLeafPointers(item, pointer + "/" + index, output); });
    return;
  }
  const keys = Object.getOwnPropertyNames(value).sort(compareAscii);
  if (keys.length === 0) { output.push(pointer); return; }
  keys.forEach(function (key) {
    collectLeafPointers(value[key], pointer + "/" + encodePointerToken(key), output);
  });
}

function validateV4LockCoverage(annex, tree, options) {
  options = options || {};
  V3Annex.validateAnnex(annex, options.annexContext);
  validateV4NormalizedLockTree(tree);
  const semanticArrayPaths = normalizeSemanticArrayPaths(options.semanticArrayPaths);
  const bindingPointers = annex.bindingLocks.map(function (record) { return record.jsonPointer; });
  const candidatePointers = annex.candidateScopes.slice();
  validateNoInternalOverlap(bindingPointers, function (index) {
    return "/bindingLocks/" + index + "/jsonPointer";
  });
  validateNoInternalOverlap(candidatePointers, function (index) { return "/candidateScopes/" + index; });
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
      tree, record.jsonPointer, "/bindingLocks/" + index + "/jsonPointer", semanticArrayPaths
    );
    const actual = V3Annex.canonicalValueHash(value);
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
  LOCK_TREE_KEYS: LOCK_TREE_KEYS,
  collectLeafPointers: collectLeafPointers,
  pointersIntersect: pointersIntersect,
  validateV4LockCoverage: validateV4LockCoverage,
  validateV4NormalizedLockTree: validateV4NormalizedLockTree,
});
