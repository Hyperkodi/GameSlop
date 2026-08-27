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
const Records = require("./lib/aegis/v3-record-contracts.js");
const V3MapAdapter = require("./lib/aegis/v3-map-adapter.js");

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
  "  node tools/analyze-aegis-map.js --manifest <repo-relative-file> --mission <id> --check",
  "  node tools/analyze-aegis-map.js --manifest <repo-relative-file> --all --check",
  "  node tools/analyze-aegis-map.js --manifest <repo-relative-file> --mission <id> --write",
  "  node tools/analyze-aegis-map.js --mission legacy-proving-ground --report-known-issues",
].join("\n");

function usageError(message) {
  const error = new Error(message);
  error.name = "AegisMapUsageError";
  error.usage = true;
  return error;
}

function validateManifestReference(value) {
  if (typeof value !== "string" || !value || value.startsWith("--")) {
    throw usageError("--manifest requires one repository-relative JSON file");
  }
  if (
    value.indexOf("\\") !== -1 ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /[:?#%&=]/.test(value)
  ) {
    throw usageError("--manifest must be a portable repository-relative path without URL or query syntax");
  }
  const segments = value.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
  })) {
    throw usageError("--manifest must use portable path segments without aliases or escapes");
  }
  if (
    segments.length < 4 ||
    segments[0] !== "games" ||
    segments[1] !== "aegis" ||
    segments[2] !== "content"
  ) {
    throw usageError("--manifest must stay inside games/aegis/content");
  }
  if (!value.endsWith(".json")) {
    throw usageError("--manifest must name a lowercase .json file");
  }
  return value;
}

function parseArgs(argv) {
  let mission = null;
  let all = false;
  let action = null;
  let manifest;
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
    } else if (token === "--manifest") {
      if (manifest !== undefined) throw usageError("Choose at most one --manifest");
      index++;
      manifest = validateManifestReference(argv[index]);
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
  if (manifest !== undefined && action === "report-known-issues") {
    throw usageError("--manifest cannot be combined with the isolated legacy report mode");
  }
  const result = { mission: mission, all: all, action: action };
  if (manifest !== undefined) result.manifest = manifest;
  return Object.freeze(result);
}

function analyzerContext(value) {
  const input = value || {};
  const repositoryRoot = path.resolve(input.repositoryRoot || REPO_ROOT);
  const contentSourceRoot = path.resolve(
    input.contentSourceRoot || path.join(repositoryRoot, "games", "aegis", "content")
  );
  const mapReportDir = path.resolve(
    input.mapReportDir || path.join(repositoryRoot, "docs", "aegis-balance", "maps")
  );
  return Object.freeze({
    repositoryRoot: repositoryRoot,
    contentSourceRoot: contentSourceRoot,
    mapReportDir: mapReportDir,
  });
}

function resolveCandidateManifest(reference, context) {
  const portable = validateManifestReference(reference);
  const roots = analyzerContext(context);
  const resolved = path.resolve(roots.repositoryRoot, ...portable.split("/"));
  const relative = path.relative(roots.contentSourceRoot, resolved);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw usageError("--manifest must resolve to a file inside games/aegis/content");
  }
  return Object.freeze({ reference: portable, path: resolved, context: roots });
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

function candidateArtifactPaths(id, campaign, context) {
  if (!MISSION_ID.test(id) || id === LEGACY_ID) fail("MAP_MISSION_ID", "/id", "Invalid campaign mission ID " + id);
  if (!campaign || !campaign.preflight || !campaign.preflight.manifest) {
    fail("MAP_CANDIDATE_SOURCE", "/manifest", "Candidate artifact paths require a verified v3 campaign source");
  }
  const manifest = campaign.preflight.manifest;
  const manifestHash = campaign.preflight.manifestHash;
  if (typeof manifestHash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(manifestHash)) {
    fail("MAP_CANDIDATE_IDENTITY", "/manifestHash", "Candidate manifest identity must be a full lowercase SHA-256");
  }
  const roots = analyzerContext(context || campaign.context);
  const directory = path.join(
    roots.mapReportDir,
    "candidates",
    manifest.contentVersion + "." + manifestHash.slice("sha256:".length)
  );
  return Object.freeze({
    directory: directory,
    report: path.join(directory, id + "-pad-report.json"),
    svg: path.join(directory, id + "-pad-heatmap.svg"),
  });
}

function listMissionIds(source) {
  return campaignSourceTree(source).missionMaps.map(function (mission) { return mission.id; });
}

function loadMission(id, source) {
  return declaredMission(id, source).mission.compiled;
}

function loadCandidateCampaign(manifestReference, context) {
  const selected = resolveCandidateManifest(manifestReference, context);
  const preflight = loadSourceTree(selected.context.contentSourceRoot, {
    manifestPath: selected.path,
    repositoryRoot: selected.context.repositoryRoot,
  });
  if (!preflight || !preflight.manifest || preflight.manifest.schemaVersion !== 3) {
    fail("MAP_CANDIDATE_SCHEMA", "/schemaVersion", "Explicit analyzer manifests must use source schemaVersion 3");
  }
  const source = preflight.normalizedSource;
  if (!source || !Array.isArray(source.missions)) {
    fail("MAP_CANDIDATE_SOURCE", "/missions", "Verified v3 map source partitions are incomplete");
  }
  const recordSet = Records.validateNonMapSliceRecordSet({
    approvalState: preflight.manifest.approvalState,
    campaignRules: source.campaignRules,
    defenses: source.defenses,
    enemies: source.enemies,
    bosses: source.bosses,
    missions: source.missions.map(function (record) { return record.definition; }),
    eventCatalog: source.eventCatalog,
    stringCatalog: source.stringCatalog,
    presentationCatalog: source.presentationCatalog,
  }, { previewProofMode: "defer-to-map-compiler" });

  const missions = preflight.manifest.missions.map(function (manifestMission, index) {
    const sourceMission = source.missions[index];
    const mission = recordSet.missions[index];
    if (
      !sourceMission || !mission ||
      sourceMission.id !== manifestMission.id ||
      mission.id !== manifestMission.id
    ) {
      fail(
        "MISSION_SOURCE_MISMATCH",
        "/missions/" + index + "/id",
        "Manifest, mission definition, and loaded map records must align by ID"
      );
    }
    return Object.freeze({
      id: manifestMission.id,
      index: index,
      manifestMission: manifestMission,
      mission: mission,
      mapSource: sourceMission.map,
      mapProofSupplement: sourceMission.mapProofSupplement,
    });
  });
  return Object.freeze({
    context: selected.context,
    manifestReference: selected.reference,
    preflight: preflight,
    recordSet: recordSet,
    missions: Object.freeze(missions),
  });
}

function listCandidateMissionIds(campaign) {
  if (!campaign || !Array.isArray(campaign.missions)) {
    fail("MAP_CANDIDATE_SOURCE", "/missions", "Candidate campaign mission records are required");
  }
  return campaign.missions.map(function (mission) { return mission.id; });
}

function declaredCandidateMission(id, campaign) {
  if (!MISSION_ID.test(id) || id === LEGACY_ID) fail("MAP_MISSION_ID", "/id", "Invalid campaign mission ID " + id);
  const index = campaign.missions.findIndex(function (mission) { return mission.id === id; });
  if (index === -1) fail("MAP_MISSION_MISSING", "/id", "No candidate campaign source is declared for " + id);
  return campaign.missions[index];
}

function analyzeCandidateCampaign(id, campaign) {
  const selected = declaredCandidateMission(id, campaign);
  const adapterInput = {
    mission: selected.mission,
    missionIndex: selected.index,
    manifestMission: selected.manifestMission,
    mapSource: selected.mapSource,
    campaignRules: campaign.recordSet.campaignRules,
    defenses: campaign.recordSet.defenses,
  };
  if (selected.mapProofSupplement !== undefined) {
    adapterInput.mapProofSupplement = selected.mapProofSupplement;
  }
  const validated = V3MapAdapter.normalizeAndValidateMap(adapterInput);
  if (!validated || validated.schemaVersion !== 2 || validated.id !== selected.mission.mapId) {
    fail(
      "MAP_CANDIDATE_RESULT",
      "/missions/" + selected.index + "/map",
      "Candidate map must normalize to schemaVersion 2 with the mission mapId"
    );
  }
  if (!Array.isArray(validated.routes) || validated.routes.length === 0 || !Array.isArray(validated.roleProofs)) {
    fail(
      "MAP_CANDIDATE_RESULT",
      "/missions/" + selected.index + "/map",
      "Candidate map must contain validated routes and its role-proof partition"
    );
  }
  return Object.freeze({
    validated: validated,
    artifacts: Report.createNormalizedMapArtifacts(validated),
  });
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

function writeMissionArtifacts(id, artifacts, paths) {
  const targets = paths || artifactPaths(id);
  fs.mkdirSync(path.dirname(targets.report), { recursive: true });
  fs.mkdirSync(path.dirname(targets.svg), { recursive: true });
  fs.writeFileSync(targets.report, artifacts.reportBytes);
  fs.writeFileSync(targets.svg, artifacts.svgBytes);
  return targets;
}

function analyzeCampaign(id, source) {
  const validated = loadMission(id, source);
  return { validated: validated, artifacts: Report.createMissionArtifacts(validated) };
}

function execute(options, io, context) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  if (options.mission === LEGACY_ID) {
    const source = Validation.readMapFile(LEGACY_SOURCE);
    const report = Validation.validateLegacyMap(source);
    output.stdout.write(Buffer.concat([canonicalBytes(report), Buffer.from("\n", "utf8")]));
    return 0;
  }
  if (options.manifest !== undefined) {
    const campaign = loadCandidateCampaign(options.manifest, context);
    const candidateIds = options.all ? listCandidateMissionIds(campaign) : [options.mission];
    if (candidateIds.length === 0) fail("MAP_MISSION_MISSING", "/", "No candidate campaign maps were found");
    for (const id of candidateIds) {
      const result = analyzeCandidateCampaign(id, campaign);
      const paths = candidateArtifactPaths(id, campaign, context);
      if (options.action === "check") {
        checkMissionArtifacts(id, result.artifacts, paths);
        output.stdout.write(id + ": deterministic candidate map report and heatmap are current\n");
      } else {
        const targets = writeMissionArtifacts(id, result.artifacts, paths);
        output.stdout.write(id + ": wrote " + path.relative(campaign.context.repositoryRoot, targets.report).replace(/\\/g, "/") +
          " and " + path.relative(campaign.context.repositoryRoot, targets.svg).replace(/\\/g, "/") + "\n");
      }
    }
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
  validateManifestReference: validateManifestReference,
  parseArgs: parseArgs,
  analyzerContext: analyzerContext,
  resolveCandidateManifest: resolveCandidateManifest,
  campaignSourceTree: campaignSourceTree,
  sourcePathForMission: sourcePathForMission,
  artifactPaths: artifactPaths,
  candidateArtifactPaths: candidateArtifactPaths,
  listMissionIds: listMissionIds,
  listCandidateMissionIds: listCandidateMissionIds,
  loadMission: loadMission,
  loadCandidateCampaign: loadCandidateCampaign,
  checkMissionArtifacts: checkMissionArtifacts,
  writeMissionArtifacts: writeMissionArtifacts,
  analyzeCampaign: analyzeCampaign,
  analyzeCandidateCampaign: analyzeCandidateCampaign,
  execute: execute,
  main: main,
});
