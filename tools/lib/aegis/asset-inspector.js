"use strict";

const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { fail, pointerJoin } = require("./diagnostics.js");

const DEFAULT_LIMITS = Object.freeze({
  maxDimensionPx: 2048,
  maxIndividualBytes: 10 * 1024 * 1024,
});

const DEFAULT_ATLAS_TRANSPARENCY_LIMITS = Object.freeze({
  alphaClearMaximum: 8,
  cornerSampleSizePx: 8,
  minimumFrameClearPixelBasisPoints: 3000,
  maximumFramePerimeterVisibleBasisPoints: 5000,
  maximumFrameCornerVisibleBasisPoints: 5000,
  maximumFrameMagentaPerimeterBasisPoints: 40,
  maximumFrameMagentaCornerBasisPoints: 0,
});

const BASIS_POINT_SCALE = 10000;

const CLAIM_FIELDS = Object.freeze([
  "relativeUrl",
  "sha256",
  "widthPx",
  "heightPx",
  "alphaMode",
  "transferBytes",
  "decodedBytes",
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PORTABLE_IMAGE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:png|webp)$/;
const WEBP_DECODER_PRECONDITION =
  "WebP inspection requires FFmpeg with the webp_pipe demuxer and WebP decoder " +
  "(ffmpeg on PATH, AEGIS_FFMPEG_PATH, or options.ffmpegPath)";
const WEBP_DECODE_TIMEOUT_MS = 15000;

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requirePositiveInteger(value, diagnosticPath, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("ASSET_OPTION", diagnosticPath, label + " must be a positive safe integer");
  }
  return value;
}

function requireAtlasPositiveInteger(value, diagnosticPath, label) {
  if (!Number.isSafeInteger(value) || value <= 0 || Object.is(value, -0)) {
    fail("ASSET_ATLAS_OPTION", diagnosticPath, label + " must be a positive safe integer");
  }
  return value;
}

function requireAtlasRangeInteger(value, minimum, maximum, diagnosticPath, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum || Object.is(value, -0)) {
    fail(
      "ASSET_ATLAS_OPTION",
      diagnosticPath,
      label + " must be a safe integer from " + minimum + " through " + maximum
    );
  }
  return value;
}

function safeAtlasProduct(left, right, diagnosticPath) {
  const product = BigInt(left) * BigInt(right);
  if (product > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail("ASSET_ATLAS_OPTION", diagnosticPath, "Atlas geometry exceeds safe integer arithmetic");
  }
  return Number(product);
}

function atlasLayoutFrom(options) {
  options = options || {};
  const columns = requireAtlasPositiveInteger(options.columns, "/options/columns", "columns");
  const rows = requireAtlasPositiveInteger(options.rows, "/options/rows", "rows");
  const frameWidthPx = requireAtlasPositiveInteger(
    options.frameWidthPx,
    "/options/frameWidthPx",
    "frameWidthPx"
  );
  const frameHeightPx = requireAtlasPositiveInteger(
    options.frameHeightPx,
    "/options/frameHeightPx",
    "frameHeightPx"
  );
  const defaults = DEFAULT_ATLAS_TRANSPARENCY_LIMITS;
  const alphaClearMaximum = requireAtlasRangeInteger(
    options.alphaClearMaximum === undefined ? defaults.alphaClearMaximum : options.alphaClearMaximum,
    0,
    254,
    "/options/alphaClearMaximum",
    "alphaClearMaximum"
  );
  const cornerSampleSizePx = requireAtlasPositiveInteger(
    options.cornerSampleSizePx === undefined ? defaults.cornerSampleSizePx : options.cornerSampleSizePx,
    "/options/cornerSampleSizePx",
    "cornerSampleSizePx"
  );
  const doubledCorner = BigInt(cornerSampleSizePx) * 2n;
  if (doubledCorner > BigInt(frameWidthPx) || doubledCorner > BigInt(frameHeightPx)) {
    fail(
      "ASSET_ATLAS_OPTION",
      "/options/cornerSampleSizePx",
      "cornerSampleSizePx must fit four non-overlapping frame-corner samples"
    );
  }
  const basisPointOption = function (key) {
    return requireAtlasRangeInteger(
      options[key] === undefined ? defaults[key] : options[key],
      0,
      BASIS_POINT_SCALE,
      "/options/" + key,
      key
    );
  };
  return Object.freeze({
    columns: columns,
    rows: rows,
    frameWidthPx: frameWidthPx,
    frameHeightPx: frameHeightPx,
    expectedWidthPx: safeAtlasProduct(columns, frameWidthPx, "/options/frameWidthPx"),
    expectedHeightPx: safeAtlasProduct(rows, frameHeightPx, "/options/frameHeightPx"),
    frameCount: safeAtlasProduct(columns, rows, "/options/rows"),
    alphaClearMaximum: alphaClearMaximum,
    cornerSampleSizePx: cornerSampleSizePx,
    minimumFrameClearPixelBasisPoints: basisPointOption("minimumFrameClearPixelBasisPoints"),
    maximumFramePerimeterVisibleBasisPoints: basisPointOption("maximumFramePerimeterVisibleBasisPoints"),
    maximumFrameCornerVisibleBasisPoints: basisPointOption("maximumFrameCornerVisibleBasisPoints"),
    maximumFrameMagentaPerimeterBasisPoints: basisPointOption("maximumFrameMagentaPerimeterBasisPoints"),
    maximumFrameMagentaCornerBasisPoints: basisPointOption("maximumFrameMagentaCornerBasisPoints"),
  });
}

function limitsFrom(options) {
  options = options || {};
  return Object.freeze({
    maxDimensionPx: requirePositiveInteger(
      options.maxDimensionPx === undefined ? DEFAULT_LIMITS.maxDimensionPx : options.maxDimensionPx,
      "/options/maxDimensionPx",
      "maxDimensionPx"
    ),
    maxIndividualBytes: requirePositiveInteger(
      options.maxIndividualBytes === undefined ? DEFAULT_LIMITS.maxIndividualBytes : options.maxIndividualBytes,
      "/options/maxIndividualBytes",
      "maxIndividualBytes"
    ),
  });
}

function requireRelativeUrl(relativeUrl, diagnosticPath) {
  if (typeof relativeUrl !== "string" || !relativeUrl || relativeUrl.indexOf("\\") !== -1 ||
      path.isAbsolute(relativeUrl) || !PORTABLE_IMAGE_PATH.test(relativeUrl) ||
      /[?#%:]/.test(relativeUrl)) {
    fail("ASSET_REFERENCE", diagnosticPath, "Asset URL must be a portable repo-relative PNG or WebP path");
  }
  const segments = relativeUrl.split("/");
  if (segments.some(function (segment) {
    return !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment);
  })) {
    fail("ASSET_REFERENCE", diagnosticPath, "Asset URL contains an unsafe or non-portable path segment");
  }
  return segments;
}

function resolveRoot(rootDirectory, diagnosticPath) {
  if (typeof rootDirectory !== "string" || !rootDirectory) {
    fail("ASSET_READ", diagnosticPath, "Asset repository root is required");
  }
  const resolved = path.resolve(rootDirectory);
  let stats;
  try { stats = fs.lstatSync(resolved); }
  catch (error) { fail("ASSET_READ", diagnosticPath, "Asset repository root must exist"); }
  if (stats.isSymbolicLink()) fail("ASSET_SYMLINK", diagnosticPath, "Asset repository root cannot be a symlink or junction");
  if (!stats.isDirectory()) fail("ASSET_READ", diagnosticPath, "Asset repository root must be a directory");
  try { return fs.realpathSync(resolved); }
  catch (error) { fail("ASSET_READ", diagnosticPath, "Asset repository root cannot be resolved"); }
}

function exactEntry(parent, segment, diagnosticPath) {
  let names;
  try { names = fs.readdirSync(parent); }
  catch (error) { fail("ASSET_READ", diagnosticPath, "Asset path parent cannot be read"); }
  if (names.indexOf(segment) >= 0) return;
  const folded = segment.toLowerCase();
  if (names.some(function (name) { return name.toLowerCase() === folded; })) {
    fail("ASSET_CASE", diagnosticPath, "Asset path casing does not match the filesystem entry");
  }
  fail("ASSET_READ", diagnosticPath, "Asset file does not exist");
}

function resolveAssetPath(rootDirectory, relativeUrl, diagnosticPath) {
  const segments = requireRelativeUrl(relativeUrl, diagnosticPath);
  const root = resolveRoot(rootDirectory, diagnosticPath);
  let current = root;
  segments.forEach(function (segment, index) {
    exactEntry(current, segment, diagnosticPath);
    current = path.join(current, segment);
    let stats;
    try { stats = fs.lstatSync(current); }
    catch (error) { fail("ASSET_READ", diagnosticPath, "Asset path cannot be inspected"); }
    if (stats.isSymbolicLink()) {
      fail("ASSET_SYMLINK", diagnosticPath, "Asset paths cannot traverse a symlink or junction");
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      fail("ASSET_READ", diagnosticPath, "Asset path has a non-directory component");
    }
    if (index === segments.length - 1 && !stats.isFile()) {
      fail("ASSET_READ", diagnosticPath, "Asset target must be a regular file");
    }
  });
  let real;
  try { real = fs.realpathSync(current); }
  catch (error) { fail("ASSET_READ", diagnosticPath, "Asset file identity cannot be resolved"); }
  const relative = path.relative(root, real);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    fail("ASSET_REFERENCE", diagnosticPath, "Asset path resolves outside the repository root");
  }
  return real;
}

function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function unfilterPngRows(inflated, width, height, channels, bitDepth, diagnosticPath) {
  const rowBytes = Math.ceil(width * channels * bitDepth / 8);
  const expected = height * (rowBytes + 1);
  if (!Number.isSafeInteger(rowBytes) || inflated.length !== expected) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG scanline byte count is inconsistent with IHDR");
  }
  const bytesPerPixel = Math.max(1, Math.ceil(channels * bitDepth / 8));
  const rows = new Array(height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    if (filter > 4) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG uses an unsupported scanline filter");
    const row = Buffer.allocUnsafe(rowBytes);
    const prior = y === 0 ? null : rows[y - 1];
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[inputOffset++];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = prior ? prior[x] : 0;
      const upperLeft = prior && x >= bytesPerPixel ? prior[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      row[x] = (raw + predictor) & 0xff;
    }
    rows[y] = row;
  }
  return rows;
}

function packedSample(row, bitDepth, sampleIndex) {
  if (bitDepth === 8) return row[sampleIndex];
  if (bitDepth === 16) return row.readUInt16BE(sampleIndex * 2);
  const bitOffset = sampleIndex * bitDepth;
  const shift = 8 - bitDepth - (bitOffset % 8);
  return (row[Math.floor(bitOffset / 8)] >>> shift) & ((1 << bitDepth) - 1);
}

function pngInflatedLayout(meta, diagnosticPath) {
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[meta.colorType];
  const rowBits = BigInt(meta.width) * BigInt(channels) * BigInt(meta.bitDepth);
  const rowBytes = (rowBits + 7n) / 8n;
  const expected = BigInt(meta.height) * (rowBytes + 1n);
  if (rowBytes > BigInt(Number.MAX_SAFE_INTEGER) || expected > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail("ASSET_DIMENSION", diagnosticPath, "PNG decoded scanline byte count is unsafe");
  }
  return Object.freeze({
    channels: channels,
    expectedBytes: Number(expected),
    rowBytes: Number(rowBytes),
  });
}

function pngHasVisibleAlpha(meta, idat, transparency, diagnosticPath) {
  const declared = meta.colorType === 4 || meta.colorType === 6 || transparency !== null;
  const layout = pngInflatedLayout(meta, diagnosticPath);
  let inflated;
  try {
    inflated = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: layout.expectedBytes });
  }
  catch (error) { fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG IDAT data cannot be decompressed"); }
  const rows = unfilterPngRows(
    inflated,
    meta.width,
    meta.height,
    layout.channels,
    meta.bitDepth,
    diagnosticPath
  );
  if (!declared) return false;
  const maximumSample = meta.bitDepth === 16 ? 65535 : ((1 << meta.bitDepth) - 1);
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < meta.width; x += 1) {
      if (meta.colorType === 4 || meta.colorType === 6) {
        const alphaIndex = x * layout.channels + layout.channels - 1;
        if (packedSample(row, meta.bitDepth, alphaIndex) < maximumSample) return true;
      } else if (meta.colorType === 3) {
        const paletteIndex = packedSample(row, meta.bitDepth, x);
        if (paletteIndex < transparency.length && transparency[paletteIndex] < 255) return true;
      } else if (meta.colorType === 0) {
        if (packedSample(row, meta.bitDepth, x) === transparency.readUInt16BE(0)) return true;
      } else if (meta.colorType === 2) {
        const base = x * 3;
        if (packedSample(row, meta.bitDepth, base) === transparency.readUInt16BE(0) &&
            packedSample(row, meta.bitDepth, base + 1) === transparency.readUInt16BE(2) &&
            packedSample(row, meta.bitDepth, base + 2) === transparency.readUInt16BE(4)) return true;
      }
    }
  }
  return false;
}

function enforceDimensionLimits(width, height, limits, diagnosticPath) {
  if (width > limits.maxDimensionPx || height > limits.maxDimensionPx) {
    fail("ASSET_DIMENSION", diagnosticPath, "Asset exceeds the maximum pixel dimension");
  }
}

function decodedByteCount(width, height, diagnosticPath) {
  const decoded = BigInt(width) * BigInt(height) * 4n;
  if (decoded > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail("ASSET_DIMENSION", diagnosticPath, "Asset decoded byte count is unsafe");
  }
  return Number(decoded);
}

function parsePng(bytes, diagnosticPath, limits) {
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    fail("ASSET_SIGNATURE", diagnosticPath, "PNG signature is invalid");
  }
  let offset = 8;
  let meta = null;
  let transparency = null;
  let paletteEntries = null;
  let ended = false;
  const idat = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG chunk header is truncated");
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (!Number.isSafeInteger(dataEnd) || crcOffset + 4 > bytes.length) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG chunk escapes the file");
    }
    const type = bytes.toString("ascii", typeStart, dataStart);
    if (!/^[A-Za-z]{4}$/.test(type)) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG chunk type is invalid");
    if (crc32(bytes, typeStart, dataEnd) !== bytes.readUInt32BE(crcOffset)) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG chunk CRC is invalid");
    }
    const data = bytes.subarray(dataStart, dataEnd);
    if (meta === null && type !== "IHDR") fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG IHDR must be the first chunk");
    if (type === "IHDR") {
      if (meta !== null || length !== 13) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG requires one 13-byte IHDR chunk");
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const validDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (width === 0 || height === 0 || !validDepths[colorType] || validDepths[colorType].indexOf(bitDepth) < 0 ||
          data[10] !== 0 || data[11] !== 0 || (data[12] !== 0 && data[12] !== 1)) {
        fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG IHDR contains unsupported or invalid fields");
      }
      enforceDimensionLimits(width, height, limits, diagnosticPath);
      if (data[12] === 1) {
        fail(
          "ASSET_IMAGE_FORMAT",
          diagnosticPath,
          "Interlaced PNG is unsupported because alpha must be proven from decoded pixels"
        );
      }
      meta = { width: width, height: height, bitDepth: bitDepth, colorType: colorType, interlace: data[12] };
    } else if (type === "PLTE") {
      if (length === 0 || length % 3 !== 0 || length > 768) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG palette is invalid");
      paletteEntries = length / 3;
    } else if (type === "tRNS") {
      if (transparency !== null) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG has duplicate transparency chunks");
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      if (length !== 0) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG IEND must be empty");
      ended = true;
      offset = crcOffset + 4;
      break;
    }
    offset = crcOffset + 4;
  }
  if (!meta || !ended || offset !== bytes.length || idat.length === 0) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG is missing required image chunks or has trailing data");
  }
  if (meta.colorType === 3 && paletteEntries === null) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "Indexed PNG requires a palette");
  if (transparency !== null) {
    const validTransparency = (meta.colorType === 0 && transparency.length === 2) ||
      (meta.colorType === 2 && transparency.length === 6) ||
      (meta.colorType === 3 && transparency.length > 0 && transparency.length <= paletteEntries);
    if (!validTransparency) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "PNG transparency chunk does not match its color type");
  }
  return Object.freeze({
    widthPx: meta.width,
    heightPx: meta.height,
    alphaMode: pngHasVisibleAlpha(meta, idat, transparency, diagnosticPath) ? "alpha" : "opaque",
  });
}

function uint24Little(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDecoderPath(options) {
  const configured = options.ffmpegPath === undefined
    ? (process.env.AEGIS_FFMPEG_PATH || "ffmpeg")
    : options.ffmpegPath;
  if (typeof configured !== "string" || !configured || configured.indexOf("\0") !== -1 || configured.length > 4096) {
    fail("ASSET_OPTION", "/options/ffmpegPath", "ffmpegPath must be a bounded executable path");
  }
  return configured;
}

function parseVp8Frame(bytes, dataStart, length, diagnosticPath) {
  if (length < 10 || bytes[dataStart + 3] !== 0x9d || bytes[dataStart + 4] !== 0x01 ||
      bytes[dataStart + 5] !== 0x2a) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8 frame header is invalid");
  }
  const width = bytes.readUInt16LE(dataStart + 6) & 0x3fff;
  const height = bytes.readUInt16LE(dataStart + 8) & 0x3fff;
  if (width === 0 || height === 0) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8 frame dimensions are invalid");
  }
  return Object.freeze({ codec: "VP8", width: width, height: height, alphaHint: false });
}

function parseVp8lFrame(bytes, dataStart, length, diagnosticPath) {
  if (length < 5 || bytes[dataStart] !== 0x2f) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8L frame header is invalid");
  }
  const bits = bytes.readUInt32LE(dataStart + 1);
  if ((bits >>> 29) !== 0) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8L version is unsupported");
  }
  return Object.freeze({
    codec: "VP8L",
    width: (bits & 0x3fff) + 1,
    height: ((bits >>> 14) & 0x3fff) + 1,
    alphaHint: ((bits >>> 28) & 1) !== 0,
  });
}

function parseWebpContainer(bytes, diagnosticPath) {
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    fail("ASSET_SIGNATURE", diagnosticPath, "WebP RIFF signature is invalid");
  }
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP RIFF byte count is inconsistent");
  }
  let offset = 12;
  const chunks = [];
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP chunk header is truncated");
    const type = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const next = dataEnd + (length & 1);
    if (!Number.isSafeInteger(next) || next > bytes.length) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP chunk escapes the file");
    if ((length & 1) && bytes[dataEnd] !== 0) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP chunk padding byte must be zero");
    }
    chunks.push(Object.freeze({ type: type, length: length, dataStart: dataStart, index: chunks.length }));
    offset = next;
  }
  if (chunks.length === 0) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP contains no chunks");

  const supported = new Set(["VP8X", "ICCP", "ALPH", "VP8 ", "VP8L", "EXIF", "XMP "]);
  chunks.forEach(function (chunk) {
    if (!supported.has(chunk.type)) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP contains unsupported chunk " + JSON.stringify(chunk.type));
    }
  });
  const extendedChunks = chunks.filter(function (chunk) { return chunk.type === "VP8X"; });
  if (extendedChunks.length > 1 || (extendedChunks.length === 1 && extendedChunks[0].index !== 0)) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X must be the first and only extended header");
  }
  const imageChunks = chunks.filter(function (chunk) { return chunk.type === "VP8 " || chunk.type === "VP8L"; });
  if (imageChunks.length !== 1) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP requires exactly one non-animated VP8 or VP8L frame");
  }
  const imageChunk = imageChunks[0];
  const image = imageChunk.type === "VP8 "
    ? parseVp8Frame(bytes, imageChunk.dataStart, imageChunk.length, diagnosticPath)
    : parseVp8lFrame(bytes, imageChunk.dataStart, imageChunk.length, diagnosticPath);
  let dimensions = { width: image.width, height: image.height };
  let declaredAlpha = image.alphaHint;

  if (extendedChunks.length === 0) {
    if (chunks.length !== 1) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP feature chunks require one leading VP8X header");
    }
  } else {
    const extended = extendedChunks[0];
    if (extended.length !== 10) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X header must contain ten bytes");
    const flags = bytes[extended.dataStart];
    if ((flags & 0xc1) !== 0 || bytes[extended.dataStart + 1] !== 0 ||
        bytes[extended.dataStart + 2] !== 0 || bytes[extended.dataStart + 3] !== 0) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X contains nonzero reserved bits");
    }
    if ((flags & 0x02) !== 0) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "Animated WebP is unsupported for deterministic static assets");
    }
    dimensions = {
      width: uint24Little(bytes, extended.dataStart + 4) + 1,
      height: uint24Little(bytes, extended.dataStart + 7) + 1,
    };
    if (dimensions.width !== image.width || dimensions.height !== image.height) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X canvas dimensions do not match its image frame");
    }

    const count = function (type) {
      return chunks.filter(function (chunk) { return chunk.type === type; }).length;
    };
    ["ICCP", "ALPH", "EXIF", "XMP "].forEach(function (type) {
      if (count(type) > 1) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP contains duplicate " + type + " chunks");
    });
    const hasIcc = count("ICCP") === 1;
    const hasAlpha = count("ALPH") === 1;
    const hasExif = count("EXIF") === 1;
    const hasXmp = count("XMP ") === 1;
    if (((flags & 0x20) !== 0) !== hasIcc || ((flags & 0x08) !== 0) !== hasExif ||
        ((flags & 0x04) !== 0) !== hasXmp) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X feature flags do not match their chunks");
    }
    const icc = chunks.find(function (chunk) { return chunk.type === "ICCP"; });
    const exif = chunks.find(function (chunk) { return chunk.type === "EXIF"; });
    const xmp = chunks.find(function (chunk) { return chunk.type === "XMP "; });
    if ((icc && icc.index > imageChunk.index) || (exif && exif.index < imageChunk.index) ||
        (xmp && xmp.index < imageChunk.index)) {
      fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP feature chunks are out of canonical order");
    }
    if (image.codec === "VP8") {
      if (((flags & 0x10) !== 0) !== hasAlpha) {
        fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X alpha flag does not match its ALPH chunk");
      }
      if (hasAlpha) {
        const alpha = chunks.find(function (chunk) { return chunk.type === "ALPH"; });
        if (alpha.index !== imageChunk.index - 1 || alpha.length < 1) {
          fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP ALPH must immediately precede VP8 image data");
        }
        const alphaHeader = bytes[alpha.dataStart];
        const compression = alphaHeader & 0x03;
        const preprocessing = (alphaHeader >>> 4) & 0x03;
        if ((alphaHeader & 0xc0) !== 0 || compression > 1 || preprocessing > 1) {
          fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP ALPH header contains reserved values");
        }
      }
      declaredAlpha = hasAlpha;
    } else {
      if (hasAlpha) fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8L must not use a separate ALPH chunk");
      if (((flags & 0x10) !== 0) !== image.alphaHint) {
        fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP VP8X alpha flag disagrees with VP8L image data");
      }
      declaredAlpha = image.alphaHint;
    }
  }

  return Object.freeze({
    declaredAlpha: declaredAlpha,
    heightPx: dimensions.height,
    widthPx: dimensions.width,
  });
}

function decodeWebpPixels(bytes, dimensions, diagnosticPath, options) {
  const expectedBytes = decodedByteCount(dimensions.widthPx, dimensions.heightPx, diagnosticPath);
  const executable = webpDecoderPath(options);
  const result = childProcess.spawnSync(executable, [
    "-v", "error",
    "-xerror",
    "-err_detect", "explode",
    "-nostdin",
    "-threads", "1",
    "-f", "webp_pipe",
    "-i", "pipe:0",
    "-map", "0:v:0",
    "-frames:v", "1",
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "pipe:1",
  ], {
    encoding: null,
    input: bytes,
    maxBuffer: expectedBytes + 1024 * 1024,
    timeout: WEBP_DECODE_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail("ASSET_DECODER_UNAVAILABLE", "/options/ffmpegPath", WEBP_DECODER_PRECONDITION);
    }
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP decoder could not complete: " + result.error.message);
  }
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8").trim() : "";
  if (result.status !== 0 || result.signal !== null || stderr) {
    if (/unknown decoder|decoder .*not found|unknown input format|demuxer .*not found/i.test(stderr)) {
      fail("ASSET_DECODER_UNAVAILABLE", "/options/ffmpegPath", WEBP_DECODER_PRECONDITION);
    }
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP bitstream cannot be decoded");
  }
  if (!Buffer.isBuffer(result.stdout) || result.stdout.length !== expectedBytes) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "WebP decoded pixel count does not match its dimensions");
  }
  return result.stdout;
}

function parseWebp(bytes, diagnosticPath, limits, options) {
  const dimensions = parseWebpContainer(bytes, diagnosticPath);
  enforceDimensionLimits(dimensions.widthPx, dimensions.heightPx, limits, diagnosticPath);
  const pixels = decodeWebpPixels(bytes, dimensions, diagnosticPath, options);
  let actualAlpha = false;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    if (pixels[offset] < 255) {
      actualAlpha = true;
      break;
    }
  }
  if (actualAlpha !== dimensions.declaredAlpha) {
    fail("ASSET_ALPHA_MISMATCH", diagnosticPath, "WebP alpha declaration does not match decoded pixels");
  }
  return {
    widthPx: dimensions.widthPx,
    heightPx: dimensions.heightPx,
    alphaMode: actualAlpha ? "alpha" : "opaque",
    pixels: pixels,
  };
}

function inspectImageBufferDetailed(bytes, relativeUrl, options) {
  options = options || {};
  const diagnosticPath = options.diagnosticPath || "/relativeUrl";
  requireRelativeUrl(relativeUrl, diagnosticPath);
  if (!Buffer.isBuffer(bytes)) fail("ASSET_READ", diagnosticPath, "Asset bytes must be a Buffer");
  const limits = limitsFrom(options);
  if (bytes.length === 0) fail("ASSET_READ", diagnosticPath, "Asset file is empty");
  if (bytes.length > limits.maxIndividualBytes) {
    fail("ASSET_SIZE", diagnosticPath, "Asset exceeds the maximum individual compressed byte limit");
  }
  const format = relativeUrl.endsWith(".png") ? "png" : "webp";
  const parsed = format === "png"
    ? { dimensions: parsePng(bytes, diagnosticPath, limits), pixels: null }
    : (function () {
      const webp = parseWebp(bytes, diagnosticPath, limits, options);
      return { dimensions: webp, pixels: webp.pixels };
    }());
  const dimensions = parsed.dimensions;
  enforceDimensionLimits(dimensions.widthPx, dimensions.heightPx, limits, diagnosticPath);
  const decodedBytes = decodedByteCount(dimensions.widthPx, dimensions.heightPx, diagnosticPath);
  return {
    inspection: Object.freeze({
      relativeUrl: relativeUrl,
      format: format,
      sha256: "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex"),
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      alphaMode: dimensions.alphaMode,
      transferBytes: bytes.length,
      decodedBytes: decodedBytes,
    }),
    pixels: parsed.pixels,
  };
}

function inspectImageBuffer(bytes, relativeUrl, options) {
  return inspectImageBufferDetailed(bytes, relativeUrl, options).inspection;
}

function basisPoints(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Number(BigInt(numerator) * BigInt(BASIS_POINT_SCALE) / BigInt(denominator));
}

function isVisibleMagenta(pixels, offset, alphaClearMaximum) {
  const red = pixels[offset];
  const green = pixels[offset + 1];
  const blue = pixels[offset + 2];
  const alpha = pixels[offset + 3];
  return alpha > alphaClearMaximum && red >= 224 && blue >= 192 && green <= 96 &&
    red - green >= 128 && blue - green >= 96;
}

function inspectAtlasPixels(pixels, layout, diagnosticPath) {
  const width = layout.expectedWidthPx;
  const height = layout.expectedHeightPx;
  const totalPixelCount = safeAtlasProduct(width, height, "/options/frameHeightPx");
  const expectedDecodedBytes = safeAtlasProduct(totalPixelCount, 4, "/options/frameHeightPx");
  if (!Buffer.isBuffer(pixels) || pixels.length !== expectedDecodedBytes) {
    fail("ASSET_IMAGE_FORMAT", diagnosticPath, "Atlas decoded pixel count is inconsistent with its frame geometry");
  }

  const frameClearPixelCounts = new Array(layout.frameCount).fill(0);
  let transparentPixelCount = 0;
  let clearPixelCount = 0;
  let translucentPixelCount = 0;
  let opaquePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    const frameRow = Math.floor(y / layout.frameHeightPx);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha === 0) transparentPixelCount += 1;
      else if (alpha === 255) opaquePixelCount += 1;
      else translucentPixelCount += 1;
      if (alpha <= layout.alphaClearMaximum) {
        clearPixelCount += 1;
        const frameColumn = Math.floor(x / layout.frameWidthPx);
        frameClearPixelCounts[frameRow * layout.columns + frameColumn] += 1;
      }
    }
  }

  const framePixelCount = safeAtlasProduct(
    layout.frameWidthPx,
    layout.frameHeightPx,
    "/options/frameHeightPx"
  );
  let minimumFrameClearPixelBasisPoints = BASIS_POINT_SCALE;
  frameClearPixelCounts.forEach(function (count) {
    minimumFrameClearPixelBasisPoints = Math.min(
      minimumFrameClearPixelBasisPoints,
      basisPoints(count, framePixelCount)
    );
  });

  let perimeterPixelCount = 0;
  let visiblePerimeterPixelCount = 0;
  let visibleMagentaPerimeterPixelCount = 0;
  let maximumFrameVisiblePerimeterBasisPoints = 0;
  let maximumFrameVisibleMagentaPerimeterBasisPoints = 0;
  let cornerPixelCount = 0;
  let visibleCornerPixelCount = 0;
  let visibleMagentaCornerPixelCount = 0;
  let maximumFrameVisibleCornerBasisPoints = 0;
  let maximumFrameVisibleMagentaCornerBasisPoints = 0;

  function sample(frameX, frameY, localX, localY) {
    const x = frameX * layout.frameWidthPx + localX;
    const y = frameY * layout.frameHeightPx + localY;
    const offset = (y * width + x) * 4;
    return {
      magenta: isVisibleMagenta(pixels, offset, layout.alphaClearMaximum),
      visible: pixels[offset + 3] > layout.alphaClearMaximum,
    };
  }

  for (let frameY = 0; frameY < layout.rows; frameY += 1) {
    for (let frameX = 0; frameX < layout.columns; frameX += 1) {
      let framePerimeterPixelCount = 0;
      let frameVisiblePerimeterPixelCount = 0;
      let frameVisibleMagentaPerimeterPixelCount = 0;
      const addPerimeter = function (localX, localY) {
        const measured = sample(frameX, frameY, localX, localY);
        framePerimeterPixelCount += 1;
        if (measured.visible) frameVisiblePerimeterPixelCount += 1;
        if (measured.magenta) frameVisibleMagentaPerimeterPixelCount += 1;
      };
      for (let x = 0; x < layout.frameWidthPx; x += 1) {
        addPerimeter(x, 0);
        addPerimeter(x, layout.frameHeightPx - 1);
      }
      for (let y = 1; y < layout.frameHeightPx - 1; y += 1) {
        addPerimeter(0, y);
        addPerimeter(layout.frameWidthPx - 1, y);
      }
      perimeterPixelCount += framePerimeterPixelCount;
      visiblePerimeterPixelCount += frameVisiblePerimeterPixelCount;
      visibleMagentaPerimeterPixelCount += frameVisibleMagentaPerimeterPixelCount;
      maximumFrameVisiblePerimeterBasisPoints = Math.max(
        maximumFrameVisiblePerimeterBasisPoints,
        basisPoints(frameVisiblePerimeterPixelCount, framePerimeterPixelCount)
      );
      maximumFrameVisibleMagentaPerimeterBasisPoints = Math.max(
        maximumFrameVisibleMagentaPerimeterBasisPoints,
        basisPoints(frameVisibleMagentaPerimeterPixelCount, framePerimeterPixelCount)
      );

      let frameCornerPixelCount = 0;
      let frameVisibleCornerPixelCount = 0;
      let frameVisibleMagentaCornerPixelCount = 0;
      const cornerSize = layout.cornerSampleSizePx;
      for (let y = 0; y < cornerSize; y += 1) {
        for (let x = 0; x < cornerSize; x += 1) {
          [
            [x, y],
            [layout.frameWidthPx - cornerSize + x, y],
            [x, layout.frameHeightPx - cornerSize + y],
            [layout.frameWidthPx - cornerSize + x, layout.frameHeightPx - cornerSize + y],
          ].forEach(function (point) {
            const measured = sample(frameX, frameY, point[0], point[1]);
            frameCornerPixelCount += 1;
            if (measured.visible) frameVisibleCornerPixelCount += 1;
            if (measured.magenta) frameVisibleMagentaCornerPixelCount += 1;
          });
        }
      }
      cornerPixelCount += frameCornerPixelCount;
      visibleCornerPixelCount += frameVisibleCornerPixelCount;
      visibleMagentaCornerPixelCount += frameVisibleMagentaCornerPixelCount;
      maximumFrameVisibleCornerBasisPoints = Math.max(
        maximumFrameVisibleCornerBasisPoints,
        basisPoints(frameVisibleCornerPixelCount, frameCornerPixelCount)
      );
      maximumFrameVisibleMagentaCornerBasisPoints = Math.max(
        maximumFrameVisibleMagentaCornerBasisPoints,
        basisPoints(frameVisibleMagentaCornerPixelCount, frameCornerPixelCount)
      );
    }
  }

  if (minimumFrameClearPixelBasisPoints < layout.minimumFrameClearPixelBasisPoints) {
    fail(
      "ASSET_ATLAS_MATTE",
      diagnosticPath,
      "Every atlas frame must contain a substantial field of decoded clear pixels"
    );
  }
  if (maximumFrameVisibleMagentaPerimeterBasisPoints > layout.maximumFrameMagentaPerimeterBasisPoints ||
      maximumFrameVisibleMagentaCornerBasisPoints > layout.maximumFrameMagentaCornerBasisPoints) {
    fail(
      "ASSET_ATLAS_MAGENTA",
      diagnosticPath,
      "Atlas frame guards contain visible chroma-magenta residue"
    );
  }
  if (maximumFrameVisiblePerimeterBasisPoints > layout.maximumFramePerimeterVisibleBasisPoints ||
      maximumFrameVisibleCornerBasisPoints > layout.maximumFrameCornerVisibleBasisPoints) {
    fail(
      "ASSET_ATLAS_GUTTER",
      diagnosticPath,
      "Atlas frame corners or perimeters exceed the decoded visible-pixel limit"
    );
  }

  return Object.freeze({
    alphaClearMaximum: layout.alphaClearMaximum,
    cornerSampleSizePx: layout.cornerSampleSizePx,
    minimumRequiredFrameClearPixelBasisPoints: layout.minimumFrameClearPixelBasisPoints,
    maximumAllowedFramePerimeterVisibleBasisPoints: layout.maximumFramePerimeterVisibleBasisPoints,
    maximumAllowedFrameCornerVisibleBasisPoints: layout.maximumFrameCornerVisibleBasisPoints,
    maximumAllowedFrameMagentaPerimeterBasisPoints: layout.maximumFrameMagentaPerimeterBasisPoints,
    maximumAllowedFrameMagentaCornerBasisPoints: layout.maximumFrameMagentaCornerBasisPoints,
    totalPixelCount: totalPixelCount,
    transparentPixelCount: transparentPixelCount,
    clearPixelCount: clearPixelCount,
    translucentPixelCount: translucentPixelCount,
    opaquePixelCount: opaquePixelCount,
    clearPixelBasisPoints: basisPoints(clearPixelCount, totalPixelCount),
    minimumFrameClearPixelBasisPoints: minimumFrameClearPixelBasisPoints,
    perimeterPixelCount: perimeterPixelCount,
    visiblePerimeterPixelCount: visiblePerimeterPixelCount,
    maximumFrameVisiblePerimeterBasisPoints: maximumFrameVisiblePerimeterBasisPoints,
    cornerPixelCount: cornerPixelCount,
    visibleCornerPixelCount: visibleCornerPixelCount,
    maximumFrameVisibleCornerBasisPoints: maximumFrameVisibleCornerBasisPoints,
    visibleMagentaPerimeterPixelCount: visibleMagentaPerimeterPixelCount,
    maximumFrameVisibleMagentaPerimeterBasisPoints: maximumFrameVisibleMagentaPerimeterBasisPoints,
    visibleMagentaCornerPixelCount: visibleMagentaCornerPixelCount,
    maximumFrameVisibleMagentaCornerBasisPoints: maximumFrameVisibleMagentaCornerBasisPoints,
  });
}

function inspectAtlasImageBuffer(bytes, relativeUrl, options) {
  options = options || {};
  const diagnosticPath = options.diagnosticPath || "/relativeUrl";
  requireRelativeUrl(relativeUrl, diagnosticPath);
  if (!relativeUrl.endsWith(".webp")) {
    fail("ASSET_ATLAS_FORMAT", diagnosticPath, "Decoded atlas transparency inspection requires WebP");
  }
  const layout = atlasLayoutFrom(options);
  const detailed = inspectImageBufferDetailed(bytes, relativeUrl, options);
  if (detailed.inspection.widthPx !== layout.expectedWidthPx ||
      detailed.inspection.heightPx !== layout.expectedHeightPx) {
    fail("ASSET_ATLAS_DIMENSION", diagnosticPath, "Decoded atlas dimensions do not match its frame grid");
  }
  const transparency = inspectAtlasPixels(detailed.pixels, layout, diagnosticPath);
  return Object.freeze({
    inspection: detailed.inspection,
    transparency: transparency,
  });
}

function readAssetBuffer(rootDirectory, relativeUrl, diagnosticPath) {
  const resolved = resolveAssetPath(rootDirectory, relativeUrl, diagnosticPath);
  try { return fs.readFileSync(resolved); }
  catch (error) { fail("ASSET_READ", diagnosticPath, "Asset file cannot be read"); }
}

function inspectAsset(rootDirectory, relativeUrl, options) {
  options = options || {};
  const diagnosticPath = options.diagnosticPath || "/relativeUrl";
  const bytes = readAssetBuffer(rootDirectory, relativeUrl, diagnosticPath);
  return inspectImageBuffer(bytes, relativeUrl, options);
}

function inspectAtlasAsset(rootDirectory, relativeUrl, options) {
  options = options || {};
  const diagnosticPath = options.diagnosticPath || "/relativeUrl";
  const bytes = readAssetBuffer(rootDirectory, relativeUrl, diagnosticPath);
  return inspectAtlasImageBuffer(bytes, relativeUrl, options);
}

function compareManifestClaim(claim, inspection, diagnosticPath) {
  diagnosticPath = diagnosticPath || "/asset";
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
    fail("ASSET_CLAIM", diagnosticPath, "Asset manifest claim must be an object");
  }
  if (!inspection || typeof inspection !== "object" || Array.isArray(inspection)) {
    fail("ASSET_CLAIM", diagnosticPath, "Asset inspection result must be an object");
  }
  CLAIM_FIELDS.forEach(function (field) {
    if (!own(claim, field)) fail("ASSET_CLAIM", pointerJoin(diagnosticPath, field), "Asset manifest claim is missing this measured field");
    if (claim[field] !== inspection[field]) {
      fail("ASSET_CLAIM_MISMATCH", pointerJoin(diagnosticPath, field), "Asset manifest claim does not match measured file data");
    }
  });
  return inspection;
}

function inspectManifestClaim(rootDirectory, claim, options) {
  options = options || {};
  const diagnosticPath = options.diagnosticPath || "/asset";
  if (!claim || typeof claim !== "object" || Array.isArray(claim) || typeof claim.relativeUrl !== "string") {
    fail("ASSET_CLAIM", diagnosticPath, "Asset manifest claim requires relativeUrl");
  }
  const inspectOptions = Object.assign({}, options, { diagnosticPath: pointerJoin(diagnosticPath, "relativeUrl") });
  const inspection = inspectAsset(rootDirectory, claim.relativeUrl, inspectOptions);
  return compareManifestClaim(claim, inspection, diagnosticPath);
}

module.exports = Object.freeze({
  CLAIM_FIELDS: CLAIM_FIELDS,
  DEFAULT_ATLAS_TRANSPARENCY_LIMITS: DEFAULT_ATLAS_TRANSPARENCY_LIMITS,
  DEFAULT_LIMITS: DEFAULT_LIMITS,
  WEBP_DECODER_PRECONDITION: WEBP_DECODER_PRECONDITION,
  compareManifestClaim: compareManifestClaim,
  inspectAsset: inspectAsset,
  inspectAtlasAsset: inspectAtlasAsset,
  inspectAtlasImageBuffer: inspectAtlasImageBuffer,
  inspectImageBuffer: inspectImageBuffer,
  inspectManifestClaim: inspectManifestClaim,
  resolveAssetPath: resolveAssetPath,
});
