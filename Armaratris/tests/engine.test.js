const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

test("mulberry32 is deterministic per seed", () => {
  const a = E.mulberry32(123), b = E.mulberry32(123), c = E.mulberry32(124);
  const va = [a(), a(), a(), a(), a()], vb = [b(), b(), b(), b(), b()], vc = [c(), c(), c(), c(), c()];
  assert.deepEqual(va, vb);
  assert.notDeepEqual(va, vc);
  for (const v of va) assert.ok(v >= 0 && v < 1);
});

test("7-bag: first 14 draws contain each type exactly twice", () => {
  const seq = E.sequence(7, 14);
  for (const t of E.TYPES) assert.equal(seq.filter((x) => x === t).length, 2, t);
});

test("sequence is stable for a seed and differs across seeds", () => {
  assert.deepEqual(E.sequence(42, 50), E.sequence(42, 50));
  assert.notDeepEqual(E.sequence(42, 50), E.sequence(43, 50));
});

test("new engine is ready with active + 3 queued from the seed sequence", () => {
  const e = E.createEngine({ seed: 42 });
  assert.equal(e.state.status, "ready");
  assert.equal(e.state.seed, 42);
  const seq = E.sequence(42, 4);
  assert.equal(e.state.active.type, seq[0]);
  assert.deepEqual(e.state.queue, seq.slice(1));
  assert.deepEqual(e.state.active, { type: seq[0], rot: 0, x: 3, y: 0 });
  assert.equal(e.state.board.length, E.ROWS);
  assert.equal(e.state.board[0].length, E.COLS);
});

test("start moves status to playing and actions are logged with the tick index", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  assert.equal(e.state.status, "playing");
  e.dispatch("left");
  assert.deepEqual(e.state.inputLog, [[0, "start"], [0, "left"]]);
});

test("movement is ignored unless playing", () => {
  const e = E.createEngine({ seed: 1 });
  e.setActive({ type: "O", rot: 0, x: 3, y: 5 });
  assert.deepEqual(e.dispatch("left"), []);
  assert.equal(e.state.active.x, 3);
});

test("left/right move one column and are blocked by walls", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "O", rot: 0, x: 1, y: 5 }); // O occupies cols x+1, x+2 → cols 2,3
  assert.deepEqual(e.dispatch("left"), [{ type: "move" }]); // cols 1,2
  assert.equal(e.state.active.x, 0);
  assert.deepEqual(e.dispatch("left"), [{ type: "move" }]); // cols 0,1 — still inside
  assert.equal(e.state.active.x, -1);
  assert.deepEqual(e.dispatch("left"), []); // x=-2 would use col -1 → blocked
  assert.equal(e.state.active.x, -1);
  e.setActive({ type: "O", rot: 0, x: 7, y: 5 }); // cols 8,9
  assert.deepEqual(e.dispatch("right"), []);
  assert.equal(e.state.active.x, 7);
});

test("movement is blocked by the stack", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  const rows = new Array(E.ROWS).fill("..........");
  rows[5] = "...X......"; // col 3, row 5
  e.setBoard(rows);
  e.setActive({ type: "O", rot: 0, x: 3, y: 4 }); // cols 4,5 rows 4,5
  assert.deepEqual(e.dispatch("left"), []); // would put col 3 row 5 into X
  assert.equal(e.state.active.x, 3);
});

test("SRS: T in state R against the left wall kicks right when rotating CW", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 1, x: -1, y: 5 }); // R state cells: (1,0)(1,1)(2,1)(1,2) → cols 0,0,1,0
  assert.deepEqual(e.dispatch("rotateCW"), [{ type: "rotate" }]);
  assert.equal(e.state.active.rot, 2);
  assert.equal(e.state.active.x, 0);
  assert.equal(e.state.active.y, 5);
});

test("SRS: vertical I against the left wall kicks to x=0 when rotating CW", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "I", rot: 1, x: -2, y: 5 }); // R state cells at dx=2 → col 0
  assert.deepEqual(e.dispatch("rotateCW"), [{ type: "rotate" }]);
  assert.equal(e.state.active.rot, 2);
  assert.equal(e.state.active.x, 0);
});

test("SRS: rotation is refused when no kick fits", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  const rows = new Array(E.ROWS).fill("XXXXXXXXXX");
  rows[5] = "....X.X..."; // leave col 5 free in row 5
  rows[6] = "....X.X..."; // and row 6 → a 1-wide vertical slot
  rows[7] = "....X.X...";
  rows[4] = "....X.X...";
  e.setBoard(rows);
  e.setActive({ type: "I", rot: 1, x: 3, y: 4 }); // vertical I in the slot (col 5), rows 4–7
  assert.deepEqual(e.dispatch("rotateCW"), []);
  assert.equal(e.state.active.rot, 1);
  assert.equal(e.state.active.x, 3);
});

test("O never rotates", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "O", rot: 0, x: 3, y: 5 });
  assert.deepEqual(e.dispatch("rotateCW"), []);
  assert.deepEqual(e.dispatch("rotateCCW"), []);
  assert.equal(e.state.active.rot, 0);
});

test("rotateCCW goes 0 → L(3)", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 0, x: 3, y: 5 });
  e.dispatch("rotateCCW");
  assert.equal(e.state.active.rot, 3);
});

test("ghostY is the lowest row the active piece can occupy", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 }); // T rot 0 uses dy 0 and 1
  assert.equal(e.ghostY(), E.ROWS - 2); // 20
  const rows = new Array(E.ROWS).fill("..........");
  rows[10] = "....X.....";
  e.setBoard(rows);
  assert.equal(e.ghostY(), 8); // T row y+1 would hit row 10 at col 4 when y=9
});

test("fnv1a is stable", () => {
  assert.equal(E.fnv1a(""), "811c9dc5");
  assert.equal(E.fnv1a("a"), "e40c292c");
  assert.equal(E.fnv1a("abc").length, 8);
});
