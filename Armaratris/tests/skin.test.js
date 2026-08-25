const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SKIN_DIR = path.join(__dirname, "..", "skin", "armara");

function readJson() {
  return JSON.parse(fs.readFileSync(path.join(SKIN_DIR, "skin.json"), "utf8"));
}

test("skin.json has every key the game reads", () => {
  const s = readJson();
  assert.equal(s.name, "armara");
  assert.ok(s.title && s.tagline && s.logo);
  assert.ok(s.fonts.display && s.fonts.body && s.fonts.googleFonts);
  for (const k of ["bg", "bg2", "marble", "gold", "goldDeep", "bronze", "ink", "muted", "well", "grid", "frame", "ghost"]) {
    assert.match(s.palette[k], /^#[0-9A-Fa-f]{6}$/, `palette.${k}`);
  }
  for (const t of ["I", "O", "T", "S", "Z", "J", "L"]) {
    for (const k of ["base", "hi", "lo"]) assert.match(s.tiles[t][k], /^#[0-9A-Fa-f]{6}$/, `tiles.${t}.${k}`);
  }
  assert.ok(s.watermarkAlpha > 0 && s.watermarkAlpha < 0.2);
  for (const k of ["hold", "next", "score", "level", "lines", "best", "start", "paused", "resume", "gameOver", "restart"]) {
    assert.equal(typeof s.strings[k], "string", `strings.${k}`);
  }
  assert.ok(fs.existsSync(path.join(SKIN_DIR, s.logo)), "logo file exists");
});

test("skin.js mirrors skin.json exactly", () => {
  const json = readJson();
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SKIN_DIR, "skin.js"), "utf8"), sandbox);
  assert.deepEqual(sandbox.window.Armaratris.skins.armara, json);
});
