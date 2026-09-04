"use strict";

const managementJourney = require("./aegis-live-tower-management.js");

module.exports = async function (cdp, evaluate, sleep) {
  await managementJourney(cdp, evaluate, sleep);
  // Spend only earned/starting currency through the real store controls.
  await evaluate(`(() => {
    document.querySelector('[data-pad-id="p04"]').dispatchEvent(new MouseEvent("click", {bubbles:true}));
    const build = document.querySelector('[data-build-defense-id="sentinel"] button');
    if (!build || build.disabled) throw new Error("Cannot build animation witness tower");
    build.click();
    return true;
  })()`);
  await sleep(150);
  await evaluate(`(() => {
    document.querySelector('[data-pad-id="p04"]').dispatchEvent(new MouseEvent("click", {bubbles:true}));
    const upgrade = [...document.querySelectorAll('#previewStore button')].find(n => /^Upgrade for/.test(n.textContent));
    if (upgrade && !upgrade.disabled) upgrade.click();
    else document.getElementById('previewStoreClose').click();
    return true;
  })()`);
  const evidence = await evaluate(`new Promise(resolve => {
    const start = performance.now();
    const frames = {}, poses = {}, hrefs = new Set();
    let hits = 0, defeats = 0, projectiles = 0, towerBlends = 0, towerEffects = 0, missing = 0;
    function sample() {
      document.querySelectorAll('.preview-map-enemy').forEach(unit => {
        const id = unit.getAttribute('data-enemy-id');
        (frames[id] ||= new Set()).add(unit.dataset.gaitFrame);
        (poses[id] ||= new Set()).add(unit.querySelector('.preview-enemy-body')?.getAttribute('transform'));
        unit.querySelectorAll('[data-asset-href]').forEach(sprite => hrefs.add(sprite.dataset.assetHref));
      });
      hits += document.querySelectorAll('.preview-enemy-hit-spark').length;
      defeats += document.querySelectorAll('.preview-enemy-defeat').length;
      projectiles += document.querySelectorAll('.preview-projectile').length;
      towerBlends += [...document.querySelectorAll('.preview-tower-sprite-blend')].filter(n => +n.getAttribute('opacity') > 0 && +n.getAttribute('opacity') < 1).length;
      towerEffects += document.querySelectorAll('.preview-tower-effect').length;
      missing += document.querySelectorAll('[data-asset-state="error"]').length;
      if (performance.now() - start < 10500) requestAnimationFrame(sample);
      else resolve({ frames: Object.fromEntries(Object.entries(frames).map(([k,v]) => [k,[...v]])),
        poseCounts: Object.fromEntries(Object.entries(poses).map(([k,v]) => [k,v.size])),
        hrefs: [...hrefs], hits, defeats, projectiles, towerBlends, towerEffects, missing,
        tick: window.__gameslop.state.tick, fatal: window.__gameslop.fatalError || null });
    }
    sample();
  })`);
  if (evidence.missing || evidence.fatal) throw new Error("Broken animation assets: " + JSON.stringify(evidence));
  if (!Object.values(evidence.frames).some(frames => frames.length === 8)) throw new Error("Eight-pose run not observed: " + JSON.stringify(evidence));
  if (!evidence.hrefs.some(href => /run-v2/.test(href))) throw new Error("New movement sheets not rendered");
  if (!evidence.hits || !evidence.defeats) throw new Error("Combat reactions not observed: " + JSON.stringify(evidence));
  if (!evidence.towerBlends || !evidence.towerEffects || !evidence.projectiles) throw new Error("Tower firing effects not observed");
  await evaluate(`(() => {
    document.body.dataset.reducedMotion = "true";
    const start = document.getElementById('previewStartWave');
    if (start && !start.disabled) start.click();
    return true;
  })()`);
  await sleep(700);
  const quiet = await evaluate(`(() => ({
    enemies: document.querySelectorAll('.preview-map-enemy').length,
    animated: [...document.querySelectorAll('.preview-map-enemy')].some(n => n.dataset.gaitFrame !== "0"),
    effects: document.querySelectorAll('.preview-enemy-hit-spark, .preview-enemy-footfall, .preview-enemy-defeat').length
  }))()`);
  if (!quiet.enemies || quiet.animated || quiet.effects) throw new Error("Reduced motion was ignored: " + JSON.stringify(quiet));
  await evaluate(`(() => { document.body.dataset.reducedMotion = "false"; return true; })()`);
  const raiders = await evaluate(`new Promise(resolve => {
    const start = performance.now(), frames = new Set();
    let missing = 0;
    function sample() {
      document.querySelectorAll('[data-asset-href$="raider-run-v2.webp"]').forEach(n => {
        frames.add(n.dataset.frame);
        if (n.dataset.assetState === "error") missing++;
      });
      if (frames.size < 8 && performance.now() - start < 6500) requestAnimationFrame(sample);
      else resolve({ frames: [...frames], missing });
    }
    sample();
  })`);
  if (raiders.frames.length !== 8 || raiders.missing) throw new Error("Raider movement failed: " + JSON.stringify(raiders));
  return { evidence, quiet, raiders };
};
