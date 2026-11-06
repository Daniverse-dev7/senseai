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
