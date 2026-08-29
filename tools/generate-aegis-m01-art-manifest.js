#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { canonicalBytes } = require("./lib/aegis/canonical.js");
const { AegisContentError, fail, pointerJoin } = require("./lib/aegis/diagnostics.js");
const AssetInspector = require("./lib/aegis/asset-inspector.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ASSET_ROOT = path.join(REPO_ROOT, "games", "aegis");
const USAGE = "Usage: node tools/generate-aegis-m01-art-manifest.js";

const PACK_LIMITS = Object.freeze({
  maxDecodedBytes: 64 * 1024 * 1024,
  maxDimensionPx: 2048,
  maxIndividualBytes: 1024 * 1024,
  maxTransferBytes: 3 * 1024 * 1024,
});

const ACCEPTED_ASSETS = Object.freeze([
  Object.freeze({
    id: "asset.m01.environment.gate-of-dawn",
    kind: "bitmap",
    usage: "mission-environment",
    relativeUrl: "art/v2/m01/environment-gate-of-dawn-v4.webp",
    expectedWidthPx: 2048,
    expectedHeightPx: 1280,
    expectedAlphaMode: "opaque",
  }),
  Object.freeze({
    id: "asset.m01.foundation.attican",
    kind: "bitmap",
    usage: "neutral-build-foundation",
    relativeUrl: "art/v2/m01/foundation-attican-v1.webp",
    expectedWidthPx: 1024,
    expectedHeightPx: 1024,
    expectedAlphaMode: "alpha",
  }),
  Object.freeze({
    id: "asset.m01.road.city-cobble",
    kind: "bitmap",
    usage: "road-texture",
    relativeUrl: "art/v2/m01/road-city-cobble-v2.webp",
    expectedWidthPx: 1024,
    expectedHeightPx: 1024,
    expectedAlphaMode: "opaque",
  }),
  Object.freeze({
    id: "asset.m01.road.earth",
    kind: "bitmap",
    usage: "road-texture",
    relativeUrl: "art/v2/m01/road-earth-v2.webp",
    expectedWidthPx: 1024,
    expectedHeightPx: 1024,
    expectedAlphaMode: "opaque",
  }),
  Object.freeze({
    id: "asset.m01.road.limestone",
    kind: "bitmap",
    usage: "road-texture",
    relativeUrl: "art/v2/m01/road-limestone-v2.webp",
    expectedWidthPx: 1024,
    expectedHeightPx: 1024,
    expectedAlphaMode: "opaque",
  }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function positiveLimit(value, diagnosticPath) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("M01_ART_INVENTORY_LIMIT", diagnosticPath, "Art-pack limits must be positive safe integers");
  }
  return value;
}

function normalizeLimits(input) {
  const source = input || PACK_LIMITS;
  return Object.freeze({
    maxDecodedBytes: positiveLimit(source.maxDecodedBytes, "/limits/maxDecodedBytes"),
    maxDimensionPx: positiveLimit(source.maxDimensionPx, "/limits/maxDimensionPx"),
    maxIndividualBytes: positiveLimit(source.maxIndividualBytes, "/limits/maxIndividualBytes"),
    maxTransferBytes: positiveLimit(source.maxTransferBytes, "/limits/maxTransferBytes"),
  });
}

function validateDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    fail("M01_ART_INVENTORY_DEFINITION", "/assetRecords", "At least one accepted M01 asset definition is required");
  }
  let previousId = null;
  const urls = new Set();
  definitions.forEach(function (definition, index) {
    const diagnosticPath = "/assetRecords/" + index;
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      fail("M01_ART_INVENTORY_DEFINITION", diagnosticPath, "Accepted asset definitions must be objects");
    }
    if (typeof definition.id !== "string" || !definition.id || (previousId !== null && previousId >= definition.id)) {
      fail("M01_ART_INVENTORY_ORDER", pointerJoin(diagnosticPath, "id"), "Accepted asset IDs must be unique and ASCII sorted");
    }
    previousId = definition.id;
    if (typeof definition.relativeUrl !== "string" || urls.has(definition.relativeUrl)) {
      fail("M01_ART_INVENTORY_DEFINITION", pointerJoin(diagnosticPath, "relativeUrl"), "Accepted assets require unique relative URLs");
    }
    urls.add(definition.relativeUrl);
    ["expectedWidthPx", "expectedHeightPx"].forEach(function (field) {
      if (!Number.isSafeInteger(definition[field]) || definition[field] <= 0) {
        fail("M01_ART_INVENTORY_DEFINITION", pointerJoin(diagnosticPath, field), "Expected dimensions must be positive safe integers");
      }
    });
    if (definition.expectedAlphaMode !== "alpha" && definition.expectedAlphaMode !== "opaque") {
      fail("M01_ART_INVENTORY_DEFINITION", pointerJoin(diagnosticPath, "expectedAlphaMode"), "Expected alpha mode must be alpha or opaque");
    }
  });
  return definitions;
}

function requireExpectedMeasurement(definition, measured, diagnosticPath) {
  const claims = [
    ["widthPx", definition.expectedWidthPx],
    ["heightPx", definition.expectedHeightPx],
    ["alphaMode", definition.expectedAlphaMode],
  ];
  claims.forEach(function (entry) {
    if (measured[entry[0]] !== entry[1]) {
      fail(
        "M01_ART_INVENTORY_MEASUREMENT",
        pointerJoin(diagnosticPath, entry[0]),
        "Accepted asset does not match its reviewed dimension/alpha contract"
      );
    }
  });
}

function measuredRecord(definition, measured) {
  return Object.freeze({
    id: definition.id,
    kind: definition.kind,
    usage: definition.usage,
    relativeUrl: measured.relativeUrl,
    format: measured.format,
    sha256: measured.sha256,
    widthPx: measured.widthPx,
    heightPx: measured.heightPx,
    alphaMode: measured.alphaMode,
    transferBytes: measured.transferBytes,
    decodedBytes: measured.decodedBytes,
  });
}

function buildM01ArtInventory(options) {
  options = options || {};
  const assetRoot = path.resolve(options.assetRoot || DEFAULT_ASSET_ROOT);
  const definitions = validateDefinitions(options.assetDefinitions || ACCEPTED_ASSETS);
  const limits = normalizeLimits(options.limits);
  const records = definitions.map(function (definition, index) {
    const diagnosticPath = "/assetRecords/" + index;
    const measured = AssetInspector.inspectAsset(assetRoot, definition.relativeUrl, {
      diagnosticPath: pointerJoin(diagnosticPath, "relativeUrl"),
      maxDimensionPx: limits.maxDimensionPx,
      maxIndividualBytes: limits.maxIndividualBytes,
    });
    requireExpectedMeasurement(definition, measured, diagnosticPath);
    return measuredRecord(definition, measured);
  });

  let transferBytes = 0;
  let decodedBytes = 0;
  let maximumDimensionPx = 0;
  let largest = null;
  records.forEach(function (record) {
    transferBytes += record.transferBytes;
    decodedBytes += record.decodedBytes;
    maximumDimensionPx = Math.max(maximumDimensionPx, record.widthPx, record.heightPx);
    if (!largest || record.transferBytes > largest.transferBytes ||
        (record.transferBytes === largest.transferBytes && record.id < largest.id)) {
      largest = record;
    }
  });
  if (!Number.isSafeInteger(transferBytes) || !Number.isSafeInteger(decodedBytes)) {
    fail("M01_ART_INVENTORY_BUDGET", "/totals", "Art-pack byte totals exceed safe integer arithmetic");
  }
  if (transferBytes > limits.maxTransferBytes) {
    fail("M01_ART_INVENTORY_BUDGET", "/budgets/maxTransferBytes", "Accepted M01 static art exceeds its transfer budget");
  }
  if (decodedBytes > limits.maxDecodedBytes) {
    fail("M01_ART_INVENTORY_BUDGET", "/budgets/maxDecodedBytes", "Accepted M01 static art exceeds its decoded-memory budget");
  }

  return deepFreeze({
    schemaVersion: 1,
    id: "inventory.m01.static-art-v1",
    missionId: "m01",
    assetRoot: "games/aegis",
    assetRecords: records,
    totals: {
      assetCount: records.length,
      transferBytes: transferBytes,
      decodedBytes: decodedBytes,
      maximumDimensionPx: maximumDimensionPx,
      largestAssetId: largest.id,
      largestAssetTransferBytes: largest.transferBytes,
    },
    budgets: {
      maxTransferBytes: limits.maxTransferBytes,
      remainingTransferBytes: limits.maxTransferBytes - transferBytes,
      maxDecodedBytes: limits.maxDecodedBytes,
      remainingDecodedBytes: limits.maxDecodedBytes - decodedBytes,
      maxDimensionPx: limits.maxDimensionPx,
      maxIndividualBytes: limits.maxIndividualBytes,
    },
  });
}

function renderM01ArtInventory(inventory) {
  return Buffer.concat([canonicalBytes(inventory), Buffer.from("\n", "utf8")]);
}

function main(argv, io, options) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  if (argv.length !== 0) {
    output.stderr.write(USAGE + "\n");
    return 2;
  }
  try {
    output.stdout.write(renderM01ArtInventory(buildM01ArtInventory(options)));
    return 0;
  } catch (error) {
    if (error instanceof AegisContentError) {
      error.diagnostics.forEach(function (item) {
        output.stderr.write(item.code + " " + item.path + ": " + item.message + "\n");
      });
      return 1;
    }
    output.stderr.write((error && error.stack) ? error.stack + "\n" : String(error) + "\n");
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = Object.freeze({
  ACCEPTED_ASSETS: ACCEPTED_ASSETS,
  DEFAULT_ASSET_ROOT: DEFAULT_ASSET_ROOT,
  PACK_LIMITS: PACK_LIMITS,
  REPO_ROOT: REPO_ROOT,
  USAGE: USAGE,
  buildM01ArtInventory: buildM01ArtInventory,
  main: main,
  renderM01ArtInventory: renderM01ArtInventory,
});
