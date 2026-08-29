"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

module.exports = async function (_cdp, evaluate) {
  const ready = await evaluate(`document.body.dataset.ready`);
  if (ready !== "1") throw new Error("Aegis preview is not ready");
  await evaluate(`(() => {
    const pad = document.querySelector('[data-pad-id="p04"]') || document.querySelector(".preview-map-pad");
    if (!pad) throw new Error("No M01 build site is available");
    pad.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  })()`);
  await delay(180);
  const result = await evaluate(`(() => {
    document.getElementById("previewBattlefield").scrollIntoView({ block: "start" });
    window.scrollBy(0, -72);
    const cards = Array.from(document.querySelectorAll("#previewStore .preview-card"));
    const buildLabels = cards.map((card) => {
      const button = card.querySelector("button");
      return button && button.textContent.trim();
    });
    return {
      storeOpen: window.__gameslop.storeOpen,
      paused: window.__gameslop.paused,
      phase: window.__gameslop.state.management.phase,
      aether: document.getElementById("previewAether").textContent.trim(),
      cardCount: cards.length,
      buildLabels,
      cardsHaveRoles: cards.every((card) => /Role:/.test(card.textContent)),
      cardsHaveStats: cards.every((card) => /Damage/.test(card.textContent) && /Range/.test(card.textContent)),
      cardsHaveWeaknesses: cards.every((card) => /Weakness:/.test(card.textContent))
    };
  })()`);
  if (!result.storeOpen || (result.phase === "wave" && !result.paused) || result.cardCount < 3 ||
      !result.cardsHaveRoles || !result.cardsHaveStats || !result.cardsHaveWeaknesses ||
      result.buildLabels.some((label) => !/Build · \d+ Aether/.test(label || ""))) {
    throw new Error("Tower store did not expose paused, priced, readable tower choices: " + JSON.stringify(result));
  }
  return result;
};
