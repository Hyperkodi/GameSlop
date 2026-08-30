"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

module.exports = async function (_cdp, evaluate) {
  const releaseId = await evaluate(`window.__gameslop && window.__gameslop.releaseId`);
  if (releaseId !== "candidate-v4" && releaseId !== "slice-dev-v1") {
    throw new Error("Chronos cadence QA requires an Aegis campaign preview");
  }

  await evaluate(`(() => {
    const click = (pattern) => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((node) => pattern.test(node.textContent.trim()) && !node.disabled);
      if (!button) throw new Error("Navigation control unavailable: " + pattern);
      button.click();
    };
    click(/CONTINUE: GATE OF DAWN/i);
    return true;
  })()`);
  await delay(250);
  await evaluate(`(() => {
    const click = (pattern) => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((node) => pattern.test(node.textContent.trim()) && !node.disabled);
      if (!button) throw new Error("Navigation control unavailable: " + pattern);
      button.click();
    };
    click(/READ THE BRIEFING/i);
    return true;
  })()`);
  await delay(200);
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((node) => /^START MISSION$/i.test(node.textContent.trim()) && !node.disabled);
    if (!button) throw new Error("Start mission control unavailable");
    button.click();
    return true;
  })()`);
  await delay(350);
  await evaluate(`(() => {
    const pad = document.querySelector('[data-pad-id="p04"]');
    if (!pad) throw new Error("Build site p04 unavailable");
    pad.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  })()`);
  await delay(180);
  await evaluate(`(() => {
    const card = Array.from(document.querySelectorAll("#previewStore .preview-build-card"))
      .find((candidate) => /Chronos/i.test((candidate.querySelector("h4") || {}).textContent || ""));
    const button = card && card.querySelector("button");
    if (!button || button.disabled) throw new Error("Chronos build is unavailable");
    button.click();
    return true;
  })()`);
  await delay(250);
  await evaluate(`document.querySelector('[data-pad-id="p04"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
  await delay(180);

  const result = await evaluate(`(() => {
    const card = document.querySelector("#previewStore .preview-card");
    const text = card ? card.textContent.replace(/\\s+/g, " ").trim() : "";
    if (!card) throw new Error("Built Chronos management card did not open");
    if (document.getElementById("previewTowers") || document.getElementById("previewBattlefieldStatus")) {
      throw new Error("Redundant battlefield inventory copy remains visible");
    }
    document.getElementById("previewStorePanel").scrollIntoView({ block: "center" });
    return { text, hasRatePerSecond: /\\d+(?:\\.\\d+)?\\/sec/.test(text) };
  })()`);
  if (!result.text.includes("Cadence every 900 ms -> every 750 ms") ||
      !result.text.includes("Deals 4 damage every 750 ms") || result.hasRatePerSecond) {
    throw new Error("Chronos cadence copy is inconsistent: " + JSON.stringify(result));
  }
  return result;
};
