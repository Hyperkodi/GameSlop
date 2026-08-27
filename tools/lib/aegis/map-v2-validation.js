"use strict";

const { AegisContentError, fail } = require("./diagnostics.js");
const Geometry = require("./map-geometry.js");
const ExistingValidation = require("./map-validation.js");
const Selection = require("./map-selection.js");
const RoleProofs = require("./map-role-proofs.js");

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const LANE_KINDS = new Set(["ground", "air"]);
const JOIN_KINDS = new Set(["continuation", "merge", "split"]);
const CROSSING_KINDS = new Set(["at-grade", "overpass"]);
const PAD_KINDS = new Set(["ordinary", "specialist"]);
const PAD_INTENTS = new Set(["early", "bend", "double-pass", "mid", "late", "air", "support", "line", "guard", "mine"]);
const PAD_QUALITIES = new Set(["specialist", "standard", "strong", "power"]);
const ENDPOINT_KINDS = new Set(["entry", "breach", "gate"]);
const LIMITS = Object.freeze({
  routes: 16,
  laneSegments: 128,
  nodesPerLane: 64,
  joins: 128,
  crossings: 128,
  pads: 32,
  exclusions: 128,
  probes: 32,
});

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

function inspectPlainTree(value, path, seen, depth) {
  if (depth > 32) fail("MAP_LIMIT", path, "Map JSON nesting depth exceeds 32");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      fail("MAP_SAFE_INTEGER", path, "Map numbers must be non-negative-zero safe integers");
    }
    return;
  }
  if (!value || typeof value !== "object") fail("MAP_PLAIN_DATA", path, "Map input must contain only plain JSON data");
  if (seen.has(value)) fail("MAP_SHARED_REFERENCE", path, "Map input cannot contain cycles or shared object references");
  seen.add(value);
  if (!Array.isArray(value) && !isPlainObject(value)) fail("MAP_OBJECT", path, "Map objects must have a plain prototype");
  if (Object.getOwnPropertySymbols(value).length !== 0) fail("MAP_PLAIN_DATA", path, "Map input cannot contain symbol properties");
  const names = Object.getOwnPropertyNames(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) fail("MAP_PLAIN_DATA", path + "/" + index, "Map arrays cannot be sparse");
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        fail("MAP_PLAIN_DATA", path + "/" + index, "Map array elements must be enumerable data properties");
      }
      inspectPlainTree(value[index], path + "/" + index, seen, depth + 1);
    }
    for (const name of names) {
      if (name !== "length" && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length)) {
        fail("MAP_PLAIN_DATA", path + "/" + name, "Map arrays cannot have extra properties");
      }
    }
    return;
  }
  if (names.length > 64) fail("MAP_LIMIT", path, "Map object field count exceeds 64");
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      fail("MAP_PLAIN_DATA", path + "/" + name, "Map fields must be enumerable data properties");
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

function checkedNumber(value, path, label) {
  if (value > MAX_SAFE_BIG || value < -MAX_SAFE_BIG) fail("MAP_SAFE_INTEGER", path, label + " exceeds the safe-integer range");
  return Number(value);
}

function multiplySafe(value, factor, path, label) {
  return checkedNumber(BigInt(value) * BigInt(factor), path, label);
}

function stableId(value, path, label) {
  if (typeof value !== "string" || value.length > 64 || !STABLE_ID.test(value)) {
    fail("MAP_STABLE_ID", path, label + " must be a 1-64 character stable ASCII ID");
  }
  return value;
}

function enumValue(value, values, path, label) {
  if (typeof value !== "string" || !values.has(value)) fail("MAP_ENUM", path, "Unknown " + label + " " + String(value));
  return value;
}

function requireArray(value, path, label, minimum, maximum) {
  if (!Array.isArray(value)) fail("MAP_ARRAY", path, label + " must be an array");
  if (value.length < minimum || value.length > maximum) {
    fail("MAP_LIMIT", path, label + " count must be " + minimum + ".." + maximum);
  }
  return value;
}

function orderedRecords(items, path, label) {
  let prior = null;
  const seen = new Set();
  for (let index = 0; index < items.length; index++) {
    const id = items[index].id;
    if (seen.has(id)) fail("MAP_DUPLICATE_ID", path + "/" + index + "/id", "Duplicate " + label + " ID " + id);
    if (prior !== null && asciiCompare(prior, id) >= 0) {
      fail("MAP_UNSTABLE_ORDER", path + "/" + index + "/id", label + " IDs must be authored in strict ASCII order");
    }
    seen.add(id);
    prior = id;
  }
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

function semanticIdArray(value, path, label) {
  if (!Array.isArray(value) || value.length === 0) fail("MAP_ARRAY", path, label + " must be a nonempty array");
  const seen = new Set();
  return value.map(function (item, index) {
    const id = stableId(item, path + "/" + index, label + " item");
    if (seen.has(id)) fail("MAP_REPEATED_LANE", path + "/" + index, label + " cannot repeat " + id);
    seen.add(id);
    return id;
  });
}

function compiledPointKey(x, y) {
  return String(x) + "," + String(y);
}

function isInBoard(column, row) {
  return column >= 0 && column < 40 && row >= 0 && row < 25;
}

function validateBoard(value) {
  exactKeys(value, ["columns", "rows", "cellWorldUnits", "widthWorldUnits", "heightWorldUnits"],
    ["columns", "rows", "cellWorldUnits", "widthWorldUnits", "heightWorldUnits"], "/board", "board");
  const expected = { columns: 40, rows: 25, cellWorldUnits: 4, widthWorldUnits: 160, heightWorldUnits: 100 };
  for (const key of Object.keys(expected)) {
    safeInteger(value[key], "/board/" + key, "Board " + key);
    if (value[key] !== expected[key]) fail("MAP_GRID_CONTRACT", "/board/" + key, "Board " + key + " must equal " + expected[key]);
  }
  return expected;
}

function validateRoad(value) {
  exactKeys(value, ["widthWorldUnits"], ["widthWorldUnits"], "/road", "road");
  if (value.widthWorldUnits !== 12) fail("MAP_ROAD_WIDTH", "/road/widthWorldUnits", "Campaign road width must equal 12 world units");
  return { widthWorldUnits: 12, widthMilliUnits: 12000, halfWidthMilliUnits: 6000 };
}

function validateNode(value, index, count, path) {
  exactKeys(value, ["column", "row", "portal"], ["column", "row"], path, "lane node");
  const column = safeInteger(value.column, path + "/column", "Lane-node column");
  const row = safeInteger(value.row, path + "/row", "Lane-node row");
  if (Object.prototype.hasOwnProperty.call(value, "portal") && typeof value.portal !== "boolean") {
    fail("MAP_PORTAL", path + "/portal", "Portal must be Boolean");
  }
  const inside = isInBoard(column, row);
  const portal = value.portal === true;
  if (!inside) {
    if (!portal) fail("MAP_PORTAL", path, "An off-board lane endpoint must declare portal true");
    if (index !== 0 && index !== count - 1) fail("MAP_PORTAL_ENDPOINT", path, "Only a lane endpoint may be off-board");
    if (column < -4 || column > 43 || row < -4 || row > 28) {
      fail("MAP_PORTAL_BOUNDS", path, "Off-board portal endpoints must stay inside column -4..43 and row -4..28");
    }
  } else if (portal) {
    fail("MAP_PORTAL_BOUNDS", path, "Portal true is reserved for an off-board endpoint");
  }
  const output = { column: column, row: row };
  if (portal) output.portal = true;
  return output;
}

function withLaneDiagnostics(action, index) {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof AegisContentError)) throw error;
    throw new AegisContentError(error.diagnostics.map(function (item) {
      let rebased = item.path;
      if (rebased === "/route") rebased = "/laneSegments/" + index;
      else if (rebased.startsWith("/route/")) rebased = "/laneSegments/" + index + rebased.slice(6);
      return { code: item.code, path: rebased, message: item.message };
    }));
  }
}

function validateLane(value, index) {
  const path = "/laneSegments/" + index;
  exactKeys(value, ["id", "kind", "layerId", "nodes"], ["id", "kind", "layerId", "nodes"], path, "lane segment");
  const id = stableId(value.id, path + "/id", "Lane-segment ID");
  const kind = enumValue(value.kind, LANE_KINDS, path + "/kind", "lane kind");
  const layerId = stableId(value.layerId, path + "/layerId", "Lane layer ID");
  requireArray(value.nodes, path + "/nodes", "Lane nodes", 2, LIMITS.nodesPerLane);
  const nodes = value.nodes.map(function (node, nodeIndex) {
    return validateNode(node, nodeIndex, value.nodes.length, path + "/nodes/" + nodeIndex);
  });
  const compiled = withLaneDiagnostics(function () { return Geometry.compileRoute({ id: id, nodes: nodes }); }, index);
  for (let segmentIndex = 1; segmentIndex < compiled.segments.length; segmentIndex++) {
    const incoming = compiled.segments[segmentIndex - 1];
    const outgoing = compiled.segments[segmentIndex];
    const cross = BigInt(incoming.deltaX) * BigInt(outgoing.deltaY) - BigInt(incoming.deltaY) * BigInt(outgoing.deltaX);
    const dot = BigInt(incoming.deltaX) * BigInt(outgoing.deltaX) + BigInt(incoming.deltaY) * BigInt(outgoing.deltaY);
    if (cross === 0n && dot < 0n) fail("MAP_TIGHT_BEND", path + "/nodes/" + segmentIndex, "Lane cannot reverse through a zero-radius U-turn");
    if (cross === 0n && dot > 0n) fail("MAP_REDUNDANT_NODE", path + "/nodes/" + segmentIndex, "Straight-through lane nodes must be merged");
  }
  return { id: id, kind: kind, layerId: layerId, nodes: nodes, compiled: compiled };
}

function validateJoin(value, index, laneById) {
  const path = "/joins/" + index;
  exactKeys(value, ["id", "kind", "column", "row", "incomingLaneSegmentIds", "outgoingLaneSegmentIds"],
    ["id", "kind", "column", "row", "incomingLaneSegmentIds", "outgoingLaneSegmentIds"], path, "join");
  const id = stableId(value.id, path + "/id", "Join ID");
  const kind = enumValue(value.kind, JOIN_KINDS, path + "/kind", "join kind");
  const column = safeInteger(value.column, path + "/column", "Join column");
  const row = safeInteger(value.row, path + "/row", "Join row");
  if (!isInBoard(column, row)) fail("MAP_GRID_BOUNDS", path, "Join center must be inside the board");
  const incoming = idArray(value.incomingLaneSegmentIds, path + "/incomingLaneSegmentIds", "Incoming lane IDs", false);
  const outgoing = idArray(value.outgoingLaneSegmentIds, path + "/outgoingLaneSegmentIds", "Outgoing lane IDs", false);
  if ((kind === "continuation" && (incoming.length !== 1 || outgoing.length !== 1)) ||
      (kind === "merge" && (incoming.length < 2 || outgoing.length !== 1)) ||
      (kind === "split" && (incoming.length !== 1 || outgoing.length < 2))) {
    fail("MAP_JOIN_ARITY", path, "Join kind " + kind + " has invalid incoming/outgoing arity");
  }
  const center = Geometry.cellCenterMilli(column, row, false);
  let laneKind = null;
  for (const direction of [incoming, outgoing]) {
    for (const laneId of direction) {
      const lane = laneById.get(laneId);
      if (!lane) fail("MAP_LANE_REFERENCE", path, "Join references unknown lane " + laneId);
      if (laneKind === null) laneKind = lane.kind;
      if (lane.kind !== laneKind) fail("MAP_JOIN_KIND", path, "A join cannot connect different lane kinds");
    }
  }
  for (const laneId of incoming) {
    if (outgoing.includes(laneId)) fail("MAP_JOIN_CYCLE", path, "A join cannot list one lane as both incoming and outgoing");
    const lane = laneById.get(laneId);
    const end = lane.compiled.segments[lane.compiled.segments.length - 1];
    if (end.toX !== center.x || end.toY !== center.y) {
      fail("MAP_JOIN_ENDPOINT", path + "/incomingLaneSegmentIds", "Incoming lane " + laneId + " must end at the join center");
    }
  }
  for (const laneId of outgoing) {
    const lane = laneById.get(laneId);
    const start = lane.compiled.segments[0];
    if (start.fromX !== center.x || start.fromY !== center.y) {
      fail("MAP_JOIN_ENDPOINT", path + "/outgoingLaneSegmentIds", "Outgoing lane " + laneId + " must begin at the join center");
    }
  }
  return {
    id: id,
    kind: kind,
    column: column,
    row: row,
    x: center.x,
    y: center.y,
    incomingLaneSegmentIds: incoming,
    outgoingLaneSegmentIds: outgoing,
  };
}

function transitionKey(incomingId, outgoingId) {
  return incomingId + "|" + outgoingId;
}

function buildTransitionIndex(joins) {
  const result = new Map();
  for (const join of joins) {
    for (const incomingId of join.incomingLaneSegmentIds) {
      for (const outgoingId of join.outgoingLaneSegmentIds) {
        const key = transitionKey(incomingId, outgoingId);
        if (result.has(key)) fail("MAP_DUPLICATE_JOIN", "/joins", "More than one join declares transition " + key);
        result.set(key, join);
      }
    }
  }
  return result;
}

function validateRoute(value, index, laneById, transitionIndex, usedTransitions) {
  const path = "/routes/" + index;
  exactKeys(value, ["id", "kind", "laneSegmentIds", "entryAnchorId", "gateAnchorId"],
    ["id", "kind", "laneSegmentIds", "entryAnchorId", "gateAnchorId"], path, "logical route");
  const id = stableId(value.id, path + "/id", "Route ID");
  const kind = enumValue(value.kind, LANE_KINDS, path + "/kind", "route kind");
  const laneSegmentIds = semanticIdArray(value.laneSegmentIds, path + "/laneSegmentIds", "Route lane segment IDs");
  const entryAnchorId = stableId(value.entryAnchorId, path + "/entryAnchorId", "Entry anchor ID");
  const gateAnchorId = stableId(value.gateAnchorId, path + "/gateAnchorId", "Gate anchor ID");
  let length = 0n;
  const boundaryPoints = new Set();
  const offsets = [];
  for (let laneIndex = 0; laneIndex < laneSegmentIds.length; laneIndex++) {
    const laneId = laneSegmentIds[laneIndex];
    const lane = laneById.get(laneId);
    if (!lane) fail("MAP_LANE_REFERENCE", path + "/laneSegmentIds/" + laneIndex, "Unknown lane-segment ID " + laneId);
    if (lane.kind !== kind) fail("MAP_ROUTE_KIND", path + "/laneSegmentIds/" + laneIndex, "Route and lane kinds must match");
    const first = lane.compiled.segments[0];
    const last = lane.compiled.segments[lane.compiled.segments.length - 1];
    if (laneIndex === 0) boundaryPoints.add(compiledPointKey(first.fromX, first.fromY));
    if (laneIndex > 0) {
      const prior = laneById.get(laneSegmentIds[laneIndex - 1]);
      const priorLast = prior.compiled.segments[prior.compiled.segments.length - 1];
      if (priorLast.toX !== first.fromX || priorLast.toY !== first.fromY) {
        fail("MAP_ROUTE_DIRECTION", path + "/laneSegmentIds/" + laneIndex, "Consecutive directed lane endpoints do not coincide");
      }
      const key = transitionKey(prior.id, lane.id);
      if (!transitionIndex.has(key)) fail("MAP_UNDECLARED_JOIN", path + "/laneSegmentIds/" + laneIndex, "Route transition requires one declared join");
      usedTransitions.add(key);
    }
    const endKey = compiledPointKey(last.toX, last.toY);
    if (boundaryPoints.has(endKey)) fail("MAP_ROUTE_CYCLE", path + "/laneSegmentIds/" + laneIndex, "Logical route cannot return to an earlier boundary point");
    boundaryPoints.add(endKey);
    const routeOffset = checkedNumber(length, path, "Route offset");
    length += BigInt(lane.compiled.length);
    checkedNumber(length, path + "/laneSegmentIds/" + laneIndex, "Aggregate route length");
    offsets.push({ laneSegmentId: laneId, routeOffset: routeOffset, laneLength: lane.compiled.length });
  }
  const routeLength = checkedNumber(length, path, "Route length");
  return {
    id: id,
    kind: kind,
    laneSegmentIds: laneSegmentIds,
    entryAnchorId: entryAnchorId,
    gateAnchorId: gateAnchorId,
    length: routeLength,
    segmentOffsets: offsets.map(function (offset) {
      return {
        laneSegmentId: offset.laneSegmentId,
        routeOffset: offset.routeOffset,
        laneLength: offset.laneLength,
        remainingDistanceAtStart: routeLength - offset.routeOffset,
        remainingDistanceAtEnd: routeLength - offset.routeOffset - offset.laneLength,
      };
    }),
  };
}

function validateAnchor(value, index, laneById, routeById) {
  const path = "/anchors/" + index;
  if (!isPlainObject(value)) fail("MAP_OBJECT", path, "Anchor must be a plain object");
  const kind = value.kind;
  if (kind === "large-prop") {
    exactKeys(value, ["id", "kind", "column", "row"], ["id", "kind", "column", "row"], path, "large-prop anchor");
    const id = stableId(value.id, path + "/id", "Anchor ID");
    const column = safeInteger(value.column, path + "/column", "Anchor column");
    const row = safeInteger(value.row, path + "/row", "Anchor row");
    if (!isInBoard(column, row)) fail("MAP_GRID_BOUNDS", path, "Large-prop anchor must be in bounds");
    const center = Geometry.cellCenterMilli(column, row, false);
    return { id: id, kind: "large-prop", column: column, row: row, x: center.x, y: center.y };
  }
  exactKeys(value, ["id", "kind", "column", "row", "laneSegmentId", "routeIds"],
    ["id", "kind", "column", "row", "laneSegmentId", "routeIds"], path, "endpoint anchor");
  const id = stableId(value.id, path + "/id", "Anchor ID");
  enumValue(kind, ENDPOINT_KINDS, path + "/kind", "anchor kind");
  const column = safeInteger(value.column, path + "/column", "Anchor column");
  const row = safeInteger(value.row, path + "/row", "Anchor row");
  if (!isInBoard(column, row) && (column < -4 || column > 43 || row < -4 || row > 28)) {
    fail("MAP_PORTAL_BOUNDS", path, "Off-board endpoint anchor exceeds the portal envelope");
  }
  const laneSegmentId = stableId(value.laneSegmentId, path + "/laneSegmentId", "Anchor lane ID");
  if (!laneById.has(laneSegmentId)) fail("MAP_LANE_REFERENCE", path + "/laneSegmentId", "Unknown anchor lane " + laneSegmentId);
  const routeIds = idArray(value.routeIds, path + "/routeIds", "Anchor route IDs", false);
  for (const routeId of routeIds) if (!routeById.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/routeIds", "Unknown anchor route " + routeId);
  const center = Geometry.cellCenterMilli(column, row, true);
  return {
    id: id,
    kind: kind,
    column: column,
    row: row,
    x: center.x,
    y: center.y,
    laneSegmentId: laneSegmentId,
    routeIds: routeIds,
  };
}

function validateRouteAnchors(routes, anchors, laneById) {
  const anchorById = new Map(anchors.map(function (anchor) { return [anchor.id, anchor]; }));
  const expected = new Map();
  function addExpected(anchorId, routeId) {
    if (!expected.has(anchorId)) expected.set(anchorId, []);
    expected.get(anchorId).push(routeId);
  }
  for (const route of routes) {
    const entry = anchorById.get(route.entryAnchorId);
    const gate = anchorById.get(route.gateAnchorId);
    if (!entry || (entry.kind !== "entry" && entry.kind !== "breach")) {
      fail("MAP_ROUTE_ENTRY", "/routes/" + route.id + "/entryAnchorId", "Route entryAnchorId must resolve to entry or breach");
    }
    if (!gate || gate.kind !== "gate") fail("MAP_ROUTE_GATE", "/routes/" + route.id + "/gateAnchorId", "Route gateAnchorId must resolve to a gate");
    const firstLane = laneById.get(route.laneSegmentIds[0]);
    const lastLane = laneById.get(route.laneSegmentIds[route.laneSegmentIds.length - 1]);
    const first = firstLane.compiled.segments[0];
    const last = lastLane.compiled.segments[lastLane.compiled.segments.length - 1];
    if (entry.laneSegmentId !== firstLane.id || entry.x !== first.fromX || entry.y !== first.fromY) {
      fail("MAP_ROUTE_ENTRY", "/routes/" + route.id, "Route entry anchor must match its first directed lane point");
    }
    if (gate.laneSegmentId !== lastLane.id || gate.x !== last.toX || gate.y !== last.toY) {
      fail("MAP_ROUTE_GATE", "/routes/" + route.id, "Route gate anchor must match its last directed lane point");
    }
    addExpected(entry.id, route.id);
    addExpected(gate.id, route.id);
  }
  for (const anchor of anchors) {
    if (anchor.kind === "large-prop") continue;
    const ids = (expected.get(anchor.id) || []).sort(asciiCompare);
    if (ids.length === 0 || JSON.stringify(ids) !== JSON.stringify(anchor.routeIds)) {
      fail("MAP_ANCHOR_ROUTES", "/anchors/" + anchor.id + "/routeIds", "Endpoint anchor routeIds must equal every route using that endpoint");
    }
  }
}

function validateCrossing(value, index, laneById) {
  const path = "/crossings/" + index;
  const common = ["id", "kind", "laneAId", "subsegmentAIndex", "laneBId", "subsegmentBIndex"];
  exactKeys(value, common.concat(["upperLayerId"]), common, path, "crossing");
  const id = stableId(value.id, path + "/id", "Crossing ID");
  const kind = enumValue(value.kind, CROSSING_KINDS, path + "/kind", "crossing kind");
  const laneAId = stableId(value.laneAId, path + "/laneAId", "Crossing lane A ID");
  const laneBId = stableId(value.laneBId, path + "/laneBId", "Crossing lane B ID");
  const laneA = laneById.get(laneAId);
  const laneB = laneById.get(laneBId);
  if (!laneA) fail("MAP_LANE_REFERENCE", path + "/laneAId", "Unknown crossing lane " + laneAId);
  if (!laneB) fail("MAP_LANE_REFERENCE", path + "/laneBId", "Unknown crossing lane " + laneBId);
  if (laneA.kind !== "ground" || laneB.kind !== "ground") fail("MAP_CROSSING_KIND", path, "Crossings apply only to ground physical lanes");
  const subsegmentAIndex = nonnegativeInteger(value.subsegmentAIndex, path + "/subsegmentAIndex", "Crossing subsegment A index");
  const subsegmentBIndex = nonnegativeInteger(value.subsegmentBIndex, path + "/subsegmentBIndex", "Crossing subsegment B index");
  if (subsegmentAIndex >= laneA.compiled.segments.length) fail("MAP_SUBSEGMENT_REFERENCE", path + "/subsegmentAIndex", "Unknown crossing subsegment A");
  if (subsegmentBIndex >= laneB.compiled.segments.length) fail("MAP_SUBSEGMENT_REFERENCE", path + "/subsegmentBIndex", "Unknown crossing subsegment B");
  if (asciiCompare(laneAId, laneBId) > 0 || (laneAId === laneBId && subsegmentAIndex >= subsegmentBIndex)) {
    fail("MAP_UNSTABLE_CROSSING", path, "Crossing lane/subsegment pairs must be canonical");
  }
  let upperLayerId;
  if (kind === "overpass") {
    if (!Object.prototype.hasOwnProperty.call(value, "upperLayerId")) fail("MAP_MISSING_KEY", path + "/upperLayerId", "Overpass requires upperLayerId");
    upperLayerId = stableId(value.upperLayerId, path + "/upperLayerId", "Upper layer ID");
    if (laneA.layerId === laneB.layerId || (upperLayerId !== laneA.layerId && upperLayerId !== laneB.layerId)) {
      fail("MAP_OVERPASS_LAYER", path, "Overpass lanes must use distinct layers and name one upper layer");
    }
  } else {
    if (Object.prototype.hasOwnProperty.call(value, "upperLayerId")) fail("MAP_UNKNOWN_KEY", path + "/upperLayerId", "At-grade crossing cannot name an upper layer");
    if (laneA.layerId !== laneB.layerId) fail("MAP_CROSSING_LAYER", path, "At-grade crossing lanes must share a layer");
  }
  const output = {
    id: id,
    kind: kind,
    laneAId: laneAId,
    subsegmentAIndex: subsegmentAIndex,
    laneBId: laneBId,
    subsegmentBIndex: subsegmentBIndex,
  };
  if (upperLayerId !== undefined) output.upperLayerId = upperLayerId;
  return output;
}

function orientation(a, b, c) {
  return (BigInt(b.x) - BigInt(a.x)) * (BigInt(c.y) - BigInt(a.y)) -
    (BigInt(b.y) - BigInt(a.y)) * (BigInt(c.x) - BigInt(a.x));
}

function sign(value) {
  return value < 0n ? -1 : (value > 0n ? 1 : 0);
}

function between(value, first, second) {
  return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function onSegment(a, b, point) {
  return orientation(a, b, point) === 0n && between(point.x, a.x, b.x) && between(point.y, a.y, b.y);
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
    const low = Math.max(Math.min(a0, a1), Math.min(b0, b1));
    const high = Math.min(Math.max(a0, a1), Math.max(b0, b1));
    if (low > high) return "none";
    return low < high ? "overlap" : "endpoint";
  }
  if (sign(o1) * sign(o2) < 0 && sign(o3) * sign(o4) < 0) return "proper";
  if ((o1 === 0n && onSegment(a, b, c)) || (o2 === 0n && onSegment(a, b, d)) ||
      (o3 === 0n && onSegment(c, d, a)) || (o4 === 0n && onSegment(c, d, b))) return "endpoint";
  return "none";
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

function rationalLess(left, right) {
  return left.numerator * right.denominator < right.numerator * left.denominator;
}

function segmentDistanceRational(left, right) {
  const candidates = [
    pointSegmentDistanceRational(left.fromX, left.fromY, right),
    pointSegmentDistanceRational(left.toX, left.toY, right),
    pointSegmentDistanceRational(right.fromX, right.fromY, left),
    pointSegmentDistanceRational(right.toX, right.toY, left),
  ];
  let nearest = candidates[0];
  for (let index = 1; index < candidates.length; index++) if (rationalLess(candidates[index], nearest)) nearest = candidates[index];
  return nearest;
}

function rationalAtLeast(value, distance) {
  return value.numerator >= BigInt(distance) * BigInt(distance) * value.denominator;
}

function pairKey(laneAId, indexA, laneBId, indexB) {
  return laneAId + ":" + indexA + "|" + laneBId + ":" + indexB;
}

function canonicalGeometrySignature(lane) {
  const points = [];
  const segments = lane.compiled.segments;
  points.push([segments[0].fromX, segments[0].fromY]);
  for (const segment of segments) points.push([segment.toX, segment.toY]);
  const forward = JSON.stringify(points);
  const reverse = JSON.stringify(points.slice().reverse());
  return asciiCompare(forward, reverse) <= 0 ? forward : reverse;
}

function joinForIncidentPair(leftLane, leftSegment, rightLane, rightSegment, joins) {
  for (const join of joins) {
    const leftIncoming = join.incomingLaneSegmentIds.includes(leftLane.id) && leftSegment.index === leftLane.compiled.segments.length - 1;
    const leftOutgoing = join.outgoingLaneSegmentIds.includes(leftLane.id) && leftSegment.index === 0;
    const rightIncoming = join.incomingLaneSegmentIds.includes(rightLane.id) && rightSegment.index === rightLane.compiled.segments.length - 1;
    const rightOutgoing = join.outgoingLaneSegmentIds.includes(rightLane.id) && rightSegment.index === 0;
    if ((leftIncoming || leftOutgoing) && (rightIncoming || rightOutgoing)) return join;
  }
  return null;
}

function sharedJoinForLanes(leftLaneId, rightLaneId, joins) {
  for (const join of joins) {
    const members = join.incomingLaneSegmentIds.concat(join.outgoingLaneSegmentIds);
    if (members.includes(leftLaneId) && members.includes(rightLaneId)) return join;
  }
  return null;
}

function rayAwayFromJoin(lane, segment, join) {
  if (segment.toX === join.x && segment.toY === join.y) return { x: -segment.deltaX, y: -segment.deltaY, length: segment.length };
  if (segment.fromX === join.x && segment.fromY === join.y) return { x: segment.deltaX, y: segment.deltaY, length: segment.length };
  return null;
}

function validateJoinNeighborhood(leftLane, leftSegment, rightLane, rightSegment, join) {
  const left = rayAwayFromJoin(leftLane, leftSegment, join);
  const right = rayAwayFromJoin(rightLane, rightSegment, join);
  if (!left || !right || left.length < 12000 || right.length < 12000) {
    fail("MAP_JOIN_NEIGHBORHOOD", "/joins/" + join.id, "Join collision exception must be provably contained inside the closed 12-unit neighborhood");
  }
  const dot = BigInt(left.x) * BigInt(right.x) + BigInt(left.y) * BigInt(right.y);
  if (dot <= 0n) return;
  const leftSquared = BigInt(left.x) * BigInt(left.x) + BigInt(left.y) * BigInt(left.y);
  const rightSquared = BigInt(right.x) * BigInt(right.x) + BigInt(right.y) * BigInt(right.y);
  if (4n * dot * dot > leftSquared * rightSquared) {
    fail("MAP_JOIN_NEIGHBORHOOD", "/joins/" + join.id, "Converging road masks remain within road width outside the join neighborhood");
  }
}

function validatePhysicalTopology(lanes, joins, crossings) {
  const signatureOwner = new Map();
  for (const lane of lanes) {
    const signature = canonicalGeometrySignature(lane);
    if (signatureOwner.has(signature)) {
      fail("MAP_DUPLICATE_PHYSICAL_GEOMETRY", "/laneSegments/" + lane.id, "Physical geometry duplicates lane " + signatureOwner.get(signature));
    }
    signatureOwner.set(signature, lane.id);
  }
  const crossingByPair = new Map();
  for (const crossing of crossings) {
    const key = pairKey(crossing.laneAId, crossing.subsegmentAIndex, crossing.laneBId, crossing.subsegmentBIndex);
    if (crossingByPair.has(key)) fail("MAP_DUPLICATE_CROSSING", "/crossings", "Duplicate physical crossing " + key);
    crossingByPair.set(key, crossing);
  }
  const usedCrossings = new Set();
  function inspect(leftLane, leftSegment, rightLane, rightSegment, adjacent) {
    const relationship = segmentRelationship(leftSegment, rightSegment);
    const key = pairKey(leftLane.id, leftSegment.index, rightLane.id, rightSegment.index);
    const declaration = crossingByPair.get(key);
    if (adjacent) return;
    if (relationship === "overlap") {
      fail("MAP_PHYSICAL_OVERLAP", "/laneSegments", "Physical subsegments overlap under distinct identities at " + key);
    }
    const join = leftLane.id === rightLane.id ? null : joinForIncidentPair(leftLane, leftSegment, rightLane, rightSegment, joins);
    if (relationship === "proper") {
      if (leftLane.kind !== "ground" || rightLane.kind !== "ground") {
        if (declaration) fail("MAP_CROSSING_KIND", "/crossings/" + declaration.id, "Non-ground point contacts are not road crossings");
        return;
      }
      if (!declaration) fail("MAP_UNDECLARED_CROSSING", "/laneSegments", "Physical point crossing requires an exact declaration at " + key);
      usedCrossings.add(key);
      return;
    }
    if (relationship === "endpoint") {
      if (join) {
        if (declaration) fail("MAP_CROSSING_JOIN", "/crossings/" + declaration.id, "A join cannot also be encoded as a crossing");
        if (leftLane.kind === "ground" && rightLane.kind === "ground") {
          validateJoinNeighborhood(leftLane, leftSegment, rightLane, rightSegment, join);
        }
        return;
      }
      if (leftLane.kind !== "ground" || rightLane.kind !== "ground") return;
      if (leftLane.id === rightLane.id) {
        if (!declaration) fail("MAP_UNDECLARED_CROSSING", "/laneSegments/" + leftLane.id, "Nonadjacent lane self-contact requires a crossing declaration");
        usedCrossings.add(key);
        return;
      }
      fail("MAP_UNDECLARED_JOIN", "/laneSegments", "Lane endpoint contact requires one declared join at " + key);
    }
    if (declaration) return;
    if (leftLane.kind !== "ground" || rightLane.kind !== "ground") return;
    const distance = segmentDistanceRational(leftSegment, rightSegment);
    if (!rationalAtLeast(distance, 12000)) {
      if (leftLane.id === rightLane.id) fail("MAP_ROAD_SELF_COLLISION", "/laneSegments/" + leftLane.id, "Nonadjacent road buffers collide");
      if (leftLane.layerId === rightLane.layerId) {
        const relatedJoin = sharedJoinForLanes(leftLane.id, rightLane.id, joins);
        if (relatedJoin) fail("MAP_JOIN_NEIGHBORHOOD", "/joins/" + relatedJoin.id, "Joined road masks collide outside the closed join neighborhood");
        fail("MAP_LANE_OVERLAP", "/laneSegments", "Same-layer road buffers collide outside a join");
      }
    }
  }
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
    const leftLane = lanes[laneIndex];
    for (let first = 0; first < leftLane.compiled.segments.length; first++) {
      for (let second = first + 1; second < leftLane.compiled.segments.length; second++) {
        inspect(leftLane, leftLane.compiled.segments[first], leftLane, leftLane.compiled.segments[second], second === first + 1);
      }
    }
    for (let otherIndex = laneIndex + 1; otherIndex < lanes.length; otherIndex++) {
      const rightLane = lanes[otherIndex];
      for (const leftSegment of leftLane.compiled.segments) {
        for (const rightSegment of rightLane.compiled.segments) inspect(leftLane, leftSegment, rightLane, rightSegment, false);
      }
    }
  }
  for (const key of crossingByPair.keys()) {
    if (!usedCrossings.has(key)) fail("MAP_STALE_CROSSING", "/crossings", "Crossing does not identify one geometric point crossing: " + key);
  }
}

function validatePad(value, index, routeById) {
  const path = "/pads/" + index;
  exactKeys(value, ["id", "kind", "column", "row", "intent", "declaredQuality", "claimedRouteIds", "selectionOrder"],
    ["id", "kind", "column", "row", "intent", "declaredQuality", "claimedRouteIds", "selectionOrder"], path, "pad");
  const id = stableId(value.id, path + "/id", "Pad ID");
  const kind = enumValue(value.kind, PAD_KINDS, path + "/kind", "pad kind");
  const column = safeInteger(value.column, path + "/column", "Pad column");
  const row = safeInteger(value.row, path + "/row", "Pad row");
  if (!isInBoard(column, row)) fail("MAP_GRID_BOUNDS", path, "Pad must be inside the board");
  const center = Geometry.cellCenterMilli(column, row, false);
  const intent = enumValue(value.intent, PAD_INTENTS, path + "/intent", "pad intent");
  const declaredQuality = enumValue(value.declaredQuality, PAD_QUALITIES, path + "/declaredQuality", "declared quality");
  const claimedRouteIds = idArray(value.claimedRouteIds, path + "/claimedRouteIds", "Claimed route IDs", false);
  for (const routeId of claimedRouteIds) if (!routeById.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/claimedRouteIds", "Unknown claimed route " + routeId);
  const selectionOrder = nonnegativeInteger(value.selectionOrder, path + "/selectionOrder", "Pad selection order");
  return {
    id: id,
    kind: kind,
    column: column,
    row: row,
    x: center.x,
    y: center.y,
    intent: intent,
    declaredQuality: declaredQuality,
    claimedRouteIds: claimedRouteIds,
    selectionOrder: selectionOrder,
  };
}

function validateSelectionOrders(pads) {
  const seen = new Set();
  for (let index = 0; index < pads.length; index++) {
    const order = pads[index].selectionOrder;
    if (order >= pads.length || seen.has(order)) fail("MAP_SELECTION_ORDER", "/pads/" + index + "/selectionOrder", "Selection orders must be unique contiguous 0..padCount-1");
    seen.add(order);
  }
}

function validateExclusion(value, index) {
  const path = "/exclusions/" + index;
  exactKeys(value, ["id", "kind", "column", "row", "radiusWorldUnits"],
    ["id", "kind", "column", "row", "radiusWorldUnits"], path, "exclusion");
  const id = stableId(value.id, path + "/id", "Exclusion ID");
  if (value.kind !== "circle") fail("MAP_ENUM", path + "/kind", "Only circle exclusions are supported");
  const column = safeInteger(value.column, path + "/column", "Exclusion column");
  const row = safeInteger(value.row, path + "/row", "Exclusion row");
  if (!isInBoard(column, row)) fail("MAP_GRID_BOUNDS", path, "Exclusion center must be in bounds");
  const center = Geometry.cellCenterMilli(column, row, false);
  const radiusWorldUnits = positiveInteger(value.radiusWorldUnits, path + "/radiusWorldUnits", "Exclusion radius");
  if (radiusWorldUnits > 1000000) fail("MAP_LIMIT", path + "/radiusWorldUnits", "Exclusion radius exceeds authored bounds");
  return {
    id: id,
    kind: "circle",
    column: column,
    row: row,
    x: center.x,
    y: center.y,
    radiusWorldUnits: radiusWorldUnits,
    radiusMilliUnits: multiplySafe(radiusWorldUnits, 1000, path + "/radiusWorldUnits", "Exclusion radius"),
  };
}

function validateProbe(value, index, routeById) {
  const path = "/probes/" + index;
  exactKeys(value, ["id", "rangeWorldUnits", "targetKinds", "routeIds", "baselineMilliUnits"],
    ["id", "rangeWorldUnits", "targetKinds", "routeIds"], path, "probe");
  const id = stableId(value.id, path + "/id", "Probe ID");
  const rangeWorldUnits = positiveInteger(value.rangeWorldUnits, path + "/rangeWorldUnits", "Probe range");
  if (rangeWorldUnits > 1000000) fail("MAP_LIMIT", path + "/rangeWorldUnits", "Probe range exceeds authored bounds");
  const targetKinds = idArray(value.targetKinds, path + "/targetKinds", "Probe target kinds", false);
  for (const kind of targetKinds) enumValue(kind, LANE_KINDS, path + "/targetKinds", "target kind");
  const routeIds = idArray(value.routeIds, path + "/routeIds", "Probe route IDs", false);
  for (const routeId of routeIds) if (!routeById.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/routeIds", "Unknown probe route " + routeId);
  let baselineMilliUnits = null;
  if (Object.prototype.hasOwnProperty.call(value, "baselineMilliUnits")) {
    baselineMilliUnits = positiveInteger(value.baselineMilliUnits, path + "/baselineMilliUnits", "Probe baseline");
    if (baselineMilliUnits > 1000000) fail("MAP_LIMIT", path + "/baselineMilliUnits", "Probe baseline exceeds authored bounds");
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

function validateReview(value, probeById) {
  exactKeys(value, ["entryProbeId", "qualityProbeId", "minimumEntryExposureMilliUnits", "maximumSpread", "selectionOrderPolicy"],
    ["entryProbeId", "qualityProbeId", "minimumEntryExposureMilliUnits", "maximumSpread", "selectionOrderPolicy"], "/review", "review");
  const entryProbeId = stableId(value.entryProbeId, "/review/entryProbeId", "Entry probe ID");
  const qualityProbeId = stableId(value.qualityProbeId, "/review/qualityProbeId", "Quality probe ID");
  if (!probeById.has(entryProbeId)) fail("MAP_PROBE_REFERENCE", "/review/entryProbeId", "Unknown entry probe");
  if (!probeById.has(qualityProbeId)) fail("MAP_PROBE_REFERENCE", "/review/qualityProbeId", "Unknown quality probe");
  if (probeById.get(qualityProbeId).baselineMilliUnits === null) fail("MAP_QUALITY_BASELINE", "/review/qualityProbeId", "Quality probe requires a baseline");
  const minimum = positiveInteger(value.minimumEntryExposureMilliUnits, "/review/minimumEntryExposureMilliUnits", "Minimum entry exposure");
  if (minimum < ExistingValidation.POLICY.minimumOrdinaryExposureMilliUnits) {
    fail("MAP_ENTRY_EXPOSURE_POLICY", "/review/minimumEntryExposureMilliUnits", "Entry exposure cannot be below 18000 milli-units");
  }
  exactKeys(value.maximumSpread, ["numerator", "denominator"], ["numerator", "denominator"], "/review/maximumSpread", "spread limit");
  const numerator = positiveInteger(value.maximumSpread.numerator, "/review/maximumSpread/numerator", "Spread numerator");
  const denominator = positiveInteger(value.maximumSpread.denominator, "/review/maximumSpread/denominator", "Spread denominator");
  if (value.selectionOrderPolicy !== "route-stage-route-id-pad-id") {
    fail("MAP_SELECTION_POLICY", "/review/selectionOrderPolicy", "Map v2 selection policy is fixed");
  }
  return {
    entryProbeId: entryProbeId,
    qualityProbeId: qualityProbeId,
    minimumEntryExposureMilliUnits: minimum,
    maximumSpread: { numerator: numerator, denominator: denominator },
    selectionOrderPolicy: "route-stage-route-id-pad-id",
  };
}

function pointDistanceSquared(x1, y1, x2, y2) {
  const dx = BigInt(x1) - BigInt(x2);
  const dy = BigInt(y1) - BigInt(y2);
  return dx * dx + dy * dy;
}

function rationalFloorDistance(value) {
  return checkedNumber(Geometry.integerSqrtFloor(value.numerator / value.denominator), "/distance", "Distance");
}

function validatePadClearances(pads, lanes, anchors, exclusions) {
  const groundSegments = [];
  for (const lane of lanes) if (lane.kind === "ground") groundSegments.push.apply(groundSegments, lane.compiled.segments);
  if (groundSegments.length === 0) fail("MAP_GROUND_ROUTE", "/laneSegments", "Map requires at least one ground lane");
  return pads.map(function (pad, index) {
    const inset = Math.min(pad.x, pad.y, 160000 - pad.x, 100000 - pad.y);
    if (inset < ExistingValidation.POLICY.boardInsetMilliUnits) fail("MAP_BOARD_INSET", "/pads/" + index, "Pad center must satisfy board inset");
    let laneDistance = null;
    for (const segment of groundSegments) {
      const value = pointSegmentDistanceRational(pad.x, pad.y, segment);
      if (laneDistance === null || rationalLess(value, laneDistance)) laneDistance = value;
    }
    if (pad.kind === "ordinary" && !rationalAtLeast(laneDistance, ExistingValidation.POLICY.ordinaryLaneClearanceMilliUnits)) {
      fail("MAP_LANE_CLEARANCE", "/pads/" + index, "Ordinary pad must clear every ground lane by 16000 milli-units");
    }
    let nearestPadSquared = null;
    for (let other = 0; other < pads.length; other++) {
      if (other === index) continue;
      const squared = pointDistanceSquared(pad.x, pad.y, pads[other].x, pads[other].y);
      if (nearestPadSquared === null || squared < nearestPadSquared) nearestPadSquared = squared;
      if (squared < BigInt(ExistingValidation.POLICY.padSpacingMilliUnits) ** 2n) {
        fail("MAP_PAD_SPACING", "/pads/" + index, "Pads must be at least 20000 milli-units apart");
      }
    }
    let declaredClearance = null;
    for (const anchor of anchors) {
      const squared = pointDistanceSquared(pad.x, pad.y, anchor.x, anchor.y);
      const candidate = { numerator: squared, denominator: 1n };
      if (declaredClearance === null || rationalLess(candidate, declaredClearance)) declaredClearance = candidate;
      if (squared < BigInt(ExistingValidation.POLICY.anchorClearanceMilliUnits) ** 2n) {
        fail("MAP_ANCHOR_CLEARANCE", "/pads/" + index, "Pad must clear endpoint/prop anchors by 20000 milli-units");
      }
    }
    for (const exclusion of exclusions) {
      const squared = pointDistanceSquared(pad.x, pad.y, exclusion.x, exclusion.y);
      const required = exclusion.radiusMilliUnits + ExistingValidation.POLICY.anchorClearanceMilliUnits;
      if (squared < BigInt(required) ** 2n) fail("MAP_EXCLUSION_CLEARANCE", "/pads/" + index, "Pad must clear an exclusion boundary");
      const centerDistance = Geometry.integerSqrtFloor(squared);
      const boundaryDistance = centerDistance > BigInt(exclusion.radiusMilliUnits) ? centerDistance - BigInt(exclusion.radiusMilliUnits) : 0n;
      const candidate = { numerator: boundaryDistance * boundaryDistance, denominator: 1n };
      if (declaredClearance === null || rationalLess(candidate, declaredClearance)) declaredClearance = candidate;
    }
    return {
      id: pad.id,
      boardInsetMilliUnits: inset,
      minimumLaneClearanceMilliUnits: rationalFloorDistance(laneDistance),
      minimumPadSpacingMilliUnits: nearestPadSquared === null ? null : checkedNumber(Geometry.integerSqrtFloor(nearestPadSquared), "/pads", "Pad spacing"),
      minimumDeclaredClearanceMilliUnits: declaredClearance === null ? null : rationalFloorDistance(declaredClearance),
    };
  });
}

function validateMapV2(source, options) {
  inspectPlainTree(source, "/", new WeakSet(), 0);
  exactKeys(source,
    ["schemaVersion", "id", "title", "sourceKind", "board", "road", "laneSegments", "routes", "joins", "crossings", "pads", "anchors", "exclusions", "probes", "roleProofs", "review"],
    ["schemaVersion", "id", "title", "sourceKind", "board", "road", "laneSegments", "routes", "joins", "crossings", "pads", "anchors", "exclusions", "probes", "roleProofs", "review"],
    "/", "map-v2");
  if (source.schemaVersion !== 2) fail("MAP_SCHEMA_VERSION", "/schemaVersion", "Map-v2 schemaVersion must equal 2");
  const id = stableId(source.id, "/id", "Map ID");
  ExistingValidation.requireHumanText(source.title, "/title", "Map title");
  if (Buffer.byteLength(source.title, "utf8") > 1024) fail("MAP_STRING", "/title", "Map title must be at most 1024 UTF-8 bytes");
  if (source.sourceKind !== "campaign") fail("MAP_SOURCE_KIND", "/sourceKind", "Map-v2 sourceKind must equal campaign");
  const board = validateBoard(source.board);
  const road = validateRoad(source.road);

  requireArray(source.laneSegments, "/laneSegments", "Lane segments", 1, LIMITS.laneSegments);
  const lanes = source.laneSegments.map(validateLane);
  orderedRecords(lanes, "/laneSegments", "Lane-segment");
  const laneById = new Map(lanes.map(function (lane) { return [lane.id, lane]; }));

  requireArray(source.joins, "/joins", "Joins", 0, LIMITS.joins);
  const joins = source.joins.map(function (join, index) { return validateJoin(join, index, laneById); });
  orderedRecords(joins, "/joins", "Join");
  const transitionIndex = buildTransitionIndex(joins);

  requireArray(source.routes, "/routes", "Routes", 1, LIMITS.routes);
  const usedTransitions = new Set();
  const routes = source.routes.map(function (route, index) { return validateRoute(route, index, laneById, transitionIndex, usedTransitions); });
  orderedRecords(routes, "/routes", "Route");
  const routeById = new Map(routes.map(function (route) { return [route.id, route]; }));
  const usedLaneIds = new Set();
  for (const route of routes) for (const laneId of route.laneSegmentIds) usedLaneIds.add(laneId);
  for (const lane of lanes) if (!usedLaneIds.has(lane.id)) fail("MAP_UNUSED_LANE", "/laneSegments/" + lane.id, "Every physical lane must belong to a logical route");
  for (const [key, join] of transitionIndex) {
    if (!usedTransitions.has(key)) fail("MAP_STALE_JOIN", "/joins/" + join.id, "Declared join transition is not traversed by a logical route: " + key);
  }

  requireArray(source.anchors, "/anchors", "Anchors", 1, 128);
  const anchors = source.anchors.map(function (anchor, index) { return validateAnchor(anchor, index, laneById, routeById); });
  orderedRecords(anchors, "/anchors", "Anchor");
  validateRouteAnchors(routes, anchors, laneById);

  requireArray(source.crossings, "/crossings", "Crossings", 0, LIMITS.crossings);
  const crossings = source.crossings.map(function (crossing, index) { return validateCrossing(crossing, index, laneById); });
  orderedRecords(crossings, "/crossings", "Crossing");
  validatePhysicalTopology(lanes, joins, crossings);

  requireArray(source.pads, "/pads", "Pads", 1, LIMITS.pads);
  const pads = source.pads.map(function (pad, index) { return validatePad(pad, index, routeById); });
  orderedRecords(pads, "/pads", "Pad");
  validateSelectionOrders(pads);

  requireArray(source.exclusions, "/exclusions", "Exclusions", 0, LIMITS.exclusions);
  const exclusions = source.exclusions.map(validateExclusion);
  orderedRecords(exclusions, "/exclusions", "Exclusion");

  requireArray(source.probes, "/probes", "Probes", 1, LIMITS.probes);
  const probes = source.probes.map(function (probe, index) { return validateProbe(probe, index, routeById); });
  orderedRecords(probes, "/probes", "Probe");
  const probeById = new Map(probes.map(function (probe) { return [probe.id, probe]; }));
  const review = validateReview(source.review, probeById);

  const padClearances = validatePadClearances(pads, lanes, anchors, exclusions);
  const routeIdsByLane = new Map(lanes.map(function (lane) { return [lane.id, []]; }));
  for (const route of routes) for (const laneId of route.laneSegmentIds) routeIdsByLane.get(laneId).push(route.id);
  const outputLanes = lanes.map(function (lane) {
    return {
      id: lane.id,
      kind: lane.kind,
      layerId: lane.layerId,
      nodes: lane.nodes,
      compiled: lane.compiled,
      routeIds: routeIdsByLane.get(lane.id).slice().sort(asciiCompare),
    };
  });
  const analysisInput = {
    laneSegments: outputLanes,
    routes: routes,
    pads: pads,
    probes: probes,
    review: review,
    road: road,
  };
  const analysis = Selection.analyzeRouteLocalMap(analysisInput);
  const proofSet = RoleProofs.compileRoleProofSet(
    analysisInput,
    source.roleProofs,
    options && options.roleProofContext
  );
  return deepFreeze({
    schemaVersion: 2,
    id: id,
    title: source.title,
    sourceKind: "campaign",
    geometryPolicy: {
      roadWidthMilliUnits: 12000,
      roadHalfWidthMilliUnits: 6000,
      ordinaryLaneClearanceMilliUnits: ExistingValidation.POLICY.ordinaryLaneClearanceMilliUnits,
      padSpacingMilliUnits: ExistingValidation.POLICY.padSpacingMilliUnits,
      boardInsetMilliUnits: ExistingValidation.POLICY.boardInsetMilliUnits,
      anchorClearanceMilliUnits: ExistingValidation.POLICY.anchorClearanceMilliUnits,
      minimumOrdinaryExposureMilliUnits: ExistingValidation.POLICY.minimumOrdinaryExposureMilliUnits,
    },
    board: board,
    road: road,
    laneSegments: outputLanes,
    routes: routes,
    joins: joins,
    crossings: crossings,
    pads: pads,
    anchors: anchors,
    exclusions: exclusions,
    probes: probes,
    roleProofs: proofSet.roleProofs,
    review: review,
    padClearances: padClearances,
    analysis: analysis,
    intentProofChecks: proofSet.intentProofChecks,
  });
}

module.exports = Object.freeze({
  validateMapV2: validateMapV2,
});
