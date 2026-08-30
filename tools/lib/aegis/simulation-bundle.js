"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");
const { fail } = require("./diagnostics.js");


function moduleSpec(id, relativePath, globalName, dependencies) {
  return Object.freeze({
    id: id,
    relativePath: relativePath,
    globalName: globalName,
    dependencies: dependencies === null ? null : Object.freeze(dependencies.map(function (dependency) {
      return Object.freeze({
        id: dependency[0],
        parameterName: dependency[1],
        requirePath: "./" + dependency[2],
      });
    })),
  });
}

/* The declared deterministic simulation module set (ruling R16). The order is the CommonJS
   require order: every dependency precedes its dependents, so `abi-v2`, `commands-v2`,
   `protocols`, and `relics` are installed before `management` and `kernel` consume them.
   Parameter names are the exact factory parameter identifiers written in each module file.

   One list serves every content schema. `management.js` and `kernel.js` are single files whose
   static dependencies must all be installed, so a schema-3 bundle that omitted the four ABI-v2
   modules would emit a management seam referencing globals that were never installed. Changing
   any bundled source changes the ruleset hash by design (ADR-003); the committed immutable
   artifacts on disk are never rewritten. */
const MODULE_SPECS = Object.freeze([
  moduleSpec("abi", "abi.js", "AegisSim", null),
  moduleSpec("geometry", "geometry.js", "AegisGeometry", [["abi", "ABI", "abi.js"]]),
  moduleSpec("timers", "timers.js", "AegisTimers", [["abi", "ABI", "abi.js"]]),
  moduleSpec("economy", "economy.js", "AegisEconomy", [["abi", "ABI", "abi.js"]]),
  moduleSpec("movement", "movement.js", "AegisMovement", [["abi", "ABI", "abi.js"]]),
  moduleSpec("effects", "effects.js", "AegisEffects", [["abi", "ABI", "abi.js"]]),
  moduleSpec("targeting", "targeting.js", "AegisTargeting", [
    ["abi", "ABI", "abi.js"],
    ["geometry", "Geometry", "geometry.js"],
  ]),
  moduleSpec("behaviors", "behaviors.js", "AegisBehaviors", [
    ["abi", "ABI", "abi.js"],
    ["geometry", "Geometry", "geometry.js"],
    ["timers", "Timers", "timers.js"],
    ["movement", "Movement", "movement.js"],
    ["effects", "Effects", "effects.js"],
    ["targeting", "Targeting", "targeting.js"],
  ]),
  moduleSpec("commands", "commands.js", "AegisCommands", [["abi", "ABI", "abi.js"]]),
  moduleSpec("abi-v2", "abi-v2.js", "AegisSimV2", [["abi", "ABI_V1", "abi.js"]]),
  moduleSpec("commands-v2", "commands-v2.js", "AegisCommandsV2", [
    ["abi-v2", "ABI", "abi-v2.js"],
    ["commands", "CommandsV1", "commands.js"],
  ]),
  moduleSpec("protocols", "protocols.js", "AegisProtocols", [
    ["abi-v2", "ABI", "abi-v2.js"],
    ["commands-v2", "CommandsV2", "commands-v2.js"],
  ]),
  moduleSpec("relics", "relics.js", "AegisRelics", [["abi-v2", "ABI", "abi-v2.js"]]),
  moduleSpec("management", "management.js", "AegisManagement", [
    ["abi", "ABI", "abi.js"],
    ["economy", "Economy", "economy.js"],
    ["movement", "Movement", "movement.js"],
    ["commands", "Commands", "commands.js"],
    ["commands-v2", "CommandsV2", "commands-v2.js"],
    ["protocols", "Protocols", "protocols.js"],
    ["relics", "Relics", "relics.js"],
  ]),
  moduleSpec("objectives", "objectives.js", "AegisObjectives", [["abi", "ABI", "abi.js"]]),
  moduleSpec("kernel", "kernel.js", "AegisKernel", [
    ["abi", "ABI", "abi.js"],
    ["geometry", "Geometry", "geometry.js"],
    ["timers", "Timers", "timers.js"],
    ["economy", "Economy", "economy.js"],
    ["movement", "Movement", "movement.js"],
    ["effects", "Effects", "effects.js"],
    ["targeting", "Targeting", "targeting.js"],
    ["behaviors", "Behaviors", "behaviors.js"],
    ["commands", "Commands", "commands.js"],
    ["management", "Management", "management.js"],
    ["objectives", "Objectives", "objectives.js"],
    ["abi-v2", "ABIV2", "abi-v2.js"],
    ["commands-v2", "CommandsV2", "commands-v2.js"],
    ["protocols", "Protocols", "protocols.js"],
    ["relics", "Relics", "relics.js"],
  ]),
  moduleSpec("replay-runner", "replay-runner.js", "AegisReplayRunner", [
    ["abi", "ABI", "abi.js"],
    ["commands", "Commands", "commands.js"],
    ["kernel", "Kernel", "kernel.js"],
  ]),
  moduleSpec("replay", "replay.js", "AegisReplay", [
    ["abi", "ABI", "abi.js"],
    ["commands", "Commands", "commands.js"],
    ["replay-runner", "ReplayRunner", "replay-runner.js"],
  ]),
  moduleSpec("replay-v2", "replay-v2.js", "AegisReplayV2", [
    ["abi-v2", "ABI", "abi-v2.js"],
    ["commands-v2", "CommandsV2", "commands-v2.js"],
    ["replay", "ReplayV1", "replay.js"],
  ]),
  moduleSpec("replay-formats", "replay-formats.js", "AegisReplayFormats", [
    ["replay", "ReplayV1", "replay.js"],
    ["replay-v2", "ReplayV2", "replay-v2.js"],
  ]),
]);

const SPEC_SETS = Object.freeze({ v1: MODULE_SPECS, v4: MODULE_SPECS });

function resolveSpecs(input) {
  if (input === undefined || input === null) return MODULE_SPECS;
  if (typeof input === "string") {
    if (!Object.prototype.hasOwnProperty.call(SPEC_SETS, input)) {
      fail("SIMULATION_BUNDLE_SPEC_SET", "/simulationBundle", "Unknown declared simulation module set " + input);
    }
    return SPEC_SETS[input];
  }
  if (input === MODULE_SPECS) return input;
  fail("SIMULATION_BUNDLE_SPEC_SET", "/simulationBundle", "Simulation module sets are declared, never caller supplied");
  return MODULE_SPECS;
}

const ABI_COMMON_JS_SEAM = [
  "  if (typeof module !== \"undefined\" && module.exports) {",
  "    module.exports = api;",
  "    return;",
  "  }",
  "",
].join("\n");

const ROOT_SEAM = '})(typeof globalThis !== "undefined" ? globalThis : this, function ';

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function replaceExactly(source, needle, replacement, code, diagnosticPath, message) {
  const first = source.indexOf(needle);
  if (first === -1 || source.indexOf(needle, first + needle.length) !== -1) {
    fail(code, diagnosticPath, message);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function declaredDependencies(spec, specs) {
  specs = specs || MODULE_SPECS;
  if (spec.dependencies === null) return [];
  if (!Array.isArray(spec.dependencies) || spec.dependencies.length === 0) {
    fail("SIMULATION_BUNDLE_DEPENDENCY", "/simulationBundle/" + spec.id, spec.relativePath + " must declare its CommonJS dependencies");
  }
  const specIndex = specs.indexOf(spec);
  const ids = new Set();
  return spec.dependencies.map(function (dependency) {
    if (!dependency || typeof dependency !== "object" || Array.isArray(dependency) || ids.has(dependency.id)) {
      fail("SIMULATION_BUNDLE_DEPENDENCY", "/simulationBundle/" + spec.id, spec.relativePath + " has an invalid CommonJS dependency");
    }
    const dependencyIndex = specs.findIndex(function (candidate) { return candidate.id === dependency.id; });
    const dependencySpec = specs[dependencyIndex];
    if (
      dependencyIndex < 0 ||
      dependencyIndex >= specIndex ||
      dependency.requirePath !== "./" + dependencySpec.relativePath ||
      typeof dependency.parameterName !== "string" ||
      !/^[A-Z][A-Za-z0-9_]*$/.test(dependency.parameterName)
    ) {
      fail("SIMULATION_BUNDLE_DEPENDENCY", "/simulationBundle/" + spec.id, spec.relativePath + " has an invalid or forward CommonJS dependency");
    }
    ids.add(dependency.id);
    return { declaration: dependency, module: dependencySpec };
  });
}

function commonJsSeam(spec, dependencies) {
  if (spec.dependencies === null) return ABI_COMMON_JS_SEAM;
  const requireExpressions = dependencies.map(function (dependency) {
    return 'require("' + dependency.declaration.requirePath + '")';
  });
  let factoryCall;
  if (requireExpressions.length <= 2) {
    factoryCall = ["    module.exports = factory(" + requireExpressions.join(", ") + ");"];
  } else {
    factoryCall = ["    module.exports = factory("];
    requireExpressions.forEach(function (expression, index) {
      factoryCall.push("      " + expression + (index + 1 === requireExpressions.length ? "" : ","));
    });
    factoryCall.push("    );");
  }
  return [
    "  if (typeof module !== \"undefined\" && module.exports) {",
    ...factoryCall,
    "    return;",
    "  }",
    "",
  ].join("\n");
}

function classicDependencySeam(spec, dependencies) {
  if (dependencies.length === 0) return null;
  const lines = ["  const game = root.Game;"];
  dependencies.forEach(function (dependency, index) {
    const prefix = index === 0 ? "!game || !game." : "!game.";
    lines.push(
      "  if (" + prefix + dependency.module.globalName + ") throw new Error(\"Game." +
        dependency.module.globalName + " must be installed before " + spec.relativePath + "\");"
    );
  });
  const classicArguments = dependencies.map(function (dependency) {
    return "game." + dependency.module.globalName;
  });
  if (classicArguments.length <= 2) {
    lines.push("  const api = factory(" + classicArguments.join(", ") + ");");
  } else {
    lines.push("  const api = factory(");
    classicArguments.forEach(function (argument, index) {
      lines.push("    " + argument + (index + 1 === classicArguments.length ? "" : ","));
    });
    lines.push("  );");
  }
  return lines.join("\n");
}

function portableRelativePath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    path.isAbsolute(value) ||
    value.indexOf("\\") !== -1
  ) {
    fail("SIMULATION_BUNDLE_PATH", "/simulationBundle", "Module paths must be relative POSIX paths");
  }
  const segments = value.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
  })) {
    fail("SIMULATION_BUNDLE_PATH", "/simulationBundle", "Module paths must use portable path segments");
  }
  return value;
}

function decodeSource(bytes, spec) {
  const buffer = Buffer.from(bytes);
  if (buffer.length === 0) {
    fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle/" + spec.id, spec.relativePath + " is empty");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle/" + spec.id, spec.relativePath + " must not contain a BOM");
  }
  let source;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch (error) {
    fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle/" + spec.id, spec.relativePath + " is not valid UTF-8");
  }
  if (source.indexOf("\r") !== -1 || !source.endsWith("\n") || source.endsWith("\n\n")) {
    fail(
      "SIMULATION_BUNDLE_LINE_ENDINGS",
      "/simulationBundle/" + spec.id,
      spec.relativePath + " must use LF and end with exactly one LF"
    );
  }
  return { bytes: buffer, source: source };
}

function transformSource(source, spec, specs) {
  const dependencies = declaredDependencies(spec, specs);
  const wrapper = "(function (root, factory) {";
  if (source.indexOf(wrapper) === -1 || source.indexOf(wrapper, source.indexOf(wrapper) + wrapper.length) !== -1) {
    fail("SIMULATION_BUNDLE_SEAM", "/simulationBundle/" + spec.id, spec.relativePath + " wrapper seam drifted");
  }
  const installMarker = 'Object.defineProperty(game, "' + spec.globalName + '", {';
  if (
    source.indexOf(installMarker) === -1 ||
    source.indexOf(installMarker, source.indexOf(installMarker) + installMarker.length) !== -1
  ) {
    fail("SIMULATION_BUNDLE_SEAM", "/simulationBundle/" + spec.id, spec.relativePath + " global install seam drifted");
  }

  const declaredClassicSeam = classicDependencySeam(spec, dependencies);
  if (declaredClassicSeam !== null) {
    source = replaceExactly(
      source,
      declaredClassicSeam,
      declaredClassicSeam,
      "SIMULATION_BUNDLE_SEAM",
      "/simulationBundle/" + spec.id,
      spec.relativePath + " classic dependency seam drifted"
    );
  }

  const declaredCommonJsSeam = commonJsSeam(spec, dependencies);
  let transformed = replaceExactly(
    source,
    declaredCommonJsSeam,
    "",
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/" + spec.id,
    spec.relativePath + " CommonJS seam drifted"
  );
  const parameterList = dependencies.map(function (dependency) {
    return dependency.declaration.parameterName;
  }).join(", ");
  let factoryParameters;
  if (dependencies.length <= 2) {
    factoryParameters = "(" + parameterList + ") {";
  } else {
    factoryParameters = "(\n" + dependencies.map(function (dependency, index) {
      return "  " + dependency.declaration.parameterName +
        (index + 1 === dependencies.length ? "" : ",");
    }).join("\n") + "\n) {";
  }
  const declaredRootSeam = ROOT_SEAM + factoryParameters;
  transformed = replaceExactly(
    transformed,
    declaredRootSeam,
    "})(BUNDLE_ROOT, function " + factoryParameters,
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/" + spec.id,
    spec.relativePath + " root capture seam drifted"
  );

  if (
    /\brequire\s*\(/.test(transformed) ||
    /\bimport\s*(?:\(|["'])/.test(transformed) ||
    /\bmodule\s*\.\s*exports\b/.test(transformed)
  ) {
    fail("SIMULATION_BUNDLE_IMPORT", "/simulationBundle/" + spec.id, spec.relativePath + " retains a runtime import seam");
  }
  if (/\beval\s*\(/.test(transformed) || /\b(?:new\s+)?Function\s*\(/.test(transformed)) {
    fail("SIMULATION_BUNDLE_CODEGEN", "/simulationBundle/" + spec.id, spec.relativePath + " uses runtime code generation");
  }
  return transformed;
}

function validateSources(sources, specs) {
  specs = specs || MODULE_SPECS;
  if (!Array.isArray(sources)) {
    fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle", "Simulation module sources must be an array");
  }
  const ids = new Set();
  for (const entry of sources) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle", "Every simulation module source must be an object");
    }
    if (ids.has(entry.id)) {
      fail("SIMULATION_BUNDLE_DUPLICATE", "/simulationBundle/" + entry.id, "Duplicate simulation module " + entry.id);
    }
    ids.add(entry.id);
  }
  if (sources.length !== specs.length) {
    fail(
      "SIMULATION_BUNDLE_MISSING",
      "/simulationBundle",
      "Expected exactly " + specs.length + " declared simulation modules"
    );
  }

  return specs.map(function (spec, index) {
    const entry = sources[index];
    const relativePath = portableRelativePath(entry.relativePath);
    if (entry.id !== spec.id || relativePath !== spec.relativePath) {
      fail(
        "SIMULATION_BUNDLE_ORDER",
        "/simulationBundle/" + index,
        "Expected " + spec.id + " from " + spec.relativePath + " at declared position " + index
      );
    }
    let bytes;
    try { bytes = Buffer.from(entry.bytes); }
    catch (error) {
      fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle/" + spec.id, spec.relativePath + " bytes are invalid");
    }
    const decoded = decodeSource(bytes, spec);
    return {
      spec: spec,
      bytes: Buffer.from(decoded.bytes),
      source: decoded.source,
    };
  });
}

function assembleSimulationBundle(sources, specSetInput) {
  const specs = resolveSpecs(specSetInput);
  const modules = validateSources(sources, specs);
  const lines = [
    "/* Generated Armara Aegis deterministic simulation bundle.",
    "   Exact source hashes bind ABI and named deterministic modules in declared order. */",
    "(function (ROOT) {",
    '  "use strict";',
    '  const HAS_COMMON_JS = typeof module !== "undefined" && !!module.exports;',
    "  const BUNDLE_ROOT = HAS_COMMON_JS ? Object.create(null) : ROOT;",
    "",
  ];

  modules.forEach(function (module) {
    lines.push(
      "  /* source " + module.spec.relativePath +
        " bytes=" + module.bytes.length +
        " sha256=" + sha256Hex(module.bytes) + " */"
    );
    lines.push(transformSource(module.source, module.spec, specs).replace(/\n$/, ""));
    lines.push("");
  });

  lines.push(
    "  const game = BUNDLE_ROOT.Game;",
    "  if (",
    "    !game ||"
  );
  specs.forEach(function (spec, index) {
    lines.push("    !game." + spec.globalName + (index + 1 === specs.length ? "" : " ||"));
  });
  lines.push(
    "  ) {",
    '    throw new Error("Aegis simulation bundle did not install every declared module");',
    "  }",
    "  if (HAS_COMMON_JS) {",
    "    const commonJsApi = {};",
    "    Object.keys(game.AegisSim).forEach(function (key) { commonJsApi[key] = game.AegisSim[key]; });"
  );
  specs.forEach(function (spec) {
    lines.push("    commonJsApi." + spec.globalName + " = game." + spec.globalName + ";");
  });
  lines.push(
    "    module.exports = Object.freeze(commonJsApi);",
    "  }",
    "})(typeof globalThis !== \"undefined\" ? globalThis : this);",
    ""
  );
  return Buffer.from(lines.join("\n"), "utf8");
}

function readSimulationSources(sourceRoot, specSetInput) {
  const specs = resolveSpecs(specSetInput);
  if (typeof sourceRoot !== "string" || !sourceRoot) {
    fail("SIMULATION_BUNDLE_PATH", "/simulationBundle", "Simulation source root is required");
  }
  let root;
  try {
    root = fs.realpathSync(path.resolve(sourceRoot));
    if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
  } catch (error) {
    fail("SIMULATION_BUNDLE_READ", "/simulationBundle", "Simulation source root must be an existing directory");
  }

  return specs.map(function (spec) {
    const requested = path.resolve(root, spec.relativePath);
    let resolved;
    try {
      resolved = fs.realpathSync(requested);
      if (!fs.statSync(resolved).isFile()) throw new Error("not a regular file");
    } catch (error) {
      fail("SIMULATION_BUNDLE_READ", "/simulationBundle/" + spec.id, "Missing simulation module " + spec.relativePath);
    }
    const relative = path.relative(root, resolved);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
      fail("SIMULATION_BUNDLE_PATH", "/simulationBundle/" + spec.id, spec.relativePath + " resolves outside the source root");
    }
    let bytes;
    try { bytes = fs.readFileSync(resolved); }
    catch (error) {
      fail("SIMULATION_BUNDLE_READ", "/simulationBundle/" + spec.id, "Cannot read simulation module " + spec.relativePath);
    }
    return { id: spec.id, relativePath: spec.relativePath, bytes: bytes };
  });
}

function buildSimulationBundle(input) {
  input = input || {};
  if (input.sources !== undefined && input.sourceRoot !== undefined) {
    fail("SIMULATION_BUNDLE_SOURCE", "/simulationBundle", "Provide sources or sourceRoot, not both");
  }
  const sources = input.sources !== undefined
    ? input.sources
    : readSimulationSources(input.sourceRoot, input.moduleSet);
  return assembleSimulationBundle(sources, input.moduleSet);
}

module.exports = Object.freeze({
  MODULE_SPECS: MODULE_SPECS,
  readSimulationSources: readSimulationSources,
  assembleSimulationBundle: assembleSimulationBundle,
  buildSimulationBundle: buildSimulationBundle,
});
