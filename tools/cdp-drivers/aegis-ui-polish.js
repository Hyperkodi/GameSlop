"use strict";

/* Visual regression journey using real controls. Result fixtures exercise the
   production view without awarding progress or writing a player profile. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

module.exports = async function (cdp, evaluate, sleep) {
  const report = { screens: [], screenshots: [] };
  const viewport = await evaluate("({width: innerWidth, height: innerHeight})");
  async function click(label) {
    await evaluate(`(() => {
      const expression = new RegExp(${JSON.stringify(label)}, "i");
      const button = Array.from(document.querySelectorAll("button")).find(node =>
        expression.test(node.textContent.trim()) && !node.disabled && node.getClientRects().length);
      if (!button) throw new Error("Missing visible button: " + expression);
      button.click();
    })()`);
    await sleep(150);
  }
  async function capture(name) {
    const audit = await evaluate(`(() => {
      const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden";
      const overflow = document.documentElement.scrollWidth > innerWidth + 1;
      const smallControls = Array.from(document.querySelectorAll("button, input[type=text], select"))
        .filter(visible).filter(node => node.getBoundingClientRect().height < 43)
        .map(node => ({text: node.textContent.trim(), height: node.getBoundingClientRect().height}));
      const names = Array.from(document.querySelectorAll("[aria-labelledby]"))
        .filter(visible).flatMap(node => node.getAttribute("aria-labelledby").split(/\\s+/))
        .filter(id => !document.getElementById(id));
      const firstButton = Array.from(document.querySelectorAll("button")).find(node => visible(node) && !node.disabled);
      return {overflow, smallControls, missingLabels: names,
        buttonFont: firstButton && getComputedStyle(firstButton).fontFamily,
        ready: document.body.dataset.ready, bootError: document.body.dataset.bootError || null};
    })()`);
    if (audit.overflow || audit.smallControls.length || audit.missingLabels.length || audit.bootError || audit.ready !== "1") {
      throw new Error(name + " UI check failed: " + JSON.stringify(audit));
    }
    report.screens.push({name, ...audit});
    const shot = await cdp("Page.captureScreenshot", {format: "png", captureBeyondViewport: false});
    const file = path.join(os.tmpdir(), "aegis-polish-" + viewport.width + "x" + viewport.height + "-" + name + ".png");
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    report.screenshots.push(file);
  }

  await capture("title");
  await cdp("Input.dispatchKeyEvent", {type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9});
  await cdp("Input.dispatchKeyEvent", {type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9});
  report.keyboardFocus = await evaluate(`(() => {
    const focused = document.activeElement;
    return {visible: focused.matches(":focus-visible"), width: parseFloat(getComputedStyle(focused).outlineWidth)};
  })()`);
  if (!report.keyboardFocus.visible || report.keyboardFocus.width < 3) throw new Error("Keyboard focus is not visible");
  await cdp("Emulation.setEmulatedMedia", {features: [{name: "forced-colors", value: "active"}]});
  await sleep(100);
  await capture("title-forced-colors");
  await cdp("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: "reduce"}]});
  await sleep(100);
  report.reducedMotion = await evaluate(`Array.from(document.querySelectorAll(".aegis-shell-button")).map(node => ({
    transition: getComputedStyle(node).transitionDuration, animation: getComputedStyle(node).animationName,
    duration: getComputedStyle(node).animationDuration, media: matchMedia("(prefers-reduced-motion: reduce)").matches}))`);
  if (report.reducedMotion.some(item => !item.media || parseFloat(item.transition) > .001 ||
      (item.animation !== "none" && parseFloat(item.duration) > .001))) {
    throw new Error("Reduced Motion left menu animation enabled: " + JSON.stringify(report.reducedMotion));
  }
  await cdp("Emulation.setEmulatedMedia", {features: []});
  await sleep(100);
  await click("^Campaign$");
  await capture("campaign");
  await click("^Back$");
  await click("^Training Courtyard$");
  await capture("training");
  await click("^Back$");
  await click("^Settings$");
  await capture("settings");
  await click("^Reduced Motion: off$");
  await click("^Photosensitivity-safe mode: off$");
  report.accessSettings = await evaluate(`({reduced: document.body.dataset.reducedMotion, safe: document.body.dataset.photosensitiveSafe})`);
  if (report.accessSettings.reduced !== "true" || report.accessSettings.safe !== "true") throw new Error("Display settings did not apply");
  await click("^Reduced Motion: on$");
  await click("^Photosensitivity-safe mode: on$");
  await click("^Back$");
  await click("CONTINUE: GATE OF DAWN");
  await capture("loadout");
  await evaluate(`document.querySelector(".aegis-shell-card-grid--protocols").scrollIntoView({block: "center"})`);
  await sleep(100);
  await capture("protocols");
  report.protocolRows = await evaluate(`(() => {
    const rows = new Map();
    document.querySelectorAll(".aegis-shell-card-grid--protocols > li").forEach(node => {
      const top = Math.round(node.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) || 0) + 1);
    });
    return Array.from(rows.values());
  })()`);
  if (report.protocolRows.some(count => count !== report.protocolRows[0])) throw new Error("Uneven protocol rows");
  await click("^Story");
  await click("^Assist: off$");
  await click("READ THE BRIEFING");
  await evaluate("window.scrollTo(0, 0)");
  await capture("briefing");
  await click("^START MISSION$");
  await evaluate("window.scrollTo(0, 0)");
  await capture("battle");
  report.map = await evaluate(`(() => {
    const map = document.getElementById("previewBattlefield").getBoundingClientRect();
    const grid = document.querySelector(".preview-tactical-grid");
    return {left: map.left, right: map.right, bottom: map.bottom, height: map.height,
      gridVisible: Boolean(grid && getComputedStyle(grid).display !== "none")};
  })()`);
  if (report.map.gridVisible || report.map.left < 0 || report.map.right > viewport.width ||
      ((viewport.width >= 1024 || viewport.width > viewport.height) && report.map.bottom > viewport.height)) {
    throw new Error("Battlefield fit failed: " + JSON.stringify(report.map));
  }
  await evaluate(`document.querySelector(".preview-map-pad").dispatchEvent(new MouseEvent("click", {bubbles: true}))`);
  await sleep(150);
  await capture("store");
  report.store = await evaluate(`(() => {
    const panel = document.getElementById("previewStorePanel");
    const card = panel.querySelector(".preview-card");
    const rect = panel.getBoundingClientRect();
      const title = card && card.querySelector("h4");
      const header = panel.querySelector(".preview-store-panel-header");
      return {hidden: panel.hidden, bottom: rect.bottom, top: rect.top,
        titleVisible: Boolean(title && title.getBoundingClientRect().top >= header.getBoundingClientRect().bottom),
      descriptionSize: card && parseFloat(getComputedStyle(card.querySelector("p")).fontSize)};
  })()`);
  if (report.store.hidden || !report.store.titleVisible || report.store.top < 0 || report.store.bottom > viewport.height + 1 || report.store.descriptionSize < 13) {
    throw new Error("Tower store fit failed: " + JSON.stringify(report.store));
  }
  await click("^Close$");
  /* Render result states as explicit visual fixtures, with no simulation or
     storage mutation. Both reuse the same production result-screen builder. */
  for (const outcome of ["victory", "defeat"]) {
    await evaluate(`(() => {
      const outcome = ${JSON.stringify(outcome)};
      const view = Game.AegisShellView;
      const model = {screen: "result", mode: "campaign", outcome,
        heading: outcome === "victory" ? "Victory" : "Defeat", missionTitle: "Gate of Dawn",
        difficultyLabel: "Strategos", assist: false, score: 12500, gateHealth: outcome === "victory" ? 18 : 0,
        waves: {cleared: outcome === "victory" ? 6 : 4, total: 6},
        laurels: [{title: "Hold the Gate", statusText: outcome === "victory" ? "Laurel earned" : "Not earned", isNew: outcome === "victory"}],
        firstClearRewards: outcome === "victory" ? [{text: "New defense: Hoplite"}] : [],
        masteryChanges: [], badges: [], primaryAction: "Continue campaign",
        persistence: {durable: false, message: "Session only: export progress in Settings to keep it."}};
      document.body.dataset.screen = "result";
      document.getElementById("battleRegion").hidden = true;
      view.mount(document, document.getElementById("shellRoot"), view.buildScreenTree(model, {storageKind: "session"}), () => {});
      window.scrollTo(0, 0);
    })()`);
    await capture(outcome + "-fixture");
  }
  return report;
};
