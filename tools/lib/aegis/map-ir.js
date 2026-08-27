"use strict";

const { fail } = require("./diagnostics.js");
const ExistingValidation = require("./map-validation.js");
const MapV2Validation = require("./map-v2-validation.js");
const RoleProofs = require("./map-role-proofs.js");
const Selection = require("./map-selection.js");

const NORMALIZED_SCHEMA_VERSION = 2;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function copyPlain(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copyPlain);
  const output = {};
  for (const key of Object.keys(value)) output[key] = copyPlain(value[key]);
  return output;
}

function stripCompiled(compiled) {
  return {
    length: compiled.length,
    subsegments: compiled.segments.map(function (segment) {
      return {
        index: segment.index,
        start: segment.start,
        length: segment.length,
        fromX: segment.fromX,
        fromY: segment.fromY,
        toX: segment.toX,
        toY: segment.toY,
        deltaX: segment.deltaX,
        deltaY: segment.deltaY,
      };
    }),
  };
}

function normalizedRoad(road) {
  return {
    widthWorldUnits: road.widthWorldUnits,
    widthMilliUnits: road.widthMilliUnits,
    halfWidthMilliUnits: road.halfWidthMilliUnits,
  };
}

function normalizedGeometryPolicy(policy) {
  return {
    roadWidthMilliUnits: policy.roadWidthMilliUnits,
    roadHalfWidthMilliUnits: policy.roadHalfWidthMilliUnits,
    ordinaryLaneClearanceMilliUnits: policy.ordinaryLaneClearanceMilliUnits,
    padSpacingMilliUnits: policy.padSpacingMilliUnits,
    boardInsetMilliUnits: policy.boardInsetMilliUnits,
    anchorClearanceMilliUnits: policy.anchorClearanceMilliUnits,
    minimumOrdinaryExposureMilliUnits: policy.minimumOrdinaryExposureMilliUnits,
  };
}

function normalizedPad(pad, selectionOrder) {
  return {
    id: pad.id,
    kind: pad.kind,
    column: pad.column,
    row: pad.row,
    x: pad.x,
    y: pad.y,
    intent: pad.intent,
    declaredQuality: pad.declaredQuality,
    claimedRouteIds: pad.claimedRouteIds.slice(),
    selectionOrder: selectionOrder,
  };
}

function normalizedProbe(probe) {
  return {
    id: probe.id,
    rangeMilliUnits: probe.rangeMilliUnits,
    targetKinds: probe.targetKinds.slice(),
    routeIds: probe.routeIds.slice(),
    baselineMilliUnits: probe.baselineMilliUnits,
  };
}

function normalizedExclusion(exclusion) {
  return {
    id: exclusion.id,
    kind: exclusion.kind,
    column: exclusion.column,
    row: exclusion.row,
    x: exclusion.x,
    y: exclusion.y,
    radiusMilliUnits: exclusion.radiusMilliUnits,
  };
}

function analysisRecord(routeLocalAnalysis, padClearances, intentProofChecks, stageCheck) {
  return {
    coverage: copyPlain(routeLocalAnalysis.coverage),
    padClearances: copyPlain(padClearances),
    padChecks: copyPlain(routeLocalAnalysis.padChecks),
    spreadCheck: copyPlain(routeLocalAnalysis.spreadCheck),
    selectionOrderCheck: copyPlain(routeLocalAnalysis.selectionOrderCheck),
    routeProvenance: copyPlain(routeLocalAnalysis.routeProvenance),
    intentProofChecks: copyPlain(intentProofChecks),
    routeStageOrderCheck: copyPlain(stageCheck),
  };
}

function derivedRouteStageOrderCheck(map, routeLocalAnalysis) {
  const unavailable = {
    probeId: map.review.qualityProbeId,
    routeId: null,
    applicable: false,
    stages: [],
    pass: true,
  };
  if (map.routes.length !== 1) return unavailable;
  const routeId = map.routes[0].id;
  if (map.pads.some(function (pad, index) {
    return pad.selectionOrder !== index || pad.claimedRouteIds.length !== 1 || pad.claimedRouteIds[0] !== routeId;
  })) return unavailable;
  const selectionByPadId = new Map(routeLocalAnalysis.selectionOrderCheck.records.map(function (record) {
    return [record.padId, record];
  }));
  return {
    probeId: map.review.qualityProbeId,
    routeId: routeId,
    applicable: true,
    stages: map.pads.map(function (pad) {
      return { id: pad.id, meanStageBp: selectionByPadId.get(pad.id).selectionStageBp };
    }),
    pass: true,
  };
}

function normalizeMapV1(source) {
  const validated = ExistingValidation.validateMissionMap(source);
  const lanes = validated.routes.map(function (route) {
    const laneId = "lane.migrated." + route.id;
    if (laneId.length > 64) fail("MAP_STABLE_ID", "/routes/" + route.id, "Migrated lane ID exceeds 64 characters");
    return {
      id: laneId,
      kind: route.kind,
      layerId: route.layerId,
      nodes: copyPlain(route.nodes),
      compiled: stripCompiled(route.route),
      routeIds: [route.id],
    };
  });
  const laneByRouteId = new Map(validated.routes.map(function (route, index) { return [route.id, lanes[index]]; }));
  const routes = validated.routes.map(function (route) {
    const lane = laneByRouteId.get(route.id);
    const entry = validated.anchors.find(function (anchor) {
      return anchor.routeId === route.id && (anchor.kind === "entry" || anchor.kind === "breach");
    });
    const gate = validated.anchors.find(function (anchor) { return anchor.routeId === route.id && anchor.kind === "gate"; });
    if (!entry || !gate) fail("MAP_ROUTE_ENDPOINT", "/routes/" + route.id, "Validated v1 route lacks one entry/breach and gate");
    return {
      id: route.id,
      kind: route.kind,
      laneSegmentIds: [lane.id],
      entryAnchorId: entry.id,
      gateAnchorId: gate.id,
      length: route.route.length,
      segmentOffsets: [{
        laneSegmentId: lane.id,
        routeOffset: 0,
        laneLength: route.route.length,
        remainingDistanceAtStart: route.route.length,
        remainingDistanceAtEnd: 0,
      }],
    };
  });
  const anchors = validated.anchors.map(function (anchor) {
    const base = {
      id: anchor.id,
      kind: anchor.kind,
      column: anchor.column,
      row: anchor.row,
      x: anchor.x,
      y: anchor.y,
    };
    if (anchor.routeId !== null) {
      base.laneSegmentId = laneByRouteId.get(anchor.routeId).id;
      base.routeIds = [anchor.routeId];
    }
    return base;
  });
  const crossings = validated.crossings.map(function (crossing) {
    const output = {
      id: crossing.id,
      kind: crossing.kind,
      laneAId: laneByRouteId.get(crossing.routeAId).id,
      subsegmentAIndex: crossing.segmentAIndex,
      laneBId: laneByRouteId.get(crossing.routeBId).id,
      subsegmentBIndex: crossing.segmentBIndex,
    };
    if (crossing.upperLayerId !== null) output.upperLayerId = crossing.upperLayerId;
    return output;
  });
  const pads = validated.pads.map(function (pad, index) { return normalizedPad(pad, index); });
  const probes = validated.probes.map(normalizedProbe);
  const road = normalizedRoad(validated.road);
  const review = {
    entryProbeId: validated.review.entryProbeId,
    qualityProbeId: validated.review.qualityProbeId,
    minimumEntryExposureMilliUnits: validated.review.minimumEntryExposureMilliUnits,
    maximumSpread: copyPlain(validated.review.maximumSpread),
    selectionOrderPolicy: "route-stage-route-id-pad-id",
  };
  const padClearances = validated.padChecks.map(function (check) {
    return {
      id: check.id,
      boardInsetMilliUnits: check.clearance.boardInsetMilliUnits,
      minimumLaneClearanceMilliUnits: check.clearance.minimumLaneClearanceMilliUnits,
      minimumPadSpacingMilliUnits: check.clearance.minimumPadSpacingMilliUnits,
      minimumDeclaredClearanceMilliUnits: check.clearance.minimumDeclaredClearanceMilliUnits,
    };
  });
  const routeLocalAnalysis = Selection.analyzeRouteLocalMap({
    laneSegments: lanes,
    routes: routes,
    pads: pads,
    probes: probes,
    review: review,
    road: road,
  });
  return deepFreeze({
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    id: validated.id,
    sourceKind: "campaign",
    geometryPolicy: normalizedGeometryPolicy(validated.geometryPolicy),
    board: copyPlain(validated.board),
    road: road,
    laneSegments: lanes,
    routes: routes,
    joins: [],
    crossings: crossings,
    pads: pads,
    anchors: anchors,
    exclusions: validated.exclusions.map(normalizedExclusion),
    probes: probes,
    roleProofs: [],
    review: review,
    analysis: analysisRecord(routeLocalAnalysis, padClearances, [], validated.routeStageOrderCheck),
  });
}

function normalizeMapV2(source, options) {
  const validated = MapV2Validation.validateMapV2(source, options);
  const lanes = validated.laneSegments.map(function (lane) {
    return {
      id: lane.id,
      kind: lane.kind,
      layerId: lane.layerId,
      nodes: copyPlain(lane.nodes),
      compiled: stripCompiled(lane.compiled),
      routeIds: lane.routeIds.slice(),
    };
  });
  const routes = validated.routes.map(function (route) {
    return {
      id: route.id,
      kind: route.kind,
      laneSegmentIds: route.laneSegmentIds.slice(),
      entryAnchorId: route.entryAnchorId,
      gateAnchorId: route.gateAnchorId,
      length: route.length,
      segmentOffsets: copyPlain(route.segmentOffsets),
    };
  });
  const pads = validated.pads.map(function (pad) { return normalizedPad(pad, pad.selectionOrder); });
  const probes = validated.probes.map(normalizedProbe);
  const routeStageOrderCheck = derivedRouteStageOrderCheck(validated, validated.analysis);
  return deepFreeze({
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    id: validated.id,
    sourceKind: "campaign",
    geometryPolicy: copyPlain(validated.geometryPolicy),
    board: copyPlain(validated.board),
    road: normalizedRoad(validated.road),
    laneSegments: lanes,
    routes: routes,
    joins: copyPlain(validated.joins),
    crossings: copyPlain(validated.crossings),
    pads: pads,
    anchors: copyPlain(validated.anchors),
    exclusions: validated.exclusions.map(normalizedExclusion),
    probes: probes,
    roleProofs: copyPlain(validated.roleProofs),
    review: copyPlain(validated.review),
    analysis: analysisRecord(validated.analysis, validated.padClearances, validated.intentProofChecks, routeStageOrderCheck),
  });
}

function normalizeMap(source, options) {
  if (!source || typeof source !== "object" || Array.isArray(source)) fail("MAP_OBJECT", "/", "Map source must be an object");
  if (source.schemaVersion === 1) return normalizeMapV1(source);
  if (source.schemaVersion === 2) return normalizeMapV2(source, options);
  fail("MAP_SCHEMA_VERSION", "/schemaVersion", "Normalized maps support source schema 1 or 2");
}

function normalizeMapForV3(source, options) {
  if (!source || typeof source !== "object" || Array.isArray(source)) fail("MAP_OBJECT", "/", "Map source must be an object");
  const settings = options && typeof options === "object" ? options : {};
  const hasSupplement = Object.prototype.hasOwnProperty.call(settings, "mapProofSupplement");
  if (source.schemaVersion === 1) {
    if (!hasSupplement) fail("MAP_PROOF_SUPPLEMENT_REQUIRED", "/mapProofSupplement", "A schema-v1 map in source schema v3 requires one proof supplement");
    const normalized = normalizeMapV1(source);
    const proofSet = RoleProofs.validateMapProofSupplement(settings.mapProofSupplement, normalized, settings.roleProofContext);
    const output = copyPlain(normalized);
    output.roleProofs = copyPlain(proofSet.roleProofs);
    output.analysis.intentProofChecks = copyPlain(proofSet.intentProofChecks);
    return deepFreeze(output);
  }
  if (source.schemaVersion === 2) {
    if (hasSupplement) fail("MAP_PROOF_SUPPLEMENT_FORBIDDEN", "/mapProofSupplement", "Map-v2 authors role proofs directly and forbids a supplement");
    return normalizeMapV2(source, { roleProofContext: settings.roleProofContext });
  }
  fail("MAP_SCHEMA_VERSION", "/schemaVersion", "Source schema v3 maps support map schema 1 or 2");
}

function routePosition(ir, routeId, laneSegmentId, laneOffset) {
  if (!ir || ir.schemaVersion !== NORMALIZED_SCHEMA_VERSION || !Array.isArray(ir.routes)) {
    fail("MAP_IR", "/", "routePosition requires a normalized map-v2 IR");
  }
  if (typeof routeId !== "string" || typeof laneSegmentId !== "string") fail("MAP_ROUTE_REFERENCE", "/", "Route and lane IDs must be strings");
  if (!Number.isSafeInteger(laneOffset) || Object.is(laneOffset, -0) || laneOffset < 0) {
    fail("MAP_ROUTE_OFFSET", "/laneOffset", "Lane offset must be a nonnegative safe integer");
  }
  const route = ir.routes.find(function (item) { return item.id === routeId; });
  if (!route) fail("MAP_ROUTE_REFERENCE", "/routeId", "Unknown route ID " + routeId);
  const offset = route.segmentOffsets.find(function (item) { return item.laneSegmentId === laneSegmentId; });
  if (!offset) fail("MAP_LANE_REFERENCE", "/laneSegmentId", "Route does not traverse lane " + laneSegmentId);
  if (!Number.isSafeInteger(offset.routeOffset) || !Number.isSafeInteger(offset.laneLength) ||
      !Number.isSafeInteger(offset.remainingDistanceAtStart) || offset.routeOffset < 0 ||
      offset.laneLength <= 0 || offset.remainingDistanceAtStart < offset.laneLength) {
    fail("MAP_IR", "/routes/" + routeId + "/segmentOffsets", "Route segment offsets must be safe normalized integers");
  }
  if (laneOffset > offset.laneLength) fail("MAP_ROUTE_OFFSET", "/laneOffset", "Lane offset exceeds the physical lane length");
  const routeDistance = BigInt(offset.routeOffset) + BigInt(laneOffset);
  const remainingDistance = BigInt(offset.remainingDistanceAtStart) - BigInt(laneOffset);
  if (routeDistance > BigInt(Number.MAX_SAFE_INTEGER) || remainingDistance > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail("MAP_ROUTE_OFFSET", "/laneOffset", "Route position exceeds the safe-integer range");
  }
  return deepFreeze({
    routeId: routeId,
    laneSegmentId: laneSegmentId,
    laneOffset: laneOffset,
    routeDistance: Number(routeDistance),
    remainingDistance: Number(remainingDistance),
  });
}

module.exports = Object.freeze({
  normalizeMap: normalizeMap,
  normalizeMapV1: normalizeMapV1,
  normalizeMapV2: normalizeMapV2,
  normalizeMapForV3: normalizeMapForV3,
  routePosition: routePosition,
});
