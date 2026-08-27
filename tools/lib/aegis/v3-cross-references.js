"use strict";

const { canonicalBytes } = require("./canonical.js");
const { validateAbiDescriptor, validateBehaviorContracts } = require("./contracts.js");
const { fail, pointerJoin } = require("./diagnostics.js");
const { parseExactDecimal } = require("./exact-decimal.js");
const Annex = require("./v3-annex.js");
const Records = require("./v3-record-contracts.js");

const DECIMAL_FIELDS = new Set([
  "armor", "baseDamage", "capacity", "contactDamage", "damage", "hp", "initialAmount",
  "radiusWorldUnits", "rangeWorldUnits", "routeOffsetDistance", "speedWorldUnitsPerSecond",
]);
const PRESENTATION_ONLY_FIELDS = new Set(["presentationPackId", "ui"]);
const SEMANTIC_ARRAY_FIELDS = new Set([
  "behaviors", "childSpawnRecords", "comparatorIds", "difficultyPresets", "firstClearRewards",
  "groups", "laneSegmentIds", "levels", "markers", "nodes", "objectives", "payloadFields",
  "phaseRecords", "previewDeclarations", "segmentOffsets", "statusDeliveries", "subsegments",
  "thresholdRecords", "thresholds", "waves",
]);
const M01_ENVELOPES = Object.freeze([30, 40, 45, 50, 55, 60]);

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodePointerToken(value) {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function compileValue(value, fieldName, diagnosticPath, seen) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return DECIMAL_FIELDS.has(fieldName) ? parseExactDecimal(value, 1000, diagnosticPath) : value;
  }
  if (!value || typeof value !== "object") fail("V3_NORMALIZE_TYPE", diagnosticPath, "Simulation source contains JSON data only");
  if (seen.has(value)) fail("V3_NORMALIZE_SHARED", diagnosticPath, "Simulation source cannot contain shared references");
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(function (item, index) {
      return compileValue(item, null, pointerJoin(diagnosticPath, index), seen);
    });
  }
  if (!isPlainRecord(value)) fail("V3_NORMALIZE_OBJECT", diagnosticPath, "Simulation source records must be plain objects");
  const output = {};
  Object.keys(value).sort(compareAscii).forEach(function (key) {
    if (PRESENTATION_ONLY_FIELDS.has(key)) return;
    output[key] = compileValue(value[key], key, pointerJoin(diagnosticPath, key), seen);
  });
  return output;
}

function frozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = frozenClone(value[key]); });
  return Object.freeze(output);
}

function idObject(records, diagnosticPath) {
  const output = {};
  records.slice().sort(function (left, right) { return compareAscii(left.id, right.id); }).forEach(function (record) {
    if (Object.prototype.hasOwnProperty.call(output, record.id)) {
      fail("V3_NORMALIZE_DUPLICATE", pointerJoin(diagnosticPath, record.id), "Duplicate normalized record ID");
    }
    output[record.id] = compileValue(record, null, pointerJoin(diagnosticPath, record.id), new WeakSet());
  });
  return output;
}

function requireCompiledMap(value, mission, missionIndex) {
  const base = "/missions/" + missionIndex + "/map";
  if (!isPlainRecord(value)) fail("V3_MAP_RESULT", base, "Map compiler must return one plain normalized map IR");
  if (value.schemaVersion !== 2) fail("V3_MAP_RESULT", pointerJoin(base, "schemaVersion"), "Normalized v3 map IR schemaVersion must be 2");
  if (value.id !== mission.mapId) fail("MISSION_MAP_MISMATCH", pointerJoin(base, "id"), "Compiled map ID must match the mission mapId");
  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    fail("V3_MAP_RESULT", pointerJoin(base, "routes"), "Compiled map must contain validated logical routes");
  }
  if (!Array.isArray(value.roleProofs)) {
    fail("V3_MAP_RESULT", pointerJoin(base, "roleProofs"), "Compiled map must contain the validated role-proof partition");
  }
  canonicalBytes(value);
  return value;
}

function orderedChildRecords(owner, diagnosticPath) {
  const output = [];
  ["spawnBehavior", "deathBehavior"].forEach(function (field) {
    const behavior = owner[field];
    if (!behavior || behavior.kind !== "ordered-children") return;
    behavior.childSpawnRecords.forEach(function (record, index) {
      output.push({
        record: record,
        path: pointerJoin(pointerJoin(pointerJoin(diagnosticPath, field), "childSpawnRecords"), index),
      });
    });
  });
  if (owner.thresholdScript) {
    owner.thresholdScript.parameters.thresholds.forEach(function (threshold, thresholdIndex) {
      threshold.childSpawnRecords.forEach(function (record, childIndex) {
        output.push({
          record: record,
          path: pointerJoin(
            pointerJoin(
              pointerJoin(
                pointerJoin(pointerJoin(diagnosticPath, "thresholdScript"), "parameters"),
                "thresholds"
              ),
              thresholdIndex
            ),
            "childSpawnRecords"
          ) + "/" + childIndex,
        });
      });
    });
  }
  return output;
}

function validateChildRouteCompatibility(owner, ownerPath, inheritedRoute, ownerById, routeById, visited) {
  let visitedRoutes = visited.get(owner);
  if (!visitedRoutes) {
    visitedRoutes = new Set();
    visited.set(owner, visitedRoutes);
  }
  if (visitedRoutes.has(inheritedRoute.id)) return;
  visitedRoutes.add(inheritedRoute.id);

  orderedChildRecords(owner, ownerPath).forEach(function (entry) {
    const child = entry.record;
    const childOwner = ownerById.get("enemy:" + child.enemyId);
    if (!childOwner) {
      fail("REFERENCE_UNKNOWN", pointerJoin(entry.path, "enemyId"), "Child enemy does not resolve globally");
    }
    const route = child.routeOwnership === "fixed"
      ? routeById.get(child.fixedRouteId)
      : inheritedRoute;
    const routePath = pointerJoin(entry.path, child.routeOwnership === "fixed" ? "fixedRouteId" : "routeOwnership");
    if (!route) {
      fail("MISSION_ROUTE_REFERENCE", routePath, "Fixed child route does not resolve in the compiled mission map");
    }
    if (childOwner.routeKinds.indexOf(route.kind) === -1) {
      fail("MISSION_ROUTE_KIND", routePath, "Child spawn owner is unavailable on the resolved route kind");
    }
    validateChildRouteCompatibility(
      childOwner,
      "/enemies/" + childOwner.id,
      route,
      ownerById,
      routeById,
      visited
    );
  });
}

function routeCompatibility(records, ownerById, routeById, diagnosticPath) {
  const visited = new Map();
  records.forEach(function (wave, waveIndex) {
    wave.groups.forEach(function (group, groupIndex) {
      const base = pointerJoin(pointerJoin(pointerJoin(diagnosticPath, "waves"), waveIndex), "groups") + "/" + groupIndex;
      const route = routeById.get(group.routeId);
      if (!route) fail("MISSION_ROUTE_REFERENCE", pointerJoin(base, "routeId"), "Spawn group route does not resolve in the compiled mission map");
      const owner = ownerById.get(group.spawnKind + ":" + (group.enemyId || group.bossId));
      if (!owner || owner.routeKinds.indexOf(route.kind) === -1) {
        fail("MISSION_ROUTE_KIND", pointerJoin(base, "routeId"), "Spawn owner is unavailable on the referenced route kind");
      }
      validateChildRouteCompatibility(
        owner,
        (group.spawnKind === "enemy" ? "/enemies/" : "/bosses/") + owner.id,
        route,
        ownerById,
        routeById,
        visited
      );
    });
  });
}

function validateFixedRoutes(value, routeById, diagnosticPath) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { validateFixedRoutes(item, routeById, pointerJoin(diagnosticPath, index)); });
    return;
  }
  if (value.routeOwnership === "fixed") {
    if (typeof value.fixedRouteId !== "string" || !routeById.has(value.fixedRouteId)) {
      fail("MISSION_ROUTE_REFERENCE", pointerJoin(diagnosticPath, "fixedRouteId"), "Fixed child route does not resolve in the compiled mission map");
    }
  }
  Object.keys(value).forEach(function (key) {
    validateFixedRoutes(value[key], routeById, pointerJoin(diagnosticPath, key));
  });
}

function analyzeSpawns(mission, diagnosticPath) {
  const records = [];
  mission.waves.forEach(function (wave, waveIndex) {
    const due = new Map();
    let finalSpawnTick = 0;
    let totalSpawnCount = 0;
    wave.groups.forEach(function (group, groupIndex) {
      totalSpawnCount += group.count;
      if (!Number.isSafeInteger(totalSpawnCount)) {
        fail("SPAWN_AGGREGATE_OVERFLOW", pointerJoin(pointerJoin(pointerJoin(diagnosticPath, "waves"), waveIndex), "groups") + "/" + groupIndex, "Aggregate spawn count exceeds safe integer bounds");
      }
      for (let occurrence = 0; occurrence < group.count; occurrence++) {
        const tick = group.firstTick + occurrence * group.intervalTicks;
        if (!Number.isSafeInteger(tick) || tick > Records.LIMITS.maxSimulationTick) {
          fail("SPAWN_TICK_OVERFLOW", pointerJoin(diagnosticPath, "waves") + "/" + waveIndex + "/groups/" + groupIndex, "Spawn tick exceeds the finite simulation bound");
        }
        due.set(tick, (due.get(tick) || 0) + 1);
        if (tick > finalSpawnTick) finalSpawnTick = tick;
      }
    });
    let maximumSimultaneousDueSpawns = 0;
    due.forEach(function (count) { if (count > maximumSimultaneousDueSpawns) maximumSimultaneousDueSpawns = count; });
    if (maximumSimultaneousDueSpawns > Records.LIMITS.maxSimultaneousWaveSpawns) {
      fail("SPAWN_SIMULTANEOUS_LIMIT", pointerJoin(pointerJoin(diagnosticPath, "waves"), waveIndex), "Simultaneous scheduled spawns exceed the strict authored per-tick cap");
    }
    records.push({
      waveId: wave.id,
      totalSpawnCount: totalSpawnCount,
      finalSpawnTick: finalSpawnTick,
      maximumSimultaneousDueSpawns: maximumSimultaneousDueSpawns,
    });
  });
  return records;
}

function collectSemanticArrayPaths(value, pointer, fieldName, output) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    if (
      SEMANTIC_ARRAY_FIELDS.has(fieldName) &&
      !(fieldName === "comparatorIds" && pointer.indexOf("/ruleCatalog/") !== -1)
    ) output.add(pointer);
    value.forEach(function (item, index) {
      collectSemanticArrayPaths(item, pointer + "/" + index, null, output);
    });
    return;
  }
  Object.keys(value).forEach(function (key) {
    collectSemanticArrayPaths(value[key], pointer + "/" + encodePointerToken(key), key, output);
  });
}

function validatePendingPreviewProofs(recordSet, compiledMaps, validator) {
  const pending = recordSet.pendingPreviewProofRecords;
  if (!Array.isArray(pending)) {
    fail("V3_PREVIEW_PROOF_RESULT", "/previewDeclarations", "Non-map validation must return its typed pending preview-proof partition");
  }
  if (pending.length === 0) return Object.freeze([]);
  if (typeof validator !== "function") {
    fail("V3_PREVIEW_VALIDATOR_REQUIRED", "/previewDeclarations", "Non-briefing previews require the reviewed compiler lethality-provenance validator");
  }
  const result = validator({
    pendingPreviewProofRecords: pending,
    missions: recordSet.missions,
    maps: compiledMaps,
    enemies: recordSet.enemies,
    bosses: recordSet.bosses,
    eventCatalog: recordSet.eventCatalog,
  });
  if (!Array.isArray(result) || result.length !== pending.length) {
    fail("V3_PREVIEW_PROOF_RESULT", "/previewDeclarations", "Preview validator must return exactly one proof for each pending declaration");
  }
  return result.map(function (proof, index) {
    const expected = pending[index];
    if (!isPlainRecord(proof)) fail("V3_PREVIEW_PROOF_RESULT", "/previewDeclarations/" + index, "Preview proofs must be plain records");
    const keys = Object.keys(proof).sort(compareAscii);
    const expectedKeys = [
      "firstLethalWaveIndex", "missionId", "precedesFirstLethal", "previewDeclarationId",
      "previewKind", "provenanceId",
    ];
    if (keys.length !== expectedKeys.length || keys.some(function (key, keyIndex) { return key !== expectedKeys[keyIndex]; })) {
      fail("V3_PREVIEW_PROOF_RESULT", "/previewDeclarations/" + index, "Preview proofs must use the exact compiler proof shape");
    }
    if (
      proof.missionId !== expected.missionId ||
      proof.previewDeclarationId !== expected.previewDeclarationId ||
      proof.previewKind !== expected.previewKind ||
      proof.firstLethalWaveIndex !== expected.firstLethalWaveIndex ||
      proof.precedesFirstLethal !== true ||
      typeof proof.provenanceId !== "string" || !proof.provenanceId
    ) {
      fail("V3_PREVIEW_PROOF_RESULT", "/previewDeclarations/" + index, "Preview proof does not establish the exact pending declaration before first lethal use");
    }
    return compileValue(proof, null, "/previewDeclarations/" + index, new WeakSet());
  });
}

function validateM01BindingLocks(recordSet) {
  const missionIndex = recordSet.missions.findIndex(function (mission) { return mission.id === "m01"; });
  const path = missionIndex < 0 ? "/missions" : "/missions/" + missionIndex;
  if (missionIndex !== 0) {
    fail("M01_BINDING_LOCK", path, "Mission 1 must remain the first compiled slice mission");
  }
  const mission = recordSet.missions[missionIndex];
  if (mission.actIndex !== 1 || mission.missionIndex !== 1 || mission.mapId !== "m01" || mission.prerequisiteMissionIds.length !== 0) {
    fail("M01_BINDING_LOCK", path, "Mission 1 identity, order, map, and prerequisite bindings are immutable");
  }
  if (mission.headlineMechanicId !== "tutorial-foundation") {
    fail("M01_BINDING_LOCK", pointerJoin(path, "headlineMechanicId"), "Mission 1 headline mechanic is immutable");
  }
  if (mission.baseStartAether !== 150) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "baseStartAether"), "Mission 1 Strategos base start must equal 150 Aether");
  }
  if (mission.waves.length !== M01_ENVELOPES.length) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "waves"), "Mission 1 requires exactly six waves");
  }
  mission.waves.forEach(function (wave, waveIndex) {
    const wavePath = pointerJoin(pointerJoin(path, "waves"), waveIndex);
    const expectedIndex = waveIndex + 1;
    const expectedId = "m01.w" + String(expectedIndex).padStart(2, "0");
    if (wave.id !== expectedId || wave.index !== expectedIndex) {
      fail("M01_BINDING_LOCK", wavePath, "Mission 1 wave identities and order are immutable");
    }
    if (wave.baseAetherEnvelope !== M01_ENVELOPES[waveIndex]) {
      fail("M01_BINDING_LOCK", pointerJoin(wavePath, "baseAetherEnvelope"), "Mission 1 inclusive wave envelope differs from its binding value");
    }
    wave.groups.forEach(function (group, groupIndex) {
      if (group.routeId !== "route.main") {
        fail(
          "M01_BINDING_LOCK",
          pointerJoin(pointerJoin(pointerJoin(wavePath, "groups"), groupIndex), "routeId"),
          "Mission 1 spawn groups remain bound to the approved route"
        );
      }
    });
  });
  const grossAether = mission.baseStartAether + mission.waves.reduce(function (sum, wave) {
    return sum + wave.baseAetherEnvelope;
  }, 0);
  if (grossAether !== 430) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "waves"), "Mission 1 maximum gross Aether must equal 430");
  }
  const finalWave = mission.waves[mission.waves.length - 1];
  if (
    finalWave.deploymentGrantAether !== 60 ||
    finalWave.clearGrantAether !== 0 ||
    finalWave.deploymentGrantEventId !== "wave.deploy" ||
    finalWave.clearGrantEventId !== null
  ) {
    fail("M01_BINDING_LOCK", pointerJoin(pointerJoin(path, "waves"), mission.waves.length - 1), "Mission 1 Wave 6 must grant 60 Aether at accepted wave start and zero at clear");
  }
  finalWave.groups.forEach(function (group, groupIndex) {
    if (group.bountyPolicy !== "suppressed") {
      fail(
        "M01_BINDING_LOCK",
        pointerJoin(pointerJoin(pointerJoin(pointerJoin(path, "waves"), mission.waves.length - 1), "groups"), groupIndex),
        "Mission 1 Wave 6 lineage bounty must remain zero"
      );
    }
  });
  if (
    mission.firstClearRewards.length !== 1 ||
    mission.firstClearRewards[0].id !== "reward.m01.hoplite" ||
    mission.firstClearRewards[0].kind !== "unlock-defense" ||
    mission.firstClearRewards[0].defenseId !== "hoplite"
  ) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "firstClearRewards"), "Mission 1 first clear must grant exactly the Hoplite defense unlock");
  }
  if (
    mission.tutorial.kind !== "guided" ||
    mission.tutorial.upgradeGateMode !== "m01-wave1" ||
    mission.tutorial.skipCommandType !== "skipTutorialGate"
  ) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "tutorial"), "Mission 1 tutorial must retain the one-wave gate and recorded skip semantics");
  }
}

function resolveV3Graph(preflight, options) {
  options = options || {};
  if (!preflight || !preflight.manifest || preflight.manifest.schemaVersion !== 3) {
    fail("V3_COMPILER_SCHEMA", "/schemaVersion", "V3 graph resolution accepts only a verified schema-3 preflight result");
  }
  if (typeof options.normalizeAndValidateMap !== "function") {
    fail("V3_MAP_COMPILER_REQUIRED", "/maps", "Inject the complete reviewed map normalizer/role-proof validator");
  }
  const source = preflight.normalizedSource;
  if (!source || !source.abiDescriptor || !source.behaviorContracts) {
    fail("V3_COMPILER_SOURCE", "/", "Verified v3 normalized source partitions are incomplete");
  }
  validateAbiDescriptor(source.abiDescriptor);
  const behaviorContracts = validateBehaviorContracts(source.behaviorContracts, source.abiDescriptor.behaviorRegistry.contracts);
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
  validateM01BindingLocks(recordSet);

  const ownerById = new Map();
  recordSet.enemies.records.forEach(function (record) { ownerById.set("enemy:" + record.id, record); });
  recordSet.bosses.records.forEach(function (record) { ownerById.set("boss:" + record.id, record); });
  const compiledMaps = [];
  const missionRecords = [];
  recordSet.missions.forEach(function (mission, missionIndex) {
    const sourceMission = source.missions[missionIndex];
    const manifestMission = preflight.manifest.missions[missionIndex];
    if (!sourceMission || sourceMission.id !== mission.id || !manifestMission || manifestMission.id !== mission.id) {
      fail("MISSION_SOURCE_MISMATCH", "/missions/" + missionIndex + "/id", "Manifest, mission definition, and loaded map records must align by ID");
    }
    const compiledMap = requireCompiledMap(options.normalizeAndValidateMap({
      mission: mission,
      missionIndex: missionIndex,
      manifestMission: manifestMission,
      mapSource: sourceMission.map,
      mapProofSupplement: sourceMission.mapProofSupplement,
      campaignRules: recordSet.campaignRules,
      defenses: recordSet.defenses,
    }), mission, missionIndex);
    const routeById = new Map(compiledMap.routes.map(function (route) { return [route.id, route]; }));
    if (mission.id === "m01") {
      const routeIndex = compiledMap.routes.findIndex(function (route) { return route.id === "route.main"; });
      if (routeIndex < 0 || compiledMap.routes[routeIndex].kind !== "ground") {
        fail(
          "M01_BINDING_LOCK",
          routeIndex < 0 ? "/maps/m01/routes" : "/maps/m01/routes/" + routeIndex + "/kind",
          "Mission 1 route.main must remain the approved ground road"
        );
      }
    }
    routeCompatibility(mission.waves, ownerById, routeById, "/missions/" + missionIndex);
    mission.objectives.forEach(function (objective, objectiveIndex) {
      if (objective.kind === "mastery" && objective.predicate.kind === "no-leaks-from-routes") {
        objective.predicate.routeIds.forEach(function (routeId, routeIndex) {
          if (!routeById.has(routeId)) {
            fail(
              "MISSION_ROUTE_REFERENCE",
              "/missions/" + missionIndex + "/objectives/" + objectiveIndex + "/predicate/routeIds/" + routeIndex,
              "Mastery route does not resolve in the compiled mission map"
            );
          }
        });
      }
    });
    mission.enemyRosterIds.forEach(function (enemyId) {
      validateFixedRoutes(ownerById.get("enemy:" + enemyId), routeById, "/enemies/" + enemyId);
    });
    mission.bossRosterIds.forEach(function (bossId) {
      validateFixedRoutes(ownerById.get("boss:" + bossId), routeById, "/bosses/" + bossId);
    });
    const normalizedMission = compileValue(mission, null, "/missions/" + mission.id, new WeakSet());
    normalizedMission.spawnAnalysis = analyzeSpawns(mission, "/missions/" + missionIndex);
    missionRecords.push(normalizedMission);
    compiledMaps.push(compileValue(compiledMap, null, "/maps/" + compiledMap.id, new WeakSet()));
  });

  const previewProofRecords = validatePendingPreviewProofs(
    recordSet,
    compiledMaps,
    options.validatePendingPreviewProofs
  );

  const lockTree = {
    schemaVersion: 1,
    campaignRules: compileValue(recordSet.campaignRules, null, "/campaignRules", new WeakSet()),
    defenses: idObject(recordSet.defenses.records, "/defenses"),
    summons: idObject(recordSet.defenses.summonRecords, "/summons"),
    enemies: idObject(recordSet.enemies.records, "/enemies"),
    bosses: idObject(recordSet.bosses.records, "/bosses"),
    missions: idObject(missionRecords, "/missions"),
    maps: idObject(compiledMaps, "/maps"),
    eventCatalog: idObject(recordSet.eventCatalog.records, "/eventCatalog"),
  };
  Annex.validateNormalizedLockTree(lockTree);
  const semanticArrayPaths = new Set();
  collectSemanticArrayPaths(lockTree, "", null, semanticArrayPaths);
  return frozenClone({
    eventSchemaVersion: recordSet.eventSchemaVersion,
    behaviorRegistryVersion: recordSet.behaviorRegistryVersion,
    behaviorContracts: behaviorContracts,
    defenseUnlockGrantMappings: recordSet.defenseUnlockGrantMappings,
    previewProofRecords: previewProofRecords,
    lockTree: lockTree,
    semanticArrayPaths: Array.from(semanticArrayPaths).sort(compareAscii),
  });
}

module.exports = Object.freeze({
  resolveV3Graph: resolveV3Graph,
});
