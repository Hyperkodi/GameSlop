#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { canonicalBytes } = require("./lib/aegis/canonical.js");
const { AegisContentError, fail, pointerJoin } = require("./lib/aegis/diagnostics.js");
const AssetInspector = require("./lib/aegis/asset-inspector.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ASSET_ROOT = path.join(REPO_ROOT, "games", "aegis");
const USAGE = "Usage: node tools/generate-aegis-ui-art-manifest.js";

const PACK_LIMITS = Object.freeze({
  maxDecodedBytes: 64 * 1024 * 1024,
  maxDimensionPx: 2048,
  maxIndividualBytes: 1024 * 1024,
  maxTransferBytes: 2 * 1024 * 1024,
});

function acceptedAsset(id, usage, relativeUrl, sha256, widthPx, heightPx, transferBytes, decodedBytes) {
  return Object.freeze({
    id: id,
    kind: "bitmap",
    usage: usage,
    relativeUrl: relativeUrl,
    expectedFormat: "webp",
    expectedSha256: sha256,
    expectedWidthPx: widthPx,
    expectedHeightPx: heightPx,
    expectedAlphaMode: "opaque",
    expectedTransferBytes: transferBytes,
    expectedDecodedBytes: decodedBytes,
  });
}

const ACCEPTED_ASSETS = Object.freeze([
  acceptedAsset(
    "asset.ui.act-1.attican",
    "act-banner",
    "art/v2/ui/act-1-attican-v1.webp",
    "sha256:74436d1282be0c0f75f4b54cf4f55a8f49050f4a4d5e5fafdcdc4bcd970bc318",
    1536, 512, 96646, 3145728
  ),
  acceptedAsset(
    "asset.ui.act-2.aegean",
    "act-banner",
    "art/v2/ui/act-2-aegean-v1.webp",
    "sha256:a003a2845d01941db5cc9c33c8d39f1b82f182a445681634fbf7cdd30a76dd00",
    1536, 512, 114116, 3145728
  ),
  acceptedAsset(
    "asset.ui.act-3.oracle",
    "act-banner",
    "art/v2/ui/act-3-oracle-v1.webp",
    "sha256:166d07726db6f5feb2f19eaf084c82b818a90936328b3e1cd37db01f783d7083",
    1536, 512, 99210, 3145728
  ),
  acceptedAsset(
    "asset.ui.act-4.titan",
    "act-banner",
    "art/v2/ui/act-4-titan-v1.webp",
    "sha256:f79cfa5fbfa9054e112526c71bb44cb35fe706cc1271dc73c54016348efdbe61",
    1536, 512, 126656, 3145728
  ),
  acceptedAsset(
    "asset.ui.panel.4x3",
    "ui-panel",
    "art/v2/ui/panel-4x3-v1.webp",
    "sha256:c836b8c4361c6b611dcf1ff73ef3de3b36fca2c3c345d6c36692777bf045e540",
    1024, 768, 42810, 3145728
  ),
  acceptedAsset(
    "asset.ui.shell.landscape",
    "shell-background",
    "art/v2/ui/shell-landscape-v1.webp",
    "sha256:d69c8a853491631e10a02b983d90a188d260818200ea527e0f4ddaf214e114f9",
    2048, 1280, 323520, 10485760
  ),
  acceptedAsset(
    "asset.ui.shell.portrait",
    "shell-background",
    "art/v2/ui/shell-portrait-v1.webp",
    "sha256:9e9842ef92e64b412fb810eb3185073d6eac055d636ded63e4ab4bd9b2706bc8",
    1000, 1600, 228712, 6400000
  ),
  acceptedAsset(
    "asset.ui.victory-share",
    "victory-share-background",
    "art/v2/ui/victory-share-v1.webp",
    "sha256:c815e08a1fa9243bc64d91649feca498c353f1976635c2edd0da92abda9e1b39",
    1200, 630, 102808, 3024000
  ),
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function positiveLimit(value, diagnosticPath) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("UI_ART_INVENTORY_LIMIT", diagnosticPath, "UI-art limits must be positive safe integers");
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

function positiveExpected(value, diagnosticPath, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("UI_ART_INVENTORY_DEFINITION", diagnosticPath, label + " must be a positive safe integer");
  }
}

function validateDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length !== 8) {
    fail("UI_ART_INVENTORY_DEFINITION", "/assetRecords", "Exactly eight accepted global UI assets are required");
  }
  let previousId = null;
  const urls = new Set();
  definitions.forEach(function (definition, index) {
    const diagnosticPath = "/assetRecords/" + index;
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      fail("UI_ART_INVENTORY_DEFINITION", diagnosticPath, "Accepted UI asset definitions must be objects");
    }
    if (typeof definition.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(definition.id) ||
        (previousId !== null && previousId >= definition.id)) {
      fail("UI_ART_INVENTORY_ORDER", pointerJoin(diagnosticPath, "id"),
        "Accepted UI asset IDs must be stable, unique, and ASCII sorted");
    }
    previousId = definition.id;
    if (definition.kind !== "bitmap" || typeof definition.usage !== "string" || !definition.usage) {
      fail("UI_ART_INVENTORY_DEFINITION", diagnosticPath, "Accepted UI assets require bitmap kind and usage");
    }
    if (typeof definition.relativeUrl !== "string" ||
        !/^art\/v2\/ui\/[A-Za-z0-9._-]+\.webp$/.test(definition.relativeUrl) ||
        urls.has(definition.relativeUrl)) {
      fail("UI_ART_INVENTORY_DEFINITION", pointerJoin(diagnosticPath, "relativeUrl"),
        "Accepted UI assets require unique art/v2/ui WebP URLs");
    }
    urls.add(definition.relativeUrl);
    if (definition.expectedFormat !== "webp" ||
        typeof definition.expectedSha256 !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(definition.expectedSha256) ||
        definition.expectedAlphaMode !== "opaque") {
      fail("UI_ART_INVENTORY_DEFINITION", diagnosticPath,
        "Accepted UI assets require locked WebP, SHA-256, and opaque contracts");
    }
    [
      ["expectedWidthPx", "Expected width"],
      ["expectedHeightPx", "Expected height"],
      ["expectedTransferBytes", "Expected transfer bytes"],
      ["expectedDecodedBytes", "Expected decoded bytes"],
    ].forEach(function (entry) {
      positiveExpected(definition[entry[0]], pointerJoin(diagnosticPath, entry[0]), entry[1]);
    });
  });
  return definitions;
}

function requireExpectedMeasurement(definition, measured, diagnosticPath) {
  const claims = [
    ["format", definition.expectedFormat],
    ["sha256", definition.expectedSha256],
    ["widthPx", definition.expectedWidthPx],
    ["heightPx", definition.expectedHeightPx],
    ["alphaMode", definition.expectedAlphaMode],
    ["transferBytes", definition.expectedTransferBytes],
    ["decodedBytes", definition.expectedDecodedBytes],
  ];
  claims.forEach(function (entry) {
    if (measured[entry[0]] !== entry[1]) {
      fail(
        "UI_ART_INVENTORY_MEASUREMENT",
        pointerJoin(diagnosticPath, entry[0]),
        "Accepted UI asset does not match its locked measured contract"
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

function buildUiArtInventory(options) {
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
    fail("UI_ART_INVENTORY_BUDGET", "/totals", "UI-art byte totals exceed safe integer arithmetic");
  }
  if (maximumDimensionPx > limits.maxDimensionPx) {
    fail("UI_ART_INVENTORY_BUDGET", "/budgets/maxDimensionPx", "Accepted UI art exceeds its dimension budget");
  }
  if (records.some(function (record) { return record.transferBytes > limits.maxIndividualBytes; })) {
    fail("UI_ART_INVENTORY_BUDGET", "/budgets/maxIndividualBytes", "Accepted UI art exceeds its individual-file budget");
  }
  if (transferBytes > limits.maxTransferBytes) {
    fail("UI_ART_INVENTORY_BUDGET", "/budgets/maxTransferBytes", "Accepted UI art exceeds its transfer budget");
  }
  if (decodedBytes > limits.maxDecodedBytes) {
    fail("UI_ART_INVENTORY_BUDGET", "/budgets/maxDecodedBytes", "Accepted UI art exceeds its decoded-memory budget");
  }

  return deepFreeze({
    schemaVersion: 1,
    id: "inventory.ui.static-art-v1",
    scope: "global-ui",
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

function renderUiArtInventory(inventory) {
  return Buffer.concat([canonicalBytes(inventory), Buffer.from("\n", "utf8")]);
}

function main(argv, io, options) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  if (argv.length !== 0) {
    output.stderr.write(USAGE + "\n");
    return 2;
  }
  try {
    output.stdout.write(renderUiArtInventory(buildUiArtInventory(options)));
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
  buildUiArtInventory: buildUiArtInventory,
  main: main,
  renderUiArtInventory: renderUiArtInventory,
});
