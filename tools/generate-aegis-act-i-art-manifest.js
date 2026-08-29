#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { canonicalBytes } = require("./lib/aegis/canonical.js");
const { AegisContentError, fail, pointerJoin } = require("./lib/aegis/diagnostics.js");
const AssetInspector = require("./lib/aegis/asset-inspector.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ASSET_ROOT = path.join(REPO_ROOT, "games", "aegis");
const USAGE = "Usage: node tools/generate-aegis-act-i-art-manifest.js";
const MISSION_IDS = Object.freeze(["m04", "m05"]);

const PACK_LIMITS = Object.freeze({
  maxDimensionPx: 2048,
  maxIndividualBytes: 1024 * 1024,
  maxMissionTransferBytes: 3 * 1024 * 1024,
  maxMissionDecodedBytes: 64 * 1024 * 1024,
});

const DEFINITION_FIELDS = Object.freeze([
  "expectedAlphaMode",
  "expectedDecodedBytes",
  "expectedFormat",
  "expectedHeightPx",
  "expectedSha256",
  "expectedTransferBytes",
  "expectedWidthPx",
  "id",
  "kind",
  "missionId",
  "relativeUrl",
  "usage",
]);

function acceptedAsset(values) {
  return Object.freeze(values);
}

const ACCEPTED_ASSETS = Object.freeze([
  acceptedAsset({
    id: "asset.m04.environment.piraeus-switchyard",
    missionId: "m04",
    kind: "bitmap",
    usage: "mission-environment",
    relativeUrl: "art/v2/m04/environment-piraeus-switchyard-v1.webp",
    expectedFormat: "webp",
    expectedSha256: "sha256:93df4c0b34fcbd134d21abb2ba399a2cdd95e9e5bbfe0645a31704b8cc008b1a",
    expectedWidthPx: 2048,
    expectedHeightPx: 1280,
    expectedAlphaMode: "opaque",
    expectedTransferBytes: 755926,
    expectedDecodedBytes: 10485760,
  }),
  acceptedAsset({
    id: "asset.m04.road.harbor-limestone",
    missionId: "m04",
    kind: "bitmap",
    usage: "road-texture",
    relativeUrl: "art/v2/m04/road-harbor-limestone-v1.webp",
    expectedFormat: "webp",
    expectedSha256: "sha256:05006e356113cc83018a617ab40b3a5c7ee92054eb56c3a6922c941d120566dc",
    expectedWidthPx: 1024,
    expectedHeightPx: 1024,
    expectedAlphaMode: "opaque",
    expectedTransferBytes: 331178,
    expectedDecodedBytes: 4194304,
  }),
  acceptedAsset({
    id: "asset.m05.environment.bronze-warden",
    missionId: "m05",
    kind: "bitmap",
    usage: "mission-environment",
    relativeUrl: "art/v2/m05/environment-bronze-warden-v1.webp",
    expectedFormat: "webp",
    expectedSha256: "sha256:c026123d3a56fd362ac7c9001d7f27b414966a6bd54b24141ec086b6b35bf29d",
    expectedWidthPx: 2048,
    expectedHeightPx: 1280,
    expectedAlphaMode: "opaque",
    expectedTransferBytes: 533106,
    expectedDecodedBytes: 10485760,
  }),
  acceptedAsset({
    id: "asset.m05.road.foundry-blackstone",
    missionId: "m05",
    kind: "bitmap",
    usage: "road-texture",
    relativeUrl: "art/v2/m05/road-foundry-blackstone-v1.webp",
    expectedFormat: "webp",
    expectedSha256: "sha256:5c576956dfc90b02d1a96e63c9c6342c8fd18d362b4343fb499dbb4e86be77e4",
    expectedWidthPx: 1024,
    expectedHeightPx: 1024,
    expectedAlphaMode: "opaque",
    expectedTransferBytes: 378398,
    expectedDecodedBytes: 4194304,
  }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function positiveLimit(value, diagnosticPath) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("ACT_I_ART_INVENTORY_LIMIT", diagnosticPath,
      "Act I art limits must be positive safe integers");
  }
  return value;
}

function normalizeLimits(input) {
  const source = input || PACK_LIMITS;
  return Object.freeze({
    maxDimensionPx: positiveLimit(source.maxDimensionPx, "/limits/maxDimensionPx"),
    maxIndividualBytes: positiveLimit(source.maxIndividualBytes, "/limits/maxIndividualBytes"),
    maxMissionTransferBytes: positiveLimit(
      source.maxMissionTransferBytes,
      "/limits/maxMissionTransferBytes"
    ),
    maxMissionDecodedBytes: positiveLimit(
      source.maxMissionDecodedBytes,
      "/limits/maxMissionDecodedBytes"
    ),
  });
}

function positiveExpected(value, diagnosticPath, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("ACT_I_ART_INVENTORY_DEFINITION", diagnosticPath,
      label + " must be a positive safe integer");
  }
}

function validateDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length !== 4) {
    fail("ACT_I_ART_INVENTORY_DEFINITION", "/assetRecords",
      "Exactly four accepted M04/M05 assets are required");
  }
  let previousId = null;
  const urls = new Set();
  const counts = new Map(MISSION_IDS.map(function (missionId) { return [missionId, 0]; }));
  definitions.forEach(function (definition, index) {
    const diagnosticPath = "/assetRecords/" + index;
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      fail("ACT_I_ART_INVENTORY_DEFINITION", diagnosticPath,
        "Accepted Act I asset definitions must be objects");
    }
    const keys = Object.keys(definition).sort();
    if (keys.length !== DEFINITION_FIELDS.length ||
        keys.some(function (key, keyIndex) { return key !== DEFINITION_FIELDS[keyIndex]; })) {
      fail("ACT_I_ART_INVENTORY_DEFINITION", diagnosticPath,
        "Accepted Act I asset definitions require exact fields");
    }
    if (typeof definition.id !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(definition.id) ||
        (previousId !== null && previousId >= definition.id)) {
      fail("ACT_I_ART_INVENTORY_ORDER", pointerJoin(diagnosticPath, "id"),
        "Accepted Act I asset IDs must be stable, unique, and strict ASCII sorted");
    }
    previousId = definition.id;
    if (!counts.has(definition.missionId)) {
      fail("ACT_I_ART_INVENTORY_DEFINITION", pointerJoin(diagnosticPath, "missionId"),
        "Accepted Act I assets belong only to M04 or M05");
    }
    counts.set(definition.missionId, counts.get(definition.missionId) + 1);
    if (definition.kind !== "bitmap" ||
        (definition.usage !== "mission-environment" && definition.usage !== "road-texture")) {
      fail("ACT_I_ART_INVENTORY_DEFINITION", diagnosticPath,
        "Accepted Act I assets require bitmap kind and a supported usage");
    }
    const expectedPrefix = "art/v2/" + definition.missionId + "/";
    if (typeof definition.relativeUrl !== "string" ||
        !definition.relativeUrl.startsWith(expectedPrefix) ||
        !/^[A-Za-z0-9/_-]+\.webp$/.test(definition.relativeUrl) ||
        urls.has(definition.relativeUrl)) {
      fail("ACT_I_ART_INVENTORY_DEFINITION", pointerJoin(diagnosticPath, "relativeUrl"),
        "Accepted Act I assets require unique mission-bound WebP URLs");
    }
    urls.add(definition.relativeUrl);
    if (definition.expectedFormat !== "webp" ||
        typeof definition.expectedSha256 !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(definition.expectedSha256) ||
        definition.expectedAlphaMode !== "opaque") {
      fail("ACT_I_ART_INVENTORY_DEFINITION", diagnosticPath,
        "Accepted Act I assets require locked WebP, SHA-256, and opaque contracts");
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
  MISSION_IDS.forEach(function (missionId) {
    if (counts.get(missionId) !== 2) {
      fail("ACT_I_ART_INVENTORY_DEFINITION", "/assetRecords",
        "Each accepted Act I mission requires one environment and one road asset");
    }
    const usages = definitions.filter(function (definition) {
      return definition.missionId === missionId;
    }).map(function (definition) { return definition.usage; }).sort();
    if (usages[0] !== "mission-environment" || usages[1] !== "road-texture") {
      fail("ACT_I_ART_INVENTORY_DEFINITION", "/assetRecords",
        "Each accepted Act I mission requires one environment and one road asset");
    }
  });
  return definitions;
}

function requireExpectedMeasurement(definition, measured, diagnosticPath) {
  [
    ["format", definition.expectedFormat],
    ["sha256", definition.expectedSha256],
    ["widthPx", definition.expectedWidthPx],
    ["heightPx", definition.expectedHeightPx],
    ["alphaMode", definition.expectedAlphaMode],
    ["transferBytes", definition.expectedTransferBytes],
    ["decodedBytes", definition.expectedDecodedBytes],
  ].forEach(function (claim) {
    if (measured[claim[0]] !== claim[1]) {
      fail("ACT_I_ART_INVENTORY_MEASUREMENT", pointerJoin(diagnosticPath, claim[0]),
        "Accepted Act I asset does not match its locked measured contract");
    }
  });
}

function measuredRecord(definition, measured) {
  return Object.freeze({
    id: definition.id,
    missionId: definition.missionId,
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

function checkedAdd(left, right, diagnosticPath) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    fail("ACT_I_ART_INVENTORY_BUDGET", diagnosticPath,
      "Act I art byte totals exceed safe integer arithmetic");
  }
  return result;
}

function largestRecord(records) {
  return records.reduce(function (largest, record) {
    if (!largest || record.transferBytes > largest.transferBytes ||
        (record.transferBytes === largest.transferBytes && record.id < largest.id)) {
      return record;
    }
    return largest;
  }, null);
}

function buildActIArtInventory(options) {
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

  const missionTotals = MISSION_IDS.map(function (missionId, missionIndex) {
    const missionRecords = records.filter(function (record) { return record.missionId === missionId; });
    const transferBytes = missionRecords.reduce(function (total, record) {
      return checkedAdd(total, record.transferBytes, "/missionTotals/" + missionIndex + "/transferBytes");
    }, 0);
    const decodedBytes = missionRecords.reduce(function (total, record) {
      return checkedAdd(total, record.decodedBytes, "/missionTotals/" + missionIndex + "/decodedBytes");
    }, 0);
    if (transferBytes > limits.maxMissionTransferBytes) {
      fail("ACT_I_ART_INVENTORY_BUDGET", "/missionTotals/" + missionIndex + "/transferBytes",
        "Accepted mission art exceeds its three-megabyte transfer budget");
    }
    if (decodedBytes > limits.maxMissionDecodedBytes) {
      fail("ACT_I_ART_INVENTORY_BUDGET", "/missionTotals/" + missionIndex + "/decodedBytes",
        "Accepted mission art exceeds its decoded-memory budget");
    }
    const largest = largestRecord(missionRecords);
    return {
      missionId: missionId,
      assetCount: missionRecords.length,
      transferBytes: transferBytes,
      decodedBytes: decodedBytes,
      largestAssetId: largest.id,
      largestAssetTransferBytes: largest.transferBytes,
      remainingTransferBytes: limits.maxMissionTransferBytes - transferBytes,
      remainingDecodedBytes: limits.maxMissionDecodedBytes - decodedBytes,
    };
  });

  let transferBytes = 0;
  let decodedBytes = 0;
  let maximumDimensionPx = 0;
  records.forEach(function (record) {
    transferBytes = checkedAdd(transferBytes, record.transferBytes, "/totals/transferBytes");
    decodedBytes = checkedAdd(decodedBytes, record.decodedBytes, "/totals/decodedBytes");
    maximumDimensionPx = Math.max(maximumDimensionPx, record.widthPx, record.heightPx);
  });
  const largest = largestRecord(records);

  return deepFreeze({
    schemaVersion: 1,
    id: "inventory.act-i.m04-m05.static-art-v1",
    scope: "act-i-developer-preview",
    assetRoot: "games/aegis",
    assetRecords: records,
    missionTotals: missionTotals,
    totals: {
      missionCount: missionTotals.length,
      assetCount: records.length,
      transferBytes: transferBytes,
      decodedBytes: decodedBytes,
      maximumDimensionPx: maximumDimensionPx,
      largestAssetId: largest.id,
      largestAssetTransferBytes: largest.transferBytes,
    },
    budgets: {
      maxMissionTransferBytes: limits.maxMissionTransferBytes,
      maxMissionDecodedBytes: limits.maxMissionDecodedBytes,
      maxDimensionPx: limits.maxDimensionPx,
      maxIndividualBytes: limits.maxIndividualBytes,
    },
  });
}

function renderActIArtInventory(inventory) {
  return Buffer.concat([canonicalBytes(inventory), Buffer.from("\n", "utf8")]);
}

function main(argv, io, options) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  if (argv.length !== 0) {
    output.stderr.write(USAGE + "\n");
    return 2;
  }
  try {
    output.stdout.write(renderActIArtInventory(buildActIArtInventory(options)));
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
  MISSION_IDS: MISSION_IDS,
  PACK_LIMITS: PACK_LIMITS,
  REPO_ROOT: REPO_ROOT,
  USAGE: USAGE,
  buildActIArtInventory: buildActIArtInventory,
  main: main,
  renderActIArtInventory: renderActIArtInventory,
});
