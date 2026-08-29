"use strict";

const { fail } = require("./diagnostics.js");
const { formatMilli } = require("./map-report.js");

const DEFAULT_CAMERA = Object.freeze({
  id: "camera.overscan-16x10-v1",
  x: -18000,
  y: -12000,
  width: 198400,
  height: 124000,
});

const GUIDE_WIDTH_PX = 2048;
const GUIDE_HEIGHT_PX = 1280;
const CORE_WIDTH_MILLI = 8000;
const TACTICAL_WIDTH_MILLI = 12000;
const CALM_WIDTH_MILLI = 16000;
const PAD_CLEAR_RADIUS_MILLI = 10000;

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function cameraRecord(input) {
  const camera = input || DEFAULT_CAMERA;
  if (!camera || typeof camera !== "object" || Array.isArray(camera) ||
      typeof camera.id !== "string" || !camera.id ||
      !Number.isSafeInteger(camera.x) || !Number.isSafeInteger(camera.y) ||
      !Number.isSafeInteger(camera.width) || !Number.isSafeInteger(camera.height) ||
      camera.width <= 0 || camera.height <= 0 || camera.width * 5 !== camera.height * 8) {
    fail("ART_GUIDE_CAMERA", "/camera", "Art guide requires one safe fixed 16:10 camera record");
  }
  if (camera.id !== DEFAULT_CAMERA.id || camera.x !== DEFAULT_CAMERA.x || camera.y !== DEFAULT_CAMERA.y ||
      camera.width !== DEFAULT_CAMERA.width || camera.height !== DEFAULT_CAMERA.height) {
    fail(
      "ART_GUIDE_CAMERA_IDENTITY",
      "/camera",
      "Art guide requires the exact reviewed camera.overscan-16x10-v1 tuple"
    );
  }
  return {
    id: camera.id,
    x: camera.x,
    y: camera.y,
    width: camera.width,
    height: camera.height,
  };
}

function pointInsideCamera(x, y, camera) {
  return x >= camera.x && x <= camera.x + camera.width && y >= camera.y && y <= camera.y + camera.height;
}

function circleInsideCamera(x, y, radius, camera) {
  return pointInsideCamera(x - radius, y - radius, camera) &&
    pointInsideCamera(x + radius, y + radius, camera);
}

function assertNormalizedMap(ir) {
  if (!ir || ir.schemaVersion !== 2 || ir.sourceKind !== "campaign" || !ir.board || !ir.road ||
      !Array.isArray(ir.laneSegments) || !Array.isArray(ir.pads) || !Array.isArray(ir.anchors) ||
      !Array.isArray(ir.exclusions) || !Array.isArray(ir.joins) || !Array.isArray(ir.crossings)) {
    fail("ART_GUIDE_MAP", "/", "Art guide requires a normalized campaign map-v2 IR");
  }
  if (ir.road.widthMilliUnits !== TACTICAL_WIDTH_MILLI) {
    fail("ART_GUIDE_ROAD_WIDTH", "/road/widthMilliUnits", "Art guide requires the binding twelve-world-unit tactical road");
  }
}

function normalizeLane(lane, path) {
  if (!lane || typeof lane.id !== "string" || !lane.id || !lane.compiled || !Array.isArray(lane.compiled.subsegments) ||
      lane.compiled.subsegments.length === 0 || typeof lane.kind !== "string" || typeof lane.layerId !== "string") {
    fail("ART_GUIDE_LANE", path, "Art guide lane lacks normalized physical geometry");
  }
  if (lane.kind !== "ground" && lane.kind !== "air") {
    fail("ART_GUIDE_LANE", path + "/kind", "Art guide lanes must be ground or air");
  }
  const points = [];
  lane.compiled.subsegments.forEach(function (segment, index) {
    const values = [segment.fromX, segment.fromY, segment.toX, segment.toY];
    if (!values.every(Number.isSafeInteger)) {
      fail("ART_GUIDE_LANE", path + "/subsegments/" + index, "Lane coordinates must be safe integers");
    }
    if (index === 0) points.push({ x: segment.fromX, y: segment.fromY });
    const previous = points[points.length - 1];
    if (previous.x !== segment.fromX || previous.y !== segment.fromY) {
      fail("ART_GUIDE_LANE", path + "/subsegments/" + index, "Lane subsegments must form one contiguous physical polyline");
    }
    points.push({ x: segment.toX, y: segment.toY });
  });
  return {
    id: lane.id,
    kind: lane.kind,
    layerId: lane.layerId,
    routeIds: Array.isArray(lane.routeIds) ? lane.routeIds.slice().sort(compareAscii) : [],
    points: points,
  };
}

function createArtGuideModel(ir, cameraInput) {
  assertNormalizedMap(ir);
  const camera = cameraRecord(cameraInput);
  const board = {
    x: 0,
    y: 0,
    width: ir.board.widthWorldUnits * 1000,
    height: ir.board.heightWorldUnits * 1000,
  };
  const corners = [
    [board.x, board.y], [board.x + board.width, board.y],
    [board.x, board.y + board.height], [board.x + board.width, board.y + board.height],
  ];
  if (!corners.every(function (point) { return pointInsideCamera(point[0], point[1], camera); })) {
    fail("ART_GUIDE_CAMERA_CONTAINMENT", "/camera", "Fixed camera must contain the complete logical board");
  }

  const normalizedLanes = ir.laneSegments.map(function (lane, index) {
    return normalizeLane(lane, "/laneSegments/" + index);
  }).sort(function (left, right) { return compareAscii(left.id, right.id); });
  normalizedLanes.forEach(function (lane) {
    lane.points.forEach(function (point) {
      if (!pointInsideCamera(point.x, point.y, camera)) {
        fail("ART_GUIDE_CAMERA_CONTAINMENT", "/laneSegments/" + lane.id, "Fixed camera must contain every physical-lane point");
      }
    });
  });
  const lanes = normalizedLanes.filter(function (lane) { return lane.kind === "ground"; });
  const airLanes = normalizedLanes.filter(function (lane) { return lane.kind === "air"; });

  const pads = ir.pads.map(function (pad) {
    if (!pad || typeof pad.id !== "string" || !Number.isSafeInteger(pad.x) || !Number.isSafeInteger(pad.y)) {
      fail("ART_GUIDE_PAD", "/pads", "Art guide pads require stable IDs and safe centers");
    }
    if (!circleInsideCamera(pad.x, pad.y, PAD_CLEAR_RADIUS_MILLI, camera)) {
      fail("ART_GUIDE_CAMERA_CONTAINMENT", "/pads/" + pad.id, "Fixed camera must contain the complete pad-clear disk");
    }
    return { id: pad.id, x: pad.x, y: pad.y, clearRadius: PAD_CLEAR_RADIUS_MILLI };
  }).sort(function (left, right) { return compareAscii(left.id, right.id); });

  const anchors = ir.anchors.map(function (anchor) {
    if (!anchor || typeof anchor.id !== "string" || typeof anchor.kind !== "string" ||
        !Number.isSafeInteger(anchor.x) || !Number.isSafeInteger(anchor.y)) {
      fail("ART_GUIDE_ANCHOR", "/anchors", "Art guide anchors require stable IDs, kinds, and safe centers");
    }
    if (!pointInsideCamera(anchor.x, anchor.y, camera)) {
      fail("ART_GUIDE_CAMERA_CONTAINMENT", "/anchors/" + anchor.id, "Fixed camera must contain every anchor center");
    }
    return { id: anchor.id, kind: anchor.kind, x: anchor.x, y: anchor.y };
  }).sort(function (left, right) { return compareAscii(left.id, right.id); });

  const exclusions = ir.exclusions.map(function (exclusion) {
    if (!exclusion || typeof exclusion.id !== "string" || typeof exclusion.kind !== "string" ||
        !Number.isSafeInteger(exclusion.x) || !Number.isSafeInteger(exclusion.y) ||
        !Number.isSafeInteger(exclusion.radiusMilliUnits) || exclusion.radiusMilliUnits <= 0) {
      fail("ART_GUIDE_EXCLUSION", "/exclusions", "Art guide exclusions require stable geometry");
    }
    if (!circleInsideCamera(exclusion.x, exclusion.y, exclusion.radiusMilliUnits, camera)) {
      fail("ART_GUIDE_CAMERA_CONTAINMENT", "/exclusions/" + exclusion.id, "Fixed camera must contain the complete exclusion disk");
    }
    return {
      id: exclusion.id,
      kind: exclusion.kind,
      x: exclusion.x,
      y: exclusion.y,
      radius: exclusion.radiusMilliUnits,
    };
  }).sort(function (left, right) { return compareAscii(left.id, right.id); });

  const joins = ir.joins.map(function (join) {
    if (!join || typeof join.id !== "string" || typeof join.kind !== "string" ||
        !Number.isSafeInteger(join.x) || !Number.isSafeInteger(join.y) ||
        !Array.isArray(join.incomingLaneSegmentIds) || !Array.isArray(join.outgoingLaneSegmentIds)) {
      fail("ART_GUIDE_JOIN", "/joins", "Art guide joins require stable IDs, kinds, centers, and lane membership");
    }
    if (!pointInsideCamera(join.x, join.y, camera)) {
      fail("ART_GUIDE_CAMERA_CONTAINMENT", "/joins/" + join.id, "Fixed camera must contain every join center");
    }
    return {
      id: join.id,
      kind: join.kind,
      x: join.x,
      y: join.y,
      incomingLaneSegmentIds: join.incomingLaneSegmentIds.slice(),
      outgoingLaneSegmentIds: join.outgoingLaneSegmentIds.slice(),
    };
  }).sort(function (left, right) { return compareAscii(left.id, right.id); });

  const crossings = ir.crossings.map(function (crossing) {
    return {
      id: crossing.id,
      kind: crossing.kind,
      laneAId: crossing.laneAId,
      laneBId: crossing.laneBId,
      subsegmentAIndex: crossing.subsegmentAIndex,
      subsegmentBIndex: crossing.subsegmentBIndex,
      upperLayerId: Object.prototype.hasOwnProperty.call(crossing, "upperLayerId") ? crossing.upperLayerId : null,
    };
  }).sort(function (left, right) { return compareAscii(left.id, right.id); });

  return deepFreeze({
    schemaVersion: 1,
    missionId: ir.id,
    camera: camera,
    output: { widthPx: GUIDE_WIDTH_PX, heightPx: GUIDE_HEIGHT_PX },
    board: board,
    widths: {
      coreMilliUnits: CORE_WIDTH_MILLI,
      tacticalMilliUnits: TACTICAL_WIDTH_MILLI,
      calmMilliUnits: CALM_WIDTH_MILLI,
      padClearRadiusMilliUnits: PAD_CLEAR_RADIUS_MILLI,
    },
    lanes: lanes,
    airLanes: airLanes,
    pads: pads,
    anchors: anchors,
    exclusions: exclusions,
    joins: joins,
    crossings: crossings,
  });
}

function polylinePoints(lane) {
  return lane.points.map(function (point) {
    return formatMilli(point.x) + "," + formatMilli(point.y);
  }).join(" ");
}

function renderArtGuideSvg(model) {
  if (!model || model.schemaVersion !== 1 || !model.camera || !Array.isArray(model.lanes)) {
    fail("ART_GUIDE_MODEL", "/", "Art guide renderer requires a validated guide model");
  }
  const camera = model.camera;
  const lines = [];
  lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
  lines.push("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + model.output.widthPx + "\" height=\"" + model.output.heightPx + "\" viewBox=\"" +
    [formatMilli(camera.x), formatMilli(camera.y), formatMilli(camera.width), formatMilli(camera.height)].join(" ") + "\" role=\"img\" aria-labelledby=\"title desc\">");
  lines.push("  <title id=\"title\">" + escapeXml(model.missionId) + " production art guide</title>");
  lines.push("  <desc id=\"desc\">Fixed 16:10 camera guide. Green is the landmark-safe base outside overlaid clearances. Red is the ground-route calm corridor. Dashed cyan marks air clearance. Blue circles are neutral pad clear zones. Teal markers are joins. This image is not player-facing art.</desc>");
  lines.push("  <rect x=\"" + formatMilli(camera.x) + "\" y=\"" + formatMilli(camera.y) + "\" width=\"" + formatMilli(camera.width) + "\" height=\"" + formatMilli(camera.height) + "\" fill=\"#143f37\"/>");
  lines.push("  <rect id=\"safe-landmark-zone-board\" x=\"0\" y=\"0\" width=\"" + formatMilli(model.board.width) + "\" height=\"" + formatMilli(model.board.height) + "\" fill=\"#245f4f\" stroke=\"#f7f0d7\" stroke-width=\"0.8\" data-guide-only=\"true\"/>");
  lines.push("  <g id=\"quiet-corridors\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">");
  model.lanes.forEach(function (lane) {
    const points = polylinePoints(lane);
    lines.push("    <polyline id=\"calm-" + escapeXml(lane.id) + "\" points=\"" + points + "\" stroke=\"#ff4268\" stroke-width=\"" + formatMilli(model.widths.calmMilliUnits) + "\" opacity=\"0.44\" data-layer=\"" + escapeXml(lane.layerId) + "\"/>");
    lines.push("    <polyline id=\"tactical-" + escapeXml(lane.id) + "\" points=\"" + points + "\" stroke=\"#ff9a3c\" stroke-width=\"" + formatMilli(model.widths.tacticalMilliUnits) + "\" opacity=\"0.66\"/>");
    lines.push("    <polyline id=\"visual-core-" + escapeXml(lane.id) + "\" points=\"" + points + "\" stroke=\"#fff4a8\" stroke-width=\"" + formatMilli(model.widths.coreMilliUnits) + "\" opacity=\"0.92\"/>");
  });
  lines.push("  </g>");
  if (model.airLanes.length) {
    lines.push("  <g id=\"air-clearance-corridors\" fill=\"none\" stroke=\"#61e6ff\" stroke-width=\"" + formatMilli(model.widths.tacticalMilliUnits) + "\" stroke-dasharray=\"3 2\" stroke-linecap=\"round\" opacity=\"0.46\">");
    model.airLanes.forEach(function (lane) {
      lines.push("    <polyline id=\"air-clearance-" + escapeXml(lane.id) + "\" points=\"" + polylinePoints(lane) + "\" data-layer=\"" + escapeXml(lane.layerId) + "\"/>");
    });
    lines.push("  </g>");
  }
  if (model.joins.length) {
    lines.push("  <g id=\"joins\" fill=\"#5ef0c2\" stroke=\"#05261e\" stroke-width=\"0.8\" font-family=\"system-ui,Segoe UI,sans-serif\" font-size=\"2.2\" font-weight=\"700\" text-anchor=\"middle\" data-guide-only=\"true\">");
    model.joins.forEach(function (join) {
      lines.push("    <g id=\"join-" + escapeXml(join.id) + "\" data-kind=\"" + escapeXml(join.kind) + "\" data-incoming=\"" + escapeXml(join.incomingLaneSegmentIds.join(" ")) + "\" data-outgoing=\"" + escapeXml(join.outgoingLaneSegmentIds.join(" ")) + "\">");
      lines.push("      <circle cx=\"" + formatMilli(join.x) + "\" cy=\"" + formatMilli(join.y) + "\" r=\"4\"/>");
      lines.push("      <path d=\"M " + formatMilli(join.x - 2300) + " " + formatMilli(join.y) + " H " + formatMilli(join.x + 2300) + " M " + formatMilli(join.x) + " " + formatMilli(join.y - 2300) + " V " + formatMilli(join.y + 2300) + "\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"0.65\"/>");
      lines.push("      <text x=\"" + formatMilli(join.x) + "\" y=\"" + formatMilli(join.y - 5600) + "\" fill=\"#ffffff\" stroke=\"#071018\" stroke-width=\"0.55\" paint-order=\"stroke\">" + escapeXml(join.id) + "</text>");
      lines.push("    </g>");
    });
    lines.push("  </g>");
  }
  lines.push("  <g id=\"pad-clear-zones\" fill=\"#36c8ff\" fill-opacity=\"0.34\" stroke=\"#bceeff\" stroke-width=\"0.65\" font-family=\"system-ui,Segoe UI,sans-serif\" font-size=\"2.4\" text-anchor=\"middle\" data-guide-only=\"true\" data-semantic=\"neutral-clear-disk\">");
  model.pads.forEach(function (pad) {
    lines.push("    <circle id=\"pad-clear-" + escapeXml(pad.id) + "\" cx=\"" + formatMilli(pad.x) + "\" cy=\"" + formatMilli(pad.y) + "\" r=\"" + formatMilli(pad.clearRadius) + "\"/>");
    lines.push("    <text x=\"" + formatMilli(pad.x) + "\" y=\"" + formatMilli(pad.y + 700) + "\" fill=\"#06131a\">" + escapeXml(pad.id) + "</text>");
  });
  lines.push("  </g>");
  if (model.exclusions.length) {
    lines.push("  <g id=\"exclusions\" fill=\"#b66cff\" fill-opacity=\"0.38\" stroke=\"#ecd8ff\" stroke-width=\"0.7\">");
    model.exclusions.forEach(function (exclusion) {
      lines.push("    <circle id=\"exclusion-" + escapeXml(exclusion.id) + "\" cx=\"" + formatMilli(exclusion.x) + "\" cy=\"" + formatMilli(exclusion.y) + "\" r=\"" + formatMilli(exclusion.radius) + "\" data-kind=\"" + escapeXml(exclusion.kind) + "\"/>");
    });
    lines.push("  </g>");
  }
  lines.push("  <g id=\"anchors\" font-family=\"system-ui,Segoe UI,sans-serif\" font-size=\"2.2\" font-weight=\"700\">");
  model.anchors.forEach(function (anchor) {
    lines.push("    <g id=\"anchor-" + escapeXml(anchor.id) + "\" data-kind=\"" + escapeXml(anchor.kind) + "\">");
    lines.push("      <circle cx=\"" + formatMilli(anchor.x) + "\" cy=\"" + formatMilli(anchor.y) + "\" r=\"2.8\" fill=\"#ffffff\" stroke=\"#071018\" stroke-width=\"0.8\"/>");
    lines.push("      <text x=\"" + formatMilli(anchor.x) + "\" y=\"" + formatMilli(anchor.y - 4300) + "\" fill=\"#ffffff\" stroke=\"#071018\" stroke-width=\"0.6\" paint-order=\"stroke\">" + escapeXml(anchor.id) + "</text>");
    lines.push("    </g>");
  });
  lines.push("  </g>");
  lines.push("  <g transform=\"translate(" + formatMilli(camera.x + 3500) + " " + formatMilli(camera.y + 6500) + ")\" font-family=\"system-ui,Segoe UI,sans-serif\" fill=\"#ffffff\" font-size=\"2.5\">");
  lines.push("    <rect x=\"0\" y=\"-4.5\" width=\"79\" height=\"8\" rx=\"1.5\" fill=\"#071018\" opacity=\"0.9\"/>");
  lines.push("    <text x=\"2\" y=\"0\">GREEN landmark-safe / RED quiet / BLUE pads / TEAL joins / WHITE anchors</text>");
  lines.push("  </g>");
  lines.push("</svg>");
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}

module.exports = Object.freeze({
  CALM_WIDTH_MILLI: CALM_WIDTH_MILLI,
  CORE_WIDTH_MILLI: CORE_WIDTH_MILLI,
  DEFAULT_CAMERA: DEFAULT_CAMERA,
  GUIDE_HEIGHT_PX: GUIDE_HEIGHT_PX,
  GUIDE_WIDTH_PX: GUIDE_WIDTH_PX,
  PAD_CLEAR_RADIUS_MILLI: PAD_CLEAR_RADIUS_MILLI,
  TACTICAL_WIDTH_MILLI: TACTICAL_WIDTH_MILLI,
  createArtGuideModel: createArtGuideModel,
  renderArtGuideSvg: renderArtGuideSvg,
});
