"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

module.exports = async function (_cdp, evaluate) {
  await evaluate(`(() => {
    const click = (pattern) => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((node) => pattern.test(node.textContent.trim()) && !node.disabled);
      if (!button) throw new Error("Briefing navigation control unavailable: " + pattern);
      button.click();
    };
    click(/CONTINUE: GATE OF DAWN/i);
    return true;
  })()`);
  await delay(300);
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((node) => /READ THE BRIEFING/i.test(node.textContent) && !node.disabled);
    if (!button) throw new Error("Read briefing control unavailable");
    button.click();
    return true;
  })()`);
  await delay(300);

  const result = await evaluate(`(() => {
    const screen = document.querySelector(".aegis-shell-screen--briefing");
    const synopsis = document.querySelector(".aegis-shell-briefing-synopsis");
    if (!screen || !synopsis) throw new Error("Lore briefing did not render");
    const text = screen.textContent;
    const removed = ["What is new here", "The situation", "The road", "Your task"]
      .filter((label) => text.includes(label));
    if (removed.length) throw new Error("Removed briefing copy remains: " + removed.join(", "));
    screen.scrollIntoView({ block: "start" });
    return {
      synopsis: synopsis.textContent.trim(),
      synopsisCount: document.querySelectorAll(".aegis-shell-briefing-synopsis").length,
      kicker: document.querySelector(".aegis-shell-briefing-act").textContent.trim(),
      removed,
    };
  })()`);
  if (result.synopsisCount !== 1 || !result.synopsis.includes("Miltiades")) {
    throw new Error("The canonical Gate of Dawn synopsis is not the sole story: " + JSON.stringify(result));
  }
  return result;
};
