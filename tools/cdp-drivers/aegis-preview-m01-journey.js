"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

module.exports = async function (_cdp, evaluate) {
  const boot = await evaluate(`(() => ({
    ready: document.body.dataset.ready,
    releaseId: window.__gameslop && window.__gameslop.releaseId,
    viewBox: document.querySelector(".preview-battlefield-svg") &&
      document.querySelector(".preview-battlefield-svg").getAttribute("viewBox"),
    physicalLaneCount: document.querySelector(".preview-road-layer") &&
      document.querySelector(".preview-road-layer").getAttribute("data-physical-lane-count"),
    environmentHref: document.querySelector(".preview-environment-plate") &&
      document.querySelector(".preview-environment-plate").getAttribute("href")
  }))()`);
  if (!boot || boot.ready !== "1" || boot.releaseId !== "slice-dev-v1") {
    throw new Error("M01 preview did not reach its pinned ready state");
  }
  if (boot.viewBox !== "-18000 -12000 198400 124000" || boot.physicalLaneCount !== "1") {
    throw new Error("M01 preview did not use the fixed camera and one physical road");
  }

  await evaluate(`(() => {
    const pad = document.querySelector('[data-pad-id="p04"]') || document.querySelector(".preview-map-pad");
    if (!pad) throw new Error("No build site is available");
    pad.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  })()`);
  await delay(120);
  await evaluate(`(() => {
    const build = Array.from(document.querySelectorAll("#previewStore .preview-card-grid button"))
      .find((button) => !button.disabled);
    if (!build) throw new Error("No affordable M01 tower is available");
    build.click();
    document.getElementById("previewStoreClose").click();
    return true;
  })()`);
  await delay(220);
  await evaluate(`(() => {
    const start = document.getElementById("previewStartWave");
    if (!start || start.disabled) throw new Error("M01 wave cannot start after building");
    start.click();
    return true;
  })()`);
  await delay(320);
  const pauseStartTick = await evaluate(`(() => {
    const pad = document.querySelector('[data-pad-id="p02"]');
    if (!pad) throw new Error("No second M01 build site is available");
    const tick = window.__gameslop.state.tick;
    pad.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return tick;
  })()`);
  await delay(260);
  const pausedAudit = await evaluate(`(() => ({
    paused: window.__gameslop.paused,
    tick: window.__gameslop.state.tick,
    storeOpen: window.__gameslop.storeOpen
  }))()`);
  if (!pausedAudit.paused || !pausedAudit.storeOpen || pausedAudit.tick !== pauseStartTick) {
    throw new Error("Opening a build site during combat did not freeze the simulation");
  }
  await evaluate(`document.getElementById("previewStoreClose").click()`);
  await delay(280);
  const resumedTick = await evaluate(`window.__gameslop.state.tick`);
  if (resumedTick <= pauseStartTick) throw new Error("Closing the combat store did not resume simulation");
  await delay(900);

  const result = await evaluate(`(() => {
    const battlefield = document.getElementById("previewBattlefield");
    battlefield.scrollIntoView({ block: "start" });
    window.scrollBy(0, -72);
    const tower = document.querySelector(".preview-tower-sprite");
    const enemies = Array.from(document.querySelectorAll(".preview-enemy-sprite"));
    return {
      towerCount: document.querySelectorAll(".preview-tower-sprite").length,
      towerFrame: tower && tower.getAttribute("data-frame"),
      enemyCount: enemies.length,
      enemyFrames: enemies.map((node) => node.getAttribute("data-frame")),
      aether: document.getElementById("previewAether").textContent,
      wave: document.getElementById("previewWave").textContent,
      storeOpen: window.__gameslop.storeOpen,
      paused: window.__gameslop.paused
    };
  })()`);
  if (!result || result.towerCount < 1 || result.storeOpen || result.paused) {
    throw new Error("M01 build/start journey did not reach active gameplay");
  }
  return Object.assign({}, boot, result, {
    storePauseTick: pauseStartTick,
    storeResumeTick: resumedTick,
  });
};
