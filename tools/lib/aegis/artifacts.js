"use strict";

const crypto = require("node:crypto");
const vm = require("node:vm");
const { canonicalEncode, canonicalBytes } = require("./canonical.js");
const { fail, pointerJoin } = require("./diagnostics.js");
const { decodeUtf8 } = require("./strict-json.js");

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function lengthPrefix(length) {
  if (!Number.isSafeInteger(length) || length < 0) fail("HASH_LENGTH", "/", "Artifact length must be a nonnegative safe integer");
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64BE(BigInt(length));
  return prefix;
}

function frameRulesetBytes(abiBytes, simulationBytes, contentBytes) {
  const parts = [Buffer.from(abiBytes), Buffer.from(simulationBytes), Buffer.from(contentBytes)];
  const framed = [];
  for (const part of parts) framed.push(lengthPrefix(part.length), part);
  return Buffer.concat(framed);
}

function cloneDescriptorData(value, path, seen) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      fail("SIMULATION_DESCRIPTOR_DATA", path, "Simulation DESCRIPTOR numbers must be safe integers");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (!value || typeof value !== "object") {
    fail("SIMULATION_DESCRIPTOR_DATA", path, "Simulation DESCRIPTOR must contain only JSON data");
  }
  if (seen.has(value)) {
    fail("SIMULATION_DESCRIPTOR_DATA", path, "Simulation DESCRIPTOR cannot contain cycles or shared references");
  }
  seen.add(value);
  if (Object.getOwnPropertySymbols(value).length) {
    fail("SIMULATION_DESCRIPTOR_DATA", path, "Simulation DESCRIPTOR cannot contain symbol properties");
  }

  if (Array.isArray(value)) {
    const result = [];
    const names = Object.getOwnPropertyNames(value);
    for (let index = 0; index < value.length; index++) {
      const key = String(index);
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (!property) {
        fail("SIMULATION_DESCRIPTOR_DATA", pointerJoin(path, index), "Simulation DESCRIPTOR arrays cannot be sparse");
      }
      if (!property.enumerable || property.get || property.set) {
        fail("SIMULATION_DESCRIPTOR_DATA", pointerJoin(path, index), "Simulation DESCRIPTOR array elements must be enumerable data properties");
      }
      result.push(cloneDescriptorData(property.value, pointerJoin(path, index), seen));
    }
    for (const name of names) {
      if (name !== "length" && (
        !/^(0|[1-9][0-9]*)$/.test(name) ||
        !Number.isSafeInteger(Number(name)) ||
        Number(name) >= value.length
      )) {
        fail("SIMULATION_DESCRIPTOR_DATA", pointerJoin(path, name), "Simulation DESCRIPTOR arrays cannot have extra properties");
      }
    }
    return result;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null) {
    const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
    if (
      Object.getPrototypeOf(prototype) !== null ||
      !constructor ||
      typeof constructor.value !== "function" ||
      constructor.value.name !== "Object"
    ) {
      fail("SIMULATION_DESCRIPTOR_DATA", path, "Simulation DESCRIPTOR objects must be plain objects");
    }
  }
  const result = Object.create(null);
  for (const key of Object.getOwnPropertyNames(value)) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property.enumerable || property.get || property.set) {
      fail("SIMULATION_DESCRIPTOR_DATA", pointerJoin(path, key), "Simulation DESCRIPTOR properties must be enumerable data properties");
    }
    result[key] = cloneDescriptorData(property.value, pointerJoin(path, key), seen);
  }
  return result;
}

function executeSimulation(source, label, commonJs) {
  const sandbox = Object.create(null);
  if (commonJs) {
    sandbox.module = Object.create(null);
    sandbox.module.exports = Object.create(null);
    sandbox.exports = sandbox.module.exports;
  }
  sandbox.globalThis = sandbox;
  try {
    const context = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });
    vm.runInContext(source, context, { filename: label, timeout: 1000 });
  } catch (error) {
    fail(
      "SIMULATION_LOAD",
      "/simulation",
      label + " failed in " + (commonJs ? "CommonJS" : "classic-script") +
        " mode without imports: " + String(error && error.message || error)
    );
  }
  const api = commonJs ? sandbox.module.exports : sandbox.Game && sandbox.Game.AegisSim;
  const descriptorProperty = api && typeof api === "object"
    ? Object.getOwnPropertyDescriptor(api, "DESCRIPTOR")
    : null;
  if (
    !descriptorProperty ||
    descriptorProperty.get ||
    descriptorProperty.set ||
    !descriptorProperty.value ||
    typeof descriptorProperty.value !== "object"
  ) {
    fail(
      "SIMULATION_DESCRIPTOR",
      "/simulation",
      label + " must export DESCRIPTOR in " + (commonJs ? "CommonJS" : "classic-script") + " mode"
    );
  }
  return cloneDescriptorData(descriptorProperty.value, "/simulation/DESCRIPTOR", new WeakSet());
}

function simulationDescriptor(simulationBytes, label) {
  label = label || "simulation artifact";
  const source = decodeUtf8(simulationBytes, label);
  if (source.indexOf("\r") !== -1 || !source.endsWith("\n") || source.endsWith("\n\n")) {
    fail("SIMULATION_LINE_ENDINGS", "/simulation", label + " must use LF line endings and end with exactly one LF");
  }
  const commonJs = executeSimulation(source, label, true);
  const classic = executeSimulation(source, label, false);
  if (!canonicalBytes(commonJs).equals(canonicalBytes(classic))) {
    fail("SIMULATION_MODE_MISMATCH", "/simulation/DESCRIPTOR", label + " exports different descriptors in CommonJS and classic-script modes");
  }
  return commonJs;
}

function renderContentArtifact(content) {
  const encoded = canonicalEncode(content);
  const source = [
    "/* Generated Armara Aegis content artifact. Source JSON is authoritative. */",
    "(function (root) {",
    "  \"use strict\";",
    "  function deepFreeze(value) {",
    "    if (!value || typeof value !== \"object\" || Object.isFrozen(value)) return value;",
    "    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });",
    "    return Object.freeze(value);",
    "  }",
    "  const CONTENT = deepFreeze(JSON.parse(" + JSON.stringify(encoded) + "));",
    "  const api = deepFreeze({ CONTENT: CONTENT });",
    "  if (typeof module !== \"undefined\" && module.exports) { module.exports = api; return; }",
    "  const game = root.Game = root.Game || {};",
    "  if (Object.prototype.hasOwnProperty.call(game, \"AegisContent\")) throw new Error(\"Game.AegisContent is already installed\");",
    "  Object.defineProperty(game, \"AegisContent\", { value: api, writable: false, configurable: false, enumerable: true });",
    "})(typeof globalThis !== \"undefined\" ? globalThis : this);",
    "",
  ].join("\n");
  return Buffer.from(source, "utf8");
}

function deepFreezeData(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreezeData(value[key]); });
  return Object.freeze(value);
}

function immutableOutputs(entries) {
  const store = new Map(entries.map(function (entry) {
    return [entry[0], Buffer.from(entry[1])];
  }));
  const names = Object.freeze(Array.from(store.keys()).sort());
  function get(name) {
    const bytes = store.get(name);
    return bytes === undefined ? undefined : Buffer.from(bytes);
  }
  function keys() {
    return names[Symbol.iterator]();
  }
  function entriesIterator() {
    return names.map(function (name) { return [name, Buffer.from(store.get(name))]; })[Symbol.iterator]();
  }
  const output = {
    size: names.length,
    has: function (name) { return store.has(name); },
    get: get,
    keys: keys,
    entries: entriesIterator,
  };
  output[Symbol.iterator] = entriesIterator;
  return Object.freeze(output);
}

function buildArtifacts(input) {
  const abi = input.abi;
  const behaviorContracts = input.behaviorContracts;
  const simulationBytes = Buffer.from(input.simulationBytes);
  const runtimeAbi = simulationDescriptor(simulationBytes, input.simulationLabel);
  const authoredAbiBytes = canonicalBytes(abi);
  const runtimeAbiBytes = canonicalBytes(runtimeAbi);
  if (!authoredAbiBytes.equals(runtimeAbiBytes)) {
    fail("ABI_RUNTIME_MISMATCH", "/abiDescriptor", "Authored ABI descriptor does not byte-semantically match the simulation artifact DESCRIPTOR");
  }

  const abiHashHex = sha256Hex(authoredAbiBytes);
  const content = deepFreezeData(JSON.parse(canonicalEncode({
    abi: abi,
    abiHash: "sha256:" + abiHashHex,
    behaviorContracts: behaviorContracts,
    contentVersion: input.contentVersion,
    missionIds: input.missionIds.slice(),
    schemaVersion: input.schemaVersion,
    sourceKind: input.sourceKind,
  })));
  const contentBytes = renderContentArtifact(content);
  const simulationHashHex = sha256Hex(simulationBytes);
  const contentHashHex = sha256Hex(contentBytes);
  const rulesetHashHex = sha256Hex(frameRulesetBytes(authoredAbiBytes, simulationBytes, contentBytes));
  const simulationName = "aegis-sim." + simulationHashHex + ".js";
  const contentName = "aegis-content." + contentHashHex + ".js";
  const manifest = deepFreezeData({
    abiHash: "sha256:" + abiHashHex,
    contentArtifact: contentName,
    contentHash: "sha256:" + contentHashHex,
    contentVersion: input.contentVersion,
    missionIds: input.missionIds.slice(),
    rulesetHash: "sha256:" + rulesetHashHex,
    schemaVersion: input.schemaVersion,
    simulationArtifact: simulationName,
    simulationHash: "sha256:" + simulationHashHex,
  });
  const manifestBytes = Buffer.concat([canonicalBytes(manifest), Buffer.from("\n", "utf8")]);
  const manifestHashHex = sha256Hex(manifestBytes);
  const manifestName = "manifest." + manifestHashHex + ".json";
  const outputs = immutableOutputs([
    [simulationName, simulationBytes],
    [contentName, contentBytes],
    [manifestName, manifestBytes],
  ]);
  const result = {
    content: content,
    manifest: manifest,
    manifestName: manifestName,
    outputs: outputs,
    rulesetHash: manifest.rulesetHash,
  };
  Object.defineProperties(result, {
    abiBytes: { enumerable: true, get: function () { return Buffer.from(authoredAbiBytes); } },
    contentBytes: { enumerable: true, get: function () { return Buffer.from(contentBytes); } },
    manifestBytes: { enumerable: true, get: function () { return Buffer.from(manifestBytes); } },
  });
  return Object.freeze(result);
}

module.exports = Object.freeze({
  sha256Hex: sha256Hex,
  frameRulesetBytes: frameRulesetBytes,
  simulationDescriptor: simulationDescriptor,
  renderContentArtifact: renderContentArtifact,
  immutableOutputs: immutableOutputs,
  buildArtifacts: buildArtifacts,
});
