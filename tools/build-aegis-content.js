#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { AegisContentError } = require("./lib/aegis/diagnostics.js");
const { executeBuild } = require("./lib/aegis/compiler.js");
const { buildSimulationBundle } = require("./lib/aegis/simulation-bundle.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.join(REPO_ROOT, "games", "aegis", "content");
const V4_SOURCE = path.join(REPO_ROOT, "games", "aegis", "content-v4");
// The declared authoring roots an alternate --manifest may name. A manifest selects its own tree,
// so schema-4 sources compile through the same CLI without a second entry point.
const CONTENT_ROOTS = Object.freeze([DEFAULT_SOURCE, V4_SOURCE]);
const DEFAULT_SIMULATION = path.join(REPO_ROOT, "games", "aegis", "js", "sim", "abi.js");
const DEFAULT_SIMULATION_ROOT = path.dirname(DEFAULT_SIMULATION);
const FIXTURE_ROOT = path.join(REPO_ROOT, "games", "aegis", "tests", "fixtures", "compiler");
const USAGE = [
  "Usage:",
  "  node tools/build-aegis-content.js --check",
  "  node tools/build-aegis-content.js --write",
  "  node tools/build-aegis-content.js --check --fixture <name>",
  "  node tools/build-aegis-content.js --write --fixture <name>",
  "  node tools/build-aegis-content.js --check --manifest <repo-relative-file>",
  "  node tools/build-aegis-content.js --write --manifest <repo-relative-file>",
  "  production defaults to the complete declared deterministic simulation module bundle",
  "  append --manifest <repo-relative-file> to compile an alternate contained source manifest",
  "  an alternate manifest must live inside games/aegis/content or games/aegis/content-v4",
  "  append --simulation <repo-relative-file> only to override the explicit simulation seam",
  "Exit codes: 0 success, 1 source/build/I/O failure, 2 invalid CLI usage.",
].join("\n");

function usageError(message) {
  const error = new Error(message + "\n" + USAGE);
  error.code = "CLI_USAGE";
  return error;
}

function declaredContentRoot(manifestPath) {
  for (const root of CONTENT_ROOTS) {
    const relative = path.relative(root, manifestPath);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return root;
  }
  throw usageError("--manifest must name a file inside games/aegis/content or games/aegis/content-v4");
}

function parseArgs(argv) {
  let mode = null;
  let fixture = null;
  let manifest = null;
  let simulation = null;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--check" || arg === "--write") {
      if (mode) throw usageError("Specify exactly one of --check or --write");
      mode = arg.slice(2);
    } else if (arg === "--fixture") {
      if (fixture !== null || index + 1 >= argv.length) throw usageError("--fixture requires one value");
      fixture = argv[++index];
      if (!/^[a-z0-9][a-z0-9-]*$/.test(fixture)) throw usageError("Invalid fixture name");
    } else if (arg === "--simulation") {
      if (simulation !== null || index + 1 >= argv.length) throw usageError("--simulation requires one value");
      simulation = argv[++index];
      if (path.isAbsolute(simulation) || simulation.indexOf("\\") !== -1) {
        throw usageError("--simulation must be a repo-relative POSIX path");
      }
      const segments = simulation.split("/");
      if (segments.some(function (segment) {
        return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
      })) {
        throw usageError("--simulation must use portable path segments without aliases or alternate streams");
      }
      const normalized = path.posix.normalize(simulation);
      if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) {
        throw usageError("--simulation must stay inside the repository");
      }
      simulation = normalized;
    } else if (arg === "--manifest") {
      if (manifest !== null || index + 1 >= argv.length) throw usageError("--manifest requires one value");
      manifest = argv[++index];
      if (path.isAbsolute(manifest) || manifest.indexOf("\\") !== -1) {
        throw usageError("--manifest must be a repo-relative POSIX path");
      }
      const segments = manifest.split("/");
      if (segments.some(function (segment) {
        return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
      })) {
        throw usageError("--manifest must use portable path segments without aliases or alternate streams");
      }
      const normalized = path.posix.normalize(manifest);
      if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) {
        throw usageError("--manifest must stay inside the repository");
      }
      manifest = normalized;
    } else if (arg === "--help" && argv.length === 1) {
      return { help: true };
    } else {
      throw usageError("Unknown argument " + arg);
    }
  }
  if (!mode) throw usageError("Specify exactly one of --check or --write");
  if (fixture && manifest) throw usageError("--fixture and --manifest cannot be combined");
  const manifestPath = manifest ? path.resolve(REPO_ROOT, manifest) : undefined;
  let sourceRoot = DEFAULT_SOURCE;
  if (fixture) {
    sourceRoot = path.join(FIXTURE_ROOT, fixture);
  } else if (manifestPath) {
    sourceRoot = declaredContentRoot(manifestPath);
  }
  let simulationPath = simulation
    ? path.resolve(REPO_ROOT, simulation)
    : (fixture ? path.join(sourceRoot, "simulation.js") : DEFAULT_SIMULATION);
  if (simulation && fs.existsSync(simulationPath)) {
    const realRepo = fs.realpathSync(REPO_ROOT);
    const realSimulation = fs.realpathSync(simulationPath);
    const relative = path.relative(realRepo, realSimulation);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative) ||
      !fs.statSync(realSimulation).isFile()
    ) {
      throw usageError("--simulation must resolve to a regular file inside the repository");
    }
    simulationPath = realSimulation;
  }
  return {
    help: false,
    mode: mode,
    repositoryRoot: REPO_ROOT,
    sourceRoot: sourceRoot,
    manifestPath: manifestPath,
    simulationPath: simulationPath,
    useDefaultSimulationBundle: !fixture && !simulation,
  };
}

// Ruling R16: one declared twenty-module simulation set serves every compiled-content schema,
// because `management.js` and `kernel.js` are single files whose static ABI-v2 dependencies must
// all be installed. Schema 4 still names its set explicitly so the binding stays legible at the
// call site and a future divergence has an obvious seam.
function declaredModuleSet(options) {
  if (!options.manifestPath) return undefined;
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(options.manifestPath, "utf8")); }
  catch (error) { return undefined; }
  return parsed && parsed.schemaVersion === 4 ? "v4" : undefined;
}

function materializeBuildOptions(options) {
  if (!options.useDefaultSimulationBundle) return options;
  const buildOptions = Object.assign({}, options);
  buildOptions.simulationBytes = buildSimulationBundle({
    sourceRoot: DEFAULT_SIMULATION_ROOT,
    moduleSet: declaredModuleSet(options),
  });
  return buildOptions;
}

function main(argv) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) {
    console.error(error.message);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  try {
    const output = executeBuild(materializeBuildOptions(options));
    console.log("Aegis content " + options.mode + " passed: " + output.rulesetHash);
    output.files.forEach(function (file) { console.log("  " + file); });
    return 0;
  } catch (error) {
    if (error instanceof AegisContentError) {
      error.diagnostics.forEach(function (item) {
        console.error(item.code + " " + item.path + ": " + item.message);
      });
      return 1;
    }
    console.error(String(error && error.stack || error));
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = Object.freeze({
  USAGE: USAGE,
  parseArgs: parseArgs,
  materializeBuildOptions: materializeBuildOptions,
  main: main,
});
