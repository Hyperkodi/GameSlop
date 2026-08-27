"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");
const { fail } = require("./diagnostics.js");

const MODULE_SPECS = Object.freeze([
  Object.freeze({ id: "abi", relativePath: "abi.js", globalName: "AegisSim", dependencies: null }),
  Object.freeze({ id: "geometry", relativePath: "geometry.js", globalName: "AegisGeometry", dependencies: Object.freeze([
    Object.freeze({ id: "abi", parameterName: "ABI", requirePath: "./abi.js" }),
  ]) }),
  Object.freeze({ id: "timers", relativePath: "timers.js", globalName: "AegisTimers", dependencies: Object.freeze([
    Object.freeze({ id: "abi", parameterName: "ABI", requirePath: "./abi.js" }),
  ]) }),
  Object.freeze({ id: "economy", relativePath: "economy.js", globalName: "AegisEconomy", dependencies: Object.freeze([
    Object.freeze({ id: "abi", parameterName: "ABI", requirePath: "./abi.js" }),
  ]) }),
  Object.freeze({ id: "movement", relativePath: "movement.js", globalName: "AegisMovement", dependencies: Object.freeze([
    Object.freeze({ id: "abi", parameterName: "ABI", requirePath: "./abi.js" }),
  ]) }),
  Object.freeze({ id: "effects", relativePath: "effects.js", globalName: "AegisEffects", dependencies: Object.freeze([
    Object.freeze({ id: "abi", parameterName: "ABI", requirePath: "./abi.js" }),
  ]) }),
  Object.freeze({ id: "targeting", relativePath: "targeting.js", globalName: "AegisTargeting", dependencies: Object.freeze([
    Object.freeze({ id: "abi", parameterName: "ABI", requirePath: "./abi.js" }),
    Object.freeze({ id: "geometry", parameterName: "Geometry", requirePath: "./geometry.js" }),
  ]) }),
]);

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

function declaredDependencies(spec) {
  if (spec.dependencies === null) return [];
  if (!Array.isArray(spec.dependencies) || spec.dependencies.length === 0) {
    fail("SIMULATION_BUNDLE_DEPENDENCY", "/simulationBundle/" + spec.id, spec.relativePath + " must declare its CommonJS dependencies");
  }
  const specIndex = MODULE_SPECS.indexOf(spec);
  const ids = new Set();
  return spec.dependencies.map(function (dependency) {
    if (!dependency || typeof dependency !== "object" || Array.isArray(dependency) || ids.has(dependency.id)) {
      fail("SIMULATION_BUNDLE_DEPENDENCY", "/simulationBundle/" + spec.id, spec.relativePath + " has an invalid CommonJS dependency");
    }
    const dependencyIndex = MODULE_SPECS.findIndex(function (candidate) { return candidate.id === dependency.id; });
    const dependencySpec = MODULE_SPECS[dependencyIndex];
    if (
      dependencyIndex < 0 ||
      dependencyIndex >= specIndex ||
      dependency.requirePath !== "./" + dependencySpec.relativePath ||
      typeof dependency.parameterName !== "string" ||
      !/^[A-Z][A-Za-z0-9]*$/.test(dependency.parameterName)
    ) {
      fail("SIMULATION_BUNDLE_DEPENDENCY", "/simulationBundle/" + spec.id, spec.relativePath + " has an invalid or forward CommonJS dependency");
    }
    ids.add(dependency.id);
    return { declaration: dependency, module: dependencySpec };
  });
}

function commonJsSeam(spec, dependencies) {
  if (spec.dependencies === null) return ABI_COMMON_JS_SEAM;
  return [
    "  if (typeof module !== \"undefined\" && module.exports) {",
    "    module.exports = factory(" + dependencies.map(function (dependency) {
      return 'require("' + dependency.declaration.requirePath + '")';
    }).join(", ") + ");",
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
  lines.push(
    "  const api = factory(" + dependencies.map(function (dependency) {
      return "game." + dependency.module.globalName;
    }).join(", ") + ");"
  );
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

function transformSource(source, spec) {
  const dependencies = declaredDependencies(spec);
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
  const declaredRootSeam = ROOT_SEAM + "(" + parameterList + ") {";
  transformed = replaceExactly(
    transformed,
    declaredRootSeam,
    "})(BUNDLE_ROOT, function (" + parameterList + ") {",
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

function validateSources(sources) {
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
  if (sources.length !== MODULE_SPECS.length) {
    fail(
      "SIMULATION_BUNDLE_MISSING",
      "/simulationBundle",
      "Expected exactly " + MODULE_SPECS.length + " declared simulation modules"
    );
  }

  return MODULE_SPECS.map(function (spec, index) {
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

function assembleSimulationBundle(sources) {
  const modules = validateSources(sources);
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
    lines.push(transformSource(module.source, module.spec).replace(/\n$/, ""));
    lines.push("");
  });

  lines.push(
    "  const game = BUNDLE_ROOT.Game;",
    "  if (!game || !game.AegisSim || !game.AegisGeometry || !game.AegisTimers || !game.AegisEconomy || !game.AegisMovement || !game.AegisEffects || !game.AegisTargeting) {",
    '    throw new Error("Aegis simulation bundle did not install every declared module");',
    "  }",
    "  if (HAS_COMMON_JS) {",
    "    const commonJsApi = {};",
    "    Object.keys(game.AegisSim).forEach(function (key) { commonJsApi[key] = game.AegisSim[key]; });",
    "    commonJsApi.AegisSim = game.AegisSim;",
    "    commonJsApi.AegisGeometry = game.AegisGeometry;",
    "    commonJsApi.AegisTimers = game.AegisTimers;",
    "    commonJsApi.AegisEconomy = game.AegisEconomy;",
    "    commonJsApi.AegisMovement = game.AegisMovement;",
    "    commonJsApi.AegisEffects = game.AegisEffects;",
    "    commonJsApi.AegisTargeting = game.AegisTargeting;",
    "    module.exports = Object.freeze(commonJsApi);",
    "  }",
    "})(typeof globalThis !== \"undefined\" ? globalThis : this);",
    ""
  );
  return Buffer.from(lines.join("\n"), "utf8");
}

function readSimulationSources(sourceRoot) {
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

  return MODULE_SPECS.map(function (spec) {
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
  const sources = input.sources !== undefined ? input.sources : readSimulationSources(input.sourceRoot);
  return assembleSimulationBundle(sources);
}

module.exports = Object.freeze({
  MODULE_SPECS: MODULE_SPECS,
  readSimulationSources: readSimulationSources,
  assembleSimulationBundle: assembleSimulationBundle,
  buildSimulationBundle: buildSimulationBundle,
});
