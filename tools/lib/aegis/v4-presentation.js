"use strict";

/* Schema-v4 presentation companion.
   Presentation catalog v2 is the only accepted authoring version for candidate-v4; the reviewed
   v3 companion builder and validator are imported unchanged so a v4 release cannot drift from
   the audited presentation contract. Compiling never generates or transcodes raster art. */

const { fail } = require("./diagnostics.js");
const V3Presentation = require("./v3-presentation.js");

function requireCatalogSchemaVersion(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
      !Object.prototype.hasOwnProperty.call(catalog, "schemaVersion")) {
    fail("PRESENTATION_SCHEMA_VERSION", "/presentationCatalog/schemaVersion", "Presentation catalog schemaVersion is required");
  }
  if (catalog.schemaVersion !== 2) {
    fail(
      "PRESENTATION_SCHEMA_VERSION",
      "/presentationCatalog/schemaVersion",
      "Compiled content v4 requires presentation catalog schema 2"
    );
  }
  return catalog.schemaVersion;
}

function buildV4PresentationCompanion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("PRESENTATION_INPUT", "/presentation", "Presentation companion input must be an object");
  }
  requireCatalogSchemaVersion(input.presentationCatalog);
  const companion = V3Presentation.buildPresentationCompanion(input);
  if (companion.schemaVersion !== 2) {
    fail("PRESENTATION_SCHEMA_VERSION", "/presentation/schemaVersion", "V4 presentation companions are schema 2");
  }
  return companion;
}

module.exports = Object.freeze({
  buildV4PresentationCompanion: buildV4PresentationCompanion,
  requireCatalogSchemaVersion: requireCatalogSchemaVersion,
  validatePresentationCompanion: V3Presentation.validatePresentationCompanion,
});
