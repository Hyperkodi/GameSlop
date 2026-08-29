#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const MapIr = require("./lib/aegis/map-ir.js");
const PlayerRoad = require("./lib/aegis/m01-player-road-preview.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, "docs/aegis/art-guides/m01-player-road-preview.svg");
const M01_SOURCE_PATH = path.join(REPO_ROOT, "games/aegis/content/maps/m01.json");
const APPROVED_ASSET_FILES = Object.freeze({
  environment: "environment-gate-of-dawn-v4.webp",
  earth: "road-earth-v2.webp",
  limestone: "road-limestone-v2.webp",
  cityCobble: "road-city-cobble-v2.webp",
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function threeByteLittleEndian(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(value, labelValue) {
  const label = labelValue || "WebP asset";
  if (!Buffer.isBuffer(value)) throw new TypeError(label + " must be a Buffer");
  if (value.length < 30 || value.toString("ascii", 0, 4) !== "RIFF" ||
      value.toString("ascii", 8, 12) !== "WEBP") {
    throw new TypeError(label + " must be a complete RIFF WebP file");
  }
  if (value.readUInt32LE(4) + 8 !== value.length) {
    throw new RangeError(label + " RIFF byte length is inconsistent");
  }
  let offset = 12;
  while (offset + 8 <= value.length) {
    const kind = value.toString("ascii", offset, offset + 4);
    const size = value.readUInt32LE(offset + 4);
    const payload = offset + 8;
    const end = payload + size;
    if (end > value.length) throw new RangeError(label + " contains a truncated " + kind + " chunk");
    if (kind === "VP8X") {
      if (size < 10) throw new RangeError(label + " contains a short VP8X header");
      return deepFreeze({
        width: threeByteLittleEndian(value, payload + 4) + 1,
        height: threeByteLittleEndian(value, payload + 7) + 1,
      });
    }
    if (kind === "VP8 ") {
      if (size < 10 || value[payload + 3] !== 0x9d || value[payload + 4] !== 0x01 ||
          value[payload + 5] !== 0x2a) {
        throw new RangeError(label + " contains an invalid VP8 key-frame header");
      }
      return deepFreeze({
        width: value.readUInt16LE(payload + 6) & 0x3fff,
        height: value.readUInt16LE(payload + 8) & 0x3fff,
      });
    }
    if (kind === "VP8L") {
      if (size < 5 || value[payload] !== 0x2f) {
        throw new RangeError(label + " contains an invalid VP8L header");
      }
      const bits = value.readUInt32LE(payload + 1);
      return deepFreeze({
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      });
    }
    offset = end + (size % 2);
  }
  throw new TypeError(label + " contains no supported WebP image chunk");
}

function embeddedAsset(filePath, expected, label) {
  const bytes = fs.readFileSync(filePath);
  const dimensions = readWebpDimensions(bytes, label);
  if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
    throw new RangeError(label + " must be " + expected.width + " x " + expected.height + " pixels");
  }
  return {
    id: expected.id,
    dimensions: { width: dimensions.width, height: dimensions.height },
    href: "data:image/webp;base64," + bytes.toString("base64"),
  };
}

function loadApprovedAssets(repoRootValue) {
  const repoRoot = path.resolve(repoRootValue || REPO_ROOT);
  const directory = path.join(repoRoot, "games/aegis/art/v2/m01");
  const assets = {};
  Object.keys(APPROVED_ASSET_FILES).forEach(function (key) {
    assets[key] = embeddedAsset(
      path.join(directory, APPROVED_ASSET_FILES[key]),
      PlayerRoad.EXPECTED_ASSETS[key],
      "Approved M01 " + key + " asset"
    );
  });
  return deepFreeze(assets);
}

function main(argsValue, ioValue) {
  const args = Array.isArray(argsValue) ? argsValue : [];
  if (args.length > 1) {
    throw new TypeError("Usage: node tools/render-aegis-m01-road-preview.js [output.svg]");
  }
  const io = ioValue || { stdout: process.stdout };
  if (!io || !io.stdout || typeof io.stdout.write !== "function") {
    throw new TypeError("Renderer IO requires stdout.write");
  }
  const outputPath = path.resolve(args.length === 1 ? args[0] : DEFAULT_OUTPUT_PATH);
  const source = JSON.parse(fs.readFileSync(M01_SOURCE_PATH, "utf8"));
  const ir = MapIr.normalizeMap(source);
  const model = PlayerRoad.createM01PlayerRoadModel(ir, loadApprovedAssets(REPO_ROOT));
  const bytes = PlayerRoad.renderM01PlayerRoadSvg(model);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  io.stdout.write(outputPath + "\n");
  return outputPath;
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write((error && error.stack ? error.stack : String(error)) + "\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  APPROVED_ASSET_FILES: APPROVED_ASSET_FILES,
  DEFAULT_OUTPUT_PATH: DEFAULT_OUTPUT_PATH,
  loadApprovedAssets: loadApprovedAssets,
  main: main,
  readWebpDimensions: readWebpDimensions,
});
