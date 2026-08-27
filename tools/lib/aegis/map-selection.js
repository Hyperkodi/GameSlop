"use strict";

const { fail } = require("./diagnostics.js");
const Geometry = require("./map-geometry.js");

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
const LATER_ROLE_INTENTS = new Set(["air", "line", "mine"]);

function asciiCompare(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
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

function checkedNumber(value, path, label) {
  if (value > MAX_SAFE_BIG || value < -MAX_SAFE_BIG) {
    fail("MAP_SAFE_INTEGER", path, label + " exceeds the safe-integer range");
  }
  return Number(value);
}

function laneSubsegments(lane) {
  if (!lane || !lane.compiled) fail("MAP_IR", "/laneSegments", "Lane is missing compiled geometry");
  const segments = Array.isArray(lane.compiled.segments) ? lane.compiled.segments : lane.compiled.subsegments;
  if (!Array.isArray(segments) || segments.length === 0) {
    fail("MAP_IR", "/laneSegments/" + lane.id, "Lane is missing compiled subsegments");
  }
  return segments;
}

function laneLength(lane) {
  if (!lane || !lane.compiled || !Number.isSafeInteger(lane.compiled.length) || lane.compiled.length <= 0) {
    fail("MAP_IR", "/laneSegments/" + (lane && lane.id), "Lane has no positive compiled length");
  }
  return lane.compiled.length;
}

function flattenLogicalRoute(route, laneById) {
  const segments = [];
  let routeStart = 0;
  for (const laneId of route.laneSegmentIds) {
    const lane = laneById.get(laneId);
    if (!lane) fail("MAP_LANE_REFERENCE", "/routes/" + route.id, "Unknown route lane " + laneId);
    for (const segment of laneSubsegments(lane)) {
      const segmentId = lane.id + ":s" + String(segment.index).padStart(3, "0");
      segments.push({
        id: segmentId,
        index: segments.length,
        start: routeStart + segment.start,
        length: segment.length,
        fromX: segment.fromX,
        fromY: segment.fromY,
        toX: segment.toX,
        toY: segment.toY,
        deltaX: segment.deltaX,
        deltaY: segment.deltaY,
      });
    }
    routeStart += laneLength(lane);
  }
  if (routeStart !== route.length) {
    fail("MAP_ROUTE_LENGTH", "/routes/" + route.id, "Route-local offsets do not sum to route length");
  }
  return { id: route.id, length: route.length, segments: segments };
}

function buildRouteProvenance(routes, laneById) {
  return routes.map(function (route) {
    const laneSegments = route.segmentOffsets.map(function (offset) {
      const lane = laneById.get(offset.laneSegmentId);
      const sharedRouteIds = lane.routeIds.slice();
      const subsegments = laneSubsegments(lane).map(function (segment) {
        const routeStart = offset.routeOffset + segment.start;
        const routeEnd = routeStart + segment.length;
        return {
          laneSegmentId: lane.id,
          subsegmentIndex: segment.index,
          physicalSegmentId: lane.id + ":s" + String(segment.index).padStart(3, "0"),
          layerId: lane.layerId,
          sharedRouteIds: sharedRouteIds.slice(),
          routeStart: routeStart,
          routeEnd: routeEnd,
          remainingDistanceAtStart: route.length - routeStart,
          remainingDistanceAtEnd: route.length - routeEnd,
        };
      });
      return {
        laneSegmentId: lane.id,
        layerId: lane.layerId,
        sharedRouteIds: sharedRouteIds,
        routeOffset: offset.routeOffset,
        laneLength: offset.laneLength,
        remainingDistanceAtStart: offset.remainingDistanceAtStart,
        remainingDistanceAtEnd: offset.remainingDistanceAtEnd,
        subsegments: subsegments,
      };
    });
    return {
      routeId: route.id,
      kind: route.kind,
      length: route.length,
      laneSegments: laneSegments,
    };
  });
}

function coverageDescriptors(routes, laneById) {
  return routes.map(function (route) {
    const layers = new Set(route.laneSegmentIds.map(function (laneId) { return laneById.get(laneId).layerId; }));
    return {
      route: flattenLogicalRoute(route, laneById),
      kind: route.kind,
      layerId: layers.size === 1 ? layers.values().next().value : "mixed",
    };
  });
}

function probeDescriptor(probe) {
  const output = {
    id: probe.id,
    range: probe.rangeMilliUnits,
    targetKinds: probe.targetKinds.slice(),
    routeIds: probe.routeIds.slice(),
  };
  if (probe.baselineMilliUnits !== null) output.baseline = probe.baselineMilliUnits;
  return output;
}

function rawCoverage(map) {
  const laneById = new Map(map.laneSegments.map(function (lane) { return [lane.id, lane]; }));
  return Geometry.analyzeCoverage({
    routes: coverageDescriptors(map.routes, laneById),
    pads: map.pads.map(function (pad) { return { id: pad.id, x: pad.x, y: pad.y }; }),
    probes: map.probes.map(probeDescriptor),
  });
}

function routeResult(probe, routeId, path) {
  const result = probe.routes.find(function (route) { return route.routeId === routeId; });
  if (!result) fail("MAP_PAD_ROUTE_CLAIM", path, "Probe does not select claimed route " + routeId);
  return result;
}

function annotateProbe(pad, probe, definition, path, requireAllClaimed) {
  const declaredClaimSet = new Set(pad.claimedRouteIds);
  const routes = probe.routes.map(function (route) {
    const output = copyPlain(route);
    output.claimed = declaredClaimSet.has(route.routeId);
    return output;
  });
  if (requireAllClaimed) {
    for (const routeId of pad.claimedRouteIds) routeResult({ routes: routes }, routeId, path + "/claimedRouteIds");
  }
  const claimedRoutes = routes.filter(function (route) { return route.claimed; });
  const claimedIds = claimedRoutes.map(function (route) { return route.routeId; });
  let claimedMinimum = null;
  let claimedTotal = 0n;
  for (const route of claimedRoutes) {
    const exposure = BigInt(route.exposureSubunits);
    claimedTotal += exposure;
    if (claimedMinimum === null || exposure < claimedMinimum) claimedMinimum = exposure;
  }
  const unclaimedRoutes = routes.filter(function (route) { return !route.claimed; });
  let unclaimedTotal = 0n;
  for (const route of unclaimedRoutes) unclaimedTotal += BigInt(route.exposureSubunits);
  const claimedQuality = claimedMinimum === null ? null : checkedNumber(claimedMinimum, path, "Claimed-route exposure");
  return {
    probeId: probe.probeId,
    range: probe.range,
    routes: routes,
    claimedRouteIds: claimedIds,
    unclaimedRouteIds: unclaimedRoutes.map(function (route) { return route.routeId; }),
    totalExposureSubunits: probe.totalExposureSubunits,
    physicalWorstRouteExposureSubunits: probe.worstRouteExposureSubunits,
    claimedTotalExposureSubunits: checkedNumber(claimedTotal, path, "Claimed total exposure"),
    unclaimedTotalExposureSubunits: checkedNumber(unclaimedTotal, path, "Unclaimed total exposure"),
    worstRouteExposureSubunits: claimedQuality,
    qualityExposureSubunits: claimedQuality,
    classification: definition.baselineMilliUnits === null || claimedQuality === null ? null : Geometry.classifyExposure(claimedQuality, definition.baselineMilliUnits),
  };
}

function findProbe(coverage, padId, probeId) {
  const pad = coverage.pads.find(function (item) { return item.id === padId; });
  return pad.probes.find(function (probe) { return probe.probeId === probeId; });
}

function pointDistanceSquared(x1, y1, x2, y2) {
  const dx = BigInt(x1) - BigInt(x2);
  const dy = BigInt(y1) - BigInt(y2);
  return dx * dx + dy * dy;
}

function bendIntentPass(pad, map, qualityRange) {
  const laneById = new Map(map.laneSegments.map(function (lane) { return [lane.id, lane]; }));
  const maximumSquared = BigInt(qualityRange + map.road.halfWidthMilliUnits) ** 2n;
  for (const routeId of pad.claimedRouteIds) {
    const route = map.routes.find(function (item) { return item.id === routeId; });
    const flat = flattenLogicalRoute(route, laneById);
    for (let index = 1; index < flat.segments.length; index++) {
      const incoming = flat.segments[index - 1];
      const outgoing = flat.segments[index];
      const cross = BigInt(incoming.deltaX) * BigInt(outgoing.deltaY) - BigInt(incoming.deltaY) * BigInt(outgoing.deltaX);
      if (cross !== 0n && pointDistanceSquared(pad.x, pad.y, outgoing.fromX, outgoing.fromY) <= maximumSquared) return true;
    }
  }
  return false;
}

function validateGeometryIntent(pad, qualityProbe, map, qualityRange, path) {
  if (LATER_ROLE_INTENTS.has(pad.intent)) {
    fail("ROLE_PROOF_UNIMPLEMENTED", path + "/intent", "Intent " + pad.intent + " has no implemented role-proof contract");
  }
  const claimed = qualityProbe.routes.filter(function (route) { return route.claimed; });
  const stages = claimed.map(function (route) { return route.meanStageBp; }).filter(function (stage) { return stage !== null; });
  let minimumStage = null;
  let maximumStage = null;
  for (const stage of stages) {
    if (minimumStage === null || stage < minimumStage) minimumStage = stage;
    if (maximumStage === null || stage > maximumStage) maximumStage = stage;
  }
  let pass;
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
    const maximumReentry = claimed.reduce(function (maximum, route) { return Math.max(maximum, route.reentryCount); }, 0);
    pass = maximumReentry >= 1;
    evidence = { maximumReentryCount: maximumReentry, requiredMinimum: 1 };
  } else if (pad.intent === "bend") {
    pass = bendIntentPass(pad, map, qualityRange);
    evidence = { turnWaypointWithinMilliUnits: qualityRange + map.road.halfWidthMilliUnits };
  } else if (pad.intent === "support" || pad.intent === "guard") {
    return { intent: pad.intent, pass: null, supported: true, deferredToRoleProof: true, evidence: {} };
  } else {
    fail("MAP_ENUM", path + "/intent", "Unknown pad intent " + pad.intent);
  }
  if (!pass) fail("MAP_INTENT_MISMATCH", path + "/intent", "Pad geometry does not support declared intent " + pad.intent);
  return { intent: pad.intent, pass: true, supported: true, deferredToRoleProof: false, evidence: evidence };
}

function spreadFromClaimed(pads, probeId) {
  const values = pads.map(function (pad) {
    return { id: pad.id, value: pad.probes.find(function (probe) { return probe.probeId === probeId; }).qualityExposureSubunits };
  });
  if (values.some(function (item) { return !Number.isSafeInteger(item.value) || item.value < 0; })) {
    fail("MAP_PROBE_ROUTES", "/probes/" + probeId, "Claimed-route spread requires every pad to intersect the probe");
  }
  let minimum = values[0].value;
  let maximum = values[0].value;
  for (const item of values) {
    if (item.value < minimum) minimum = item.value;
    if (item.value > maximum) maximum = item.value;
  }
  return {
    probeId: probeId,
    kind: minimum === 0 ? (maximum === 0 ? "all-zero" : "infinite-zero-min") : "finite",
    numeratorSubunits: maximum,
    denominatorSubunits: minimum,
    maxPadIds: values.filter(function (item) { return item.value === maximum; }).map(function (item) { return item.id; }).sort(asciiCompare),
    minPadIds: values.filter(function (item) { return item.value === minimum; }).map(function (item) { return item.id; }).sort(asciiCompare),
  };
}

function selectionRecord(pad, qualityProbe, path) {
  let selectionStage = null;
  let selectionRouteId = null;
  for (const routeId of pad.claimedRouteIds) {
    const route = routeResult(qualityProbe, routeId, path + "/claimedRouteIds");
    if (route.meanStageBp === null) fail("MAP_CLAIMED_ROUTE_EXPOSURE", path, "Claimed route has no quality-probe stage");
    if (selectionStage === null || route.meanStageBp < selectionStage ||
        (route.meanStageBp === selectionStage && asciiCompare(routeId, selectionRouteId) < 0)) {
      selectionStage = route.meanStageBp;
      selectionRouteId = routeId;
    }
  }
  return {
    padId: pad.id,
    selectionOrder: pad.selectionOrder,
    selectionStageBp: selectionStage,
    selectionRouteId: selectionRouteId,
  };
}

function analyzeRouteLocalMap(map) {
  const laneById = new Map(map.laneSegments.map(function (lane) { return [lane.id, lane]; }));
  const probeById = new Map(map.probes.map(function (probe) { return [probe.id, probe]; }));
  const raw = rawCoverage(map);
  const coveragePads = raw.pads.map(function (rawPad) {
    const pad = map.pads.find(function (item) { return item.id === rawPad.id; });
    return {
      id: rawPad.id,
      x: rawPad.x,
      y: rawPad.y,
      probes: rawPad.probes.map(function (probe) {
        const reviewProbe = probe.probeId === map.review.entryProbeId || probe.probeId === map.review.qualityProbeId;
        return annotateProbe(pad, probe, probeById.get(probe.probeId), "/pads/" + pad.id, reviewProbe);
      }),
    };
  });
  const rawSpreadById = new Map(raw.spreads.map(function (spread) { return [spread.probeId, spread]; }));
  const coverage = {
    analysisSubunitsPerMilli: raw.analysisSubunitsPerMilli,
    pads: coveragePads,
    spreads: map.probes.map(function (probe) {
      const values = coveragePads.map(function (pad) {
        return pad.probes.find(function (entry) { return entry.probeId === probe.id; }).qualityExposureSubunits;
      });
      return values.every(function (value) { return Number.isSafeInteger(value) && value >= 0; }) ?
        spreadFromClaimed(coveragePads, probe.id) : copyPlain(rawSpreadById.get(probe.id));
    }),
  };

  const qualityDefinition = probeById.get(map.review.qualityProbeId);
  const entryDefinition = probeById.get(map.review.entryProbeId);
  const padChecks = [];
  const selections = [];
  for (let index = 0; index < map.pads.length; index++) {
    const pad = map.pads[index];
    const path = "/pads/" + index;
    const entry = findProbe(coverage, pad.id, map.review.entryProbeId);
    const quality = findProbe(coverage, pad.id, map.review.qualityProbeId);
    const entryRecords = [];
    for (const routeId of pad.claimedRouteIds) {
      const entryRoute = routeResult(entry, routeId, path + "/claimedRouteIds");
      const qualityRoute = routeResult(quality, routeId, path + "/claimedRouteIds");
      if (qualityRoute.exposureSubunits === 0) {
        fail("MAP_CLAIMED_ROUTE_EXPOSURE", path, "Claimed route has zero quality-probe exposure: " + routeId);
      }
      const pass = BigInt(entryRoute.exposureSubunits) >=
        BigInt(map.review.minimumEntryExposureMilliUnits) * BigInt(Geometry.ANALYSIS_SUBUNITS_PER_MILLI);
      if (pad.kind === "ordinary" && !pass) {
        fail("MAP_ENTRY_EXPOSURE", path, "Ordinary pad is below its entry threshold on claimed route " + routeId);
      }
      entryRecords.push({ routeId: routeId, exposureSubunits: entryRoute.exposureSubunits, pass: pass });
    }
    if (quality.classification !== pad.declaredQuality) {
      fail("MAP_QUALITY_MISMATCH", path + "/declaredQuality", "Declared quality " + pad.declaredQuality + " does not match claimed-route quality " + quality.classification);
    }
    const intent = validateGeometryIntent(pad, quality, map, qualityDefinition.rangeMilliUnits, path);
    padChecks.push({
      id: pad.id,
      entry: { probeId: entryDefinition.id, thresholdMilliUnits: map.review.minimumEntryExposureMilliUnits, routes: entryRecords, pass: true },
      quality: {
        probeId: qualityDefinition.id,
        declared: pad.declaredQuality,
        computed: quality.classification,
        claimedRouteIds: pad.claimedRouteIds.slice(),
        qualityExposureSubunits: quality.qualityExposureSubunits,
        pass: true,
      },
      intent: intent,
    });
    selections.push(selectionRecord(pad, quality, path));
  }

  const spread = spreadFromClaimed(coveragePads, map.review.qualityProbeId);
  if (!Geometry.spreadWithin(spread, map.review.maximumSpread.numerator, map.review.maximumSpread.denominator)) {
    fail("MAP_SPREAD", "/review/maximumSpread", "Claimed-route quality exposure spread exceeds the declared integer ratio");
  }
  const derived = selections.slice().sort(function (left, right) {
    if (left.selectionStageBp !== right.selectionStageBp) return left.selectionStageBp - right.selectionStageBp;
    const routeOrder = asciiCompare(left.selectionRouteId, right.selectionRouteId);
    return routeOrder !== 0 ? routeOrder : asciiCompare(left.padId, right.padId);
  });
  for (let order = 0; order < derived.length; order++) {
    if (derived[order].selectionOrder !== order) {
      fail("MAP_SELECTION_ORDER_DERIVED", "/pads/" + derived[order].padId + "/selectionOrder",
        "selectionOrder must equal the derived route-stage order");
    }
  }
  const records = derived.map(function (record, order) {
    return {
      padId: record.padId,
      selectionOrder: order,
      selectionStageBp: record.selectionStageBp,
      selectionRouteId: record.selectionRouteId,
    };
  });
  return deepFreeze({
    coverage: coverage,
    padChecks: padChecks,
    spreadCheck: {
      probeId: map.review.qualityProbeId,
      numeratorSubunits: spread.numeratorSubunits,
      denominatorSubunits: spread.denominatorSubunits,
      limitNumerator: map.review.maximumSpread.numerator,
      limitDenominator: map.review.maximumSpread.denominator,
      pass: true,
    },
    selectionOrderCheck: {
      policy: "route-stage-route-id-pad-id",
      records: records,
      pass: true,
    },
    routeProvenance: buildRouteProvenance(map.routes, laneById),
  });
}

function analyzePadRange(map, pad, rangeMilliUnits, routeIds) {
  if (!Number.isSafeInteger(rangeMilliUnits) || rangeMilliUnits <= 0) {
    fail("MAP_SAFE_INTEGER", "/rangeMilliUnits", "Role-proof range must be a positive safe integer");
  }
  const laneById = new Map(map.laneSegments.map(function (lane) { return [lane.id, lane]; }));
  const routes = coverageDescriptors(map.routes, laneById);
  const result = Geometry.analyzeCoverage({
    routes: routes,
    pads: [{ id: pad.id, x: pad.x, y: pad.y }],
    probes: [{ id: "role-proof", range: rangeMilliUnits, targetKinds: ["ground"], routeIds: routeIds.slice() }],
  });
  return result.pads[0].probes[0].routes;
}

module.exports = Object.freeze({
  analyzeRouteLocalMap: analyzeRouteLocalMap,
  analyzePadRange: analyzePadRange,
  flattenLogicalRoute: flattenLogicalRoute,
  buildRouteProvenance: buildRouteProvenance,
});
