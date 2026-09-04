"use strict";
const assert = require("node:assert/strict");
const manageTowers = require("./aegis-live-tower-management.js");

module.exports = async function (cdp, evaluate, sleep) {
  const management = await manageTowers(cdp, evaluate, sleep);
  await evaluate('document.getElementById("previewPause").click()');
  async function camera() {
    return evaluate(`(() => {
      const svg = document.querySelector(".preview-battlefield-svg");
      const rect = svg.getBoundingClientRect();
      return {box: svg.getAttribute("viewBox").split(" ").map(Number), width: innerWidth,
        frame: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
        tick: __gameslop.state.tick, aether: __gameslop.state.management.aether};
    })()`);
  }
  async function wheel(deltaY, ctrl) {
    const { frame } = await camera();
    await cdp("Input.dispatchMouseEvent", {type: "mouseWheel", x: frame.left + frame.width / 2,
      y: frame.top + frame.height / 2, deltaX: 0, deltaY, modifiers: ctrl ? 2 : 0});
    await sleep(100);
  }
  const before = await camera();
  await wheel(-240, true);
  const zoomed = await camera();
  assert.ok(zoomed.box[2] < before.box[2], "Ctrl + wheel must magnify the map");
  assert.equal(zoomed.width, before.width, "The browser page must not zoom");
  assert.equal(zoomed.tick, before.tick, "Zoom cannot advance a paused simulation");
  assert.equal(zoomed.aether, before.aether);
  const screenshot = await cdp("Page.captureScreenshot", {format: "png", captureBeyondViewport: false});
  require("node:fs").writeFileSync(require("node:path").join(require("node:os").tmpdir(),
    "aegis-zoomed-battlefield.png"), Buffer.from(screenshot.data, "base64"));
  await wheel(-100, false);
  assert.deepEqual((await camera()).box, zoomed.box, "Ordinary scrolling must not zoom");
  await evaluate('window.scrollTo(0, 0)');
  const { frame } = await camera();
  const x = frame.left + frame.width / 2;
  const y = frame.top + frame.height / 2;
  await cdp("Input.dispatchMouseEvent", {type: "mousePressed", x, y, button: "left", clickCount: 1});
  await cdp("Input.dispatchMouseEvent", {type: "mouseMoved", x: x + 60, y: y + 30, buttons: 1});
  await cdp("Input.dispatchMouseEvent", {type: "mouseReleased", x: x + 60, y: y + 30, button: "left", clickCount: 1});
  const panned = await camera();
  assert.ok(panned.box[0] < zoomed.box[0], "Dragging should pan the camera");
  assert.equal(await evaluate("__gameslop.storeOpen"), false, "Dragging cannot open a tower menu");
  await wheel(-400, true);
  await wheel(-400, true);
  assert.ok(Math.abs((await camera()).box[2] - before.box[2] / 3) < .001, "Zoom is capped at 3x");
  await evaluate('document.getElementById("previewMapFit").click()');
  assert.deepEqual((await camera()).box, before.box, "Fit map restores the whole battlefield");
  await evaluate('document.getElementById("previewBattlefield").focus()');
  await cdp("Input.dispatchKeyEvent", {type: "keyDown", key: "+", code: "Equal"});
  await cdp("Input.dispatchKeyEvent", {type: "keyUp", key: "+", code: "Equal"});
  assert.ok((await camera()).box[2] < before.box[2], "Keyboard zoom works");
  const pad = await evaluate(`(() => {
    const node = document.querySelector('.preview-map-pad[data-pad-id="p04"]');
    const box = node.getBoundingClientRect();
    return {x: box.left + box.width / 2, y: box.top + box.height / 2};
  })()`);
  await cdp("Input.dispatchMouseEvent", {type: "mousePressed", ...pad, button: "left", clickCount: 1});
  await cdp("Input.dispatchMouseEvent", {type: "mouseReleased", ...pad, button: "left", clickCount: 1});
  await sleep(100);
  assert.equal(await evaluate("__gameslop.storeOpen"), true, "A real click selects a pad after zoom");
  const held = (await camera()).box;
  await evaluate('document.getElementById("previewStoreClose").click()');
  await evaluate('document.getElementById("previewPause").click()');
  await sleep(400);
  assert.deepEqual((await camera()).box, held, "Combat redraws must preserve zoom");
  await evaluate('document.getElementById("previewMapFit").click()');
  return {before, zoomed, panned, final: await camera(), management};
};
