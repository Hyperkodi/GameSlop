"use strict";

class AegisContentError extends Error {
  constructor(diagnostics) {
    const list = Array.isArray(diagnostics) ? diagnostics : [diagnostics];
    const first = list[0] || { code: "CONTENT_ERROR", path: "/", message: "Content validation failed" };
    super(first.code + " " + first.path + ": " + first.message);
    this.name = "AegisContentError";
    this.diagnostics = Object.freeze(list.map(function (item) {
      return Object.freeze({ code: item.code, path: item.path, message: item.message });
    }));
  }
}

function diagnostic(code, path, message) {
  return { code: String(code), path: path || "/", message: String(message) };
}

function fail(code, path, message) {
  throw new AegisContentError(diagnostic(code, path, message));
}

function pointerJoin(base, token) {
  const escaped = String(token).replace(/~/g, "~0").replace(/\//g, "~1");
  return (base && base !== "/" ? base : "") + "/" + escaped;
}

module.exports = Object.freeze({
  AegisContentError: AegisContentError,
  diagnostic: diagnostic,
  fail: fail,
  pointerJoin: pointerJoin,
});
