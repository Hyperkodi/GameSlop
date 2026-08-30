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

  if (!await evaluate(`Boolean(document.querySelector(".preview-map-pad"))`)) {
    await evaluate(`(() => {
      const click = (pattern) => {
        const button = Array.from(document.querySelectorAll("button"))
          .find((node) => pattern.test(node.textContent.trim()) && !node.disabled);
        if (!button) throw new Error("Campaign navigation control unavailable: " + pattern);
        button.click();
      };
      click(/CONTINUE: GATE OF DAWN/i);
      return true;
    })()`);
    await delay(400);
    await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((node) => /READ THE BRIEFING/i.test(node.textContent) && !node.disabled);
      if (!button) throw new Error("Read briefing control unavailable");
      button.click();
      return true;
    })()`);
    await delay(250);
    await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((node) => /^START MISSION$/i.test(node.textContent.trim()) && !node.disabled);
      if (!button) throw new Error("Start mission control unavailable");
      button.click();
      return true;
    })()`);
    await delay(450);
  }

  const boot = await evaluate(`(() => {
    const mapPads = Array.from(document.querySelectorAll(".preview-map-pad"));
    const first = mapPads[0];
    const battlefield = document.getElementById("previewBattlefield");
    const picker = document.querySelector(".preview-site-picker");
    if (document.body.dataset.ready !== "1") throw new Error("Aegis preview is not ready");
    if (!first || mapPads.length === 0 || !picker || !picker.hidden) {
      throw new Error("The physical map foundations must be the only visible build-site controls");
    }
    const battlefieldRect = battlefield.getBoundingClientRect();
    const sideRoom = Math.min(battlefieldRect.left, innerWidth - battlefieldRect.right);
    if (battlefieldRect.width > innerWidth - 48 || battlefieldRect.height > innerHeight - 96 ||
        sideRoom < 24 || Math.abs(battlefieldRect.width / battlefieldRect.height - 1.6) > 0.02) {
      throw new Error("The battlefield must fit inside the window with a visible border at its authored aspect ratio");
    }
    window.__aegisQaFocusNode = first;
    first.focus();
    return {
      missionId: window.__gameslop.state.missionId,
      sitePickerHidden: picker.hidden,
      mapPadCount: mapPads.length,
      battlefieldWidth: battlefieldRect.width,
      battlefieldHeight: battlefieldRect.height,
      battlefieldSideRoom: sideRoom,
      viewportWidth: innerWidth,
      battlefieldRole: document.querySelector(".preview-battlefield-svg").getAttribute("role"),
    };
  })()`);

  await delay(350);
  const stableFocus = await evaluate(`(() => ({
    sameNode: window.__aegisQaFocusNode === document.querySelector(".preview-map-pad"),
    active: document.activeElement === window.__aegisQaFocusNode,
  }))()`);
  if (!stableFocus.sameNode || !stableFocus.active) {
    throw new Error("Planning cadence replaced or displaced the focused build-site control");
  }

  const store = await evaluate(`(() => {
    window.__aegisQaFocusNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      !store.atlasHrefs.includes("art/v2/m01/towers/chronos-anim-v1.webp") ||
      !store.atlasHrefs.includes("art/v2/m01/towers/sentinel-anim-v1.webp")) {
    throw new Error("The tower menu did not expose the equipped starter atlases: " + JSON.stringify(store));
  }

  await delay(250);
  const hopliteBuild = await evaluate(`(() => {
    const sprite = document.querySelector('#previewStore [data-asset-href="art/v2/m01/towers/chronos-anim-v1.webp"]');
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
    throw new Error("Chronos is not available to build: " + JSON.stringify(hopliteBuild));
  }
  await delay(180);
  const returnedFocus = await evaluate(`(() => ({
    activePad: document.activeElement && document.activeElement.getAttribute("data-pad-id"),
    state: document.activeElement && document.activeElement.getAttribute("aria-label"),
  }))()`);
  if (returnedFocus.activePad !== "p01" || !/Chronos/.test(returnedFocus.state || "")) {
    throw new Error("Closing the tower menu did not return focus to the built site");
  }

  await evaluate(`(() => {
    const second = document.querySelector('[data-pad-id="p02"]');
    if (!second) throw new Error("A second build site is unavailable");
    second.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const sprite = document.querySelector('#previewStore [data-asset-href="art/v2/m01/towers/sentinel-anim-v1.webp"]');
    const card = sprite && sprite.closest(".preview-card");
    const build = card && card.querySelector("button");
    if (!build || build.disabled) throw new Error("Sentinel is not available to build");
    build.click();
    document.getElementById("previewStoreClose").click();
    document.getElementById("previewStartWave").click();
    return true;
  })()`);
  const animationSamples = [];
  for (let sample = 0; sample < 50; sample += 1) {
    await delay(40);
    const visual = await evaluate(`(() => ({
      frames: Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("data-frame")),
      actions: Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("data-action")),
      transforms: Array.from(document.querySelectorAll(".preview-tower-sprite"), node => node.getAttribute("transform")),
      effectCount: document.querySelectorAll(".preview-tower-effect").length
    }))()`);
    animationSamples.push(visual);
    if (visual.effectCount > 0) break;
  }
  const firstFrames = animationSamples[0].frames;
  const motionStart = await evaluate(`(() => {
    const enemy = window.__gameslop.state.enemies[0];
    const node = document.querySelector(".preview-map-enemy");
    return enemy && node ? { id: enemy.id, distance: enemy.distance, transform: node.getAttribute("transform") } : null;
  })()`);
  await delay(360);
  const motionEnd = await evaluate(`(() => {
    const enemy = window.__gameslop.state.enemies[0];
    const node = document.querySelector(".preview-map-enemy");
    return enemy && node ? { id: enemy.id, distance: enemy.distance, transform: node.getAttribute("transform") } : null;
  })()`);
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
  const sampledFrames = animationSamples.flatMap((sample) => sample.frames);
  const sampledActions = animationSamples.flatMap((sample) => sample.actions);
  const sampledTransforms = animationSamples.flatMap((sample) => sample.transforms);
  if (active.phase !== "wave" || !active.paused || active.frames.length !== 2 ||
      !motionStart || !motionEnd || motionStart.id !== motionEnd.id ||
      motionEnd.distance <= motionStart.distance || motionEnd.transform === motionStart.transform ||
      sampledFrames.some((frame) => !["idleA", "active", "recover"].includes(frame)) ||
      !sampledFrames.includes("active") || sampledTransforms.some((transform) => transform !== null) ||
      !sampledActions.some((action) => action === "active" || action === "recover") ||
      !animationSamples.some((sample) => sample.effectCount > 0) ||
      !active.hrefs.includes("art/v2/m01/towers/chronos-anim-v1.webp") ||
      !active.hrefs.includes("art/v2/m01/towers/sentinel-anim-v1.webp") ||
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
    animationSamples,
    motionStart,
    motionEnd,
    active,
  });
};
