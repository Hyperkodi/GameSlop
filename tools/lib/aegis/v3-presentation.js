"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");
const Records = require("./v3-record-contracts.js");

const FORBIDDEN_KEYS = new Set([
  "asset", "assets", "assetPath", "assetUrl", "atlas", "bitmap", "decodedBytes",
  "sprite", "spriteRect", "transferBytes", "url",
]);

function compareAscii(left, right) {
  return left < right ? -1 : (left > right ? 1 : 0);
}

function deepFrozenClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFrozenClone));
  const output = {};
  Object.keys(value).forEach(function (key) { output[key] = deepFrozenClone(value[key]); });
  return Object.freeze(output);
}

function rejectAssetData(value, diagnosticPath, seen) {
  if (!value || typeof value !== "object") return;
  seen = seen || new WeakSet();
  if (seen.has(value)) fail("PRESENTATION_SHARED", diagnosticPath, "Presentation data cannot contain shared references");
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach(function (item, index) { rejectAssetData(item, pointerJoin(diagnosticPath, index), seen); });
    return;
  }
  Object.keys(value).forEach(function (key) {
    if (FORBIDDEN_KEYS.has(key)) {
      fail("PRESENTATION_ASSET_FORBIDDEN", pointerJoin(diagnosticPath, key), "Presentation schema v1 cannot carry asset records");
    }
    rejectAssetData(value[key], pointerJoin(diagnosticPath, key), seen);
  });
}

function buildPresentationCompanion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("PRESENTATION_INPUT", "/presentation", "Presentation companion input must be an object");
  }
  if (input.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/approvalState", "Presentation schema v1 can never authorize production approval");
  }
  if (typeof input.contentVersion !== "string" || !input.contentVersion) {
    fail("PRESENTATION_INPUT", "/contentVersion", "Presentation contentVersion is required");
  }
  const missionPackRecords = (input.missions || []).map(function (mission) {
    return { missionId: mission.id, presentationPackId: mission.presentationPackId };
  });
  const cueIds = Array.from(new Set((input.eventCatalog && input.eventCatalog.records || []).map(function (record) {
    return record.presentationCueId;
  }))).sort(compareAscii);
  const catalog = Records.validatePresentationCatalog(input.presentationCatalog, {
    approvalState: input.approvalState,
    missionIds: (input.missions || []).map(function (mission) { return mission.id; }),
    missionPackRecords: missionPackRecords,
    cueIds: cueIds,
  });
  const strings = Records.validateStringCatalog(input.stringCatalog);
  rejectAssetData(catalog, "/presentationCatalog");

  const companion = {
    schemaVersion: 1,
    contentVersion: input.contentVersion,
    locale: strings.locale,
    fallbackLocale: strings.fallbackLocale,
    strings: strings.entries.map(function (entry) {
      return {
        key: entry.key,
        value: entry.value,
        placeholders: entry.placeholders.map(function (placeholder) {
          return { name: placeholder.name, type: placeholder.type };
        }),
      };
    }),
    packRecords: catalog.packRecords.map(function (record) {
      return {
        id: record.id,
        kind: record.kind,
        missionIds: record.missionIds.slice(),
        fallbackStyleId: record.fallbackStyleId,
      };
    }),
    cueMappings: catalog.cueMappings.map(function (record) {
      return {
        cueId: record.cueId,
        kind: record.kind,
        fallbackStyleId: record.fallbackStyleId,
      };
    }),
  };
  return deepFrozenClone(companion);
}

module.exports = Object.freeze({
  buildPresentationCompanion: buildPresentationCompanion,
  rejectAssetData: rejectAssetData,
});
