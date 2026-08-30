"use strict";

/* Schema-v4 graph resolution.
   Reuses the reviewed v3 record contracts for every retained record and adds the v4
   specialization, protocol-loan, mechanism, and reinforcement-marker cross references. */

const { canonicalBytes } = require("./canonical.js");
const { fail, pointerJoin } = require("./diagnostics.js");
const { parseExactDecimal } = require("./exact-decimal.js");
const Catalog = require("./v4-behavior-catalog.js");
const RuleCatalog = require("./v4-rule-catalog.js");
const Records = require("./v4-record-contracts.js");
const UnlockCompiler = require("./v4-unlock-compiler.js");
const V3Records = require("./v3-record-contracts.js");

const DECIMAL_FIELDS = new Set([
  "armor", "baseDamage", "blastDamage", "blastRadiusWorldUnits", "capacity", "contactDamage",
  "damage", "damagePerSecond", "hp", "incrementDamage", "initialAmount", "jumpRangeWorldUnits",
  "lineWidthWorldUnits", "armingRadiusWorldUnits", "patrolRadiusWorldUnits", "peakDamage",
  "displacementWorldUnits", "radiusWorldUnits", "rangeWorldUnits", "routeOffsetDistance",
  "speedWorldUnitsPerSecond", "startDamage", "travelSpeedWorldUnitsPerSecond",
]);
const PRESENTATION_ONLY_FIELDS = new Set(["presentationPackId", "ui"]);
const SEMANTIC_ARRAY_FIELDS = new Set([
  "activations", "behaviors", "childSpawnRecords", "comparatorIds", "difficultyPresets",
  "falloffBp", "firstClearRewards", "groups", "laneSegmentIds", "levels", "markers", "nodes",
  "objectives", "payloadFields", "phaseRecords", "previewDeclarations", "reinforcementMarkers",
  "segmentOffsets", "statPolicies", "statusDeliveries", "subsegments", "thresholdRecords",
  "thresholds", "tierCosts", "waves",
]);
const M01_ENVELOPES = [30, 40, 45, 50, 55, 60];

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

function compileValue(value, fieldName, diagnosticPath, seen, keepUi) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return DECIMAL_FIELDS.has(fieldName) ? parseExactDecimal(value, 1000, diagnosticPath) : value;
  }
  if (!value || typeof value !== "object") {
    fail("V4_NORMALIZE_TYPE", diagnosticPath, "Simulation source contains JSON data only");
  }
  if (seen.has(value)) fail("V4_NORMALIZE_SHARED", diagnosticPath, "Simulation source cannot contain shared references");
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(function (item, index) {
      return compileValue(item, null, pointerJoin(diagnosticPath, index), seen, keepUi);
    });
  }
  if (!isPlainRecord(value)) fail("V4_NORMALIZE_OBJECT", diagnosticPath, "Simulation source records must be plain objects");
  const output = {};
  Object.keys(value).sort(compareAscii).forEach(function (key) {
    if (PRESENTATION_ONLY_FIELDS.has(key) && !(keepUi && key === "ui")) return;
    output[key] = compileValue(value[key], key, pointerJoin(diagnosticPath, key), seen, false);
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

function idObject(records, diagnosticPath, keepUi) {
  const output = {};
  records.slice().sort(function (left, right) { return compareAscii(left.id, right.id); })
    .forEach(function (record) {
      if (Object.prototype.hasOwnProperty.call(output, record.id)) {
        fail("V4_NORMALIZE_DUPLICATE", pointerJoin(diagnosticPath, record.id), "Duplicate normalized record ID");
      }
      output[record.id] = compileValue(
        record, null, pointerJoin(diagnosticPath, record.id), new WeakSet(), keepUi === true
      );
    });
  return output;
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

function walkReferences(value, path, singularKeys, arrayKeys, output) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(function (item, index) {
      walkReferences(item, pointerJoin(path, index), singularKeys, arrayKeys, output);
    });
    return;
  }
  Object.keys(value).forEach(function (key) {
    const childPath = pointerJoin(path, key);
    const child = value[key];
    if (singularKeys.has(key) && child !== null && typeof child === "string") {
      output.push({ id: child, path: childPath });
    } else if (arrayKeys.has(key) && Array.isArray(child)) {
      child.forEach(function (id, index) { output.push({ id: id, path: pointerJoin(childPath, index) }); });
    }
    walkReferences(child, childPath, singularKeys, arrayKeys, output);
  });
}

function assertReferences(references, known, code, message) {
  references.forEach(function (reference) {
    if (!known.has(reference.id)) fail(code, reference.path, message || "Referenced ID does not resolve");
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
        fail(
          "SPAWN_AGGREGATE_OVERFLOW",
          pointerJoin(pointerJoin(pointerJoin(diagnosticPath, "waves"), waveIndex), "groups") + "/" + groupIndex,
          "Aggregate spawn count exceeds safe integer bounds"
        );
      }
      for (let occurrence = 0; occurrence < group.count; occurrence++) {
        const tick = group.firstTick + occurrence * group.intervalTicks;
        if (!Number.isSafeInteger(tick) || tick > V3Records.LIMITS.maxSimulationTick) {
          fail(
            "SPAWN_TICK_OVERFLOW",
            pointerJoin(diagnosticPath, "waves") + "/" + waveIndex + "/groups/" + groupIndex,
            "Spawn tick exceeds the finite simulation bound"
          );
        }
        due.set(tick, (due.get(tick) || 0) + 1);
        if (tick > finalSpawnTick) finalSpawnTick = tick;
      }
    });
    let maximumSimultaneousDueSpawns = 0;
    due.forEach(function (count) { if (count > maximumSimultaneousDueSpawns) maximumSimultaneousDueSpawns = count; });
    if (maximumSimultaneousDueSpawns > V3Records.LIMITS.maxSimultaneousWaveSpawns) {
      fail(
        "SPAWN_SIMULTANEOUS_LIMIT",
        pointerJoin(pointerJoin(diagnosticPath, "waves"), waveIndex),
        "Simultaneous scheduled spawns exceed the strict authored per-tick cap"
      );
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

function validateM01BindingLocks(missions) {
  const missionIndex = missions.findIndex(function (mission) { return mission.id === "m01"; });
  const path = missionIndex < 0 ? "/missions" : "/missions/" + missionIndex;
  if (missionIndex !== 0) fail("M01_BINDING_LOCK", path, "Mission 1 must remain the first compiled mission");
  const mission = missions[0];
  if (mission.actIndex !== 1 || mission.missionIndex !== 1 || mission.mapId !== "m01" ||
      mission.prerequisiteMissionIds.length !== 0 ||
      mission.headlineMechanicId !== "tutorial-foundation" || mission.baseStartAether !== 150) {
    fail("M01_BINDING_LOCK", path, "Mission 1 identity, order, map, prerequisite, and start Aether bindings are immutable");
  }
  if (mission.waves.length !== M01_ENVELOPES.length) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "waves"), "Mission 1 requires exactly six waves");
  }
  mission.waves.forEach(function (wave, waveIndex) {
    const wavePath = pointerJoin(pointerJoin(path, "waves"), waveIndex);
    const expectedId = "m01.w" + String(waveIndex + 1).padStart(2, "0");
    if (wave.id !== expectedId || wave.index !== waveIndex + 1 ||
        wave.baseAetherEnvelope !== M01_ENVELOPES[waveIndex]) {
      fail("M01_BINDING_LOCK", wavePath, "Mission 1 wave identity, order, and envelope are immutable");
    }
  });
  const grossAether = mission.baseStartAether + mission.waves.reduce(function (sum, wave) {
    return sum + wave.baseAetherEnvelope;
  }, 0);
  if (grossAether !== 430) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "waves"), "Mission 1 maximum gross Aether must equal 430");
  }
  if (mission.tutorial.kind !== "guided" || mission.tutorial.upgradeGateMode !== "m01-wave1" ||
      mission.tutorial.skipCommandType !== "skipTutorialGate") {
    fail("M01_BINDING_LOCK", pointerJoin(path, "tutorial"), "Mission 1 tutorial gate is immutable");
  }
  if (mission.protocolLoan !== null) {
    fail("M01_BINDING_LOCK", pointerJoin(path, "protocolLoan"), "Mission 1 predates every Protocol loan");
  }
}

function requireCompiledMap(value, mission, missionIndex) {
  const base = "/missions/" + missionIndex + "/map";
  if (!isPlainRecord(value)) fail("V4_MAP_RESULT", base, "Map compiler must return one plain normalized map IR");
  if (value.schemaVersion !== 2) {
    fail("V4_MAP_RESULT", pointerJoin(base, "schemaVersion"), "Normalized v4 map IR schemaVersion must be 2");
  }
  if (value.id !== mission.mapId) {
    fail("MISSION_MAP_MISMATCH", pointerJoin(base, "id"), "Compiled map ID must match the mission mapId");
  }
  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    fail("V4_MAP_RESULT", pointerJoin(base, "routes"), "Compiled map must contain validated logical routes");
  }
  if (!Array.isArray(value.roleProofs)) {
    fail("V4_MAP_RESULT", pointerJoin(base, "roleProofs"), "Compiled map must contain the validated role-proof partition");
  }
  canonicalBytes(value);
  return value;
}

/* ADR-001: a reinforcement marker obeys the ordinary pad grammar. Cell centers resolve as
   world = 4 * cell + 2; the marker keeps the twelve-unit road buffer through the sixteen-unit
   lane-centre rule, twenty units from any pad or another marker, and eight units inside the
   board. Compiled lane geometry is milli world units, so every comparison scales by 1000. */
const CELL_WORLD_UNITS = 4;
const CELL_CENTER_OFFSET = 2;
const MILLI = 1000;
const MIN_LANE_CENTER_MILLI = 16 * MILLI;
const MIN_PAD_MILLI = 20 * MILLI;
const MIN_BOARD_INSET_MILLI = 8 * MILLI;

function cellCenterMilli(column, row) {
  return {
    x: (CELL_WORLD_UNITS * column + CELL_CENTER_OFFSET) * MILLI,
    y: (CELL_WORLD_UNITS * row + CELL_CENTER_OFFSET) * MILLI,
  };
}

function squaredDistance(left, right) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function pointSegmentSquaredDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return squaredDistance(point, start);
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return squaredDistance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function laneSubsegments(compiledMap) {
  const output = [];
  (compiledMap.laneSegments || []).forEach(function (lane) {
    const compiled = lane && lane.compiled;
    if (!compiled || !Array.isArray(compiled.subsegments)) return;
    compiled.subsegments.forEach(function (subsegment) {
      output.push([
        { x: subsegment.fromX, y: subsegment.fromY },
        { x: subsegment.toX, y: subsegment.toY },
      ]);
    });
  });
  return output;
}

function validateReinforcementMarkers(mission, missionPath, compiledMap, reinforcementIds) {
  const markers = mission.reinforcementMarkers;
  if (markers.length === 0) return;
  const board = compiledMap.board || {};
  const boardWidth = (typeof board.widthWorldUnits === "number" ? board.widthWorldUnits : 160) * MILLI;
  const boardHeight = (typeof board.heightWorldUnits === "number" ? board.heightWorldUnits : 100) * MILLI;
  const padCenters = (compiledMap.pads || []).map(function (pad) {
    return cellCenterMilli(pad.column, pad.row);
  });
  const segments = laneSubsegments(compiledMap);
  if (segments.length === 0) {
    fail(
      "V4_MARKER_GEOMETRY",
      pointerJoin(missionPath, "reinforcementMarkers"),
      "Reinforcement markers require compiled lane geometry to prove their road buffer"
    );
  }
  const markerCenters = [];
  markers.forEach(function (marker, index) {
    const markerPath = pointerJoin(pointerJoin(missionPath, "reinforcementMarkers"), index);
    marker.supportedReinforcementIds.forEach(function (id, idIndex) {
      if (!reinforcementIds.has(id)) {
        fail(
          "V4_MARKER_REINFORCEMENT",
          pointerJoin(pointerJoin(markerPath, "supportedReinforcementIds"), idIndex),
          "Unknown reinforcement " + JSON.stringify(id)
        );
      }
    });
    const center = cellCenterMilli(marker.column, marker.row);
    if (center.x < MIN_BOARD_INSET_MILLI || center.y < MIN_BOARD_INSET_MILLI ||
        center.x > boardWidth - MIN_BOARD_INSET_MILLI || center.y > boardHeight - MIN_BOARD_INSET_MILLI) {
      fail("V4_MARKER_GEOMETRY", markerPath, "Reinforcement markers stay at least eight world units inside the board");
    }
    segments.forEach(function (segment) {
      if (pointSegmentSquaredDistance(center, segment[0], segment[1]) <
          MIN_LANE_CENTER_MILLI * MIN_LANE_CENTER_MILLI) {
        fail("V4_MARKER_GEOMETRY", markerPath, "Reinforcement markers obey the ordinary sixteen-unit lane-centre buffer");
      }
    });
    padCenters.concat(markerCenters).forEach(function (other) {
      if (squaredDistance(center, other) < MIN_PAD_MILLI * MIN_PAD_MILLI) {
        fail("V4_MARKER_GEOMETRY", markerPath, "Reinforcement markers stay twenty world units from pads and each other");
      }
    });
    markerCenters.push(center);
  });
}

function validateMissionMechanism(mission, missionPath, compiledMap, mechanismById) {
  if (mission.mechanism === null) return;
  const mechanismPath = pointerJoin(missionPath, "mechanism");
  const mechanism = mechanismById.get(mission.mechanism.mechanismId);
  if (!mechanism) {
    fail("V4_MECHANISM_REFERENCE", pointerJoin(mechanismPath, "mechanismId"), "Unknown mechanism");
  }
  const geometry = compiledMap.mechanismGeometry;
  if (!Array.isArray(geometry)) {
    fail(
      "V4_MECHANISM_GEOMETRY",
      pointerJoin(mechanismPath, "activations"),
      "A mission mechanism requires authored mechanismGeometry in its compiled map"
    );
  }
  const geometryIds = new Set(geometry.map(function (record) { return record.id; }));
  mission.mechanism.activations.forEach(function (activation, index) {
    if (!geometryIds.has(activation.geometryId)) {
      fail(
        "V4_MECHANISM_GEOMETRY",
        pointerJoin(pointerJoin(pointerJoin(mechanismPath, "activations"), index), "geometryId"),
        "Activation geometry does not resolve in the compiled map"
      );
    }
  });
}

function resolveV4Graph(preflight, options) {
  options = options || {};
  if (!preflight || !preflight.manifest || preflight.manifest.schemaVersion !== 4) {
    fail("V4_COMPILER_SCHEMA", "/schemaVersion", "V4 graph resolution accepts only a verified schema-4 preflight result");
  }
  if (typeof options.normalizeAndValidateMap !== "function") {
    fail("V4_MAP_COMPILER_REQUIRED", "/maps", "Inject the complete reviewed map normalizer/role-proof validator");
  }
  const source = preflight.normalizedSource;
  const approvalState = preflight.manifest.approvalState;
  if (approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/approvalState", "Candidate v4 content can never be production approved");
  }

  const context = Records.createReferenceContext();
  Records.preflight(source.campaignRules, "/campaignRules");
  Records.validateV4CampaignRulesCore(source.campaignRules, "/campaignRules");
  Records.preflight(source.defenses, "/defenses");
  Records.validateV4DefenseSourceCore(source.defenses, "/defenses", context);
  const enemies = V3Records.validateEnemySource(source.enemies);
  const bosses = V3Records.validateBossSource(source.bosses);
  Records.preflight(source.eventCatalog, "/eventCatalog");
  Records.validateV4EventCatalogCore(source.eventCatalog, "/eventCatalog");
  const stringCatalog = V3Records.validateStringCatalog(source.stringCatalog);

  const missions = source.missions.map(function (record) { return record.definition; });
  missions.forEach(function (mission, index) {
    Records.preflight(mission, pointerJoin("/missions", index));
    Records.validateV4MissionCore(mission, pointerJoin("/missions", index), context);
  });
  Records.requireRecordOrder(missions, "/missions");
  validateM01BindingLocks(missions);

  const behaviorContracts = validateBehaviorContractsV2(source.behaviorContracts, context.deliveryKeys);
  const unlockContent = UnlockCompiler.compileUnlockSimulationContent(source.unlocks);

  /* --- specialization parity against the approved unlock binding --- */
  const specializationById = new Map(unlockContent.specializations.map(function (record) {
    return [record.id, record];
  }));
  const specializationSourceById = new Map(source.unlocks.specializations.records.map(function (record) {
    return [record.id, record];
  }));
  context.specializationRecords.forEach(function (entry) {
    const authored = entry.record;
    const binding = specializationById.get(authored.id);
    const bindingSource = specializationSourceById.get(authored.id);
    if (!binding || !bindingSource) {
      fail("V4_SPECIALIZATION_BINDING", pointerJoin(entry.path, "id"), "Unknown approved specialization ID");
    }
    if (bindingSource.nameKey !== authored.nameKey) {
      fail("V4_SPECIALIZATION_BINDING", pointerJoin(entry.path, "nameKey"), "Specialization nameKey differs from the approved unlock binding");
    }
    if (binding.defenseId !== authored.defenseId || binding.isDefault !== authored.isDefault ||
        binding.branchRoleId !== authored.branchRoleId || binding.unlockGrantId !== authored.unlockGrantId) {
      fail("V4_SPECIALIZATION_BINDING", entry.path, "Specialization identity differs from the approved unlock binding");
    }
    if (binding.level3CostAether !== authored.purchase.costAether) {
      fail(
        "V4_SPECIALIZATION_COST",
        pointerJoin(pointerJoin(entry.path, "purchase"), "costAether"),
        "Branch cost must equal the rule catalog level3CostAether"
      );
    }
  });
  if (context.specializationRecords.length !== RuleCatalog.SPECIALIZATION_IDS.length) {
    fail("V4_SPECIALIZATION_BINDING", "/defenses/records", "Every approved specialization must be authored exactly once");
  }

  /* --- campaign, event, string, status, and damage-type resolution --- */
  const campaignRules = source.campaignRules;
  const accessGrants = new Set(campaignRules.accessGrantIds);
  const policyIds = new Set(campaignRules.targetPolicyRecords.map(function (record) { return record.id; }));
  const defenseIds = new Set();
  const unlockIds = new Set();
  const defenseUnlockGrantMappings = [];
  source.defenses.records.forEach(function (defense, index) {
    const defensePath = pointerJoin("/defenses/records", index);
    defenseIds.add(defense.id);
    if (unlockIds.has(defense.unlockId)) {
      fail("ACCESS_GRANT_MAPPING", pointerJoin(defensePath, "unlockId"), "Two defenses cannot share one access grant");
    }
    if (!accessGrants.has(defense.unlockId)) {
      fail("REFERENCE_UNKNOWN", pointerJoin(defensePath, "unlockId"), "Defense unlockId is absent from campaign access grants");
    }
    unlockIds.add(defense.unlockId);
    defenseUnlockGrantMappings.push({ defenseId: defense.id, accessGrantId: defense.unlockId });
    defense.allowedTargetPolicyIds.forEach(function (policyId, policyIndex) {
      if (!policyIds.has(policyId)) {
        fail(
          "REFERENCE_UNKNOWN",
          pointerJoin(pointerJoin(defensePath, "allowedTargetPolicyIds"), policyIndex),
          "Unknown campaign target policy"
        );
      }
    });
  });

  const eventById = new Map(source.eventCatalog.records.map(function (record) { return [record.id, record]; }));
  const eventIds = new Set(eventById.keys());
  const eventReferences = context.eventReferences.slice();
  const eventSingular = new Set([
    "applyEventId", "attackEventId", "clearGrantEventId", "consumeEventId", "contactEventId",
    "createEventId", "deploymentGrantEventId", "detonateEventId", "enterEventId", "exitEventId",
    "expireEventId", "previewEventId", "pulseEventId", "rejectedEventId", "removeEventId",
    "scanEventId", "semanticEventId", "spawnEventId",
  ]);
  const eventArrays = new Set(["eventIds", "semanticEventIds", "transitionEventIds"]);
  [
    [source.enemies, "/enemies"],
    [source.bosses, "/bosses"],
    [missions, "/missions"],
  ].forEach(function (entry) {
    walkReferences(entry[0], entry[1], eventSingular, eventArrays, eventReferences);
  });
  unlockContent.protocols.forEach(function (protocol, index) {
    walkReferences(protocol, pointerJoin("/protocols", index), eventSingular, eventArrays, eventReferences);
  });
  assertReferences(eventReferences, eventIds, "REFERENCE_UNKNOWN", "Referenced semantic event does not resolve");
  eventReferences.forEach(function (reference) {
    if (!reference.phase) return;
    const event = eventById.get(reference.id);
    if (event && event.phaseId !== reference.phase) {
      fail("EVENT_PHASE_MISMATCH", reference.path, "Semantic event does not belong to its required ABI phase");
    }
  });
  const referencedEventIds = new Set(eventReferences.map(function (reference) { return reference.id; }));
  source.eventCatalog.records.forEach(function (record, index) {
    if (!referencedEventIds.has(record.id)) {
      fail("EVENT_UNUSED", pointerJoin(pointerJoin("/eventCatalog/records", index), "id"), "Event definition is unused");
    }
  });

  const statusIds = new Set(campaignRules.statusIds);
  const statusReferences = context.statusReferences.slice();
  walkReferences(source.enemies, "/enemies", new Set(["revealStatusId", "damageExposeStatusId"]), new Set(["statusIds"]), statusReferences);
  walkReferences(source.bosses, "/bosses", new Set(["revealStatusId", "damageExposeStatusId", "statusId"]), new Set(["statusIds", "activeStatusIds"]), statusReferences);
  assertReferences(statusReferences, statusIds, "REFERENCE_UNKNOWN", "Referenced status ID does not resolve");

  const damageTypeIds = new Set(campaignRules.damageTypeIds);
  const damageReferences = context.damageTypeReferences.slice();
  [[source.enemies, "/enemies"], [source.bosses, "/bosses"]].forEach(function (entry) {
    walkReferences(entry[0], entry[1], new Set(["damageTypeId"]), new Set([]), damageReferences);
  });
  assertReferences(damageReferences, damageTypeIds, "REFERENCE_UNKNOWN", "Referenced damage type does not resolve");

  const stringKeys = new Set(stringCatalog.entries.map(function (entry) { return entry.key; }));
  const stringReferences = context.stringReferences.slice();
  const stringSingular = new Set([
    "benefitKey", "briefingKey", "descriptionKey", "drawbackKey", "nameKey", "objectiveKey",
    "progressKey", "roleKey", "summaryKey", "titleKey", "weaknessKey",
  ]);
  const stringArrays = new Set(["mechanicNoticeKeys", "routeNoticeKeys"]);
  [
    [source.enemies, "/enemies"],
    [source.bosses, "/bosses"],
    [missions, "/missions"],
    [source.unlocks.protocols, "/unlocks/protocols"],
    [source.unlocks.relics, "/unlocks/relics"],
    [source.unlocks.specializations, "/unlocks/specializations"],
    [source.unlocks.reinforcements, "/unlocks/reinforcements"],
    [source.unlocks.mechanisms, "/unlocks/mechanisms"],
  ].forEach(function (entry) {
    walkReferences(entry[0], entry[1], stringSingular, stringArrays, stringReferences);
  });
  assertReferences(stringReferences, stringKeys, "REFERENCE_UNKNOWN", "Referenced localization key does not resolve");
  const referencedStringKeys = new Set(stringReferences.map(function (reference) { return reference.id; }));
  stringCatalog.entries.forEach(function (entry, index) {
    if (!referencedStringKeys.has(entry.key)) {
      fail("STRING_UNUSED", pointerJoin(pointerJoin("/stringCatalog/entries", index), "key"), "String entry is unused");
    }
  });

  /* --- mission graph, maps, loans, mechanisms, and markers --- */
  const enemyById = new Map(enemies.records.map(function (record) { return [record.id, record]; }));
  const bossById = new Map(bosses.records.map(function (record) { return [record.id, record]; }));
  const missionCatalogIds = new Set(campaignRules.missionCatalogIds);
  const modifierById = new Map(campaignRules.campaignModifierRecords.map(function (record) {
    return [record.id, record];
  }));
  const mechanismById = new Map(unlockContent.mechanisms.map(function (record) { return [record.id, record]; }));
  const reinforcementIds = new Set(unlockContent.reinforcements.map(function (record) { return record.id; }));
  const progressionByMission = new Map(unlockContent.missionProgression.map(function (record) {
    return [record.missionId, record];
  }));

  const compiledMaps = [];
  const missionRecords = [];
  missions.forEach(function (mission, missionIndex) {
    const missionPath = "/missions/" + missionIndex;
    const sourceMission = source.missions[missionIndex];
    const manifestMission = preflight.manifest.missions[missionIndex];
    if (!sourceMission || sourceMission.id !== mission.id || !manifestMission || manifestMission.id !== mission.id) {
      fail("MISSION_SOURCE_MISMATCH", pointerJoin(missionPath, "id"), "Manifest, mission definition, and loaded map records must align by ID");
    }
    if (!missionCatalogIds.has(mission.id)) {
      fail("REFERENCE_UNKNOWN", pointerJoin(missionPath, "id"), "Mission is absent from campaign mission catalog");
    }
    mission.enemyRosterIds.forEach(function (id, index) {
      if (!enemyById.has(id)) {
        fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "enemyRosterIds"), index), "Unknown enemy roster ID");
      }
    });
    mission.bossRosterIds.forEach(function (id, index) {
      if (!bossById.has(id)) {
        fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "bossRosterIds"), index), "Unknown boss roster ID");
      }
    });
    mission.availableDefenseIds.forEach(function (id, index) {
      if (!defenseIds.has(id)) {
        fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "availableDefenseIds"), index), "Unknown available defense ID");
      }
    });
    if (mission.scoreRecord.scoreRuleId !== campaignRules.scoreRules.id) {
      fail("REFERENCE_UNKNOWN", pointerJoin(pointerJoin(missionPath, "scoreRecord"), "scoreRuleId"), "Mission score rule does not resolve");
    }
    mission.firstClearRewards.forEach(function (reward, rewardIndex) {
      const rewardPath = pointerJoin(pointerJoin(missionPath, "firstClearRewards"), rewardIndex);
      if (reward.kind === "unlock-defense" && !defenseIds.has(reward.defenseId)) {
        fail("REWARD_UNLOCK_MAPPING", pointerJoin(rewardPath, "defenseId"), "Reward defense does not resolve");
      }
      if (reward.kind === "campaign-modifier") {
        const modifier = modifierById.get(reward.campaignModifierId);
        if (!modifier || modifier.amountAether !== reward.amountAether) {
          fail("REWARD_MODIFIER_MAPPING", rewardPath, "Modifier reward must match its declared grant exactly");
        }
      }
    });
    mission.waves.forEach(function (wave, waveIndex) {
      const wavePath = pointerJoin(pointerJoin(missionPath, "waves"), waveIndex);
      let lineageBounty = 0;
      wave.groups.forEach(function (group, groupIndex) {
        const groupPath = pointerJoin(pointerJoin(wavePath, "groups"), groupIndex);
        const owner = group.spawnKind === "enemy" ? enemyById.get(group.enemyId) : bossById.get(group.bossId);
        if (!owner) fail("REFERENCE_UNKNOWN", groupPath, "Spawn group owner does not resolve");
        if (group.spawnKind === "enemy" && mission.enemyRosterIds.indexOf(group.enemyId) === -1) {
          fail("MISSION_ROSTER", pointerJoin(groupPath, "enemyId"), "Group enemy is absent from mission roster");
        }
        if (group.spawnKind === "boss" && mission.bossRosterIds.indexOf(group.bossId) === -1) {
          fail("MISSION_ROSTER", pointerJoin(groupPath, "bossId"), "Group boss is absent from mission roster");
        }
        if (group.bountyPolicy === "base-lineage") lineageBounty += group.count * owner.baseLineageBountyAether;
      });
      const envelope = wave.deploymentGrantAether + lineageBounty + wave.clearGrantAether;
      if (!Number.isSafeInteger(envelope) || envelope !== wave.baseAetherEnvelope) {
        fail("WAVE_ENVELOPE_MISMATCH", pointerJoin(wavePath, "baseAetherEnvelope"), "Strategos wave envelope does not reconcile exactly");
      }
    });

    const progression = progressionByMission.get(mission.id);
    if (!progression) {
      fail("V4_PROGRESSION_REFERENCE", pointerJoin(missionPath, "id"), "Mission is absent from the approved progression binding");
    }
    const expectedLoans = progression.loanProtocolIds;
    const actualLoans = mission.protocolLoan === null ? [] : [mission.protocolLoan.protocolId];
    if (expectedLoans.length !== actualLoans.length ||
        expectedLoans.some(function (id, index) { return id !== actualLoans[index]; })) {
      fail(
        "V4_PROTOCOL_LOAN_BINDING",
        pointerJoin(missionPath, "protocolLoan"),
        "Mission Protocol loan must equal the approved progression binding"
      );
    }

    const compiledMap = requireCompiledMap(options.normalizeAndValidateMap({
      mission: mission,
      missionIndex: missionIndex,
      manifestMission: manifestMission,
      mapSource: sourceMission.map,
      mapProofSupplement: sourceMission.mapProofSupplement,
      campaignRules: campaignRules,
      defenses: source.defenses,
    }), mission, missionIndex);
    const routeById = new Map(compiledMap.routes.map(function (route) { return [route.id, route]; }));
    mission.objectives.forEach(function (objective, objectiveIndex) {
      if (objective.kind === "mastery" && objective.predicate.kind === "no-leaks-from-routes") {
        objective.predicate.routeIds.forEach(function (routeId, routeIndex) {
          if (!routeById.has(routeId)) {
            fail(
              "MISSION_ROUTE_REFERENCE",
              pointerJoin(missionPath, "objectives") + "/" + objectiveIndex + "/predicate/routeIds/" + routeIndex,
              "Mastery route does not resolve in the compiled mission map"
            );
          }
        });
      }
    });
    mission.waves.forEach(function (wave, waveIndex) {
      wave.groups.forEach(function (group, groupIndex) {
        const route = routeById.get(group.routeId);
        const groupPath = pointerJoin(pointerJoin(pointerJoin(pointerJoin(missionPath, "waves"), waveIndex), "groups"), groupIndex);
        if (!route) fail("MISSION_ROUTE_REFERENCE", pointerJoin(groupPath, "routeId"), "Spawn group route does not resolve");
        const owner = group.spawnKind === "enemy" ? enemyById.get(group.enemyId) : bossById.get(group.bossId);
        if (owner.routeKinds.indexOf(route.kind) === -1) {
          fail("MISSION_ROUTE_KIND", pointerJoin(groupPath, "routeId"), "Spawn owner is unavailable on the referenced route kind");
        }
      });
    });
    validateMissionMechanism(mission, missionPath, compiledMap, mechanismById);
    validateReinforcementMarkers(mission, missionPath, compiledMap, reinforcementIds);

    const normalizedMission = compileValue(mission, null, "/missions/" + mission.id, new WeakSet(), false);
    normalizedMission.spawnAnalysis = analyzeSpawns(mission, missionPath);
    missionRecords.push(normalizedMission);
    compiledMaps.push(compileValue(compiledMap, null, "/maps/" + compiledMap.id, new WeakSet(), false));
  });

  /* --- normalized v4 lock tree --- */
  const specializationRecords = context.specializationRecords.map(function (entry) { return entry.record; });
  const defenseLockRecords = source.defenses.records.map(function (record) {
    const output = {};
    Object.keys(record).forEach(function (key) {
      if (key === "specializations") return;
      output[key] = record[key];
    });
    /* Branch order is [default, alternate], not ASCII: the runtime, the profile's
       SPECIALIZATIONS_BY_DEFENSE table, and the player-facing branch cards all read index 0 as
       the always-available default. Exactly one record of each kind is required. */
    const defaultBranches = record.specializations.filter(function (specialization) {
      return specialization.isDefault === true;
    });
    const alternateBranches = record.specializations.filter(function (specialization) {
      return specialization.isDefault === false;
    });
    if (defaultBranches.length !== 1 || alternateBranches.length !== 1 ||
        record.specializations.length !== 2) {
      fail(
        "V4_SPECIALIZATION_PAIR",
        pointerJoin(pointerJoin("/defenses", record.id), "specializations"),
        "Each defense declares exactly one default and one alternate specialization"
      );
    }
    output.specializationIds = [defaultBranches[0].id, alternateBranches[0].id];
    return output;
  });

  const lockTree = {
    schemaVersion: 1,
    campaignRules: compileValue(campaignRules, null, "/campaignRules", new WeakSet(), false),
    defenses: idObject(defenseLockRecords, "/defenses", false),
    specializations: idObject(specializationRecords, "/specializations", true),
    summons: idObject(source.defenses.summonRecords, "/summons", false),
    enemies: idObject(enemies.records, "/enemies", false),
    bosses: idObject(bosses.records, "/bosses", false),
    missions: idObject(missionRecords, "/missions", false),
    maps: idObject(compiledMaps, "/maps", false),
    eventCatalog: idObject(source.eventCatalog.records, "/eventCatalog", false),
  };
  canonicalBytes(lockTree);
  const semanticArrayPaths = new Set();
  collectSemanticArrayPaths(lockTree, "", null, semanticArrayPaths);

  return frozenClone({
    approvalState: approvalState,
    eventSchemaVersion: Catalog.EVENT_SCHEMA_VERSION,
    behaviorRegistryVersion: Catalog.BEHAVIOR_REGISTRY_VERSION,
    commandSchemaVersion: Catalog.COMMAND_SCHEMA_VERSION,
    replayFormatVersion: Catalog.REPLAY_FORMAT_VERSION,
    profileSchemaVersion: RuleCatalog.PROFILE_SCHEMA_VERSION,
    behaviorContracts: behaviorContracts,
    unlockContent: unlockContent,
    defenseUnlockGrantMappings: defenseUnlockGrantMappings,
    previewProofRecords: [],
    lockTree: lockTree,
    semanticArrayPaths: Array.from(semanticArrayPaths).sort(compareAscii),
  });
}

function validateBehaviorContractsV2(value, usedDeliveryKeys) {
  Records.preflight(value, "/behaviorContracts");
  Records.exactFields(value, ["schemaVersion", "contracts"], "/behaviorContracts");
  if (value.schemaVersion !== Catalog.BEHAVIOR_REGISTRY_VERSION) {
    fail("BEHAVIOR_CONTRACTS_VERSION", "/behaviorContracts/schemaVersion", "Behavior contracts must declare registry version 2");
  }
  const expected = Catalog.BEHAVIOR_CONTRACTS;
  Records.requireArray(value.contracts, "/behaviorContracts/contracts", expected.length, expected.length);
  value.contracts.forEach(function (record, index) {
    const path = pointerJoin("/behaviorContracts/contracts", index);
    Records.exactFields(record, ["id", "version"], path);
    if (record.id !== expected[index].id || record.version !== expected[index].version) {
      fail("BEHAVIOR_CONTRACTS_MISMATCH", path, "Behavior contract roster differs from the approved registry");
    }
  });
  const declared = new Set(value.contracts.map(function (record) { return record.id + "@" + record.version; }));
  usedDeliveryKeys.forEach(function (deliveryKey) {
    const contractKey = deliveryKey.slice(0, deliveryKey.indexOf("/"));
    if (!declared.has(contractKey)) {
      fail("BEHAVIOR_CONTRACTS_MISMATCH", "/behaviorContracts/contracts", "Authored behavior uses an undeclared contract " + contractKey);
    }
  });
  /* Compiled content carries the bare roster array, matching the ABI's own BEHAVIOR_CONTRACTS
     export and the v1/v3 convention, so the kernel can compare the two canonical encodings
     directly. The authored file's schemaVersion is validated above and is not re-emitted. */
  return Records.deepFrozenClone(value.contracts);
}

module.exports = Object.freeze({
  compileValue: compileValue,
  resolveV4Graph: resolveV4Graph,
  validateBehaviorContractsV2: validateBehaviorContractsV2,
});
