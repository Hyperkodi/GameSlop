#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { canonicalBytes } = require("./lib/aegis/canonical.js");
const { AegisContentError, fail, pointerJoin } = require("./lib/aegis/diagnostics.js");
const AssetInspector = require("./lib/aegis/asset-inspector.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ASSET_ROOT = path.join(REPO_ROOT, "games", "aegis");
const USAGE = "Usage: node tools/generate-aegis-m01-gameplay-art-manifest.js";
const FRAME_WIDTH_PX = 256;
const FRAME_HEIGHT_PX = 256;
const ATLAS_WIDTH_PX = 1024;
const PORTABLE_WEBP = /^[a-z0-9][a-z0-9._/-]*\.webp$/;
const STABLE_ID = /^[a-z0-9][a-z0-9._-]*$/;

const PACK_LIMITS = Object.freeze({
  maxAggregateDecodedBytes: 16 * 1024 * 1024,
  maxAggregateTransferBytes: 2 * 1024 * 1024,
  maxDimensionPx: 1024,
  maxIndividualDecodedBytes: 4 * 1024 * 1024,
  maxIndividualTransferBytes: 1024 * 1024,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function row(id, stateIds) {
  return deepFreeze({ id: id, stateIds: stateIds.slice() });
}

const ENEMY_ROWS = deepFreeze([
  row("movement", ["idle-a", "idle-b", "run-a", "run-b"]),
  row("combat", ["run-c", "hit", "stagger", "defeat"]),
]);

const TOWER_ROWS = deepFreeze([
  row("level-1", ["idle-a", "idle-b", "active-fire", "recovery-hit"]),
  row("level-2", ["idle-a", "idle-b", "active-fire", "recovery-hit"]),
  row("level-3", ["idle-a", "idle-b", "active-fire", "recovery-hit"]),
]);

function acceptedAtlas(id, ownerId, usage, relativeUrl, heightPx, rows) {
  return deepFreeze({
    id: id,
    kind: "atlas",
    ownerId: ownerId,
    usage: usage,
    relativeUrl: relativeUrl,
    expectedWidthPx: ATLAS_WIDTH_PX,
    expectedHeightPx: heightPx,
    expectedAlphaMode: "alpha",
    columns: 4,
    rows: rows,
  });
}

const ACCEPTED_ATLASES = deepFreeze([
  acceptedAtlas(
    "asset.m01.enemy.raider.atlas",
    "raider",
    "enemy-atlas",
    "art/v2/m01/enemies/raider-anim-v1.webp",
    512,
    ENEMY_ROWS
  ),
  acceptedAtlas(
    "asset.m01.enemy.scout.atlas",
    "scout",
    "enemy-atlas",
    "art/v2/m01/enemies/scout-anim-v1.webp",
    512,
    ENEMY_ROWS
  ),
  acceptedAtlas(
    "asset.m01.tower.chronos.atlas",
    "chronos",
    "tower-atlas",
    "art/v2/m01/towers/chronos-anim-v1.webp",
    768,
    TOWER_ROWS
  ),
  acceptedAtlas(
    "asset.m01.tower.sentinel.atlas",
    "sentinel",
    "tower-atlas",
    "art/v2/m01/towers/sentinel-anim-v1.webp",
    768,
    TOWER_ROWS
  ),
  acceptedAtlas(
    "asset.m01.tower.siege.atlas",
    "siege",
    "tower-atlas",
    "art/v2/m01/towers/siege-anim-v1.webp",
    768,
    TOWER_ROWS
  ),
]);

const DEFINITION_FIELDS = Object.freeze([
  "id", "kind", "ownerId", "usage", "relativeUrl", "expectedWidthPx",
  "expectedHeightPx", "expectedAlphaMode", "columns", "rows",
]);

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function plainObject(value, diagnosticPath) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail("M01_GAMEPLAY_ART_DEFINITION", diagnosticPath, "Gameplay-art definitions must be plain objects");
  }
  return value;
}

function exactFields(value, fields, diagnosticPath) {
  plainObject(value, diagnosticPath);
  const allowed = new Set(fields);
  Object.keys(value).forEach(function (key) {
    if (!allowed.has(key)) {
      fail("M01_GAMEPLAY_ART_DEFINITION", pointerJoin(diagnosticPath, key), "Unknown definition field");
    }
  });
  fields.forEach(function (key) {
    if (!own(value, key)) {
      fail("M01_GAMEPLAY_ART_DEFINITION", pointerJoin(diagnosticPath, key), "Missing definition field");
    }
  });
}

function positiveInteger(value, diagnosticPath) {
  if (!Number.isSafeInteger(value) || value <= 0 || Object.is(value, -0)) {
    fail("M01_GAMEPLAY_ART_DEFINITION", diagnosticPath, "Expected a positive safe integer");
  }
  return value;
}

function stableId(value, diagnosticPath) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail("M01_GAMEPLAY_ART_DEFINITION", diagnosticPath, "Expected a lowercase stable ID");
  }
  return value;
}

function sameStringArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every(function (value, index) {
    return value === right[index];
  });
}

function validateRows(rows, expectedRows, columns, diagnosticPath) {
  if (!Array.isArray(rows) || rows.length !== expectedRows.length) {
    fail("M01_GAMEPLAY_ART_SEMANTICS", diagnosticPath, "Atlas row count differs from its semantic contract");
  }
  rows.forEach(function (record, rowIndex) {
    const pathForRow = pointerJoin(diagnosticPath, rowIndex);
    exactFields(record, ["id", "stateIds"], pathForRow);
    stableId(record.id, pointerJoin(pathForRow, "id"));
    if (record.id !== expectedRows[rowIndex].id ||
        !sameStringArray(record.stateIds, expectedRows[rowIndex].stateIds) ||
        record.stateIds.length !== columns) {
      fail("M01_GAMEPLAY_ART_SEMANTICS", pathForRow, "Atlas row/column states differ from the reviewed contract");
    }
    const seen = new Set();
    record.stateIds.forEach(function (stateId, columnIndex) {
      stableId(stateId, pointerJoin(pointerJoin(pathForRow, "stateIds"), columnIndex));
      if (seen.has(stateId)) {
        fail("M01_GAMEPLAY_ART_SEMANTICS", pointerJoin(pointerJoin(pathForRow, "stateIds"), columnIndex),
          "Semantic states must be unique within a row");
      }
      seen.add(stateId);
    });
  });
}

function validateDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length !== ACCEPTED_ATLASES.length) {
    fail("M01_GAMEPLAY_ART_DEFINITION", "/atlasRecords", "M01 requires exactly five gameplay atlases");
  }
  const requiredById = new Map(ACCEPTED_ATLASES.map(function (record) { return [record.id, record]; }));
  const urls = new Set();
  let priorId = null;
  definitions.forEach(function (definition, index) {
    const diagnosticPath = "/atlasRecords/" + index;
    exactFields(definition, DEFINITION_FIELDS, diagnosticPath);
    stableId(definition.id, pointerJoin(diagnosticPath, "id"));
    if (priorId !== null && priorId >= definition.id) {
      fail("M01_GAMEPLAY_ART_ORDER", pointerJoin(diagnosticPath, "id"), "Atlas IDs must be unique and ASCII sorted");
    }
    priorId = definition.id;
    const expected = requiredById.get(definition.id);
    if (!expected) {
      fail("M01_GAMEPLAY_ART_DEFINITION", pointerJoin(diagnosticPath, "id"), "Unexpected M01 gameplay atlas ID");
    }
    if (definition.kind !== expected.kind || definition.ownerId !== expected.ownerId ||
        definition.usage !== expected.usage || definition.relativeUrl !== expected.relativeUrl ||
        definition.expectedWidthPx !== expected.expectedWidthPx ||
        definition.expectedHeightPx !== expected.expectedHeightPx ||
        definition.expectedAlphaMode !== "alpha" || definition.columns !== 4) {
      fail("M01_GAMEPLAY_ART_DEFINITION", diagnosticPath, "Atlas identity, path, dimensions, or grid differs from the reviewed contract");
    }
    stableId(definition.ownerId, pointerJoin(diagnosticPath, "ownerId"));
    if (typeof definition.relativeUrl !== "string" || !PORTABLE_WEBP.test(definition.relativeUrl) ||
        definition.relativeUrl.split("/").some(function (segment) {
          return !segment || segment === "." || segment === "..";
        })) {
      fail("M01_GAMEPLAY_ART_DEFINITION", pointerJoin(diagnosticPath, "relativeUrl"),
        "Atlas path must be canonical lowercase portable WebP");
    }
    if (urls.has(definition.relativeUrl)) {
      fail("M01_GAMEPLAY_ART_DEFINITION", pointerJoin(diagnosticPath, "relativeUrl"), "Atlas paths must be unique");
    }
    urls.add(definition.relativeUrl);
    positiveInteger(definition.expectedWidthPx, pointerJoin(diagnosticPath, "expectedWidthPx"));
    positiveInteger(definition.expectedHeightPx, pointerJoin(diagnosticPath, "expectedHeightPx"));
    positiveInteger(definition.columns, pointerJoin(diagnosticPath, "columns"));
    validateRows(definition.rows, expected.rows, definition.columns, pointerJoin(diagnosticPath, "rows"));
  });
  return definitions;
}

function normalizeLimits(input) {
  const source = input || PACK_LIMITS;
  const output = {};
  Object.keys(PACK_LIMITS).forEach(function (key) {
    const value = source[key];
    if (!Number.isSafeInteger(value) || value <= 0 || Object.is(value, -0)) {
      fail("M01_GAMEPLAY_ART_LIMIT", pointerJoin("/limits", key), "Gameplay-art limits must be positive safe integers");
    }
    output[key] = value;
  });
  return Object.freeze(output);
}

function requireExpectedMeasurement(definition, measured, diagnosticPath) {
  const expectations = [
    ["format", "webp"],
    ["widthPx", definition.expectedWidthPx],
    ["heightPx", definition.expectedHeightPx],
    ["alphaMode", definition.expectedAlphaMode],
  ];
  expectations.forEach(function (expectation) {
    if (measured[expectation[0]] !== expectation[1]) {
      fail(
        "M01_GAMEPLAY_ART_MEASUREMENT",
        pointerJoin(diagnosticPath, expectation[0]),
        "Decoded atlas does not match its reviewed format, dimensions, or alpha contract"
      );
    }
  });
}

function semanticRecords(definition) {
  const rowRecords = [];
  const frameRecords = [];
  definition.rows.forEach(function (sourceRow, rowIndex) {
    const columnStates = [];
    sourceRow.stateIds.forEach(function (stateId, columnIndex) {
      const frameId = definition.ownerId + "." + sourceRow.id + "." + stateId;
      columnStates.push({
        columnIndex: columnIndex,
        frameId: frameId,
        stateId: stateId,
      });
      frameRecords.push({
        id: frameId,
        rowIndex: rowIndex,
        columnIndex: columnIndex,
        xPx: columnIndex * FRAME_WIDTH_PX,
        yPx: rowIndex * FRAME_HEIGHT_PX,
        widthPx: FRAME_WIDTH_PX,
        heightPx: FRAME_HEIGHT_PX,
        semanticRowId: sourceRow.id,
        semanticStateId: stateId,
      });
    });
    rowRecords.push({
      rowIndex: rowIndex,
      rowId: sourceRow.id,
      columnStates: columnStates,
    });
  });
  return { frameRecords: frameRecords, rowRecords: rowRecords };
}

function measuredAtlasRecord(definition, measured, transparency, limits, diagnosticPath) {
  if (measured.transferBytes > limits.maxIndividualTransferBytes) {
    fail("M01_GAMEPLAY_ART_BUDGET", pointerJoin(diagnosticPath, "transferBytes"),
      "Atlas exceeds the per-file compressed-byte budget");
  }
  if (measured.decodedBytes > limits.maxIndividualDecodedBytes) {
    fail("M01_GAMEPLAY_ART_BUDGET", pointerJoin(diagnosticPath, "decodedBytes"),
      "Atlas exceeds the per-file decoded-byte budget");
  }
  const semantics = semanticRecords(definition);
  return {
    id: definition.id,
    kind: definition.kind,
    ownerId: definition.ownerId,
    usage: definition.usage,
    relativeUrl: measured.relativeUrl,
    format: measured.format,
    sha256: measured.sha256,
    widthPx: measured.widthPx,
    heightPx: measured.heightPx,
    alphaMode: measured.alphaMode,
    transferBytes: measured.transferBytes,
    decodedBytes: measured.decodedBytes,
    transparency: transparency,
    grid: {
      columns: definition.columns,
      rows: definition.rows.length,
      frameWidthPx: FRAME_WIDTH_PX,
      frameHeightPx: FRAME_HEIGHT_PX,
    },
    rowRecords: semantics.rowRecords,
    frameRecords: semantics.frameRecords,
    budgets: {
      maxTransferBytes: limits.maxIndividualTransferBytes,
      remainingTransferBytes: limits.maxIndividualTransferBytes - measured.transferBytes,
      maxDecodedBytes: limits.maxIndividualDecodedBytes,
      remainingDecodedBytes: limits.maxIndividualDecodedBytes - measured.decodedBytes,
    },
  };
}

function buildM01GameplayArtInventory(options) {
  options = options || {};
  const definitions = validateDefinitions(options.assetDefinitions || ACCEPTED_ATLASES);
  const limits = normalizeLimits(options.limits);
  const assetRoot = path.resolve(options.assetRoot || DEFAULT_ASSET_ROOT);
  const records = definitions.map(function (definition, index) {
    const diagnosticPath = "/atlasRecords/" + index;
    const atlasInspection = AssetInspector.inspectAtlasAsset(assetRoot, definition.relativeUrl, {
      diagnosticPath: pointerJoin(diagnosticPath, "relativeUrl"),
      ffmpegPath: options.ffmpegPath,
      maxDimensionPx: limits.maxDimensionPx,
      maxIndividualBytes: AssetInspector.DEFAULT_LIMITS.maxIndividualBytes,
      columns: definition.columns,
      rows: definition.rows.length,
      frameWidthPx: FRAME_WIDTH_PX,
      frameHeightPx: FRAME_HEIGHT_PX,
    });
    const measured = atlasInspection.inspection;
    requireExpectedMeasurement(definition, measured, diagnosticPath);
    return measuredAtlasRecord(
      definition,
      measured,
      atlasInspection.transparency,
      limits,
      diagnosticPath
    );
  });

  let transferBytes = 0;
  let decodedBytes = 0;
  let frameCount = 0;
  let largest = null;
  records.forEach(function (record) {
    transferBytes += record.transferBytes;
    decodedBytes += record.decodedBytes;
    frameCount += record.frameRecords.length;
    if (!largest || record.transferBytes > largest.transferBytes ||
        (record.transferBytes === largest.transferBytes && record.id < largest.id)) {
      largest = record;
    }
  });
  if (!Number.isSafeInteger(transferBytes) || !Number.isSafeInteger(decodedBytes)) {
    fail("M01_GAMEPLAY_ART_BUDGET", "/totals", "Gameplay-art totals exceed safe integer arithmetic");
  }
  if (transferBytes > limits.maxAggregateTransferBytes) {
    fail("M01_GAMEPLAY_ART_BUDGET", "/budgets/maxAggregateTransferBytes",
      "M01 gameplay atlases exceed the aggregate compressed-byte budget");
  }
  if (decodedBytes > limits.maxAggregateDecodedBytes) {
    fail("M01_GAMEPLAY_ART_BUDGET", "/budgets/maxAggregateDecodedBytes",
      "M01 gameplay atlases exceed the aggregate decoded-byte budget");
  }

  return deepFreeze({
    schemaVersion: 1,
    id: "inventory.m01.gameplay-art-v1",
    missionId: "m01",
    assetRoot: "games/aegis",
    frameContract: {
      frameWidthPx: FRAME_WIDTH_PX,
      frameHeightPx: FRAME_HEIGHT_PX,
    },
    atlasRecords: records,
    totals: {
      atlasCount: records.length,
      enemyAtlasCount: records.filter(function (record) { return record.usage === "enemy-atlas"; }).length,
      towerAtlasCount: records.filter(function (record) { return record.usage === "tower-atlas"; }).length,
      frameCount: frameCount,
      transferBytes: transferBytes,
      decodedBytes: decodedBytes,
      largestAtlasId: largest.id,
      largestAtlasTransferBytes: largest.transferBytes,
    },
    budgets: {
      maxAggregateTransferBytes: limits.maxAggregateTransferBytes,
      remainingAggregateTransferBytes: limits.maxAggregateTransferBytes - transferBytes,
      maxAggregateDecodedBytes: limits.maxAggregateDecodedBytes,
      remainingAggregateDecodedBytes: limits.maxAggregateDecodedBytes - decodedBytes,
      maxIndividualTransferBytes: limits.maxIndividualTransferBytes,
      maxIndividualDecodedBytes: limits.maxIndividualDecodedBytes,
      maxDimensionPx: limits.maxDimensionPx,
    },
  });
}

function renderM01GameplayArtInventory(inventory) {
  return Buffer.concat([canonicalBytes(inventory), Buffer.from("\n", "utf8")]);
}

function main(argv, io, options) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  if (argv.length !== 0) {
    output.stderr.write(USAGE + "\n");
    return 2;
  }
  try {
    output.stdout.write(renderM01GameplayArtInventory(buildM01GameplayArtInventory(options)));
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
  ACCEPTED_ATLASES: ACCEPTED_ATLASES,
  DEFAULT_ASSET_ROOT: DEFAULT_ASSET_ROOT,
  ENEMY_ROWS: ENEMY_ROWS,
  FRAME_HEIGHT_PX: FRAME_HEIGHT_PX,
  FRAME_WIDTH_PX: FRAME_WIDTH_PX,
  PACK_LIMITS: PACK_LIMITS,
  REPO_ROOT: REPO_ROOT,
  TOWER_ROWS: TOWER_ROWS,
  USAGE: USAGE,
  buildM01GameplayArtInventory: buildM01GameplayArtInventory,
  main: main,
  renderM01GameplayArtInventory: renderM01GameplayArtInventory,
});
