import { test } from "node:test";
import assert from "node:assert/strict";
import { SmoothPen } from "../lib/smooth-pen";
function hand(x: number, gap = 0.04) {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  p[0] = { x: 0.5, y: 0.85 };
  p[9] = { x: 0.5, y: 0.45 };
  p[8] = { x: 1 - x, y: 0.3 };
  p[4] = { x: 1 - x + gap, y: 0.3 };
  return p;
}
test("adaptive filter suppresses stationary jitter while keeping fast strokes close", () => {
  const f = new SmoothPen();
  f.update(hand(0.5), 0);
  let error = 0;
  for (let i = 1; i <= 60; i++) {
    const p = f.update(hand(0.5 + (i % 2 ? 0.004 : -0.004)), (i * 1000) / 60)!;
    error += Math.abs(p.x - 0.5);
  }
  assert.ok(error / 60 < 0.002);
  f.reset();
  let x = 0;
  for (let i = 0; i <= 30; i++)
    x = f.update(hand(0.2 + i * 0.01), (i * 1000) / 30)!.x;
  assert.ok(0.5 - x < 0.025);
});
test("similar trajectories stay consistent across camera frame rates", () => {
  const run = (fps: number) => {
    const f = new SmoothPen();
    let x = 0;
    for (let i = 0; i <= fps; i++)
      x = f.update(hand(0.2 + (0.3 * i) / fps), (i * 1000) / fps)!.x;
    return x;
  };
  assert.ok(Math.abs(run(30) - run(60)) < 0.008);
});
test("release is immediate and lost frames break continuity", () => {
  const f = new SmoothPen();
  f.update(hand(0.5), 0);
  assert.equal(f.update(hand(0.5, 0.25), 33)?.down, false);
  assert.equal(f.update(hand(0.5), 66)?.down, true);
  assert.equal(f.update(hand(0.52), 400)?.down, false);
  assert.equal(f.update(undefined, 433), null);
  assert.equal(f.update(hand(0.7), 466)?.x, 0.7);
});
test("zero stabilization preserves raw coordinates and pinch hysteresis", () => {
  const f = new SmoothPen();
  f.update(hand(0.4), 0, 0);
  assert.ok(Math.abs(f.update(hand(0.43, 0.15), 33, 0)!.x - 0.43) < 1e-12);
  assert.equal(f.update(hand(0.43, 0.15), 66, 0)?.down, true);
  f.reset();
  assert.equal(f.update(hand(0.43, 0.15), 99, 0)?.down, false);
});

test("brief tracking dropout freezes ink and resumes only near the last point", () => {
  const f = new SmoothPen();
  const initial = f.update(hand(0.5), 0)!;
  assert.deepEqual(f.update(undefined, 33), initial);
  assert.equal(f.update(hand(0.51), 66)?.down, true);
  f.update(undefined, 99);
  assert.equal(f.update(hand(0.65), 132)?.down, false);
  assert.equal(f.update(hand(0.65), 165)?.down, true);
});
test("long loss and large jumps lift instead of connecting unrelated positions", () => {
  const f = new SmoothPen();
  f.update(hand(0.4), 0);
  assert.equal(f.update(undefined, 100), null);
  f.update(hand(0.4), 130);
  assert.equal(f.update(hand(0.65), 163)?.down, false);
});
test("borderline pinch flicker holds the tip but a deliberate lift is immediate", () => {
  const f = new SmoothPen();
  const first = f.update(hand(0.5), 0)!;
  assert.deepEqual(f.update(hand(0.52, 0.19), 33), first);
  assert.equal(f.update(hand(0.51, 0.04), 66)?.down, true);
  assert.equal(f.update(hand(0.52, 0.25), 99)?.down, false);
  f.update(hand(0.5), 132);
  f.update(hand(0.5, 0.19), 165);
  assert.equal(f.update(hand(0.5, 0.19), 231)?.down, false);
});

test("movement during ambiguous release cannot reconnect across letters", () => {
  const f = new SmoothPen();
  f.update(hand(0.5), 0);
  f.update(hand(0.51, 0.19), 33);
  assert.equal(f.update(hand(0.6), 66)?.down, false);
});
