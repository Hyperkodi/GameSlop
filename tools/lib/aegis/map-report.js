"use strict";

const { canonicalBytes } = require("./canonical.js");
const { fail } = require("./diagnostics.js");
const Geometry = require("./map-geometry.js");

function asciiCompare(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function primitiveRoute(route) {
  return {
    id: route.id,
    kind: route.kind,
    layerId: route.layerId,
    lengthMilliUnits: route.route.length,
    compiled: route.route,
  };
}

function primitivePadCheck(check) {
  return {
    id: check.id,
    clearance: {
      boardInsetMilliUnits: check.clearance.boardInsetMilliUnits,
      minimumLaneClearanceMilliUnits: check.clearance.minimumLaneClearanceMilliUnits,
      minimumPadSpacingMilliUnits: check.clearance.minimumPadSpacingMilliUnits,
      minimumDeclaredClearanceMilliUnits: check.clearance.minimumDeclaredClearanceMilliUnits,
    },
    entry: {
      probeId: check.entry.probeId,
      thresholdMilliUnits: check.entry.thresholdMilliUnits,
      pass: check.entry.pass,
    },
    quality: {
      probeId: check.quality.probeId,
      declared: check.quality.declared,
      computed: check.quality.computed,
      pass: check.quality.pass,
    },
    intent: {
      intent: check.intent.intent,
      pass: check.intent.pass,
      evidence: Object.assign({}, check.intent.evidence),
    },
  };
}

function createMissionReport(validated) {
  if (!validated || validated.approvalEligible !== true || validated.sourceKind !== "campaign") {
    fail("MAP_REPORT_MODE", "/", "Only a validated campaign map can produce approval artifacts");
  }
  const qualityProbeId = validated.review.qualityProbeId;
  const pads = validated.pads.map(function (pad) {
    const analysisPad = validated.analysis.pads.find(function (item) { return item.id === pad.id; });
    const quality = analysisPad.probes.find(function (probe) { return probe.probeId === qualityProbeId; });
    const check = validated.padChecks.find(function (item) { return item.id === pad.id; });
    return {
      id: pad.id,
      cell: { column: pad.column, row: pad.row },
      centerMilliUnits: { x: pad.x, y: pad.y },
      kind: pad.kind,
      intent: pad.intent,
      declaredQuality: pad.declaredQuality,
      claimedRouteIds: pad.claimedRouteIds.slice(),
      qualityExposureSubunits: quality.qualityExposureSubunits,
      roundedQualityExposureMilliUnits: Geometry.roundAnalysisSubunitsToMilli(quality.qualityExposureSubunits),
      checks: primitivePadCheck(check),
    };
  });
  return deepFreeze({
    schemaVersion: 1,
    missionId: validated.id,
    title: validated.title,
    sourceKind: "campaign",
    approvalEligible: true,
    units: {
      compiledDistance: "milli-world-unit",
      analysisSubunitsPerMilliUnit: Geometry.ANALYSIS_SUBUNITS_PER_MILLI,
      stage: "basis-points-of-route-progress",
    },
    grid: {
      columns: validated.board.columns,
      rows: validated.board.rows,
      cellWorldUnits: validated.board.cellWorldUnits,
      widthWorldUnits: validated.board.widthWorldUnits,
      heightWorldUnits: validated.board.heightWorldUnits,
    },
    policy: {
      roadWidthMilliUnits: validated.road.widthMilliUnits,
      roadHalfWidthMilliUnits: validated.road.halfWidthMilliUnits,
      ordinaryLaneClearanceMilliUnits: validated.geometryPolicy.ordinaryLaneClearanceMilliUnits,
      padSpacingMilliUnits: validated.geometryPolicy.padSpacingMilliUnits,
      boardInsetMilliUnits: validated.geometryPolicy.boardInsetMilliUnits,
      declaredObjectClearanceMilliUnits: validated.geometryPolicy.anchorClearanceMilliUnits,
      entryProbeId: validated.review.entryProbeId,
      qualityProbeId: qualityProbeId,
      minimumEntryExposureMilliUnits: validated.review.minimumEntryExposureMilliUnits,
      maximumSpread: {
        numerator: validated.review.maximumSpread.numerator,
        denominator: validated.review.maximumSpread.denominator,
      },
      intentProbeProfile: "m1-route-stage-v1",
      endpointAnchorConvention: "off-board-portal-cell-center",
    },
    routes: validated.routes.map(primitiveRoute),
    probes: validated.probes.map(function (probe) {
      return {
        id: probe.id,
        rangeMilliUnits: probe.rangeMilliUnits,
        targetKinds: probe.targetKinds.slice(),
        routeIds: probe.routeIds.slice(),
        baselineMilliUnits: probe.baselineMilliUnits,
      };
    }),
    anchors: validated.anchors.map(function (anchor) {
      return {
        id: anchor.id,
        kind: anchor.kind,
        cell: { column: anchor.column, row: anchor.row },
        centerMilliUnits: { x: anchor.x, y: anchor.y },
        routeId: anchor.routeId,
      };
    }),
    exclusions: validated.exclusions.map(function (exclusion) {
      return {
        id: exclusion.id,
        kind: exclusion.kind,
        cell: { column: exclusion.column, row: exclusion.row },
        centerMilliUnits: { x: exclusion.x, y: exclusion.y },
        radiusMilliUnits: exclusion.radiusMilliUnits,
      };
    }),
    crossings: validated.crossings.map(function (crossing) {
      const result = {
        id: crossing.id,
        kind: crossing.kind,
        routeAId: crossing.routeAId,
        segmentAIndex: crossing.segmentAIndex,
        routeBId: crossing.routeBId,
        segmentBIndex: crossing.segmentBIndex,
      };
      if (crossing.upperLayerId !== null) result.upperLayerId = crossing.upperLayerId;
      return result;
    }),
    pads: pads,
    spreadCheck: {
      probeId: validated.spreadCheck.probeId,
      numeratorSubunits: validated.spreadCheck.numeratorSubunits,
      denominatorSubunits: validated.spreadCheck.denominatorSubunits,
      limitNumerator: validated.spreadCheck.limitNumerator,
      limitDenominator: validated.spreadCheck.limitDenominator,
      pass: validated.spreadCheck.pass,
    },
    routeStageOrderCheck: {
      probeId: validated.routeStageOrderCheck.probeId,
      routeId: validated.routeStageOrderCheck.routeId,
      applicable: validated.routeStageOrderCheck.applicable,
      stages: validated.routeStageOrderCheck.stages.map(function (stage) {
        return { id: stage.id, meanStageBp: stage.meanStageBp };
      }),
      pass: validated.routeStageOrderCheck.pass,
    },
    coverage: validated.analysis,
  });
}

function createNormalizedMapReport(ir) {
  if (!ir || ir.schemaVersion !== 2 || ir.sourceKind !== "campaign" || !ir.analysis ||
      !Array.isArray(ir.analysis.routeProvenance) || !ir.analysis.coverage || !ir.board || !ir.road ||
      !ir.geometryPolicy || !ir.review || !Array.isArray(ir.laneSegments) || !Array.isArray(ir.routes) ||
      !Array.isArray(ir.joins) || !Array.isArray(ir.crossings) || !Array.isArray(ir.pads) ||
      !Array.isArray(ir.anchors) || !Array.isArray(ir.exclusions) || !Array.isArray(ir.probes) ||
      !Array.isArray(ir.roleProofs)) {
    fail("MAP_REPORT_MODE", "/", "Normalized route-local reports require a fully analyzed map-v2 IR");
  }
  const pads = ir.pads.map(function (pad) {
    const coveragePad = ir.analysis.coverage.pads.find(function (item) { return item.id === pad.id; });
    if (!coveragePad || !Array.isArray(coveragePad.probes)) {
      fail("MAP_REPORT_MODE", "/analysis/coverage/pads", "Normalized pad coverage must match every physical pad");
    }
    const qualityProbe = coveragePad.probes.find(function (probe) { return probe.probeId === ir.review.qualityProbeId; });
    if (!qualityProbe) {
      fail("MAP_REPORT_MODE", "/analysis/coverage/pads/" + pad.id, "Normalized pad coverage lacks the quality probe");
    }
    return {
      id: pad.id,
      cell: { column: pad.column, row: pad.row },
      centerMilliUnits: { x: pad.x, y: pad.y },
      kind: pad.kind,
      intent: pad.intent,
      declaredQuality: pad.declaredQuality,
      claimedRouteIds: pad.claimedRouteIds.slice(),
      selectionOrder: pad.selectionOrder,
      roundedQualityExposureMilliUnits: Geometry.roundAnalysisSubunitsToMilli(qualityProbe.qualityExposureSubunits),
      probes: coveragePad.probes.map(function (probe) {
        return {
          probeId: probe.probeId,
          rangeMilliUnits: probe.range,
          qualityExposureSubunits: probe.qualityExposureSubunits,
          classification: probe.classification,
          claimedRoutes: probe.routes.filter(function (route) { return route.claimed; }).map(function (route) {
            return Object.assign({}, route);
          }),
          unclaimedRoutes: probe.routes.filter(function (route) { return !route.claimed; }).map(function (route) {
            return Object.assign({}, route);
          }),
          unclaimedTotalExposureSubunits: probe.unclaimedTotalExposureSubunits,
        };
      }),
    };
  });
  return deepFreeze({
    schemaVersion: 2,
    missionId: ir.id,
    sourceKind: "campaign",
    approvalEligible: true,
    units: {
      compiledDistance: "milli-world-unit",
      analysisSubunitsPerMilliUnit: Geometry.ANALYSIS_SUBUNITS_PER_MILLI,
      stage: "basis-points-of-route-progress",
    },
    grid: {
      columns: ir.board.columns,
      rows: ir.board.rows,
      cellWorldUnits: ir.board.cellWorldUnits,
      widthWorldUnits: ir.board.widthWorldUnits,
      heightWorldUnits: ir.board.heightWorldUnits,
    },
    policy: {
      roadWidthMilliUnits: ir.road.widthMilliUnits,
      roadHalfWidthMilliUnits: ir.road.halfWidthMilliUnits,
      ordinaryLaneClearanceMilliUnits: ir.geometryPolicy.ordinaryLaneClearanceMilliUnits,
      padSpacingMilliUnits: ir.geometryPolicy.padSpacingMilliUnits,
      boardInsetMilliUnits: ir.geometryPolicy.boardInsetMilliUnits,
      declaredObjectClearanceMilliUnits: ir.geometryPolicy.anchorClearanceMilliUnits,
      entryProbeId: ir.review.entryProbeId,
      qualityProbeId: ir.review.qualityProbeId,
      minimumEntryExposureMilliUnits: ir.review.minimumEntryExposureMilliUnits,
      maximumSpread: {
        numerator: ir.review.maximumSpread.numerator,
        denominator: ir.review.maximumSpread.denominator,
      },
      selectionOrderPolicy: ir.review.selectionOrderPolicy,
      endpointAnchorConvention: "off-board-portal-cell-center",
    },
    laneSegments: ir.laneSegments.map(function (lane) {
      return {
        id: lane.id,
        kind: lane.kind,
        layerId: lane.layerId,
        lengthMilliUnits: lane.compiled.length,
        routeIds: lane.routeIds.slice(),
        subsegments: lane.compiled.subsegments.map(function (segment) { return Object.assign({}, segment); }),
      };
    }),
    routes: ir.analysis.routeProvenance.map(function (route) {
      return {
        id: route.routeId,
        kind: route.kind,
        lengthMilliUnits: route.length,
        laneSegments: route.laneSegments.map(function (lane) {
          return {
            laneSegmentId: lane.laneSegmentId,
            layerId: lane.layerId,
            sharedRouteIds: lane.sharedRouteIds.slice(),
            routeOffset: lane.routeOffset,
            laneLength: lane.laneLength,
            remainingDistanceAtStart: lane.remainingDistanceAtStart,
            remainingDistanceAtEnd: lane.remainingDistanceAtEnd,
            subsegments: lane.subsegments.map(function (segment) { return Object.assign({}, segment); }),
          };
        }),
      };
    }),
    joins: ir.joins.map(function (join) {
      return {
        id: join.id,
        kind: join.kind,
        cell: { column: join.column, row: join.row },
        centerMilliUnits: { x: join.x, y: join.y },
        incomingLaneSegmentIds: join.incomingLaneSegmentIds.slice(),
        outgoingLaneSegmentIds: join.outgoingLaneSegmentIds.slice(),
      };
    }),
    crossings: ir.crossings.map(function (crossing) { return Object.assign({}, crossing); }),
    pads: pads,
    anchors: ir.anchors.map(function (anchor) {
      const output = {
        id: anchor.id,
        kind: anchor.kind,
        cell: { column: anchor.column, row: anchor.row },
        centerMilliUnits: { x: anchor.x, y: anchor.y },
      };
      if (Object.prototype.hasOwnProperty.call(anchor, "laneSegmentId")) output.laneSegmentId = anchor.laneSegmentId;
      if (Object.prototype.hasOwnProperty.call(anchor, "routeIds")) output.routeIds = anchor.routeIds.slice();
      return output;
    }),
    exclusions: ir.exclusions.map(function (exclusion) {
      return {
        id: exclusion.id,
        kind: exclusion.kind,
        cell: { column: exclusion.column, row: exclusion.row },
        centerMilliUnits: { x: exclusion.x, y: exclusion.y },
        radiusMilliUnits: exclusion.radiusMilliUnits,
      };
    }),
    probes: ir.probes.map(function (probe) {
      return {
        id: probe.id,
        rangeMilliUnits: probe.rangeMilliUnits,
        targetKinds: probe.targetKinds.slice(),
        routeIds: probe.routeIds.slice(),
        baselineMilliUnits: probe.baselineMilliUnits,
      };
    }),
    spreadCheck: Object.assign({}, ir.analysis.spreadCheck),
    selectionOrderCheck: {
      policy: ir.analysis.selectionOrderCheck.policy,
      records: ir.analysis.selectionOrderCheck.records.map(function (record) { return Object.assign({}, record); }),
      pass: ir.analysis.selectionOrderCheck.pass,
    },
    roleProofs: ir.roleProofs.map(function (proof) { return JSON.parse(JSON.stringify(proof)); }),
  });
}

function renderReportJson(report) {
  return Buffer.concat([canonicalBytes(report), Buffer.from("\n", "utf8")]);
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function formatMilli(value) {
  let current = BigInt(value);
  let prefix = "";
  if (current < 0n) {
    prefix = "-";
    current = -current;
  }
  const whole = current / 1000n;
  const fraction = current % 1000n;
  if (fraction === 0n) return prefix + whole.toString();
  let digits = fraction.toString().padStart(3, "0");
  while (digits.endsWith("0")) digits = digits.slice(0, -1);
  return prefix + whole.toString() + "." + digits;
}

function routePoints(route) {
  const segments = route.compiled.segments;
  const points = [[segments[0].fromX, segments[0].fromY]];
  for (const segment of segments) points.push([segment.toX, segment.toY]);
  return points.map(function (point) { return formatMilli(point[0]) + "," + formatMilli(point[1]); }).join(" ");
}

function padColor(quality) {
  if (quality === "strong") return { fill: "#ffd34d", stroke: "#fff3a6", range: "#f3b61f" };
  if (quality === "power") return { fill: "#ff865c", stroke: "#ffd4c5", range: "#ff6d3b" };
  if (quality === "specialist") return { fill: "#bb8cff", stroke: "#e8d8ff", range: "#9966dd" };
  return { fill: "#44dcff", stroke: "#d5f8ff", range: "#18a8ce" };
}

function renderHeatmapSvg(report) {
  if (!report || report.approvalEligible !== true || report.schemaVersion !== 1) {
    fail("MAP_REPORT_MODE", "/", "Only the validated map-v1 campaign report can produce this heatmap format");
  }
  const qualityProbeId = report.policy.qualityProbeId;
  const qualityProbe = report.coverage.pads[0].probes.find(function (probe) { return probe.probeId === qualityProbeId; });
  if (!Number.isSafeInteger(qualityProbe.range) || qualityProbe.range <= 0 || qualityProbe.range % 1000 !== 0) {
    fail("MAP_SVG_RANGE", "/coverage", "SVG quality range must be a positive integer world unit");
  }
  const rangeWorldUnits = (BigInt(qualityProbe.range) / 1000n).toString();
  const lines = [];
  lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
  lines.push("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 100\" role=\"img\" aria-labelledby=\"title desc\">");
  lines.push("  <title id=\"title\">" + escapeXml(report.title) + " deterministic pad heatmap</title>");
  lines.push("  <desc id=\"desc\">A 40 by 25 hidden grid, twelve-unit ancient road, and ten approved tower pads. Gold marks strong double-pass pockets; cyan marks standard pads.</desc>");
  lines.push("  <rect width=\"160\" height=\"100\" fill=\"#111a24\"/>");
  lines.push("  <rect x=\"1\" y=\"1\" width=\"158\" height=\"98\" rx=\"3\" fill=\"#24313a\" stroke=\"#d1a95b\" stroke-width=\"1\"/>");
  lines.push("  <g stroke=\"#8aa0a8\" stroke-width=\"0.16\" opacity=\"0.14\">");
  for (let column = 1; column < 40; column++) lines.push("    <path d=\"M " + (column * 4) + " 0 V 100\"/>");
  for (let row = 1; row < 25; row++) lines.push("    <path d=\"M 0 " + (row * 4) + " H 160\"/>");
  lines.push("  </g>");
  const routes = report.routes.slice().sort(function (left, right) { return asciiCompare(left.id, right.id); });
  for (const route of routes) {
    const points = routePoints(route);
    lines.push("  <polyline points=\"" + points + "\" fill=\"none\" stroke=\"#130e0a\" stroke-width=\"14\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
    lines.push("  <polyline points=\"" + points + "\" fill=\"none\" stroke=\"#b9a274\" stroke-width=\"12\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
    lines.push("  <polyline points=\"" + points + "\" fill=\"none\" stroke=\"#dfc994\" stroke-width=\"0.8\" stroke-dasharray=\"3 2\" stroke-linejoin=\"round\"/>");
  }
  lines.push("  <g font-family=\"system-ui,Segoe UI,sans-serif\" text-anchor=\"middle\">");
  for (const pad of report.pads) {
    const colors = padColor(pad.declaredQuality);
    const x = formatMilli(pad.centerMilliUnits.x);
    const y = formatMilli(pad.centerMilliUnits.y);
    const labelY = pad.centerMilliUnits.y >= 85000 ? pad.centerMilliUnits.y - 6500 : pad.centerMilliUnits.y + 6500;
    const exposure = formatMilli(pad.roundedQualityExposureMilliUnits);
    lines.push("    <g id=\"pad-" + escapeXml(pad.id) + "\" data-quality=\"" + escapeXml(pad.declaredQuality) + "\" data-exposure-milli=\"" + pad.roundedQualityExposureMilliUnits + "\">");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"" + rangeWorldUnits + "\" fill=\"none\" stroke=\"" + colors.range + "\" stroke-width=\"0.45\" opacity=\"0.26\"/>");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"4\" fill=\"#081016\" stroke=\"#05090c\" stroke-width=\"1.2\"/>");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"3\" fill=\"" + colors.fill + "\" stroke=\"" + colors.stroke + "\" stroke-width=\"0.65\"/>");
    lines.push("      <text x=\"" + x + "\" y=\"" + formatMilli(pad.centerMilliUnits.y - 500) + "\" fill=\"#071018\" font-size=\"2.7\" font-weight=\"800\">" + escapeXml(pad.id.slice(1)) + "</text>");
    lines.push("      <text x=\"" + x + "\" y=\"" + formatMilli(labelY) + "\" fill=\"#f3f7f8\" stroke=\"#111a24\" stroke-width=\"0.6\" paint-order=\"stroke\" font-size=\"2.7\" font-weight=\"700\">" + escapeXml(pad.id) + " · " + exposure + "</text>");
    lines.push("    </g>");
  }
  lines.push("  </g>");
  lines.push("  <g transform=\"translate(4 8)\" font-family=\"system-ui,Segoe UI,sans-serif\" font-size=\"2.8\" fill=\"#f6ead0\">");
  lines.push("    <rect x=\"0\" y=\"-4.5\" width=\"62\" height=\"6\" rx=\"1.5\" fill=\"#111a24\" opacity=\"0.9\"/>");
  lines.push("    <circle cx=\"3\" cy=\"-1.5\" r=\"1.5\" fill=\"#44dcff\"/><text x=\"6\" y=\"-0.5\">Standard</text>");
  lines.push("    <circle cx=\"27\" cy=\"-1.5\" r=\"1.5\" fill=\"#ffd34d\"/><text x=\"30\" y=\"-0.5\">Strong double-pass</text>");
  lines.push("  </g>");
  lines.push("</svg>");
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}

function normalizedLanePoints(lane) {
  if (!lane || !Array.isArray(lane.subsegments) || lane.subsegments.length === 0) {
    fail("MAP_REPORT_MODE", "/laneSegments", "Normalized physical lanes require compiled subsegments");
  }
  const points = [[lane.subsegments[0].fromX, lane.subsegments[0].fromY]];
  for (const segment of lane.subsegments) points.push([segment.toX, segment.toY]);
  return points.map(function (point) {
    return formatMilli(point[0]) + "," + formatMilli(point[1]);
  }).join(" ");
}

function crossingPoint(report, crossing) {
  const laneA = report.laneSegments.find(function (lane) { return lane.id === crossing.laneAId; });
  const laneB = report.laneSegments.find(function (lane) { return lane.id === crossing.laneBId; });
  const segmentA = laneA && laneA.subsegments.find(function (segment) { return segment.index === crossing.subsegmentAIndex; });
  const segmentB = laneB && laneB.subsegments.find(function (segment) { return segment.index === crossing.subsegmentBIndex; });
  if (!segmentA || !segmentB) fail("MAP_REPORT_MODE", "/crossings/" + crossing.id, "Crossing references missing physical geometry");

  const rx = BigInt(segmentA.toX) - BigInt(segmentA.fromX);
  const ry = BigInt(segmentA.toY) - BigInt(segmentA.fromY);
  const sx = BigInt(segmentB.toX) - BigInt(segmentB.fromX);
  const sy = BigInt(segmentB.toY) - BigInt(segmentB.fromY);
  let denominator = rx * sy - ry * sx;
  if (denominator === 0n) {
    const endpointsA = [[segmentA.fromX, segmentA.fromY], [segmentA.toX, segmentA.toY]];
    const endpointsB = [[segmentB.fromX, segmentB.fromY], [segmentB.toX, segmentB.toY]];
    const shared = endpointsA.find(function (left) {
      return endpointsB.some(function (right) { return left[0] === right[0] && left[1] === right[1]; });
    });
    if (!shared) fail("MAP_REPORT_MODE", "/crossings/" + crossing.id, "Crossing geometry has no renderable point");
    return { x: formatMilli(shared[0]), y: formatMilli(shared[1]) };
  }
  const qpx = BigInt(segmentB.fromX) - BigInt(segmentA.fromX);
  const qpy = BigInt(segmentB.fromY) - BigInt(segmentA.fromY);
  const tNumerator = qpx * sy - qpy * sx;
  let xNumerator = BigInt(segmentA.fromX) * denominator + rx * tNumerator;
  let yNumerator = BigInt(segmentA.fromY) * denominator + ry * tNumerator;
  if (denominator < 0n) {
    denominator = -denominator;
    xNumerator = -xNumerator;
    yNumerator = -yNumerator;
  }
  return {
    x: formatMilli(xNumerator / denominator),
    y: formatMilli(yNumerator / denominator),
  };
}

function renderNormalizedHeatmapSvg(report) {
  if (!report || report.approvalEligible !== true || report.schemaVersion !== 2 || typeof report.missionId !== "string" ||
      !report.grid || !report.policy || !Array.isArray(report.routes) ||
      !Array.isArray(report.laneSegments) || !Array.isArray(report.pads) || !Array.isArray(report.crossings) ||
      !Array.isArray(report.joins) || !Array.isArray(report.anchors) || !Array.isArray(report.exclusions)) {
    fail("MAP_REPORT_MODE", "/", "Only a normalized campaign-map report can produce this heatmap format");
  }
  const grid = report.grid;
  if (!Number.isSafeInteger(grid.columns) || grid.columns <= 0 || !Number.isSafeInteger(grid.rows) || grid.rows <= 0 ||
      !Number.isSafeInteger(grid.cellWorldUnits) || grid.cellWorldUnits <= 0 ||
      !Number.isSafeInteger(grid.widthWorldUnits) || grid.widthWorldUnits <= 2 ||
      !Number.isSafeInteger(grid.heightWorldUnits) || grid.heightWorldUnits <= 2 ||
      !Number.isSafeInteger(report.policy.roadWidthMilliUnits) || report.policy.roadWidthMilliUnits <= 0) {
    fail("MAP_REPORT_MODE", "/grid", "Normalized SVG geometry must use positive safe integers");
  }

  const upperLayers = new Set(report.crossings.filter(function (crossing) {
    return crossing.kind === "overpass";
  }).map(function (crossing) { return crossing.upperLayerId; }));
  const lanes = report.laneSegments.slice().sort(function (left, right) {
    const leftRank = left.kind === "air" ? 2 : (upperLayers.has(left.layerId) ? 1 : 0);
    const rightRank = right.kind === "air" ? 2 : (upperLayers.has(right.layerId) ? 1 : 0);
    if (leftRank !== rightRank) return leftRank - rightRank;
    const layerOrder = asciiCompare(left.layerId, right.layerId);
    return layerOrder === 0 ? asciiCompare(left.id, right.id) : layerOrder;
  });
  const roadWidth = formatMilli(report.policy.roadWidthMilliUnits);
  const roadCasingWidth = formatMilli(BigInt(report.policy.roadWidthMilliUnits) + 2000n);
  const crossingRadius = formatMilli(BigInt(report.policy.roadWidthMilliUnits) / 2n + 1500n);
  const heightMilliUnits = BigInt(grid.heightWorldUnits) * 1000n;
  const lines = [];
  lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
  lines.push("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + grid.widthWorldUnits + " " + grid.heightWorldUnits + "\" role=\"img\" aria-labelledby=\"title desc\">");
  lines.push("  <title id=\"title\">Aegis " + escapeXml(report.missionId) + " normalized physical map heatmap</title>");
  lines.push("  <desc id=\"desc\">" + report.laneSegments.length + " physical lanes, " + report.routes.length + " logical routes, and " + report.pads.length + " approved tower pads. Solid ochre marks ground roads; dashed cyan marks air lanes; rings mark declared crossings.</desc>");
  lines.push("  <rect width=\"" + grid.widthWorldUnits + "\" height=\"" + grid.heightWorldUnits + "\" fill=\"#111a24\"/>");
  lines.push("  <rect x=\"1\" y=\"1\" width=\"" + (grid.widthWorldUnits - 2) + "\" height=\"" + (grid.heightWorldUnits - 2) + "\" rx=\"3\" fill=\"#24313a\" stroke=\"#d1a95b\" stroke-width=\"1\"/>");
  lines.push("  <g id=\"grid\" stroke=\"#8aa0a8\" stroke-width=\"0.16\" opacity=\"0.14\">");
  for (let column = 1; column < grid.columns; column++) {
    lines.push("    <path d=\"M " + (column * grid.cellWorldUnits) + " 0 V " + grid.heightWorldUnits + "\"/>");
  }
  for (let row = 1; row < grid.rows; row++) {
    lines.push("    <path d=\"M 0 " + (row * grid.cellWorldUnits) + " H " + grid.widthWorldUnits + "\"/>");
  }
  lines.push("  </g>");
  if (report.exclusions.length > 0) {
    lines.push("  <g id=\"exclusions\" fill=\"#6d2730\" fill-opacity=\"0.32\" stroke=\"#ff8290\" stroke-width=\"0.55\" stroke-dasharray=\"2 1\">");
    for (const exclusion of report.exclusions) {
      lines.push("    <circle id=\"exclusion-" + escapeXml(exclusion.id) + "\" cx=\"" + formatMilli(exclusion.centerMilliUnits.x) + "\" cy=\"" + formatMilli(exclusion.centerMilliUnits.y) + "\" r=\"" + formatMilli(exclusion.radiusMilliUnits) + "\" data-kind=\"" + escapeXml(exclusion.kind) + "\"/>");
    }
    lines.push("  </g>");
  }
  lines.push("  <g id=\"physical-lanes\">");
  for (const lane of lanes) {
    const points = normalizedLanePoints(lane);
    lines.push("    <g id=\"lane-" + escapeXml(lane.id) + "\" data-lane-segment-id=\"" + escapeXml(lane.id) + "\" data-kind=\"" + escapeXml(lane.kind) + "\" data-layer=\"" + escapeXml(lane.layerId) + "\" data-route-ids=\"" + escapeXml(lane.routeIds.join(",")) + "\">");
    if (lane.kind === "air") {
      lines.push("      <polyline points=\"" + points + "\" fill=\"none\" stroke=\"#082d44\" stroke-width=\"3.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
      lines.push("      <polyline points=\"" + points + "\" fill=\"none\" stroke=\"#5be7ff\" stroke-width=\"1.6\" stroke-dasharray=\"4 2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
    } else {
      const bridge = lane.layerId !== "surface";
      lines.push("      <polyline points=\"" + points + "\" fill=\"none\" stroke=\"#130e0a\" stroke-width=\"" + roadCasingWidth + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
      lines.push("      <polyline points=\"" + points + "\" fill=\"none\" stroke=\"" + (bridge ? "#d8b462" : "#b9a274") + "\" stroke-width=\"" + roadWidth + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
      lines.push("      <polyline points=\"" + points + "\" fill=\"none\" stroke=\"" + (bridge ? "#fff0b3" : "#dfc994") + "\" stroke-width=\"0.8\" stroke-dasharray=\"3 2\" stroke-linejoin=\"round\"/>");
    }
    lines.push("    </g>");
  }
  lines.push("  </g>");
  if (report.crossings.length > 0) {
    lines.push("  <g id=\"crossings\">");
    for (const crossing of report.crossings) {
      const point = crossingPoint(report, crossing);
      const upperLayer = crossing.kind === "overpass" ? " data-upper-layer=\"" + escapeXml(crossing.upperLayerId) + "\"" : "";
      lines.push("    <g id=\"crossing-" + escapeXml(crossing.id) + "\" data-crossing-kind=\"" + escapeXml(crossing.kind) + "\"" + upperLayer + ">");
      lines.push("      <circle cx=\"" + point.x + "\" cy=\"" + point.y + "\" r=\"" + crossingRadius + "\" fill=\"none\" stroke=\"" + (crossing.kind === "overpass" ? "#fff0b3" : "#8ff0bd") + "\" stroke-width=\"0.8\" stroke-dasharray=\"2 1\"/>");
      lines.push("      <circle cx=\"" + point.x + "\" cy=\"" + point.y + "\" r=\"1.1\" fill=\"" + (crossing.kind === "overpass" ? "#d8b462" : "#48c986") + "\"/>");
      lines.push("    </g>");
    }
    lines.push("  </g>");
  }
  if (report.joins.length > 0) {
    lines.push("  <g id=\"joins\" fill=\"#48c986\" stroke=\"#d9ffea\" stroke-width=\"0.55\">");
    for (const join of report.joins) {
      const x = BigInt(join.centerMilliUnits.x);
      const y = BigInt(join.centerMilliUnits.y);
      const points = [
        formatMilli(x) + "," + formatMilli(y - 3000n),
        formatMilli(x + 3000n) + "," + formatMilli(y),
        formatMilli(x) + "," + formatMilli(y + 3000n),
        formatMilli(x - 3000n) + "," + formatMilli(y),
      ].join(" ");
      lines.push("    <polygon id=\"join-" + escapeXml(join.id) + "\" points=\"" + points + "\" data-join-kind=\"" + escapeXml(join.kind) + "\"/>");
    }
    lines.push("  </g>");
  }
  lines.push("  <g id=\"anchors\" font-family=\"system-ui,Segoe UI,sans-serif\" font-size=\"2.5\" font-weight=\"700\">");
  for (const anchor of report.anchors) {
    const x = formatMilli(anchor.centerMilliUnits.x);
    const y = formatMilli(anchor.centerMilliUnits.y);
    const gate = anchor.kind === "gate";
    lines.push("    <g id=\"anchor-" + escapeXml(anchor.id) + "\" data-anchor-kind=\"" + escapeXml(anchor.kind) + "\">");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"2.2\" fill=\"" + (gate ? "#ff865c" : "#8ff0bd") + "\" stroke=\"#0b1118\" stroke-width=\"0.7\"/>");
    lines.push("    </g>");
  }
  lines.push("  </g>");
  lines.push("  <g id=\"pads\" font-family=\"system-ui,Segoe UI,sans-serif\" text-anchor=\"middle\">");
  for (const pad of report.pads) {
    const qualityProbe = pad.probes.find(function (probe) { return probe.probeId === report.policy.qualityProbeId; });
    if (!qualityProbe || !Number.isSafeInteger(qualityProbe.rangeMilliUnits) || qualityProbe.rangeMilliUnits <= 0) {
      fail("MAP_SVG_RANGE", "/pads/" + pad.id, "Normalized SVG quality range must be a positive safe integer");
    }
    const colors = padColor(pad.declaredQuality);
    const x = formatMilli(pad.centerMilliUnits.x);
    const y = formatMilli(pad.centerMilliUnits.y);
    const labelYMilli = BigInt(pad.centerMilliUnits.y) > heightMilliUnits - 15000n ?
      BigInt(pad.centerMilliUnits.y) - 6500n : BigInt(pad.centerMilliUnits.y) + 6500n;
    lines.push("    <g id=\"pad-" + escapeXml(pad.id) + "\" data-quality=\"" + escapeXml(pad.declaredQuality) + "\" data-selection-order=\"" + pad.selectionOrder + "\" data-exposure-milli=\"" + pad.roundedQualityExposureMilliUnits + "\">");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"" + formatMilli(qualityProbe.rangeMilliUnits) + "\" fill=\"none\" stroke=\"" + colors.range + "\" stroke-width=\"0.45\" opacity=\"0.26\"/>");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"4\" fill=\"#081016\" stroke=\"#05090c\" stroke-width=\"1.2\"/>");
    lines.push("      <circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"3\" fill=\"" + colors.fill + "\" stroke=\"" + colors.stroke + "\" stroke-width=\"0.65\"/>");
    lines.push("      <text x=\"" + x + "\" y=\"" + formatMilli(BigInt(pad.centerMilliUnits.y) - 500n) + "\" fill=\"#071018\" font-size=\"2.7\" font-weight=\"800\">" + (pad.selectionOrder + 1) + "</text>");
    lines.push("      <text x=\"" + x + "\" y=\"" + formatMilli(labelYMilli) + "\" fill=\"#f3f7f8\" stroke=\"#111a24\" stroke-width=\"0.6\" paint-order=\"stroke\" font-size=\"2.7\" font-weight=\"700\">" + escapeXml(pad.id) + " / " + formatMilli(pad.roundedQualityExposureMilliUnits) + "</text>");
    lines.push("    </g>");
  }
  lines.push("  </g>");
  lines.push("  <g transform=\"translate(4 8)\" font-family=\"system-ui,Segoe UI,sans-serif\" font-size=\"2.8\" fill=\"#f6ead0\">");
  lines.push("    <rect x=\"0\" y=\"-4.5\" width=\"76\" height=\"6\" rx=\"1.5\" fill=\"#111a24\" opacity=\"0.9\"/>");
  lines.push("    <path d=\"M 2 -1.5 H 9\" stroke=\"#b9a274\" stroke-width=\"2\"/><text x=\"11\" y=\"-0.5\">Ground</text>");
  lines.push("    <path d=\"M 29 -1.5 H 36\" stroke=\"#5be7ff\" stroke-width=\"1.3\" stroke-dasharray=\"2 1\"/><text x=\"38\" y=\"-0.5\">Air</text>");
  lines.push("    <circle cx=\"57\" cy=\"-1.5\" r=\"1.5\" fill=\"#44dcff\"/><text x=\"60\" y=\"-0.5\">Pad</text>");
  lines.push("  </g>");
  lines.push("</svg>");
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}

function createMissionArtifacts(validated) {
  const report = createMissionReport(validated);
  return Object.freeze({
    report: report,
    reportBytes: renderReportJson(report),
    svgBytes: renderHeatmapSvg(report),
  });
}

function createNormalizedMapArtifacts(ir) {
  const report = createNormalizedMapReport(ir);
  return Object.freeze({
    report: report,
    reportBytes: renderReportJson(report),
    svgBytes: renderNormalizedHeatmapSvg(report),
  });
}

module.exports = Object.freeze({
  createMissionReport: createMissionReport,
  createNormalizedMapReport: createNormalizedMapReport,
  renderReportJson: renderReportJson,
  renderHeatmapSvg: renderHeatmapSvg,
  renderNormalizedHeatmapSvg: renderNormalizedHeatmapSvg,
  createMissionArtifacts: createMissionArtifacts,
  createNormalizedMapArtifacts: createNormalizedMapArtifacts,
  formatMilli: formatMilli,
});
