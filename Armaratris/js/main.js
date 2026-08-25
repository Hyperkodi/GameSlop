(function (global) {
  "use strict";
  window.addEventListener("DOMContentLoaded", async function () {
    const params = new URLSearchParams(location.search);
    const skin = await global.Armaratris.loadSkin(params.get("skin"));
    document.getElementById("overlayTitle").textContent = skin.title;
    document.getElementById("overlayBody").textContent = skin.strings.start;
    document.getElementById("overlayBtn").textContent = skin.strings.restart;
    const well = document.getElementById("well");
    well.width = 300; well.height = 600; well.style.width = "300px"; well.style.height = "600px";
    document.body.dataset.skin = skin.name; // marker for the screenshot step
  });
})(window);
