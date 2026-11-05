import { test } from "node:test";
import assert from "node:assert/strict";
import { trackPen, connects, type Pen } from "../lib/air-writing";
function hand(gap: number, x = 0.3) {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  p[0] = { x: 0.5, y: 0.85 };
  p[9] = { x: 0.5, y: 0.45 };
  p[8] = { x, y: 0.3 };
  p[4] = { x: x + gap, y: 0.3 };
  return p;
}
test("pinch writes at mirrored fingertip, open hand lifts pen", () => {
  const p = trackPen(hand(0.05), null)!;
  assert.equal(p.down, true);
  assert.equal(p.x, 0.7);
  assert.equal(p.y, 0.3);
  assert.equal(trackPen(hand(0.25), p)?.down, false);
});
test("pinch hysteresis prevents flickering near threshold", () => {
  const held: Pen = { x: 0.7, y: 0.3, down: true };
  assert.equal(trackPen(hand(0.15), held)?.down, true);
  assert.equal(trackPen(hand(0.15), null)?.down, false);
});
test("missing, tiny or invalid hands do not draw", () => {
  assert.equal(trackPen(undefined, null), null);
  assert.equal(trackPen([], null), null);
  const p = hand(0.05);
  p[0] = p[9];
  assert.equal(trackPen(p, null), null);
  p[8] = { x: NaN, y: 0.2 };
  assert.equal(trackPen(p, null), null);
});
test("lifted pens and large tracking jumps never connect strokes", () => {
  const p: Pen = { x: 0.2, y: 0.3, down: true };
  assert.equal(connects(p, { x: 0.25, y: 0.3, down: true }), true);
  assert.equal(connects(p, { x: 0.8, y: 0.3, down: true }), false);
  assert.equal(connects({ ...p, down: false }, p), false);
  assert.equal(connects(null, p), false);
});
