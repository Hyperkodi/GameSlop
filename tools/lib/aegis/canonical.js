"use strict";

const { fail, pointerJoin } = require("./diagnostics.js");

function isAscii(value) {
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) > 0x7f) return false;
  return true;
}

function canonicalEncode(value) {
  const seen = new WeakSet();

  function encode(current, path) {
    if (current === null) return "null";
    const type = typeof current;
    if (type === "boolean" || type === "string") return JSON.stringify(current);
    if (type === "number") {
      if (!Number.isSafeInteger(current)) fail("CANONICAL_INTEGER", path, "Canonical numbers must be safe integers");
      return Object.is(current, -0) ? "0" : String(current);
    }
    if (type !== "object") fail("CANONICAL_TYPE", path, "Unsupported canonical value type " + type);
    if (seen.has(current)) fail("CANONICAL_SHARED", path, "Canonical objects may not contain cycles or shared references");
    seen.add(current);

    let output;
    if (Array.isArray(current)) {
      if (Object.getOwnPropertySymbols(current).length) {
        fail("CANONICAL_ARRAY_PROPERTY", path, "Canonical arrays cannot have symbol properties");
      }
      const ownNames = Object.getOwnPropertyNames(current);
      const parts = [];
      for (let i = 0; i < current.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(current, i)) {
          fail("CANONICAL_SPARSE_ARRAY", pointerJoin(path, i), "Canonical arrays may not be sparse");
        }
        const property = Object.getOwnPropertyDescriptor(current, String(i));
        if (!property.enumerable || property.get || property.set) {
          fail("CANONICAL_ARRAY_PROPERTY", pointerJoin(path, i), "Canonical array elements must be enumerable data properties");
        }
        parts.push(encode(current[i], pointerJoin(path, i)));
      }
      for (const name of ownNames) {
        if (name !== "length" && (
          !/^(0|[1-9][0-9]*)$/.test(name) ||
          !Number.isSafeInteger(Number(name)) ||
          Number(name) >= current.length
        )) {
          fail("CANONICAL_ARRAY_PROPERTY", pointerJoin(path, name), "Canonical arrays cannot have extra properties");
        }
      }
      output = "[" + parts.join(",") + "]";
    } else {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        fail("CANONICAL_OBJECT", path, "Canonical objects must be plain objects");
      }
      if (Object.getOwnPropertySymbols(current).length) {
        fail("CANONICAL_OBJECT_PROPERTY", path, "Canonical objects cannot have symbol properties");
      }
      const keys = Object.getOwnPropertyNames(current);
      for (const key of keys) {
        const property = Object.getOwnPropertyDescriptor(current, key);
        if (!isAscii(key)) {
          fail("CANONICAL_KEY_ASCII", pointerJoin(path, key), "Canonical object keys must be ASCII");
        }
        if (!property.enumerable || property.get || property.set) {
          fail("CANONICAL_OBJECT_PROPERTY", pointerJoin(path, key), "Canonical object properties must be enumerable data properties");
        }
      }
      keys.sort(function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); });
      const parts = [];
      for (const key of keys) {
        parts.push(JSON.stringify(key) + ":" + encode(current[key], pointerJoin(path, key)));
      }
      output = "{" + parts.join(",") + "}";
    }
    return output;
  }

  return encode(value, "/");
}

function canonicalBytes(value) {
  return Buffer.from(canonicalEncode(value), "utf8");
}

module.exports = Object.freeze({ canonicalEncode: canonicalEncode, canonicalBytes: canonicalBytes });
