"use strict";

const { TextDecoder } = require("node:util");
const { fail, pointerJoin } = require("./diagnostics.js");
const MAX_JSON_DEPTH = 256;

function decodeUtf8(bytes, label) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    fail("JSON_BOM", "/", label + " must be UTF-8 without a BOM");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    fail("JSON_UTF8", "/", label + " is not valid UTF-8");
  }
}

function parseStrictJsonBytes(bytes, label) {
  label = label || "JSON source";
  const text = decodeUtf8(bytes, label);
  let index = 0;

  function syntax(path, message) {
    fail("JSON_PARSE", path, label + ": " + message + " at byte-character " + index);
  }

  function whitespace() {
    while (index < text.length && /[\x20\t\r\n]/.test(text[index])) index++;
  }

  function parseString(path) {
    if (text[index] !== '"') syntax(path, "Expected string");
    const start = index++;
    while (index < text.length) {
      const code = text.charCodeAt(index);
      if (code === 0x22) {
        index++;
        let value;
        try { value = JSON.parse(text.slice(start, index)); }
        catch (error) { syntax(path, "Invalid string escape"); }
        for (let offset = 0; offset < value.length; offset++) {
          const unit = value.charCodeAt(offset);
          if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(offset + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) {
              fail("JSON_STRING_UNICODE", path, label + ": JSON strings cannot contain lone surrogate code units");
            }
            offset++;
          } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            fail("JSON_STRING_UNICODE", path, label + ": JSON strings cannot contain lone surrogate code units");
          }
        }
        return value;
      }
      if (code < 0x20) syntax(path, "Unescaped control character in string");
      if (code === 0x5c) {
        index++;
        if (index >= text.length) syntax(path, "Unterminated string escape");
        if (text[index] === "u") {
          const hex = text.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) syntax(path, "Invalid Unicode escape");
          index += 5;
          continue;
        }
        if (!/["\\/bfnrt]/.test(text[index])) syntax(path, "Invalid string escape");
      }
      index++;
    }
    syntax(path, "Unterminated string");
  }

  function parseNumber(path) {
    const start = index;
    if (text[index] === "-") index++;
    if (text[index] === "0") index++;
    else {
      if (!/[1-9]/.test(text[index] || "")) syntax(path, "Invalid number");
      while (/[0-9]/.test(text[index] || "")) index++;
    }
    if (text[index] === ".") {
      index++;
      if (!/[0-9]/.test(text[index] || "")) syntax(path, "Invalid fractional number");
      while (/[0-9]/.test(text[index] || "")) index++;
    }
    if (text[index] === "e" || text[index] === "E") {
      index++;
      if (text[index] === "+" || text[index] === "-") index++;
      if (!/[0-9]/.test(text[index] || "")) syntax(path, "Invalid exponent");
      while (/[0-9]/.test(text[index] || "")) index++;
    }
    const token = text.slice(start, index);
    if (!/^-?(0|[1-9][0-9]*)$/.test(token)) {
      fail("JSON_NUMBER_FORMAT", path, label + ": JSON numbers must be plain integers; author exact decimals as strings");
    }
    const value = Number(token);
    if (!Number.isSafeInteger(value)) fail("JSON_NUMBER_UNSAFE", path, label + ": JSON integer exceeds the safe-integer range");
    return Object.is(value, -0) ? 0 : value;
  }

  function parseArray(path, depth) {
    index++;
    whitespace();
    const value = [];
    if (text[index] === "]") { index++; return value; }
    while (index < text.length) {
      value.push(parseValue(pointerJoin(path, value.length), depth + 1));
      whitespace();
      if (text[index] === "]") { index++; return value; }
      if (text[index] !== ",") syntax(path, "Expected ',' or ']'");
      index++;
      whitespace();
    }
    syntax(path, "Unterminated array");
  }

  function parseObject(path, depth) {
    index++;
    whitespace();
    // A null prototype ensures authored keys such as "__proto__" remain inert data and
    // cannot alter the parsed object's prototype before unknown-key validation runs.
    const value = Object.create(null);
    const keys = new Set();
    if (text[index] === "}") { index++; return value; }
    while (index < text.length) {
      const key = parseString(path);
      const keyPath = pointerJoin(path, key);
      if (keys.has(key)) fail("JSON_DUPLICATE_KEY", keyPath, label + ": duplicate object key " + JSON.stringify(key));
      keys.add(key);
      whitespace();
      if (text[index] !== ":") syntax(keyPath, "Expected ':' after object key");
      index++;
      whitespace();
      value[key] = parseValue(keyPath, depth + 1);
      whitespace();
      if (text[index] === "}") { index++; return value; }
      if (text[index] !== ",") syntax(path, "Expected ',' or '}'");
      index++;
      whitespace();
    }
    syntax(path, "Unterminated object");
  }

  function parseValue(path, depth) {
    if (depth > MAX_JSON_DEPTH) fail("JSON_DEPTH", path, label + ": JSON nesting exceeds " + MAX_JSON_DEPTH);
    whitespace();
    const token = text[index];
    if (token === "{") return parseObject(path, depth);
    if (token === "[") return parseArray(path, depth);
    if (token === '"') return parseString(path);
    if (token === "-" || /[0-9]/.test(token || "")) return parseNumber(path);
    if (text.slice(index, index + 4) === "true") { index += 4; return true; }
    if (text.slice(index, index + 5) === "false") { index += 5; return false; }
    if (text.slice(index, index + 4) === "null") { index += 4; return null; }
    syntax(path, "Unexpected token");
  }

  whitespace();
  const value = parseValue("/", 0);
  whitespace();
  if (index !== text.length) syntax("/", "Unexpected trailing content");
  return value;
}

module.exports = Object.freeze({ decodeUtf8: decodeUtf8, parseStrictJsonBytes: parseStrictJsonBytes });
