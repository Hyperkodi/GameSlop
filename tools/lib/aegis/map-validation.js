"use strict";

const fs = require("node:fs");
const { parseStrictJsonBytes } = require("./strict-json.js");
const { AegisContentError, fail } = require("./diagnostics.js");
const Geometry = require("./map-geometry.js");

const POLICY = Object.freeze({
  roadWidthMilliUnits: 12000,
  roadHalfWidthMilliUnits: 6000,
  ordinaryLaneClearanceMilliUnits: 16000,
  padSpacingMilliUnits: 20000,
  boardInsetMilliUnits: 8000,
  anchorClearanceMilliUnits: 20000,
  minimumOrdinaryExposureMilliUnits: 18000,
});
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const ROUTE_KINDS = new Set(["ground", "air"]);
const PAD_KINDS = new Set(["ordinary", "specialist"]);
const INTENTS = new Set(["early", "bend", "double-pass", "mid", "late", "air", "support", "line", "guard", "mine"]);
const M1_GEOMETRY_INTENTS = new Set(["early", "bend", "double-pass", "mid", "late"]);
const QUALITIES = new Set(["specialist", "standard", "strong", "power"]);
const ANCHOR_KINDS = new Set(["entry", "gate", "breach", "large-prop"]);
const CROSSING_KINDS = new Set(["at-grade", "overpass"]);
const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, allowed, required, path, label) {
  if (!isPlainObject(value)) fail("MAP_OBJECT", path, label + " must be a plain object");
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) fail("MAP_UNKNOWN_KEY", path + "/" + key, "Unknown " + label + " key " + key);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("MAP_MISSING_KEY", path + "/" + key, label + " requires " + key);
    }
  }
}

function safeInteger(value, path, label) {
  if (!Number.isSafeInteger(value)) fail("MAP_SAFE_INTEGER", path, label + " must be a safe integer");
  return value;
}

function positiveInteger(value, path, label) {
  safeInteger(value, path, label);
  if (value <= 0) fail("MAP_POSITIVE", path, label + " must be positive");
  return value;
}

function stableId(value, path, label) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail("MAP_STABLE_ID", path, label + " must be a stable ASCII ID");
  }
  return value;
}

function asciiCompare(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function requireString(value, path, label) {
  if (typeof value !== "string" || value.trim() === "") fail("MAP_STRING", path, label + " must be a non-empty string");
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit <= 0x1f || unit === 0x7f || unit === 0xfffe || unit === 0xffff) {
      fail("MAP_STRING_XML", path, label + " contains a character forbidden by the deterministic SVG report");
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail("MAP_STRING_XML", path, label + " contains a lone surrogate");
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail("MAP_STRING_XML", path, label + " contains a lone surrogate");
    }
  }
  return value;
}

function requireArray(value, path, label, allowEmpty) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail("MAP_ARRAY", path, label + " must be " + (allowEmpty ? "an array" : "a non-empty array"));
  }
  return value;
}

function checkedNumber(value, path, label) {
  if (value > MAX_SAFE_BIG || value < -MAX_SAFE_BIG) fail("MAP_SAFE_INTEGER", path, label + " exceeds the safe-integer range");
  return Number(value);
}

function multiplySafe(value, factor, path, label) {
  return checkedNumber(BigInt(value) * BigInt(factor), path, label);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function orderedIds(items, path, label) {
  let prior = null;
  const seen = new Set();
  for (let index = 0; index < items.length; index++) {
    const id = items[index].id;
    if (seen.has(id)) fail("MAP_DUPLICATE_ID", path + "/" + index + "/id", "Duplicate " + label + " ID " + id);
    if (prior !== null && asciiCompare(prior, id) >= 0) {
      fail("MAP_UNSTABLE_ORDER", path + "/" + index + "/id", label + " IDs must be authored in strict ASCII order");
    }
    prior = id;
    seen.add(id);
  }
}

function idArray(value, path, label, allowEmpty) {
  requireArray(value, path, label, allowEmpty === true);
  const result = value.map(function (item, index) {
    return stableId(item, path + "/" + index, label + " item");
  });
  for (let index = 1; index < result.length; index++) {
    if (asciiCompare(result[index - 1], result[index]) >= 0) {
      fail("MAP_UNSTABLE_ORDER", path + "/" + index, label + " must be unique and in strict ASCII order");
    }
  }
  return result;
}

function enumValue(value, allowed, path, label) {
  if (typeof value !== "string" || !allowed.has(value)) fail("MAP_ENUM", path, "Unknown " + label + " " + String(value));
  return value;
}

function readMapFile(filePath) {
  return parseStrictJsonBytes(fs.readFileSync(filePath), filePath);
}

function withRebasedDiagnostics(action, oldPrefix, newPrefix) {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof AegisContentError)) throw error;
    throw new AegisContentError(error.diagnostics.map(function (item) {
      let rebased = item.path;
      if (rebased === oldPrefix) rebased = newPrefix;
      else if (rebased.startsWith(oldPrefix + "/")) rebased = newPrefix + rebased.slice(oldPrefix.length);
      return { code: item.code, path: rebased, message: item.message };
    }));
  }
}

function validateBoard(source) {
  exactKeys(source, ["columns", "rows", "cellWorldUnits", "widthWorldUnits", "heightWorldUnits"],
    ["columns", "rows", "cellWorldUnits", "widthWorldUnits", "heightWorldUnits"], "/board", "board");
  const expected = {
    columns: 40,
    rows: 25,
    cellWorldUnits: 4,
    widthWorldUnits: 160,
    heightWorldUnits: 100,
  };
  for (const key of Object.keys(expected)) {
    safeInteger(source[key], "/board/" + key, "Board " + key);
    if (source[key] !== expected[key]) fail("MAP_GRID_CONTRACT", "/board/" + key, "Board " + key + " must equal " + expected[key]);
  }
  return expected;
}

function validateRoad(source) {
  exactKeys(source, ["widthWorldUnits"], ["widthWorldUnits"], "/road", "road");
  positiveInteger(source.widthWorldUnits, "/road/widthWorldUnits", "Road width");
  if (source.widthWorldUnits !== 12) fail("MAP_ROAD_WIDTH", "/road/widthWorldUnits", "Campaign roads must be exactly 12 world units wide");
  return { widthWorldUnits: 12, widthMilliUnits: POLICY.roadWidthMilliUnits, halfWidthMilliUnits: POLICY.roadHalfWidthMilliUnits };
}

function validateRouteSource(source, index) {
  const path = "/routes/" + index;
  exactKeys(source, ["id", "kind", "layerId", "nodes"], ["id", "kind", "layerId", "nodes"], path, "route");
  const id = stableId(source.id, path + "/id", "Route ID");
  const kind = enumValue(source.kind, ROUTE_KINDS, path + "/kind", "route kind");
  const layerId = stableId(source.layerId, path + "/layerId", "Route layer ID");
  requireArray(source.nodes, path + "/nodes", "Route nodes", false);
  const route = withRebasedDiagnostics(function () {
    return Geometry.compileRoute({ id: id, nodes: source.nodes });
  }, "/route", path);
  const nodes = source.nodes.map(function (node) {
    const copy = { column: node.column, row: node.row };
    if (Object.prototype.hasOwnProperty.call(node, "portal")) copy.portal = node.portal;
    return copy;
  });
  for (let nodeIndex = 1; nodeIndex < route.segments.length; nodeIndex++) {
    const incoming = route.segments[nodeIndex - 1];
    const outgoing = route.segments[nodeIndex];
    const cross = BigInt(incoming.deltaX) * BigInt(outgoing.deltaY) - BigInt(incoming.deltaY) * BigInt(outgoing.deltaX);
    const dot = BigInt(incoming.deltaX) * BigInt(outgoing.deltaX) + BigInt(incoming.deltaY) * BigInt(outgoing.deltaY);
    if (cross === 0n && dot < 0n) {
      fail("MAP_TIGHT_BEND", path + "/nodes/" + nodeIndex, "A road cannot reverse through a zero-radius U-turn");
    }
    if (cross === 0n && dot > 0n) {
      fail("MAP_REDUNDANT_NODE", path + "/nodes/" + nodeIndex, "Collinear straight-through route nodes must be merged");
    }
  }
  return { id: id, kind: kind, layerId: layerId, route: route, nodes: nodes };
}

function validateCrossingSource(source, index, routeById) {
  const path = "/crossings/" + index;
  const common = ["id", "kind", "routeAId", "segmentAIndex", "routeBId", "segmentBIndex"];
  exactKeys(source, common.concat(["upperLayerId"]), common, path, "crossing");
  const id = stableId(source.id, path + "/id", "Crossing ID");
  const kind = enumValue(source.kind, CROSSING_KINDS, path + "/kind", "crossing kind");
  const routeAId = stableId(source.routeAId, path + "/routeAId", "Crossing route A ID");
  const routeBId = stableId(source.routeBId, path + "/routeBId", "Crossing route B ID");
  const routeA = routeById.get(routeAId);
  const routeB = routeById.get(routeBId);
  if (!routeA) fail("MAP_ROUTE_REFERENCE", path + "/routeAId", "Unknown route ID " + routeAId);
  if (!routeB) fail("MAP_ROUTE_REFERENCE", path + "/routeBId", "Unknown route ID " + routeBId);
  const segmentAIndex = safeInteger(source.segmentAIndex, path + "/segmentAIndex", "Crossing segment A index");
  const segmentBIndex = safeInteger(source.segmentBIndex, path + "/segmentBIndex", "Crossing segment B index");
  if (segmentAIndex < 0 || segmentAIndex >= routeA.route.segments.length) fail("MAP_SEGMENT_REFERENCE", path + "/segmentAIndex", "Unknown route A segment index");
  if (segmentBIndex < 0 || segmentBIndex >= routeB.route.segments.length) fail("MAP_SEGMENT_REFERENCE", path + "/segmentBIndex", "Unknown route B segment index");
  if (asciiCompare(routeAId, routeBId) > 0 || (routeAId === routeBId && segmentAIndex >= segmentBIndex)) {
    fail("MAP_UNSTABLE_CROSSING", path, "Crossing route/segment pairs must be authored in canonical order");
  }
  let upperLayerId = null;
  if (kind === "overpass") {
    if (!Object.prototype.hasOwnProperty.call(source, "upperLayerId")) fail("MAP_MISSING_KEY", path + "/upperLayerId", "Overpass requires upperLayerId");
    upperLayerId = stableId(source.upperLayerId, path + "/upperLayerId", "Overpass upper layer ID");
    if (routeA.layerId === routeB.layerId) fail("MAP_OVERPASS_LAYER", path, "Overpass routes must use distinct layers");
    if (upperLayerId !== routeA.layerId && upperLayerId !== routeB.layerId) fail("MAP_OVERPASS_LAYER", path + "/upperLayerId", "Overpass upperLayerId must name one crossing route layer");
  } else if (Object.prototype.hasOwnProperty.call(source, "upperLayerId")) {
    fail("MAP_UNKNOWN_KEY", path + "/upperLayerId", "At-grade crossings cannot declare upperLayerId");
  } else if (routeA.layerId !== routeB.layerId) {
    fail("MAP_CROSSING_LAYER", path, "At-grade crossing routes must share a layer");
  }
  return {
    id: id,
    kind: kind,
    routeAId: routeAId,
    segmentAIndex: segmentAIndex,
    routeBId: routeBId,
    segmentBIndex: segmentBIndex,
    upperLayerId: upperLayerId,
  };
}

function validatePadSource(source, index, routeById) {
  const path = "/pads/" + index;
  exactKeys(source, ["id", "kind", "column", "row", "intent", "declaredQuality", "claimedRouteIds"],
    ["id", "kind", "column", "row", "intent", "declaredQuality", "claimedRouteIds"], path, "pad");
  const id = stableId(source.id, path + "/id", "Pad ID");
  const kind = enumValue(source.kind, PAD_KINDS, path + "/kind", "pad kind");
  const intent = enumValue(source.intent, INTENTS, path + "/intent", "pad intent");
  const declaredQuality = enumValue(source.declaredQuality, QUALITIES, path + "/declaredQuality", "declared quality");
  const claimedRouteIds = idArray(source.claimedRouteIds, path + "/claimedRouteIds", "Claimed route IDs", false);
  for (const routeId of claimedRouteIds) if (!routeById.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/claimedRouteIds", "Unknown route ID " + routeId);
  safeInteger(source.column, path + "/column", "Pad column");
  safeInteger(source.row, path + "/row", "Pad row");
  const compiled = withRebasedDiagnostics(function () {
    return Geometry.compilePad({ id: id, column: source.column, row: source.row });
  }, "/pad", path);
  return {
    id: id,
    kind: kind,
    column: source.column,
    row: source.row,
    x: compiled.x,
    y: compiled.y,
    intent: intent,
    declaredQuality: declaredQuality,
    claimedRouteIds: claimedRouteIds,
  };
}

function validateAnchorSource(source, index, routeById) {
  const path = "/anchors/" + index;
  exactKeys(source, ["id", "kind", "column", "row", "routeId"], ["id", "kind", "column", "row"], path, "anchor");
  const id = stableId(source.id, path + "/id", "Anchor ID");
  const kind = enumValue(source.kind, ANCHOR_KINDS, path + "/kind", "anchor kind");
  safeInteger(source.column, path + "/column", "Anchor column");
  safeInteger(source.row, path + "/row", "Anchor row");
  const endpointKind = kind === "entry" || kind === "gate" || kind === "breach";
  let routeId = null;
  if (endpointKind) {
    if (!Object.prototype.hasOwnProperty.call(source, "routeId")) fail("MAP_MISSING_KEY", path + "/routeId", "Route endpoint anchor requires routeId");
    routeId = stableId(source.routeId, path + "/routeId", "Anchor route ID");
    if (!routeById.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/routeId", "Unknown route ID " + routeId);
  } else if (Object.prototype.hasOwnProperty.call(source, "routeId")) {
    fail("MAP_UNKNOWN_KEY", path + "/routeId", "Large-prop anchors cannot declare routeId");
  }
  const inside = source.column >= 0 && source.column < Geometry.GRID.columns && source.row >= 0 && source.row < Geometry.GRID.rows;
  if (!inside && !endpointKind) fail("MAP_GRID_BOUNDS", path, "Only route endpoint anchors may be off-board");
  const center = Geometry.cellCenterMilli(source.column, source.row, endpointKind);
  if (endpointKind) {
    const route = routeById.get(routeId);
    const first = route.nodes[0];
    const last = route.nodes[route.nodes.length - 1];
    const matchesFirst = first.column === source.column && first.row === source.row;
    const matchesLast = last.column === source.column && last.row === source.row;
    if ((kind === "entry" || kind === "breach") && !matchesFirst) {
      fail("MAP_ANCHOR_ENDPOINT", path, "Entry or breach anchor must coincide with its route's first node");
    }
    if (kind === "gate" && !matchesLast) fail("MAP_ANCHOR_ENDPOINT", path, "Gate anchor must coincide with its route's last node");
  }
  return { id: id, kind: kind, column: source.column, row: source.row, x: center.x, y: center.y, routeId: routeId };
}

function validateExclusionSource(source, index) {
  const path = "/exclusions/" + index;
  exactKeys(source, ["id", "kind", "column", "row", "radiusWorldUnits"],
    ["id", "kind", "column", "row", "radiusWorldUnits"], path, "exclusion");
  const id = stableId(source.id, path + "/id", "Exclusion ID");
  if (source.kind !== "circle") fail("MAP_ENUM", path + "/kind", "Only circle exclusion masks are supported");
  safeInteger(source.column, path + "/column", "Exclusion column");
  safeInteger(source.row, path + "/row", "Exclusion row");
  const center = Geometry.cellCenterMilli(source.column, source.row, false);
  const radiusWorldUnits = positiveInteger(source.radiusWorldUnits, path + "/radiusWorldUnits", "Exclusion radius");
  return {
    id: id,
    kind: "circle",
    column: source.column,
    row: source.row,
    x: center.x,
    y: center.y,
    radiusMilliUnits: multiplySafe(radiusWorldUnits, 1000, path + "/radiusWorldUnits", "Exclusion radius"),
  };
}

function validateGroundRouteEndpoints(routes, anchors) {
  for (let index = 0; index < routes.length; index++) {
    const route = routes[index];
    if (route.kind !== "ground") continue;
    const starts = anchors.filter(function (anchor) {
      return anchor.routeId === route.id && (anchor.kind === "entry" || anchor.kind === "breach");
    });
    const gates = anchors.filter(function (anchor) {
      return anchor.routeId === route.id && anchor.kind === "gate";
    });
    if (starts.length !== 1) {
      fail("MAP_ROUTE_ENTRY", "/routes/" + index, "Every ground route requires exactly one declared entry or breach at its first node");
    }
    if (gates.length !== 1) {
      fail("MAP_ROUTE_GATE", "/routes/" + index, "Every ground route must reach exactly one declared gate at its last node");
    }
  }
}

function validateProbeSource(source, index, routeById) {
  const path = "/probes/" + index;
  exactKeys(source, ["id", "rangeWorldUnits", "targetKinds", "routeIds", "baselineMilliUnits"],
    ["id", "rangeWorldUnits", "targetKinds", "routeIds"], path, "probe");
  const id = stableId(source.id, path + "/id", "Probe ID");
  const rangeWorldUnits = positiveInteger(source.rangeWorldUnits, path + "/rangeWorldUnits", "Probe range");
  const targetKinds = idArray(source.targetKinds, path + "/targetKinds", "Target kinds", false);
  for (const kind of targetKinds) enumValue(kind, ROUTE_KINDS, path + "/targetKinds", "target kind");
  const routeIds = idArray(source.routeIds, path + "/routeIds", "Probe route IDs", false);
  for (const routeId of routeIds) if (!routeById.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/routeIds", "Unknown route ID " + routeId);
  let baselineMilliUnits = null;
  if (Object.prototype.hasOwnProperty.call(source, "baselineMilliUnits")) {
    baselineMilliUnits = positiveInteger(source.baselineMilliUnits, path + "/baselineMilliUnits", "Probe baseline");
  }
  return {
    id: id,
    rangeWorldUnits: rangeWorldUnits,
    rangeMilliUnits: multiplySafe(rangeWorldUnits, 1000, path + "/rangeWorldUnits", "Probe range"),
    targetKinds: targetKinds,
    routeIds: routeIds,
    baselineMilliUnits: baselineMilliUnits,
  };
}

function validateReview(source, probeById) {
  exactKeys(source, ["entryProbeId", "qualityProbeId", "minimumEntryExposureMilliUnits", "maximumSpread"],
    ["entryProbeId", "qualityProbeId", "minimumEntryExposureMilliUnits", "maximumSpread"], "/review", "review policy");
  const entryProbeId = stableId(source.entryProbeId, "/review/entryProbeId", "Entry probe ID");
  const qualityProbeId = stableId(source.qualityProbeId, "/review/qualityProbeId", "Quality probe ID");
  if (!probeById.has(entryProbeId)) fail("MAP_PROBE_REFERENCE", "/review/entryProbeId", "Unknown entry probe ID " + entryProbeId);
  if (!probeById.has(qualityProbeId)) fail("MAP_PROBE_REFERENCE", "/review/qualityProbeId", "Unknown quality probe ID " + qualityProbeId);
  if (probeById.get(qualityProbeId).baselineMilliUnits === null) fail("MAP_QUALITY_BASELINE", "/review/qualityProbeId", "Quality probe requires a baseline");
  const minimum = positiveInteger(source.minimumEntryExposureMilliUnits, "/review/minimumEntryExposureMilliUnits", "Minimum entry exposure");
  if (minimum < POLICY.minimumOrdinaryExposureMilliUnits) {
    fail("MAP_ENTRY_EXPOSURE_POLICY", "/review/minimumEntryExposureMilliUnits", "Ordinary-pad entry exposure cannot be set below 18 world units");
  }
  exactKeys(source.maximumSpread, ["numerator", "denominator"], ["numerator", "denominator"], "/review/maximumSpread", "spread limit");
  const numerator = positiveInteger(source.maximumSpread.numerator, "/review/maximumSpread/numerator", "Spread numerator");
  const denominator = positiveInteger(source.maximumSpread.denominator, "/review/maximumSpread/denominator", "Spread denominator");
  return {
    entryProbeId: entryProbeId,
    qualityProbeId: qualityProbeId,
    minimumEntryExposureMilliUnits: minimum,
    maximumSpread: { numerator: numerator, denominator: denominator },
  };
}

function sign(value) {
  return value < 0n ? -1 : (value > 0n ? 1 : 0);
}

function orientation(a, b, c) {
  return (BigInt(b.x) - BigInt(a.x)) * (BigInt(c.y) - BigInt(a.y)) -
    (BigInt(b.y) - BigInt(a.y)) * (BigInt(c.x) - BigInt(a.x));
}

function between(value, first, second) {
  return value >= (first < second ? first : second) && value <= (first > second ? first : second);
}

function onSegment(a, b, p) {
  return orientation(a, b, p) === 0n && between(p.x, a.x, b.x) && between(p.y, a.y, b.y);
}

function segmentRelationship(left, right) {
  const a = { x: left.fromX, y: left.fromY };
  const b = { x: left.toX, y: left.toY };
  const c = { x: right.fromX, y: right.fromY };
  const d = { x: right.toX, y: right.toY };
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 === 0n && o2 === 0n && o3 === 0n && o4 === 0n) {
    const useX = left.fromX !== left.toX;
    const a0 = useX ? left.fromX : left.fromY;
    const a1 = useX ? left.toX : left.toY;
    const b0 = useX ? right.fromX : right.fromY;
    const b1 = useX ? right.toX : right.toY;
    const leftLow = a0 < a1 ? a0 : a1;
    const leftHigh = a0 > a1 ? a0 : a1;
    const rightLow = b0 < b1 ? b0 : b1;
    const rightHigh = b0 > b1 ? b0 : b1;
    const low = leftLow > rightLow ? leftLow : rightLow;
    const high = leftHigh < rightHigh ? leftHigh : rightHigh;
    if (low > high) return "none";
    return low < high ? "overlap" : "point";
  }
  if (sign(o1) * sign(o2) < 0 && sign(o3) * sign(o4) < 0) return "point";
  if ((o1 === 0n && onSegment(a, b, c)) || (o2 === 0n && onSegment(a, b, d)) ||
      (o3 === 0n && onSegment(c, d, a)) || (o4 === 0n && onSegment(c, d, b))) return "point";
  return "none";
}

function crossingKey(routeAId, segmentAIndex, routeBId, segmentBIndex) {
  return routeAId + ":" + segmentAIndex + "|" + routeBId + ":" + segmentBIndex;
}

function validateRouteTopology(routes, crossings) {
  const declared = new Map();
  for (const crossing of crossings) {
    const key = crossingKey(crossing.routeAId, crossing.segmentAIndex, crossing.routeBId, crossing.segmentBIndex);
    if (declared.has(key)) fail("MAP_DUPLICATE_CROSSING", "/crossings", "Duplicate crossing declaration for " + key);
    declared.set(key, crossing);
  }
  const used = new Set();
  function inspect(leftRoute, leftSegment, rightRoute, rightSegment, adjacent) {
    const relation = segmentRelationship(leftSegment, rightSegment);
    const key = crossingKey(leftRoute.id, leftSegment.index, rightRoute.id, rightSegment.index);
    if (relation === "none") {
      if (adjacent || leftRoute.kind !== "ground" || rightRoute.kind !== "ground") return;
      const distance = segmentDistanceRational(leftSegment, rightSegment);
      if (!rationalAtLeastDistance(distance, POLICY.roadWidthMilliUnits)) {
        if (leftRoute.id === rightRoute.id) {
          fail("MAP_TIGHT_BEND", "/routes", "Nonadjacent parts of a 12-wide road collide at " + key);
        }
        if (leftRoute.layerId === rightRoute.layerId) {
          fail("MAP_LANE_OVERLAP", "/routes", "Same-layer 12-wide road masks collide at " + key);
        }
      }
      return;
    }
    if (relation === "overlap") fail("MAP_ROUTE_OVERLAP", "/routes", "Road segments overlap at " + key);
    if (adjacent) return;
    if (leftRoute.kind !== "ground" || rightRoute.kind !== "ground") return;
    if (!declared.has(key)) fail("MAP_UNDECLARED_CROSSING", "/routes", "Ground-route crossing requires an explicit declaration for " + key);
    used.add(key);
  }
  for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
    const leftRoute = routes[routeIndex];
    for (let first = 0; first < leftRoute.route.segments.length; first++) {
      for (let second = first + 1; second < leftRoute.route.segments.length; second++) {
        inspect(leftRoute, leftRoute.route.segments[first], leftRoute, leftRoute.route.segments[second], second === first + 1);
      }
    }
    for (let otherIndex = routeIndex + 1; otherIndex < routes.length; otherIndex++) {
      const rightRoute = routes[otherIndex];
      for (const leftSegment of leftRoute.route.segments) {
        for (const rightSegment of rightRoute.route.segments) inspect(leftRoute, leftSegment, rightRoute, rightSegment, false);
      }
    }
  }
  for (const key of declared.keys()) if (!used.has(key)) fail("MAP_STALE_CROSSING", "/crossings", "Crossing declaration does not identify a ground-route point crossing: " + key);
}

function pointDistanceSquared(x1, y1, x2, y2) {
  const dx = BigInt(x1) - BigInt(x2);
  const dy = BigInt(y1) - BigInt(y2);
  return dx * dx + dy * dy;
}

function pointSegmentDistanceRational(x, y, segment) {
  const dx = BigInt(segment.deltaX);
  const dy = BigInt(segment.deltaY);
  const px = BigInt(x) - BigInt(segment.fromX);
  const py = BigInt(y) - BigInt(segment.fromY);
  const denominator = dx * dx + dy * dy;
  const projection = px * dx + py * dy;
  if (projection <= 0n) return { numerator: px * px + py * py, denominator: 1n };
  if (projection >= denominator) {
    const tx = BigInt(x) - BigInt(segment.toX);
    const ty = BigInt(y) - BigInt(segment.toY);
    return { numerator: tx * tx + ty * ty, denominator: 1n };
  }
  const cross = px * dy - py * dx;
  return { numerator: cross * cross, denominator: denominator };
}

function segmentDistanceRational(left, right) {
  const candidates = [
    pointSegmentDistanceRational(left.fromX, left.fromY, right),
    pointSegmentDistanceRational(left.toX, left.toY, right),
    pointSegmentDistanceRational(right.fromX, right.fromY, left),
    pointSegmentDistanceRational(right.toX, right.toY, left),
  ];
  let nearest = candidates[0];
  for (let index = 1; index < candidates.length; index++) {
    if (rationalLess(candidates[index], nearest)) nearest = candidates[index];
  }
  return nearest;
}

function rationalLess(left, right) {
  return left.numerator * right.denominator < right.numerator * left.denominator;
}

function rationalAtLeastDistance(value, distance) {
  return value.numerator >= BigInt(distance) * BigInt(distance) * value.denominator;
}

function rationalFloorDistance(value) {
  return checkedNumber(Geometry.integerSqrtFloor(value.numerator / value.denominator), "/distance", "Distance");
}

function nearestRouteDistance(pad, routes) {
  let nearest = null;
  for (const route of routes) {
    if (route.kind !== "ground") continue;
    for (const segment of route.route.segments) {
      const candidate = pointSegmentDistanceRational(pad.x, pad.y, segment);
      if (nearest === null || rationalLess(candidate, nearest)) nearest = candidate;
    }
  }
  if (nearest === null) fail("MAP_GROUND_ROUTE", "/routes", "Map requires at least one ground route");
  return nearest;
}

function padClearanceMetrics(pads, routes, anchors, exclusions) {
  const output = [];
  const boardWidth = Geometry.GRID.columns * Geometry.GRID.cellMilliUnits;
  const boardHeight = Geometry.GRID.rows * Geometry.GRID.cellMilliUnits;
  for (let index = 0; index < pads.length; index++) {
    const pad = pads[index];
    const insetCandidates = [pad.x, pad.y, boardWidth - pad.x, boardHeight - pad.y];
    let inset = insetCandidates[0];
    for (let insetIndex = 1; insetIndex < insetCandidates.length; insetIndex++) {
      if (insetCandidates[insetIndex] < inset) inset = insetCandidates[insetIndex];
    }
    if (inset < POLICY.boardInsetMilliUnits) fail("MAP_BOARD_INSET", "/pads/" + index, "Pad center must be at least 8 world units inside the board");
    const routeDistance = nearestRouteDistance(pad, routes);
    if (pad.kind === "ordinary" && !rationalAtLeastDistance(routeDistance, POLICY.ordinaryLaneClearanceMilliUnits)) {
      fail("MAP_LANE_CLEARANCE", "/pads/" + index, "Ordinary pad center must be at least 16 world units from every ground lane centerline");
    }
    let nearestPadSquared = null;
    for (let other = 0; other < pads.length; other++) {
      if (other === index) continue;
      const squared = pointDistanceSquared(pad.x, pad.y, pads[other].x, pads[other].y);
      if (nearestPadSquared === null || squared < nearestPadSquared) nearestPadSquared = squared;
      if (squared < BigInt(POLICY.padSpacingMilliUnits) * BigInt(POLICY.padSpacingMilliUnits)) {
        fail("MAP_PAD_SPACING", "/pads/" + index, "Pad centers must be at least 20 world units apart");
      }
    }
    let nearestDeclaredClearance = null;
    for (const anchor of anchors) {
      const squared = pointDistanceSquared(pad.x, pad.y, anchor.x, anchor.y);
      const candidate = { numerator: squared, denominator: 1n };
      if (nearestDeclaredClearance === null || rationalLess(candidate, nearestDeclaredClearance)) nearestDeclaredClearance = candidate;
      if (squared < BigInt(POLICY.anchorClearanceMilliUnits) * BigInt(POLICY.anchorClearanceMilliUnits)) {
        fail("MAP_ANCHOR_CLEARANCE", "/pads/" + index, "Pad center must be at least 20 world units from declared entry, gate, breach, or large prop");
      }
    }
    for (const exclusion of exclusions) {
      const squared = pointDistanceSquared(pad.x, pad.y, exclusion.x, exclusion.y);
      const required = exclusion.radiusMilliUnits + POLICY.anchorClearanceMilliUnits;
      if (squared < BigInt(required) * BigInt(required)) {
        fail("MAP_EXCLUSION_CLEARANCE", "/pads/" + index, "Pad center must clear an exclusion boundary by at least 20 world units");
      }
      const centerDistance = Geometry.integerSqrtFloor(squared);
      const boundaryDistance = centerDistance > BigInt(exclusion.radiusMilliUnits) ? centerDistance - BigInt(exclusion.radiusMilliUnits) : 0n;
      const candidate = { numerator: boundaryDistance * boundaryDistance, denominator: 1n };
      if (nearestDeclaredClearance === null || rationalLess(candidate, nearestDeclaredClearance)) nearestDeclaredClearance = candidate;
    }
    output.push({
      id: pad.id,
      boardInsetMilliUnits: inset,
      minimumLaneClearanceMilliUnits: rationalFloorDistance(routeDistance),
      minimumPadSpacingMilliUnits: nearestPadSquared === null ? null : checkedNumber(Geometry.integerSqrtFloor(nearestPadSquared), "/pads", "Pad spacing"),
      minimumDeclaredClearanceMilliUnits: nearestDeclaredClearance === null ? null : rationalFloorDistance(nearestDeclaredClearance),
    });
  }
  return output;
}

function buildAnalysis(routes, pads, probes) {
  return Geometry.analyzeCoverage({
    routes: routes.map(function (route) { return { route: route.route, kind: route.kind, layerId: route.layerId }; }),
    pads: pads.map(function (pad) { return { id: pad.id, x: pad.x, y: pad.y }; }),
    probes: probes.map(function (probe) {
      const value = {
        id: probe.id,
        range: probe.rangeMilliUnits,
        targetKinds: probe.targetKinds.slice(),
        routeIds: probe.routeIds.slice(),
      };
      if (probe.baselineMilliUnits !== null) value.baseline = probe.baselineMilliUnits;
      return value;
    }),
  });
}

function findPadProbe(analysis, padId, probeId) {
  const pad = analysis.pads.find(function (item) { return item.id === padId; });
  return pad.probes.find(function (probe) { return probe.probeId === probeId; });
}

function bendIntentPass(pad, routes, qualityRange) {
  const maxSquared = BigInt(qualityRange + POLICY.roadWidthMilliUnits / 2) ** 2n;
  for (const routeId of pad.claimedRouteIds) {
    const route = routes.find(function (item) { return item.id === routeId; });
    for (let index = 1; index < route.route.segments.length; index++) {
      const vertex = route.route.segments[index];
      const prior = route.route.segments[index - 1];
      const cross = BigInt(prior.deltaX) * BigInt(vertex.deltaY) - BigInt(prior.deltaY) * BigInt(vertex.deltaX);
      if (cross !== 0n && pointDistanceSquared(pad.x, pad.y, vertex.fromX, vertex.fromY) <= maxSquared) return true;
    }
  }
  return false;
}

function intentResult(pad, qualityProbe, routes, qualityRange) {
  const claimed = qualityProbe.routes.filter(function (route) { return pad.claimedRouteIds.includes(route.routeId); });
  const stages = claimed.filter(function (route) { return route.meanStageBp !== null; }).map(function (route) { return route.meanStageBp; });
  let minimumStage = null;
  let maximumStage = null;
  for (const stage of stages) {
    if (minimumStage === null || stage < minimumStage) minimumStage = stage;
    if (maximumStage === null || stage > maximumStage) maximumStage = stage;
  }
  let pass = false;
  let evidence;
  if (pad.intent === "early") {
    pass = maximumStage !== null && maximumStage <= 3500;
    evidence = { maximumMeanStageBp: maximumStage, requiredMaximumBp: 3500 };
  } else if (pad.intent === "mid") {
    pass = minimumStage !== null && minimumStage >= 3500 && maximumStage <= 6500;
    evidence = { minimumMeanStageBp: minimumStage, maximumMeanStageBp: maximumStage, requiredMinimumBp: 3500, requiredMaximumBp: 6500 };
  } else if (pad.intent === "late") {
    pass = minimumStage !== null && minimumStage >= 6000;
    evidence = { minimumMeanStageBp: minimumStage, requiredMinimumBp: 6000 };
  } else if (pad.intent === "double-pass") {
    let maximumReentry = 0;
    for (const route of claimed) if (route.reentryCount > maximumReentry) maximumReentry = route.reentryCount;
    pass = maximumReentry >= 1;
    evidence = { maximumReentryCount: maximumReentry, requiredMinimum: 1 };
  } else if (pad.intent === "bend") {
    pass = bendIntentPass(pad, routes, qualityRange);
    evidence = { turnWaypointWithinMilliUnits: qualityRange + POLICY.roadWidthMilliUnits / 2 };
  } else {
    return {
      intent: pad.intent,
      pass: false,
      supported: false,
      evidence: { requiredProbeProfile: pad.intent + "-probe-not-yet-integrated" },
    };
  }
  return { intent: pad.intent, pass: pass, supported: true, evidence: evidence };
}

function assertM01Binding(result) {
  const route = result.routes[0];
  if (result.routes.length !== 1 || route.id !== "route.main" || route.kind !== "ground" ||
      route.layerId !== "surface" || route.route.length !== 260000) {
    fail("MAP_M01_ROUTE", "/routes", "M1 requires the binding route.main with compiled length 260000");
  }
  const expectedNodes = [
    { column: -2, row: 5, portal: true }, { column: 11, row: 5 }, { column: 11, row: 18 },
    { column: 28, row: 18 }, { column: 28, row: 9 }, { column: 41, row: 9, portal: true },
  ];
  if (JSON.stringify(route.nodes) !== JSON.stringify(expectedNodes)) {
    fail("MAP_M01_ROUTE", "/routes/0/nodes", "M1 requires the exact six binding route-node cells and portal flags");
  }
  const expectedAnchors = [
    ["entry.west", "entry", -2, 5, "route.main"],
    ["gate.east", "gate", 41, 9, "route.main"],
  ];
  const actualAnchors = result.anchors.map(function (anchor) {
    return [anchor.id, anchor.kind, anchor.column, anchor.row, anchor.routeId];
  });
  if (JSON.stringify(actualAnchors) !== JSON.stringify(expectedAnchors)) {
    fail("MAP_M01_ANCHORS", "/anchors", "M1 requires the binding entry and gate endpoint anchors");
  }
  const expectedProbes = [
    ["r20", 20000, null, "ground", "route.main"],
    ["r22", 22000, 30200, "ground", "route.main"],
    ["r24", 24000, null, "ground", "route.main"],
  ];
  const actualProbes = result.probes.map(function (probe) {
    return [probe.id, probe.rangeMilliUnits, probe.baselineMilliUnits, probe.targetKinds.join(","), probe.routeIds.join(",")];
  });
  if (JSON.stringify(actualProbes) !== JSON.stringify(expectedProbes)) {
    fail("MAP_M01_PROBES", "/probes", "M1 requires the exact R20/R22/R24 ground-route probe set and R22 baseline");
  }
  const expectedPads = [
    ["p01", "ordinary", 3, 9, "early", "standard", "route.main"], ["p02", "ordinary", 15, 8, "early", "standard", "route.main"],
    ["p03", "ordinary", 7, 14, "bend", "standard", "route.main"], ["p04", "ordinary", 16, 14, "double-pass", "strong", "route.main"],
    ["p05", "ordinary", 15, 22, "mid", "standard", "route.main"], ["p06", "ordinary", 20, 22, "mid", "standard", "route.main"],
    ["p07", "ordinary", 25, 22, "late", "standard", "route.main"], ["p08", "ordinary", 24, 13, "double-pass", "strong", "route.main"],
    ["p09", "ordinary", 31, 5, "late", "standard", "route.main"], ["p10", "ordinary", 36, 13, "late", "standard", "route.main"],
  ];
  const actualPads = result.pads.map(function (pad) {
    return [pad.id, pad.kind, pad.column, pad.row, pad.intent, pad.declaredQuality, pad.claimedRouteIds.join(",")];
  });
  if (JSON.stringify(actualPads) !== JSON.stringify(expectedPads)) fail("MAP_M01_PADS", "/pads", "M1 requires the ten binding pad cells, intents, and quality declarations");
  const expectedR22 = {
    p01: 30199337740, p02: 29538757784, p03: 30199337740, p04: 48529640518,
    p05: 30199337740, p06: 30199337740, p07: 29538757784, p08: 48529640518,
    p09: 29538757784, p10: 30199337740,
  };
  for (const pad of result.pads) {
    const r20 = findPadProbe(result.analysis, pad.id, "r20");
    const r22 = findPadProbe(result.analysis, pad.id, "r22");
    if (!r20 || r20.qualityExposureSubunits < 24000000000) fail("MAP_M01_E20", "/pads/" + pad.id, "Every M1 pad requires E20 at least 24.000 world units");
    if (!r22 || r22.qualityExposureSubunits !== expectedR22[pad.id]) fail("MAP_M01_E22", "/pads/" + pad.id, "M1 R22 exposure does not match the deterministic binding golden");
  }
  const standard = result.pads.filter(function (pad) { return pad.declaredQuality === "standard"; }).map(function (pad) {
    return findPadProbe(result.analysis, pad.id, "r22").qualityExposureSubunits;
  });
  let standardMinimum = standard[0];
  let standardMaximum = standard[0];
  for (const exposure of standard) {
    if (exposure < standardMinimum) standardMinimum = exposure;
    if (exposure > standardMaximum) standardMaximum = exposure;
  }
  if (standardMinimum !== 29538757784 || standardMaximum !== 30199337740) {
    fail("MAP_M01_STANDARD_BAND", "/pads", "M1 standard pads require the exact deterministic R22 range");
  }
  const strong = result.pads.filter(function (pad) { return pad.declaredQuality === "strong"; }).map(function (pad) { return pad.id; });
  if (JSON.stringify(strong) !== JSON.stringify(["p04", "p08"])) fail("MAP_M01_STRONG", "/pads", "Only M1 pads p04 and p08 may be strong");
  if (result.crossings.length !== 0 || result.exclusions.length !== 0) {
    fail("MAP_M01_MASKS", "/", "M1 binding geometry has no route crossings or exclusion masks");
  }
  const review = result.review;
  if (review.entryProbeId !== "r20" || review.qualityProbeId !== "r22" ||
      review.minimumEntryExposureMilliUnits !== 24000 || review.maximumSpread.numerator !== 165 ||
      review.maximumSpread.denominator !== 100) {
    fail("MAP_M01_REVIEW", "/review", "M1 requires the binding R20/R22 review thresholds and 1.65 spread ceiling");
  }
}

function validateMissionMap(source) {
  exactKeys(source,
    ["schemaVersion", "id", "title", "sourceKind", "board", "road", "routes", "crossings", "pads", "anchors", "exclusions", "probes", "review"],
    ["schemaVersion", "id", "title", "sourceKind", "board", "road", "routes", "crossings", "pads", "anchors", "exclusions", "probes", "review"],
    "/", "campaign map");
  if (source.schemaVersion !== 1) fail("MAP_SCHEMA_VERSION", "/schemaVersion", "Map schemaVersion must equal 1");
  const id = stableId(source.id, "/id", "Map ID");
  const title = requireString(source.title, "/title", "Map title");
  if (source.sourceKind !== "campaign") fail("MAP_SOURCE_KIND", "/sourceKind", "Campaign map sourceKind must equal campaign");
  const board = validateBoard(source.board);
  const road = validateRoad(source.road);

  requireArray(source.routes, "/routes", "Routes", false);
  const routes = source.routes.map(validateRouteSource);
  orderedIds(routes, "/routes", "Route");
  const routeById = new Map(routes.map(function (route) { return [route.id, route]; }));

  requireArray(source.crossings, "/crossings", "Crossings", true);
  const crossings = source.crossings.map(function (crossing, index) { return validateCrossingSource(crossing, index, routeById); });
  orderedIds(crossings, "/crossings", "Crossing");

  requireArray(source.pads, "/pads", "Pads", false);
  const pads = source.pads.map(function (pad, index) { return validatePadSource(pad, index, routeById); });
  orderedIds(pads, "/pads", "Pad");

  requireArray(source.anchors, "/anchors", "Anchors", true);
  const anchors = source.anchors.map(function (anchor, index) { return validateAnchorSource(anchor, index, routeById); });
  orderedIds(anchors, "/anchors", "Anchor");
  validateGroundRouteEndpoints(routes, anchors);

  requireArray(source.exclusions, "/exclusions", "Exclusions", true);
  const exclusions = source.exclusions.map(validateExclusionSource);
  orderedIds(exclusions, "/exclusions", "Exclusion");

  requireArray(source.probes, "/probes", "Probes", false);
  const probes = source.probes.map(function (probe, index) { return validateProbeSource(probe, index, routeById); });
  orderedIds(probes, "/probes", "Probe");
  const probeById = new Map(probes.map(function (probe) { return [probe.id, probe]; }));
  const review = validateReview(source.review, probeById);

  validateRouteTopology(routes, crossings);
  const clearance = padClearanceMetrics(pads, routes, anchors, exclusions);
  const analysis = buildAnalysis(routes, pads, probes);
  const entryProbe = probeById.get(review.entryProbeId);
  const qualityProbeDefinition = probeById.get(review.qualityProbeId);
  const checks = [];
  for (let index = 0; index < pads.length; index++) {
    const pad = pads[index];
    const entry = findPadProbe(analysis, pad.id, review.entryProbeId);
    const quality = findPadProbe(analysis, pad.id, review.qualityProbeId);
    for (const routeId of pad.claimedRouteIds) {
      const routeEntry = entry.routes.find(function (route) { return route.routeId === routeId; });
      if (!routeEntry) fail("MAP_PAD_ROUTE_CLAIM", "/pads/" + index + "/claimedRouteIds", "Entry probe does not select claimed route " + routeId);
      if (pad.kind === "ordinary" && BigInt(routeEntry.exposureSubunits) < BigInt(review.minimumEntryExposureMilliUnits) * BigInt(Geometry.ANALYSIS_SUBUNITS_PER_MILLI)) {
        fail("MAP_ENTRY_EXPOSURE", "/pads/" + index, "Ordinary pad exposure is below its declared entry threshold on route " + routeId);
      }
    }
    if (quality.classification !== pad.declaredQuality) {
      fail("MAP_QUALITY_MISMATCH", "/pads/" + index + "/declaredQuality", "Declared quality " + pad.declaredQuality + " does not match computed " + quality.classification);
    }
    const intent = intentResult(pad, quality, routes, qualityProbeDefinition.rangeMilliUnits);
    if (intent.supported === false) {
      fail("MAP_INTENT_PROBE_UNIMPLEMENTED", "/pads/" + index + "/intent", "Intent " + pad.intent + " requires its later role-probe integration before campaign approval");
    }
    if (!intent.pass) fail("MAP_INTENT_MISMATCH", "/pads/" + index + "/intent", "Pad geometry does not support declared intent " + pad.intent);
    checks.push({
      id: pad.id,
      clearance: clearance[index],
      entry: {
        probeId: entryProbe.id,
        thresholdMilliUnits: review.minimumEntryExposureMilliUnits,
        pass: true,
      },
      quality: {
        probeId: qualityProbeDefinition.id,
        declared: pad.declaredQuality,
        computed: quality.classification,
        pass: true,
      },
      intent: intent,
    });
  }
  const spread = analysis.spreads.find(function (item) { return item.probeId === review.qualityProbeId; });
  if (!Geometry.spreadWithin(spread, review.maximumSpread.numerator, review.maximumSpread.denominator)) {
    fail("MAP_SPREAD", "/review/maximumSpread", "Quality exposure spread exceeds the declared integer ratio");
  }
  let routeStageOrderApplicable = true;
  let stageRouteId = null;
  const stageRecords = [];
  for (const pad of pads) {
    if (pad.claimedRouteIds.length !== 1) {
      routeStageOrderApplicable = false;
      break;
    }
    if (stageRouteId === null) stageRouteId = pad.claimedRouteIds[0];
    if (pad.claimedRouteIds[0] !== stageRouteId) {
      routeStageOrderApplicable = false;
      break;
    }
    const quality = findPadProbe(analysis, pad.id, review.qualityProbeId);
    const routeQuality = quality.routes.find(function (route) { return route.routeId === stageRouteId; });
    if (!routeQuality || routeQuality.meanStageBp === null) {
      routeStageOrderApplicable = false;
      break;
    }
    stageRecords.push({ id: pad.id, meanStageBp: routeQuality.meanStageBp });
  }
  if (routeStageOrderApplicable) {
    for (let index = 1; index < stageRecords.length; index++) {
      if (stageRecords[index].meanStageBp <= stageRecords[index - 1].meanStageBp) {
        fail("MAP_ROUTE_STAGE_ORDER", "/pads/" + index, "Pad IDs must follow strictly increasing quality-probe route stage");
      }
    }
  }
  const result = {
    schemaVersion: 1,
    id: id,
    title: title,
    sourceKind: "campaign",
    approvalEligible: true,
    geometryPolicy: POLICY,
    board: board,
    road: road,
    routes: routes,
    crossings: crossings,
    pads: pads,
    anchors: anchors,
    exclusions: exclusions,
    probes: probes,
    review: review,
    analysis: analysis,
    padChecks: checks,
    spreadCheck: {
      probeId: review.qualityProbeId,
      numeratorSubunits: spread.numeratorSubunits,
      denominatorSubunits: spread.denominatorSubunits,
      limitNumerator: review.maximumSpread.numerator,
      limitDenominator: review.maximumSpread.denominator,
      pass: true,
    },
    routeStageOrderCheck: {
      probeId: review.qualityProbeId,
      routeId: routeStageOrderApplicable ? stageRouteId : null,
      applicable: routeStageOrderApplicable,
      stages: routeStageOrderApplicable ? stageRecords : [],
      pass: true,
    },
  };
  if (id === "m01") {
    for (let index = 0; index < pads.length; index++) {
      if (!M1_GEOMETRY_INTENTS.has(pads[index].intent)) {
        fail("MAP_M01_INTENT", "/pads/" + index + "/intent", "M1 supports only its route-stage geometry intent profile");
      }
    }
    assertM01Binding(result);
  }
  return deepFreeze(result);
}

function validateLegacyMap(source) {
  exactKeys(source, ["schemaVersion", "id", "sourceKind", "route", "pads", "probe", "expectedExposureMilliUnits", "knownIssues"],
    ["schemaVersion", "id", "sourceKind", "route", "pads", "probe", "expectedExposureMilliUnits", "knownIssues"], "/", "legacy map fixture");
  if (source.schemaVersion !== 1 || source.id !== "legacy-proving-ground" || source.sourceKind !== "legacy-report-only") {
    fail("MAP_LEGACY_ID", "/", "Legacy audit fixture identity is fixed");
  }
  exactKeys(source.probe, ["id", "rangeMilliUnits", "baselineMilliUnits"], ["id", "rangeMilliUnits", "baselineMilliUnits"], "/probe", "legacy probe");
  const probeId = stableId(source.probe.id, "/probe/id", "Legacy probe ID");
  const range = positiveInteger(source.probe.rangeMilliUnits, "/probe/rangeMilliUnits", "Legacy probe range");
  const baseline = positiveInteger(source.probe.baselineMilliUnits, "/probe/baselineMilliUnits", "Legacy probe baseline");
  requireArray(source.expectedExposureMilliUnits, "/expectedExposureMilliUnits", "Legacy exposure golden", false);
  exactKeys(source.knownIssues, ["weakOrDeadPadIds", "dominantPadIds"], ["weakOrDeadPadIds", "dominantPadIds"], "/knownIssues", "legacy known issues");
  const weak = idArray(source.knownIssues.weakOrDeadPadIds, "/knownIssues/weakOrDeadPadIds", "Weak/dead pad IDs", false);
  const dominant = idArray(source.knownIssues.dominantPadIds, "/knownIssues/dominantPadIds", "Dominant pad IDs", false);
  const analysis = Geometry.analyzeCoverage({
    routes: [{ route: source.route, kind: "ground", layerId: "surface" }],
    pads: source.pads,
    probes: [{ id: probeId, range: range, targetKinds: ["ground"], routeIds: [source.route.id], baseline: baseline }],
  });
  const observed = analysis.pads.map(function (pad) { return Geometry.roundAnalysisSubunitsToMilli(pad.probes[0].qualityExposureSubunits); });
  if (JSON.stringify(observed) !== JSON.stringify(source.expectedExposureMilliUnits)) {
    fail("MAP_LEGACY_GOLDEN", "/expectedExposureMilliUnits", "Legacy exposure vector changed");
  }
  const observedWeak = analysis.pads.filter(function (pad) { return pad.probes[0].classification === "invalid"; }).map(function (pad) { return pad.id; });
  const observedDominant = analysis.pads.filter(function (pad) { return pad.probes[0].classification === "power" || pad.probes[0].classification === "rejected"; }).map(function (pad) { return pad.id; });
  if (JSON.stringify(observedWeak) !== JSON.stringify(weak)) fail("MAP_LEGACY_ISSUES", "/knownIssues/weakOrDeadPadIds", "Legacy weak/dead pad findings changed");
  if (JSON.stringify(observedDominant) !== JSON.stringify(dominant)) fail("MAP_LEGACY_ISSUES", "/knownIssues/dominantPadIds", "Legacy dominant pad findings changed");
  return deepFreeze({
    schemaVersion: 1,
    id: source.id,
    sourceKind: source.sourceKind,
    approvalEligible: false,
    mode: "report-known-issues",
    observedExposureMilliUnits: observed,
    knownIssues: { weakOrDeadPadIds: weak, dominantPadIds: dominant },
    analysis: analysis,
  });
}

module.exports = Object.freeze({
  POLICY: POLICY,
  readMapFile: readMapFile,
  validateMissionMap: validateMissionMap,
  validateLegacyMap: validateLegacyMap,
  validateRouteTopology: validateRouteTopology,
});
