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
  if (!report || report.approvalEligible !== true) fail("MAP_REPORT_MODE", "/", "Legacy reports cannot produce campaign heatmaps");
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

function createMissionArtifacts(validated) {
  const report = createMissionReport(validated);
  return Object.freeze({
    report: report,
    reportBytes: renderReportJson(report),
    svgBytes: renderHeatmapSvg(report),
  });
}

module.exports = Object.freeze({
  createMissionReport: createMissionReport,
  renderReportJson: renderReportJson,
  renderHeatmapSvg: renderHeatmapSvg,
  createMissionArtifacts: createMissionArtifacts,
  formatMilli: formatMilli,
});
