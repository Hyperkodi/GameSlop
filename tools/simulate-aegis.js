#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { AegisContentError } = require("./lib/aegis/diagnostics.js");
const { canonicalBytes, canonicalEncode } = require("./lib/aegis/canonical.js");
const { parseStrictJsonBytes } = require("./lib/aegis/strict-json.js");
const { compileSourceTree, artifactEntries } = require("./lib/aegis/compiler.js");
const { buildSimulationBundle } = require("./lib/aegis/simulation-bundle.js");
const { verifyV3ReleaseSelection } = require("./lib/aegis/v3-artifacts.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const CONTENT_ROOT = path.join(REPO_ROOT, "games", "aegis", "content");
const SIMULATION_ROOT = path.join(REPO_ROOT, "games", "aegis", "js", "sim");
const BALANCE_ROOT = path.join(REPO_ROOT, "docs", "aegis-balance", "slice");
const SCENARIO_ROOT = path.join(REPO_ROOT, "games", "aegis", "tests", "fixtures", "balance", "scenarios");
const SCENARIO_CATALOG = path.join(SCENARIO_ROOT, "catalog.json");
const FORMULA_VERSION = "combat-value-v1-conserved";
const SCENARIO_SCHEMA_VERSION = 1;
const REPORT_SCHEMA_VERSION = 1;
const TELEMETRY_SCHEMA_VERSION = 1;
const TELEMETRY_RECORD_LIMIT = 65536;
const TELEMETRY_TARGET_LIMIT = 4096;
const MISSIONS = Object.freeze(["m01", "m04", "m05"]);
const DIFFICULTIES = Object.freeze(["story", "strategos", "titan"]);
const GATE_STATUSES = Object.freeze(["pass", "fail", "review", "manual", "unavailable"]);
const RANDOM_CONTROL_SEEDS = Object.freeze([
  0, 1, 2, 17, 257, 65537, 324508639, 610839776, 2147483647, 2147483648,
  3735928559, 4294967295,
]);
const SCENARIO_FIELDS = Object.freeze([
  "commands", "expectations", "header", "id", "kind", "pair", "schemaVersion", "strategyVersion",
]);
const SCENARIO_HEADER_FIELDS = Object.freeze([
  "accessGrantIds", "assist", "campaignModifierIds", "difficultyId", "loadoutIds",
  "loadoutSlotCap", "missionId", "seed", "tutorialUpgradeGateMode",
]);
const SCENARIO_EXPECTATION_FIELDS = Object.freeze([
  "defeatWaveIndexes", "integrityMax", "integrityMin", "outcome", "requiredGateIds",
]);
const SCENARIO_KINDS = Object.freeze([
  "failure-control", "fuzz-soak", "mission-witness", "role-matrix", "weakness-matrix",
]);
const STRATEGY_VERSIONS = Object.freeze([
  "authored-command-stream-v1", "legal-random-placement-spend-v1",
]);
const PAIR_ROLES = Object.freeze([
  "aware", "baseline", "imperfect", "member-a", "member-b", "substitute",
]);
const REQUIRED_GATE_IDS = Object.freeze([
  "defense-role-chronos", "defense-role-hoplite", "defense-role-oracle",
  "defense-role-sentinel", "defense-role-siege", "defense-weakness-chronos",
  "defense-weakness-hoplite", "defense-weakness-oracle", "defense-weakness-sentinel",
  "defense-weakness-siege", "fuzz-soak", "m01-chronos-emphasis",
  "m01-legal-random-control", "m01-one-tower-control", "m01-placement-pair",
  "m01-representative-economy", "m01-sentinel-emphasis", "m01-siege-emphasis",
  "m04-route-exercise", "m04-witness-diversity", "m05-boss-exercise",
  "m05-witness-diversity", "no-strict-dominance", "parser-and-runtime-limits",
  "replay-parity", "starter-trio-wins-m01", "starter-trio-wins-m04",
  "starter-trio-wins-m05",
]);
const MACHINE_GATE_IDS = Object.freeze([
  "fuzz-soak", "parser-and-runtime-limits", "replay-parity",
]);
const MALFORMED_FUZZ_SEEDS = Object.freeze([
  0, 324508639, 610839776, 3735928559,
]);
const MALFORMED_FUZZ_ITERATIONS_PER_SEED = 16;
const NODE_SIMULATION_CACHE = new Map();
const USAGE = [
  "Usage:",
  "  node tools/simulate-aegis.js --manifest <repo-relative-file> --check",
  "  node tools/simulate-aegis.js --manifest <repo-relative-file> --write",
  "  append --mission m01|m04|m05 and/or --difficulty story|strategos|titan for diagnostics",
  "  append --matrix for the deterministic role/weakness matrix projection",
  "Exit codes: 0 success, 1 evidence/build/I/O failure, 2 invalid CLI usage.",
].join("\n");

function usageError(message) {
  const error = new Error(message);
  error.name = "AegisBalanceUsageError";
  error.usage = true;
  return error;
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.prototype.toString.call(value) !== "[object Object]" ||
      Object.getOwnPropertySymbols(value).length !== 0) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && Object.prototype.toString.call(prototype) !== "[object Object]") return false;
  return Object.keys(value).every(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && descriptor.enumerable && !descriptor.get && !descriptor.set;
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function cloneCanonical(value) {
  function copy(current) {
    if (current === null || typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
        throw new TypeError("Canonical balance data requires safe integers without negative zero");
      }
      return current;
    }
    if (Array.isArray(current)) return current.map(copy);
    if (!isPlainRecord(current)) throw new TypeError("Canonical balance data requires plain records");
    const output = {};
    Object.keys(current).forEach(function (key) { output[key] = copy(current[key]); });
    return output;
  }
  const output = copy(value);
  canonicalEncode(output);
  return output;
}

function loadNodeSimulationRuntime(simulationRoot) {
  const root = path.resolve(simulationRoot || SIMULATION_ROOT);
  const cached = NODE_SIMULATION_CACHE.get(root);
  if (cached) return cached;
  const abi = require(path.join(root, "abi.js"));
  const commands = require(path.join(root, "commands.js"));
  const kernel = require(path.join(root, "kernel.js"));
  const replay = require(path.join(root, "replay.js"));
  if (!Object.isFrozen(abi) || !Object.isFrozen(commands) || !Object.isFrozen(kernel) ||
      !Object.isFrozen(replay) || typeof replay.createBoundSimulator !== "function") {
    throw new TypeError("Node simulation modules must expose the frozen CommonJS APIs");
  }
  const simulationBytes = buildSimulationBundle({ sourceRoot: root });
  const loaded = Object.freeze({
    abi: abi,
    commands: commands,
    kernel: kernel,
    replay: replay,
    simulationHash: sha256Reference(simulationBytes),
  });
  NODE_SIMULATION_CACHE.set(root, loaded);
  return loaded;
}

function exactFields(value, fields, label) {
  if (!isPlainRecord(value)) throw new TypeError(label + " must be a plain record");
  const actual = Object.keys(value).sort();
  const expected = fields.slice().sort();
  if (actual.length !== expected.length || actual.some(function (key, index) {
    return key !== expected[index];
  })) {
    throw new TypeError(label + " must contain exactly " + expected.join(", "));
  }
}

function safeInteger(value, label, minimum) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < (minimum || 0)) {
    throw new RangeError(label + " must be a nonnegative safe integer");
  }
  return value;
}

function stableId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new TypeError(label + " must be a stable ASCII ID");
  }
  return value;
}

function validatePortableRepositoryFile(value, label) {
  if (typeof value !== "string" || !value || value.indexOf("\\") !== -1 ||
      path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /[:?#%&=]/.test(value)) {
    throw usageError(label + " must be a portable repository-relative POSIX path");
  }
  const segments = value.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
  })) {
    throw usageError(label + " must use portable path segments without aliases or escapes");
  }
  if (!value.endsWith(".json")) throw usageError(label + " must name a lowercase .json file");
  return value;
}

function validateManifestReference(value) {
  const reference = validatePortableRepositoryFile(value, "--manifest");
  const segments = reference.split("/");
  if (segments.length < 4 || segments[0] !== "games" || segments[1] !== "aegis" ||
      segments[2] !== "content") {
    throw usageError("--manifest must stay inside games/aegis/content");
  }
  return reference;
}

function parseArgs(argv) {
  let manifest = null;
  let mode = null;
  let mission = null;
  let difficulty = null;
  let matrix = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--manifest") {
      if (manifest !== null || index + 1 >= argv.length) throw usageError("Specify exactly one --manifest");
      manifest = validateManifestReference(argv[++index]);
    } else if (token === "--check" || token === "--write") {
      if (mode !== null) throw usageError("Specify exactly one of --check or --write");
      mode = token.slice(2);
    } else if (token === "--mission") {
      if (mission !== null || index + 1 >= argv.length || MISSIONS.indexOf(argv[index + 1]) === -1) {
        throw usageError("--mission requires exactly one of " + MISSIONS.join("|"));
      }
      mission = argv[++index];
    } else if (token === "--difficulty") {
      if (difficulty !== null || index + 1 >= argv.length ||
          DIFFICULTIES.indexOf(argv[index + 1]) === -1) {
        throw usageError("--difficulty requires exactly one of " + DIFFICULTIES.join("|"));
      }
      difficulty = argv[++index];
    } else if (token === "--matrix") {
      if (matrix) throw usageError("Specify --matrix at most once");
      matrix = true;
    } else if (token === "--help" && argv.length === 1) {
      return Object.freeze({ help: true });
    } else {
      throw usageError("Unknown argument " + token);
    }
  }
  if (manifest === null) throw usageError("Specify exactly one --manifest");
  if (mode === null) throw usageError("Specify exactly one of --check or --write");
  return Object.freeze({
    help: false,
    manifest: manifest,
    mode: mode,
    mission: mission,
    difficulty: difficulty,
    matrix: matrix,
  });
}

function balanceContext(input) {
  const source = input || {};
  const repositoryRoot = path.resolve(source.repositoryRoot || REPO_ROOT);
  return Object.freeze({
    repositoryRoot: repositoryRoot,
    contentRoot: path.resolve(source.contentRoot || path.join(repositoryRoot, "games", "aegis", "content")),
    simulationRoot: path.resolve(source.simulationRoot || path.join(repositoryRoot, "games", "aegis", "js", "sim")),
    balanceRoot: path.resolve(source.balanceRoot || path.join(repositoryRoot, "docs", "aegis-balance", "slice")),
  });
}

function resolveContainedManifest(reference, context) {
  const portable = validateManifestReference(reference);
  const roots = balanceContext(context);
  const requested = path.resolve(roots.repositoryRoot, ...portable.split("/"));
  const relative = path.relative(roots.contentRoot, requested);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw usageError("--manifest must resolve inside games/aegis/content");
  }
  let real;
  try {
    const stat = fs.lstatSync(requested);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("not a regular file");
    real = fs.realpathSync(requested);
  } catch (error) {
    throw usageError("--manifest must resolve to an existing regular file");
  }
  const realRoot = fs.realpathSync(roots.contentRoot);
  const realRelative = path.relative(realRoot, real);
  if (!realRelative || realRelative === ".." || realRelative.startsWith(".." + path.sep) ||
      path.isAbsolute(realRelative)) {
    throw usageError("--manifest may not escape games/aegis/content through a link");
  }
  return Object.freeze({ reference: portable, path: real, context: roots });
}

function executeSimulationBundle(bytes, label) {
  const sandbox = Object.create(null);
  sandbox.module = Object.create(null);
  sandbox.module.exports = Object.create(null);
  sandbox.exports = sandbox.module.exports;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(Buffer.from(bytes).toString("utf8"), context, {
    filename: label || "authenticated Aegis simulation bundle",
    timeout: 5000,
  });
  const api = sandbox.module.exports;
  if (!api || typeof api !== "object" || !Object.isFrozen(api) ||
      !api.AegisKernel || !api.AegisReplay || !api.AegisEconomy || !api.AegisMovement) {
    throw new TypeError("Authenticated simulation must expose frozen Kernel, Replay, Economy, and Movement APIs");
  }
  return api;
}

function createLockedSimulationRuntime(bytes, label) {
  const sandbox = Object.create(null);
  sandbox.module = Object.create(null);
  sandbox.module.exports = Object.create(null);
  sandbox.exports = sandbox.module.exports;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(Buffer.from(bytes).toString("utf8"), context, {
    filename: label || "authenticated Aegis simulation bundle",
    timeout: 5000,
  });
  const api = sandbox.module.exports;
  if (!api || typeof api !== "object" || !Object.isFrozen(api) ||
      !api.AegisKernel || !api.AegisReplay || !api.AegisEconomy || !api.AegisMovement) {
    throw new TypeError("Authenticated simulation must expose frozen Kernel, Replay, Economy, and Movement APIs");
  }
  function cloneInto(value) {
    sandbox.__aegisBalanceTransport = canonicalEncode(value);
    try {
      return vm.runInContext([
        "(function (value) {",
        "  function freeze(tree) {",
        "    if (!tree || typeof tree !== 'object' || Object.isFrozen(tree)) return tree;",
        "    Object.keys(tree).forEach(function (key) { freeze(tree[key]); });",
        "    return Object.freeze(tree);",
        "  }",
        "  return freeze(value);",
        "})(JSON.parse(globalThis.__aegisBalanceTransport))",
      ].join("\n"), context, {
        filename: "Aegis balance canonical data transport",
        timeout: 1000,
      });
    } finally {
      delete sandbox.__aegisBalanceTransport;
    }
  }
  function cloneOut(value) {
    return JSON.parse(JSON.stringify(value));
  }
  return Object.freeze({ api: api, cloneInto: cloneInto, cloneOut: cloneOut });
}

function compileAuthenticatedSelection(manifestReference, context) {
  const selected = resolveContainedManifest(manifestReference, context);
  const simulationBytes = buildSimulationBundle({ sourceRoot: selected.context.simulationRoot });
  const compiled = compileSourceTree({
    repositoryRoot: selected.context.repositoryRoot,
    sourceRoot: selected.context.contentRoot,
    manifestPath: selected.path,
    simulationBytes: simulationBytes,
  });
  if (!compiled.source || compiled.source.manifest.schemaVersion !== 3) {
    throw new RangeError("Balance simulation requires a verified source schemaVersion 3 manifest");
  }
  const entries = artifactEntries(compiled);
  const artifacts = new Map(entries);
  const releaseEntry = entries.find(function (entry) { return entry[0].startsWith("aegis-release."); });
  const manifestEntry = entries.find(function (entry) { return entry[0].startsWith("manifest."); });
  if (!releaseEntry || !manifestEntry) throw new Error("Compiled v3 selection lacks immutable release artifacts");
  const verified = verifyV3ReleaseSelection({
    pinnedReleaseName: releaseEntry[0],
    releaseName: releaseEntry[0],
    releaseBytes: releaseEntry[1],
    manifestBytes: manifestEntry[1],
    artifacts: artifacts,
  });
  const lockedRuntime = createLockedSimulationRuntime(
    artifacts.get(verified.release.simulationArtifact),
    verified.release.simulationArtifact
  );
  const simulationApi = lockedRuntime.api;
  if (simulationApi.EVENT_SCHEMA_VERSION !== verified.release.eventSchemaVersion ||
      simulationApi.BEHAVIOR_REGISTRY_VERSION !== verified.release.behaviorRegistryVersion) {
    throw new Error("Locked VM simulation identities differ from the authenticated release");
  }
  return Object.freeze({
    artifacts: artifacts,
    compiled: compiled,
    content: verified.content,
    release: verified.release,
    simulation: simulationApi,
    simulationRoot: selected.context.simulationRoot,
    lockedRuntime: lockedRuntime,
  });
}

function createBoundRuntime(selection) {
  if (!selection || !selection.lockedRuntime || !selection.simulation ||
      !selection.release || !selection.content) {
    throw new TypeError("Authenticated locked simulation selection is required");
  }
  const nodeSimulation = loadNodeSimulationRuntime(selection.simulationRoot || SIMULATION_ROOT);
  const nodeIdentities = Object.freeze({
    behaviorRegistryVersion: nodeSimulation.kernel.BEHAVIOR_REGISTRY_VERSION,
    eventSchemaVersion: nodeSimulation.replay.EVENT_SCHEMA_VERSION,
    executionPath: "commonjs-source",
    releaseAbiHash: selection.release.abiHash,
    runtimeAbiDescriptorHash: "sha256:" + nodeSimulation.abi.DESCRIPTOR_SHA256,
    simulationArtifact: selection.release.simulationArtifact,
    simulationHash: nodeSimulation.simulationHash,
  });
  if (nodeIdentities.runtimeAbiDescriptorHash !== "sha256:" + selection.simulation.DESCRIPTOR_SHA256 ||
      nodeIdentities.releaseAbiHash !== selection.release.abiHash ||
      nodeIdentities.behaviorRegistryVersion !== selection.release.behaviorRegistryVersion ||
      nodeIdentities.eventSchemaVersion !== selection.release.eventSchemaVersion ||
      nodeIdentities.simulationHash !== selection.release.simulationHash) {
    throw new Error("Node CommonJS simulation identities differ from the authenticated release");
  }
  const pair = selection.lockedRuntime.cloneInto({
    content: selection.content,
    release: selection.release,
  });
  const kernel = selection.simulation.AegisKernel;
  if (kernel.BALANCE_TELEMETRY_SCHEMA_VERSION !== TELEMETRY_SCHEMA_VERSION ||
      kernel.MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK !== TELEMETRY_RECORD_LIMIT ||
      kernel.MAX_BALANCE_TELEMETRY_TARGET_IDS !== TELEMETRY_TARGET_LIMIT) {
    throw new Error("Authenticated Kernel does not expose the exact balance telemetry authorities");
  }
  const binding = kernel.createRulesetBinding(pair);
  return Object.freeze({
    binding: binding,
    content: pair.content,
    release: pair.release,
    simulation: selection.simulation,
    cloneInto: selection.lockedRuntime.cloneInto,
    cloneOut: selection.lockedRuntime.cloneOut,
    node: Object.freeze({
      commands: nodeSimulation.commands,
      identities: nodeIdentities,
      pair: Object.freeze({ content: selection.content, release: selection.release }),
      replay: nodeSimulation.replay,
    }),
    pair: pair,
  });
}

function scenarioReplayHeader(runtime, scenario) {
  return {
    formatVersion: 1,
    rulesetHash: runtime.release.rulesetHash,
    eventSchemaVersion: runtime.release.eventSchemaVersion,
    missionId: scenario.header.missionId,
    difficultyId: scenario.header.difficultyId,
    assist: scenario.header.assist,
    seed: scenario.header.seed,
    loadoutIds: scenario.header.loadoutIds,
    loadoutSlotCap: scenario.header.loadoutSlotCap,
    campaignModifierIds: scenario.header.campaignModifierIds,
    accessGrantIds: scenario.header.accessGrantIds,
    tutorialUpgradeGateMode: scenario.header.tutorialUpgradeGateMode,
  };
}

function prepareScenarioInput(scenarioInput) {
  exactFields(scenarioInput, SCENARIO_FIELDS, "Balance scenario");
  const sourceHash = typeof scenarioInput.sourceHash === "string" ? scenarioInput.sourceHash :
    "sha256:" + "0".repeat(64);
  if (!/^sha256:[0-9a-f]{64}$/.test(sourceHash)) {
    throw new TypeError("Balance scenario sourceHash metadata must be lowercase SHA-256");
  }
  const source = {};
  SCENARIO_FIELDS.forEach(function (field) { source[field] = scenarioInput[field]; });
  return validateScenario(source, sourceHash);
}

function replayExecutionFacts(replayApi, execution) {
  return Object.freeze({
    finalStateHash: replayApi.finalStateHash(execution.finalState),
    integrity: execution.finalState.integrity,
    outcome: execution.finalState.outcome,
    score: execution.finalState.score,
    tick: execution.finalState.tick,
    verifiedCheckpointCount: execution.verifiedCheckpointCount,
  });
}

function replayParityProof(runtime, envelope, bundledExecution) {
  if (!runtime.node || !runtime.node.replay || !runtime.node.pair || !runtime.node.identities) {
    throw new TypeError("Node CommonJS replay binding is required for parity proof");
  }
  const nodeExecution = runtime.node.replay.createBoundSimulator(runtime.node.pair)
    .simulateReplay(cloneCanonical(envelope));
  return Object.freeze({
    bundled: replayExecutionFacts(runtime.simulation.AegisReplay, bundledExecution),
    identities: runtime.node.identities,
    node: replayExecutionFacts(runtime.node.replay, nodeExecution),
  });
}

function runAuthoredScenario(runtime, scenarioInput) {
  const scenario = prepareScenarioInput(scenarioInput);
  if (scenario.strategyVersion !== "authored-command-stream-v1") {
    throw new Error("Only authored command streams may use runAuthoredScenario");
  }
  const replay = runtime.simulation.AegisReplay;
  const kernel = runtime.simulation.AegisKernel;
  const headerSource = scenarioReplayHeader(runtime, scenario);
  const header = runtime.cloneInto(headerSource);
  let state = kernel.createInitialState(runtime.binding, header);
  const commands = scenario.commands;
  let inputIndex = 0;
  let steps = 0;
  const maxSteps = replay.DEFAULT_LIMITS.maxDurationTicks;
  const accumulator = createBalanceAccumulator(createConservedAuthorities(
    runtime, scenario.header.missionId
  ));
  while (state.outcome === "active") {
    if (steps >= maxSteps) throw new RangeError("Balance scenario exceeded the replay duration ceiling");
    const bucket = [];
    while (inputIndex < commands.length && commands[inputIndex].tick === state.tick) {
      bucket.push(commands[inputIndex++]);
    }
    if (inputIndex < commands.length && commands[inputIndex].tick < state.tick) {
      throw new RangeError("Balance scenario contains a command behind the canonical boundary");
    }
    if (state.management.phase === "planning" && bucket.length === 0) {
      throw new RangeError("Authored scenario leaves a suspended planning boundary without commands");
    }
    const result = kernel.advanceTick(runtime.binding, state, runtime.cloneInto(bucket));
    foldTelemetryTick(accumulator, state, result);
    if (result.state.tick === state.tick && inputIndex >= commands.length) {
      throw new RangeError("Authored scenario commands did not advance the suspended planning boundary");
    }
    state = result.state;
    steps += 1;
  }
  if (inputIndex !== commands.length) throw new RangeError("Balance scenario has commands after terminal state");
  if (state.outcome !== scenario.expectations.outcome) {
    throw new Error("Balance scenario terminal outcome differs from its expectation");
  }
  if (scenario.expectations.integrityMin !== null && state.integrity < scenario.expectations.integrityMin) {
    throw new Error("Balance scenario integrity is below its expected minimum");
  }
  if (scenario.expectations.integrityMax !== null && state.integrity > scenario.expectations.integrityMax) {
    throw new Error("Balance scenario integrity is above its expected maximum");
  }
  const laurels = state.objectiveResults.reduce(function (count, result) {
    return count + (result.complete ? 1 : 0);
  }, 0);
  const envelope = Object.assign({}, headerSource, {
    inputs: cloneCanonical(commands),
    checkpoints: [],
    finalClaim: {
      outcome: state.outcome,
      score: state.score,
      laurels: laurels,
      durationTicks: state.tick,
      finalStateHash: replay.finalStateHash(state),
    },
  });
  const simulator = replay.createBoundSimulator(runtime.pair);
  const replayExecution = simulator.simulateReplay(runtime.cloneInto(envelope));
  const finalized = finalizeAccumulator(accumulator, { requireComplete: true });
  if (scenario.expectations.defeatWaveIndexes.length > 0 &&
      scenario.expectations.defeatWaveIndexes.indexOf(finalized.terminalWaveIndex) === -1) {
    throw new Error("Balance scenario terminal wave differs from its exact expectation");
  }
  return deepFreeze({
    machineProofs: {
      replayParity: replayParityProof(runtime, envelope, replayExecution),
    },
    replay: cloneCanonical(envelope),
    result: finalized,
    sourceHash: scenario.sourceHash,
  });
}

function legalRandomIndex(movement, stream, count) {
  safeInteger(count, "Legal-random candidate count", 1);
  const modulus = 4294967296;
  const limit = Math.floor(modulus / count) * count;
  let next = movement.stepNamedRngStream(stream);
  while (next.uint32 >= limit) next = movement.stepNamedRngStream(next.state);
  return Object.freeze({ index: next.uint32 % count, stream: next.state });
}

function legalRandomPlanningBucket(runtime, state, stream, purchaseCount) {
  const mission = runtime.content.missions[state.missionId];
  const map = runtime.content.maps[mission.mapId];
  const padOrder = Object.create(null);
  map.pads.forEach(function (pad) { padOrder[pad.id] = pad.selectionOrder; });
  let bank = state.management.aether;
  let nextTowerId = state.management.runtimeIds.nextByDomain.tower;
  const towers = state.management.towers.map(function (tower) {
    return { id: tower.id, padId: tower.padId, defenseId: tower.defenseId, level: tower.level };
  });
  const commands = [];
  let nextStream = stream;
  function candidates() {
    const choices = [];
    const occupied = new Set(towers.map(function (tower) { return tower.padId; }));
    map.pads.forEach(function (pad) {
      if (occupied.has(pad.id)) return;
      state.loadoutIds.forEach(function (defenseId) {
        const defense = runtime.content.defenses[defenseId];
        const cost = defense.levels[0].purchase.costAether;
        if (cost <= bank) choices.push({
          kindOrder: 0,
          padId: pad.id,
          padOrder: pad.selectionOrder,
          defenseId: defenseId,
          resultingLevel: 1,
          cost: cost,
          towerId: null,
        });
      });
    });
    if (state.management.tutorialUpgradeGateOpen) {
      towers.forEach(function (tower) {
        const defense = runtime.content.defenses[tower.defenseId];
        if (tower.level >= defense.levels.length) return;
        const cost = defense.levels[tower.level].purchase.costAether;
        if (cost <= bank) choices.push({
          kindOrder: 1,
          padId: tower.padId,
          padOrder: padOrder[tower.padId],
          defenseId: tower.defenseId,
          resultingLevel: tower.level + 1,
          cost: cost,
          towerId: tower.id,
        });
      });
    }
    choices.sort(function (left, right) {
      if (left.kindOrder !== right.kindOrder) return left.kindOrder - right.kindOrder;
      if (left.padOrder !== right.padOrder) return left.padOrder - right.padOrder;
      if (left.defenseId !== right.defenseId) return left.defenseId < right.defenseId ? -1 : 1;
      return left.resultingLevel - right.resultingLevel;
    });
    return choices;
  }
  let skippedPurchaseCount = 0;
  for (let purchase = 0; purchase < purchaseCount; purchase += 1) {
    const choices = candidates();
    if (choices.length === 0) {
      skippedPurchaseCount = purchaseCount - purchase;
      break;
    }
    const draw = legalRandomIndex(runtime.simulation.AegisMovement, nextStream, choices.length);
    nextStream = draw.stream;
    const selected = choices[draw.index];
    if (selected.kindOrder === 0) {
      commands.push({
        tick: state.tick, seq: commands.length, type: "build",
        padId: selected.padId, defenseId: selected.defenseId,
      });
      towers.push({
        id: nextTowerId++, padId: selected.padId, defenseId: selected.defenseId, level: 1,
      });
    } else {
      commands.push({ tick: state.tick, seq: commands.length, type: "upgrade", towerId: selected.towerId });
      towers.find(function (tower) { return tower.id === selected.towerId; }).level += 1;
    }
    bank -= selected.cost;
  }
  commands.push({ tick: state.tick, seq: commands.length, type: "startWave" });
  return Object.freeze({
    commands: commands,
    skippedPurchaseCount: skippedPurchaseCount,
    stream: nextStream,
  });
}

function runLegalRandomScenario(runtime, scenarioInput) {
  const scenario = prepareScenarioInput(scenarioInput);
  if (scenario.strategyVersion !== "legal-random-placement-spend-v1") {
    throw new Error("runLegalRandomScenario requires the legal-random strategy identity");
  }
  const expectedLoadout = ["sentinel", "chronos", "siege"];
  const expectedGrants = ["campaign.chronos", "campaign.sentinel", "campaign.siege"];
  if (scenario.header.missionId !== "m01" || scenario.header.difficultyId !== "strategos" ||
      scenario.header.assist !== false || scenario.header.campaignModifierIds.length !== 0 ||
      scenario.header.loadoutSlotCap !== 3 ||
      JSON.stringify(scenario.header.loadoutIds) !== JSON.stringify(expectedLoadout) ||
      JSON.stringify(scenario.header.accessGrantIds.slice().sort()) !== JSON.stringify(expectedGrants) ||
      scenario.header.tutorialUpgradeGateMode !== "m01-wave1" ||
      RANDOM_CONTROL_SEEDS.indexOf(scenario.header.seed) === -1) {
    throw new Error("Legal-random control requires the exact new-profile m01 Strategos starter-trio header and seed set");
  }
  const replay = runtime.simulation.AegisReplay;
  const kernel = runtime.simulation.AegisKernel;
  const headerSource = scenarioReplayHeader(runtime, scenario);
  let state = kernel.createInitialState(runtime.binding, runtime.cloneInto(headerSource));
  let stream = runtime.simulation.AegisMovement.createNamedRngStream(
    scenario.header.seed, "balance.legal-random-placement-spend-v1"
  );
  const generatedCommands = [];
  const accumulator = createBalanceAccumulator(createConservedAuthorities(runtime, scenario.header.missionId));
  let steps = 0;
  while (state.outcome === "active") {
    if (steps >= replay.DEFAULT_LIMITS.maxDurationTicks) {
      throw new RangeError("Legal-random scenario exceeded the replay duration ceiling");
    }
    let bucket = [];
    if (state.management.phase === "planning") {
      const planned = legalRandomPlanningBucket(runtime, state, stream,
        state.management.clearedWaves === 0 ? 2 : 1);
      bucket = planned.commands;
      stream = planned.stream;
      generatedCommands.push.apply(generatedCommands, bucket);
    }
    const result = kernel.advanceTick(runtime.binding, state, runtime.cloneInto(bucket));
    if (bucket.length > 0) {
      const acceptedSeqs = result.telemetry.records.filter(function (record) {
        return record.kind === "aether-transaction" && record.commandSeq !== null;
      }).map(function (record) { return record.commandSeq; });
      if (acceptedSeqs.length !== bucket.length || acceptedSeqs.some(function (seq, index) {
        return seq !== index;
      })) throw new Error("Legal-random strategy produced a denied command");
    }
    foldTelemetryTick(accumulator, state, result);
    state = result.state;
    steps += 1;
  }
  const laurels = state.objectiveResults.reduce(function (count, objective) {
    return count + (objective.complete ? 1 : 0);
  }, 0);
  const envelope = Object.assign({}, headerSource, {
    inputs: generatedCommands,
    checkpoints: [],
    finalClaim: {
      outcome: state.outcome,
      score: state.score,
      laurels: laurels,
      durationTicks: state.tick,
      finalStateHash: replay.finalStateHash(state),
    },
  });
  const replayExecution = replay.createBoundSimulator(runtime.pair)
    .simulateReplay(runtime.cloneInto(envelope));
  const result = finalizeAccumulator(accumulator, { requireComplete: true });
  if (result.outcome !== scenario.expectations.outcome ||
      (scenario.expectations.defeatWaveIndexes.length > 0 &&
       scenario.expectations.defeatWaveIndexes.indexOf(result.terminalWaveIndex) === -1)) {
    throw new Error("Legal-random terminal result differs from its exact expectation");
  }
  return deepFreeze({
    machineProofs: {
      replayParity: replayParityProof(runtime, envelope, replayExecution),
    },
    replay: envelope,
    result: result,
    sourceHash: scenario.sourceHash,
  });
}

function sha256Reference(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateScenario(value, sourceHash) {
  exactFields(value, SCENARIO_FIELDS, "Balance scenario");
  if (value.schemaVersion !== SCENARIO_SCHEMA_VERSION) throw new RangeError("Unsupported balance scenario schema");
  stableId(value.id, "Balance scenario id");
  if (SCENARIO_KINDS.indexOf(value.kind) === -1) throw new RangeError("Unknown balance scenario kind");
  if (STRATEGY_VERSIONS.indexOf(value.strategyVersion) === -1) {
    throw new RangeError("Unknown balance scenario strategyVersion");
  }
  exactFields(value.header, SCENARIO_HEADER_FIELDS, "Balance scenario header");
  if (MISSIONS.indexOf(value.header.missionId) === -1 ||
      DIFFICULTIES.indexOf(value.header.difficultyId) === -1) {
    throw new RangeError("Balance scenario header has an unsupported mission or difficulty");
  }
  if (typeof value.header.assist !== "boolean") throw new TypeError("Balance scenario assist must be boolean");
  safeInteger(value.header.seed, "Balance scenario seed");
  safeInteger(value.header.loadoutSlotCap, "Balance scenario loadout slot cap", 1);
  ["loadoutIds", "campaignModifierIds", "accessGrantIds"].forEach(function (field) {
    if (!Array.isArray(value.header[field])) throw new TypeError("Balance scenario " + field + " must be an array");
    value.header[field].forEach(function (id) { stableId(id, "Balance scenario " + field + " ID"); });
  });
  stableId(value.header.tutorialUpgradeGateMode, "Balance scenario tutorial gate mode");
  if (!Array.isArray(value.commands)) throw new TypeError("Balance scenario commands must be an array");
  if (value.strategyVersion === "legal-random-placement-spend-v1" && value.commands.length !== 0) {
    throw new RangeError("Legal-random scenarios derive commands and must not embed a second command stream");
  }
  if (value.pair !== null) {
    exactFields(value.pair, ["id", "role"], "Balance scenario pair");
    stableId(value.pair.id, "Balance scenario pair ID");
    if (PAIR_ROLES.indexOf(value.pair.role) === -1) throw new RangeError("Unknown balance scenario pair role");
  }
  exactFields(value.expectations, SCENARIO_EXPECTATION_FIELDS, "Balance scenario expectations");
  if (value.expectations.outcome !== "victory" && value.expectations.outcome !== "defeat") {
    throw new RangeError("Balance scenario expected outcome must be victory or defeat");
  }
  ["integrityMin", "integrityMax"].forEach(function (field) {
    if (value.expectations[field] !== null) safeInteger(value.expectations[field], "Expected " + field);
  });
  if (value.expectations.integrityMin !== null && value.expectations.integrityMax !== null &&
      value.expectations.integrityMin > value.expectations.integrityMax) {
    throw new RangeError("Balance scenario integrity bounds are inverted");
  }
  if (!Array.isArray(value.expectations.defeatWaveIndexes) ||
      !Array.isArray(value.expectations.requiredGateIds)) {
    throw new TypeError("Balance scenario expectations require defeat-wave and gate arrays");
  }
  value.expectations.defeatWaveIndexes.forEach(function (wave) {
    safeInteger(wave, "Expected defeat wave", 1);
  });
  value.expectations.requiredGateIds.forEach(function (id) {
    stableId(id, "Expected required gate ID");
    if (REQUIRED_GATE_IDS.indexOf(id) === -1) throw new RangeError("Unknown required balance gate ID");
  });
  canonicalEncode(value);
  const clone = cloneCanonical(value);
  Object.defineProperty(clone, "sourceHash", {
    value: sourceHash,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return deepFreeze(clone);
}

function parseScenarioBytes(bytes, label) {
  const raw = Buffer.from(bytes);
  if (raw.length > 4 * 1024 * 1024) throw new RangeError("Balance scenario exceeds the UTF-8 byte limit");
  if (raw.indexOf(0x0d) !== -1 || raw.length === 0 || raw[raw.length - 1] !== 0x0a ||
      (raw.length > 1 && raw[raw.length - 2] === 0x0a)) {
    throw new RangeError("Balance scenario bytes must use LF and end with exactly one newline");
  }
  const value = parseStrictJsonBytes(raw, label || "balance scenario", {
    maxDepth: 64,
    maxObjectFields: 128,
    rejectNegativeZero: true,
  });
  return validateScenario(value, sha256Reference(raw));
}

function parseScenarioCatalogBytes(bytes, label) {
  const raw = Buffer.from(bytes);
  if (raw.indexOf(0x0d) !== -1 || raw.length === 0 || raw[raw.length - 1] !== 0x0a ||
      (raw.length > 1 && raw[raw.length - 2] === 0x0a)) {
    throw new RangeError("Balance scenario catalog must use LF and exactly one final newline");
  }
  const catalog = parseStrictJsonBytes(raw, label || "balance scenario catalog", {
    maxDepth: 16,
    maxObjectFields: 16,
    rejectNegativeZero: true,
  });
  exactFields(catalog, ["records", "schemaVersion"], "Balance scenario catalog");
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.records)) {
    throw new RangeError("Balance scenario catalog schemaVersion 1 and records are required");
  }
  let priorId = null;
  const sources = new Set();
  catalog.records.forEach(function (record, index) {
    exactFields(record, ["id", "sha256", "source"], "Balance scenario catalog record " + index);
    stableId(record.id, "Catalog scenario ID");
    if (priorId !== null && priorId >= record.id) {
      throw new RangeError("Balance scenario catalog IDs must be strict ASCII sorted");
    }
    priorId = record.id;
    if (typeof record.sha256 !== "string" || !/^sha256:[0-9a-f]{64}$/.test(record.sha256)) {
      throw new TypeError("Catalog scenario hash must be lowercase SHA-256");
    }
    const source = validatePortableRepositoryFile(record.source, "Catalog scenario source");
    const prefix = "games/aegis/tests/fixtures/balance/scenarios/";
    if (!source.startsWith(prefix) || source === prefix + "catalog.json" || sources.has(source)) {
      throw new RangeError("Catalog scenario sources must be unique files under the scenario root");
    }
    if (path.posix.basename(source, ".json") !== record.id) {
      throw new RangeError("Catalog scenario ID must match its source basename");
    }
    sources.add(source);
  });
  return deepFreeze(cloneCanonical(catalog));
}

function loadScenarioCatalog(context, catalogPath) {
  const roots = balanceContext(context);
  const scenarioRoot = path.resolve(roots.repositoryRoot,
    "games", "aegis", "tests", "fixtures", "balance", "scenarios");
  const selectedCatalog = path.resolve(catalogPath || path.join(scenarioRoot, "catalog.json"));
  if (path.dirname(selectedCatalog) !== scenarioRoot) {
    throw new Error("Scenario catalog must be the fixed catalog.json under the scenario root");
  }
  const catalog = parseScenarioCatalogBytes(fs.readFileSync(selectedCatalog), "balance scenario catalog");
  const scenarios = catalog.records.map(function (record) {
    const requested = path.resolve(roots.repositoryRoot, ...record.source.split("/"));
    const relative = path.relative(scenarioRoot, requested);
    if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
      throw new Error("Catalog scenario escaped the scenario root");
    }
    const stat = fs.lstatSync(requested);
    const realScenarioRoot = fs.realpathSync(scenarioRoot);
    const realRequested = fs.realpathSync(requested);
    const realRelative = path.relative(realScenarioRoot, realRequested);
    if (!stat.isFile() || stat.isSymbolicLink() || !realRelative || realRelative === ".." ||
        realRelative.startsWith(".." + path.sep) || path.isAbsolute(realRelative)) {
      throw new Error("Catalog scenario must be a direct regular file, not a link or alias");
    }
    const bytes = fs.readFileSync(requested);
    if (sha256Reference(bytes) !== record.sha256) throw new Error("Catalog scenario source hash mismatch");
    const scenario = parseScenarioBytes(bytes, record.source);
    if (scenario.id !== record.id) throw new Error("Catalog record and scenario ID differ");
    return scenario;
  });
  return Object.freeze(scenarios);
}

function allocateLargestRemainder(total, weightedIds) {
  safeInteger(total, "Allocation total");
  if (!Array.isArray(weightedIds) || weightedIds.length === 0) {
    if (total !== 0) throw new RangeError("A positive allocation requires at least one source");
    return Object.freeze([]);
  }
  let weightTotal = 0;
  let priorId = 0;
  const rows = weightedIds.map(function (entry, index) {
    exactFields(entry, ["runtimeId", "weight"], "Allocation source " + index);
    const runtimeId = safeInteger(entry.runtimeId, "Allocation runtimeId", 1);
    const weight = safeInteger(entry.weight, "Allocation weight");
    if (weight === 0 || (index !== 0 && runtimeId <= priorId)) {
      throw new RangeError("Allocation sources must have positive weights and ascending unique runtime IDs");
    }
    priorId = runtimeId;
    weightTotal = safeInteger(weightTotal + weight, "Allocation weight total");
    const product = BigInt(total) * BigInt(weight);
    return { runtimeId: runtimeId, value: 0, product: product };
  });
  if (weightTotal === 0) throw new RangeError("Allocation weight total must be positive");
  let assigned = 0;
  rows.forEach(function (row) {
    row.value = Number(row.product / BigInt(weightTotal));
    row.remainder = row.product % BigInt(weightTotal);
    assigned += row.value;
  });
  let remaining = total - assigned;
  const priority = rows.slice().sort(function (left, right) {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    return left.runtimeId - right.runtimeId;
  });
  for (let index = 0; index < remaining; index += 1) priority[index].value += 1;
  rows.sort(function (left, right) { return left.runtimeId - right.runtimeId; });
  return Object.freeze(rows.map(function (row) {
    return Object.freeze({ runtimeId: row.runtimeId, value: row.value });
  }));
}

function createBalanceAccumulator(authorities) {
  return {
    schemaVersion: 1,
    ticks: 0,
    telemetryRecords: 0,
    economy: {
      debitsAether: 0,
      creditsAether: 0,
      sellCreditsAether: 0,
      netConsumedAether: 0,
      maximumSimultaneousInvestmentAether: 0,
      finalBankAether: 0,
      actions: Object.create(null),
      activeInvestmentByTower: Object.create(null),
    },
    combat: {
      attemptedDamageMilli: 0,
      appliedDamageMilli: 0,
      deferredDamageMilli: 0,
      overkillDamageMilli: 0,
      directValueMilli: 0,
      supportValueMilli: 0,
      controlValueMilli: 0,
      preventedLeakValueMilli: 0,
    },
    activations: Object.create(null),
    effectSources: Object.create(null),
    towerUsage: Object.create(null),
    entities: Object.create(null),
    attributionByTower: Object.create(null),
    attributionByDefense: Object.create(null),
    towerDefenseIds: Object.create(null),
    authorities: authorities || null,
    unresolvedEvidence: Object.create(null),
    eventCounts: Object.create(null),
    missionFacts: {
      builtNorthLocal: false,
      builtSouthLocal: false,
      builtShared: false,
      northLocalBeforeJoin: false,
      southLocalBeforeJoin: false,
      sharedAffectedRouteIds: Object.create(null),
      crossRouteComparatorSelection: false,
      talosRuntimeId: null,
      talosLineageId: null,
      talosSpawned: false,
      thresholdTransitions: 0,
      warningsMatured: 0,
      podChildrenReleased: 0,
      exposureWindows: [],
    },
    routes: Object.create(null),
    pads: Object.create(null),
    spawns: Object.create(null),
    leaks: 0,
    finalState: null,
    firstAcceptedBuildPadId: null,
    firstPaidUpgrade: null,
  };
}

function createConservedAuthorities(boundRuntime, missionId) {
  if (!boundRuntime || !boundRuntime.simulation || !boundRuntime.content) {
    throw new TypeError("Bound runtime is required for conserved balance authorities");
  }
  const map = boundRuntime.content.maps[boundRuntime.content.missions[missionId].mapId];
  if (!map || !Array.isArray(map.routes) || !Array.isArray(map.laneSegments) ||
      !Array.isArray(map.pads)) throw new TypeError("Compiled mission map geometry is required");
  const geometry = boundRuntime.simulation.AegisGeometry;
  if (!geometry || typeof geometry.freezeCompiledRoute !== "function" ||
      typeof geometry.positionOnRoute !== "function" ||
      typeof geometry.isWithinSquaredRange !== "function") {
    throw new TypeError("Bundled geometry authorities are required for conserved balance evidence");
  }
  const routeLengths = Object.create(null);
  const routeGeometry = Object.create(null);
  const lanes = Object.create(null);
  map.laneSegments.forEach(function (lane) { lanes[lane.id] = lane; });
  map.routes.forEach(function (route) {
    routeLengths[route.id] = route.length;
    const segments = [];
    route.laneSegmentIds.forEach(function (laneId, laneIndex) {
      const lane = lanes[laneId];
      const offset = route.segmentOffsets[laneIndex];
      if (!lane || !lane.compiled || !Array.isArray(lane.compiled.subsegments) ||
          !offset || offset.laneSegmentId !== laneId) {
        throw new Error("Balance route geometry lacks a bound lane/offset record");
      }
      lane.compiled.subsegments.forEach(function (segment) {
        segments.push({
          deltaX: segment.deltaX,
          deltaY: segment.deltaY,
          fromX: segment.fromX,
          fromY: segment.fromY,
          id: laneId + ":s" + String(segment.index).padStart(3, "0"),
          index: segments.length,
          length: segment.length,
          start: safeInteger(offset.routeOffset + segment.start, "Balance route segment start"),
          toX: segment.toX,
          toY: segment.toY,
        });
      });
    });
    routeGeometry[route.id] = geometry.freezeCompiledRoute(boundRuntime.cloneInto({
      id: route.id, length: route.length, segments: segments,
    }));
  });
  const pads = Object.create(null);
  const padRouteIds = Object.create(null);
  map.pads.forEach(function (pad) {
    pads[pad.id] = { x: pad.x, y: pad.y };
    padRouteIds[pad.id] = pad.claimedRouteIds.slice();
  });
  const sharedRouteStartByRoute = Object.create(null);
  map.routes.forEach(function (route) {
    const shared = route.segmentOffsets.find(function (offset) {
      return offset.laneSegmentId === "lane.shared.trunk";
    });
    if (shared) sharedRouteStartByRoute[route.id] = shared.routeOffset;
  });
  function shadowOutsideRange(record, shadowDistance) {
    const defense = boundRuntime.content.defenses[record.defenseId];
    const level = defense && defense.levels[record.level - 1];
    const pad = pads[record.padId];
    const route = routeGeometry[record.targetRouteId];
    if (!level || !pad || !route) {
      throw new Error("Damage attribution lacks compiled defense/pad/route geometry");
    }
    const position = geometry.positionOnRoute(route, shadowDistance);
    return !geometry.isWithinSquaredRange(
      pad.x, pad.y, position.x, position.y, level.rangeWorldUnits
    );
  }
  return Object.freeze({
    movement: boundRuntime.simulation.AegisMovement,
    routeLengths: Object.freeze(routeLengths),
    padRouteIds: Object.freeze(padRouteIds),
    sharedRouteStartByRoute: Object.freeze(sharedRouteStartByRoute),
    shadowOutsideRange: shadowOutsideRange,
    waveCount: boundRuntime.content.missions[missionId].waves.length,
    missionId: missionId,
  });
}

function m04PadClass(authorities, padId) {
  if (!authorities || authorities.missionId !== "m04") return null;
  const routes = authorities.padRouteIds[padId] || [];
  if (routes.length > 1) return "shared";
  if (routes[0] === "route.north") return "north";
  if (routes[0] === "route.south") return "south";
  return null;
}

function noteM04MaterialEffect(accumulator, padId, routeId, targetDistance) {
  const padClass = m04PadClass(accumulator.authorities, padId);
  if (padClass === null) return;
  const sharedStart = accumulator.authorities.sharedRouteStartByRoute[routeId];
  if (!Number.isSafeInteger(sharedStart)) return;
  if (padClass === "north" && routeId === "route.north" && targetDistance < sharedStart) {
    accumulator.missionFacts.northLocalBeforeJoin = true;
  } else if (padClass === "south" && routeId === "route.south" && targetDistance < sharedStart) {
    accumulator.missionFacts.southLocalBeforeJoin = true;
  } else if (padClass === "shared" && targetDistance >= sharedStart) {
    accumulator.missionFacts.sharedAffectedRouteIds[routeId] = true;
  }
}

function towerUsageRecord(accumulator, towerRuntimeId, defenseId) {
  const key = String(towerRuntimeId);
  if (!own(accumulator.towerUsage, key)) {
    accumulator.towerUsage[key] = {
      towerRuntimeId: towerRuntimeId,
      defenseId: defenseId,
      builtBeforeFinalWave: false,
      builtTick: null,
      builtPadId: null,
      sold: false,
      waveActiveOwnedTicks: 0,
      positiveAppliedHits: 0,
      strongestMovementEnemyTicks: 0,
      multiTargetActivations: 0,
      acceptedGuardContacts: 0,
      revealEnabledHits: 0,
      positivelyAmplifiedMarkedHits: 0,
    };
  }
  const usage = accumulator.towerUsage[key];
  if (defenseId !== null && usage.defenseId === null) usage.defenseId = defenseId;
  else if (defenseId !== null && usage.defenseId !== defenseId) {
    throw new Error("Tower usage defense identity changed");
  }
  return usage;
}

function attributionBucket(table, id, defenseId) {
  const key = String(id);
  if (!own(table, key)) {
    table[key] = {
      defenseId: defenseId,
      directValueMilli: 0,
      supportValueMilli: 0,
      controlValueMilli: 0,
      preventedLeakValueMilli: 0,
    };
  } else if (defenseId !== null && table[key].defenseId !== null &&
      table[key].defenseId !== defenseId) {
    throw new Error("One attribution identity cannot change defense family");
  } else if (table[key].defenseId === null) {
    table[key].defenseId = defenseId;
  }
  return table[key];
}

function addAttribution(accumulator, towerRuntimeId, defenseId, field, amount) {
  const tower = attributionBucket(accumulator.attributionByTower, towerRuntimeId, defenseId);
  addChecked(tower, field, amount, "Tower conserved attribution");
  if (defenseId !== null) {
    const defense = attributionBucket(accumulator.attributionByDefense, defenseId, defenseId);
    addChecked(defense, field, amount, "Defense conserved attribution");
  }
}

function sourceProvenanceForTower(accumulator, targetRuntimeId, towerRuntimeId, effectKind) {
  const matches = Object.keys(accumulator.effectSources).map(function (key) {
    return accumulator.effectSources[key];
  }).filter(function (source) {
    return source.targetRuntimeId === targetRuntimeId &&
      source.sourceTowerRuntimeId === towerRuntimeId &&
      (effectKind === null || source.effectKind === effectKind);
  });
  return matches;
}

function allocateAndAttribute(accumulator, total, weightedIds, field, defenseResolver) {
  const allocations = allocateLargestRemainder(total, weightedIds);
  allocations.forEach(function (allocation) {
    addAttribution(accumulator, allocation.runtimeId,
      defenseResolver(allocation.runtimeId), field, allocation.value);
  });
}

function addChecked(target, key, amount, label) {
  target[key] = safeInteger(target[key] + safeInteger(amount, label), label);
}

function requireTelemetry(telemetry, expectedTick) {
  exactFields(telemetry, ["records", "schemaVersion", "tick"], "Balance telemetry");
  if (telemetry.schemaVersion !== TELEMETRY_SCHEMA_VERSION || telemetry.tick !== expectedTick) {
    throw new RangeError("Balance telemetry identity or tick does not match its input boundary");
  }
  if (!Array.isArray(telemetry.records) || telemetry.records.length > TELEMETRY_RECORD_LIMIT) {
    throw new RangeError("Balance telemetry record count exceeds the schema-v1 bound");
  }
  telemetry.records.forEach(function (record, ordinal) {
    if (!isPlainRecord(record) || record.ordinal !== ordinal) {
      throw new RangeError("Balance telemetry ordinals must be contiguous reducer order");
    }
  });
  return telemetry;
}

function foldTelemetryTick(accumulator, stateBefore, result, resolvers) {
  if (!accumulator || !isPlainRecord(accumulator)) throw new TypeError("Balance accumulator is required");
  if (!stateBefore || !result || !result.state) throw new TypeError("A bound state transition is required");
  const telemetry = requireTelemetry(result.telemetry, stateBefore.tick);
  const hooks = resolvers || {};
  result.events.forEach(function (event) {
    accumulator.eventCounts[event.eventId] = (accumulator.eventCounts[event.eventId] || 0) + 1;
    if (event.eventId === "talos.threshold") accumulator.missionFacts.thresholdTransitions += 1;
    if (event.eventId === "talos.expose") accumulator.missionFacts.warningsMatured += 1;
  });
  telemetry.records.forEach(function (record) {
    accumulator.telemetryRecords += 1;
    if (record.kind === "spawn") {
      const durability = safeInteger(record.maximumHpMilli + record.initialShieldMilli, "Spawn durability");
      accumulator.spawns[String(record.enemyRuntimeId)] = {
        durabilityMilli: durability,
        lineageId: record.lineageId,
        routeId: record.routeId,
      };
      accumulator.entities[String(record.enemyRuntimeId)] = {
        appliedMilli: 0,
        actualDistance: null,
        controlValueMilli: 0,
        directValueMilli: 0,
        supportValueMilli: 0,
        preventedLeakValueMilli: 0,
        baseDurabilityMilli: durability,
        baseSpeedDistanceUnitsPerSecond: record.baseSpeedDistanceUnitsPerSecond,
        entityKind: record.entityKind,
        lineageId: record.lineageId,
        ownerId: record.ownerId,
        routeId: record.routeId,
        controlDistanceByTower: Object.create(null),
        leaked: false,
        noSupportRemainingMilli: durability,
        shadowDistance: null,
        shadowLeaked: false,
        shadowMovementState: accumulator.authorities
          ? accumulator.authorities.movement.createMovementState()
          : null,
      };
      if (record.entityKind === "boss" && record.ownerId === "talos-prototype") {
        accumulator.missionFacts.talosRuntimeId = record.enemyRuntimeId;
        accumulator.missionFacts.talosLineageId = record.lineageId;
        accumulator.missionFacts.talosSpawned = true;
      } else if (accumulator.missionFacts.talosLineageId !== null &&
          record.lineageId === accumulator.missionFacts.talosLineageId) {
        accumulator.missionFacts.podChildrenReleased += 1;
      }
      accumulator.routes[record.routeId] = true;
    } else if (record.kind === "aether-transaction") {
      addChecked(accumulator.economy, "debitsAether", record.debitAether, "Aether debits");
      addChecked(accumulator.economy, "creditsAether", record.creditAether, "Aether credits");
      if (record.action === "sell") addChecked(accumulator.economy, "sellCreditsAether", record.creditAether, "Sell credits");
      accumulator.economy.actions[record.action] = (accumulator.economy.actions[record.action] || 0) + 1;
      if (record.towerRuntimeId !== null) {
        const towerKey = String(record.towerRuntimeId);
        const usage = towerUsageRecord(accumulator, record.towerRuntimeId, record.defenseId);
        if (record.action === "sell") {
          delete accumulator.economy.activeInvestmentByTower[towerKey];
          usage.sold = true;
        }
        else if (record.action === "build" || record.action === "upgrade") {
          accumulator.economy.activeInvestmentByTower[towerKey] = record.investedAfterAether;
          accumulator.towerDefenseIds[towerKey] = record.defenseId;
          if (record.action === "build") {
            usage.builtTick = stateBefore.tick;
            usage.builtPadId = record.padId;
            usage.builtBeforeFinalWave = accumulator.authorities === null ||
              stateBefore.management.clearedWaves < accumulator.authorities.waveCount - 1;
            if (accumulator.firstAcceptedBuildPadId === null) {
              accumulator.firstAcceptedBuildPadId = record.padId;
            }
            const padClass = m04PadClass(accumulator.authorities, record.padId);
            if (padClass === "north") accumulator.missionFacts.builtNorthLocal = true;
            else if (padClass === "south") accumulator.missionFacts.builtSouthLocal = true;
            else if (padClass === "shared") accumulator.missionFacts.builtShared = true;
          } else if (accumulator.firstPaidUpgrade === null) {
            accumulator.firstPaidUpgrade = {
              tick: stateBefore.tick,
              waveIndex: stateBefore.management.clearedWaves + 1,
            };
          }
        }
      }
      const simultaneousInvestment = Object.keys(accumulator.economy.activeInvestmentByTower).reduce(
        function (sum, towerKey) {
          return safeInteger(sum + accumulator.economy.activeInvestmentByTower[towerKey],
            "Simultaneous investment");
        },
        0
      );
      accumulator.economy.maximumSimultaneousInvestmentAether = Math.max(
        accumulator.economy.maximumSimultaneousInvestmentAether,
        simultaneousInvestment
      );
      if (record.padId !== null) accumulator.pads[record.padId] = true;
    } else if (record.kind === "activation") {
      accumulator.activations[record.actionId] = (accumulator.activations[record.actionId] || 0) + 1;
      if (record.padId !== null) accumulator.pads[record.padId] = true;
      const usage = towerUsageRecord(accumulator, record.sourceTowerRuntimeId, record.defenseId);
      if (record.actionId === "splash-blast" && record.outcome === "accepted" &&
          record.selectedTargetRuntimeIds.length >= 2) usage.multiTargetActivations += 1;
      if (record.actionId === "guard-contact" && record.outcome === "accepted") {
        usage.acceptedGuardContacts += 1;
      }
      if (accumulator.authorities && accumulator.authorities.missionId === "m04" &&
          record.outcome === "accepted" && record.eligibleTargetRuntimeIds.length > 1) {
        const routeIds = new Set();
        let allShared = true;
        record.eligibleTargetRuntimeIds.forEach(function (runtimeId) {
          const candidate = accumulator.entities[String(runtimeId)];
          if (!candidate) { allShared = false; return; }
          routeIds.add(candidate.routeId);
          const sharedStart = accumulator.authorities.sharedRouteStartByRoute[candidate.routeId];
          if (!Number.isSafeInteger(sharedStart) || candidate.actualDistance === null ||
              candidate.actualDistance < sharedStart) allShared = false;
        });
        if (allShared && routeIds.size >= 2 && record.selectedTargetRuntimeIds.length > 0) {
          accumulator.missionFacts.crossRouteComparatorSelection = true;
        }
      }
    } else if (record.kind === "movement-control") {
      accumulator.routes[record.routeId] = true;
      if (record.sourceEffectRuntimeIds.length !== record.sourceRuntimeIds.length) {
        throw new RangeError("Movement effect and source arrays must align");
      }
      if (record.sourceEffectRuntimeIds.length === 0 && record.sourceTowerRuntimeIds.length !== 0) {
        throw new RangeError("Uncontrolled movement cannot name tower sources");
      }
      const resolvedTowerIds = [];
      record.sourceRuntimeIds.forEach(function (sourceRuntimeId) {
        if (record.sourceTowerRuntimeIds.indexOf(sourceRuntimeId) !== -1) return;
        const matches = Object.keys(accumulator.effectSources).filter(function (key) {
          const source = accumulator.effectSources[key];
          return source.sourceRuntimeId === sourceRuntimeId &&
            source.targetRuntimeId === record.enemyRuntimeId && source.sourceTowerRuntimeId !== null &&
            source.effectKind === "status" &&
            ["drench", "slow", "stun"].indexOf(source.statusId) !== -1;
        });
        if (matches.length !== 1) {
          throw new Error("Movement source ownership omission lacks one bounded prior effect provenance record");
        }
        resolvedTowerIds.push(accumulator.effectSources[matches[0]].sourceTowerRuntimeId);
      });
      record.sourceTowerRuntimeIds.forEach(function (runtimeId) { resolvedTowerIds.push(runtimeId); });
      const uniqueTowerIds = Array.from(new Set(resolvedTowerIds)).sort(function (left, right) {
        return left - right;
      });
      if (record.scaledReductionBp > 0) {
        uniqueTowerIds.forEach(function (towerRuntimeId) {
          towerUsageRecord(accumulator, towerRuntimeId,
            accumulator.towerDefenseIds[String(towerRuntimeId)] || null)
            .strongestMovementEnemyTicks += 1;
        });
      }
      const entity = accumulator.entities[String(record.enemyRuntimeId)];
      if (!entity) throw new Error("Movement telemetry lacks a prior spawn record");
      if (entity.shadowDistance === null) entity.shadowDistance = record.priorRouteDistance;
      entity.actualDistance = record.nextRouteDistance;
      if (accumulator.authorities) {
        const routeLength = accumulator.authorities.routeLengths[record.routeId];
        if (!Number.isSafeInteger(routeLength)) throw new Error("Shadow movement lacks a compiled route length");
        if (!entity.shadowLeaked) {
          const movement = accumulator.authorities.movement.advanceMovementTick(
            entity.shadowMovementState,
            entity.baseSpeedDistanceUnitsPerSecond,
            10000
          );
          entity.shadowMovementState = movement.state;
          const progress = accumulator.authorities.movement.advanceRouteProgress(
            routeLength,
            entity.shadowDistance,
            movement.advance
          );
          entity.shadowDistance = progress.distance;
          entity.shadowLeaked = progress.reachedEnd && entity.noSupportRemainingMilli > 0;
          // Route progress is capped at its endpoint. Only the shadow distance that
          // actually advanced is available as prevented-distance weight.
          const prevented = Math.max(0, progress.appliedAdvance - record.actualAdvanceDistance);
          if (prevented > 0 && uniqueTowerIds.length === 0) {
            const historical = Object.keys(entity.controlDistanceByTower).map(function (towerId) {
              return { runtimeId: Number(towerId), weight: entity.controlDistanceByTower[towerId] };
            }).filter(function (entry) { return entry.weight > 0; }).sort(function (left, right) {
              return left.runtimeId - right.runtimeId;
            });
            if (historical.length === 0) {
              throw new Error("Positive prevented-distance tail lacks a historical winning control source");
            }
            allocateLargestRemainder(prevented, historical).forEach(function (allocation) {
              entity.controlDistanceByTower[allocation.runtimeId] = safeInteger(
                entity.controlDistanceByTower[allocation.runtimeId] + allocation.value,
                "Historical prevented-distance tail"
              );
            });
          } else {
            uniqueTowerIds.forEach(function (towerRuntimeId) {
              entity.controlDistanceByTower[towerRuntimeId] = safeInteger(
                (entity.controlDistanceByTower[towerRuntimeId] || 0) + prevented,
                "Accumulated prevented distance"
              );
            });
          }
        }
      } else if (record.scaledReductionBp > 0) {
        accumulator.unresolvedEvidence.noControlShadow = true;
      }
    } else if (record.kind === "damage") {
      const attempted = safeInteger(record.attemptedShieldDamageMilli + record.eligibleHpDamageMilli,
        "Attempted damage");
      const applied = safeInteger(record.appliedShieldDamageMilli + record.appliedHpDamageMilli,
        "Applied damage");
      const noExternal = safeInteger(record.noExternalAppliedShieldDamageMilli +
        record.noExternalAppliedHpDamageMilli, "No-external damage");
      const deferred = safeInteger(record.deferredHpDamageMilli, "Deferred damage");
      const overkill = safeInteger(record.overkillHpDamageMilli, "Overkill damage");
      addChecked(accumulator.combat, "attemptedDamageMilli", attempted, "Attempted damage total");
      addChecked(accumulator.combat, "appliedDamageMilli", applied, "Applied damage total");
      addChecked(accumulator.combat, "deferredDamageMilli", deferred, "Deferred damage total");
      addChecked(accumulator.combat, "overkillDamageMilli", overkill, "Overkill damage total");
      const entity = accumulator.entities[String(record.targetRuntimeId)];
      if (!entity) throw new Error("Damage telemetry lacks a prior spawn record");
      entity.appliedMilli = safeInteger(entity.appliedMilli + applied, "Entity applied damage");
      const shadowApplied = record.revealSourceTowerRuntimeIds.length > 0 ? 0 : noExternal;
      entity.noSupportRemainingMilli = Math.max(0,
        entity.noSupportRemainingMilli - shadowApplied);
      const firingUsage = towerUsageRecord(accumulator, record.sourceTowerRuntimeId, record.defenseId);
      if (applied > 0) firingUsage.positiveAppliedHits += 1;
      if (applied > 0 && entity.actualDistance !== null) {
        noteM04MaterialEffect(accumulator, record.padId, record.targetRouteId, entity.actualDistance);
      }
      if (applied > 0 && accumulator.missionFacts.exposureWindows.length > 0 &&
          record.targetRuntimeId === accumulator.missionFacts.talosRuntimeId) {
        const window = accumulator.missionFacts.exposureWindows[
          accumulator.missionFacts.exposureWindows.length - 1
        ];
        if (!window.closed) window.positiveDamage = true;
      }
      let remaining = applied;
      const supportCredit = Math.min(remaining, Math.max(0, applied - noExternal));
      if (supportCredit > 0) {
        let weights;
        if (record.supportSourceTowerRuntimeIds.length === 1) {
          const onlyId = record.supportSourceTowerRuntimeIds[0];
          const sources = sourceProvenanceForTower(accumulator, record.targetRuntimeId, onlyId,
            "external-amplification");
          if (sources.length !== 1 || sources[0].appliedMagnitude <= 0) {
            throw new Error("Single-source amplification lacks one positive active effect weight");
          }
          weights = [{ runtimeId: onlyId, weight: sources[0].appliedMagnitude }];
        } else if (typeof hooks.supportWeights === "function") {
          weights = hooks.supportWeights(record, stateBefore, accumulator);
        } else if (record.supportSourceTowerRuntimeIds.length > 1) {
          weights = record.supportSourceTowerRuntimeIds.map(function (towerRuntimeId) {
            const sources = sourceProvenanceForTower(accumulator, record.targetRuntimeId,
              towerRuntimeId, "external-amplification");
            if (sources.length !== 1 || sources[0].appliedMagnitude <= 0) {
              throw new Error("Amplification attribution lacks one positive active effect weight");
            }
            return { runtimeId: towerRuntimeId, weight: sources[0].appliedMagnitude };
          });
        } else {
          throw new Error("Multiple amplification sources require bound support-weight resolution");
        }
        allocateAndAttribute(accumulator, supportCredit, weights, "supportValueMilli",
          function (towerRuntimeId) {
            const sources = sourceProvenanceForTower(accumulator, record.targetRuntimeId,
              towerRuntimeId, "external-amplification");
            return sources.length === 1 ? sources[0].defenseId : null;
          });
        record.supportSourceTowerRuntimeIds.forEach(function (towerRuntimeId) {
          towerUsageRecord(accumulator, towerRuntimeId,
            accumulator.towerDefenseIds[String(towerRuntimeId)] || null)
            .positivelyAmplifiedMarkedHits += 1;
        });
        addChecked(accumulator.combat, "supportValueMilli", supportCredit, "Support value total");
        entity.supportValueMilli = safeInteger(entity.supportValueMilli + supportCredit,
          "Entity support value");
        remaining -= supportCredit;
      }
      if (remaining > 0 && record.revealSourceTowerRuntimeIds.length > 0) {
        const revealTowerId = record.revealSourceTowerRuntimeIds[0];
        const revealSources = sourceProvenanceForTower(accumulator, record.targetRuntimeId,
          revealTowerId, "status").filter(function (source) { return source.statusId === "reveal"; });
        if (revealSources.length !== 1) {
          throw new Error("Reveal attribution lacks one active lowest-runtime source");
        }
        addAttribution(accumulator, revealTowerId, revealSources[0].defenseId,
          "supportValueMilli", remaining);
        towerUsageRecord(accumulator, revealTowerId, revealSources[0].defenseId)
          .revealEnabledHits += 1;
        addChecked(accumulator.combat, "supportValueMilli", remaining, "Reveal value total");
        entity.supportValueMilli = safeInteger(entity.supportValueMilli + remaining,
          "Entity Reveal value");
        remaining = 0;
      }
      if (remaining > 0 && accumulator.authorities) {
        // Splash collateral may legitimately receive damage while already outside
        // the firing tower's acquisition range. Range-created C exists only when
        // the real target is in range and its no-control shadow is not.
        const actualOutsideRange = entity.actualDistance === null ? true :
          accumulator.authorities.shadowOutsideRange(record, entity.actualDistance);
        const controlEnabled = entity.shadowLeaked || (!actualOutsideRange &&
          accumulator.authorities.shadowOutsideRange(
            record, entity.shadowDistance === null ? 0 : entity.shadowDistance
          ));
        if (controlEnabled) {
          const weights = Object.keys(entity.controlDistanceByTower).map(function (towerId) {
            return { runtimeId: Number(towerId), weight: entity.controlDistanceByTower[towerId] };
          }).filter(function (entry) { return entry.weight > 0; }).sort(function (left, right) {
            return left.runtimeId - right.runtimeId;
          });
          if (weights.length === 0) throw new Error("Control-enabled damage lacks prevented-distance weights");
          allocateAndAttribute(accumulator, remaining, weights, "controlValueMilli",
            function (towerRuntimeId) {
              const defenseId = accumulator.towerDefenseIds[String(towerRuntimeId)];
              if (!defenseId) throw new Error("Control attribution lacks persistent tower defense identity");
              return defenseId;
            });
          addChecked(accumulator.combat, "controlValueMilli", remaining, "Control value total");
          entity.controlValueMilli = safeInteger(entity.controlValueMilli + remaining,
            "Entity control value");
          remaining = 0;
        }
      } else if (remaining > 0 && typeof hooks.controlValue === "function") {
        const control = safeInteger(hooks.controlValue(record, stateBefore, remaining), "Control value");
        if (control > remaining) throw new RangeError("Control value cannot exceed the remaining applied damage");
        addChecked(accumulator.combat, "controlValueMilli", control, "Control value total");
        entity.controlValueMilli = safeInteger(entity.controlValueMilli + control,
          "Entity control value");
        remaining -= control;
      }
      addChecked(accumulator.combat, "directValueMilli", remaining, "Direct value total");
      entity.directValueMilli = safeInteger(entity.directValueMilli + remaining,
        "Entity direct value");
      addAttribution(accumulator, record.sourceTowerRuntimeId, record.defenseId,
        "directValueMilli", remaining);
      accumulator.routes[record.targetRouteId] = true;
      accumulator.pads[record.padId] = true;
    } else if (record.kind === "effect") {
      const key = [record.effectKind, record.statusId, record.sourceRuntimeId,
        record.targetRuntimeId].join("\u0000");
      const provenance = [record.sourceTowerRuntimeId, record.defenseId, record.level, record.padId];
      const nullCount = provenance.filter(function (value) { return value === null; }).length;
      if (nullCount !== 0 && nullCount !== provenance.length) {
        throw new Error("Effect player provenance must be wholly present or wholly unavailable");
      }
      if (record.action === "apply" || record.action === "refresh") {
        let inherited = null;
        if (nullCount !== 0 && record.action === "refresh" && record.effectKind === "status") {
          const delayedKey = ["delayed-status", record.statusId, record.sourceRuntimeId,
            record.targetRuntimeId].join("\u0000");
          if (own(accumulator.effectSources, delayedKey)) {
            inherited = accumulator.effectSources[delayedKey];
            delete accumulator.effectSources[delayedKey];
          }
        }
        if (nullCount !== 0 && inherited === null &&
            !(accumulator.entities[String(record.sourceRuntimeId)] &&
              accumulator.entities[String(record.sourceRuntimeId)].entityKind === "boss") &&
            !(typeof hooks.isNonPlayerBossSource === "function" &&
              hooks.isNonPlayerBossSource(record, stateBefore) === true)) {
          throw new Error("Null-provenance effect refresh lacks one prior delayed-status transition");
        }
        accumulator.effectSources[key] = {
          effectKind: record.effectKind,
          statusId: record.statusId,
          sourceRuntimeId: record.sourceRuntimeId,
          targetRuntimeId: record.targetRuntimeId,
          sourceTowerRuntimeId: inherited ? inherited.sourceTowerRuntimeId : record.sourceTowerRuntimeId,
          defenseId: inherited ? inherited.defenseId : record.defenseId,
          level: inherited ? inherited.level : record.level,
          padId: inherited ? inherited.padId : record.padId,
          appliedMagnitude: record.appliedMagnitude,
        };
        if (accumulator.effectSources[key].sourceTowerRuntimeId !== null) {
          accumulator.towerDefenseIds[String(accumulator.effectSources[key].sourceTowerRuntimeId)] =
            accumulator.effectSources[key].defenseId;
        }
        if (Object.keys(accumulator.effectSources).length > TELEMETRY_TARGET_LIMIT) {
          throw new RangeError("Active balance effect provenance exceeds its bounded target ceiling");
        }
        const target = accumulator.entities[String(record.targetRuntimeId)];
        if (target && target.actualDistance !== null && record.sourceTowerRuntimeId !== null &&
            (record.outcome === "applied" || record.outcome === "refreshed")) {
          noteM04MaterialEffect(accumulator, record.padId, record.targetRouteId, target.actualDistance);
        }
        if (record.effectKind === "boss-exposure" &&
            record.targetRuntimeId === accumulator.missionFacts.talosRuntimeId) {
          accumulator.missionFacts.exposureWindows.push({ closed: false, positiveDamage: false });
        }
      } else if (record.action === "remove" || record.action === "expire") {
        if (nullCount === provenance.length && !own(accumulator.effectSources, key)) {
          throw new Error("Null-provenance effect lifecycle lacks a prior apply/refresh record");
        }
        delete accumulator.effectSources[key];
        if (record.effectKind === "boss-exposure" &&
            record.targetRuntimeId === accumulator.missionFacts.talosRuntimeId) {
          const window = accumulator.missionFacts.exposureWindows[
            accumulator.missionFacts.exposureWindows.length - 1
          ];
          if (window && !window.closed) window.closed = true;
        }
      }
    } else if (record.kind === "leak") {
      accumulator.leaks += 1;
      accumulator.routes[record.routeId] = true;
      const entity = accumulator.entities[String(record.enemyRuntimeId)];
      if (!entity) throw new Error("Leak telemetry lacks a prior spawn record");
      entity.leaked = true;
    }
  });
  accumulator.ticks += 1;
  if (result.state.tick > stateBefore.tick) {
    result.state.management.towers.forEach(function (tower) {
      towerUsageRecord(accumulator, tower.id, tower.defenseId).waveActiveOwnedTicks += 1;
    });
  }
  accumulator.economy.finalBankAether = result.state.management.aether;
  accumulator.economy.netConsumedAether = safeInteger(
    accumulator.economy.debitsAether - accumulator.economy.sellCreditsAether,
    "Net consumed Aether"
  );
  accumulator.finalState = result.state;
  return accumulator;
}

function finalEnemyDurability(finalState, runtimeId) {
  if (!finalState || !Array.isArray(finalState.enemies)) return 0;
  const enemy = finalState.enemies.find(function (candidate) { return candidate.id === runtimeId; });
  if (!enemy) return 0;
  return safeInteger(enemy.hpMilli + enemy.shields.reduce(function (sum, shield) {
    return safeInteger(sum + shield.remainingMilli, "Final enemy shield durability");
  }, 0), "Final enemy durability");
}

function terminallyUnprocessedEndpoint(accumulator, entity) {
  if (!accumulator.finalState || accumulator.finalState.outcome !== "defeat" ||
      accumulator.finalState.integrity !== 0 || !accumulator.authorities ||
      !accumulator.authorities.routeLengths || entity.actualDistance === null) return false;
  const routeLength = accumulator.authorities.routeLengths[entity.routeId];
  return Number.isSafeInteger(routeLength) && entity.actualDistance === routeLength;
}

function finalizeAccumulator(accumulator, options) {
  const settings = options || {};
  const combat = accumulator.combat;
  if (!accumulator.preventedLeakFinalized) {
    Object.keys(accumulator.entities).sort(function (left, right) {
      return Number(left) - Number(right);
    }).forEach(function (runtimeKey) {
      const entity = accumulator.entities[runtimeKey];
      if (!entity.shadowLeaked || entity.leaked) return;
      // Once an earlier same-tick leak has reduced integrity to zero, the kernel
      // terminates leak arbitration. A later live entity already at the exact
      // endpoint is terminally unprocessed, not a control-preserved survivor.
      if (terminallyUnprocessedEndpoint(accumulator, entity)) return;
      const remaining = finalEnemyDurability(accumulator.finalState, Number(runtimeKey));
      const prevented = Math.min(entity.baseDurabilityMilli - entity.appliedMilli, remaining);
      if (prevented <= 0) return;
      const weights = Object.keys(entity.controlDistanceByTower).map(function (towerId) {
        return { runtimeId: Number(towerId), weight: entity.controlDistanceByTower[towerId] };
      }).filter(function (entry) { return entry.weight > 0; }).sort(function (left, right) {
        return left.runtimeId - right.runtimeId;
      });
      if (weights.length === 0) {
        throw new Error("Prevented-leak durability lacks a positive resolved control weight");
      }
      allocateAndAttribute(accumulator, prevented, weights, "preventedLeakValueMilli",
        function (towerRuntimeId) {
          const defenseId = accumulator.towerDefenseIds[String(towerRuntimeId)];
          if (!defenseId) throw new Error("Prevented-leak attribution lacks persistent tower defense identity");
          return defenseId;
        });
      addChecked(combat, "preventedLeakValueMilli", prevented, "Prevented-leak value total");
      entity.preventedLeakValueMilli = prevented;
    });
    accumulator.preventedLeakFinalized = true;
  }
  const numerator = safeInteger(
    combat.directValueMilli + combat.supportValueMilli + combat.controlValueMilli +
      combat.preventedLeakValueMilli,
    "Combat numerator"
  );
  if (combat.directValueMilli + combat.supportValueMilli + combat.controlValueMilli !==
      combat.appliedDamageMilli) {
    throw new RangeError("Conserved applied damage attribution does not equal actual pool decrements");
  }
  const entityConservation = Object.keys(accumulator.entities).sort(function (left, right) {
    return Number(left) - Number(right);
  }).map(function (runtimeKey) {
    const entity = accumulator.entities[runtimeKey];
    const attributedApplied = entity.directValueMilli + entity.supportValueMilli +
      entity.controlValueMilli;
    if (attributedApplied !== entity.appliedMilli ||
        attributedApplied + entity.preventedLeakValueMilli > entity.baseDurabilityMilli) {
      throw new RangeError("Per-entity conserved value exceeds authoritative durability");
    }
    return {
      enemyRuntimeId: Number(runtimeKey),
      baseDurabilityMilli: entity.baseDurabilityMilli,
      appliedDamageMilli: entity.appliedMilli,
      directValueMilli: entity.directValueMilli,
      supportValueMilli: entity.supportValueMilli,
      controlValueMilli: entity.controlValueMilli,
      preventedLeakValueMilli: entity.preventedLeakValueMilli,
    };
  });
  const unresolved = Object.keys(accumulator.unresolvedEvidence).sort();
  if (settings.requireComplete === true && unresolved.length > 0) {
    throw new Error("Conserved evidence has unresolved authorities: " + unresolved.join(", "));
  }
  const denominator = accumulator.economy.netConsumedAether;
  const final = accumulator.finalState;
  const bossLineageLeaks = accumulator.missionFacts.talosLineageId === null ? 0 :
    Object.keys(accumulator.entities).filter(function (runtimeKey) {
      const entity = accumulator.entities[runtimeKey];
      return entity.lineageId === accumulator.missionFacts.talosLineageId && entity.leaked;
    }).length;
  const talosEntity = accumulator.missionFacts.talosRuntimeId === null ? null :
    accumulator.entities[String(accumulator.missionFacts.talosRuntimeId)];
  const m04Facts = {
    builtNorthLocal: accumulator.missionFacts.builtNorthLocal,
    builtShared: accumulator.missionFacts.builtShared,
    builtSouthLocal: accumulator.missionFacts.builtSouthLocal,
    crossRouteComparatorSelection: accumulator.missionFacts.crossRouteComparatorSelection,
    northLocalBeforeJoin: accumulator.missionFacts.northLocalBeforeJoin,
    sharedAffectedRouteIds: Object.keys(accumulator.missionFacts.sharedAffectedRouteIds).sort(),
    southLocalBeforeJoin: accumulator.missionFacts.southLocalBeforeJoin,
  };
  const m05Facts = {
    bossLineageLeaks: bossLineageLeaks,
    exposureWindowsWithPositiveDamage: accumulator.missionFacts.exposureWindows.filter(function (window) {
      return window.positiveDamage;
    }).length,
    podChildrenReleased: accumulator.missionFacts.podChildrenReleased,
    talosDied: !!talosEntity && !talosEntity.leaked &&
      finalEnemyDurability(final, accumulator.missionFacts.talosRuntimeId) === 0,
    talosSpawned: accumulator.missionFacts.talosSpawned,
    thresholdTransitions: accumulator.missionFacts.thresholdTransitions,
    victory: !!final && final.outcome === "victory",
    warningsMatured: accumulator.missionFacts.warningsMatured,
  };
  const finalTowers = final ? final.management.towers.map(function (tower) {
    return {
      defenseId: tower.defenseId,
      id: tower.id,
      investedAether: tower.investedAether,
      level: tower.level,
      padId: tower.padId,
      targetPolicy: tower.targetPolicy,
    };
  }).sort(function (left, right) { return left.id - right.id; }) : [];
  const finalInvestmentByDefense = Object.create(null);
  finalTowers.forEach(function (tower) {
    finalInvestmentByDefense[tower.defenseId] = safeInteger(
      (finalInvestmentByDefense[tower.defenseId] || 0) + tower.investedAether,
      "Final family investment"
    );
  });
  const result = {
    schemaVersion: 1,
    formulaVersion: FORMULA_VERSION,
    ticks: accumulator.ticks,
    telemetryRecords: accumulator.telemetryRecords,
    economy: cloneCanonical({
      actions: accumulator.economy.actions,
      creditsAether: accumulator.economy.creditsAether,
      debitsAether: accumulator.economy.debitsAether,
      finalBankAether: accumulator.economy.finalBankAether,
      maximumSimultaneousInvestmentAether: accumulator.economy.maximumSimultaneousInvestmentAether,
      netConsumedAether: accumulator.economy.netConsumedAether,
      sellCreditsAether: accumulator.economy.sellCreditsAether,
    }),
    combat: cloneCanonical(combat),
    entityConservation: cloneCanonical(entityConservation),
    attributionByTower: cloneCanonical(accumulator.attributionByTower),
    attributionByDefense: cloneCanonical(accumulator.attributionByDefense),
    towerUsage: cloneCanonical(accumulator.towerUsage),
    finalTowers: cloneCanonical(finalTowers),
    finalInvestmentByDefense: cloneCanonical(finalInvestmentByDefense),
    finalTowerCount: finalTowers.length,
    occupiedPadCount: new Set(finalTowers.map(function (tower) { return tower.padId; })).size,
    upgradeUnits: finalTowers.reduce(function (sum, tower) {
      return safeInteger(sum + tower.level - 1, "Final upgrade units");
    }, 0),
    firstAcceptedBuildPadId: accumulator.firstAcceptedBuildPadId,
    firstPaidUpgrade: cloneCanonical(accumulator.firstPaidUpgrade),
    eventCounts: cloneCanonical(accumulator.eventCounts),
    m04Facts: m04Facts,
    m05Facts: m05Facts,
    combatValuePerAether: { numerator: numerator, denominator: denominator },
    routeIds: Object.keys(accumulator.routes).sort(),
    padIds: Object.keys(accumulator.pads).sort(),
    outcome: final ? final.outcome : "active",
    terminalWaveIndex: final ? Math.max(1,
      final.management.activeWave || final.management.clearedWaves) : 0,
    score: final ? final.score : 0,
    integrity: final ? final.integrity : 0,
    objectiveResults: final ? cloneCanonical(final.objectiveResults) : [],
    unresolvedEvidence: unresolved,
  };
  return deepFreeze(result);
}

function placementGate(aware, naive) {
  const awareNumerator = safeInteger(aware.numerator, "Aware combat numerator");
  const naiveNumerator = safeInteger(naive.numerator, "Naive combat numerator");
  const awareNetConsumed = safeInteger(aware.denominator, "Aware net consumed Aether");
  const naiveNetConsumed = safeInteger(naive.denominator, "Naive net consumed Aether");
  if (awareNetConsumed <= 0 || naiveNetConsumed <= 0) return false;
  return BigInt(awareNumerator) * BigInt(naiveNetConsumed) * 10000n >=
    BigInt(naiveNumerator) * BigInt(awareNetConsumed) * 11500n;
}

function ratioAtLeast(left, right, requiredBp) {
  const leftNumerator = safeInteger(left.numerator, "Left ratio numerator");
  const leftDenominator = safeInteger(left.denominator, "Left ratio denominator");
  const rightNumerator = safeInteger(right.numerator, "Right ratio numerator");
  const rightDenominator = safeInteger(right.denominator, "Right ratio denominator");
  safeInteger(requiredBp, "Required ratio basis points");
  if (leftDenominator <= 0 || rightDenominator <= 0) return false;
  return BigInt(leftNumerator) * BigInt(rightDenominator) * 10000n >=
    BigInt(rightNumerator) * BigInt(leftDenominator) * BigInt(requiredBp);
}

function materiallyUsedDefense(facts) {
  exactFields(facts, [
    "builtBeforeFinalWave", "defenseId", "metrics", "valueMilli", "waveActiveOwnedTicks",
    "witnessValueMilli",
  ], "Defense material-use facts");
  const defenseId = stableId(facts.defenseId, "Material-use defense ID");
  const base = facts.builtBeforeFinalWave === true &&
    safeInteger(facts.waveActiveOwnedTicks, "Wave-active owned ticks") >= 60 &&
    safeInteger(facts.valueMilli, "Defense conserved value") >= 1000 &&
    safeInteger(facts.witnessValueMilli, "Witness conserved value") > 0 &&
    BigInt(facts.valueMilli) * 100n >= BigInt(facts.witnessValueMilli) * 5n;
  if (!base || !isPlainRecord(facts.metrics)) return false;
  if (defenseId === "sentinel") return safeInteger(facts.metrics.positiveAppliedHits, "Sentinel hits") >= 10;
  if (defenseId === "chronos") return safeInteger(facts.metrics.strongestMovementEnemyTicks,
    "Chronos strongest movement ticks") >= 60;
  if (defenseId === "siege") return safeInteger(facts.metrics.multiTargetActivations,
    "Siege multi-target activations") >= 3;
  if (defenseId === "hoplite") return safeInteger(facts.metrics.acceptedGuardContacts,
    "Hoplite accepted guard contacts") >= 2;
  if (defenseId === "oracle") {
    return safeInteger(facts.metrics.revealEnabledHits, "Oracle Reveal-enabled hits") >= 1 &&
      safeInteger(facts.metrics.positivelyAmplifiedMarkedHits, "Oracle amplified marked hits") >= 3;
  }
  throw new RangeError("Unknown Candidate-slice defense in material-use facts");
}

function conservedValue(row) {
  if (!row) return 0;
  return safeInteger(row.directValueMilli + row.supportValueMilli + row.controlValueMilli +
    row.preventedLeakValueMilli, "Conserved attribution value");
}

function materialUseFactsByDefense(result) {
  if (!result || !isPlainRecord(result.towerUsage) || !isPlainRecord(result.attributionByDefense) ||
      !result.combatValuePerAether) {
    throw new TypeError("Completed conserved scenario result is required for material-use facts");
  }
  const defenseIds = new Set(Object.keys(result.attributionByDefense));
  Object.keys(result.towerUsage).forEach(function (towerId) {
    const usage = result.towerUsage[towerId];
    if (usage.defenseId) defenseIds.add(usage.defenseId);
  });
  const output = Object.create(null);
  Array.from(defenseIds).sort().forEach(function (defenseId) {
    const facts = {
      builtBeforeFinalWave: false,
      defenseId: defenseId,
      metrics: {
        acceptedGuardContacts: 0,
        multiTargetActivations: 0,
        positiveAppliedHits: 0,
        positivelyAmplifiedMarkedHits: 0,
        revealEnabledHits: 0,
        strongestMovementEnemyTicks: 0,
      },
      valueMilli: conservedValue(result.attributionByDefense[defenseId]),
      waveActiveOwnedTicks: 0,
      witnessValueMilli: safeInteger(result.combatValuePerAether.numerator, "Witness value"),
    };
    Object.keys(result.towerUsage).forEach(function (towerId) {
      const usage = result.towerUsage[towerId];
      if (usage.defenseId !== defenseId) return;
      facts.builtBeforeFinalWave = facts.builtBeforeFinalWave || usage.builtBeforeFinalWave === true;
      facts.waveActiveOwnedTicks = safeInteger(facts.waveActiveOwnedTicks + usage.waveActiveOwnedTicks,
        "Family wave-active ticks");
      Object.keys(facts.metrics).forEach(function (metric) {
        facts.metrics[metric] = safeInteger(facts.metrics[metric] + usage[metric],
          "Family material-use metric");
      });
    });
    output[defenseId] = facts;
  });
  return deepFreeze(cloneCanonical(output));
}

function emphasisRows(result) {
  if (!result || !isPlainRecord(result.finalInvestmentByDefense) ||
      !isPlainRecord(result.attributionByDefense)) {
    throw new TypeError("Completed scenario family facts are required");
  }
  const defenseIds = new Set(Object.keys(result.finalInvestmentByDefense));
  Object.keys(result.attributionByDefense).forEach(function (id) { defenseIds.add(id); });
  return deepFreeze(Array.from(defenseIds).sort().map(function (defenseId) {
    return {
      defenseId: defenseId,
      investmentAether: result.finalInvestmentByDefense[defenseId] || 0,
      valueMilli: conservedValue(result.attributionByDefense[defenseId]),
    };
  }));
}

function representativeM01(facts) {
  exactFields(facts, [
    "finalTowerCount", "netConsumedAether", "occupiedPadCount", "upgradeUnits",
  ], "Representative m01 facts");
  return (facts.finalTowerCount === 4 || facts.finalTowerCount === 5) &&
    safeInteger(facts.upgradeUnits, "Upgrade units") >= 1 && facts.upgradeUnits <= 3 &&
    safeInteger(facts.netConsumedAether, "Net consumed Aether") >= 360 &&
    facts.netConsumedAether <= 410 &&
    safeInteger(facts.occupiedPadCount, "Occupied pad count") < 10;
}

function medianInteger(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length % 2 === 0) {
    throw new RangeError("Exact median requires a nonempty odd-sized integer set");
  }
  const sorted = values.map(function (value) { return safeInteger(value, "Median value"); })
    .sort(function (left, right) { return left - right; });
  return sorted[(sorted.length - 1) / 2];
}

function m01RepresentativeSetGate(results) {
  if (!Array.isArray(results) || results.length !== 3 ||
      results.some(function (result) {
        exactFields(result, [
          "finalBankAether", "finalTowerCount", "netConsumedAether", "occupiedPadCount",
          "upgradeUnits",
        ], "Representative m01 set result");
        return !representativeM01({
          finalTowerCount: result.finalTowerCount,
          netConsumedAether: result.netConsumedAether,
          occupiedPadCount: result.occupiedPadCount,
          upgradeUnits: result.upgradeUnits,
        });
      })) return false;
  return medianInteger(results.map(function (result) { return result.upgradeUnits; })) === 2 &&
    medianInteger(results.map(function (result) { return result.finalBankAether; })) < 65;
}

function emphasisGate(namedDefenseId, familyResults) {
  stableId(namedDefenseId, "Emphasis defense ID");
  if (!Array.isArray(familyResults) || familyResults.length < 2) return false;
  let totalInvestment = 0;
  let totalValue = 0;
  const rows = familyResults.map(function (row) {
    exactFields(row, ["defenseId", "investmentAether", "valueMilli"], "Emphasis family");
    totalInvestment += safeInteger(row.investmentAether, "Family investment");
    totalValue += safeInteger(row.valueMilli, "Family value");
    return row;
  });
  const named = rows.find(function (row) { return row.defenseId === namedDefenseId; });
  if (!named || totalInvestment <= 0 || totalValue <= 0) return false;
  const nextInvestment = Math.max.apply(null, rows.filter(function (row) {
    return row !== named;
  }).map(function (row) { return row.investmentAether; }));
  const nextValue = Math.max.apply(null, rows.filter(function (row) { return row !== named; })
    .map(function (row) { return row.valueMilli; }));
  return BigInt(named.investmentAether) * 100n >= BigInt(totalInvestment) * 35n &&
    BigInt(named.valueMilli) * 100n >= BigInt(totalValue) * 35n &&
    BigInt(named.investmentAether - nextInvestment) * 100n >= BigInt(totalInvestment) * 10n &&
    BigInt(named.valueMilli - nextValue) * 100n >= BigInt(totalValue) * 10n;
}

function synergyStatus(synergyNumerator, baselineNumerator) {
  safeInteger(synergyNumerator, "Synergy numerator");
  safeInteger(baselineNumerator, "Synergy baseline");
  if (baselineNumerator <= 0) return "review";
  return BigInt(synergyNumerator) * 100n > BigInt(baselineNumerator) * 135n ? "review" : "pass";
}

function materiallyDifferentLoadouts(left, right, materialUseByDefense) {
  if (!Array.isArray(left) || !Array.isArray(right)) throw new TypeError("Loadouts must be arrays");
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const symmetricDifference = Array.from(leftSet).filter(function (id) { return !rightSet.has(id); })
    .concat(Array.from(rightSet).filter(function (id) { return !leftSet.has(id); }));
  return symmetricDifference.length >= 2 && symmetricDifference.every(function (id) {
    return materialUseByDefense && materialUseByDefense[id] === true;
  });
}

function m04ExerciseGate(facts) {
  exactFields(facts, [
    "builtNorthLocal", "builtShared", "builtSouthLocal", "crossRouteComparatorSelection",
    "northLocalBeforeJoin", "sharedAffectedRouteIds", "southLocalBeforeJoin",
  ], "Mission 4 exercise facts");
  return facts.builtNorthLocal === true && facts.builtSouthLocal === true && facts.builtShared === true &&
    facts.northLocalBeforeJoin === true && facts.southLocalBeforeJoin === true &&
    Array.isArray(facts.sharedAffectedRouteIds) &&
    new Set(facts.sharedAffectedRouteIds).size >= 2 && facts.crossRouteComparatorSelection === true;
}

function m05ExerciseGate(facts) {
  exactFields(facts, [
    "bossLineageLeaks", "exposureWindowsWithPositiveDamage", "podChildrenReleased",
    "talosDied", "talosSpawned", "thresholdTransitions", "victory", "warningsMatured",
  ], "Mission 5 exercise facts");
  return facts.talosSpawned === true && facts.talosDied === true &&
    safeInteger(facts.bossLineageLeaks, "Boss-lineage leaks") === 0 &&
    safeInteger(facts.thresholdTransitions, "Talos threshold transitions") === 3 &&
    safeInteger(facts.warningsMatured, "Talos matured warnings") === 3 &&
    safeInteger(facts.exposureWindowsWithPositiveDamage, "Damaged exposure windows") === 3 &&
    safeInteger(facts.podChildrenReleased, "Released Talos children") === 12 && facts.victory === true;
}

function pairAtSharedCheckpoint(left, right) {
  if (!left || !right || !left.replay || !right.replay || !left.result || !right.result) {
    throw new TypeError("Two completed scenario runs are required for a shared checkpoint");
  }
  const checkpointTick = Math.max(
    left.replay.finalClaim.durationTicks,
    right.replay.finalClaim.durationTicks
  );
  return deepFreeze({
    checkpointTick: checkpointTick,
    left: {
      durationTicks: left.replay.finalClaim.durationTicks,
      combatValuePerAether: cloneCanonical(left.result.combatValuePerAether),
    },
    right: {
      durationTicks: right.replay.finalClaim.durationTicks,
      combatValuePerAether: cloneCanonical(right.result.combatValuePerAether),
    },
  });
}

function compiledAxisAvailability(content) {
  if (!content || !isPlainRecord(content.enemies) || !isPlainRecord(content.bosses)) {
    throw new TypeError("Compiled Candidate content roster is required");
  }
  const roster = Object.keys(content.enemies).map(function (id) { return content.enemies[id]; })
    .concat(Object.keys(content.bosses).map(function (id) { return content.bosses[id]; }));
  const airOwnerIds = roster.filter(function (owner) {
    return owner.routeKinds.indexOf("air") !== -1;
  }).map(function (owner) { return owner.id; }).sort();
  const shieldOwnerIds = roster.filter(function (owner) {
    return owner.shieldPools.length > 0;
  }).map(function (owner) { return owner.id; }).sort();
  return deepFreeze({
    air: {
      status: airOwnerIds.length === 0 ? "unavailable" : "review",
      ownerIds: airOwnerIds,
    },
    shield: {
      status: shieldOwnerIds.length === 0 ? "unavailable" : "review",
      ownerIds: shieldOwnerIds,
    },
  });
}

function terminalResultBetter(left, right) {
  if (!left || !right) throw new TypeError("Two completed terminal results are required");
  const leftOutcome = left.outcome === "victory" ? 1 : 0;
  const rightOutcome = right.outcome === "victory" ? 1 : 0;
  if (leftOutcome !== rightOutcome) return leftOutcome > rightOutcome;
  if (left.integrity !== right.integrity) return left.integrity > right.integrity;
  if (left.outcome === "defeat" && left.terminalWaveIndex !== right.terminalWaveIndex) {
    return left.terminalWaveIndex > right.terminalWaveIndex;
  }
  return left.score > right.score;
}

function logicalPlanningCommands(replay) {
  if (!replay || !Array.isArray(replay.inputs)) throw new TypeError("Replay inputs are required");
  let bucketOrdinal = -1;
  let priorTick = null;
  let withinBucketOrder = 0;
  return replay.inputs.map(function (command) {
    if (priorTick === null || command.tick !== priorTick) {
      bucketOrdinal += 1;
      withinBucketOrder = 0;
      priorTick = command.tick;
    }
    const payload = cloneCanonical(command);
    delete payload.tick;
    const normalized = {
      bucketOrdinal: bucketOrdinal,
      payload: payload,
      seq: command.seq,
      type: command.type,
      withinBucketOrder: withinBucketOrder,
    };
    withinBucketOrder += 1;
    return normalized;
  });
}

function commandPairDiffersOnlyByTwoBuildPads(leftReplay, rightReplay) {
  if (!leftReplay || !rightReplay) return false;
  const leftCommands = logicalPlanningCommands(leftReplay);
  const rightCommands = logicalPlanningCommands(rightReplay);
  if (leftCommands.length !== rightCommands.length) return false;
  function everyBucketStartsExactlyOnce(commands) {
    const counts = Object.create(null);
    commands.forEach(function (command) {
      if (!own(counts, command.bucketOrdinal)) counts[command.bucketOrdinal] = 0;
      if (command.type === "startWave") counts[command.bucketOrdinal] += 1;
    });
    return Object.keys(counts).every(function (bucket) { return counts[bucket] === 1; });
  }
  if (!everyBucketStartsExactlyOnce(leftCommands) || !everyBucketStartsExactlyOnce(rightCommands)) {
    return false;
  }
  let changedPads = 0;
  for (let index = 0; index < leftCommands.length; index += 1) {
    const left = cloneCanonical(leftCommands[index]);
    const right = cloneCanonical(rightCommands[index]);
    if (left.type !== right.type || left.seq !== right.seq ||
        left.bucketOrdinal !== right.bucketOrdinal ||
        left.withinBucketOrder !== right.withinBucketOrder) return false;
    if (left.type === "build" && right.type === "build" &&
        left.payload.padId !== right.payload.padId) changedPads += 1;
    if (left.type === "build") left.payload.padId = "pair-pad";
    if (right.type === "build") right.payload.padId = "pair-pad";
    if (canonicalEncode(left) !== canonicalEncode(right)) return false;
  }
  return changedPads === 2;
}

function materialMap(run) {
  const facts = materialUseFactsByDefense(run.result);
  const output = Object.create(null);
  Object.keys(facts).forEach(function (defenseId) {
    output[defenseId] = materiallyUsedDefense(facts[defenseId]);
  });
  return output;
}

function diversityGate(runs, missionId) {
  if (runs.length !== 2) return false;
  if (runs.some(function (run) {
    return run.scenario.header.missionId !== missionId ||
      run.scenario.header.difficultyId !== "strategos" || run.scenario.header.assist !== false ||
      run.result.outcome !== "victory" || run.result.integrity < 5;
  })) return false;
  const material = Object.assign(Object.create(null), materialMap(runs[0]), materialMap(runs[1]));
  return materiallyDifferentLoadouts(runs[0].scenario.header.loadoutIds,
    runs[1].scenario.header.loadoutIds, material);
}

function matchedPairGate(runs, requiredBp, weakness) {
  if (runs.length < 2) return false;
  const groups = Object.create(null);
  runs.forEach(function (run) {
    if (!run.scenario.pair) return;
    (groups[run.scenario.pair.id] || (groups[run.scenario.pair.id] = [])).push(run);
  });
  const pairIds = Object.keys(groups);
  if (pairIds.length === 0) return false;
  return pairIds.every(function (pairId) {
    const baseline = groups[pairId].filter(function (run) {
      return run.scenario.pair.role === "baseline";
    });
    const substitutes = groups[pairId].filter(function (run) {
      return run.scenario.pair.role === "substitute";
    });
    if (baseline.length !== 1 || substitutes.length === 0) return false;
    return substitutes.every(function (substitute) {
      const favored = weakness ? substitute : baseline[0];
      const opposed = weakness ? baseline[0] : substitute;
      return terminalResultBetter(favored.result, opposed.result) || ratioAtLeast(
        favored.result.combatValuePerAether, opposed.result.combatValuePerAether, requiredBp
      );
    });
  });
}

function noStrictDominanceGate(runs) {
  return ["chronos", "hoplite", "oracle", "sentinel", "siege"].every(function (defenseId) {
    const roleId = "defense-role-" + defenseId;
    const weaknessId = "defense-weakness-" + defenseId;
    const roleRuns = runs.filter(function (run) {
      return run.scenario.expectations.requiredGateIds.indexOf(roleId) !== -1;
    });
    const weaknessRuns = runs.filter(function (run) {
      return run.scenario.expectations.requiredGateIds.indexOf(weaknessId) !== -1;
    });
    return matchedPairGate(roleRuns, 10500, false) &&
      matchedPairGate(weaknessRuns, 11000, true);
  });
}

function rejectedBy(callback) {
  try {
    callback();
    return false;
  } catch (_error) {
    return true;
  }
}

function captureRejection(callback) {
  try {
    callback();
    return null;
  } catch (error) {
    return Object.freeze({
      message: error && error.message ? error.message : String(error),
      name: error && typeof error.name === "string" ? error.name : "Error",
    });
  }
}

function replayParityFacts(runtime, runs) {
  if (!runtime || !runtime.simulation || !runtime.simulation.AegisReplay ||
      typeof runtime.cloneInto !== "function" || !runtime.pair || !runtime.node ||
      !runtime.node.identities || !Array.isArray(runs) || runs.length === 0) return null;
  const verifiedScenarioIds = [];
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    const proof = run && run.machineProofs && run.machineProofs.replayParity;
    if (!run || !run.scenario || !run.replay || !run.result || !proof ||
        !isPlainRecord(proof)) return null;
    exactFields(proof, ["bundled", "identities", "node"], "Replay-parity machine proof");
    if (!isPlainRecord(proof.bundled) || !isPlainRecord(proof.identities) ||
        !isPlainRecord(proof.node)) return null;
    const executionFields = [
      "finalStateHash", "integrity", "outcome", "score", "tick", "verifiedCheckpointCount",
    ];
    exactFields(proof.bundled, executionFields, "Bundled replay-parity facts");
    exactFields(proof.node, executionFields, "Node replay-parity facts");
    exactFields(proof.identities, [
      "behaviorRegistryVersion", "eventSchemaVersion", "executionPath", "releaseAbiHash",
      "runtimeAbiDescriptorHash", "simulationArtifact", "simulationHash",
    ], "Node replay-parity identities");
    const bundled = proof.bundled;
    const node = proof.node;
    if (canonicalEncode(bundled) !== canonicalEncode(node) ||
        canonicalEncode(proof.identities) !== canonicalEncode(runtime.node.identities) ||
        bundled.verifiedCheckpointCount !== run.replay.checkpoints.length ||
        bundled.outcome !== run.replay.finalClaim.outcome ||
        bundled.score !== run.replay.finalClaim.score ||
        bundled.tick !== run.replay.finalClaim.durationTicks ||
        bundled.finalStateHash !== run.replay.finalClaim.finalStateHash ||
        bundled.outcome !== run.result.outcome || bundled.score !== run.result.score ||
        bundled.integrity !== run.result.integrity ||
        typeof bundled.finalStateHash !== "string" || !/^[0-9a-f]{64}$/.test(bundled.finalStateHash)) {
      return null;
    }
    verifiedScenarioIds.push(run.scenario.id);
  }
  return deepFreeze({
    bundledExecutionCount: verifiedScenarioIds.length,
    identities: cloneCanonical(runtime.node.identities),
    nodeExecutionCount: verifiedScenarioIds.length,
    scenarioCount: verifiedScenarioIds.length,
    verifiedScenarioIds: verifiedScenarioIds,
  });
}

function parserAndRuntimeLimitsFacts(runtime, runs) {
  if (!runtime || !runtime.simulation || !runtime.simulation.AegisReplay ||
      !runtime.simulation.AegisKernel || typeof runtime.cloneInto !== "function" ||
      !runtime.pair || !Array.isArray(runs) || runs.length === 0) return null;
  const replay = runtime.simulation.AegisReplay;
  const kernel = runtime.simulation.AegisKernel;
  const sample = runs.slice().sort(function (left, right) {
    return left.replay.finalClaim.durationTicks - right.replay.finalClaim.durationTicks;
  }).find(function (run) {
    return run && run.replay && Array.isArray(run.replay.inputs) &&
      run.replay.inputs.length > 0 && run.replay.finalClaim.durationTicks > 1;
  });
  if (!sample || !replay.DEFAULT_LIMITS ||
      kernel.MAX_ACTIVE_ENTITIES !== 4096 || kernel.MAX_TARGET_CANDIDATES !== 4096 ||
      kernel.MAX_SEMANTIC_EVENTS_PER_TICK !== 16384) return null;

  const canonical = replay.canonicalEnvelopeString(runtime.cloneInto(sample.replay));
  const canonicalBytesLength = Buffer.byteLength(canonical, "utf8");
  if (canonicalBytesLength <= 1) return null;
  const probes = [];
  function probe(id, callback, allowedNames) {
    const rejection = captureRejection(callback);
    if (!rejection || allowedNames.indexOf(rejection.name) === -1) return false;
    probes.push(Object.freeze({ id: id, rejectionType: rejection.name }));
    return true;
  }
  if (!probe("replay.max-utf8-bytes", function () {
    replay.parseReplayEnvelope(canonical, runtime.cloneInto({
      maxUtf8Bytes: canonicalBytesLength - 1,
    }));
  }, ["RangeError"]) || !probe("replay.frozen-limit-relaxation", function () {
    replay.createReplayLimits(runtime.cloneInto({
      maxTotalCommands: replay.DEFAULT_LIMITS.maxTotalCommands + 1,
    }));
  }, ["RangeError"])) return null;

  const oversized = cloneCanonical(sample.replay);
  oversized.inputs = Array.from({
    length: replay.DEFAULT_LIMITS.maxTotalCommands + 1,
  }, function (_unused, index) {
    return { tick: 0, seq: index, type: "startWave" };
  });
  if (!probe("replay.max-total-commands", function () {
    replay.normalizeReplayEnvelope(runtime.cloneInto(oversized));
  }, ["RangeError"])) return null;

  const headerFields = [
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode",
  ];
  const header = {};
  headerFields.forEach(function (field) { header[field] = cloneCanonical(sample.replay[field]); });
  const initial = kernel.createInitialState(runtime.binding, runtime.cloneInto(header));
  const initialHash = replay.finalStateHash(initial);
  const tooManyThisTick = Array.from({
    length: runtime.simulation.AegisCommands.DEFAULT_LIMITS.maxCommandsPerTick + 1,
  }, function (_unused, seq) {
    return { tick: 0, seq: seq, type: "startWave" };
  });
  if (!probe("kernel.max-commands-per-tick-atomic", function () {
    kernel.advanceTick(runtime.binding, initial, runtime.cloneInto(tooManyThisTick));
  }, ["RangeError"]) || replay.finalStateHash(initial) !== initialHash) return null;

  const oneTickRuntimeProbe = cloneCanonical(sample.replay);
  oneTickRuntimeProbe.inputs = [{ tick: 0, seq: 0, type: "startWave" }];
  oneTickRuntimeProbe.checkpoints = [];
  oneTickRuntimeProbe.finalClaim = {
    durationTicks: 1,
    finalStateHash: "0".repeat(64),
    laurels: 0,
    outcome: "defeat",
    score: 0,
  };
  if (!probe("runtime.terminal-duration-claim", function () {
    replay.createBoundSimulator(runtime.pair)
      .simulateReplay(runtime.cloneInto(oneTickRuntimeProbe));
  }, ["Error", "RangeError"])) return null;
  return deepFreeze({
    exercisedLimits: probes,
    kernelCeilingIdentities: {
      MAX_ACTIVE_ENTITIES: kernel.MAX_ACTIVE_ENTITIES,
      MAX_SEMANTIC_EVENTS_PER_TICK: kernel.MAX_SEMANTIC_EVENTS_PER_TICK,
      MAX_TARGET_CANDIDATES: kernel.MAX_TARGET_CANDIDATES,
    },
    probeCount: probes.length,
  });
}

function parserAndRuntimeLimitsGate(runtime, runs) {
  return parserAndRuntimeLimitsFacts(runtime, runs) !== null;
}

function malformedReplayFuzzCase(baseReplay, variant, salt) {
  const replay = cloneCanonical(baseReplay);
  switch (variant) {
    case 0: delete replay.finalClaim; break;
    case 1: replay["unexpected" + (salt % 7)] = salt; break;
    case 2: replay.formatVersion = 2; break;
    case 3: replay.rulesetHash = "sha256:" + (salt >>> 0).toString(16); break;
    case 4: replay.eventSchemaVersion += 1; break;
    case 5: replay.missionId = "M" + (salt % 10); break;
    case 6: replay.difficultyId = "impossible"; break;
    case 7: replay.assist = 0; break;
    case 8: replay.loadoutIds = []; break;
    case 9: replay.loadoutSlotCap = 0; break;
    case 10: replay.campaignModifierIds = ["UPPER" + (salt % 10)]; break;
    case 11: replay.inputs[0].type = "unknown"; break;
    case 12: replay.inputs[0].seq = 1; break;
    case 13: replay.finalClaim.finalStateHash = "bad"; break;
    case 14: replay.inputs[0].tick = replay.finalClaim.durationTicks; break;
    case 15:
      return Object.freeze({ mode: "json", payload: "{\"seed\":" + salt });
    default: throw new RangeError("Malformed replay fuzz variant is out of range");
  }
  return Object.freeze({ mode: "object", payload: replay });
}

function malformedCommandFuzzCase(variant, salt, commandLimits) {
  switch (variant) {
    case 0: return [null];
    case 1: return [{}];
    case 2: return [{ tick: 0, seq: 1, type: "startWave" }];
    case 3: return [{ tick: 0, seq: 0, type: "unknown" }];
    case 4: return [{ tick: 0, seq: 0, type: "startWave", extra: salt }];
    case 5: return [{ tick: -1, seq: 0, type: "startWave" }];
    case 6: return [{ tick: 0, seq: 0, type: "build", padId: "P01", defenseId: "sentinel" }];
    case 7: return [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "SENTINEL" }];
    case 8: return [{ tick: 0, seq: 0, type: "upgrade", towerId: 0 }];
    case 9: return [{ tick: 0, seq: 0, type: "sell", towerId: 0 }];
    case 10: return [{ tick: 0, seq: 0, type: "setTargetPolicy", towerId: 1, policy: "LAST" }];
    case 11: return [
      { tick: 1, seq: 0, type: "startWave" },
      { tick: 0, seq: 0, type: "startWave" },
    ];
    case 12: return [
      { tick: 0, seq: 0, type: "startWave" },
      { tick: 0, seq: 0, type: "startWave" },
    ];
    case 13: return [{ tick: commandLimits.maxTick + 1, seq: 0, type: "startWave" }];
    case 14:
      return Array.from({ length: commandLimits.maxCommandsPerTick + 1 }, function (_unused, seq) {
        return { tick: 0, seq: seq, type: "startWave" };
      });
    case 15: return { invalid: "command-sequence", salt: salt };
    default: throw new RangeError("Malformed command fuzz variant is out of range");
  }
}

function malformedInputFuzzFacts(runtime, runs) {
  if (!runtime || !runtime.simulation || !runtime.simulation.AegisReplay ||
      !runtime.simulation.AegisKernel || !runtime.simulation.AegisMovement ||
      !runtime.simulation.AegisCommands || typeof runtime.cloneInto !== "function" ||
      !Array.isArray(runs) || runs.length === 0) return null;
  const sample = runs.find(function (run) {
    return run && run.replay && Array.isArray(run.replay.inputs) && run.replay.inputs.length > 0;
  });
  if (!sample) return null;
  const replay = runtime.simulation.AegisReplay;
  const kernel = runtime.simulation.AegisKernel;
  const movement = runtime.simulation.AegisMovement;
  const commandLimits = runtime.simulation.AegisCommands.DEFAULT_LIMITS;
  const header = {};
  [
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode",
  ].forEach(function (field) { header[field] = cloneCanonical(sample.replay[field]); });
  const initial = kernel.createInitialState(runtime.binding, runtime.cloneInto(header));
  const initialStateHash = replay.finalStateHash(initial);
  const corpus = [];
  const rejectionTypes = Object.create(null);
  let parserRejectionCount = 0;
  let commandRejectionCount = 0;
  function recordRejection(kind, seed, iteration, salt, input, callback, allowedNames) {
    const rejection = captureRejection(callback);
    if (!rejection || allowedNames.indexOf(rejection.name) === -1 ||
        replay.finalStateHash(initial) !== initialStateHash) return false;
    rejectionTypes[rejection.name] = (rejectionTypes[rejection.name] || 0) + 1;
    corpus.push({
      input: cloneCanonical(input), iteration: iteration, kind: kind,
      rejectionType: rejection.name, salt: salt, seed: seed,
    });
    return true;
  }
  for (let seedIndex = 0; seedIndex < MALFORMED_FUZZ_SEEDS.length; seedIndex += 1) {
    const seed = MALFORMED_FUZZ_SEEDS[seedIndex];
    let stream = movement.createNamedRngStream(seed, "balance.malformed-input-fuzz-v1");
    for (let iteration = 0; iteration < MALFORMED_FUZZ_ITERATIONS_PER_SEED; iteration += 1) {
      const next = movement.stepNamedRngStream(stream);
      stream = next.state;
      const salt = next.uint32;
      const replayCase = malformedReplayFuzzCase(sample.replay, iteration, salt);
      if (!recordRejection("replay", seed, iteration, salt, replayCase, function () {
        if (replayCase.mode === "json") replay.parseReplayEnvelope(replayCase.payload);
        else replay.normalizeReplayEnvelope(runtime.cloneInto(replayCase.payload));
      }, ["RangeError", "SyntaxError", "TypeError"])) return null;
      parserRejectionCount += 1;

      const commandCase = malformedCommandFuzzCase(iteration, salt, commandLimits);
      if (!recordRejection("command", seed, iteration, salt, commandCase, function () {
        kernel.advanceTick(runtime.binding, initial, runtime.cloneInto(commandCase));
      }, ["RangeError", "TypeError"])) return null;
      commandRejectionCount += 1;
    }
  }
  if (replay.finalStateHash(initial) !== initialStateHash) return null;
  const corpusBytes = Buffer.from(canonicalEncode(corpus), "utf8");
  return deepFreeze({
    commandRejectionCount: commandRejectionCount,
    corpusHash: sha256Reference(corpusBytes),
    corpusVersion: "malformed-input-fuzz-v1",
    initialStateHash: initialStateHash,
    iterationCount: corpus.length,
    iterationsPerSeedPerDomain: MALFORMED_FUZZ_ITERATIONS_PER_SEED,
    parserRejectionCount: parserRejectionCount,
    rejectionTypes: rejectionTypes,
    seedList: MALFORMED_FUZZ_SEEDS.slice(),
  });
}

function evaluateMachineGates(runtime, runs) {
  const parity = replayParityFacts(runtime, runs);
  const fuzz = malformedInputFuzzFacts(runtime, runs);
  const limits = parserAndRuntimeLimitsFacts(runtime, runs);
  return deepFreeze({
    evidence: {
      malformedInputFuzz: fuzz,
      parserAndRuntimeLimits: limits,
      replayParity: parity,
    },
    "fuzz-soak": fuzz !== null && fuzz.iterationCount ===
      MALFORMED_FUZZ_SEEDS.length * MALFORMED_FUZZ_ITERATIONS_PER_SEED * 2,
    "parser-and-runtime-limits": limits !== null,
    "replay-parity": parity !== null && parity.scenarioCount === runs.length,
  });
}

function evaluateGate(gateId, runs, machineGates) {
  const selected = runs.filter(function (run) {
    return run.scenario.expectations.requiredGateIds.indexOf(gateId) !== -1;
  });
  if (MACHINE_GATE_IDS.indexOf(gateId) !== -1) {
    return !!machineGates && machineGates[gateId] === true;
  }
  if (gateId.startsWith("starter-trio-wins-")) {
    const missionId = gateId.slice("starter-trio-wins-".length);
    return selected.length > 0 && selected.every(function (run) {
      return run.scenario.header.missionId === missionId &&
        canonicalEncode(run.scenario.header.loadoutIds) === canonicalEncode(["sentinel", "chronos", "siege"]) &&
        run.scenario.header.difficultyId === "strategos" && run.scenario.header.assist === false &&
        run.result.outcome === "victory";
    });
  }
  const emphasis = /^m01-(sentinel|chronos|siege)-emphasis$/.exec(gateId);
  if (emphasis) return selected.length === 1 && emphasisGate(emphasis[1], emphasisRows(selected[0].result));
  if (gateId === "m01-representative-economy") {
    if (selected.length !== 3 || !m01RepresentativeSetGate(selected.map(function (run) {
      return {
        finalBankAether: run.result.economy.finalBankAether,
        finalTowerCount: run.result.finalTowerCount,
        netConsumedAether: run.result.economy.netConsumedAether,
        occupiedPadCount: run.result.occupiedPadCount,
        upgradeUnits: run.result.upgradeUnits,
      };
    }))) return false;
    const buildPads = new Set(selected.map(function (run) { return run.result.firstAcceptedBuildPadId; }));
    const upgradeMoments = new Set(selected.map(function (run) {
      return run.result.firstPaidUpgrade ?
        run.result.firstPaidUpgrade.waveIndex + ":" + run.result.firstPaidUpgrade.tick : "none";
    }));
    return buildPads.size === 3 && upgradeMoments.size === 3;
  }
  if (gateId === "m01-one-tower-control") return selected.length > 0 && selected.every(function (run) {
    return run.result.outcome === "defeat" && [5, 6].indexOf(run.result.terminalWaveIndex) !== -1 &&
      run.result.finalTowerCount === 1 && run.result.upgradeUnits === 0;
  });
  if (gateId === "m01-legal-random-control") {
    const seeds = selected.map(function (run) { return run.scenario.header.seed; }).sort(function (a, b) {
      return a - b;
    });
    if (selected.length !== RANDOM_CONTROL_SEEDS.length || canonicalEncode(seeds) !==
        canonicalEncode(RANDOM_CONTROL_SEEDS.slice().sort(function (a, b) { return a - b; })) ||
        selected.some(function (run) {
          return run.scenario.strategyVersion !== "legal-random-placement-spend-v1";
        })) return false;
    const defeats = selected.filter(function (run) { return run.result.outcome === "defeat"; });
    return defeats.length >= 8 && selected.length - defeats.length <= 4 &&
      defeats.some(function (run) { return [5, 6].indexOf(run.result.terminalWaveIndex) !== -1; });
  }
  if (gateId === "m01-placement-pair") {
    const aware = selected.filter(function (run) { return run.scenario.pair && run.scenario.pair.role === "aware"; });
    const imperfect = selected.filter(function (run) {
      return run.scenario.pair && run.scenario.pair.role === "imperfect";
    });
    if (aware.length !== 1 || imperfect.length !== 1 || aware[0].scenario.pair.id !== imperfect[0].scenario.pair.id ||
        canonicalEncode(aware[0].scenario.header) !== canonicalEncode(imperfect[0].scenario.header) ||
        !commandPairDiffersOnlyByTwoBuildPads(aware[0].replay, imperfect[0].replay) ||
        imperfect[0].result.outcome !== "victory" || imperfect[0].result.integrity < 12 ||
        imperfect[0].result.integrity > 17) return false;
    return representativeM01({
      finalTowerCount: aware[0].result.finalTowerCount,
      netConsumedAether: aware[0].result.economy.netConsumedAether,
      occupiedPadCount: aware[0].result.occupiedPadCount,
      upgradeUnits: aware[0].result.upgradeUnits,
    }) && representativeM01({
      finalTowerCount: imperfect[0].result.finalTowerCount,
      netConsumedAether: imperfect[0].result.economy.netConsumedAether,
      occupiedPadCount: imperfect[0].result.occupiedPadCount,
      upgradeUnits: imperfect[0].result.upgradeUnits,
    }) && placementGate(aware[0].result.combatValuePerAether,
      imperfect[0].result.combatValuePerAether);
  }
  if (gateId === "m04-witness-diversity") return diversityGate(selected, "m04");
  if (gateId === "m05-witness-diversity") return diversityGate(selected, "m05");
  if (gateId === "m04-route-exercise") return selected.length > 0 &&
    selected.every(function (run) { return m04ExerciseGate(run.result.m04Facts); });
  if (gateId === "m05-boss-exercise") return selected.length > 0 &&
    selected.every(function (run) { return m05ExerciseGate(run.result.m05Facts); });
  if (gateId.startsWith("defense-role-")) return matchedPairGate(selected, 10500, false);
  if (gateId.startsWith("defense-weakness-")) return matchedPairGate(selected, 11000, true);
  if (gateId === "no-strict-dominance") return noStrictDominanceGate(runs);
  return false;
}

function evaluateRequiredGates(runs, machineGates) {
  const statuses = Object.create(null);
  const results = REQUIRED_GATE_IDS.map(function (gateId) {
    const pass = evaluateGate(gateId, runs, machineGates);
    statuses[gateId] = pass ? "pass" : "fail";
    return { id: gateId, required: true, status: statuses[gateId] };
  });
  return deepFreeze(results);
}

function percentileNearestRank(values, percentileBp) {
  if (!Array.isArray(values) || values.length === 0) return null;
  safeInteger(percentileBp, "Percentile basis points", 1);
  const sorted = values.slice().sort(function (left, right) { return left - right; });
  const rank = Math.max(1, Math.ceil(sorted.length * percentileBp / 10000));
  return sorted[rank - 1];
}

function scenarioReportRecord(run, replayPath, replayHash) {
  return deepFreeze({
    header: cloneCanonical(run.scenario.header),
    id: run.scenario.id,
    kind: run.scenario.kind,
    pair: cloneCanonical(run.scenario.pair),
    replayPath: replayPath,
    replaySha256: replayHash,
    requiredGateIds: run.scenario.expectations.requiredGateIds.slice(),
    result: cloneCanonical(run.result),
    sourceSha256: run.sourceHash,
    strategyVersion: run.scenario.strategyVersion,
  });
}

function scenarioExecutionCacheKey(scenario) {
  return canonicalEncode({
    commands: scenario.commands,
    header: scenario.header,
    strategyVersion: scenario.strategyVersion,
    terminalExpectation: {
      defeatWaveIndexes: scenario.expectations.defeatWaveIndexes,
      integrityMax: scenario.expectations.integrityMax,
      integrityMin: scenario.expectations.integrityMin,
      outcome: scenario.expectations.outcome,
    },
  });
}

function generateEvidence(authenticatedSelection, options, dependencies) {
  const deps = dependencies || {};
  const runtime = (deps.createBoundRuntime || createBoundRuntime)(authenticatedSelection);
  const scenarios = (deps.loadScenarioCatalog || loadScenarioCatalog)(deps.context);
  const executionCache = new Map();
  const runs = scenarios.map(function (scenario) {
    const runner = scenario.strategyVersion === "legal-random-placement-spend-v1" ?
      (deps.runLegalRandomScenario || runLegalRandomScenario) :
      (deps.runAuthoredScenario || runAuthoredScenario);
    const cacheKey = scenarioExecutionCacheKey(scenario);
    let run = executionCache.get(cacheKey);
    if (!run) {
      run = runner(runtime, scenario);
      executionCache.set(cacheKey, Object.freeze({
        machineProofs: run.machineProofs || null,
        replay: run.replay,
        result: run.result,
      }));
    }
    return Object.freeze({
      machineProofs: run.machineProofs || null,
      replay: run.replay,
      result: run.result,
      scenario: scenario,
      sourceHash: scenario.sourceHash,
    });
  });
  const artifacts = new Map();
  const records = runs.map(function (run) {
    const replayPath = "witnesses/" + run.scenario.id + ".replay.json";
    const bytes = canonicalArtifact(run.replay);
    artifacts.set(replayPath, bytes);
    return scenarioReportRecord(run, replayPath, sha256Reference(bytes));
  });
  const matrixResults = records.filter(function (record) {
    return record.kind === "role-matrix" || record.kind === "weakness-matrix";
  });
  const scenarioResults = records.filter(function (record) {
    return record.kind !== "role-matrix" && record.kind !== "weakness-matrix";
  });
  const axes = compiledAxisAvailability(runtime.content);
  const machineGates = (deps.evaluateMachineGates || evaluateMachineGates)(runtime, runs);
  const gateResults = evaluateRequiredGates(runs, machineGates).concat([
    { id: "full-campaign-air-axis", required: false, status: axes.air.status },
    { id: "full-campaign-shield-axis", required: false, status: axes.shield.status },
  ]);
  const binding = {
    abiHash: authenticatedSelection.release.abiHash,
    annexHash: authenticatedSelection.release.annexHash,
    contentHash: authenticatedSelection.release.contentHash,
    contentVersion: authenticatedSelection.release.contentVersion,
    eventSchemaVersion: authenticatedSelection.release.eventSchemaVersion,
    rulesetHash: authenticatedSelection.release.rulesetHash,
    simulationHash: authenticatedSelection.release.simulationHash,
    sourceManifestHash: authenticatedSelection.release.sourceManifestHash,
  };
  const report = createBalanceReport({
    aggregates: {
      axisAvailability: axes,
      bankAetherP90: percentileNearestRank(runs.map(function (run) {
        return run.result.economy.finalBankAether;
      }), 9000),
      machineEvidence: cloneCanonical(machineGates.evidence || {
        malformedInputFuzz: null, parserAndRuntimeLimits: null, replayParity: null,
      }),
      scenarioCount: runs.length,
    },
    binding: binding,
    gateResults: gateResults,
    manualTargets: [
      { id: "human-board-clarity", status: "manual" },
      { id: "human-cohort-success", status: "manual" },
      { id: "human-upgrade-timing", status: "manual" },
    ],
    matrixResults: matrixResults,
    scenarioResults: scenarioResults,
  });
  artifacts.set("balance-report.json", canonicalArtifact(report));
  return deepFreeze({ artifacts: artifacts, report: report });
}

function evidenceDirectory(binding, context) {
  if (!binding || !binding.release) throw new TypeError("Authenticated release binding is required");
  const hash = binding.release.rulesetHash;
  if (typeof hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
    throw new TypeError("Release rulesetHash must be a lowercase SHA-256 reference");
  }
  if (typeof binding.release.contentVersion !== "string" ||
      !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(binding.release.contentVersion)) {
    throw new TypeError("Release contentVersion is invalid");
  }
  return path.join(balanceContext(context).balanceRoot,
    binding.release.contentVersion + "." + hash.slice("sha256:".length));
}

function canonicalArtifact(value) {
  return Buffer.concat([canonicalBytes(value), Buffer.from("\n", "utf8")]);
}

function validateGateResults(gateResults) {
  if (!Array.isArray(gateResults)) throw new TypeError("gateResults must be an array");
  gateResults.forEach(function (gate, index) {
    exactFields(gate, ["id", "required", "status"], "Gate result " + index);
    stableId(gate.id, "Gate id");
    if (typeof gate.required !== "boolean" || GATE_STATUSES.indexOf(gate.status) === -1) {
      throw new TypeError("Gate results require a boolean required flag and closed status");
    }
    if (gate.status === "manual" || gate.status === "unavailable") {
      if (!gate.required) return;
      throw new RangeError("Manual and unavailable gates cannot be marked as machine-required passes");
    }
  });
}

function createBalanceReport(input) {
  exactFields(input, [
    "aggregates", "binding", "gateResults", "manualTargets", "matrixResults", "scenarioResults",
  ], "Balance report input");
  validateGateResults(input.gateResults);
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    formulaVersion: FORMULA_VERSION,
    binding: cloneCanonical(input.binding),
    scenarioResults: cloneCanonical(input.scenarioResults),
    matrixResults: cloneCanonical(input.matrixResults),
    aggregates: cloneCanonical(input.aggregates),
    gateResults: cloneCanonical(input.gateResults),
    manualTargets: cloneCanonical(input.manualTargets),
  };
  return deepFreeze(report);
}

function ensureTruthfulWrite(report) {
  report.gateResults.forEach(function (gate) {
    if (gate.required && gate.status !== "pass") {
      throw new Error("Refusing evidence write while required gate " + gate.id + " is " + gate.status);
    }
  });
  report.manualTargets.forEach(function (target) {
    if (target.status !== "manual") throw new Error("Human targets must remain manual in headless evidence");
  });
}

function compareEvidence(directory, artifacts) {
  for (const entry of artifacts) {
    const target = path.join(directory, ...entry[0].split("/"));
    let bytes;
    try { bytes = fs.readFileSync(target); }
    catch (error) { throw new Error("Balance evidence is missing: " + entry[0]); }
    if (!bytes.equals(entry[1])) throw new Error("Balance evidence is stale: " + entry[0]);
  }
}

function writeEvidence(directory, artifacts) {
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of artifacts) {
    const target = path.join(directory, ...entry[0].split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry[1]);
  }
}

function execute(options, io, dependencies) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  const deps = dependencies || {};
  const context = balanceContext(deps.context);
  const binding = (deps.compileAuthenticatedSelection || compileAuthenticatedSelection)(options.manifest, context);
  const generated = (deps.generateEvidence || generateEvidence)(binding, options, deps);
  if (!generated || !generated.report || !(generated.artifacts instanceof Map)) {
    throw new TypeError("Balance evidence generator must return a report and artifact Map");
  }
  if (options.mode === "write") ensureTruthfulWrite(generated.report);
  const directory = evidenceDirectory(binding, context);
  const entries = Array.from(generated.artifacts.entries()).sort(function (left, right) {
    return left[0] < right[0] ? -1 : (left[0] > right[0] ? 1 : 0);
  });
  entries.forEach(function (entry) {
    validatePortableRepositoryFile(entry[0], "Evidence artifact");
    entry[1] = Buffer.from(entry[1]);
  });
  if (options.mode === "check") (deps.compareEvidence || compareEvidence)(directory, entries);
  else (deps.writeEvidence || writeEvidence)(directory, entries);
  output.stdout.write("Aegis balance " + options.mode + " passed: " + binding.release.rulesetHash + "\n");
  return 0;
}

function main(argv, io, dependencies) {
  const output = io || { stdout: process.stdout, stderr: process.stderr };
  let options;
  try { options = parseArgs(argv); }
  catch (error) {
    output.stderr.write(error.message + "\n" + USAGE + "\n");
    return 2;
  }
  if (options.help) {
    output.stdout.write(USAGE + "\n");
    return 0;
  }
  try { return execute(options, output, dependencies); }
  catch (error) {
    if (error instanceof AegisContentError) {
      error.diagnostics.forEach(function (item) {
        output.stderr.write(item.code + " " + item.path + ": " + item.message + "\n");
      });
    } else {
      output.stderr.write((error && error.stack) ? error.stack + "\n" : String(error) + "\n");
    }
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = Object.freeze({
  REPO_ROOT: REPO_ROOT,
  CONTENT_ROOT: CONTENT_ROOT,
  SIMULATION_ROOT: SIMULATION_ROOT,
  BALANCE_ROOT: BALANCE_ROOT,
  SCENARIO_ROOT: SCENARIO_ROOT,
  SCENARIO_CATALOG: SCENARIO_CATALOG,
  FORMULA_VERSION: FORMULA_VERSION,
  RANDOM_CONTROL_SEEDS: RANDOM_CONTROL_SEEDS,
  MALFORMED_FUZZ_SEEDS: MALFORMED_FUZZ_SEEDS,
  MALFORMED_FUZZ_ITERATIONS_PER_SEED: MALFORMED_FUZZ_ITERATIONS_PER_SEED,
  REQUIRED_GATE_IDS: REQUIRED_GATE_IDS,
  MACHINE_GATE_IDS: MACHINE_GATE_IDS,
  USAGE: USAGE,
  validateManifestReference: validateManifestReference,
  parseArgs: parseArgs,
  balanceContext: balanceContext,
  resolveContainedManifest: resolveContainedManifest,
  executeSimulationBundle: executeSimulationBundle,
  createLockedSimulationRuntime: createLockedSimulationRuntime,
  compileAuthenticatedSelection: compileAuthenticatedSelection,
  createBoundRuntime: createBoundRuntime,
  runAuthoredScenario: runAuthoredScenario,
  prepareScenarioInput: prepareScenarioInput,
  legalRandomIndex: legalRandomIndex,
  legalRandomPlanningBucket: legalRandomPlanningBucket,
  runLegalRandomScenario: runLegalRandomScenario,
  validateScenario: validateScenario,
  parseScenarioBytes: parseScenarioBytes,
  parseScenarioCatalogBytes: parseScenarioCatalogBytes,
  loadScenarioCatalog: loadScenarioCatalog,
  allocateLargestRemainder: allocateLargestRemainder,
  createBalanceAccumulator: createBalanceAccumulator,
  createConservedAuthorities: createConservedAuthorities,
  foldTelemetryTick: foldTelemetryTick,
  finalizeAccumulator: finalizeAccumulator,
  placementGate: placementGate,
  ratioAtLeast: ratioAtLeast,
  materiallyUsedDefense: materiallyUsedDefense,
  materialUseFactsByDefense: materialUseFactsByDefense,
  emphasisRows: emphasisRows,
  representativeM01: representativeM01,
  medianInteger: medianInteger,
  m01RepresentativeSetGate: m01RepresentativeSetGate,
  emphasisGate: emphasisGate,
  synergyStatus: synergyStatus,
  materiallyDifferentLoadouts: materiallyDifferentLoadouts,
  m04ExerciseGate: m04ExerciseGate,
  m05ExerciseGate: m05ExerciseGate,
  pairAtSharedCheckpoint: pairAtSharedCheckpoint,
  compiledAxisAvailability: compiledAxisAvailability,
  terminalResultBetter: terminalResultBetter,
  commandPairDiffersOnlyByTwoBuildPads: commandPairDiffersOnlyByTwoBuildPads,
  logicalPlanningCommands: logicalPlanningCommands,
  diversityGate: diversityGate,
  matchedPairGate: matchedPairGate,
  noStrictDominanceGate: noStrictDominanceGate,
  replayParityFacts: replayParityFacts,
  parserAndRuntimeLimitsFacts: parserAndRuntimeLimitsFacts,
  parserAndRuntimeLimitsGate: parserAndRuntimeLimitsGate,
  malformedReplayFuzzCase: malformedReplayFuzzCase,
  malformedCommandFuzzCase: malformedCommandFuzzCase,
  malformedInputFuzzFacts: malformedInputFuzzFacts,
  evaluateMachineGates: evaluateMachineGates,
  evaluateRequiredGates: evaluateRequiredGates,
  percentileNearestRank: percentileNearestRank,
  scenarioExecutionCacheKey: scenarioExecutionCacheKey,
  generateEvidence: generateEvidence,
  evidenceDirectory: evidenceDirectory,
  canonicalArtifact: canonicalArtifact,
  createBalanceReport: createBalanceReport,
  ensureTruthfulWrite: ensureTruthfulWrite,
  compareEvidence: compareEvidence,
  writeEvidence: writeEvidence,
  execute: execute,
  main: main,
});
