#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ArtGuide = require("./lib/aegis/art-guide.js");
const MapIr = require("./lib/aegis/map-ir.js");
const V3MapAdapter = require("./lib/aegis/v3-map-adapter.js");

function usage() {
  process.stderr.write(
    "Usage: node tools/render-aegis-art-guide.js <map.json> <output.svg> " +
    "[<mission.json> <defenses.json> <campaign-rules.json>]\n"
  );
  process.exitCode = 2;
}

function readJson(inputPath) {
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
}

function normalizeSource(args) {
  const source = readJson(args[0]);
  if (args.length === 2) return MapIr.normalizeMap(source);
  return V3MapAdapter.normalizeAndValidateMap({
    mapSource: source,
    mission: readJson(args[2]),
    defenses: readJson(args[3]),
    campaignRules: readJson(args[4]),
  });
}

function main(args) {
  if (args.length !== 2 && args.length !== 5) return usage();
  const outputPath = path.resolve(args[1]);
  const ir = normalizeSource(args);
  const model = ArtGuide.createArtGuideModel(ir);
  const bytes = ArtGuide.renderArtGuideSvg(model);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  process.stdout.write(outputPath + "\n");
}

if (require.main === module) main(process.argv.slice(2));

module.exports = Object.freeze({ main: main, normalizeSource: normalizeSource });
