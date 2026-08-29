"use strict";

module.exports = async function (_cdp, evaluate) {
  return evaluate(`(() => {
    const url = new URL(location.href);
    const background = url.searchParams.get("background");
    if (!background) throw new Error("Missing background query parameter");
    const svg = document.documentElement;
    svg.style.backgroundImage = "url(" + JSON.stringify(background) + ")";
    svg.style.backgroundPosition = "center";
    svg.style.backgroundRepeat = "no-repeat";
    svg.style.backgroundSize = "100% 100%";
    const directRects = Array.from(svg.children).filter((node) =>
      node.localName === "rect" && node.parentNode === svg
    );
    directRects.slice(0, 2).forEach((node) => node.remove());
    const quiet = svg.querySelector("#quiet-corridors");
    const pads = svg.querySelector("#pad-clear-zones");
    const anchors = svg.querySelector("#anchors");
    if (quiet) quiet.style.opacity = "0.58";
    if (pads) pads.style.opacity = "0.52";
    if (anchors) anchors.style.opacity = "0.82";
    return {
      background,
      lanes: quiet ? quiet.children.length : 0,
      pads: pads ? pads.querySelectorAll("circle").length : 0,
    };
  })()`);
};
