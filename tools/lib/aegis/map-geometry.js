"use strict";

const { fail } = require("./diagnostics.js");

const GRID = Object.freeze({
  columns: 40,
  rows: 25,
  cellWorldUnits: 4,
  distanceScale: 1000,
  cellMilliUnits: 4000,
  centerOffsetMilli: 2000,
});
const ANALYSIS_SUBUNITS_PER_MILLI = 1000000;
const ANALYSIS_SCALE_BIG = BigInt(ANALYSIS_SUBUNITS_PER_MILLI);
const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const ROUTE_FIELDS = Object.freeze(["id", "length", "segments"]);
const SEGMENT_FIELDS = Object.freeze([
  "id", "index", "start", "length", "fromX", "fromY", "toX", "toY", "deltaX", "deltaY",
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireObject(value, path, label) {
  if (!isPlainObject(value)) fail("MAP_OBJECT", path, label + " must be a plain object");
  return value;
}

function exactKeys(value, allowed, required, path, label) {
  requireObject(value, path, label);
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

function stableId(value, path, label) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    fail("MAP_STABLE_ID", path, label + " must be a stable ASCII ID");
  }
  return value;
}

function asciiCompare(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function checkedNumber(value, path, label) {
  if (value > MAX_SAFE_BIG || value < -MAX_SAFE_BIG) {
    fail("MAP_SAFE_INTEGER", path, label + " exceeds the safe-integer range");
  }
  return Number(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function integerSqrtFloor(value) {
  if (typeof value !== "bigint" || value < 0n) {
    throw new TypeError("integerSqrtFloor requires a nonnegative BigInt");
  }
  if (value < 2n) return value;
  const bitLength = value.toString(2).length;
  let estimate = 1n << BigInt((bitLength + 1) >> 1);
  while (true) {
    const next = (estimate + value / estimate) >> 1n;
    if (next >= estimate) return estimate;
    estimate = next;
  }
}

function floorDiv(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError("floorDiv denominator must be positive");
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder !== 0n && numerator < 0n) quotient -= 1n;
  return quotient;
}

function ceilDiv(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError("ceilDiv denominator must be positive");
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder !== 0n && numerator > 0n) quotient += 1n;
  return quotient;
}

function roundHalfUpNonnegative(numerator, denominator) {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError("roundHalfUpNonnegative requires a nonnegative numerator and positive denominator");
  }
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function isInGrid(column, row) {
  return column >= 0 && column < GRID.columns && row >= 0 && row < GRID.rows;
}

function centeredCoordinate(cell, path, label) {
  safeInteger(cell, path, label);
  return checkedNumber(
    BigInt(cell) * BigInt(GRID.cellMilliUnits) + BigInt(GRID.centerOffsetMilli),
    path,
    label + " center"
  );
}

function cellCenterMilli(column, row, allowOutside) {
  safeInteger(column, "/column", "Grid column");
  safeInteger(row, "/row", "Grid row");
  if (!allowOutside && !isInGrid(column, row)) {
    fail("MAP_GRID_BOUNDS", "/", "Grid cell must be inside the 40x25 board bounds");
  }
  return Object.freeze({
    x: centeredCoordinate(column, "/column", "Grid column"),
    y: centeredCoordinate(row, "/row", "Grid row"),
  });
}

function normalizedNode(node, index, count, path) {
  exactKeys(node, ["column", "row", "portal"], ["column", "row"], path, "route node");
  const column = safeInteger(node.column, path + "/column", "Route-node column");
  const row = safeInteger(node.row, path + "/row", "Route-node row");
  const inside = isInGrid(column, row);
  const portal = node.portal === true;
  if (node.portal !== undefined && typeof node.portal !== "boolean") {
    fail("MAP_PORTAL", path + "/portal", "Route-node portal must be boolean");
  }
  if (!inside && !portal) {
    fail("MAP_PORTAL", path, "An off-board route node must be declared as a portal");
  }
  if (portal && index !== 0 && index !== count - 1) {
    fail("MAP_PORTAL_ENDPOINT", path, "An off-board portal is permitted only at a route endpoint");
  }
  if (portal && inside) {
    fail("MAP_PORTAL_BOUNDS", path, "A portal marker is reserved for an off-board route endpoint");
  }
  const center = cellCenterMilli(column, row, true);
  return { x: center.x, y: center.y };
}

function compileRoute(source) {
  exactKeys(source, ["id", "nodes"], ["id", "nodes"], "/route", "route");
  const id = stableId(source.id, "/route/id", "Route ID");
  if (!Array.isArray(source.nodes) || source.nodes.length < 2) {
    fail("MAP_ROUTE_NODES", "/route/nodes", "Route nodes must contain at least two grid cells");
  }
  const points = source.nodes.map(function (node, index) {
    return normalizedNode(node, index, source.nodes.length, "/route/nodes/" + index);
  });
  const segments = [];
  let start = 0n;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    const deltaX = BigInt(to.x) - BigInt(from.x);
    const deltaY = BigInt(to.y) - BigInt(from.y);
    const squared = deltaX * deltaX + deltaY * deltaY;
    if (squared === 0n) {
      fail("MAP_ZERO_SEGMENT", "/route/nodes/" + (index + 1), "Consecutive route nodes must be distinct; zero-length segments are forbidden");
    }
    const length = integerSqrtFloor(squared);
    if (length === 0n) fail("MAP_ZERO_SEGMENT", "/route/nodes/" + (index + 1), "Compiled route segment length is zero");
    const segmentPath = "/route/segments/" + index;
    const segment = {
      id: id + ":s" + String(index).padStart(3, "0"),
      index: index,
      start: checkedNumber(start, segmentPath + "/start", "Segment start"),
      length: checkedNumber(length, segmentPath + "/length", "Segment length"),
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      deltaX: checkedNumber(deltaX, segmentPath + "/deltaX", "Segment delta X"),
      deltaY: checkedNumber(deltaY, segmentPath + "/deltaY", "Segment delta Y"),
    };
    segments.push(Object.freeze(segment));
    start += length;
  }
  return Object.freeze({
    id: id,
    length: checkedNumber(start, "/route/length", "Route length"),
    segments: Object.freeze(segments),
  });
}

function compilePad(source) {
  exactKeys(source, ["id", "column", "row"], ["id", "column", "row"], "/pad", "pad");
  const id = stableId(source.id, "/pad/id", "Pad ID");
  const column = safeInteger(source.column, "/pad/column", "Pad column");
  const row = safeInteger(source.row, "/pad/row", "Pad row");
  if (!isInGrid(column, row)) fail("MAP_GRID_BOUNDS", "/pad", "Pad grid cell must be inside the board bounds");
  const center = cellCenterMilli(column, row, false);
  return Object.freeze({ id: id, x: center.x, y: center.y });
}

function normalizeCompiledRoute(source, path) {
  exactKeys(source, ROUTE_FIELDS, ROUTE_FIELDS, path, "compiled route");
  const id = stableId(source.id, path + "/id", "Compiled route ID");
  positiveInteger(source.length, path + "/length", "Compiled route length");
  if (!Array.isArray(source.segments) || source.segments.length === 0) {
    fail("MAP_ROUTE_SEGMENTS", path + "/segments", "Compiled route requires non-empty segments");
  }
  const segments = [];
  const segmentIds = new Set();
  let expectedStart = 0;
  let previousTo = null;
  for (let index = 0; index < source.segments.length; index++) {
    const input = source.segments[index];
    const segmentPath = path + "/segments/" + index;
    exactKeys(input, SEGMENT_FIELDS, SEGMENT_FIELDS, segmentPath, "compiled segment");
    const segmentId = stableId(input.id, segmentPath + "/id", "Segment ID");
    if (segmentIds.has(segmentId)) fail("MAP_DUPLICATE_ID", segmentPath + "/id", "Duplicate segment ID " + segmentId);
    segmentIds.add(segmentId);
    if (input.index !== index) fail("MAP_SEGMENT_INDEX", segmentPath + "/index", "Segment index must equal authored order");
    const start = nonnegativeInteger(input.start, segmentPath + "/start", "Segment start");
    const length = positiveInteger(input.length, segmentPath + "/length", "Segment length");
    if (start !== expectedStart) fail("MAP_SEGMENT_START", segmentPath + "/start", "Segment starts must be contiguous");
    const fromX = safeInteger(input.fromX, segmentPath + "/fromX", "Segment fromX");
    const fromY = safeInteger(input.fromY, segmentPath + "/fromY", "Segment fromY");
    const toX = safeInteger(input.toX, segmentPath + "/toX", "Segment toX");
    const toY = safeInteger(input.toY, segmentPath + "/toY", "Segment toY");
    const deltaX = safeInteger(input.deltaX, segmentPath + "/deltaX", "Segment deltaX");
    const deltaY = safeInteger(input.deltaY, segmentPath + "/deltaY", "Segment deltaY");
    if (BigInt(toX) - BigInt(fromX) !== BigInt(deltaX) || BigInt(toY) - BigInt(fromY) !== BigInt(deltaY)) {
      fail("MAP_SEGMENT_DELTA", segmentPath, "Segment deltas must equal endpoint differences");
    }
    const squared = BigInt(deltaX) * BigInt(deltaX) + BigInt(deltaY) * BigInt(deltaY);
    if (squared === 0n || integerSqrtFloor(squared) !== BigInt(length)) {
      fail("MAP_SEGMENT_LENGTH", segmentPath + "/length", "Segment length must equal floor integer square root of displacement squared");
    }
    if (previousTo && (previousTo.x !== fromX || previousTo.y !== fromY)) {
      fail("MAP_SEGMENT_CONTIGUITY", segmentPath, "Segment endpoints must be spatially contiguous");
    }
    segments.push(Object.freeze({
      id: segmentId,
      index: index,
      start: start,
      length: length,
      fromX: fromX,
      fromY: fromY,
      toX: toX,
      toY: toY,
      deltaX: deltaX,
      deltaY: deltaY,
    }));
    expectedStart = checkedNumber(BigInt(start) + BigInt(length), segmentPath, "Segment end");
    previousTo = { x: toX, y: toY };
  }
  if (expectedStart !== source.length) fail("MAP_ROUTE_LENGTH", path + "/length", "Route length must equal the final segment end");
  return Object.freeze({ id: id, length: source.length, segments: Object.freeze(segments) });
}

function normalizePad(source, path) {
  exactKeys(source, ["id", "x", "y"], ["id", "x", "y"], path, "compiled pad");
  return Object.freeze({
    id: stableId(source.id, path + "/id", "Pad ID"),
    x: safeInteger(source.x, path + "/x", "Pad X"),
    y: safeInteger(source.y, path + "/y", "Pad Y"),
  });
}

function quadraticValueAtSubunit(a, b, c, localSubunits) {
  return a * localSubunits * localSubunits +
    b * localSubunits * ANALYSIS_SCALE_BIG +
    c * ANALYSIS_SCALE_BIG * ANALYSIS_SCALE_BIG;
}

function segmentCircleCoverage(route, segment, pad, range) {
  const length = BigInt(segment.length);
  const deltaX = BigInt(segment.deltaX);
  const deltaY = BigInt(segment.deltaY);
  const fromPadX = BigInt(segment.fromX) - BigInt(pad.x);
  const fromPadY = BigInt(segment.fromY) - BigInt(pad.y);
  const rangeBig = BigInt(range);
  const a = deltaX * deltaX + deltaY * deltaY;
  const dot = deltaX * fromPadX + deltaY * fromPadY;
  const b = 2n * length * dot;
  const c = length * length * (fromPadX * fromPadX + fromPadY * fromPadY - rangeBig * rangeBig);
  const discriminant = b * b - 4n * a * c;
  if (discriminant < 0n) return { windows: [], contacts: [] };

  const denominator = 2n * a;
  const segmentEndSubunits = length * ANALYSIS_SCALE_BIG;
  const routeStartSubunits = BigInt(segment.start) * ANALYSIS_SCALE_BIG;
  const contacts = [];

  if (discriminant === 0n) {
    const rootNumerator = -b;
    if (rootNumerator >= 0n && rootNumerator <= denominator * length) {
      const local = roundHalfUpNonnegative(rootNumerator * ANALYSIS_SCALE_BIG, denominator);
      contacts.push({ progress: routeStartSubunits + local, segmentId: segment.id });
    }
    return { windows: [], contacts: contacts };
  }

  const rootScaledFloor = integerSqrtFloor(
    discriminant * ANALYSIS_SCALE_BIG * ANALYSIS_SCALE_BIG
  );
  let lower = ceilDiv(-b * ANALYSIS_SCALE_BIG - rootScaledFloor, denominator);
  let upper = floorDiv(-b * ANALYSIS_SCALE_BIG + rootScaledFloor, denominator);
  if (upper < 0n || lower > segmentEndSubunits) return { windows: [], contacts: [] };
  if (lower < 0n) lower = 0n;
  if (upper > segmentEndSubunits) upper = segmentEndSubunits;

  while (lower <= upper && quadraticValueAtSubunit(a, b, c, lower) > 0n) lower += 1n;
  while (lower > 0n && quadraticValueAtSubunit(a, b, c, lower - 1n) <= 0n) lower -= 1n;
  while (upper >= lower && quadraticValueAtSubunit(a, b, c, upper) > 0n) upper -= 1n;
  while (upper < segmentEndSubunits && quadraticValueAtSubunit(a, b, c, upper + 1n) <= 0n) upper += 1n;
  if (lower > upper) return { windows: [], contacts: [] };

  const globalLower = routeStartSubunits + lower;
  const globalUpper = routeStartSubunits + upper;
  if (globalLower === globalUpper) {
    contacts.push({ progress: globalLower, segmentId: segment.id });
    return { windows: [], contacts: contacts };
  }
  return {
    windows: [{ start: globalLower, end: globalUpper, segmentIds: [segment.id] }],
    contacts: contacts,
  };
}

function mergeRouteGeometry(route, rawWindows, rawContacts) {
  rawWindows.sort(function (left, right) {
    if (left.start !== right.start) return left.start < right.start ? -1 : 1;
    if (left.end !== right.end) return left.end < right.end ? -1 : 1;
    return asciiCompare(left.segmentIds[0], right.segmentIds[0]);
  });
  const merged = [];
  for (const candidate of rawWindows) {
    const current = merged[merged.length - 1];
    if (current && candidate.start <= current.end) {
      if (candidate.end > current.end) current.end = candidate.end;
      for (const segmentId of candidate.segmentIds) {
        if (!current.segmentIds.includes(segmentId)) current.segmentIds.push(segmentId);
      }
    } else {
      merged.push({ start: candidate.start, end: candidate.end, segmentIds: candidate.segmentIds.slice() });
    }
  }

  const contactMap = new Map();
  for (const contact of rawContacts) {
    const key = contact.progress.toString();
    let item = contactMap.get(key);
    if (!item) {
      item = { progress: contact.progress, segmentIds: [] };
      contactMap.set(key, item);
    }
    if (!item.segmentIds.includes(contact.segmentId)) item.segmentIds.push(contact.segmentId);
  }
  const contacts = Array.from(contactMap.values()).sort(function (left, right) {
    return left.progress < right.progress ? -1 : (left.progress > right.progress ? 1 : 0);
  });

  let exposure = 0n;
  let longest = 0n;
  let momentTwice = 0n;
  const windows = merged.map(function (window, index) {
    const length = window.end - window.start;
    exposure += length;
    if (length > longest) longest = length;
    momentTwice += (window.start + window.end) * length;
    window.segmentIds.sort(asciiCompare);
    return {
      startSubunits: checkedNumber(window.start, "/windows/" + index + "/startSubunits", "Coverage-window start"),
      endSubunits: checkedNumber(window.end, "/windows/" + index + "/endSubunits", "Coverage-window end"),
      lengthSubunits: checkedNumber(length, "/windows/" + index + "/lengthSubunits", "Coverage-window length"),
      segmentIds: window.segmentIds.slice(),
    };
  });
  const tangentContacts = contacts.map(function (contact, index) {
    contact.segmentIds.sort(asciiCompare);
    return {
      progressSubunits: checkedNumber(contact.progress, "/contacts/" + index + "/progressSubunits", "Tangent progress"),
      segmentIds: contact.segmentIds.slice(),
    };
  });
  const routeLengthSubunits = BigInt(route.length) * ANALYSIS_SCALE_BIG;
  const meanProgress = exposure === 0n ? null : roundHalfUpNonnegative(momentTwice, 2n * exposure);
  const meanStageBp = exposure === 0n ? null : roundHalfUpNonnegative(
    momentTwice * 10000n,
    2n * exposure * routeLengthSubunits
  );
  return {
    exposure: exposure,
    windows: windows,
    tangentContacts: tangentContacts,
    reentryCount: windows.length === 0 ? 0 : windows.length - 1,
    longestWindowSubunits: checkedNumber(longest, "/longestWindowSubunits", "Longest coverage window"),
    meanProgressSubunits: meanProgress === null ? null : checkedNumber(meanProgress, "/meanProgressSubunits", "Mean route progress"),
    meanStageBp: meanStageBp === null ? null : checkedNumber(meanStageBp, "/meanStageBp", "Mean route stage"),
  };
}

function classifyExposure(exposureSubunits, baselineMilli) {
  nonnegativeInteger(exposureSubunits, "/exposureSubunits", "Exposure subunits");
  positiveInteger(baselineMilli, "/baseline", "Coverage baseline");
  const exposure = BigInt(exposureSubunits);
  const baseline = BigInt(baselineMilli) * ANALYSIS_SCALE_BIG;
  if (exposure * 5n < baseline * 3n) return "invalid";
  if (exposure * 20n < baseline * 17n) return "specialist";
  if (exposure * 4n < baseline * 5n) return "standard";
  if (exposure * 10n < baseline * 17n) return "strong";
  if (exposure <= baseline * 2n) return "power";
  return "rejected";
}

function normalizeRouteDescriptor(source, index) {
  const path = "/routes/" + index;
  exactKeys(source, ["route", "kind", "layerId"], ["route", "kind", "layerId"], path, "route descriptor");
  return Object.freeze({
    route: normalizeCompiledRoute(source.route, path + "/route"),
    kind: stableId(source.kind, path + "/kind", "Route kind"),
    layerId: stableId(source.layerId, path + "/layerId", "Route layer ID"),
  });
}

function stringIdArray(value, path, label) {
  if (!Array.isArray(value) || value.length === 0) fail("MAP_ID_ARRAY", path, label + " must be a non-empty array");
  const output = value.map(function (item, index) {
    return stableId(item, path + "/" + index, label + " item");
  });
  const sorted = output.slice().sort(asciiCompare);
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index] === sorted[index - 1]) fail("MAP_DUPLICATE_ID", path, "Duplicate " + label + " item " + sorted[index]);
  }
  return Object.freeze(sorted);
}

function normalizeProbe(source, index, knownRouteIds) {
  const path = "/probes/" + index;
  exactKeys(source, ["id", "range", "targetKinds", "routeIds", "baseline"], ["id", "range", "targetKinds"], path, "coverage probe");
  const routeIds = source.routeIds === undefined ? null : stringIdArray(source.routeIds, path + "/routeIds", "Probe route ID");
  if (routeIds) {
    for (const routeId of routeIds) {
      if (!knownRouteIds.has(routeId)) fail("MAP_ROUTE_REFERENCE", path + "/routeIds", "Unknown route ID " + routeId);
    }
  }
  return Object.freeze({
    id: stableId(source.id, path + "/id", "Probe ID"),
    range: positiveInteger(source.range, path + "/range", "Probe range"),
    targetKinds: stringIdArray(source.targetKinds, path + "/targetKinds", "Target kind"),
    routeIds: routeIds,
    baseline: source.baseline === undefined ? null : positiveInteger(source.baseline, path + "/baseline", "Coverage baseline"),
  });
}

function duplicateIds(values, key, path, label) {
  const seen = new Set();
  for (let index = 0; index < values.length; index++) {
    const id = values[index][key];
    if (seen.has(id)) fail("MAP_DUPLICATE_ID", path + "/" + index, "Duplicate " + label + " ID " + id);
    seen.add(id);
  }
}

function routeProbeResult(descriptor, pad, probe) {
  const rawWindows = [];
  const rawContacts = [];
  for (const segment of descriptor.route.segments) {
    const raw = segmentCircleCoverage(descriptor.route, segment, pad, probe.range);
    rawWindows.push.apply(rawWindows, raw.windows);
    rawContacts.push.apply(rawContacts, raw.contacts);
  }
  const geometry = mergeRouteGeometry(descriptor.route, rawWindows, rawContacts);
  const exposureSubunits = checkedNumber(geometry.exposure, "/exposureSubunits", "Route exposure");
  return {
    routeId: descriptor.route.id,
    layerId: descriptor.layerId,
    kind: descriptor.kind,
    exposureSubunits: exposureSubunits,
    windows: geometry.windows,
    tangentContacts: geometry.tangentContacts,
    reentryCount: geometry.reentryCount,
    longestWindowSubunits: geometry.longestWindowSubunits,
    meanProgressSubunits: geometry.meanProgressSubunits,
    meanStageBp: geometry.meanStageBp,
    classification: probe.baseline === null ? null : classifyExposure(exposureSubunits, probe.baseline),
  };
}

function selectedRouteDescriptors(routes, probe) {
  const kinds = new Set(probe.targetKinds);
  const ids = probe.routeIds === null ? null : new Set(probe.routeIds);
  const selected = routes.filter(function (descriptor) {
    return kinds.has(descriptor.kind) && (!ids || ids.has(descriptor.route.id));
  });
  if (selected.length === 0) fail("MAP_PROBE_ROUTES", "/probes/" + probe.id, "Coverage probe selects no routes");
  return selected;
}

function padProbeResult(routes, pad, probe) {
  const selected = selectedRouteDescriptors(routes, probe);
  const routeResults = selected.map(function (descriptor) {
    return routeProbeResult(descriptor, pad, probe);
  }).sort(function (left, right) { return asciiCompare(left.routeId, right.routeId); });
  let total = 0n;
  let worst = null;
  for (const result of routeResults) {
    const exposure = BigInt(result.exposureSubunits);
    total += exposure;
    if (worst === null || exposure < worst) worst = exposure;
  }
  const totalNumber = checkedNumber(total, "/totalExposureSubunits", "Total exposure");
  const worstNumber = checkedNumber(worst, "/worstRouteExposureSubunits", "Worst-route exposure");
  return {
    probeId: probe.id,
    range: probe.range,
    routes: routeResults,
    totalExposureSubunits: totalNumber,
    worstRouteExposureSubunits: worstNumber,
    qualityExposureSubunits: worstNumber,
    classification: probe.baseline === null ? null : classifyExposure(worstNumber, probe.baseline),
  };
}

function spreadForProbe(pads, probeId) {
  const values = pads.map(function (pad) {
    const result = pad.probes.find(function (entry) { return entry.probeId === probeId; });
    return { id: pad.id, value: result.qualityExposureSubunits };
  });
  let minimum = values[0].value;
  let maximum = values[0].value;
  for (const item of values) {
    if (item.value < minimum) minimum = item.value;
    if (item.value > maximum) maximum = item.value;
  }
  const minPadIds = values.filter(function (item) { return item.value === minimum; }).map(function (item) { return item.id; }).sort(asciiCompare);
  const maxPadIds = values.filter(function (item) { return item.value === maximum; }).map(function (item) { return item.id; }).sort(asciiCompare);
  return {
    probeId: probeId,
    kind: minimum === 0 ? (maximum === 0 ? "all-zero" : "infinite-zero-min") : "finite",
    numeratorSubunits: maximum,
    denominatorSubunits: minimum,
    maxPadIds: maxPadIds,
    minPadIds: minPadIds,
  };
}

function analyzeCoverage(source) {
  exactKeys(source, ["routes", "pads", "probes"], ["routes", "pads", "probes"], "/", "map analysis");
  if (!Array.isArray(source.routes) || source.routes.length === 0) fail("MAP_ROUTES", "/routes", "Map analysis requires routes");
  if (!Array.isArray(source.pads) || source.pads.length === 0) fail("MAP_PADS", "/pads", "Map analysis requires pads");
  if (!Array.isArray(source.probes) || source.probes.length === 0) fail("MAP_PROBES", "/probes", "Map analysis requires probes");

  const routes = source.routes.map(normalizeRouteDescriptor).sort(function (left, right) {
    return asciiCompare(left.route.id, right.route.id);
  });
  duplicateIds(routes.map(function (item) { return { id: item.route.id }; }), "id", "/routes", "route");
  const routeIds = new Set(routes.map(function (item) { return item.route.id; }));
  const pads = source.pads.map(function (item, index) {
    return normalizePad(item, "/pads/" + index);
  }).sort(function (left, right) { return asciiCompare(left.id, right.id); });
  duplicateIds(pads, "id", "/pads", "pad");
  const probes = source.probes.map(function (item, index) {
    return normalizeProbe(item, index, routeIds);
  }).sort(function (left, right) { return asciiCompare(left.id, right.id); });
  duplicateIds(probes, "id", "/probes", "probe");

  const padReports = pads.map(function (pad) {
    return {
      id: pad.id,
      x: pad.x,
      y: pad.y,
      probes: probes.map(function (probe) { return padProbeResult(routes, pad, probe); }),
    };
  });
  const spreads = probes.map(function (probe) { return spreadForProbe(padReports, probe.id); });
  return deepFreeze({
    analysisSubunitsPerMilli: ANALYSIS_SUBUNITS_PER_MILLI,
    pads: padReports,
    spreads: spreads,
  });
}

function roundAnalysisSubunitsToMilli(value) {
  nonnegativeInteger(value, "/analysisSubunits", "Analysis subunits");
  return checkedNumber(
    roundHalfUpNonnegative(BigInt(value), ANALYSIS_SCALE_BIG),
    "/analysisSubunits",
    "Rounded milli-units"
  );
}

function spreadWithin(spread, ratioNumerator, ratioDenominator) {
  requireObject(spread, "/spread", "Spread");
  positiveInteger(ratioNumerator, "/ratioNumerator", "Spread limit numerator");
  positiveInteger(ratioDenominator, "/ratioDenominator", "Spread limit denominator");
  if (spread.kind !== "finite") return false;
  nonnegativeInteger(spread.numeratorSubunits, "/spread/numeratorSubunits", "Spread numerator");
  positiveInteger(spread.denominatorSubunits, "/spread/denominatorSubunits", "Spread denominator");
  return BigInt(spread.numeratorSubunits) * BigInt(ratioDenominator) <=
    BigInt(spread.denominatorSubunits) * BigInt(ratioNumerator);
}

module.exports = Object.freeze({
  GRID: GRID,
  ANALYSIS_SUBUNITS_PER_MILLI: ANALYSIS_SUBUNITS_PER_MILLI,
  integerSqrtFloor: integerSqrtFloor,
  cellCenterMilli: cellCenterMilli,
  compileRoute: compileRoute,
  compilePad: compilePad,
  analyzeCoverage: analyzeCoverage,
  classifyExposure: classifyExposure,
  roundAnalysisSubunitsToMilli: roundAnalysisSubunitsToMilli,
  spreadWithin: spreadWithin,
});
