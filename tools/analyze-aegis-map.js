#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { AegisContentError, fail } = require("./lib/aegis/diagnostics.js");
const { canonicalBytes } = require("./lib/aegis/canonical.js");
const { CAMPAIGN_MISSION_ID } = require("./lib/aegis/contracts.js");
const { loadSourceTree } = require("./lib/aegis/source-loader.js");
const Validation = require("./lib/aegis/map-validation.js");
const Report = require("./lib/aegis/map-report.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const CONTENT_SOURCE_ROOT = path.join(REPO_ROOT, "games", "aegis", "content");
const MAP_REPORT_DIR = path.join(REPO_ROOT, "docs", "aegis-balance", "maps");
const LEGACY_SOURCE = path.join(REPO_ROOT, "games", "aegis", "tests", "fixtures", "maps", "legacy-proving-ground.json");
const LEGACY_ID = "legacy-proving-ground";
const MISSION_ID = CAMPAIGN_MISSION_ID;
const USAGE = [
  "Usage:",
  "  node tools/analyze-aegis-map.js --mission <id> --check",
  "  node tools/analyze-aegis-map.js --all --check",
  "  node tools/analyze-aegis-map.js --mission <id> --write",
  "  node tools/analyze-aegis-map.js --mission legacy-proving-ground --report-known-issues",
].join("\n");

function usageError(message) {
  const error = new Error(message);
  error.name = "AegisMapUsageError";
  error.usage = true;
  return error;
}

function parseArgs(argv) {
  let mission = null;
  let all = false;
  let action = null;
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--mission") {
      if (mission !== null || all) throw usageError("Choose exactly one of --mission and --all");
      index++;
      if (index >= argv.length || !MISSION_ID.test(argv[index])) throw usageError("--mission requires a stable lowercase mission ID");
      mission = argv[index];
    } else if (token === "--all") {
      if (all || mission !== null) throw usageError("Choose exactly one of --mission and --all");
      all = true;
    } else if (token === "--check" || token === "--write" || token === "--report-known-issues") {
      if (action !== null) throw usageError("Choose exactly one action");
      action = token.slice(2);
    } else {
      throw usageError("Unknown argument " + token);
    }
  }
  if ((mission === null) === !all) throw usageError("Choose exactly one of --mission and --all");
  if (action === null) throw usageError("Choose one of --check, --write, or --report-known-issues");
  if (all && action !== "check") throw usageError("--all is valid only with --check");
  if (mission === LEGACY_ID && action !== "report-known-issues") throw usageError("Legacy proving ground is report-only; use --report-known-issues");
  if (mission !== LEGACY_ID && action === "report-known-issues") throw usageError("--report-known-issues is reserved for legacy-proving-ground");
  return Object.freeze({ mission: mission, all: all, action: action });
}

function campaignSourceTree(source) {
  if (source && Array.isArray(source.missionMaps) && source.paths) return source;
  return loadSourceTree(source || CONTENT_SOURCE_ROOT);
}

function declaredMission(id, source) {
  if (!MISSION_ID.test(id) || id === LEGACY_ID) fail("MAP_MISSION_ID", "/id", "Invalid campaign mission ID " + id);
  const tree = campaignSourceTree(source);
  const index = tree.missionMaps.findIndex(function (mission) { return mission.id === id; });
  if (index === -1) fail("MAP_MISSION_MISSING", "/id", "No campaign source is declared for " + id);
  return Object.freeze({
    tree: tree,
    index: index,
    mission: tree.missionMaps[index],
    path: tree.paths.missionMaps[index],
  });
}

function sourcePathForMission(id, source) {
  return declaredMission(id, source).path;
}

function artifactPaths(id) {
  if (!MISSION_ID.test(id) || id === LEGACY_ID) fail("MAP_MISSION_ID", "/id", "Invalid campaign mission ID " + id);
  return Object.freeze({
    report: path.join(MAP_REPORT_DIR, id + "-pad-report.json"),
    svg: path.join(MAP_REPORT_DIR, id + "-pad-heatmap.svg"),
  });
}

function listMissionIds(source) {
  return campaignSourceTree(source).missionMaps.map(function (mission) { return mission.id; });
}

function loadMission(id, source) {
  return declaredMission(id, source).mission.compiled;
}

function compareArtifact(expected, target, label) {
  if (!fs.existsSync(target)) fail("MAP_ARTIFACT_STALE", target, label + " is missing; regenerate it with explicit --write");
  const actual = fs.readFileSync(target);
  if (!actual.equals(expected)) fail("MAP_ARTIFACT_STALE", target, label + " is stale; regenerate it with explicit --write");
}

function checkMissionArtifacts(id, artifacts, paths) {
  const targets = paths || artifactPaths(id);
  compareArtifact(artifacts.reportBytes, targets.report, id + " pad report");
  compareArtifact(artifacts.svgBytes, targets.svg, id + " pad heatmap");
}

function writeMissionArtifacts(id, artifacts) {
  const targets = artifactPaths(id);
  fs.mkdirSync(MAP_REPORT_DIR, { recursive: true });
  fs.writeFileSync(targets.report, artifacts.reportBytes);
  fs.writeFileSync(targets.svg, artifacts.svgBytes);
  return targets;
}

function analyzeCampaign(id, source) {
  const validated = loadMission(id, source);
  return { validated: validated, artifacts: Report.createMissionArtifacts(validated) };
}

function execute(options, io) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  if (options.mission === LEGACY_ID) {
    const source = Validation.readMapFile(LEGACY_SOURCE);
    const report = Validation.validateLegacyMap(source);
    output.stdout.write(Buffer.concat([canonicalBytes(report), Buffer.from("\n", "utf8")]));
    return 0;
  }
  const tree = campaignSourceTree();
  const ids = options.all ? listMissionIds(tree) : [options.mission];
  if (ids.length === 0) fail("MAP_MISSION_MISSING", "/", "No campaign maps were found");
  for (const id of ids) {
    const result = analyzeCampaign(id, tree);
    if (options.action === "check") {
      checkMissionArtifacts(id, result.artifacts);
      output.stdout.write(id + ": deterministic map report and heatmap are current\n");
    } else {
      const targets = writeMissionArtifacts(id, result.artifacts);
      output.stdout.write(id + ": wrote " + path.relative(REPO_ROOT, targets.report).replace(/\\/g, "/") +
        " and " + path.relative(REPO_ROOT, targets.svg).replace(/\\/g, "/") + "\n");
    }
  }
  return 0;
}

function main(argv, io) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  try {
    return execute(parseArgs(argv), output);
  } catch (error) {
    if (error && error.usage) {
      output.stderr.write(error.message + "\n" + USAGE + "\n");
      return 2;
    }
    if (error instanceof AegisContentError) {
      for (const item of error.diagnostics) output.stderr.write(item.code + " " + item.path + ": " + item.message + "\n");
      return 1;
    }
    output.stderr.write((error && error.stack) ? error.stack + "\n" : String(error) + "\n");
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = Object.freeze({
  REPO_ROOT: REPO_ROOT,
  CONTENT_SOURCE_ROOT: CONTENT_SOURCE_ROOT,
  MAP_REPORT_DIR: MAP_REPORT_DIR,
  LEGACY_SOURCE: LEGACY_SOURCE,
  USAGE: USAGE,
  parseArgs: parseArgs,
  campaignSourceTree: campaignSourceTree,
  sourcePathForMission: sourcePathForMission,
  artifactPaths: artifactPaths,
  listMissionIds: listMissionIds,
  loadMission: loadMission,
  checkMissionArtifacts: checkMissionArtifacts,
  analyzeCampaign: analyzeCampaign,
  execute: execute,
  main: main,
});
