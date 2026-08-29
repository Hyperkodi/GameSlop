"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

module.exports = async function (_cdp, evaluate) {
  const ready = await evaluate(`document.body.dataset.ready`);
  if (ready !== "1") throw new Error("Aegis preview is not ready");
  const missionId = await evaluate(`new URL(location.href).searchParams.get("mission")`);
  if (missionId !== "m04" && missionId !== "m05") {
    throw new Error("Act I preview driver requires ?mission=m04 or ?mission=m05");
  }
  await evaluate(`(() => {
    const mission = document.getElementById("previewMission");
    const reset = document.getElementById("previewReset");
    const missionId = new URL(location.href).searchParams.get("mission");
    if (!mission || !reset || !Array.from(mission.options).some((option) => option.value === missionId)) {
      throw new Error("Requested Act I mission is not available in the developer preview");
    }
    mission.value = missionId;
    mission.dispatchEvent(new Event("change", { bubbles: true }));
    reset.click();
    return true;
  })()`);
  await delay(250);
  const result = await evaluate(`(() => {
    const missionId = new URL(location.href).searchParams.get("mission");
    const svg = document.querySelector(".preview-battlefield-svg");
    const environment = svg && svg.querySelector(".preview-environment-plate");
    const road = svg && svg.querySelector(".preview-road-layer-act-i");
    const cores = road ? Array.from(road.querySelectorAll(".preview-road-core-act-i")) : [];
    const laneIds = Array.from(new Set(cores.map((node) => node.getAttribute("data-lane-segment-id"))));
    const expected = missionId === "m04" ? {
      environment: "art/v2/m04/environment-piraeus-switchyard-v1.webp",
      road: "art/v2/m04/road-harbor-limestone-v1.webp",
      lanes: ["lane.north.approach", "lane.shared.trunk", "lane.south.approach"],
      count: "3"
    } : {
      environment: "art/v2/m05/environment-bronze-warden-v1.webp",
      road: "art/v2/m05/road-foundry-blackstone-v1.webp",
      lanes: ["lane.spiral"],
      count: "1"
    };
    const patternImage = svg && svg.querySelector("defs pattern image");
    const result = {
      missionId,
      stateMissionId: window.__gameslop.state.missionId,
      viewBox: svg && svg.getAttribute("viewBox"),
      environment: environment && environment.getAttribute("href"),
      roadAsset: patternImage && patternImage.getAttribute("href"),
      physicalLaneCount: road && road.getAttribute("data-physical-lane-count"),
      laneIds,
      coreWidths: cores.map((node) => node.getAttribute("stroke-width")),
      shoulderWidths: road ? Array.from(road.querySelectorAll(".preview-road-shoulder-act-i")).map((node) => node.getAttribute("stroke-width")) : [],
      foundationCount: svg ? svg.querySelectorAll(".preview-map-pad-foundation").length : 0,
      padCount: svg ? svg.querySelectorAll(".preview-map-pad").length : 0,
      fallbackRoadCount: svg ? svg.querySelectorAll(".preview-road-layer-fallback").length : 0
    };
    if (result.stateMissionId !== missionId || result.viewBox !== "-18000 -12000 198400 124000" ||
        result.environment !== expected.environment || result.roadAsset !== expected.road ||
        result.physicalLaneCount !== expected.count || JSON.stringify(result.laneIds) !== JSON.stringify(expected.lanes) ||
        result.coreWidths.some((width) => width !== "8000") ||
        result.shoulderWidths.some((width) => width !== "12000") ||
        result.foundationCount !== result.padCount || result.fallbackRoadCount !== 0) {
      throw new Error("Act I art did not bind to the exact physical map contract: " + JSON.stringify(result));
    }
    document.getElementById("previewBattlefield").scrollIntoView({ block: "center" });
    return result;
  })()`);
  return result;
};
