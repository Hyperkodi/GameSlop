"use strict";

module.exports = async function (_cdp, evaluate, sleep) {
  await evaluate(`(() => {
    const continueButton = Array.from(document.querySelectorAll("button"))
      .find((button) => /CONTINUE: GATE OF DAWN/i.test(button.textContent) && !button.disabled);
    if (!continueButton) throw new Error("Continue to Gate of Dawn is unavailable");
    continueButton.click();
    return true;
  })()`);
  await sleep(400);

  const geometry = await evaluate(`(() => {
    const grids = Array.from(document.querySelectorAll(".aegis-shell-balanced-grid"));
    const describe = (grid) => {
      const children = Array.from(grid.children);
      const rows = new Map();
      children.forEach((child) => {
        const rect = child.getBoundingClientRect();
        const key = Math.round(rect.top);
        rows.set(key, (rows.get(key) || 0) + 1);
      });
      return {
        className: grid.className,
        count: children.length,
        rowCounts: Array.from(rows.values()),
      };
    };
    const described = grids.map(describe);
    const protocols = described.find((grid) => /--protocols/.test(grid.className));
    if (!protocols || protocols.count !== 10 ||
        protocols.rowCounts.length !== 2 || protocols.rowCounts.some((count) => count !== 5)) {
      throw new Error("Divine Protocols must render as two ordered rows of five: "
        + JSON.stringify(protocols));
    }
    const uneven = described.filter((grid) => grid.rowCounts.length > 1 &&
      grid.rowCounts.some((count) => count !== grid.rowCounts[0]));
    if (uneven.length) {
      throw new Error("Player-facing grids contain uneven rows: " + JSON.stringify(uneven));
    }
    document.querySelector(".aegis-shell-card-grid--protocols")
      .scrollIntoView({ block: "center" });
    return { protocols, grids: described };
  })()`);

  return geometry;
};
