(function (global) {
  "use strict";
  window.addEventListener("DOMContentLoaded", async function () {
    const params = new URLSearchParams(location.search);
    const skin = await global.Armaratris.loadSkin(params.get("skin"));
    document.getElementById("overlayTitle").textContent = skin.title;
    document.getElementById("overlayBody").textContent = skin.strings.start;
    document.getElementById("overlayBtn").textContent = skin.strings.restart;
    const well = document.getElementById("well");
    const narrow = window.innerWidth < 760;
    const cell = Math.max(12, Math.floor(Math.min((window.innerHeight - (narrow ? 270 : 140)) / 20, (window.innerWidth - (narrow ? 60 : 460)) / 10)));
    well.width = cell * 10; well.height = cell * 20;
    well.style.width = well.width + "px"; well.style.height = well.height + "px";
    const next = document.getElementById("next");
    if (narrow) { next.style.width = "36px"; next.style.height = "96px"; }
    document.body.dataset.skin = skin.name; // marker for the screenshot step
  });
})(window);
