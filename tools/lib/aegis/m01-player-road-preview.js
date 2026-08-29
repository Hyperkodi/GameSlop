"use strict";

const Camera = require("../../../games/aegis/js/presentation/camera.js");
const RoadGeometry = require("../../../games/aegis/js/presentation/road-geometry.js");

const MODEL_BRAND = new WeakSet();
const OUTPUT = Object.freeze({ widthPx: 2048, heightPx: 1280 });
const EXPECTED_ASSETS = Object.freeze({
  environment: Object.freeze({
    id: "environment-gate-of-dawn-v4",
    width: 2048,
    height: 1280,
  }),
  earth: Object.freeze({ id: "road-earth-v2", width: 1024, height: 1024 }),
  limestone: Object.freeze({ id: "road-limestone-v2", width: 1024, height: 1024 }),
  cityCobble: Object.freeze({ id: "road-city-cobble-v2", width: 1024, height: 1024 }),
});
const APPEARANCE = Object.freeze({
  ambientOcclusionOpacity: 0.18,
  shoulderOpacity: 0.5,
  shoulderTransitionOpacity: 0.62,
  coreTransitionOpacity: 0.78,
  transitionHalfLengthMilliUnits: 3000,
});
const M01_MATERIAL_SPANS = Object.freeze([
  Object.freeze({
    id: "earth",
    assetKey: "earth",
    styleId: "ancient-road.packed-earth",
    startMilliUnits: 0,
    endMilliUnits: 48000,
    coreOpacity: 0.82,
    tintColor: "#c99b55",
  }),
  Object.freeze({
    id: "limestone",
    assetKey: "limestone",
    styleId: "ancient-road.worn-limestone",
    startMilliUnits: 48000,
    endMilliUnits: 184000,
    coreOpacity: 0.58,
    tintColor: "#d2ba84",
  }),
  Object.freeze({
    id: "city-cobble",
    assetKey: "cityCobble",
    styleId: "ancient-road.city-cobble",
    startMilliUnits: 184000,
    endMilliUnits: 260000,
    coreOpacity: 0.78,
    tintColor: "#c6a96e",
  }),
]);
const M01_VISUAL_TRANSITIONS = Object.freeze([
  Object.freeze({
    id: "earth-to-limestone",
    fromSpanId: "earth",
    toSpanId: "limestone",
    boundaryMilliUnits: 48000,
  }),
  Object.freeze({
    id: "limestone-to-city-cobble",
    fromSpanId: "limestone",
    toSpanId: "city-cobble",
    boundaryMilliUnits: 184000,
  }),
]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function plainRecord(value, label) {
  if (!isPlainRecord(value)) throw new TypeError(label + " must be a plain object");
  return value;
}

function exactKeys(value, expected, label) {
  plainRecord(value, label);
  const actual = Object.keys(value).sort();
  const wanted = expected.slice().sort();
  if (actual.length !== wanted.length || actual.some(function (key, index) { return key !== wanted[index]; })) {
    throw new TypeError(label + " must contain exactly " + expected.join(", "));
  }
}

function safeInteger(value, label) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    throw new TypeError(label + " must be a safe integer and not negative zero");
  }
  return value;
}

function deepFreeze(value, seen) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  const visited = seen || new WeakSet();
  if (visited.has(value)) return value;
  visited.add(value);
  Object.keys(value).forEach(function (key) { deepFreeze(value[key], visited); });
  return Object.freeze(value);
}

function normalizeAsset(value, key) {
  const label = "assets." + key;
  exactKeys(value, ["dimensions", "href", "id"], label);
  const expected = EXPECTED_ASSETS[key];
  if (value.id !== expected.id) throw new RangeError(label + ".id must be " + expected.id);
  exactKeys(value.dimensions, ["height", "width"], label + ".dimensions");
  if (safeInteger(value.dimensions.width, label + ".dimensions.width") !== expected.width ||
      safeInteger(value.dimensions.height, label + ".dimensions.height") !== expected.height) {
    throw new RangeError(label + " has unexpected dimensions");
  }
  if (typeof value.href !== "string" ||
      !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.href)) {
    throw new TypeError(label + ".href must be one embedded WebP data URI");
  }
  return {
    id: value.id,
    href: value.href,
    dimensions: { width: value.dimensions.width, height: value.dimensions.height },
  };
}

function normalizeAssets(value) {
  exactKeys(value, ["cityCobble", "earth", "environment", "limestone"], "assets");
  return {
    environment: normalizeAsset(value.environment, "environment"),
    earth: normalizeAsset(value.earth, "earth"),
    limestone: normalizeAsset(value.limestone, "limestone"),
    cityCobble: normalizeAsset(value.cityCobble, "cityCobble"),
  };
}

function interpolateCoordinate(origin, delta, offset, length, label) {
  const numerator = BigInt(delta) * BigInt(offset);
  const divisor = BigInt(length);
  if (numerator % divisor !== 0n) {
    throw new RangeError(label + " does not land on an exact milli-unit coordinate");
  }
  const result = BigInt(origin) + numerator / divisor;
  if (result < BigInt(Number.MIN_SAFE_INTEGER) || result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(label + " exceeds the safe-integer range");
  }
  return Number(result);
}

function pointAtDistance(subsegments, distance, totalLength) {
  safeInteger(distance, "Material boundary distance");
  if (distance < 0 || distance > totalLength) throw new RangeError("Material boundary is outside the road");
  if (distance === totalLength) {
    const last = subsegments[subsegments.length - 1];
    return { x: last.toX, y: last.toY };
  }
  const segment = subsegments.find(function (candidate) {
    return distance >= candidate.start && distance < candidate.start + candidate.length;
  });
  if (!segment) throw new RangeError("Material boundary does not resolve to a physical subsegment");
  const offset = distance - segment.start;
  return {
    x: interpolateCoordinate(segment.fromX, segment.deltaX, offset, segment.length, "Material boundary x"),
    y: interpolateCoordinate(segment.fromY, segment.deltaY, offset, segment.length, "Material boundary y"),
  };
}

function samePoint(left, right) {
  return left.x === right.x && left.y === right.y;
}

function spanPoints(subsegments, start, end, totalLength) {
  const points = [pointAtDistance(subsegments, start, totalLength)];
  subsegments.forEach(function (segment) {
    const segmentEnd = segment.start + segment.length;
    if (segmentEnd > start && segmentEnd < end) points.push({ x: segment.toX, y: segment.toY });
  });
  const finalPoint = pointAtDistance(subsegments, end, totalLength);
  if (!samePoint(points[points.length - 1], finalPoint)) points.push(finalPoint);
  if (points.length < 2) throw new RangeError("Every material span must contain physical road length");
  return points;
}

function materialSpans(lane) {
  let expectedStart = 0;
  const spans = M01_MATERIAL_SPANS.map(function (source) {
    RoadGeometry.validateMaterialStyleId(source.styleId, "M01 material " + source.id);
    if (source.startMilliUnits !== expectedStart || source.endMilliUnits <= source.startMilliUnits) {
      throw new RangeError("M01 material spans must form one ordered exact partition");
    }
    expectedStart = source.endMilliUnits;
    return {
      id: source.id,
      assetKey: source.assetKey,
      styleId: source.styleId,
      startMilliUnits: source.startMilliUnits,
      endMilliUnits: source.endMilliUnits,
      coreOpacity: source.coreOpacity,
      tintColor: source.tintColor,
      pointsMilliUnits: spanPoints(
        lane.subsegments,
        source.startMilliUnits,
        source.endMilliUnits,
        lane.lengthMilliUnits
      ),
    };
  });
  if (expectedStart !== lane.lengthMilliUnits) {
    throw new RangeError("M01 material spans must cover the complete physical lane exactly once");
  }
  return spans;
}

function visualTransitions(lane, spans) {
  const spanById = new Map(spans.map(function (span) { return [span.id, span]; }));
  return M01_VISUAL_TRANSITIONS.map(function (source) {
    const from = spanById.get(source.fromSpanId);
    const to = spanById.get(source.toSpanId);
    if (!from || !to || from.endMilliUnits !== source.boundaryMilliUnits ||
        to.startMilliUnits !== source.boundaryMilliUnits) {
      throw new RangeError("M01 visual transitions must straddle exact material boundaries");
    }
    const start = source.boundaryMilliUnits - APPEARANCE.transitionHalfLengthMilliUnits;
    const end = source.boundaryMilliUnits + APPEARANCE.transitionHalfLengthMilliUnits;
    return {
      id: source.id,
      boundaryMilliUnits: source.boundaryMilliUnits,
      startMilliUnits: start,
      endMilliUnits: end,
      fromColor: from.tintColor,
      toColor: to.tintColor,
      pointsMilliUnits: spanPoints(lane.subsegments, start, end, lane.lengthMilliUnits),
    };
  });
}

function assertInsideOutput(projection, points) {
  points.forEach(function (point, index) {
    const pixel = Camera.worldToAsset(projection, point);
    if (pixel.x < 0 || pixel.x > OUTPUT.widthPx || pixel.y < 0 || pixel.y > OUTPUT.heightPx) {
      throw new RangeError("M01 road point " + index + " falls outside the fixed tactical camera");
    }
  });
}

function createM01PlayerRoadModel(ir, assetInput) {
  if (!isPlainRecord(ir) || ir.schemaVersion !== 2 || ir.sourceKind !== "campaign" || ir.id !== "m01") {
    throw new TypeError("M01 player preview requires normalized campaign map m01");
  }
  const assets = normalizeAssets(assetInput);
  const geometry = RoadGeometry.createRoadRenderPieces(ir, {
    ambientOcclusionWidthMilliUnits: RoadGeometry.WIDTHS.maxAmbientOcclusionMilliUnits,
  });
  if (geometry.physicalLaneCount !== 1 || geometry.lanePieces.length !== 1) {
    throw new RangeError("M01 player preview requires exactly one normalized physical ground lane");
  }
  const lane = geometry.lanePieces[0];
  if (lane.lengthMilliUnits !== 260000) {
    throw new RangeError("M01 physical lane must retain its approved 260-world-unit length");
  }
  const projection = Camera.createAssetProjection(Camera.DEFAULT_CAMERA, {
    width: OUTPUT.widthPx,
    height: OUTPUT.heightPx,
  });
  assertInsideOutput(projection, lane.centerlineMilliUnits);
  const spans = materialSpans(lane);
  const model = deepFreeze({
    schemaVersion: 1,
    missionId: "m01",
    title: "Gate of Dawn",
    camera: {
      id: Camera.DEFAULT_CAMERA.id,
      x: Camera.DEFAULT_CAMERA.x,
      y: Camera.DEFAULT_CAMERA.y,
      width: Camera.DEFAULT_CAMERA.width,
      height: Camera.DEFAULT_CAMERA.height,
    },
    output: { widthPx: OUTPUT.widthPx, heightPx: OUTPUT.heightPx },
    assets: assets,
    road: {
      physicalLaneCount: 1,
      widths: {
        coreMilliUnits: RoadGeometry.WIDTHS.coreMilliUnits,
        shoulderPerSideMilliUnits: RoadGeometry.WIDTHS.shoulderPerSideMilliUnits,
        shoulderedMilliUnits: RoadGeometry.WIDTHS.shoulderedMilliUnits,
        ambientOcclusionMilliUnits: RoadGeometry.WIDTHS.maxAmbientOcclusionMilliUnits,
      },
      appearance: {
        ambientOcclusionOpacity: APPEARANCE.ambientOcclusionOpacity,
        shoulderOpacity: APPEARANCE.shoulderOpacity,
        shoulderTransitionOpacity: APPEARANCE.shoulderTransitionOpacity,
        coreTransitionOpacity: APPEARANCE.coreTransitionOpacity,
      },
      centerlineMilliUnits: lane.centerlineMilliUnits.map(function (point) {
        return { x: point.x, y: point.y };
      }),
      materialSpans: spans,
      visualTransitions: visualTransitions(lane, spans),
    },
  });
  MODEL_BRAND.add(model);
  return model;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function formatMilli(value) {
  safeInteger(value, "SVG milli-unit value");
  const negative = value < 0;
  const absolute = BigInt(negative ? -value : value);
  const whole = absolute / 1000n;
  const remainder = absolute % 1000n;
  let output = whole.toString();
  if (remainder !== 0n) {
    output += "." + remainder.toString().padStart(3, "0").replace(/0+$/, "");
  }
  return (negative ? "-" : "") + output;
}

function pathData(points) {
  return points.map(function (point, index) {
    return (index === 0 ? "M " : "L ") + formatMilli(point.x) + " " + formatMilli(point.y);
  }).join(" ");
}

function patternDefinition(span, assets) {
  const asset = assets[span.assetKey];
  return "    <pattern id=\"material-" + escapeXml(span.id) +
    "\" patternUnits=\"userSpaceOnUse\" patternContentUnits=\"userSpaceOnUse\" x=\"0\" y=\"0\" width=\"16\" height=\"16\">\n" +
    "      <image x=\"0\" y=\"0\" width=\"16\" height=\"16\" preserveAspectRatio=\"none\" href=\"" +
    asset.href + "\"/>\n" +
    "    </pattern>";
}

function transitionGradientDefinition(transition) {
  const first = transition.pointsMilliUnits[0];
  const last = transition.pointsMilliUnits[transition.pointsMilliUnits.length - 1];
  return "    <linearGradient id=\"transition-gradient-" + escapeXml(transition.id) +
    "\" gradientUnits=\"userSpaceOnUse\" x1=\"" + formatMilli(first.x) + "\" y1=\"" +
    formatMilli(first.y) + "\" x2=\"" + formatMilli(last.x) + "\" y2=\"" + formatMilli(last.y) + "\">\n" +
    "      <stop offset=\"0\" stop-color=\"" + transition.fromColor + "\" stop-opacity=\"0\"/>\n" +
    "      <stop offset=\"0.3\" stop-color=\"" + transition.fromColor + "\" stop-opacity=\"0.92\"/>\n" +
    "      <stop offset=\"0.5\" stop-color=\"#cdae72\" stop-opacity=\"0.96\"/>\n" +
    "      <stop offset=\"0.7\" stop-color=\"" + transition.toColor + "\" stop-opacity=\"0.92\"/>\n" +
    "      <stop offset=\"1\" stop-color=\"" + transition.toColor + "\" stop-opacity=\"0\"/>\n" +
    "    </linearGradient>";
}

function spanUse(span, className, width, opacity) {
  return "      <use class=\"" + className + "\" href=\"#material-span-" + escapeXml(span.id) +
    "\" fill=\"none\" stroke=\"url(#material-" + escapeXml(span.id) + ")\" stroke-width=\"" +
    formatMilli(width) + "\" stroke-linecap=\"butt\" stroke-linejoin=\"round\"" +
    (opacity === null ? "" : " opacity=\"" + opacity + "\"") +
    " data-material=\"" + escapeXml(span.styleId) + "\"/>";
}

function terminalCircle(id, point, radius, materialId, className, opacity) {
  return "      <circle id=\"" + id + "\" class=\"" + className + "\" cx=\"" + formatMilli(point.x) +
    "\" cy=\"" + formatMilli(point.y) + "\" r=\"" + formatMilli(radius) +
    "\" fill=\"url(#material-" + materialId + ")\"" +
    (opacity === null ? "" : " opacity=\"" + opacity + "\"") + "/>";
}

function transitionUse(transition, className, width, opacity) {
  return "      <use class=\"" + className + "\" href=\"#visual-transition-" +
    escapeXml(transition.id) + "\" fill=\"none\" stroke=\"url(#transition-gradient-" +
    escapeXml(transition.id) + ")\" stroke-width=\"" + formatMilli(width) +
    "\" stroke-linecap=\"butt\" stroke-linejoin=\"round\" opacity=\"" + opacity +
    "\" data-display-only=\"true\"/>";
}

function renderM01PlayerRoadSvg(model) {
  if (!model || !MODEL_BRAND.has(model)) {
    throw new TypeError("A model created by createM01PlayerRoadModel is required");
  }
  const camera = model.camera;
  const spans = model.road.materialSpans;
  const transitions = model.road.visualTransitions;
  const firstSpan = spans[0];
  const lastSpan = spans[spans.length - 1];
  const firstPoint = firstSpan.pointsMilliUnits[0];
  const lastPoint = lastSpan.pointsMilliUnits[lastSpan.pointsMilliUnits.length - 1];
  const lines = [];
  lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
  lines.push("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + model.output.widthPx +
    "\" height=\"" + model.output.heightPx + "\" viewBox=\"" +
    [formatMilli(camera.x), formatMilli(camera.y), formatMilli(camera.width), formatMilli(camera.height)].join(" ") +
    "\" role=\"img\" aria-labelledby=\"title desc\" shape-rendering=\"geometricPrecision\">");
  lines.push("  <title id=\"title\">Gate of Dawn battlefield</title>");
  lines.push("  <desc id=\"desc\">A sunrise ancient Greek city approach with one continuous earth and stone road.</desc>");
  lines.push("  <defs>");
  spans.forEach(function (span) { lines.push(patternDefinition(span, model.assets)); });
  transitions.forEach(function (transition) { lines.push(transitionGradientDefinition(transition)); });
  lines.push("    <path id=\"physical-road-m01\" d=\"" + pathData(model.road.centerlineMilliUnits) + "\"/>");
  spans.forEach(function (span) {
    lines.push("    <path id=\"material-span-" + escapeXml(span.id) + "\" d=\"" +
      pathData(span.pointsMilliUnits) + "\"/>");
  });
  transitions.forEach(function (transition) {
    lines.push("    <path id=\"visual-transition-" + escapeXml(transition.id) + "\" d=\"" +
      pathData(transition.pointsMilliUnits) + "\"/>");
  });
  lines.push("  </defs>");
  lines.push("  <image id=\"environment-gate-of-dawn\" x=\"" + formatMilli(camera.x) + "\" y=\"" +
    formatMilli(camera.y) + "\" width=\"" + formatMilli(camera.width) + "\" height=\"" +
    formatMilli(camera.height) + "\" preserveAspectRatio=\"none\" href=\"" + model.assets.environment.href + "\"/>");
  lines.push("  <g id=\"m01-player-road\" data-physical-lane-count=\"1\">");
  lines.push("    <use id=\"road-ambient-occlusion\" href=\"#physical-road-m01\" fill=\"none\" stroke=\"#2a1b0d\" stroke-opacity=\"" +
    model.road.appearance.ambientOcclusionOpacity + "\" stroke-width=\"" +
    formatMilli(model.road.widths.ambientOcclusionMilliUnits) +
    "\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>");
  lines.push("    <g id=\"road-natural-shoulders\">");
  spans.forEach(function (span) {
    lines.push(spanUse(span, "road-shoulder", model.road.widths.shoulderedMilliUnits,
      model.road.appearance.shoulderOpacity));
  });
  transitions.forEach(function (transition) {
    lines.push(transitionUse(
      transition,
      "road-shoulder-transition",
      model.road.widths.shoulderedMilliUnits,
      model.road.appearance.shoulderTransitionOpacity
    ));
  });
  lines.push(terminalCircle(
    "road-entry-shoulder-cap", firstPoint, model.road.widths.shoulderedMilliUnits / 2,
    firstSpan.id, "road-terminal-shoulder", model.road.appearance.shoulderOpacity
  ));
  lines.push(terminalCircle(
    "road-exit-shoulder-cap", lastPoint, model.road.widths.shoulderedMilliUnits / 2,
    lastSpan.id, "road-terminal-shoulder", model.road.appearance.shoulderOpacity
  ));
  lines.push("    </g>");
  lines.push("    <g id=\"road-visible-core\">");
  spans.forEach(function (span) {
    lines.push(spanUse(span, "road-core", model.road.widths.coreMilliUnits, span.coreOpacity));
  });
  transitions.forEach(function (transition) {
    lines.push(transitionUse(
      transition,
      "road-core-transition",
      model.road.widths.coreMilliUnits,
      model.road.appearance.coreTransitionOpacity
    ));
  });
  lines.push(terminalCircle(
    "road-entry-core-cap", firstPoint, model.road.widths.coreMilliUnits / 2,
    firstSpan.id, "road-terminal-core", firstSpan.coreOpacity
  ));
  lines.push(terminalCircle(
    "road-exit-core-cap", lastPoint, model.road.widths.coreMilliUnits / 2,
    lastSpan.id, "road-terminal-core", lastSpan.coreOpacity
  ));
  lines.push("    </g>");
  lines.push("  </g>");
  lines.push("</svg>");
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}

module.exports = Object.freeze({
  APPEARANCE: APPEARANCE,
  EXPECTED_ASSETS: EXPECTED_ASSETS,
  M01_MATERIAL_SPANS: M01_MATERIAL_SPANS,
  M01_VISUAL_TRANSITIONS: M01_VISUAL_TRANSITIONS,
  OUTPUT: OUTPUT,
  createM01PlayerRoadModel: createM01PlayerRoadModel,
  renderM01PlayerRoadSvg: renderM01PlayerRoadSvg,
});
