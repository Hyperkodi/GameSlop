"use strict";

module.exports = async function (_cdp, evaluate) {
  const result = await evaluate(`(async () => {
    if (!window.Game || !Game.AegisShareCard) throw new Error("Share-card module is unavailable");
    const section = document.getElementById("previewOutcome");
    const title = document.getElementById("previewOutcomeTitle");
    const canvas = document.getElementById("previewShareCard");
    const status = document.getElementById("previewShareStatus");
    if (!section || !title || !canvas || !status) throw new Error("Result-card surface is incomplete");
    const model = Game.AegisShareCard.createModel({
      widthPx: 1200,
      heightPx: 675,
      outcome: "victory",
      missionTitle: "Piraeus Switchyard",
      score: 18450,
      waves: { cleared: 6, total: 6 },
      gateHealth: { current: 16, max: 20 }
    });
    function imageLoader(href) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load " + href));
        image.src = new URL(href, document.baseURI).href;
      });
    }
    const rendered = await Game.AegisShareCard.render(model, { canvas, imageLoader });
    section.hidden = false;
    title.textContent = "LOCAL VICTORY";
    status.textContent = rendered.summary;
    section.scrollIntoView({ block: "center" });
    return {
      width: canvas.width,
      height: canvas.height,
      role: canvas.getAttribute("role"),
      summary: canvas.getAttribute("aria-label"),
      background: Game.AegisShareCard.ASSETS.background,
      logo: Game.AegisShareCard.ASSETS.logo
    };
  })()`);
  if (result.width !== 1200 || result.height !== 675 || result.role !== "img" ||
      !/Piraeus Switchyard/.test(result.summary || "")) {
    throw new Error("Live result card did not render its exact accessible contract: " + JSON.stringify(result));
  }
  return result;
};
