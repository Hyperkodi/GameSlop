"use strict";

const { fail } = require("./diagnostics.js");

const DECIMAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/;

function checkedMultiply(a, b, path) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    fail("DECIMAL_SAFE_INTEGER", path, "Decimal arithmetic requires safe integers");
  }
  const result = a * b;
  if (!Number.isSafeInteger(result)) fail("DECIMAL_OVERFLOW", path, "Compiled decimal exceeds the safe-integer range");
  return result;
}

function parseExactDecimal(value, scale, path) {
  path = path || "/";
  if (typeof value !== "string") fail("DECIMAL_STRING", path, "Exact decimals must be authored as strings");
  if (!Number.isSafeInteger(scale) || scale <= 0) fail("DECIMAL_SCALE", path, "Decimal scale must be a positive safe integer");
  const match = DECIMAL.exec(value);
  if (!match) fail("DECIMAL_FORMAT", path, "Expected a plain decimal with at most three fractional places");
  const places = match[3] ? match[3].length : 0;
  const divisor = Math.pow(10, places);
  if (!Number.isSafeInteger(divisor) || scale % divisor !== 0) {
    fail("DECIMAL_REPRESENTATION", path, "Decimal cannot be represented exactly at scale " + scale);
  }
  const whole = Number(match[2]);
  const fraction = match[3] ? Number(match[3]) : 0;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) {
    fail("DECIMAL_SAFE_INTEGER", path, "Decimal components must be safe integers");
  }
  const magnitude = checkedMultiply(whole, scale, path) + checkedMultiply(fraction, scale / divisor, path);
  if (!Number.isSafeInteger(magnitude)) fail("DECIMAL_OVERFLOW", path, "Compiled decimal exceeds the safe-integer range");
  return match[1] && magnitude !== 0 ? -magnitude : magnitude;
}

module.exports = Object.freeze({ parseExactDecimal: parseExactDecimal });
