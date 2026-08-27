"use strict";

const { fail } = require("./diagnostics.js");
const Geometry = require("./map-geometry.js");
const Selection = require("./map-selection.js");

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
const ANALYSIS_SCALE_BIG = BigInt(Geometry.ANALYSIS_SUBUNITS_PER_MILLI);
const GUARD_ROUTE_SPACING = 8000;

function asciiCompare(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

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

function inspectPlainTree(value, path, seen, depth) {
  if (depth > 32) fail("MAP_LIMIT", path, "Role-proof nesting depth exceeds 32");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail("MAP_SAFE_INTEGER", path, "Role-proof numbers must be safe integers");
    return;
  }
  if (!value || typeof value !== "object") fail("MAP_PLAIN_DATA", path, "Role proofs must contain only plain JSON data");
  if (seen.has(value)) fail("MAP_SHARED_REFERENCE", path, "Role proofs cannot contain cycles or shared references");
  seen.add(value);
  if (!Array.isArray(value) && !isPlainObject(value)) fail("MAP_OBJECT", path, "Role-proof objects must have a plain prototype");
  if (Object.getOwnPropertySymbols(value).length !== 0) fail("MAP_PLAIN_DATA", path, "Role proofs cannot contain symbol properties");
  const names = Object.getOwnPropertyNames(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) fail("MAP_PLAIN_DATA", path + "/" + index, "Role-proof arrays cannot be sparse");
      inspectPlainTree(value[index], path + "/" + index, seen, depth + 1);
    }
    for (const name of names) {
      if (name !== "length" && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length)) {
        fail("MAP_PLAIN_DATA", path + "/" + name, "Role-proof arrays cannot have extra properties");
      }
    }
    return;
  }
  if (names.length > 64) fail("MAP_LIMIT", path, "Role-proof object field count exceeds 64");
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      fail("MAP_PLAIN_DATA", path + "/" + name, "Role-proof fields must be enumerable data properties");
    }
    inspectPlainTree(value[name], (path === "/" ? "" : path) + "/" + name, seen, depth + 1);
  }
}

function exactKeys(value, allowed, required, path, label) {
  if (!isPlainObject(value)) fail("MAP_OBJECT", path, label + " must be a plain object");
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) fail("MAP_UNKNOWN_KEY", (path === "/" ? "" : path) + "/" + key, "Unknown " + label + " key " + key);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("MAP_MISSING_KEY", (path === "/" ? "" : path) + "/" + key, label + " requires " + key);
    }
  }
}

function stableId(value, path, label) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) fail("MAP_STABLE_ID", path, label + " must be a stable ASCII ID");
  return value;
}

function safeInteger(value, path, label) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail("MAP_SAFE_INTEGER", path, label + " must be a safe integer");
  return value;
}

function nonnegativeInteger(value, path, label) {
  safeInteger(value, path, label);
  if (value < 0) fail("MAP_NONNEGATIVE", path, label + " must be nonnegative");
  return value;
}

function positiveInteger(value, path, label) {
  nonnegativeInteger(value, path, label);
  if (value === 0) fail("MAP_POSITIVE", path, label + " must be positive");
  return value;
}

function worldRange(value, path, label) {
  const output = positiveInteger(value, path, label);
  if (output > 1000000) fail("MAP_LIMIT", path, label + " exceeds the map-authored range bound");
  return output;
}

function multiplySafe(value, factor, path, label) {
  const result = BigInt(value) * BigInt(factor);
  if (result > MAX_SAFE_BIG) fail("MAP_SAFE_INTEGER", path, label + " exceeds the safe-integer range");
  return Number(result);
}

function checkedNumber(value, path, label) {
  if (value > MAX_SAFE_BIG || value < -MAX_SAFE_BIG) fail("MAP_SAFE_INTEGER", path, label + " exceeds the safe-integer range");
  return Number(value);
}

function idArray(value, path, label, allowEmpty) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail("MAP_ARRAY", path, label + " must be " + (allowEmpty ? "an array" : "a nonempty array"));
  }
  const output = value.map(function (item, index) { return stableId(item, path + "/" + index, label + " item"); });
  for (let index = 1; index < output.length; index++) {
    if (asciiCompare(output[index - 1], output[index]) >= 0) {
      fail("MAP_UNSTABLE_ORDER", path + "/" + index, label + " must be unique and strict ASCII sorted");
    }
  }
  return output;
}

function sameIds(left, right) {
  return left.length === right.length && left.every(function (id, index) { return id === right[index]; });
}

function validateContext(value) {
  if (!isPlainObject(value)) fail("ROLE_PROOF_CONTEXT", "/roleProofContext", "Role-proof compilation requires resolved records");
  const projectionRangeWorldUnits = worldRange(value.projectionRangeWorldUnits, "/roleProofContext/projectionRangeWorldUnits", "Resolved Hoplite projection range");
  const slotComparatorId = stableId(value.slotComparatorId, "/roleProofContext/slotComparatorId", "Resolved slot comparator ID");
  const contactComparatorId = stableId(value.contactComparatorId, "/roleProofContext/contactComparatorId", "Resolved contact comparator ID");
  const closedComparatorIds = idArray(value.closedComparatorIds, "/roleProofContext/closedComparatorIds", "Closed comparator IDs", false);
  if (!closedComparatorIds.includes(slotComparatorId) || !closedComparatorIds.includes(contactComparatorId)) {
    fail("ROLE_PROOF_COMPARATOR_REFERENCE", "/roleProofContext", "Guard comparators must resolve through the injected closed catalog");
  }
  const eligibleDefenseTagIds = idArray(value.eligibleDefenseTagIds, "/roleProofContext/eligibleDefenseTagIds", "Eligible defense tag IDs", true);
  if (typeof value.requireGuardProofs !== "boolean") {
    fail("ROLE_PROOF_CONTEXT", "/roleProofContext/requireGuardProofs", "Guard-proof requirement must be Boolean");
  }
  return {
    projectionRangeWorldUnits: projectionRangeWorldUnits,
    projectionRangeMilliUnits: multiplySafe(projectionRangeWorldUnits, 1000, "/roleProofContext/projectionRangeWorldUnits", "Resolved projection range"),
    slotComparatorId: slotComparatorId,
    contactComparatorId: contactComparatorId,
    closedComparatorIds: closedComparatorIds,
    eligibleDefenseTagIds: eligibleDefenseTagIds,
    requireGuardProofs: value.requireGuardProofs,
  };
}

function laneSegments(lane) {
  const segments = lane && lane.compiled && (lane.compiled.segments || lane.compiled.subsegments);
  if (!Array.isArray(segments) || segments.length === 0) fail("MAP_IR", "/laneSegments/" + (lane && lane.id), "Compiled lane subsegments are required");
  return segments;
}

function routePosition(map, routeId, laneSegmentId, laneOffset, path) {
  const route = map.routes.find(function (item) { return item.id === routeId; });
  if (!route) fail("MAP_ROUTE_REFERENCE", path, "Unknown route " + routeId);
  const offset = route.segmentOffsets.find(function (item) { return item.laneSegmentId === laneSegmentId; });
  if (!offset) fail("MAP_LANE_REFERENCE", path, "Route " + routeId + " does not traverse lane " + laneSegmentId);
  if (laneOffset > offset.laneLength) fail("GUARD_MARKER_OFFSET", path, "Marker offset exceeds lane length");
  return {
    routeId: routeId,
    routeDistance: offset.routeOffset + laneOffset,
    remainingDistance: offset.remainingDistanceAtStart - laneOffset,
  };
}

function segmentAtOffset(lane, laneOffset, path) {
  const segments = laneSegments(lane);
  if (laneOffset === 0) return { segment: segments[0], localOffset: 0 };
  for (const segment of segments) {
    const end = segment.start + segment.length;
    if (laneOffset > segment.start && laneOffset <= end) {
      return { segment: segment, localOffset: laneOffset - segment.start };
    }
  }
  fail("GUARD_MARKER_OFFSET", path, "Marker offset does not resolve to an incoming physical subsegment");
}

function interpolateMarker(lane, laneOffset, path) {
  const located = segmentAtOffset(lane, laneOffset, path);
  const segment = located.segment;
  const length = BigInt(segment.length);
  const local = BigInt(located.localOffset);
  return {
    x: checkedNumber(BigInt(segment.fromX) + local * BigInt(segment.deltaX) / length, path, "Marker x"),
    y: checkedNumber(BigInt(segment.fromY) + local * BigInt(segment.deltaY) / length, path, "Marker y"),
    tangentX: segment.deltaX,
    tangentY: segment.deltaY,
  };
}

function validateMarker(source, markerIndex, proofPath, pad, map, context) {
  const path = proofPath + "/markers/" + markerIndex;
  exactKeys(source, ["id", "slotIndex", "laneSegmentId", "laneOffsetMilliUnits", "routeIds"],
    ["id", "slotIndex", "laneSegmentId", "laneOffsetMilliUnits", "routeIds"], path, "guard marker");
  const id = stableId(source.id, path + "/id", "Guard marker ID");
  const slotIndex = nonnegativeInteger(source.slotIndex, path + "/slotIndex", "Guard slot index");
  if (slotIndex > 2) fail("GUARD_MARKER_SLOTS", path + "/slotIndex", "Guard marker slotIndex must be 0, 1, or 2");
  const laneSegmentId = stableId(source.laneSegmentId, path + "/laneSegmentId", "Guard lane ID");
  const lane = map.laneSegments.find(function (item) { return item.id === laneSegmentId; });
  if (!lane) fail("MAP_LANE_REFERENCE", path + "/laneSegmentId", "Unknown guard lane " + laneSegmentId);
  if (lane.kind !== "ground") fail("GUARD_MARKER_GROUND", path + "/laneSegmentId", "Guard markers require a ground lane");
  const laneOffset = nonnegativeInteger(source.laneOffsetMilliUnits, path + "/laneOffsetMilliUnits", "Guard lane offset");
  if (laneOffset > lane.compiled.length) fail("GUARD_MARKER_OFFSET", path + "/laneOffsetMilliUnits", "Guard lane offset exceeds the compiled lane");
  const routeIds = idArray(source.routeIds, path + "/routeIds", "Guard marker route IDs", false);
  if (!sameIds(routeIds, lane.routeIds)) {
    fail("GUARD_MARKER_ROUTES", path + "/routeIds", "Guard marker route IDs must equal every route traversing its physical lane");
  }
  if (!routeIds.some(function (routeId) { return pad.claimedRouteIds.includes(routeId); })) {
    fail("GUARD_MARKER_CLAIM", path + "/routeIds", "Guard marker must lie on a lane traversed by a claimed route");
  }
  const point = interpolateMarker(lane, laneOffset, path);
  const dx = BigInt(point.x) - BigInt(pad.x);
  const dy = BigInt(point.y) - BigInt(pad.y);
  if (dx * dx + dy * dy > BigInt(context.projectionRangeMilliUnits) ** 2n) {
    fail("GUARD_MARKER_RANGE", path, "Guard marker exceeds the resolved Hoplite squared projection range");
  }
  const routeDistances = routeIds.map(function (routeId) {
    return routePosition(map, routeId, laneSegmentId, laneOffset, path + "/routeIds");
  }).sort(function (left, right) { return asciiCompare(left.routeId, right.routeId); });
  for (const record of routeDistances) {
    const route = map.routes.find(function (item) { return item.id === record.routeId; });
    if (record.routeDistance + record.remainingDistance !== route.length) {
      fail("GUARD_MARKER_ROUTE_DISTANCE", path, "Guard marker route distance does not complement remaining distance");
    }
  }
  return {
    id: id,
    slotIndex: slotIndex,
    padId: pad.id,
    laneSegmentId: laneSegmentId,
    laneOffset: laneOffset,
    x: point.x,
    y: point.y,
    tangentX: point.tangentX,
    tangentY: point.tangentY,
    routeDistances: routeDistances,
  };
}

function guardIntentPass(pad, markers, map, context) {
  const coveredClaims = new Set();
  for (const marker of markers) {
    for (const distance of marker.routeDistances) {
      if (pad.claimedRouteIds.includes(distance.routeId)) coveredClaims.add(distance.routeId);
    }
  }
  if (coveredClaims.size >= 2) return true;
  for (const routeId of pad.claimedRouteIds) {
    const routes = Selection.analyzePadRange(map, pad, context.projectionRangeMilliUnits, [routeId]);
    const route = routes[0];
    const windowIndexes = new Set();
    for (const marker of markers) {
      const distance = marker.routeDistances.find(function (item) { return item.routeId === routeId; });
      if (!distance) continue;
      const progress = BigInt(distance.routeDistance) * ANALYSIS_SCALE_BIG;
      for (let index = 0; index < route.windows.length; index++) {
        const window = route.windows[index];
        if (progress >= BigInt(window.startSubunits) && progress <= BigInt(window.endSubunits)) windowIndexes.add(index);
      }
    }
    if (windowIndexes.size >= 2) return true;
  }
  return false;
}

function compileGuard(source, proofPath, pad, map, context) {
  exactKeys(source, ["id", "kind", "version", "padId", "projectionRangeWorldUnits", "markers"],
    ["id", "kind", "version", "padId", "projectionRangeWorldUnits", "markers"], proofPath, "guard proof");
  const projectionRange = worldRange(source.projectionRangeWorldUnits, proofPath + "/projectionRangeWorldUnits", "Guard projection range");
  if (projectionRange !== context.projectionRangeWorldUnits) {
    fail("GUARD_PROJECTION_RANGE", proofPath + "/projectionRangeWorldUnits", "Guard projection range must equal the injected resolved Hoplite range");
  }
  if (!Array.isArray(source.markers) || source.markers.length !== 3) {
    fail("GUARD_MARKER_SLOTS", proofPath + "/markers", "Guard proof requires exactly three marker slots");
  }
  const markers = source.markers.map(function (marker, index) {
    return validateMarker(marker, index, proofPath, pad, map, context);
  }).sort(function (left, right) { return left.slotIndex - right.slotIndex; });
  if (new Set(markers.map(function (marker) { return marker.slotIndex; })).size !== 3) {
    fail("GUARD_MARKER_SLOTS", proofPath + "/markers", "Guard proof must contain slots 0, 1, and 2 exactly once");
  }
  if (new Set(markers.map(function (marker) { return marker.id; })).size !== markers.length) {
    fail("MAP_DUPLICATE_ID", proofPath + "/markers", "Guard marker IDs must be unique");
  }
  const points = new Set();
  for (const marker of markers) {
    const point = marker.x + "," + marker.y;
    if (points.has(point)) fail("GUARD_MARKER_POINT", proofPath + "/markers", "Guard slots must use distinct physical points");
    points.add(point);
  }
  for (const route of map.routes) {
    const distances = [];
    for (const marker of markers) {
      const record = marker.routeDistances.find(function (item) { return item.routeId === route.id; });
      if (record) distances.push({ markerId: marker.id, distance: record.routeDistance });
    }
    distances.sort(function (left, right) { return left.distance - right.distance || asciiCompare(left.markerId, right.markerId); });
    for (let index = 1; index < distances.length; index++) {
      if (distances[index].distance - distances[index - 1].distance < GUARD_ROUTE_SPACING) {
        fail("GUARD_MARKER_SPACING", proofPath + "/markers", "Markers on one route must be at least 8000 distance units apart");
      }
    }
  }
  for (const routeId of pad.claimedRouteIds) {
    if (!markers.some(function (marker) { return marker.routeDistances.some(function (record) { return record.routeId === routeId; }); })) {
      fail("GUARD_MARKER_COVERAGE", proofPath + "/markers", "Every claimed route requires a guard marker");
    }
  }
  if (pad.intent === "guard" && !guardIntentPass(pad, markers, map, context)) {
    fail("GUARD_INTENT_PROOF", proofPath, "Guard intent requires two claimed routes or two disconnected projection windows");
  }
  return {
    id: source.id,
    kind: "guard",
    version: 1,
    padId: pad.id,
    projectionRangeMilliUnits: context.projectionRangeMilliUnits,
    slotComparatorId: context.slotComparatorId,
    contactComparatorId: context.contactComparatorId,
    markers: markers,
  };
}

function compileRouteStatus(source, proofPath, pad, map) {
  exactKeys(source, ["id", "kind", "version", "padId", "rangeWorldUnits", "routeProofRecords"],
    ["id", "kind", "version", "padId", "rangeWorldUnits", "routeProofRecords"], proofPath, "support route-status proof");
  const rangeWorldUnits = worldRange(source.rangeWorldUnits, proofPath + "/rangeWorldUnits", "Support range");
  const rangeMilliUnits = multiplySafe(rangeWorldUnits, 1000, proofPath + "/rangeWorldUnits", "Support range");
  if (!Array.isArray(source.routeProofRecords) || source.routeProofRecords.length === 0) {
    fail("MAP_ARRAY", proofPath + "/routeProofRecords", "Route-status proof records must be nonempty");
  }
  const authored = source.routeProofRecords.map(function (record, index) {
    const path = proofPath + "/routeProofRecords/" + index;
    exactKeys(record, ["routeId", "minimumExposureMilliUnits", "expectedCoverageWindowCount"],
      ["routeId", "minimumExposureMilliUnits", "expectedCoverageWindowCount"], path, "route-status record");
    return {
      routeId: stableId(record.routeId, path + "/routeId", "Route-status route ID"),
      minimumExposureMilliUnits: positiveInteger(record.minimumExposureMilliUnits, path + "/minimumExposureMilliUnits", "Minimum support exposure"),
      expectedCoverageWindowCount: positiveInteger(record.expectedCoverageWindowCount, path + "/expectedCoverageWindowCount", "Expected support window count"),
    };
  });
  for (let index = 1; index < authored.length; index++) {
    if (asciiCompare(authored[index - 1].routeId, authored[index].routeId) >= 0) {
      fail("MAP_UNSTABLE_ORDER", proofPath + "/routeProofRecords/" + index + "/routeId", "Route proof records must be unique and ASCII sorted");
    }
  }
  if (!sameIds(authored.map(function (record) { return record.routeId; }), pad.claimedRouteIds)) {
    fail("ROLE_PROOF_ROUTE_COVERAGE", proofPath + "/routeProofRecords", "Route-status proof must cover every claimed route exactly once");
  }
  const actual = Selection.analyzePadRange(map, pad, rangeMilliUnits, pad.claimedRouteIds);
  const records = authored.map(function (record, index) {
    const route = actual.find(function (item) { return item.routeId === record.routeId; });
    if (!route) fail("MAP_ROUTE_REFERENCE", proofPath + "/routeProofRecords/" + index, "Unknown support route " + record.routeId);
    if (BigInt(route.exposureSubunits) < BigInt(record.minimumExposureMilliUnits) * ANALYSIS_SCALE_BIG) {
      fail("ROLE_PROOF_EXPOSURE", proofPath + "/routeProofRecords/" + index, "Support route exposure is below its authored minimum");
    }
    if (route.windows.length !== record.expectedCoverageWindowCount) {
      fail("ROLE_PROOF_WINDOWS", proofPath + "/routeProofRecords/" + index, "Support coverage-window count differs from authored proof");
    }
    return {
      routeId: record.routeId,
      minimumExposureMilliUnits: record.minimumExposureMilliUnits,
      expectedCoverageWindowCount: record.expectedCoverageWindowCount,
    };
  });
  return {
    id: source.id,
    kind: "support",
    version: 1,
    padId: pad.id,
    mode: "route-status",
    rangeMilliUnits: rangeMilliUnits,
    routeProofRecords: records,
  };
}

function compileFriendlyNeighbor(source, proofPath, pad, map, context) {
  exactKeys(source, ["id", "kind", "version", "padId", "rangeWorldUnits", "eligibleDefenseTagIds", "expectedNeighborPadIds", "minimumEligibleNeighborCount"],
    ["id", "kind", "version", "padId", "rangeWorldUnits", "eligibleDefenseTagIds", "expectedNeighborPadIds", "minimumEligibleNeighborCount"],
    proofPath, "support friendly-neighbor proof");
  const rangeWorldUnits = worldRange(source.rangeWorldUnits, proofPath + "/rangeWorldUnits", "Neighbor range");
  const rangeMilliUnits = multiplySafe(rangeWorldUnits, 1000, proofPath + "/rangeWorldUnits", "Neighbor range");
  const eligibleDefenseTagIds = idArray(source.eligibleDefenseTagIds, proofPath + "/eligibleDefenseTagIds", "Eligible defense tag IDs", false);
  for (let index = 0; index < eligibleDefenseTagIds.length; index++) {
    if (!context.eligibleDefenseTagIds.includes(eligibleDefenseTagIds[index])) {
      fail("ROLE_PROOF_TAG_REFERENCE", proofPath + "/eligibleDefenseTagIds/" + index, "Support tag is absent from the injected defense-tag catalog");
    }
  }
  const expectedNeighborPadIds = idArray(source.expectedNeighborPadIds, proofPath + "/expectedNeighborPadIds", "Expected neighbor pad IDs", true);
  const minimum = positiveInteger(source.minimumEligibleNeighborCount, proofPath + "/minimumEligibleNeighborCount", "Minimum eligible neighbor count");
  const rangeSquared = BigInt(rangeMilliUnits) ** 2n;
  const actual = map.pads.filter(function (candidate) {
    if (candidate.id === pad.id) return false;
    const dx = BigInt(candidate.x) - BigInt(pad.x);
    const dy = BigInt(candidate.y) - BigInt(pad.y);
    return dx * dx + dy * dy <= rangeSquared;
  }).map(function (candidate) { return candidate.id; }).sort(asciiCompare);
  if (!sameIds(actual, expectedNeighborPadIds)) {
    fail("ROLE_PROOF_NEIGHBORS", proofPath + "/expectedNeighborPadIds", "Expected neighbor pads must equal the exact squared-distance graph");
  }
  if (actual.length < minimum) {
    fail("ROLE_PROOF_NEIGHBOR_COUNT", proofPath + "/minimumEligibleNeighborCount", "Neighbor graph does not meet its authored minimum");
  }
  return {
    id: source.id,
    kind: "support",
    version: 1,
    padId: pad.id,
    mode: "friendly-neighbor",
    rangeMilliUnits: rangeMilliUnits,
    eligibleDefenseTagIds: eligibleDefenseTagIds,
    expectedNeighborPadIds: expectedNeighborPadIds,
    minimumEligibleNeighborCount: minimum,
  };
}

function compileSupport(source, proofPath, pad, map, context) {
  if (Object.prototype.hasOwnProperty.call(source, "routeProofRecords")) return compileRouteStatus(source, proofPath, pad, map);
  if (Object.prototype.hasOwnProperty.call(source, "eligibleDefenseTagIds") ||
      Object.prototype.hasOwnProperty.call(source, "expectedNeighborPadIds") ||
      Object.prototype.hasOwnProperty.call(source, "minimumEligibleNeighborCount")) {
    return compileFriendlyNeighbor(source, proofPath, pad, map, context);
  }
  fail("ROLE_PROOF_UNIMPLEMENTED", proofPath, "Support@1 proof fields do not identify an implemented strict mode");
}

function compileRoleProofSet(map, sources, contextSource) {
  if (!Array.isArray(sources)) fail("MAP_ARRAY", "/roleProofs", "roleProofs must be an array");
  inspectPlainTree(sources, "/roleProofs", new WeakSet(), 0);
  if (sources.length > 256) fail("MAP_LIMIT", "/roleProofs", "Role-proof count exceeds 256");
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    if (!isPlainObject(source)) fail("MAP_OBJECT", "/roleProofs/" + index, "Role proof must be a plain object");
    if ((source.kind !== "support" && source.kind !== "guard") || source.version !== 1) {
      fail("ROLE_PROOF_UNIMPLEMENTED", "/roleProofs/" + index, "Only support@1 and guard@1 role proofs are implemented");
    }
  }
  const needsContext = sources.length !== 0 || map.pads.some(function (pad) { return pad.intent === "support" || pad.intent === "guard"; });
  const context = needsContext || contextSource ? validateContext(contextSource) : null;
  const padById = new Map(map.pads.map(function (pad) { return [pad.id, pad]; }));
  const compiled = [];
  const supportByPad = new Map();
  const guardByPad = new Map();
  let priorId = null;
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const path = "/roleProofs/" + index;
    if (!isPlainObject(source)) fail("MAP_OBJECT", path, "Role proof must be a plain object");
    const id = stableId(source.id, path + "/id", "Role-proof ID");
    if (priorId !== null && asciiCompare(priorId, id) >= 0) fail("MAP_UNSTABLE_ORDER", path + "/id", "Role-proof IDs must be unique and strict ASCII sorted");
    priorId = id;
    if ((source.kind !== "support" && source.kind !== "guard") || source.version !== 1) {
      fail("ROLE_PROOF_UNIMPLEMENTED", path, "Only support@1 and guard@1 role proofs are implemented");
    }
    const padId = stableId(source.padId, path + "/padId", "Role-proof pad ID");
    const pad = padById.get(padId);
    if (!pad) fail("MAP_PAD_REFERENCE", path + "/padId", "Unknown role-proof pad " + padId);
    if (source.kind === "support") {
      if (supportByPad.has(padId)) fail("ROLE_PROOF_DUPLICATE", path + "/padId", "A pad cannot have more than one support proof");
      supportByPad.set(padId, id);
      compiled.push(compileSupport(Object.assign({}, source, { id: id, padId: padId }), path, pad, map, context));
    } else {
      if (guardByPad.has(padId)) fail("ROLE_PROOF_DUPLICATE", path + "/padId", "A pad cannot have more than one guard proof");
      guardByPad.set(padId, id);
      compiled.push(compileGuard(Object.assign({}, source, { id: id, padId: padId }), path, pad, map, context));
    }
  }
  for (const pad of map.pads) {
    if (pad.intent === "support" && !supportByPad.has(pad.id)) {
      fail("ROLE_PROOF_REQUIRED", "/pads/" + pad.id + "/intent", "Support intent requires exactly one support@1 proof");
    }
    if ((context && context.requireGuardProofs || pad.intent === "guard") && !guardByPad.has(pad.id)) {
      fail("ROLE_PROOF_REQUIRED", "/pads/" + pad.id, "This pad requires exactly one guard@1 proof");
    }
  }
  const intentProofChecks = map.pads.filter(function (pad) { return pad.intent === "support" || pad.intent === "guard"; }).map(function (pad) {
    return {
      padId: pad.id,
      intent: pad.intent,
      proofId: pad.intent === "support" ? supportByPad.get(pad.id) : guardByPad.get(pad.id),
      pass: true,
    };
  });
  return deepFreeze({ roleProofs: compiled, intentProofChecks: intentProofChecks });
}

function compileRoleProofs(map, sources, context) {
  return compileRoleProofSet(map, sources, context).roleProofs;
}

function validateMapProofSupplement(source, map, context) {
  inspectPlainTree(source, "/mapProofSupplement", new WeakSet(), 0);
  exactKeys(source, ["schemaVersion", "id", "mapId", "normalizedMapSchemaVersion", "roleProofs"],
    ["schemaVersion", "id", "mapId", "normalizedMapSchemaVersion", "roleProofs"], "/mapProofSupplement", "map proof supplement");
  if (source.schemaVersion !== 1) fail("MAP_SCHEMA_VERSION", "/mapProofSupplement/schemaVersion", "Map proof supplement schemaVersion must equal 1");
  stableId(source.id, "/mapProofSupplement/id", "Map proof supplement ID");
  const mapId = stableId(source.mapId, "/mapProofSupplement/mapId", "Supplement map ID");
  if (mapId !== map.id) fail("MAP_PROOF_SUPPLEMENT_MAP", "/mapProofSupplement/mapId", "Map proof supplement must name its exact map");
  if (source.normalizedMapSchemaVersion !== 2) {
    fail("MAP_SCHEMA_VERSION", "/mapProofSupplement/normalizedMapSchemaVersion", "Proof supplement targets normalized map schema 2");
  }
  return compileRoleProofSet(map, source.roleProofs, context);
}

function forwardCrossedMarker(priorRouteDistance, nextRouteDistance, markerDistance) {
  safeInteger(priorRouteDistance, "/priorRouteDistance", "Prior route distance");
  safeInteger(nextRouteDistance, "/nextRouteDistance", "Next route distance");
  safeInteger(markerDistance, "/markerDistance", "Marker route distance");
  return priorRouteDistance < markerDistance && markerDistance <= nextRouteDistance;
}

function guardContactEligible(contact) {
  return !!contact && contact.targetKind === "ground" && contact.hardControlBucketOccupied === false &&
    contact.hasResolve === false && contact.otherwiseEligible === true;
}

function createGuardOrderingKernel() {
  function compareAscii(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }
  function eligible(contact) {
    return !!contact && contact.targetKind === "ground" && contact.hardControlBucketOccupied === false &&
      contact.hasResolve === false && contact.otherwiseEligible === true;
  }
  function crosses(contact) {
    const prior = BigInt(contact.priorRouteDistance);
    const marker = BigInt(contact.markerDistance);
    return prior < marker && marker <= prior + BigInt(contact.requestedForwardAdvance);
  }
  function compare(left, right) {
    const leftNumerator = BigInt(left.markerDistance - left.priorRouteDistance);
    const rightNumerator = BigInt(right.markerDistance - right.priorRouteDistance);
    const leftCross = leftNumerator * BigInt(right.requestedForwardAdvance);
    const rightCross = rightNumerator * BigInt(left.requestedForwardAdvance);
    if (leftCross !== rightCross) return leftCross < rightCross ? -1 : 1;
    const route = compareAscii(left.routeId, right.routeId);
    if (route !== 0) return route;
    if (left.markerDistance !== right.markerDistance) return left.markerDistance < right.markerDistance ? -1 : 1;
    const marker = compareAscii(left.markerId, right.markerId);
    if (marker !== 0) return marker;
    return left.enemyId < right.enemyId ? -1 : (left.enemyId > right.enemyId ? 1 : 0);
  }
  function order(contacts) {
    return contacts.filter(function (contact) { return eligible(contact) && crosses(contact); }).slice().sort(compare);
  }
  return Object.freeze({ order: order });
}

const GUARD_ORDERING_KERNEL = createGuardOrderingKernel();

function normalizeContact(contact, index) {
  const path = "/contacts/" + index;
  const prior = nonnegativeInteger(contact.priorRouteDistance, path + "/priorRouteDistance", "Prior route distance");
  const advance = positiveInteger(contact.requestedForwardAdvance, path + "/requestedForwardAdvance", "Requested forward advance");
  const markerDistance = nonnegativeInteger(contact.markerDistance, path + "/markerDistance", "Marker route distance");
  const routeId = stableId(contact.routeId, path + "/routeId", "Contact route ID");
  const markerId = stableId(contact.markerId, path + "/markerId", "Contact marker ID");
  const enemyId = nonnegativeInteger(contact.enemyId, path + "/enemyId", "Immutable enemy ID");
  const next = checkedNumber(BigInt(prior) + BigInt(advance), path, "Next route distance");
  if (!forwardCrossedMarker(prior, next, markerDistance)) return null;
  return {
    source: copyPlain(contact),
    numerator: markerDistance - prior,
    denominator: advance,
    routeId: routeId,
    markerDistance: markerDistance,
    markerId: markerId,
    enemyId: enemyId,
  };
}

function compareContacts(left, right) {
  const leftCross = BigInt(left.numerator) * BigInt(right.denominator);
  const rightCross = BigInt(right.numerator) * BigInt(left.denominator);
  if (leftCross !== rightCross) return leftCross < rightCross ? -1 : 1;
  const route = asciiCompare(left.routeId, right.routeId);
  if (route !== 0) return route;
  if (left.markerDistance !== right.markerDistance) return left.markerDistance - right.markerDistance;
  const marker = asciiCompare(left.markerId, right.markerId);
  if (marker !== 0) return marker;
  return left.enemyId - right.enemyId;
}

function orderGuardContacts(contacts, contextSource) {
  if (!Array.isArray(contacts)) fail("MAP_ARRAY", "/contacts", "Guard contacts must be an array");
  validateContext(contextSource);
  const eligible = [];
  for (let index = 0; index < contacts.length; index++) {
    if (!guardContactEligible(contacts[index])) continue;
    const normalized = normalizeContact(contacts[index], index);
    if (normalized) eligible.push(normalized);
  }
  eligible.sort(compareContacts);
  const normalizedSources = eligible.map(function (item) { return item.source; });
  const ordered = GUARD_ORDERING_KERNEL.order(normalizedSources);
  return deepFreeze(ordered);
}

function orderGuardMarkers(markers, contextSource) {
  if (!Array.isArray(markers)) fail("MAP_ARRAY", "/markers", "Guard markers must be an array");
  validateContext(contextSource);
  const output = markers.map(copyPlain).sort(function (left, right) {
    const leftSlot = nonnegativeInteger(left.slotIndex, "/markers/slotIndex", "Guard slot index");
    const rightSlot = nonnegativeInteger(right.slotIndex, "/markers/slotIndex", "Guard slot index");
    return leftSlot - rightSlot || asciiCompare(stableId(left.id, "/markers/id", "Guard marker ID"), stableId(right.id, "/markers/id", "Guard marker ID"));
  });
  return deepFreeze(output);
}

module.exports = Object.freeze({
  GUARD_ROUTE_SPACING: GUARD_ROUTE_SPACING,
  validateRoleProofContext: function (value) { return deepFreeze(validateContext(value)); },
  compileRoleProofSet: compileRoleProofSet,
  compileRoleProofs: compileRoleProofs,
  validateMapProofSupplement: validateMapProofSupplement,
  forwardCrossedMarker: forwardCrossedMarker,
  guardContactEligible: guardContactEligible,
  createGuardOrderingKernel: createGuardOrderingKernel,
  orderGuardContacts: orderGuardContacts,
  orderGuardMarkers: orderGuardMarkers,
});
