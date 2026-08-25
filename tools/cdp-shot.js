#!/usr/bin/env node
// cdp-shot.js — headless-Chrome screenshot + scripted-input driver over the DevTools Protocol.
//
// Usage:
//   node tools/cdp-shot.js <url> <width> <height> <out.png> [--script driver.js] [--wait ms]
//
// The driver script (--script), when given, is a CommonJS module exporting
//   module.exports = async function (cdp, evaluate, sleep) { ... }
// where:
//   cdp(method, params)  sends a DevTools command on the page session and
//                        resolves with its result object (rejects on a CDP error).
//   evaluate(expr)       runs Runtime.evaluate({expression: expr, returnByValue: true,
//                        awaitPromise: true}) in the page and resolves with the JSON value
//                        (rejects if the expression throws).
//   sleep(ms)            resolves after ms milliseconds.
//
// Flow: launch headless Chrome -> open a new target at <url> -> override the viewport ->
// wait for the page to finish loading -> wait for document.body.dataset.ready === "1"
// (best-effort, up to 10s) -> run the driver, if any -> wait --wait ms (default 1500) ->
// capture a PNG screenshot -> write it to <out.png> -> kill Chrome.
//
// Exits 0 only when the PNG was written (and prints its path). Exits non-zero with a
// clear message on any failure.

"use strict";

const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const LOAD_TIMEOUT_MS = 20000;
const READY_TIMEOUT_MS = 10000;
const READY_POLL_MS = 150;

function fail(message) {
  console.error("cdp-shot: " + message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  let scriptPath = null;
  let waitMs = 1500;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--script") {
      scriptPath = argv[++i];
      if (!scriptPath) fail("--script requires a path argument");
    } else if (a === "--wait") {
      const v = argv[++i];
      if (v === undefined || Number.isNaN(Number(v))) fail("--wait requires a numeric ms argument");
      waitMs = Number(v);
    } else {
      positional.push(a);
    }
  }
  const [url, widthS, heightS, outPath] = positional;
  if (!url || !widthS || !heightS || !outPath) {
    fail(
      "usage: node tools/cdp-shot.js <url> <width> <height> <out.png> [--script driver.js] [--wait ms]"
    );
  }
  const width = parseInt(widthS, 10);
  const height = parseInt(heightS, 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    fail("width and height must be positive integers");
  }
  return { url, width, height, outPath, scriptPath, waitMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function httpJson(port, reqPath, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: reqPath, method: method || "GET" },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("bad JSON from " + reqPath + ": " + data));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function waitForDebugPort(port, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      await httpJson(port, "/json/version");
      return;
    } catch (e) {
      await sleep(300);
    }
  }
  throw new Error("Chrome remote-debugging port never came up on " + port);
}

async function main() {
  const { url, width, height, outPath, scriptPath, waitMs } = parseArgs(process.argv.slice(2));

  const port = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdpshot-"));

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=" + port,
      "--user-data-dir=" + userDataDir,
      "--allow-file-access-from-files",
      "--autoplay-policy=no-user-gesture-required",
    ],
    { stdio: "ignore" }
  );

  let chromeExited = false;
  chrome.on("exit", () => {
    chromeExited = true;
  });

  let ws = null;

  try {
    await waitForDebugPort(port, 60);
    if (chromeExited) throw new Error("Chrome exited before the debug port was usable");

    // The "/json/new" quirk: current Chrome requires PUT (GET is rejected), and the
    // target URL is passed as the raw query suffix (not standard key=value encoding).
    const target = await httpJson(port, "/json/new?" + url, "PUT");
    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error("PUT /json/new did not return a webSocketDebuggerUrl: " + JSON.stringify(target));
    }

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (ev) => reject(new Error("WebSocket connect failed: " + (ev.message || ev))));
    });

    let msgId = 1;
    const pending = new Map();
    const eventListeners = new Map(); // method -> Set<fn>

    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data.toString());
      } catch (e) {
        return;
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error("CDP error on " + msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        const listeners = eventListeners.get(msg.method);
        if (listeners) for (const fn of listeners) fn(msg.params || {});
      }
    });

    function cdp(method, params) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }

    function onEvent(method, fn) {
      if (!eventListeners.has(method)) eventListeners.set(method, new Set());
      eventListeners.get(method).add(fn);
    }

    async function evaluate(expression) {
      const result = await cdp("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        const desc =
          (result.exceptionDetails.exception && result.exceptionDetails.exception.description) ||
          JSON.stringify(result.exceptionDetails);
        throw new Error("evaluate() threw: " + desc);
      }
      return result.result ? result.result.value : undefined;
    }

    let loadFired = false;
    onEvent("Page.loadEventFired", () => {
      loadFired = true;
    });

    await cdp("Runtime.enable");
    await cdp("Page.enable");
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 760,
    });

    // The target already started navigating to <url> the moment it was created (before we
    // connected), so Page.loadEventFired may fire before our listener is attached. Guard
    // against that race by also polling document.readyState.
    const loadDeadline = Date.now() + LOAD_TIMEOUT_MS;
    while (!loadFired) {
      const readyState = await evaluate("document.readyState").catch(() => null);
      if (readyState === "complete") {
        loadFired = true;
        break;
      }
      if (Date.now() > loadDeadline) {
        throw new Error(
          "Timed out after " + LOAD_TIMEOUT_MS + "ms waiting for the page to finish loading: " + url
        );
      }
      await sleep(150);
    }

    // Best-effort: wait for the game's ready signal, but don't hard-fail if a page never
    // sets it — proceed and let the screenshot itself show whatever state it's in.
    const readyDeadline = Date.now() + READY_TIMEOUT_MS;
    let ready = false;
    while (Date.now() < readyDeadline) {
      const val = await evaluate(
        "document.body && document.body.dataset && document.body.dataset.ready"
      ).catch(() => null);
      if (val === "1") {
        ready = true;
        break;
      }
      await sleep(READY_POLL_MS);
    }
    if (!ready) {
      console.error(
        'cdp-shot: warning: document.body.dataset.ready never became "1" within ' +
          READY_TIMEOUT_MS +
          "ms; continuing anyway."
      );
    }

    if (scriptPath) {
      const driver = require(path.resolve(scriptPath));
      if (typeof driver !== "function") {
        throw new Error("--script " + scriptPath + " must export a function (module.exports = async function (cdp, evaluate, sleep) {...})");
      }
      const driverResult = await driver(cdp, evaluate, sleep);
      if (driverResult !== undefined) {
        console.error("cdp-shot: driver returned: " + JSON.stringify(driverResult));
      }
    }

    await sleep(waitMs);

    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    if (!shot || !shot.data) throw new Error("Page.captureScreenshot returned no data");

    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  } finally {
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        /* ignore */
      }
    }
    if (!chromeExited) chrome.kill();
  }

  console.log(path.resolve(outPath));
  process.exit(0);
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
