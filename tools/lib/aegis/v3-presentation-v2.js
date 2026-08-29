"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");

const LIMITS = Object.freeze({
  maxAssets: 2048,
  maxAssetBytes: 10 * 1024 * 1024,
  maxCameras: 64,
  maxCues: 4096,
  maxDecodedPackBytes: 64 * 1024 * 1024,
  maxDimensionPx: 2048,
  maxFramesPerAtlas: 512,
  maxPackTransferBytes: 5 * 1024 * 1024,
  maxPacks: 64,
  maxPlacements: 4096,
  maxProvenanceRecords: 4096,
  maxSourceBytes: 4 * 1024 * 1024,
});

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const RELATIVE_URL = /^(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.(?:avif|png|webp)$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const CANONICAL_CAMERA = Object.freeze({
  id: "camera.overscan-16x10-v1",
  x: -18000,
  y: -12000,
  width: 198400,
  height: 124000,
});

const ALPHA_MODES = Object.freeze(["alpha", "opaque"]);
const ASSET_KINDS = Object.freeze(["atlas", "bitmap", "nine-slice"]);
const ASSET_USAGES = Object.freeze([
  "brand", "effect", "enemy-atlas", "landmark", "mission-environment", "plinth",
  "portrait", "road-texture", "tower-atlas", "ui-backdrop", "ui-nine-slice", "ui-ornament",
]);
const LAYERS = Object.freeze([
  "environment", "ground-decal", "road-shadow", "road", "plinth", "landmark-back",
  "unit", "effect", "landmark-front", "readability-ui", "dom-ui",
]);
const PROVENANCE_KINDS = Object.freeze(["authored", "canonical", "derived", "generated"]);
const REVIEW_STATES = Object.freeze(["concept", "reviewed-source", "runtime-ready"]);

const COMMON_ASSET_FIELDS = Object.freeze([
  "id", "kind", "relativeUrl", "sha256", "widthPx", "heightPx", "alphaMode",
  "transferBytes", "decodedBytes", "usage", "fallbackStyleId", "cropRect", "provenanceId",
]);

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepFrozenClone(value[key]); });
  return Object.freeze(output);
}

function preflight(value, diagnosticPath) {
  const seen = new WeakSet();
  function visit(current, currentPath, depth) {
    if (depth > 32) fail("PRESENTATION_V2_DEPTH", currentPath, "Presentation data exceeds maximum depth");
    if (current === null || typeof current === "string" || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
        fail("PRESENTATION_V2_INTEGER", currentPath, "Numbers must be safe integers and may not be negative zero");
      }
      return;
    }
    if (!current || typeof current !== "object") {
      fail("PRESENTATION_V2_TYPE", currentPath, "Presentation records contain JSON data only");
    }
    if (seen.has(current)) fail("PRESENTATION_V2_SHARED", currentPath, "Shared references and cycles are forbidden");
    seen.add(current);
    const expectedPrototype = Array.isArray(current) ? Array.prototype : Object.prototype;
    if (Object.getPrototypeOf(current) !== expectedPrototype) {
      fail("PRESENTATION_V2_OBJECT", currentPath, "Expected ordinary JSON arrays and objects");
    }
    Object.getOwnPropertyNames(current).forEach(function (key) {
      if (Array.isArray(current) && key === "length") return;
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        fail("PRESENTATION_V2_DATA", pointerJoin(currentPath, key), "Fields must be enumerable data properties");
      }
      visit(descriptor.value, pointerJoin(currentPath, key), depth + 1);
    });
  }
  visit(value, diagnosticPath || "/", 0);
  let serialized;
  try { serialized = JSON.stringify(value); }
  catch (error) { fail("PRESENTATION_V2_TYPE", diagnosticPath || "/", "Presentation data must serialize as JSON"); }
  if (Buffer.byteLength(serialized, "utf8") > LIMITS.maxSourceBytes) {
    fail("PRESENTATION_V2_LIMIT", diagnosticPath || "/", "Presentation catalog exceeds its byte limit");
  }
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("PRESENTATION_V2_OBJECT", path, "Expected an object");
  }
  return value;
}

function exactFields(value, fields, path) {
  requireObject(value, path);
  const allowed = new Set(fields);
  Object.keys(value).forEach(function (key) {
    if (!allowed.has(key)) fail("PRESENTATION_V2_UNKNOWN_KEY", pointerJoin(path, key), "Unknown key " + JSON.stringify(key));
  });
  fields.forEach(function (key) {
    if (!own(value, key)) fail("PRESENTATION_V2_REQUIRED", pointerJoin(path, key), "Missing required key " + JSON.stringify(key));
  });
}

function requireArray(value, path, maximum) {
  if (!Array.isArray(value)) fail("PRESENTATION_V2_ARRAY", path, "Expected an array");
  if (value.length > maximum) fail("PRESENTATION_V2_LIMIT", path, "Array exceeds its record limit");
  return value;
}

function requireInteger(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail("PRESENTATION_V2_INTEGER", path, "Expected a safe integer");
  if (value < minimum || value > maximum) fail("PRESENTATION_V2_RANGE", path, "Integer is outside its allowed range");
  return value;
}

function requireId(value, path) {
  if (typeof value !== "string" || !ID.test(value)) fail("PRESENTATION_V2_ID", path, "Expected a stable authored ID");
  return value;
}

function requireEnum(value, allowed, path) {
  if (typeof value !== "string" || allowed.indexOf(value) < 0) {
    fail("PRESENTATION_V2_ENUM", path, "Unsupported value " + JSON.stringify(value));
  }
  return value;
}

function requireCanonicalRelativeUrl(value, path) {
  if (typeof value !== "string" || !RELATIVE_URL.test(value)) {
    fail("PRESENTATION_V2_URL", path, "Expected a lowercase contained canonical relative image URL");
  }
  const segments = value.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || segment.endsWith(".");
  })) {
    fail("PRESENTATION_V2_URL", path, "Expected a lowercase contained canonical relative image URL");
  }
  return value;
}

function requireSortedUniqueIds(values, path, maximum) {
  requireArray(values, path, maximum);
  let previous = null;
  values.forEach(function (value, index) {
    requireId(value, pointerJoin(path, index));
    if (previous !== null && previous >= value) {
      fail("PRESENTATION_V2_ORDER", pointerJoin(path, index), "IDs must be unique and ASCII sorted");
    }
    previous = value;
  });
  return values;
}

function requireSortedRecords(records, path, maximum, key) {
  requireArray(records, path, maximum);
  let previous = null;
  records.forEach(function (record, index) {
    const recordPath = pointerJoin(path, index);
    requireObject(record, recordPath);
    const id = requireId(record[key], pointerJoin(recordPath, key));
    if (previous !== null && previous >= id) {
      fail("PRESENTATION_V2_ORDER", pointerJoin(recordPath, key), "Records must be unique and ASCII sorted by " + key);
    }
    previous = id;
  });
  return records;
}

function rect(value, path, bounds) {
  exactFields(value, ["x", "y", "width", "height"], path);
  const x = requireInteger(value.x, pointerJoin(path, "x"), bounds.allowNegative ? -1000000000 : 0, 1000000000);
  const y = requireInteger(value.y, pointerJoin(path, "y"), bounds.allowNegative ? -1000000000 : 0, 1000000000);
  const width = requireInteger(value.width, pointerJoin(path, "width"), 1, 1000000000);
  const height = requireInteger(value.height, pointerJoin(path, "height"), 1, 1000000000);
  if (bounds.width !== undefined && (x < 0 || x + width > bounds.width)) {
    fail("PRESENTATION_V2_BOUNDS", path, "Rectangle escapes the asset width");
  }
  if (bounds.height !== undefined && (y < 0 || y + height > bounds.height)) {
    fail("PRESENTATION_V2_BOUNDS", path, "Rectangle escapes the asset height");
  }
  return value;
}

function nullableRect(value, path, width, height) {
  if (value === null) return null;
  return rect(value, path, { width: width, height: height });
}

function validateCamera(record, path) {
  exactFields(record, ["id", "x", "y", "width", "height"], path);
  requireId(record.id, pointerJoin(path, "id"));
  requireInteger(record.x, pointerJoin(path, "x"), -1000000000, 1000000000);
  requireInteger(record.y, pointerJoin(path, "y"), -1000000000, 1000000000);
  requireInteger(record.width, pointerJoin(path, "width"), 1, 1000000000);
  requireInteger(record.height, pointerJoin(path, "height"), 1, 1000000000);
  if (record.width * 5 !== record.height * 8) {
    fail("PRESENTATION_V2_CAMERA_ASPECT", path, "Camera width-to-height must be exactly 8:5");
  }
  if (record.id === CANONICAL_CAMERA.id &&
      (record.x !== CANONICAL_CAMERA.x || record.y !== CANONICAL_CAMERA.y ||
       record.width !== CANONICAL_CAMERA.width || record.height !== CANONICAL_CAMERA.height)) {
    fail(
      "PRESENTATION_V2_CAMERA_IDENTITY",
      path,
      "Canonical camera id must use its exact reviewed coordinate tuple"
    );
  }
}

function validateProvenance(record, path) {
  exactFields(record, ["id", "kind", "sourceRef", "parentIds", "reviewState"], path);
  requireId(record.id, pointerJoin(path, "id"));
  requireEnum(record.kind, PROVENANCE_KINDS, pointerJoin(path, "kind"));
  if (typeof record.sourceRef !== "string" || !record.sourceRef || record.sourceRef.length > 256 || /[\r\n]/.test(record.sourceRef)) {
    fail("PRESENTATION_V2_SOURCE_REF", pointerJoin(path, "sourceRef"), "sourceRef must be a bounded single-line reference");
  }
  requireSortedUniqueIds(record.parentIds, pointerJoin(path, "parentIds"), 64);
  requireEnum(record.reviewState, REVIEW_STATES, pointerJoin(path, "reviewState"));
}

function validateFrame(frame, path, asset) {
  exactFields(frame, [
    "id", "xPx", "yPx", "widthPx", "heightPx", "pivotXPx", "pivotYPx",
    "groundXPx", "groundYPx", "projectileXPx", "projectileYPx", "gutterPx", "animationTags",
  ], path);
  requireId(frame.id, pointerJoin(path, "id"));
  requireInteger(frame.xPx, pointerJoin(path, "xPx"), 0, asset.widthPx - 1);
  requireInteger(frame.yPx, pointerJoin(path, "yPx"), 0, asset.heightPx - 1);
  requireInteger(frame.widthPx, pointerJoin(path, "widthPx"), 1, asset.widthPx);
  requireInteger(frame.heightPx, pointerJoin(path, "heightPx"), 1, asset.heightPx);
  if (frame.xPx + frame.widthPx > asset.widthPx || frame.yPx + frame.heightPx > asset.heightPx) {
    fail("PRESENTATION_V2_FRAME_BOUNDS", path, "Frame escapes its atlas");
  }
  ["pivotXPx", "groundXPx"].forEach(function (key) {
    requireInteger(frame[key], pointerJoin(path, key), 0, frame.widthPx);
  });
  ["pivotYPx", "groundYPx"].forEach(function (key) {
    requireInteger(frame[key], pointerJoin(path, key), 0, frame.heightPx);
  });
  const projectileNull = frame.projectileXPx === null && frame.projectileYPx === null;
  const projectileSet = frame.projectileXPx !== null && frame.projectileYPx !== null;
  if (!projectileNull && !projectileSet) {
    fail("PRESENTATION_V2_PROJECTILE_ORIGIN", path, "Projectile coordinates must both be null or both be present");
  }
  if (projectileSet) {
    requireInteger(frame.projectileXPx, pointerJoin(path, "projectileXPx"), 0, frame.widthPx);
    requireInteger(frame.projectileYPx, pointerJoin(path, "projectileYPx"), 0, frame.heightPx);
  }
  requireInteger(frame.gutterPx, pointerJoin(path, "gutterPx"), 2, 32);
  requireSortedUniqueIds(frame.animationTags, pointerJoin(path, "animationTags"), 32);
}

function rectanglesOverlap(left, right) {
  const leftGutter = left.gutterPx;
  const rightGutter = right.gutterPx;
  return left.xPx - leftGutter < right.xPx + right.widthPx + rightGutter &&
    left.xPx + left.widthPx + leftGutter > right.xPx - rightGutter &&
    left.yPx - leftGutter < right.yPx + right.heightPx + rightGutter &&
    left.yPx + left.heightPx + leftGutter > right.yPx - rightGutter;
}

function validateAsset(record, path) {
  requireObject(record, path);
  const kind = requireEnum(record.kind, ASSET_KINDS, pointerJoin(path, "kind"));
  const fields = COMMON_ASSET_FIELDS.concat(kind === "atlas" ? ["frameRecords"] : (kind === "nine-slice" ? ["capInsets"] : []));
  exactFields(record, fields, path);
  requireId(record.id, pointerJoin(path, "id"));
  requireCanonicalRelativeUrl(record.relativeUrl, pointerJoin(path, "relativeUrl"));
  if (typeof record.sha256 !== "string" || !SHA256.test(record.sha256)) {
    fail("PRESENTATION_V2_HASH", pointerJoin(path, "sha256"), "Expected sha256: plus lowercase SHA-256");
  }
  requireInteger(record.widthPx, pointerJoin(path, "widthPx"), 1, LIMITS.maxDimensionPx);
  requireInteger(record.heightPx, pointerJoin(path, "heightPx"), 1, LIMITS.maxDimensionPx);
  requireEnum(record.alphaMode, ALPHA_MODES, pointerJoin(path, "alphaMode"));
  requireInteger(record.transferBytes, pointerJoin(path, "transferBytes"), 1, LIMITS.maxAssetBytes);
  const expectedDecoded = record.widthPx * record.heightPx * 4;
  requireInteger(record.decodedBytes, pointerJoin(path, "decodedBytes"), 4, LIMITS.maxDecodedPackBytes);
  if (record.decodedBytes !== expectedDecoded) {
    fail("PRESENTATION_V2_DECODED_BYTES", pointerJoin(path, "decodedBytes"), "decodedBytes must equal widthPx * heightPx * 4");
  }
  requireEnum(record.usage, ASSET_USAGES, pointerJoin(path, "usage"));
  requireId(record.fallbackStyleId, pointerJoin(path, "fallbackStyleId"));
  nullableRect(record.cropRect, pointerJoin(path, "cropRect"), record.widthPx, record.heightPx);
  requireId(record.provenanceId, pointerJoin(path, "provenanceId"));

  if (["brand", "effect", "enemy-atlas", "landmark", "plinth", "portrait", "tower-atlas"].includes(record.usage) && record.alphaMode !== "alpha") {
    fail("PRESENTATION_V2_ALPHA_REQUIRED", pointerJoin(path, "alphaMode"), "This asset usage requires genuine alpha");
  }
  if (["mission-environment", "ui-backdrop"].includes(record.usage) && record.alphaMode !== "opaque") {
    fail("PRESENTATION_V2_OPAQUE_REQUIRED", pointerJoin(path, "alphaMode"), "This asset usage requires an opaque plate");
  }
  if (kind === "atlas") {
    if (!["effect", "enemy-atlas", "tower-atlas"].includes(record.usage)) {
      fail("PRESENTATION_V2_KIND_USAGE", pointerJoin(path, "usage"), "Atlas usage is not supported for this asset");
    }
    requireSortedRecords(record.frameRecords, pointerJoin(path, "frameRecords"), LIMITS.maxFramesPerAtlas, "id");
    if (record.frameRecords.length === 0) fail("PRESENTATION_V2_LIMIT", pointerJoin(path, "frameRecords"), "Atlas requires at least one frame");
    record.frameRecords.forEach(function (frame, index) {
      validateFrame(frame, pointerJoin(pointerJoin(path, "frameRecords"), index), record);
    });
    for (let left = 0; left < record.frameRecords.length; left += 1) {
      for (let right = left + 1; right < record.frameRecords.length; right += 1) {
        if (rectanglesOverlap(record.frameRecords[left], record.frameRecords[right])) {
          fail("PRESENTATION_V2_FRAME_OVERLAP", pointerJoin(pointerJoin(path, "frameRecords"), right), "Atlas frames or declared gutters overlap");
        }
      }
    }
  }
  if (kind === "nine-slice") {
    if (record.usage !== "ui-nine-slice") {
      fail("PRESENTATION_V2_KIND_USAGE", pointerJoin(path, "usage"), "Nine-slice asset must use ui-nine-slice");
    }
    exactFields(record.capInsets, ["topPx", "rightPx", "bottomPx", "leftPx"], pointerJoin(path, "capInsets"));
    ["topPx", "rightPx", "bottomPx", "leftPx"].forEach(function (key) {
      requireInteger(record.capInsets[key], pointerJoin(pointerJoin(path, "capInsets"), key), 1, LIMITS.maxDimensionPx);
    });
    if (record.capInsets.leftPx + record.capInsets.rightPx >= record.widthPx ||
        record.capInsets.topPx + record.capInsets.bottomPx >= record.heightPx) {
      fail("PRESENTATION_V2_CAP_INSETS", pointerJoin(path, "capInsets"), "Nine-slice cap insets consume the entire asset");
    }
  }
}

function validatePlacement(record, path, assetById, cameraById) {
  exactFields(record, ["id", "assetId", "cameraId", "layer", "worldRect", "pivot", "anchorId", "foregroundAssetId"], path);
  requireId(record.id, pointerJoin(path, "id"));
  requireId(record.assetId, pointerJoin(path, "assetId"));
  requireId(record.cameraId, pointerJoin(path, "cameraId"));
  requireEnum(record.layer, LAYERS, pointerJoin(path, "layer"));
  const asset = assetById.get(record.assetId);
  const camera = cameraById.get(record.cameraId);
  if (!asset) fail("PRESENTATION_V2_ASSET_REF", pointerJoin(path, "assetId"), "Unknown asset ID");
  if (!camera) fail("PRESENTATION_V2_CAMERA_REF", pointerJoin(path, "cameraId"), "Unknown camera ID");
  rect(record.worldRect, pointerJoin(path, "worldRect"), { allowNegative: true });
  exactFields(record.pivot, ["x", "y"], pointerJoin(path, "pivot"));
  requireInteger(record.pivot.x, pointerJoin(pointerJoin(path, "pivot"), "x"), 0, record.worldRect.width);
  requireInteger(record.pivot.y, pointerJoin(pointerJoin(path, "pivot"), "y"), 0, record.worldRect.height);
  if (record.anchorId !== null) requireId(record.anchorId, pointerJoin(path, "anchorId"));
  if (record.foregroundAssetId !== null) requireId(record.foregroundAssetId, pointerJoin(path, "foregroundAssetId"));
  if (asset.usage === "mission-environment") {
    if (record.layer !== "environment" || record.worldRect.x !== camera.x || record.worldRect.y !== camera.y ||
        record.worldRect.width !== camera.width || record.worldRect.height !== camera.height) {
      fail("PRESENTATION_V2_ENVIRONMENT_CAMERA", path, "Mission environment must map exactly to its camera on the environment layer");
    }
    if (asset.widthPx * camera.height !== asset.heightPx * camera.width) {
      fail("PRESENTATION_V2_ASSET_ASPECT", pointerJoin(path, "assetId"), "Environment asset aspect does not match its camera");
    }
  }
}

function validatePack(record, path) {
  exactFields(record, [
    "id", "kind", "missionIds", "assetIds", "dependencyPackIds", "preloadAssetIds",
    "criticalAssetIds", "fallbackStyleId", "maxTransferBytes", "maxDecodedBytes",
  ], path);
  requireId(record.id, pointerJoin(path, "id"));
  if (record.kind !== "asset-pack") fail("PRESENTATION_V2_ENUM", pointerJoin(path, "kind"), "Pack kind must be asset-pack");
  requireSortedUniqueIds(record.missionIds, pointerJoin(path, "missionIds"), 20);
  requireSortedUniqueIds(record.assetIds, pointerJoin(path, "assetIds"), LIMITS.maxAssets);
  requireSortedUniqueIds(record.dependencyPackIds, pointerJoin(path, "dependencyPackIds"), LIMITS.maxPacks);
  requireSortedUniqueIds(record.preloadAssetIds, pointerJoin(path, "preloadAssetIds"), LIMITS.maxAssets);
  requireSortedUniqueIds(record.criticalAssetIds, pointerJoin(path, "criticalAssetIds"), LIMITS.maxAssets);
  requireId(record.fallbackStyleId, pointerJoin(path, "fallbackStyleId"));
  requireInteger(record.maxTransferBytes, pointerJoin(path, "maxTransferBytes"), 1, LIMITS.maxPackTransferBytes);
  requireInteger(record.maxDecodedBytes, pointerJoin(path, "maxDecodedBytes"), 4, LIMITS.maxDecodedPackBytes);
}

function validateCue(record, path) {
  exactFields(record, ["cueId", "kind", "assetId", "frameId", "fallbackStyleId"], path);
  requireId(record.cueId, pointerJoin(path, "cueId"));
  if (record.kind !== "asset-or-fallback") fail("PRESENTATION_V2_ENUM", pointerJoin(path, "kind"), "Cue kind must be asset-or-fallback");
  if (record.assetId !== null) requireId(record.assetId, pointerJoin(path, "assetId"));
  if (record.frameId !== null) requireId(record.frameId, pointerJoin(path, "frameId"));
  if (record.assetId === null && record.frameId !== null) {
    fail("PRESENTATION_V2_FRAME_REF", pointerJoin(path, "frameId"), "A frame cannot be selected without an asset");
  }
  requireId(record.fallbackStyleId, pointerJoin(path, "fallbackStyleId"));
}

function assertNoPackCycle(packById) {
  const states = new Map();
  function visit(packId, path) {
    const state = states.get(packId);
    if (state === 1) fail("PRESENTATION_V2_PACK_CYCLE", path, "Pack dependency cycle detected");
    if (state === 2) return;
    states.set(packId, 1);
    packById.get(packId).dependencyPackIds.forEach(function (dependencyId, index) {
      visit(dependencyId, pointerJoin(pointerJoin(path, "dependencyPackIds"), index));
    });
    states.set(packId, 2);
  }
  Array.from(packById.keys()).forEach(function (packId) { visit(packId, "/packRecords"); });
}

function packCanReach(packById, sourcePackId, targetPackId) {
  if (sourcePackId === targetPackId) return true;
  const visited = new Set();
  const pending = [sourcePackId];
  while (pending.length > 0) {
    const packId = pending.pop();
    if (visited.has(packId)) continue;
    visited.add(packId);
    const pack = packById.get(packId);
    for (let index = pack.dependencyPackIds.length - 1; index >= 0; index -= 1) {
      const dependencyId = pack.dependencyPackIds[index];
      if (dependencyId === targetPackId) return true;
      if (!visited.has(dependencyId)) pending.push(dependencyId);
    }
  }
  return false;
}

function validatePresentationCatalogV2(value, options) {
  preflight(value, "/");
  exactFields(value, [
    "schemaVersion", "id", "cameraRecords", "provenanceRecords", "assetRecords",
    "placementRecords", "packRecords", "cueMappings",
  ], "/");
  if (value.schemaVersion !== 2) fail("PRESENTATION_V2_VERSION", "/schemaVersion", "Presentation schema version must be 2");
  requireId(value.id, "/id");
  requireSortedRecords(value.cameraRecords, "/cameraRecords", LIMITS.maxCameras, "id");
  requireSortedRecords(value.provenanceRecords, "/provenanceRecords", LIMITS.maxProvenanceRecords, "id");
  requireSortedRecords(value.assetRecords, "/assetRecords", LIMITS.maxAssets, "id");
  requireSortedRecords(value.placementRecords, "/placementRecords", LIMITS.maxPlacements, "id");
  requireSortedRecords(value.packRecords, "/packRecords", LIMITS.maxPacks, "id");
  requireSortedRecords(value.cueMappings, "/cueMappings", LIMITS.maxCues, "cueId");

  const cameraById = new Map();
  value.cameraRecords.forEach(function (record, index) {
    validateCamera(record, pointerJoin("/cameraRecords", index));
    cameraById.set(record.id, record);
  });
  const provenanceById = new Map();
  value.provenanceRecords.forEach(function (record, index) {
    validateProvenance(record, pointerJoin("/provenanceRecords", index));
    provenanceById.set(record.id, record);
  });
  value.provenanceRecords.forEach(function (record, index) {
    record.parentIds.forEach(function (parentId, parentIndex) {
      if (!provenanceById.has(parentId)) {
        fail("PRESENTATION_V2_PROVENANCE_REF", pointerJoin(pointerJoin(pointerJoin("/provenanceRecords", index), "parentIds"), parentIndex), "Unknown provenance parent ID");
      }
    });
  });

  const assetById = new Map();
  const assetIdByRelativeUrl = new Map();
  value.assetRecords.forEach(function (record, index) {
    const path = pointerJoin("/assetRecords", index);
    validateAsset(record, path);
    if (assetIdByRelativeUrl.has(record.relativeUrl)) {
      fail(
        "PRESENTATION_V2_ASSET_URL_OWNER",
        pointerJoin(path, "relativeUrl"),
        "Asset URL is already owned by " + JSON.stringify(assetIdByRelativeUrl.get(record.relativeUrl))
      );
    }
    assetIdByRelativeUrl.set(record.relativeUrl, record.id);
    if (!provenanceById.has(record.provenanceId)) {
      fail("PRESENTATION_V2_PROVENANCE_REF", pointerJoin(pointerJoin("/assetRecords", index), "provenanceId"), "Unknown provenance ID");
    }
    if (options && options.requireRuntimeReady && provenanceById.get(record.provenanceId).reviewState !== "runtime-ready") {
      fail("PRESENTATION_V2_REVIEW_STATE", pointerJoin(pointerJoin("/assetRecords", index), "provenanceId"), "Runtime selection requires runtime-ready provenance");
    }
    assetById.set(record.id, record);
  });

  value.placementRecords.forEach(function (record, index) {
    validatePlacement(record, pointerJoin("/placementRecords", index), assetById, cameraById);
    if (record.foregroundAssetId !== null && !assetById.has(record.foregroundAssetId)) {
      fail("PRESENTATION_V2_ASSET_REF", pointerJoin(pointerJoin("/placementRecords", index), "foregroundAssetId"), "Unknown foreground asset ID");
    }
  });

  const packById = new Map();
  const ownerByAssetId = new Map();
  value.packRecords.forEach(function (record, index) {
    const path = pointerJoin("/packRecords", index);
    validatePack(record, path);
    packById.set(record.id, record);
    record.assetIds.forEach(function (assetId, assetIndex) {
      const assetPath = pointerJoin(pointerJoin(path, "assetIds"), assetIndex);
      if (!assetById.has(assetId)) fail("PRESENTATION_V2_ASSET_REF", assetPath, "Unknown asset ID");
      if (ownerByAssetId.has(assetId)) fail("PRESENTATION_V2_ASSET_OWNER", assetPath, "Asset has more than one owning pack");
      ownerByAssetId.set(assetId, record.id);
    });
    ["preloadAssetIds", "criticalAssetIds"].forEach(function (field) {
      record[field].forEach(function (assetId, assetIndex) {
        if (record.assetIds.indexOf(assetId) < 0) {
          fail("PRESENTATION_V2_PACK_SUBSET", pointerJoin(pointerJoin(path, field), assetIndex), field + " must be a subset of owned assetIds");
        }
      });
    });
  });
  value.assetRecords.forEach(function (record, index) {
    if (!ownerByAssetId.has(record.id)) {
      fail("PRESENTATION_V2_ASSET_OWNER", pointerJoin(pointerJoin("/assetRecords", index), "id"), "Asset must have exactly one owning pack");
    }
  });
  value.packRecords.forEach(function (record, index) {
    const path = pointerJoin("/packRecords", index);
    record.dependencyPackIds.forEach(function (dependencyId, dependencyIndex) {
      if (!packById.has(dependencyId)) {
        fail("PRESENTATION_V2_PACK_REF", pointerJoin(pointerJoin(path, "dependencyPackIds"), dependencyIndex), "Unknown dependency pack ID");
      }
      if (dependencyId === record.id) {
        fail("PRESENTATION_V2_PACK_CYCLE", pointerJoin(pointerJoin(path, "dependencyPackIds"), dependencyIndex), "Pack cannot depend on itself");
      }
    });
    const transferBytes = record.assetIds.reduce(function (total, assetId) { return total + assetById.get(assetId).transferBytes; }, 0);
    const decodedBytes = record.assetIds.reduce(function (total, assetId) { return total + assetById.get(assetId).decodedBytes; }, 0);
    if (transferBytes > record.maxTransferBytes) fail("PRESENTATION_V2_PACK_TRANSFER", path, "Owned assets exceed maxTransferBytes");
    if (decodedBytes > record.maxDecodedBytes) fail("PRESENTATION_V2_PACK_DECODED", path, "Owned assets exceed maxDecodedBytes");
  });
  assertNoPackCycle(packById);

  value.placementRecords.forEach(function (record, index) {
    if (record.foregroundAssetId === null) return;
    const baseOwnerId = ownerByAssetId.get(record.assetId);
    const foregroundOwnerId = ownerByAssetId.get(record.foregroundAssetId);
    if (!packCanReach(packById, baseOwnerId, foregroundOwnerId)) {
      fail(
        "PRESENTATION_V2_PACK_ACCESS",
        pointerJoin(pointerJoin("/placementRecords", index), "foregroundAssetId"),
        "Foreground asset pack " + JSON.stringify(foregroundOwnerId) +
          " is neither base asset pack " + JSON.stringify(baseOwnerId) +
          " nor one of its reachable dependencies"
      );
    }
  });

  // Cue mappings are catalog-global and carry no consuming mission or pack identity.
  // Their dependency reachability cannot be derived without adding schema authority.
  value.cueMappings.forEach(function (record, index) {
    const path = pointerJoin("/cueMappings", index);
    validateCue(record, path);
    if (record.assetId === null) return;
    const asset = assetById.get(record.assetId);
    if (!asset) fail("PRESENTATION_V2_ASSET_REF", pointerJoin(path, "assetId"), "Unknown cue asset ID");
    if (record.frameId !== null) {
      if (asset.kind !== "atlas" || !asset.frameRecords.some(function (frame) { return frame.id === record.frameId; })) {
        fail("PRESENTATION_V2_FRAME_REF", pointerJoin(path, "frameId"), "Unknown frame for cue asset");
      }
    }
  });

  return deepFrozenClone(value);
}

module.exports = Object.freeze({
  ALPHA_MODES: ALPHA_MODES,
  ASSET_KINDS: ASSET_KINDS,
  ASSET_USAGES: ASSET_USAGES,
  LAYERS: LAYERS,
  LIMITS: LIMITS,
  PROVENANCE_KINDS: PROVENANCE_KINDS,
  REVIEW_STATES: REVIEW_STATES,
  validatePresentationCatalogV2: validatePresentationCatalogV2,
});
