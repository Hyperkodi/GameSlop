"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

module.exports = async function (_cdp, evaluate) {
  const requestedMission = await evaluate(`new URL(location.href).searchParams.get("mission")`);
  if (requestedMission) {
    await evaluate(`(() => {
      const requestedMission = new URL(location.href).searchParams.get("mission");
      const mission = document.getElementById("previewMission");
      if (!mission || !Array.from(mission.options).some((option) => option.value === requestedMission)) {
        throw new Error("Requested mission is unavailable in the developer preview");
      }
      mission.value = requestedMission;
      mission.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("previewReset").click();
      return true;
    })()`);
    await delay(250);
  }

  const boot = await evaluate(`(() => {
    const siteButtons = Array.from(document.querySelectorAll("#previewSiteList .preview-site-button"));
    const mapPads = Array.from(document.querySelectorAll(".preview-map-pad"));
    const first = siteButtons[0];
    if (document.body.dataset.ready !== "1") throw new Error("Aegis preview is not ready");
    if (!first || siteButtons.length !== mapPads.length) {
      throw new Error("Build-site companion controls do not match the physical map pads");
    }
    const rect = first.getBoundingClientRect();
    const style = getComputedStyle(first);
    const labels = siteButtons.map((button) => button.textContent.trim());
    if (rect.height < 48 || parseFloat(style.minHeight) < 48) {
      throw new Error("Build-site controls do not meet the 48px touch target");
    }
    if (labels.some((label, index) => !label.startsWith("Site " + (index + 1)))) {
      throw new Error("Build-site controls expose implementation labels instead of neutral site numbers");
    }
    window.__aegisQaFocusNode = first;
    first.focus();
    return {
      missionId: window.__gameslop.state.missionId,
      siteCount: siteButtons.length,
      mapPadCount: mapPads.length,
      minimumSiteHeight: parseFloat(style.minHeight),
      renderedSiteHeight: rect.height,
      battlefieldRole: document.querySelector(".preview-battlefield-svg").getAttribute("role"),
    };
  })()`);

  await delay(350);
  const stableFocus = await evaluate(`(() => ({
    sameNode: window.__aegisQaFocusNode === document.querySelector("#previewSiteList .preview-site-button"),
    active: document.activeElement === window.__aegisQaFocusNode,
  }))()`);
  if (!stableFocus.sameNode || !stableFocus.active) {
    throw new Error("Planning cadence replaced or displaced the focused build-site control");
  }

  const store = await evaluate(`(() => {
    window.__aegisQaFocusNode.click();
    const cards = Array.from(document.querySelectorAll("#previewStore .preview-card"));
    const thumbnails = Array.from(document.querySelectorAll("#previewStore .preview-tower-thumbnail-sprite"));
    return {
      open: window.__gameslop.storeOpen,
      closeFocused: document.activeElement === document.getElementById("previewStoreClose"),
      towerNames: cards.map((card) => (card.querySelector("h4") || {}).textContent || ""),
      atlasHrefs: thumbnails.map((sprite) => sprite.getAttribute("data-asset-href")),
    };
  })()`);
  if (!store.open || !store.closeFocused ||
      !store.atlasHrefs.includes("art/v2/shared/towers/hoplite-anim-v1.webp") ||
      !store.atlasHrefs.includes("art/v2/shared/towers/oracle-anim-v1.webp")) {
    throw new Error("The tower menu did not expose the Hoplite and Oracle atlases: " + JSON.stringify(store));
  }

  await delay(250);
  const hopliteBuild = await evaluate(`(() => {
    const sprite = document.querySelector('#previewStore [data-asset-href="art/v2/shared/towers/hoplite-anim-v1.webp"]');
    const card = sprite && sprite.closest(".preview-card");
    const build = card && card.querySelector("button");
    if (!build || build.disabled) return {
      built: false,
      found: Boolean(build),
      disabled: Boolean(build && build.disabled),
      title: build && build.title,
      cardText: card && card.textContent.trim(),
    };
    build.click();
    document.getElementById("previewStoreClose").click();
    return { built: true };
  })()`);
  if (!hopliteBuild.built) {
    throw new Error("Hoplite is not available to build: " + JSON.stringify(hopliteBuild));
  }
  await delay(180);
  const returnedFocus = await evaluate(`(() => ({
    activeSite: document.activeElement && document.activeElement.getAttribute("data-site-number"),
    state: document.activeElement && document.activeElement.textContent.trim(),
  }))()`);
  if (returnedFocus.activeSite !== "1" || !/Hoplite/.test(returnedFocus.state || "")) {
    throw new Error("Closing the tower menu did not return focus to the built site");
  }

  await evaluate(`(() => {
    const second = document.querySelector('[data-site-number="2"]');
    if (!second) throw new Error("A second build site is unavailable");
    second.click();
    const sprite = document.querySelector('#previewStore [data-asset-href="art/v2/shared/towers/oracle-anim-v1.webp"]');
    const card = sprite && sprite.closest(".preview-card");
    const build = card && card.querySelector("button");
    if (!build || build.disabled) throw new Error("Oracle is not available to build");
    build.click();
    document.getElementById("previewStoreClose").click();
    document.getElementById("previewStartWave").click();
    return true;
  })()`);
  await delay(320);
  const firstFrames = await evaluate(`Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("data-frame"))`);
  await delay(520);
  await evaluate(`document.getElementById("previewPause").click()`);
  await delay(220);
  const active = await evaluate(`(() => ({
    frames: Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("data-frame")),
    hrefs: Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("data-asset-href")),
    states: Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("data-asset-state")),
    errorCount: document.querySelectorAll('[data-asset-state="error"]').length,
    visibleFallbackCount: document.querySelectorAll('.preview-sprite-fallback[visibility="visible"]').length,
    tick: window.__gameslop.state.tick,
    phase: window.__gameslop.state.management.phase,
    paused: window.__gameslop.paused,
  }))()`);
  if (active.phase !== "wave" || !active.paused || active.frames.length !== 2 ||
      JSON.stringify(active.frames) === JSON.stringify(firstFrames) ||
      !active.hrefs.includes("art/v2/shared/towers/hoplite-anim-v1.webp") ||
      !active.hrefs.includes("art/v2/shared/towers/oracle-anim-v1.webp") ||
      active.states.some((state) => state !== "loaded") || active.errorCount !== 0 ||
      active.visibleFallbackCount !== 0) {
    throw new Error("Animated tower delivery failed live QA: " + JSON.stringify({ firstFrames, active }));
  }

  await evaluate(`document.getElementById("previewBattlefield").scrollIntoView({ block: "center" })`);
  return Object.assign({}, boot, {
    stableFocus,
    store,
    returnedFocus,
    firstFrames,
    active,
  });
};
