"use strict";

function delay(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

async function waitFor(evaluate, label, expression, timeoutMilliseconds) {
  const deadline = Date.now() + (timeoutMilliseconds || 8000);
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(expression);
    if (last && last.ok) return last;
    await delay(40);
  }
  throw new Error(label + " timed out: " + JSON.stringify(last));
}

async function openMissionOne(evaluate) {
  const ready = await waitFor(evaluate, "Aegis boot", `(() => ({
    ok: document.body.dataset.ready === "1" && Boolean(window.__gameslop),
    ready: document.body.dataset.ready,
    releaseId: window.__gameslop && window.__gameslop.releaseId
  }))()`, 12000);
  if (ready.releaseId !== "candidate-v4") {
    throw new Error("Live tower management QA requires candidate-v4, received " + ready.releaseId);
  }

  if (await evaluate(`Boolean(document.querySelector(".preview-map-pad"))`)) return ready;

  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((node) => /CONTINUE: GATE OF DAWN/i.test(node.textContent) && !node.disabled);
    if (!button) throw new Error("Continue to Gate of Dawn is unavailable");
    button.click();
    return true;
  })()`);
  await waitFor(evaluate, "Mission 1 loadout", `(() => ({
    ok: Array.from(document.querySelectorAll("button"))
      .some((node) => /READ THE BRIEFING/i.test(node.textContent) && !node.disabled),
    screen: window.__gameslop && window.__gameslop.screen
  }))()`);
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const story = buttons.find((node) => /^Story/i.test(node.textContent.trim()) && !node.disabled);
    if (!story) throw new Error("Story difficulty is unavailable for management QA");
    story.click();
    const assist = Array.from(document.querySelectorAll("button"))
      .find((node) => /^Assist: off$/i.test(node.textContent.trim()) && !node.disabled);
    if (assist) assist.click();
    return true;
  })()`);
  await waitFor(evaluate, "Story Assist loadout", `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return {
      ok: buttons.some((node) => /^Assist: on$/i.test(node.textContent.trim())) &&
        buttons.some((node) => /^Story/i.test(node.textContent.trim()) && node.getAttribute("aria-pressed") === "true"),
      screen: window.__gameslop && window.__gameslop.screen
    };
  })()`);
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((node) => /READ THE BRIEFING/i.test(node.textContent) && !node.disabled);
    button.click();
    return true;
  })()`);
  await waitFor(evaluate, "Mission 1 briefing", `(() => ({
    ok: Array.from(document.querySelectorAll("button"))
      .some((node) => /^START MISSION$/i.test(node.textContent.trim()) && !node.disabled),
    screen: window.__gameslop && window.__gameslop.screen
  }))()`);
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((node) => /^START MISSION$/i.test(node.textContent.trim()) && !node.disabled);
    button.click();
    return true;
  })()`);
  await waitFor(evaluate, "Mission 1 battlefield", `(() => ({
    ok: Boolean(document.querySelector(".preview-map-pad")) &&
      window.__gameslop && window.__gameslop.state &&
      window.__gameslop.state.missionId === "m01",
    screen: window.__gameslop && window.__gameslop.screen,
    missionId: window.__gameslop && window.__gameslop.state && window.__gameslop.state.missionId
  }))()`, 12000);
  return ready;
}

async function selectPad(evaluate, padId) {
  await evaluate(`(() => {
    const pad = document.querySelector('[data-pad-id="${padId}"]');
    if (!pad) throw new Error("Build site ${padId} is unavailable");
    pad.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  })()`);
  return waitFor(evaluate, "Tower menu for " + padId, `(() => ({
    ok: Boolean(window.__gameslop.storeOpen) &&
      Boolean(document.querySelector('[data-pad-id="${padId}"].is-selected')),
    storeOpen: window.__gameslop.storeOpen,
    paused: window.__gameslop.paused,
    tick: window.__gameslop.state.tick
  }))()`);
}

async function buildCheapest(evaluate) {
  return evaluate(`(() => {
    const choices = Array.from(document.querySelectorAll("#previewStore .preview-build-card"))
      .map((card) => ({
        card,
        button: card.querySelector("button"),
        cost: Number(((card.querySelector("button") || {}).textContent || "").match(/\\d+/)?.[0])
      }))
      .filter((choice) => choice.button && !choice.button.disabled && Number.isSafeInteger(choice.cost))
      .sort((left, right) => left.cost - right.cost);
    if (!choices.length) throw new Error("No affordable tower is available in the open menu");
    const choice = choices[0];
    const heading = choice.card.querySelector("h4");
    const defenseId = choice.card.getAttribute("data-build-defense-id");
    choice.button.click();
    return { name: heading && heading.textContent.trim(), defenseId, cost: choice.cost };
  })()`);
}

module.exports = async function (_cdp, evaluate) {
  const boot = await openMissionOne(evaluate);

  const planningBefore = await evaluate(`(() => ({
    tick: window.__gameslop.state.tick,
    aether: window.__gameslop.state.management.aether,
    towers: window.__gameslop.state.management.towers.length,
    phase: window.__gameslop.state.management.phase
  }))()`);
  if (planningBefore.phase !== "planning") throw new Error("Mission 1 did not begin in planning");

  await selectPad(evaluate, "p09");
  const initialChoice = await buildCheapest(evaluate);
  if (await evaluate(`Boolean(window.__gameslop.storeOpen)`)) {
    await evaluate(`document.getElementById("previewStoreClose").click()`);
  }
  const planningBuild = await waitFor(evaluate, "Planning tower build", `(() => {
    const state = window.__gameslop.state;
    const tower = state.management.towers.find((candidate) => candidate.padId === "p09");
    return {
      ok: Boolean(tower) && state.management.aether < ${planningBefore.aether},
      tick: state.tick,
      aether: state.management.aether,
      tower: tower || null,
      storeOpen: window.__gameslop.storeOpen
    };
  })()`);
  if (planningBuild.tick !== planningBefore.tick || planningBuild.storeOpen) {
    throw new Error("Planning build advanced time or left the menu open: " + JSON.stringify(planningBuild));
  }

  await evaluate(`(() => {
    const button = document.getElementById("previewStartWave");
    if (!button || button.disabled) throw new Error("Wave 1 cannot start");
    button.click();
    return true;
  })()`);
  const firstEnemy = await waitFor(evaluate, "Wave movement start", `(() => {
    const state = window.__gameslop.state;
    const enemy = state.enemies[0];
    return {
      ok: state.management.phase === "wave" && state.tick > 0 && Boolean(enemy),
      tick: state.tick,
      enemyId: enemy && enemy.id,
      distance: enemy && enemy.distance
    };
  })()`, 12000);
  const movedEnemy = await waitFor(evaluate, "Enemy movement", `(() => {
    const state = window.__gameslop.state;
    const enemy = state.enemies.find((candidate) => candidate.id === ${firstEnemy.enemyId});
    return {
      ok: state.tick > ${firstEnemy.tick} && Boolean(enemy) && enemy.distance > ${firstEnemy.distance},
      tick: state.tick,
      enemyId: enemy && enemy.id,
      distance: enemy && enemy.distance
    };
  })()`, 5000);

  const selected = await selectPad(evaluate, "p04");
  if (!selected.paused) throw new Error("Opening a site during Wave 1 did not contextually pause");
  await delay(180);
  const pauseProof = await evaluate(`(() => ({
    tick: window.__gameslop.state.tick,
    paused: window.__gameslop.paused,
    storeOpen: window.__gameslop.storeOpen
  }))()`);
  if (!pauseProof.paused || !pauseProof.storeOpen || pauseProof.tick !== selected.tick) {
    throw new Error("Contextual pause was not stable: " + JSON.stringify({ selected, pauseProof }));
  }

  const beforeLiveBuild = await evaluate(`(() => ({
    count: window.__gameslop.state.management.towers.length,
    aether: window.__gameslop.state.management.aether,
    tick: window.__gameslop.state.tick
  }))()`);
  const liveChoice = await buildCheapest(evaluate);
  const liveBuild = await waitFor(evaluate, "Live tower build", `(() => {
    const state = window.__gameslop.state;
    const tower = state.management.towers.find((candidate) => candidate.padId === "p04");
    return {
      ok: !window.__gameslop.storeOpen && !window.__gameslop.paused &&
        Boolean(tower) && state.management.towers.length === ${beforeLiveBuild.count + 1} &&
        state.management.aether < ${beforeLiveBuild.aether} && state.tick > ${beforeLiveBuild.tick},
      storeOpen: window.__gameslop.storeOpen,
      paused: window.__gameslop.paused,
      tick: state.tick,
      aether: state.management.aether,
      tower: tower || null
    };
  })()`, 5000);

  const accessibility = await evaluate(`(() => {
    const pad = document.querySelector('[data-pad-id="p04"]');
    return {
      visibleLevelCount: document.querySelectorAll(".preview-map-level").length,
      ariaLabel: pad && pad.getAttribute("aria-label")
    };
  })()`);
  if (accessibility.visibleLevelCount !== 0 || !/level 1/i.test(accessibility.ariaLabel || "")) {
    throw new Error("Tower level badge or accessible label is wrong: " + JSON.stringify(accessibility));
  }

  if (!await evaluate(`window.__gameslop.state.management.tutorialUpgradeGateOpen`)) {
    await evaluate(`(() => {
      const button = document.getElementById("previewSkipTutorial");
      if (!button || button.disabled) throw new Error("Tutorial gate cannot be skipped");
      button.click();
      return true;
    })()`);
    await waitFor(evaluate, "Tutorial upgrade gate", `(() => ({
      ok: window.__gameslop.state.management.tutorialUpgradeGateOpen === true,
      tick: window.__gameslop.state.tick
    }))()`);
  }

  const upgradeSelection = await selectPad(evaluate, "p04");
  if (!upgradeSelection.paused) throw new Error("Selecting a tower during Wave 1 did not pause");
  const beforeUpgrade = await evaluate(`(() => {
    const tower = window.__gameslop.state.management.towers.find((candidate) => candidate.padId === "p04");
    const button = Array.from(document.querySelectorAll("#previewStore button"))
      .find((candidate) => /^Upgrade for /i.test(candidate.textContent.trim()));
    if (!tower || !button || button.disabled) {
      throw new Error("Live upgrade control is unavailable");
    }
    return { towerId: tower.id, level: tower.level, aether: window.__gameslop.state.management.aether,
      tick: window.__gameslop.state.tick };
  })()`);
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("#previewStore button"))
      .find((candidate) => /^Upgrade for /i.test(candidate.textContent.trim()));
    button.click();
    return true;
  })()`);
  const liveUpgrade = await waitFor(evaluate, "Live tower upgrade", `(() => {
    const state = window.__gameslop.state;
    const tower = state.management.towers.find((candidate) => candidate.id === ${beforeUpgrade.towerId});
    return {
      ok: !window.__gameslop.storeOpen && !window.__gameslop.paused && Boolean(tower) &&
        tower.level === ${beforeUpgrade.level + 1} && state.management.aether < ${beforeUpgrade.aether} &&
        state.tick > ${beforeUpgrade.tick},
      storeOpen: window.__gameslop.storeOpen,
      paused: window.__gameslop.paused,
      tick: state.tick,
      aether: state.management.aether,
      tower: tower || null
    };
  })()`, 5000);

  const frameSamples = [];
  const frameDeadline = Date.now() + 12000;
  while (Date.now() < frameDeadline) {
    const sample = await evaluate(`(() => ({
      phase: window.__gameslop.state.management.phase,
      frames: Array.from(document.querySelectorAll(".preview-tower-sprite"), (node) => ({
        frame: node.getAttribute("data-frame"),
        action: node.getAttribute("data-action"),
        transform: node.getAttribute("transform")
      }))
    }))()`);
    frameSamples.push(sample);
    if (sample.frames.some((frame) => frame.transform !== null)) {
      throw new Error("A firing tower sprite still uses transform-based shaking: " + JSON.stringify(sample));
    }
    const seen = new Set(frameSamples.flatMap((entry) => entry.frames.map((frame) => frame.frame)));
    if (seen.has("active") && seen.has("recover")) break;
    if (sample.phase !== "wave") throw new Error("Wave ended before active and recover frames were observed");
    await delay(35);
  }
  const observedFrames = Array.from(new Set(
    frameSamples.flatMap((sample) => sample.frames.map((frame) => frame.frame))
  ));
  if (!observedFrames.includes("active") || !observedFrames.includes("recover")) {
    throw new Error("Tower atlases did not expose active and recover frames: " + JSON.stringify(observedFrames));
  }

  const sellSelection = await selectPad(evaluate, "p04");
  const beforeSell = await evaluate(`(() => {
    const state = window.__gameslop.state;
    const tower = state.management.towers.find((candidate) => candidate.padId === "p04");
    const button = Array.from(document.querySelectorAll("#previewStore button"))
      .find((candidate) => /^Sell for /i.test(candidate.textContent.trim()));
    if (!tower || !button || button.disabled) throw new Error("Sell control is unavailable");
    window.__aegisQaOriginalConfirm = window.confirm;
    window.__aegisQaConfirmCalls = 0;
    window.confirm = function () { window.__aegisQaConfirmCalls += 1; return false; };
    return {
      towerId: tower.id,
      count: state.management.towers.length,
      aether: state.management.aether,
      tick: state.tick,
      refundLabel: button.textContent.trim()
    };
  })()`);
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("#previewStore button"))
      .find((candidate) => /^Sell for /i.test(candidate.textContent.trim()));
    button.click();
    return true;
  })()`);
  await delay(180);
  const cancelledSell = await evaluate(`(() => {
    const state = window.__gameslop.state;
    return {
      confirmCalls: window.__aegisQaConfirmCalls,
      towerPresent: state.management.towers.some((tower) => tower.id === ${beforeSell.towerId}),
      count: state.management.towers.length,
      aether: state.management.aether,
      tick: state.tick,
      paused: window.__gameslop.paused,
      storeOpen: window.__gameslop.storeOpen
    };
  })()`);
  if (cancelledSell.confirmCalls !== 1 || !cancelledSell.towerPresent ||
      cancelledSell.count !== beforeSell.count || cancelledSell.aether !== beforeSell.aether ||
      cancelledSell.tick !== beforeSell.tick || !cancelledSell.paused || !cancelledSell.storeOpen) {
    throw new Error("Cancelled sell changed the run or closed the menu: " + JSON.stringify(cancelledSell));
  }

  await evaluate(`(() => {
    window.confirm = function () { window.__aegisQaConfirmCalls += 1; return true; };
    const button = Array.from(document.querySelectorAll("#previewStore button"))
      .find((candidate) => /^Sell for /i.test(candidate.textContent.trim()));
    button.click();
    return true;
  })()`);
  const confirmedSell = await waitFor(evaluate, "Confirmed live sell", `(() => {
    const state = window.__gameslop.state;
    return {
      ok: !window.__gameslop.storeOpen && !window.__gameslop.paused &&
        !state.management.towers.some((tower) => tower.id === ${beforeSell.towerId}) &&
        state.management.towers.length === ${beforeSell.count - 1} &&
        state.management.aether > ${beforeSell.aether} && state.tick > ${beforeSell.tick},
      confirmCalls: window.__aegisQaConfirmCalls,
      towerPresent: state.management.towers.some((tower) => tower.id === ${beforeSell.towerId}),
      count: state.management.towers.length,
      aether: state.management.aether,
      tick: state.tick,
      paused: window.__gameslop.paused,
      storeOpen: window.__gameslop.storeOpen
    };
  })()`, 5000);
  await evaluate(`(() => {
    if (window.__aegisQaOriginalConfirm) window.confirm = window.__aegisQaOriginalConfirm;
    delete window.__aegisQaOriginalConfirm;
    return true;
  })()`);
  if (confirmedSell.confirmCalls !== 2) {
    throw new Error("Sell confirmation was not exercised exactly twice: " + JSON.stringify(confirmedSell));
  }
  const expectedRefund = Number(beforeSell.refundLabel.match(/\d+/)[0]);
  if (confirmedSell.aether - beforeSell.aether !== expectedRefund) {
    throw new Error("Confirmed sell did not grant its exact displayed refund: " +
      JSON.stringify({ beforeSell, confirmedSell, expectedRefund }));
  }

  return {
    boot,
    planning: { before: planningBefore, choice: initialChoice, after: planningBuild },
    movement: { first: firstEnemy, moved: movedEnemy },
    contextualPause: { selected, proof: pauseProof },
    liveBuild: { choice: liveChoice, result: liveBuild },
    accessibility,
    liveUpgrade,
    animation: { sampleCount: frameSamples.length, observedFrames },
    sell: { selection: sellSelection, before: beforeSell, cancelled: cancelledSell, confirmed: confirmedSell }
  };
};
