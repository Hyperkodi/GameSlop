"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");
const Records = require("./v3-record-contracts.js");
const PresentationV2 = require("./v3-presentation-v2.js");

const FORBIDDEN_KEYS = new Set([
  "asset", "assets", "assetPath", "assetUrl", "atlas", "bitmap", "decodedBytes",
  "sprite", "spriteRect", "transferBytes", "url",
]);
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const V1_COMPANION_FIELDS = Object.freeze([
  "schemaVersion", "contentVersion", "locale", "fallbackLocale", "strings", "packRecords", "cueMappings",
]);
const V2_COMPANION_FIELDS = Object.freeze([
  "schemaVersion", "contentVersion", "locale", "fallbackLocale", "strings", "id",
  "cameraRecords", "provenanceRecords", "assetRecords", "placementRecords", "packRecords", "cueMappings",
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

function buildPresentationCompanionV1(input) {
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

function requireSchemaVersion(value, diagnosticPath, code) {
  const versionPath = pointerJoin(diagnosticPath, "schemaVersion");
  const descriptor = value && typeof value === "object" && !Array.isArray(value)
    ? Object.getOwnPropertyDescriptor(value, "schemaVersion")
    : null;
  if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
      !Number.isSafeInteger(descriptor.value) ||
      (descriptor.value !== 1 && descriptor.value !== 2)) {
    fail(code, versionPath, "Presentation schemaVersion must be explicitly 1 or 2");
  }
  return descriptor.value;
}

function referencedCueIds(input) {
  const cueIds = new Set((input.eventCatalog && input.eventCatalog.records || []).map(function (record) {
    return record.presentationCueId;
  }));
  (input.missions || []).forEach(function (mission) {
    (mission.previewDeclarations || []).forEach(function (declaration) {
      (declaration.semanticCueIds || []).forEach(function (cueId) { cueIds.add(cueId); });
    });
  });
  return Array.from(cueIds).sort(compareAscii);
}

function buildPresentationCompanionV2(input) {
  if (input.approvalState === "production-approved") {
    fail("PRESENTATION_PRODUCTION_FORBIDDEN", "/approvalState", "Presentation schema v2 is not production-authorized");
  }
  if (typeof input.contentVersion !== "string" || !input.contentVersion) {
    fail("PRESENTATION_INPUT", "/contentVersion", "Presentation contentVersion is required");
  }
  const missionPackRecords = (input.missions || []).map(function (mission) {
    return { missionId: mission.id, presentationPackId: mission.presentationPackId };
  });
  const catalog = Records.validatePresentationCatalogByVersion(input.presentationCatalog, {
    approvalState: input.approvalState,
    missionIds: (input.missions || []).map(function (mission) { return mission.id; }),
    missionPackRecords: missionPackRecords,
    cueIds: referencedCueIds(input),
  });
  const strings = Records.validateStringCatalog(input.stringCatalog);
  return deepFrozenClone({
    schemaVersion: 2,
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
    id: catalog.id,
    cameraRecords: catalog.cameraRecords,
    provenanceRecords: catalog.provenanceRecords,
    assetRecords: catalog.assetRecords,
    placementRecords: catalog.placementRecords,
    packRecords: catalog.packRecords,
    cueMappings: catalog.cueMappings,
  });
}

function buildPresentationCompanion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("PRESENTATION_INPUT", "/presentation", "Presentation companion input must be an object");
  }
  const schemaVersion = requireSchemaVersion(
    input.presentationCatalog,
    "/presentationCatalog",
    "PRESENTATION_SCHEMA_VERSION"
  );
  if (schemaVersion === 1) return buildPresentationCompanionV1(input);
  return buildPresentationCompanionV2(input);
}

function requireExactCompanionFields(value, fields, path) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("PRESENTATION_COMPANION_OBJECT", path, "Presentation companion must be an ordinary object");
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    fail("PRESENTATION_COMPANION_UNKNOWN_KEY", path, "Presentation companion cannot contain symbol fields");
  }
  const allowed = new Set(fields);
  Object.getOwnPropertyNames(value).forEach(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      fail("PRESENTATION_COMPANION_DATA", pointerJoin(path, key), "Presentation companion fields must be enumerable data properties");
    }
    if (!allowed.has(key)) {
      fail("PRESENTATION_COMPANION_UNKNOWN_KEY", pointerJoin(path, key), "Unknown presentation companion field");
    }
  });
  fields.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail("PRESENTATION_COMPANION_REQUIRED", pointerJoin(path, key), "Missing presentation companion field");
    }
  });
}

function cloneCompanionData(value, path, seen, depth) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      fail("PRESENTATION_COMPANION_DATA", path, "Presentation companion numbers must be safe integers");
    }
    return value;
  }
  if (!value || typeof value !== "object") {
    fail("PRESENTATION_COMPANION_DATA", path, "Presentation companion contains JSON data only");
  }
  if (depth > 32) fail("PRESENTATION_COMPANION_DATA", path, "Presentation companion exceeds maximum depth");
  if (seen.has(value)) fail("PRESENTATION_SHARED", path, "Presentation companion cannot contain shared references");
  seen.add(value);
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    fail("PRESENTATION_COMPANION_UNKNOWN_KEY", path, "Presentation companion cannot contain symbol fields");
  }

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      fail("PRESENTATION_COMPANION_OBJECT", path, "Presentation arrays must use the ordinary Array prototype");
    }
    const names = Object.getOwnPropertyNames(value);
    const output = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        fail("PRESENTATION_COMPANION_DATA", pointerJoin(path, index), "Presentation array entries must be enumerable data properties");
      }
      output.push(cloneCompanionData(descriptor.value, pointerJoin(path, index), seen, depth + 1));
    }
    names.forEach(function (name) {
      if (name === "length") return;
      if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length) {
        fail("PRESENTATION_COMPANION_UNKNOWN_KEY", pointerJoin(path, name), "Presentation arrays cannot have extra fields");
      }
    });
    return output;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    fail("PRESENTATION_COMPANION_OBJECT", path, "Presentation records must be ordinary objects");
  }
  const output = {};
  Object.getOwnPropertyNames(value).forEach(function (key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      fail("PRESENTATION_COMPANION_DATA", pointerJoin(path, key), "Presentation fields must be enumerable data properties");
    }
    Object.defineProperty(output, key, {
      value: cloneCompanionData(descriptor.value, pointerJoin(path, key), seen, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  });
  return output;
}

function requireSortedBindingIds(value, path) {
  if (!Array.isArray(value)) fail("PRESENTATION_BINDING", path, "Presentation binding IDs must be an array");
  let previous = null;
  value.forEach(function (id, index) {
    if (typeof id !== "string" || !STABLE_ID.test(id)) {
      fail("PRESENTATION_BINDING", pointerJoin(path, index), "Presentation binding ID is invalid");
    }
    if (previous !== null && previous >= id) {
      fail("PRESENTATION_BINDING", pointerJoin(path, index), "Presentation binding IDs must be unique and ASCII sorted");
    }
    previous = id;
  });
}

function normalizePresentationBindings(bindingInput, required) {
  if (bindingInput === undefined || bindingInput === null) {
    if (required) {
      fail("PRESENTATION_BINDINGS_REQUIRED", "/presentationBindings", "Compiled schema v2 validation requires mission and cue bindings");
    }
    return null;
  }
  requireExactCompanionFields(bindingInput, ["missionIds", "cueIds"], "/presentationBindings");
  const bindings = cloneCompanionData(bindingInput, "/presentationBindings", new WeakSet(), 0);
  requireSortedBindingIds(bindings.missionIds, "/presentationBindings/missionIds");
  requireSortedBindingIds(bindings.cueIds, "/presentationBindings/cueIds");
  return bindings;
}

function derivedMissionPackRecords(packRecords) {
  if (!Array.isArray(packRecords)) return [];
  const assignments = [];
  packRecords.forEach(function (record) {
    if (!record || typeof record !== "object" || typeof record.id !== "string" || !Array.isArray(record.missionIds)) return;
    record.missionIds.forEach(function (missionId) {
      assignments.push({ missionId: missionId, presentationPackId: record.id });
    });
  });
  assignments.sort(function (left, right) { return compareAscii(left.missionId, right.missionId); });
  return assignments;
}

function derivedPresentationBindings(value) {
  const assignments = derivedMissionPackRecords(value.packRecords);
  const missionIds = Array.from(new Set(assignments.map(function (record) { return record.missionId; }))).sort(compareAscii);
  const cueIds = Array.isArray(value.cueMappings)
    ? Array.from(new Set(value.cueMappings.map(function (record) { return record && record.cueId; }))).sort(compareAscii)
    : [];
  return { missionIds: missionIds, cueIds: cueIds };
}

function validateCompanionCoverage(value, diagnosticPath, bindings) {
  const assignments = new Map();
  value.packRecords.forEach(function (record, packIndex) {
    record.missionIds.forEach(function (missionId, missionIndex) {
      const missionPath = pointerJoin(pointerJoin(pointerJoin(diagnosticPath, "packRecords"), packIndex), "missionIds");
      if (assignments.has(missionId)) {
        fail("PRESENTATION_MISSION_ASSIGNMENT", pointerJoin(missionPath, missionIndex), "Mission is assigned to more than one presentation pack");
      }
      assignments.set(missionId, record.id);
    });
  });
  const expectedMissions = new Set(bindings.missionIds);
  if (assignments.size !== expectedMissions.size || Array.from(expectedMissions).some(function (missionId) {
    return !assignments.has(missionId);
  })) {
    fail(
      "PRESENTATION_MISSION_ASSIGNMENT",
      pointerJoin(diagnosticPath, "packRecords"),
      "Compiled presentation packs must cover every included mission exactly once and no others"
    );
  }

  const mappedCues = new Set(value.cueMappings.map(function (record) { return record.cueId; }));
  const expectedCues = new Set(bindings.cueIds);
  if (mappedCues.size !== expectedCues.size || Array.from(expectedCues).some(function (cueId) { return !mappedCues.has(cueId); })) {
    fail(
      "PRESENTATION_CUE_ASSIGNMENT",
      pointerJoin(diagnosticPath, "cueMappings"),
      "Compiled presentation cues must cover every referenced content cue exactly once and no others"
    );
  }
}

function validatePresentationCompanion(value, diagnosticPath, bindingInput) {
  diagnosticPath = diagnosticPath || "/presentation";
  const schemaVersion = requireSchemaVersion(value, diagnosticPath, "PRESENTATION_SCHEMA_UNIMPLEMENTED");
  requireExactCompanionFields(value, schemaVersion === 1 ? V1_COMPANION_FIELDS : V2_COMPANION_FIELDS, diagnosticPath);
  const companion = cloneCompanionData(value, diagnosticPath, new WeakSet(), 0);
  if (typeof companion.contentVersion !== "string" || !companion.contentVersion) {
    fail("PRESENTATION_INPUT", pointerJoin(diagnosticPath, "contentVersion"), "Presentation contentVersion is required");
  }
  Records.validateStringCatalog({
    schemaVersion: 1,
    id: "compiled-presentation-strings-v1",
    locale: companion.locale,
    fallbackLocale: companion.fallbackLocale,
    entries: companion.strings,
  });

  if (schemaVersion === 1) {
    const bindings = normalizePresentationBindings(bindingInput, false) || derivedPresentationBindings(companion);
    Records.validatePresentationCatalog({
      schemaVersion: 1,
      id: "compiled-presentation-v1",
      packRecords: companion.packRecords,
      cueMappings: companion.cueMappings,
    }, {
      approvalState: "candidate-balance",
      missionIds: bindings.missionIds,
      missionPackRecords: derivedMissionPackRecords(companion.packRecords),
      cueIds: bindings.cueIds,
    });
    validateCompanionCoverage(companion, diagnosticPath, bindings);
    return deepFrozenClone(companion);
  }

  PresentationV2.validatePresentationCatalogV2({
    schemaVersion: 2,
    id: companion.id,
    cameraRecords: companion.cameraRecords,
    provenanceRecords: companion.provenanceRecords,
    assetRecords: companion.assetRecords,
    placementRecords: companion.placementRecords,
    packRecords: companion.packRecords,
    cueMappings: companion.cueMappings,
  }, { requireRuntimeReady: true });
  const bindings = normalizePresentationBindings(bindingInput, true);
  validateCompanionCoverage(companion, diagnosticPath, bindings);
  return deepFrozenClone(companion);
}

module.exports = Object.freeze({
  buildPresentationCompanion: buildPresentationCompanion,
  rejectAssetData: rejectAssetData,
  validatePresentationCompanion: validatePresentationCompanion,
});
